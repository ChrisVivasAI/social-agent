import { createSupabaseClient } from '../utils/supabase.js';

export interface FacebookPostOptions {
  message: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
  link?: string;
}

export interface FacebookConfig {
  accessToken: string;
  pageId: string;
  appId?: string;
  appSecret?: string;
}

export class FacebookClient {
  private pageId: string;
  private accessToken: string;

  constructor(config?: FacebookConfig) {
    // Use provided config or fall back to environment variables
    this.accessToken = config?.accessToken || process.env.FACEBOOK_ACCESS_TOKEN!;
    this.pageId = config?.pageId || process.env.FACEBOOK_PAGE_ID!;

    if (!this.accessToken || !this.pageId) {
      throw new Error('Facebook access token and page ID are required. Set FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables.');
    }

    console.log(`Facebook client initialized for page: ${this.pageId}`);
  }

  /**
   * Initialize Facebook SDK
   */
  private async initializeFacebookSDK() {
    const { FacebookAdsApi } = await import('facebook-nodejs-business-sdk');
    FacebookAdsApi.init(this.accessToken);
    return { FacebookAdsApi };
  }

  /**
   * Post a message to Facebook page
   */
  async postToPage(options: FacebookPostOptions): Promise<string> {
    const { message, imageUrl, link } = options;

    try {
      await this.initializeFacebookSDK();
      const { Page } = await import('facebook-nodejs-business-sdk');

      console.log(`Posting to Facebook page: ${message.substring(0, 50)}...`);

      const page = new Page(this.pageId);
      
      // If we have an image, use the photos endpoint
      if (imageUrl) {
        const photoData = {
          message,
          url: imageUrl
        };

        const response = await page.createPhoto([], photoData);
        console.log(`✅ Facebook photo post created: ${response.id}`);
        return response.id;
      } else {
        // Text-only post or post with link
        const postData: any = {
          message
        };

        if (link) {
          postData.link = link;
        }

        const response = await page.createFeed([], postData);
        console.log(`✅ Facebook post created: ${response.id}`);
        return response.id;
      }
    } catch (error) {
      console.error('Error posting to Facebook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Facebook posting failed: ${errorMessage}`);
    }
  }

  /**
   * Test Facebook connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const pageInfo = await this.getPageInfo();
      console.log(`✅ Facebook connection test successful: ${pageInfo.name}`);
      return true;
    } catch (error) {
      console.error('❌ Facebook connection test failed:', error);
      return false;
    }
  }

  /**
   * Get Facebook page information
   */
  async getPageInfo(): Promise<{
    id: string;
    name: string;
    fan_count: number;
    about?: string;
  }> {
    try {
      await this.initializeFacebookSDK();
      const { Page } = await import('facebook-nodejs-business-sdk');

      const page = new Page(this.pageId);
      const pageData = await page.read(['id', 'name', 'fan_count', 'about']);

      return {
        id: pageData.id,
        name: pageData.name,
        fan_count: pageData.fan_count || 0,
        about: pageData.about
      };
    } catch (error) {
      console.error('Error getting Facebook page info:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get Facebook page info: ${errorMessage}`);
    }
  }

  /**
   * Upload image to Facebook and get URL
   */
  async uploadImage(imageBuffer: Buffer): Promise<string> {
    try {
      // For now, we'll use Supabase to store the image and return the URL
      // In a production environment, you might want to upload directly to Facebook
      const supabase = createSupabaseClient();
      
      const fileName = `facebook_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(data.path);

      console.log(`✅ Image uploaded for Facebook: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image for Facebook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload image: ${errorMessage}`);
    }
  }

  /**
   * Get page posts (for analytics)
   */
  async getPagePosts(limit: number = 10): Promise<any[]> {
    try {
      await this.initializeFacebookSDK();
      const { Page } = await import('facebook-nodejs-business-sdk');

      const page = new Page(this.pageId);
      const posts = await page.read(['posts{id,message,created_time,likes.summary(true),comments.summary(true)}']);

      return posts.posts?.data?.slice(0, limit) || [];
    } catch (error) {
      console.error('Error getting Facebook page posts:', error);
      return [];
    }
  }
} 