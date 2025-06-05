-- Enhanced Social Media Agent Database Schema for Discord Integration
-- This script enhances the existing database with Discord integration, timezone support, and comprehensive post management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== ENHANCE EXISTING POSTS TABLE ====================

-- Add new columns to existing posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(20) DEFAULT 'draft' 
    CHECK (workflow_state IN ('draft', 'pending_review', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
ADD COLUMN IF NOT EXISTS user_timezone VARCHAR(50) DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS scheduled_for_utc TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_for_user_tz TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS user_modifications JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS platform_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS discord_thread_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS discord_message_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS created_by_discord BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS original_content TEXT, -- Store original AI-generated content
ADD COLUMN IF NOT EXISTS selected_image_url TEXT, -- User-selected image from options
ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{}'; -- Store generation context

-- Update existing records to use new workflow_state
UPDATE posts SET workflow_state = status WHERE workflow_state = 'draft';

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_posts_workflow_state ON posts(workflow_state);
CREATE INDEX IF NOT EXISTS idx_posts_discord_thread_id ON posts(discord_thread_id);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_for_utc ON posts(scheduled_for_utc);
CREATE INDEX IF NOT EXISTS idx_posts_user_timezone ON posts(user_timezone);

-- ==================== NEW TABLES ====================

-- Post variations table - store different content versions
CREATE TABLE IF NOT EXISTS post_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    variation_type VARCHAR(20) NOT NULL CHECK (variation_type IN ('original', 'user_edit', 'ai_alternative', 'platform_specific')),
    content TEXT NOT NULL,
    platform VARCHAR(20), -- For platform-specific variations
    is_selected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) DEFAULT 'system' -- 'system', 'user', 'discord'
);

-- Post image options table - store multiple image choices
CREATE TABLE IF NOT EXISTS post_image_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    processed_image_url TEXT, -- Instagram 3:4 processed version
    image_description TEXT,
    image_source VARCHAR(50), -- 'youtube', 'screenshot', 'upload', 'ai_generated'
    is_selected BOOLEAN DEFAULT false,
    option_index INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Discord interactions table - track all Discord commands and responses
CREATE TABLE IF NOT EXISTS discord_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(100) NOT NULL,
    discord_username VARCHAR(100),
    discord_channel_id VARCHAR(100) NOT NULL,
    discord_message_id VARCHAR(100),
    command_type VARCHAR(50) NOT NULL, -- 'generate', 'schedule', 'modify', 'select_image', 'publish', 'cancel'
    command_data JSONB DEFAULT '{}',
    response_message_id VARCHAR(100),
    response_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- User preferences table - store Discord user settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id VARCHAR(100) UNIQUE NOT NULL,
    discord_username VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    default_platforms JSONB DEFAULT '["twitter", "linkedin", "instagram", "facebook"]',
    notification_preferences JSONB DEFAULT '{"post_created": true, "post_published": true, "post_failed": true}',
    scheduling_preferences JSONB DEFAULT '{"default_time": "09:00", "preferred_days": ["monday", "tuesday", "wednesday", "thursday", "friday"]}',
    content_preferences JSONB DEFAULT '{"tone": "professional", "include_hashtags": true, "max_length": 280}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post scheduling table - enhanced scheduling with recurrence
