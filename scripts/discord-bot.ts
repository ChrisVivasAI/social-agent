import { 
  Client, 
  Events, 
  GatewayIntentBits, 
  TextChannel, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  EmbedBuilder
} from "discord.js";
import { config } from "dotenv";
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";
import path from "path";
import { fileURLToPath } from "url";
import { pendingPosts } from "../src/clients/discord/commands/post.js";

// Load environment variables
config();

// Get Discord bot token from environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_BOT_TOKEN) {
  console.error("DISCORD_BOT_TOKEN is not defined in environment variables");
  process.exit(1);
}

// Define the structure for LangGraph extracted output
type ExtractedLangGraphOutput = {
  content: string;        // From 'Post' or similar
  report?: string;
  relevantLinks?: string[];
  imageOptions?: string[];
  imageUrl?: string;       // If a primary image URL is directly in the output
};

// Update the GeneratedPost interface to match the one in post.ts
type GeneratedPost = {
  content: string;
  url: string;
  threadId: string;
  runId: string;
  timestamp: number;
  platform?: string;
  imageUrl?: string;
  imageOptions?: string[];
  report?: string;
  relevantLinks?: string[];
  scheduleDate?: string | Date;
  scheduleId?: string; // ID returned by LangGraph for scheduled posts
};

// Define the structure for pollForCompletion results
type PollResult = {
  status: "completed" | "requires_action" | "failed" | "timeout";
  data?: any; // Content or other data on completion
  error?: string; // Error message
  runId?: string; // run_id, ensuring it's always available if a run was initiated
  threadId?: string; // thread_id, ensuring it's always available if a thread was created
};

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('generate')
    .setDescription('Generate social media content from a URL')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The URL to generate content from')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule a post for publishing')
    .addStringOption(option => 
      option.setName('post_id')
        .setDescription('ID of the generated post to schedule')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('platform')
        .setDescription('Platform to post to')
        .setRequired(true)
        .addChoices(
          { name: 'Twitter', value: 'twitter' },
          { name: 'LinkedIn', value: 'linkedin' }
        ))
    .addStringOption(option => 
      option.setName('date')
        .setDescription('Date to publish (YYYY-MM-DD)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('time')
        .setDescription('Time to publish (HH:MM)')
        .setRequired(true)),
    
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information'),
    
  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List pending posts'),
    
  new SlashCommandBuilder()
    .setName('check_status')
    .setDescription('Check the status of a post by ID')
    .addStringOption(option =>
      option.setName('post_id')
        .setDescription('ID of the post to check')
        .setRequired(true)),
    
  new SlashCommandBuilder()
    .setName('check-human-tasks')
    .setDescription('Check for pending human tasks in LangGraph that need your attention'),
];

// Function to validate a URL
function isValidURL(url: string) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

