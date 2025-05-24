import {
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ingestDiscordMessages } from "./nodes/ingest-discord.js";
import { Client } from "@langchain/langgraph-sdk";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../generate-post/constants.js";
import { shouldPostToLinkedInOrg } from "../utils.js";
import {
  IngestRepurposedDataAnnotation,
  IngestRepurposedDataConfigurableAnnotation,
  IngestRepurposedDataState,
} from "./types.js";
import { extract } from "./extract.js";

async function generatePostsFromMessages(
  state: IngestRepurposedDataState,
  config: LangGraphRunnableConfig,
) {
  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  for await (const content of state.contents) {
    const thread = await client.threads.create();
    await client.runs.create(thread.thread_id, "repurposer", {
      input: {
        originalLink: content.originalLink,
        contextLinks: content.additionalContextLinks,
        quantity: content.quantity,
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        },
      },
    });
  }
  return {};
}

const builder = new StateGraph(
  IngestRepurposedDataAnnotation,
  IngestRepurposedDataConfigurableAnnotation,
)
  // Ingests posts from Discord channel.
  .addNode("ingestDiscordMessages", ingestDiscordMessages)
  // A node which extracts the links and other data from the discord messages
  .addNode("extract", extract)
  // Subgraph which is invoked once for each message.
  // This subgraph will verify content is relevant to
  // LangChain, generate a report on the content, and
  // finally generate and schedule the specified number of posts.
  .addNode("generatePostsGraph", generatePostsFromMessages)
  // Start node
  .addEdge(START, "ingestDiscordMessages")
  // After ingesting the messages, send them to the extract function to extract the links and other data
  .addEdge("ingestDiscordMessages", "extract")
  // After extracting the data, route to the subgraph for each message.
  .addEdge("extract", "generatePostsGraph")
  // Finish after kicking off the subgraph for each message.
  .addEdge("generatePostsGraph", END);

export const graph = builder.compile();

graph.name = "Ingest Repurposed Data Graph";
