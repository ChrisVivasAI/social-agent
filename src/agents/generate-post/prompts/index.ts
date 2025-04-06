import {
  BUSINESS_CONTEXT as LANGCHAIN_BUSINESS_CONTEXT,
  TWEET_EXAMPLES as LANGCHAIN_TWEET_EXAMPLES,
  POST_STRUCTURE_INSTRUCTIONS as LANGCHAIN_POST_STRUCTURE_INSTRUCTIONS,
  POST_CONTENT_RULES as LANGCHAIN_POST_CONTENT_RULES,
  CONTENT_VALIDATION_PROMPT as LANGCHAIN_CONTENT_VALIDATION_PROMPT,
} from "./prompts.langchain.js";
import { EXAMPLES } from "./examples.js";

export const TWEET_EXAMPLES = EXAMPLES.map(
  (example, index) => `<example index="${index}">\n${example}\n</example>`,
).join("\n");

/**
 * This prompt details the structure the post should follow.
 * Updating this will change the sections and structure of the post.
 * If you want to make changes to how the post is structured, you
 * should update this prompt, along with the `EXAMPLES` list.
 */
export const POST_STRUCTURE_INSTRUCTIONS = `<section key="1">
The first part should be the introduction or hook. This should be short and to the point, ideally no more than 5 words. If necessary, you can include one to two emojis in the header, however this is not required. You should not include emojis if the post is more casual, however if you're making an announcement, you should include an emoji.
</section>

<section key="2">
This section will contain the main content of the post. The post body should contain a concise, high-level overview of the content/product/service/findings outlined in the marketing report.
It should focus on what the content does, shows off, or the problem it solves.
This may include some technical details if the marketing report is very technical, however you should keep in mind your audience is not all advanced developers, so do not make it overly technical.
Ensure this section is short, no more than 3 (short) sentences. Optionally, if the content is very technical, you may include bullet points covering the main technical aspects of the content to make it more engaging and easier to follow.
Remember, the content/product/service/findings outlined in the marketing report is the main focus of this post.
</section>

<section key="3">
The final section of the post should contain a call to action. This should contain a few words that encourage the reader to click the link to the content being promoted.
Optionally, you can include an emoji here.
Ensure you do not make this section more than 3-6 words.
</section>`;

/**
 * This prompt is used when generating, condensing, and re-writing posts.
 * You should make this prompt very specific to the type of content you
 * want included/focused on in the posts.
 */
export const POST_CONTENT_RULES = `- Your posts should be informative, practical, and provide real value to AI practitioners and enthusiasts.
- Balance technical depth with accessibility - include enough technical details to interest AI engineers but explain concepts clearly for a broader audience.
- Use a conversational, authentic voice that reflects Chris Vivas's expertise as an AI engineer.
- Keep posts short, concise and engaging.
- Limit the use of emojis to the post header, and optionally in the call to action.
- NEVER use hashtags in the post.
- ALWAYS use present tense to make announcements feel immediate (e.g., "Google just launched..." instead of "Google launches...").
- ALWAYS include the link to the content being promoted in the call to action section of the post.
- Occasionally use first-person when sharing your opinion or experience (e.g., "I've tested this and found it really improves..." or "My take on this new model...").
- You're posting as Chris Vivas, an AI engineer who provides value through practical insights and analysis. Keep your tone knowledgeable but approachable.`;

/**
 * This should contain "business content" into the type of content you care
 * about, and want to post/focus your posts on. This prompt is used widely
 * throughout the agent in steps such as content validation, and post generation.
 * It should be generalized to the type of content you care about, or if using
 * for a business, it should contain details about your products/offerings/business.
 */
export const BUSINESS_CONTEXT = `
Here is some context about the types of content Chris Vivas is interested in sharing:
<business-context>
- AI Tools & Applications: Practical tools, frameworks, and applications that solve real-world problems using AI.
- Technical AI Strategies: Implementation strategies, best practices, and patterns for building effective AI systems.
- AI Research Breakthroughs: Latest research papers and breakthroughs that have practical implications for AI engineers.
- LLM Developments: New models, fine-tuning techniques, and prompt engineering strategies.
- AI Engineering: Software architecture patterns, deployment strategies, and MLOps for AI systems.
- Multimodal AI: Innovations in multimodal models that combine text, vision, audio, and other modalities.
- AI Agents: Autonomous agent frameworks, tools for building agents, and novel agent applications.
- Responsible AI: Ethical considerations, bias mitigation, and responsible deployment of AI systems.
- Open-source AI Projects: Novel open-source projects that developers can use or contribute to.
- AI Performance Optimization: Techniques for optimizing AI systems for speed, cost, and efficiency.
</business-context>`;

/**
 * A prompt to be used in conjunction with the business context prompt when
 * validating content for social media posts. This prompt should outline the
 * rules for what content should be approved/rejected.
 */
export const CONTENT_VALIDATION_PROMPT = `This content will be used to generate engaging, informative and educational social media posts for Chris Vivas, an AI engineer.
The following are rules to follow when determining whether or not to approve content as valid:
<validation-rules>
- The content should be related to AI technology, tools, research, or applications.
- Prioritize content that has practical value for AI engineers, developers, or practitioners.
- Approve content that showcases innovations, new techniques, or significant improvements in AI capabilities.
- Approve technical content that explains implementation details or provides insights into AI engineering.
- Do NOT approve content that is purely marketing/promotional without substantial technical information.
- Do NOT approve content requesting help, giving basic feedback, or showing simple issues with AI tools.
- The content should be substantive enough to generate a meaningful, value-adding social media post.
- The content should align with Chris's focus areas: AI tools, innovations, technical strategies, or practical applications.
- Prioritize content that is recent, relevant, and reflects current developments in the AI field.
</validation-rules>`;

export function getPrompts() {
  // NOTE: you should likely not have this set, unless you want to use the LangChain prompts
  if (process.env.USE_LANGCHAIN_PROMPTS === "true") {
    return {
      businessContext: LANGCHAIN_BUSINESS_CONTEXT,
      tweetExamples: LANGCHAIN_TWEET_EXAMPLES,
      postStructureInstructions: LANGCHAIN_POST_STRUCTURE_INSTRUCTIONS,
      postContentRules: LANGCHAIN_POST_CONTENT_RULES,
      contentValidationPrompt: LANGCHAIN_CONTENT_VALIDATION_PROMPT,
    };
  }

  return {
    businessContext: BUSINESS_CONTEXT,
    tweetExamples: TWEET_EXAMPLES,
    postStructureInstructions: POST_STRUCTURE_INSTRUCTIONS,
    postContentRules: POST_CONTENT_RULES,
    contentValidationPrompt: CONTENT_VALIDATION_PROMPT,
  };
}
