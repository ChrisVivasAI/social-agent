import { Annotation } from "@langchain/langgraph";
import { SimpleMessage } from "../../clients/discord/index.js";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";

export type LangChainProduct = "langchain" | "langgraph" | "langsmith";
export type SimpleDiscordMessageWithLinks = SimpleMessage & {
  links: string[];
};

export const IngestDataAnnotation = Annotation.Root({
  /**
   * The links to content to use for generating posts.
   */
  links: Annotation<string[]>,
  /**
   * A report generated on the content. Will be used in the main
   * graph when generating the post about this content.
   */
  report: Annotation<string>,
  /**
   * The content of the linkedin post.
   */
  linkedinPost: Annotation<string>,
  /**
   * The content of the tweet.
   */
  twitterPost: Annotation<string>,
});

export const IngestDataConfigurableAnnotation = Annotation.Root({
  /**
   * Maximum number of messages to fetch from Discord.
   */
  maxMessages: Annotation<number>({
    reducer: (_state, update) => update,
    default: () => 100,
  }),
  /**
   * The maximum number of days to go back when ingesting
   * messages from Discord.
   */
  maxDaysHistory: Annotation<number | undefined>,
  /**
   * The name of the Discord channel to ingest messages from.
   */
  discordChannelName: Annotation<string | undefined>,
  /**
   * The ID of the Discord channel to ingest messages from.
   */
  discordChannelId: Annotation<string | undefined>,
  /**
   * Whether or not to skip ingesting messages from Discord.
   * This will throw an error if links are not
   * pre-provided in state.
   */
  skipIngest: Annotation<boolean | undefined>,
  /**
   * Whether to post to the LinkedIn organization or the user's profile.
   * If true, [LINKEDIN_ORGANIZATION_ID] is required.
   */
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * Whether or not to use text only mode throughout the graph.
   * If true, it will not try to extract, validate, or upload images.
   * Additionally, it will not be able to handle validating YouTube videos.
   * @default false
   */
  [TEXT_ONLY_MODE]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
});
