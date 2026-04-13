# Chinese Target Language Support — Design

Date: 2026-04-13

## Motivation

The source language for AATranslator is always Japanese (AA / Yaruo works are Japanese-native). Keeping Japanese as a *target* language is meaningless — a Japanese reader does not need translation. Meanwhile, Chinese-speaking users are a natural audience for Japanese AA and are currently unsupported.

This change removes Japanese from the target language set and adds Simplified and Traditional Chinese.

## Scope

1. Replace `ja` with `zh_CN` and `zh_TW` in the translation target language set.
2. Replace the `_locales/ja` extension UI locale with `_locales/zh_CN` and `_locales/zh_TW`.
3. Validate stored `targetLang` against the supported set; fall back to `en` when invalid.
4. Pick the initial default `targetLang` from the browser UI language on first install.

Out of scope: source language selection (always Japanese), new provider integrations, prompt engineering beyond adding language names.

## Supported Target Languages

| Code    | Display (dropdown) | Prompt name (`LANG_NAMES`) |
|---------|--------------------|----------------------------|
| `ko`    | 한국어             | Korean                     |
| `en`    | English            | English                    |
| `zh_CN` | 简体中文           | Simplified Chinese         |
| `zh_TW` | 繁體中文           | Traditional Chinese        |

The same four codes are used in both the settings dropdown and the validation allow-list.

## Defaults and Fallback

Two independent defaults, not to be confused:

### Extension UI locale (Chrome i18n)

