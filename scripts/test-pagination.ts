import "dotenv/config";
import { DiscordCommandHandler, DiscordCommandContext } from "../src/clients/discord/commandHandler.js";

/**
 * Test pagination functionality for Discord commands
 */
async function testPagination() {
  console.log('🧪 Testing Discord Command Pagination...\n');

  const commandHandler = new DiscordCommandHandler();
  
  const mockContext: DiscordCommandContext = {
    userId: 'test-user-123',
    username: 'TestUser',
    channelId: 'test-channel-123',
    messageId: 'test-message-123'
  };

  try {
    console.log('1️⃣ Testing !view-scheduled all (should be limited to 5 posts)...');
    console.log('='.repeat(60));
    const allResponse = await commandHandler.handleCommand('!view-scheduled all', mockContext);
    console.log(allResponse);
    console.log('='.repeat(60));
    console.log(`📊 Response length: ${allResponse.length} characters`);
    console.log(`✅ Under Discord limit (2000): ${allResponse.length < 2000}`);
    console.log();

    console.log('2️⃣ Testing !help command (should fit in Discord limit)...');
    console.log('='.repeat(60));
    const helpResponse = await commandHandler.handleCommand('!help', mockContext);
    console.log(helpResponse);
    console.log('='.repeat(60));
    console.log(`📊 Response length: ${helpResponse.length} characters`);
    console.log(`✅ Under Discord limit (2000): ${helpResponse.length < 2000}`);

  } catch (error) {
    console.error('❌ Error testing pagination:', error);
  }
}

testPagination().catch(console.error); 