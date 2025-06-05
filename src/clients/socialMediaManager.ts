import { TwitterClient } from './twitter/client.js';
import { LinkedInClient } from './linkedin.js';
import { InstagramClient } from './instagram.js';
import { FacebookClient } from './facebook.js';
import { SupabaseManager, type PostData } from './supabaseManager.js';
import { ImageProcessor } from '../utils/imageProcessor.js';

export interface PostRequest {
  content: string;
  platforms: string[];
  imageUrl?: string;
  imageBuffer?: Buffer;
  title?: string;
  scheduleFor?: Date;
  originalUrl?: string;
}

export interface PostResult {
  platform: string;
  success: boolean;
  id?: string;
  error?: string;
}

export interface PublishResponse {
  postId: string;
  results: PostResult[];
  processedImageUrl?: string;
}

export class SocialMediaManager {
  private twitter?: TwitterClient;
  private linkedin?: LinkedInClient;
  private instagram?: InstagramClient;
  private facebook?: FacebookClient;
  private supabase: SupabaseManager;

  constructor() {
    this.supabase = new SupabaseManager();
    this.initializeClients();
  }

  /**
   * Initialize social media clients based on available environment variables
   */
  private initializeClients(): void {
    try {
      // Initialize Twitter client if credentials are available
      if (process.env.TWITTER_USER_TOKEN && process.env.TWITTER_USER_TOKEN_SECRET) {
        this.twitter = TwitterClient.fromBasicTwitterAuth();
        console.log('✅ Twitter client initialized');
      }

      // Initialize LinkedIn client if credentials are available
      if (process.env.LINKEDIN_ACCESS_TOKEN) {
        this.linkedin = new LinkedInClient();
        console.log('✅ LinkedIn client initialized');
      }

      // Initialize Instagram client if credentials are available
      if (process.env.INSTAGRAM_ACCESS_TOKEN && (process.env.INSTAGRAM_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID)) {
        this.instagram = new InstagramClient();
        console.log('✅ Instagram client initialized');
      }

      // Initialize Facebook client if credentials are available
      if (process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID) {
        this.facebook = new FacebookClient();
        console.log('✅ Facebook client initialized');
      }
    } catch (error) {
      console.error('Error initializing social media clients:', error);
    }
  }

