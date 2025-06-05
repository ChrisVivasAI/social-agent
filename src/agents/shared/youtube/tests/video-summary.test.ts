import { jest } from "@jest/globals";

jest.unstable_mockModule("../../nodes/youtube.utils.js", () => ({
  getYouTubeVideoDuration: jest.fn(() => Promise.resolve(undefined)),
  getVideoThumbnailUrl: jest.fn(() => Promise.resolve("thumb")),
  getChannelInfo: jest.fn(() => Promise.resolve({ channelName: "test", channelId: "id" })),
}));

jest.unstable_mockModule("@langchain/google-vertexai-web", () => ({
  ChatVertexAI: jest.fn().mockImplementation(() => ({
    withConfig: () => ({
      invoke: jest.fn(() => Promise.resolve({ content: "summary" })),
    }),
  })),
}));

async function loadModule() {
  const mod = await import("../video-summary.js");
  return mod.getVideoSummary as typeof import("../video-summary.js").getVideoSummary;
}

test("getVideoSummary handles missing duration", async () => {
  process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS = JSON.stringify({ client_email: "x", private_key: "y" });
  const getVideoSummary = await loadModule();
  const result = await getVideoSummary("https://youtube.com/watch?v=abc", true);
  expect(result).toEqual({ thumbnail: "thumb", summary: "summary" });
});
