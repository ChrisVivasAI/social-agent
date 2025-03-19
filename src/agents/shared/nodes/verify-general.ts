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

const VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee.
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
    // Use a simpler approach without structured output first
    const model = getVertexChatModel("claude-3-5-sonnet-latest", 0);
    
    const response = await model
      .withConfig({
        runName: "check-general-relevancy-model",
      })
      .invoke([
        {
          role: "system",
          content: `${VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT}\n\nRespond in JSON format with the following structure:\n{\n  "reasoning": "your reasoning here",\n  "relevant": true or false\n}\n\nDo not include any other text outside the JSON.`,
        },
        {
          role: "user",
          content: content,
        },
      ]);
      
    // Parse JSON from the response content
    const responseText = response.content;
    if (typeof responseText !== 'string') {
      console.error("Unexpected response type from model");
      return false;
    }
    
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response:", responseText);
        return false;
      }
      
      const jsonResponse = JSON.parse(jsonMatch[0]);
      console.log("Parsed response:", jsonResponse);
      
      if (typeof jsonResponse.relevant === 'boolean') {
        return jsonResponse.relevant;
      } else {
        console.error("Invalid 'relevant' field in response:", jsonResponse);
        return false;
      }
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      console.error("Raw response:", responseText);
      return false;
    }
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
