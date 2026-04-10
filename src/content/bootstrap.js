(async () => {
  try {
    const url = chrome.runtime.getURL("src/content/main.js");
    const mod = await import(url);
    await mod.init();
    mod.showToolbar();
  } catch (e) {
    console.error("[AAT] Failed to bootstrap content module:", e);
  }
})();
