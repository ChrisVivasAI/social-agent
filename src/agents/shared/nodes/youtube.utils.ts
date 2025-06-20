import { youtube, youtube_v3 } from "@googleapis/youtube";
import { GoogleAuth } from "google-auth-library";

/**
 * Extracts the videoId from a YouTube video URL.
 * @param url The URL of the YouTube video.
 * @returns The videoId of the YouTube video.
 */
function getVideoID(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get("v");
    if (videoId) {
      return videoId;
    }
  } catch (_) {
    // no-op
  }

  const match = url.match(
    /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/,
  );
  if (match !== null && match[1].length === 11) {
    return match[1];
  } else {
    return undefined;
  }
}

/**
 * Converts ISO 8601 duration to seconds
 * @param duration ISO 8601 duration string (e.g., "PT15M51S")
 * @returns number of seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

function getYouTubeClientFromUrl(): youtube_v3.Youtube {
  if (!process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
    throw new Error("GOOGLE_VERTEX_AI_WEB_CREDENTIALS is not set");
  }
  const parsedGoogleCredentials = JSON.parse(
    process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS,
  );

  const auth = new GoogleAuth({
    credentials: parsedGoogleCredentials,
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
  });

  const youtubeClient = youtube({
    version: "v3",
    auth,
  });

  return youtubeClient;
}

/**
 * Get the duration of a video from a YouTube URL.
 * @param videoUrl The URL of the YouTube video
 * @returns The duration of the video in seconds
 */
export async function getYouTubeVideoDuration(
  videoUrl: string,
): Promise<number | undefined> {
  const youtubeClient = getYouTubeClientFromUrl();
  const videoId = getVideoID(videoUrl);
  if (!videoId) {
    console.error(`Invalid YouTube URL: ${videoUrl}`);
    return undefined;
  }

  try {
    const videoInfo = await youtubeClient.videos.list({
      id: [videoId],
      part: ["contentDetails"],
    });

    if (videoInfo.data.items?.length !== 1) {
      console.error(
        `Unexpected number of items for ${videoId}: ${videoInfo.data.items?.length}`,
      );
      return undefined;
    }

    const duration = videoInfo.data.items[0].contentDetails?.duration;
    return duration ? parseDuration(duration) : undefined;
  } catch (e) {
    console.error(`Failed to fetch duration for ${videoId}:`, e);
    return undefined;
  }
}

/**
 * Gets the highest quality thumbnail URL for a YouTube video.
 * @param videoUrl The URL of the YouTube video
 * @returns A promise that resolves to the URL of the video's thumbnail, or undefined if there's an error
 * @throws Error if the video URL is invalid or if there's an error fetching the thumbnail
 */
export async function getVideoThumbnailUrl(
  videoUrl: string,
): Promise<string | undefined> {
  const youtubeClient = getYouTubeClientFromUrl();
  const videoId = getVideoID(videoUrl);
  if (!videoId) {
    console.error(`Invalid YouTube URL: ${videoUrl}`);
    return undefined;
  }
  try {
    const response = await youtubeClient.videos.list({
      part: ["snippet"],
      id: [videoId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      console.error(`No video found for ID: ${videoId}`);
      return undefined;
    }

    const thumbnails = response.data.items[0].snippet?.thumbnails;
    if (!thumbnails) {
      console.error(`No thumbnails found for video: ${videoId}`);
      return undefined;
    }

    return (
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      undefined
    );
  } catch (e) {
    console.error(`Failed to fetch thumbnails for ${videoId}:`, e);
    return undefined;
  }
}

/**
 * Gets information about the channel that posted a YouTube video.
 * @param videoUrl The URL of the YouTube video
 * @returns An object containing the channel's name and ID
 * @throws Error if the video URL is invalid or if there's an error fetching the channel info
 */
export async function getChannelInfo(
  videoUrl: string,
): Promise<{ channelName: string; channelId: string }> {
  const youtubeClient = getYouTubeClientFromUrl();
  const videoId = getVideoID(videoUrl);
  if (!videoId) {
    console.error(`Invalid YouTube URL: ${videoUrl}`);
    return { channelName: "", channelId: "" };
  }
  try {
    const response = await youtubeClient.videos.list({
      part: ["snippet"],
      id: [videoId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      console.error(`No video found for ID: ${videoId}`);
      return { channelName: "", channelId: "" };
    }

    const snippet = response.data.items[0].snippet;
    if (!snippet) {
      console.error(`No snippet information found for video: ${videoId}`);
      return { channelName: "", channelId: "" };
    }

    const channelName = snippet.channelTitle || "";
    const channelId = snippet.channelId || "";

    if (!channelName || !channelId) {
      console.error(`Could not find channel information for video: ${videoId}`);
      return { channelName: "", channelId: "" };
    }

    return {
      channelName,
      channelId,
    };
  } catch (e) {
    console.error(`Failed to fetch channel info for ${videoId}:`, e);
    return { channelName: "", channelId: "" };
  }
}
