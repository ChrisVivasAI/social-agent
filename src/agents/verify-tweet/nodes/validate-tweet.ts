import { z } from "zod";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyTweetAnnotation } from "../verify-tweet-state.js";
import { getVertexChatModel } from "../../../utils/vertex-model.js";

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the content is or isn't relevant to AI engineering, tools, or innovations.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the content is relevant to AI engineering, tools, or innovations.",
      ),
  })
  .describe("The relevancy of the content to AI engineering, tools, or innovations.");

const VERIFY_RELEVANT_CONTENT_PROMPT = `You are evaluating content for Chris Vivas, an AI engineer who shares valuable insights about AI news, tools, innovations, and technical AI strategies.
You're provided with a Tweet and the page content of links in the Tweet. Your task is to determine if this content is relevant and valuable for Chris's audience.
You need to carefully read the entire content and determine if it aligns with Chris's focus areas:

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the entire Tweet plus webpage content closely, and determine if the content is relevant to AI engineering, tools, innovations, or technical strategies.
You should provide reasoning as to why the content is or isn't relevant to Chris's audience, followed by a simple true or false determination.
Content should be considered relevant if it provides substantive information about AI that would be useful to Chris's followers.`;

async function verifyGeneralContentIsRelevant(
  content: string,
): Promise<boolean> {
  const relevancyModel = getVertexChatModel("claude-3-5-sonnet-latest", 0)
    .withStructuredOutput(RELEVANCY_SCHEMA, {
      name: "relevancy",
    });

  const { relevant } = await relevancyModel
    .withConfig({
      runName: "check-general-relevancy-model",
    })
    .invoke([
      {
        role: "system",
        content: VERIFY_RELEVANT_CONTENT_PROMPT,
      },
      {
        role: "user",
        content: content,
      },
    ]);
  return relevant;
}

function constructContext({
  tweetContent,
  pageContents,
}: {
  tweetContent: string;
  pageContents: string[];
}): string {
  const tweetPrompt = `The following is the content of the Tweet:
<tweet-content>
${tweetContent}
</tweet-content>`;
  const webpageContents =
    pageContents.length > 0
      ? `The following are the contents of the webpage${pageContents.length > 1 ? "s" : ""} linked in the Tweet:
${pageContents.map((content, index) => `<webpage-content key="${index}">\n${content}\n</webpage-content>`).join("\n")}`
      : "No webpage content was found in the Tweet.";

  return `${tweetPrompt}\n\n${webpageContents}`;
}

/**
 * Verifies the Tweet & webpage contents provided is relevant to AI engineering, tools, or innovations.
 */
export async function validateTweetContent(
  state: typeof VerifyTweetAnnotation.State,
): Promise<Partial<typeof VerifyTweetAnnotation.State>> {
  if (!state.pageContents?.length && !state.tweetContent) {
    throw new Error(
      "Missing page contents and tweet contents. One of these must be defined to verify the Tweet content.",
    );
  }
  const context = constructContext({
    tweetContent: state.tweetContent,
    pageContents: state.pageContents || [],
  });

  const relevant = await verifyGeneralContentIsRelevant(context);

  if (!relevant) {
    return {
      relevantLinks: [],
      pageContents: [],
      imageOptions: [],
    };
  }

  return {
    relevantLinks: [state.link, ...state.tweetContentUrls],
    pageContents: [context],
  };
}
