import "dotenv/config";
import { DiscordCommandHandler, DiscordCommandContext } from "../src/clients/discord/commandHandler.js";

/**
 * Test Discord commands with full output to see exactly what users would see
 */
async function testLiveDiscordCommands() {
  console.log('🧪 Testing Live Discord Commands with Full Output...\n');

  const commandHandler = new DiscordCommandHandler();
  
  const mockContext: DiscordCommandContext = {
    userId: 'test-user-123',
    username: 'TestUser',
    channelId: 'test-channel-123',
    messageId: 'test-message-123'
  };

  try {
    // Test the exact commands a user would run
    console.log('1️⃣ Testing !view-scheduled (what user sees by default)...');
    console.log('='.repeat(60));
    const scheduledResponse = await commandHandler.handleCommand('!view-scheduled', mockContext);
    console.log(scheduledResponse);
    console.log('='.repeat(60));
    console.log();

    console.log('2️⃣ Testing !view-pending (new command)...');
    console.log('='.repeat(60));
    const pendingResponse = await commandHandler.handleCommand('!view-pending', mockContext);
    console.log(pendingResponse);
    console.log('='.repeat(60));
    console.log();

    console.log('3️⃣ Testing !view-scheduled active (combined view)...');
    console.log('='.repeat(60));
    const activeResponse = await commandHandler.handleCommand('!view-scheduled active', mockContext);
    console.log(activeResponse);
    console.log('='.repeat(60));
    console.log();

    console.log('4️⃣ Testing !view-scheduled draft...');
    console.log('='.repeat(60));
    const draftResponse = await commandHandler.handleCommand('!view-scheduled draft', mockContext);
    console.log(draftResponse);
    console.log('='.repeat(60));
    console.log();

    console.log('🎯 Analysis:');
    console.log(`• Default !view-scheduled response length: ${scheduledResponse.length} chars`);
    console.log(`• !view-pending response length: ${pendingResponse.length} chars`);
    console.log(`• !view-scheduled active response length: ${activeResponse.length} chars`);
    console.log(`• !view-scheduled draft response length: ${draftResponse.length} chars`);
    
    // Check if responses contain the recent post ID
    const recentPostId = 'f8191f93-d5c0-4c7b-ae5a-d167a53364ae';
    console.log(`\n🔍 Checking for recent post ID (${recentPostId}):`);
    console.log(`• Found in !view-scheduled: ${scheduledResponse.includes(recentPostId)}`);
    console.log(`• Found in !view-pending: ${pendingResponse.includes(recentPostId)}`);
    console.log(`• Found in !view-scheduled active: ${activeResponse.includes(recentPostId)}`);

  } catch (error) {
    console.error('❌ Error testing Discord commands:', error);
  }
}

testLiveDiscordCommands().catch(console.error); 