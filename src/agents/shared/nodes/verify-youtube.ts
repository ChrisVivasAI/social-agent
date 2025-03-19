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
const VERIFY_RELEVANT_CONTENT_PROMPT = `You are a marketing employee at LangChain.
You're given a summary of a YouTube video. Determine if the content is relevant to LangChain products before approving it.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the summary and determine if the content is relevant to LangChain products.
Provide reasoning and a simple true or false for whether it's relevant.`;

async function verifyYouTubeContentIsRelevant(
  summary: string,
): Promise<boolean> {
  try {
    const model = getVertexChatModel("claude-3-5-sonnet-latest", 0);
    
    try {
      const response = await model
        .withConfig({
          runName: "check-video-relevancy-model",
        })
        .invoke([
          {
            role: "system",
            content: `${VERIFY_RELEVANT_CONTENT_PROMPT}\n\nRespond in JSON format with the following structure:\n{\n  "reasoning": "your reasoning here",\n  "relevant": true or false\n}\n\nDo not include any other text outside the JSON.`,
          },
          {
            role: "user",
            content: summary.substring(0, 12000), // Limit content size to avoid safety issues
          },
        ]);
        
      // Parse JSON from the response content
      const responseText = response.content;
      if (typeof responseText !== 'string') {
        console.error("Unexpected response type from model");
        return false;
      }
      
      try {
        // Try to parse the JSON response
        let jsonText = responseText;
        
        // Extract JSON from markdown code blocks if present
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonText = codeBlockMatch[1].trim();
        }
        
        const parsedResponse = JSON.parse(jsonText);
        
        // If we can't validate against our schema, consider it not relevant
        if (!parsedResponse.hasOwnProperty('relevant')) {
          console.error("Response missing 'relevant' property", parsedResponse);
          return false;
        }
        return Boolean(parsedResponse.relevant);
      } catch (parseError) {
        console.error("Failed to parse model response as JSON:", parseError);
        console.error("Raw response:", responseText);
        // In case of parsing error, assume not relevant
        return false;
      }
    } catch (modelError) {
      console.error("Error in model invocation:", modelError);
      // For model errors (including safety errors), return false
      return false;
    }
  } catch (error) {
    console.error("Unexpected error in verifyYouTubeContentIsRelevant:", error);
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
