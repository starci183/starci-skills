import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["requestPaths", "receipts", "blockedByGrammarGap"];
const receiptKeys = ["stableId", "path", "contentHash"];
const requestPath = /^\.claude\/requests\/[a-z0-9]+(?:-[a-z0-9]+)*\.request\.json$/;
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors, min = 0) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`); value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateOutput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.request-emission.output") errors.push("/kind: expected fe.request-emission.output");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  if (value.stage !== "request.result") errors.push("/stage: expected request.result");
  if (!["ready", "blocked"].includes(value.status)) errors.push("/status: expected ready or blocked");
  const facts = strings(value.facts, "/facts", errors);
  if (!facts.includes("requests-emitted")) errors.push("/facts: requests-emitted is required");
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  const paths = strings(value.payload.requestPaths, "/payload/requestPaths", errors, 1);
  paths.forEach((item, index) => { if (!requestPath.test(item)) errors.push(`/payload/requestPaths/${index}: invalid request path`); });
  if (typeof value.payload.blockedByGrammarGap !== "boolean") errors.push("/payload/blockedByGrammarGap: expected boolean");
  const receipts = value.payload.receipts;
  if (!Array.isArray(receipts) || receipts.length === 0) errors.push("/payload/receipts: expected non-empty array");
  const receiptPaths = [];
  if (Array.isArray(receipts)) receipts.forEach((item, index) => {
    const at = `/payload/receipts/${index}`;
    if (!exact(item, receiptKeys, at, errors)) return;
    text(item.stableId, `${at}/stableId`, errors); text(item.contentHash, `${at}/contentHash`, errors);
    if (typeof item.path !== "string" || !requestPath.test(item.path)) errors.push(`${at}/path: invalid request path`); else receiptPaths.push(item.path);
    if (typeof item.stableId === "string" && typeof item.path === "string" && item.path !== `.claude/requests/${item.stableId}.request.json`) errors.push(`${at}: stableId and path disagree`);
  });
  if (new Set(receiptPaths).size !== receiptPaths.length) errors.push("/payload/receipts: duplicate paths are forbidden");
  if ([...paths].sort().join("\n") !== [...receiptPaths].sort().join("\n")) errors.push("/payload: requestPaths and receipt paths must match exactly");
  if (value.status === "blocked") {
    if (value.payload.blockedByGrammarGap !== true || !facts.includes("grammar-gap")) errors.push("/payload: blocked output requires Grammar-gap truth and fact");
  } else if (value.payload.blockedByGrammarGap !== false || facts.includes("grammar-gap")) errors.push("/payload: ready output cannot retain Grammar-gap blocking");
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-output.mjs <output.json>"); const result = validateOutput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
