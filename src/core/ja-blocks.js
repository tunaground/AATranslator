const JA_CORE_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;
const JA_STILL_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;
// Kana-only detector: hiragana + katakana are unambiguously Japanese.
// Used when the translation target is a language that shares CJK ideographs
// (Chinese), so legitimate hanzi translations aren't falsely flagged as
// "still Japanese".
const JA_KANA_RE = /[\u3041-\u3096\u30A1-\u30FA]/;
const KANA_GLOBAL_RE = /[\u3041-\u3096\u30A1-\u30FA]/g;
const CJK_IDEOGRAPH_RE = /[\u4E00-\u9FFF]/g;

export const SPLIT_RE = /([\u0020\u3000\t\n\r]+|[\u3010\u3011\u300C\u300D\u300E\u300F\uFF08\uFF09\u3008\u3009\u300A\u300B\[\]\(\)\u2460-\u2473\u2474-\u2487\u2488-\u249B\u24EA-\u24FF\u203B\uFF0A])/;

export function isJaBlock(token) {
  if (!token) return false;
  const matches = token.match(JA_CORE_RE);
  return matches !== null && matches.length >= 2;
}

export function extractJaBlocks(text) {
  if (!text) return [];
  const tokens = text.split(SPLIT_RE);
  return tokens.filter((t) => t && !SPLIT_RE.test(t) && isJaBlock(t));
}

export function isStillJapanese(text, targetLang) {
  if (!text) return false;
  if (targetLang === "zh_CN" || targetLang === "zh_TW") {
    return JA_KANA_RE.test(text);
  }
  const m = text.match(JA_STILL_RE);
  if (!m) return false;
  return m.length / text.length > 0.3;
}

// Sanity check for the romanization post-processing step. When the input
// is mostly target-language (hanzi-dominant) with a small Japanese leak,
// the LLM should preserve the non-Japanese characters. If the output
// dropped most of the hanzi, the LLM probably translated the whole text
// into another Latin-script language instead of romanizing — reject and
// let the caller fall back to the original partial translation.
export function isRomanizeOutputValid(input, output) {
  if (!output) return false;
  if (!input) return true;
  const inputCJK = (input.match(CJK_IDEOGRAPH_RE) || []).length;
  if (inputCJK < 5) return true;
  const inputKana = (input.match(KANA_GLOBAL_RE) || []).length;
  if (inputCJK <= inputKana * 2) return true;
  const outputCJK = (output.match(CJK_IDEOGRAPH_RE) || []).length;
  return outputCJK >= inputCJK * 0.5;
}
