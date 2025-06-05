#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { SocialMediaManager } from '../src/clients/socialMediaManager.js';
import { SupabaseManager } from '../src/clients/supabaseManager.js';

async function testSpecificPost() {
  console.log('🧪 Testing specific post and Instagram processing...\n');

  try {
    const supabase = new SupabaseManager();
    const socialMediaManager = new SocialMediaManager();

    // Get the specific post
    const postId = 'de42f4a6-3992-4000-8622-30f09b3e114b';
    const post = await supabase.getPost(postId);
    
    if (!post) {
      console.log('❌ Post not found');
      return;
    }

    console.log('📝 Post details:');
    console.log(`   ID: ${post.id}`);
    console.log(`   Title: ${post.title}`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Content: ${post.content}`);
    console.log(`   Image: ${post.image_url}`);
    console.log(`   Platforms: ${post.platforms.join(', ')}`);

    // Test Instagram caption processing
    console.log('\n📱 Testing Instagram caption processing...');
    const originalContent = post.content;
    const processedCaption = (socialMediaManager as any).processInstagramCaption(originalContent);
    
    console.log('\nOriginal content:');
    console.log(originalContent);
    console.log('\nProcessed caption:');
    console.log(processedCaption);
    
    // Test if URLs were removed
    const hasUrls = /https?:\/\/[^\s]+/.test(originalContent);
    const processedHasUrls = /https?:\/\/[^\s]+/.test(processedCaption);
    console.log(`\nURLs in original: ${hasUrls}`);
    console.log(`URLs in processed: ${processedHasUrls}`);
    
    if (hasUrls && !processedHasUrls) {
      console.log('✅ Instagram caption processing working correctly - URLs removed');
    } else if (!hasUrls) {
      console.log('ℹ️ No URLs in original content to test removal');
    } else {
      console.log('❌ Instagram caption processing failed - URLs still present');
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSpecificPost(); 