import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBlockPrompt,
  buildBatchPrompt,
  buildRomanizePrompt,
  buildRomanizeBatchPrompt,
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

test("buildBlockPrompt: includes language name for zh_CN", () => {
  const p = buildBlockPrompt("zh_CN");
  assert.match(p, /Simplified Chinese/);
});

test("buildBlockPrompt: includes language name for zh_TW", () => {
  const p = buildBlockPrompt("zh_TW");
  assert.match(p, /Traditional Chinese/);
});

test("buildBatchPrompt: includes language name for zh_CN", () => {
  const p = buildBatchPrompt("zh_CN");
  assert.match(p, /Simplified Chinese/);
  assert.match(p, /JSON array/);
});

test("buildBatchPrompt: includes language name for zh_TW", () => {
  const p = buildBatchPrompt("zh_TW");
  assert.match(p, /Traditional Chinese/);
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

test("buildRomanizePrompt: instructs Hepburn conversion, names examples", () => {
  const p = buildRomanizePrompt();
  assert.match(p, /Hepburn/);
  assert.match(p, /hiragana/i);
  assert.match(p, /katakana/i);
  assert.match(p, /Yaruo/);
});

test("buildRomanizeBatchPrompt: returns JSON array instructions", () => {
  const p = buildRomanizeBatchPrompt();
  assert.match(p, /Hepburn/);
  assert.match(p, /JSON array/);
  assert.match(p, /"i"/);
  assert.match(p, /"t"/);
});

test("formatBatchUser: numbers fragments with [i]", () => {
  const r = formatBatchUser(["foo", "bar"]);
  assert.equal(r, "[0] foo\n[1] bar");
});

test("formatBatchUser: empty array returns empty string", () => {
  assert.equal(formatBatchUser([]), "");
});
