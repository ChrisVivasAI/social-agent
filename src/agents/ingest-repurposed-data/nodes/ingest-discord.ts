import { IngestRepurposedDataState } from "../types.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { SimpleMessage, DiscordClient } from "../../../clients/discord/index.js"; // Adjusted path
import { RunnableLambda } from "@langchain/core/runnables";

const getChannelIdFromConfig = async (
  config: LangGraphRunnableConfig,
): Promise<string | undefined> => {
  // Assuming similar config structure for Discord channel ID
  if (config.configurable?.repurposerDiscordChannelId) {
    return config.configurable?.repurposerDiscordChannelId;
  } else if (config.configurable?.repurposerDiscordChannelName) {
    const client = new DiscordClient({
      channelName: config.configurable.repurposerDiscordChannelName,
    });
    return await client.getChannelId();
  }

  throw new Error("Repurposer Discord channel ID or Name not found in config.");
};

export async function ingestDiscordMessages(
  state: IngestRepurposedDataState,
  config: LangGraphRunnableConfig,
): Promise<Partial<IngestRepurposedDataState>> {
  if (config.configurable?.skipIngest) {
    if (state.contents.length === 0) {
      throw new Error("Can not skip ingest with no links/content");
    }
    return {};
  }

  const channelId = await getChannelIdFromConfig(config);
  if (!channelId) {
    // This case should be handled by getChannelIdFromConfig throwing an error
    throw new Error("Discord Channel ID not found for repurposer"); 
  }

  const client = new DiscordClient({
    channelId,
    // token: process.env.DISCORD_BOT_TOKEN // Ensure token is available
  });
  const recentMessages = await RunnableLambda.from<
    unknown,
    SimpleMessage[] // Using SimpleMessage from Discord types
  >(() => client.fetchLast24HoursMessages({
    maxMessages: config.configurable?.maxMessages, // Assuming these might be used here too
    maxDaysHistory: config.configurable?.maxDaysHistory,
  }))
    .withConfig({ runName: "fetch_discord_repurposer_messages" })
    .invoke({}, config);

  return {
    messages: recentMessages, // Storing SimpleMessage[]
  };
} 