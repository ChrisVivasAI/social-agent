import "dotenv/config";
import { EnhancedSupabaseManager } from "../src/clients/enhancedSupabaseManager.js";

/**
 * Debug script to check what posts are being created and their statuses
 */
async function debugPostCreation() {
  console.log('🔍 Debugging Post Creation and Database Storage...\n');

  const enhancedSupabase = new EnhancedSupabaseManager();

  try {
    // Check all posts in the database
    console.log('1️⃣ Checking all posts in database...');
    const allPosts = await enhancedSupabase.searchPosts({
      limit: 20
    });
    
    console.log(`📊 Total posts found: ${allPosts.length}\n`);
    
    if (allPosts.length > 0) {
      console.log('📋 Recent posts:');
      allPosts.slice(0, 5).forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.title}`);
        console.log(`      🆔 ID: ${post.id}`);
        console.log(`      📝 Status: ${post.workflow_state}`);
        console.log(`      📅 Created: ${new Date(post.created_at || '').toLocaleString()}`);
        console.log(`      🎯 Platforms: ${post.platforms.join(', ')}`);
        console.log('');
      });
    }

    // Check posts by different statuses
    console.log('2️⃣ Checking posts by status...');
    
    const statuses = ['draft', 'pending_review', 'scheduled', 'published', 'failed'];
    
    for (const status of statuses) {
      const posts = await enhancedSupabase.searchPosts({
        workflow_state: status as any,
        limit: 10
      });
      console.log(`   📝 ${status}: ${posts.length} posts`);
      
      if (posts.length > 0 && status === 'pending_review') {
        console.log('      Recent pending_review posts:');
        posts.slice(0, 3).forEach((post, index) => {
          console.log(`         ${index + 1}. ${post.title} (${post.id})`);
          console.log(`            Created: ${new Date(post.created_at || '').toLocaleString()}`);
        });
      }
    }

    // Check recent posts created in the last hour
    console.log('\n3️⃣ Checking posts created in the last hour...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const recentPosts = await enhancedSupabase.searchPosts({
      limit: 10
    });
    
    const veryRecentPosts = recentPosts.filter(post => 
      post.created_at && new Date(post.created_at) > new Date(oneHourAgo)
    );
    
    console.log(`📊 Posts created in last hour: ${veryRecentPosts.length}`);
    
    if (veryRecentPosts.length > 0) {
      console.log('   Recent posts:');
      veryRecentPosts.forEach((post, index) => {
        console.log(`      ${index + 1}. ${post.title}`);
        console.log(`         🆔 ID: ${post.id}`);
        console.log(`         📝 Status: ${post.workflow_state}`);
        console.log(`         📅 Created: ${new Date(post.created_at || '').toLocaleString()}`);
        console.log(`         🎯 Platforms: ${post.platforms.join(', ')}`);
        console.log('');
      });
    }

    // Test what view-scheduled would return
    console.log('4️⃣ Testing what !view-scheduled commands would return...');
    
    // Default view-scheduled (looks for 'scheduled' status)
    const scheduledPosts = await enhancedSupabase.searchPosts({
      workflow_state: 'scheduled',
      limit: 10
    });
    console.log(`   !view-scheduled (default): ${scheduledPosts.length} posts`);
    
    // view-scheduled draft
    const draftPosts = await enhancedSupabase.searchPosts({
      workflow_state: 'draft',
      limit: 10
    });
    console.log(`   !view-scheduled draft: ${draftPosts.length} posts`);
    
    // view-scheduled pending_review
    const pendingPosts = await enhancedSupabase.searchPosts({
      workflow_state: 'pending_review',
      limit: 10
    });
    console.log(`   !view-scheduled pending_review: ${pendingPosts.length} posts`);

    console.log('\n🎯 Summary:');
    console.log(`   • Total posts: ${allPosts.length}`);
    console.log(`   • Recent posts (last hour): ${veryRecentPosts.length}`);
    console.log(`   • Posts visible to !view-scheduled: ${scheduledPosts.length}`);
    console.log(`   • Posts visible to !view-scheduled draft: ${draftPosts.length}`);
    console.log(`   • Posts visible to !view-scheduled pending_review: ${pendingPosts.length}`);

    if (veryRecentPosts.length > 0 && scheduledPosts.length === 0) {
      console.log('\n❗ ISSUE IDENTIFIED:');
      console.log('   Recent posts are being created but they have status "pending_review" or "draft"');
      console.log('   The default !view-scheduled command only shows posts with status "scheduled"');
      console.log('   Users need to use !view-scheduled draft or !view-scheduled pending_review');
    }

  } catch (error) {
    console.error('❌ Error debugging post creation:', error);
  }
}

debugPostCreation().catch(console.error); 