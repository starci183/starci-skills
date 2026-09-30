// json.mjs — the ledger's forgiving JSON read. Every one of these rows may hold text a peer wrote or a
// truncated payload, so a malformed column is the caller's fallback, never a throw. The parse of the
// literal 'null' is kept as null (callers that want {} instead write `parseJsonOr`).
import fs from 'node:fs';

/** `text` as JSON, or `fallback` when it does not parse. */
export const parseJson = (text, fallback = null) => {
  try { return JSON.parse(text); } catch { return fallback; }
};

/** `text` as JSON, or `fallback` when it does not parse OR parses to null/undefined. Rows written
 * as the literal 'null' read back as the fallback too, so a caller that wants an object gets one. */
export const parseJsonOr = (text, fallback = {}) => parseJson(text) ?? fallback;

/** A jobs/events row spread with `payload`: the row's payload_json parsed via parseJsonOr
 * (`fallback` defaults to {}). Pass fallback null to keep a raw parseJson result, nulls included. */
export const withPayload = (row, fallback = {}) => (row ? { ...row, payload: parseJsonOr(row.payload_json, fallback) } : row);

/** `file` read and parsed as JSON, or `fallback` when the file is missing, unreadable or malformed. */
export const readJsonFile = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
