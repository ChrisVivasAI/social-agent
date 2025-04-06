import { Client, ClientOptions, Message, Embed, User } from 'discord.js';

export interface DiscordMessageData {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  timestamp: Date;
  channelId: string;
  attachments: string[];
  embeds: Embed[];
}

export interface DiscordClientArgs {
  /**
   * Discord bot token
   * If not provided, the token will be read from the DISCORD_BOT_TOKEN environment variable.
   */
  token?: string;
  
  /**
   * The channel ID to send messages to by default
   * Optional, if not provided a channel ID must be specified when sending messages
   */
  defaultChannelId?: string;
  
  /**
   * Discord client options
   */
  clientOptions?: ClientOptions;
}

export interface CommandExecuteArgs {
  message: Message;
  args: string[];
  client: Client;
}

export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  execute: (args: CommandExecuteArgs) => Promise<any>;
}

export interface ButtonInteraction {
  id: string;
  execute: (interaction: any) => Promise<void>;
}

export interface SelectMenuInteraction {
  id: string;
  execute: (interaction: any) => Promise<void>;
} 