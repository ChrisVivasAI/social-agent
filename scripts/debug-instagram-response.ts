import 'dotenv/config';
import { InstagramClient } from '../src/clients/instagram.js';
import { PostPagePhotoMediaRequest, PostPublishMediaRequest } from 'instagram-graph-api';

async function debugInstagramResponse() {
  console.log('🔍 Debugging Instagram API Responses\n');

  try {
    const instagram = new InstagramClient();
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
    const pageId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
    
    // Test with a simple image URL
    const testImageUrl = 'https://picsum.photos/800/800';
    const testCaption = '🔍 Debug Test - Instagram API Response Analysis';

    console.log('📱 Step 1: Creating media container...');
    
    const createRequest = new PostPagePhotoMediaRequest(
      accessToken,
      pageId,
      testImageUrl,
      testCaption
    );

    const createResponse = await createRequest.execute();
    
    console.log('📊 Create Response Object:');
    console.log('   Type:', typeof createResponse);
    console.log('   Constructor:', createResponse.constructor.name);
    console.log('   Keys:', Object.keys(createResponse));
    console.log('   Full Response:', createResponse);
    
    // Try different ways to get the ID
    console.log('\n🔍 Trying different ID access methods:');
    console.log('   .getId():', (createResponse as any).getId?.());
    console.log('   .id:', (createResponse as any).id);
    console.log('   .data?.id:', (createResponse as any).data?.id);
    console.log('   .response?.id:', (createResponse as any).response?.id);
    
    // Try to get the container ID
    let containerId;
    if (typeof (createResponse as any).getId === 'function') {
      containerId = (createResponse as any).getId();
    } else if ((createResponse as any).id) {
      containerId = (createResponse as any).id;
    } else if ((createResponse as any).data?.id) {
      containerId = (createResponse as any).data.id;
    }
    
    console.log(`\n📦 Container ID: ${containerId}`);
    
    if (containerId) {
      console.log('\n📱 Step 2: Attempting to publish...');
      
      const publishRequest = new PostPublishMediaRequest(
        accessToken,
        pageId,
        containerId
      );

      try {
        const publishResponse = await publishRequest.execute();
        
        console.log('📊 Publish Response Object:');
        console.log('   Type:', typeof publishResponse);
        console.log('   Constructor:', publishResponse.constructor.name);
        console.log('   Keys:', Object.keys(publishResponse));
        console.log('   Full Response:', publishResponse);
        
        console.log('\n🔍 Trying different ID access methods:');
        console.log('   .getId():', (publishResponse as any).getId?.());
        console.log('   .id:', (publishResponse as any).id);
        console.log('   .data?.id:', (publishResponse as any).data?.id);
        console.log('   .response?.id:', (publishResponse as any).response?.id);
        
      } catch (publishError) {
        console.log('❌ Publish failed:', publishError);
      }
    }

  } catch (error) {
    console.error('\n❌ Debug failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

debugInstagramResponse().catch(console.error); 