import { Client } from "@langchain/langgraph-sdk";

/**
 * Gets a LangGraph client instance connected to the local or remote LangGraph server.
 * @returns A Promise that resolves to a LangGraph client instance
 */
export async function getGraph(): Promise<any> {
  // Initialize the LangGraph client
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  // Use type casting to avoid typescript errors with the LangGraph SDK
  return client as any;
} 