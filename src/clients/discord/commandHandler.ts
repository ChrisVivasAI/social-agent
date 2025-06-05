import { EnhancedSupabaseManager, DiscordInteraction, PostImageOption, PostVariation } from '../enhancedSupabaseManager.js';
import { SocialMediaManager } from '../socialMediaManager.js';
import { Client } from '@langchain/langgraph-sdk';

export interface DiscordCommandContext {
  userId: string;
  username: string;
  channelId: string;
  messageId?: string;
}

export class DiscordCommandHandler {
  private enhancedSupabase: EnhancedSupabaseManager;
  private socialMediaManager: SocialMediaManager;
  private langGraphClient: Client;

  constructor() {
    this.enhancedSupabase = new EnhancedSupabaseManager();
    this.socialMediaManager = new SocialMediaManager();
    this.langGraphClient = new Client({
      apiUrl: process.env.LANGGRAPH_API_URL || 'http://localhost:54367'
    });
  }

  /**
   * Parse Discord command from message content
   */
  parseCommand(content: string): { command: string; args: string[] } | null {
    const match = content.match(/^!([a-z-]+)\s*(.*)/);
    if (!match) return null;
    
    const [, command, argsString] = match;
    const args = argsString.trim().split(/\s+/).filter(arg => arg.length > 0);
    
    return { command, args };
  }

  /**
   * Handle Discord commands
   */
  async handleCommand(
    content: string, 
    context: DiscordCommandContext
  ): Promise<string> {
    const parsed = this.parseCommand(content);
    if (!parsed) {
      return "❌ Invalid command format. Use `!help` to see available commands.";
    }

    const { command, args } = parsed;

    try {
      // Record the interaction attempt
      await this.enhancedSupabase.recordDiscordInteraction({
        discord_user_id: context.userId,
        discord_username: context.username,
        discord_channel_id: context.channelId,
        discord_message_id: context.messageId,
        command_type: this.mapCommandType(command),
        command_data: { command, args },
        status: 'pending'
      });

      let response: string;

      switch (command) {
        case 'generate-post':
          response = await this.handleGeneratePost(args, context);
          break;
        case 'view-scheduled':
          response = await this.handleViewScheduled(args, context);
          break;
        case 'view-pending':
          response = await this.handleViewPending(args, context);
          break;
        case 'review-post':
          response = await this.handleReviewPost(args, context);
          break;
        case 'schedule-post':
          response = await this.handleSchedulePost(args, context);
          break;
        case 'modify-caption':
          response = await this.handleModifyCaption(args, context);
          break;
        case 'select-image':
          response = await this.handleSelectImage(args, context);
          break;
        case 'publish-now':
          response = await this.handlePublishNow(args, context);
          break;
        case 'cancel-post':
          response = await this.handleCancelPost(args, context);
          break;
        case 'help':
          response = this.getHelpMessage();
          break;
        default:
          response = `❌ Unknown command: \`${command}\`\nUse \`!help\` to see available commands.`;
      }

      // Record successful completion
      await this.enhancedSupabase.recordDiscordInteraction({
        discord_user_id: context.userId,
        discord_username: context.username,
        discord_channel_id: context.channelId,
        discord_message_id: context.messageId,
        command_type: this.mapCommandType(command),
        command_data: { command, args, success: true },
        status: 'completed'
      });

      return response;

    } catch (error) {
      console.error(`Error handling command ${command}:`, error);
      
      // Record the error
      await this.enhancedSupabase.recordDiscordInteraction({
        discord_user_id: context.userId,
        discord_username: context.username,
        discord_channel_id: context.channelId,
        discord_message_id: context.messageId,
        command_type: this.mapCommandType(command),
        command_data: { command, args, error: error instanceof Error ? error.message : 'Unknown error' },
        status: 'failed'
      });

      return `❌ **Error processing command**\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`;
    }
  }

  /**
   * Map command string to interaction type
   */
  private mapCommandType(command: string): DiscordInteraction['command_type'] {
    const mapping: Record<string, DiscordInteraction['command_type']> = {
      'generate-post': 'generate',
      'view-scheduled': 'view',
      'view-pending': 'view',
      'review-post': 'review',
      'schedule-post': 'schedule',
      'modify-caption': 'modify',
      'select-image': 'select_image',
      'publish-now': 'publish',
      'cancel-post': 'cancel',
      'help': 'help'
    };
    return mapping[command] || 'unknown';
  }

