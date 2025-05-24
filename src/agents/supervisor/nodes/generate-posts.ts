import { Client } from "@langchain/langgraph-sdk";
import { SupervisorState } from "../supervisor-state.js";
import { extractUrls } from "../../utils.js";
import { DiscordClient } from "../../../clients/discord/index.js";

export async function generatePosts(
  state: SupervisorState,
): Promise<Partial<SupervisorState>> {
  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const idsAndTypes: Array<{
    type: "thread" | "post";
    thread_id: string;
    run_id: string;
  }> = [];

  for await (const reportAndPostType of state.reportAndPostType) {
    const { thread_id } = await client.threads.create();
    const reportsMapped = reportAndPostType.reports.map((report, index) => {
      if (!reportAndPostType.keyDetails[index]) {
        return report;
      }

      return `# Report Key Details:\n${reportAndPostType.keyDetails[index]}\n\n${report}`;
    });
    if (reportAndPostType.type === "thread") {
      const run = await client.runs.create(thread_id, "generate_thread", {
        input: {
          reports: reportsMapped,
        },
      });

      idsAndTypes.push({
        type: "thread",
        thread_id,
        run_id: run.run_id,
      });
    } else {
      const reportString = reportsMapped.join("\n");
      const linksInReport = extractUrls(reportString);
      const run = await client.runs.create(thread_id, "generate_post", {
        input: {},
        command: {
          goto: "generatePost",
          update: {
            report: reportString,
            links: [linksInReport?.[0] || ""],
            relevantLinks: [linksInReport?.[0] || ""],
          },
        },
      });

      idsAndTypes.push({
        type: "post",
        thread_id,
        run_id: run.run_id,
      });
    }
  }

  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

  if (!discordChannelId && !discordChannelName) {
    console.warn("Discord channel ID or name not provided in environment variables. Skipping notification.");
    return { idsAndTypes };
  }

  const clientArgs: any = {};
  if (discordChannelId) {
    clientArgs.channelId = discordChannelId;
  } else if (discordChannelName) {
    clientArgs.channelName = discordChannelName;
  }
  const discordClient = new DiscordClient(clientArgs);

  const messageText = `*Ingested data successfully processed*
  
Number of threads: *${idsAndTypes.filter((x) => x.type === "thread").length}*
Number of individual posts: *${idsAndTypes.filter((x) => x.type === "post").length}*

Thread post IDs:
${idsAndTypes
  .filter((x) => x.type === "thread")
  .map((x) => `- *${x.thread_id}* : *${x.run_id}*`)
  .join("\n")}
  
Single post IDs:
${idsAndTypes
  .filter((x) => x.type === "post")
  .map((x) => `- *${x.thread_id}* : *${x.run_id}*`)
  .join("\n")}`;

  try {
    await discordClient.sendMessage(messageText);
  } catch (error) {
    console.error("Failed to send Discord notification for processed data:", error);
  }

  return {
    idsAndTypes,
  };
}
