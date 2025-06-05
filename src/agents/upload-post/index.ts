import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { TwitterClient } from "../../clients/twitter/client.js";
import {
  imageUrlToBuffer,
  isTextOnly,
  shouldPostToLinkedInOrg,
  shouldPostToInstagram,
  shouldPostToFacebook,
  removeUrls,
} from "../utils.js";
import { CreateMediaRequest } from "../../clients/twitter/types.js";
import { LinkedInClient } from "../../clients/linkedin.js";
import { InstagramClient } from "../../clients/instagram.js";
import { FacebookClient } from "../../clients/facebook.js";
import { ImageProcessor } from "../../utils/imageProcessor.js";
import { createSupabaseClient } from "../../utils/supabase.js";
import {
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_ORGANIZATION_ID,
  LINKEDIN_PERSON_URN,
  POST_TO_LINKEDIN_ORGANIZATION,
  POST_TO_INSTAGRAM,
  POST_TO_FACEBOOK,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";
import { DiscordClient } from "../../clients/discord/index.js";

async function getMediaFromImage(image?: {
  imageUrl: string;
  mimeType: string;
}): Promise<CreateMediaRequest | undefined> {
  if (!image) return undefined;
  const { buffer, contentType } = await imageUrlToBuffer(image.imageUrl);
  return {
    media: buffer,
    mimeType: contentType,
  };
}

/**
 * Extract a smart, meaningful title from post content for Instagram image overlay (max 5 words)
 * Uses pattern recognition to create punchy, contextual headlines
 */
function extractSmartInstagramTitle(postContent: string): string {
  // Remove URLs first to get clean content
  let cleanContent = removeUrls(postContent);
  
  // Remove excessive emojis but keep basic punctuation and apostrophes
  cleanContent = cleanContent.replace(/[^\w\s\-.,!?']/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Convert to lowercase for pattern matching, but keep original for final result
  const lowerContent = cleanContent.toLowerCase();
  
  // Pattern 1: Brand + Product (e.g., "Anthropic's MCP", "Claude's features")
  const brandProductMatch = cleanContent.match(/(\w+(?:'s)?)\s+(MCP|Claude|LLM|API|GPT|AI|ML)\b/i);
  if (brandProductMatch) {
    const brand = brandProductMatch[1];
    const product = brandProductMatch[2];
    
    // Look for action words nearby
    if (lowerContent.includes('upgrade') || lowerContent.includes('update')) {
      return `${brand} ${product} Upgrade`;
    }
    if (lowerContent.includes('new') || lowerContent.includes('launch')) {
      return `New ${brand} ${product}`;
    }
    if (lowerContent.includes('faster') || lowerContent.includes('performance')) {
      return `${brand} ${product} Boost`;
    }
    return `${brand} ${product} Update`;
  }
  
  // Pattern 2: "New X" or "Latest X"
  const newFeatureMatch = cleanContent.match(/\b(new|latest|updated?)\s+(\w+(?:\s+\w+)?)\b/i);
  if (newFeatureMatch) {
    const modifier = newFeatureMatch[1];
    const feature = newFeatureMatch[2];
    return `${modifier} ${feature}`.split(' ').slice(0, 4).join(' ');
  }
  
  // Pattern 3: Performance/Speed improvements
  if (lowerContent.includes('faster') || lowerContent.includes('speed') || lowerContent.includes('performance')) {
    if (lowerContent.includes('llm')) return 'Faster LLM Performance';
    if (lowerContent.includes('api')) return 'Faster API Performance';
    return 'Performance Upgrade';
  }
  
  // Pattern 4: "X just Y" → "X Y"
  const justActionMatch = cleanContent.match(/(\w+(?:'s)?)\s+just\s+(went|got|launched|released|updated)/i);
  if (justActionMatch) {
    const subject = justActionMatch[1];
    const action = justActionMatch[2];
    if (action.toLowerCase() === 'went') return `${subject} Upgrade`;
    if (action.toLowerCase() === 'got') return `${subject} Enhanced`;
    return `${subject} ${action}`;
  }
  
  // Pattern 5: Technology announcements
  if (lowerContent.includes('mcp')) {
    if (lowerContent.includes('anthropic')) return "Anthropic's MCP Update";
    return 'MCP Enhancement';
  }
  
  if (lowerContent.includes('claude')) {
    if (lowerContent.includes('upgrade') || lowerContent.includes('update')) return 'Claude Upgrade';
    if (lowerContent.includes('new')) return 'New Claude Features';
    return 'Claude Enhancement';
  }
  
  // Pattern 6: Fallback - extract first meaningful phrase
  const words = cleanContent.split(/\s+/).filter(word => word.length > 0);
  
  // Remove common stop words but keep important ones
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'now', 'here', 'there', 'when', 'where', 'why', 'how'
  ]);
  
  const meaningfulWords = words.filter(word => 
    !stopWords.has(word.toLowerCase()) && word.length > 1
  ).slice(0, 5);
  
  if (meaningfulWords.length === 0) {
    return 'Tech Update';
  }
  
  // Capitalize first letter of each word for title case
  const titleWords = meaningfulWords.map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
  
  return titleWords.join(' ');
}

/**
 * Process caption for Instagram by removing links
 */
function processInstagramCaption(caption: string): string {
  return removeUrls(caption);
}

/**
 * Process image for Instagram: download, convert to 4:3 with title, upload to Supabase
 */
async function processImageForInstagram(imageUrl: string, title: string): Promise<string> {
  try {
    console.log(`🖼️ Processing image for Instagram: ${imageUrl}`);
    
    // Download the original image
    const { buffer } = await imageUrlToBuffer(imageUrl);
    
    // Process image to 4:3 aspect ratio with title overlay
    const processedResult = await ImageProcessor.processImageFor43AspectRatio(
      buffer,
      {
        title,
        titlePosition: 'bottom',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleColor: '#ffffff',
        fontSize: 42
      }
    );
    
    // Upload processed image to Supabase
    const supabase = createSupabaseClient();
    const fileName = `instagram_processed_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(fileName, processedResult.buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(data.path);

    console.log(`✅ Instagram image processed and uploaded: ${urlData.publicUrl}`);
    console.log(`   📏 Processed to: ${processedResult.width}x${processedResult.height} (4:3 ratio)`);
    console.log(`   🏷️ Title overlay: "${title}"`);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Failed to process image for Instagram:', error);
    // Fallback to original image if processing fails
    console.log('⚠️ Falling back to original image');
    return imageUrl;
  }
}

/**
 * Process image for Instagram: download, convert to 3:4 with title, upload to Supabase
 */
async function processImageForInstagram34(imageUrl: string, title: string): Promise<string> {
  try {
    console.log(`🖼️ Processing image for Instagram (3:4): ${imageUrl}`);
    
    // Download the original image
    const { buffer } = await imageUrlToBuffer(imageUrl);
    
    // Import Sharp dynamically
    const sharp = (await import('sharp')).default;
    
    // Get original image metadata
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    if (originalWidth === 0 || originalHeight === 0) {
      throw new Error('Invalid image dimensions');
    }

    // Target dimensions for 3:4 aspect ratio (portrait)
    const targetWidth = 900;
    const targetHeight = 1200;
    const targetAspectRatio = 3 / 4; // 0.75
    const originalAspectRatio = originalWidth / originalHeight;

    let processedBuffer: Buffer;

    if (Math.abs(originalAspectRatio - targetAspectRatio) < 0.01) {
      // Image is already close to 3:4, just resize
      processedBuffer = await sharp(buffer)
        .resize(targetWidth, targetHeight, { fit: 'fill' })
        .jpeg({ quality: 90 })
        .toBuffer();
    } else {
      // Need to add black bars (letterboxing)
      let resizeWidth: number;
      let resizeHeight: number;

      if (originalAspectRatio > targetAspectRatio) {
        // Image is wider than 3:4, add black bars on top and bottom
        resizeWidth = targetWidth;
        resizeHeight = Math.round(targetWidth / originalAspectRatio);
      } else {
        // Image is taller than 3:4, add black bars on left and right
        resizeHeight = targetHeight;
        resizeWidth = Math.round(targetHeight * originalAspectRatio);
      }

      // Resize the image
      const resizedBuffer = await sharp(buffer)
        .resize(resizeWidth, resizeHeight, { fit: 'fill' })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Create a black background and composite the resized image
      processedBuffer = await sharp({
        create: {
          width: targetWidth,
          height: targetHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite([{
        input: resizedBuffer,
        left: Math.round((targetWidth - resizeWidth) / 2),
        top: Math.round((targetHeight - resizeHeight) / 2)
      }])
      .jpeg({ quality: 90 })
      .toBuffer();
    }

    // Add title overlay using canvas
    if (title) {
      processedBuffer = await addTitleOverlayToImage(processedBuffer, title, targetWidth, targetHeight);
    }
    
    // Upload processed image to Supabase
    const supabase = createSupabaseClient();
    const fileName = `instagram_34_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(fileName, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(data.path);

    console.log(`✅ Instagram image processed and uploaded: ${urlData.publicUrl}`);
    console.log(`   📏 Processed to: ${targetWidth}x${targetHeight} (3:4 ratio)`);
    console.log(`   🏷️ Title overlay: "${title}"`);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Failed to process image for Instagram:', error);
    // Fallback to original image if processing fails
    console.log('⚠️ Falling back to original image');
    return imageUrl;
  }
}

/**
 * Add title overlay to an image using canvas
 */
async function addTitleOverlayToImage(
  imageBuffer: Buffer,
  title: string,
  width: number,
  height: number
): Promise<Buffer> {
  try {
    // Dynamic import for canvas to handle ES modules
    const { createCanvas, loadImage } = await import('canvas');
    
    // Load the image
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw the original image
    ctx.drawImage(image, 0, 0, width, height);

    // Set up text properties
    const fontSize = 68;
    const fontFamily = 'Arial';
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Calculate text area
    const maxWidth = width * 0.9; // 90% of image width
    const words = title.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    // Word wrap
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate text area height
    const lineHeight = fontSize * 1.2;
    const textAreaHeight = lines.length * lineHeight;
    const padding = 20;

    // Position text at bottom
    const textY = height - padding - textAreaHeight / 2;
    const backgroundY = height - textAreaHeight - padding * 2;
    const backgroundHeight = textAreaHeight + padding * 2;

    // Draw background rectangle with transparency
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, backgroundY, width, backgroundHeight);

    // Draw text lines
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, index) => {
      const lineY = textY - (lines.length - 1) * lineHeight / 2 + index * lineHeight;
      ctx.fillText(line, width / 2, lineY);
    });

    // Convert canvas to buffer
    return canvas.toBuffer('image/jpeg', { quality: 0.9 });
  } catch (error) {
    console.error('Error adding title overlay:', error);
    // If canvas fails, return the original image
    return imageBuffer;
  }
}

const UploadPostAnnotation = Annotation.Root({
  post: Annotation<string>,
  image: Annotation<
    | {
        imageUrl: string;
        mimeType: string;
      }
    | undefined
  >,
});

const UploadPostGraphConfiguration = Annotation.Root({
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * Whether to post to Instagram.
   * Requires INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID environment variables.
   * @default false
   */
  [POST_TO_INSTAGRAM]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
  /**
   * Whether to post to Facebook.
   * Requires FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables.
   * @default false
   */
  [POST_TO_FACEBOOK]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
  /**
   * Whether or not to use text only mode throughout the graph.
   * If true, it will not try to extract, validate, or upload images.
   * Additionally, it will not be able to handle validating YouTube videos.
   * @default false
   */
  [TEXT_ONLY_MODE]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
});

interface PostUploadFailureToDiscordArgs {
  uploadDestination: "twitter" | "linkedin" | "instagram" | "facebook";
  error: any;
  threadId: string;
  postContent: string;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function postUploadFailureToDiscord({
  uploadDestination,
  error,
  threadId,
  postContent,
  image,
}: PostUploadFailureToDiscordArgs) {
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (!discordChannelId && !discordChannelName) {
    console.warn(
      "No DISCORD_CHANNEL_ID or DISCORD_CHANNEL_NAME found in environment variables. Cannot send error message to Discord.",
    );
    return;
  }
  const clientArgs: any = {};
  if (discordChannelId) {
    clientArgs.channelId = discordChannelId;
  } else if (discordChannelName) {
    clientArgs.channelName = discordChannelName;
  }
  const discordClient = new DiscordClient(clientArgs);
  
  const discordMessageContent = `❌ FAILED TO UPLOAD POST TO ${uploadDestination.toUpperCase()} ❌

Error message:
\`\`\`
${error}
\`\`\`

Thread ID: *${threadId}*

Post:
\`\`\`
${postContent}
\`\`\`

${image ? `Image:\nURL: ${image.imageUrl}\nMIME type: ${image.mimeType}` : ""}
`;
  try {
    await discordClient.sendMessage(discordMessageContent);
  } catch (discordError) {
    console.error("Failed to send upload failure notification to Discord:", discordError);
  }
}

export async function uploadPost(
  state: typeof UploadPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof UploadPostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post text found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);
  const postToInstagram = shouldPostToInstagram(config);
  const postToFacebook = shouldPostToFacebook(config);

  try {
    let twitterClient: TwitterClient;
    const useArcadeAuth = process.env.USE_ARCADE_AUTH;
    const useTwitterApiOnly = process.env.USE_TWITTER_API_ONLY;

    if (useTwitterApiOnly === "true" || useArcadeAuth !== "true") {
      twitterClient = TwitterClient.fromBasicTwitterAuth();
    } else {
      const twitterUserId = process.env.TWITTER_USER_ID;
      if (!twitterUserId) {
        throw new Error("Twitter user ID not found in configurable fields.");
      }

      const twitterToken = process.env.TWITTER_USER_TOKEN;
      const twitterTokenSecret = process.env.TWITTER_USER_TOKEN_SECRET;

      twitterClient = await TwitterClient.fromArcade(
        twitterUserId,
        {
          twitterToken,
          twitterTokenSecret,
        },
        {
          textOnlyMode: isTextOnlyMode,
        },
      );
    }

    let mediaBuffer: CreateMediaRequest | undefined = undefined;
    if (!isTextOnlyMode) {
      mediaBuffer = await getMediaFromImage(state.image);
    }

    await twitterClient.uploadTweet({
      text: state.post,
      ...(mediaBuffer && { media: mediaBuffer }),
    });
    console.log("✅ Successfully uploaded Tweet ✅");
  } catch (e: any) {
    console.error("Failed to upload post:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = String(e);
    }
    await postUploadFailureToDiscord({
      uploadDestination: "twitter",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.post,
      image: state.image,
    });
  }

  try {
    let linkedInClient: LinkedInClient;

    const useArcadeAuth = process.env.USE_ARCADE_AUTH;
    if (useArcadeAuth === "true") {
      const linkedInUserId = process.env.LINKEDIN_USER_ID;
      if (!linkedInUserId) {
        throw new Error("LinkedIn user ID not found in configurable fields.");
      }

      linkedInClient = await LinkedInClient.fromArcade(linkedInUserId, {
        postToOrganization: postToLinkedInOrg,
      });
    } else {
      const accessToken =
        process.env.LINKEDIN_ACCESS_TOKEN ||
        config.configurable?.[LINKEDIN_ACCESS_TOKEN];
      if (!accessToken) {
        throw new Error(
          "LinkedIn access token not found in environment or configurable fields. Either set it, or use Arcade Auth.",
        );
      }

      const personUrn =
        process.env.LINKEDIN_PERSON_URN ||
        config.configurable?.[LINKEDIN_PERSON_URN];
      const organizationId =
        process.env.LINKEDIN_ORGANIZATION_ID ||
        config.configurable?.[LINKEDIN_ORGANIZATION_ID];

      if (!postToLinkedInOrg && !personUrn) {
        throw new Error(
          "LinkedIn person URN not found. Either set it, use Arcade Auth, or post to an organization."
        );
      }
      if (postToLinkedInOrg && !organizationId) {
        throw new Error(
          "LinkedIn organization ID not found. Either set it, use Arcade Auth, or post to a person."
        );
      }

      linkedInClient = new LinkedInClient({
        accessToken: accessToken,
        personUrn: personUrn,
        organizationId: organizationId,
      });
    }

    if (!isTextOnlyMode && state.image) {
      await linkedInClient.createImagePost(
        {
          text: state.post,
          imageUrl: state.image.imageUrl,
        },
        {
          postToOrganization: postToLinkedInOrg,
        },
      );
    } else {
      await linkedInClient.createTextPost(state.post, {
        postToOrganization: postToLinkedInOrg,
      });
    }

    console.log("✅ Successfully uploaded post to LinkedIn ✅");
  } catch (e: any) {
    console.error("Failed to upload post to LinkedIn:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = String(e);
    }
    await postUploadFailureToDiscord({
      uploadDestination: "linkedin",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.post,
      image: state.image,
    });
  }

  // Instagram posting
  if (postToInstagram) {
    try {
      const instagramAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
      const instagramBusinessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

      if (!instagramAccessToken || !instagramBusinessAccountId) {
        throw new Error(
          "Instagram access token and business account ID are required for Instagram posting. Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID environment variables."
        );
      }

      if (isTextOnlyMode) {
        console.warn("⚠️ Instagram posting skipped: Text-only mode is enabled but Instagram requires images");
      } else if (!state.image) {
        console.warn("⚠️ Instagram posting skipped: No image provided but Instagram requires images");
      } else {
        // Extract title from post content for image overlay
        const title = extractSmartInstagramTitle(state.post);
        console.log(`📝 Extracted short title for Instagram: "${title}"`);
        
        // Process image for Instagram (3:4 aspect ratio + title overlay)
        const processedImageUrl = await processImageForInstagram34(state.image.imageUrl, title);
        
        // Process caption for Instagram (remove links)
        const instagramCaption = processInstagramCaption(state.post);
        console.log(`📱 Instagram caption processed (${instagramCaption.length} chars, links removed)`);
        
        const instagramClient = new InstagramClient({
          accessToken: instagramAccessToken,
          pageId: instagramBusinessAccountId,
        });

        await instagramClient.postImageSimple({
          imageUrl: processedImageUrl,
          caption: instagramCaption,
        });

        console.log("✅ Successfully uploaded post to Instagram ✅");
      }
    } catch (e: any) {
      console.error("Failed to upload post to Instagram:", e);
      let errorString = "";
      if (typeof e === "object" && "message" in e) {
        errorString = e.message;
      } else {
        errorString = String(e);
      }
      await postUploadFailureToDiscord({
        uploadDestination: "instagram",
        error: errorString,
        threadId:
          config.configurable?.thread_id || "no thread id found in configurable",
        postContent: state.post,
        image: state.image,
      });
    }
  }

  // Facebook posting
  if (postToFacebook) {
    try {
      const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;
      const facebookPageId = process.env.FACEBOOK_PAGE_ID;

      if (!facebookAccessToken || !facebookPageId) {
        throw new Error(
          "Facebook access token and page ID are required for Facebook posting. Please set FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables."
        );
      }

      const facebookClient = new FacebookClient({
        accessToken: facebookAccessToken,
        pageId: facebookPageId,
      });

      if (!isTextOnlyMode && state.image) {
        await facebookClient.postToPage({
          message: state.post,
          imageUrl: state.image.imageUrl,
        });
      } else {
        await facebookClient.postToPage({
          message: state.post,
        });
      }

      console.log("✅ Successfully uploaded post to Facebook ✅");
    } catch (e: any) {
      console.error("Failed to upload post to Facebook:", e);
      let errorString = "";
      if (typeof e === "object" && "message" in e) {
        errorString = e.message;
      } else {
        errorString = String(e);
      }
      await postUploadFailureToDiscord({
        uploadDestination: "facebook",
        error: errorString,
        threadId:
          config.configurable?.thread_id || "no thread id found in configurable",
        postContent: state.post,
        image: state.image,
      });
    }
  }

  return {};
}

const uploadPostWorkflow = new StateGraph(
  UploadPostAnnotation,
  UploadPostGraphConfiguration,
)
  .addNode("uploadPost", uploadPost)
  .addEdge(START, "uploadPost")
  .addEdge("uploadPost", END);

export const uploadPostGraph = uploadPostWorkflow.compile();
(uploadPostGraph as any).name = "Upload Post Graph";