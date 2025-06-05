import 'dotenv/config';
import { ImageProcessor } from '../src/utils/imageProcessor.js';
import { InstagramClient } from '../src/clients/instagram.js';
import { FacebookClient } from '../src/clients/facebook.js';
import { SupabaseManager } from '../src/clients/supabaseManager.js';
import { SocialMediaManager } from '../src/clients/socialMediaManager.js';

/**
 * Test script for new social media integrations
 */
class IntegrationTester {
  private supabase: SupabaseManager;
  private socialMediaManager: SocialMediaManager;

  constructor() {
    this.supabase = new SupabaseManager();
    this.socialMediaManager = new SocialMediaManager();
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting integration tests...\n');

    const tests = [
      { name: 'Supabase Connection', test: () => this.testSupabaseConnection() },
      { name: 'Image Processing', test: () => this.testImageProcessing() },
      { name: 'Instagram Client', test: () => this.testInstagramClient() },
      { name: 'Facebook Client', test: () => this.testFacebookClient() },
      { name: 'Social Media Manager', test: () => this.testSocialMediaManager() },
      { name: 'Database Operations', test: () => this.testDatabaseOperations() },
    ];

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const test of tests) {
      try {
        console.log(`🔍 Testing ${test.name}...`);
        await test.test();
        results.push({ name: test.name, success: true });
        console.log(`✅ ${test.name} test passed\n`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ name: test.name, success: false, error: errorMessage });
        console.error(`❌ ${test.name} test failed: ${errorMessage}\n`);
      }
    }

    // Print summary
    console.log('📊 Test Results Summary:');
    console.log('========================');
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📈 Overall: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Your integrations are ready to use.');
    } else {
      console.log('⚠️  Some tests failed. Please check the errors above.');
    }
  }

  /**
   * Test Supabase connection and basic operations
   */
  private async testSupabaseConnection(): Promise<void> {
    // Test connection
    const isConnected = await this.supabase.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Supabase');
    }

    // Test stats (this will work even with empty tables)
    const stats = await this.supabase.getStats();
    console.log(`   📊 Database stats: ${JSON.stringify(stats)}`);
  }

  /**
   * Test image processing functionality
   */
  private async testImageProcessing(): Promise<void> {
    // Create a simple test image using Sharp (100x100 red square)
    const sharp = (await import('sharp')).default;
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg()
    .toBuffer();

    // Test image validation
    const isValid = await ImageProcessor.validateImage(testImageBuffer);
    if (!isValid) {
      throw new Error('Test image validation failed');
    }

    // Test image processing
    const result = await ImageProcessor.processImageFor43AspectRatio(
      testImageBuffer,
      { title: 'Test Title' }
    );

    if (!result.buffer || result.width !== 1200 || result.height !== 900) {
      throw new Error('Image processing returned unexpected results');
    }

    console.log(`   🖼️ Processed image: ${result.width}x${result.height}`);
  }

  /**
   * Test Instagram client initialization and connection
   */
  private async testInstagramClient(): Promise<void> {
    const hasInstagramCredentials = process.env.INSTAGRAM_ACCESS_TOKEN && 
      (process.env.INSTAGRAM_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
    
    if (!hasInstagramCredentials) {
      console.log('   ⚠️ Instagram credentials not found, skipping Instagram tests');
      return;
    }

    const instagram = new InstagramClient();
    
    // Test connection
    const isConnected = await instagram.testConnection();
    if (!isConnected) {
      throw new Error('Instagram connection test failed');
    }

    // Test getting page info
    const pageInfo = await instagram.getPageInfo();
    console.log(`   📱 Instagram page: ${pageInfo.name} (${pageInfo.followers} followers)`);
  }

  /**
   * Test Facebook client initialization and connection
   */
  private async testFacebookClient(): Promise<void> {
    if (!process.env.FACEBOOK_ACCESS_TOKEN || !process.env.FACEBOOK_PAGE_ID) {
      console.log('   ⚠️ Facebook credentials not found, skipping Facebook tests');
      return;
    }

    const facebook = new FacebookClient();
    
    // Test connection
    const isConnected = await facebook.testConnection();
    if (!isConnected) {
      throw new Error('Facebook connection test failed');
    }

    // Test getting page info
    const pageInfo = await facebook.getPageInfo();
    console.log(`   📘 Facebook page: ${pageInfo.name} (${pageInfo.fan_count} fans)`);
  }

  /**
   * Test social media manager functionality
   */
  private async testSocialMediaManager(): Promise<void> {
    // Test initialization
    const availablePlatforms = this.socialMediaManager.getAvailablePlatforms();
    console.log(`   🌐 Available platforms: ${availablePlatforms.join(', ')}`);

    // Test connection testing
    const connections = await this.socialMediaManager.testConnections();
    console.log(`   🔗 Connection tests:`, connections);

    // Test stats
    const stats = await this.socialMediaManager.getStats();
    console.log(`   📊 Post stats:`, stats);
  }

  /**
   * Test database operations
   */
  private async testDatabaseOperations(): Promise<void> {
    // Create a test post
    const testPostData = {
      title: 'Test Post',
      content: 'This is a test post created by the integration tester',
      platforms: ['instagram', 'facebook'],
      status: 'draft' as const
    };

    const postId = await this.supabase.createPost(testPostData);
    console.log(`   📝 Created test post: ${postId}`);

    // Retrieve the post
    const retrievedPost = await this.supabase.getPost(postId);
    if (!retrievedPost || retrievedPost.title !== testPostData.title) {
      throw new Error('Failed to retrieve created post');
    }

    // Update the post
    await this.supabase.updatePost(postId, { status: 'published' });

    // Create a platform post record
    const platformPostId = await this.supabase.createPlatformPost({
      post_id: postId,
      platform: 'instagram',
      platform_post_id: 'test_instagram_id',
      status: 'published'
    });

    console.log(`   📱 Created platform post record: ${platformPostId}`);

    // Get platform posts
    const platformPosts = await this.supabase.getPlatformPosts(postId);
    if (platformPosts.length === 0) {
      throw new Error('Failed to retrieve platform posts');
    }

    console.log(`   ✅ Database operations completed successfully`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const tester = new IntegrationTester();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 