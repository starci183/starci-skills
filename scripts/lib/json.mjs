// json.mjs — the ledger's forgiving JSON read. Every one of these rows may hold text a peer wrote or a
// truncated payload, so a malformed column is the caller's fallback, never a throw. The parse of the
// literal 'null' is kept as null (callers that want {} instead write `parseJson(text) ?? {}`).

/** `text` as JSON, or `fallback` when it does not parse. */
export const parseJson = (text, fallback = null) => {
  try { return JSON.parse(text); } catch { return fallback; }
};
