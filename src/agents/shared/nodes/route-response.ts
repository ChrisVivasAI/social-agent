import { getVertexChatModel } from "../../../utils/vertex-model.js";
import { z } from "zod";

const ROUTE_RESPONSE_PROMPT = `You are an AI assistant tasked with routing a user's response to one of two possible routes based on their intention. The two possible routes are:

1. Rewrite post - The user's response indicates they want to rewrite the generated post.
2. Update scheduled date - The user wants to update the scheduled date for the post. This can either be a new date or a priority level (P1, P2, P3).

Here is the generated post:
<post>
{POST}
</post>

Here is the current date/priority level for scheduling the post:
<date-or-priority>
{DATE_OR_PRIORITY}
</date-or-priority>

Carefully analyze the user's response:
<user-response>
{USER_RESPONSE}
</user-response>

Based on the user's response, determine which of the two routes they intend to take. Consider the following:

1. If the user mentions editing, changing, or rewriting the content of the post, choose the "rewrite_post" route.
2. If the user mentions changing the date, time, or priority level of the post, choose the "update_date" route. Ensure you only call this if the user mentions a date, or one of P1, P2 or P3.

If the user's response can not be handled by one of the two routes, choose the "unknown_response" route.

Provide your answer in the following format:
<explanation>
[A brief explanation of why you chose this route based on the user's response]
</explanation>
(call the 'route' tool to choose the route)

Here are some examples of possible user responses and the corresponding routes:

Example 1:
User: "Can we change the wording in the second paragraph?"
Route: rewrite_post
Explanation: The user is requesting changes to the content of the post.

Example 2:
User: "Schedule this for next Tuesday."
Route: update_date
Explanation: The user wants to change the posting date.

Example 3:
User: "This should be a P1 priority."
Route: update_date
Explanation: The user wants to change the priority level of the post.

Example 4:
User: "This should be a P0 priority."
Route: unknown_response
Explanation: P0 is not a valid priority level.

Example 5:
User: "Hi! How are you?"
Route: unknown_response
Explanation: The user is engaging in general conversation, not a request to change the post.

Remember to always base your decision on the actual content of the user's response, not on these examples.`;

interface RouteResponseArgs {
  post: string;
  dateOrPriority: string;
  userResponse: string;
}

export async function routeResponse({
  post,
  dateOrPriority,
  userResponse,
}: RouteResponseArgs) {
  try {
    // Use a simpler approach without structured output
    const model = getVertexChatModel("claude-3-5-sonnet-latest", 0);
    
    const formattedPrompt = ROUTE_RESPONSE_PROMPT.replace("{POST}", post)
      .replace("{DATE_OR_PRIORITY}", dateOrPriority)
      .replace("{USER_RESPONSE}", userResponse);
    
    const systemPrompt = `${formattedPrompt}
    
    Respond in JSON format with the following structure:
    {
      "route": "rewrite_post" OR "update_date" OR "unknown_response"
    }
    
    Do not include any other text outside the JSON.`;

    const response = await model.invoke([
      {
        role: "user",
        content: systemPrompt,
      },
    ]);
    
    // Parse JSON from the response content
    const responseText = response.content;
    if (typeof responseText !== 'string') {
      console.error("Unexpected response type from model");
      return { route: "unknown_response" };
    }
    
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response:", responseText);
        return { route: "unknown_response" };
      }
      
      const result = JSON.parse(jsonMatch[0]);
      console.log("Parsed response:", result);
      
      if (result.route && ["rewrite_post", "update_date", "unknown_response"].includes(result.route)) {
        return { route: result.route };
      } else {
        console.error("Invalid route in response:", result);
        return { route: "unknown_response" };
      }
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      console.error("Raw response:", responseText);
      return { route: "unknown_response" };
    }
  } catch (error) {
    console.error("Error in routeResponse:", error);
    return { route: "unknown_response" };
  }
}
