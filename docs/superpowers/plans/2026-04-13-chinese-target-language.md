# Chinese Target Language Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Japanese as a translation target (it's always the source) and add Simplified + Traditional Chinese, with smart default picking based on browser UI language and safe fallback to English for invalid stored values.

**Architecture:** Extract target-language validation into a pure `src/core/target-lang.js` module with `SUPPORTED_TARGETS`, `pickInitialTarget(rawBrowserLang)`, and `coerceTarget(stored, rawBrowserLang)`. Both `state.js` (load from storage) and `ui.js` (settings modal) call `coerceTarget` with `chrome.i18n.getUILanguage()` as the browser lang source. Delete `_locales/ja`, add `_locales/zh_CN` and `_locales/zh_TW`. Update `LANG_NAMES` in `prompts.js` and replace `<option>` list in `ui.js`.

**Tech Stack:** Vanilla JS (ESM), `node:test` + `node:assert/strict` for tests, Chrome MV3 (`chrome.storage.sync`, `chrome.i18n.getUILanguage()`).

**Spec:** `docs/superpowers/specs/2026-04-13-chinese-target-language-design.md`

---

## File Structure

**New:**
- `src/core/target-lang.js` — Pure module: `SUPPORTED_TARGETS`, `pickInitialTarget`, `coerceTarget`
- `tests/target-lang.test.js` — Unit tests for the above
- `_locales/zh_CN/messages.json` — Simplified Chinese UI locale
- `_locales/zh_TW/messages.json` — Traditional Chinese UI locale

**Modified:**
- `src/core/prompts.js` — `LANG_NAMES`: remove `ja`, add `zh_CN` and `zh_TW`
- `src/content/state.js` — Import and use `coerceTarget`; remove `targetLang` from `DEFAULTS`
- `src/content/ui.js` — Replace `<option>` list (152–154); use `coerceTarget` when loading into the dropdown
- `tests/prompts.test.js` — Add `zh_CN` and `zh_TW` cases; Japanese was never tested, nothing to remove

**Deleted:**
- `_locales/ja/` — Entire directory

---

## Task 1: Pure target-lang module with TDD

**Files:**
- Create: `src/core/target-lang.js`
- Create: `tests/target-lang.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/target-lang.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- --test-name-pattern="pickInitialTarget|coerceTarget|SUPPORTED_TARGETS"`

Expected: FAIL with `Cannot find module '.../src/core/target-lang.js'` (module does not exist yet).

- [ ] **Step 3: Create the target-lang module**

Create `src/core/target-lang.js`:

```js
export const SUPPORTED_TARGETS = ["ko", "en", "zh_CN", "zh_TW"];

export function pickInitialTarget(rawBrowserLang) {
  const raw = (rawBrowserLang || "").toLowerCase();
  if (raw.startsWith("ko")) return "ko";
  if (
    raw.startsWith("zh-tw") ||
    raw.startsWith("zh-hk") ||
    raw.startsWith("zh-mo")
  ) {
    return "zh_TW";
  }
  if (raw.startsWith("zh")) return "zh_CN";
  if (raw.startsWith("en")) return "en";
  return "en";
}

export function coerceTarget(stored, rawBrowserLang) {
  if (!stored) return pickInitialTarget(rawBrowserLang);
  return SUPPORTED_TARGETS.includes(stored) ? stored : "en";
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`

