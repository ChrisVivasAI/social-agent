import { CommandDefinition } from '../types.js';
import { EmbedBuilder } from 'discord.js';
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";

const command: CommandDefinition = {
  name: 'delete-scheduled',
  description: 'Delete a scheduled post',
  usage: '!delete-scheduled [cron_id]',
  execute: async ({ message, args }) => {
    // Check if a cron ID was provided
    if (args.length === 0) {
      return message.reply('Please provide the ID of the scheduled post to delete');
    }

    const cronId = args[0];
    
    // Inform the user that the deletion is in progress
    const processingMessage = await message.reply(`Deleting scheduled post with ID ${cronId}...`);

    try {
      // Connect to LangGraph client
      const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
      const client = new LangGraphClient({
        apiUrl,
      }) as any; // Type assertion to avoid TypeScript errors with SDK
      
      // Delete the scheduled post
      await client.crons.delete(cronId);
      
      // Create an embed for the deleted post
      const embed = new EmbedBuilder()
        .setTitle('Scheduled Post Deleted')
        .setColor('#FF0000')
        .setDescription(`The scheduled post with ID ${cronId} has been deleted.`);

      // Update the processing message
      await processingMessage.edit({
        content: 'Scheduled post deleted successfully!',
        embeds: [embed]
      });
    } catch (error: any) {
      console.error('Error deleting scheduled post:', error);
      await processingMessage.edit(`Error deleting scheduled post: ${error?.message || "Unknown error"}`);
    }
  }
};

export default command; 