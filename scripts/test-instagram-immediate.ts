import 'dotenv/config';
import { SocialMediaManager } from '../src/clients/socialMediaManager.js';

async function testInstagramImmediate() {
  console.log('🧪 Testing Instagram Immediate Publish\n');

  try {
    const manager = new SocialMediaManager();
    
    // Create a simple test image
    const sharp = (await import('sharp')).default;
    const testImage = await sharp({
      create: {
        width: 1080,
        height: 1080,
        channels: 3,
        background: { r: 70, g: 130, b: 180 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer();

    const testCaption = `🧪 Instagram Immediate Publish Test

✨ Testing the enhanced social media agent!
🚀 This post was created using the new Instagram integration
📱 Posted directly via Instagram Graph API

#test #instagram #api #socialmedia`;

    console.log('📱 Publishing to Instagram only...');
    
    const result = await manager.publishPost({
      content: testCaption,
      platforms: ['instagram'], // Only Instagram
      imageBuffer: testImage,
      title: 'Instagram Test Post'
    });

    console.log(`\n✅ Post created with ID: ${result.postId}`);
    
    console.log('\n📊 Publishing Results:');
    result.results.forEach(r => {
      const emoji = r.success ? '✅' : '❌';
      console.log(`  ${emoji} ${r.platform.toUpperCase()}: ${r.success ? r.id || 'Success' : r.error}`);
      
      if (r.success && r.platform === 'instagram' && r.id) {
        console.log(`  📱 Instagram Post URL: https://www.instagram.com/p/${r.id}`);
      }
    });

    if (result.processedImageUrl) {
      console.log(`\n🖼️ Processed image: ${result.processedImageUrl}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

testInstagramImmediate().catch(console.error); 