  /**
   * Publish a post to multiple platforms
   */
  async publishPost(request: PostRequest): Promise<PublishResponse> {
    console.log(`📝 Publishing post to platforms: ${request.platforms.join(', ')}`);

    try {
      // Create post record in Supabase
      const postData: PostData = {
        title: request.title || 'Generated Post',
        content: request.content,
        platforms: request.platforms,
        image_url: request.imageUrl,
        original_url: request.originalUrl,
        status: request.scheduleFor ? 'scheduled' : 'draft',
        scheduled_for: request.scheduleFor?.toISOString()
      };

      const postId = await this.supabase.createPost(postData);

      // Process image if needed
      let processedImageUrl = request.imageUrl;
      if (request.imageBuffer || (request.imageUrl && request.title)) {
        processedImageUrl = await this.processAndUploadImage(
          request.imageBuffer || await this.downloadImage(request.imageUrl!),
          request.title,
          postId
        );

        // Update post with processed image URL
        await this.supabase.updatePost(postId, {
          processed_image_url: processedImageUrl
        });
      }

      // If scheduled, set up for future publishing
      if (request.scheduleFor) {
        await this.supabase.schedulePost(postId, request.scheduleFor);
        return { 
          postId, 
          results: [{ platform: 'scheduled', success: true, id: 'scheduled' }],
          processedImageUrl
        };
      }

      // Publish immediately to all platforms
      const results = await this.publishToPlatforms(
        postId,
        request.content,
        request.platforms,
        processedImageUrl
      );

      // Update post status based on results
      const allSuccessful = results.every(r => r.success);
      await this.supabase.updatePost(postId, {
        status: allSuccessful ? 'published' : 'failed'
      });

      return { postId, results, processedImageUrl };
    } catch (error) {
      console.error('Error publishing post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to publish post: ${errorMessage}`);
    }
  }

  /**
   * Publish to individual platforms
   */
  async publishToPlatforms(
    postId: string,
    content: string,
    platforms: string[],
    imageUrl?: string
  ): Promise<PostResult[]> {
    const results: PostResult[] = [];

    for (const platform of platforms) {
      try {
        console.log(`📤 Publishing to ${platform}...`);
        
        let platformPostId: string;

        switch (platform.toLowerCase()) {
          case 'twitter':
            platformPostId = await this.publishToTwitter(content, imageUrl);
            break;
          case 'linkedin':
            platformPostId = await this.publishToLinkedIn(content, imageUrl);
            break;
          case 'instagram':
            if (!imageUrl) {
              throw new Error('Instagram requires an image');
            }
            platformPostId = await this.publishToInstagram(content, imageUrl);
            break;
          case 'facebook':
            platformPostId = await this.publishToFacebook(content, imageUrl);
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Record successful publication
        await this.supabase.createPlatformPost({
          post_id: postId,
          platform: platform as any,
          platform_post_id: platformPostId,
          status: 'published'
        });

        results.push({ 
          platform, 
          success: true, 
          id: platformPostId 
        });

        console.log(`✅ Successfully published to ${platform}: ${platformPostId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Record failed publication
        await this.supabase.createPlatformPost({
          post_id: postId,
          platform: platform as any,
          status: 'failed',
          error_message: errorMessage
        });

        results.push({ 
          platform, 
          success: false, 
          error: errorMessage 
        });

        console.error(`❌ Failed to publish to ${platform}:`, errorMessage);
      }
    }

    return results;
  }

  /**
   * Process image and upload to storage
   */
  private async processAndUploadImage(
    imageBuffer: Buffer,
    title?: string,
    postId?: string
  ): Promise<string> {
    try {
      console.log('🖼️ Processing image...');

      // Process image to 4:3 aspect ratio with title
      const processedResult = await ImageProcessor.processImageFor43AspectRatio(
        imageBuffer,
        { title }
      );

      // Upload processed image
      const fileName = `processed_${postId || Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const imageUrl = await this.supabase.uploadImage(processedResult.buffer, fileName);

      console.log(`✅ Image processed and uploaded: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      console.error('Error processing image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process image: ${errorMessage}`);
    }
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Error downloading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to download image: ${errorMessage}`);
    }
  }

  // ==================== PLATFORM-SPECIFIC METHODS ====================

  private async publishToTwitter(content: string, imageUrl?: string): Promise<string> {
    if (!this.twitter) {
      throw new Error('Twitter client not initialized');
    }
    
    const tweetData: any = { text: content };
    
    if (imageUrl) {
      // Download and upload image to Twitter
      const imageBuffer = await this.downloadImage(imageUrl);
      const mediaId = await this.twitter.uploadMedia(imageBuffer, 'image/jpeg');
      tweetData.media = { media_ids: [mediaId] };
    }
    
    const result = await this.twitter.uploadTweet(tweetData);
    return result.data.id;
  }

  private async publishToLinkedIn(content: string, imageUrl?: string): Promise<string> {
    if (!this.linkedin) {
      throw new Error('LinkedIn client not initialized');
    }
    
    if (imageUrl) {
      const result = await this.linkedin.createImagePost({
        text: content,
        imageUrl
      });
      // LinkedIn returns a response object, extract the post ID from location header
      const locationHeader = (result as any).headers?.get?.('location');
      if (locationHeader) {
        const postId = locationHeader.split('/').pop();
        return postId || 'linkedin_post_created';
      }
      return 'linkedin_image_post_created';
    } else {
      const result = await this.linkedin.createTextPost(content);
      const locationHeader = (result as any).headers?.get?.('location');
      if (locationHeader) {
        const postId = locationHeader.split('/').pop();
        return postId || 'linkedin_post_created';
      }
      return 'linkedin_text_post_created';
    }
  }

  private async publishToInstagram(content: string, imageUrl: string): Promise<string> {
    if (!this.instagram) {
      throw new Error('Instagram client not initialized. Check INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_PAGE_ID environment variables.');
    }

    // Process image for Instagram (4:3 aspect ratio with title overlay)
    let processedImageUrl = imageUrl;
    try {
      console.log('📱 Instagram: Processing image for 4:3 aspect ratio...');
      const imageBuffer = await this.downloadImage(imageUrl);
      
      // Extract title from content (first line or first sentence)
      const title = content.split('\n')[0].split('.')[0].trim();
      
      // Process image to 4:3 aspect ratio with title overlay
      const processedResult = await ImageProcessor.processImageFor43AspectRatio(
        imageBuffer,
        { title }
      );

      // Upload processed image
      const fileName = `instagram_processed_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      processedImageUrl = await this.supabase.uploadImage(processedResult.buffer, fileName);
      
      console.log(`✅ Instagram: Image processed and uploaded: ${processedImageUrl}`);
    } catch (error) {
      console.warn('⚠️ Instagram: Image processing failed, using original:', error);
      // Continue with original image if processing fails
    }

    // Process caption for Instagram (remove URLs)
    const processedCaption = this.processInstagramCaption(content);

    return await this.instagram.postImageSimple({
      caption: processedCaption,
      imageUrl: processedImageUrl
    });
  }

  /**
   * Process Instagram caption by removing URLs (Instagram doesn't allow clickable links in captions)
   */
  private processInstagramCaption(content: string): string {
    // Remove URLs from the caption since Instagram doesn't make them clickable
    return content.replace(/https?:\/\/[^\s]+/g, '').trim();
  }

  private async publishToFacebook(content: string, imageUrl?: string): Promise<string> {
    if (!this.facebook) {
      throw new Error('Facebook client not initialized. Check FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables.');
    }

    return await this.facebook.postToPage({
      message: content,
      imageUrl
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Test all available platform connections
   */
  async testConnections(): Promise<{ [platform: string]: boolean }> {
    const results: { [platform: string]: boolean } = {};

    if (this.instagram) {
      results.instagram = await this.instagram.testConnection();
    }

    if (this.facebook) {
      results.facebook = await this.facebook.testConnection();
    }

    results.supabase = await this.supabase.testConnection();

    return results;
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): string[] {
    const platforms: string[] = [];

    if (this.twitter) platforms.push('twitter');
    if (this.linkedin) platforms.push('linkedin');
    if (this.instagram) platforms.push('instagram');
    if (this.facebook) platforms.push('facebook');

    return platforms;
  }

  /**
   * Get post statistics
   */
  async getStats() {
    return await this.supabase.getStats();
  }

  /**
   * Get posts with filtering
   */
  async getPosts(filters?: {
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.supabase.getPosts(filters);
  }

  /**
   * Get a specific post
   */
  async getPost(id: string) {
    return await this.supabase.getPost(id);
  }

  /**
   * Process scheduled posts (called by cron job)
   */
  async processScheduledPosts(): Promise<void> {
    console.log('🕐 Processing scheduled posts...');

    try {
      const scheduledPosts = await this.supabase.getScheduledPosts();
      
      for (const post of scheduledPosts) {
        await this.processScheduledPost(post);
      }

      console.log(`✅ Processed ${scheduledPosts.length} scheduled posts`);
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  }

  /**
   * Process a single scheduled post
   */
  private async processScheduledPost(post: PostData): Promise<void> {
    try {
      console.log(`📤 Publishing scheduled post ${post.id} to platforms:`, post.platforms);

      const results = await this.publishToPlatforms(
        post.id!,
        post.content,
        post.platforms,
        post.processed_image_url || post.image_url
      );

      // Update post status
      const allSuccessful = results.every(r => r.success);
      await this.supabase.updatePost(post.id!, {
        status: allSuccessful ? 'published' : 'failed'
      });

      console.log(`✅ Scheduled post ${post.id} processed:`, results);
    } catch (error) {
      console.error(`❌ Error processing scheduled post ${post.id}:`, error);
      
      await this.supabase.updatePost(post.id!, {
        status: 'failed'
      });
    }
  }
} 