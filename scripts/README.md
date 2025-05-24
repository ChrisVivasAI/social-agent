# Social Media Agent Scripts

## Setup

First ensure you have all dependencies installed:

```bash
yarn install
```

And your `LANGCHAIN_API_KEY`, `LANGGRAPH_API_URL` environment variables set:

```bash
LANGCHAIN_API_KEY=...
LANGGRAPH_API_URL=...
```

Some scripts will send output to Discord. If you want this output to post to Discord, ensure you have the `DISCORD_BOT_TOKEN` and either `DISCORD_CHANNEL_ID` or `DISCORD_CHANNEL_NAME` environment variables set:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_discord_channel_id_here
# Or, alternatively for the channel:
# DISCORD_CHANNEL_NAME=your-discord-channel-name
```

Ensure you have an `.env` file at the root of the project with your LangGraph Cloud API key and other necessary environment variables like `OPENAI_API_KEY` and the Discord variables mentioned above.

## Scripts

### Get Scheduled Runs

This script will fetch all scheduled runs and either send them to Discord or print them to the console.

```bash
yarn get:scheduled_runs
```

### Get all used links

This script will fetch and log all links which are currently scheduled, or interrupted and awaiting human intervention.

```bash
yarn get:used_links
```

### Generate Demo Post

This script will invoke the graph to generate a post. It defaults to a LangChain blog post, and typically used to demonstrate how the Social Media Agent works.

```bash
yarn generate_post
```

### Delete Run(s) & Thread(s)

This script will delete runs and associated threads. It requires setting the run ID(s) and thread ID(s) in the script.

```bash
yarn graph:delete:run_thread
```

### Backfill

This script will backfill your deployment with links. It contains two functions, one for backfilling from Discord, and one for backfilling from a list of links. You'll need to uncomment one/both of the functions to use them.

```bash
yarn graph:backfill
```

### Create Cron

This script will create a cron job to run the `ingest_data` graph.

```bash
yarn cron:create
```

### Delete Cron

This script will delete a cron job.

```bash
yarn cron:delete
```

### List Crons

This script will list all cron jobs.

```bash
yarn cron:list
```

### Running Scripts

To run any of these scripts, use the following command structure from the root of the repository:

```bash
poetry run node --loader ts-node/esm scripts/<script_name>.ts
```

For example, to run the `get_thread.ts` script:

```bash
poetry run node --loader ts-node/esm scripts/get_thread.ts <thread_id>
```
