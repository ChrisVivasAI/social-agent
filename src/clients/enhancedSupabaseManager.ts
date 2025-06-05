import { createSupabaseClient } from '../utils/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== ENHANCED INTERFACES ====================

export interface EnhancedPostData {
  id?: string;
  title: string;
  content: string;
  original_content?: string;
  original_url?: string;
  image_url?: string;
  processed_image_url?: string;
  selected_image_url?: string;
  platforms: string[];
  workflow_state?: 'draft' | 'pending_review' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
  user_timezone?: string;
  scheduled_for_utc?: string;
  scheduled_for_user_tz?: string;
  user_modifications?: any;
  platform_config?: any;
  discord_thread_id?: string;
  discord_message_id?: string;
  created_by_discord?: boolean;
  generation_metadata?: any;
  metadata?: any;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  last_modified_at?: string;
}

export interface PostVariation {
  id?: string;
  post_id: string;
  variation_type: 'original' | 'user_edit' | 'ai_alternative' | 'platform_specific';
  content: string;
  platform?: string;
  is_selected?: boolean;
  created_by?: string;
  created_at?: string;
}

export interface PostImageOption {
  id?: string;
  post_id: string;
  image_url: string;
  processed_image_url?: string;
  image_description?: string;
  image_source?: 'youtube' | 'screenshot' | 'upload' | 'ai_generated';
  is_selected?: boolean;
  option_index?: number;
  metadata?: any;
  created_at?: string;
}

export interface DiscordInteraction {
  id?: string;
  post_id?: string;
  discord_user_id: string;
  discord_username?: string;
  discord_channel_id: string;
  discord_message_id?: string;
  command_type: 'generate' | 'schedule' | 'modify' | 'select_image' | 'publish' | 'cancel' | 'review' | 'list' | 'view' | 'help' | 'unknown';
  command_data?: any;
  response_message_id?: string;
  response_data?: any;
  status?: 'pending' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

export interface UserPreferences {
  id?: string;
  discord_user_id: string;
  discord_username?: string;
  timezone?: string;
  default_platforms?: string[];
  notification_preferences?: any;
  scheduling_preferences?: any;
  content_preferences?: any;
  created_at?: string;
  updated_at?: string;
}

export interface PostScheduling {
  id?: string;
  post_id: string;
  scheduled_for_utc: string;
  scheduled_for_user_tz: string;
  user_timezone: string;
  recurrence_pattern?: any;
  is_recurring?: boolean;
  next_occurrence?: string;
  created_by_discord_user?: string;
  scheduling_command_id?: string;
  status?: 'pending' | 'completed' | 'failed' | 'cancelled';
  published_at?: string;
  error_message?: string;
  created_at?: string;
}

export interface TimezoneConversionOptions {
  fromTimezone?: string;
  toTimezone?: string;
  userTimezone?: string;
}

// ==================== ENHANCED SUPABASE MANAGER ====================

export class EnhancedSupabaseManager {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  // ==================== TIMEZONE UTILITIES ====================

