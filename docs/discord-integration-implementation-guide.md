# Discord Integration Implementation Guide

## 🎯 **OVERVIEW**

This guide provides a comprehensive step-by-step plan to replace the agent inbox with Discord-based post management, ensuring proper timezone handling (EST instead of PST), and storing comprehensive data for full Discord workflow control.

## 📋 **IMPLEMENTATION PHASES**

### **Phase 1: Database Schema Enhancement** ✅ READY

**Status**: Migration scripts created
**Files**: 
- `scripts/enhance-database-for-discord.sql` - Complete database migration
- `src/clients/enhancedSupabaseManager.ts` - Enhanced manager with all new functionality

**What's Included**:
- ✅ Enhanced `posts` table with workflow states and timezone support
- ✅ New `post_variations` table for content alternatives
- ✅ New `post_image_options` table for multiple image choices
- ✅ New `discord_interactions` table for command tracking
- ✅ New `user_preferences` table for Discord user settings
- ✅ New `post_scheduling` table for timezone-aware scheduling
- ✅ Timezone conversion functions
- ✅ Enhanced views and statistics
- ✅ Database triggers and notifications

**Next Steps**:
1. **Run the migration**: Execute `scripts/enhance-database-for-discord.sql` on your Supabase database
2. **Test the schema**: Verify all tables and functions are created correctly
3. **Update environment**: Ensure Supabase credentials are properly configured

---

### **Phase 2: Enhanced Supabase Manager Integration** 🔄 IN PROGRESS

**Current Status**: Enhanced manager created, needs integration

**Implementation Steps**:

#### 2.1 Update Existing Code to Use Enhanced Manager

```typescript
// Replace imports in existing files
import { EnhancedSupabaseManager } from '../clients/enhancedSupabaseManager.js';

// Update generate-post workflow to use new manager
const supabase = new EnhancedSupabaseManager();
```

#### 2.2 Modify Generate-Post Workflow

**File**: `src/agents/generate-post/nodes/schedule-post/index.ts`

**Changes Needed**:
- Save posts as 'draft' state instead of immediate publishing
- Store multiple image options from find-images
- Create post variations (original + alternatives)
- Send Discord notification instead of human-in-the-loop

#### 2.3 Update Upload-Post Function

**File**: `src/agents/upload-post/index.ts`

**Changes Needed**:
- Check for selected image from options
- Use workflow state instead of status
- Update timezone handling for scheduling

---

### **Phase 3: Discord Bot Commands** 🚧 TODO

**Required Discord Commands**:

#### 3.1 Core Commands
```typescript
// /generate-post [topic] - Start post generation
// /review-post [post-id] - Show post preview with options
// /schedule-post [post-id] [datetime-est] - Schedule a post
// /modify-caption [post-id] [new-caption] - Edit post content
// /select-image [post-id] [option-number] - Choose image
// /publish-now [post-id] - Immediately publish
// /cancel-post [post-id] - Cancel/delete post
// /list-posts [status] - List posts by status
```

#### 3.2 Discord Bot Enhancement

**File**: `src/clients/discord/index.ts`

**New Features Needed**:
- Rich embed post previews
- Interactive buttons for quick actions
- Image option display with thumbnails
- Timezone-aware scheduling interface
- Error handling and user feedback

---

### **Phase 4: Timezone Handling** 🕐 CRITICAL

**Current Issue**: App uses PST, user needs EST

**Implementation**:

#### 4.1 Timezone Utilities

```typescript
// Add to enhanced manager (already included)
async convertTimezone(timestamp, fromTz, toTz): Promise<string>
getCurrentTimeInUserTimezone(userTimezone): string
```

#### 4.2 User Preferences Integration

```typescript
// Get user timezone preference
const userPrefs = await supabase.getUserPreferences(discordUserId);
const userTimezone = userPrefs.timezone; // 'America/New_York' for EST
```

#### 4.3 Scheduling Updates

```typescript
// Schedule with timezone awareness
await supabase.schedulePostWithTimezone(
  postId, 
  '2024-01-15 09:00:00', // User's local time
  'America/New_York',    // User's timezone
  discordUserId
);
```

---

### **Phase 5: Workflow Integration** 🔄 COMPLEX

**Goal**: Replace agent inbox with Discord workflow

#### 5.1 Generate-Post Modifications

**Current Flow**:
```
generate-post → human-in-the-loop → schedule/modify → upload-post
```

**New Flow**:
```
generate-post → save-as-draft → discord-notification → discord-commands → upload-post
```

#### 5.2 Implementation Steps

1. **Modify generate-post to save drafts**:
   ```typescript
   // Instead of immediate publishing
   const postId = await supabase.createPostWithOptions(postData, variations, imageOptions);
   
   // Send Discord notification
   await sendDiscordPostPreview(postId, discordChannelId);
   ```

2. **Create Discord notification system**:
   ```typescript
   async function sendDiscordPostPreview(postId: string, channelId: string) {
     const postData = await supabase.getCompletePostData(postId);
     const embed = createPostPreviewEmbed(postData);
     const buttons = createPostActionButtons(postId);
     
     await discordClient.sendMessage(channelId, { embeds: [embed], components: [buttons] });
   }
   ```

3. **Handle Discord interactions**:
   ```typescript
   // Button/command handlers for schedule, modify, publish, etc.
   ```

---

## 🚀 **IMMEDIATE NEXT STEPS**

### **Step 1: Run Database Migration** (5 minutes)

