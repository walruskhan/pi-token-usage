import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";
import { SqliteDAL } from "./dal/sqlite.ts";
import { nonNegativeNumber, number } from "./utils/numbers.ts";
import { timestamp } from "./utils/time.ts";

export const DB_PATH = join(
  process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
  "token-usage.sqlite",
);
const EXTENSION_VERSION = 1;
export const dal = new SqliteDAL(DB_PATH);

type Usage = {
  input?: number;
  output?: number;
  reasoning?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

function runPrepared(sql: string, params: unknown[]): void {
  dal.run(sql, params);
}

export async function resetDatabase(): Promise<void> {
  await dal.reset();
}

export async function recordSession(ctx: ExtensionContext): Promise<string> {
  dal.initialize();
  const sessionId = ctx.sessionManager.getSessionId();
  const sessionFile = ctx.sessionManager.getSessionFile() || "";
  runPrepared(
    `INSERT INTO sessions(session_id, session_file, cwd, started_at, extension_version)
    VALUES(?, ?, ?, datetime('now'), ?)
    ON CONFLICT(session_id) DO UPDATE SET session_file=excluded.session_file, cwd=excluded.cwd`,
    [sessionId, sessionFile, ctx.cwd, EXTENSION_VERSION],
  );
  for (const entry of ctx.sessionManager.getEntries() as any[]) {
    if (entry.type === "message") await recordUsage(sessionId, entry.message);
    else if (
      entry.type === "usage" ||
      entry.type === "compaction" ||
      entry.type === "branch_summary"
    ) {
      if (entry.usage)
        await recordUsage(
          sessionId,
          { ...entry, id: entry.id },
          entry.kind || entry.type,
        );
    }
  }
  return sessionId;
}

export async function recordUsage(
  sessionId: string,
  message: any,
  source = "assistant",
): Promise<void> {
  const usage: Usage | undefined = message?.usage;
  if (!usage) return;
  const provider = String(message.provider || "unknown");
  const model = String(message.model || message.responseModel || "unknown");
  const occurredAt = timestamp(message.timestamp || Date.now());
  const eventKey = `${sessionId}:${message.responseId || `${message.id || occurredAt}:${provider}:${model}:${number(usage.totalTokens)}:${source}`}`;
  const cost = usage.cost || {};
  runPrepared(
    `INSERT OR IGNORE INTO usage_events(
    event_key, session_id, occurred_at, provider, model, api,
    input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
    input_cost, output_cost, cache_read_cost, cache_write_cost, total_cost, source)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventKey,
      sessionId,
      occurredAt,
      provider,
      model,
      message.api || null,
      number(usage.input),
      number(usage.output),
      number(usage.reasoning),
      number(usage.cacheRead),
      number(usage.cacheWrite),
      number(usage.totalTokens),
      nonNegativeNumber(cost.input),
      nonNegativeNumber(cost.output),
      nonNegativeNumber(cost.cacheRead),
      nonNegativeNumber(cost.cacheWrite),
      nonNegativeNumber(cost.total),
      source,
    ],
  );
}
