# AATranslator — Design Spec

**Date:** 2026-04-10
**Status:** Approved for planning

## 1. Purpose

Browser extension that translates Japanese AA (Ascii Art / Yaruo works) in-place on any webpage using an LLM, preserving the ASCII art and only replacing meaningful Japanese text blocks.

Functionally equivalent to the existing `libraa` extension at `~/Sources/libraa/extension/`, but with a project structure that is simple, well-tested, and easy to modify.

## 2. Goals / Non-Goals

**Goals**
- Same end-user behavior as `libraa`: container selection, auto-detection of Japanese blocks, click-to-translate, batch "translate all", manual text selection translation.
- Pure logic is unit-testable in Node with zero external dependencies.
- Clear separation between pure logic (`src/core/`) and browser/DOM glue (`src/content/`, `src/background.js`).
- Toolbar redesigned as a thin horizontal bar with a fixed layout.
- Default provider and model set to Gemini 2.5 Flash Lite.

**Non-Goals**
- New LLM providers beyond the four already supported (OpenAI, Gemini, Claude, Ollama).
- New translation strategies (glossary, context window, memory) — not planned.
- Build tooling (bundler, TypeScript) — explicitly avoided to keep setup simple.
- Site-specific adapters.

## 3. Architecture

Three layers:

1. **`src/core/`** — Pure functions. No imports from `chrome.*`, `document`, or `window`. Directly importable in Node for unit tests.
2. **`src/content/`** — Content script glue. Handles DOM manipulation, Chrome messaging, and orchestrates core functions. Manually verified.
3. **`src/background.js`** — MV3 service worker. Handles the extension icon click and proxies LLM API calls with retry/backoff.

### Module system

- ES modules throughout (`"type": "module"` in `package.json`).
- Service worker: MV3 `"type": "module"` in manifest.
- Content script: injected via `chrome.scripting.executeScript` on icon click. A tiny `bootstrap.js` uses dynamic `import()` of `main.js`, which then uses static `import` for the other content modules. All module files are listed in `web_accessible_resources`.

### Test strategy

- Node built-in test runner (`node --test`). Node 18+. Zero npm dependencies.
- Tests live in `tests/` and import directly from `src/core/`.
- Glue layer is intentionally not unit tested — it is thin enough to verify by loading the unpacked extension in Chrome.

## 4. File Structure

```
AATranslator/
├── manifest.json
├── package.json              # "type": "module", test script only
├── icons/
│   ├── icon48.png            # copied from libraa
│   └── icon128.png           # copied from libraa
├── src/
│   ├── background.js         # service worker: icon click + LLM call proxy with retry
│   ├── core/                 # ── pure, testable ──
│   │   ├── ja-blocks.js      # isJaBlock, extractJaBlocks, isStillJapanese, SPLIT_RE
│   │   ├── providers.js      # buildRequest(provider, config, sys, user), parseResponse(provider, json)
│   │   ├── prompts.js        # buildBlockPrompt(lang), buildBatchPrompt(lang), formatBatchUser(texts)
│   │   ├── parse.js          # parseBlockResponse(text), parseBatchResponse(text)
│   │   └── batches.js        # buildBatches(items, provider) → item[][]
│   └── content/              # ── DOM/Chrome glue ──
│       ├── bootstrap.js      # dynamic import loader (not a module itself)
│       ├── main.js           # init, toggle-toolbar message listener
│       ├── state.js          # shared state object, DEFAULTS, loadSettings
│       ├── llm.js            # sendMessage wrapper for background llm-call
│       ├── dom.js            # wrapJaBlocks, unwrapBlocks, applyTranslation, setSpanText, onBlockClick
│       ├── translate-flow.js # translateBlock, translateBatch, translateAll (orchestrates core + dom)
│       ├── selection.js      # container selection mode + manual text selection popup
│       ├── ui.js             # toolbar render/update + settings modal
│       └── styles.css
├── tests/
│   ├── ja-blocks.test.js
│   ├── providers.test.js
│   ├── prompts.test.js
│   ├── parse.test.js
│   └── batches.test.js
└── docs/
    └── superpowers/specs/2026-04-10-aatranslator-design.md
```

## 5. Core Module Contracts

The signatures below are conceptual (TypeScript-style annotations used for clarity). Actual files are plain JavaScript — types documented via JSDoc where helpful.

### `core/ja-blocks.js`

```js
export const SPLIT_RE: RegExp;         // whitespace + japanese punctuation + brackets
export function isJaBlock(token: string): boolean;
export function extractJaBlocks(text: string): string[];
export function isStillJapanese(text: string): boolean;
```

Regex kept identical to libraa: hiragana/katakana/CJK unified ideographs range; `isJaBlock` requires ≥2 Japanese characters; `isStillJapanese` returns true when >30% of characters are Japanese.

### `core/providers.js`

```js
export function buildRequest(provider, { apiKey, model }, systemPrompt, userMessage)
  → { url, method, headers, body }   // body is a plain JS object (caller JSON.stringify)
export function parseResponse(provider, json) → string
```

