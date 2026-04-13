import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_TARGETS,
  pickInitialTarget,
  coerceTarget,
} from "../src/core/target-lang.js";

test("SUPPORTED_TARGETS contains exactly ko/en/zh_CN/zh_TW", () => {
  assert.deepEqual([...SUPPORTED_TARGETS].sort(), ["en", "ko", "zh_CN", "zh_TW"]);
});

test("pickInitialTarget: ko browser -> ko", () => {
  assert.equal(pickInitialTarget("ko"), "ko");
  assert.equal(pickInitialTarget("ko-KR"), "ko");
});

test("pickInitialTarget: en browser -> en", () => {
  assert.equal(pickInitialTarget("en"), "en");
  assert.equal(pickInitialTarget("en-US"), "en");
  assert.equal(pickInitialTarget("en-GB"), "en");
});

test("pickInitialTarget: zh-TW/HK/MO -> zh_TW", () => {
  assert.equal(pickInitialTarget("zh-TW"), "zh_TW");
  assert.equal(pickInitialTarget("zh-HK"), "zh_TW");
  assert.equal(pickInitialTarget("zh-MO"), "zh_TW");
});

test("pickInitialTarget: zh / zh-CN / zh-SG -> zh_CN", () => {
  assert.equal(pickInitialTarget("zh"), "zh_CN");
  assert.equal(pickInitialTarget("zh-CN"), "zh_CN");
  assert.equal(pickInitialTarget("zh-SG"), "zh_CN");
});

test("pickInitialTarget: unknown language -> en", () => {
  assert.equal(pickInitialTarget("ja"), "en");
  assert.equal(pickInitialTarget("fr"), "en");
  assert.equal(pickInitialTarget(""), "en");
  assert.equal(pickInitialTarget(null), "en");
  assert.equal(pickInitialTarget(undefined), "en");
});

test("pickInitialTarget: case-insensitive", () => {
  assert.equal(pickInitialTarget("ZH-TW"), "zh_TW");
  assert.equal(pickInitialTarget("EN-US"), "en");
});

test("coerceTarget: valid stored value passes through", () => {
  assert.equal(coerceTarget("ko", "en-US"), "ko");
  assert.equal(coerceTarget("en", "ko"), "en");
  assert.equal(coerceTarget("zh_CN", "ko"), "zh_CN");
  assert.equal(coerceTarget("zh_TW", "ko"), "zh_TW");
});

test("coerceTarget: invalid stored value -> en (not browser default)", () => {
  assert.equal(coerceTarget("ja", "ko"), "en");
  assert.equal(coerceTarget("fr", "zh-CN"), "en");
});

test("coerceTarget: no stored value -> browser-derived default", () => {
  assert.equal(coerceTarget(null, "ko-KR"), "ko");
  assert.equal(coerceTarget(undefined, "zh-TW"), "zh_TW");
  assert.equal(coerceTarget("", "en-US"), "en");
});
