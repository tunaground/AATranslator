const JA_CORE_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;
const JA_STILL_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;

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

export function isStillJapanese(text) {
  if (!text) return false;
  const m = text.match(JA_STILL_RE);
  if (!m) return false;
  return m.length / text.length > 0.3;
}
