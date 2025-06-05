import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import { TEXT_ONLY_MODE, POST_TO_INSTAGRAM, POST_TO_FACEBOOK } from "../src/agents/generate-post/constants.js";

/**
 * Debug the generate-post workflow to see the response structure
 */
async function debugGeneratePost() {
  console.log('🧪 Debugging Generate Post Workflow...\n');

  const url = "https://youtu.be/WRJZT0DTGjY?si=PI0B0zpKvj4rKtPT";

  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  try {
    console.log('🔗 Creating thread...');
    const thread = await client.threads.create();
    console.log(`✅ Thread created: ${thread.thread_id}`);

    console.log('🚀 Starting generate-post workflow...');
    const run = await client.runs.create(thread.thread_id, "generate_post", {
      input: {
        links: [url],
      },
      config: {
        configurable: {
          platform: 'discord',
          [TEXT_ONLY_MODE]: false,
          [POST_TO_INSTAGRAM]: true,
          [POST_TO_FACEBOOK]: true,
        },
      },
    });

    console.log(`✅ Run created: ${run.run_id}`);
    console.log('⏳ Waiting for completion...\n');

    // Wait for completion
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes timeout
    
    while (attempts < maxAttempts) {
      const runStatus = await client.runs.get(thread.thread_id, run.run_id);
      
      console.log(`📊 Attempt ${attempts + 1}: Status = ${runStatus.status}`);
      
      if (runStatus.status === 'success') {
        console.log('\n🎉 Workflow completed successfully!');
        console.log('📋 Full response structure:');
        console.log(JSON.stringify(runStatus, null, 2));
        
        // Try different ways to extract post ID
        console.log('\n🔍 Attempting to extract post ID...');
        
        const fullResponse = runStatus as any;
        console.log('kwargs:', fullResponse.kwargs);
        console.log('state:', fullResponse.kwargs?.state);
        
        const finalState = fullResponse.kwargs?.state;
        const postId1 = finalState?.postId;
        const postId2 = finalState?.post_id;
        const postId3 = finalState?.id;
        
        console.log('postId (postId):', postId1);
        console.log('postId (post_id):', postId2);
        console.log('postId (id):', postId3);
        
        // Check if there's a post in the state
        if (finalState) {
          console.log('\n📝 Final state keys:', Object.keys(finalState));
          
          // Look for any field that might contain the post ID
          for (const [key, value] of Object.entries(finalState)) {
            if (typeof value === 'string' && value.length > 20 && value.includes('-')) {
              console.log(`🎯 Potential post ID found in ${key}:`, value);
            }
          }
        }
        
        break;
      } else if (runStatus.status === 'error') {
        console.log('\n❌ Workflow failed!');
        console.log('Error:', (runStatus as any).kwargs?.error);
        break;
      }
      
      // Still running, wait a bit more
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏰ Workflow timed out');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugGeneratePost().catch(console.error); 