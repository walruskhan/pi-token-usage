import Mustache from "mustache";
import { readFile } from "node:fs/promises";
import { escapeHtml, money, num, periodLabel } from "../utils/format.ts";

const TEMPLATE_DIR = new URL("./templates/", import.meta.url);
let templates: Record<string, string> | undefined;

async function loadTemplates(): Promise<Record<string, string>> {
  if (!templates) {
    const names = [
      "dashboard",
      "summary",
      "charts",
      "providers",
      "water-impact",
      "models",
    ];
    const contents = await Promise.all(
      names.map((name) =>
        readFile(new URL(`${name}.mustache`, TEMPLATE_DIR), "utf8"),
      ),
    );
    templates = Object.fromEntries(
      names.map((name, index) => [name, contents[index]]),
    );
  }
  return templates;
}

function chartRows(rows: any[]): any[] {
  const max = Math.max(...rows.map((row) => Number(row.cost) || 0), 0.000001);
  return rows.map((row) => ({
    height: Math.max(2, (Number(row.cost) / max) * 100),
    hasCost: Number(row.cost) > 0,
    cost: money(row.cost),
    tooltip: `<strong>${escapeHtml(periodLabel(row.period))}</strong><br>Input: ${num(row.input_tokens)} tokens · ${money(row.input_cost)}<br>Output: ${num(row.output_tokens)} tokens · ${money(row.output_cost)}<br>Thinking: ${num(row.reasoning_tokens)} tokens<br><strong>Total cost: ${money(row.cost)}</strong>`,
  }));
}

export async function renderDashboard(data: any): Promise<string> {
  const summary = data.summary || {};
  const providers = data.providers || [];
  const maxProviderCost = Math.max(
    ...providers.map((row: any) => Number(row.cost) || 0),
    0.000001,
  );
  const charts = [
    ["Daily costs", data.daily],
    ["Weekly costs", data.weekly],
    ["Monthly costs", data.monthly],
    ["Annual costs", data.annual],
  ].map(([title, rows]) => ({ title, rows: chartRows(rows as any[]) }));
  const view = {
    summaryCards: [
      ["Cost", money(summary.cost)],
      ["Requests", num(summary.requests)],
      ["Input tokens", num(summary.input_tokens)],
      ["Output tokens", num(summary.output_tokens)],
      ["Thinking tokens", num(summary.reasoning_tokens)],
      ["Sessions", num(summary.sessions)],
    ].map(([label, value]) => ({ label, value })),
    providers: providers.map((row: any) => ({
      provider: row.provider,
      cost: money(row.cost),
      tokens: num(row.total_tokens),
      requests: num(row.requests),
      barWidth: Math.max(2, (Number(row.cost) / maxProviderCost) * 70),
    })),
    charts,
    totalTokens: Number(summary.total_tokens || 0),
    modelsJson: escapeHtml(JSON.stringify(data.models || [])),
    models: (data.models || []).map((row: any) => ({
      provider: row.provider,
      model: row.model,
      requests: num(row.requests),
      input: num(row.input_tokens),
      output: num(row.output_tokens),
      reasoning: num(row.reasoning_tokens),
      tokens: num(row.total_tokens),
      cost: money(row.cost),
    })),
  };
  const loaded = await loadTemplates();
  return Mustache.render(loaded.dashboard, view, {
    summary: loaded.summary,
    charts: loaded.charts,
    providers: loaded.providers,
    "water-impact": loaded["water-impact"],
    models: loaded.models,
  });
}
