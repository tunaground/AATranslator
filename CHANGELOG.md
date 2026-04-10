# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/tunaground/AATranslator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tunaground/AATranslator/releases/tag/v0.1.0
