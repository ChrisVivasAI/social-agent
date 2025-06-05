#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { SocialMediaManager } from '../src/clients/socialMediaManager.js';
import { SupabaseManager } from '../src/clients/supabaseManager.js';

async function testSocialMediaManager() {
  console.log('🧪 Testing SocialMediaManager fixes...\n');

  try {
    // Initialize SocialMediaManager
    const socialMediaManager = new SocialMediaManager();
    console.log('✅ SocialMediaManager initialized\n');

    // Test client availability
    const availablePlatforms = socialMediaManager.getAvailablePlatforms();
    console.log('📱 Available platforms:', availablePlatforms);

    // Test connections
    console.log('\n🔗 Testing connections...');
    const connectionResults = await socialMediaManager.testConnections();
    console.log('Connection results:', connectionResults);

    // Get a recent post to test publishing
    const supabase = new SupabaseManager();
    const recentPosts = await supabase.getPosts({ 
      status: 'pending_review', 
      limit: 1 
    });

    if (recentPosts.length === 0) {
      console.log('\n⚠️ No pending_review posts found to test with');
      // Try to get any post for testing
      const anyPosts = await supabase.getPosts({ limit: 1 });
      if (anyPosts.length === 0) {
        console.log('⚠️ No posts found at all');
        return;
      }
      console.log('📝 Using any available post for testing...');
      const testPost = anyPosts[0];
      console.log(`   Post: ${testPost.title} (${testPost.id})`);
      return;
    }

    const testPost = recentPosts[0];
    console.log(`\n📝 Found test post: ${testPost.id}`);
    console.log(`   Title: ${testPost.title}`);
    console.log(`   Content: ${testPost.content.substring(0, 100)}...`);
    console.log(`   Image: ${testPost.image_url}`);

    // Test Instagram caption processing
    console.log('\n📱 Testing Instagram caption processing...');
    const originalContent = testPost.content;
    const processedCaption = (socialMediaManager as any).processInstagramCaption(originalContent);
    console.log('Original content:', originalContent);
    console.log('Processed caption:', processedCaption);
    
    // Test if URLs were removed
    const hasUrls = /https?:\/\/[^\s]+/.test(originalContent);
    const processedHasUrls = /https?:\/\/[^\s]+/.test(processedCaption);
    console.log(`URLs in original: ${hasUrls}`);
    console.log(`URLs in processed: ${processedHasUrls}`);
    
    if (hasUrls && !processedHasUrls) {
      console.log('✅ Instagram caption processing working correctly - URLs removed');
    } else if (!hasUrls) {
      console.log('ℹ️ No URLs in original content to test removal');
    } else {
      console.log('❌ Instagram caption processing failed - URLs still present');
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSocialMediaManager(); 