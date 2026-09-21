import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { dirname } from "node:path";

export class SqliteDAL {
  private database: Database.Database | undefined;
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  private get db(): Database.Database {
    if (!this.database) {
      mkdirSync(dirname(this.path), { recursive: true });
      this.database = new Database(this.path);
      this.database.pragma("journal_mode = WAL");
    }
    return this.database;
  }

  initialize(): void {
    this.db.exec(`
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
      CREATE INDEX IF NOT EXISTS usage_events_occurred ON usage_events(occurred_at);
      CREATE INDEX IF NOT EXISTS usage_events_model ON usage_events(provider, model);
    `);
    try {
      this.db.exec(
        "ALTER TABLE usage_events ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0",
      );
    } catch (error: any) {
      if (!String(error?.message).includes("duplicate column name"))
        throw error;
    }
  }

  run(sql: string, params: unknown[] = []): void {
    this.db.prepare(sql).run(...params);
  }

  query(sql: string): any[] {
    return this.db.prepare(sql).all() as any[];
  }

  async reset(): Promise<void> {
    this.database?.close();
    this.database = undefined;
    for (const path of [this.path, `${this.path}-wal`, `${this.path}-shm`]) {
      try {
        await unlink(path);
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }
}
