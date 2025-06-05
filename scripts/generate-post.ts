import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import { TEXT_ONLY_MODE, POST_TO_INSTAGRAM, POST_TO_FACEBOOK } from "../src/agents/generate-post/constants.js";

/**
 * Generate a post based on a LangChain blog post.
 * This may be modified to generate posts for other content.
 */
async function invokeGraph() {
  const link = "https://youtu.be/BUvR7t9Fip0?si=F8D4QSVvcn4rXOZH";

  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  const { thread_id } = await client.threads.create();
  await client.runs.create(thread_id, "generate_post", {
    input: {
      links: [link],
    },
    config: {
      configurable: {
        // By default, the graph will read these values from the environment
        // [TWITTER_USER_ID]: process.env.TWITTER_USER_ID,
        // [LINKEDIN_USER_ID]: process.env.LINKEDIN_USER_ID,
        // This ensures the graph runs in a basic text only mode.
        // If you followed the full setup instructions, you may remove this line.
        [TEXT_ONLY_MODE]: false,
        // Enable Instagram posting (requires INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID)
        [POST_TO_INSTAGRAM]: true,
        // Enable Facebook posting (requires FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID)
        [POST_TO_FACEBOOK]: true,
      },
    },
  });
}

invokeGraph().catch(console.error);
