import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from "discord.js";
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
        .addStringOption(option => option.setName('url')
        .setDescription('The URL to generate content from')
        .setRequired(true)),
    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Schedule a post for publishing')
        .addStringOption(option => option.setName('post_id')
        .setDescription('ID of the generated post to schedule')
        .setRequired(true))
        .addStringOption(option => option.setName('platform')
        .setDescription('Platform to post to')
        .setRequired(true)
        .addChoices({ name: 'Twitter', value: 'twitter' }, { name: 'LinkedIn', value: 'linkedin' }))
        .addStringOption(option => option.setName('date')
        .setDescription('Date to publish (YYYY-MM-DD)')
        .setRequired(true))
        .addStringOption(option => option.setName('time')
        .setDescription('Time to publish (HH:MM)')
        .setRequired(true)),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show help information'),
    new SlashCommandBuilder()
        .setName('list')
        .setDescription('List pending posts'),
    new SlashCommandBuilder()
        .setName('check-human-tasks')
        .setDescription('Check for pending human tasks in LangGraph that need your attention'),
];
// Function to validate a URL
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    }
    catch (err) {
        return false;
    }
}
// Function to create interactive buttons for post approval
function createPostActionRow(postId) {
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
    return new ActionRowBuilder()
        .addComponents(approveButton, editButton, scheduleButton, discardButton);
}
// Function to generate a unique post ID
function generatePostId() {
    return Math.random().toString(36).substring(2, 10);
}
// Function to run the LangGraph workflow with proper inputs
async function runLangGraphFlow(url) {
    let thread_id = undefined;
    let run_id = undefined;
    try {
        console.log(`Running LangGraph with URL: ${url}`);
        // Get the LangGraph API URL
        const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
        console.log(`Using LangGraph API URL: ${apiUrl}`);
        // Create a LangGraph client with type assertion to avoid TypeScript errors
        const client = new LangGraphClient({
            apiUrl,
        }); // Type assertion to avoid TypeScript errors with SDK
        console.log("Creating thread...");
        const threadResponse = await client.threads.create();
        if (!threadResponse || !threadResponse.thread_id) {
            console.error("Failed to create thread, no thread_id returned", threadResponse);
            return { status: "failed", error: "Failed to create LangGraph thread." };
        }
        thread_id = threadResponse.thread_id;
        console.log(`Thread created with ID: ${thread_id}`);
        console.log(`Submitting URL: ${url} in links array`);
        // Create input and config objects for better debugging
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
        // Create a run with exactly the same input format as generate-post.ts
        const runResponse = await client.runs.create(thread_id, "generate_post", {
            input,
            config,
        });
        // Check if run creation was successful
        if (!runResponse || (!runResponse.id && !runResponse.run_id)) {
            console.error("Run creation failed, response:", runResponse);
            // Check if the response has a run_id property (different structure)
            run_id = runResponse?.run_id || runResponse?.id;
            if (run_id && thread_id) {
                console.log(`Found run ID in response: ${run_id}`);
                return await pollForCompletion(client, run_id, thread_id);
            }
            // Try a different approach - check if any runs exist for this thread
            console.log("Attempting to list runs for thread...");
            const runs = await client.runs.list(thread_id);
            if (runs && Array.isArray(runs) && runs.length > 0) {
                // Use the most recent run
                console.log(`Found ${runs.length} runs, using the most recent one`);
                const latestRun = runs[0];
                run_id = latestRun.id || latestRun.run_id;
                if (run_id && thread_id) {
                    console.log(`Using run ID: ${run_id}`);
                    return await pollForCompletion(client, run_id, thread_id);
                }
            }
            // throw new Error("Failed to create run and couldn't find existing runs");
            return { status: "failed", error: "Failed to create LangGraph run and couldn't find existing runs.", threadId: thread_id };
        }
        // Extract the run ID using || to handle different response structures
        run_id = runResponse.id || runResponse.run_id;
        console.log(`Run created with ID: ${run_id}`);
        if (thread_id && run_id) {
            return await pollForCompletion(client, run_id, thread_id);
        }
        else {
            // This case should ideally not be reached if previous checks are robust
            return {
                status: "failed",
                error: "Failed to obtain valid thread_id or run_id before polling.",
                threadId: thread_id,
                runId: run_id
            };
        }
    }
    catch (error) {
        console.error("Error running LangGraph flow:", error);
        // return `Error: ${error.message || String(error)}`;
        return {
            status: "failed",
            error: `Error running LangGraph flow: ${error.message || String(error)}`,
            threadId: thread_id, // Include threadId if available
            runId: run_id // Include runId if available
        };
    }
}
// Function to poll for run completion
async function pollForCompletion(client2, runId, threadId) {
    let attempts = 0;
    const maxAttempts = 60; // Poll for a maximum of 60 seconds (60 attempts * 1000ms)
    while (attempts < maxAttempts) {
        try {
            // Log which method we're trying to use for debugging
            console.log(`Polling run ${runId} with threadId ${threadId}, attempt ${attempts + 1}...`);
            let runState;
            // Try different methods to support potential different SDK versions
            try {
                // First try using the .get method (newer SDK versions)
                console.log(`Trying client2.runs.get(threadId, runId)...`);
                runState = await client2.runs.get(threadId, runId);
            }
            catch (methodError) {
                if (methodError.message?.includes("is not a function")) {
                    console.log(`get() method not found. Trying client2.runs.read(runId)...`);
                    // Fallback to the .read method (older SDK versions)
                    runState = await client2.runs.read(runId);
                }
                else {
                    // If it's some other error, rethrow it
                    throw methodError;
                }
            }
            console.log(`Run ${runId} state fetched successfully. Status: ${runState?.status}`);
            if (runState && runState.status === "completed") {
                // Log the full outputs for debugging
                console.log(`Run ${runId} completed. Full outputs:`, JSON.stringify(runState.outputs, null, 2));
                if (runState.outputs) {
                    // Try multiple locations where content might be found
                    if (typeof runState.outputs.content === 'string') {
                        return runState.outputs.content;
                    }
                    else if (typeof runState.outputs.post_content === 'string') {
                        return runState.outputs.post_content;
                    }
                    else if (runState.outputs.values && typeof runState.outputs.values.content === 'string') {
                        return runState.outputs.values.content;
                    }
                    else if (runState.outputs.values && typeof runState.outputs.values.post_content === 'string') {
                        return runState.outputs.values.post_content;
                    }
                    else if (runState.outputs.messages) {
                        console.log(`Run ${runId} completed, but no direct content key found. Using 'messages' from output.`);
                        // Fallback to messages
                        return runState.outputs.messages;
                    }
                    else {
                        console.error(`Run ${runId} completed, but the expected content field (content, post_content, or messages) was not found in the output.`);
                        return {
                            status: "failed",
                            error: `Error: Run completed, but the expected content field was not found in the output. Please check Run ID: ${runId} in LangGraph Studio.`,
                            runId,
                            threadId
                        };
                    }
                }
                else {
                    console.error(`Run ${runId} completed, but no outputs were found.`);
                    return {
                        status: "failed",
                        error: `Error: Run ${runId} completed, but no outputs were found. Please check LangGraph Studio.`,
                        runId,
                        threadId
                    };
                }
            }
            else if (runState && runState.status === "failed") {
                console.error(`Run ${runId} failed. Full state:`, runState);
                return {
                    status: "failed",
                    error: `Run failed with status: ${runState.status}. Check LangGraph Studio for details.`,
                    runId,
                    threadId
                };
            }
            else if (runState && (runState.status === "pending" || runState.status === "streaming")) {
                // Run is still in progress, continue polling
                console.log(`Run ${runId} still in progress with status: ${runState.status}`);
            }
            else if (runState) {
                console.warn(`Run ${runId} has unexpected status: ${runState.status}`);
            }
            else {
                console.warn(`No run state received for run ${runId}.`);
            }
        }
        catch (error) {
            console.error(`Error polling for completion of run ${runId}:`, error);
            if (error.message?.toLowerCase().includes("no run found") || error.status === 404) {
                // Run not found, possibly still being initialized. Continue polling.
                console.log("Run not found (404), continuing to poll...");
            }
            else {
                // For other errors, logged above. Depending on severity, might break or return null.
                // For now, continues polling to see if it's a transient issue.
                console.log("Error caught during polling, continuing to try...");
            }
        }
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    }
    console.warn(`Polling for run ${runId} timed out after ${maxAttempts} attempts.`);
    return {
        status: "timeout",
        error: `Polling timed out after ${maxAttempts} seconds. The operation might still be running. Check LangGraph Studio with Run ID: ${runId}, Thread ID: ${threadId}.`,
        runId,
        threadId
    };
}
// Function to schedule a post (placeholder - would connect to actual posting API)
async function schedulePost(postId, platform, date, time) {
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
        await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commands });
        console.log("Successfully registered application commands.");
    }
    catch (error) {
        console.error("Error registering application commands:", error);
    }
    // Get the default channel if specified
    const defaultChannelId = process.env.DISCORD_DEFAULT_CHANNEL_ID;
    if (defaultChannelId) {
        try {
            const channel = client.channels.cache.get(defaultChannelId);
            if (channel) {
                channel.send("Social Media Agent is now online! Use the `/generate` command or mention me with a URL to generate content.");
            }
        }
        catch (error) {
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
                    components: [] // Remove buttons after selection
                });
            }
            else {
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
            // Handle schedule button - show a modal for scheduling the post
            await handleSchedulePost(interaction, post, postId);
        }
        else if (action === 'discard') {
            // Remove the post from pending posts
            pendingPosts.delete(postId);
            await interaction.reply({ content: "Post discarded.", ephemeral: true });
        }
    }
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('edit_modal_')) {
            // Handle edit modal submission
            await handleEditModalSubmit(interaction);
        }
        else if (interaction.customId.startsWith('schedule_modal_')) {
            // Handle schedule modal submission
            await handleScheduleModalSubmit(interaction);
        }
        else if (interaction.customId.startsWith('image_modal_')) {
            // Handle image modal submission
            await handleImageModalSubmit(interaction);
        }
    }
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'generate') {
            // Cast the interaction to ChatInputCommandInteraction to access options
            const url = interaction.options.getString('url');
            if (!url || !isValidURL(url)) {
                await interaction.reply({ content: "Please provide a valid URL.", ephemeral: true });
                return;
            }
            await interaction.deferReply();
            try {
                // Run LangGraph flow
                const generationResult = await runLangGraphFlow(url);
                // Check if the content contains an error message
                if (generationResult.status === "failed" || generationResult.status === "timeout") {
                    await interaction.editReply(generationResult.error || "An unknown error occurred during content generation.");
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
                    await interaction.editReply(`Your content generation request (Post ID: ${postIdOnError}, Run ID: ${generationResult.runId}, Thread ID: ${generationResult.threadId}) requires human review in LangGraph Studio. ` +
                        `Please go to [Your LangGraph Studio URL, e.g., http://localhost:PORT/threads/${generationResult.threadId}/runs/${generationResult.runId}] to complete the process.`);
                    return;
                }
                // Assuming status is "completed"
                const generatedContent = generationResult.data || "Content could not be extracted.";
                const postId = generatePostId();
                // Store the generated content
                pendingPosts.set(postId, {
                    content: generatedContent,
                    url,
                    threadId: generationResult.threadId || "",
                    runId: generationResult.runId || "",
                    timestamp: Date.now()
                });
                // Create action row with buttons
                const actionRow = createPostActionRow(postId);
                // Format the response
                const response = `**Generated content (ID: ${postId}):**\n\n${generatedContent}\n\nUse the buttons below to approve, edit, schedule, or discard this post.`;
                // Send the response with buttons
                await interaction.editReply({
                    content: response,
                    components: [actionRow]
                });
            }
            catch (error) {
                console.error("Error processing URL:", error);
                await interaction.editReply("Sorry, I encountered an error when generating content. Please try again later.");
            }
        }
        else if (commandName === 'schedule') {
            const interaction_typed = interaction;
            const postId = interaction_typed.options.getString('post_id', true);
            const platform = interaction_typed.options.getString('platform', true);
            const date = interaction_typed.options.getString('date', true);
            const time = interaction_typed.options.getString('time', true);
            // Check if post exists
            if (!pendingPosts.has(postId)) {
                await interaction.reply({ content: `Error: Post with ID ${postId} not found`, ephemeral: true });
                return;
            }
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                await interaction.reply({ content: "Invalid date format. Please use YYYY-MM-DD (e.g. 2023-12-31).", ephemeral: true });
                return;
            }
            // Validate time format (HH:MM)
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!timeRegex.test(time)) {
                await interaction.reply({ content: "Invalid time format. Please use HH:MM (e.g. 14:30).", ephemeral: true });
                return;
            }
            await interaction.deferReply();
            try {
                // Schedule the post
                const result = await schedulePost(postId, platform, date, time);
                await interaction.editReply(result);
            }
            catch (error) {
                console.error("Error scheduling post:", error);
                await interaction.editReply("Sorry, I encountered an error when scheduling the post. Please try again later.");
            }
        }
        else if (commandName === 'help') {
            await interaction.reply({
                content: "**Social Media Agent Commands**\n\n" +
                    "• `/generate <url>` - Generate social media content from a URL\n" +
                    "• `/schedule <post_id> <platform> <date> <time>` - Schedule a post for publishing\n" +
                    "• `/list` - List pending posts\n" +
                    "• `/check-human-tasks` - Check for pending human tasks in LangGraph\n" +
                    "• `/help` - Show this help message\n\n" +
                    "**About Human Review Process:**\n" +
                    "Some posts will require human review in LangGraph Studio before they're completed. " +
                    "When this happens, you'll see a notification and need to check the Studio UI to approve the post.\n\n" +
                    "You can also mention me with a URL to generate content.",
                ephemeral: true
            });
        }
        else if (commandName === 'list') {
            if (pendingPosts.size === 0) {
                await interaction.reply({ content: "No pending posts available.", ephemeral: true });
                return;
            }
            let content = "**Pending Posts:**\n\n";
            pendingPosts.forEach((post, id) => {
                const date = new Date(post.timestamp);
                content += `**ID:** ${id}\n`;
                content += `**Source:** ${post.url}\n`;
                content += `**Created:** ${date.toLocaleString()}\n`;
                content += `**Content Preview:** ${post.content.substring(0, 100)}...\n\n`;
            });
            await interaction.reply({ content, ephemeral: true });
        }
        else if (commandName === 'check-human-tasks') {
            await interaction.deferReply();
            try {
                const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
                const lgClient = new LangGraphClient({
                    apiUrl,
                });
                // Check for pending human tasks
                console.log("Fetching human tasks from LangGraph API...");
                let tasks = [];
                try {
                    // Try the primary method first
                    tasks = await lgClient.runs.listHumanTasks();
                    console.log(`Found ${tasks?.length || 0} tasks using primary method`);
                }
                catch (primaryErr) {
                    console.error("Error with primary human tasks method:", primaryErr);
                    // Try alternative method
                    try {
                        tasks = await lgClient.humanTasks.list();
                        console.log(`Found ${tasks?.length || 0} tasks using alternative method`);
                    }
                    catch (altErr) {
                        console.error("Error with alternative human tasks method:", altErr);
                        // Last resort - try to list runs with requires_action status
                        try {
                            const allRuns = await lgClient.runs.list();
                            tasks = allRuns.filter((run) => run.status === "requires_action" || run.state === "requires_action");
                            console.log(`Found ${tasks?.length || 0} tasks by filtering runs`);
                        }
                        catch (lastErr) {
                            console.error("Error with last resort method:", lastErr);
                            // Continue with empty tasks array
                        }
                    }
                }
                if (tasks && tasks.length > 0) {
                    let taskList = "**Pending Human Tasks:**\n\n";
                    let count = 0;
                    tasks.forEach((task, index) => {
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
                            taskList += `**Details:** ${details}\n\n`;
                            count++;
                            // Discord has message length limits, so limit the number of tasks shown
                            if (count >= 5 && tasks.length > 5) {
                                taskList += `\n*...and ${tasks.length - 5} more tasks. Check LangGraph Studio for complete list.*\n`;
                                return false; // Break out of forEach
                            }
                        }
                        catch (taskErr) {
                            console.error("Error processing task:", taskErr);
                            // Skip this task and continue
                        }
                    });
                    await interaction.editReply({
                        content: taskList + "\n\nTo see and respond to these tasks, visit the LangGraph Studio UI."
                    });
                }
                else {
                    await interaction.editReply("No pending human tasks found.");
                }
            }
            catch (error) {
                console.error("Error checking human tasks:", error);
                await interaction.editReply("Sorry, I encountered an error when checking for human tasks. Please try again later or check the LangGraph Studio UI directly.");
            }
        }
    }
});
// Event handler for message creation (for mentions and direct messages)
client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots (including itself)
    if (message.author.bot)
        return;
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
            }
            else {
                message.reply("Please provide a valid URL. Example: `https://github.com/langchain-ai/social-media-agent`");
                return;
            }
        }
        // Let the user know we're working on it
        const loadingMessage = await message.reply(`Generating content about ${url}, please wait... (this may take several minutes)\n` +
            `Note: If the post goes through human review, you'll need to check LangGraph Studio to approve it.`);
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
                await loadingMessage.edit(`Your content generation request (Post ID: ${postIdOnError}, Run ID: ${generationResult.runId}, Thread ID: ${generationResult.threadId}) requires human review in LangGraph Studio. ` +
                    `Please go to [Your LangGraph Studio URL, e.g., http://localhost:PORT/threads/${generationResult.threadId}/runs/${generationResult.runId}] to complete the process.`);
                return;
            }
            // Assuming status is "completed"
            const generatedContent = generationResult.data || "Content could not be extracted.";
            const postId = generatePostId();
            // Store the generated content
            pendingPosts.set(postId, {
                content: generatedContent,
                url,
                threadId: generationResult.threadId || "",
                runId: generationResult.runId || "",
                timestamp: Date.now()
            });
            // Create action row with buttons
            const actionRow = createPostActionRow(postId);
            // Format the response
            const response = `**Generated content (ID: ${postId}):**\n\n${generatedContent}\n\nUse the buttons below to approve, edit, schedule, or discard this post.`;
            // Edit the loading message with the response and buttons
            await loadingMessage.edit({
                content: response,
                components: [actionRow]
            });
        }
        catch (error) {
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
client.on('error', (error) => {
    if (error.code === 10062) {
        console.warn('Interaction timed out - this is normal for delayed responses');
    }
    else {
        console.error('Discord client error:', error);
    }
});
// Add global unhandled rejection handler for interaction errors
process.on('unhandledRejection', (error) => {
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
async function handleViewDetails(interaction, post, postId) {
    try {
        // Create a series of embeds to show all the information
        const embeds = [];
        // Main post embed
        const mainEmbed = new EmbedBuilder()
            .setTitle('Post Details')
            .setColor('#0099ff')
            .setDescription(post.content)
            .addFields({ name: 'Post ID', value: postId, inline: true }, { name: 'Platform', value: post.platform || 'All', inline: true }, { name: 'Status', value: 'Pending', inline: true }, { name: 'Source URL', value: post.url })
            .setFooter({ text: 'Generated at ' + new Date(post.timestamp).toLocaleString() })
            .setTimestamp();
        if (post.imageUrl) {
            mainEmbed.setImage(post.imageUrl);
        }
        else if (post.imageOptions && post.imageOptions.length > 0) {
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
                .setDescription(post.imageOptions.map((url, index) => `**Option ${index + 1}**: ${url}`).join('\n\n'))
                .setFooter({ text: 'Use the Set Image button to choose one of these images' });
            embeds.push(imagesEmbed);
        }
        // Add a button to close this detailed view
        const closeButton = new ButtonBuilder()
            .setCustomId(`close_details_${postId}`)
            .setLabel('Close Details')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️');
        const actionRow = new ActionRowBuilder()
            .addComponents(closeButton);
        // Reply with all the embeds (ephemeral to avoid cluttering the channel)
        await interaction.reply({
            content: 'Here are the complete details for this post:',
            embeds: embeds,
            components: [actionRow],
            ephemeral: true
        });
    }
    catch (error) {
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
async function handleSetImage(interaction, post, postId) {
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
        const imageUrlRow = new ActionRowBuilder()
            .addComponents(imageUrlInput);
        // If there are image options, show them in the modal
        let optionsDescription = '';
        if (post.imageOptions && post.imageOptions.length > 0) {
            optionsDescription = `Available image options:\n${post.imageOptions.map((url, i) => `${i + 1}. ${url}`).join('\n')}`;
            // Add a description input to show the options (non-editable)
            const optionsInput = new TextInputBuilder()
                .setCustomId('options')
                .setLabel('Available Image Options (Copy an option if desired)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(optionsDescription)
                .setRequired(false);
            const optionsRow = new ActionRowBuilder()
                .addComponents(optionsInput);
            // Add both rows to the modal
            modal.addComponents(imageUrlRow, optionsRow);
        }
        else {
            // Just add the URL input
            modal.addComponents(imageUrlRow);
        }
        // Show the modal to the user
        await interaction.showModal(modal);
    }
    catch (error) {
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
async function handleImageModalSubmit(interaction) {
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
        }
        else {
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
    }
    catch (error) {
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
async function handleEditContent(interaction, post, postId) {
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
                    .setTitle(`Image Option ${i + 1}`)
                    .setColor('#3498db')
                    .setImage(imageUrl)
                    .setDescription(`Use \`{{image${i + 1}}}\` in your post to reference this image`);
                embeds.push(embed);
            }
            // Add a hint about the currently selected image
            let currentImage = "No image selected";
            if (post.imageUrl) {
                const index = post.imageOptions.indexOf(post.imageUrl);
                currentImage = index >= 0 ? `Image Option ${index + 1}` : post.imageUrl;
            }
            // Create buttons for each image
            const buttons = [];
            for (let i = 0; i < maxImages; i++) {
                const imageButton = new ButtonBuilder()
                    .setCustomId(`select_image_${postId}_${i}`)
                    .setLabel(`Use Image ${i + 1}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🖼️');
                buttons.push(imageButton);
            }
            // Group buttons in rows (max 5 buttons per row)
            const actionRow = new ActionRowBuilder()
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
                    post.imageOptions.slice(0, 5).map((_, i) => `- {{image${i + 1}}}: Image Option ${i + 1}`).join('\n');
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
                `Currently using Image Option ${index + 1}` :
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
            .setValue('• Use {{image1}}, {{image2}}, etc. to reference specific images\n' +
            '• You can set an image using the "Set Image" button too\n' +
            '• Add instructions above if you want AI help rewriting')
            .setRequired(false);
        // Add inputs to the modal
        const contentRow = new ActionRowBuilder().addComponents(contentInput);
        const instructionsRow = new ActionRowBuilder().addComponents(instructionsInput);
        const imageNoteRow = new ActionRowBuilder().addComponents(imageNoteInput);
        const helpRow = new ActionRowBuilder().addComponents(helpInput);
        modal.addComponents(contentRow, instructionsRow, imageNoteRow, helpRow);
        // Show the modal to the user
        // If we already replied with an ephemeral message, we need to use followUp
        if (post.imageOptions && post.imageOptions.length > 0) {
            await interaction.followUp({
                content: 'Now opening the edit modal...',
                ephemeral: true
            });
            await interaction.showModal(modal);
        }
        else {
            await interaction.showModal(modal);
        }
    }
    catch (error) {
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
async function handleEditModalSubmit(interaction) {
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
        }
        catch (e) {
            // Ignore error if the field doesn't exist
        }
        if (instructions && instructions.trim() !== '') {
            // If there are rewrite instructions, we need to submit them to the LangGraph flow
            // But for now, just acknowledge the request and update the content
            await interaction.reply({
                content: 'Content updated with your edits. Note: Rewrite instructions were provided but this feature is not fully implemented yet.',
                ephemeral: true
            });
        }
        else {
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
    }
    catch (error) {
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
async function refreshPostDisplay(interaction, post, postId) {
    try {
        // Try to find the original message
        const message = await interaction.channel.messages.fetch(interaction.message?.id || interaction.message?.reference?.messageId);
        if (!message) {
            console.warn('Could not find original message to refresh');
            return;
        }
        // Format the schedule date if it exists
        let scheduleDisplay = "Not scheduled";
        if (post.scheduleDate) {
            const options = {
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
            }
            else {
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
            .addFields({ name: 'Post ID', value: postId, inline: true }, { name: 'Platform', value: post.platform || 'Twitter/LinkedIn', inline: true }, { name: 'Scheduled For', value: scheduleDisplay, inline: true }, { name: 'Original URL', value: post.url })
            .setFooter({ text: 'Edited at ' + new Date().toLocaleString() })
            .setTimestamp();
        // Add image preview if available
        if (post.imageUrl) {
            embed.setImage(post.imageUrl);
        }
        else if (post.imageOptions && post.imageOptions.length > 0) {
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
    }
    catch (error) {
        console.error('Error refreshing post display:', error);
        // Don't reply with an error message here, as we've already replied to the interaction
    }
}
/**
 * Handles the schedule button interaction
 * Shows a modal for scheduling the post
 */
async function handleSchedulePost(interaction, post, postId) {
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
                }
                else {
                    // Try to parse the date string
                    try {
                        const date = new Date(post.scheduleDate);
                        defaultDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
                        defaultTime = date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
                    }
                    catch (e) {
                        // If parsing fails, just use the string as is
                        defaultDate = post.scheduleDate;
                    }
                }
            }
            else {
                // It's a Date object
                defaultDate = post.scheduleDate.toISOString().split('T')[0]; // YYYY-MM-DD
                defaultTime = post.scheduleDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
            }
        }
        else {
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
        const platformRow = new ActionRowBuilder().addComponents(platformInput);
        const dateRow = new ActionRowBuilder().addComponents(dateInput);
        const timeRow = new ActionRowBuilder().addComponents(timeInput);
        const notesRow = new ActionRowBuilder().addComponents(notesInput);
        // Create a help/info section explaining priority levels
        const helpInput = new TextInputBuilder()
            .setCustomId('help')
            .setLabel('Priority Guide (Read Only)')
            .setStyle(TextInputStyle.Paragraph)
            .setValue('Priority Levels (optional):\n' +
            'P1: High priority - Weekend mornings (8-10 AM)\n' +
            'P2: Medium priority - Weekday mornings or weekend afternoons\n' +
            'P3: Low priority - Weekend evenings\n\n' +
            'Note: Using a priority level will override any time you select.')
            .setRequired(false);
        const helpRow = new ActionRowBuilder().addComponents(helpInput);
        // Add all rows to the modal (max 5 components)
        modal.addComponents(platformRow, dateRow, timeRow, notesRow, helpRow);
        // Show the modal to the user
        await interaction.showModal(modal);
    }
    catch (error) {
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
async function handleScheduleModalSubmit(interaction) {
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
        }
        catch (e) {
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
        const options = {
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
            }); // Type assertion to avoid TypeScript errors with SDK
            // Only create an actual schedule if this is a specific date (not priority levels like P1, P2, P3)
            if (typeof post.scheduleDate === 'object') {
                // Create a cron job for the scheduled post
                // We use a one-time cron format: minute hour day month day-of-week
                // JavaScript months are 0-indexed, but cron months are 1-indexed
                const cronDate = post.scheduleDate;
                const cronMinute = cronDate.getMinutes();
                const cronHour = cronDate.getHours();
                const cronDay = cronDate.getDate();
                const cronMonth = cronDate.getMonth() + 1; // Add 1 to convert to 1-indexed month
                const cronExpression = `${cronMinute} ${cronHour} ${cronDay} ${cronMonth} *`;
                // Schedule the post
                console.log(`Scheduling post with cron expression: ${cronExpression}`);
                const scheduleResult = await lgClient.runs.schedule("publish_post", {
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
                console.log("LangGraph schedule call result:", JSON.stringify(scheduleResult, null, 2));
                let scheduleTrackingId = "N/A";
                let successMessage = `Post scheduling action was successful for ${platform} on ${scheduleString}. Please monitor LangGraph Studio for the scheduled run.`;
                // Extract the schedule/run ID from the response (attempting multiple common field names)
                if (scheduleResult) {
                    if (scheduleResult.id) {
                        scheduleTrackingId = scheduleResult.id;
                    }
                    else if (scheduleResult.scheduled_id) {
                        scheduleTrackingId = scheduleResult.scheduled_id;
                    }
                    else if (scheduleResult.schedule_id) {
                        scheduleTrackingId = scheduleResult.schedule_id;
                    }
                    else if (scheduleResult.scheduled_run_id) {
                        scheduleTrackingId = scheduleResult.scheduled_run_id;
                    }
                    else if (scheduleResult.run_id) {
                        scheduleTrackingId = scheduleResult.run_id;
                    }
                    else {
                        // Try to find an ID field in the response
                        const potentialIdFields = Object.keys(scheduleResult).filter(key => key.toLowerCase().includes('id') &&
                            typeof scheduleResult[key] === 'string');
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
                }
                else {
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
            }
            else {
                // This is a priority level - store in database but don't schedule a run yet
                // For now, just simulate success
                await interaction.editReply({
                    content: `Post added to queue with priority level ${dateStr.toUpperCase()} for ${platform}.`
                });
                // Refresh the post display
                await refreshPostDisplay(interaction, post, postId);
            }
        }
        catch (error) {
            console.error("Error scheduling post:", error);
            await interaction.editReply({
                content: `Error scheduling post: ${error?.message || "Unknown error"}`
            });
        }
    }
    catch (error) {
        console.error('Error handling schedule modal submit:', error);
        await interaction.reply({
            content: 'There was an error scheduling the post. Please try again.',
            ephemeral: true
        });
    }
}
