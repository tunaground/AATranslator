# AATranslator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome (MV3) extension that translates Japanese AA (Ascii Art / Yaruo) works in-place using LLM providers, functionally equivalent to `~/Sources/libraa/extension/` but with a layered, unit-testable structure.

**Architecture:** Three layers — pure core (`src/core/`, zero browser deps, unit-tested with Node's built-in test runner), content-script glue (`src/content/`, DOM + Chrome messaging), and MV3 service worker (`src/background.js`, LLM fetch proxy with retry). Content scripts use ES modules via a `bootstrap.js` + dynamic `import()` loader against `web_accessible_resources`.

**Tech Stack:** Vanilla JavaScript (ES modules), Chrome Extension Manifest V3, Node 18+ built-in test runner (`node --test`), zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-aatranslator-design.md`

---

## File Layout

Created during this plan (all paths relative to `/Users/tunarider/Sources/AATranslator/`):

```
.gitignore
package.json
manifest.json
icons/icon48.png          # already copied from libraa
icons/icon128.png         # already copied from libraa
_locales/ko/messages.json
_locales/en/messages.json
_locales/ja/messages.json
src/background.js
src/core/ja-blocks.js
src/core/batches.js
src/core/prompts.js
src/core/parse.js
src/core/providers.js
src/content/bootstrap.js
src/content/main.js
src/content/state.js
src/content/llm.js
src/content/dom.js
src/content/i18n.js
src/content/translate-flow.js
src/content/selection.js
src/content/ui.js
src/content/styles.css
tests/ja-blocks.test.js
tests/batches.test.js
tests/prompts.test.js
tests/parse.test.js
tests/providers.test.js
```

Already present (from prior session): `icons/icon48.png`, `icons/icon128.png`, `docs/superpowers/specs/2026-04-10-aatranslator-design.md`, `docs/superpowers/plans/2026-04-10-aatranslator.md` (this file).

---

## Task 1: Project Scaffold

Initialize git, create `.gitignore`, `package.json`, and the empty `src/core`, `src/content`, `tests` directories (already present — just verify). Commit the scaffold and the existing spec/plan/icons as the first commit.

**Files:**
- Create: `.gitignore`
- Create: `package.json`

- [ ] **Step 1.1: Initialize git repository**

Run:
```bash
cd /Users/tunarider/Sources/AATranslator
git init
```

Expected: `Initialized empty Git repository in /Users/tunarider/Sources/AATranslator/.git/`

- [ ] **Step 1.2: Create `.gitignore`**

Write `.gitignore`:
```
node_modules/
.DS_Store
*.log
.vscode/
.idea/
```

- [ ] **Step 1.3: Create `package.json`**

Write `package.json`:
```json
{
  "name": "aatranslator",
  "version": "0.1.0",
  "description": "Translate Japanese AA (Ascii Art / Yaruo) works in-place using LLMs",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 1.4: Sanity-check test runner works (no tests yet)**

Run:
```bash
cd /Users/tunarider/Sources/AATranslator && npm test
```

Expected: `node --test tests/` runs, reports `ℹ tests 0` (no files yet but exits 0 or "no test files found"). Either outcome is fine — we're just verifying Node is invokable.

- [ ] **Step 1.5: First commit**

Run:
```bash
cd /Users/tunarider/Sources/AATranslator
git add .gitignore package.json icons/ docs/
git commit -m "chore: initial project scaffold with spec and plan"
```

---

## Task 2: `core/ja-blocks.js` (TDD)

Pure Japanese text detection: `isJaBlock`, `extractJaBlocks`, `isStillJapanese`, and the `SPLIT_RE` splitter. Regex ranges are identical to libraa.

**Files:**
- Create: `tests/ja-blocks.test.js`
- Create: `src/core/ja-blocks.js`

- [ ] **Step 2.1: Write failing tests**

Write `tests/ja-blocks.test.js`:
```js
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
```

- [ ] **Step 2.2: Run tests — expect failure**

Run:
```bash
cd /Users/tunarider/Sources/AATranslator && npm test
```

Expected: all tests fail because `src/core/ja-blocks.js` doesn't exist yet. Error messages about `Cannot find module`.

- [ ] **Step 2.3: Implement `src/core/ja-blocks.js`**

Write `src/core/ja-blocks.js`:
```js
const JA_CORE_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;
const JA_STILL_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;

export const SPLIT_RE = /([\u0020\u3000\t\n\r]+|[\u3010\u3011\u300C\u300D\u300E\u300F\uFF08\uFF09\u3008\u3009\u300A\u300B\[\]\(\)\u2460-\u2473\u2474-\u2487\u2488-\u249B\u24EA-\u24FF\u203B\uFF0A])/;

export function isJaBlock(token) {
  if (!token) return false;
  const matches = token.match(JA_CORE_RE);
  return matches !== null && matches.length >= 2;
}

export function extractJaBlocks(text) {
  if (!text) return [];
  const tokens = text.split(SPLIT_RE);
  return tokens.filter((t) => t && !SPLIT_RE.test(t) && isJaBlock(t));
}

export function isStillJapanese(text) {
  if (!text) return false;
  const m = text.match(JA_STILL_RE);
  if (!m) return false;
  return m.length / text.length > 0.3;
}
```

- [ ] **Step 2.4: Run tests — expect pass**

Run:
```bash
cd /Users/tunarider/Sources/AATranslator && npm test
```

Expected: all `ja-blocks` tests pass. Final line shows `ℹ fail 0`.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/core/ja-blocks.js tests/ja-blocks.test.js
git commit -m "feat(core): add japanese block detection"
```

---

## Task 3: `core/batches.js` (TDD)

Greedy packing of items into batches by character-count limit. Provider-specific limits. `getText` lets callers pass domain objects (e.g. DOM spans) without leaking DOM into core.

**Files:**
- Create: `tests/batches.test.js`
- Create: `src/core/batches.js`

- [ ] **Step 3.1: Write failing tests**

Write `tests/batches.test.js`:
```js
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
```

- [ ] **Step 3.2: Run tests — expect failure**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: `batches.test.js` fails with module not found. `ja-blocks` tests still pass.

- [ ] **Step 3.3: Implement `src/core/batches.js`**

Write `src/core/batches.js`:
```js
export const BATCH_CHAR_LIMITS = {
  ollama: 1000,
  openai: 3000,
  gemini: 3000,
  claude: 3000,
};

const DEFAULT_LIMIT = 2000;

export function buildBatches(items, provider, getText = (x) => x) {
  const limit = BATCH_CHAR_LIMITS[provider] ?? DEFAULT_LIMIT;
  const batches = [];
  let current = [];
  let currentLen = 0;
  for (const item of items) {
    const text = getText(item);
    const len = text.length;
    if (current.length > 0 && currentLen + len > limit) {
      batches.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(item);
    currentLen += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
```

- [ ] **Step 3.4: Run tests — expect pass**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: all tests (ja-blocks + batches) pass.

- [ ] **Step 3.5: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/core/batches.js tests/batches.test.js
git commit -m "feat(core): add batch packing by char limit"
```

---

## Task 4: `core/prompts.js` (TDD)

Pure prompt builders. No state. Language name map with fallback to raw code.

**Files:**
- Create: `tests/prompts.test.js`
- Create: `src/core/prompts.js`

- [ ] **Step 4.1: Write failing tests**

Write `tests/prompts.test.js`:
```js
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
```

- [ ] **Step 4.2: Run tests — expect failure**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: `prompts.test.js` fails with module not found.

- [ ] **Step 4.3: Implement `src/core/prompts.js`**

Write `src/core/prompts.js`:
```js
const LANG_NAMES = { ko: "Korean", en: "English", ja: "Japanese" };

function langName(code) {
  return LANG_NAMES[code] || code;
}

export function buildBlockPrompt(targetLang) {
  const name = langName(targetLang);
  return `You are a translator for Japanese AA (Ascii Art) works.
You will receive a Japanese text fragment. Determine if it is meaningful text or decorative.
Single words, names, katakana loanwords ARE meaningful — translate them.

Respond in JSON:
{"meaningful": true, "translation": "translated text in ${name}"}
or {"meaningful": false}

IMPORTANT: When meaningful, "translation" MUST be in ${name}, NOT Japanese.
JSON only.`;
}

export function buildBatchPrompt(targetLang) {
  const name = langName(targetLang);
  return `Translate Japanese text fragments to ${name}.
You receive numbered fragments. For each, decide if it's meaningful text or decorative (kanji shading, symbols).
Single words, names, katakana loanwords ARE meaningful — translate them.

Respond as a JSON array:
[{"i":0,"m":true,"t":"translation in ${name}"},{"i":1,"m":false},...]

"i" = index, "m" = meaningful, "t" = translation (only when m=true, MUST be in ${name}).
JSON only. No explanation.`;
}

export function formatBatchUser(texts) {
  return texts.map((t, i) => `[${i}] ${t}`).join("\n");
}
```

- [ ] **Step 4.4: Run tests — expect pass**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: all tests pass.

- [ ] **Step 4.5: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/core/prompts.js tests/prompts.test.js
git commit -m "feat(core): add prompt builders"
```

---

## Task 5: `core/parse.js` (TDD)

Pure response parsers. Strips ` ```json ` fences. Throws on malformed JSON — caller handles fallback.

**Files:**
- Create: `tests/parse.test.js`
- Create: `src/core/parse.js`

- [ ] **Step 5.1: Write failing tests**

Write `tests/parse.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlockResponse, parseBatchResponse } from "../src/core/parse.js";

test("parseBlockResponse: meaningful=true returns translation", () => {
  const raw = '{"meaningful": true, "translation": "안녕하세요"}';
  assert.deepEqual(parseBlockResponse(raw), {
    meaningful: true,
    translation: "안녕하세요",
  });
});

test("parseBlockResponse: meaningful=false returns meaningful:false", () => {
  const raw = '{"meaningful": false}';
  assert.deepEqual(parseBlockResponse(raw), { meaningful: false });
});

test("parseBlockResponse: strips ```json fences", () => {
  const raw = '```json\n{"meaningful": true, "translation": "Hi"}\n```';
  assert.deepEqual(parseBlockResponse(raw), {
    meaningful: true,
    translation: "Hi",
  });
});

test("parseBlockResponse: strips bare ``` fences", () => {
  const raw = '```\n{"meaningful": false}\n```';
  assert.deepEqual(parseBlockResponse(raw), { meaningful: false });
});

test("parseBlockResponse: throws on invalid JSON", () => {
  assert.throws(() => parseBlockResponse("not json at all"));
});

test("parseBlockResponse: missing translation with meaningful=true returns meaningful:false", () => {
  const raw = '{"meaningful": true}';
  assert.deepEqual(parseBlockResponse(raw), { meaningful: false });
});

test("parseBatchResponse: parses JSON array", () => {
  const raw = '[{"i":0,"m":true,"t":"hi"},{"i":1,"m":false}]';
  assert.deepEqual(parseBatchResponse(raw), [
    { i: 0, m: true, t: "hi" },
    { i: 1, m: false },
  ]);
});

test("parseBatchResponse: strips ```json fences", () => {
  const raw = '```json\n[{"i":0,"m":false}]\n```';
  assert.deepEqual(parseBatchResponse(raw), [{ i: 0, m: false }]);
});

test("parseBatchResponse: throws when not an array", () => {
  assert.throws(() => parseBatchResponse('{"i":0,"m":false}'));
});

test("parseBatchResponse: throws on invalid JSON", () => {
  assert.throws(() => parseBatchResponse("garbage"));
});
```

- [ ] **Step 5.2: Run tests — expect failure**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: `parse.test.js` fails with module not found.

- [ ] **Step 5.3: Implement `src/core/parse.js`**

Write `src/core/parse.js`:
```js
function stripFences(raw) {
  return raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
}

export function parseBlockResponse(raw) {
  const json = stripFences(raw);
  const parsed = JSON.parse(json);
  if (parsed.meaningful && parsed.translation) {
    return { meaningful: true, translation: parsed.translation };
  }
  return { meaningful: false };
}

export function parseBatchResponse(raw) {
  const json = stripFences(raw);
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("Batch response is not an array");
  }
  return parsed;
}
```

- [ ] **Step 5.4: Run tests — expect pass**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/core/parse.js tests/parse.test.js
git commit -m "feat(core): add LLM response parsers"
```

---

## Task 6: `core/providers.js` (TDD)

Build the HTTP request shape and parse the JSON response for each of the four providers. **Pure** — no `fetch` here. The body is returned as a plain JS object; the caller (`background.js`) runs `JSON.stringify` when sending.

**Files:**
- Create: `tests/providers.test.js`
- Create: `src/core/providers.js`

- [ ] **Step 6.1: Write failing tests**

Write `tests/providers.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, parseResponse } from "../src/core/providers.js";

const cfg = { apiKey: "KEY", model: "m1" };
const sys = "you are a translator";
const user = "こんにちは";

test("buildRequest openai: url/headers/body shape", () => {
  const r = buildRequest("openai", cfg, sys, user);
  assert.equal(r.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(r.method, "POST");
  assert.equal(r.headers["Content-Type"], "application/json");
  assert.equal(r.headers.Authorization, "Bearer KEY");
  assert.equal(r.body.model, "m1");
  assert.equal(r.body.messages[0].role, "system");
  assert.equal(r.body.messages[0].content, sys);
  assert.equal(r.body.messages[1].role, "user");
  assert.equal(r.body.messages[1].content, user);
  assert.equal(r.body.max_tokens, 8192);
});

test("buildRequest gemini: url contains model and api key", () => {
  const r = buildRequest("gemini", cfg, sys, user);
  assert.equal(
    r.url,
    "https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent?key=KEY",
  );
  assert.equal(r.body.system_instruction.parts[0].text, sys);
  assert.equal(r.body.contents[0].parts[0].text, user);
  assert.equal(r.body.generationConfig.maxOutputTokens, 8192);
});

test("buildRequest claude: x-api-key header and anthropic-version", () => {
  const r = buildRequest("claude", cfg, sys, user);
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], "KEY");
  assert.equal(r.headers["anthropic-version"], "2023-06-01");
  assert.equal(r.body.system, sys);
  assert.equal(r.body.messages[0].content, user);
  assert.equal(r.body.max_tokens, 8192);
});

test("buildRequest ollama: localhost url, no auth header", () => {
  const r = buildRequest("ollama", cfg, sys, user);
  assert.equal(r.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(r.headers.Authorization, undefined);
  assert.equal(r.body.temperature, 0);
  assert.equal(r.body.messages[0].content, sys);
});

test("buildRequest: unknown provider throws", () => {
  assert.throws(() => buildRequest("unknown", cfg, sys, user));
});

test("parseResponse openai: extracts choices[0].message.content", () => {
  const data = { choices: [{ message: { content: "hi" } }] };
  assert.equal(parseResponse("openai", data), "hi");
});

test("parseResponse openai: missing content returns empty string", () => {
  assert.equal(parseResponse("openai", {}), "");
});

test("parseResponse gemini: extracts candidates[0].content.parts[0].text", () => {
  const data = { candidates: [{ content: { parts: [{ text: "hi" }] } }] };
  assert.equal(parseResponse("gemini", data), "hi");
});

test("parseResponse gemini: missing returns empty string", () => {
  assert.equal(parseResponse("gemini", {}), "");
});

test("parseResponse claude: finds first text block", () => {
  const data = {
    content: [
      { type: "thinking", text: "x" },
      { type: "text", text: "hi" },
    ],
  };
  assert.equal(parseResponse("claude", data), "hi");
});

test("parseResponse claude: missing returns empty string", () => {
  assert.equal(parseResponse("claude", {}), "");
});

test("parseResponse ollama: same shape as openai", () => {
  const data = { choices: [{ message: { content: "hi" } }] };
  assert.equal(parseResponse("ollama", data), "hi");
});

test("parseResponse: unknown provider throws", () => {
  assert.throws(() => parseResponse("unknown", {}));
});
```

- [ ] **Step 6.2: Run tests — expect failure**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: `providers.test.js` fails with module not found.

- [ ] **Step 6.3: Implement `src/core/providers.js`**

Write `src/core/providers.js`:
```js
export function buildRequest(provider, { apiKey, model }, systemPrompt, userMessage) {
  if (provider === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 8192,
      },
    };
  }

  if (provider === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 8192 },
      },
    };
  }

  if (provider === "claude") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      },
    };
  }

  if (provider === "ollama") {
    return {
      url: "http://localhost:11434/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      },
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export function parseResponse(provider, data) {
  if (provider === "openai" || provider === "ollama") {
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "gemini") {
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  if (provider === "claude") {
    return data.content?.find((b) => b.type === "text")?.text ?? "";
  }
  throw new Error(`Unknown provider: ${provider}`);
}
```

- [ ] **Step 6.4: Run tests — expect pass**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: all 5 test files pass, fail=0.

- [ ] **Step 6.5: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/core/providers.js tests/providers.test.js
git commit -m "feat(core): add LLM provider request/response adapters"
```

---

## Task 7: `manifest.json`

MV3 manifest. Host permissions match libraa. Background service worker is an ES module. Content files are web-accessible so dynamic `import()` can load them. `default_locale` is `ko`; the description and any future user-visible manifest strings use the `__MSG_*__` syntax.

**Files:**
- Create: `manifest.json`

- [ ] **Step 7.1: Write `manifest.json`**

Write `manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "AATranslator",
  "version": "0.1.0",
  "default_locale": "ko",
  "description": "__MSG_app_description__",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
    "http://localhost:11434/*"
  ],
  "action": {
    "default_icon": "icons/icon48.png"
  },
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "icons": {
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["src/content/*.js", "src/content/*.css"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

Note: the manifest references `__MSG_app_description__` and declares `"default_locale": "ko"`, which require the `_locales/ko/` directory from Task 7.5 to load successfully in Chrome. Do not attempt to load the unpacked extension until Task 7.5 is committed — Chrome will refuse a manifest whose `default_locale` directory is missing.

- [ ] **Step 7.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add manifest.json
git commit -m "feat: add MV3 manifest with i18n hook"
```

---

## Task 7.5: i18n Scaffold

Create the three locale message files (`ko` = default, `en`, `ja`) and a tiny `t()` helper used by the content layer. All UI strings live in `_locales/`; code imports `t` and never hardcodes localized text.

**Files:**
- Create: `_locales/ko/messages.json`
- Create: `_locales/en/messages.json`
- Create: `_locales/ja/messages.json`
- Create: `src/content/i18n.js`

- [ ] **Step 7.5.1: Write `_locales/ko/messages.json`**

Write `_locales/ko/messages.json`:
```json
{
  "app_description": {
    "message": "AA(아스키 아트/야르오) 작품 속 일본어를 페이지에서 바로 LLM으로 번역합니다"
  },
  "toolbar_select": { "message": "영역 선택" },
  "toolbar_needs_setup": { "message": "⚠ 설정 필요" },
  "toolbar_selecting_hint": { "message": "영역을 클릭하세요" },
  "toolbar_cancel": { "message": "취소" },
  "toolbar_block_count": {
    "message": "$COUNT$ 블록",
    "placeholders": { "count": { "content": "$1", "example": "42" } }
  },
  "toolbar_translate_all": { "message": "전체 번역" },
  "toolbar_reselect": { "message": "다시 선택" },
  "toolbar_reset": { "message": "초기화" },
  "toolbar_highlight_on": { "message": "강조 ON" },
  "toolbar_highlight_off": { "message": "강조 OFF" },
  "toolbar_settings": { "message": "설정" },
  "settings_title": { "message": "AATranslator 설정" },
  "settings_provider": { "message": "Provider" },
  "settings_api_key": { "message": "API Key" },
  "settings_model": { "message": "Model" },
  "settings_concurrency": { "message": "동시 실행 수" },
  "settings_target_language": { "message": "번역 대상 언어" },
  "settings_highlight_color": { "message": "강조 색상" },
  "settings_save": { "message": "저장" },
  "settings_close": { "message": "닫기" },
  "provider_ollama": { "message": "Ollama (로컬)" },
  "color_light_green": { "message": "연녹색" },
  "color_light_blue": { "message": "연파랑" },
  "color_light_yellow": { "message": "연노랑" },
  "color_light_purple": { "message": "연보라" },
  "color_light_red": { "message": "연빨강" },
  "color_transparent": { "message": "투명" },
  "popup_translate": { "message": "번역" }
}
```

- [ ] **Step 7.5.2: Write `_locales/en/messages.json`**

Write `_locales/en/messages.json`:
```json
{
  "app_description": {
    "message": "Translate Japanese AA (Ascii Art / Yaruo) works in-place using LLMs"
  },
  "toolbar_select": { "message": "Select" },
  "toolbar_needs_setup": { "message": "⚠ Setup required" },
  "toolbar_selecting_hint": { "message": "Click an area to translate" },
  "toolbar_cancel": { "message": "Cancel" },
  "toolbar_block_count": {
    "message": "$COUNT$ blocks",
    "placeholders": { "count": { "content": "$1", "example": "42" } }
  },
  "toolbar_translate_all": { "message": "Translate All" },
  "toolbar_reselect": { "message": "Reselect" },
  "toolbar_reset": { "message": "Reset" },
  "toolbar_highlight_on": { "message": "HL ON" },
  "toolbar_highlight_off": { "message": "HL OFF" },
  "toolbar_settings": { "message": "Settings" },
  "settings_title": { "message": "AATranslator Settings" },
  "settings_provider": { "message": "Provider" },
  "settings_api_key": { "message": "API Key" },
  "settings_model": { "message": "Model" },
  "settings_concurrency": { "message": "Concurrency" },
  "settings_target_language": { "message": "Target Language" },
  "settings_highlight_color": { "message": "Highlight Color" },
  "settings_save": { "message": "Save" },
  "settings_close": { "message": "Close" },
  "provider_ollama": { "message": "Ollama (local)" },
  "color_light_green": { "message": "Light green" },
  "color_light_blue": { "message": "Light blue" },
  "color_light_yellow": { "message": "Light yellow" },
  "color_light_purple": { "message": "Light purple" },
  "color_light_red": { "message": "Light red" },
  "color_transparent": { "message": "Transparent" },
  "popup_translate": { "message": "Translate" }
}
```

- [ ] **Step 7.5.3: Write `_locales/ja/messages.json`**

Write `_locales/ja/messages.json`:
```json
{
  "app_description": {
    "message": "AA(アスキーアート/やる夫)作品の日本語をページ上で直接 LLM で翻訳します"
  },
  "toolbar_select": { "message": "範囲選択" },
  "toolbar_needs_setup": { "message": "⚠ 設定が必要" },
  "toolbar_selecting_hint": { "message": "翻訳する範囲をクリックしてください" },
  "toolbar_cancel": { "message": "キャンセル" },
  "toolbar_block_count": {
    "message": "$COUNT$ ブロック",
    "placeholders": { "count": { "content": "$1", "example": "42" } }
  },
  "toolbar_translate_all": { "message": "すべて翻訳" },
  "toolbar_reselect": { "message": "再選択" },
  "toolbar_reset": { "message": "リセット" },
  "toolbar_highlight_on": { "message": "HL ON" },
  "toolbar_highlight_off": { "message": "HL OFF" },
  "toolbar_settings": { "message": "設定" },
  "settings_title": { "message": "AATranslator 設定" },
  "settings_provider": { "message": "プロバイダー" },
  "settings_api_key": { "message": "API キー" },
  "settings_model": { "message": "モデル" },
  "settings_concurrency": { "message": "並列実行数" },
  "settings_target_language": { "message": "翻訳先言語" },
  "settings_highlight_color": { "message": "ハイライト色" },
  "settings_save": { "message": "保存" },
  "settings_close": { "message": "閉じる" },
  "provider_ollama": { "message": "Ollama (ローカル)" },
  "color_light_green": { "message": "薄緑" },
  "color_light_blue": { "message": "薄青" },
  "color_light_yellow": { "message": "薄黄" },
  "color_light_purple": { "message": "薄紫" },
  "color_light_red": { "message": "薄赤" },
  "color_transparent": { "message": "透明" },
  "popup_translate": { "message": "翻訳" }
}
```

- [ ] **Step 7.5.4: Write `src/content/i18n.js`**

Write `src/content/i18n.js`:
```js
export function t(key, ...subs) {
  try {
    const msg = chrome.i18n.getMessage(key, subs.length ? subs.map(String) : undefined);
    return msg || key;
  } catch {
    return key;
  }
}
```

- [ ] **Step 7.5.5: Validate JSON files parse**

Run (iterates each locale file and lets `node` throw on invalid JSON):
```bash
cd /Users/tunarider/Sources/AATranslator
for f in _locales/*/messages.json; do
  node --input-type=commonjs -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f ok"
done
```

Expected: three `ok` lines.

- [ ] **Step 7.5.6: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add _locales/ src/content/i18n.js
git commit -m "feat(i18n): add ko/en/ja locales and t() helper"
```

---

## Task 8: `src/background.js`

Service worker. Handles extension icon click (try message → fall back to inject bootstrap), and proxies LLM calls with 429/503/529 retry.

**Files:**
- Create: `src/background.js`

- [ ] **Step 8.1: Write `src/background.js`**

Write `src/background.js`:
```js
import { buildRequest, parseResponse } from "./core/providers.js";

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-toolbar" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/bootstrap.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/content/styles.css"],
      });
    } catch (e) {
      console.warn("[AAT] Cannot inject into this tab:", e);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "llm-call") {
    handleWithRetry(msg.config, msg.systemPrompt, msg.userMessage)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
});

async function handleWithRetry(config, systemPrompt, userMessage) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callLLM(config, systemPrompt, userMessage);
    } catch (err) {
      const status = err.message?.match(/\b(429|503|529)\b/);
      if (status && attempt < maxRetries - 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
        console.log(
          `[AAT] ${status[0]} error, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

async function callLLM(config, systemPrompt, userMessage) {
  const { provider } = config;
  const req = buildRequest(provider, config, systemPrompt, userMessage);
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return parseResponse(provider, data);
}
```

- [ ] **Step 8.2: Verify core tests still pass (no regression)**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: all core tests still pass (background.js is not imported by tests but we confirm nothing broke).

- [ ] **Step 8.3: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/background.js
git commit -m "feat(background): add service worker with LLM proxy and retry"
```

---

## Task 9: `src/content/state.js`

Shared state object, DEFAULTS, and `loadSettings()`. Exports live references — other content modules import `state` and mutate it directly.

**Files:**
- Create: `src/content/state.js`

- [ ] **Step 9.1: Write `src/content/state.js`**

Write `src/content/state.js`:
```js
export const DEFAULTS = {
  provider: "gemini",
  model: "gemini-2.5-flash-lite",
  apiKey: "",
  concurrency: 3,
  targetLang: "ko",
  highlightColor: "rgba(34, 197, 94, 0.1)",
};

export const state = {
  mode: "idle", // "idle" | "selecting" | "ready" | "translating"
  selectedContainer: null,
  toolbar: null,
  settingsModal: null,
  config: null,
  targetLang: DEFAULTS.targetLang,
  highlightOn: true,
  highlightColor: DEFAULTS.highlightColor,
  translatedCount: 0,
  totalCount: 0,
  cancelFlag: false,
  translateStartTime: 0,
  selectionPopup: null,
  highlightStyleEl: null,
};

export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["provider", "apiKey", "model", "targetLang", "concurrency", "highlightColor"],
      (data) => {
        state.config = {
          provider: data.provider || DEFAULTS.provider,
          apiKey: data.apiKey ?? DEFAULTS.apiKey,
          model: data.model || DEFAULTS.model,
          concurrency: data.concurrency || DEFAULTS.concurrency,
        };
        state.targetLang = data.targetLang || DEFAULTS.targetLang;
        state.highlightColor = data.highlightColor || DEFAULTS.highlightColor;
        resolve();
      },
    );
  });
}
```

- [ ] **Step 9.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/state.js
git commit -m "feat(content): add shared state and settings loader"
```

---

## Task 10: `src/content/llm.js`

Thin wrapper that sends an `llm-call` message to the background worker using the current `state.config`.

**Files:**
- Create: `src/content/llm.js`

- [ ] **Step 10.1: Write `src/content/llm.js`**

Write `src/content/llm.js`:
```js
import { state } from "./state.js";

export function callLLM(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "llm-call", config: state.config, systemPrompt, userMessage },
      (response) => {
        if (response?.ok) resolve(response.text);
        else reject(new Error(response?.error || "LLM call failed"));
      },
    );
  });
}
```

- [ ] **Step 10.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/llm.js
git commit -m "feat(content): add LLM message bridge"
```

---

## Task 11: `src/content/dom.js`

DOM helpers: wrap Japanese blocks in `<span class="aat-block">`, unwrap, apply translation (preserving newlines), highlight style element. Imports `SPLIT_RE`/`isJaBlock`/`extractJaBlocks` from `core/ja-blocks.js` and `state` from `state.js`. `wrapJaBlocks` takes an `onClick` callback so `dom.js` doesn't depend on `translate-flow.js` (avoiding a circular import).

**Files:**
- Create: `src/content/dom.js`

- [ ] **Step 11.1: Write `src/content/dom.js`**

Write `src/content/dom.js`:
```js
import { state } from "./state.js";
import { SPLIT_RE, isJaBlock, extractJaBlocks } from "../core/ja-blocks.js";

export function wrapJaBlocks(container, onClick) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent && extractJaBlocks(node.textContent).length > 0) {
      textNodes.push(node);
    }
  }
  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const tokens = text.split(SPLIT_RE);
    if (tokens.length <= 1 && !isJaBlock(text)) continue;
    const frag = document.createDocumentFragment();
    for (const token of tokens) {
      if (!token) continue;
      if (!SPLIT_RE.test(token) && isJaBlock(token)) {
        const span = document.createElement("span");
        span.className = "aat-block";
        span.textContent = token;
        span.dataset.original = token;
        span.addEventListener("click", onClick);
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(token));
      }
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

export function unwrapBlocks(container) {
  const spans = container.querySelectorAll(".aat-block");
  for (const span of spans) {
    span.replaceWith(document.createTextNode(span.dataset.original || span.textContent));
  }
  container.normalize();
}

export function setSpanText(span, text) {
  span.innerHTML = "";
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) span.appendChild(document.createElement("br"));
    span.appendChild(document.createTextNode(lines[i]));
  }
}

export function applyTranslation(span, translated) {
  span.dataset.translated = translated;
  span.dataset.showing = "translated";
  setSpanText(span, translated);
  span.classList.add("aat-translated");
  span.classList.remove("aat-translating");
}

export function toggleSpan(span) {
  const showing = span.dataset.showing || "translated";
  if (showing === "translated") {
    setSpanText(span, span.dataset.original);
    span.dataset.showing = "original";
  } else {
    setSpanText(span, span.dataset.translated);
    span.dataset.showing = "translated";
  }
}

export function applyHighlightStyle() {
  if (!state.highlightStyleEl) {
    state.highlightStyleEl = document.createElement("style");
    state.highlightStyleEl.id = "aat-highlight-style";
    document.head.appendChild(state.highlightStyleEl);
  }
  if (state.highlightOn) {
    state.highlightStyleEl.textContent =
      `.aat-block.aat-translated { background-color: ${state.highlightColor} !important; }`;
  } else {
    state.highlightStyleEl.textContent =
      `.aat-block.aat-translated { background-color: transparent !important; }`;
  }
}
```

- [ ] **Step 11.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/dom.js
git commit -m "feat(content): add DOM wrap/unwrap and highlight helpers"
```

---

## Task 12: `src/content/translate-flow.js`

Orchestrates core modules + DOM. Provides `translateBlockText`, `translateSpan`, `translateBatchSpans`, `translateAll`, and `onBlockClick`. `translateAll` takes an `updateUI` callback so this file doesn't depend on `ui.js` (avoiding a cycle).

Counting rule: `translateSpan` and `translateBatchSpans` increment `state.translatedCount` exactly once per span they "resolve" (successfully translated OR confirmed decorative). Spans that go into `failed` are not counted until a retry resolves them. The final fallback individual pass in `translateAll` counts each span via `translateSpan`.

**Files:**
- Create: `src/content/translate-flow.js`

- [ ] **Step 12.1: Write `src/content/translate-flow.js`**

Write `src/content/translate-flow.js`:
```js
import { state } from "./state.js";
import { callLLM } from "./llm.js";
import { applyTranslation, toggleSpan, setSpanText } from "./dom.js";
import { isStillJapanese } from "../core/ja-blocks.js";
import { buildBlockPrompt, buildBatchPrompt, formatBatchUser } from "../core/prompts.js";
import { parseBlockResponse, parseBatchResponse } from "../core/parse.js";
import { buildBatches } from "../core/batches.js";

export async function translateBlockText(text) {
  const systemPrompt = buildBlockPrompt(state.targetLang);
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await callLLM(systemPrompt, text);
    try {
      const parsed = parseBlockResponse(raw);
      if (parsed.meaningful && parsed.translation) {
        if (parsed.translation.trim() === text.trim()) continue;
        if (isStillJapanese(parsed.translation) && attempt < 2) continue;
        return { meaningful: true, translated: parsed.translation };
      }
      return { meaningful: false, translated: text };
    } catch {
      const trimmed = raw.trim();
      if (trimmed && trimmed !== text.trim() && !isStillJapanese(trimmed)) {
        return { meaningful: true, translated: trimmed };
      }
    }
  }
  return { meaningful: false, translated: text };
}

export async function translateSpan(span, updateUI) {
  if (state.cancelFlag) return;
  span.classList.add("aat-translating");
  try {
    const result = await translateBlockText(span.dataset.original);
    if (state.cancelFlag) {
      span.classList.remove("aat-translating");
      return;
    }
    if (result.meaningful) {
      applyTranslation(span, result.translated);
    } else {
      span.classList.remove("aat-translating");
    }
  } catch (err) {
    console.error("[AAT] Single translation failed:", err);
    span.classList.remove("aat-translating");
  }
  state.translatedCount++;
  updateUI?.();
}

export async function translateBatchSpans(spans, updateUI) {
  const systemPrompt = buildBatchPrompt(state.targetLang);
  const texts = spans.map((s) => s.dataset.original);
  const userMsg = formatBatchUser(texts);
  try {
    const raw = await callLLM(systemPrompt, userMsg);
    const parsed = parseBatchResponse(raw);
    const failed = [];
    for (let i = 0; i < spans.length; i++) {
      if (state.cancelFlag) break;
      const span = spans[i];
      const entry = parsed.find((p) => p.i === i);
      if (!entry) {
        failed.push(span);
      } else if (
        entry.m &&
        entry.t &&
        entry.t.trim() !== texts[i].trim() &&
        !isStillJapanese(entry.t)
      ) {
        applyTranslation(span, entry.t);
        state.translatedCount++;
        updateUI?.();
      } else {
        span.classList.remove("aat-translating");
        state.translatedCount++;
        updateUI?.();
      }
    }
    return failed;
  } catch {
    return spans;
  }
}

export async function onBlockClick(e) {
  if (!state.config) return;
  const span = e.target.closest(".aat-block") || e.target;
  if (span.classList.contains("aat-translating")) return;

  if (span.classList.contains("aat-translated")) {
    toggleSpan(span);
    return;
  }

  span.classList.add("aat-translating");
  try {
    const result = await translateBlockText(span.dataset.original);
    if (result.meaningful) {
      applyTranslation(span, result.translated);
    }
  } catch (err) {
    console.error("[AAT] Block click translation failed:", err);
  }
  span.classList.remove("aat-translating");
}

export async function translateAll(updateUI) {
  if (!state.selectedContainer || !state.config) return;
  const blocks = [
    ...state.selectedContainer.querySelectorAll(".aat-block:not(.aat-translated)"),
  ];
  state.totalCount = blocks.length;
  state.translatedCount = 0;
  state.cancelFlag = false;
  state.translateStartTime = Date.now();
  state.mode = "translating";
  updateUI();

  blocks.forEach((s) => s.classList.add("aat-translating"));

  const concurrency = state.config.concurrency || 3;
  const provider = state.config.provider;
  const getText = (s) => s.dataset.original;

  const runChunk = (chunkBatches) =>
    Promise.all(
      chunkBatches.map((batch) => {
        if (state.cancelFlag) return Promise.resolve([]);
        if (batch.length === 1) {
          return translateSpan(batch[0], updateUI).then(() => []);
        }
        return translateBatchSpans(batch, updateUI);
      }),
    );

  const batches = buildBatches(blocks, provider, getText);
  for (let i = 0; i < batches.length; i += concurrency) {
    if (state.cancelFlag) break;
    const chunk = batches.slice(i, i + concurrency);
    const results = await runChunk(chunk);
    const failed = results.flat();

    if (failed.length > 0) {
      const smallBatches = buildBatches(failed, provider, getText);
      for (let j = 0; j < smallBatches.length; j += concurrency) {
        if (state.cancelFlag) break;
        const retryChunk = smallBatches.slice(j, j + concurrency);
        const retryResults = await runChunk(retryChunk);
        const stillFailed = retryResults.flat();
        for (let k = 0; k < stillFailed.length; k += concurrency) {
          if (state.cancelFlag) break;
          await Promise.all(
            stillFailed.slice(k, k + concurrency).map((span) => {
              if (state.cancelFlag) return Promise.resolve();
              return translateSpan(span, updateUI);
            }),
          );
        }
      }
    }
  }

  blocks.forEach((s) => s.classList.remove("aat-translating"));
  state.mode = "ready";
  updateUI();
}
```

- [ ] **Step 12.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/translate-flow.js
git commit -m "feat(content): add translate flow orchestration"
```

---

## Task 13: `src/content/selection.js`

Two independent selection features: (1) container pick mode (hover outline → click), (2) manual text-selection popup. Imports `wrapJaBlocks`/`unwrapBlocks` from `dom.js` and `onBlockClick`/`translateBlockText` from `translate-flow.js`. Takes an `updateUI` argument where needed.

**Files:**
- Create: `src/content/selection.js`

- [ ] **Step 13.1: Write `src/content/selection.js`**

Write `src/content/selection.js`:
```js
import { state } from "./state.js";
import { wrapJaBlocks, unwrapBlocks, applyTranslation, setSpanText } from "./dom.js";
import { onBlockClick, translateBlockText } from "./translate-flow.js";
import { t } from "./i18n.js";

let currentUpdateUI = null;

export function startSelecting(updateUI) {
  currentUpdateUI = updateUI;
  state.mode = "selecting";
  document.body.style.cursor = "crosshair";
  document.addEventListener("mouseover", onSelectHover, true);
  document.addEventListener("mouseout", onSelectOut, true);
  document.addEventListener("click", onSelectClick, true);
  updateUI();
}

export function cancelSelecting(updateUI) {
  document.removeEventListener("mouseover", onSelectHover, true);
  document.removeEventListener("mouseout", onSelectOut, true);
  document.removeEventListener("click", onSelectClick, true);
  document.querySelectorAll(".aat-selectable").forEach((el) =>
    el.classList.remove("aat-selectable"),
  );
  document.body.style.cursor = "";
  state.mode = "idle";
  updateUI();
}

function onSelectHover(e) {
  if (state.mode !== "selecting") return;
  const el = e.target;
  if (el === state.toolbar || state.toolbar?.contains(el)) return;
  el.classList.add("aat-selectable");
}

function onSelectOut(e) {
  if (state.mode !== "selecting") return;
  e.target.classList.remove("aat-selectable");
}

function onSelectClick(e) {
  if (state.mode !== "selecting") return;
  const el = e.target;
  if (el === state.toolbar || state.toolbar?.contains(el)) return;

  e.preventDefault();
  e.stopPropagation();

  document.removeEventListener("mouseover", onSelectHover, true);
  document.removeEventListener("mouseout", onSelectOut, true);
  document.removeEventListener("click", onSelectClick, true);
  document.querySelectorAll(".aat-selectable").forEach((x) =>
    x.classList.remove("aat-selectable"),
  );
  document.body.style.cursor = "";

  if (state.selectedContainer) {
    state.selectedContainer.classList.remove("aat-selected");
    unwrapBlocks(state.selectedContainer);
  }

  state.selectedContainer = el;
  state.selectedContainer.classList.add("aat-selected");
  wrapJaBlocks(state.selectedContainer, onBlockClick);

  state.mode = "ready";
  currentUpdateUI?.();
}

export function resetAll(updateUI) {
  if (state.selectedContainer) {
    unwrapBlocks(state.selectedContainer);
    state.selectedContainer.classList.remove("aat-selected");
    state.selectedContainer = null;
  }
  state.cancelFlag = true;
  state.mode = "idle";
  updateUI();
}

// ===== Manual text-selection popup =====

function removeSelectionPopup() {
  if (state.selectionPopup) {
    state.selectionPopup.remove();
    state.selectionPopup = null;
  }
}

export function installSelectionPopup() {
  document.addEventListener("mouseup", (e) => {
    if (!state.toolbar) return;
    if (state.toolbar.contains(e.target)) return;
    if (state.selectionPopup?.contains(e.target)) return;
    if (state.settingsModal?.contains(e.target)) return;

    removeSelectionPopup();

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !state.config) return;
    const rawText = sel.toString();
    if (!rawText.trim()) return;
    const text = rawText;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const popup = document.createElement("div");
    popup.className = "aat-selection-popup";
    popup.textContent = t("popup_translate");
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top + window.scrollY - 32}px`;
    document.body.appendChild(popup);
    state.selectionPopup = popup;

    popup.addEventListener("click", async () => {
      removeSelectionPopup();

      const span = document.createElement("span");
      span.className = "aat-block aat-translating";
      span.dataset.original = text;
      span.addEventListener("click", onBlockClick);

      try {
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        sel.removeAllRanges();

        const leadingWS = text.match(/^(\s*)/)[1];
        const trailingWS = text.match(/(\s*)$/)[1];
        const trimmedText = text.trim();

        const result = await translateBlockText(trimmedText);
        if (result.meaningful) {
          const translated = leadingWS + result.translated + trailingWS;
          applyTranslation(span, translated);
        }
      } catch (err) {
        console.error("[AAT] Manual translation failed:", err);
      }
      span.classList.remove("aat-translating");
    });
  });

  document.addEventListener("mousedown", (e) => {
    if (state.selectionPopup && !state.selectionPopup.contains(e.target)) {
      removeSelectionPopup();
    }
  });
}
```

- [ ] **Step 13.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/selection.js
git commit -m "feat(content): add container/text selection handlers"
```

---

## Task 14: `src/content/styles.css`

All styles: toolbar, block highlight, selection outlines, settings modal, manual selection popup. Class names use `aat-` prefix.

**Files:**
- Create: `src/content/styles.css`

- [ ] **Step 14.1: Write `src/content/styles.css`**

Write `src/content/styles.css`:
```css
/* Container selection mode */
.aat-selectable {
  outline: 2px dashed rgba(79, 123, 232, 0.5) !important;
  cursor: crosshair !important;
}
.aat-selectable:hover {
  outline: 2px solid rgba(79, 123, 232, 0.8) !important;
  background-color: rgba(79, 123, 232, 0.05) !important;
}
.aat-selected {
  outline: 2px solid #4f7be8 !important;
}

/* Japanese block highlight */
.aat-block {
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 0.1s;
}
.aat-block:hover {
  background-color: rgba(79, 123, 232, 0.15) !important;
}
.aat-block.aat-translating {
  background-color: rgba(79, 123, 232, 0.1) !important;
  animation: aat-pulse 1.5s infinite;
}
.aat-block.aat-translated {
  background-color: rgba(34, 197, 94, 0.1) !important;
}

@keyframes aat-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Floating toolbar */
.aat-toolbar {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: #1a1d23;
  color: #e8eaef;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  align-items: center;
}
.aat-toolbar .aat-brand {
  font-weight: 600;
  white-space: nowrap;
}
.aat-toolbar .aat-ver {
  color: #9198a5;
  font-weight: 400;
  margin-left: 4px;
}
.aat-toolbar button {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
}
.aat-toolbar .aat-btn-primary {
  background: #4f7be8;
  color: #fff;
}
.aat-toolbar .aat-btn-primary:hover {
  background: #3d65cc;
}
.aat-toolbar .aat-btn-secondary {
  background: #374151;
  color: #e8eaef;
}
.aat-toolbar .aat-btn-secondary:hover {
  background: #4b5563;
}
.aat-toolbar .aat-btn-danger {
  background: #374151;
  color: #e5484d;
}
.aat-toolbar .aat-btn-danger:hover {
  background: #3a1d1f;
}
.aat-toolbar .aat-status {
  color: #9198a5;
  margin-left: 4px;
  white-space: nowrap;
}
.aat-toolbar .aat-progress-bar {
  width: 80px;
  height: 4px;
  background: #374151;
  border-radius: 2px;
  overflow: hidden;
}
.aat-toolbar .aat-progress-fill {
  height: 100%;
  background: #4f7be8;
  border-radius: 2px;
  transition: width 0.3s;
}

/* Selection popup */
.aat-selection-popup {
  position: absolute;
  transform: translateX(-50%);
  z-index: 2147483647;
  padding: 4px 12px;
  background: #4f7be8;
  color: #fff;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  user-select: none;
}
.aat-selection-popup:hover {
  background: #3d65cc;
}

/* Settings modal */
.aat-settings {
  position: fixed;
  bottom: 56px;
  right: 20px;
  z-index: 2147483647;
  width: 300px;
  padding: 20px;
  background: #1a1d23;
  color: #e8eaef;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  border: 1px solid #2e313b;
}
.aat-settings .aat-settings-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #2e313b;
}
.aat-settings .aat-settings-group {
  margin-bottom: 12px;
}
.aat-settings label {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: #9198a5;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.aat-settings select,
.aat-settings input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  background: #252830;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #e8eaef;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.aat-settings select:focus,
.aat-settings input:focus {
  border-color: #4f7be8;
  box-shadow: 0 0 0 2px rgba(79, 123, 232, 0.15);
}
.aat-settings .aat-settings-footer {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #2e313b;
}
.aat-settings .aat-settings-footer button {
  flex: 1;
  height: 32px;
  border-radius: 6px;
  font-weight: 500;
}
```

- [ ] **Step 14.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/styles.css
git commit -m "feat(content): add toolbar and modal styles"
```

---

## Task 15: `src/content/ui.js`

Toolbar create/update (state-driven render) + settings modal. Pulls version from `chrome.runtime.getManifest().version`. Exports `createToolbar`, `updateToolbar`, `toggleToolbar`, `toggleSettings`, `toggleHighlight`.

**Files:**
- Create: `src/content/ui.js`

- [ ] **Step 15.1: Write `src/content/ui.js`**

Write `src/content/ui.js`:
```js
import { state, loadSettings } from "./state.js";
import { applyHighlightStyle } from "./dom.js";
import { startSelecting, cancelSelecting, resetAll } from "./selection.js";
import { translateAll } from "./translate-flow.js";
import { t } from "./i18n.js";

function version() {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "?";
  }
}

export function createToolbar() {
  const el = document.createElement("div");
  el.className = "aat-toolbar";
  document.body.appendChild(el);
  state.toolbar = el;
  updateToolbar();
}

export function toggleToolbar() {
  if (!state.toolbar) {
    createToolbar();
  } else {
    state.toolbar.remove();
    state.toolbar = null;
    if (state.mode === "selecting") {
      cancelSelecting(() => {});
    }
  }
}

export function toggleHighlight() {
  state.highlightOn = !state.highlightOn;
  applyHighlightStyle();
  updateToolbar();
}

export function updateToolbar() {
  if (!state.toolbar) return;

  const brand = `<span class="aat-brand">AATranslator <span class="aat-ver">v${version()}</span></span>`;
  const rightBtns =
    `<button class="aat-btn-secondary" id="aat-hl-toggle">${state.highlightOn ? t("toolbar_highlight_on") : t("toolbar_highlight_off")}</button>` +
    `<button class="aat-btn-secondary" id="aat-settings">${t("toolbar_settings")}</button>`;

  let middle = "";
  if (state.mode === "idle") {
    middle =
      `<button class="aat-btn-primary" id="aat-select">${t("toolbar_select")}</button>` +
      (state.config ? "" : `<span class="aat-status">${t("toolbar_needs_setup")}</span>`);
  } else if (state.mode === "selecting") {
    middle =
      `<span class="aat-status">${t("toolbar_selecting_hint")}</span>` +
      `<button class="aat-btn-secondary" id="aat-cancel-select">${t("toolbar_cancel")}</button>`;
  } else if (state.mode === "ready") {
    const n = state.selectedContainer?.querySelectorAll(".aat-block:not(.aat-translated)").length || 0;
    middle =
      `<span class="aat-status">${t("toolbar_block_count", String(n))}</span>` +
      `<button class="aat-btn-primary" id="aat-translate-all">${t("toolbar_translate_all")}</button>` +
      `<button class="aat-btn-secondary" id="aat-reselect">${t("toolbar_reselect")}</button>` +
      `<button class="aat-btn-danger" id="aat-reset">${t("toolbar_reset")}</button>`;
  } else if (state.mode === "translating") {
    const pct = state.totalCount > 0 ? Math.round((state.translatedCount / state.totalCount) * 100) : 0;
    let etaStr = "";
    if (state.translatedCount > 0) {
      const elapsed = (Date.now() - state.translateStartTime) / 1000;
      const rate = state.translatedCount / elapsed;
      const remaining = Math.round((state.totalCount - state.translatedCount) / rate);
      if (remaining >= 60) {
        etaStr = `${Math.floor(remaining / 60)}m ${remaining % 60}s`;
      } else {
        etaStr = `${remaining}s`;
      }
    }
    middle =
      `<span class="aat-status">${state.translatedCount}/${state.totalCount}</span>` +
      `<div class="aat-progress-bar"><div class="aat-progress-fill" style="width:${pct}%"></div></div>` +
      `<span class="aat-status">${pct}%${etaStr ? ` · ${etaStr}` : ""}</span>` +
      `<button class="aat-btn-danger" id="aat-cancel">${t("toolbar_cancel")}</button>`;
  }

  state.toolbar.innerHTML = brand + middle + rightBtns;

  const q = (id) => state.toolbar.querySelector(id);
  q("#aat-select")?.addEventListener("click", () => startSelecting(updateToolbar));
  q("#aat-cancel-select")?.addEventListener("click", () => cancelSelecting(updateToolbar));
  q("#aat-translate-all")?.addEventListener("click", () => translateAll(updateToolbar));
  q("#aat-reselect")?.addEventListener("click", () => startSelecting(updateToolbar));
  q("#aat-reset")?.addEventListener("click", () => resetAll(updateToolbar));
  q("#aat-cancel")?.addEventListener("click", () => {
    state.cancelFlag = true;
    document.querySelectorAll(".aat-block.aat-translating").forEach((el) =>
      el.classList.remove("aat-translating"),
    );
    state.mode = "ready";
    updateToolbar();
  });
  q("#aat-hl-toggle")?.addEventListener("click", toggleHighlight);
  q("#aat-settings")?.addEventListener("click", toggleSettings);
}

export function toggleSettings() {
  if (state.settingsModal) {
    state.settingsModal.remove();
    state.settingsModal = null;
    return;
  }

  const modal = document.createElement("div");
  modal.className = "aat-settings";
  modal.innerHTML = `
    <div class="aat-settings-title">${t("settings_title")}</div>
    <div class="aat-settings-group">
      <label>${t("settings_provider")}</label>
      <select id="aat-s-provider">
        <option value="openai">OpenAI</option>
        <option value="gemini">Google Gemini</option>
        <option value="claude">Claude</option>
        <option value="ollama">${t("provider_ollama")}</option>
      </select>
    </div>
    <div class="aat-settings-group" id="aat-s-apikey-row">
      <label>${t("settings_api_key")}</label>
      <input type="password" id="aat-s-apikey">
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_model")}</label>
      <input type="text" id="aat-s-model">
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_concurrency")}</label>
      <select id="aat-s-concurrency">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="5">5</option>
        <option value="8">8</option>
        <option value="10">10</option>
      </select>
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_target_language")}</label>
      <select id="aat-s-lang">
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_highlight_color")}</label>
      <select id="aat-s-hlcolor">
        <option value="rgba(34, 197, 94, 0.1)">${t("color_light_green")}</option>
        <option value="rgba(79, 123, 232, 0.1)">${t("color_light_blue")}</option>
        <option value="rgba(234, 179, 8, 0.1)">${t("color_light_yellow")}</option>
        <option value="rgba(168, 85, 247, 0.1)">${t("color_light_purple")}</option>
        <option value="rgba(239, 68, 68, 0.1)">${t("color_light_red")}</option>
        <option value="rgba(0, 0, 0, 0)">${t("color_transparent")}</option>
      </select>
    </div>
    <div class="aat-settings-footer">
      <button class="aat-btn-primary" id="aat-s-save">${t("settings_save")}</button>
      <button class="aat-btn-secondary" id="aat-s-close">${t("settings_close")}</button>
    </div>
  `;
  document.body.appendChild(modal);
  state.settingsModal = modal;

  const pEl = modal.querySelector("#aat-s-provider");
  const kEl = modal.querySelector("#aat-s-apikey");
  const kRow = modal.querySelector("#aat-s-apikey-row");
  const mEl = modal.querySelector("#aat-s-model");
  const cEl = modal.querySelector("#aat-s-concurrency");
  const lEl = modal.querySelector("#aat-s-lang");
  const hlcEl = modal.querySelector("#aat-s-hlcolor");

  chrome.storage.sync.get(
    ["provider", "apiKey", "model", "concurrency", "targetLang", "highlightColor"],
    (data) => {
      pEl.value = data.provider || "gemini";
      if (data.apiKey) kEl.value = data.apiKey;
      mEl.value = data.model || "gemini-2.5-flash-lite";
      cEl.value = String(data.concurrency || 3);
      lEl.value = data.targetLang || "ko";
      if (data.highlightColor) hlcEl.value = data.highlightColor;
      kRow.style.display = pEl.value === "ollama" ? "none" : "block";
    },
  );

  pEl.addEventListener("change", () => {
    kRow.style.display = pEl.value === "ollama" ? "none" : "block";
  });

  modal.querySelector("#aat-s-save").addEventListener("click", () => {
    chrome.storage.sync.set(
      {
        provider: pEl.value,
        apiKey: kEl.value,
        model: mEl.value,
        concurrency: Number(cEl.value),
        targetLang: lEl.value,
        highlightColor: hlcEl.value,
      },
      async () => {
        state.highlightColor = hlcEl.value;
        applyHighlightStyle();
        await loadSettings();
        modal.remove();
        state.settingsModal = null;
        updateToolbar();
      },
    );
  });

  modal.querySelector("#aat-s-close").addEventListener("click", () => {
    modal.remove();
    state.settingsModal = null;
  });
}
```

- [ ] **Step 15.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/ui.js
git commit -m "feat(content): add toolbar and settings modal UI"
```

---

## Task 16: `src/content/main.js`

Entry module imported dynamically by `bootstrap.js`. Exports `init()` and `showToolbar()`. Sets up `storage.onChanged` and `runtime.onMessage` listeners and installs the manual selection popup.

**Files:**
- Create: `src/content/main.js`

- [ ] **Step 16.1: Write `src/content/main.js`**

Write `src/content/main.js`:
```js
import { state, loadSettings } from "./state.js";
import { applyHighlightStyle } from "./dom.js";
import { installSelectionPopup } from "./selection.js";
import { createToolbar, updateToolbar, toggleToolbar } from "./ui.js";

let initialized = false;

export async function init() {
  if (initialized) return;
  initialized = true;

  await loadSettings();
  applyHighlightStyle();
  installSelectionPopup();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggle-toolbar") toggleToolbar();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (
      changes.provider ||
      changes.apiKey ||
      changes.model ||
      changes.targetLang ||
      changes.concurrency ||
      changes.highlightColor
    ) {
      loadSettings().then(() => {
        applyHighlightStyle();
        updateToolbar();
      });
    }
  });
}

