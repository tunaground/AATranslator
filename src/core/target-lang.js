export const SUPPORTED_TARGETS = ["ko", "en", "zh_CN", "zh_TW"];

export function pickInitialTarget(rawBrowserLang) {
  const raw = (rawBrowserLang || "").toLowerCase();
  if (raw.startsWith("ko")) return "ko";
  if (
    raw.startsWith("zh-tw") ||
    raw.startsWith("zh-hk") ||
    raw.startsWith("zh-mo")
  ) {
    return "zh_TW";
  }
  if (raw.startsWith("zh")) return "zh_CN";
  if (raw.startsWith("en")) return "en";
  return "en";
}

export function coerceTarget(stored, rawBrowserLang) {
  if (!stored) return pickInitialTarget(rawBrowserLang);
  return SUPPORTED_TARGETS.includes(stored) ? stored : "en";
}
