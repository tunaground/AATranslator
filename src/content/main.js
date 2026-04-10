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
