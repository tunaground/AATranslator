import { state } from "./state.js";

export function callLLM(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "llm-call", config: state.config, systemPrompt, userMessage },
      (response) => {
        if (response?.ok) resolve(response.text);
        else reject(new Error(response?.error || "LLM call failed"));
      },
    );
  });
}
