# Browser Built-in Translator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feature-detected `"browser"` provider that uses the W3C Translator API (`self.Translator`) for manual per-block translation, with the "Translate All" button hidden and no API key required.

**Architecture:** A new content-script module `browser-translator.js` wraps `self.Translator` with a per-target-language instance cache. `translate-flow.js` branches in `onBlockClick` only — the LLM batch/meaningful pipeline stays untouched. `ui.js` conditionally adds the option (when `"Translator" in self`), hides the API key and model rows, and hides the "Translate All" toolbar button. `state.js` drops an invalid saved provider when sync'd to a non-supporting browser.

**Tech Stack:** Vanilla JS ESM, Chrome extension MV3, `node --test` test runner, Chrome 138+ `self.Translator` API.

**Spec:** `docs/superpowers/specs/2026-04-15-browser-builtin-translator-design.md`

---

## File Structure

**Create:**
- `src/content/browser-translator.js` — Translator API wrapper with instance cache
- `tests/browser-translator.test.js` — unit tests for the wrapper

**Modify:**
- `src/content/state.js` — guard invalid provider values
- `src/content/ui.js` — settings modal option + row hiding, toolbar button hiding
- `src/content/translate-flow.js` — `onBlockClick` branches on provider
- `_locales/ko/messages.json` — add `provider_browser`
- `_locales/en/messages.json` — add `provider_browser`
- `_locales/zh_CN/messages.json` — add `provider_browser`
- `_locales/zh_TW/messages.json` — add `provider_browser`

**Unchanged (verify they stay untouched):** `src/background.js`, `src/core/providers.js`, `src/core/prompts.js`, `src/core/parse.js`, `src/core/batches.js`, `src/core/ja-blocks.js`, `src/content/llm.js`, `src/content/main.js`.

---

## Task 1: `browser-translator.js` — feature detection

**Files:**
- Create: `src/content/browser-translator.js`
- Test: `tests/browser-translator.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/browser-translator.test.js`:

```js
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
```

Note: the `?case=...` query strings force a fresh module evaluation per test so module-level state (the cache) is isolated. Node's ESM loader treats each distinct specifier as a fresh module.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="isBrowserTranslatorSupported"`
Expected: FAIL with `Cannot find module '../src/content/browser-translator.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/content/browser-translator.js`:

```js
export function isBrowserTranslatorSupported() {
  return typeof self !== "undefined" && "Translator" in self;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="isBrowserTranslatorSupported"`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/browser-translator.js tests/browser-translator.test.js
git commit -m "feat(browser-translator): add feature detection helper"
```

---

## Task 2: `translateBlockBrowser` — happy path with caching

**Files:**
- Modify: `src/content/browser-translator.js`
- Test: `tests/browser-translator.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/browser-translator.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="translateBlockBrowser"`
Expected: FAIL with `mod.translateBlockBrowser is not a function`.

- [ ] **Step 3: Write minimal implementation**

Replace contents of `src/content/browser-translator.js` with:

```js
const SOURCE_LANG = "ja";
const instances = new Map();

export function isBrowserTranslatorSupported() {
  return typeof self !== "undefined" && "Translator" in self;
}

export async function checkAvailability(targetLang) {
  if (!isBrowserTranslatorSupported()) return "unavailable";
  return await self.Translator.availability({
    sourceLanguage: SOURCE_LANG,
    targetLanguage: targetLang,
  });
}

async function getTranslator(targetLang) {
  if (instances.has(targetLang)) return instances.get(targetLang);
  const p = self.Translator.create({
    sourceLanguage: SOURCE_LANG,
    targetLanguage: targetLang,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        console.log(
          `[AAT] Browser translator model download: ${(e.loaded * 100).toFixed(0)}%`,
        );
      });
    },
  });
  instances.set(targetLang, p);
  try {
    const inst = await p;
    instances.set(targetLang, inst);
    return inst;
  } catch (err) {
    instances.delete(targetLang);
    throw err;
  }
}

