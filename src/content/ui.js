import { state, loadSettings } from "./state.js";
import { applyHighlightStyle } from "./dom.js";
import { startSelecting, cancelSelecting, resetTranslations } from "./selection.js";
import { translateAll } from "./translate-flow.js";
import { t } from "./i18n.js";
import { coerceTarget } from "../core/target-lang.js";

function version() {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "?";
  }
}

export function createToolbar() {
  const el = document.createElement("div");
  el.className = "aat-toolbar";
  document.body.appendChild(el);
  state.toolbar = el;
  updateToolbar();
}

export function toggleToolbar() {
  if (!state.toolbar) {
    createToolbar();
  } else {
    state.toolbar.remove();
    state.toolbar = null;
    if (state.mode === "selecting") {
      cancelSelecting(() => {});
    }
  }
}

export function toggleHighlight() {
  state.highlightOn = !state.highlightOn;
  applyHighlightStyle();
  updateToolbar();
}

export function updateToolbar() {
  if (!state.toolbar) return;

  const brand = `<span class="aat-brand">AATranslator <span class="aat-ver">v${version()}</span></span>`;
  const provider = state.config?.provider;
  const needsSetup =
    provider === "browser"
      ? false
      : !state.config?.model ||
        (provider !== "ollama" && !state.config?.apiKey);
  const settingsBtnClass = needsSetup ? "aat-btn-warn" : "aat-btn-secondary";
  const settingsLabel = needsSetup
    ? `⚠ ${t("toolbar_settings")}`
    : t("toolbar_settings");
  const rightBtns =
    `<button class="aat-btn-secondary" id="aat-hl-toggle">${state.highlightOn ? t("toolbar_highlight_on") : t("toolbar_highlight_off")}</button>` +
    `<button class="${settingsBtnClass}" id="aat-settings" title="${needsSetup ? t("toolbar_needs_setup") : ""}">${settingsLabel}</button>`;

  let middle = "";
  if (state.mode === "idle") {
    middle = `<button class="aat-btn-primary" id="aat-select">${t("toolbar_select")}</button>`;
  } else if (state.mode === "selecting") {
    middle =
      `<span class="aat-status">${t("toolbar_selecting_hint")}</span>` +
      `<button class="aat-btn-secondary" id="aat-cancel-select">${t("toolbar_cancel")}</button>`;
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
  } else if (state.mode === "translating") {
    const pct = state.totalCount > 0 ? Math.round((state.translatedCount / state.totalCount) * 100) : 0;
    let etaStr = "";
    if (state.translatedCount > 0) {
      const elapsed = (Date.now() - state.translateStartTime) / 1000;
      const rate = state.translatedCount / elapsed;
      const remaining = Math.round((state.totalCount - state.translatedCount) / rate);
      if (remaining >= 60) {
        etaStr = `${Math.floor(remaining / 60)}m ${remaining % 60}s`;
      } else {
        etaStr = `${remaining}s`;
      }
    }
    middle =
      `<span class="aat-status">${state.translatedCount}/${state.totalCount}</span>` +
      `<div class="aat-progress-bar"><div class="aat-progress-fill" style="width:${pct}%"></div></div>` +
      `<span class="aat-status">${pct}%${etaStr ? ` · ${etaStr}` : ""}</span>` +
      `<button class="aat-btn-danger" id="aat-cancel">${t("toolbar_cancel")}</button>`;
  }

  state.toolbar.innerHTML = brand + middle + rightBtns;

  const q = (id) => state.toolbar.querySelector(id);
  q("#aat-select")?.addEventListener("click", () => startSelecting(updateToolbar));
  q("#aat-cancel-select")?.addEventListener("click", () => cancelSelecting(updateToolbar));
  q("#aat-translate-all")?.addEventListener("click", () => translateAll(updateToolbar));
  q("#aat-reselect")?.addEventListener("click", () => startSelecting(updateToolbar));
  q("#aat-reset")?.addEventListener("click", () => resetTranslations(updateToolbar));
  q("#aat-cancel")?.addEventListener("click", () => {
    state.cancelFlag = true;
    document.querySelectorAll(".aat-block.aat-translating").forEach((el) =>
      el.classList.remove("aat-translating"),
    );
    state.mode = "ready";
    updateToolbar();
  });
  q("#aat-hl-toggle")?.addEventListener("click", toggleHighlight);
  q("#aat-settings")?.addEventListener("click", toggleSettings);
}

