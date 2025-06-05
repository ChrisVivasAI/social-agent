import 'dotenv/config';
import { InstagramClient } from '../src/clients/instagram.js';

async function testSimpleInstagramPost() {
  console.log('🧪 Testing Simple Instagram Post\n');

  try {
    const instagram = new InstagramClient();
    
    // Test with a simple image URL
    const testImageUrl = 'https://picsum.photos/1080/1080';
    const testCaption = '🧪 Simple Instagram API Test\n\nTesting the enhanced social media agent!\n\n#test #api #instagram';

    console.log('📱 Posting to Instagram...');
    console.log(`   Image: ${testImageUrl}`);
    console.log(`   Caption: ${testCaption.substring(0, 50)}...`);

    const postId = await instagram.postImageSimple({
      caption: testCaption,
      imageUrl: testImageUrl
    });

    console.log(`\n🎉 SUCCESS! Instagram post created: ${postId}`);
    console.log(`📱 View at: https://www.instagram.com/p/${postId}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('Container did not become ready')) {
      console.log('\n💡 Note: The container was created but status checking failed.');
      console.log('   This might mean the post was actually successful but took longer to process.');
      console.log('   Check your Instagram account manually.');
    }
  }
}

testSimpleInstagramPost().catch(console.error); 