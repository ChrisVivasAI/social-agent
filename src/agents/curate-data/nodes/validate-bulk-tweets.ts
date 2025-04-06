import { getVertexChatModel } from "../../../utils/vertex-model.js";
import { CurateDataState } from "../state.js";
import { z } from "zod";
import { chunkArray } from "../../utils.js";
import { TweetV2 } from "twitter-api-v2";

const EXAMPLES = `<example index="0">
    <example-tweet>
      RT @arjunkhemani: .@naval: Looking for truth is the opposite of looking for social approval.\n\n"I'm deeply suspicious of groups of people co…
    </example-tweet>

    <scratchpad>
      This tweet is not relevant because it has no mentions of AI, or valuable content for learning.
    </scratchpad>
    is_relevant: false
  </example>

  <example index="0">
    <example-tweet>
      Blog post for Transformer²: Self-Adaptive LLMs\n\nhttps://t.co/AyeFdqEKsd\n\nEventually, neural network weights should be as adaptive as the Octopus 🐙\nhttps://t.co/me7urXJ6BS
    </example-tweet>

    <scratchpad>
      This tweet is relevant because it is about AI, and contains links to blog posts which are most likely about AI.
    </scratchpad>
    is_relevant: true
  </example>

  <example index="0">
    <example-tweet>
      @karpathy @martin_casado Sir, how do I convince my talented ex-big tech SDE peers to use LLMs more for coding\n\nalmost all of them cite privacy/security concerns or hallucinations
    </example-tweet>

    <scratchpad>
      This tweet is not relevant because it does not have enough AI content for learning, but rather it's presenting a question about AI.
    </scratchpad>
    is_relevant: false
  </example>

  <example index="0">
    <example-tweet>
      Aligning Instruction Tuning with Pre-training\n\nDetermines differences between pretraining corpus and SFT corpus and generates instruction data for the difference set. Evaluations on three fully\nopen LLMs across eight benchmarks demonstrate\nconsistent performance improvements. https://t.co/1jJxiv5q2T
    </example-tweet>

    <scratchpad>
      This tweet is relevant because it appears to be referencing a research paper on AI.
    </scratchpad>
    is_relevant: true
  </example>

  <example index="0">
    <example-tweet>
      Btw, your docs are likely AI generated, GAIA is not about environmental and sustainability at all 🤣
    </example-tweet>

    <scratchpad>
      This tweet is not relevant. Although it does mention AI, the tweet itself has no content for learning, or writing educational AI content. Instead it's dissing someone's (alleged) poor documentation.
    </scratchpad>
    is_relevant: false
  </example>

  <example index="0">
    <example-tweet>
      Prompt Engineers at Work 🍰👷🎨\n\nExclusive merch only available for the PromptLayer team... but good news is that we are hiring! https://t.co/X9aJO95RQp
    </example-tweet>

    <scratchpad>
      This tweet is not relevant because it is promoting a non-software product.
    </scratchpad>
    is_relevant: false
  </example>`;