- `manifest.json` `default_locale` stays `ko`.
- Chrome automatically picks `_locales/<browser-lang>/messages.json` when present, falling back to `default_locale` otherwise.
- After this change: `_locales/` contains `ko`, `en`, `zh_CN`, `zh_TW`. A Chinese-browser user sees the extension UI in Chinese automatically; `ja` is removed (Japanese users don't use the extension).

### Translation target language (stored setting)

Validation allow-list: `SUPPORTED_TARGETS = ["ko", "en", "zh_CN", "zh_TW"]`.

On load in `src/content/state.js`:

1. If no stored `targetLang` (fresh install): compute default from `chrome.i18n.getUILanguage()`.
   - If that value is in `SUPPORTED_TARGETS`, use it.
   - Otherwise use `"en"`.
2. If stored `targetLang` exists but is not in `SUPPORTED_TARGETS` (e.g. legacy `"ja"`): fall back to `"en"`.
3. Otherwise use the stored value as-is.

Note: `chrome.i18n.getUILanguage()` returns values like `"en-US"`, `"ko"`, `"zh-CN"`, `"zh-TW"`, `"zh-HK"`. Map these by prefix rather than exact match:

- starts with `ko` → `ko`
- starts with `zh-tw` or `zh-hk` or `zh-mo` → `zh_TW` (Traditional-using regions)
- starts with `zh` (including `zh`, `zh-cn`, `zh-sg`) → `zh_CN`
- starts with `en` → `en`
- anything else → `en`

Comparison is lowercase, using the hyphen form returned by the API (no underscore conversion needed for this mapping).

`DEFAULTS.targetLang` as a static constant is removed; the default is now computed at load time by the logic above.

## Code Changes

| File | Change |
|---|---|
| `src/core/prompts.js` | `LANG_NAMES`: remove `ja`, add `zh_CN: "Simplified Chinese"`, `zh_TW: "Traditional Chinese"`. |
| `src/content/ui.js` (lines 152–154) | `<option>` list: remove `ja`, add `zh_CN` (`简体中文`) and `zh_TW` (`繁體中文`). |
| `src/content/state.js` | Add `SUPPORTED_TARGETS` constant. Replace the static `DEFAULTS.targetLang` with computed initial default (browser UI language → supported code → `en`). On load, validate stored value against `SUPPORTED_TARGETS`; coerce invalid values to `"en"`. |
| `src/content/main.js` | No change expected; already observes `targetLang` changes. Verify during implementation. |
| `_locales/ja/` | Delete entire directory. |
| `_locales/zh_CN/messages.json` | New. Translate all keys from `_locales/en/messages.json`. |
| `_locales/zh_TW/messages.json` | New. Translate all keys from `_locales/en/messages.json`. |
| `manifest.json` | No change. `default_locale` stays `ko`. |
| `tests/prompts.test.js` | Remove `ja` cases; add `zh_CN` and `zh_TW` cases asserting the prompt contains the correct language name. |

## Validation Logic (single source of truth)

All validation lives in `src/content/state.js`. UI and translation flow trust the validated value. No duplicated checks in `ui.js` or `translate-flow.js`.

```js
const SUPPORTED_TARGETS = ["ko", "en", "zh_CN", "zh_TW"];

function computeInitialTarget() {
  const raw = (chrome.i18n.getUILanguage() || "").toLowerCase();
  if (raw.startsWith("ko")) return "ko";
  if (raw.startsWith("zh-tw") || raw.startsWith("zh-hk") || raw.startsWith("zh-mo")) return "zh_TW";
  if (raw.startsWith("zh")) return "zh_CN";
  if (raw.startsWith("en")) return "en";
  return "en";
}

function coerceTarget(stored) {
  if (!stored) return computeInitialTarget();
  return SUPPORTED_TARGETS.includes(stored) ? stored : "en";
}
```

## Prompt Handling

`prompts.js` needs no logic changes beyond `LANG_NAMES`. The existing `${name}` interpolation passes `"Simplified Chinese"` or `"Traditional Chinese"` to the LLM, which is sufficient for the model to produce the correct variant. No separate prompt branches for Chinese.

## Tests

`tests/prompts.test.js`:

- Remove: any assertion that Japanese appears as a target.
- Add: `buildBlockPrompt("zh_CN")` contains `"Simplified Chinese"`.
- Add: `buildBlockPrompt("zh_TW")` contains `"Traditional Chinese"`.
- Add: `buildBatchPrompt("zh_CN")` / `buildBatchPrompt("zh_TW")` same.

No new test file for state validation is required unless state already has a unit test file; verify during implementation and add only if the existing test layout supports it without new infrastructure.

## Migration for Existing Users

Handled implicitly by the validation logic: on first load after update, any stored `targetLang: "ja"` is coerced to `"en"` and written back to storage on next save. No explicit migration script.

## Chrome Web Store Listing Updates

The extension is already published. No manifest permissions or host permissions change, and `chrome.i18n.getUILanguage()` requires no permission, so this is a normal update submission. However, the store listing reflects `_locales/` content automatically and the Developer Dashboard has per-locale listing fields that must be reconciled manually.

Required dashboard actions when submitting this update:

1. **Remove the Japanese listing tab.** Developer Dashboard → Store listing → language selector → Japanese. Delete the Japanese localized title, description, and any uploaded screenshots/promo images.
2. **Add Simplified Chinese and Traditional Chinese listing tabs.** Populate localized title, summary, and detailed description. Screenshots can be reused from English/Korean unless Chinese-specific captions are desired.
3. **Verify `app_description` translation.** After the package is uploaded, confirm that `_locales/zh_CN/messages.json` and `_locales/zh_TW/messages.json` produce the expected store description (the store pulls this via `__MSG_app_description__`).
4. **Supported languages count.** After review, the store page will auto-update to show four supported languages (ko, en, zh_CN, zh_TW) instead of the current three. No manual action.

No changes required:

- Permissions / host permissions
- Single purpose description
- Privacy practices disclosure (no new data collection)
- Screenshots for existing locales (en/ko)

## Risks and Notes

- **`_locales/zh_CN` and `_locales/zh_TW` translation quality.** Initial translations will be produced by the implementer; if a native Chinese reviewer is not available, the strings are short UI labels and can be iterated on later without blocking this change.
- **`chrome.i18n.getUILanguage()` availability.** Content scripts may not have access in all MV3 configurations. During implementation, verify the call works in the content script context where `state.js` runs; if not, use `navigator.language` as a fallback source before the `"en"` final fallback.
