import { ChatVertexAI } from "@langchain/google-vertexai-web";

// Models map from Claude to equivalent Vertex models
// Using correct Vertex AI model names
const MODEL_MAPPINGS: Record<string, string> = {
  "claude-3-5-sonnet-latest": "gemini-1.5-pro", // Use Gemini 1.5 Pro instead of 2.0
  "claude-3-opus-latest": "gemini-1.5-pro",
  "claude-3-5-sonnet-20240620": "gemini-1.5-pro",
  "claude-3-haiku-latest": "gemini-1.5-flash", // Using 1.5-flash for less complex tasks
};

/**
 * Get a Vertex AI chat model instance that's suitable as a replacement for Anthropic models
 * 
 * @param model The original Anthropic model name or a Vertex model name
 * @param temperature Temperature setting (0-1)
 * @returns A ChatVertexAI instance
 */
export function getVertexChatModel(model: string, temperature: number = 0) {
  // If the model is an Anthropic model, map it to the appropriate Vertex model
  const vertexModel = MODEL_MAPPINGS[model] || model;
  
  if (!process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
    throw new Error("GOOGLE_VERTEX_AI_WEB_CREDENTIALS is not set in environment variables");
  }

  return new ChatVertexAI({
    model: vertexModel,
    temperature,
  });
}

/**
 * Get the parsed Google Vertex AI credentials
 */
export function getVertexCredentials() {
  if (!process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
    throw new Error("GOOGLE_VERTEX_AI_WEB_CREDENTIALS is not set in environment variables");
  }
  
  return JSON.parse(process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS);
} 