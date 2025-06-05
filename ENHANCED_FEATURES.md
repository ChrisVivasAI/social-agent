# Enhanced Social Media Agent Features

This document outlines the new features and capabilities added to your social media agent, including Instagram and Facebook posting, advanced image processing, enhanced Supabase integration, and improved Discord bot functionality.

## 🚀 New Features Overview

### 1. Instagram Integration
- **Instagram Graph API** support for posting images with captions
- Automatic image upload to Supabase storage
- Connection testing and page information retrieval
- Error handling and retry mechanisms

### 2. Facebook Integration
- **Facebook Graph API** support for posting to pages
- Support for text posts, image posts, and link sharing
- Page information and statistics retrieval
- Comprehensive error handling

### 3. Advanced Image Processing
- **4:3 Aspect Ratio Conversion** with black bars (letterboxing)
- **Title Overlay** on black bars with word wrapping
- **Sharp-based Processing** for high-quality image manipulation
- **Canvas Integration** for text rendering and composition

### 4. Enhanced Supabase Integration
- **Complete Post Management** with status tracking
- **Platform-specific Post Tracking** for each social media platform
- **Scheduling System** with job management
- **Image Storage** with automatic bucket creation
- **Statistics and Analytics** views

### 5. Unified Social Media Manager
- **Multi-platform Publishing** with a single API call
- **Automatic Image Processing** and upload
- **Scheduling Support** for future posts
- **Error Tracking** and retry mechanisms
- **Platform Availability Detection**

## 📁 File Structure

```
src/
├── utils/
│   └── imageProcessor.ts          # Image processing utilities
├── clients/
│   ├── instagram.ts               # Instagram Graph API client
│   ├── facebook.ts                # Facebook Graph API client
│   ├── supabaseManager.ts         # Enhanced Supabase operations
│   └── socialMediaManager.ts      # Unified social media manager
scripts/
├── test-new-integrations.ts       # Comprehensive test suite
├── setup-database.sql             # Database schema setup
env.template                       # Environment variables template
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

The required dependencies are already added to your `package.json`:

```bash
yarn install
```

### 2. Environment Variables

Copy the environment template and fill in your credentials:

```bash
cp env.template .env
```

Required environment variables:

```bash
# Instagram
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_PAGE_ID=your_instagram_page_id

# Facebook
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token
FACEBOOK_PAGE_ID=your_facebook_page_id

# Supabase (existing)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Database Setup

Run the database setup script in your Supabase SQL editor:

```sql
-- Copy and paste the contents of scripts/setup-database.sql
```

This creates:
- `posts` table for storing all social media posts
- `platform_posts` table for tracking individual platform publications
- `scheduled_jobs` table for managing scheduled posts
- Indexes for optimal performance
- Views for statistics and analytics
- Storage bucket for images

### 4. API Setup

#### Instagram Setup:
1. Create a Facebook App at https://developers.facebook.com/
2. Add Instagram Graph API product
3. Get a Page Access Token with `instagram_basic`, `instagram_content_publish` permissions
4. Find your Instagram Business Account ID

#### Facebook Setup:
1. Use the same Facebook App from Instagram setup
2. Get a Page Access Token with `pages_manage_posts`, `pages_read_engagement` permissions
3. Find your Facebook Page ID

## 🧪 Testing

Run the comprehensive test suite:

```bash
yarn test:integrations
```

This tests:
- ✅ Supabase connection and operations
- ✅ Image processing functionality
- ✅ Instagram client connection
- ✅ Facebook client connection
- ✅ Social Media Manager integration
- ✅ Database operations

## 📖 Usage Examples

### Basic Post Publishing

```typescript
import { SocialMediaManager } from './src/clients/socialMediaManager.js';

const manager = new SocialMediaManager();

// Publish to multiple platforms
const result = await manager.publishPost({
  content: 'Check out this amazing post!',
  platforms: ['instagram', 'facebook'],
  imageUrl: 'https://example.com/image.jpg',
  title: 'Amazing Post Title'
});

console.log('Post ID:', result.postId);
console.log('Results:', result.results);
console.log('Processed Image:', result.processedImageUrl);
```

### Scheduled Posts

```typescript
// Schedule a post for later
const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

const result = await manager.publishPost({
  content: 'This will be posted tomorrow!',
  platforms: ['instagram', 'facebook'],
  imageUrl: 'https://example.com/image.jpg',
  title: 'Tomorrow\'s Post',
  scheduleFor: futureDate
});
```

### Image Processing Only

```typescript
import { ImageProcessor } from './src/utils/imageProcessor.js';

const processedImage = await ImageProcessor.processImageFor43AspectRatio(
  imageBuffer,
  {
    title: 'My Post Title',
    titlePosition: 'bottom',
    backgroundColor: '#000000',
    titleColor: '#ffffff',
    fontSize: 48
  }
);
```

### Platform-Specific Clients

