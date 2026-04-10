export const BATCH_CHAR_LIMITS = {
  ollama: 1000,
  openai: 3000,
  gemini: 3000,
  claude: 3000,
};

const DEFAULT_LIMIT = 2000;

export function buildBatches(items, provider, getText = (x) => x) {
  const limit = BATCH_CHAR_LIMITS[provider] ?? DEFAULT_LIMIT;
  const batches = [];
  let current = [];
  let currentLen = 0;
  for (const item of items) {
    const text = getText(item);
    const len = text.length;
    if (current.length > 0 && currentLen + len > limit) {
      batches.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(item);
    currentLen += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