export async function translateBlockBrowser(text, targetLang) {
  const t = await getTranslator(targetLang);
  const out = await t.translate(text);
  return out?.trim() || text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="translateBlockBrowser|isBrowserTranslatorSupported"`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/browser-translator.js tests/browser-translator.test.js
git commit -m "feat(browser-translator): implement cached translate entry point"
```

---

## Task 3: Race-safe concurrent creation

**Files:**
- Test: `tests/browser-translator.test.js`

No implementation change is expected — Task 2's code already stores the in-flight Promise. This task *proves* it with a test.

- [ ] **Step 1: Write the failing (or passing) test**

Append to `tests/browser-translator.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify behavior**

Run: `npm test -- --test-name-pattern="concurrent first calls"`
Expected: PASS (Task 2's implementation already handles this).

If it fails: inspect `getTranslator` — the `instances.set(targetLang, p)` call must happen *synchronously before* any `await`, so a second caller sees the in-flight Promise. Fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/browser-translator.test.js
git commit -m "test(browser-translator): cover concurrent first-call race"
```

---

## Task 4: `create()` failure clears cache

**Files:**
- Test: `tests/browser-translator.test.js`

- [ ] **Step 1: Write the failing (or passing) test**

Append to `tests/browser-translator.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify behavior**

Run: `npm test -- --test-name-pattern="failed create"`
Expected: PASS (Task 2's `catch` block deletes the cache entry).

If it fails: check `getTranslator` — the `catch` must call `instances.delete(targetLang)` before re-throwing.

- [ ] **Step 3: Commit**

```bash
git add tests/browser-translator.test.js
git commit -m "test(browser-translator): cover create() failure cache reset"
```

---

## Task 5: i18n key `provider_browser`

**Files:**
- Modify: `_locales/ko/messages.json`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`
- Modify: `_locales/zh_TW/messages.json`

- [ ] **Step 1: Add key to ko**

In `_locales/ko/messages.json`, add after the `provider_ollama` entry:

```json
  "provider_browser": { "message": "브라우저 내장 번역" },
```

Ensure the preceding line's trailing comma is correct.

- [ ] **Step 2: Add key to en**

In `_locales/en/messages.json`, add the same key:

```json
  "provider_browser": { "message": "Browser built-in" },
```

- [ ] **Step 3: Add key to zh_CN**

In `_locales/zh_CN/messages.json`:

```json
  "provider_browser": { "message": "浏览器内置翻译" },
```

- [ ] **Step 4: Add key to zh_TW**

In `_locales/zh_TW/messages.json`:

```json
  "provider_browser": { "message": "瀏覽器內建翻譯" },
```

- [ ] **Step 5: Validate JSON**

Run:
```bash
node --input-type=module -e 'import("node:fs").then(({readFileSync}) => { for (const l of ["ko","en","zh_CN","zh_TW"]) { const j = JSON.parse(readFileSync(`_locales/${l}/messages.json`, "utf8")); if (!j.provider_browser) throw new Error(l + " missing provider_browser"); console.log(l, "ok"); } })'
```
Expected: `ko ok`, `en ok`, `zh_CN ok`, `zh_TW ok`.

- [ ] **Step 6: Commit**

```bash
git add _locales/ko/messages.json _locales/en/messages.json _locales/zh_CN/messages.json _locales/zh_TW/messages.json
git commit -m "i18n: add provider_browser label"
```

---

## Task 6: `state.js` — validate provider on load

**Files:**
- Modify: `src/content/state.js:35-55`

- [ ] **Step 1: Replace `loadSettings` body**

In `src/content/state.js`, replace the existing `loadSettings` function with:

```js
export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["provider", "apiKey", "model", "targetLang", "concurrency", "highlightColor"],
      (data) => {
        const validProviders = ["openai", "gemini", "claude", "ollama"];
        if (typeof self !== "undefined" && "Translator" in self) {
          validProviders.push("browser");
        }
        const provider = validProviders.includes(data.provider)
          ? data.provider
          : DEFAULTS.provider;
        state.config = {
          provider,
          apiKey: data.apiKey ?? DEFAULTS.apiKey,
          model: data.model || DEFAULTS.model,
          concurrency: data.concurrency || DEFAULTS.concurrency,
        };
        state.targetLang = coerceTarget(
          data.targetLang,
          chrome.i18n.getUILanguage(),
        );
        state.highlightColor = data.highlightColor || DEFAULTS.highlightColor;
        resolve();
      },
    );
  });
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass (no existing test reads `state.js`, but run the suite to confirm nothing regressed).

- [ ] **Step 3: Commit**

```bash
git add src/content/state.js
git commit -m "feat(state): drop invalid provider on load"
```

---

## Task 7: Settings modal — option + row hiding

**Files:**
- Modify: `src/content/ui.js:118-201`

- [ ] **Step 1: Add id to the model row**

In `src/content/ui.js`, find the model settings group (currently line 131-134):

```js
    <div class="aat-settings-group">
      <label>${t("settings_model")}</label>
      <input type="text" id="aat-s-model">
    </div>
```

Replace with:

```js
    <div class="aat-settings-group" id="aat-s-model-row">
      <label>${t("settings_model")}</label>
      <input type="text" id="aat-s-model">
    </div>
```

- [ ] **Step 2: Add browser option after modal insertion**

In `toggleSettings`, after `document.body.appendChild(modal);` and `state.settingsModal = modal;`, and before the line `const pEl = modal.querySelector("#aat-s-provider");`, insert:

```js
  if (typeof self !== "undefined" && "Translator" in self) {
    const opt = document.createElement("option");
    opt.value = "browser";
    opt.textContent = t("provider_browser");
    modal.querySelector("#aat-s-provider").appendChild(opt);
  }
```

- [ ] **Step 3: Grab the model row element**

In the element lookup block (currently `const pEl = ...` down to `const hlcEl = ...`), add after `const mEl = modal.querySelector("#aat-s-model");`:

```js
  const mRow = modal.querySelector("#aat-s-model-row");
```

- [ ] **Step 4: Replace initial row visibility**

In the `chrome.storage.sync.get` callback, replace this line:

```js
      kRow.style.display = pEl.value === "ollama" ? "none" : "block";
```

with:

```js
      const hideCreds = pEl.value === "ollama" || pEl.value === "browser";
      kRow.style.display = hideCreds ? "none" : "block";
      mRow.style.display = pEl.value === "browser" ? "none" : "block";
```

- [ ] **Step 5: Replace on-change visibility**

Replace the `pEl.addEventListener("change", ...)` body:

```js
  pEl.addEventListener("change", () => {
    kRow.style.display = pEl.value === "ollama" ? "none" : "block";
  });
```

with:

```js
  pEl.addEventListener("change", () => {
    const hideCreds = pEl.value === "ollama" || pEl.value === "browser";
    kRow.style.display = hideCreds ? "none" : "block";
    mRow.style.display = pEl.value === "browser" ? "none" : "block";
  });
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/content/ui.js
git commit -m "feat(ui): add browser provider option and hide key/model rows"
```

---

## Task 8: Toolbar — hide "Translate All" and fix setup warning

**Files:**
- Modify: `src/content/ui.js:42-106`

- [ ] **Step 1: Fix the setup-needed check**

In `updateToolbar`, replace:

```js
  const needsSetup =
    !state.config?.model ||
    (state.config?.provider !== "ollama" && !state.config?.apiKey);
```

with:

```js
  const provider = state.config?.provider;
  const needsSetup =
    provider === "browser"
      ? false
      : !state.config?.model ||
        (provider !== "ollama" && !state.config?.apiKey);
```

Rationale: for `browser`, neither model nor API key are required. Ollama's existing rule (model required, API key not) is preserved.

- [ ] **Step 2: Hide "Translate All" button for browser provider**

In the `ready` branch, replace:

```js
  } else if (state.mode === "ready") {
    const n = state.selectedContainer?.querySelectorAll(".aat-block:not(.aat-translated)").length || 0;
    middle =
      `<span class="aat-status">${t("toolbar_block_count", String(n))}</span>` +
      `<button class="aat-btn-primary" id="aat-translate-all">${t("toolbar_translate_all")}</button>` +
      `<button class="aat-btn-secondary" id="aat-reselect">${t("toolbar_reselect")}</button>` +
      `<button class="aat-btn-danger" id="aat-reset">${t("toolbar_reset")}</button>`;
  }