```bash
# Connect to your Supabase database and run:
psql -h your-supabase-host -U postgres -d postgres -f scripts/enhance-database-for-discord.sql
```

### **Step 2: Test Enhanced Manager** (15 minutes)

Create a test script to verify the new functionality:

```typescript
// scripts/test-enhanced-supabase.ts
import { EnhancedSupabaseManager } from '../src/clients/enhancedSupabaseManager.js';

async function testEnhancedFeatures() {
  const supabase = new EnhancedSupabaseManager();
  
  // Test timezone conversion
  const estTime = await supabase.convertTimezone(
    new Date().toISOString(),
    'UTC',
    'America/New_York'
  );
  console.log('EST Time:', estTime);
  
  // Test user preferences
  const prefs = await supabase.getUserPreferences('test-discord-user');
  console.log('User Preferences:', prefs);
  
  // Test post creation with options
  const postId = await supabase.createPostWithOptions(
    {
      title: 'Test Post',
      content: 'This is a test post',
      platforms: ['twitter', 'linkedin'],
      workflow_state: 'draft',
      created_by_discord: true
    },
    [
      {
        post_id: '', // Will be set automatically
        variation_type: 'original',
        content: 'Original content',
        is_selected: true
      }
    ],
    [
      {
        post_id: '', // Will be set automatically
        image_url: 'https://example.com/image.jpg',
        image_description: 'Test image',
        is_selected: true,
        option_index: 1
      }
    ]
  );
  
  console.log('Created post with options:', postId);
}

testEnhancedFeatures().catch(console.error);
```

### **Step 3: Update Generate-Post Integration** (30 minutes)

Modify the generate-post workflow to use the enhanced manager:

```typescript
// In generate-post workflow
import { EnhancedSupabaseManager } from '../../clients/enhancedSupabaseManager.js';

// Replace existing Supabase usage with enhanced manager
const enhancedSupabase = new EnhancedSupabaseManager();

// Save as draft instead of publishing
const postId = await enhancedSupabase.createPostWithOptions(
  {
    title: extractedTitle,
    content: generatedContent,
    original_content: generatedContent,
    platforms: ['twitter', 'linkedin', 'instagram', 'facebook'],
    workflow_state: 'draft',
    user_timezone: 'America/New_York',
    created_by_discord: false, // Set to true when initiated from Discord
    generation_metadata: {
      source_url: originalUrl,
      generation_timestamp: new Date().toISOString()
    }
  },
  [], // Content variations (can be added later)
  imageOptions // Multiple image choices from find-images
);
```

---

## 📊 **SUCCESS METRICS**

### **Phase 1 Success Criteria**:
- ✅ Database migration runs without errors
- ✅ All new tables and functions are created
- ✅ Enhanced manager can connect and perform basic operations

### **Phase 2 Success Criteria**:
- ✅ Posts are saved as drafts with workflow states
- ✅ Multiple image options are stored and selectable
- ✅ Timezone conversion works correctly
- ✅ User preferences are created and updated

### **Phase 3 Success Criteria**:
- ✅ Discord commands respond correctly
- ✅ Post previews display with rich embeds
- ✅ Interactive buttons work for post actions
- ✅ Error handling provides clear feedback

### **Phase 4 Success Criteria**:
- ✅ All times display in EST for the user
- ✅ Scheduling works with timezone conversion
- ✅ User can set timezone preferences

### **Phase 5 Success Criteria**:
- ✅ Complete workflow: Discord → generate → review → schedule → publish
- ✅ No more agent inbox dependency
- ✅ All post management happens through Discord

---

## 🔧 **TECHNICAL CONSIDERATIONS**

### **Database Performance**:
- All new tables have proper indexes
- Foreign key constraints ensure data integrity
- Row Level Security (RLS) policies are in place

### **Timezone Handling**:
- All timestamps stored in UTC
- User timezone preferences respected
- Conversion functions handle edge cases

### **Discord Integration**:
- Rate limiting considerations for Discord API
- Error handling for network issues
- Graceful degradation when Discord is unavailable

### **Data Consistency**:
- Transactions ensure atomic operations
- Triggers maintain data consistency
- Notifications provide real-time updates

---

## 🚨 **POTENTIAL ISSUES & SOLUTIONS**

### **Issue 1: Database Migration Conflicts**
**Solution**: Test migration on a copy of production data first

### **Issue 2: Timezone Conversion Errors**
**Solution**: Fallback to JavaScript Date conversion if database function fails

### **Issue 3: Discord API Rate Limits**
**Solution**: Implement queuing system for Discord messages

### **Issue 4: Large Image Processing**
**Solution**: Async processing with status updates

---

## 📝 **NEXT ACTIONS REQUIRED**

1. **IMMEDIATE** (Today):
   - Run database migration script
   - Test enhanced Supabase manager
   - Verify timezone conversion works

2. **THIS WEEK**:
   - Update generate-post workflow
   - Implement basic Discord commands
   - Test end-to-end draft creation

3. **NEXT WEEK**:
   - Complete Discord bot enhancement
   - Implement rich post previews
   - Add interactive buttons and scheduling

4. **FOLLOWING WEEK**:
   - Full integration testing
   - User acceptance testing
   - Production deployment

---

This implementation plan provides a clear roadmap to replace the agent inbox with Discord-based post management while ensuring proper timezone handling and comprehensive data storage. Each phase builds on the previous one, allowing for incremental testing and validation. 