import { z } from "zod";
import { GenerateThreadState } from "../state.js";
import { getVertexChatModel } from "../../../utils/vertex-model.js";
import {
  getThreadReflections,
  THREAD_REFLECTIONS_PROMPT,
  THREAD_RULESET_KEY,
} from "../../../utils/reflections.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const REWRITE_THREAD_PROMPT = `<context>
You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for your LinkedIn and Twitter pages.
You wrote a thread for your LinkedIn and Twitter pages, however your boss has asked for some changes to be made before it can be published.
You're also be provided with the original plan for the thread which you wrote.
Use this plan to guide your decisions, however ensure you weigh the user's requests above the plan if they contradict each other.
</context>

<original-thread>
{originalThread}
</original-thread>

{reflectionsPrompt}

<original-thread-plan>
{originalThreadPlan}
</original-thread-plan>

<instructions>
Listen to your boss closely, and make the necessary changes to the thread.
Ensure you keep the reflections above in mind when making the changes.
You should ONLY update the posts which the user has requested to be updated.
If it is not clear which posts should be updated, you should do your best to determine which posts they intend to update.
You should respond with ALL of the posts, including updated and unchanged posts.

Your response must be valid JSON with the following format:
{
  "threadPosts": [
    {
      "index": number,
      "text": "post content"
    },
    ...
  ]
}
</instructions>`;

const schema = z
  .object({
    threadPosts: z
      .array(
        z.object({
          index: z.number().describe("The index of the post in the thread."),
          text: z
            .string()
            .describe("The text content of the individual post in the thread."),
        }),
      )
      .describe("The list of updated thread posts."),
  })
  .describe("The updated thread posts.");

export async function rewriteThread(
  state: GenerateThreadState,
  config: LangGraphRunnableConfig,
): Promise<Partial<GenerateThreadState>> {
  if (!state.threadPosts?.length) {
    throw new Error("No thread found. Can not rewrite thread without posts.");
  }
  if (!state.userResponse) {
    throw new Error(
      "No user response found. Can not rewrite thread without a response.",
    );
  }

  const rewriteThreadModel = getVertexChatModel("claude-3-5-sonnet-latest", 0);

  const threadReflections = await getThreadReflections(config);
  let threadReflectionsPrompt = "";
  if (
    threadReflections?.value?.[THREAD_RULESET_KEY]?.length &&
    Array.isArray(threadReflections?.value?.[THREAD_RULESET_KEY])
  ) {
    const rulesetString = `- ${threadReflections.value[THREAD_RULESET_KEY].join("\n- ")}`;
    threadReflectionsPrompt = THREAD_REFLECTIONS_PROMPT.replace(
      "{reflections}",
      rulesetString,
    );
  }

  const formattedSystemPrompt = REWRITE_THREAD_PROMPT.replace(
    "{originalThread}",
    state.threadPosts
      .map((p) => `<post index="${p.index}">\n${p.text}\n</post>`)
      .join("\n"),
  )
    .replace("{originalThreadPlan}", state.threadPlan)
    .replace("{reflectionsPrompt}", threadReflectionsPrompt);

  try {
    const response = await rewriteThreadModel.invoke([
      {
        role: "system",
        content: formattedSystemPrompt,
      },
      {
        role: "user",
        content: state.userResponse,
      },
    ]);

    // Parse JSON from response
    const responseText = response.content;
    if (typeof responseText !== 'string') {
      throw new Error("Unexpected response type from model");
    }

    // Extract JSON from markdown code blocks if present
    let jsonText = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonText = codeBlockMatch[1].trim();
    }

    // Parse the response
    const parsedResponse = JSON.parse(jsonText);
    
    // Validate response has threadPosts
    if (!parsedResponse.threadPosts || !Array.isArray(parsedResponse.threadPosts)) {
      throw new Error("Invalid response format: missing threadPosts array");
    }

    return {
      threadPosts: parsedResponse.threadPosts,
      next: undefined,
      userResponse: undefined,
    };
  } catch (error) {
    console.error("Error in rewriteThread:", error);
    throw error;
  }
}
