import "dotenv/config";
import { DiscordClient } from "../src/clients/discord/client.js";

/**
 * Start the Discord bot with command handling
 */
async function startDiscordBot() {
  console.log('🤖 Starting Discord Bot with Enhanced Command Handler...\n');

  // Check required environment variables
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!process.env.DISCORD_CHANNEL_ID && !process.env.DISCORD_CHANNEL_NAME) {
    console.error('❌ Either DISCORD_CHANNEL_ID or DISCORD_CHANNEL_NAME environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize Discord client
    const discordClient = new DiscordClient({
      channelId: process.env.DISCORD_CHANNEL_ID,
      channelName: process.env.DISCORD_CHANNEL_NAME
    });

    // Login to Discord
    await discordClient.login();

    console.log('🎉 Discord bot is now running and ready to process commands!');
    console.log('📝 Available commands:');
    console.log('   • !generate-post <url> - Generate new post from URL');
    console.log('   • !view-scheduled [status] - View scheduled/draft posts');
    console.log('   • !help - Show available commands');
    console.log('   • !review-post <post-id> - Review a post');
    console.log('   • !schedule-post <post-id> [time] - Schedule a post');
    console.log('   • !select-image <post-id> <number> - Select an image');
    console.log('   • !publish-now <post-id> - Publish immediately');
    console.log('   • !cancel-post <post-id> - Cancel a post');
    console.log();
    console.log('💡 Try typing "!help" in your Discord channel to test!');
    console.log('🚀 Or generate a new post with "!generate-post <youtube-url>"');
    console.log('🔗 Channel:', process.env.DISCORD_CHANNEL_ID || process.env.DISCORD_CHANNEL_NAME);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Discord bot...');
      await discordClient.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Discord bot...');
      await discordClient.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Discord bot:', error);
    process.exit(1);
  }
}

// Start the bot
startDiscordBot().catch(console.error); 