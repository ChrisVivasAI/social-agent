# Discord Bot Integration

This document explains how to set up and use the Discord bot integration with the Social Media Agent.

## Setup Instructions

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click on "New Application" and give it a name (e.g., "Social Media Agent")
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the "Privileged Gateway Intents" section, enable:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent
5. Copy the bot token by clicking "Reset Token" and then "Copy" (you'll need this for your .env file)

### 2. Invite the Bot to Your Server

1. In the Developer Portal, go to the "OAuth2" > "URL Generator" tab
2. Under "Scopes," select "bot" and "applications.commands" (required for slash commands)
3. Under "Bot Permissions," select:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Attach Files
   - Mention Everyone
   - Add Reactions
   - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to and authorize it

### 3. Configure Your Environment

1. Add the following variables to your `.env` file:

```
# Discord configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_DEFAULT_CHANNEL_ID=your_default_channel_id_here  # Optional
```

2. To get a channel ID, enable Developer Mode in Discord (User Settings > Advanced > Developer Mode), then right-click on a channel and select "Copy ID"

### 4. Run the Bot

```bash
yarn start:discord
```

## Usage

The Discord bot can be used in several ways:

### Slash Commands

The bot supports the following slash commands:

1. **`/generate <url>`**: Generate social media content from a URL
   ```
   /generate url:https://github.com/langchain-ai/social-media-agent
   ```

2. **`/schedule <post_id> <platform> <date> <time>`**: Schedule a post for publishing
   ```
   /schedule post_id:a1b2c3d4 platform:twitter date:2023-12-31 time:14:30
   ```

3. **`/list`**: List all pending posts that haven't been scheduled yet

4. **`/help`**: Show help information about available commands

### Mention or Direct Message

You can also interact with the bot using:

1. **Mention the bot**: Type `@YourBotName` followed by a URL in any channel where the bot has access
   ```
   @SocialMediaAgent https://github.com/langchain-ai/social-media-agent
   ```

2. **Direct Message**: Send a direct message to the bot with a URL

### Post Workflow

After generating content with the `/generate` command or by mentioning the bot, you'll see:

1. **Generated content** with an associated post ID
2. **Interactive buttons** to:
   - **Approve**: Mark the post as approved (it remains in pending posts)
   - **Edit**: Open an editing modal to modify the generated content
   - **Schedule**: Show instructions for scheduling the post
   - **Discard**: Remove the post from pending posts

### Content Editing

When you click the "Edit" button on a generated post:
1. A modal dialog will open with the post content
2. Edit the content as needed
3. Submit the form to save your changes
4. The post will be updated in the pending posts list

### Post Scheduling

After approving or editing a post, use the `/schedule` command to schedule it:
```
/schedule post_id:a1b2c3d4 platform:twitter date:2023-12-31 time:14:30
```

Parameters:
- `post_id`: The ID shown with the generated content
- `platform`: Currently supports `twitter` or `linkedin`
- `date`: Format is YYYY-MM-DD
- `time`: Format is HH:MM (24-hour format)

## Troubleshooting

- **Bot doesn't respond**: Make sure you've enabled the necessary intents in the Discord Developer Portal
- **Slash commands don't appear**: The commands may take up to an hour to register globally. Try restarting the bot or check that you included "applications.commands" scope when inviting the bot
- **Permission errors**: Check that the bot has the correct permissions in your server
- **Button interactions don't work**: Make sure the bot has permission to use message components
- **Connection issues**: Verify your `DISCORD_BOT_TOKEN` is correct in the .env file
- **Post IDs not found**: Posts are stored in memory, so they'll be lost if the bot restarts

## Advanced Configuration

For advanced users, you can modify the `scripts/discord-bot.ts` file to customize the bot's behavior, such as:

- Changing the wait time for LangGraph responses
- Adding custom commands or buttons
- Implementing additional message handling logic
- Connecting to a database for persistent storage of posts 