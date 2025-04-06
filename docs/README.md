# Social Media Agent

## Overview

The Social Media Agent is an AI-powered tool that enables users to create, schedule, and manage social media content for Twitter and LinkedIn through a Discord interface. This version has been customized for Chris Vivas, an AI engineer focused on sharing valuable insights about AI news, tools, innovations, and technical strategies. The system automates content generation based on user-provided links, utilizes AI to craft engaging posts in Chris's personal voice, and handles the publishing workflow.

## Features

- AI-powered post generation from URLs (articles, videos, GitHub repos)
- Content created in Chris Vivas's personal voice and expertise focus
- Customized content filtering aligned with AI engineering topics
- Interactive post editing and approval workflow
- Post scheduling and calendar management
- Twitter and LinkedIn integration
- Discord bot interface with slash commands and buttons
- Content approval workflow with interactive components
- Docker support for easy deployment
- Google Cloud Run compatible

## Quick Start

### Prerequisites

- Node.js (v18+)
- Discord account and server
- Twitter Developer Account
- LinkedIn Developer Account
- Google Cloud Vertex AI API access 

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/social-media-agent.git
   cd social-media-agent
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Set up Discord bot**
   - Create a new Discord application at https://discord.com/developers/applications
   - Create a bot and enable necessary intents (MESSAGE CONTENT, GUILD MESSAGES)
   - Add the bot to your server with proper permissions
   - Copy the bot token to your .env file

5. **Start the development server**
   ```bash
   yarn langgraph:in_mem:up
   ```

6. **Start the agent**
   ```bash
   yarn start
   ```

## Usage

Once set up, you can interact with the agent through Discord using slash commands:

- `/generate [URL]` - Generate a post from a URL
- `/schedule [post_id] [platform] [date] [time]` - Schedule a post for a specific date
- `/list` - View all pending posts
- `/help` - Display available commands

You can also mention the bot with a URL or send a direct message.

After content generation, interactive buttons allow you to:
- Approve posts
- Edit content in a modal dialog
- Schedule posts
- Discard unwanted content

## Customization

The agent is pre-configured with Chris Vivas's voice and focus areas:

- AI Tools & Applications
- Technical AI Strategies
- AI Research Breakthroughs
- LLM Developments
- AI Engineering
- Multimodal AI
- AI Agents
- Responsible AI
- Open-source AI Projects
- AI Performance Optimization

To modify these settings, edit the prompt files in `src/agents/generate-post/prompts/`.

## Docker Deployment

```bash
# Build the Docker image
docker build -t social-media-agent .

# Run locally
docker run -p 54368:54368 --env-file .env social-media-agent
```

## Google Cloud Run Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Google Cloud Run.

## Documentation

- [Architecture](./ARCHITECTURE.md) - System design and component interactions
- [Features](./FEATURES.md) - Detailed feature list and roadmap
- [Discord Bot](./DISCORD_BOT.md) - Discord bot setup and features 
- [Implementation Progress](./IMPLEMENTATION_PROGRESS.md) - Development status
- [API Reference](./API_REFERENCE.md) - Discord commands and API endpoints
- [Deployment](./DEPLOYMENT.md) - Deployment instructions

## License

MIT 