import { LANGCHAIN_DOMAINS } from "../../should-exclude.js";

export const BUSINESS_CONTEXT = `
Here's the tech stack I'm building with and hyped about:
<business-context>
- **AI Engineering** - Building and shipping real AI systems that solve actual problems. No vaporware, just working code.
- **LangGraph** - Open source framework for building AI agents that actually do something useful. Think autonomous systems that ship.
- **Vector Search & RAG** - Because your AI should have a memory better than mine after a Miami night out.
- **MLOps & Deployment** - Getting models from notebook to production without breaking everything.
</business-context>`;

export const CONTENT_VALIDATION_PROMPT = `We're generating posts that make AI engineering hit different.
Here's what makes content worth the timeline space:
<validation-rules>
- Content must show something new in AI/ML that actually works
- NO "help me fix this error" posts or basic tutorials
- YES to content showing real implementation details
- YES to AI tools/frameworks that solve real problems
- Must include code, deployments, or concrete technical details
- Skip the pure marketing fluff - we want the technical meat
- If it's using AI to build something useful, we're interested
- Content should be fresh - AI moves fast, old news is old news
</validation-rules>`;

export const TWEET_EXAMPLES = `<example index="1">
This API just went multimodal 🎙️

Podcastfy.ai dropping an open-source alternative to NotebookLM's podcast game. 

Multilingual audio convos from any content, powered by that good AI. Check the repo: https://podcastfy.ai
</example>

<example index="2">
BREAKING: Waii just made SQL joins tap out 🥊

This toolkit is throwing hands with complex database queries:
- Text-to-SQL that actually works
- Charts that don't make your eyes hurt
- All running through LangGraph like butter

See it live: https://waii.com
</example>

<example index="3">
Just caught this agent automating my entire workflow 🌴

@DendriteSystems showing us how to build agents that browse like a human:
- Scouting Product Hunt & HN for competition
- Drafting emails that don't sound like a bot
- Sliding into Outlook like a pro

Watch the magic:
📺 https://youtube.com/watch?v=BGvqeRB4Jpk
🧠 https://github.com/dendrite-systems/dendrite-examples
</example>

<example index="4">
RepoGPT just entered the chat 🚀

Your GitHub repos just got an AI wingman that actually helps:
- Natural language repo exploration
- Doc generation that makes sense
- Code suggestions that don't make senior devs cry

Try it: https://repogpt.com
</example>

<example index="5">
This AI Travel Agent is working harder than my last startup 🌴

Most comprehensive LangGraph agent I've seen in the wild:
- Stateful convos that remember your travel style
- Human-in-the-loop when things get spicy
- Smart LLM switching
- Email game stronger than my morning coffee

Repo's open for business: https://github.com/nirbar1985/ai-travel-agent
</example>`;

export const POST_STRUCTURE_INSTRUCTIONS = `Your post needs these three parts to hit different:
<structure-instructions>

<section key="1">
Hook them fast - 5 words max, maybe an emoji or two if you're feeling it. Time stamps are your friend ("It's 3AM and..."). Make it punch.
</section>

<section key="2">
Drop the knowledge. What's the tech do? How's it solve problems? Keep it real, keep it technical, but make it make sense. 
If it's complex, bullet points are your friend - but keep them sharp.
Remember: Focus on what the tech does, not just the hype.
</section>

<section key="3">
Close with a call to action that makes them want to click. Keep it short, maybe throw an emoji, and always drop that link.
</section>

</structure-instructions>`;

export const POST_CONTENT_RULES = `- Keep it technical but make it hit like a Miami beat
- Focus on what the tech actually does and why anyone should care
- If you're posting about our own stuff (${LANGCHAIN_DOMAINS.map((domain) => `"${domain}"`).join(", ")}), own it with "we" and "our"
- Keep the energy high but the fluff low
- Emojis: header and call-to-action only, make them count
- NO hashtags - we're not that kind of account
- Present tense keeps it fresh ("just shipped" > "shipped")
- Links belong in the call to action - make them want to click
- Keep it shorter than a South Beach attention span`;
