import "dotenv/config";
import { schedulePost } from "../src/agents/generate-post/nodes/schedule-post/index.js";
import { GeneratePostAnnotation } from "../src/agents/generate-post/generate-post-state.js";

/**
 * Test the enhanced schedule-post function directly
 */
async function testSchedulePostDirect() {
  console.log('🧪 Testing Enhanced Schedule-Post Function Directly...\n');

  // Create a mock state
  const mockState: typeof GeneratePostAnnotation.State = {
    post: "This is a test post for the enhanced schedule-post function! 🚀",
    scheduleDate: new Date("2024-12-25T10:00:00-08:00"),
    links: ["https://example.com/test"],
    relevantLinks: ["https://example.com/test"],
    imageOptions: [
      "https://i.ytimg.com/vi/test/maxresdefault.jpg",
      "https://example.com/image2.jpg"
    ],
    report: "This is a test report for the enhanced functionality.",
    condenseCount: 0,
    userResponse: undefined,
    next: undefined,
    image: undefined,
    pageContents: []
  };

  // Create a mock config
  const mockConfig = {
    configurable: {
      postToInstagram: true,
      postToFacebook: true,
      textOnlyMode: false
    }
  };

  try {
    console.log('🚀 Calling enhanced schedulePost function directly...');
    const result = await schedulePost(mockState, mockConfig as any);
    console.log('✅ Enhanced schedulePost completed successfully!');
    console.log('📊 Result:', result);
  } catch (error) {
    console.error('❌ Enhanced schedulePost failed:', error);
    console.error('📋 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the test
testSchedulePostDirect().catch(console.error); 