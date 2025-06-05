import { 
  Client, 
  PostPagePhotoMediaRequest,
  PostPublishMediaRequest,
  GetLinkedInstagramAccountRequest,
  GetAuthorizedFacebookPagesRequest 
} from 'instagram-graph-api';
import { createSupabaseClient } from '../utils/supabase.js';

export interface InstagramPostOptions {
  caption: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
}

export interface InstagramConfig {
  accessToken: string;
  pageId: string;
  appId?: string;
  appSecret?: string;
}

export class InstagramClient {
  private client: Client;
  private pageId: string;
  private accessToken: string;

  constructor(config?: InstagramConfig) {
    // Use provided config or fall back to environment variables
    this.accessToken = config?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN!;
    // Support both INSTAGRAM_PAGE_ID and INSTAGRAM_BUSINESS_ACCOUNT_ID
    this.pageId = config?.pageId || process.env.INSTAGRAM_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;

    if (!this.accessToken || !this.pageId) {
      throw new Error('Instagram access token and page ID are required. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_PAGE_ID (or INSTAGRAM_BUSINESS_ACCOUNT_ID) environment variables.');
    }

    this.client = new Client(this.accessToken, this.pageId);
    console.log(`Instagram client initialized for page: ${this.pageId}`);
  }

  /**
   * Post an image to Instagram with caption (complete two-step process)
   */
  async postImage(options: InstagramPostOptions): Promise<string> {
    const { caption, imageUrl, imageBuffer } = options;

    if (!imageUrl && !imageBuffer) {
      throw new Error('Either imageUrl or imageBuffer must be provided');
    }

    try {
      // Step 1: If we have a buffer, upload it first
      let finalImageUrl = imageUrl;
      if (imageBuffer && !imageUrl) {
        finalImageUrl = await this.uploadImageBuffer(imageBuffer);
      }

      if (!finalImageUrl) {
        throw new Error('No image URL available for posting');
      }

      console.log(`📱 Instagram: Creating media container...`);
      console.log(`   Image URL: ${finalImageUrl}`);
      console.log(`   Caption: ${caption.substring(0, 50)}...`);

      // Step 1: Create media container
      const createRequest = new PostPagePhotoMediaRequest(
        this.accessToken,
        this.pageId,
        finalImageUrl,
        caption
      );

      const createResponse = await createRequest.execute();
      
      // Check for errors in response
      if ((createResponse as any).data?.error) {
        const error = (createResponse as any).data.error;
        throw new Error(`Instagram API Error: ${error.message} (Code: ${error.code})`);
      }

      // Extract container ID from response
      let containerId = (createResponse as any).data?.id || (createResponse as any).id;
      if (!containerId) {
        console.log('Debug - Full create response:', createResponse);
        throw new Error('Failed to get container ID from Instagram API response');
      }

      console.log(`✅ Instagram: Media container created: ${containerId}`);

      // Step 2: Wait for container to be ready and then publish
      console.log(`⏳ Instagram: Waiting for container to be ready...`);
      await this.waitForContainerReady(containerId);

      // Step 3: Publish the container
      console.log(`📤 Instagram: Publishing media container...`);
      const publishRequest = new PostPublishMediaRequest(
        this.accessToken,
        this.pageId,
        containerId
      );

      const publishResponse = await publishRequest.execute();
      
      // Check for errors in publish response
      if ((publishResponse as any).data?.error) {
        const error = (publishResponse as any).data.error;
        throw new Error(`Instagram Publish Error: ${error.message} (Code: ${error.code})`);
      }

      // Extract post ID from response
      let postId = (publishResponse as any).data?.id || (publishResponse as any).id;
      if (!postId) {
        console.log('Debug - Full publish response:', publishResponse);
        throw new Error('Failed to get post ID from Instagram API response');
      }

      console.log(`🎉 Instagram: Post published successfully: ${postId}`);
      return postId;
    } catch (error) {
      console.error('❌ Instagram posting error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to post to Instagram: ${errorMessage}`);
    }
  }

  /**
   * Post an image to Instagram with caption (simple version - tries immediate publish)
   */
  async postImageSimple(options: InstagramPostOptions): Promise<string> {
    const { caption, imageUrl, imageBuffer } = options;

    if (!imageUrl && !imageBuffer) {
      throw new Error('Either imageUrl or imageBuffer must be provided');
    }

    try {
      // Step 1: If we have a buffer, upload it first
      let finalImageUrl = imageUrl;
      if (imageBuffer && !imageUrl) {
        finalImageUrl = await this.uploadImageBuffer(imageBuffer);
      }

      if (!finalImageUrl) {
        throw new Error('No image URL available for posting');
      }

      console.log(`📱 Instagram: Creating media container...`);
      console.log(`   Image URL: ${finalImageUrl}`);
      console.log(`   Caption: ${caption.substring(0, 50)}...`);

      // Step 1: Create media container
      const createRequest = new PostPagePhotoMediaRequest(
        this.accessToken,
        this.pageId,
        finalImageUrl,
        caption
      );

      const createResponse = await createRequest.execute();
      
      // Check for errors in response
      if ((createResponse as any).data?.error) {
        const error = (createResponse as any).data.error;
        throw new Error(`Instagram API Error: ${error.message} (Code: ${error.code})`);
      }

      // Extract container ID from response
      let containerId = (createResponse as any).data?.id || (createResponse as any).id;
      if (!containerId) {
        console.log('Debug - Full create response:', createResponse);
        throw new Error('Failed to get container ID from Instagram API response');
      }

      console.log(`✅ Instagram: Media container created: ${containerId}`);

      // Step 2: Try to publish immediately (some containers are ready right away)
      console.log(`📤 Instagram: Attempting immediate publish...`);
      try {
        const publishRequest = new PostPublishMediaRequest(
          this.accessToken,
          this.pageId,
          containerId
        );

        const publishResponse = await publishRequest.execute();
        
        // Check for errors in publish response
        if ((publishResponse as any).data?.error) {
          const error = (publishResponse as any).data.error;
          throw new Error(`Instagram Publish Error: ${error.message} (Code: ${error.code})`);
        }

        // Extract post ID from response
        let postId = (publishResponse as any).data?.id || (publishResponse as any).id;
        if (!postId) {
          console.log('Debug - Full publish response:', publishResponse);
          throw new Error('Failed to get post ID from Instagram API response');
        }

        console.log(`🎉 Instagram: Post published successfully: ${postId}`);
        return postId;
      } catch (publishError) {
        console.log(`⚠️ Instagram: Immediate publish failed, container may need processing time`);
        console.log(`   Container ID: ${containerId}`);
        console.log(`   Error: ${publishError instanceof Error ? publishError.message : 'Unknown error'}`);
        
        // Return the container ID so user knows what was created
        throw new Error(`Container created (${containerId}) but publish failed. The container may need more processing time.`);
      }
    } catch (error) {
      console.error('❌ Instagram posting error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to post to Instagram: ${errorMessage}`);
    }
  }

  /**
   * Wait for media container to be ready for publishing
   */
  private async waitForContainerReady(containerId: string, maxAttempts: number = 10): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check container status using direct API call
        const statusUrl = `https://graph.instagram.com/v23.0/${containerId}?fields=status_code&access_token=${this.accessToken}`;
        const response = await fetch(statusUrl);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(`API error: ${data.error?.message || 'Unknown error'}`);
        }

        const status = data.status_code;
        console.log(`   📊 Container status (attempt ${attempt}): ${status}`);

        if (status === 'FINISHED') {
          console.log(`✅ Instagram: Container is ready for publishing`);
          return;
        }

        if (status === 'ERROR') {
          throw new Error('Container processing failed');
        }

        if (status === 'EXPIRED') {
          throw new Error('Container expired before it could be published');
        }

        // Wait 10 seconds before checking again
        if (attempt < maxAttempts) {
          console.log(`   ⏳ Waiting 10 seconds before next check...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Container did not become ready after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        console.log(`   ⚠️ Status check failed (attempt ${attempt}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`Container did not become ready after ${maxAttempts} attempts`);
  }

  /**
   * Get Instagram page information
   */
  async getPageInfo() {
    try {
      const request = this.client.newGetPageInfoRequest();
      const response = await request.execute();
      
      return {
        id: response.getId(),
        name: response.getName(),
        username: response.getUsername(),
        followers: response.getFollowers(),
        media_count: response.getMediaCount()
      };
    } catch (error) {
      console.error('Error getting Instagram page info:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get Instagram page info: ${errorMessage}`);
    }
  }

  /**
   * Upload image buffer to Supabase storage and return public URL
   */
  private async uploadImageBuffer(buffer: Buffer): Promise<string> {
    try {
      const supabase = createSupabaseClient();
      const fileName = `instagram_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(data.path);

      console.log(`📤 Image uploaded to Supabase: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image to Supabase:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload image: ${errorMessage}`);
    }
  }

  /**
   * Get linked Instagram account from Facebook page
   */
  static async getLinkedInstagramAccount(facebookPageId: string, accessToken: string): Promise<string> {
    try {
      const request = new GetLinkedInstagramAccountRequest(accessToken, facebookPageId);
      const response = await request.execute();
      return response.getInstagramPageId();
    } catch (error) {
      console.error('Error getting linked Instagram account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get linked Instagram account: ${errorMessage}`);
    }
  }

  /**
   * Get authorized Facebook pages
   */
  static async getAuthorizedFacebookPages(accessToken: string): Promise<any[]> {
    try {
      const request = new GetAuthorizedFacebookPagesRequest(accessToken);
      const response = await request.execute();
      return response.getAuthorizedFacebookPages();
    } catch (error) {
      console.error('Error getting authorized Facebook pages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get authorized Facebook pages: ${errorMessage}`);
    }
  }

  /**
   * Test the Instagram connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getPageInfo();
      console.log('✅ Instagram connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Instagram connection test failed:', error);
      return false;
    }
  }
} 