import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBlockPrompt,
  buildBatchPrompt,
  formatBatchUser,
} from "../src/core/prompts.js";

test("buildBlockPrompt: includes language name for ko", () => {
  const p = buildBlockPrompt("ko");
  assert.match(p, /Korean/);
  assert.match(p, /JSON/);
});

test("buildBlockPrompt: includes language name for en", () => {
  const p = buildBlockPrompt("en");
  assert.match(p, /English/);
});

test("buildBlockPrompt: unknown lang falls back to raw code", () => {
  const p = buildBlockPrompt("xx");
  assert.match(p, /in xx/);
});

test("buildBatchPrompt: includes language name and JSON array instructions", () => {
  const p = buildBatchPrompt("ko");
  assert.match(p, /Korean/);
  assert.match(p, /JSON array/);
  assert.match(p, /"i"/);
  assert.match(p, /"m"/);
  assert.match(p, /"t"/);
});

test("formatBatchUser: numbers fragments with [i]", () => {
  const r = formatBatchUser(["foo", "bar"]);
  assert.equal(r, "[0] foo\n[1] bar");
});

test("formatBatchUser: empty array returns empty string", () => {
  assert.equal(formatBatchUser([]), "");
});
