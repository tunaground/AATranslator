import { state } from "./state.js";
import {
  wrapJaBlocks,
  unwrapBlocks,
  resetTranslatedBlocks,
  applyTranslation,
  setSpanText,
} from "./dom.js";
import { onBlockClick, translateBlockText } from "./translate-flow.js";
import { t } from "./i18n.js";

let currentUpdateUI = null;

export function startSelecting(updateUI) {
  currentUpdateUI = updateUI;
  state.mode = "selecting";
  document.body.style.cursor = "crosshair";
  document.addEventListener("mouseover", onSelectHover, true);
  document.addEventListener("mouseout", onSelectOut, true);
  document.addEventListener("click", onSelectClick, true);
  updateUI();
}

export function cancelSelecting(updateUI) {
  document.removeEventListener("mouseover", onSelectHover, true);
  document.removeEventListener("mouseout", onSelectOut, true);
  document.removeEventListener("click", onSelectClick, true);
  document.querySelectorAll(".aat-selectable").forEach((el) =>
    el.classList.remove("aat-selectable"),
  );
  document.body.style.cursor = "";
  state.mode = "idle";
  updateUI();
}

function onSelectHover(e) {
  if (state.mode !== "selecting") return;
  const el = e.target;
  if (el === state.toolbar || state.toolbar?.contains(el)) return;
  el.classList.add("aat-selectable");
}

function onSelectOut(e) {
  if (state.mode !== "selecting") return;
  e.target.classList.remove("aat-selectable");
}

function onSelectClick(e) {
  if (state.mode !== "selecting") return;
  const el = e.target;
  if (el === state.toolbar || state.toolbar?.contains(el)) return;

  e.preventDefault();
  e.stopPropagation();

  document.removeEventListener("mouseover", onSelectHover, true);
  document.removeEventListener("mouseout", onSelectOut, true);
  document.removeEventListener("click", onSelectClick, true);
  document.querySelectorAll(".aat-selectable").forEach((x) =>
    x.classList.remove("aat-selectable"),
  );
  document.body.style.cursor = "";

  if (state.selectedContainer) {
    state.selectedContainer.classList.remove("aat-selected");
    unwrapBlocks(state.selectedContainer);
  }

  state.selectedContainer = el;
  state.selectedContainer.classList.add("aat-selected");
  wrapJaBlocks(state.selectedContainer, onBlockClick);

  state.mode = "ready";
  currentUpdateUI?.();
}

export function resetTranslations(updateUI) {
  state.cancelFlag = true;
  if (state.selectedContainer) {
    resetTranslatedBlocks(state.selectedContainer);
  }
  state.translatedCount = 0;
  state.totalCount = 0;
  state.mode = state.selectedContainer ? "ready" : "idle";
  updateUI();
}

// ===== Manual text-selection popup =====

function removeSelectionPopup() {
  if (state.selectionPopup) {
    state.selectionPopup.remove();
    state.selectionPopup = null;
  }
}

export function installSelectionPopup() {
  document.addEventListener("mouseup", (e) => {
    if (!state.toolbar) return;
    if (state.toolbar.contains(e.target)) return;
    if (state.selectionPopup?.contains(e.target)) return;
    if (state.settingsModal?.contains(e.target)) return;

    removeSelectionPopup();

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !state.config) return;
    const rawText = sel.toString();
    if (!rawText.trim()) return;
    const text = rawText;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const popup = document.createElement("div");
    popup.className = "aat-selection-popup";
    popup.textContent = t("popup_translate");
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top + window.scrollY - 32}px`;
    document.body.appendChild(popup);
    state.selectionPopup = popup;

    popup.addEventListener("click", async () => {
      removeSelectionPopup();

      const span = document.createElement("span");
      span.className = "aat-block aat-translating";
      span.dataset.original = text;
      span.addEventListener("click", onBlockClick);

      try {
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        sel.removeAllRanges();

        const leadingWS = text.match(/^(\s*)/)[1];
        const trailingWS = text.match(/(\s*)$/)[1];
        const trimmedText = text.trim();

        const result = await translateBlockText(trimmedText);
        if (result.meaningful) {
          const translated = leadingWS + result.translated + trailingWS;
          applyTranslation(span, translated);
        }
      } catch (err) {
        console.error("[AAT] Manual translation failed:", err);
      }
      span.classList.remove("aat-translating");
    });
  });

  document.addEventListener("mousedown", (e) => {
    if (state.selectionPopup && !state.selectionPopup.contains(e.target)) {
      removeSelectionPopup();
    }
  });
}
