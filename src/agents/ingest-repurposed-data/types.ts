import { Annotation } from "@langchain/langgraph";
import { SimpleMessage } from "../../clients/discord/index.js";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../generate-post/constants.js";

export type RepurposedContent = {
  originalLink: string;
  additionalContextLinks?: string[];
  quantity: number;
};

export const IngestRepurposedDataAnnotation = Annotation.Root({
  /**
   * The contents to use for generating repurposed posts.
   */
  contents: Annotation<RepurposedContent[]>,
  /**
   * The Discord messages ingested.
   */
  messages: Annotation<SimpleMessage[]>,
});

export type IngestRepurposedDataState =
  typeof IngestRepurposedDataAnnotation.State;

export const IngestRepurposedDataConfigurableAnnotation = Annotation.Root({
  /**
   * The ID of the Discord channel to use when ingesting data.
   */
  repurposerDiscordChannelId: Annotation<string | undefined>,
  /**
   * The name of the Discord channel to use when ingesting data.
   * If ID is not provided, name will be used to find the ID.
   */
  repurposerDiscordChannelName: Annotation<string | undefined>,
  /**
   * Whether or not to skip ingesting messages from Discord.
   * This will throw an error if messages are not
   * pre-provided in state.
   */
  skipIngest: Annotation<boolean | undefined>,
  /**
   * Whether to post to the LinkedIn organization or the user's profile.
   * If true, [LINKEDIN_ORGANIZATION_ID] is required.
   */
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * Maximum number of messages to fetch from Discord.
   */
  maxMessages: Annotation<number | undefined>,
  /**
   * Maximum number of days of history to fetch from Discord.
   */
  maxDaysHistory: Annotation<number | undefined>,
});
