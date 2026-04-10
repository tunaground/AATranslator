import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, parseResponse } from "../src/core/providers.js";

const cfg = { apiKey: "KEY", model: "m1" };
const sys = "you are a translator";
const user = "こんにちは";

test("buildRequest openai: url/headers/body shape", () => {
  const r = buildRequest("openai", cfg, sys, user);
  assert.equal(r.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(r.method, "POST");
  assert.equal(r.headers["Content-Type"], "application/json");
  assert.equal(r.headers.Authorization, "Bearer KEY");
  assert.equal(r.body.model, "m1");
  assert.equal(r.body.messages[0].role, "system");
  assert.equal(r.body.messages[0].content, sys);
  assert.equal(r.body.messages[1].role, "user");
  assert.equal(r.body.messages[1].content, user);
  assert.equal(r.body.max_tokens, 8192);
});

test("buildRequest gemini: url contains model and api key", () => {
  const r = buildRequest("gemini", cfg, sys, user);
  assert.equal(
    r.url,
    "https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent?key=KEY",
  );
  assert.equal(r.body.system_instruction.parts[0].text, sys);
  assert.equal(r.body.contents[0].parts[0].text, user);
  assert.equal(r.body.generationConfig.maxOutputTokens, 8192);
});

test("buildRequest claude: x-api-key header and anthropic-version", () => {
  const r = buildRequest("claude", cfg, sys, user);
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], "KEY");
  assert.equal(r.headers["anthropic-version"], "2023-06-01");
  assert.equal(r.body.system, sys);
  assert.equal(r.body.messages[0].content, user);
  assert.equal(r.body.max_tokens, 8192);
});

test("buildRequest ollama: localhost url, no auth header", () => {
  const r = buildRequest("ollama", cfg, sys, user);
  assert.equal(r.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(r.headers.Authorization, undefined);
  assert.equal(r.body.temperature, 0);
  assert.equal(r.body.messages[0].content, sys);
});

test("buildRequest: unknown provider throws", () => {
  assert.throws(() => buildRequest("unknown", cfg, sys, user));
});

test("parseResponse openai: extracts choices[0].message.content", () => {
  const data = { choices: [{ message: { content: "hi" } }] };
  assert.equal(parseResponse("openai", data), "hi");
});

test("parseResponse openai: missing content returns empty string", () => {
  assert.equal(parseResponse("openai", {}), "");
});

test("parseResponse gemini: extracts candidates[0].content.parts[0].text", () => {
  const data = { candidates: [{ content: { parts: [{ text: "hi" }] } }] };
  assert.equal(parseResponse("gemini", data), "hi");
});

test("parseResponse gemini: missing returns empty string", () => {
  assert.equal(parseResponse("gemini", {}), "");
});

test("parseResponse claude: finds first text block", () => {
  const data = {
    content: [
      { type: "thinking", text: "x" },
      { type: "text", text: "hi" },
    ],
  };
  assert.equal(parseResponse("claude", data), "hi");
});

test("parseResponse claude: missing returns empty string", () => {
  assert.equal(parseResponse("claude", {}), "");
});

test("parseResponse ollama: same shape as openai", () => {
  const data = { choices: [{ message: { content: "hi" } }] };
  assert.equal(parseResponse("ollama", data), "hi");
});

test("parseResponse: unknown provider throws", () => {
  assert.throws(() => parseResponse("unknown", {}));
});
