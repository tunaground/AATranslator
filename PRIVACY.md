# Privacy Policy — AATranslator

Last updated: 2026-04-10

## Overview

AATranslator is a browser extension that translates Japanese AA (Ascii Art / Yaruo-style) text on web pages using LLM (Large Language Model) APIs.

## Data Collection

This extension does **not** collect, store, or transmit any personal data to the developer.

## Data Stored Locally

The following data is stored locally on your device using Chrome's `chrome.storage.sync`:

- **LLM provider name** (e.g., OpenAI, Gemini, Claude, Ollama)
- **API key** you provide for the selected LLM provider
- **Model name** and translation settings (language, concurrency, highlight color)

This data is synced across your Chrome browsers if you are signed into Chrome. It is never sent to anyone other than the LLM provider you configure.

## External API Communication

When you initiate a translation, the extension sends the selected Japanese text to the LLM API you configured:

- **OpenAI** (api.openai.com) — [OpenAI Privacy Policy](https://openai.com/privacy/)
- **Google Gemini** (generativelanguage.googleapis.com) — [Google Privacy Policy](https://policies.google.com/privacy)
- **Anthropic Claude** (api.anthropic.com) — [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- **Ollama** (localhost) — Local only, no external transmission

Only the text fragments you choose to translate are sent. No other page content, browsing history, or personal information is transmitted.

## Permissions

- **activeTab**: Access the current tab only when you click the extension icon
- **storage**: Save your settings locally
- **scripting**: Inject translation functionality into the active tab on demand

## Data Deletion

All stored data can be cleared by removing the extension from Chrome. No data remains on external servers controlled by the developer.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/tunaground/AATranslator/issues
