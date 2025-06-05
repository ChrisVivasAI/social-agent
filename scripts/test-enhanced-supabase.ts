import 'dotenv/config';
import { EnhancedSupabaseManager } from '../src/clients/enhancedSupabaseManager.js';

async function testEnhancedFeatures() {
  console.log('🧪 Testing Enhanced Supabase Manager...\n');
  
  const supabase = new EnhancedSupabaseManager();
  
  try {
    // Test 1: Timezone conversion
    console.log('1️⃣ Testing timezone conversion...');
    const utcTime = new Date().toISOString();
    const estTime = await supabase.convertTimezone(
      utcTime,
      'UTC',
      'America/New_York'
    );
    console.log(`   UTC: ${utcTime}`);
    console.log(`   EST: ${estTime}`);
    console.log('   ✅ Timezone conversion working\n');
    
    // Test 2: User preferences
    console.log('2️⃣ Testing user preferences...');
    const testDiscordUserId = 'test-discord-user-' + Date.now();
    const prefs = await supabase.getUserPreferences(testDiscordUserId);
    console.log('   📋 User Preferences:', {
      discord_user_id: prefs.discord_user_id,
      timezone: prefs.timezone,
      default_platforms: prefs.default_platforms
    });
    console.log('   ✅ User preferences working\n');
    
    // Test 3: Post creation with options
    console.log('3️⃣ Testing post creation with options...');
    const postId = await supabase.createPostWithOptions(
      {
        title: 'Enhanced Manager Test Post',
        content: 'This is a test post created with the enhanced Supabase manager',
        original_content: 'Original AI-generated content',
        platforms: ['twitter', 'linkedin', 'instagram', 'facebook'],
        workflow_state: 'draft',
        user_timezone: 'America/New_York',
        created_by_discord: true,
        discord_thread_id: 'test-thread-123',
        generation_metadata: {
          test: true,
          created_at: new Date().toISOString()
        }
      },
      [
        {
          post_id: '', // Will be set automatically
          variation_type: 'original',
          content: 'Original content variation',
          is_selected: true,
          created_by: 'system'
        },
        {
          post_id: '', // Will be set automatically
          variation_type: 'ai_alternative',
          content: 'Alternative AI-generated content',
          is_selected: false,
          created_by: 'system'
        }
      ],
      [
        {
          post_id: '', // Will be set automatically
          image_url: 'https://i.ytimg.com/vi/PYMEspZPcmc/maxresdefault.jpg',
          image_description: 'Test YouTube thumbnail',
          image_source: 'youtube',
          is_selected: true,
          option_index: 1
        },
        {
          post_id: '', // Will be set automatically
          image_url: 'https://example.com/image2.jpg',
          image_description: 'Alternative test image',
          image_source: 'upload',
          is_selected: false,
          option_index: 2
        }
      ]
    );
    
    console.log(`   📝 Created post with ID: ${postId}`);
    console.log('   ✅ Post creation with options working\n');
    
    // Test 4: Get complete post data
    console.log('4️⃣ Testing complete post data retrieval...');
    const completeData = await supabase.getCompletePostData(postId);
    console.log('   📊 Complete post data:', {
      post_title: completeData.post?.title,
      variations_count: completeData.variations.length,
      image_options_count: completeData.imageOptions.length,
      workflow_state: completeData.post?.workflow_state
    });
    console.log('   ✅ Complete post data retrieval working\n');
    
    // Test 5: Discord interaction recording
    console.log('5️⃣ Testing Discord interaction recording...');
    const interactionId = await supabase.recordDiscordInteraction({
      post_id: postId,
      discord_user_id: testDiscordUserId,
      discord_username: 'TestUser',
      discord_channel_id: 'test-channel-123',
      command_type: 'generate',
      command_data: { test: true },
      status: 'completed'
    });
    console.log(`   💬 Recorded interaction with ID: ${interactionId}`);
    console.log('   ✅ Discord interaction recording working\n');
    
    // Test 6: Enhanced stats
    console.log('6️⃣ Testing enhanced statistics...');
    const stats = await supabase.getEnhancedStats();
    console.log('   📈 Enhanced stats:', {
      total_posts: stats?.total_posts || 0,
      draft_posts: stats?.draft_posts || 0,
      discord_created_posts: stats?.discord_created_posts || 0
    });
    console.log('   ✅ Enhanced statistics working\n');
    
    // Test 7: Scheduling with timezone
    console.log('7️⃣ Testing timezone-aware scheduling...');
    const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
    await supabase.schedulePostWithTimezone(
      postId,
      scheduledTime,
      'America/New_York',
      testDiscordUserId,
      interactionId
    );
    console.log(`   ⏰ Scheduled post for: ${scheduledTime} EST`);
    console.log('   ✅ Timezone-aware scheduling working\n');
    
    console.log('🎉 All enhanced Supabase manager tests passed!');
    console.log(`📝 Test post ID: ${postId} (you can check this in your Supabase dashboard)`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testEnhancedFeatures().catch(console.error); 