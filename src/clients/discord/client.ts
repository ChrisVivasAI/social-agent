import { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  Events, 
  Message, 
  TextChannel,
  MessagePayload,
  MessageCreateOptions,
  ChannelType,
  Collection as DiscordCollection,
  FetchMessagesOptions
} from 'discord.js';
import path from 'path';
import fs from 'fs';
import moment from 'moment';
import { fileURLToPath } from 'url';
import { DiscordClientArgs, DiscordMessageData, CommandDefinition, SimpleMessage } from './types.js';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Wrapper around Discord.js for interacting with Discord
 * Required intents: Guilds, GuildMessages, MessageContent
 */
export class DiscordClient {
  private client: Client;
  private channelId: string;
  private channelName: string;
  private commands: Collection<string, CommandDefinition>;
  private ready: boolean = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor(args: DiscordClientArgs = {}) {
    if (!args.channelId && !args.channelName) {
      throw new Error("Either channelId or channelName must be provided");
    }

    // Set up client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
      ...args.clientOptions
    });

    this.channelId = args.channelId || "";
    this.channelName = args.channelName || "";
    this.commands = new Collection();
    
    // Create a promise that resolves when the client is ready
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Set up commands
    this.loadCommands();

    // Connect to Discord
    const token = args.token || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('Discord bot token not provided');
    }
    this.client.login(token);
  }

  /**
   * Set up Discord client event handlers
   */
  private setupEventHandlers(): void {
    // Client ready event
    this.client.once(Events.ClientReady, client => {
      console.log(`Discord bot logged in as ${client.user.tag}`);
      this.ready = true;
      this.readyResolve();
    });

    // Message creation event for command handling
    this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
  }

  /**
   * Load command modules from the commands directory
   */
  private loadCommands(): void {
    const commandsDir = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
      console.warn(`Commands directory ${commandsDir} does not exist`);
      return;
    }

    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
    
    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsDir, file);
        import(filePath).then(commandModule => {
          if (commandModule.default && typeof commandModule.default === 'object') {
            const command = commandModule.default as CommandDefinition;
            this.commands.set(command.name, command);
            console.log(`Loaded command: ${command.name}`);
          }
        }).catch(error => {
          console.error(`Error loading command file ${file}:`, error);
        });
      } catch (error) {
        console.error(`Error loading command file ${file}:`, error);
      }
    }
  }

  /**
   * Handle incoming messages and execute commands
   */
  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = this.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute({ message, args, client: this.client });
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await message.reply('There was an error executing that command.');
    }
  }

  /**
   * Convert Discord message to simple message format
   */
  private convertToSimpleMessage(message: Message): SimpleMessage {
    return {
      id: message.id,
      timestamp: message.createdTimestamp.toString(),
      username: message.author.username,
      user: message.author.id,
      text: message.content,
      type: 'message',
      attachments: message.attachments.map(attachment => attachment.url),
      files: message.attachments.map(attachment => attachment.url)
    };
  }

  /**
   * Fetch messages from the last 24 hours
   */
  async fetchLast24HoursMessages({
    maxMessages,
    maxDaysHistory,
  }: {
    maxMessages?: number;
    maxDaysHistory?: number;
  }): Promise<SimpleMessage[]> {
    await this.ensureReady();

    if (!this.channelId) {
      this.channelId = await this.getChannelId(this.channelName);
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error(`Channel ${this.channelId} is not a text channel`);
      }

      const getHours = maxDaysHistory !== undefined ? maxDaysHistory * 24 : 24;
      const oldestTimestamp = moment().subtract(getHours, 'hours').valueOf(); // Get timestamp in milliseconds
      
      const messages: Message[] = [];
      let lastId: string | undefined;

      do {
        const options: FetchMessagesOptions = { limit: 100 };
        if (lastId) {
          options.before = lastId;
        }

        // fetchedMessages is a Collection<Snowflake, Message>
        const fetchedMessages: DiscordCollection<string, Message> = await channel.messages.fetch(options);
        
        const messageArray = Array.from(fetchedMessages.values());
        
        const filteredMessages = messageArray.filter(msg => msg.createdTimestamp >= oldestTimestamp);

        messages.push(...filteredMessages);

        if (messageArray.length > 0) {
          const lastMessage = messageArray[messageArray.length - 1];
          if (lastMessage) {
            lastId = lastMessage.id;
          } else {
            // Should not happen if messageArray.length > 0
            break; 
          }
        } else {
          // No messages fetched in this batch
          break;
        }
        
        // Stop if we have enough messages or no more messages are being returned
        if ((maxMessages && messages.length >= maxMessages) || messageArray.length < 100 || filteredMessages.length === 0) {
          break;
        }
      } while (true); // Loop will be broken by conditions inside

      return messages
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp) // Sort by newest first
        .slice(0, maxMessages) // Ensure we don't exceed maxMessages
        .map(msg => this.convertToSimpleMessage(msg));
    } catch (error) {
      console.error("Error fetching Discord messages:", error);
      throw error;
    }
  }

  /**
   * Get channel ID from channel name
   */
  async getChannelId(name?: string): Promise<string> {
    await this.ensureReady();

    const channelName = name || this.channelName;
    if (!channelName) {
      throw new Error("Channel name not provided in method arguments, or found in client instance.");
    }

    try {
      const guilds = await this.client.guilds.fetch();
      
      for (const guild of guilds.values()) {
        const fullGuild = await guild.fetch();
        const channels = await fullGuild.channels.fetch();
        
        const channel = channels.find(c => 
          c?.type === ChannelType.GuildText && 
          c.name === channelName
        );

        if (channel) {
          return channel.id;
        }
      }

      throw new Error(`Channel ${channelName} not found`);
    } catch (error) {
      console.error("Error getting channel ID:", error);
      throw error;
    }
  }

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(message: string): Promise<void> {
    await this.ensureReady();

    if (!this.channelId) {
      this.channelId = await this.getChannelId(this.channelName);
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error(`Channel ${this.channelId} is not a text channel`);
      }

      await channel.send(message);
    } catch (error) {
      console.error('Error sending message to Discord:', error);
      throw error;
    }
  }

  /**
   * Ensure the client is ready before performing operations
   */
  private async ensureReady(): Promise<void> {
    if (!this.ready) {
      await this.readyPromise;
    }
  }

  /**
   * Get the Discord client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Gracefully disconnect the client
   */
  async disconnect(): Promise<void> {
    await this.client.destroy();
    console.log('Discord client disconnected');
  }
} 