```

with:

```js
  } else if (state.mode === "ready") {
    const n = state.selectedContainer?.querySelectorAll(".aat-block:not(.aat-translated)").length || 0;
    const isBrowser = state.config?.provider === "browser";
    const translateAllBtn = isBrowser
      ? ""
      : `<button class="aat-btn-primary" id="aat-translate-all">${t("toolbar_translate_all")}</button>`;
    middle =
      `<span class="aat-status">${t("toolbar_block_count", String(n))}</span>` +
      translateAllBtn +
      `<button class="aat-btn-secondary" id="aat-reselect">${t("toolbar_reselect")}</button>` +
      `<button class="aat-btn-danger" id="aat-reset">${t("toolbar_reset")}</button>`;
  }
```

Note: the existing `q("#aat-translate-all")?.addEventListener(...)` uses optional chaining so missing button is safely ignored.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/content/ui.js
git commit -m "feat(ui): hide translate-all and clear setup warn for browser provider"
```

---

## Task 9: `translate-flow.js` — branch `onBlockClick`

**Files:**
- Modify: `src/content/translate-flow.js:1-14,146-166`

- [ ] **Step 1: Add import**

At the top of `src/content/translate-flow.js`, under the existing imports, add:

```js
import { translateBlockBrowser } from "./browser-translator.js";
```

