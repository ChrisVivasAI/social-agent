import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import { getVertexChatModel } from "../../../utils/vertex-model.js";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { getVideoSummary } from "../youtube/video-summary.js";

type VerifyYouTubeContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
};

// Safer version of the verification prompt
const VERIFY_RELEVANT_CONTENT_PROMPT = `You are a marketing employee at Chris Vivas.
You're given a summary of a YouTube video. Determine if the content is relevant to AI-related products or technologies before approving it.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the summary and determine if the content is relevant to AI-related products or technologies.
Provide reasoning and a simple true or false for whether it's relevant.`;

async function verifyYouTubeContentIsRelevant(
  summary: string,
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
    const lowerSummary = summary.toLowerCase();
    const hasAIContent = aiKeywords.some(keyword => lowerSummary.includes(keyword.toLowerCase()));
    return hasAIContent;
  } catch (error) {
    console.error("Error in verifyYouTubeContentIsRelevant:", error);
    return false;
  }
}

/**
 * Verifies the content provided is relevant to your company's products.
 */
export async function verifyYouTubeContent(
  state: typeof VerifyContentAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<VerifyYouTubeContentReturn> {
  try {
    const { summary, thumbnail } = await getVideoSummary(state.link);
    const relevant = await verifyYouTubeContentIsRelevant(summary);

    if (relevant) {
      return {
        relevantLinks: [state.link],
        pageContents: [summary as string],
        ...(thumbnail ? { imageOptions: [thumbnail] } : {}),
      };
    }

    // Not relevant, return empty arrays so this URL is not included.
    return {
      relevantLinks: [],
      pageContents: [],
    };
  } catch (error) {
    console.error("Error in verifyYouTubeContent:", error);
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }
}
