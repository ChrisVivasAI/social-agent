import { Client, ClientOptions, Message, Embed, User, TextChannel } from 'discord.js';

// Base message data interface that matches Slack's SimpleSlackMessage
export interface SimpleMessage {
  id: string;
  timestamp: string;
  username?: string;
  user?: string;
  text: string;
  type: string;
  attachments?: string[];
  files?: string[];
}

// Discord-specific message data
export interface DiscordMessageData extends SimpleMessage {
  authorId: string;
  authorUsername: string;
  channelId: string;
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
   * Optional, if not provided a channel name must be provided
   */
  channelId?: string;

  /**
   * The channel name to send messages to by default
   * Optional, if not provided a channel ID must be provided
   */
  channelName?: string;
  
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