- [ ] **Step 2: Replace `onBlockClick`**

Replace the entire `onBlockClick` function with:

```js
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
    if (state.config.provider === "browser") {
      const translated = await translateBlockBrowser(
        span.dataset.original,
        state.targetLang,
      );
      if (translated && translated.trim() !== span.dataset.original.trim()) {
        applyTranslation(span, translated);
      }
    } else {
      const result = await translateBlockText(span.dataset.original);
      if (result.meaningful) {
        applyTranslation(span, result.translated);
      }
    }
  } catch (err) {
    console.error("[AAT] Block click translation failed:", err);
  }
  span.classList.remove("aat-translating");
}
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests pass (no existing test exercises `onBlockClick`, but the suite must still be green).

- [ ] **Step 4: Commit**

```bash
git add src/content/translate-flow.js
git commit -m "feat(translate-flow): route browser provider clicks through Translator API"
```

---

## Task 10: Manual verification

**Files:** none (manual browser testing).

- [ ] **Step 1: Load the unpacked extension in Chrome 138+**

In `chrome://extensions`, enable Developer mode, "Load unpacked" → project root.

- [ ] **Step 2: Open a sample AA page**

Open `samples/aa-sample.html` (or a real AA site). Click the extension icon to show the toolbar.

- [ ] **Step 3: Configure browser provider**

Open Settings. Confirm:
- The `Provider` dropdown includes `브라우저 내장 번역` (or its localized label).
- Selecting it hides the `API Key` and `Model` rows.
- Saving does not show the `⚠ 설정 필요` warning on the Settings button.

- [ ] **Step 4: Translate a block**

Select a region. Confirm:
- Toolbar in `ready` mode shows **no** `전체 번역` button (only block count, 다시 선택, 초기화).
- Clicking a Japanese block triggers translation and the block text is replaced.
- Clicking a translated block toggles back to the original (existing behavior).
- First click may take longer while the model downloads (watch DevTools console for `[AAT] Browser translator model download: ...%`).

- [ ] **Step 5: Test unsupported-browser behavior**

If a non-supporting browser is available (e.g. Firefox, or a Chromium build without Translator), load the unpacked extension there and confirm the `브라우저 내장 번역` option does NOT appear in the settings dropdown. Otherwise, temporarily patch `src/content/ui.js` locally to force `"Translator" in self` to `false`, reload the extension, reopen settings, and confirm the option is hidden. Revert the patch afterward. The unit tests in Task 1 already cover both branches of the feature check, so this manual step is a smoke test only.

- [ ] **Step 6: Test config downgrade**

Manually set the stored provider to `browser` via DevTools:
```js
chrome.storage.sync.set({ provider: "browser" })
```
Then simulate a non-supporting browser by reloading with `self.Translator` unset (or on a profile without Chrome 138+). Confirm the toolbar treats the provider as `gemini` (default) rather than breaking — the setup warning should either clear or point at the missing Gemini key (whichever is correct for that session).

- [ ] **Step 7: Sanity-check LLM providers still work**

Switch back to `gemini` with a valid key; translate-all still runs and behaves as before. No regressions.

- [ ] **Step 8: Commit no code (verification only)**

No commit for this task. Record any bugs found and loop back to the relevant earlier task.

---

## Post-implementation

- Run full test suite one last time: `npm test` — expect all green.
- Review `git log feat/browser-translator` — expect one commit per task (9 code commits).
- Spec + plan docs are already committed in earlier work.
- Leave the branch unmerged; the user decides integration strategy.
