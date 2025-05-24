import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { TwitterClient } from "../../clients/twitter/client.js";
import {
  imageUrlToBuffer,
  isTextOnly,
  shouldPostToLinkedInOrg,
} from "../utils.js";
import { CreateMediaRequest } from "../../clients/twitter/types.js";
import { LinkedInClient } from "../../clients/linkedin.js";
import {
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_ORGANIZATION_ID,
  LINKEDIN_PERSON_URN,
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";
import { DiscordClient } from "../../clients/discord/index.js";

async function getMediaFromImage(image?: {
  imageUrl: string;
  mimeType: string;
}): Promise<CreateMediaRequest | undefined> {
  if (!image) return undefined;
  const { buffer, contentType } = await imageUrlToBuffer(image.imageUrl);
  return {
    media: buffer,
    mimeType: contentType,
  };
}

const UploadPostAnnotation = Annotation.Root({
  post: Annotation<string>,
  image: Annotation<
    | {
        imageUrl: string;
        mimeType: string;
      }
    | undefined
  >,
});

const UploadPostGraphConfiguration = Annotation.Root({
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

interface PostUploadFailureToDiscordArgs {
  uploadDestination: "twitter" | "linkedin";
  error: any;
  threadId: string;
  postContent: string;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function postUploadFailureToDiscord({
  uploadDestination,
  error,
  threadId,
  postContent,
  image,
}: PostUploadFailureToDiscordArgs) {
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (!discordChannelId && !discordChannelName) {
    console.warn(
      "No DISCORD_CHANNEL_ID or DISCORD_CHANNEL_NAME found in environment variables. Cannot send error message to Discord.",
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
  
  const discordMessageContent = `❌ FAILED TO UPLOAD POST TO ${uploadDestination.toUpperCase()} ❌

Error message:
\`\`\`
${error}
\`\`\`

Thread ID: *${threadId}*

Post:
\`\`\`
${postContent}
\`\`\`

${image ? `Image:\nURL: ${image.imageUrl}\nMIME type: ${image.mimeType}` : ""}
`;
  try {
    await discordClient.sendMessage(discordMessageContent);
  } catch (discordError) {
    console.error("Failed to send upload failure notification to Discord:", discordError);
  }
}

export async function uploadPost(
  state: typeof UploadPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof UploadPostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post text found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  try {
    let twitterClient: TwitterClient;
    const useArcadeAuth = process.env.USE_ARCADE_AUTH;
    const useTwitterApiOnly = process.env.USE_TWITTER_API_ONLY;

    if (useTwitterApiOnly === "true" || useArcadeAuth !== "true") {
      twitterClient = TwitterClient.fromBasicTwitterAuth();
    } else {
      const twitterUserId = process.env.TWITTER_USER_ID;
      if (!twitterUserId) {
        throw new Error("Twitter user ID not found in configurable fields.");
      }

      const twitterToken = process.env.TWITTER_USER_TOKEN;
      const twitterTokenSecret = process.env.TWITTER_USER_TOKEN_SECRET;

      twitterClient = await TwitterClient.fromArcade(
        twitterUserId,
        {
          twitterToken,
          twitterTokenSecret,
        },
        {
          textOnlyMode: isTextOnlyMode,
        },
      );
    }

    let mediaBuffer: CreateMediaRequest | undefined = undefined;
    if (!isTextOnlyMode) {
      mediaBuffer = await getMediaFromImage(state.image);
    }

    await twitterClient.uploadTweet({
      text: state.post,
      ...(mediaBuffer && { media: mediaBuffer }),
    });
    console.log("✅ Successfully uploaded Tweet ✅");
  } catch (e: any) {
    console.error("Failed to upload post:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = String(e);
    }
    await postUploadFailureToDiscord({
      uploadDestination: "twitter",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.post,
      image: state.image,
    });
  }

  try {
    let linkedInClient: LinkedInClient;

    const useArcadeAuth = process.env.USE_ARCADE_AUTH;
    if (useArcadeAuth === "true") {
      const linkedInUserId = process.env.LINKEDIN_USER_ID;
      if (!linkedInUserId) {
        throw new Error("LinkedIn user ID not found in configurable fields.");
      }

      linkedInClient = await LinkedInClient.fromArcade(linkedInUserId, {
        postToOrganization: postToLinkedInOrg,
      });
    } else {
      const accessToken =
        process.env.LINKEDIN_ACCESS_TOKEN ||
        config.configurable?.[LINKEDIN_ACCESS_TOKEN];
      if (!accessToken) {
        throw new Error(
          "LinkedIn access token not found in environment or configurable fields. Either set it, or use Arcade Auth.",
        );
      }

      const personUrn =
        process.env.LINKEDIN_PERSON_URN ||
        config.configurable?.[LINKEDIN_PERSON_URN];
      const organizationId =
        process.env.LINKEDIN_ORGANIZATION_ID ||
        config.configurable?.[LINKEDIN_ORGANIZATION_ID];

      if (!postToLinkedInOrg && !personUrn) {
        throw new Error(
          "LinkedIn person URN not found. Either set it, use Arcade Auth, or post to an organization."
        );
      }
      if (postToLinkedInOrg && !organizationId) {
        throw new Error(
          "LinkedIn organization ID not found. Either set it, use Arcade Auth, or post to a person."
        );
      }

      linkedInClient = new LinkedInClient({
        accessToken: accessToken,
        personUrn: personUrn,
        organizationId: organizationId,
      });
    }

    if (!isTextOnlyMode && state.image) {
      await linkedInClient.createImagePost(
        {
          text: state.post,
          imageUrl: state.image.imageUrl,
        },
        {
          postToOrganization: postToLinkedInOrg,
        },
      );
    } else {
      await linkedInClient.createTextPost(state.post, {
        postToOrganization: postToLinkedInOrg,
      });
    }

    console.log("✅ Successfully uploaded post to LinkedIn ✅");
  } catch (e: any) {
    console.error("Failed to upload post to LinkedIn:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = String(e);
    }
    await postUploadFailureToDiscord({
      uploadDestination: "linkedin",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.post,
      image: state.image,
    });
  }

  return {};
}

const uploadPostWorkflow = new StateGraph(
  UploadPostAnnotation,
  UploadPostGraphConfiguration,
)
  .addNode("uploadPost", uploadPost)
  .addEdge(START, "uploadPost")
  .addEdge("uploadPost", END);

export const uploadPostGraph = uploadPostWorkflow.compile();
(uploadPostGraph as any).name = "Upload Post Graph";
