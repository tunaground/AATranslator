import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isJaBlock,
  extractJaBlocks,
  isStillJapanese,
  isRomanizeOutputValid,
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

test("isStillJapanese: Chinese translation not flagged when target is zh_CN", () => {
  assert.equal(isStillJapanese("简体中文翻译示例", "zh_CN"), false);
});

test("isStillJapanese: Chinese translation not flagged when target is zh_TW", () => {
  assert.equal(isStillJapanese("繁體中文翻譯範例", "zh_TW"), false);
});

test("isStillJapanese: Japanese kana still detected for Chinese target", () => {
  assert.equal(isStillJapanese("これは日本語です", "zh_CN"), true);
  assert.equal(isStillJapanese("これは日本語です", "zh_TW"), true);
});

test("isStillJapanese: pure kanji passage flagged for ko/en target (default)", () => {
  assert.equal(isStillJapanese("日本語翻訳例"), true);
});

test("isStillJapanese: Chinese hanzi with trace kana is still Japanese for zh target", () => {
  assert.equal(isStillJapanese("これは中文です", "zh_CN"), true);
});

test("isRomanizeOutputValid: empty output is rejected", () => {
  assert.equal(isRomanizeOutputValid("anything", ""), false);
});

test("isRomanizeOutputValid: input with <5 CJK accepts any output", () => {
  assert.equal(isRomanizeOutputValid("やる夫", "Yaruo"), true);
});

test("isRomanizeOutputValid: kana-dominant input accepts pure romaji output", () => {
  assert.equal(
    isRomanizeOutputValid(
      "やる夫は斜陽の国で生き抜くようです",
      "yaruo shayou no kuni de ikinuku you desu",
    ),
    true,
  );
});

test("isRomanizeOutputValid: hanzi-dominant input rejects when CJK dropped", () => {
  assert.equal(
    isRomanizeOutputValid(
      "やる夫似乎要在斜阳之国生存下去",
      "Yaruo sembra sopravvivere nel paese del sole al tramonto",
    ),
    false,
  );
});

test("isRomanizeOutputValid: hanzi-dominant input accepts when CJK preserved", () => {
  assert.equal(
    isRomanizeOutputValid(
      "やる夫似乎要在斜阳之国生存下去",
      "Yaruo似乎要在斜阳之国生存下去",
    ),
    true,
  );
});

test("SPLIT_RE: splits whitespace", () => {
  assert.deepEqual("a b c".split(SPLIT_RE).filter(Boolean), ["a", " ", "b", " ", "c"]);
});
