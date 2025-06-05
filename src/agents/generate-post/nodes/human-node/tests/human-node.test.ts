import { jest } from "@jest/globals";

const interrupt = jest.fn();
const processImageInput = jest.fn() as jest.Mock;

jest.unstable_mockModule("../../../../shared/stores/post-subject-urls.js", () => ({
  savePostSubjectUrls: jest.fn(async () => undefined),
}));

jest.unstable_mockModule("../../../../utils.js", () => ({
  isTextOnly: () => false,
  processImageInput,
}));

jest.unstable_mockModule("@langchain/langgraph", () => ({
  END: "END",
  interrupt,
}));

async function loadNode() {
  const mod = await import("../index.js");
  return mod.humanNode as typeof import("../index.js").humanNode;
}

const config = { store: { put: jest.fn(), get: jest.fn() } } as any;

function state() {
  return {
    post: "Post",
    report: "report",
    links: ["link"],
    relevantLinks: [],
    next: undefined,
    userResponse: undefined,
    imageOptions: [],
  } as any;
}

test("invalid date returns unknownResponse", async () => {
  interrupt.mockReturnValue([{ type: "edit", args: { args: { post: "Updated", date: "invalid" } } }]);
  processImageInput.mockReturnValue(Promise.resolve(undefined));
  const humanNode = await loadNode();
  const result = await humanNode(state(), config);
  expect(result.next).toBe("unknownResponse");
  expect(result.userResponse).toMatch(/Invalid date/);
});

test("blacklisted mime returns unknownResponse", async () => {
  interrupt.mockReturnValue([
    { type: "edit", args: { args: { post: "Updated", date: "01/01/2025 10:00 AM PST", image: "bad.svg" } } },
  ]);
  processImageInput.mockReturnValue(Promise.resolve(undefined));
  const humanNode = await loadNode();
  const result = await humanNode(state(), config);
  expect(result.next).toBe("unknownResponse");
  expect(result.userResponse).toMatch(/Unsupported image MIME type/);
});
