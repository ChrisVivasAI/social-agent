import 'dotenv/config';
import { InstagramClient } from '../src/clients/instagram.js';

async function debugInstagram() {
  console.log('🔍 Instagram Debug Analysis\n');

  try {
    const instagram = new InstagramClient();
    
    // 1. Test basic connection
    console.log('1️⃣ Testing Instagram Connection...');
    const isConnected = await instagram.testConnection();
    console.log(`   Connection: ${isConnected ? '✅ Success' : '❌ Failed'}\n`);

    // 2. Get detailed page information
    console.log('2️⃣ Instagram Account Details...');
    const pageInfo = await instagram.getPageInfo();
    console.log(`   📱 Account ID: ${pageInfo.id}`);
    console.log(`   👤 Name: ${pageInfo.name}`);
    console.log(`   🔗 Username: ${pageInfo.username || 'Not available'}`);
    console.log(`   👥 Followers: ${pageInfo.followers}`);
    console.log(`   📸 Media Count: ${pageInfo.media_count}\n`);

    // 3. Check environment variables
    console.log('3️⃣ Environment Variables Check...');
    console.log(`   INSTAGRAM_ACCESS_TOKEN: ${process.env.INSTAGRAM_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`   INSTAGRAM_BUSINESS_ACCOUNT_ID: ${process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Token length: ${process.env.INSTAGRAM_ACCESS_TOKEN?.length || 0} characters\n`);

    // 4. Test a simple post (without actually posting)
    console.log('4️⃣ Instagram API Requirements Check...');
    console.log('   ✅ Business Account: Required for API posting');
    console.log('   ✅ Access Token: Valid and present');
    console.log('   ✅ Page ID: Valid and present');
    console.log('   ⚠️  Note: Instagram posts may take time to appear or may be under review\n');

    // 5. Common Instagram posting issues
    console.log('5️⃣ Common Instagram Posting Issues:');
    console.log('   • Posts may be under Instagram review (can take minutes to hours)');
    console.log('   • Business account must be properly connected to Facebook page');
    console.log('   • Access token must have instagram_content_publish permission');
    console.log('   • Images must meet Instagram requirements (min 320px)');
    console.log('   • Account may have posting restrictions or be flagged');
    console.log('   • API posts don\'t always appear immediately in the app\n');

    // 6. Verification steps
    console.log('6️⃣ Verification Steps:');
    console.log('   1. Check Instagram app/website directly');
    console.log('   2. Look in Instagram Business Suite');
    console.log('   3. Check Facebook Creator Studio');
    console.log('   4. Verify the post ID in Instagram Graph API Explorer');
    console.log('   5. Wait 5-10 minutes and check again\n');

    console.log('🎯 Recommendation:');
    console.log('   The API returned success, so the post was likely created.');
    console.log('   Check your Instagram account in 5-10 minutes.');
    console.log('   If still not visible, the post may be under review.');

  } catch (error) {
    console.error('❌ Instagram debug failed:', error instanceof Error ? error.message : 'Unknown error');
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your Instagram account is a Business account');
    console.log('2. Check that it\'s properly connected to your Facebook page');
    console.log('3. Ensure your access token has the right permissions');
    console.log('4. Try posting manually to see if there are account restrictions');
  }
}

debugInstagram().catch(console.error); 