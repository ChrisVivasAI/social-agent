import "dotenv/config";
import { DiscordCommandHandler } from "../src/clients/discord/commandHandler.js";

/**
 * Test the new Discord commands: generate-post and view-scheduled
 */
async function testNewDiscordCommands() {
  console.log('🧪 Testing New Discord Commands...\n');

  const commandHandler = new DiscordCommandHandler();

  // Mock Discord context
  const mockContext = {
    userId: 'test-user-123',
    username: 'TestUser',
    channelId: 'test-channel-456',
    messageId: 'test-message-789'
  };

  try {
    // Test 1: Help command (should show new commands)
    console.log('1️⃣ Testing !help command...');
    const helpResponse = await commandHandler.handleCommand('!help', mockContext);
    console.log('✅ Help command response:');
    console.log(helpResponse.substring(0, 400) + '...\n');

    // Test 2: View scheduled posts
    console.log('2️⃣ Testing !view-scheduled command...');
    const viewScheduledResponse = await commandHandler.handleCommand('!view-scheduled', mockContext);
    console.log('✅ View scheduled response:');
    console.log(viewScheduledResponse.substring(0, 300) + '...\n');

    // Test 3: View draft posts
    console.log('3️⃣ Testing !view-scheduled draft command...');
    const viewDraftResponse = await commandHandler.handleCommand('!view-scheduled draft', mockContext);
    console.log('✅ View draft response:');
    console.log(viewDraftResponse.substring(0, 300) + '...\n');

    // Test 4: View all posts
    console.log('4️⃣ Testing !view-scheduled all command...');
    const viewAllResponse = await commandHandler.handleCommand('!view-scheduled all', mockContext);
    console.log('✅ View all response:');
    console.log(viewAllResponse.substring(0, 300) + '...\n');

    // Test 5: Generate post command validation (without actually running it)
    console.log('5️⃣ Testing !generate-post validation...');
    const generateNoUrlResponse = await commandHandler.handleCommand('!generate-post', mockContext);
    console.log('✅ Generate post (no URL) response:');
    console.log(generateNoUrlResponse + '\n');

    const generateInvalidUrlResponse = await commandHandler.handleCommand('!generate-post invalid-url', mockContext);
    console.log('✅ Generate post (invalid URL) response:');
    console.log(generateInvalidUrlResponse + '\n');

    // Test 6: Command parsing for new commands
    console.log('6️⃣ Testing command parsing...');
    const parsed1 = commandHandler.parseCommand('!generate-post https://youtu.be/example');
    const parsed2 = commandHandler.parseCommand('!view-scheduled draft');
    const parsed3 = commandHandler.parseCommand('!scheduled');
    
    console.log('✅ Parsing results:');
    console.log('  !generate-post https://youtu.be/example →', parsed1);
    console.log('  !view-scheduled draft →', parsed2);
    console.log('  !scheduled →', parsed3);
    console.log();

    console.log('🎉 All new Discord command tests completed successfully!');
    console.log();
    console.log('📝 Summary of new commands:');
    console.log('• !generate-post <url> - Generate new post from URL');
    console.log('• !view-scheduled [status] - View posts by status');
    console.log('• !scheduled - Alias for !view-scheduled');
    console.log();
    console.log('💡 Ready to test in Discord! Try:');
    console.log('• !help - See all commands');
    console.log('• !view-scheduled - See scheduled posts');
    console.log('• !generate-post https://youtu.be/your-video - Generate a new post');

  } catch (error) {
    console.error('❌ Error testing new Discord commands:', error);
    console.error('📋 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the test
testNewDiscordCommands().catch(console.error); 