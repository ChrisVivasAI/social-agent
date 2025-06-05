import { getYouTubeVideoDuration } from "../youtube.utils.js";

const dummyCreds = JSON.stringify({ client_email: "test@test.com", private_key: "dummy" });

beforeAll(() => {
  process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS = dummyCreds;
});

test("getYouTubeVideoDuration returns undefined for invalid URL", async () => {
  const result = await getYouTubeVideoDuration("https://example.com");
  expect(result).toBeUndefined();
});