  /**
   * Convert timestamp between timezones
   */
  async convertTimezone(
    timestamp: string | Date,
    fromTimezone: string = 'UTC',
    toTimezone: string = 'America/New_York'
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .rpc('convert_timezone', {
          input_timestamp: timestamp,
          from_timezone: fromTimezone,
          to_timezone: toTimezone
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error converting timezone:', error);
      // Fallback to JavaScript Date conversion
      const date = new Date(timestamp);
      return date.toISOString();
    }
  }

  /**
   * Get current time in user's timezone
   */
  getCurrentTimeInUserTimezone(userTimezone: string = 'America/New_York'): string {
    const now = new Date();
    return now.toLocaleString('en-US', { timeZone: userTimezone });
  }

  // ==================== ENHANCED POST MANAGEMENT ====================

  /**
   * Create a comprehensive post with variations and image options
   */
  async createPostWithOptions(
    postData: EnhancedPostData,
    variations: PostVariation[] = [],
    imageOptions: PostImageOption[] = []
  ): Promise<string> {
    try {
      // Prepare data for the database function
      const postDataJson = {
        title: postData.title,
        content: postData.content,
        original_content: postData.original_content || postData.content,
        platforms: postData.platforms,
        workflow_state: postData.workflow_state || 'draft',
        user_timezone: postData.user_timezone || 'America/New_York',
        platform_config: postData.platform_config || {},
        discord_thread_id: postData.discord_thread_id,
        discord_message_id: postData.discord_message_id,
        created_by_discord: postData.created_by_discord || false,
        generation_metadata: postData.generation_metadata || {}
      };

      const variationsJson = variations.map(v => ({
        variation_type: v.variation_type,
        content: v.content,
        platform: v.platform,
        is_selected: v.is_selected || false,
        created_by: v.created_by || 'system'
      }));

      const imageOptionsJson = imageOptions.map(img => ({
        image_url: img.image_url,
        image_description: img.image_description,
        image_source: img.image_source || 'unknown',
        is_selected: img.is_selected || false,
        option_index: img.option_index || 1,
        metadata: img.metadata || {}
      }));

      const { data, error } = await this.supabase
        .rpc('create_post_with_options', {
          post_data: postDataJson,
          content_variations: variationsJson,
          image_options: imageOptionsJson
        });

      if (error) throw error;

      console.log(`✅ Created enhanced post with options: ${data}`);
      return data;
    } catch (error) {
      console.error('Error creating post with options:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create post with options: ${errorMessage}`);
    }
  }

  /**
   * Update post workflow state
   */
  async updatePostWorkflowState(
    postId: string,
    newState: EnhancedPostData['workflow_state'],
    modifications?: any
  ): Promise<void> {
    try {
      const updates: any = {
        workflow_state: newState,
        last_modified_at: new Date().toISOString()
      };

      if (modifications) {
        updates.user_modifications = modifications;
      }

      const { error } = await this.supabase
        .from('posts')
        .update(updates)
        .eq('id', postId);

      if (error) throw error;

      console.log(`✅ Updated post workflow state: ${postId} → ${newState}`);
    } catch (error) {
      console.error('Error updating post workflow state:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update post workflow state: ${errorMessage}`);
    }
  }

  /**
   * Get posts ready for Discord review
   */
  async getPostsForDiscordReview(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_posts_for_discord_review');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting posts for Discord review:', error);
      return [];
    }
  }

  /**
   * Get scheduled posts in user timezone
   */
  async getScheduledPostsForUser(userTimezone: string = 'America/New_York'): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_scheduled_posts_for_user', { user_timezone: userTimezone });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting scheduled posts for user:', error);
      return [];
    }
  }

  // ==================== POST VARIATIONS MANAGEMENT ====================

  /**
   * Add a content variation to a post
   */
  async addPostVariation(variation: PostVariation): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('post_variations')
        .insert({
          ...variation,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log(`✅ Added post variation: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('Error adding post variation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to add post variation: ${errorMessage}`);
    }
  }

  /**
   * Select a content variation
   */
  async selectPostVariation(postId: string, variationId: string): Promise<void> {
    try {
      // First, unselect all variations for this post
      await this.supabase
        .from('post_variations')
        .update({ is_selected: false })
        .eq('post_id', postId);

      // Then select the chosen variation
      const { error } = await this.supabase
        .from('post_variations')
        .update({ is_selected: true })
        .eq('id', variationId);

      if (error) throw error;

      // Update the main post content with the selected variation
      const { data: variation } = await this.supabase
        .from('post_variations')
        .select('content')
        .eq('id', variationId)
        .single();

      if (variation) {
        await this.supabase
          .from('posts')
          .update({ 
            content: variation.content,
            last_modified_at: new Date().toISOString()
          })
          .eq('id', postId);
      }

      console.log(`✅ Selected post variation: ${variationId}`);
    } catch (error) {
      console.error('Error selecting post variation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to select post variation: ${errorMessage}`);
    }
  }

  /**
   * Get variations for a post
   */
  async getPostVariations(postId: string): Promise<PostVariation[]> {
    try {
      const { data, error } = await this.supabase
        .from('post_variations')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting post variations:', error);
      return [];
    }
  }

  // ==================== IMAGE OPTIONS MANAGEMENT ====================

  /**
   * Add image options to a post
   */
  async addImageOptions(postId: string, imageOptions: PostImageOption[]): Promise<string[]> {
    try {
      const optionsWithPostId = imageOptions.map((option, index) => ({
        ...option,
        post_id: postId,
        option_index: option.option_index || index + 1,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('post_image_options')
        .insert(optionsWithPostId)
        .select('id');

      if (error) throw error;

      const ids = data.map(item => item.id);
      console.log(`✅ Added ${ids.length} image options to post: ${postId}`);
      return ids;
    } catch (error) {
      console.error('Error adding image options:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to add image options: ${errorMessage}`);
    }
  }

  /**
   * Select an image option
   */
  async selectImageOption(postId: string, imageOptionId: string): Promise<void> {
    try {
      // First, unselect all image options for this post
      await this.supabase
        .from('post_image_options')
        .update({ is_selected: false })
        .eq('post_id', postId);

      // Then select the chosen image option
      const { error } = await this.supabase
        .from('post_image_options')
        .update({ is_selected: true })
        .eq('id', imageOptionId);

      if (error) throw error;

      // Update the main post with the selected image URL
      const { data: imageOption } = await this.supabase
        .from('post_image_options')
        .select('image_url, processed_image_url')
        .eq('id', imageOptionId)
        .single();

      if (imageOption) {
        await this.supabase
          .from('posts')
          .update({ 
            selected_image_url: imageOption.processed_image_url || imageOption.image_url,
            last_modified_at: new Date().toISOString()
          })
          .eq('id', postId);
      }

      console.log(`✅ Selected image option: ${imageOptionId}`);
    } catch (error) {
      console.error('Error selecting image option:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to select image option: ${errorMessage}`);
    }
  }

  /**
   * Get image options for a post
   */
  async getImageOptions(postId: string): Promise<PostImageOption[]> {
    try {
      const { data, error } = await this.supabase
        .from('post_image_options')
        .select('*')
        .eq('post_id', postId)
        .order('option_index', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting image options:', error);
      return [];
    }
  }

  // ==================== DISCORD INTERACTIONS ====================

  /**
   * Record a Discord interaction
   */
  async recordDiscordInteraction(interaction: DiscordInteraction): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('discord_interactions')
        .insert({
          ...interaction,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log(`✅ Recorded Discord interaction: ${data.id} (${interaction.command_type})`);
      return data.id;
    } catch (error) {
      console.error('Error recording Discord interaction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to record Discord interaction: ${errorMessage}`);
    }
  }

  /**
   * Update Discord interaction status
   */
  async updateDiscordInteraction(
    interactionId: string,
    updates: Partial<DiscordInteraction>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined
      };

      const { error } = await this.supabase
        .from('discord_interactions')
        .update(updateData)
        .eq('id', interactionId);

      if (error) throw error;

      console.log(`✅ Updated Discord interaction: ${interactionId}`);
    } catch (error) {
      console.error('Error updating Discord interaction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update Discord interaction: ${errorMessage}`);
    }
  }

  /**
   * Get Discord interactions for a post
   */
  async getDiscordInteractions(postId: string): Promise<DiscordInteraction[]> {
    try {
      const { data, error } = await this.supabase
        .from('discord_interactions')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting Discord interactions:', error);
      return [];
    }
  }

  // ==================== USER PREFERENCES ====================

  /**
   * Get or create user preferences
   */
  async getUserPreferences(discordUserId: string): Promise<UserPreferences> {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('discord_user_id', discordUserId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Create default preferences
        const defaultPrefs: UserPreferences = {
          discord_user_id: discordUserId,
          timezone: 'America/New_York',
          default_platforms: ['twitter', 'linkedin', 'instagram', 'facebook'],
          notification_preferences: {
            post_created: true,
            post_published: true,
            post_failed: true
          },
          scheduling_preferences: {
            default_time: '09:00',
            preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          },
          content_preferences: {
            tone: 'professional',
            include_hashtags: true,
            max_length: 280
          }
        };

        const { data: newData, error: insertError } = await this.supabase
          .from('user_preferences')
          .insert(defaultPrefs)
          .select('*')
          .single();

        if (insertError) throw insertError;
        return newData;
      }

      return data;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get user preferences: ${errorMessage}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    discordUserId: string,
    updates: Partial<UserPreferences>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('discord_user_id', discordUserId);

      if (error) throw error;

      console.log(`✅ Updated user preferences: ${discordUserId}`);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update user preferences: ${errorMessage}`);
    }
  }

  // ==================== SCHEDULING ====================

  /**
   * Schedule a post with timezone awareness
   */
  async schedulePostWithTimezone(
    postId: string,
    scheduledTime: string,
    userTimezone: string = 'America/New_York',
    discordUserId?: string,
    interactionId?: string
  ): Promise<void> {
    try {
      // Convert user time to UTC
      const scheduledForUtc = await this.convertTimezone(
        scheduledTime,
        userTimezone,
        'UTC'
      );

      // Update the main post
      await this.supabase
        .from('posts')
        .update({
          workflow_state: 'scheduled',
          scheduled_for_utc: scheduledForUtc,
          scheduled_for_user_tz: scheduledTime,
          user_timezone: userTimezone,
          last_modified_at: new Date().toISOString()
        })
        .eq('id', postId);

      // Create scheduling record
      const schedulingData: PostScheduling = {
        post_id: postId,
        scheduled_for_utc: scheduledForUtc,
        scheduled_for_user_tz: scheduledTime,
        user_timezone: userTimezone,
        created_by_discord_user: discordUserId,
        scheduling_command_id: interactionId,
        status: 'pending'
      };

      await this.supabase
        .from('post_scheduling')
        .insert(schedulingData);

      console.log(`✅ Scheduled post: ${postId} for ${scheduledTime} ${userTimezone}`);
    } catch (error) {
      console.error('Error scheduling post with timezone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to schedule post: ${errorMessage}`);
    }
  }

  // ==================== ANALYTICS & STATS ====================

  /**
   * Get enhanced post statistics
   */
  async getEnhancedStats(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('enhanced_post_stats')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting enhanced stats:', error);
      return null;
    }
  }

  /**
   * Get Discord activity statistics
   */
  async getDiscordActivityStats(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('discord_activity_stats')
        .select('*')
        .limit(30); // Last 30 days

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting Discord activity stats:', error);
      return [];
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get complete post data with all related information
   */
  async getCompletePostData(postId: string): Promise<{
    post: EnhancedPostData | null;
    variations: PostVariation[];
    imageOptions: PostImageOption[];
    interactions: DiscordInteraction[];
  }> {
    try {
      const [post, variations, imageOptions, interactions] = await Promise.all([
        this.getPost(postId),
        this.getPostVariations(postId),
        this.getImageOptions(postId),
        this.getDiscordInteractions(postId)
      ]);

      return {
        post,
        variations,
        imageOptions,
        interactions
      };
    } catch (error) {
      console.error('Error getting complete post data:', error);
      return {
        post: null,
        variations: [],
        imageOptions: [],
        interactions: []
      };
    }
  }

  /**
   * Get a post by ID (enhanced version)
   */
  async getPost(id: string): Promise<EnhancedPostData | null> {
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
   * Search posts with advanced filtering
   */
  async searchPosts(filters: {
    workflow_state?: string;
    created_by_discord?: boolean;
    discord_user_id?: string;
    platforms?: string[];
    search_text?: string;
    limit?: number;
    offset?: number;
  }): Promise<EnhancedPostData[]> {
    try {
      let query = this.supabase
        .from('posts')
        .select('*');

      if (filters.workflow_state) {
        query = query.eq('workflow_state', filters.workflow_state);
      }

      if (filters.created_by_discord !== undefined) {
        query = query.eq('created_by_discord', filters.created_by_discord);
      }

      if (filters.platforms && filters.platforms.length > 0) {
        query = query.overlaps('platforms', filters.platforms);
      }

      if (filters.search_text) {
        query = query.or(`title.ilike.%${filters.search_text}%,content.ilike.%${filters.search_text}%`);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching posts:', error);
      return [];
    }
  }
} 