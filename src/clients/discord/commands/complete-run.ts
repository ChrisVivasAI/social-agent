import { CommandDefinition } from '../types.js';
import { EmbedBuilder } from 'discord.js';
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";

const command: CommandDefinition = {
  name: 'complete-run',
  description: 'Manually complete a LangGraph run that timed out',
  usage: '!complete-run [run_id] [thread_id]',
  execute: async ({ message, args }) => {
    // Check if run ID and thread ID were provided
    if (args.length < 2) {
      return message.reply(
        'Please provide both the run ID and thread ID.\n' +
        'Usage: `!complete-run [run_id] [thread_id]`'
      );
    }

    const runId = args[0];
    const threadId = args[1];
    
    // Inform the user that completion is in progress
    const processingMessage = await message.reply(`Attempting to complete run ${runId}...`);

    try {
      // Connect to LangGraph client
      const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
      const client = new LangGraphClient({
        apiUrl,
      }) as any; // Type assertion to avoid TypeScript errors with SDK
      
      // Get the current run status
      const runStatus = await client.runs.get(threadId, runId);
      
      if (!runStatus) {
        await processingMessage.edit(`Error: Could not find run with ID ${runId} in thread ${threadId}`);
        return;
      }
      
      // Create an embed to show run details
      const statusEmbed = new EmbedBuilder()
        .setTitle('Run Status')
        .setColor('#0099ff')
        .addFields(
          { name: 'Run ID', value: runId, inline: true },
          { name: 'Thread ID', value: threadId, inline: true },
          { name: 'Status', value: runStatus.status || 'Unknown', inline: true }
        )
        .setTimestamp();
      
      // If run is already completed, just show the status
      if (runStatus.status === 'completed') {
        await processingMessage.edit({ 
          content: 'This run is already completed.',
          embeds: [statusEmbed]
        });
        return;
      }
      
      // If run needs human action, try to get human task details
      if (runStatus.status === 'requires_action') {
        try {
          // Try to list human tasks for this run
          const humanTasks = await client.runs.listHumanTasks(threadId, runId);
          
          if (humanTasks && humanTasks.length > 0) {
            // Get the first human task
            const task = humanTasks[0];
            
            // Add task details to the embed
            statusEmbed.addFields(
              { name: 'Task Type', value: task.type || 'Unknown', inline: true },
              { name: 'Task ID', value: task.id || 'Unknown', inline: true },
              { name: 'Created At', value: new Date(task.created_at).toLocaleString(), inline: true },
              { name: 'Task Details', value: task.details || 'No details available' }
            );
            
            // Try to complete the task
            await processingMessage.edit({
              content: 'Attempting to complete human task...',
              embeds: [statusEmbed]
            });
            
            // Submit the human task (this will vary depending on the task type)
            await client.runs.submitHumanTask(threadId, runId, task.id, {
              output: {
                approved: true,
                feedback: "Approved via Discord command"
              }
            });
            
            // Check if the run completed
            const updatedStatus = await client.runs.get(threadId, runId);
            
            if (updatedStatus.status === 'completed') {
              await processingMessage.edit({
                content: '✅ Successfully completed the run!',
                embeds: [statusEmbed]
              });
            } else {
              await processingMessage.edit({
                content: `Task submitted, but run status is now: ${updatedStatus.status}`,
                embeds: [statusEmbed]
              });
            }
            return;
          }
        } catch (taskError) {
          console.error('Error handling human task:', taskError);
          // Continue with the general completion attempt
        }
      }
      
      // Attempt to force completion (this may only work in certain cases)
      try {
        await processingMessage.edit({
          content: 'No specific human task found. Attempting to force completion...',
          embeds: [statusEmbed]
        });
        
        // Try different methods that might complete the run
        try {
          // Method 1: Try to patch the run status directly
          await client.runs.update(threadId, runId, { status: 'completed' });
        } catch (method1Error) {
          console.error('Method 1 failed:', method1Error);
          
          // Method 2: Try to submit a generic "done" event
          try {
            await client.runs.submitEvent(threadId, runId, {
              event_type: 'done',
              data: { message: 'Manually completed via Discord' }
            });
          } catch (method2Error) {
            console.error('Method 2 failed:', method2Error);
            
            // Method 3: Try to cancel and restart
            try {
              await client.runs.cancel(threadId, runId);
              // After cancelling, you might want to create a new run instead
            } catch (method3Error) {
              console.error('Method 3 failed:', method3Error);
              throw new Error('All completion methods failed');
            }
          }
        }
        
        // Check final status
        const finalStatus = await client.runs.get(threadId, runId);
        
        statusEmbed.addFields(
          { name: 'New Status', value: finalStatus.status || 'Unknown', inline: true }
        );
        
        await processingMessage.edit({
          content: finalStatus.status === 'completed' 
            ? '✅ Successfully completed the run!' 
            : `Run status after attempt: ${finalStatus.status}`,
          embeds: [statusEmbed]
        });
      } catch (forceError) {
        console.error('Error forcing completion:', forceError);
        await processingMessage.edit({
          content: 'Failed to complete the run. Please check LangGraph Studio UI.',
          embeds: [statusEmbed]
        });
      }
    } catch (error: any) {
      console.error('Error completing run:', error);
      await processingMessage.edit(`Error completing run: ${error.message || 'Unknown error'}`);
    }
  }
};

export default command; 