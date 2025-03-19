# Google Vertex AI Migration

This guide explains how we've migrated from Anthropic Claude to Google Vertex AI models in the Social Media Agent project.

## Changes Made

1. Created a utility function in `src/utils/vertex-model.ts` to standardize Vertex AI model initialization
2. Updated key model usage in several core files:
   - `src/agents/generate-post/nodes/geterate-post/index.ts`
   - `src/agents/generate-post/nodes/rewrite-post.ts` 
   - `src/agents/generate-post/nodes/condense-post.ts`
3. Updated environment settings in `.env` to comment out Anthropic API keys
4. Created a conversion script at `scripts/convert-to-vertex.js` to help automate the migration

## Model Mapping

We've mapped Anthropic Claude models to equivalent Google Vertex AI models:

| Anthropic Model | Google Vertex AI Model |
|-----------------|------------------------|
| claude-3-5-sonnet-latest | gemini-2.0-pro |
| claude-3-opus-latest | gemini-2.0-pro |
| claude-3-5-sonnet-20240620 | gemini-2.0-pro |
| claude-3-haiku-latest | gemini-2.0-flash |

## Using the Migration Scripts

To complete the migration of any remaining files:

1. Run the conversion script:
   ```
   node scripts/convert-to-vertex.js
   ```

2. Restart the LangGraph server:
   ```
   yarn langgraph:in_mem:up
   ```

## Required Environment Variables

Make sure your `.env` file has the `GOOGLE_VERTEX_AI_WEB_CREDENTIALS` variable set with your Google Cloud service account credentials.

## Testing

After completing the migration, test the following features:
1. Generate a post: `yarn generate_post`
2. Verify that posts are generated correctly
3. Check LangSmith to ensure the models are correctly invoking Vertex AI

## Troubleshooting

If you encounter any issues:
1. Check the LangGraph server logs for errors
2. Verify your Google Cloud service account has the necessary permissions
3. Ensure you've updated all references to Anthropic models 