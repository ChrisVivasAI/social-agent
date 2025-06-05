import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  POST_TO_INSTAGRAM,
  POST_TO_FACEBOOK,
  TEXT_ONLY_MODE,
} from "../../constants.js";
import {
  getScheduledDateSeconds,
  getFutureDate,
} from "../../../../utils/schedule-date/index.js";
import { DiscordClient } from "../../../../clients/discord/index.js";
import { isTextOnly, shouldPostToLinkedInOrg, shouldPostToInstagram, shouldPostToFacebook } from "../../../utils.js";
import { EnhancedSupabaseManager } from "../../../../clients/enhancedSupabaseManager.js";

interface SendDiscordMessageArgs {
  isTextOnlyMode: boolean;
  afterSeconds: number;
  threadId: string;
  runId: string;
  postContent: string;
  postId: string;
  imageOptions: string[];
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function sendDiscordMessage({
  isTextOnlyMode,
  afterSeconds,
  threadId,
  runId,
  postContent,
  postId,
  imageOptions,
  image,
}: SendDiscordMessageArgs) {
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (!discordChannelId && !discordChannelName) {
    console.warn(
      "No DISCORD_CHANNEL_ID or DISCORD_CHANNEL_NAME found in environment variables. Cannot send message to Discord.",
    );
    return;
  }

  const clientArgs: any = {};
  if (discordChannelId) {
    clientArgs.channelId = discordChannelId;
  } else if (discordChannelName) {
    clientArgs.channelName = discordChannelName;
  }
  const discordClient = new DiscordClient(clientArgs);

  const imageString = image?.imageUrl
    ? `Primary Image: ${image?.imageUrl}`
    : "No primary image selected";
  
  const imageOptionsString = imageOptions?.length 
    ? `\n📸 **${imageOptions.length} Image Options Available**\n${imageOptions.slice(0, 3).map((url, i) => `${i + 1}. ${url}`).join('\n')}${imageOptions.length > 3 ? `\n... and ${imageOptions.length - 3} more` : ''}`
    : "";

  const messageString = `🎯 **New Post Created & Ready for Review**
    
📝 **Post ID**: \`${postId}\`
⏰ **Scheduled for**: *${getFutureDate(afterSeconds)}* (EST)
🔗 **Run ID**: \`${runId}\`
🧵 **Thread ID**: \`${threadId}\`

**Content:**
\`\`\`
${postContent}
\`\`\`

${!isTextOnlyMode ? imageString + imageOptionsString : "📝 Text only mode enabled. Image support has been disabled."}

**🎮 Available Commands:**
• \`/review-post ${postId}\` - Review post with all options
• \`/schedule-post ${postId} [time]\` - Schedule for specific time
• \`/modify-caption ${postId}\` - Edit post content
• \`/select-image ${postId} [number]\` - Choose different image
• \`/publish-now ${postId}\` - Publish immediately
• \`/cancel-post ${postId}\` - Cancel this post

**Status**: 📋 Draft (awaiting review)`;

  try {
    await discordClient.sendMessage(messageString);
  } catch (error) {
    console.error("Failed to send Discord message for scheduled post:", error);
  }
}

export async function schedulePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  console.log('🎯 Enhanced schedulePost function called!');
  console.log('📊 State data:', {
    hasPost: !!state.post,
    hasScheduleDate: !!state.scheduleDate,
    imageOptionsCount: state.imageOptions?.length || 0,
    relevantLinksCount: state.relevantLinks?.length || 0
  });

