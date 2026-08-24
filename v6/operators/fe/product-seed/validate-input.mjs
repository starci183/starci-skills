import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["changeSetRef", "changeSetHash", "businessStateContractRef", "requiredStates", "seedBoundaryRef", "environmentRef"];
const stateKeys = ["stateId", "ownerRef", "provenance", "evidenceRef", "materializationIntent", "sensitivity"];
const sensitivities = new Set(["none", "money", "access", "entitlement", "data-loss", "legal", "terminal-outcome"]);
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateInput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.product-seed.input") errors.push("/kind: expected fe.product-seed.input");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  if (value.stage !== "seed.materialize" || value.status !== "ready") errors.push("/stage: expected seed.materialize / ready");
  const facts = strings(value.facts, "/facts", errors);
  if (!facts.includes("source-written")) errors.push("/facts: source-written is required");
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  for (const key of ["changeSetRef", "changeSetHash", "businessStateContractRef", "seedBoundaryRef", "environmentRef"]) text(value.payload[key], `/payload/${key}`, errors);
  const states = value.payload.requiredStates;
  if (!Array.isArray(states) || states.length === 0) errors.push("/payload/requiredStates: expected non-empty array");
  const ids = [];
  if (Array.isArray(states)) states.forEach((item, index) => {
    const at = `/payload/requiredStates/${index}`;
    if (!exact(item, stateKeys, at, errors)) return;
    for (const key of ["stateId", "ownerRef", "evidenceRef", "materializationIntent"]) text(item[key], `${at}/${key}`, errors);
    if (!["business", "derived-block"].includes(item.provenance)) errors.push(`${at}/provenance: expected business or derived-block`);
    if (!sensitivities.has(item.sensitivity)) errors.push(`${at}/sensitivity: unsupported sensitivity`);
    if (typeof item.stateId === "string") ids.push(item.stateId);
  });
  if (new Set(ids).size !== ids.length) errors.push("/payload/requiredStates: stateId values must be unique");
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-input.mjs <input.json>"); const result = validateInput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
