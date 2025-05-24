import "dotenv/config";
import { createDiscordClient } from "../src/clients/discord/index.js";

/**
 * Test Discord integration
 * This script will:
 * 1. Connect to Discord
 * 2. Send a test message to the specified channel
 * 3. List recent messages
 */
async function testDiscord() {
  console.log("Testing Discord integration...");

  // Get Discord bot token from environment variables
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("DISCORD_BOT_TOKEN is not defined in environment variables");
    process.exit(1);
  }

  // Get Discord channel name or ID from environment variables
  const channelName = process.env.DISCORD_CHANNEL_NAME;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  
  if (!channelName && !channelId) {
    console.error("Either DISCORD_CHANNEL_NAME or DISCORD_CHANNEL_ID must be defined in environment variables");
    process.exit(1);
  }
  
  try {
    // Create Discord client
    console.log("Creating Discord client...");
    const discord = createDiscordClient({
      token,
      channelName,
      channelId
    });
    
    // Wait for client to be ready - added longer timeout
    console.log("Waiting for Discord client to be ready...");
    // Instead of a fixed timeout, let's get the client and wait for the ready event
    const client = discord.getClient();
    if (!client.isReady()) {
      console.log("Client not ready, waiting for ready event...");
      await new Promise(resolve => {
        client.once('ready', () => {
          console.log("Client ready event received!");
          resolve(null);
        });
        // Add a timeout just in case
        setTimeout(resolve, 10000);
      });
    } else {
      console.log("Client already ready!");
    }
    
    // Send a test message
    console.log("Sending test message...");
    await discord.sendMessage("Discord integration test: " + new Date().toLocaleString());
    
    // List recent messages
    console.log("Fetching recent messages...");
    const messages = await discord.fetchLast24HoursMessages({ maxMessages: 10 });
    
    console.log(`Retrieved ${messages.length} messages:`);
    messages.forEach(msg => {
      console.log(`[${new Date(Number(msg.timestamp)).toLocaleString()}] ${msg.username}: ${msg.text}`);
    });
    
    // Disconnect
    console.log("Disconnecting...");
    await discord.disconnect();
    
    console.log("Discord integration test completed successfully!");
  } catch (error) {
    console.error("Error testing Discord integration:", error);
  }
}

testDiscord().catch(console.error); 