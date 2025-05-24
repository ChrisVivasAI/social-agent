import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getVertexChatModel } from "../../../utils/vertex-model.js";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  getRepoContents,
  getFileContents,
  getOwnerRepoFromUrl,
} from "../../../utils/github-repo-contents.js";
import { Octokit } from "@octokit/rest";
import { shouldExcludeGitHubContent } from "../../should-exclude.js";

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  const octokit = new Octokit({
    auth: token,
  });

  return octokit;
}

type VerifyGitHubContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
};

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the content from the GitHub repository is or isn't relevant to your company's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the content from the GitHub repository is relevant to your company's products.",
      ),
  })
  .describe("The relevancy of the content to your company's products.");

const REPO_DEPENDENCY_PROMPT = `Here are the dependencies of the repository. You should use the dependencies listed to determine if the repository is relevant.
<repository-dependency-files>
{dependencyFiles}
</repository-dependency-files>`;

// Safer version of the verification prompt for GitHub content
const VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT = `You are a marketing employee at Chris Vivas.
You're given a {file_type} from a GitHub repository and need to verify if the repository implements AI-related products or technologies.
You're doing this to ensure the content is relevant to Chris Vivas's brand and can be used as marketing material.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

{repoDependenciesPrompt}

Given this context, examine the {file_type} and determine if the repository implements AI-related products or technologies.
Provide reasoning and a simple true or false for whether it implements AI.`;

const getDependencies = async (
  githubUrl: string,
): Promise<Array<{ fileContents: string; fileName: string }> | undefined> => {
  const octokit = getOctokit();

  const { owner, repo } = getOwnerRepoFromUrl(githubUrl);

  const dependenciesCodeFileQuery = `filename:package.json OR filename:requirements.txt OR filename:pyproject.toml`;
  const dependenciesCodeFiles = await octokit.search.code({
    q: `${dependenciesCodeFileQuery} repo:${owner}/${repo}`,
    limit: 5,
  });
  if (dependenciesCodeFiles.data.total_count === 0) {
    return undefined;
  }

  const fileContents = (
    await Promise.all(
      dependenciesCodeFiles.data.items.flatMap(async (item) => {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: item.path,
        });

        if (!("content" in data)) {
          return undefined;
        }

        return {
          fileName: item.name,
          fileContents: Buffer.from(data.content, "base64").toString("utf-8"),
        };
      }),
    )
  ).filter((file) => file !== undefined) as Array<{
    fileName: string;
    fileContents: string;
  }>;

  return fileContents;
};

export async function getGitHubContentsAndTypeFromUrl(url: string): Promise<
  | {
      contents: string;
      fileType: string;
    }
  | undefined
> {
  const repoContents = await getRepoContents(url);
  const readmePath = repoContents.find(
    (c) =>
      c.name.toLowerCase() === "readme.md" || c.name.toLowerCase() === "readme",
  )?.path;
  if (!readmePath) {
    return undefined;
  }
  const readmeContents = await getFileContents(url, readmePath);
  return {
    contents: readmeContents.content,
    fileType: "README file",
  };
}

interface VerifyGitHubContentParams {
  contents: string;
  fileType: string;
  dependencyFiles:
    | Array<{ fileContents: string; fileName: string }>
    | undefined;
  config: LangGraphRunnableConfig;
}

export async function verifyGitHubContentIsRelevant(
  url: string,
  contents: string,
  fileType: string,
  config: LangGraphRunnableConfig,
): Promise<boolean> {
  try {
    if (shouldExcludeGitHubContent(url)) {
      return false;
    }

    // Simple check for AI-related content
    const aiKeywords = [
      "machine learning",
      "artificial intelligence",
      "deep learning",
      "neural network",
      "ai",
      "ml",
      "nlp",
      "natural language processing",
      "computer vision",
      "tensorflow",
      "pytorch",
      "keras",
      "scikit-learn",
      "hugging face",
      "transformers",
      "langchain",
      "llm",
      "large language model"
    ];

    const lowerContents = contents.toLowerCase();
    const hasAIContent = aiKeywords.some(keyword => lowerContents.includes(keyword.toLowerCase()));
    
    if (!hasAIContent) {
      return false;
    }

    const dependencyFiles = await getDependencies(url);
    let hasAIDependencies = false;
    
    if (dependencyFiles) {
      const aiPackages = [
        "tensorflow",
        "torch",
        "keras",
        "scikit-learn",
        "transformers",
        "langchain",
        "openai",
        "anthropic",
        "huggingface",
        "numpy",
        "pandas",
        "spacy"
      ];
      
      hasAIDependencies = dependencyFiles.some(file => {
        const content = file.fileContents.toLowerCase();
        return aiPackages.some(pkg => content.includes(pkg.toLowerCase()));
      });
    }

    return hasAIContent || hasAIDependencies;
  } catch (error) {
    console.error("Error in verifyGitHubContentIsRelevant:", error);
    return false;
  }
}

/**
 * Verifies the content provided is relevant to LangChain products.
 */
export async function verifyGitHubContent(
  state: typeof VerifyContentAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<VerifyGitHubContentReturn> {
  const shouldExclude = shouldExcludeGitHubContent(state.link);
  if (shouldExclude) {
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }

  const contentsAndType = await getGitHubContentsAndTypeFromUrl(state.link);
  if (!contentsAndType) {
    console.warn("No contents found for GitHub URL", state.link);
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }

  const relevant = await verifyGitHubContentIsRelevant(
    state.link,
    contentsAndType.contents,
    contentsAndType.fileType,
    config,
  );
  if (relevant) {
    return {
      relevantLinks: [state.link],
      pageContents: [contentsAndType.contents],
    };
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
