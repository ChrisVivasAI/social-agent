import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { z } from "zod";
import { getVertexChatModel } from "../../../utils/vertex-model.js";
import { FireCrawlLoader } from "@langchain/community/document_loaders/web/firecrawl";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { RunnableLambda } from "@langchain/core/runnables";
import { getPageText } from "../../utils.js";
import { getImagesFromFireCrawlMetadata } from "../../../utils/firecrawl.js";
import { CurateDataState } from "../../curate-data/state.js";
import { shouldExcludeGeneralContent } from "../../should-exclude.js";

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the webpage is or isn't relevant to your company's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the webpage is relevant to your company's products.",
      ),
  })
  .describe("The relevancy of the content to your company's products.");

const VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee at Chris Vivas.
You're provided with a webpage containing content a third party submitted to you claiming it's relevant to your business context.
Your task is to carefully read over the entire page, and determine whether or not the content is actually relevant to your context.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the webpage content closely, and determine if the content is relevant to your context.
You should provide reasoning as to why or why not the content is relevant to your context, then a simple true or false for whether or not it is relevant.`;

type UrlContents = {
  content: string;
  imageUrls?: string[];
};

export async function getUrlContents(url: string): Promise<UrlContents> {
  const loader = new FireCrawlLoader({
    url,
    mode: "scrape",
    params: {
      formats: ["markdown", "screenshot"],
    },
  });
  const docs = await loader.load();

  const docsText = docs.map((d) => d.pageContent).join("\n");
  if (docsText.length) {
    return {
      content: docsText,
      imageUrls: docs.flatMap(
        (d) => getImagesFromFireCrawlMetadata(d.metadata) || [],
      ),
    };
  }

  const text = await getPageText(url);
  if (text) {
    return {
      content: text,
    };
  }
  throw new Error(`Failed to fetch content from ${url}.`);
}

export async function verifyGeneralContentIsRelevant(
  content: string,
): Promise<boolean> {
  try {
    // Simple check for AI-related content
    const aiKeywords = [
      "machine learning",
      "artificial intelligence",
      "deep learning",
      "neural network",
      "ai",
      "ml",
      "nlp",
      "natural language processing",
      "computer vision",
      "tensorflow",
      "pytorch",
      "keras",
      "scikit-learn",
      "hugging face",
      "transformers",
      "langchain",
      "llm",
      "large language model"
    ];
    const lowerContent = content.toLowerCase();
    const hasAIContent = aiKeywords.some(keyword => lowerContent.includes(keyword.toLowerCase()));
    return hasAIContent;
  } catch (error) {
    console.error("Error in verifyGeneralContentIsRelevant:", error);
    return false;
  }
}

/**
 * Verifies if the general content from a provided URL is relevant to your company's products.
 *
 * @param state - The current state containing the link to verify.
 * @param _config - Configuration for the LangGraph runtime (unused in this function).
 * @returns An object containing relevant links and page contents if the content is relevant;
 * otherwise, returns empty arrays.
 */
export async function verifyGeneralContent(
  state: typeof VerifyContentAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<Partial<CurateDataState>> {
  const shouldExclude = shouldExcludeGeneralContent(state.link);
  if (shouldExclude) {
    return {};
  }

  const urlContents = await new RunnableLambda<string, UrlContents>({
    func: getUrlContents,
  })
    .withConfig({ runName: "get-url-contents" })
    .invoke(state.link);
  const relevant = await verifyGeneralContentIsRelevant(urlContents.content);

  if (relevant) {
    return {
      relevantLinks: [state.link],
      pageContents: [urlContents.content],
      ...(urlContents.imageUrls?.length
        ? { imageOptions: urlContents.imageUrls }
        : {}),
    };
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
