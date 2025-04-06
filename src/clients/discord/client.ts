import { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  Events, 
  Message, 
  TextChannel,
  MessagePayload,
  MessageCreateOptions 
} from 'discord.js';
import path from 'path';
import fs from 'fs';
import { DiscordClientArgs, DiscordMessageData, CommandDefinition } from './types.js';

/**
 * Wrapper around Discord.js for interacting with Discord
 * Required intents: Guilds, GuildMessages, MessageContent
 */
export class DiscordClient {
  private client: Client;
  private defaultChannelId?: string;
  private commands: Collection<string, CommandDefinition>;
  private ready: boolean = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor(args: DiscordClientArgs = {}) {
    // Set up client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
      ...args.clientOptions
    });

    this.defaultChannelId = args.defaultChannelId;
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
        // Using require.resolve for TypeScript compatibility
        const filePath = path.join(commandsDir, file);
        // Dynamic import for ESM compatibility
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
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message starts with the command prefix
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    // Parse the command and arguments
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    // Check if the command exists
    const command = this.commands.get(commandName);
    if (!command) return;

    // Execute the command
    try {
      await command.execute({ message, args, client: this.client });
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await message.reply('There was an error executing that command.');
    }
  }

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(content: string | MessagePayload | MessageCreateOptions, channelId?: string): Promise<Message> {
    await this.ensureReady();
    
    const targetChannelId = channelId || this.defaultChannelId;
    if (!targetChannelId) {
      throw new Error('No channel ID provided');
    }

    try {
      const channel = await this.client.channels.fetch(targetChannelId);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error(`Channel ${targetChannelId} is not a text channel`);
      }

      return await channel.send(content);
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
   * Convert a Discord message to a simplified format
   */
  convertToMessageData(message: Message): DiscordMessageData {
    return {
      id: message.id,
      content: message.content,
      authorId: message.author.id,
      authorUsername: message.author.username,
      timestamp: message.createdAt,
      channelId: message.channelId,
      attachments: message.attachments.map(attachment => attachment.url),
      embeds: message.embeds.map(embed => embed)
    };
  }

  /**
   * Gracefully disconnect the client
   */
  async disconnect(): Promise<void> {
    await this.client.destroy();
    console.log('Discord client disconnected');
  }
} 