  /**
   * Generate a new post using LangGraph
   */
  private async handleGeneratePost(args: string[], context: DiscordCommandContext): Promise<string> {
    const url = args[0];
    
    if (!url) {
      return "❌ Usage: `!generate-post <url>`\nExample: `!generate-post https://youtu.be/example`";
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return "❌ Invalid URL format. Please provide a valid URL.";
    }

    try {
      // Create thread and run LangGraph workflow
      const thread = await this.langGraphClient.threads.create();
      
      const run = await this.langGraphClient.runs.create(thread.thread_id, 'generate_post', {
        input: { links: [url] },
        config: {
          configurable: {
            platform: 'discord',
            postToTwitter: true,
            postToLinkedin: true,
            postToInstagram: true,
            postToFacebook: true,
            instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
            instagramPageId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
            facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
            facebookPageId: process.env.FACEBOOK_PAGE_ID
          }
        }
      });

      // Wait for completion (with timeout)
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes timeout
      
      while (attempts < maxAttempts) {
        const runStatus = await this.langGraphClient.runs.get(thread.thread_id, run.run_id);
        
        if (runStatus.status === 'success') {
          // Extract post ID from the final state
          const finalState = (runStatus as any).kwargs?.state;
          const postId = finalState?.postId || finalState?.post_id;
          
          if (postId) {
            // Now record the successful generation with the real post ID
            await this.enhancedSupabase.recordDiscordInteraction({
              post_id: postId,
              discord_user_id: context.userId,
              discord_username: context.username,
              discord_channel_id: context.channelId,
              discord_message_id: context.messageId,
              command_type: 'generate',
              command_data: { url, success: true },
              status: 'completed'
            });

            return `🎉 **Post Generated Successfully!**\n\n` +
                   `🆔 **Post ID:** \`${postId}\`\n` +
                   `📝 **Status:** Draft (ready for review)\n` +
                   `🔗 **Source:** ${url}\n\n` +
                   `**Next Steps:**\n` +
                   `• \`!review-post ${postId}\` - Review the generated post\n` +
                   `• \`!schedule-post ${postId}\` - Schedule for optimal time\n` +
                   `• \`!publish-now ${postId}\` - Publish immediately`;
          } else {
            return `✅ **Post Generation Completed!**\n\n` +
                   `The post has been generated and should appear in your scheduled posts.\n` +
                   `Use \`!view-scheduled\` to see all pending posts.`;
          }
        } else if (runStatus.status === 'error') {
          const error = (runStatus as any).kwargs?.error || 'Unknown error occurred';
          return `❌ **Post Generation Failed**\n\n` +
                 `**Error:** ${error}\n` +
                 `**URL:** ${url}\n\n` +
                 `Please try again or check the URL.`;
        }
        
        // Still running, wait a bit more
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      // Timeout
      return `⏰ **Post Generation Timeout**\n\n` +
             `The post generation is taking longer than expected.\n` +
             `**URL:** ${url}\n\n` +
             `Please check \`!view-scheduled\` in a few minutes to see if it completed.`;

    } catch (error) {
      console.error('Error generating post:', error);
      return `❌ **Post Generation Failed**\n\n` +
             `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n` +
             `**URL:** ${url}\n\n` +
             `Please try again later.`;
    }
  }

  /**
   * View scheduled posts
   */
  private async handleViewScheduled(args: string[], context: DiscordCommandContext): Promise<string> {
    const statusFilter = args[0] || 'pending_review';
    const limit = parseInt(args[1]) || 10;

    try {
      // Get posts based on status filter
      let posts;
      if (statusFilter === 'all') {
        posts = await this.enhancedSupabase.searchPosts({
          limit: Math.min(limit, 5) // Limit to 5 for 'all' to avoid Discord character limit
        });
      } else if (statusFilter === 'active') {
        // Show both pending_review and scheduled posts (most useful for users)
        const pendingPosts = await this.enhancedSupabase.searchPosts({
          workflow_state: 'pending_review',
          limit: Math.floor(limit / 2)
        });
        const scheduledPosts = await this.enhancedSupabase.searchPosts({
          workflow_state: 'scheduled',
          limit: Math.floor(limit / 2)
        });
        posts = [...pendingPosts, ...scheduledPosts].slice(0, limit);
      } else {
        posts = await this.enhancedSupabase.searchPosts({
          workflow_state: statusFilter as any,
          limit
        });
      }

      if (posts.length === 0) {
        return `📅 **No ${statusFilter === 'all' ? '' : statusFilter + ' '}posts found**\n\n` +
               `Use \`!generate-post <url>\` to create a new post.\n\n` +
               `**Available status filters:**\n` +
               `• \`!view-scheduled\` - Pending review posts (default)\n` +
               `• \`!view-scheduled active\` - Pending + scheduled posts\n` +
               `• \`!view-scheduled draft\` - Draft posts\n` +
               `• \`!view-scheduled scheduled\` - Scheduled posts\n` +
               `• \`!view-scheduled published\` - Published posts\n` +
               `• \`!view-scheduled all\` - All posts (latest 5 only)\n\n` +
               `**📝 Note:** Commands are limited to show 5-10 posts to fit Discord's message limits. Use specific status filters to see more targeted results.`;
      }

      let response = `📅 **${statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Posts** (${posts.length}${statusFilter === 'all' ? ' of latest' : ''})\n\n`;

      // Build response with character limit checking
      const maxLength = 1800; // Leave room for footer
      let currentLength = response.length;
      let postsAdded = 0;

      for (const post of posts) {
        const scheduledTime = post.scheduled_for_utc 
          ? new Date(post.scheduled_for_utc).toLocaleString()
          : 'Not scheduled';
        
        const platforms = post.platforms.join(', ');
        const status = post.workflow_state || 'unknown';
        const statusEmoji = this.getStatusEmoji(status);
        
        const postEntry = `**${postsAdded + 1}. ${post.title}**\n` +
                         `   🆔 ID: \`${post.id || 'unknown'}\`\n` +
                         `   ${statusEmoji} Status: ${status}\n` +
                         `   📅 Scheduled: ${scheduledTime}\n` +
                         `   🎯 Platforms: ${platforms}\n` +
                         `   📝 \`!review-post ${post.id}\`\n\n`;

        // Check if adding this post would exceed the limit
        if (currentLength + postEntry.length > maxLength) {
          response += `*... and ${posts.length - postsAdded} more posts. Use specific filters to see more.*\n\n`;
          break;
        }

        response += postEntry;
        currentLength += postEntry.length;
        postsAdded++;
      }

      response += `**Quick Actions:**\n`;
      response += `• \`!view-scheduled active\` - Show pending + scheduled posts\n`;
      response += `• \`!view-scheduled draft\` - Show draft posts\n`;
      response += `• \`!view-scheduled scheduled\` - Show scheduled posts\n`;
      response += `• \`!generate-post <url>\` - Create new post`;

      return response;

    } catch (error) {
      console.error('Error viewing scheduled posts:', error);
      return `❌ **Error retrieving posts**\n\n` +
             `${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
             `Please try again later.`;
    }
  }

  /**
   * Get emoji for post status
   */
  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'draft': '📝',
      'scheduled': '⏰',
      'publishing': '🚀',
      'published': '✅',
      'failed': '❌',
      'cancelled': '🚫'
    };
    return emojiMap[status] || '📄';
  }

  /**
   * Review post with all options
   */
  private async handleReviewPost(args: string[], context: DiscordCommandContext): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: `!review-post <post-id>`";
    }

    const postId = args[0];
    const postData = await this.enhancedSupabase.getCompletePostData(postId);
    
    if (!postData.post) {
      return `❌ Post not found: \`${postId}\``;
    }

    const { post, variations, imageOptions, interactions } = postData;

    let response = `📋 **Post Review: \`${postId}\`**\n\n`;
    response += `**Title:** ${post.title}\n`;
    response += `**Status:** ${post.workflow_state}\n`;
    response += `**Platforms:** ${post.platforms.join(', ')}\n`;
    response += `**Created:** ${new Date(post.created_at || '').toLocaleString()}\n\n`;

    response += `**Content:**\n\`\`\`\n${post.content}\n\`\`\`\n\n`;

    if (imageOptions.length > 0) {
      response += `**📸 Image Options (${imageOptions.length}):**\n`;
      imageOptions.forEach((img: PostImageOption, index: number) => {
        const selected = img.is_selected ? " ✅" : "";
        response += `${index + 1}. ${img.image_url}${selected}\n`;
      });
      response += '\n';
    }

    if (variations.length > 0) {
      response += `**📝 Content Variations (${variations.length}):**\n`;
      variations.forEach((variation: PostVariation, index: number) => {
        const selected = variation.is_selected ? " ✅" : "";
        response += `${index + 1}. ${variation.variation_type}${selected}\n`;
      });
      response += '\n';
    }

    response += `**💬 Recent Interactions:** ${interactions.length}\n\n`;
    response += `**Available Commands:**\n`;
    response += `• \`!schedule-post ${postId} [time]\` - Schedule for specific time\n`;
    response += `• \`!modify-caption ${postId}\` - Edit post content\n`;
    response += `• \`!select-image ${postId} [number]\` - Choose different image\n`;
    response += `• \`!publish-now ${postId}\` - Publish immediately\n`;
    response += `• \`!cancel-post ${postId}\` - Cancel this post`;

    return response;
  }

  /**
   * Schedule post for specific time
   */
  private async handleSchedulePost(args: string[], context: DiscordCommandContext): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: `!schedule-post <post-id> [time]`\nExample: `!schedule-post abc123 2024-12-25 10:00 AM PST`";
    }

