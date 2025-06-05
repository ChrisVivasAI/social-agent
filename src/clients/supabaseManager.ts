import { createSupabaseClient } from '../utils/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PostData {
  id?: string;
  title: string;
  content: string;
  original_url?: string;
  image_url?: string;
  processed_image_url?: string;
  platforms: string[];
  status?: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_for?: string;
  metadata?: any;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformPostData {
  post_id: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook';
  platform_post_id?: string;
  status?: 'pending' | 'published' | 'failed';
  error_message?: string;
  metadata?: any;
}

export interface ScheduledJobData {
  post_id: string;
  job_name: string;
  scheduled_for: string;
  status?: 'pending' | 'completed' | 'failed' | 'cancelled';
}

export class SupabaseManager {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  // ==================== POST MANAGEMENT ====================

  /**
   * Create a new post record
   */
  async createPost(postData: PostData): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('posts')
        .insert({
          ...postData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      
      console.log(`✅ Created post record: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('Error creating post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create post: ${errorMessage}`);
    }
  }

  /**
   * Update an existing post
   */
  async updatePost(id: string, updates: Partial<PostData>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('posts')
        .update({ 
          ...updates, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
      
      console.log(`✅ Updated post: ${id}`);
    } catch (error) {
      console.error('Error updating post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update post: ${errorMessage}`);
    }
  }

  /**
   * Get a post by ID
   */
  async getPost(id: string): Promise<PostData | null> {
    try {
      const { data, error } = await this.supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting post:', error);
      return null;
    }
  }

  /**
   * Get posts ready for publishing (scheduled posts that are due)
   */
  async getScheduledPosts(): Promise<PostData[]> {
    try {
      const { data, error } = await this.supabase
        .from('posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting scheduled posts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get scheduled posts: ${errorMessage}`);
    }
  }

  /**
   * Get all posts with optional filtering
   */
  async getPosts(filters?: {
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }): Promise<PostData[]> {
    try {
      let query = this.supabase
        .from('posts')
        .select('*');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.platform) {
        query = query.contains('platforms', [filters.platform]);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting posts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get posts: ${errorMessage}`);
    }
  }

  // ==================== PLATFORM POST TRACKING ====================

  /**
   * Create a platform post record
   */
  async createPlatformPost(platformPostData: PlatformPostData): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('platform_posts')
        .insert({
          ...platformPostData,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      
      console.log(`✅ Created platform post record: ${data.id} (${platformPostData.platform})`);
      return data.id;
    } catch (error) {
      console.error('Error creating platform post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create platform post: ${errorMessage}`);
    }
  }

  /**
   * Update a platform post record
   */
  async updatePlatformPost(id: string, updates: Partial<PlatformPostData>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('platform_posts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      console.log(`✅ Updated platform post: ${id}`);
    } catch (error) {
      console.error('Error updating platform post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update platform post: ${errorMessage}`);
    }
  }

  /**
   * Get platform posts for a specific post
   */
  async getPlatformPosts(postId: string): Promise<PlatformPostData[]> {
    try {
      const { data, error } = await this.supabase
        .from('platform_posts')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting platform posts:', error);
      return [];
    }
  }

  // ==================== IMAGE STORAGE ====================

  /**
   * Upload an image buffer to Supabase storage
   */
  async uploadImage(buffer: Buffer, fileName: string): Promise<string> {
    try {
      // Ensure the bucket exists
      await this.ensureBucketExists('post-images');

      const { data, error } = await this.supabase.storage
        .from('post-images')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = this.supabase.storage
        .from('post-images')
        .getPublicUrl(data.path);

      console.log(`✅ Image uploaded: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload image: ${errorMessage}`);
    }
  }

  /**
   * Ensure a storage bucket exists
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(bucketName, {
          public: true
        });
        
        if (error && !error.message.includes('already exists')) {
          throw error;
        }
        
        console.log(`✅ Created storage bucket: ${bucketName}`);
      }
    } catch (error) {
      // Bucket might already exist, which is fine
      console.log(`Storage bucket ${bucketName} check completed`);
    }
  }

  // ==================== SCHEDULING ====================

  /**
   * Schedule a post for future publishing
   */
  async schedulePost(postId: string, scheduledFor: Date): Promise<void> {
    try {
      // Update the post status and scheduled time
      await this.updatePost(postId, {
        status: 'scheduled',
        scheduled_for: scheduledFor.toISOString()
      });

      // Create a scheduled job record
      const jobName = `post_${postId}_${Date.now()}`;
      
      const { error } = await this.supabase
        .from('scheduled_jobs')
        .insert({
          post_id: postId,
          job_name: jobName,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      console.log(`✅ Post scheduled for ${scheduledFor.toISOString()}: ${postId}`);
    } catch (error) {
      console.error('Error scheduling post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to schedule post: ${errorMessage}`);
    }
  }

  /**
   * Get scheduled jobs
   */
  async getScheduledJobs(status?: string): Promise<ScheduledJobData[]> {
    try {
      let query = this.supabase
        .from('scheduled_jobs')
        .select('*');

      if (status) {
        query = query.eq('status', status);
      }

      query = query.order('scheduled_for', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting scheduled jobs:', error);
      return [];
    }
  }

  /**
   * Update a scheduled job status
   */
  async updateScheduledJob(jobName: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const updates: any = { 
        status,
        completed_at: new Date().toISOString()
      };

      if (errorMessage) {
        updates.error_message = errorMessage;
      }

      const { error } = await this.supabase
        .from('scheduled_jobs')
        .update(updates)
        .eq('job_name', jobName);

      if (error) throw error;
      
      console.log(`✅ Updated scheduled job: ${jobName} -> ${status}`);
    } catch (error) {
      console.error('Error updating scheduled job:', error);
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Test the Supabase connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { data: _data, error } = await this.supabase
        .from('posts')
        .select('count')
        .limit(1);

      if (error) throw error;
      
      console.log('✅ Supabase connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Supabase connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    failedPosts: number;
  }> {
    try {
      const { data: totalData } = await this.supabase
        .from('posts')
        .select('count');

      const { data: publishedData } = await this.supabase
        .from('posts')
        .select('count')
        .eq('status', 'published');

      const { data: scheduledData } = await this.supabase
        .from('posts')
        .select('count')
        .eq('status', 'scheduled');

      const { data: failedData } = await this.supabase
        .from('posts')
        .select('count')
        .eq('status', 'failed');

      return {
        totalPosts: totalData?.[0]?.count || 0,
        publishedPosts: publishedData?.[0]?.count || 0,
        scheduledPosts: scheduledData?.[0]?.count || 0,
        failedPosts: failedData?.[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalPosts: 0,
        publishedPosts: 0,
        scheduledPosts: 0,
        failedPosts: 0
      };
    }
  }
} 