Providers supported: `openai`, `gemini`, `claude`, `ollama`. Request shapes match libraa's existing `background.js` exactly.

### `core/prompts.js`

```js
export function buildBlockPrompt(targetLang): string
export function buildBatchPrompt(targetLang): string
export function formatBatchUser(texts: string[]): string   // "[0] text\n[1] text\n..."
```

Language map: `{ ko: "Korean", en: "English", ja: "Japanese" }`.

### `core/parse.js`

```js
export function parseBlockResponse(raw: string)
  → { meaningful: boolean, translation?: string }
export function parseBatchResponse(raw: string)
  → Array<{ i: number, m: boolean, t?: string }>
```

Both strip ` ```json ` code fences before JSON parsing. Throw on invalid JSON (caller decides fallback).

### `core/batches.js`

```js
export const BATCH_CHAR_LIMITS = { ollama: 1000, openai: 3000, gemini: 3000, claude: 3000 };
export function buildBatches(items, provider, getText = (x) => x)
  → items[][]
```

Greedy packing by character count. `getText` lets the content layer pass DOM spans while the pure function stays DOM-agnostic.

## 6. Content Layer Behavior

### State (`state.js`)

```js
{
  mode: "idle" | "selecting" | "ready" | "translating",
  selectedContainer: Element | null,
  toolbar: Element | null,
  settingsModal: Element | null,
  config: { provider, apiKey, model, concurrency } | null,
  targetLang: "ko" | "en" | "ja",
  highlightOn: boolean,
  highlightColor: string,
  translatedCount: number,
  totalCount: number,
  cancelFlag: boolean,
  translateStartTime: number,
  selectionPopup: Element | null,
  highlightStyleEl: HTMLStyleElement | null,
}
```

### Defaults

```js
{
  provider: "gemini",
  model: "gemini-2.5-flash-lite",
  apiKey: "",
  concurrency: 3,
  targetLang: "ko",
  highlightColor: "rgba(34, 197, 94, 0.1)",  // light green
}
```

### Translate flow

`translate-flow.js` exposes three entry points:

1. `translateBlockInPlace(span)` — single block click path. Calls `core/prompts.buildBlockPrompt`, sends via `llm.js`, parses via `core/parse.parseBlockResponse`, retries up to 3 times if result is identical to input or still Japanese, applies via `dom.applyTranslation`.

2. `translateBatchInPlace(spans)` — batch path. Uses `core/prompts.buildBatchPrompt` + `formatBatchUser`, parses via `parseBatchResponse`, applies translations, returns the list of spans that failed (missing index or invalid) for caller-side fallback.

3. `translateAll(container)` — orchestration. Builds batches via `core/batches.buildBatches` using `span.dataset.original` as the text, runs with concurrency from `state.config.concurrency`, on failure re-batches with smaller chunks, final fallback is individual `translateBlockInPlace`. Respects `state.cancelFlag` at every await point.

### Toolbar (`ui.js`)

Fixed layout; only the middle section changes with mode:

```
[ AATranslator v0.1.0 | <mode section> | [HL ON/OFF] [Settings] ]
```

| Mode | Middle section |
|---|---|
| `idle` | `[Select]` (+ `⚠ 설정 필요` if `config` missing) |
| `selecting` | `"영역을 클릭하세요"` `[Cancel]` |
| `ready` | `"N blocks"` `[Translate All]` `[Reselect]` `[Reset]` |
| `translating` | `"done/total"` progress-bar `"pct% · ETA"` `[Cancel]` |

Version pulled from `chrome.runtime.getManifest().version`.

### Settings modal (`ui.js`)

In-page modal (not a Chrome popup). Positioned above the toolbar at bottom-right. Fields:

- Provider (select: openai / gemini / claude / ollama)
- API Key (password input; hidden when Provider = ollama)
- Model (text input)
- Concurrency (select: 1/2/3/5/8/10)
- Target Language (select: ko/en/ja)
- Highlight Color (select: 연녹색 / 연파랑 / 연노랑 / 연보라 / 연빨강 / 투명)
- Save / Close buttons

Values load from `chrome.storage.sync` on open; save writes back and triggers `state.loadSettings()` + `updateToolbar()`.

### Selection (`selection.js`)

Two independent selection features, both preserved from libraa:

1. **Container selection mode** — hover adds outline, click picks that element as `state.selectedContainer`, then `wrapJaBlocks` runs.
2. **Manual text selection popup** — `mouseup` with a non-collapsed selection shows a small "번역" popup; clicking it wraps the selection in a new `.aat-block` span (preserving inner DOM/`<br>`) and runs `translateBlockInPlace`.

### DOM wrap (`dom.js`)

- `wrapJaBlocks(container)` — `TreeWalker` over text nodes; for each, split by `SPLIT_RE` and wrap matching tokens in `<span class="aat-block">` with `data-original`.
- `unwrapBlocks(container)` — restore original text nodes on reset.
- `applyTranslation(span, text)` — sets `dataset.translated`, `dataset.showing`, replaces content with `setSpanText` (preserves newlines as `<br>`), toggles classes.
- `onBlockClick(e)` — if not yet translated, translates; if translated, toggles between original and translated.

## 7. Background Service Worker

`src/background.js` (ES module):

- `chrome.action.onClicked` listener:
  1. Try `chrome.tabs.sendMessage(tabId, { type: "toggle-toolbar" })`.
  2. On failure, `chrome.scripting.executeScript({ files: ["src/content/bootstrap.js"] })` + `insertCSS({ files: ["src/content/styles.css"] })`. The bootstrap's first run auto-shows the toolbar, so no second message needed.
- `chrome.runtime.onMessage` listener for `{ type: "llm-call", config, systemPrompt, userMessage }`:
  - Imports `buildRequest`/`parseResponse` from `./core/providers.js`.
  - Wraps in `handleWithRetry` — 3 attempts, exponential backoff on 429/503/529.
  - Responds `{ ok: true, text }` or `{ ok: false, error }`.

The service worker is the only place that actually calls `fetch`; content script never touches API keys directly beyond storing them.

## 8. Manifest (MV3)

```json
{
  "manifest_version": 3,
  "name": "AATranslator",
  "version": "0.1.0",
  "description": "__MSG_app_description__",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
    "http://localhost:11434/*"
  ],
  "action": { "default_icon": "icons/icon48.png" },
  "background": { "service_worker": "src/background.js", "type": "module" },
  "icons": { "48": "icons/icon48.png", "128": "icons/icon128.png" },
  "default_locale": "ko",
  "web_accessible_resources": [
    { "resources": ["src/content/*.js", "src/content/*.css", "src/core/*.js"], "matches": ["<all_urls>"] }
  ]
}
```

## 9. Testing Plan

All tests use Node built-in runner:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
```

