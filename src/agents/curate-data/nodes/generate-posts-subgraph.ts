import { Client } from "@langchain/langgraph-sdk";
import { CurateDataState } from "../state.js";
import { getTweetLink } from "../../../clients/twitter/utils.js";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../../generate-post/constants.js";
import {
  getAfterSecondsFromLinks,
  shouldPostToLinkedInOrg,
} from "../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  getGitHubRepoURLs,
  putGitHubRepoURLs,
} from "../utils/stores/github-repos.js";
import {
  getRedditPostIds,
  putRedditPostIds,
} from "../utils/stores/reddit-post-ids.js";
import { getTweetIds, putTweetIds } from "../utils/stores/twitter.js";
import { DiscordClient } from "../../../clients/discord/index.js";
import { ThreadRunId } from "../types.js";

async function saveIngestedData(
  state: CurateDataState,
  config: LangGraphRunnableConfig,
) {
  const [existingGitHubRepoURLs, redditPostIds, existingTweetIds] =
    await Promise.all([
      getGitHubRepoURLs(config),
      getRedditPostIds(config),
      getTweetIds(config),
    ]);

  const newGitHubRepoURLs = new Set([
    ...existingGitHubRepoURLs,
    ...state.rawTrendingRepos,
  ]);
  const newRedditPostIds = new Set([
    ...redditPostIds,
    ...state.rawRedditPosts.map((p) => p.post.id),
  ]);
  const newTweetIds = new Set([
    ...existingTweetIds,
    ...state.rawTweets.map((t) => t.id),
  ]);

  await Promise.all([
    putGitHubRepoURLs(Array.from(newGitHubRepoURLs), config),
    putRedditPostIds(Array.from(newRedditPostIds), config),
    putTweetIds(Array.from(newTweetIds), config),
  ]);
}

async function sendDiscordNotification(
  state: CurateDataState,
  config: LangGraphRunnableConfig,
) {
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (!discordChannelId && !discordChannelName) {
    console.warn("Discord channel ID or name not provided in environment variables. Skipping notification.");
    return;
  }

  const clientArgs: any = {};
  if (discordChannelId) {
    clientArgs.channelId = discordChannelId;
  } else if (discordChannelName) {
    clientArgs.channelName = discordChannelName;
  }
  const discordClient = new DiscordClient(clientArgs);

  try {
    await saveIngestedData(state, config);
    await discordClient.sendMessage(`✅ INGESTED DATA SAVED SUCCESSFULLY ✅

Number of tweets: *${state.rawTweets.length}*
Number of repos: *${state.rawTrendingRepos.length}*
Number of reddit posts: *${state.rawRedditPosts.length}*
Run ID: *${config.configurable?.run_id || "not found"}*
Thread ID: *${config.configurable?.thread_id || "not found"}*
      `);
  } catch (error: any) {
    console.warn("Error saving ingested data or sending Discord notification", error);
    const errMessage = "message" in error ? error.message : String(error);
    try {
      await discordClient.sendMessage(`❌ FAILED TO SAVE INGESTED DATA OR SEND NOTIFICATION ❌
Error: ${errMessage}
  
Run ID: *${config.configurable?.run_id || "not found"}*
Thread ID: *${config.configurable?.thread_id || "not found"}*
      `);
    } catch (discordError) {
      console.error("Failed to send error notification to Discord:", discordError);
    }
  }
}

function getAfterSeconds(state: CurateDataState) {
  const twitterURLs = state.rawTweets.flatMap((t) =>
    t.author_id ? [getTweetLink(t.author_id, t.id)] : [],
  );
  const redditURLs = state.rawRedditPosts.map((p) => p.post.url);
  const afterSecondsList = getAfterSecondsFromLinks(
    [...twitterURLs, ...redditURLs, ...state.rawTrendingRepos],
    {
      baseDelaySeconds: 60,
    },
  );

  return afterSecondsList;
}

export async function generatePostsSubgraph(
  state: CurateDataState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CurateDataState>> {
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const afterSecondsList = getAfterSeconds(state);

  const threadRunIds: ThreadRunId[] = [];

  for (const { link, afterSeconds } of afterSecondsList) {
    const { thread_id } = await client.threads.create();
    const { run_id } = await client.runs.create(thread_id, "generate_post", {
      input: {
        links: [link],
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        },
      },
      afterSeconds,
    });
    threadRunIds.push({ thread_id, run_id });
  }

  await sendDiscordNotification(state, config);

  return {
    threadRunIds,
  };
}