CREATE TABLE IF NOT EXISTS post_scheduling (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    scheduled_for_utc TIMESTAMPTZ NOT NULL,
    scheduled_for_user_tz TIMESTAMPTZ NOT NULL,
    user_timezone VARCHAR(50) NOT NULL,
    recurrence_pattern JSONB, -- For recurring posts: {"type": "weekly", "days": ["monday", "friday"], "time": "09:00"}
    is_recurring BOOLEAN DEFAULT false,
    next_occurrence TIMESTAMPTZ,
    created_by_discord_user VARCHAR(100),
    scheduling_command_id UUID REFERENCES discord_interactions(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    published_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================

-- Post variations indexes
CREATE INDEX IF NOT EXISTS idx_post_variations_post_id ON post_variations(post_id);
CREATE INDEX IF NOT EXISTS idx_post_variations_type ON post_variations(variation_type);
CREATE INDEX IF NOT EXISTS idx_post_variations_selected ON post_variations(is_selected);

-- Post image options indexes
CREATE INDEX IF NOT EXISTS idx_post_image_options_post_id ON post_image_options(post_id);
CREATE INDEX IF NOT EXISTS idx_post_image_options_selected ON post_image_options(is_selected);

-- Discord interactions indexes
CREATE INDEX IF NOT EXISTS idx_discord_interactions_post_id ON discord_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_discord_interactions_user_id ON discord_interactions(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_interactions_command_type ON discord_interactions(command_type);
CREATE INDEX IF NOT EXISTS idx_discord_interactions_created_at ON discord_interactions(created_at);

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_discord_user_id ON user_preferences(discord_user_id);

-- Post scheduling indexes
CREATE INDEX IF NOT EXISTS idx_post_scheduling_post_id ON post_scheduling(post_id);
CREATE INDEX IF NOT EXISTS idx_post_scheduling_scheduled_utc ON post_scheduling(scheduled_for_utc);
CREATE INDEX IF NOT EXISTS idx_post_scheduling_status ON post_scheduling(status);
CREATE INDEX IF NOT EXISTS idx_post_scheduling_next_occurrence ON post_scheduling(next_occurrence);

-- ==================== TRIGGERS ====================

-- Update triggers for new tables
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update last_modified_at on posts
CREATE OR REPLACE FUNCTION update_post_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_posts_last_modified ON posts;
CREATE TRIGGER update_posts_last_modified
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_post_last_modified();

-- ==================== RLS POLICIES ====================

-- Enable RLS on new tables
ALTER TABLE post_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_image_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_scheduling ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables (allowing authenticated access)
CREATE POLICY "Enable all access for authenticated users" ON post_variations
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON post_image_options
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON discord_interactions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON user_preferences
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON post_scheduling
    FOR ALL USING (auth.role() = 'authenticated');

-- ==================== UTILITY FUNCTIONS ====================

-- Function to convert timezone
CREATE OR REPLACE FUNCTION convert_timezone(
    input_timestamp TIMESTAMPTZ,
    from_timezone TEXT,
    to_timezone TEXT
) RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN input_timestamp AT TIME ZONE from_timezone AT TIME ZONE to_timezone;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get posts ready for Discord review
CREATE OR REPLACE FUNCTION get_posts_for_discord_review()
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    original_content TEXT,
    platforms TEXT[],
    workflow_state VARCHAR(20),
    discord_thread_id VARCHAR(100),
    created_at TIMESTAMPTZ,
    image_options_count BIGINT,
    variations_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.content,
        p.original_content,
        p.platforms,
        p.workflow_state,
        p.discord_thread_id,
        p.created_at,
        COALESCE(img_count.count, 0) as image_options_count,
        COALESCE(var_count.count, 0) as variations_count
    FROM posts p
    LEFT JOIN (
        SELECT post_id, COUNT(*) as count 
        FROM post_image_options 
        GROUP BY post_id
    ) img_count ON p.id = img_count.post_id
    LEFT JOIN (
        SELECT post_id, COUNT(*) as count 
        FROM post_variations 
        GROUP BY post_id
    ) var_count ON p.id = var_count.post_id
    WHERE p.workflow_state IN ('draft', 'pending_review')
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get scheduled posts in user timezone
CREATE OR REPLACE FUNCTION get_scheduled_posts_for_user(user_timezone TEXT DEFAULT 'America/New_York')
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    platforms TEXT[],
    scheduled_for_utc TIMESTAMPTZ,
    scheduled_for_user_tz TIMESTAMPTZ,
    workflow_state VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.content,
        p.platforms,
        p.scheduled_for_utc,
        p.scheduled_for_utc AT TIME ZONE user_timezone as scheduled_for_user_tz,
        p.workflow_state
    FROM posts p
    WHERE p.workflow_state = 'scheduled'
    AND p.scheduled_for_utc IS NOT NULL
    ORDER BY p.scheduled_for_utc ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create post with variations and image options
CREATE OR REPLACE FUNCTION create_post_with_options(
    post_data JSONB,
    content_variations JSONB DEFAULT '[]',
    image_options JSONB DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    new_post_id UUID;
    variation JSONB;
    image_option JSONB;
BEGIN
    -- Create the main post
    INSERT INTO posts (
        title, content, original_content, platforms, workflow_state,
        user_timezone, platform_config, discord_thread_id, discord_message_id,
        created_by_discord, generation_metadata
    ) VALUES (
        (post_data->>'title')::TEXT,
        (post_data->>'content')::TEXT,
        (post_data->>'original_content')::TEXT,
        (post_data->'platforms')::TEXT[],
        COALESCE((post_data->>'workflow_state')::TEXT, 'draft'),
        COALESCE((post_data->>'user_timezone')::TEXT, 'America/New_York'),
        COALESCE(post_data->'platform_config', '{}'),
        (post_data->>'discord_thread_id')::TEXT,
        (post_data->>'discord_message_id')::TEXT,
        COALESCE((post_data->>'created_by_discord')::BOOLEAN, false),
        COALESCE(post_data->'generation_metadata', '{}')
    ) RETURNING id INTO new_post_id;

    -- Insert content variations
    FOR variation IN SELECT * FROM jsonb_array_elements(content_variations)
    LOOP
        INSERT INTO post_variations (post_id, variation_type, content, platform, is_selected, created_by)
        VALUES (
            new_post_id,
            (variation->>'variation_type')::TEXT,
            (variation->>'content')::TEXT,
            (variation->>'platform')::TEXT,
            COALESCE((variation->>'is_selected')::BOOLEAN, false),
            COALESCE((variation->>'created_by')::TEXT, 'system')
        );
    END LOOP;

    -- Insert image options
    FOR image_option IN SELECT * FROM jsonb_array_elements(image_options)
    LOOP
        INSERT INTO post_image_options (post_id, image_url, image_description, image_source, is_selected, option_index, metadata)
        VALUES (
            new_post_id,
            (image_option->>'image_url')::TEXT,
            (image_option->>'image_description')::TEXT,
            COALESCE((image_option->>'image_source')::TEXT, 'unknown'),
            COALESCE((image_option->>'is_selected')::BOOLEAN, false),
            COALESCE((image_option->>'option_index')::INTEGER, 1),
            COALESCE(image_option->'metadata', '{}')
        );
    END LOOP;

    RETURN new_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION convert_timezone(TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_posts_for_discord_review() TO authenticated;
GRANT EXECUTE ON FUNCTION get_scheduled_posts_for_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_post_with_options(JSONB, JSONB, JSONB) TO authenticated;

-- ==================== ENHANCED VIEWS ====================

-- Enhanced post stats view
CREATE OR REPLACE VIEW enhanced_post_stats AS
SELECT 
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE workflow_state = 'published') as published_posts,
    COUNT(*) FILTER (WHERE workflow_state = 'scheduled') as scheduled_posts,
    COUNT(*) FILTER (WHERE workflow_state = 'failed') as failed_posts,
    COUNT(*) FILTER (WHERE workflow_state = 'draft') as draft_posts,
    COUNT(*) FILTER (WHERE workflow_state = 'pending_review') as pending_review_posts,
    COUNT(*) FILTER (WHERE created_by_discord = true) as discord_created_posts,
    COUNT(DISTINCT discord_thread_id) FILTER (WHERE discord_thread_id IS NOT NULL) as active_discord_threads
FROM posts;

-- Discord activity view
CREATE OR REPLACE VIEW discord_activity_stats AS
SELECT 
    command_type,
    COUNT(*) as total_commands,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_commands,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_commands,
    COUNT(DISTINCT discord_user_id) as unique_users,
    DATE_TRUNC('day', created_at) as activity_date
FROM discord_interactions
GROUP BY command_type, DATE_TRUNC('day', created_at)
ORDER BY activity_date DESC, total_commands DESC;

-- Grant access to new views
GRANT SELECT ON enhanced_post_stats TO authenticated;
GRANT SELECT ON discord_activity_stats TO authenticated;

-- ==================== NOTIFICATION ENHANCEMENTS ====================

-- Enhanced notification function for Discord integration
CREATE OR REPLACE FUNCTION notify_discord_on_post_events()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- New post created
        PERFORM pg_notify('discord_post_created', json_build_object(
            'post_id', NEW.id,
            'title', NEW.title,
            'workflow_state', NEW.workflow_state,
            'platforms', NEW.platforms,
            'created_by_discord', NEW.created_by_discord,
            'discord_thread_id', NEW.discord_thread_id
        )::text);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Post updated
        IF OLD.workflow_state != NEW.workflow_state THEN
            PERFORM pg_notify('discord_post_state_changed', json_build_object(
                'post_id', NEW.id,
                'title', NEW.title,
                'old_state', OLD.workflow_state,
                'new_state', NEW.workflow_state,
                'platforms', NEW.platforms,
                'discord_thread_id', NEW.discord_thread_id
            )::text);
        END IF;
        
        IF OLD.scheduled_for_utc IS DISTINCT FROM NEW.scheduled_for_utc THEN
            PERFORM pg_notify('discord_post_scheduled', json_build_object(
                'post_id', NEW.id,
                'title', NEW.title,
                'scheduled_for_utc', NEW.scheduled_for_utc,
                'scheduled_for_user_tz', NEW.scheduled_for_user_tz,
                'user_timezone', NEW.user_timezone,
                'discord_thread_id', NEW.discord_thread_id
            )::text);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update the notification trigger
DROP TRIGGER IF EXISTS discord_notification_trigger ON posts;
CREATE TRIGGER discord_notification_trigger
    AFTER INSERT OR UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION notify_discord_on_post_events();

-- ==================== SAMPLE DATA FOR TESTING ====================

-- Insert sample user preferences
INSERT INTO user_preferences (discord_user_id, discord_username, timezone, default_platforms)
VALUES ('123456789', 'testuser', 'America/New_York', '["twitter", "linkedin", "instagram", "facebook"]')
ON CONFLICT (discord_user_id) DO NOTHING;

-- ==================== COMMENTS ====================

COMMENT ON TABLE post_variations IS 'Stores different content versions for posts (original, user edits, AI alternatives)';
COMMENT ON TABLE post_image_options IS 'Stores multiple image choices for each post with processing metadata';
COMMENT ON TABLE discord_interactions IS 'Tracks all Discord commands and interactions for post management';
COMMENT ON TABLE user_preferences IS 'Stores Discord user preferences for timezone, platforms, and content settings';
COMMENT ON TABLE post_scheduling IS 'Enhanced scheduling with timezone awareness and recurrence support';

COMMENT ON FUNCTION convert_timezone(TIMESTAMPTZ, TEXT, TEXT) IS 'Converts timestamps between timezones';
COMMENT ON FUNCTION get_posts_for_discord_review() IS 'Returns posts ready for Discord review with counts';
COMMENT ON FUNCTION get_scheduled_posts_for_user(TEXT) IS 'Returns scheduled posts in user timezone';
COMMENT ON FUNCTION create_post_with_options(JSONB, JSONB, JSONB) IS 'Creates post with variations and image options in one transaction';

-- Final success message
SELECT 'Enhanced Social Media Agent database schema for Discord integration completed successfully!' as message,
       'Added: post_variations, post_image_options, discord_interactions, user_preferences, post_scheduling tables' as new_tables,
       'Enhanced: posts table with workflow_state, timezone support, Discord integration fields' as enhancements,
       'Added: Timezone conversion, Discord review functions, enhanced notifications' as new_functions; 