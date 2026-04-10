function stripFences(raw) {
  return raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
}

export function parseBlockResponse(raw) {
  const json = stripFences(raw);
  const parsed = JSON.parse(json);
  if (parsed.meaningful && parsed.translation) {
    return { meaningful: true, translation: parsed.translation };
  }
  return { meaningful: false };
}

export function parseBatchResponse(raw) {
  const json = stripFences(raw);
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("Batch response is not an array");
  }
  return parsed;
}