const VALIDATE_BULK_TWEETS_PROMPT = `You are curating content for Chris Vivas, an AI engineer who shares valuable insights about AI news, tools, innovations, and technical AI strategies. Your job is to review tweets and identify those that align with Chris's focus areas and would provide value to his audience.

Here are the criteria for determining whether a tweet is relevant:

1. The tweet discusses practical AI tools, frameworks, or applications that solve real-world problems
2. The tweet shares technical AI strategies, implementation techniques, or best practices
3. The tweet mentions significant AI research breakthroughs with practical implications
4. The tweet provides insights about LLM developments, fine-tuning techniques, or prompt engineering
5. The tweet explores AI engineering topics like architecture patterns, deployment, or MLOps
6. The tweet covers multimodal AI innovations combining text, vision, audio, or other modalities
7. The tweet addresses autonomous agent frameworks, tools, or novel agent applications
8. The tweet discusses responsible AI practices, ethics, or bias mitigation strategies
9. The tweet showcases interesting open-source AI projects developers can use or contribute to
10. The tweet shares techniques for optimizing AI systems for performance, cost, or efficiency

Additionally, ensure that the tweet has sufficient depth and substance to generate meaningful content. The tweets should contain information that Chris's audience of AI practitioners, engineers, and enthusiasts would find valuable and applicable to their work.

Prioritize tweets that:
- Contain technical depth rather than just surface-level announcements
- Provide practical insights that can be applied by AI engineers
- Showcase innovations that advance the state of AI implementation
- Share specific methodologies or approaches rather than vague concepts

You will be provided with a list of tweets, each associated with an index number. Your task is to analyze these tweets and identify which ones are relevant according to the criteria above.

Use the following examples to guide your analysis:
<analysis-examples>
${EXAMPLES}
</analysis-examples>

Here are the tweets to analyze:
<tweets>
{TWEETS}
</tweets>

Use a scratchpad to analyze each tweet independently. In your scratchpad, briefly explain why each tweet is relevant or not relevant based on the criteria provided. Then, create a list of the index numbers for the relevant tweets.
Remember, we only want high-quality tweets that align with Chris's focus on practical AI engineering, tools, innovations, and technical strategies.

<scratchpad>
[Analyze each tweet here, explaining your reasoning]
</scratchpad>

After your analysis, provide your final answer to the 'answer' tool.
Remember, there will be times when all of the tweets are NOT relevant. In this case, do not be worried and simply answer with an empty array.
I won't be upset with you if you don't find any relevant tweets, however I WILL be upset if you mark tweets as relevant which do NOT align with Chris's focus areas.

Begin!`;

const answerSchema = z
  .object({
    answer: z
      .array(z.number())
      .describe("The index numbers of the relevant tweets."),
  })
  .describe("Your final answer to what tweets are relevant.");

function formatTweets(tweets: TweetV2[]): string {
  return tweets
    .map((t, index) => {
      return `  <tweet index="${index}">
    ${t.text}
  </tweet>`;
    })
    .join("\n\n");
}

/**
 * Validates a batch of tweets to determine which ones are relevant to AI-related topics.
 * This function processes tweets in chunks of 25 and uses Claude 3 Sonnet to analyze each tweet
 * against a set of predefined relevance criteria.
 *
 * The relevance criteria includes:
 * - Discussions about AI, LLMs, or AI-related topics
 * - Retweets of AI-related content
 * - Mentions of AI research papers
 * - Information about AI products, tools, or services
 * - References to AI-related blog posts, videos, or other content
 *
 * @param {CurateDataState} state - The current state containing tweets to be validated
 * @returns {Promise<Partial<CurateDataState>>} A promise that resolves to an updated state
 *                                                 containing only the relevant tweets
 */
export async function validateBulkTweets(
  state: CurateDataState,
): Promise<Partial<CurateDataState>> {
  // If we have no tweets, there's nothing to filter.
  if (!state.rawTweets?.length) {
    return {
      validatedTweets: [],
    };
  }

  // This is pretty dumb, but we need to chunk our tweets because we can only
  // process so many at a time. We will process 20 at a time.
  const tweetChunks = chunkArray(state.rawTweets, 20);
  const relevantTweets: TweetV2[] = [];

  for (const [idx, tweetChunk] of tweetChunks.entries()) {
    console.log(`Processing chunk ${idx + 1} of ${tweetChunks.length}`);

    // Format the tweets into a string for the model
    const formattedTweets = formatTweets(tweetChunk);

    // Get the relevance of the tweets
    const prompt = VALIDATE_BULK_TWEETS_PROMPT.replace(
      "{TWEETS}",
      formattedTweets,
    );

    const model = getVertexChatModel(
      "claude-3-5-sonnet-latest",
      0,
    ).withStructuredOutput(answerSchema);

    const resp = await model.invoke([
      {
        role: "system",
        content: prompt,
      },
    ]);

    // Now we just need to extract the relevant tweets
    // The model returned a list of indices
    const relevantIndices = resp.answer;
    // We need to map those indices to the actual tweets
    for (const idx of relevantIndices) {
      relevantTweets.push(tweetChunk[idx]);
    }
  }

  return {
    validatedTweets: relevantTweets,
  };
}
