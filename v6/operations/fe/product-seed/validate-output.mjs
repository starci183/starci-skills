import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["seedEvidenceRef", "seedEvidenceHash", "stateReceipts", "uncoveredStateIds", "stopReasons"];
const receiptKeys = ["stateId", "ownerRef", "setupRef", "observableRef", "resetRef", "evidenceRef", "deterministic"];
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateOutput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.product-seed.output") errors.push("/kind: expected fe.product-seed.output");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  const route = `${value.stage}/${value.status}`;
  if (!["test.unit/ready", "seed.result/blocked"].includes(route)) errors.push("/stage: stage and status do not form a declared emission");
  const facts = strings(value.facts, "/facts", errors);
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  text(value.payload.seedEvidenceRef, "/payload/seedEvidenceRef", errors); text(value.payload.seedEvidenceHash, "/payload/seedEvidenceHash", errors);
  const uncovered = strings(value.payload.uncoveredStateIds, "/payload/uncoveredStateIds", errors);
  const stops = strings(value.payload.stopReasons, "/payload/stopReasons", errors);
  const receipts = value.payload.stateReceipts;
  if (!Array.isArray(receipts)) errors.push("/payload/stateReceipts: expected array");
  const ids = [];
  if (Array.isArray(receipts)) receipts.forEach((item, index) => {
    const at = `/payload/stateReceipts/${index}`;
    if (!exact(item, receiptKeys, at, errors)) return;
    for (const key of ["stateId", "ownerRef", "setupRef", "observableRef", "resetRef", "evidenceRef"]) text(item[key], `${at}/${key}`, errors);
    if (item.deterministic !== true) errors.push(`${at}/deterministic: expected true`);
    if (typeof item.stateId === "string") ids.push(item.stateId);
  });
  if (new Set(ids).size !== ids.length) errors.push("/payload/stateReceipts: stateId values must be unique");
  if (ids.some((id) => uncovered.includes(id))) errors.push("/payload: a state cannot be both materialized and uncovered");
  if (value.status === "ready") {
    if (!facts.includes("seed-evidence")) errors.push("/facts: ready output requires seed-evidence");
    if (ids.length === 0 || uncovered.length || stops.length) errors.push("/payload: ready output requires receipts and no uncovered state or stop reason");
  } else {
    if (!facts.includes("seed-blocked")) errors.push("/facts: blocked output requires seed-blocked");
    if (uncovered.length === 0 || stops.length === 0) errors.push("/payload: blocked output requires uncovered states and stop reasons");
  }
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-output.mjs <output.json>"); const result = validateOutput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
