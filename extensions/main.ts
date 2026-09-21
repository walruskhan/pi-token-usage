import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  DB_PATH,
  dal,
  recordSession,
  recordUsage,
  resetDatabase,
} from "./tracking.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createDashboardServer } from "./api/server.ts";

const execFileAsync = promisify(execFile);
export default function (pi: ExtensionAPI) {
  let sessionId = "";
  let server: ReturnType<typeof createDashboardServer> | undefined;
  pi.on("session_start", async (_event, ctx) => {
    try {
      sessionId = await recordSession(ctx);
    } catch (error) {
      console.error("token-stats: database init failed", error);
    }
  });
  pi.on("message_end", async (event, _ctx) => {
    if (!sessionId) return;
    try {
      await recordUsage(sessionId, event.message);
    } catch (error) {
      console.error("token-stats: usage write failed", error);
    }
  });
  pi.on("session_shutdown", async (_event, _ctx) => {
    if (!sessionId) return;
    try {
      dal.run(
        "UPDATE sessions SET ended_at=datetime('now') WHERE session_id=? AND ended_at IS NULL",
        [sessionId],
      );
    } catch {}
    sessionId = "";
    if (server) {
      server.close();
      server = undefined;
    }
  });
  pi.registerCommand("stats-reset", {
    description: "Clear the local token statistics SQLite database",
    handler: async (_args, ctx) => {
      const confirmed = await ctx.ui.confirm(
        "Reset token statistics?",
        `This permanently deletes all local usage and session records from ${DB_PATH}. This cannot be undone.`,
      );
      if (!confirmed) {
        ctx.ui.notify("Token statistics reset cancelled.", "info");
        return;
      }
      try {
        if (server) {
          server.close();
          server = undefined;
        }
        await resetDatabase();
        await recordSession(ctx);
        ctx.ui.notify("Local token statistics database cleared.", "info");
      } catch (error) {
        ctx.ui.notify(
          `Token statistics reset failed: ${String(error)}`,
          "error",
        );
      }
    },
  });

  pi.registerCommand("stats", {
    description: "Open the persistent token and cost usage dashboard",
    handler: async (_args, ctx) => {
      try {
        await recordSession(ctx);
        if (!server) {
          server = createDashboardServer(dal);
          await new Promise<void>((resolve, reject) => {
            server!.once("error", reject);
            server!.listen(0, "127.0.0.1", () => resolve());
          });
        }
        const address = server.address();
        const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;
        const command =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        await execFileAsync(command, [url]).catch(() => undefined);
        ctx.ui.notify(`Token stats opened at ${url}`, "info");
      } catch (error) {
        ctx.ui.notify(`Token stats failed: ${String(error)}`, "error");
      }
    },
  });
}
