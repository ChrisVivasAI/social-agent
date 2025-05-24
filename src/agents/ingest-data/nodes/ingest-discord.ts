import { IngestDataAnnotation } from "../ingest-data-state.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { SimpleMessage, DiscordClient } from "../../../clients/discord/index.js";
import { extractUrls } from "../../utils.js";
import { RunnableLambda } from "@langchain/core/runnables";

const getChannelIdFromConfig = async (
  config: LangGraphRunnableConfig,
): Promise<string | undefined> => {
  if (config.configurable?.discordChannelName) {
    const client = new DiscordClient({
      channelName: config.configurable.discordChannelName,
    });
    return await client.getChannelId();
  }
  return config.configurable?.discordChannelId;
};

export async function ingestDiscordData(
  state: typeof IngestDataAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof IngestDataAnnotation.State>> {
  if (config.configurable?.skipIngest) {
    if (state.links.length === 0) {
      throw new Error("Can not skip ingest with no links");
    }
    return {};
  }

  const channelId = await getChannelIdFromConfig(config);
  if (!channelId) {
    throw new Error("Discord Channel ID not found in config");
  }

  const client = new DiscordClient({
    channelId,
  });
  const recentMessages = await RunnableLambda.from<
    unknown,
    SimpleMessage[]
  >(() =>
    client.fetchLast24HoursMessages({
      maxMessages: config.configurable?.maxMessages,
      maxDaysHistory: config.configurable?.maxDaysHistory,
    }),
  )
    .withConfig({ runName: "fetch-discord-messages" })
    .invoke({}, config);

  const links = recentMessages.flatMap((msg) => {
    const extractedLinks = extractUrls(msg.text || ""); 
    if (!extractedLinks.length) {
      return [];
    }
    return extractedLinks;
  });

  return {
    links,
  };
} 