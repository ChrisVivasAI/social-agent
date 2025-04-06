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
  ChatInputCommandInteraction 
} from "discord.js";
import { config } from "dotenv";
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
config();

// Get Discord bot token from environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_BOT_TOKEN) {
  console.error("DISCORD_BOT_TOKEN is not defined in environment variables");
  process.exit(1);
}

// Store generated content for approval
type GeneratedPost = {
  content: string;
  url: string;
  timestamp: number;
};

// In-memory store for generated posts (in production, use a database)
const pendingPosts = new Map<string, GeneratedPost>();

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
async function runLangGraphFlow(url: string): Promise<string> {
  try {
    console.log(`Running LangGraph with URL: ${url}`);
    
    // Get the LangGraph API URL
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
    console.log(`Using LangGraph API URL: ${apiUrl}`);
    
    // Create a LangGraph client with type assertion to avoid TypeScript errors
    const client = new LangGraphClient({
      apiUrl,
    }) as any; // Type assertion to avoid TypeScript errors with SDK
    
    console.log("Creating thread...");
    const { thread_id } = await client.threads.create();
    
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
    
    console.log(`Run created with ID: ${runResponse.id}`);
    
    // Wait for the run to complete
    let runStatus;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (polling every 10 seconds)
    
    while (attempts < maxAttempts) {
      attempts++;
      runStatus = await client.runs.get(thread_id, runResponse.id);
      console.log(`Run status (attempt ${attempts}): ${runStatus.status}`);
      
      if (runStatus.status === "completed") {
        break;
      } else if (runStatus.status === "failed") {
        console.error("Run failed:", runStatus.error);
        return `Error: Run failed with error: ${runStatus.error || "Unknown error"}`;
      }
      
      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    if (attempts >= maxAttempts) {
      return "Error: Timed out waiting for content generation.";
    }
    
    // Fetch the generated content from the thread
    console.log("Fetching messages from thread...");
    const messages = await client.threads.messages.list(thread_id);
    
    if (!messages.data || messages.data.length === 0) {
      return "No content was generated. Please check the LangGraph Studio UI for details.";
    }
    
    // Extract text content from the first message
    const message = messages.data[0];
    let content = "";
    
    if (message.content) {
      message.content.forEach((part: any) => {
        if (part.type === "text" && part.text) {
          content += part.text.value + "\n";
        }
      });
    }
    
    return content;
  } catch (error: any) {
    console.error("Error running LangGraph flow:", error);
    return `Error: ${error.message || String(error)}`;
  }
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
    
    // Extract post ID from button custom ID
    const [action, postId] = customId.split('_');
    
    // Get the post from our in-memory store
    const post = pendingPosts.get(postId);
    if (!post) {
      await interaction.reply({ content: "This post is no longer available.", ephemeral: true });
      return;
    }
    
    if (action === 'approve') {
      // Handle approve button
      await interaction.reply({ content: "Post approved! Use `/schedule` to schedule it for publishing.", ephemeral: true });
    } 
    else if (action === 'edit') {
      // Create a modal for editing the post
      const modal = new ModalBuilder()
        .setCustomId(`edit_modal_${postId}`)
        .setTitle('Edit Generated Post');
        
      // Add a text input component
      const contentInput = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Edit the post content:')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(post.content)
        .setRequired(true);
        
      // Add inputs to the modal
      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
      modal.addComponents(firstActionRow);
      
      // Show the modal to the user
      await interaction.showModal(modal);
    }
    else if (action === 'schedule') {
      // Reply with instructions to use the schedule command
      await interaction.reply({
        content: `To schedule this post (ID: \`${postId}\`), use the \`/schedule\` command with the following details:\n`
          + `- Post ID: \`${postId}\`\n`
          + `- Platform: \`twitter\` or \`linkedin\`\n`
          + `- Date: in format \`YYYY-MM-DD\`\n`
          + `- Time: in format \`HH:MM\``,
        ephemeral: true
      });
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
      const postId = interaction.customId.replace('edit_modal_', '');
      const post = pendingPosts.get(postId);
      
      if (!post) {
        await interaction.reply({ content: "This post is no longer available.", ephemeral: true });
        return;
      }
      
      // Get the edited content
      const editedContent = interaction.fields.getTextInputValue('content');
      
      // Update the post in our store
      post.content = editedContent;
      pendingPosts.set(postId, post);
      
      // Respond to the user
      await interaction.reply({ content: "Post updated! Use `/schedule` to schedule it for publishing.", ephemeral: true });
    }
  }
  
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    
    if (commandName === 'generate') {
      // Cast the interaction to ChatInputCommandInteraction to access options
      const url = (interaction as ChatInputCommandInteraction).options.getString('url');
      
      if (!url || !isValidURL(url)) {
        await interaction.reply({ content: "Please provide a valid URL.", ephemeral: true });
        return;
      }
      
      await interaction.deferReply();
      
      try {
        // Run LangGraph flow
        const generatedContent = await runLangGraphFlow(url);
        
        // Check if the content contains an error message
        if (generatedContent.startsWith("Error:")) {
          await interaction.editReply(generatedContent);
          return;
        }
        
        // Generate a post ID
        const postId = generatePostId();
        
        // Store the generated content
        pendingPosts.set(postId, {
          content: generatedContent,
          url,
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
      } catch (error) {
        console.error("Error processing URL:", error);
        await interaction.editReply("Sorry, I encountered an error when generating content. Please try again later.");
      }
    } 
    else if (commandName === 'schedule') {
      const interaction_typed = interaction as ChatInputCommandInteraction;
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
      } catch (error) {
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
                 "• `/help` - Show this help message\n\n" +
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
    const loadingMessage = await message.reply(`Generating content about ${url}, please wait... (this may take several minutes)`);
    
    try {
      // Run LangGraph flow
      const generatedContent = await runLangGraphFlow(url);
      
      // Check if the content contains an error message
      if (generatedContent.startsWith("Error:")) {
        await loadingMessage.edit(generatedContent);
        return;
      }
      
      // Generate a post ID
      const postId = generatePostId();
      
      // Store the generated content
      pendingPosts.set(postId, {
        content: generatedContent,
        url,
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

console.log("Starting Discord bot..."); 