  if (!state.post || !state.scheduleDate) {
    throw new Error("No post or schedule date found");
  }
  
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);
  const postToInstagram = shouldPostToInstagram(config);
  const postToFacebook = shouldPostToFacebook(config);

  const enhancedSupabase = new EnhancedSupabaseManager();

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT || process.env.LANGGRAPH_API_URL?.split(':').pop() || '54367'}`,
  });

  const afterSeconds = await getScheduledDateSeconds({
    scheduleDate: state.scheduleDate,
    config,
  });

  const platforms = [];
  if (postToLinkedInOrg) platforms.push('linkedin');
  else platforms.push('linkedin');
  platforms.push('twitter');
  if (postToInstagram) platforms.push('instagram');
  if (postToFacebook) platforms.push('facebook');

  try {
    // Enhanced: Create post as draft with all options
    console.log('🚀 Starting enhanced post creation...');
    const postId = await enhancedSupabase.createPostWithOptions(
      {
        title: state.post.split('\n')[0].substring(0, 100) || 'Generated Post',
        content: state.post,
        original_content: state.post,
        platforms: platforms,
        workflow_state: 'draft',
        user_timezone: 'America/New_York',
        created_by_discord: false,
        generation_metadata: {
          source_links: state.relevantLinks || [],
          report_summary: state.report?.substring(0, 500) || '',
          generation_timestamp: new Date().toISOString(),
          scheduled_for_seconds: afterSeconds,
          config: {
            text_only_mode: isTextOnlyMode,
            post_to_linkedin_org: postToLinkedInOrg,
            post_to_instagram: postToInstagram,
            post_to_facebook: postToFacebook
          }
        }
      },
      [
        {
          post_id: '',
          variation_type: 'original',
          content: state.post,
          is_selected: true,
          created_by: 'system'
        }
      ],
      (state.imageOptions || []).map((imageUrl, index) => ({
        post_id: '',
        image_url: imageUrl,
        image_description: `Image option ${index + 1}`,
        image_source: imageUrl.includes('youtube') ? 'youtube' as const : 
                     imageUrl.includes('supabase') ? 'screenshot' as const : 'upload' as const,
        is_selected: index === 0,
        option_index: index + 1
      }))
    );

    console.log(`✅ Created enhanced post draft: ${postId}`);

    const scheduledTime = new Date(Date.now() + afterSeconds * 1000).toISOString();
    await enhancedSupabase.schedulePostWithTimezone(
      postId,
      scheduledTime,
      'America/New_York',
      undefined,
      undefined
    );

    console.log(`⏰ Scheduled post for: ${scheduledTime} EST`);

    const thread = await client.threads.create();
    
    await enhancedSupabase.updatePostWorkflowState(postId, 'pending_review', {
      thread_id: thread.thread_id,
      scheduled_for_seconds: afterSeconds,
      platforms_config: {
        linkedin_org: postToLinkedInOrg,
        instagram: postToInstagram,
        facebook: postToFacebook,
        text_only: isTextOnlyMode
      }
    });

    try {
      await sendDiscordMessage({
        isTextOnlyMode,
        afterSeconds,
        threadId: thread.thread_id,
        runId: 'draft-' + postId.substring(0, 8),
        postContent: state.post,
        postId: postId,
        imageOptions: state.imageOptions || [],
        image: state.image,
      });

      await enhancedSupabase.recordDiscordInteraction({
        post_id: postId,
        discord_user_id: 'system',
        discord_username: 'Social Agent',
        discord_channel_id: process.env.DISCORD_CHANNEL_ID || 'unknown',
        discord_message_id: undefined,
        command_type: 'generate',
        command_data: {
          platforms: platforms,
          image_options_count: state.imageOptions?.length || 0,
          scheduled_for: scheduledTime
        },
        status: 'completed'
      });
    } catch (e) {
      console.error("Failed to send Discord notification:", e);
    }

    console.log(`📱 Discord notification sent for post: ${postId}`);

  } catch (error) {
    console.error("❌ Failed to create enhanced post:", error);
    console.error("📋 Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Fallback: Use original scheduling if enhanced fails
    console.log("🔄 Falling back to original scheduling method...");
    
    const thread = await client.threads.create();
    const run = await client.runs.create(thread.thread_id, "upload_post", {
      input: {
        post: state.post,
        image: state.image,
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
          [POST_TO_INSTAGRAM]: postToInstagram,
          [POST_TO_FACEBOOK]: postToFacebook,
          [TEXT_ONLY_MODE]: isTextOnlyMode,
        },
      },
      afterSeconds,
    });

    try {
      await sendDiscordMessage({
        isTextOnlyMode,
        afterSeconds,
        threadId: thread.thread_id,
        runId: run.run_id,
        postContent: state.post,
        postId: 'fallback-' + run.run_id.substring(0, 8),
        imageOptions: state.imageOptions || [],
        image: state.image,
      });
    } catch (e) {
      console.error("Failed to send fallback Discord message:", e);
    }
  }

  return {};
}
