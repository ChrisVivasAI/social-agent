import { CommandDefinition } from '../types.js';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";
import { format } from 'date-fns';

const command: CommandDefinition = {
  name: 'scheduled',
  description: 'View scheduled posts',
  usage: '!scheduled',
  execute: async ({ message }) => {
    // Inform the user that we're fetching scheduled posts
    const processingMessage = await message.reply('Fetching scheduled posts...');

    try {
      // Connect to LangGraph client
      const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
      const client = new LangGraphClient({
        apiUrl,
      });

      // In the newer SDK, we need to search for threads with metadata for scheduled posts
      // rather than using crons.search which doesn't exist
      const threads = await (client as any).threads.search({
        metadata: {
          graph_id: "publish_post", // or "upload_post" - depends on your graph naming
        },
        status: "busy", // Threads with runs that are pending/scheduled
      });

      if (!threads || threads.length === 0) {
        await processingMessage.edit('No scheduled posts found.');
        return;
      }

      // Create an embed for each scheduled post
      const embeds = [];
      
      // Process each thread to find scheduled runs
      for await (const thread of threads) {
        try {
          // Get runs for this thread
          const runs = await client.runs.list(thread.thread_id);
          
          if (!runs || runs.length === 0) continue;
          
          // Check if any of these runs are scheduled for the future
          for (const run of runs) {
            const runDetails = run as any; // Type assertion for flexibility
            
            // Try to determine if this is a scheduled run
            const isScheduled = runDetails.scheduled_at || 
                               (runDetails.kwargs && runDetails.kwargs.afterSeconds) ||
                               (runDetails.status === "pending" && runDetails.created_at);
            
            if (!isScheduled) continue;
            
            // Extract platform information
            const platform = runDetails.config?.configurable?.platform || 
                             (runDetails.kwargs?.config?.configurable?.platform) || 
                             'Unknown';
            
            // Extract post content if available
            let postContent = 'Content not available';
            let inputData = runDetails.kwargs?.input || runDetails.input;
            
            if (inputData) {
              if (typeof inputData.post_content === 'string') {
                postContent = inputData.post_content.substring(0, 100) + '...';
              } else if (typeof inputData.post === 'string') {
                postContent = inputData.post.substring(0, 100) + '...';
              }
            }
            
            // Determine scheduled time
            let scheduledTime = 'Unknown time';
            if (runDetails.scheduled_at) {
              scheduledTime = new Date(runDetails.scheduled_at).toLocaleString();
            } else if (runDetails.created_at && runDetails.kwargs?.afterSeconds) {
              const createdDate = new Date(runDetails.created_at);
              const scheduledDate = new Date(createdDate.getTime() + (runDetails.kwargs.afterSeconds * 1000));
              scheduledTime = scheduledDate.toLocaleString();
            }
            
            const embed = new EmbedBuilder()
              .setTitle(`Scheduled Post (${runDetails.run_id || runDetails.id})`)
              .setColor('#0099ff')
              .addFields(
                { name: 'Thread ID', value: thread.thread_id },
                { name: 'Scheduled Time', value: scheduledTime },
                { name: 'Platform', value: platform },
                { name: 'Content Preview', value: postContent }
              );
            
            embeds.push(embed);
          }
        } catch (error) {
          console.error(`Error processing thread ${thread.thread_id}:`, error);
        }
      }
      
      if (embeds.length === 0) {
        await processingMessage.edit('No scheduled posts found.');
        return;
      }
      
      // Update the processing message with the scheduled posts
      // Discord only allows up to 10 embeds per message
      if (embeds.length <= 10) {
        await processingMessage.edit({
          content: 'Here are the scheduled posts:',
          embeds
        });
      } else {
        // If more than 10 embeds, send multiple messages
        await processingMessage.edit({
          content: `Found ${embeds.length} scheduled posts. Showing first 10:`,
          embeds: embeds.slice(0, 10)
        });
        
        // Send remaining embeds in batches of 10
        for (let i = 10; i < embeds.length; i += 10) {
          const batch = embeds.slice(i, i + 10);
          // Cast the channel to TextChannel to ensure send method exists
          if (message.channel instanceof TextChannel) {
            await message.channel.send({
              content: `Continued (${i+1}-${Math.min(i+10, embeds.length)} of ${embeds.length}):`,
              embeds: batch
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      await processingMessage.edit('There was an error fetching scheduled posts. Please try again.');
    }
  }
};

export default command; 