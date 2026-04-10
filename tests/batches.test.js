import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBatches, BATCH_CHAR_LIMITS } from "../src/core/batches.js";

test("buildBatches: exports provider-specific limits", () => {
  assert.equal(BATCH_CHAR_LIMITS.ollama, 1000);
  assert.equal(BATCH_CHAR_LIMITS.openai, 3000);
  assert.equal(BATCH_CHAR_LIMITS.gemini, 3000);
  assert.equal(BATCH_CHAR_LIMITS.claude, 3000);
});

test("buildBatches: packs strings under limit into one batch", () => {
  const items = ["aaa", "bbb", "ccc"];
  assert.deepEqual(buildBatches(items, "openai"), [["aaa", "bbb", "ccc"]]);
});

test("buildBatches: splits when limit exceeded", () => {
  const big = "x".repeat(600);
  const items = [big, big, big]; // 1800 chars; ollama limit=1000
  const result = buildBatches(items, "ollama");
  assert.equal(result.length, 3);
  assert.equal(result[0].length, 1);
  assert.equal(result[1].length, 1);
  assert.equal(result[2].length, 1);
});

test("buildBatches: single oversized item is its own batch", () => {
  const huge = "x".repeat(5000);
  const items = ["a", huge, "b"];
  const result = buildBatches(items, "openai");
  assert.deepEqual(result, [["a"], [huge], ["b"]]);
});

test("buildBatches: empty input returns empty array", () => {
  assert.deepEqual(buildBatches([], "openai"), []);
});

test("buildBatches: unknown provider uses default limit 2000", () => {
  const items = Array(5).fill("x".repeat(500)); // 2500 chars total
  const result = buildBatches(items, "unknown");
  // 2000 default: 500+500+500+500=2000, next would exceed → split
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 4);
  assert.equal(result[1].length, 1);
});

test("buildBatches: uses getText to read string length", () => {
  const items = [{ text: "aaa" }, { text: "bbb" }];
  const result = buildBatches(items, "openai", (x) => x.text);
  assert.deepEqual(result, [[{ text: "aaa" }, { text: "bbb" }]]);
});
