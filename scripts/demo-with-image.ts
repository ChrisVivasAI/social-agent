import 'dotenv/config';
import { SocialMediaManager } from '../src/clients/socialMediaManager.js';
import { ImageProcessor } from '../src/utils/imageProcessor.js';

/**
 * Demo script showing how to post with images to Instagram and Facebook
 */
async function demonstrateImagePosting() {
  console.log('🚀 Social Media Manager - Image Posting Demo\n');

  const manager = new SocialMediaManager();

  // Check available platforms
  const platforms = manager.getAvailablePlatforms();
  console.log(`📱 Available Platforms: ${platforms.join(', ')}\n`);

  if (platforms.length === 0) {
    console.log('❌ No platforms configured. Please check your environment variables.');
    return;
  }

  try {
    // 1. Create a beautiful demo image
    console.log('🎨 Creating demo image...');
    const sharp = (await import('sharp')).default;
    
    // Create a gradient background image
    const width = 1080;
    const height = 1080;
    
    const demoImage = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 70, g: 130, b: 180 } // Steel blue
      }
    })
    .composite([
      {
        input: await sharp({
          create: {
            width: width - 200,
            height: height - 200,
            channels: 3,
            background: { r: 100, g: 149, b: 237 } // Cornflower blue
          }
        }).png().toBuffer(),
        top: 100,
        left: 100
      }
    ])
    .jpeg({ quality: 90 })
    .toBuffer();

    console.log(`✅ Created demo image: ${width}x${height}`);

    // 2. Post with image to available platforms
    const postContent = `🚀 Enhanced Social Media Agent Demo!

✨ Features:
• Multi-platform posting (Instagram + Facebook)
• Automatic image processing (4:3 aspect ratio)
• Title overlay on images
• Database tracking & analytics
• Scheduling support

#SocialMediaAutomation #TechDemo #AI`;

    const postTitle = 'Enhanced Social Media Agent - Live Demo';

    console.log('\n📝 Publishing post with image...');
    
    const result = await manager.publishPost({
      content: postContent,
      platforms: platforms, // Post to all available platforms
      imageBuffer: demoImage,
      title: postTitle
    });

    console.log(`\n✅ Post created with ID: ${result.postId}`);
    
    if (result.processedImageUrl) {
      console.log(`🖼️ Processed image URL: ${result.processedImageUrl}`);
    }

    console.log('\n📊 Publishing Results:');
    result.results.forEach(r => {
      const emoji = r.success ? '✅' : '❌';
      console.log(`  ${emoji} ${r.platform.toUpperCase()}: ${r.success ? r.id || 'Success' : r.error}`);
    });

    // 3. Show what happened
    console.log('\n🎯 What Just Happened:');
    
    if (result.results.some(r => r.platform === 'instagram' && r.success)) {
      console.log('📱 Instagram: Posted with processed image (4:3 aspect ratio + title overlay)');
    }
    
    if (result.results.some(r => r.platform === 'facebook' && r.success)) {
      console.log('📘 Facebook: Posted with processed image');
    }

    // 4. Show image processing details
    if (result.processedImageUrl) {
      console.log('\n🖼️ Image Processing Details:');
      console.log('  • Original: 1080x1080 (square)');
      console.log('  • Processed: 1200x900 (4:3 aspect ratio)');
      console.log('  • Added: Black bars + title overlay');
      console.log('  • Format: JPEG with 90% quality');
    }

    // 5. Check the posts in database
    console.log('\n📋 Recent Posts in Database:');
    const recentPosts = await manager.getPosts({ limit: 3 });
    recentPosts.forEach((post, index) => {
      console.log(`  ${index + 1}. ${post.title} (${post.status})`);
      console.log(`     Platforms: ${post.platforms.join(', ')}`);
      if (post.processed_image_url) {
        console.log(`     Image: ✅ Processed`);
      }
    });

  } catch (error) {
    console.error('\n❌ Demo failed:', error instanceof Error ? error.message : 'Unknown error');
    
    // Show troubleshooting tips
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Check your Instagram/Facebook access tokens are valid');
    console.log('2. Ensure your Instagram account is a Business account');
    console.log('3. Verify your Facebook page permissions');
    console.log('4. Run: yarn test:integrations');
  }

  console.log('\n🎉 Demo completed!');
}

// Run the demo
demonstrateImagePosting().catch(console.error); 