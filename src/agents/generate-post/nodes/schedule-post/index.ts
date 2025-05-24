import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../../constants.js";
import {
  getScheduledDateSeconds,
  getFutureDate,
} from "../../../../utils/schedule-date/index.js";
import { DiscordClient } from "../../../../clients/discord/index.js";
import { isTextOnly, shouldPostToLinkedInOrg } from "../../../utils.js";

interface SendDiscordMessageArgs {
  isTextOnlyMode: boolean;
  afterSeconds: number;
  threadId: string;
  runId: string;
  postContent: string;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function sendDiscordMessage({
  isTextOnlyMode,
  afterSeconds,
  threadId,
  runId,
  postContent,
  image,
}: SendDiscordMessageArgs) {
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (!discordChannelId && !discordChannelName) {
    console.warn(
      "No DISCORD_CHANNEL_ID or DISCORD_CHANNEL_NAME found in environment variables. Cannot send message to Discord.",
    );
    return;
  }

  const clientArgs: any = {};
  if (discordChannelId) {
    clientArgs.channelId = discordChannelId;
  } else if (discordChannelName) {
    clientArgs.channelName = discordChannelName;
  }
  const discordClient = new DiscordClient(clientArgs);

  const imageString = image?.imageUrl
    ? `Image:\n${image?.imageUrl}`
    : "No image provided";

  const messageString = `*New Post Scheduled*
    
Scheduled post for: *${getFutureDate(afterSeconds)}*
Run ID: *${runId}*
Thread ID: *${threadId}*

Post:
\`\`\`
${postContent}
\`\`\`

${!isTextOnlyMode ? imageString : "Text only mode enabled. Image support has been disabled."}`;

  try {
    await discordClient.sendMessage(messageString);
  } catch (error) {
    console.error("Failed to send Discord message for scheduled post:", error);
  }
}

export async function schedulePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.post || !state.scheduleDate) {
    throw new Error("No post or schedule date found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const afterSeconds = await getScheduledDateSeconds({
    scheduleDate: state.scheduleDate,
    config,
  });

  const thread = await client.threads.create();
  const run = await client.runs.create(thread.thread_id, "upload_post", {
    input: {
      post: state.post,
      image: state.image,
    },
    config: {
      configurable: {
        [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        [TEXT_ONLY_MODE]: isTextOnlyMode,
      },
    },
    afterSeconds,
  });

  try {
    await sendDiscordMessage({
      isTextOnlyMode,
      afterSeconds,
      threadId: thread.thread_id,
      runId: run.run_id,
      postContent: state.post,
      image: state.image,
    });
  } catch (e) {
    console.error("Failed to send schedule post Discord message logic", e);
  }

  return {};
}