// Function to create interactive buttons for post approval
function createPostActionRow(postId: string) {
  const approveButton = new ButtonBuilder()
    .setCustomId(`approve_${postId}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success);
    
  const editButton = new ButtonBuilder()
    .setCustomId(`edit_${postId}`)
    .setLabel('Edit')
    .setStyle(ButtonStyle.Primary);
    
  const scheduleButton = new ButtonBuilder()
    .setCustomId(`schedule_${postId}`)
    .setLabel('Schedule')
    .setStyle(ButtonStyle.Secondary);
    
  const discardButton = new ButtonBuilder()
    .setCustomId(`discard_${postId}`)
    .setLabel('Discard')
    .setStyle(ButtonStyle.Danger);
    
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(approveButton, editButton, scheduleButton, discardButton);
}

// Function to generate a unique post ID
function generatePostId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Function to run the LangGraph workflow with proper inputs
async function runLangGraphFlow(url: string): Promise<PollResult> {
  let thread_id: string | undefined = undefined;
  let run_id: string | undefined = undefined;
  try {
    console.log(`Running LangGraph with URL: ${url}`);
    
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
    console.log(`Using LangGraph API URL: ${apiUrl}`);
    
    const client = new LangGraphClient({
      apiUrl,
    }) as any; 
    
    const sdkVersion = await detectSdkVersion(client);
    console.log(`[SDK] Using detected SDK version: ${sdkVersion.version}`);
    
    console.log("Creating thread...");
    const threadResponse = await client.threads.create();
    if (!threadResponse || !threadResponse.thread_id) {
      console.error("Failed to create thread, no thread_id returned", threadResponse);
      return { status: "failed", error: "Failed to create LangGraph thread." };
    }
    thread_id = threadResponse.thread_id;
    
    console.log(`Thread created with ID: ${thread_id}`);
    console.log(`Submitting URL: ${url} in links array`);
    
    const input = {
      links: [url],
    };
    
    const config = {
      configurable: {
        platform: "discord",
      },
    };
    
    console.log("LangGraph input:", JSON.stringify(input));
    console.log("LangGraph config:", JSON.stringify(config));
    
    let runResponse;
    try {
      console.log("[SDK] Creating run using client.runs.create (standard method)");
      runResponse = await client.runs.create(thread_id, "generate_post", {
        input,
        config,
      });
    } catch (createError: any) {
      console.error("[SDK] Error with standard create method:", createError.message);
      if (sdkVersion.version === 'v1' || sdkVersion.features.runsRead) {
        try {
          console.log("[SDK] Falling back to alternative create pattern for v1");
          runResponse = await client.runs.create({
            thread_id,
            assistant_id: "generate_post",
            input,
            config,
          });
        } catch (altCreateError: any) {
          console.error("[SDK] Alternative create method also failed:", altCreateError.message);
          throw new Error(`Failed to create run with any available methods: ${createError.message}, ${altCreateError.message}`);
        }
      } else {
        throw createError;
      }
    }
    
    if (!runResponse || (!runResponse.id && !runResponse.run_id)) {
      console.error("Run creation failed, response:", runResponse);
      run_id = runResponse?.run_id || runResponse?.id;
      if (run_id && thread_id) {
        console.log(`Found run ID in response: ${run_id}`);
        // Potentially start streaming here too if run creation failed but gave an ID
      } else {
        console.log("Attempting to list runs for thread as fallback after failed creation...");
        const runs = await client.runs.list(thread_id);
        if (runs && Array.isArray(runs) && runs.length > 0) {
          const latestRun = runs[0];
          run_id = latestRun.id || latestRun.run_id;
          if (run_id && thread_id) {
            console.log(`Using latest run ID from list: ${run_id}`);
          } else {
            return { status: "failed", error: "Failed to create LangGraph run and couldn't find a usable existing run ID.", threadId: thread_id };
          }
        } else {
           return { status: "failed", error: "Failed to create LangGraph run and no existing runs found for thread.", threadId: thread_id };
        }
      }
    } else {
      run_id = runResponse.id || runResponse.run_id;
    }

    console.log(`Run created with ID: ${run_id}, Thread ID: ${thread_id}. Starting event stream...`);

    // Stream events
    // According to docs, v1 event stream is default, but explicit for clarity
    const stream = await client.runs.streamEvents(thread_id, run_id, { version: "v1" }); 
    let lastRequiresActionState: any = null;
    let streamEnded = false;

    console.log("Subscribed to event stream. Waiting for events...");
    for await (const event of stream) {
      console.log("[STREAM EVENT] Type:", event.event, "Data:", JSON.stringify(event.data), "Run ID:", event.run_id);
      if (event.event === "on_run_update" && event.data?.run?.status === "requires_action") {
        console.log("[STREAM EVENT] Run requires action. Full event data:", JSON.stringify(event.data.run));
        lastRequiresActionState = event.data.run; // Capture the state when it requires action
        // We might not want to break here, let the stream formally end or continue if other events are useful
      }
      // The stream might end naturally, or we might want to detect a specific end event
      // For now, we will let it run its course and then use pollForCompletion as a final check
    }
    streamEnded = true;
    console.log("[STREAM] Event stream ended.");

    // After streaming, or if streaming isn't fully conclusive for final state, poll for completion.
    // If we captured a requires_action state from the stream, pollForCompletion can use it or verify.
    if (lastRequiresActionState) {
      console.log("[STREAM] Handing over requires_action state to pollForCompletion logic.");
      // Simulate a poll result structure for requires_action
      // Ensure the structure matches what pollForCompletion expects or adapt pollForCompletion
      // For now, let pollForCompletion still try to fetch its own state, but this gives us logs.
    }
    
    // Proceed to polling for final confirmation or if stream didn't yield a terminal requires_action state clearly.
    if (thread_id && run_id) {
      return await pollForCompletion(client, run_id, thread_id, lastRequiresActionState);
    } else {
      return { 
        status: "failed", 
        error: "Failed to obtain valid thread_id or run_id before polling, after streaming.", 
        threadId: thread_id, 
        runId: run_id 
      };
    }
  } catch (error: any) {
    console.error("Error running LangGraph flow:", error);
    return { 
      status: "failed", 
      error: `Error running LangGraph flow: ${error.message || String(error)}`,
      threadId: thread_id, 
      runId: run_id 
    };
  }
}

// Function to safely get a property from an object, checking multiple case variations
function getProperty<T = string>(obj: any, keys: string[], defaultValue?: T): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  for (const key of keys) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined && obj[key] !== null) {
      // Basic type check for string, or if it's an array for array types
      if (typeof defaultValue === 'string' && typeof obj[key] === 'string') return obj[key] as T;
      if (Array.isArray(defaultValue) && Array.isArray(obj[key])) return obj[key] as T;
      if (typeof defaultValue === undefined && obj[key]) return obj[key] as T; // For optional fields
      if (typeof obj[key] === typeof defaultValue) return obj[key] as T;
    }
  }
  return defaultValue;
}

// Function to poll for run completion
async function pollForCompletion(
  client2: LangGraphClient,
  runId: string,
  threadId: string,
  prefetchedState?: any // Optional state from streaming
): Promise<PollResult> {
  let attempts = 0;
  const maxAttempts = 300; 
  
  console.log(`==== Starting polling for run ${runId} with threadId ${threadId} ====`);
  if (prefetchedState) {
    console.log("[POLL] Received prefetched state:", JSON.stringify(prefetchedState));
    // Potentially process prefetchedState immediately if it's what we need
    // For now, we'll log it and let the polling logic proceed as a robust check
    // or if the stream didn't give us the final complete requires_action state.
  }
  console.log(`SDK Info: Using ${client2.constructor.name}`);
  
  while (attempts < maxAttempts) {
    try {
      console.log(`Polling run ${runId} with threadId ${threadId}, attempt ${attempts + 1}/${maxAttempts}...`);
      let runState: any;
      let methodUsed = '';
      
      try {
        console.log(`[API Method] Trying client2.runs.get(threadId, runId)...`);
        methodUsed = 'client2.runs.get';
        runState = await client2.runs.get(threadId, runId);
        console.log(`[Success] Successfully retrieved run using client2.runs.get`);
      } catch (methodError: any) {
        console.log(`[API Error] Error with client2.runs.get: ${methodError.message}`);
        if (methodError.message?.includes("is not a function")) {
          try {
            console.log(`[API Method] Falling back to client2.runs.read(runId)...`);
            methodUsed = 'client2.runs.read';
            runState = await (client2.runs as any).read(runId);
            console.log(`[Success] Successfully retrieved run using client2.runs.read`);
          } catch (readError: any) {
            console.log(`[API Error] Error with client2.runs.read: ${readError.message}`);
            try {
              console.log(`[API Method] Trying final fallback to client2.runs.retrieve(threadId, runId)...`);
              methodUsed = 'client2.runs.retrieve';
              runState = await (client2.runs as any).retrieve(threadId, runId);
              console.log(`[Success] Successfully retrieved run using client2.runs.retrieve`);
            } catch (retrieveError: any) {
              console.log(`[API Error] Final method failed: ${retrieveError.message}`);
              throw new Error(`All run retrieval methods failed: ${methodError.message}, ${readError.message}, ${retrieveError.message}`);
            }
          }
        } else {
          throw methodError;
        }
      }
      
      console.log(`[Run State] Structure of run state from ${methodUsed}:`, Object.keys(runState || {}).join(', '));
      console.log(`[Run Status] ${runState?.status || 'unknown'}`);
      
      if (runState) {
        const debugFields = ['outputs', 'messages', 'result', 'output', 'response', 'content', 'returned_values', 'kwargs', 'value', 'values'];
        for (const field of debugFields) {
          if (runState[field]) {
            console.log(`[Debug] runState.${field} exists:`, typeof runState[field]);
            if (typeof runState[field] === 'object') {
              console.log(`[Debug] Keys for runState.${field}: ${Object.keys(runState[field]).join(', ')}`);
              if (field === 'messages' && Array.isArray(runState[field]) && runState[field].length > 0) {
                const lastMessage = runState[field][runState[field].length - 1];
                console.log(`[Debug] Last message in runState.messages keys: ${Object.keys(lastMessage).join(', ')}`);
                if (typeof lastMessage.content === 'object') {
                  console.log(`[Debug] Last message content keys: ${Object.keys(lastMessage.content).join(', ')}`);
                }
              }
            } else if (typeof runState[field] === 'string' && runState[field].length < 200) {
              console.log(`[Debug] Value of runState.${field}: ${runState[field]}`);
            }
          }
        }
        if (runState.kwargs) {
          console.log('[Debug] Inspecting runState.kwargs.input:', runState.kwargs.input);
          console.log('[Debug] Inspecting runState.kwargs.output:', runState.kwargs.output);
        }
      }

      if (runState && (runState.status === "completed" || runState.status === "success")) {
        console.log(`[Success] Run ${runId} completed.`);
        
        let actualDataPayload: any = null;
        let payloadSourceDescription = "";

        // Step 1: Check runState.messages (most promising for agentic outputs)
        if (runState.messages && Array.isArray(runState.messages) && runState.messages.length > 0) {
          const lastMessage = runState.messages[runState.messages.length - 1];
          console.log("[Payload Search] Checking last message in runState.messages.");
          if (lastMessage && typeof lastMessage.content === 'object') {
            const lastMessageContent = lastMessage.content;
            if (lastMessageContent.Output && typeof lastMessageContent.Output === 'object') {
              actualDataPayload = lastMessageContent.Output;
              payloadSourceDescription = "runState.messages[last].content.Output";
            } else if (Array.isArray(lastMessageContent.value) && lastMessageContent.value.length > 0 && typeof lastMessageContent.value[0] === 'object') {
              actualDataPayload = lastMessageContent.value[0];
              payloadSourceDescription = "runState.messages[last].content.value[0]";
            } else if (Object.keys(lastMessageContent).length > 0) { // Check if content itself is the payload
              const potentialKeys = ['Post', 'Report', 'ImageUrl', 'content', 'text'];
              if (potentialKeys.some(key => lastMessageContent.hasOwnProperty(key))) {
                  actualDataPayload = lastMessageContent;
                  payloadSourceDescription = "runState.messages[last].content (direct properties)";
              }
            }
          } else if (lastMessage && typeof lastMessage === 'object') { // If last message itself is the payload (not nested in content)
             if (lastMessage.Output && typeof lastMessage.Output === 'object') {
              actualDataPayload = lastMessage.Output;
              payloadSourceDescription = "runState.messages[last].Output";
            } else if (Array.isArray(lastMessage.value) && lastMessage.value.length > 0 && typeof lastMessage.value[0] === 'object') {
              actualDataPayload = lastMessage.value[0];
              payloadSourceDescription = "runState.messages[last].value[0]";
            } else {
              const potentialKeys = ['Post', 'Report', 'ImageUrl', 'content', 'text'];
              if (potentialKeys.some(key => lastMessage.hasOwnProperty(key))) {
                  actualDataPayload = lastMessage;
                  payloadSourceDescription = "runState.messages[last] (direct properties)";
              }
            }
          }
        }

        // Step 2: If not in messages, check Primary Data Source Candidate (outputs, then kwargs.output)
        if (!actualDataPayload) {
          let primarySourceCandidate: any = null;
          let primarySourceDescription = "";
          if (runState.outputs && typeof runState.outputs === 'object' && Object.keys(runState.outputs).length > 0) {
            primarySourceCandidate = runState.outputs;
            primarySourceDescription = "runState.outputs";
          } else if (runState.kwargs && runState.kwargs.output && typeof runState.kwargs.output === 'object' && Object.keys(runState.kwargs.output).length > 0) {
            primarySourceCandidate = runState.kwargs.output;
            primarySourceDescription = "runState.kwargs.output";
          }

          if (primarySourceCandidate) {
            console.log(`[Payload Search] Trying primary source candidate: ${primarySourceDescription}`);
            if (primarySourceCandidate.Output && typeof primarySourceCandidate.Output === 'object') {
              actualDataPayload = primarySourceCandidate.Output;
              payloadSourceDescription = primarySourceDescription + ".Output";
            } else if (Array.isArray(primarySourceCandidate.value) && primarySourceCandidate.value.length > 0 && typeof primarySourceCandidate.value[0] === 'object') {
              actualDataPayload = primarySourceCandidate.value[0];
              payloadSourceDescription = primarySourceDescription + ".value[0]";
            } else if (typeof primarySourceCandidate === 'object' && Object.keys(primarySourceCandidate).length > 0) {
              const potentialKeys = ['Post', 'Report', 'ImageUrl', 'ImageOptions', 'RelevantLinks', 'content', 'text'];
              if (potentialKeys.some(key => primarySourceCandidate.hasOwnProperty(key))) {
                  actualDataPayload = primarySourceCandidate;
                  payloadSourceDescription = primarySourceDescription; // Keep original description
              } else {
                   console.log(`[Payload Search] Primary source candidate (${primarySourceDescription}) does not appear to be the direct payload or a known wrapper.`);
              }
            }
          }
        }

        // Step 3: If no payload yet, check runState top-level structures
        if (!actualDataPayload) {
          console.log("[Payload Search] No payload from messages, outputs, or kwargs.output. Checking runState top-level itself.");
          if (Array.isArray(runState.value) && runState.value.length > 0 && typeof runState.value[0] === 'object') {
            actualDataPayload = runState.value[0];
            payloadSourceDescription = "runState.value[0]";
          } else if (runState.Output && typeof runState.Output === 'object') { 
            actualDataPayload = runState.Output;
            payloadSourceDescription = "runState.Output";
          } else if (runState.results && typeof runState.results === 'object') {
            actualDataPayload = runState.results;
            payloadSourceDescription = "runState.results";
          } else if (runState.final_output && typeof runState.final_output === 'object') {
            actualDataPayload = runState.final_output;
            payloadSourceDescription = "runState.final_output";
          } else {
            const potentialKeys = ['Post', 'Report', 'ImageUrl', 'content', 'text'];
            if (potentialKeys.some(key => runState.hasOwnProperty(key))) {
                actualDataPayload = runState;
                payloadSourceDescription = "runState (direct properties)";
            } else {
                console.log("[Payload Search] Could not identify a structured payload in runState's known top-level locations.");
                console.warn("[Payload Search] Caution: Falling back to using entire runState object as potential payload if all else fails.");
                actualDataPayload = runState; // This is the ultimate fallback for searchForContent if no structure is matched.
                payloadSourceDescription = "runState (full object as last resort for generic search)";
            }
          }
        }
        
        const extractedData: Partial<ExtractedLangGraphOutput> = {};

        if (actualDataPayload && payloadSourceDescription !== "runState (full object as last resort for generic search)") {
          console.log(`[Content Extraction] Attempting to extract from identified payload source: ${payloadSourceDescription}`);
          console.log(`[Content Extraction] Payload keys: ${Object.keys(actualDataPayload).join(', ')}`);

          if ((payloadSourceDescription.endsWith(".value[0]") || payloadSourceDescription.startsWith("runState.messages[last].content.value[0]") || payloadSourceDescription.startsWith("runState.messages[last].value[0]")) && actualDataPayload.action_request && actualDataPayload.action_request.args) {
            console.log("[Content Extraction] Using human-review style extraction from action_request.args and description.");
            extractedData.content = actualDataPayload.action_request.args.post;
            extractedData.report = actualDataPayload.report; 
            extractedData.imageUrl = actualDataPayload.action_request.args.image;
            
            if (typeof actualDataPayload.description === 'string') {
              extractedData.imageOptions = parseImageOptionsFromDescription(actualDataPayload.description);
              extractedData.relevantLinks = parseRelevantLinksFromDescription(actualDataPayload.description);
            }
          } else {
            console.log("[Content Extraction] Using standard getProperty extraction for general object.");
            extractedData.content = getProperty<string>(actualDataPayload, ['Post', 'post', 'content', 'text', 'message', 'generation'], '');
            extractedData.report = getProperty<string>(actualDataPayload, ['Report', 'report', 'summary']);
            extractedData.relevantLinks = getProperty<string[]>(actualDataPayload, ['RelevantLinks', 'relevantLinks', 'links'], []);
            extractedData.imageOptions = getProperty<string[]>(actualDataPayload, ['ImageOptions', 'imageOptions', 'images', 'image_urls'], []);
            extractedData.imageUrl = getProperty<string>(actualDataPayload, ['ImageUrl', 'imageUrl', 'image', 'image_url']);
          }

          if (extractedData.content && extractedData.content.trim() !== '') {
            console.log("[Content Extraction] Successfully extracted structured data via primary/secondary paths:", extractedData);
            return { status: "completed", data: extractedData as ExtractedLangGraphOutput, runId, threadId };
          } else {
             console.log("[Content Extraction] Main content field (Post, content, etc.) was empty or not found in the identified payload via structured paths.");
          }
        } else {
            console.log("[Content Extraction] No specific structured payload was identified, or fell through to generic search fallback.");
        }
        
        // Fallback to generic searchForContent on the *entire runState* if structured extraction failed or produced no content
        console.log("[Content Extraction] Trying generic searchForContent on ENTIRE runState as a final fallback...");
        const fallbackContent = searchForContent(runState, runId, threadId); 
        if (fallbackContent) {
          console.log("[Content Extraction] Found content via fallback generic search on entire runState:", fallbackContent.substring(0, 200) + "...");
          return { status: "completed", data: { content: fallbackContent } as ExtractedLangGraphOutput, runId, threadId };
        }

        // If still no content, try fetching thread messages as a last resort
        console.error(`[Error] Run ${runId} completed, but no structured content or fallback content could be extracted directly from runState or its outputs/payload.`);
        try {
          console.log(`[Fallback] Attempting to fetch messages for thread ${threadId}...`);
          const messages = await getThreadMessages(client2, threadId);
          if (messages && messages.data && messages.data.length > 0) {
            for (const message of messages.data) {
              const contentFromMessage = extractContentFromMessage(message);
              if (contentFromMessage.trim()) {
                console.log(`[Content Found] Successfully extracted content from thread message: ${contentFromMessage.substring(0, 100)}...`);
                return { status: "completed", data: { content: contentFromMessage } as ExtractedLangGraphOutput, runId, threadId };
              }
            }
          }
        } catch (msgErr) {
          console.error(`[Error] Error fetching thread messages:`, msgErr);
        }

        console.error(`[Critical Error] Run ${runId} completed, but ALL content extraction methods failed.`);
          return { 
          status: "failed", 
          error: `Error: Run completed, but no content could be extracted. Please check Run ID: ${runId} in LangGraph Studio. Full runState keys: ${Object.keys(runState || {}).join(', ')}`, 
          runId, 
          threadId 
        };

      } else if (runState && runState.status === "failed") {
        console.error(`[Error] Run ${runId} failed. Full state:`, runState);
        return { 
          status: "failed",
          error: `Run failed with status: ${runState.status}. Check LangGraph Studio for details.`,
          runId,
          threadId
        };
      } else if (runState && runState.status === "requires_action") {
        console.log(`[Human Action] Run ${runId} requires human action.`);
        return { 
          status: "requires_action", 
          data: runState.required_action || "Human review required",
          runId,
          threadId
        };
      } else if (runState && (runState.status === "pending" || runState.status === "streaming")) {
        console.log(`[In Progress] Run ${runId} still in progress with status: ${runState.status}`);
      } else if (runState) {
        console.warn(`[Warning] Run ${runId} has unexpected status: ${runState.status}`);
      } else {
        console.warn(`[Warning] No run state received for run ${runId}.`);
      }
    } catch (error: any) {
      console.error(`[Error] Error polling for completion of run ${runId}:`, error);
      if (error.message?.toLowerCase().includes("no run found") || error.status === 404) {
        console.log("[Not Found] Run not found (404), continuing to poll...");
      } else {
        console.log("[Error] Error caught during polling, continuing to try...");
      }
    }
    attempts++;
    console.log(`[Waiting] Attempt ${attempts}/${maxAttempts} completed, waiting 1 second...`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
  }

  console.warn(`[Timeout] Polling for run ${runId} timed out after ${maxAttempts} attempts.`);
  return { 
    status: "timeout", 
    error: `Polling timed out after ${maxAttempts} seconds. The operation might still be running. Check LangGraph Studio with Run ID: ${runId}, Thread ID: ${threadId}.`,
    runId,
    threadId
  };
}

// Function to schedule a post (placeholder - would connect to actual posting API)
async function schedulePost(postId: string, platform: string, date: string, time: string): Promise<string> {
  // Get the post content from our pending posts
  const post = pendingPosts.get(postId);
  if (!post) {
    return `Error: Post with ID ${postId} not found`;
  }
  
  // In a real implementation, this would call the platform API to schedule
  console.log(`Scheduling post to ${platform} for ${date} at ${time}`);
  console.log(`Post content: ${post.content}`);
  
  // Remove from pending posts
  pendingPosts.delete(postId);
  
  return `Post successfully scheduled for ${platform} on ${date} at ${time}`;
}

// Event handler for when the client is ready
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
  
  try {
    // Register slash commands
    const rest = new REST().setToken(DISCORD_BOT_TOKEN);
    console.log("Started refreshing application commands...");
    
    // Register global commands (alternative: use guild-specific commands for faster updates during development)
    await rest.put(
      Routes.applicationCommands(readyClient.user.id),
      { body: commands },
    );
    
    console.log("Successfully registered application commands.");
  } catch (error) {
    console.error("Error registering application commands:", error);
  }
  
  // Get the default channel if specified
  const defaultChannelId = process.env.DISCORD_DEFAULT_CHANNEL_ID;
  if (defaultChannelId) {
    try {
      const channel = client.channels.cache.get(defaultChannelId) as TextChannel;
      if (channel) {
        channel.send("Social Media Agent is now online! Use the `/generate` command or mention me with a URL to generate content.");
      }
    } catch (error) {
      console.error("Failed to send startup message:", error);
    }
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    // Extract post ID and potentially other info from button custom ID
    // Format can be: action_postId or action_postId_additionalData
    const parts = customId.split('_');
    const action = parts[0];
    const postId = parts[1];
    
    // Get the post from our in-memory store
    const post = pendingPosts.get(postId);
    if (!post) {
      await interaction.reply({ content: "This post is no longer available.", ephemeral: true });
      return;
    }
    
    if (action === 'details') {
      // Handle view details button
      await handleViewDetails(interaction, post, postId);
    } 
    else if (action === 'image') {
      // Handle image button - show a modal for setting an image URL
      await handleSetImage(interaction, post, postId);
    }
    else if (action === 'select') {
      // Handle image selection from the edit screen
      // This button format is: select_image_postId_imageIndex
      const imageIndex = parseInt(parts[3]);
      
      if (post.imageOptions && post.imageOptions.length > imageIndex) {
        // Set the selected image
        post.imageUrl = post.imageOptions[imageIndex];
        pendingPosts.set(postId, post);
        
        // Create an embed to show the selected image
        const embed = new EmbedBuilder()
          .setTitle(`Selected Image ${imageIndex + 1}`)
          .setColor('#0099ff')
          .setDescription(`This image has been selected for your post.`)
          .setImage(post.imageUrl);
        
        await interaction.update({ 
          content: `You've selected Image Option ${imageIndex + 1}. You can now continue editing your post in the modal.`,
          embeds: [embed],
          components: []  // Remove buttons after selection
        });
      } else {
        await interaction.reply({ 
          content: 'Error: The selected image option is not available.', 
          ephemeral: true 
        });
      }
    }
    else if (action === 'close') {
      // Handle close button - just acknowledge the interaction
      await interaction.deferUpdate();
    }
    else if (action === 'close_details') {
      // Just acknowledge this interaction to close the detailed view
      await interaction.deferUpdate();
    }
    else if (action === 'edit') {
      // Handle edit button - show a modal for editing the post content
      await handleEditContent(interaction, post, postId);
    }
    else if (action === 'schedule') {
      // Handle schedule button
      await handleSchedulePost(interaction, post, postId);
    }
  } 
  // Handle modal submit interactions
  else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('edit_modal_')) {
      await handleEditModalSubmit(interaction);
    }
    else if (interaction.customId.startsWith('image_modal_')) {
      await handleImageModalSubmit(interaction);
    }
    else if (interaction.customId.startsWith('schedule_modal_')) {
      await handleScheduleModalSubmit(interaction);
  }
  }
  // Handle slash commands
  else if (interaction.isChatInputCommand()) {
    const commandName = interaction.commandName;
    
    if (commandName === 'generate') {
      // Extract the URL from the command options
      const url = interaction.options.getString('url');
      
      if (!url) {
        await interaction.reply({ content: 'Please provide a valid URL.', ephemeral: true });
        return;
      }
      
      // Validate URL format
      if (!isValidURL(url)) {
        await interaction.reply({ content: 'Please provide a valid URL.', ephemeral: true });
        return;
      }
      
      // Defer the reply to give us time to process the URL
      await interaction.deferReply();
      
      // Generate the post content
      const result = await runLangGraphFlow(url);
        
      if (result.status === 'failed') {
        await interaction.editReply(`Error: ${result.error || 'Unknown error generating post'}`);
          return;
        }
        
      if (result.status === 'requires_action') {
        // Human in the loop detected
        const message = `Your post requires human review. Please check LangGraph Studio to review and approve.\n\nRun ID: \`${result.runId}\`\nThread ID: \`${result.threadId}\``;
        await interaction.editReply(message);
          return;
        }
        
      if (result.status === 'timeout') {
        const message = `Timed out while waiting for post generation. The process might still be running.\n\nRun ID: \`${result.runId}\`\nThread ID: \`${result.threadId}\`\n\nYou can check the status later using \`/check_status ${result.runId}\``;
        await interaction.editReply(message);
        return;
      }
      
      // If we reached here, we have a successful result
      let postContent: string;
      let postImageUrl: string | undefined;
      let postImageOptions: string[] | undefined;
      let postReport: string | undefined;
      let postRelevantLinks: string[] | undefined;

      if (result.data && typeof result.data === 'object' && 'content' in result.data) {
        // Data is an ExtractedLangGraphOutput object
        const extractedData = result.data as ExtractedLangGraphOutput;
        postContent = extractedData.content;
        postImageUrl = extractedData.imageUrl;
        postImageOptions = extractedData.imageOptions;
        postReport = extractedData.report;
        postRelevantLinks = extractedData.relevantLinks;
        console.log("[Discord Reply] Using structured result.data:", extractedData);
      } else if (typeof result.data === 'string' && result.data.trim() !== '') {
        // Data is just a string (fallback from older extraction)
        postContent = result.data;
        console.log("[Discord Reply] Using string result.data for content.");
      } else {
        console.error("[Discord Reply] Error: result.data was not a usable string or structured object for content.", result);
        await interaction.editReply(
          `Error: Content generation completed successfully, but the final content could not be properly extracted or was empty. Run ID: ${result.runId}, Thread ID: ${result.threadId}. Please check the bot logs or LangGraph Studio for more details.`
        );
        return; 
      }
      
      const postId = generatePostId();
      pendingPosts.set(postId, {
        content: postContent,
        url: url,
        threadId: result.threadId || '',
        runId: result.runId || '',
        timestamp: Date.now(),
        imageUrl: postImageUrl,
        imageOptions: postImageOptions,
        report: postReport,
        relevantLinks: postRelevantLinks,
      });
      
      const embed = new EmbedBuilder()
        .setTitle('Generated Post')
        .setColor('#0099ff')
        .setDescription(postContent)
        .setURL(url)
        .setFooter({ text: `Post ID: ${postId} • Generated on: ${new Date().toLocaleString()}` });

      if (postImageUrl) {
        embed.setImage(postImageUrl);
      } else if (postImageOptions && postImageOptions.length > 0) {
        // Default to the first image option if no specific imageUrl is set
        embed.setImage(postImageOptions[0]);
      }
        
      const actionRow = createPostActionRow(postId);
        
      // Send the post preview with action buttons
        await interaction.editReply({
        content: 'Here is your generated post:',
        embeds: [embed],
        components: [actionRow as any],
      });
    }
    else if (commandName === 'help') {
      const helpText = `
**Social Media Agent Bot Commands:**

\`/generate [url]\` - Generate a social media post from a URL
\`/list\` - List all pending posts awaiting approval
\`/schedule\` - Schedule a generated post for publication
\`/check_status\` - Check the status of a post by its ID
\`/check-human-tasks\` - Check if there are any tasks awaiting human review in LangGraph

**Post Management:**
After generating a post, you can:
- Approve: Post immediately
- Edit: Modify the content before posting
- Schedule: Set a date and time for posting
- Discard: Delete the generated post
`;
      
      await interaction.reply({ content: helpText, ephemeral: true });
    }
    else if (commandName === 'list') {
      // Get all pending posts
      if (pendingPosts.size === 0) {
        await interaction.reply({ content: 'You have no pending posts.', ephemeral: true });
        return;
      }
      
      // Build a list of posts
      let postList = '**Your Pending Posts:**\n\n';
      
      pendingPosts.forEach((post, id) => {
        const date = new Date(post.timestamp).toLocaleString();
        let status = 'Pending';
        
        if (post.scheduleDate) {
          if (typeof post.scheduleDate === 'string') {
            status = `Scheduled (Priority: ${post.scheduleDate.toUpperCase()})`;
          } else {
            status = `Scheduled for ${post.scheduleDate.toLocaleString()}`;
          }
        }
        
        const preview = post.content.length > 50 
          ? post.content.substring(0, 50) + '...' 
          : post.content;
        
        postList += `**ID:** ${id}\n**Created:** ${date}\n**Status:** ${status}\n**Preview:** ${preview}\n\n`;
      });
      
      await interaction.reply({ content: postList, ephemeral: true });
    }
    else if (commandName === 'check_status') {
      await interaction.deferReply({ ephemeral: true });
      
      const postId = interaction.options.getString('post_id');
      
      if (!postId) {
        await interaction.editReply('Please provide a valid post ID.');
        return;
      }
      
      // First check if the post is in our pending posts collection
      const post = pendingPosts.get(postId);
      
      if (post) {
        // Create an embed with detailed post status
        const embed = new EmbedBuilder()
          .setTitle('Post Status')
          .setColor('#0099ff')
          .setDescription(`Here is the status of post ID: ${postId}`)
          .addFields(
            { name: 'Status', value: post.scheduleDate ? 'Scheduled' : 'Pending', inline: true },
            { name: 'Created', value: new Date(post.timestamp).toLocaleString(), inline: true }
          );
          
        if (post.threadId && post.runId) {
          embed.addFields(
            { name: 'Thread ID', value: post.threadId, inline: false },
            { name: 'Run ID', value: post.runId, inline: false }
          );
        }
        
        if (post.scheduleDate) {
          const scheduleDisplay = typeof post.scheduleDate === 'string' 
            ? `Priority: ${post.scheduleDate.toUpperCase()}`
            : `Scheduled for: ${post.scheduleDate.toLocaleString()}`;
            
          embed.addFields({ name: 'Schedule', value: scheduleDisplay, inline: false });
          
          if (post.scheduleId) {
            embed.addFields({ name: 'Schedule/Run ID', value: post.scheduleId, inline: false });
          }
          
          if (post.platform) {
            embed.addFields({ name: 'Platform', value: post.platform, inline: true });
          }
        }
        
        // Show a preview of the content
        const contentPreview = post.content.length > 200 
          ? post.content.substring(0, 200) + '...'
          : post.content;
          
        embed.addFields({ name: 'Content Preview', value: contentPreview, inline: false });
        
        // Add action buttons if the post is still pending
        let actionRow;
        if (!post.scheduleDate) {
          actionRow = createPostActionRow(postId);
        }
        
        await interaction.editReply({
          embeds: [embed],
          components: actionRow ? [actionRow as any] : []
        });
      }
      else {
        // Post not found in pending posts, check if it's a Run ID instead
        try {
          const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
          const client = new LangGraphClient({
            apiUrl,
          }) as any;
          
          // Check if the postId looks like a Run ID (longer format typically with hyphens)
          if (postId.includes('-') || postId.length > 10) {
            // Try to get the run directly
            await interaction.editReply(`Checking LangGraph for run ID: ${postId}...`);
            
            // We need a thread ID, which we don't have, so check all active threads
            const threads = await client.threads.list();
            let runFound = false;
            
            for (const thread of threads) {
              try {
                const threadId = thread.id || thread.thread_id;
                if (!threadId) continue;
                
                const runStatus = await client.runs.get(threadId, postId);
                
                if (runStatus) {
                  runFound = true;
                  // Extract status and other info
                  const status = runStatus.status || runStatus.state || 'unknown';
                  
                  const embed = new EmbedBuilder()
                    .setTitle('Run Status')
                    .setColor('#0099ff')
                    .setDescription(`Information for Run ID: ${postId}`)
                    .addFields(
                      { name: 'Status', value: status, inline: true },
                      { name: 'Thread ID', value: threadId, inline: true }
                    );
                    
                  if (status === 'completed') {
                    embed.addFields({ name: 'Completed', value: 'This run has completed successfully.', inline: false });
                    
                    if (runStatus.outputs) {
                      const outputStr = JSON.stringify(runStatus.outputs).substring(0, 200) + '...';
                      embed.addFields({ name: 'Output Preview', value: `\`\`\`json\n${outputStr}\n\`\`\``, inline: false });
                    }
                  }
                  else if (status === 'failed') {
                    embed.addFields({ name: 'Failed', value: 'This run has failed.', inline: false });
                    if (runStatus.error) {
                      embed.addFields({ name: 'Error', value: runStatus.error, inline: false });
                    }
                  }
                  else if (status === 'requires_action') {
                    embed.addFields({ 
                      name: 'Human Review Required', 
                      value: 'This run is waiting for human review in LangGraph Studio.', 
                      inline: false 
                    });
                    
                    // If we have a studio URL, provide it
                    if (process.env.LANGGRAPH_STUDIO_URL) {
                      const studioUrl = process.env.LANGGRAPH_STUDIO_URL.replace(/\/+$/, '');
                      embed.addFields({ 
                        name: 'Review Link', 
                        value: `[Open in LangGraph Studio](${studioUrl}/projects/my_projects/inbox)`, 
                        inline: false 
                      });
                    }
                  }
                  
                  await interaction.editReply({ embeds: [embed] });
                  break;
                }
              }
              catch (error) {
                // Ignore errors for individual threads and continue trying others
                console.error(`Error checking thread ${thread.id || thread.thread_id}:`, error);
              }
            }
            
            if (!runFound) {
              await interaction.editReply(`No information found for Run ID: ${postId}. The run might have been deleted or doesn't exist.`);
            }
          }
          else {
            await interaction.editReply(`Post with ID "${postId}" not found. If this is a LangGraph Run ID, make sure to use the full Run ID format.`);
          }
        }
        catch (error) {
          console.error('Error checking run status:', error);
          await interaction.editReply(`Error checking status for ID "${postId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    else if (commandName === 'check-human-tasks') {
      await checkForHumanReviewTasks(interaction);
    }
  }
});

// Event handler for message creation (for mentions and direct messages)
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots (including itself)
  if (message.author.bot) return;
  
  // Check if the message mentions the bot or starts with a prefix
  const isMentioned = client.user && message.mentions.users.has(client.user.id);
  const isDirectMessage = message.channel.isDMBased();
  
  if (isMentioned || isDirectMessage) {
    // Extract message content, removing the mention
    let content = client.user ? 
      message.content.replace(new RegExp(`<@!?${client.user.id}>`), "").trim() : 
      message.content.trim();
    
    // If the message is empty after removing the mention, ask for input
    if (!content) {
      message.reply("Please send me a URL to generate content about. Example: `https://github.com/langchain-ai/social-media-agent`");
      return;
    }
    
    // Check if it's a run command with default URL
    if (content.toLowerCase() === "run generate-post") {
      // Use the default URL from the generate-post script
      content = "https://github.com/coleam00/ai-agents-masterclass";
    }
    
    // Check if the content is a URL or contains a URL
    let url = content;
    if (!isValidURL(url)) {
      // Try to extract a URL if the message contains one
      const urlMatch = content.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        url = urlMatch[0];
      } else {
        message.reply("Please provide a valid URL. Example: `https://github.com/langchain-ai/social-media-agent`");
        return;
      }
    }
    
    // Let the user know we're working on it
    const loadingMessage = await message.reply(
      `Generating content about ${url}, please wait... (this may take several minutes)\n` +
      `Note: If the post goes through human review, you'll need to check LangGraph Studio to approve it.`
    );
    
    try {
      // Run LangGraph flow
      const generationResult = await runLangGraphFlow(url);
      
      // Check if the content contains an error message
      if (generationResult.status === "failed" || generationResult.status === "timeout") {
        await loadingMessage.edit(generationResult.error || "An unknown error occurred during content generation.");
        return;
      }
      
      if (generationResult.status === "requires_action") {
        const postIdOnError = generatePostId(); // Generate an ID to reference even if content isn't final
        pendingPosts.set(postIdOnError, {
          content: "Content generation requires human review.",
          url,
          threadId: generationResult.threadId || "",
          runId: generationResult.runId || "",
          timestamp: Date.now()
        });
        await loadingMessage.edit(
          `Your content generation request (Post ID: ${postIdOnError}, Run ID: ${generationResult.runId}, Thread ID: ${generationResult.threadId}) requires human review in LangGraph Studio. ` +
          `Please go to [Your LangGraph Studio URL, e.g., http://localhost:PORT/threads/${generationResult.threadId}/runs/${generationResult.runId}] to complete the process.`
        );
        return;
      }
      
      // Assuming status is "completed"
      let finalPostContent: string;
      let finalPostImageUrl: string | undefined;
      let finalPostImageOptions: string[] | undefined;
      let finalPostReport: string | undefined;
      let finalPostRelevantLinks: string[] | undefined;

      if (generationResult.data && typeof generationResult.data === 'object' && 'content' in generationResult.data) {
        const extractedData = generationResult.data as ExtractedLangGraphOutput;
        finalPostContent = extractedData.content;
        finalPostImageUrl = extractedData.imageUrl;
        finalPostImageOptions = extractedData.imageOptions;
        finalPostReport = extractedData.report;
        finalPostRelevantLinks = extractedData.relevantLinks;
        console.log("[Discord Reply - Mention] Using structured generationResult.data:", extractedData);
      } else if (typeof generationResult.data === 'string' && generationResult.data.trim() !== '') {
        finalPostContent = generationResult.data;
        console.log("[Discord Reply - Mention] Using string generationResult.data for content.");
      } else {
        console.error("[Discord Reply - Mention] Error: generationResult.data was not a usable string or structured object.", generationResult);
        await loadingMessage.edit(
          `Error: Content generation completed successfully, but the final content could not be properly extracted or was empty. Run ID: ${generationResult.runId}, Thread ID: ${generationResult.threadId}. Please check logs.`
        );
        return;
      }
      
      const mentionPostId = generatePostId(); // Renamed to avoid conflict if postId was used above
      pendingPosts.set(mentionPostId, {
        content: finalPostContent,
        url, // url is already defined in this scope
        threadId: generationResult.threadId || "",
        runId: generationResult.runId || "",
        timestamp: Date.now(),
        imageUrl: finalPostImageUrl,
        imageOptions: finalPostImageOptions,
        report: finalPostReport,
        relevantLinks: finalPostRelevantLinks,
      });
      
      const actionRowForMention = createPostActionRow(mentionPostId);
      
      let responseText = `**Generated content (ID: ${mentionPostId}):**\n\n${finalPostContent}`;
      if (finalPostImageUrl) {
        responseText += `\n\n**Image:** ${finalPostImageUrl}`;
      } else if (finalPostImageOptions && finalPostImageOptions.length > 0) {
        responseText += `\n\n**Image Option 1:** ${finalPostImageOptions[0]}`;
      }
      responseText += "\n\nUse the buttons below to approve, edit, schedule, or discard this post.";

      await loadingMessage.edit({
        content: responseText,
        components: [actionRowForMention]
      });
    } catch (error) {
      console.error("Error processing URL:", error);
      await loadingMessage.edit("Sorry, I encountered an error when generating content. Please try again later.");
    }
  }
});