Run: `node --test tests/` (wired via `npm test`).

| Test file | Coverage |
|---|---|
| `ja-blocks.test.js` | `isJaBlock` on hiragana/katakana/kanji/mixed/single-char/latin; `extractJaBlocks` on mixed text; `isStillJapanese` on threshold edge (30%); `SPLIT_RE` splitting behavior |
| `providers.test.js` | For each of 4 providers: `buildRequest` URL/method/headers/body shape; `parseResponse` on valid, empty, and alternate shapes |
| `prompts.test.js` | `buildBlockPrompt`/`buildBatchPrompt` include the target language name; unknown lang falls back to raw code; `formatBatchUser` numbering format |
| `parse.test.js` | `parseBlockResponse` with plain JSON, ` ```json ``` ` fenced, plain text fallback; `parseBatchResponse` with valid array, missing indices, non-array, invalid JSON (throws) |
| `batches.test.js` | Greedy packing under limit; single oversized item becomes its own batch; empty input → empty array; provider-specific limits applied |

Non-goals for tests: DOM wrapping, toolbar rendering, message passing, actual LLM calls — verified manually by loading the unpacked extension.

## 10. Feature Parity Checklist vs libraa

All of the following carry over unchanged in behavior:

- [x] Container selection mode (hover outline → click)
- [x] Auto-detection and wrapping of Japanese blocks
- [x] Click individual block to translate; re-click toggles original/translated
- [x] "Translate All" batch flow with fallback waterfall (batch → smaller batch → individual)
- [x] Concurrency from settings
- [x] Cancel during translation
- [x] Manual text selection with "번역" popup
- [x] 4 providers (OpenAI / Gemini / Claude / Ollama)
- [x] Retry with exponential backoff on 429/503/529
- [x] Highlight color customization
- [x] Settings modal in-page (no Chrome popup)

## 11. Internationalization

UI strings (toolbar labels, settings modal labels, popup label, manifest description) are externalized via Chrome's standard `_locales/` mechanism.

- `manifest.json` sets `"default_locale": "ko"` and references `"description": "__MSG_app_description__"`.
- Locale files: `_locales/ko/messages.json`, `_locales/en/messages.json`, `_locales/ja/messages.json`.
- `src/content/i18n.js` exposes a tiny `t(key, ...substitutions)` helper around `chrome.i18n.getMessage`, falling back to the key name if the lookup returns empty.
- **Target Language** (in settings) remains independent — it controls the language LLM output is translated INTO, not the UI language.
- UI language follows the user's Chrome locale automatically (standard `chrome.i18n` behavior).
- Strings that are NOT localized: brand names ("AATranslator", "OpenAI", "Google Gemini", "Claude", "Ollama"), the Target Language option labels themselves (`한국어`, `English`, `日本語` — each is self-naming regardless of UI locale), and numeric/status-only strings.

Scope: only the three locales above ship in 0.1.0. Adding more is a single-file change (drop a new `_locales/<code>/messages.json`).

## 12. Open Questions

None at this time. Any future provider additions, glossary/context features, or site-specific adapters are explicitly out of scope and would be new specs.
