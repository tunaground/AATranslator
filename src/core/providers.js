export function buildRequest(provider, { apiKey, model }, systemPrompt, userMessage) {
  if (provider === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 8192,
      },
    };
  }

  if (provider === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 8192 },
      },
    };
  }

  if (provider === "claude") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      },
    };
  }

  if (provider === "ollama") {
    return {
      url: "http://localhost:11434/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      },
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export function parseResponse(provider, data) {
  if (provider === "openai" || provider === "ollama") {
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "gemini") {
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  if (provider === "claude") {
    return data.content?.find((b) => b.type === "text")?.text ?? "";
  }
  throw new Error(`Unknown provider: ${provider}`);
}
