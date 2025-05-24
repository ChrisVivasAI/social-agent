import { DiscordClient } from './client.js';
export * from './types.js';
export { pendingPosts } from './commands/post.js';

/**
 * Create a Discord client instance
 */
export function createDiscordClient(options = {}) {
  return new DiscordClient(options);
}

export { DiscordClient }; 