export const EXAMPLES = [
  `🔍 AI Evaluation Toolkit

Just found this incredible framework for evaluating LLM responses with custom criteria.

It provides a standardized approach to measuring response quality and tracking model performance over time. I especially like how it lets you define your own rubrics for domain-specific evaluation.

Try it now: https://ai-toolkit.example.com`,
  `Claude 3.5 Sonnet's Reasoning Abilities

I've spent the weekend testing Claude 3.5 Sonnet on complex reasoning tasks, and the results are impressive.

Key strengths:
- Significantly improved multi-step reasoning
- Better handling of ambiguous instructions
- 73% reduction in hallucinations on my benchmark tests
- Excels at code generation with cleaner, more maintainable solutions

Check out my detailed analysis: https://chris-vivas-blog.example.com/claude-3-5-analysis`,
  `rStar-Math helps small language models rival or even surpass OpenAI o1 on math reasoning.

How do they achieve this?

rStar-Math uses a math policy SLM for test-time search guided by an SLM-based process reward model.

What's new in rStar-Math?

- a code-augmented CoT data synthesis method involving MCTS to generate step-by-step verified reasoning trajectories which is used to train the policy SLM

- an SLM-based process reward model that reliably predicts a reward label for each math reasoning step. This leads to a more effective process preference model (PPM).

- a self-evolution recipe where the policy SLM and PPM are iteratively evolved to improve math reasoning.

Putting it together:

They first curate a dataset of 747k math word problems from publicly available sources. In each round (for four rounds), they use the latest policy model and PPM to perform MCTS, generating increasingly high-quality training data to train a stronger policy model and PPM for the next round.

Results:

On the MATH benchmark, rStar-Math improves Qwen2.5-Math-7B from 58.8% to 90.0% and Phi3-mini-3.8B from 41.4% to 86.4%, surpassing o1-preview by +4.5% and +0.9%.

My thoughts:

The iterative self-evolution deep thinking process combined with small language models is an interesting development because there is not much evidence that these SLMs can generate high-quality and reliable training data. However, this work shows that SLMs with extensive MCTS rollouts can lead to the self-generation of high-quality training data for frontier-level math reasoning.`,
  `QLoRA is a quantized version of Low-Rank Adaptations

QLoRA reduces memory usage by 73% compared to a regular LoRA

Using QLoRA, you can fine-tune a 65B parameter model on a single 48GB GPU

This is a significant milestone for democratizing access to large language models.`,
  `Unnatural Instructions 🚀

A curated dataset of 240k hard instruction-response pairs meant to improve instruction-following ability and factual knowledge in language models.

The dataset is generated via prompting GPT-4 and human curation.

Evaluated on over 3,000 novel instructions across 8 existing benchmarks, models fine-tuned with this dataset outperform strong baselines.`,
  `Introducing VILA 🤖

VILA is a new vision-language model that supports dynamic image manipulation based on natural language instructions.

It achieves this by conditioning large language model responses on diffusion-based image features.

VILA combines vision and language understanding in a way that enables image manipulations that are helpful, harmless, and honest.`,
  `Retrieval-Augmented Generation, or RAG, enhances LLM responses with information fetched from external sources based on the user's question.

The basic RAG process:
1. When a question is asked, it's converted into a vector.
2. This vector is compared to vectors in a knowledge base to find relevant information.
3. The most relevant information is combined with the original question and sent to the LLM.
4. The LLM generates a response that incorporates this extra context.

This approach improves accuracy, reduces hallucinations, enables up-to-date information, and allows for domain specialization without full fine-tuning.

RAG in practice:
- Question: "What's the latest on quantum computing breakthroughs?"
- Create search vector from question
- Retrieve relevant documents from knowledge base
- Combine retrieved information with original question
- Generate response that includes recent quantum computing developments

https://www.pinecone.io/learn/retrieval-augmented-generation/`,
  `Introducing AutoGPT: Autonomous GPT-4 Agents 

This open-source application acts as an AI agent that can autonomously achieve goals

Features:
- Internet access for searches and information gathering
- Long-Term and Short-Term memory management
- Text generation capabilities
- Can use GPT-3.5 or GPT-4 for different functions
- File storage and summarization capabilities

Example use cases:
- Market research
- Content creation
- Data analysis
- Code development

https://github.com/Significant-Gravitas/Auto-GPT`,
  `"GPTs are apps that run on the GPT Store. When users talk to a GPT, they'll stay in that specific GPT until they choose to exit. This means a GPT acts as a system prompt that persists through your whole conversation. When you make a GPT, you can:

1. Set the name, description, and instructions that define the GPT
2. Let it browse the web, run code, generate images with DALL·E, analyze data files, and more
3. Add custom actions that integrate with APIs (yours or others via auth)
4. Add knowledge files like CSVs, text, PDFs, and more

Building GPTs is free, and you can share them publicly with a few clicks."`,
  `Meta Llama 3 400B is Meta's new high-end foundation model with a parametric knowledge cutoff of March 2023

Features of Meta Llama 3 400B:
- New mixed expert architecture
- 128K token context window
- Strong mathematical reasoning abilities
- Benchmarks show it is between Gemini 1.5 Pro and GPT-4.
- Performs 90th-percentile in grad-level math (vs 75th for Llama 3 70B)
- Available in three sizes: 8B, 70B, 400B

Along with Llama 3 400B, Meta has also introduced "Meta AI Tools" (like assistants API), "Meta AI Search", and "Super Resolution"`,
];
