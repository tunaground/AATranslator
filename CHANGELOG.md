# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-04-13

### Added

- **Simplified Chinese (zh_CN) and Traditional Chinese (zh_TW)** as translation target languages.
- **Browser-language-based default target.** New installs now pick the initial target language from `chrome.i18n.getUILanguage()` (Korean browser → ko, Chinese browser → zh_CN/zh_TW, others → en) instead of being hardcoded to Korean.
- **`_locales/zh_CN` and `_locales/zh_TW`** UI locales for the extension's own settings/toolbar strings; Chinese-browser users see the UI in Chinese automatically.
- **Romanization post-processing.** When the LLM leaves Japanese characters in the translation (typically character names like やる夫 that don't have an established target-language form), a follow-up call converts the leftover Japanese to Hepburn romaji so the output is at least readable.
- **Romanize output validation.** Hanzi-dominant inputs whose romanize result drops most of the target-language characters are rejected (catches occasional cross-language hallucinations) and fall back to the partial translation.

### Changed

- **Reset button** now clears only the translations and keeps the selected container intact, so the user can immediately re-run Translate All without re-picking the area. Use Reselect to switch to a different container.
- **`isStillJapanese` is target-language-aware.** For Chinese targets, only hiragana/katakana count as "still Japanese" — hanzi are preserved as legitimate target output. Other targets keep the original kana-plus-kanji threshold.
- **Translation prompts explicitly require proper-noun translation** and forbid hiragana/katakana in the output. Names like やる夫/やらない夫 are mentioned by example.
- **Single-block translation retry loop** reduced from 3 attempts to 2; still-Japanese results no longer trigger retries (they go through romanization instead).
- **Batch translation** routes still-Japanese entries through romanization in a single batched follow-up call instead of silently displaying the original text.

### Removed

- **Japanese (`ja`) as a translation target.** Japanese is always the source language, so picking it as the target was meaningless.
- **`_locales/ja` UI locale.** Japanese-browser users are not the target audience.

### Fixed

- **Chinese translations were rejected by the still-Japanese quality gate** because Chinese hanzi share the CJK Unified Ideographs Unicode block with Japanese kanji. Fixed by the target-language-aware detection above.
- **Batch path silently dropped still-Japanese entries**, leaving the original Japanese on screen instead of going through retry/romanization.

### Migration

- Existing users with stored `targetLang: "ja"` are transparently coerced to `"en"` on the next load. No data loss; the new value is written back when the user next saves settings.

## [0.1.0] - 2026-04-10

Initial release.

### Added

- **Japanese block detection** — Unicode-range based detector that wraps meaningful Japanese text in `<span class="aat-block">` while leaving surrounding ASCII art untouched.
- **Container selection mode** — hover outline + click to pick a translation target on any page.
- **Click-to-translate** — translate a single block with one click; click again to toggle between original and translation.
- **Translate All** — batch-translate every block in the selected container with a 3-stage fallback (full batch → smaller batch → individual calls).
- **Manual text selection** — drag-select arbitrary text and click the "Translate" popup to translate an ad-hoc range.
- **Four LLM providers** — OpenAI, Google Gemini, Anthropic Claude, and Ollama (local). Default model is `gemini-2.5-flash-lite`.
- **Per-provider rate gate** — Gemini calls are spaced at ~4.5 s intervals (~13 RPM) to stay safely under the free-tier 15 RPM cap. Other providers are unthrottled.
- **Retry with exponential backoff** — up to 5 attempts on `429 / 503 / 529` responses, capped at 60 s per wait.
- **Settings modal** — in-page modal for Provider, Model, API Key, Concurrency, Target Language, and Highlight Color. Warning indicator on the Settings button when Model or API Key is missing.
- **Thin floating toolbar** — state-driven UI for idle / selecting / ready / translating modes with progress bar and ETA during "Translate All".
- **Highlight customization** — 6 color presets (5 tinted + transparent) for translated blocks.
- **i18n UI** — Korean, English, and Japanese locales for toolbar and settings strings (follows Chrome's UI language via `chrome.i18n`).
- **Pure-core architecture** — `src/core/` modules (`ja-blocks`, `batches`, `prompts`, `parse`, `providers`) have zero browser dependencies and are unit-tested with Node's built-in test runner (52 tests, zero npm dependencies).
- **Release packaging** — `npm run package` produces `dist/aatranslator-<version>.zip`; a GitHub Actions workflow attaches the zip to a release on `v*.*.*` tag push.
- **Privacy policy** — `PRIVACY.md` describes what's stored locally and what's sent to LLM providers.

[Unreleased]: https://github.com/tunaground/AATranslator/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/tunaground/AATranslator/releases/tag/v0.2.0
[0.1.0]: https://github.com/tunaground/AATranslator/releases/tag/v0.1.0