export function showToolbar() {
  if (!state.toolbar) createToolbar();
}
```

- [ ] **Step 16.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/main.js
git commit -m "feat(content): add main entry with message listeners"
```

---

## Task 17: `src/content/bootstrap.js`

Classic (non-module) loader injected by `chrome.scripting.executeScript`. Uses dynamic `import()` to pull `main.js` as an ES module, then calls `init()` and `showToolbar()`.

**Files:**
- Create: `src/content/bootstrap.js`

- [ ] **Step 17.1: Write `src/content/bootstrap.js`**

Write `src/content/bootstrap.js`:
```js
(async () => {
  try {
    const url = chrome.runtime.getURL("src/content/main.js");
    const mod = await import(url);
    await mod.init();
    mod.showToolbar();
  } catch (e) {
    console.error("[AAT] Failed to bootstrap content module:", e);
  }
})();
```

- [ ] **Step 17.2: Commit**

```bash
cd /Users/tunarider/Sources/AATranslator
git add src/content/bootstrap.js
git commit -m "feat(content): add dynamic import bootstrap loader"
```

---

## Task 18: Full Verification

Run the full test suite and load the extension in Chrome for a manual smoke test.

- [ ] **Step 18.1: Run full test suite**

Run: `cd /Users/tunarider/Sources/AATranslator && npm test`
Expected: all 5 test files pass. Final summary: `ℹ pass: <total>`, `ℹ fail: 0`.

