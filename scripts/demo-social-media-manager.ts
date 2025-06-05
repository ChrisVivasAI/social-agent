import 'dotenv/config';
import { SocialMediaManager } from '../src/clients/socialMediaManager.js';
import { ImageProcessor } from '../src/utils/imageProcessor.js';

/**
 * Demo script showing how to use the enhanced social media manager
 */
async function demonstrateSocialMediaManager() {
  console.log('🚀 Social Media Manager Demo\n');

  const manager = new SocialMediaManager();

  // 1. Check available platforms
  console.log('📱 Available Platforms:');
  const platforms = manager.getAvailablePlatforms();
  console.log(`   ${platforms.length > 0 ? platforms.join(', ') : 'No platforms configured yet'}\n`);

  // 2. Test connections
  console.log('🔗 Testing Connections:');
  const connections = await manager.testConnections();
  Object.entries(connections).forEach(([platform, status]) => {
    const emoji = status ? '✅' : '❌';
    console.log(`   ${emoji} ${platform}: ${status ? 'Connected' : 'Failed'}`);
  });
  console.log();

  // 3. Get current stats
  console.log('📊 Current Statistics:');
  const stats = await manager.getStats();
  console.log(`   Total Posts: ${stats.totalPosts}`);
  console.log(`   Published: ${stats.publishedPosts}`);
  console.log(`   Scheduled: ${stats.scheduledPosts}`);
  console.log(`   Failed: ${stats.failedPosts}\n`);

  // 4. Demo image processing
  console.log('🖼️ Image Processing Demo:');
  try {
    // Create a test image
    const sharp = (await import('sharp')).default;
    const testImage = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 70, g: 130, b: 180 } // Steel blue
      }
    })
    .jpeg()
    .toBuffer();

    // Process the image
    const processed = await ImageProcessor.processImageFor43AspectRatio(
      testImage,
      {
        title: 'Demo Post: Enhanced Social Media Agent',
        titlePosition: 'bottom',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleColor: '#ffffff',
        fontSize: 42
      }
    );

    console.log(`   ✅ Processed image: ${processed.width}x${processed.height}`);
    console.log(`   📏 Original: ${processed.originalDimensions.width}x${processed.originalDimensions.height}`);
  } catch (error) {
    console.log(`   ❌ Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // 5. Demo post creation (without actually posting)
  console.log('📝 Post Creation Demo:');
  
  if (platforms.length > 0) {
    console.log('   Creating a test post...');
    
    try {
      // Create a demo post (this will create database records but won't post to social media without images)
      const result = await manager.publishPost({
        content: 'Demo post from the enhanced social media agent! 🚀\n\nFeatures:\n✅ Multi-platform posting\n✅ Image processing\n✅ Scheduling\n✅ Analytics',
        platforms: platforms.slice(0, 2), // Use first 2 available platforms
        title: 'Enhanced Social Media Agent Demo'
      });

      console.log(`   ✅ Post created with ID: ${result.postId}`);
      console.log('   📊 Results:');
      result.results.forEach(r => {
        const emoji = r.success ? '✅' : '❌';
        console.log(`     ${emoji} ${r.platform}: ${r.success ? r.id || 'Success' : r.error}`);
      });
    } catch (error) {
      console.log(`   ⚠️ Post creation demo skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('   ⚠️ No platforms configured - add Instagram/Facebook credentials to test posting');
  }
  console.log();

  // 6. Show recent posts
  console.log('📋 Recent Posts:');
  try {
    const recentPosts = await manager.getPosts({ limit: 5 });
    if (recentPosts.length > 0) {
      recentPosts.forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.title} (${post.status})`);
        console.log(`      Platforms: ${post.platforms.join(', ')}`);
        console.log(`      Created: ${new Date(post.created_at!).toLocaleDateString()}`);
      });
    } else {
      console.log('   No posts found');
    }
  } catch (error) {
    console.log(`   ❌ Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('🎉 Demo completed!');
  console.log('\n📖 Next Steps:');
  console.log('1. Add Instagram/Facebook credentials to your .env file');
  console.log('2. Run: yarn test:integrations');
  console.log('3. Use the SocialMediaManager in your Discord bot or other applications');
  console.log('4. Check the ENHANCED_FEATURES.md for detailed usage examples');
}

// Run the demo
demonstrateSocialMediaManager().catch(console.error); 