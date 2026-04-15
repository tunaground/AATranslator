import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

let originalSelf;

beforeEach(() => {
  originalSelf = globalThis.self;
});

afterEach(() => {
  if (originalSelf === undefined) delete globalThis.self;
  else globalThis.self = originalSelf;
});

test("isBrowserTranslatorSupported: true when self.Translator exists", async () => {
  globalThis.self = { Translator: {} };
  const mod = await import(`../src/content/browser-translator.js?case=support-true`);
  assert.equal(mod.isBrowserTranslatorSupported(), true);
});

test("isBrowserTranslatorSupported: false when self.Translator is missing", async () => {
  globalThis.self = {};
  const mod = await import(`../src/content/browser-translator.js?case=support-false`);
  assert.equal(mod.isBrowserTranslatorSupported(), false);
});

function makeFakeTranslatorAPI() {
  const createCalls = [];
  const api = {
    createCalls,
    Translator: {
      async availability(opts) {
        return "available";
      },
      async create(opts) {
        createCalls.push(opts);
        return {
          async translate(text) {
            if (text === "原文") return "원문";
            if (text === "") return "";
            if (text === "same") return "same";
            return `[${opts.targetLanguage}] ${text}`;
          },
        };
      },
    },
  };
  return api;
}

test("translateBlockBrowser: returns translated text on happy path", async () => {
  const fake = makeFakeTranslatorAPI();
  globalThis.self = { Translator: fake.Translator };
  const mod = await import(`../src/content/browser-translator.js?case=happy`);
  const out = await mod.translateBlockBrowser("原文", "ko");
  assert.equal(out, "원문");
});

test("translateBlockBrowser: caches Translator per target language", async () => {
  const fake = makeFakeTranslatorAPI();
  globalThis.self = { Translator: fake.Translator };
  const mod = await import(`../src/content/browser-translator.js?case=cache`);
  await mod.translateBlockBrowser("原文", "ko");
  await mod.translateBlockBrowser("原文", "ko");
  await mod.translateBlockBrowser("原文", "en");
  assert.equal(fake.createCalls.length, 2);
  assert.equal(fake.createCalls[0].targetLanguage, "ko");
  assert.equal(fake.createCalls[1].targetLanguage, "en");
});

test("translateBlockBrowser: concurrent first calls share a single create()", async () => {
  let createCount = 0;
  let resolveCreate;
  const translator = {
    async translate(text) {
      return `ko:${text}`;
    },
  };
  globalThis.self = {
    Translator: {
      create(opts) {
        createCount++;
        return new Promise((resolve) => {
          resolveCreate = () => resolve(translator);
        });
      },
    },
  };
  const mod = await import(`../src/content/browser-translator.js?case=race`);
  const p1 = mod.translateBlockBrowser("a", "ko");
  const p2 = mod.translateBlockBrowser("b", "ko");
  resolveCreate();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(createCount, 1);
  assert.equal(r1, "ko:a");
  assert.equal(r2, "ko:b");
});

test("translateBlockBrowser: failed create() lets a retry try again", async () => {
  let attempt = 0;
  globalThis.self = {
    Translator: {
      async create(opts) {
        attempt++;
        if (attempt === 1) throw new Error("download failed");
        return {
          async translate(text) {
            return `ok:${text}`;
          },
        };
      },
    },
  };
  const mod = await import(`../src/content/browser-translator.js?case=retry`);
  await assert.rejects(
    () => mod.translateBlockBrowser("x", "ko"),
    /download failed/,
  );
  const second = await mod.translateBlockBrowser("y", "ko");
  assert.equal(second, "ok:y");
  assert.equal(attempt, 2);
});
