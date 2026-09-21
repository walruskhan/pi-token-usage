import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const db = join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "token-usage.sqlite");
mkdirSync(dirname(db), { recursive: true });
const database = new Database(db);
database.pragma("journal_mode = WAL");
database.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY, session_file TEXT, cwd TEXT NOT NULL,
  started_at TEXT NOT NULL, ended_at TEXT, extension_version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  event_key TEXT PRIMARY KEY, session_id TEXT NOT NULL, occurred_at TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT NOT NULL, api TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0, input_cost REAL NOT NULL DEFAULT 0,
  output_cost REAL NOT NULL DEFAULT 0, cache_read_cost REAL NOT NULL DEFAULT 0,
  cache_write_cost REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'assistant'
);
`);

const insertSession = database.prepare(`INSERT OR IGNORE INTO sessions(session_id, session_file, cwd, started_at, ended_at, extension_version) VALUES(?, '', '/mock/token-stats', ?, ?, 1)`);
const insertEvent = database.prepare(`INSERT OR IGNORE INTO usage_events(event_key, session_id, occurred_at, provider, model, api, input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens, total_tokens, input_cost, output_cost, cache_read_cost, cache_write_cost, total_cost, source) VALUES(?, ?, ?, ?, ?, 'mock', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'mock')`);
const providers = [
  ["openrouter", "anthropic/claude-3.7-sonnet", 0.018],
  ["openrouter", "openai/gpt-4.1", 0.031],
  ["anthropic", "claude-sonnet-4", 0.024],
  ["openai", "gpt-4.1", 0.027],
];
const now = Date.now();
for (let i = 0; i < 28; i++) {
  const provider = providers[i % providers.length];
  const daysAgo = (i * 11) % 420;
  const when = new Date(now - daysAgo * 86400000 - (i % 8) * 3600000).toISOString();
  const sessionId = `mock-session-${i % 9}`;
  const input = 1200 + i * 317;
  const output = 450 + (i * 193) % 2400;
  const reasoning = i % 2 === 0 ? 100 + (i * 37) % 900 : 0;
  const cacheRead = i % 3 === 0 ? 8000 + i * 100 : 0;
  const cacheWrite = i % 5 === 0 ? 2000 : 0;
  const cost = provider[2] * (1 + (i % 4) / 4);
  insertSession.run(sessionId, when, when);
  insertEvent.run(`mock-event-${i}`, sessionId, when, provider[0], provider[1], input, output, reasoning, cacheRead, cacheWrite, input + output + reasoning + cacheRead + cacheWrite, cost * 0.4, cost * 0.6, cost);
}

database.close();
console.log(`Inserted mock usage data into ${db}`);
console.log("Open Pi and run /stats to view the dashboard.");
