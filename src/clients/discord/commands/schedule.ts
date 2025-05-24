import { CommandDefinition } from '../types.js';
import { EmbedBuilder } from 'discord.js';
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";
import { pendingPosts } from './post.js';

const command: CommandDefinition = {
  name: 'schedule',
  description: 'Schedule a post for publishing',
  usage: '!schedule [post_id] [platform] [date] [time]',
  execute: async ({ message, args }) => {
    // Check if all required arguments were provided
    if (args.length < 4) {
      return message.reply(
        'Please provide all required arguments:\n' +
        '!schedule [post_id] [platform] [date] [time]\n\n' +
        'Example: !schedule abc123 twitter 2023-12-31 14:30'
      );
    }

    const [postId, platform, date, time] = args;
    
    // Check if the platform is valid
    const validPlatforms = ['twitter', 'linkedin', 'discord'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return message.reply(`Invalid platform. Please use one of: ${validPlatforms.join(', ')}`);
    }
    
    // Check if the post exists
    if (!pendingPosts.has(postId)) {
      return message.reply(`Post with ID ${postId} not found. Please check the ID and try again.`);
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return message.reply('Invalid date format. Please use YYYY-MM-DD (e.g. 2023-12-31).');
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time)) {
      return message.reply('Invalid time format. Please use HH:MM (e.g. 14:30).');
    }
    
    // Parse date and time to ensure they're valid
    let scheduledDate: Date;
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      
      // JavaScript months are 0-indexed
      scheduledDate = new Date(year, month - 1, day, hour, minute);
      
      // Check if date is in the past
      if (scheduledDate < new Date()) {
        return message.reply('Cannot schedule posts in the past. Please provide a future date and time.');
      }
      
      // Check if date is too far in the future (e.g., more than 1 year)
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      if (scheduledDate > oneYearFromNow) {
        return message.reply('Cannot schedule posts more than 1 year in advance.');
      }
    } catch (error) {
      return message.reply('Invalid date or time. Please check your input and try again.');
    }

    // Inform the user that scheduling is in progress
    const processingMessage = await message.reply('Scheduling post for publishing...');

    try {
      // Get the post content
      const post = pendingPosts.get(postId)!;
      
      // Connect to LangGraph client
      const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
      const client = new LangGraphClient({
        apiUrl,
      }) as any; // Type assertion to avoid TypeScript errors with SDK
      
      // Calculate seconds until the scheduled date
      const now = new Date();
      const secondsUntilScheduled = Math.floor((scheduledDate.getTime() - now.getTime()) / 1000);
      
      if (secondsUntilScheduled <= 0) {
        await processingMessage.edit({ 
          content: 'Cannot schedule for a time in the past. Please choose a future date and time.' 
        });
        return;
      }
      
      console.log(`Scheduling post for ${scheduledDate.toISOString()} (${secondsUntilScheduled} seconds from now)`);
      
      // Create a thread for the scheduled post first
      const threadResponse = await client.threads.create();
      if (!threadResponse || !threadResponse.thread_id) {
        throw new Error("Failed to create thread for scheduled post");
      }
      
      // Create a run with afterSeconds parameter instead of using schedule method
      const result = await client.runs.create(
        threadResponse.thread_id,
        "publish_post",
        {
          input: {
            post_content: post.content,
            original_url: post.url,
            source_thread_id: post.threadId,
            source_run_id: post.runId
          },
          config: {
            configurable: {
              platform,
            },
          },
          afterSeconds: secondsUntilScheduled
        }
      );
      
      // Remove the post from pending posts
      pendingPosts.delete(postId);
      
      // Create an embed for the scheduled post
      const embed = new EmbedBuilder()
        .setTitle('Post Scheduled')
        .setColor('#00FF00')
        .setDescription('Your post has been scheduled for publishing.')
        .addFields(
          { name: 'Platform', value: platform },
          { name: 'Scheduled Date', value: date },
          { name: 'Scheduled Time', value: time },
          { name: 'Run ID', value: result.run_id || 'Unknown' },
          { name: 'Thread ID', value: threadResponse.thread_id || 'Unknown' }
        );

      // Update the processing message with the scheduled post details
      await processingMessage.edit({
        content: 'Post scheduled successfully!',
        embeds: [embed]
      });
    } catch (error) {
      console.error('Error scheduling post:', error);
      await processingMessage.edit('There was an error scheduling the post. Please try again.');
    }
  }
};

export default command; 