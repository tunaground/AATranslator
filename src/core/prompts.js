const LANG_NAMES = {
  ko: "Korean",
  en: "English",
  zh_CN: "Simplified Chinese",
  zh_TW: "Traditional Chinese",
};

function langName(code) {
  return LANG_NAMES[code] || code;
}

export function buildBlockPrompt(targetLang) {
  const name = langName(targetLang);
  return `You are a translator for Japanese AA (Ascii Art) works.
You will receive a Japanese text fragment. Determine if it is meaningful text or decorative.
Single words, names, katakana loanwords ARE meaningful — translate them.

Translate EVERY Japanese character, including proper nouns and character names (e.g. やる夫, やらない夫).
For character names without an established ${name} equivalent, transliterate phonetically.
The "translation" field MUST NOT contain any hiragana or katakana.

Respond in JSON:
{"meaningful": true, "translation": "translated text in ${name}"}
or {"meaningful": false}

IMPORTANT: When meaningful, "translation" MUST be fully in ${name}, NOT Japanese.
JSON only.`;
}

export function buildBatchPrompt(targetLang) {
  const name = langName(targetLang);
  return `Translate Japanese text fragments to ${name}.
You receive numbered fragments. For each, decide if it's meaningful text or decorative (kanji shading, symbols).
Single words, names, katakana loanwords ARE meaningful — translate them.

Translate EVERY Japanese character, including proper nouns and character names (e.g. やる夫, やらない夫).
For character names without an established ${name} equivalent, transliterate phonetically.
The "t" field MUST NOT contain any hiragana or katakana.

Respond as a JSON array:
[{"i":0,"m":true,"t":"translation in ${name}"},{"i":1,"m":false},...]

"i" = index, "m" = meaningful, "t" = translation (only when m=true, MUST be fully in ${name}).
JSON only. No explanation.`;
}

export function buildRomanizePrompt() {
  return `You will receive a text that mixes a target language (Chinese, Korean, or English) with Japanese fragments that were not translated.
Convert ALL Japanese characters (hiragana, katakana, kanji used as Japanese words or names) to Hepburn romanization using Latin letters.
- Hiragana and katakana MUST be converted (e.g. やる → yaru, カタカナ → katakana).
- Kanji that appear as Japanese words or names MUST be converted using the Japanese reading (e.g. やる夫 → Yaruo, 斜陽 → shayou).
- Keep all non-Japanese text (Chinese hanzi, Korean hangul, Latin letters, numbers, punctuation) EXACTLY as it appears.
- For well-known Japanese proper nouns, use the commonly known romanization (e.g. やる夫 → Yaruo).
- Do not translate meaning. Do not explain. Do not add quotes or markdown. Return ONLY the converted text.`;
}

export function buildRomanizeBatchPrompt() {
  return `You will receive numbered mixed-language texts. Each may contain some Japanese characters (hiragana, katakana, or kanji used as Japanese words or names).
For each, convert ONLY the Japanese characters to Hepburn romanization using Latin letters. Keep all non-Japanese text (Chinese hanzi, Korean hangul, Latin letters, numbers, punctuation) unchanged.
For well-known Japanese proper nouns, use the commonly known romanization (e.g. やる夫 → Yaruo, やらない夫 → Yaranaio).

Respond as a JSON array:
[{"i":0,"t":"converted text"},{"i":1,"t":"..."},...]

"i" = index, "t" = converted text. JSON only. No explanation.`;
}

export function formatBatchUser(texts) {
  return texts.map((t, i) => `[${i}] ${t}`).join("\n");
}
