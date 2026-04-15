const SOURCE_LANG = "ja";
const instances = new Map();

export function isBrowserTranslatorSupported() {
  return typeof self !== "undefined" && "Translator" in self;
}

async function getTranslator(targetLang) {
  if (instances.has(targetLang)) return instances.get(targetLang);
  const p = self.Translator.create({
    sourceLanguage: SOURCE_LANG,
    targetLanguage: targetLang,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        console.log(
          `[AAT] Browser translator model download: ${(e.loaded * 100).toFixed(0)}%`,
        );
      });
    },
  });
  instances.set(targetLang, p);
  try {
    const inst = await p;
    instances.set(targetLang, inst);
    return inst;
  } catch (err) {
    instances.delete(targetLang);
    throw err;
  }
}

export async function translateBlockBrowser(text, targetLang) {
  const t = await getTranslator(targetLang);
  const out = await t.translate(text);
  return out?.trim() || text;
}
