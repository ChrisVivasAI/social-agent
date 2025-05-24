import "dotenv/config";
import { Client, Run } from "@langchain/langgraph-sdk";
import { DiscordClient } from "../src/clients/discord/index.js";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

type PendingRun = {
  thread_id: string;
  run_id: string;
  post: string;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
  scheduleDate: string;
};

async function getScheduledRuns() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
    // apiUrl: "http://localhost:54367",
  });

  const threads = await client.threads.search({
    metadata: {
      graph_id: "upload_post",
    },
    status: "busy",
  });
  let pendingRuns: PendingRun[] = [];

  for await (const thread of threads) {
    const runs = await client.runs.list(thread.thread_id);
    const run = runs[0] as Run & {
      kwargs: Record<string, any>;
    };
    if (!run) {
      console.warn(`No run found for thread ${thread.thread_id}`);
      continue;
    }
    pendingRuns.push({
      thread_id: thread.thread_id,
      run_id: run.run_id,
      post: run.kwargs.input.post,
      image: run.kwargs.input.image,
      scheduleDate: run.created_at,
    });
  }

  // Sort the pending runs by schedule date
  pendingRuns.sort((a, b) => {
    return (
      new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime()
    );
  });

  const pendingRunsString = pendingRuns.map(
    (post, index) => `*Post ${index + 1}*:

Scheduled for *${format(toZonedTime(new Date(post.scheduleDate), "America/Los_Angeles"), "MM/dd hh:mm a")} PST*

Post:
\`\`\`
${post.post}
\`\`\`

Image:
\`\`\`
${post.image?.imageUrl || "No image"}
\`\`\``,
  );

  const discordMessageContent = `Number of scheduled posts: *${pendingRuns.length}*
  
Scheduled posts:

${pendingRunsString.join("\n\n")}`;

  // Updated to use Discord environment variables and DiscordClient
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (discordChannelId || discordChannelName) {
    const clientArgs: any = {};
    if (discordChannelId) {
      clientArgs.channelId = discordChannelId;
    } else if (discordChannelName) {
      clientArgs.channelName = discordChannelName;
    }
    // Token is handled by DiscordClient constructor via process.env.DISCORD_BOT_TOKEN
    const discordClient = new DiscordClient(clientArgs);
    try {
      await discordClient.sendMessage(discordMessageContent);
    } catch (error) {
      console.error("Failed to send scheduled runs notification to Discord:", error);
      console.log("Scheduled runs content (fallback due to Discord error):\n", discordMessageContent);
    }
  } else {
    console.log("Scheduled runs content (Discord not configured):\n", discordMessageContent);
  }
}

getScheduledRuns().catch(console.error);
