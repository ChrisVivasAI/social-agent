-- Enhanced Social Media Agent Database Schema
-- This script sets up the required tables for posts, platform tracking, and scheduling

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Posts table - stores all social media posts
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    original_url TEXT,
    image_url TEXT,
    processed_image_url TEXT,
    platforms TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
    scheduled_for TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform posts table - tracks individual platform publications
CREATE TABLE IF NOT EXISTS platform_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'facebook')),
    platform_post_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled jobs table - tracks scheduled post publishing
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    job_name TEXT NOT NULL UNIQUE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_for ON posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_posts_platforms ON posts USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_platform_posts_post_id ON platform_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_platform ON platform_posts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_posts_status ON platform_posts(status);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_post_id ON scheduled_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_for ON scheduled_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_posts_updated_at ON platform_posts;
CREATE TRIGGER update_platform_posts_updated_at
    BEFORE UPDATE ON platform_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for post images (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) policies
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON posts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON posts
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON posts
    FOR DELETE USING (auth.role() = 'authenticated');

-- Platform posts policies
CREATE POLICY "Enable read access for authenticated users" ON platform_posts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON platform_posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON platform_posts
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON platform_posts
    FOR DELETE USING (auth.role() = 'authenticated');

-- Scheduled jobs policies
CREATE POLICY "Enable read access for authenticated users" ON scheduled_jobs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON scheduled_jobs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON scheduled_jobs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON scheduled_jobs
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create a view for post statistics
CREATE OR REPLACE VIEW post_stats AS
SELECT 
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'published') as published_posts,
    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_posts,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_posts,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_posts
FROM posts;

-- Create a view for platform performance
CREATE OR REPLACE VIEW platform_performance AS
SELECT 
    platform,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE status = 'published') as successful_posts,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_posts,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'published')::DECIMAL / COUNT(*)) * 100, 
        2
    ) as success_rate
FROM platform_posts
GROUP BY platform;

-- Grant access to views
GRANT SELECT ON post_stats TO authenticated;
GRANT SELECT ON platform_performance TO authenticated;

-- Create function to get posts ready for publishing
CREATE OR REPLACE FUNCTION get_posts_ready_for_publishing()
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    platforms TEXT[],
    image_url TEXT,
    processed_image_url TEXT,
    scheduled_for TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.content,
        p.platforms,
        p.image_url,
        p.processed_image_url,
        p.scheduled_for
    FROM posts p
    WHERE p.status = 'scheduled'
    AND p.scheduled_for <= NOW()
    ORDER BY p.scheduled_for ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_posts_ready_for_publishing() TO authenticated;

-- Insert some sample data for testing (optional)
-- Uncomment the following lines if you want sample data

/*
INSERT INTO posts (title, content, platforms, status) VALUES
('Welcome Post', 'Welcome to our enhanced social media agent!', ARRAY['instagram', 'facebook'], 'draft'),
('Test Scheduled Post', 'This is a test scheduled post', ARRAY['instagram'], 'scheduled');

INSERT INTO platform_posts (post_id, platform, status) 
SELECT id, 'instagram', 'published' FROM posts WHERE title = 'Welcome Post';
*/

-- Create notification function for Discord integration
CREATE OR REPLACE FUNCTION notify_discord_on_post_update()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be extended to send notifications to Discord
    -- when posts are created, updated, or published
    
    IF TG_OP = 'INSERT' THEN
        -- New post created
        PERFORM pg_notify('post_created', json_build_object(
            'post_id', NEW.id,
            'title', NEW.title,
            'platforms', NEW.platforms,
            'status', NEW.status
        )::text);
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- Post status changed
        PERFORM pg_notify('post_status_changed', json_build_object(
            'post_id', NEW.id,
            'title', NEW.title,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'platforms', NEW.platforms
        )::text);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Discord notifications
DROP TRIGGER IF EXISTS discord_notification_trigger ON posts;
CREATE TRIGGER discord_notification_trigger
    AFTER INSERT OR UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION notify_discord_on_post_update();

COMMENT ON TABLE posts IS 'Stores all social media posts with metadata and status tracking';
COMMENT ON TABLE platform_posts IS 'Tracks individual platform publications for each post';
COMMENT ON TABLE scheduled_jobs IS 'Manages scheduled post publishing jobs';
COMMENT ON VIEW post_stats IS 'Provides aggregate statistics about posts';
COMMENT ON VIEW platform_performance IS 'Shows performance metrics for each platform';
COMMENT ON FUNCTION get_posts_ready_for_publishing() IS 'Returns posts that are scheduled and ready to be published';
COMMENT ON FUNCTION notify_discord_on_post_update() IS 'Sends notifications to Discord when posts are created or updated';

-- Final message
SELECT 'Enhanced Social Media Agent database schema setup completed successfully!' as message; 