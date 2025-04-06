# Social Media Agent - API Reference

This document describes the available Discord commands and REST API endpoints for the Social Media Agent.

## Discord Commands

### General Commands

| Command | Description | Usage | Example |
|---------|-------------|-------|---------|
| `!help` | Shows help information and available commands | `!help [command]` | `!help post` |
| `!about` | Shows information about the Social Media Agent | `!about` | `!about` |
| `!status` | Shows the current status of connected accounts | `!status` | `!status` |

### Authentication Commands

| Command | Description | Usage | Example |
|---------|-------------|-------|---------|
| `!connect twitter` | Connect your Twitter account | `!connect twitter` | `!connect twitter` |
| `!connect linkedin` | Connect your LinkedIn account | `!connect linkedin` | `!connect linkedin` |
| `!disconnect` | Disconnect a social media account | `!disconnect [platform]` | `!disconnect twitter` |
| `!accounts` | List your connected accounts | `!accounts` | `!accounts` |

### Content Generation Commands

| Command | Description | Usage | Example |
|---------|-------------|-------|---------|
| `!post` | Generate a post from a URL | `!post [url]` | `!post https://github.com/user/repo` |
| `!generate` | Generate a post from topic or description | `!generate [description]` | `!generate A post about AI development` |
| `!rewrite` | Rewrite an existing post | `!rewrite [post_id] [instructions]` | `!rewrite 123 Make it more casual` |

### Post Management Commands

| Command | Description | Usage | Example |
|---------|-------------|-------|---------|
| `!schedule` | Schedule a post | `!schedule [date] [post]` | `!schedule 2023-10-15 12:00 My post content` |
| `!priority` | Schedule with priority level | `!priority [level] [post]` | `!priority P1 My weekend post` |
| `!list` | List scheduled posts | `!list [filter]` | `!list pending` |
| `!cancel` | Cancel a scheduled post | `!cancel [post_id]` | `!cancel 123` |
| `!reschedule` | Reschedule a post | `!reschedule [post_id] [date]` | `!reschedule 123 2023-10-20 15:00` |

### Settings Commands

| Command | Description | Usage | Example |
|---------|-------------|-------|---------|
| `!config` | View or set configuration | `!config [setting] [value]` | `!config default_platform twitter` |
| `!preference` | Set user preferences | `!preference [setting] [value]` | `!preference tone professional` |
| `!prompt` | View or modify AI prompts | `!prompt [action] [prompt_id] [content]` | `!prompt view github` |

## Discord Interactions

### Buttons

| ID | Description | 
|---------|-------------|
| `approve_post` | Approve a generated post |
| `edit_post` | Edit a generated post |
| `schedule_post` | Schedule the current post |
| `cancel_post` | Cancel the current post |
| `change_image` | Change the image for a post |

### Select Menus

| ID | Description | 
|---------|-------------|
| `platform_select` | Select which platforms to post to |
| `priority_select` | Select a priority level for scheduling |
| `image_select` | Select from available images |
| `tone_select` | Select the tone for the post |

## REST API Endpoints

The Social Media Agent also exposes a REST API for programmatic access. Authentication is required for all endpoints.

### Authentication Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/auth/discord` | GET | Initiate Discord authentication | None |
| `/api/auth/twitter` | GET | Connect Twitter account | None |
| `/api/auth/linkedin` | GET | Connect LinkedIn account | None |
| `/api/auth/callback/:platform` | GET | OAuth callback for platforms | `platform`: The platform name |

### User Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/user` | GET | Get user profile information | None |
| `/api/user/accounts` | GET | List connected social accounts | None |
| `/api/user/preferences` | GET | Get user preferences | None |
| `/api/user/preferences` | POST | Update user preferences | Preference key-value pairs |

### Post Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/posts` | GET | List posts | `status`, `platform`, `page`, `limit` |
| `/api/posts/:id` | GET | Get a specific post | `id`: Post ID |
| `/api/posts` | POST | Create a new post | Post data object |
| `/api/posts/:id` | PUT | Update a post | `id`: Post ID, Post data |
| `/api/posts/:id` | DELETE | Delete a post | `id`: Post ID |

### URL Processing Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/process` | POST | Process a URL | `url`: The URL to process |
| `/api/process/youtube` | POST | Process YouTube URL | `url`: YouTube URL |
| `/api/process/github` | POST | Process GitHub URL | `url`: GitHub repository URL |
| `/api/process/article` | POST | Process article URL | `url`: Article URL |

### Scheduling Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/schedule` | POST | Schedule a post | `post_id`, `date`, `platforms` |
| `/api/schedule/:id` | PUT | Update schedule | `id`: Schedule ID, schedule data |
| `/api/schedule/:id` | DELETE | Cancel scheduled post | `id`: Schedule ID |
| `/api/schedule/priority` | POST | Schedule with priority | `post_id`, `priority`, `platforms` |

## Webhook Integration

The Social Media Agent supports incoming webhooks for integration with other services.

### Available Webhooks

| Webhook URL | Description | Payload Format |
|-------------|-------------|----------------|
| `/webhooks/content` | Submit content for processing | `{ "url": "URL", "platforms": ["twitter", "linkedin"] }` |
| `/webhooks/schedule` | Schedule a post | `{ "content": "Post content", "date": "ISO date", "platforms": ["twitter"] }` |

## API Response Format

All API responses follow a standard format:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

## Rate Limits

- API requests are limited to 100 requests per minute per user
- Content generation is limited to 20 requests per hour per user
- Post scheduling is limited to 50 posts per day per user

## API Authentication

API authentication uses JSON Web Tokens (JWT). Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

Tokens can be obtained through the Discord bot with:

```
!apikey generate
```

## Discord Permissions

The Discord bot requires the following permissions:
- Read Messages/View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Add Reactions
- Use External Emojis
- Use Application Commands 