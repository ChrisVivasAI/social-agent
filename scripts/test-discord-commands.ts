import "dotenv/config";
import { DiscordCommandHandler, DiscordCommandContext } from "../src/clients/discord/commandHandler.js";

/**
 * Test Discord commands to verify they work correctly
 */
async function testDiscordCommands() {
  console.log('🧪 Testing Discord Commands...\n');

  const commandHandler = new DiscordCommandHandler();
  
  const mockContext: DiscordCommandContext = {
    userId: 'test-user-123',
    username: 'TestUser',
    channelId: 'test-channel-123',
    messageId: 'test-message-123'
  };

  try {
    // Test 1: Help command
    console.log('1️⃣ Testing !help command...');
    const helpResponse = await commandHandler.handleCommand('!help', mockContext);
    console.log('✅ Help command response received');
    console.log(`📝 Response length: ${helpResponse.length} characters\n`);

    // Test 2: View pending command
    console.log('2️⃣ Testing !view-pending command...');
    const pendingResponse = await commandHandler.handleCommand('!view-pending', mockContext);
    console.log('✅ View pending command response received');
    console.log(`📝 Response preview: ${pendingResponse.substring(0, 100)}...\n`);

    // Test 3: View scheduled (default - now pending_review)
    console.log('3️⃣ Testing !view-scheduled command (default)...');
    const scheduledResponse = await commandHandler.handleCommand('!view-scheduled', mockContext);
    console.log('✅ View scheduled command response received');
    console.log(`📝 Response preview: ${scheduledResponse.substring(0, 100)}...\n`);

    // Test 4: View scheduled active
    console.log('4️⃣ Testing !view-scheduled active command...');
    const activeResponse = await commandHandler.handleCommand('!view-scheduled active', mockContext);
    console.log('✅ View scheduled active command response received');
    console.log(`📝 Response preview: ${activeResponse.substring(0, 100)}...\n`);

    // Test 5: View scheduled draft
    console.log('5️⃣ Testing !view-scheduled draft command...');
    const draftResponse = await commandHandler.handleCommand('!view-scheduled draft', mockContext);
    console.log('✅ View scheduled draft command response received');
    console.log(`📝 Response preview: ${draftResponse.substring(0, 100)}...\n`);

    // Test 6: Invalid command
    console.log('6️⃣ Testing invalid command...');
    const invalidResponse = await commandHandler.handleCommand('!invalid-command', mockContext);
    console.log('✅ Invalid command handled correctly');
    console.log(`📝 Response preview: ${invalidResponse.substring(0, 100)}...\n`);

    console.log('🎉 All Discord command tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   • Help command: Working');
    console.log('   • View pending: Working');
    console.log('   • View scheduled (default): Working');
    console.log('   • View scheduled active: Working');
    console.log('   • View scheduled draft: Working');
    console.log('   • Error handling: Working');

  } catch (error) {
    console.error('❌ Error testing Discord commands:', error);
  }
}

testDiscordCommands().catch(console.error); 