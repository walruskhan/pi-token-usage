import assert from "node:assert/strict";
import { test } from "node:test";
import { number } from "../extensions/utils/numbers.ts";
import { sqlString } from "../extensions/utils/sql.ts";
import { periodLabel } from "../extensions/utils/format.ts";

test("number normalizes invalid values to zero", () => {
  assert.equal(number("42"), 42);
  assert.equal(number("not a number"), 0);
  assert.equal(number(Infinity), 0);
});

test("sqlString escapes apostrophes as SQL data", () => {
  assert.equal(sqlString("model'; DROP TABLE usage_events; --"), "'model''; DROP TABLE usage_events; --'");
});

test("periodLabel adds a weekday to daily periods", () => {
  assert.equal(periodLabel("2026-07-26"), "2026-07-26 Sun");
  assert.equal(periodLabel("2026-07"), "2026-07");
});
