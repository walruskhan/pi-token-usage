import assert from "node:assert/strict";
import { test } from "node:test";
import { renderDashboard } from "../extensions/api/render.ts";

test("renderDashboard renders the dashboard sections", async () => {
  const html = await renderDashboard({
    summary: { cost: 1.25, requests: 2, input_tokens: 100, output_tokens: 50, reasoning_tokens: 20, total_tokens: 170, sessions: 1 },
    providers: [{ provider: "openrouter", cost: 1.25, total_tokens: 170, requests: 2 }],
    models: [{ provider: "openrouter", model: "test-model", requests: 2, input_tokens: 100, output_tokens: 50, reasoning_tokens: 20, total_tokens: 170, cost: 1.25 }],
    daily: [{ period: "2026-07-26", cost: 1.25, input_cost: 0.5, output_cost: 0.75, input_tokens: 100, output_tokens: 50, reasoning_tokens: 20 }],
    weekly: [], monthly: [], annual: [],
  });

  assert.match(html, /Estimated water impact/);
  assert.match(html, /openrouter/);
  assert.match(html, /test-model/);
  assert.match(html, /2026-07-26 Sun/);
  assert.match(html, /Thinking: 20 tokens/);
});

test("renderDashboard escapes provider and model values", async () => {
  const html = await renderDashboard({
    summary: {},
    providers: [{ provider: "<script>alert(1)</script>", cost: 0, total_tokens: 0, requests: 0 }],
    models: [{ provider: "safe", model: "<img src=x>", requests: 0, input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, total_tokens: 0, cost: 0 }],
    daily: [], weekly: [], monthly: [], annual: [],
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;img src&#x3D;x&gt;/);
});
