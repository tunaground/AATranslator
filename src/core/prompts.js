const LANG_NAMES = { ko: "Korean", en: "English", ja: "Japanese" };

function langName(code) {
  return LANG_NAMES[code] || code;
}

export function buildBlockPrompt(targetLang) {
  const name = langName(targetLang);
  return `You are a translator for Japanese AA (Ascii Art) works.
You will receive a Japanese text fragment. Determine if it is meaningful text or decorative.
Single words, names, katakana loanwords ARE meaningful — translate them.

Respond in JSON:
{"meaningful": true, "translation": "translated text in ${name}"}
or {"meaningful": false}

IMPORTANT: When meaningful, "translation" MUST be in ${name}, NOT Japanese.
JSON only.`;
}

export function buildBatchPrompt(targetLang) {
  const name = langName(targetLang);
  return `Translate Japanese text fragments to ${name}.
You receive numbered fragments. For each, decide if it's meaningful text or decorative (kanji shading, symbols).
Single words, names, katakana loanwords ARE meaningful — translate them.

Respond as a JSON array:
[{"i":0,"m":true,"t":"translation in ${name}"},{"i":1,"m":false},...]

"i" = index, "m" = meaningful, "t" = translation (only when m=true, MUST be in ${name}).
JSON only. No explanation.`;
}

export function formatBatchUser(texts) {
  return texts.map((t, i) => `[${i}] ${t}`).join("\n");
}
