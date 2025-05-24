# Detailed Feature List

This README contains a list of small features/logic flows which play a small, yet significate role in how the agents in the Social Media Agent work.

Each feature is nested under the graph it belongs to. If it does not belong to a graph, it will be under the [**Shared**](#shared) section.

## Main Key

- [**Generate Post**](#generate-post)
- [**Shared**](#shared)

## Generate Post

### Key

- [Stored URLs](#stored-urls)

### Stored URLs

Once a run reaches the `humanNode`, all of the URLs inside the `relevantLinks` and `links` state fields will be stored in the LangGraph store. This is then referenced after the `verifyLinksSubGraph` executes, to see if any of the URLs (`relevantLinks` and `links`) have already been used in previous posts.

If _any_ of the URLs exist in the store, it will route the graph to the `END` node, and not generate a post.

This is implemented to ensure duplicated content is not generated.

## Shared

### Key

- [Exclude URLs](#exclude-urls)

### Exclude URLs

Inside each of the verify links subgraphs (`verify-general`, `verify-github`, `verify-youtube`, `verify-tweet`) there is a check (typically named `shouldExclude<type>Content`) which checks if the URL which was passed should be excluded, and thus, a post should _not_ be generated.

Each of these util functions can be found inside the [`should-exclude.ts`](src/agents/should-exclude.ts) file.

They will first check if the `USE_LANGCHAIN_PROMPTS` env variable is set to `true`. If it is not, then they will return `false` and the graph will continue as normal. If it is set to `true`, it will then check the URL against a list/single string to see if it should be excluded. This is because the exclusion logic for these functions is specific to LangChain, and we do not want it running (by default) for non-LangChain users.

If the input matches the exclusion string(s), it will return `true` to not generate a post for that URL.