// Login to Discord with your token
client.login(DISCORD_BOT_TOKEN)
  .catch(error => {
    console.error("Failed to login to Discord:", error);
    process.exit(1);
  });

// Add error handlers for API errors
client.rest.on('rateLimited', (info) => {
  console.warn(`Rate limited! Retry after ${info.timeToReset}ms on route ${info.route}`);
});

// Handle Discord API errors
client.on('error', (error: any) => {
  if (error.code === 10062) {
    console.warn('Interaction timed out - this is normal for delayed responses');
  } else {
    console.error('Discord client error:', error);
  }
});

// Add global unhandled rejection handler for interaction errors
process.on('unhandledRejection', (error: any) => {
  if (error?.code === 10062) {
    console.warn('Interaction timed out - this is normal for delayed responses');
    return; // Prevent process from exiting
  }
  console.error('Unhandled promise rejection:', error);
});

console.log("Starting Discord bot...");

/**
 * Handles the view details button interaction
 * Shows a comprehensive view of the post including report, relevant links, etc.
 */
async function handleViewDetails(
  interaction: any, 
  post: GeneratedPost, 
  postId: string
) {
  try {
    // Create a series of embeds to show all the information
    const embeds = [];
    
    // Main post embed
    const mainEmbed = new EmbedBuilder()
      .setTitle('Post Details')
      .setColor('#0099ff')
      .setDescription(post.content)
      .addFields(
        { name: 'Post ID', value: postId, inline: true },
        { name: 'Platform', value: post.platform || 'All', inline: true },
        { name: 'Status', value: 'Pending', inline: true },
        { name: 'Source URL', value: post.url }
      )
      .setFooter({ text: 'Generated at ' + new Date(post.timestamp).toLocaleString() })
      .setTimestamp();
    
    if (post.imageUrl) {
      mainEmbed.setImage(post.imageUrl);
    } else if (post.imageOptions && post.imageOptions.length > 0) {
      mainEmbed.setImage(post.imageOptions[0]);
    }
    
    embeds.push(mainEmbed);
    
    // If there's a report, create a separate embed for it
    if (post.report && post.report.trim()) {
      const reportEmbed = new EmbedBuilder()
        .setTitle('Report')
        .setColor('#00cc99')
        .setDescription(post.report.length > 4000 
          ? post.report.substring(0, 4000) + "... (truncated)"
          : post.report);
      
      embeds.push(reportEmbed);
    }
    
    // If there are relevant links, create a separate embed for them
    if (post.relevantLinks && post.relevantLinks.length > 0) {
      const linksEmbed = new EmbedBuilder()
        .setTitle('Relevant Links')
        .setColor('#ff9900')
        .setDescription(post.relevantLinks.map(link => `- ${link}`).join('\n'));
      
      embeds.push(linksEmbed);
    }
    
    // If there are image options, create a separate embed for them
    if (post.imageOptions && post.imageOptions.length > 1) {
      const imagesEmbed = new EmbedBuilder()
        .setTitle('Image Options')
        .setColor('#9933ff')
        .setDescription(post.imageOptions.map((url, index) => 
          `**Option ${index + 1}**: ${url}`
        ).join('\n\n'))
        .setFooter({ text: 'Use the Set Image button to choose one of these images' });
      
      embeds.push(imagesEmbed);
    }
    
    // Add a button to close this detailed view
    const closeButton = new ButtonBuilder()
      .setCustomId(`close_details_${postId}`)
      .setLabel('Close Details')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️');
    
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(closeButton);
    
    // Reply with all the embeds (ephemeral to avoid cluttering the channel)
    await interaction.reply({
      content: 'Here are the complete details for this post:',
      embeds: embeds,
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error handling view details:', error);
    await interaction.reply({ 
      content: 'There was an error retrieving the post details. Please try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Handles the set image button interaction
 * Shows a modal for setting an image URL
 */
async function handleSetImage(
  interaction: any, 
  post: GeneratedPost, 
  postId: string
) {
  try {
    // Create a modal for setting an image URL
    const modal = new ModalBuilder()
      .setCustomId(`image_modal_${postId}`)
      .setTitle('Set Post Image');
    
    // Create text input for the image URL
    const imageUrlInput = new TextInputBuilder()
      .setCustomId('imageUrl')
      .setLabel('Image URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter an image URL or leave empty to remove image')
      .setRequired(false)
      .setValue(post.imageUrl || '');
    
    // Create a row for the image URL input
    const imageUrlRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(imageUrlInput);
    
    // If there are image options, show them in the modal
    let optionsDescription = '';
    if (post.imageOptions && post.imageOptions.length > 0) {
      optionsDescription = `Available image options:\n${post.imageOptions.map((url, i) => 
        `${i+1}. ${url}`).join('\n')}`;
      
      // Add a description input to show the options (non-editable)
      const optionsInput = new TextInputBuilder()
        .setCustomId('options')
        .setLabel('Available Image Options (Copy an option if desired)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(optionsDescription)
        .setRequired(false);
      
      const optionsRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(optionsInput);
      
      // Add both rows to the modal
      modal.addComponents(imageUrlRow, optionsRow);
    } else {
      // Just add the URL input
      modal.addComponents(imageUrlRow);
    }
    
    // Show the modal to the user
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error handling set image:', error);
    await interaction.reply({ 
      content: 'There was an error setting up the image modal. Please try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Handles the image modal submission
 * Updates the post with the new image URL
 */
async function handleImageModalSubmit(interaction: any) {
  try {
    // Extract the post ID from the modal custom ID
    const postId = interaction.customId.replace('image_modal_', '');
    
    // Get the post from our in-memory store
    const post = pendingPosts.get(postId);
    if (!post) {
      await interaction.reply({ 
        content: 'This post is no longer available.', 
        ephemeral: true 
      });
      return;
    }
    
    // Get the image URL from the modal
    const imageUrl = interaction.fields.getTextInputValue('imageUrl');
    
    // Update the post with the new image URL (or remove it if empty)
    if (imageUrl.trim() === '') {
      // Remove the image URL
      post.imageUrl = undefined;
      await interaction.reply({ 
        content: 'Image removed from post.', 
        ephemeral: true 
      });
    } else {
      // Update the image URL
      post.imageUrl = imageUrl.trim();
      
      // Create an embed to show the image
      const embed = new EmbedBuilder()
        .setTitle('Image Preview')
        .setColor('#0099ff')
        .setDescription('The image has been set for this post.');
      
      // Only set the image if there's a valid URL
      if (post.imageUrl) {
        embed.setImage(post.imageUrl);
      }
      
      await interaction.reply({ 
        content: 'Image updated successfully!', 
        embeds: [embed],
        ephemeral: true 
      });
    }
    
    // Update the post in our store
    pendingPosts.set(postId, post);
  } catch (error) {
    console.error('Error handling image modal submit:', error);
    await interaction.reply({ 
      content: 'There was an error updating the image. Please try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Handles the edit content button interaction
 * Shows a modal for editing the post content
 */
async function handleEditContent(
  interaction: any, 
  post: GeneratedPost, 
  postId: string
) {
  try {
    // First, send an ephemeral message showing image options
    // This gives users a chance to see images before editing the content
    if (post.imageOptions && post.imageOptions.length > 0) {
      // Create embeds for each image option (max 5 due to Discord limits)
      const embeds = [];
      const maxImages = Math.min(post.imageOptions.length, 5);
      
      for (let i = 0; i < maxImages; i++) {
        const imageUrl = post.imageOptions[i];
        const embed = new EmbedBuilder()
          .setTitle(`Image Option ${i+1}`)
          .setColor('#3498db')
          .setImage(imageUrl)
          .setDescription(`Use \`{{image${i+1}}}\` in your post to reference this image`);
        
        embeds.push(embed);
      }
      
      // Add a hint about the currently selected image
      let currentImage = "No image selected";
      if (post.imageUrl) {
        const index = post.imageOptions.indexOf(post.imageUrl);
        currentImage = index >= 0 ? `Image Option ${index+1}` : post.imageUrl;
      }
      
      // Create buttons for each image
      const buttons = [];
      for (let i = 0; i < maxImages; i++) {
        const imageButton = new ButtonBuilder()
          .setCustomId(`select_image_${postId}_${i}`)
          .setLabel(`Use Image ${i+1}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🖼️');
        
        buttons.push(imageButton);
      }
      
      // Group buttons in rows (max 5 buttons per row)
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(...buttons.slice(0, 5));
      
      // Send image previews as an ephemeral message
      await interaction.reply({ 
        content: `**Available Image Options**\nCurrently selected: ${currentImage}\nYou'll be able to edit the post content after viewing these images. The edit modal will open automatically.`,
        embeds: embeds,
        components: [actionRow],
        ephemeral: true 
      });
    }
    
    // Create a modal for editing the post
    const modal = new ModalBuilder()
      .setCustomId(`edit_modal_${postId}`)
      .setTitle('Edit Post Content');
    
    // Prepare content with image placeholders if needed
    let contentWithPlaceholders = post.content;
    
    // Add image reference to content if images are available but not referenced
    if (post.imageOptions && post.imageOptions.length > 0 &&
        !contentWithPlaceholders.includes('{{image')) {
      contentWithPlaceholders += 
      '\n\n' +
      'Available Images:\n' +
      post.imageOptions.slice(0, 5).map((_, i) => `- {{image${i+1}}}: Image Option ${i+1}`).join('\n');
    }
    
    // Add a text input for the post content
    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Edit the post content:')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(contentWithPlaceholders)
      .setRequired(true);
    
    // Add a text input for editing instructions (optional)
    const instructionsInput = new TextInputBuilder()
      .setCustomId('instructions')
      .setLabel('Instructions for rewriting (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add specific instructions for rewriting the post if needed')
      .setRequired(false);
    
    // Add selected image note
    let selectedImageNote = "No image selected";
    if (post.imageUrl) {
      const index = post.imageOptions?.indexOf(post.imageUrl) ?? -1;
      selectedImageNote = index >= 0 ? 
        `Currently using Image Option ${index+1}` : 
        `Currently using custom image: ${post.imageUrl.substring(0, 50)}...`;
    }
    
    const imageNoteInput = new TextInputBuilder()
      .setCustomId('image_note')
      .setLabel('Current Image Selection (read-only)')
      .setStyle(TextInputStyle.Short)
      .setValue(selectedImageNote)
      .setRequired(false);
    
    // Add help text
    const helpInput = new TextInputBuilder()
      .setCustomId('help')
      .setLabel('Help & Tips (read-only)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(
        '• Use {{image1}}, {{image2}}, etc. to reference specific images\n' +
        '• You can set an image using the "Set Image" button too\n' +
        '• Add instructions above if you want AI help rewriting'
      )
      .setRequired(false);
    
    // Add inputs to the modal
    const contentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
    const instructionsRow = new ActionRowBuilder<TextInputBuilder>().addComponents(instructionsInput);
    const imageNoteRow = new ActionRowBuilder<TextInputBuilder>().addComponents(imageNoteInput);
    const helpRow = new ActionRowBuilder<TextInputBuilder>().addComponents(helpInput);
    
    modal.addComponents(contentRow, instructionsRow, imageNoteRow, helpRow);
    
    // Show the modal to the user
    // If we already replied with an ephemeral message, we need to use followUp
    if (post.imageOptions && post.imageOptions.length > 0) {
      await interaction.followUp({ 
        content: 'Now opening the edit modal...',
        ephemeral: true
      });
      await interaction.showModal(modal);
    } else {
      await interaction.showModal(modal);
    }
  } catch (error) {
    console.error('Error handling edit content:', error);
    await interaction.reply({ 
      content: 'There was an error setting up the edit modal. Please try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Handles the edit modal submission
 * Updates the post with the edited content and processes any rewrite instructions
 */
async function handleEditModalSubmit(interaction: any) {
  try {
    // Extract the post ID from the modal custom ID
    const postId = interaction.customId.replace('edit_modal_', '');
    
    // Get the post from our in-memory store
    const post = pendingPosts.get(postId);
    if (!post) {
      await interaction.reply({ 
        content: 'This post is no longer available.', 
        ephemeral: true 
      });
      return;
    }
    
    // Get the edited content and instructions
    const editedContent = interaction.fields.getTextInputValue('content');
    let instructions = '';
    
    try {
      // Instructions field might not exist if using the old modal
      instructions = interaction.fields.getTextInputValue('instructions');
    } catch (e) {
      // Ignore error if the field doesn't exist
    }
    
    if (instructions && instructions.trim() !== '') {
      // If there are rewrite instructions, we need to submit them to the LangGraph flow
      // But for now, just acknowledge the request and update the content
      await interaction.reply({ 
        content: 'Content updated with your edits. Note: Rewrite instructions were provided but this feature is not fully implemented yet.', 
        ephemeral: true 
      });
    } else {
      // If no rewrite instructions, just update the content directly
      await interaction.reply({ 
        content: 'Post updated! Use the schedule button to schedule it for publishing.', 
        ephemeral: true 
      });
    }
    
    // Update the post in our store
    post.content = editedContent;
    pendingPosts.set(postId, post);
    
    // Refresh the post display in the channel
    await refreshPostDisplay(interaction, post, postId);
  } catch (error) {
    console.error('Error handling edit modal submit:', error);
    await interaction.reply({ 
      content: 'There was an error updating the post. Please try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Refreshes the post display after an edit
 * This updates the original message with the new content
 */
async function refreshPostDisplay(
  interaction: any, 
  post: GeneratedPost, 
  postId: string
) {
  try {
    // Try to find the original message
    const message = await interaction.channel.messages.fetch(
      interaction.message?.id || interaction.message?.reference?.messageId
    );
    
    if (!message) {
      console.warn('Could not find original message to refresh');
      return;
    }
    
    // Format the schedule date if it exists
    let scheduleDisplay = "Not scheduled";
    if (post.scheduleDate) {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      };
      
      if (typeof post.scheduleDate === 'string') {
        scheduleDisplay = post.scheduleDate;
      } else {
        scheduleDisplay = post.scheduleDate.toLocaleString('en-US', options);
      }
    }
    
    // Truncate content if too long
    const truncatedContent = post.content.length > 3500 
      ? post.content.substring(0, 3500) + "... (truncated, click 'View Details' to see full content)"
      : post.content;
    
    // Create an updated embed for the generated post
    const embed = new EmbedBuilder()
      .setTitle('Generated Post (Edited)')
      .setColor('#0099ff')
      .setDescription(truncatedContent)
      .addFields(
        { name: 'Post ID', value: postId, inline: true },
        { name: 'Platform', value: post.platform || 'Twitter/LinkedIn', inline: true },
        { name: 'Scheduled For', value: scheduleDisplay, inline: true },
        { name: 'Original URL', value: post.url }
      )
      .setFooter({ text: 'Edited at ' + new Date().toLocaleString() })
      .setTimestamp();
    
    // Add image preview if available
    if (post.imageUrl) {
      embed.setImage(post.imageUrl);
    } else if (post.imageOptions && post.imageOptions.length > 0) {
      embed.setImage(post.imageOptions[0]);
    }
    
    // Get the original components (button rows)
    const components = message.components;
    
    // Update the message with the new embed
    await message.edit({
      content: 'Post has been updated! Here are the details:',
      embeds: [embed],
      components: components
    });
  } catch (error) {
    console.error('Error refreshing post display:', error);
    // Don't reply with an error message here, as we've already replied to the interaction
  }
}

/**
 * Handles the schedule button interaction
 * Shows a modal for scheduling the post
 */
async function handleSchedulePost(
  interaction: any, 
  post: GeneratedPost, 
  postId: string
) {
  try {
    // Create a modal for scheduling the post
    const modal = new ModalBuilder()
      .setCustomId(`schedule_modal_${postId}`)
      .setTitle('Schedule Post');
      
    // Format the default date if it exists
    let defaultDate = '';
    let defaultTime = '';
    
    if (post.scheduleDate) {
      if (typeof post.scheduleDate === 'string') {
        // Handle priority strings (P1, P2, P3)
        if (['p1', 'p2', 'p3'].includes(post.scheduleDate.toLowerCase())) {
          defaultDate = post.scheduleDate;
        } else {
          // Try to parse the date string
          try {
            const date = new Date(post.scheduleDate);
            defaultDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            defaultTime = date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
          } catch (e) {
            // If parsing fails, just use the string as is
            defaultDate = post.scheduleDate;
          }
        }
      } else {
        // It's a Date object
        defaultDate = post.scheduleDate.toISOString().split('T')[0]; // YYYY-MM-DD
        defaultTime = post.scheduleDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      }
    } else {
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0); // 9 AM
      
      defaultDate = tomorrow.toISOString().split('T')[0];
      defaultTime = '09:00';
    }
    
    // Create input fields
    // Platform input (dropdown-like with choices)
    const platformInput = new TextInputBuilder()
      .setCustomId('platform')
      .setLabel('Platform (twitter, linkedin, discord, all)')
      .setStyle(TextInputStyle.Short)
      .setValue(post.platform || 'all')
      .setPlaceholder('twitter, linkedin, discord, or all')
      .setRequired(true);
      
    // Date input (YYYY-MM-DD)
    const dateInput = new TextInputBuilder()
      .setCustomId('date')
      .setLabel('Date (YYYY-MM-DD or P1/P2/P3 for priority)')
      .setStyle(TextInputStyle.Short)
      .setValue(defaultDate)
      .setPlaceholder('YYYY-MM-DD or P1/P2/P3')
      .setRequired(true);
      
    // Time input (HH:MM)
    const timeInput = new TextInputBuilder()
      .setCustomId('time')
      .setLabel('Time (HH:MM in 24-hour format)')
      .setStyle(TextInputStyle.Short)
      .setValue(defaultTime)
      .setPlaceholder('HH:MM (24-hour format)')
      .setRequired(defaultDate.toLowerCase().startsWith('p') ? false : true);
      
    // Notes input (optional)
    const notesInput = new TextInputBuilder()
      .setCustomId('notes')
      .setLabel('Additional Notes (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Any additional notes about this schedule')
      .setRequired(false);
    
    // Add all the inputs to the modal
    const platformRow = new ActionRowBuilder<TextInputBuilder>().addComponents(platformInput);
    const dateRow = new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput);
    const timeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput);
    const notesRow = new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput);
    
    // Create a help/info section explaining priority levels
    const helpInput = new TextInputBuilder()
      .setCustomId('help')
      .setLabel('Priority Guide (Read Only)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(
        'Priority Levels (optional):\n' +
        'P1: High priority - Weekend mornings (8-10 AM)\n' + 
        'P2: Medium priority - Weekday mornings or weekend afternoons\n' +
        'P3: Low priority - Weekend evenings\n\n' +
        'Note: Using a priority level will override any time you select.'
      )
      .setRequired(false);
    
    const helpRow = new ActionRowBuilder<TextInputBuilder>().addComponents(helpInput);
    
    // Add all rows to the modal (max 5 components)
    modal.addComponents(platformRow, dateRow, timeRow, notesRow, helpRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error handling schedule post:', error);
    await interaction.reply({ 
      content: 'There was an error setting up the schedule modal. Please try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Handles the schedule modal submission
 * Schedules the post with the LangGraph workflow
 */
async function handleScheduleModalSubmit(interaction: any) {
  try {
    // Extract the post ID from the modal custom ID
    const postId = interaction.customId.replace('schedule_modal_', '');
    
    // Get the post from our in-memory store
    const post = pendingPosts.get(postId);
    if (!post) {
      await interaction.reply({ 
        content: 'This post is no longer available.', 
        ephemeral: true 
      });
      return;
    }
    
    // Get the scheduling details from the modal
    const platform = interaction.fields.getTextInputValue('platform').toLowerCase();
    const dateStr = interaction.fields.getTextInputValue('date');
    const timeStr = interaction.fields.getTextInputValue('time');
    let notes = '';
    
    try {
      notes = interaction.fields.getTextInputValue('notes');
    } catch (e) {
      // Ignore error if the field doesn't exist
    }
    
    // Validate platform
    const validPlatforms = ['twitter', 'linkedin', 'discord', 'all'];
    if (!validPlatforms.includes(platform)) {
      await interaction.reply({ 
        content: `Invalid platform. Please use one of: ${validPlatforms.join(', ')}`, 
        ephemeral: true 
      });
      return;
    }
    
    // If the date is a priority level, store it directly
    if (dateStr.toLowerCase().startsWith('p')) {
      post.scheduleDate = dateStr.toLowerCase();
      post.platform = platform;
      
      pendingPosts.set(postId, post);
      
      await interaction.reply({ 
        content: `Post scheduled with priority level ${dateStr.toUpperCase()} for ${platform}`, 
        ephemeral: true 
      });
      
      // Refresh the post display
      await refreshPostDisplay(interaction, post, postId);
      return;
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      await interaction.reply({ 
        content: 'Invalid date format. Please use YYYY-MM-DD (e.g. 2023-12-31).', 
        ephemeral: true 
      });
      return;
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(timeStr)) {
      await interaction.reply({ 
        content: 'Invalid time format. Please use HH:MM in 24-hour format (e.g. 14:30).', 
        ephemeral: true 
      });
      return;
    }
    
    // Parse the date and time
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    
    // JavaScript months are 0-indexed
    const scheduledDate = new Date(year, month - 1, day, hour, minute);
    
    // Check if the date is valid
    if (isNaN(scheduledDate.getTime())) {
      await interaction.reply({ 
        content: 'Invalid date or time. Please check your input and try again.', 
        ephemeral: true 
      });
      return;
    }
    
    // Check if date is in the past
    if (scheduledDate < new Date()) {
      await interaction.reply({ 
        content: 'Cannot schedule posts in the past. Please provide a future date and time.', 
        ephemeral: true 
      });
      return;
    }
    
    // Update the post with the scheduling information
    post.scheduleDate = scheduledDate;
    post.platform = platform;
    
    // Store the updated post
    pendingPosts.set(postId, post);
    
    // Create human-readable schedule string
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    
    const scheduleString = scheduledDate.toLocaleString('en-US', options);
    
    // Connect to LangGraph client to schedule the post
    await interaction.deferReply({ ephemeral: true });

    try {
      const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
      const lgClient = new LangGraphClient({
        apiUrl,
      }) as any; // Type assertion to avoid TypeScript errors with SDK
      
      // Detect SDK version
      const sdkVersion = await detectSdkVersion(lgClient);
      console.log(`[SDK] Using detected SDK version for scheduling: ${sdkVersion.version}`);
      
      // Only create an actual schedule if this is a specific date (not priority levels like P1, P2, P3)
      if (typeof post.scheduleDate === 'object') {
        // Calculate seconds until the scheduled date
        const now = new Date();
        const scheduledDate = post.scheduleDate as Date;
        const secondsUntilScheduled = Math.floor((scheduledDate.getTime() - now.getTime()) / 1000);
        
        if (secondsUntilScheduled <= 0) {
          await interaction.editReply({ 
            content: 'Cannot schedule for a time in the past. Please choose a future date and time.' 
          });
          return;
        }
        
        console.log(`Scheduling post for ${scheduledDate.toISOString()} (${secondsUntilScheduled} seconds from now)`);
        
        let scheduleResult: any;
        
        if (sdkVersion.features.runsSchedule && sdkVersion.version === 'v2') {
          // Older SDK version that uses the schedule method
          console.log("[SDK] Using deprecated runs.schedule method");
          
          // Format date for cron expression
          const cronMinute = scheduledDate.getMinutes();
          const cronHour = scheduledDate.getHours();
          const cronDay = scheduledDate.getDate();
          const cronMonth = scheduledDate.getMonth() + 1; // Add 1 to convert to 1-indexed month
          const cronExpression = `${cronMinute} ${cronHour} ${cronDay} ${cronMonth} *`;
          
          // Use the deprecated schedule method
          scheduleResult = await lgClient.runs.schedule("publish_post", {
            schedule: cronExpression,
            input: {
              post_content: post.content,
              original_url: post.url,
              source_thread_id: post.threadId || "",
              source_run_id: post.runId || "",
              image_url: post.imageUrl || ((post.imageOptions && post.imageOptions.length > 0) ? post.imageOptions[0] : "")
            },
            config: {
              configurable: {
                platform: platform,
              },
            },
          });
        } else {
          // Modern SDK version - create a thread and use runs.create with afterSeconds
          console.log("[SDK] Using modern runs.create with afterSeconds");
          
          // Create a thread for the scheduled post
          const threadResponse = await lgClient.threads.create();
          if (!threadResponse || !threadResponse.thread_id) {
            throw new Error("Failed to create thread for scheduled post");
          }
          
          // Create a run with afterSeconds parameter
          scheduleResult = await lgClient.runs.create(
            threadResponse.thread_id,
            "publish_post",
            {
              input: {
                post_content: post.content,
                original_url: post.url,
                source_thread_id: post.threadId || "",
                source_run_id: post.runId || "",
                image_url: post.imageUrl || ((post.imageOptions && post.imageOptions.length > 0) ? post.imageOptions[0] : "")
              },
              config: {
                configurable: {
                  platform: platform,
                },
              },
              afterSeconds: secondsUntilScheduled
            }
          );
        }
        
        console.log("LangGraph schedule call result:", JSON.stringify(scheduleResult, null, 2));
        
        let scheduleTrackingId = "N/A";
        let successMessage = `Post scheduling action was successful for ${platform} on ${scheduleString}. Please monitor LangGraph Studio for the scheduled run.`;

        // Extract the schedule/run ID from the response (attempting multiple common field names)
        if (scheduleResult) {
          if (scheduleResult.id) {
            scheduleTrackingId = scheduleResult.id;
          } else if (scheduleResult.scheduled_id) {
            scheduleTrackingId = scheduleResult.scheduled_id;
          } else if (scheduleResult.schedule_id) {
            scheduleTrackingId = scheduleResult.schedule_id;
          } else if (scheduleResult.scheduled_run_id) {
            scheduleTrackingId = scheduleResult.scheduled_run_id;
          } else if (scheduleResult.run_id) {
            scheduleTrackingId = scheduleResult.run_id;
          } else {
            // Try to find an ID field in the response
            const potentialIdFields = Object.keys(scheduleResult).filter(key => 
              key.toLowerCase().includes('id') && 
              typeof scheduleResult[key] === 'string'
            );
            
            if (potentialIdFields.length > 0) {
              scheduleTrackingId = scheduleResult[potentialIdFields[0]];
              console.log(`Found potential ID field: ${potentialIdFields[0]} with value: ${scheduleTrackingId}`);
            }
          }
        }

        // Store the schedule ID in the post object
        if (scheduleTrackingId !== "N/A") {
          post.scheduleId = scheduleTrackingId;
          pendingPosts.set(postId, post);
          
          successMessage = `Post scheduled successfully for ${platform} on ${scheduleString}! You can track this scheduled job in LangGraph Studio with Schedule/Run ID: ${scheduleTrackingId}.`;
        } else {
          // If no specific ID, provide the full logged result snippet if it's not too large
          const resultString = JSON.stringify(scheduleResult || {}).substring(0, 100);
          successMessage = `Post scheduling action was successful for ${platform} on ${scheduleString}. No specific tracking ID found in response. Details: ${resultString}... (see console logs for full details). Please monitor LangGraph Studio.`;
        }

        // Respond to the user
        await interaction.editReply({ 
          content: successMessage
        });

        // Refresh the post display
        await refreshPostDisplay(interaction, post, postId);
      } else {
        // This is a priority level - store in database but don't schedule a run yet
        // For now, just simulate success
        await interaction.editReply({ 
          content: `Post added to queue with priority level ${dateStr.toUpperCase()} for ${platform}.`
        });

        // Refresh the post display
        await refreshPostDisplay(interaction, post, postId);
      }
    } catch (error: any) {
      console.error("Error scheduling post:", error);
      await interaction.editReply({ 
        content: `Error scheduling post: ${error?.message || "Unknown error"}`
      });
    }
  } catch (error) {
    console.error('Error handling schedule modal submit:', error);
    await interaction.reply({ 
      content: 'There was an error scheduling the post. Please try again.', 
      ephemeral: true 
    });
  }
}

// Function to check for human review tasks in LangGraph
async function checkForHumanReviewTasks(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
    const lgClient = new LangGraphClient({
      apiUrl,
    }) as any; // Type assertion to avoid TypeScript errors with SDK

    // Check for pending human tasks
    console.log("Fetching human tasks from LangGraph API...");
    let tasks: any[] = [];
    
    try {
      // Try the primary method first
      tasks = await lgClient.runs.listHumanTasks();
      console.log(`Found ${tasks?.length || 0} tasks using primary method`);
    } catch (primaryErr) {
      console.error("Error with primary human tasks method:", primaryErr);
      
      // Try alternative method
      try {
        tasks = await lgClient.humanTasks.list();
        console.log(`Found ${tasks?.length || 0} tasks using alternative method`);
      } catch (altErr) {
        console.error("Error with alternative human tasks method:", altErr);
        
        // Last resort - try to list runs with requires_action status
        try {
          const allRuns = await lgClient.runs.list();
          tasks = allRuns.filter((run: any) => 
            run.status === "requires_action" || run.state === "requires_action"
          );
          console.log(`Found ${tasks?.length || 0} tasks by filtering runs`);
        } catch (lastErr) {
          console.error("Error with last resort method:", lastErr);
          // Continue with empty tasks array
        }
      }
    }
    
    if (tasks && tasks.length > 0) {
      let taskList = "**Pending Human Tasks:**\n\n";
      let count = 0;
      
      tasks.forEach((task: any, index: number) => {
        try {
          // Extract task ID using various possible properties
          const id = task.id || task.run_id || task.runId || "unknown";
          
          // Extract other properties with fallbacks
          const type = task.type || task.task_type || "unknown";
          const status = task.status || task.state || "pending";
          const created = task.created_at || task.createdAt || task.timestamp || new Date().toISOString();
          const details = task.details || task.description || task.message || JSON.stringify(task);
          
          taskList += `**Task ${index + 1}:**\n`;
          taskList += `**ID:** ${id}\n`;
          taskList += `**Type:** ${type}\n`;
          taskList += `**Status:** ${status}\n`;
          taskList += `**Created:** ${new Date(created).toLocaleString()}\n`;
          taskList += `**Details:** ${details.substring(0, 200)}...\n\n`;
          
          count++;
          
          // Discord has message length limits, so limit the number of tasks shown
          if (count >= 5 && tasks.length > 5) {
            taskList += `\n*...and ${tasks.length - 5} more tasks. Check LangGraph Studio for complete list.*\n`;
            return false; // Break out of forEach
          }
        } catch (taskErr) {
          console.error("Error processing task:", taskErr);
          // Skip this task and continue
        }
      });
      
      await interaction.editReply({
        content: taskList + "\n\nTo see and respond to these tasks, visit the LangGraph Studio UI."
      });
    } else {
      await interaction.editReply("No pending human tasks found.");
    }
  } catch (error: any) {
    console.error("Error checking human tasks:", error);
    await interaction.editReply("Sorry, I encountered an error when checking for human tasks. Please try again later or check the LangGraph Studio UI directly.");
  }
}

// Function to catch any error and provide typing
async function catchError(fn: Function, ...args: any[]) {
  try {
    return await fn(...args);
  } catch (e: any) {
    return e;
  }
} 

// Helper function to get thread messages with fallbacks
async function getThreadMessages(client: LangGraphClient, threadId: string): Promise<any> {
  console.log(`[Thread] Attempting to fetch messages for thread ${threadId}...`);
  
  // Try multiple methods to retrieve thread messages
  const methods = [
    {
      name: 'messages.list',
      fn: async () => {
        if (client.threads && (client.threads as any).messages && typeof (client.threads as any).messages.list === 'function') {
          return await (client.threads as any).messages.list(threadId);
        }
        throw new Error("messages.list method not available");
      }
    },
    {
      name: 'getMessages',
      fn: async () => {
        if (client.threads && typeof (client.threads as any).getMessages === 'function') {
          return await (client.threads as any).getMessages(threadId);
        }
        throw new Error("getMessages method not available");
      }
    },
    {
      name: 'retrieveMessages',
      fn: async () => {
        if (client.threads && typeof (client.threads as any).retrieveMessages === 'function') {
          return await (client.threads as any).retrieveMessages(threadId);
        }
        throw new Error("retrieveMessages method not available");
      }
    },
    {
      name: 'listMessages',
      fn: async () => {
        if (client.threads && typeof (client.threads as any).listMessages === 'function') {
          return await (client.threads as any).listMessages(threadId);
        }
        throw new Error("listMessages method not available");
      }
    },
    {
      name: 'fetch',
      fn: async () => {
        // Some SDKs might have a fetch method to get thread with messages
        if (client.threads && typeof (client.threads as any).fetch === 'function') {
          const thread = await (client.threads as any).fetch(threadId);
          return thread.messages || { data: [] };
        }
        throw new Error("fetch method not available");
      }
    },
    {
      name: 'direct HTTP request',
      fn: async () => {
        // Last resort: Try to fetch messages directly using the API URL
        // This assumes the client has an apiUrl property
        const apiUrl = (client as any).apiUrl || process.env.LANGGRAPH_API_URL || "http://localhost:54367";
        console.log(`[API] Attempting direct HTTP request to ${apiUrl}/threads/${threadId}/messages`);
        
        try {
          // Use node-fetch or built-in fetch depending on environment
          const response = await fetch(`${apiUrl}/threads/${threadId}/messages`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`[API] Direct HTTP request successful, found ${data.data?.length || 0} messages`);
          return data;
        } catch (error: any) {
          console.error(`[API] Direct HTTP request failed: ${error.message}`);
          throw error;
        }
      }
    }
  ];
  
  let lastError: Error | null = null;
  
  // Try each method in order
  for (const method of methods) {
    try {
      console.log(`[API Method] Trying ${method.name}...`);
      const result = await method.fn();
      console.log(`[Success] Got messages using ${method.name}`);
      return result;
    } catch (error: any) {
      console.log(`[API Error] ${method.name} failed: ${error.message}`);
      lastError = error;
    }
  }
  
  // All methods failed
  throw new Error(`All message retrieval methods failed. Last error: ${lastError?.message}`);
}

// Helper function to extract content from message content
function extractContentFromMessage(message: any): string {
  let content = "";
  
  // Handle different message content formats
  if (!message) {
    return content;
  }
  
  // Format 1: Array of content parts (OpenAI API style)
  if (message.content && Array.isArray(message.content)) {
    message.content.forEach((part: any) => {
      if (part.type === "text" && part.text && part.text.value) {
        content += part.text.value;
      }
    });
  }
  // Format 2: Direct string content
  else if (typeof message.content === 'string') {
    content = message.content;
  }
  // Format 3: Nested content.text
  else if (message.content && message.content.text && typeof message.content.text === 'string') {
    content = message.content.text;
  }
  // Format 4: Direct text field
  else if (typeof message.text === 'string') {
    content = message.text;
  }
  // Format 5: Value field
  else if (message.value && typeof message.value === 'string') {
    content = message.value;
  }
  // Format 6: Message field
  else if (message.message && typeof message.message === 'string') {
    content = message.message;
  }
  
  return content;
}

// SDK version detection
interface SdkVersion {
  version: 'v1' | 'v2' | 'v3' | 'unknown';
  features: {
    runsGet: boolean;
    runsRead: boolean;
    runsRetrieve: boolean;
    runsCreate: boolean;
    runsSchedule: boolean;
    threadMessages: boolean;
  }
}

// Cache the detected SDK version
let detectedSdkVersion: SdkVersion | null = null;

// Detect the SDK version and available methods
async function detectSdkVersion(client: LangGraphClient): Promise<SdkVersion> {
  // Return cached version if available
  if (detectedSdkVersion) {
    return detectedSdkVersion;
  }
  
  console.log('[SDK] Detecting LangGraph SDK version and capabilities...');
  
  const version: SdkVersion = {
    version: 'unknown',
    features: {
      runsGet: false,
      runsRead: false,
      runsRetrieve: false,
      runsCreate: false,
      runsSchedule: false,
      threadMessages: false
    }
  };
  
  // Check runs.get method
  try {
    // We can't actually call it without params, but we can check if it exists
    version.features.runsGet = typeof (client.runs as any).get === 'function';
    console.log(`[SDK] runs.get: ${version.features.runsGet ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('[SDK] Error checking runs.get:', error);
  }
  
  // Check runs.read method
  try {
    version.features.runsRead = typeof (client.runs as any).read === 'function';
    console.log(`[SDK] runs.read: ${version.features.runsRead ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('[SDK] Error checking runs.read:', error);
  }
  
  // Check runs.retrieve method
  try {
    version.features.runsRetrieve = typeof (client.runs as any).retrieve === 'function';
    console.log(`[SDK] runs.retrieve: ${version.features.runsRetrieve ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('[SDK] Error checking runs.retrieve:', error);
  }
  
  // Check runs.create method
  try {
    version.features.runsCreate = typeof (client.runs as any).create === 'function';
    console.log(`[SDK] runs.create: ${version.features.runsCreate ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('[SDK] Error checking runs.create:', error);
  }
  
  // Check runs.schedule method (deprecated but might exist)
  try {
    version.features.runsSchedule = typeof (client.runs as any).schedule === 'function';
    console.log(`[SDK] runs.schedule: ${version.features.runsSchedule ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('[SDK] Error checking runs.schedule:', error);
  }
  
  // Check threads.messages 
  try {
    version.features.threadMessages = typeof (client.threads as any).messages === 'object';
    console.log(`[SDK] threads.messages: ${version.features.threadMessages ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('[SDK] Error checking threads.messages:', error);
  }
  
  // Determine overall version based on feature pattern
  if (version.features.runsGet && version.features.runsCreate && version.features.threadMessages) {
    version.version = 'v3'; // Newest version
  } else if (version.features.runsRead && !version.features.runsGet) {
    version.version = 'v1'; // Oldest version
  } else if (version.features.runsSchedule) {
    version.version = 'v2'; // Middle version with schedule method
  } else if (version.features.runsCreate) {
    version.version = 'v2'; // Default to v2 if it has create but we can't clearly determine
  }
  
  console.log(`[SDK] Detected SDK version: ${version.version}`);
  
  // Cache the detected version
  detectedSdkVersion = version;
  return version;
}

// Helper function to recursively search for content in an object
function searchForContent(obj: any, runIdToExclude?: string, threadIdToExclude?: string, maxDepth = 4, currentDepth = 0, visited = new Set()): string | null {
  // Guard against circular references and max depth
  if (!obj || currentDepth > maxDepth || visited.has(obj)) {
    return null;
  }
  
  // Add this object to visited set
  if (typeof obj === 'object') {
    visited.add(obj);
  }
  
  // If it's a string, check if it looks like content
  if (typeof obj === 'string') {
    const trimmedObj = obj.trim();
    // Exclude if it matches runId or threadId or is a very short string likely to be a key/id
    if (trimmedObj === runIdToExclude || trimmedObj === threadIdToExclude) {
      console.log(`[Search Exclude] Excluding ID match: ${trimmedObj}`);
      return null;
    }
    // Basic UUID regex to exclude typical IDs
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(trimmedObj)) {
      console.log(`[Search Exclude] Excluding UUID match: ${trimmedObj}`);
      return null;
    }
    if (trimmedObj.length > 20 && !trimmedObj.startsWith("run_") && !trimmedObj.startsWith("thread_")) { // Min length for meaningful content, and not a typical key
      console.log(`[Search Found] Potential content string at depth ${currentDepth}: ${trimmedObj.substring(0,50)}...`);
      return trimmedObj;
    }
  }
  
  // If it's an object, search its properties
  if (obj && typeof obj === 'object') {
    // Check for common content field names first
    const contentFields = [
      'content', 'Post', 'post', 'post_content', 'text', 'message', 'value', 
      'output', 'result', 'response', 'generated_text', 'answer', 'summary', 'report_text', 'article_text',
      // Keys that might appear in human review payloads if not caught by structured extraction
      // 'description' can be too broad, so handled more carefully or by structured parsing
    ];
    
    for (const field of contentFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        const val = obj[field].trim();
        if (val.length > 20 && val !== runIdToExclude && val !== threadIdToExclude) {
          console.log(`[Search Found] In field '${field}' at depth ${currentDepth}: ${val.substring(0,50)}...`);
          return val;
        }
      }
    }
    
    // If it's an array, search each element
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForContent(item, runIdToExclude, threadIdToExclude, maxDepth, currentDepth + 1, visited);
        if (found) return found;
      }
    } else {
      // For general objects, search all properties, avoiding typical ID keys or very short values
      for (const key in obj) {
        // Avoid searching keys that are likely IDs or metadata themselves
        if (key.toLowerCase().includes('id') || key.toLowerCase().includes('status') || key.toLowerCase().includes('type')) continue;
        
        const found = searchForContent(obj[key], runIdToExclude, threadIdToExclude, maxDepth, currentDepth + 1, visited);
        if (found) return found;
      }
    }
  }
  
  return null;
}

// Helper functions to parse image options and relevant links from description string (Markdown format)
function parseImageOptionsFromDescription(description: string): string[] {
  if (!description || typeof description !== 'string') return [];
  const imageOptions: string[] = [];
  // Regex to find "URL: <url>" followed by "Image: <details>...![](<actual_url>)...</details>"
  // Or simpler: "URL: <url>" and assume that's the image option if no direct image markdown follows.
  // Or even simpler, just find all markdown image links: ![](url)
  const markdownImageRegex = /!\[.*?\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownImageRegex.exec(description)) !== null) {
    if (match[1] && !imageOptions.includes(match[1])) {
        imageOptions.push(match[1]);
    }
  }

  // Fallback: Look for lines starting with "URL: http..."
  if (imageOptions.length === 0) {
    const urlLineRegex = /^\s*URL:\s*(https?:\/\/[^\s]+)/gm;
    while ((match = urlLineRegex.exec(description)) !== null) {
        if (match[1] && !imageOptions.includes(match[1])) {
            imageOptions.push(match[1]);
        }
    }
  }
  console.log(`[Parse Description] Found image options:`, imageOptions);
  return imageOptions;
}

function parseRelevantLinksFromDescription(description: string): string[] {
  if (!description || typeof description !== 'string') return [];
  const relevantLinks: string[] = [];
  // Regex to find markdown links: [text](url)
  const markdownLinkRegex = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  
  // Extract URLs from "### Relevant URLs:" section if it exists
  const relevantUrlsSectionMatch = description.match(/### Relevant URLs:([\s\S]*?)(?:###|$)/);
  if (relevantUrlsSectionMatch && relevantUrlsSectionMatch[1]) {
    const sectionContent = relevantUrlsSectionMatch[1];
    while ((match = markdownLinkRegex.exec(sectionContent)) !== null) {
      if (match[1] && !relevantLinks.includes(match[1])) {
        relevantLinks.push(match[1]);
      }
    }
    // Also look for plain URLs in this section
    const plainUrlRegex = /(https?:\/\/[^\s<>"'`]+)/g;
    while ((match = plainUrlRegex.exec(sectionContent)) !== null) {
        if (match[0] && !relevantLinks.includes(match[0])) {
            relevantLinks.push(match[0]);
        }
    }
  }
  
  // If no links found in a specific section, search the whole description (less precise)
  if (relevantLinks.length === 0) {
    while ((match = markdownLinkRegex.exec(description)) !== null) {
         if (match[1] && !relevantLinks.includes(match[1])) {
            relevantLinks.push(match[1]);
        }
    }
  }
  console.log(`[Parse Description] Found relevant links:`, relevantLinks);
  return relevantLinks;
}