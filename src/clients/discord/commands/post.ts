import { CommandDefinition } from '../types.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";

// Store generated content for approval
interface GeneratedPost {
  content: string;
  url: string;
  threadId: string;
  runId: string;
  timestamp: number;
  report?: string;
  relevantLinks?: string[];
  imageOptions?: string[];
  imageUrl?: string;
  scheduleDate?: string | Date;
  platform?: string;
  scheduleId?: string; // ID returned by LangGraph for scheduled posts
}

// In-memory store for generated posts (in production, use a database)
const pendingPosts = new Map<string, GeneratedPost>();

// Function to generate a unique post ID
function generatePostId(): string {
  return Math.random().toString(36).substring(2, 10);
}

const command: CommandDefinition = {
  name: 'post',
  description: 'Generate a post from a URL',
  usage: '!post [url]',
  execute: async ({ message, args }) => {
    // Check if a URL was provided
    if (args.length === 0) {
      return message.reply('Please provide a URL to generate a post from');
    }

    const url = args[0];
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return message.reply('Please provide a valid URL');
    }

    // Inform the user that post generation is in progress
    const processingMessage = await message.reply('Generating post from URL. This may take a moment...');

    try {
      // Connect to LangGraph client
      const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
      const client = new LangGraphClient({
        apiUrl,
      }) as any; // Type assertion to avoid TypeScript errors with SDK
      
      // Create a new thread
      const { thread_id } = await client.threads.create();
      
      // Create a run with the URL as input
      const runResponse = await client.runs.create(thread_id, "generate_post", {
        input: {
          links: [url],
        },
        config: {
          configurable: {
            platform: "discord",
          },
        },
      });
      
      // Poll for completion (this could be moved to a background process in production)
      let runStatus;
      let attempts = 0;
      const maxAttempts = 300; // 50 minutes (polling every 10 seconds)
      let humanNodeDetected = false;
      let lastStatusMessage = "";
      
      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          runStatus = await client.runs.get(thread_id, runResponse.id);
          const status = runStatus?.status || runStatus?.state || "unknown";
          
          // Only log if status changed
          if (lastStatusMessage !== status) {
            console.log(`Run status changed to: ${status}`);
            lastStatusMessage = status;
          }
          
          if (status === "completed" || status === "success") {
            console.log("Run completed successfully!");
            break;
          } else if (status === "failed" || status === "error") {
            const errorMessage = runStatus.error || "Unknown error";
            console.error(`Error generating post: ${errorMessage}`);
            await processingMessage.edit(`Error generating post: ${errorMessage}`);
            return;
          } else if (status === "requires_action") {
            // Human in the loop detected - update message to inform user
            if (!humanNodeDetected) {
              humanNodeDetected = true;
              
              // Create a LangGraph Studio URL if LANGGRAPH_STUDIO_URL is defined
              let langGraphStudioUrl = '';
              if (process.env.LANGGRAPH_STUDIO_URL) {
                langGraphStudioUrl = `${process.env.LANGGRAPH_STUDIO_URL.replace(/\/+$/, '')}/projects/my_projects/inbox`;
                
                await processingMessage.edit(
                  `Your post is being processed in the human review step. ` +
                  `\n\n**Please review and approve it here:**\n${langGraphStudioUrl}\n\n` +
                  `Once approved, the content will appear here. Run ID: \`${runResponse.id}\``
                );
              } else {
                await processingMessage.edit(
                  `Your post is being processed in the human review step. ` +
                  `Please check the LangGraph Studio UI to review and approve it. ` +
                  `Once approved, the content will appear here. Run ID: \`${runResponse.id}\``
                );
              }
            }
          }
        } catch (err) {
          console.error(`Error checking run status (attempt ${attempts}):`, err);
          // Continue polling despite errors - the run might still be processing
        }
        
        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Update the message every few attempts to show progress, but only if we're not in human review
        if (attempts % 3 === 0 && !humanNodeDetected) {
          await processingMessage.edit(`Generating post from URL... (${attempts * 10}s elapsed)`);
        }
      }
      
      if (attempts >= maxAttempts) {
        const messageContent = 
          "Timed out while waiting for post completion. The process may still be running. " +
          `View it in LangGraph Studio directly. Run ID: \`${runResponse.id}\`\n` +
          "You can try the following:\n" +
          "1. Check LangGraph Studio UI to see if your post is ready\n" +
          "2. Use `!complete-run " + runResponse.id + " " + thread_id + "` to manually complete it\n" +
          "3. Use `!post` command again later to try a new post";
        
        await processingMessage.edit(messageContent);
        return;
      }
      
      // Fetch the generated content from the thread
      const messages = await client.threads.messages.list(thread_id);
      
      if (!messages.data || messages.data.length === 0) {
        await processingMessage.edit("No content was generated. Please check the LangGraph logs for details.");
        return;
      }
      
      // Extract text content from the first message
      const message = messages.data[0];
      let content = "";
      let report = "";
      let relevantLinks: string[] = [];
      let imageOptions: string[] = [];
      
      // Process all message parts to extract different components
      if (message.content) {
        message.content.forEach((part: any) => {
          if (part.type === "text" && part.text) {
            // Attempt to parse structured content if it contains a report section
            if (part.text.value.includes("# Report") || part.text.value.includes("## Report")) {
              const sections = part.text.value.split(/(?=# |## )/g);
              
              // Extract the main content (usually the first section)
              content = sections[0].trim();
              
              // Look for report section
              const reportSection = sections.find((s: string) => s.startsWith("# Report") || s.startsWith("## Report"));
              if (reportSection) {
                report = reportSection.replace(/^# Report|^## Report/, "").trim();
              }
              
              // Look for relevant links
              const linksSection = sections.find((s: string) => s.includes("Relevant URLs") || s.includes("Relevant Links"));
              if (linksSection) {
                const linkMatches = linksSection.match(/https?:\/\/[^\s]+/g);
                if (linkMatches) {
                  relevantLinks = linkMatches;
                }
              }
              
              // Look for image options
              const imageSection = sections.find((s: string) => s.includes("Image Options"));
              if (imageSection) {
                const imageMatches = imageSection.match(/https?:\/\/[^\s)]+/g);
                if (imageMatches) {
                  imageOptions = imageMatches;
                }
              }
            } else {
              // If no structured format is detected, use the entire text as content
              content += part.text.value + "\n";
            }
          }
        });
      }
      
      // If we didn't extract structured content, just use the whole message
      if (!content.trim()) {
        if (message.content) {
          message.content.forEach((part: any) => {
            if (part.type === "text" && part.text) {
              content += part.text.value + "\n";
            }
          });
        }
      }
      
      if (!content.trim()) {
        await processingMessage.edit("Generated content was empty. Please try again.");
        return;
      }
      
      // Generate a post ID
      const postId = generatePostId();
      
      // Current date in PST timezone for default scheduling
      const defaultScheduleDate = new Date();
      defaultScheduleDate.setDate(defaultScheduleDate.getDate() + 1); // Schedule for tomorrow by default
      
      // Store the generated content with all the extracted information
      pendingPosts.set(postId, {
        content,
        url,
        threadId: thread_id,
        runId: runResponse.id,
        timestamp: Date.now(),
        report,
        relevantLinks,
        imageOptions,
        scheduleDate: defaultScheduleDate,
        platform: "all",  // Default to post on all platforms
        scheduleId: runResponse.id // Store the scheduleId
      });
      
      // Create action buttons for the post
      const viewDetailsButton = new ButtonBuilder()
        .setCustomId(`details_${postId}`)
        .setLabel('View Details')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋');
        
      const editContentButton = new ButtonBuilder()
        .setCustomId(`edit_${postId}`)
        .setLabel('Edit Content')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️');
        
      const changeImageButton = new ButtonBuilder()
        .setCustomId(`image_${postId}`)
        .setLabel('Set Image')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🖼️');
        
      const scheduleButton = new ButtonBuilder()
        .setCustomId(`schedule_${postId}`)
        .setLabel('Schedule')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📅');
        
      const discardButton = new ButtonBuilder()
        .setCustomId(`discard_${postId}`)
        .setLabel('Discard')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      // Create two action rows to hold all the buttons
      const actionRow1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(editContentButton, changeImageButton, scheduleButton);

      const actionRow2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(viewDetailsButton, discardButton);

      // Format the default schedule date
      let scheduleDisplay = "Not scheduled";
      if (defaultScheduleDate) {
        const options: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        };
        scheduleDisplay = defaultScheduleDate.toLocaleString('en-US', options);
      }

      // Truncate content if it's too long for the embed (Discord has a 4096 character limit for embed descriptions)
      const truncatedContent = content.length > 3500 
        ? content.substring(0, 3500) + "... (truncated, click 'View Details' to see full content)"
        : content;

      // Create an embed for the generated post
      const embed = new EmbedBuilder()
        .setTitle('Generated Post')
        .setColor('#0099ff')
        .setDescription(truncatedContent)
        .addFields(
          { name: 'Post ID', value: postId, inline: true },
          { name: 'Platform', value: 'Twitter/LinkedIn', inline: true },
          { name: 'Scheduled For', value: scheduleDisplay, inline: true },
          { name: 'Original URL', value: url }
        )
        .setFooter({ text: 'Use the buttons below to edit, schedule, or discard this post' })
        .setTimestamp();

      // Add image preview if available
      if (imageOptions && imageOptions.length > 0) {
        embed.setImage(imageOptions[0]); // Set the first image as the preview
      }

      // Update the processing message with the generated post
      await processingMessage.edit({
        content: 'Post generated successfully! Here are the details:',
        embeds: [embed],
        components: [actionRow1, actionRow2]
      });

    } catch (error) {
      console.error('Error generating post:', error);
      await processingMessage.edit('There was an error generating the post. Please try again.');
    }
  }
};

// Export the pending posts map for use in other commands
export { pendingPosts };

export default command; 