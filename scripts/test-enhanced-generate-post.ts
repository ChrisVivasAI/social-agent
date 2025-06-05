import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import { TEXT_ONLY_MODE, POST_TO_INSTAGRAM, POST_TO_FACEBOOK } from "../src/agents/generate-post/constants.js";
import { EnhancedSupabaseManager } from "../src/clients/enhancedSupabaseManager.js";

/**
 * Test the enhanced generate-post workflow with Discord integration
 */
async function testEnhancedGeneratePost() {
  console.log('🧪 Testing Enhanced Generate-Post Workflow...\n');

  const link = "https://youtu.be/-Qdlg-dkrX8?si=gfbZX8FUVcwYe7zi";
  
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  const enhancedSupabase = new EnhancedSupabaseManager();

  try {
    console.log('🚀 Starting generate-post workflow...');
    console.log(`📎 Processing link: ${link}`);

    // Get initial stats
    const initialStats = await enhancedSupabase.getEnhancedStats();
    console.log('📊 Initial stats:', {
      total_posts: initialStats?.total_posts || 0,
      draft_posts: initialStats?.draft_posts || 0,
      discord_created_posts: initialStats?.discord_created_posts || 0
    });

    const { thread_id } = await client.threads.create();
    console.log(`🧵 Created thread: ${thread_id}`);

    const run = await client.runs.create(thread_id, "generate_post", {
      input: {
        links: [link],
      },
      config: {
        configurable: {
          [TEXT_ONLY_MODE]: false,
          [POST_TO_INSTAGRAM]: true,
          [POST_TO_FACEBOOK]: true,
        },
      },
    });

    console.log(`▶️ Started run: ${run.run_id}`);
    console.log('⏳ Waiting for completion...\n');

    // Wait for the run to complete
    let runStatus = await client.runs.get(thread_id, run.run_id);
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (runStatus.status === 'pending' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      runStatus = await client.runs.get(thread_id, run.run_id);
      attempts++;
      
      if (attempts % 6 === 0) { // Every 30 seconds
        console.log(`⏳ Still running... (${attempts * 5}s elapsed)`);
      }
    }

    console.log(`✅ Run completed with status: ${runStatus.status}\n`);

    if (runStatus.status === 'success') {
      // Get final stats
      const finalStats = await enhancedSupabase.getEnhancedStats();
      console.log('📊 Final stats:', {
        total_posts: finalStats?.total_posts || 0,
        draft_posts: finalStats?.draft_posts || 0,
        discord_created_posts: finalStats?.discord_created_posts || 0
      });

      // Check for new draft posts
      const draftPosts = await enhancedSupabase.searchPosts({
        workflow_state: 'draft',
        limit: 5
      });

      if (draftPosts.length > 0) {
        console.log('\n📝 Recent draft posts:');
        for (const post of draftPosts.slice(0, 2)) {
          console.log(`\n🆔 Post ID: ${post.id}`);
          console.log(`📰 Title: ${post.title}`);
          console.log(`🎯 Platforms: ${post.platforms?.join(', ')}`);
          console.log(`⏰ Timezone: ${post.user_timezone}`);
          console.log(`📅 Created: ${post.created_at}`);
          
          // Get complete post data
          const completeData = await enhancedSupabase.getCompletePostData(post.id!);
          console.log(`🖼️ Image options: ${completeData.imageOptions.length}`);
          console.log(`📝 Variations: ${completeData.variations.length}`);
          console.log(`💬 Interactions: ${completeData.interactions.length}`);
          
          if (completeData.imageOptions.length > 0) {
            console.log('   📸 Image options:');
            completeData.imageOptions.forEach((img, i) => {
              console.log(`     ${i + 1}. ${img.image_url} ${img.is_selected ? '(selected)' : ''}`);
            });
          }
        }
      }

      // Check for Discord interactions
      const recentInteractions = await enhancedSupabase.getDiscordActivityStats();
      if (recentInteractions.length > 0) {
        console.log('\n💬 Recent Discord activity:');
        recentInteractions.slice(0, 3).forEach(activity => {
          console.log(`   ${activity.command_type}: ${activity.total_commands} commands (${activity.successful_commands} successful)`);
        });
      }

    } else {
      console.log('❌ Run failed or was interrupted');
      console.log('Run details:', runStatus);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testEnhancedGeneratePost().catch(console.error); 