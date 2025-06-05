import "dotenv/config";
import { REST, Routes } from 'discord.js';

/**
 * Clear all registered slash commands to prevent conflicts
 */
async function clearSlashCommands() {
  console.log('🧹 Clearing Discord Slash Commands...\n');

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  try {
    console.log('🔍 Fetching application info...');
    
    // Get application ID
    const application = await rest.get(Routes.oauth2CurrentApplication()) as any;
    const applicationId = application.id;
    
    console.log(`📱 Application ID: ${applicationId}`);

    // Clear global commands
    console.log('🌍 Clearing global slash commands...');
    await rest.put(Routes.applicationCommands(applicationId), { body: [] });
    console.log('✅ Global slash commands cleared');

    // Clear guild commands (if any)
    console.log('🏠 Clearing guild-specific slash commands...');
    
    // Get all guilds the bot is in
    const guilds = await rest.get(Routes.userGuilds()) as any[];
    
    for (const guild of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(applicationId, guild.id), { body: [] });
        console.log(`✅ Cleared commands for guild: ${guild.name} (${guild.id})`);
      } catch (error) {
        console.log(`⚠️ Could not clear commands for guild ${guild.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('\n🎉 All slash commands have been cleared!');
    console.log('💡 You can now use regular message commands like "!help" instead of "/help"');
    
  } catch (error) {
    console.error('❌ Error clearing slash commands:', error);
    process.exit(1);
  }
}

// Run the script
clearSlashCommands().catch(console.error); 