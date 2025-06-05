-- Fix for platforms array casting issue in create_post_with_options function

CREATE OR REPLACE FUNCTION create_post_with_options(
    post_data JSONB,
    content_variations JSONB DEFAULT '[]',
    image_options JSONB DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    new_post_id UUID;
    variation JSONB;
    image_option JSONB;
    platforms_array TEXT[];
BEGIN
    -- Convert JSONB array to TEXT array for platforms
    SELECT ARRAY(SELECT jsonb_array_elements_text(post_data->'platforms')) INTO platforms_array;
    
    -- Create the main post
    INSERT INTO posts (
        title, content, original_content, platforms, workflow_state,
        user_timezone, platform_config, discord_thread_id, discord_message_id,
        created_by_discord, generation_metadata
    ) VALUES (
        (post_data->>'title')::TEXT,
        (post_data->>'content')::TEXT,
        (post_data->>'original_content')::TEXT,
        platforms_array,
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