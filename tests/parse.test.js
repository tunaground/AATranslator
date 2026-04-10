import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlockResponse, parseBatchResponse } from "../src/core/parse.js";

test("parseBlockResponse: meaningful=true returns translation", () => {
  const raw = '{"meaningful": true, "translation": "안녕하세요"}';
  assert.deepEqual(parseBlockResponse(raw), {
    meaningful: true,
    translation: "안녕하세요",
  });
});

test("parseBlockResponse: meaningful=false returns meaningful:false", () => {
  const raw = '{"meaningful": false}';
  assert.deepEqual(parseBlockResponse(raw), { meaningful: false });
});

test("parseBlockResponse: strips ```json fences", () => {
  const raw = '```json\n{"meaningful": true, "translation": "Hi"}\n```';
  assert.deepEqual(parseBlockResponse(raw), {
    meaningful: true,
    translation: "Hi",
  });
});

test("parseBlockResponse: strips bare ``` fences", () => {
  const raw = '```\n{"meaningful": false}\n```';
  assert.deepEqual(parseBlockResponse(raw), { meaningful: false });
});

test("parseBlockResponse: throws on invalid JSON", () => {
  assert.throws(() => parseBlockResponse("not json at all"));
});

test("parseBlockResponse: missing translation with meaningful=true returns meaningful:false", () => {
  const raw = '{"meaningful": true}';
  assert.deepEqual(parseBlockResponse(raw), { meaningful: false });
});

test("parseBatchResponse: parses JSON array", () => {
  const raw = '[{"i":0,"m":true,"t":"hi"},{"i":1,"m":false}]';
  assert.deepEqual(parseBatchResponse(raw), [
    { i: 0, m: true, t: "hi" },
    { i: 1, m: false },
  ]);
});

test("parseBatchResponse: strips ```json fences", () => {
  const raw = '```json\n[{"i":0,"m":false}]\n```';
  assert.deepEqual(parseBatchResponse(raw), [{ i: 0, m: false }]);
});

test("parseBatchResponse: throws when not an array", () => {
  assert.throws(() => parseBatchResponse('{"i":0,"m":false}'));
});

test("parseBatchResponse: throws on invalid JSON", () => {
  assert.throws(() => parseBatchResponse("garbage"));
});
