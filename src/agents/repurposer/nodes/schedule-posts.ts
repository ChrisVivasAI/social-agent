import { Client } from "@langchain/langgraph-sdk";
import { RepurposerState } from "../types.js";
import {
  getFutureDate,
  getScheduledDateSeconds,
} from "../../../utils/schedule-date/index.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { capitalize, shouldPostToLinkedInOrg } from "../../utils.js";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../../generate-post/constants.js";
import { DiscordClient } from "../../../clients/discord/index.js";
import { DateType } from "../../types.js";

interface SendDiscordMessageArgs {
  posts: {
    afterSeconds: number;
    threadId: string;
    runId: string;
    postContent: string;
    image?: string;
  }[];
  priority: DateType;
}

async function sendDiscordMessage({ posts, priority }: SendDiscordMessageArgs) {
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

  const postOrPosts = posts.length > 1 ? "posts" : "post";

  let description = `*New Repurposed ${capitalize(postOrPosts)} Scheduled*
Total posts: *${posts.length}*
Schedule Priority: *${priority}*`;

  for (const { afterSeconds, threadId, runId, postContent, image } of posts) {
    const imageString = image
      ? `Image:\n${image}`
      : "No image provided";

    const messageString = `Scheduled post for: *${getFutureDate(afterSeconds)}*
Run ID: *${runId}*
Thread ID: *${threadId}*

Post:
\`\`\`
${postContent}
\`\`\`

${imageString}`;

    description += `\n\n------------------\n${messageString}`;
  }

  try {
    await discordClient.sendMessage(description);
  } catch (error) {
    console.error("Failed to send Discord message for scheduled repurposed posts:", error);
  }
}

export async function schedulePosts(
  state: RepurposerState,
  config: LangGraphRunnableConfig,
): Promise<Partial<RepurposerState>> {
  if (!state.scheduleDate) {
    throw new Error("No schedule date found");
  }

  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const allAfterSeconds = await getScheduledDateSeconds({
    scheduleDate: state.scheduleDate,
    numberOfDates: state.posts.length,
    config,
    numWeeksBetween: state.numWeeksBetween,
  });

  const startRunsPromises = state.posts.map(async (post) => {
    const afterSeconds = allAfterSeconds[post.index];
    if (!afterSeconds) {
      throw new Error("No after seconds found for post index " + post.index);
    }
    const { thread_id } = await client.threads.create();
    const { run_id } = await client.runs.create(thread_id, "upload_post", {
      input: {
        post: post.content,
        image: state.images?.find((image) => image.index === post.index),
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        },
      },
      afterSeconds,
    });

    return {
      threadId: thread_id,
      runId: run_id,
      afterSeconds,
      postContent: post.content,
      image: state.images.find((image) => image.index === post.index)?.imageUrl,
    };
  });

  const startedRuns = await Promise.all(startRunsPromises);

  try {
    await sendDiscordMessage({
      posts: startedRuns,
      priority: state.scheduleDate,
    });
  } catch (e) {
    console.error("Failed to send schedule repurposed post Discord message logic", e);
  }

  return {};
}
