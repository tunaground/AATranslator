import { state } from "./state.js";
import { callLLM } from "./llm.js";
import { applyTranslation, toggleSpan, setSpanText } from "./dom.js";
import { isStillJapanese, isRomanizeOutputValid } from "../core/ja-blocks.js";
import {
  buildBlockPrompt,
  buildBatchPrompt,
  buildRomanizePrompt,
  buildRomanizeBatchPrompt,
  formatBatchUser,
} from "../core/prompts.js";
import { parseBlockResponse, parseBatchResponse } from "../core/parse.js";
import { buildBatches } from "../core/batches.js";

async function romanizeText(text) {
  try {
    const raw = await callLLM(buildRomanizePrompt(), text);
    const cleaned = raw
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```/g, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!cleaned || !isRomanizeOutputValid(text, cleaned)) return text;
    return cleaned;
  } catch {
    return text;
  }
}

async function romanizeBatch(texts) {
  try {
    const raw = await callLLM(buildRomanizeBatchPrompt(), formatBatchUser(texts));
    const parsed = parseBatchResponse(raw);
    return texts.map((t, i) => {
      const entry = parsed.find((p) => p.i === i);
      if (!entry || !entry.t) return t;
      return isRomanizeOutputValid(t, entry.t) ? entry.t : t;
    });
  } catch {
    return texts;
  }
}

export async function translateBlockText(text) {
  const systemPrompt = buildBlockPrompt(state.targetLang);
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw;
    try {
      raw = await callLLM(systemPrompt, text);
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = parseBlockResponse(raw);
    } catch {
      continue;
    }
    if (!parsed.meaningful || !parsed.translation) {
      return { meaningful: false, translated: text };
    }
    if (parsed.translation.trim() === text.trim()) continue;
    if (isStillJapanese(parsed.translation, state.targetLang)) {
      const romanized = await romanizeText(parsed.translation);
      return { meaningful: true, translated: romanized };
    }
    return { meaningful: true, translated: parsed.translation };
  }
  return { meaningful: false, translated: text };
}

export async function translateSpan(span, updateUI) {
  if (state.cancelFlag) return;
  span.classList.add("aat-translating");
  try {
    const result = await translateBlockText(span.dataset.original);
    if (state.cancelFlag) {
      span.classList.remove("aat-translating");
      return;
    }
    if (result.meaningful) {
      applyTranslation(span, result.translated);
    } else {
      span.classList.remove("aat-translating");
    }
  } catch (err) {
    console.error("[AAT] Single translation failed:", err);
    span.classList.remove("aat-translating");
  }
  state.translatedCount++;
  updateUI?.();
}

export async function translateBatchSpans(spans, updateUI) {
  const systemPrompt = buildBatchPrompt(state.targetLang);
  const texts = spans.map((s) => s.dataset.original);
  const userMsg = formatBatchUser(texts);
  let parsed;
  try {
    const raw = await callLLM(systemPrompt, userMsg);
    parsed = parseBatchResponse(raw);
  } catch {
    return spans;
  }

  const failed = [];
  const pendingRomanize = [];
  for (let i = 0; i < spans.length; i++) {
    if (state.cancelFlag) break;
    const span = spans[i];
    const entry = parsed.find((p) => p.i === i);
    if (!entry) {
      failed.push(span);
      continue;
    }
    const hasTranslation =
      entry.m && entry.t && entry.t.trim() !== texts[i].trim();
    if (!hasTranslation) {
      span.classList.remove("aat-translating");
      state.translatedCount++;
      updateUI?.();
      continue;
    }
    if (isStillJapanese(entry.t, state.targetLang)) {
      pendingRomanize.push({ span, partial: entry.t });
    } else {
      applyTranslation(span, entry.t);
      state.translatedCount++;
      updateUI?.();
    }
  }

  if (pendingRomanize.length > 0 && !state.cancelFlag) {
    const romanized = await romanizeBatch(pendingRomanize.map((p) => p.partial));
    for (let k = 0; k < pendingRomanize.length; k++) {
      if (state.cancelFlag) break;
      applyTranslation(pendingRomanize[k].span, romanized[k]);
      state.translatedCount++;
      updateUI?.();
    }
  }

  return failed;
}

export async function onBlockClick(e) {
  if (!state.config) return;
  const span = e.target.closest(".aat-block") || e.target;
  if (span.classList.contains("aat-translating")) return;

  if (span.classList.contains("aat-translated")) {
    toggleSpan(span);
    return;
  }

  span.classList.add("aat-translating");
  try {
    const result = await translateBlockText(span.dataset.original);
    if (result.meaningful) {
      applyTranslation(span, result.translated);
    }
  } catch (err) {
    console.error("[AAT] Block click translation failed:", err);
  }
  span.classList.remove("aat-translating");
}

export async function translateAll(updateUI) {
  if (!state.selectedContainer || !state.config) return;
  const blocks = [
    ...state.selectedContainer.querySelectorAll(".aat-block:not(.aat-translated)"),
  ];
  state.totalCount = blocks.length;
  state.translatedCount = 0;
  state.cancelFlag = false;
  state.translateStartTime = Date.now();
  state.mode = "translating";
  updateUI();

  blocks.forEach((s) => s.classList.add("aat-translating"));

  const concurrency = state.config.concurrency || 3;
  const provider = state.config.provider;
  const getText = (s) => s.dataset.original;

  const runChunk = (chunkBatches) =>
    Promise.all(
      chunkBatches.map((batch) => {
        if (state.cancelFlag) return Promise.resolve([]);
        if (batch.length === 1) {
          return translateSpan(batch[0], updateUI).then(() => []);
        }
        return translateBatchSpans(batch, updateUI);
      }),
    );

  const batches = buildBatches(blocks, provider, getText);
  for (let i = 0; i < batches.length; i += concurrency) {
    if (state.cancelFlag) break;
    const chunk = batches.slice(i, i + concurrency);
    const results = await runChunk(chunk);
    const failed = results.flat();

    if (failed.length > 0) {
      const smallBatches = buildBatches(failed, provider, getText);
      for (let j = 0; j < smallBatches.length; j += concurrency) {
        if (state.cancelFlag) break;
        const retryChunk = smallBatches.slice(j, j + concurrency);
        const retryResults = await runChunk(retryChunk);
        const stillFailed = retryResults.flat();
        for (let k = 0; k < stillFailed.length; k += concurrency) {
          if (state.cancelFlag) break;
          await Promise.all(
            stillFailed.slice(k, k + concurrency).map((span) => {
              if (state.cancelFlag) return Promise.resolve();
              return translateSpan(span, updateUI);
            }),
          );
        }
      }
    }
  }

  blocks.forEach((s) => s.classList.remove("aat-translating"));
  state.mode = "ready";
  updateUI();
}
