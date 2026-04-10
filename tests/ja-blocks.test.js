import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isJaBlock,
  extractJaBlocks,
  isStillJapanese,
  SPLIT_RE,
} from "../src/core/ja-blocks.js";

test("isJaBlock: hiragana 2+ chars is a block", () => {
  assert.equal(isJaBlock("こんにちは"), true);
});

test("isJaBlock: katakana 2+ chars is a block", () => {
  assert.equal(isJaBlock("カタカナ"), true);
});

test("isJaBlock: kanji 2+ chars is a block", () => {
  assert.equal(isJaBlock("日本語"), true);
});

test("isJaBlock: mixed kana+kanji is a block", () => {
  assert.equal(isJaBlock("私は"), true);
});

test("isJaBlock: single japanese char is NOT a block", () => {
  assert.equal(isJaBlock("あ"), false);
});

test("isJaBlock: latin text is NOT a block", () => {
  assert.equal(isJaBlock("hello"), false);
});

test("isJaBlock: empty / null returns false", () => {
  assert.equal(isJaBlock(""), false);
  assert.equal(isJaBlock(null), false);
});

test("extractJaBlocks: returns japanese tokens, preserves multi-token splits", () => {
  const blocks = extractJaBlocks("hello こんにちは world さようなら");
  assert.deepEqual(blocks, ["こんにちは", "さようなら"]);
});

test("extractJaBlocks: ignores single-char japanese", () => {
  const blocks = extractJaBlocks("a あ b");
  assert.deepEqual(blocks, []);
});

test("extractJaBlocks: empty input returns empty array", () => {
  assert.deepEqual(extractJaBlocks(""), []);
});

test("extractJaBlocks: splits on japanese brackets 「」", () => {
  const blocks = extractJaBlocks("「こんにちは」");
  assert.deepEqual(blocks, ["こんにちは"]);
});

test("isStillJapanese: >30% japanese is true", () => {
  assert.equal(isStillJapanese("こんにちは"), true);
});

test("isStillJapanese: <=30% japanese is false", () => {
  assert.equal(isStillJapanese("Hello world, only one あ character here"), false);
});

test("isStillJapanese: no japanese is false", () => {
  assert.equal(isStillJapanese("Hello world"), false);
});

test("isStillJapanese: empty is false", () => {
  assert.equal(isStillJapanese(""), false);
});

test("SPLIT_RE: splits whitespace", () => {
  assert.deepEqual("a b c".split(SPLIT_RE).filter(Boolean), ["a", " ", "b", " ", "c"]);
});