- [ ] **Step 18.2: Manual smoke test in Chrome**

Labels below assume the default `ko` locale. If your Chrome UI language is `en` or `ja`, the equivalent labels from `_locales/<lang>/messages.json` apply instead.

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select `/Users/tunarider/Sources/AATranslator/`.
4. Open any page containing Japanese text (e.g. `https://ja.wikipedia.org/`).
5. Click the AATranslator icon in the toolbar — the thin toolbar should appear at the bottom-right: `AATranslator v0.1.0 [영역 선택] [강조 ON] [설정]` (or the `en`/`ja` equivalents).
6. Click **설정**, verify the title is `AATranslator 설정` and defaults: Provider=Google Gemini, Model=`gemini-2.5-flash-lite`. Enter a real Gemini API key, click **저장**.
7. Click **영역 선택**, hover to see outline, click a `<p>` containing Japanese — toolbar should switch to `ready` with `N 블록` count and `[전체 번역]`.
8. Click **전체 번역** — watch progress, spans get green highlight, text swaps to Korean.
9. Click a translated span — toggles between original and translated.
10. Click **초기화** — spans unwrap, back to `idle`.
11. Click the extension icon again — toolbar hides. Click again — toolbar returns.
12. Select text manually with mouse — **번역** popup appears above selection; clicking it wraps and translates that arbitrary selection.
13. Open settings, switch 강조 색상 to 연파랑, save — existing translated blocks re-tint.
14. Click **강조 OFF** — highlight disappears; click again — returns.
15. **i18n check** — in `chrome://settings/languages` move English to the top, restart Chrome, reload the unpacked extension; confirm the toolbar now reads `[Select] [HL ON] [Settings]` and the settings title is `AATranslator Settings`.

