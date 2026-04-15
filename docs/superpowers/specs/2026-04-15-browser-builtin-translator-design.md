# Browser Built-in Translator Provider — Design

**Date:** 2026-04-15
**Branch:** `feat/browser-translator`
**Status:** Approved for implementation planning

## Goal

Add a new translation provider that uses the W3C Translator API (`self.Translator`), so users on supporting browsers (currently Chrome 138+) can translate AA text blocks without any API key or signup. The provider is manual-click only: no batch or "Translate All" path, because the API cannot judge whether a block is meaningful.

## Non-Goals

- No new endpoint, HTTP provider, or key management.
- No "Translate All" support for this provider.
- No romanization fallback (the Translator API handles translation directly).
- No model-download progress UI beyond console logs (MVP).
- No support for Firefox / Whale / Safari (they do not expose equivalent APIs to extensions as of 2026-04).

## Provider Overview

New provider id: `"browser"`
UI label key: `provider_browser` ("브라우저 내장 번역" in ko)

| Aspect | LLM providers | `browser` |
|---|---|---|
| API key | Required (except Ollama) | Not required |
| Model field | Required | Hidden |
| "Translate All" button | Shown | **Hidden** |
| Block click | Supported | Supported |
| Meaningful judgment | LLM decides | **None — always translated** |
| Romanize fallback | Yes | **No** |
| Batching | Yes | N/A (1 call per block) |
| Request path | content → background → fetch | **content script direct call** |
| Feature-detected | No | Yes (`"Translator" in self`) |

## Architecture

### New module: `src/content/browser-translator.js`

Responsibilities:

- Feature detection.
- Per-target-language Translator instance cache with race-safe creation.
- Single-block translation entry point.

```js
const SOURCE_LANG = "ja";
const instances = new Map(); // key: targetLang, value: Translator | Promise<Translator>

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
        console.log(`[AAT] Browser translator model download: ${(e.loaded * 100).toFixed(0)}%`);
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

Design notes:

- The cache stores the in-flight Promise, so concurrent first-time calls share a single `create()` invocation.
- On creation failure, the cache entry is deleted so a later retry can succeed.
- No meaningful/romanize logic — callers handle "unchanged output" as a silent failure.

### Call site: `src/content/translate-flow.js`

Only `onBlockClick` branches on provider. `translateAll`, `translateSpan`, `translateBatchSpans`, and `translateBlockText` stay unchanged because the "Translate All" button is hidden for this provider and the batch/meaningful pipeline is LLM-specific.

```js
import { translateBlockBrowser } from "./browser-translator.js";

export async function onBlockClick(e) {
  if (!state.config) return;
  const span = e.target.closest(".aat-block") || e.target;
  if (span.classList.contains("aat-translating")) return;
  if (span.classList.contains("aat-translated")) { toggleSpan(span); return; }

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
      if (result.meaningful) applyTranslation(span, result.translated);
    }
  } catch (err) {
    console.error("[AAT] Block click translation failed:", err);
  }
  span.classList.remove("aat-translating");
}
```

If the result equals the original (trimmed) or is empty, the block is left untouched and the spinner is cleared — same user-visible behavior as `meaningful: false`.

### UI: `src/content/ui.js`

1. Provider `<select>` gets a `browser` option **only** when `"Translator" in self`:
   ```js
   if ("Translator" in self) {
     const opt = document.createElement("option");
     opt.value = "browser";
     opt.textContent = t("provider_browser");
     providerSelect.appendChild(opt);
   }
   ```
2. API-key row and model row are hidden when `provider === "browser"` (extend the existing Ollama branch).
3. "Translate All" toolbar button is hidden when `state.config.provider === "browser"`. Re-evaluated on config changes by the existing storage listener in `main.js`.
4. The Apply-button readiness check (currently `provider !== "ollama" && !apiKey`) becomes `!["ollama","browser"].includes(provider) && !apiKey`.

### Config validation: `src/content/state.js`

Guard against a config synced from a supporting browser to a non-supporting one:

```js
const validProviders = ["openai", "gemini", "claude", "ollama"];
if ("Translator" in self) validProviders.push("browser");
if (!validProviders.includes(data.provider)) data.provider = DEFAULTS.provider;
```

### Unchanged files

- `src/background.js` — `browser` never calls `chrome.runtime.sendMessage({type: "llm-call", ...})`.
- `src/core/providers.js`, `prompts.js`, `parse.js`, `batches.js`, `ja-blocks.js` — LLM-only paths.
- `src/content/llm.js` — branching lives one level up in `translate-flow.js`.

## Data Flow

1. User picks `브라우저 내장 번역` in settings. `apiKey`/`model` fields are hidden; Apply saves `{provider: "browser"}`.
2. Main toolbar re-renders: "Translate All" button is hidden.
3. User clicks a block. `onBlockClick` routes to `translateBlockBrowser(text, state.targetLang)`.
4. First call for that target language: `Translator.create` triggers model download; subsequent calls reuse the cached instance.
5. Output is written via `applyTranslation` (unchanged from the LLM path), or silently dropped if unchanged/empty.

## Error Handling

All failures are silent plus `console.error` — matches the existing LLM path and keeps UX consistent. No toasts, no alerts.

Failure cases:

- `Translator.create` rejects (download failure, unsupported pair): cache entry cleared, spinner removed, error logged.
- `translate()` rejects mid-session: spinner removed, error logged.
- Translation result equals original or is empty: block left unchanged.

## i18n

Add to `_locales/{ko,en,zh_CN,zh_TW}/messages.json`:

| key | ko | en | zh_CN | zh_TW |
|---|---|---|---|---|
| `provider_browser` | 브라우저 내장 번역 | Browser built-in | 浏览器内置翻译 | 瀏覽器內建翻譯 |

(No error-message keys — errors stay in console.)

## Testing

New: `tests/browser-translator.test.js`

1. `isBrowserTranslatorSupported()` returns true when `self.Translator` exists, false otherwise.
2. `checkAvailability()` forwards the result of `Translator.availability` (`"available" | "downloadable" | "downloading" | "unavailable"`).
3. `translateBlockBrowser()` returns translated text on the happy path.
4. Same-target-language calls reuse a single cached instance (`Translator.create` invoked once).
5. Concurrent first-time calls for the same target language share one in-flight Promise.
6. On `create()` rejection, the cache slot is cleared so a retry can succeed.

Existing tests (`batches.test.js`, `providers.test.js`, `prompts.test.js`, etc.) must continue to pass unchanged — the `browser` provider never touches those code paths.

Manual verification:

- In Chrome 138+: pick 브라우저 내장 번역, click a block, confirm translation appears. Verify "Translate All" button is not shown.
- In a non-supporting browser (or with `self.Translator` stubbed out): confirm the option does not appear in the settings dropdown.
- Reload after setting provider to `browser`, confirm saved selection persists.
- Import a config with `provider: "browser"` into a non-supporting browser: confirm it falls back to the default provider.

## Edge Cases

- **Model download on first click.** `create()` may take tens of seconds. The spinner keeps spinning; no extra UI. Acceptable for MVP.
- **Unsupported language pair.** `create()` rejects → logged, cache cleared, spinner removed.
- **Target language `ja`.** Not an allowed target in the existing UI; no special handling required, but the code does not crash if it ever happens — `create()` will reject and the failure path handles it.
- **Config synced from Chrome to a non-supporting browser.** `state.js` validator downgrades the provider to the default.

## Out of Scope

- Model download progress UI.
- Batch translation for this provider.
- Toasts / user-facing error strings.
- Support for other browser-native APIs (Firefox Translations, Whale Papago).