Expected: All target-lang tests PASS. Existing prompts tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/target-lang.js tests/target-lang.test.js
git commit -m "feat(core): add target-lang module with validation and browser-based default"
```

---

## Task 2: Update prompts.js LANG_NAMES

**Files:**
- Modify: `src/core/prompts.js:1`
- Modify: `tests/prompts.test.js`

- [ ] **Step 1: Add failing tests for zh_CN and zh_TW**

In `tests/prompts.test.js`, add these tests after the existing `buildBlockPrompt: includes language name for en` test:

```js
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test`

Expected: FAIL. The new tests fail because `LANG_NAMES` doesn't contain `zh_CN`/`zh_TW`, so the prompt contains `"in zh_CN"` instead of `"Simplified Chinese"`.

- [ ] **Step 3: Update LANG_NAMES**

In `src/core/prompts.js`, replace line 1:

```js
const LANG_NAMES = { ko: "Korean", en: "English", ja: "Japanese" };
```

with:

```js
const LANG_NAMES = {
  ko: "Korean",
  en: "English",
  zh_CN: "Simplified Chinese",
  zh_TW: "Traditional Chinese",
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`

Expected: All prompts tests PASS, including the new zh_CN/zh_TW cases. The existing `buildBlockPrompt: unknown lang falls back to raw code` test still passes (using `"xx"` which is not in the map).

- [ ] **Step 5: Commit**

```bash
git add src/core/prompts.js tests/prompts.test.js
git commit -m "feat(prompts): replace ja with zh_CN/zh_TW in LANG_NAMES"
```

---

## Task 3: Wire target-lang into state.js

**Files:**
- Modify: `src/content/state.js`

- [ ] **Step 1: Update state.js**

Replace the entire contents of `src/content/state.js` with:

```js
import { coerceTarget, pickInitialTarget } from "../core/target-lang.js";

export const DEFAULTS = {
  provider: "gemini",
  model: "gemini-2.5-flash-lite",
  apiKey: "",
  concurrency: 3,
  highlightColor: "rgba(34, 197, 94, 0.1)",
};

export const state = {
  mode: "idle", // "idle" | "selecting" | "ready" | "translating"
  selectedContainer: null,
  toolbar: null,
  settingsModal: null,
  config: null,
  targetLang: pickInitialTarget(
    typeof chrome !== "undefined" && chrome.i18n
      ? chrome.i18n.getUILanguage()
      : "",
  ),
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

**Notes on the changes:**
- `targetLang` removed from `DEFAULTS` (no longer a static constant; computed via `pickInitialTarget`).
- Initial `state.targetLang` is computed from `chrome.i18n.getUILanguage()` so the dropdown has a sensible initial value before `loadSettings()` resolves.
- The `typeof chrome !== "undefined"` guard is only for the module-top initialization (it's loaded before `loadSettings` and in some test harnesses `chrome` may be absent). Inside `loadSettings` the guard isn't needed because that function is only ever called at runtime where `chrome` exists.
- `loadSettings` now calls `coerceTarget(data.targetLang, chrome.i18n.getUILanguage())`: if the stored value is missing/invalid, we use the browser-derived default (or `en` for unsupported languages).

- [ ] **Step 2: Run the tests and verify they pass**

Run: `npm test`

Expected: All tests PASS (prompts + target-lang).

- [ ] **Step 3: Commit**

```bash
git add src/content/state.js
git commit -m "feat(state): use coerceTarget for target language with browser-based default"
```

---

## Task 4: Update ui.js dropdown and load logic

**Files:**
- Modify: `src/content/ui.js:152-154` (option list)
- Modify: `src/content/ui.js:191` (load target lang into dropdown)

- [ ] **Step 1: Add import at the top of ui.js**

At the top of `src/content/ui.js`, alongside existing imports, add:

```js
import { coerceTarget } from "../core/target-lang.js";
```

(Place it with the other `../core/*` imports if any; otherwise add a new import line near the top of the file.)

- [ ] **Step 2: Replace the `<option>` list**

In `src/content/ui.js`, replace lines 152–154:

```html
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
```

with:

```html
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="zh_CN">简体中文</option>
        <option value="zh_TW">繁體中文</option>
```

- [ ] **Step 3: Replace the load line**

In `src/content/ui.js`, replace line 191:

```js
      lEl.value = data.targetLang || "ko";
```

with:

```js
      lEl.value = coerceTarget(data.targetLang, chrome.i18n.getUILanguage());
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`

Expected: All tests PASS. No tests directly cover `ui.js`, but this confirms nothing broke elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/content/ui.js
git commit -m "feat(ui): swap ja for zh_CN/zh_TW in target language dropdown"
```

---

## Task 5: Delete the Japanese UI locale

**Files:**
- Delete: `_locales/ja/messages.json`
- Delete: `_locales/ja/` (directory)

- [ ] **Step 1: Remove the directory**

Run:

```bash
git rm -r _locales/ja
```

Expected output: `rm '_locales/ja/messages.json'`

- [ ] **Step 2: Verify no other references to `_locales/ja`**

Use Grep for `_locales/ja` across the repo. Expected: no matches in source files (may appear in the design spec doc and changelog, which is fine).

- [ ] **Step 3: Run the tests**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(locales): remove Japanese UI locale"
```

---

## Task 6: Add Simplified Chinese UI locale

**Files:**
- Create: `_locales/zh_CN/messages.json`

- [ ] **Step 1: Create the directory and file**

Create `_locales/zh_CN/messages.json` with this exact content:

```json
{
  "app_description": {
    "message": "使用 LLM 直接在页面上翻译日本 AA（ASCII 艺术 / やる夫）作品"
  },
  "toolbar_select": { "message": "选择区域" },
  "toolbar_needs_setup": { "message": "⚠ 需要设置" },
  "toolbar_selecting_hint": { "message": "点击要翻译的区域" },
  "toolbar_cancel": { "message": "取消" },
  "toolbar_block_count": {
    "message": "$COUNT$ 个区块",
    "placeholders": { "count": { "content": "$1", "example": "42" } }
  },
  "toolbar_translate_all": { "message": "全部翻译" },
  "toolbar_reselect": { "message": "重新选择" },
  "toolbar_reset": { "message": "重置" },
  "toolbar_highlight_on": { "message": "高亮 开" },
  "toolbar_highlight_off": { "message": "高亮 关" },
  "toolbar_settings": { "message": "设置" },
  "settings_title": { "message": "AATranslator 设置" },
  "settings_provider": { "message": "服务商" },
  "settings_api_key": { "message": "API 密钥" },
  "settings_model": { "message": "模型" },
  "settings_concurrency": { "message": "并发数" },
  "settings_target_language": { "message": "目标语言" },
  "settings_highlight_color": { "message": "高亮颜色" },
  "settings_save": { "message": "保存" },
  "settings_close": { "message": "关闭" },
  "provider_ollama": { "message": "Ollama(本地)" },
  "color_light_green": { "message": "浅绿" },
  "color_light_blue": { "message": "浅蓝" },
  "color_light_yellow": { "message": "浅黄" },
  "color_light_purple": { "message": "浅紫" },
  "color_light_red": { "message": "浅红" },
  "color_transparent": { "message": "透明" },
  "popup_translate": { "message": "翻译" }
}
```

- [ ] **Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('_locales/zh_CN/messages.json','utf8')); console.log('ok')"`

Expected output: `ok`

- [ ] **Step 3: Verify all keys from en/messages.json are present**

Run:

```bash
node -e "
const en = JSON.parse(require('fs').readFileSync('_locales/en/messages.json','utf8'));
const zh = JSON.parse(require('fs').readFileSync('_locales/zh_CN/messages.json','utf8'));
const missing = Object.keys(en).filter(k => !(k in zh));
const extra = Object.keys(zh).filter(k => !(k in en));
console.log('missing:', missing.length ? missing : 'none');
console.log('extra:', extra.length ? extra : 'none');
"
```

Expected: `missing: none` and `extra: none`.

- [ ] **Step 4: Commit**

```bash
git add _locales/zh_CN/messages.json
git commit -m "feat(locales): add Simplified Chinese UI locale"
```

---

## Task 7: Add Traditional Chinese UI locale

**Files:**
- Create: `_locales/zh_TW/messages.json`

- [ ] **Step 1: Create the file**

Create `_locales/zh_TW/messages.json` with this exact content:

```json
{
  "app_description": {
    "message": "使用 LLM 直接在頁面上翻譯日本 AA（ASCII 藝術 / やる夫）作品"
  },
  "toolbar_select": { "message": "選擇區域" },
  "toolbar_needs_setup": { "message": "⚠ 需要設定" },
  "toolbar_selecting_hint": { "message": "點擊要翻譯的區域" },
  "toolbar_cancel": { "message": "取消" },
  "toolbar_block_count": {
    "message": "$COUNT$ 個區塊",
    "placeholders": { "count": { "content": "$1", "example": "42" } }
  },
  "toolbar_translate_all": { "message": "全部翻譯" },
  "toolbar_reselect": { "message": "重新選擇" },
  "toolbar_reset": { "message": "重設" },
  "toolbar_highlight_on": { "message": "高亮 開" },
  "toolbar_highlight_off": { "message": "高亮 關" },
  "toolbar_settings": { "message": "設定" },
  "settings_title": { "message": "AATranslator 設定" },
  "settings_provider": { "message": "服務商" },
  "settings_api_key": { "message": "API 金鑰" },
  "settings_model": { "message": "模型" },
  "settings_concurrency": { "message": "並行數" },
  "settings_target_language": { "message": "目標語言" },
  "settings_highlight_color": { "message": "高亮顏色" },
  "settings_save": { "message": "儲存" },
  "settings_close": { "message": "關閉" },
  "provider_ollama": { "message": "Ollama（本機）" },
  "color_light_green": { "message": "淺綠" },
  "color_light_blue": { "message": "淺藍" },
  "color_light_yellow": { "message": "淺黃" },
  "color_light_purple": { "message": "淺紫" },
  "color_light_red": { "message": "淺紅" },
  "color_transparent": { "message": "透明" },
  "popup_translate": { "message": "翻譯" }
}
```

- [ ] **Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('_locales/zh_TW/messages.json','utf8')); console.log('ok')"`

Expected output: `ok`

- [ ] **Step 3: Verify all keys from en/messages.json are present**

Run:

```bash
node -e "
const en = JSON.parse(require('fs').readFileSync('_locales/en/messages.json','utf8'));
const zh = JSON.parse(require('fs').readFileSync('_locales/zh_TW/messages.json','utf8'));
const missing = Object.keys(en).filter(k => !(k in zh));
const extra = Object.keys(zh).filter(k => !(k in en));
console.log('missing:', missing.length ? missing : 'none');
console.log('extra:', extra.length ? extra : 'none');
"
```

Expected: `missing: none` and `extra: none`.

- [ ] **Step 4: Commit**

```bash
git add _locales/zh_TW/messages.json
git commit -m "feat(locales): add Traditional Chinese UI locale"
```

---

## Task 8: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: All tests PASS. Full list: existing `formatBatchUser` tests, existing `buildBlockPrompt`/`buildBatchPrompt` tests (now with zh_CN/zh_TW cases), and the new `target-lang` tests from Task 1.

- [ ] **Step 2: Verify no residual `ja` references in source**

Use Grep for `"ja"` in `src/**/*.js` and `_locales/**`. Expected: no matches related to target language (the string "Japanese" may still appear as the SOURCE language description in `src/core/prompts.js` — that's correct and must stay).

Also Grep for `_locales/ja`. Expected: no matches in `src/`, `tests/`, or `manifest.json` (only in doc files, which is fine).

- [ ] **Step 3: Verify the packaging script still works**

Run: `npm run package`

Expected: completes without error and produces a zip/dist artifact. Inspect the output directory; confirm `_locales/zh_CN` and `_locales/zh_TW` are included and `_locales/ja` is not.

- [ ] **Step 4: Manual smoke test (load unpacked in Chrome)**

1. Open `chrome://extensions`, enable Developer mode, "Load unpacked" → point to the repo root.
2. Open the extension on any page. Click Settings.
3. Verify the Target Language dropdown shows: 한국어, English, 简体中文, 繁體中文 (4 options, no 日本語).
4. Change target to `简体中文`, save, reopen settings — verify it persists.
5. If your Chrome UI language is not Korean/English/Chinese, confirm the initial default (for a fresh install / empty storage) is `en`. You can reset by removing the extension and reloading.
6. (Optional) In DevTools for the extension, run `chrome.storage.sync.set({targetLang: "ja"}, () => location.reload())` to simulate a legacy user, then reopen settings and verify the dropdown shows `English` (coerced from invalid `ja`).

Report any failure in this step rather than proceeding.

- [ ] **Step 5: Chrome Web Store dashboard checklist (for release, not this commit)**

Document but do not execute — the human operator will handle dashboard edits at release time:

1. Developer Dashboard → Store listing → language selector → **Japanese tab**: delete localized title, description, screenshots, promo assets.
2. Developer Dashboard → Store listing → add **Simplified Chinese** and **Traditional Chinese** tabs; populate localized title, summary, and detailed description. Screenshots may be reused.
3. After upload, verify the store page shows "Available in 4 languages" and the description auto-renders in Chinese when viewed with a Chinese browser.

- [ ] **Step 6: Final summary commit (if any residual changes)**

If Task 8 surfaced no additional changes, skip. Otherwise commit any leftover fixes with an appropriate message.

---

## Rollout Notes

- No `manifest.json` change is required in this plan. `default_locale` stays `ko`; host permissions, `permissions`, and `version` are untouched (the human operator bumps `version` at release time).
- Existing users with `targetLang: "ja"` in `chrome.storage.sync` are transparently coerced to `"en"` on the next load via `coerceTarget`. The coerced value is not written back until the user saves settings, which is intentional — no forced migration writes.
