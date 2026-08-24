import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["selectedFlowHash", "approvedLayoutHash", "exactSourceBoundary", "changeSetRef", "changeSetHash", "seedEvidenceRef", "seedEvidenceHash", "unitEvidenceRef", "unitEvidenceHash", "e2eEvidenceRef", "e2eEvidenceHash", "uiEvidenceRef", "uiEvidenceHash", "gates", "browserScenarios", "proofArtifactRoot"];
const gateKeys = ["gateId", "commandRef", "required"];
const scenarioKeys = ["scenarioId", "journeyPageIds", "stateIds", "viewportRefs", "interactionRef", "assertionRefs"];
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors, min = 0) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`); value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateInput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.product-proof.input") errors.push("/kind: expected fe.product-proof.input");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  if (value.stage !== "proof.run" || value.status !== "ready") errors.push("/stage: expected proof.run / ready");
  const facts = strings(value.facts, "/facts", errors);
  for (const fact of ["seed-evidence", "unit-pass", "unit-evidence", "e2e-pass", "e2e-evidence", "ui-pass", "ui-evidence"]) if (!facts.includes(fact)) errors.push(`/facts: ${fact} is required`);
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  for (const key of ["selectedFlowHash", "approvedLayoutHash", "changeSetRef", "changeSetHash", "seedEvidenceRef", "seedEvidenceHash", "unitEvidenceRef", "unitEvidenceHash", "e2eEvidenceRef", "e2eEvidenceHash", "uiEvidenceRef", "uiEvidenceHash", "proofArtifactRoot"]) text(value.payload[key], `/payload/${key}`, errors);
  strings(value.payload.exactSourceBoundary, "/payload/exactSourceBoundary", errors, 1);
  const gates = value.payload.gates;
  if (!Array.isArray(gates) || gates.length === 0) errors.push("/payload/gates: expected non-empty array");
  const gateIds = [];
  if (Array.isArray(gates)) gates.forEach((item, index) => { const at = `/payload/gates/${index}`; if (!exact(item, gateKeys, at, errors)) return; text(item.gateId, `${at}/gateId`, errors); text(item.commandRef, `${at}/commandRef`, errors); if (item.required !== true) errors.push(`${at}/required: every declared gate must be required`); if (typeof item.gateId === "string") gateIds.push(item.gateId); });
  if (new Set(gateIds).size !== gateIds.length) errors.push("/payload/gates: gateId values must be unique");
  const scenarios = value.payload.browserScenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) errors.push("/payload/browserScenarios: expected non-empty array");
  const scenarioIds = [];
  if (Array.isArray(scenarios)) scenarios.forEach((item, index) => {
    const at = `/payload/browserScenarios/${index}`;
    if (!exact(item, scenarioKeys, at, errors)) return;
    text(item.scenarioId, `${at}/scenarioId`, errors); text(item.interactionRef, `${at}/interactionRef`, errors);
    strings(item.journeyPageIds, `${at}/journeyPageIds`, errors, 1); strings(item.stateIds, `${at}/stateIds`, errors, 1); strings(item.viewportRefs, `${at}/viewportRefs`, errors, 1); strings(item.assertionRefs, `${at}/assertionRefs`, errors, 1);
    if (typeof item.scenarioId === "string") scenarioIds.push(item.scenarioId);
  });
  if (new Set(scenarioIds).size !== scenarioIds.length) errors.push("/payload/browserScenarios: scenarioId values must be unique");
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-input.mjs <input.json>"); const result = validateInput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
