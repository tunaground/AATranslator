import { buildRequest, parseResponse } from "./core/providers.js";

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-toolbar" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/bootstrap.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/content/styles.css"],
      });
    } catch (e) {
      console.warn("[AAT] Cannot inject into this tab:", e);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "llm-call") {
    handleWithRetry(msg.config, msg.systemPrompt, msg.userMessage)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
});

async function handleWithRetry(config, systemPrompt, userMessage) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callLLM(config, systemPrompt, userMessage);
    } catch (err) {
      const status = err.message?.match(/\b(429|503|529)\b/);
      if (status && attempt < maxRetries - 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
        console.log(
          `[AAT] ${status[0]} error, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

async function callLLM(config, systemPrompt, userMessage) {
  const { provider } = config;
  const req = buildRequest(provider, config, systemPrompt, userMessage);
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return parseResponse(provider, data);
}
