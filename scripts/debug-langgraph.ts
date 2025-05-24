import "dotenv/config";
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";

async function main() {
  try {
    console.log("Starting LangGraph API debug test");

    // Get the LangGraph API URL
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
    console.log(`Using LangGraph API URL: ${apiUrl}`);
    
    // Create a client
    const client = new LangGraphClient({
      apiUrl,
    }) as any;
    
    // Create a thread
    console.log("Creating thread...");
    const threadResponse = await client.threads.create();
    console.log("Thread creation response:", JSON.stringify(threadResponse, null, 2));
    
    const threadId = threadResponse.thread_id;
    if (!threadId) {
      throw new Error("Failed to get thread_id from response");
    }
    
    console.log(`Thread created with ID: ${threadId}`);
    
    // Create a run
    console.log("Creating run...");
    const runResponse = await client.runs.create(threadId, "generate_post", {
      input: {
        links: ["https://github.com/langchain-ai/langgraph"],
      },
      config: {
        configurable: {
          platform: "discord",
        },
      },
    });
    
    console.log("Run creation response:", JSON.stringify(runResponse, null, 2));
    
    // Extract run ID from response
    const runId = runResponse.id || runResponse.run_id;
    if (!runId) {
      throw new Error("Failed to get run ID from response");
    }
    
    console.log(`Run created with ID: ${runId}`);
    
    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;
    let runStatus;
    
    console.log("Polling for completion...");
    while (attempts < maxAttempts) {
      attempts++;
      
      runStatus = await client.runs.get(threadId, runId);
      console.log(`Attempt ${attempts}: full response:`, JSON.stringify(runStatus, null, 2));
      
      // Extract status (could be in different fields)
      const status = runStatus.status || runStatus.state || runStatus.run_status;
      console.log(`Attempt ${attempts}: status = ${status}`);
      
      if (status === "completed" || status === "success") {
        console.log("Run completed successfully!");
        break;
      } else if (status === "failed" || status === "error") {
        console.error("Run failed with error:", runStatus.error);
        break;
      } else if (status === "requires_action") {
        console.log("Run requires human action (humanNode)");
        
        // Check for human tasks
        try {
          console.log("Checking for human tasks...");
          const humanTasks = await client.runs.listHumanTasks(threadId, runId);
          console.log("Human tasks response:", JSON.stringify(humanTasks, null, 2));
          
          if (humanTasks && humanTasks.length > 0) {
            console.log(`Found ${humanTasks.length} human tasks`);
            
            // Try to complete the first task
            const task = humanTasks[0];
            console.log("Attempting to complete task:", task.id);
            
            const completionResponse = await client.runs.submitHumanTask(threadId, runId, task.id, {
              output: {
                approved: true,
                feedback: "Approved via debugging script"
              }
            });
            
            console.log("Task completion response:", JSON.stringify(completionResponse, null, 2));
          }
        } catch (taskErr) {
          console.error("Error handling human tasks:", taskErr);
        }
      }
      
      // Wait 5 seconds before checking again
      console.log("Waiting 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (attempts >= maxAttempts) {
      console.log("Timed out waiting for completion");
    }
    
    // Try to fetch messages from the thread
    console.log("Fetching messages from thread...");
    try {
      const messages = await client.threads.messages.list(threadId);
      console.log("Messages response:", JSON.stringify(messages, null, 2));
      
      // Try to extract content
      if (messages && messages.data && messages.data.length > 0) {
        const message = messages.data[0];
        let content = "";
        
        if (message.content) {
          message.content.forEach((part: any) => {
            if (part.type === "text" && part.text) {
              content += part.text.value + "\n";
            }
          });
          
          console.log("Extracted content:", content);
        }
      }
    } catch (messagesErr) {
      console.error("Error fetching messages:", messagesErr);
    }
    
    // Try to fetch artifacts
    console.log("Checking for artifacts...");
    try {
      const artifacts = await client.runs.getArtifacts(threadId, runId);
      console.log("Artifacts response:", JSON.stringify(artifacts, null, 2));
    } catch (artifactsErr) {
      console.error("Error fetching artifacts:", artifactsErr);
    }
    
    console.log("Debug test completed");
  } catch (error) {
    console.error("Error in debug script:", error);
  }
}

main().catch(console.error); 