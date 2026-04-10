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
