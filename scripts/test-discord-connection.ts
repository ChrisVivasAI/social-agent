import "dotenv/config";
import { DiscordClient } from "../src/clients/discord/client.js";

/**
 * Test Discord bot connection and channel setup
 */
async function testDiscordConnection() {
  console.log('🧪 Testing Discord Bot Connection...\n');

  // Check environment variables
  console.log('🔍 Environment Variables:');
  console.log(`  DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`  DISCORD_CHANNEL_ID: ${process.env.DISCORD_CHANNEL_ID || '❌ Not set'}`);
  console.log(`  DISCORD_CHANNEL_NAME: ${process.env.DISCORD_CHANNEL_NAME || '❌ Not set'}`);
  console.log();

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN is required');
    return;
  }

  if (!process.env.DISCORD_CHANNEL_ID && !process.env.DISCORD_CHANNEL_NAME) {
    console.error('❌ Either DISCORD_CHANNEL_ID or DISCORD_CHANNEL_NAME is required');
    return;
  }

  try {
    // Initialize Discord client
    const discordClient = new DiscordClient({
      channelId: process.env.DISCORD_CHANNEL_ID,
      channelName: process.env.DISCORD_CHANNEL_NAME
    });

    // Login to Discord
    console.log('🔐 Logging in to Discord...');
    await discordClient.login();

    console.log('✅ Discord bot connected successfully!');
    console.log();
    console.log('🎯 Next Steps:');
    console.log('1. Go to your Discord channel');
    console.log('2. Type: !help');
    console.log('3. The bot should respond with available commands');
    console.log();
    console.log('💡 If commands don\'t work:');
    console.log('- Check that you\'re in the correct channel');
    console.log('- Verify bot has "Send Messages" and "Read Message History" permissions');
    console.log('- Make sure the bot can see the channel');
    console.log();
    console.log('🔍 Debug Info:');
    console.log(`- Bot will respond to messages starting with "!"`)
    console.log(`- Channel ID: ${process.env.DISCORD_CHANNEL_ID || 'Using channel name'}`);
    console.log(`- Channel Name: ${process.env.DISCORD_CHANNEL_NAME || 'Using channel ID'}`);
    console.log();
    console.log('⏰ Bot will run for 30 seconds for testing...');

    // Keep the bot running for 30 seconds for testing
    setTimeout(async () => {
      console.log('\n🛑 Test completed. Disconnecting...');
      await discordClient.disconnect();
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to connect to Discord:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

// Run the test
testDiscordConnection().catch(console.error); 