If any step fails, capture the symptom and diagnose (browser DevTools console for content errors; `chrome://extensions/` → "Service worker" link for background errors).

- [ ] **Step 18.3: Final commit (if any fixes required during smoke test)**

Only if fixes were needed:
```bash
cd /Users/tunarider/Sources/AATranslator
git add -A
git commit -m "fix: smoke test corrections"
```

If nothing changed, skip this step.

---

## Post-Completion

At this point:
- `npm test` passes with 5 test files covering all of `src/core/`.
- The extension loads in Chrome, the toolbar renders as specified, and all libraa feature parity items from spec §10 work.
- Every file from the "File Layout" section exists, each with a focused, single responsibility.
- Each task produced one or more commits with a conventional prefix (`feat(core):`, `feat(content):`, `feat(background):`, `chore:`, `fix:`).

Future changes have clear seams:
- New LLM provider → add a branch to `core/providers.js` and test cases to `tests/providers.test.js`.
- Tweak prompts → edit `core/prompts.js` and its tests; nothing else changes.
- Tweak detection regex → edit `core/ja-blocks.js` and its tests.
- Toolbar redesign → edit `content/ui.js` + `styles.css`; state machine stays the same.
- New UI locale → drop `_locales/<code>/messages.json`; no code changes.
- New localized string → add the key to all three `_locales/*/messages.json` files and call `t("key")` where needed.