export function toggleSettings() {
  if (state.settingsModal) {
    state.settingsModal.remove();
    state.settingsModal = null;
    return;
  }

  const modal = document.createElement("div");
  modal.className = "aat-settings";
  modal.innerHTML = `
    <div class="aat-settings-title">${t("settings_title")}</div>
    <div class="aat-settings-group">
      <label>${t("settings_provider")}</label>
      <select id="aat-s-provider">
        <option value="openai">OpenAI</option>
        <option value="gemini">Google Gemini</option>
        <option value="claude">Claude</option>
        <option value="ollama">${t("provider_ollama")}</option>
      </select>
    </div>
    <div class="aat-settings-group" id="aat-s-model-row">
      <label>${t("settings_model")}</label>
      <input type="text" id="aat-s-model">
    </div>
    <div class="aat-settings-group" id="aat-s-apikey-row">
      <label>${t("settings_api_key")}</label>
      <input type="password" id="aat-s-apikey">
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_concurrency")}</label>
      <select id="aat-s-concurrency">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="5">5</option>
        <option value="8">8</option>
        <option value="10">10</option>
      </select>
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_target_language")}</label>
      <select id="aat-s-lang">
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="zh_CN">简体中文</option>
        <option value="zh_TW">繁體中文</option>
      </select>
    </div>
    <div class="aat-settings-group">
      <label>${t("settings_highlight_color")}</label>
      <select id="aat-s-hlcolor">
        <option value="rgba(34, 197, 94, 0.1)">${t("color_light_green")}</option>
        <option value="rgba(79, 123, 232, 0.1)">${t("color_light_blue")}</option>
        <option value="rgba(234, 179, 8, 0.1)">${t("color_light_yellow")}</option>
        <option value="rgba(168, 85, 247, 0.1)">${t("color_light_purple")}</option>
        <option value="rgba(239, 68, 68, 0.1)">${t("color_light_red")}</option>
        <option value="rgba(0, 0, 0, 0)">${t("color_transparent")}</option>
      </select>
    </div>
    <div class="aat-settings-footer">
      <button class="aat-btn-primary" id="aat-s-save">${t("settings_save")}</button>
      <button class="aat-btn-secondary" id="aat-s-close">${t("settings_close")}</button>
    </div>
  `;
  document.body.appendChild(modal);
  state.settingsModal = modal;

  if (typeof self !== "undefined" && "Translator" in self) {
    const opt = document.createElement("option");
    opt.value = "browser";
    opt.textContent = t("provider_browser");
    modal.querySelector("#aat-s-provider").appendChild(opt);
  }

  const pEl = modal.querySelector("#aat-s-provider");
  const kEl = modal.querySelector("#aat-s-apikey");
  const kRow = modal.querySelector("#aat-s-apikey-row");
  const mEl = modal.querySelector("#aat-s-model");
  const mRow = modal.querySelector("#aat-s-model-row");
  const cEl = modal.querySelector("#aat-s-concurrency");
  const lEl = modal.querySelector("#aat-s-lang");
  const hlcEl = modal.querySelector("#aat-s-hlcolor");

  chrome.storage.sync.get(
    ["provider", "apiKey", "model", "concurrency", "targetLang", "highlightColor"],
    (data) => {
      const stored = data.provider || "gemini";
      pEl.value = pEl.querySelector(`option[value="${stored}"]`)
        ? stored
        : "gemini";
      if (data.apiKey) kEl.value = data.apiKey;
      mEl.value = data.model || "gemini-2.5-flash-lite";
      cEl.value = String(data.concurrency || 3);
      lEl.value = coerceTarget(data.targetLang, chrome.i18n.getUILanguage());
      if (data.highlightColor) hlcEl.value = data.highlightColor;
      const hideCreds = pEl.value === "ollama" || pEl.value === "browser";
      kRow.style.display = hideCreds ? "none" : "block";
      mRow.style.display = pEl.value === "browser" ? "none" : "block";
    },
  );

  pEl.addEventListener("change", () => {
    const hideCreds = pEl.value === "ollama" || pEl.value === "browser";
    kRow.style.display = hideCreds ? "none" : "block";
    mRow.style.display = pEl.value === "browser" ? "none" : "block";
  });

  modal.querySelector("#aat-s-save").addEventListener("click", () => {
    chrome.storage.sync.set(
      {
        provider: pEl.value,
        apiKey: kEl.value,
        model: mEl.value,
        concurrency: Number(cEl.value),
        targetLang: lEl.value,
        highlightColor: hlcEl.value,
      },
      async () => {
        state.highlightColor = hlcEl.value;
        applyHighlightStyle();
        await loadSettings();
        modal.remove();
        state.settingsModal = null;
        updateToolbar();
      },
    );
  });

  modal.querySelector("#aat-s-close").addEventListener("click", () => {
    modal.remove();
    state.settingsModal = null;
  });
}
