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
const VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT = `You are a marketing employee at LangChain.
You're given a {file_type} from a GitHub repository and need to verify if the repository implements LangChain products.
You're doing this to ensure the content is relevant to LangChain, and can be used as marketing material.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

{repoDependenciesPrompt}

Given this context, examine the {file_type} and determine if the repository implements LangChain products.
Provide reasoning and a simple true or false for whether it implements LangChain.`;

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

    const model = getVertexChatModel("claude-3-5-sonnet-latest", 0);
    const dependencyFiles = await getDependencies(url);
    
    let dependenciesPrompt = "";
    if (dependencyFiles) {
      dependencyFiles.forEach((f) => {
        // Format it as a markdown code block with the file name as the header.
        dependenciesPrompt += `\`\`\`${f.fileName}\n${f.fileContents}\n\`\`\`\n`;
      });

      dependenciesPrompt = REPO_DEPENDENCY_PROMPT.replace(
        "{dependencyFiles}",
        dependenciesPrompt,
      );
    }
    
    const systemPrompt = `${VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT.replaceAll(
      "{file_type}",
      fileType,
    ).replaceAll("{repoDependenciesPrompt}", dependenciesPrompt)}
    
    Respond in JSON format with the following structure:
    {
      "reasoning": "your reasoning here",
      "relevant": true or false
    }
    
    Do not include any other text outside the JSON.`;

    try {
      const response = await model
        .withConfig({
          runName: "check-github-relevancy-model",
        })
        .invoke(
          [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: contents.substring(0, 12000), // Limit content size to avoid safety issues
            },
          ],
          config as RunnableConfig,
        );
        
      // Parse JSON from the response content
      const responseText = response.content;
      if (typeof responseText !== 'string') {
        console.error("Unexpected response type from model");
        return false;
      }
      
      try {
        // Try to parse the JSON response
        let jsonText = responseText;
        
        // Extract JSON from markdown code blocks if present
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonText = codeBlockMatch[1].trim();
        }
        
        const parsedResponse = JSON.parse(jsonText);
        // If we can't validate against our schema, consider it not relevant
        if (!parsedResponse.hasOwnProperty('relevant')) {
          console.error("Response missing 'relevant' property", parsedResponse);
          return false;
        }
        return Boolean(parsedResponse.relevant);
      } catch (parseError) {
        console.error("Failed to parse model response as JSON:", parseError);
        console.error("Raw response:", responseText);
        // In case of parsing error, assume not relevant
        return false;
      }
    } catch (modelError) {
      console.error("Error in verifyGitHubContentIsRelevant:", modelError);
      // For model errors (including safety errors), return false
      return false;
    }
  } catch (error) {
    console.error("Unexpected error in verifyGitHubContentIsRelevant:", error);
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