    const postId = args[0];
    const timeString = args.slice(1).join(' ');

    const post = await this.enhancedSupabase.getPost(postId);
    if (!post) {
      return `❌ Post not found: \`${postId}\``;
    }

    if (timeString) {
      // Parse and schedule for specific time
      const scheduledTime = new Date(timeString);
      if (isNaN(scheduledTime.getTime())) {
        return `❌ Invalid time format. Use: YYYY-MM-DD HH:MM AM/PM TZ\nExample: 2024-12-25 10:00 AM PST`;
      }

      await this.enhancedSupabase.schedulePostWithTimezone(
        postId,
        scheduledTime.toISOString(),
        'America/New_York'
      );

      await this.enhancedSupabase.updatePostWorkflowState(postId, 'scheduled');

      return `✅ **Post Scheduled Successfully!**\n\n` +
             `📅 **Scheduled for:** ${scheduledTime.toLocaleString()}\n` +
             `🆔 **Post ID:** \`${postId}\`\n` +
             `📝 **Status:** Scheduled and ready for publishing`;
    } else {
      // Schedule for next optimal time (P1 priority)
      const nextSaturday = new Date();
      nextSaturday.setDate(nextSaturday.getDate() + (6 - nextSaturday.getDay()));
      nextSaturday.setHours(8, 0, 0, 0); // 8 AM PST

      await this.enhancedSupabase.schedulePostWithTimezone(
        postId,
        nextSaturday.toISOString(),
        'America/Los_Angeles'
      );

      await this.enhancedSupabase.updatePostWorkflowState(postId, 'scheduled');

      return `✅ **Post Scheduled for Optimal Time!**\n\n` +
             `📅 **Scheduled for:** ${nextSaturday.toLocaleString()} (P1 Priority)\n` +
             `🆔 **Post ID:** \`${postId}\`\n` +
             `📝 **Status:** Scheduled and ready for publishing`;
    }
  }

  /**
   * Modify post caption/content
   */
  private async handleModifyCaption(args: string[], context: DiscordCommandContext): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: `!modify-caption <post-id>`\nThis will start an interactive caption editing session.";
    }

    const postId = args[0];
    const post = await this.enhancedSupabase.getPost(postId);
    
    if (!post) {
      return `❌ Post not found: \`${postId}\``;
    }

    // For now, return instructions for manual editing
    // In a full implementation, this would start an interactive session
    return `📝 **Caption Editing for Post \`${postId}\`**\n\n` +
           `**Current Content:**\n\`\`\`\n${post.content}\n\`\`\`\n\n` +
           `**To edit:** Please reply with your new caption content.\n` +
           `**Format:** \`!update-caption ${postId} [new content]\`\n\n` +
           `**Note:** The new content will replace the entire caption.`;
  }

  /**
   * Select different image option
   */
  private async handleSelectImage(args: string[], context: DiscordCommandContext): Promise<string> {
    if (args.length < 2) {
      return "❌ Usage: `!select-image <post-id> <image-number>`\nExample: `!select-image abc123 2`";
    }

    const postId = args[0];
    const imageNumber = parseInt(args[1]);

    if (isNaN(imageNumber) || imageNumber < 1) {
      return "❌ Image number must be a positive integer (1, 2, 3, etc.)";
    }

    const post = await this.enhancedSupabase.getPost(postId);
    if (!post) {
      return `❌ Post not found: \`${postId}\``;
    }

    const imageOptions = await this.enhancedSupabase.getImageOptions(postId);
    if (imageOptions.length === 0) {
      return `❌ No image options available for post \`${postId}\``;
    }

    if (imageNumber > imageOptions.length) {
      return `❌ Image number ${imageNumber} not found. Available options: 1-${imageOptions.length}`;
    }

    // Get the image option by index (1-based)
    const selectedImageOption = imageOptions[imageNumber - 1];
    
    // Update image selection using the image option ID
    await this.enhancedSupabase.selectImageOption(postId, selectedImageOption.id!);

    return `✅ **Image Selected Successfully!**\n\n` +
           `🖼️ **Selected Image:** Option ${imageNumber}\n` +
           `🔗 **URL:** ${selectedImageOption.image_url}\n` +
           `📝 **Description:** ${selectedImageOption.image_description || 'No description'}\n` +
           `🆔 **Post ID:** \`${postId}\`\n\n` +
           `The selected image will be used when the post is published.`;
  }

  /**
   * Publish post immediately
   */
  private async handlePublishNow(args: string[], context: DiscordCommandContext): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: `!publish-now <post-id>`";
    }

    const postId = args[0];
    const post = await this.enhancedSupabase.getPost(postId);
    
    if (!post) {
      return `❌ Post not found: \`${postId}\``;
    }

    if (post.workflow_state === 'published') {
      return `❌ Post \`${postId}\` has already been published.`;
    }

    try {
      // Update status to publishing
      await this.enhancedSupabase.updatePostWorkflowState(postId, 'publishing');

      // Get selected image
      const imageOptions = await this.enhancedSupabase.getImageOptions(postId);
      const selectedImage = imageOptions.find(img => img.is_selected);

      // Publish to all platforms
      const results = await this.socialMediaManager.publishToPlatforms(
        postId,
        post.content,
        post.platforms,
        selectedImage?.image_url
      );

      // Update status to published
      await this.enhancedSupabase.updatePostWorkflowState(postId, 'published', {
        published_at: new Date().toISOString(),
        platform_results: results
      });

      // Record successful interaction
      await this.enhancedSupabase.recordDiscordInteraction({
        post_id: postId,
        discord_user_id: context.userId,
        discord_username: context.username,
        discord_channel_id: context.channelId,
        discord_message_id: context.messageId,
        command_type: 'publish',
        command_data: { results },
        status: 'completed'
      });

      let response = `🚀 **Post Published Successfully!**\n\n`;
      response += `🆔 **Post ID:** \`${postId}\`\n`;
      response += `📅 **Published:** ${new Date().toLocaleString()}\n\n`;
      response += `**Platform Results:**\n`;

      Object.entries(results).forEach(([platform, result]: [string, any]) => {
        if (result.success) {
          response += `✅ **${platform.toUpperCase()}:** Published successfully\n`;
          if (result.postId) {
            response += `   📎 Post ID: \`${result.postId}\`\n`;
          }
        } else {
          response += `❌ **${platform.toUpperCase()}:** ${result.error}\n`;
        }
      });

      return response;

    } catch (error) {
      await this.enhancedSupabase.updatePostWorkflowState(postId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return `❌ **Publishing Failed**\n\n` +
             `🆔 **Post ID:** \`${postId}\`\n` +
             `❌ **Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
             `The post status has been updated to 'failed'. You can try publishing again or review the post.`;
    }
  }

  /**
   * Cancel post
   */
  private async handleCancelPost(args: string[], context: DiscordCommandContext): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: `!cancel-post <post-id>`";
    }

    const postId = args[0];
    const post = await this.enhancedSupabase.getPost(postId);
    
    if (!post) {
      return `❌ Post not found: \`${postId}\``;
    }

    if (post.workflow_state === 'published') {
      return `❌ Cannot cancel post \`${postId}\` - it has already been published.`;
    }

    await this.enhancedSupabase.updatePostWorkflowState(postId, 'cancelled', {
      cancelled_at: new Date().toISOString(),
      cancelled_by: context.username
    });

    return `✅ **Post Cancelled Successfully!**\n\n` +
           `🆔 **Post ID:** \`${postId}\`\n` +
           `👤 **Cancelled by:** ${context.username}\n` +
           `📅 **Cancelled at:** ${new Date().toLocaleString()}\n\n` +
           `The post will not be published and has been marked as cancelled.`;
  }

  /**
   * Get help message with all available commands
   */
  private getHelpMessage(): string {
    return `🤖 **Social Media Agent Commands**\n\n` +
           `**📝 Post Management:**\n` +
           `• \`!generate-post <url>\` - Generate new post from URL\n` +
           `• \`!view-pending\` - View newly generated posts awaiting review\n` +
           `• \`!view-scheduled [status]\` - View posts by status\n` +
           `• \`!review-post <post-id>\` - Review and edit a post\n\n` +
           
           `**⏰ Scheduling:**\n` +
           `• \`!schedule-post <post-id> [time]\` - Schedule for specific time\n` +
           `• \`!publish-now <post-id>\` - Publish immediately\n\n` +
           
           `**✏️ Editing:**\n` +
           `• \`!modify-caption <post-id>\` - Edit post content\n` +
           `• \`!select-image <post-id> <number>\` - Choose different image\n\n` +
           
           `**🗑️ Management:**\n` +
           `• \`!cancel-post <post-id>\` - Cancel a post\n\n` +
           
           `**📊 View Options:**\n` +
           `• \`!view-scheduled\` - Pending review posts (default)\n` +
           `• \`!view-scheduled active\` - Pending + scheduled posts\n` +
           `• \`!view-scheduled draft\` - Draft posts\n` +
           `• \`!view-scheduled scheduled\` - Scheduled posts\n` +
           `• \`!view-scheduled published\` - Published posts\n` +
           `• \`!view-scheduled all\` - All posts (latest 5 only)\n\n` +
           
           `**💡 Quick Start:**\n` +
           `1. \`!generate-post <youtube-url>\` - Create a post\n` +
           `2. \`!view-pending\` - See your new posts\n` +
           `3. \`!review-post <id>\` - Review and customize\n` +
           `4. \`!schedule-post <id>\` - Schedule or publish\n\n` +
           
           `**Examples:**\n` +
           `• \`!generate-post https://youtu.be/abc123\`\n` +
           `• \`!schedule-post abc123 2024-12-25 10:00 AM PST\`\n` +
           `• \`!publish-now abc123\`\n\n` +
           
           `**📝 Note:** Commands are limited to show 5-10 posts to fit Discord's message limits. Use specific status filters to see more targeted results.`;
  }

  /**
   * View pending posts (newly generated posts awaiting review)
   */
  private async handleViewPending(args: string[], context: DiscordCommandContext): Promise<string> {
    const limit = parseInt(args[0]) || 10;

    try {
      // Get pending_review and draft posts
      const pendingPosts = await this.enhancedSupabase.searchPosts({
        workflow_state: 'pending_review',
        limit: Math.floor(limit / 2)
      });
      
      const draftPosts = await this.enhancedSupabase.searchPosts({
        workflow_state: 'draft',
        limit: Math.floor(limit / 2)
      });

      const posts = [...pendingPosts, ...draftPosts].slice(0, limit);

      if (posts.length === 0) {
        return `📝 **No pending posts found**\n\n` +
               `Use \`!generate-post <url>\` to create a new post.\n\n` +
               `**Other commands:**\n` +
               `• \`!view-scheduled\` - View all posts\n` +
               `• \`!help\` - Show all commands`;
      }

      let response = `📝 **Pending Posts** (${posts.length})\n\n`;
      response += `*Posts awaiting review or scheduling*\n\n`;

      posts.forEach((post, index) => {
        const platforms = post.platforms.join(', ');
        const status = post.workflow_state || 'unknown';
        const statusEmoji = this.getStatusEmoji(status);
        const createdTime = new Date(post.created_at || '').toLocaleString();
        
        response += `**${index + 1}. ${post.title}**\n`;
        response += `   🆔 ID: \`${post.id || 'unknown'}\`\n`;
        response += `   ${statusEmoji} Status: ${status}\n`;
        response += `   📅 Created: ${createdTime}\n`;
        response += `   🎯 Platforms: ${platforms}\n`;
        response += `   📝 \`!review-post ${post.id}\`\n\n`;
      });

      response += `**Quick Actions:**\n`;
      response += `• \`!review-post <id>\` - Review and edit a post\n`;
      response += `• \`!schedule-post <id>\` - Schedule for optimal time\n`;
      response += `• \`!publish-now <id>\` - Publish immediately\n`;
      response += `• \`!generate-post <url>\` - Create new post`;

      return response;

    } catch (error) {
      console.error('Error viewing pending posts:', error);
      return `❌ **Error retrieving pending posts**\n\n` +
             `${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
             `Please try again later.`;
    }
  }
}