```typescript
import { InstagramClient } from './src/clients/instagram.js';
import { FacebookClient } from './src/clients/facebook.js';

// Instagram only
const instagram = new InstagramClient();
const instagramPostId = await instagram.postImage({
  caption: 'Instagram post!',
  imageUrl: 'https://example.com/image.jpg'
});

// Facebook only
const facebook = new FacebookClient();
const facebookPostId = await facebook.postToPage({
  message: 'Facebook post!',
  imageUrl: 'https://example.com/image.jpg'
});
```

## 🔄 Integration with Existing Discord Bot

The enhanced system integrates seamlessly with your existing Discord bot:

### Database Notifications

The database automatically sends notifications when posts are created or updated:

```sql
-- Automatic notifications are sent via PostgreSQL NOTIFY
-- Your Discord bot can listen for these notifications
```

### Discord Commands Integration

You can extend your existing Discord bot commands to use the new social media manager:

```typescript
// In your Discord bot command handler
import { SocialMediaManager } from '../src/clients/socialMediaManager.js';

const manager = new SocialMediaManager();

// Example: Post command
if (interaction.commandName === 'post') {
  const content = interaction.options.getString('content');
  const platforms = interaction.options.getString('platforms').split(',');
  
  const result = await manager.publishPost({
    content,
    platforms,
    // Add image processing if needed
  });
  
  await interaction.reply(`Posted to ${platforms.join(', ')}! Post ID: ${result.postId}`);
}
```

## 📊 Analytics and Monitoring

### Post Statistics

```typescript
const stats = await manager.getStats();
console.log('Total posts:', stats.totalPosts);
console.log('Published posts:', stats.publishedPosts);
console.log('Scheduled posts:', stats.scheduledPosts);
console.log('Failed posts:', stats.failedPosts);
```

### Platform Performance

Query the `platform_performance` view in Supabase:

```sql
SELECT * FROM platform_performance;
```

### Recent Posts

```typescript
const recentPosts = await manager.getPosts({
  limit: 10,
  status: 'published'
});
```

## 🔧 Advanced Configuration

### Image Processing Options

```typescript
const options = {
  title: 'Custom Title',
  titlePosition: 'top' | 'bottom',
  backgroundColor: '#000000',
  titleColor: '#ffffff',
  fontSize: 48,
  fontFamily: 'Arial'
};
```

### Custom Client Configuration

```typescript
const instagram = new InstagramClient({
  accessToken: 'custom_token',
  pageId: 'custom_page_id'
});
```

### Supabase Operations

```typescript
import { SupabaseManager } from './src/clients/supabaseManager.js';

const supabase = new SupabaseManager();

// Create a post record
const postId = await supabase.createPost({
  title: 'My Post',
  content: 'Post content',
  platforms: ['instagram', 'facebook'],
  status: 'draft'
});

// Schedule a post
await supabase.schedulePost(postId, new Date('2024-12-25T10:00:00Z'));

// Get scheduled posts ready for publishing
const readyPosts = await supabase.getScheduledPosts();
```

## 🚨 Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const result = await manager.publishPost({
    content: 'Test post',
    platforms: ['instagram', 'facebook']
  });
} catch (error) {
  console.error('Publishing failed:', error.message);
  // Error details are automatically logged and stored in the database
}
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit real credentials to version control
2. **Token Rotation**: Regularly rotate API tokens for security
3. **Least Privilege**: Use minimal required permissions for API tokens
4. **Rate Limiting**: The system respects platform rate limits
5. **Error Logging**: Sensitive information is not logged in error messages

## 🔄 Scheduled Post Processing

Set up a cron job to process scheduled posts:

```typescript
// Run this periodically (e.g., every 5 minutes)
await manager.processScheduledPosts();
```

## 📈 Performance Optimization

- **Database Indexes**: Optimized for common query patterns
- **Image Processing**: Efficient Sharp-based processing
- **Connection Pooling**: Supabase handles connection pooling
- **Caching**: Consider implementing Redis for frequently accessed data

## 🐛 Troubleshooting

### Common Issues

1. **Instagram API Errors**: Ensure your access token has the correct permissions
2. **Facebook API Errors**: Verify your page ID and access token
3. **Image Processing Errors**: Check that Sharp and Canvas are properly installed
4. **Database Errors**: Ensure Supabase tables are created correctly

### Debug Mode

Enable detailed logging by setting environment variables:

```bash
DEBUG=true
LOG_LEVEL=debug
```

## 🔮 Future Enhancements

Potential future improvements:

1. **Video Support**: Add video processing and posting capabilities
2. **Analytics Dashboard**: Build a web interface for analytics
3. **AI Content Generation**: Integrate with AI for automatic content creation
4. **Multi-Account Support**: Support multiple accounts per platform
5. **Advanced Scheduling**: Recurring posts and optimal timing suggestions

## 📞 Support

If you encounter any issues:

1. Check the test results: `yarn test:integrations`
2. Verify your environment variables
3. Check the database schema is properly set up
4. Review the error logs in your application

The enhanced social media agent is now ready to handle Instagram and Facebook posting with advanced image processing and comprehensive data management! 🎉 