import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { SqliteDAL } from "./SqliteDAL.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, type Server } from "node:http";

const execFileAsync = promisify(execFile);
const DB_PATH = join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "token-usage.sqlite");
const EXTENSION_VERSION = 1;
const dal = new SqliteDAL(DB_PATH);

type Usage = {
  input?: number; output?: number; cacheRead?: number; cacheWrite?: number;
  totalTokens?: number;
  cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; total?: number };
};

function sqlString(value: unknown): string {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}
function number(value: unknown): number { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function timestamp(value: unknown): string {
  const date = new Date(number(value) || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function sqlite(sql: string, json = false): Promise<any[]> {
  if (!json) { dal.run(sql); return []; }
  return dal.query(sql);
}

function runPrepared(sql: string, params: unknown[]): void {
  dal.run(sql, params);
}

async function resetDatabase(): Promise<void> {
  await dal.reset();
}

async function ensureSchema(): Promise<void> {
  dal.initialize();
}

async function recordSession(ctx: ExtensionContext): Promise<string> {
  await ensureSchema();
  const sessionId = ctx.sessionManager.getSessionId();
  const sessionFile = ctx.sessionManager.getSessionFile() || "";
  runPrepared(`INSERT INTO sessions(session_id, session_file, cwd, started_at, extension_version)
    VALUES(?, ?, ?, datetime('now'), ?)
    ON CONFLICT(session_id) DO UPDATE SET session_file=excluded.session_file, cwd=excluded.cwd`,
    [sessionId, sessionFile, ctx.cwd, EXTENSION_VERSION]);
  // Backfill the complete session branch, including usage entries created by compaction/cache warming.
  for (const entry of ctx.sessionManager.getEntries() as any[]) {
    if (entry.type === "message") await recordUsage(sessionId, entry.message);
    else if (entry.type === "usage" || entry.type === "compaction" || entry.type === "branch_summary") {
      if (entry.usage) await recordUsage(sessionId, { ...entry, id: entry.id }, entry.kind || entry.type);
    }
  }
  return sessionId;
}

async function recordUsage(sessionId: string, message: any, source = "assistant"): Promise<void> {
  const usage: Usage | undefined = message?.usage;
  if (!usage) return;
  const provider = String(message.provider || "unknown");
  const model = String(message.model || message.responseModel || "unknown");
  const occurredAt = timestamp(message.timestamp || Date.now());
  // responseId is stable when supplied; the fallback also prevents duplicate writes during a reload.
  const eventKey = `${sessionId}:${message.responseId || `${message.id || occurredAt}:${provider}:${model}:${number(usage.totalTokens)}:${source}`}`;
  const cost = usage.cost || {};
  runPrepared(`INSERT OR IGNORE INTO usage_events(
    event_key, session_id, occurred_at, provider, model, api,
    input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
    input_cost, output_cost, cache_read_cost, cache_write_cost, total_cost, source)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [eventKey, sessionId, occurredAt, provider, model, message.api || null,
      number(usage.input), number(usage.output), number(usage.reasoning), number(usage.cacheRead), number(usage.cacheWrite),
      number(usage.totalTokens), number(cost.input), number(cost.output), number(cost.cacheRead),
      number(cost.cacheWrite), number(cost.total), source]);
}

function dateFilter(start: string | null, end: string | null): string {
  const clauses: string[] = [];
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) clauses.push(`occurred_at >= ${sqlString(`${start}T00:00:00.000Z`)}`);
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const exclusiveEnd = new Date(`${end}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    clauses.push(`occurred_at < ${sqlString(exclusiveEnd.toISOString())}`);
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

async function dashboardData(start: string | null = null, end: string | null = null): Promise<any> {
  await ensureSchema();
  const filter = dateFilter(start, end);
  const [summary, models, providers, daily, weekly, monthly, annual] = await Promise.all([
    sqlite(`SELECT COUNT(*) AS requests, COALESCE(SUM(input_tokens),0) AS input_tokens,
      COALESCE(SUM(output_tokens),0) AS output_tokens, COALESCE(SUM(reasoning_tokens),0) AS reasoning_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens, COALESCE(SUM(total_cost),0) AS cost,
      COUNT(DISTINCT session_id) AS sessions FROM usage_events ${filter}`, true),
    sqlite(`SELECT provider, model, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens, SUM(total_tokens) AS total_tokens, SUM(total_cost) AS cost
      FROM usage_events ${filter} GROUP BY provider, model ORDER BY cost DESC`, true),
    sqlite(`SELECT provider, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens, SUM(total_tokens) AS total_tokens, SUM(total_cost) AS cost
      FROM usage_events ${filter} GROUP BY provider ORDER BY cost DESC`, true),
    sqlite(`SELECT date(occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`, true),
    sqlite(`SELECT strftime('%Y-W%W', occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`, true),
    sqlite(`SELECT strftime('%Y-%m', occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`, true),
    sqlite(`SELECT strftime('%Y', occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`, true),
  ]);
  return { summary: summary[0] || {}, models, providers, daily, weekly, monthly, annual };
}

const DASHBOARD_HTML_URL = new URL("./dashboard.html", import.meta.url);

async function html(): Promise<string> {
  return readFile(DASHBOARD_HTML_URL, "utf8");
}

export default function (pi: ExtensionAPI) {
  let sessionId = "";
  let server: Server | undefined;
  pi.on("session_start", async (_event, ctx) => {
    try { sessionId = await recordSession(ctx); } catch (error) { console.error("token-stats: database init failed", error); }
  });
  pi.on("message_end", async (event, _ctx) => {
    if (!sessionId) return;
    try { await recordUsage(sessionId, event.message); } catch (error) { console.error("token-stats: usage write failed", error); }
  });
  pi.on("session_shutdown", async (_event, _ctx) => {
    if (!sessionId) return;
    try { runPrepared("UPDATE sessions SET ended_at=datetime('now') WHERE session_id=? AND ended_at IS NULL", [sessionId]); } catch {}
    sessionId = "";
    if (server) { server.close(); server = undefined; }
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
        if (server) { server.close(); server = undefined; }
        await resetDatabase();
        await recordSession(ctx);
        ctx.ui.notify("Local token statistics database cleared.", "info");
      } catch (error) {
        ctx.ui.notify(`Token statistics reset failed: ${String(error)}`, "error");
      }
    },
  });

  pi.registerCommand("stats", {
    description: "Open the persistent token and cost usage dashboard",
    handler: async (_args, ctx) => {
      try {
        await recordSession(ctx);
        if (!server) {
          server = createServer(async (request, response) => {
            try {
              if (request.url?.startsWith("/api")) { const requestUrl = new URL(request.url, "http://127.0.0.1"); response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify(await dashboardData(requestUrl.searchParams.get("start"), requestUrl.searchParams.get("end")))); }
              else { response.writeHead(200, { "content-type": "text/html; charset=utf-8" }); response.end(await html()); }
            } catch (error) { response.writeHead(500); response.end(String(error)); }
          });
          await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", () => resolve()); });
        }
        const address = server.address();
        const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;
        const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        await execFileAsync(command, [url]).catch(() => undefined);
        ctx.ui.notify(`Token stats opened at ${url}`, "info");
      } catch (error) { ctx.ui.notify(`Token stats failed: ${String(error)}`, "error"); }
    },
  });
}
