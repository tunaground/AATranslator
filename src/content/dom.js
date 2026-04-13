import { state } from "./state.js";
import { SPLIT_RE, isJaBlock, extractJaBlocks } from "../core/ja-blocks.js";

export function wrapJaBlocks(container, onClick) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent && extractJaBlocks(node.textContent).length > 0) {
      textNodes.push(node);
    }
  }
  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const tokens = text.split(SPLIT_RE);
    if (tokens.length <= 1 && !isJaBlock(text)) continue;
    const frag = document.createDocumentFragment();
    for (const token of tokens) {
      if (!token) continue;
      if (!SPLIT_RE.test(token) && isJaBlock(token)) {
        const span = document.createElement("span");
        span.className = "aat-block";
        span.textContent = token;
        span.dataset.original = token;
        span.addEventListener("click", onClick);
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(token));
      }
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

export function unwrapBlocks(container) {
  const spans = container.querySelectorAll(".aat-block");
  for (const span of spans) {
    span.replaceWith(document.createTextNode(span.dataset.original || span.textContent));
  }
  container.normalize();
}

export function resetTranslatedBlocks(container) {
  const spans = container.querySelectorAll(".aat-block");
  for (const span of spans) {
    span.classList.remove("aat-translated", "aat-translating");
    delete span.dataset.translated;
    delete span.dataset.showing;
    setSpanText(span, span.dataset.original);
  }
}

export function setSpanText(span, text) {
  span.innerHTML = "";
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) span.appendChild(document.createElement("br"));
    span.appendChild(document.createTextNode(lines[i]));
  }
}

export function applyTranslation(span, translated) {
  span.dataset.translated = translated;
  span.dataset.showing = "translated";
  setSpanText(span, translated);
  span.classList.add("aat-translated");
  span.classList.remove("aat-translating");
}

export function toggleSpan(span) {
  const showing = span.dataset.showing || "translated";
  if (showing === "translated") {
    setSpanText(span, span.dataset.original);
    span.dataset.showing = "original";
  } else {
    setSpanText(span, span.dataset.translated);
    span.dataset.showing = "translated";
  }
}

export function applyHighlightStyle() {
  if (!state.highlightStyleEl) {
    state.highlightStyleEl = document.createElement("style");
    state.highlightStyleEl.id = "aat-highlight-style";
    document.head.appendChild(state.highlightStyleEl);
  }
  if (state.highlightOn) {
    state.highlightStyleEl.textContent =
      `.aat-block.aat-translated { background-color: ${state.highlightColor} !important; }`;
  } else {
    state.highlightStyleEl.textContent =
      `.aat-block.aat-translated { background-color: transparent !important; }`;
  }
}
