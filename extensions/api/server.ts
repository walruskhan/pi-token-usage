import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { sqlString } from "../utils/sql.ts";
import type { SqliteDAL } from "../dal/sqlite.ts";
import { renderDashboard } from "./render.ts";

const DASHBOARD_HTML_URL = new URL("../client/index.html", import.meta.url);
const HTMX_URL = new URL("../vendor/htmx.min.js", import.meta.url);
const DASHBOARD_JS_URL = new URL("../client/index.js", import.meta.url);
const STYLES_URL = new URL("../client/styles.css", import.meta.url);
const CONTROLS_URL = new URL(
  "../client/fragments/controls.html",
  import.meta.url,
);

function dateFilter(start: string | null, end: string | null): string {
  const clauses: string[] = [];
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start))
    clauses.push(`occurred_at >= ${sqlString(`${start}T00:00:00.000Z`)}`);
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const exclusiveEnd = new Date(`${end}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    clauses.push(`occurred_at < ${sqlString(exclusiveEnd.toISOString())}`);
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

async function dashboardData(
  dal: SqliteDAL,
  start: string | null,
  end: string | null,
): Promise<any> {
  dal.initialize();
  const filter = dateFilter(start, end);
  const query = (sql: string) => dal.query(sql);
  const [summary, models, providers, daily, weekly, monthly, annual] =
    await Promise.all([
      query(`SELECT COUNT(*) AS requests, COALESCE(SUM(input_tokens),0) AS input_tokens,
      COALESCE(SUM(output_tokens),0) AS output_tokens, COALESCE(SUM(reasoning_tokens),0) AS reasoning_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens, COALESCE(SUM(total_cost),0) AS cost,
      COUNT(DISTINCT session_id) AS sessions FROM usage_events ${filter}`),
      query(`SELECT provider, model, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens, SUM(total_tokens) AS total_tokens, SUM(total_cost) AS cost
      FROM usage_events ${filter} GROUP BY provider, model ORDER BY cost DESC`),
      query(`SELECT provider, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens, SUM(total_tokens) AS total_tokens, SUM(total_cost) AS cost
      FROM usage_events ${filter} GROUP BY provider ORDER BY cost DESC`),
      query(`SELECT date(occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`),
      query(`SELECT strftime('%Y-W%W', occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`),
      query(`SELECT strftime('%Y-%m', occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`),
      query(`SELECT strftime('%Y', occurred_at) AS period, SUM(total_cost) AS cost, SUM(input_cost) AS input_cost, SUM(output_cost) AS output_cost,
      SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
      FROM usage_events ${filter} GROUP BY period ORDER BY period`),
    ]);
  return {
    summary: summary[0] || {},
    models,
    providers,
    daily,
    weekly,
    monthly,
    annual,
  };
}

export function createDashboardServer(dal: SqliteDAL): Server {
  return createServer(async (request, response) => {
    try {
      if (request.url === "/htmx.min.js") {
        response.writeHead(200, {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=86400",
        });
        response.end(await readFile(HTMX_URL));
      } else if (request.url === "/index.js") {
        response.writeHead(200, {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-cache",
        });
        response.end(await readFile(DASHBOARD_JS_URL));
      } else if (request.url === "/styles.css") {
        response.writeHead(200, {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "no-cache",
        });
        response.end(await readFile(STYLES_URL));
      } else if (request.url === "/fragments/controls") {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
        });
        response.end(await readFile(CONTROLS_URL, "utf8"));
      } else if (request.url?.startsWith("/fragments/dashboard")) {
        const requestUrl = new URL(request.url, "http://127.0.0.1");
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(
          await renderDashboard(
            await dashboardData(
              dal,
              requestUrl.searchParams.get("start"),
              requestUrl.searchParams.get("end"),
            ),
          ),
        );
      } else {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(await readFile(DASHBOARD_HTML_URL, "utf8"));
      }
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
    }
  });
}
