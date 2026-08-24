import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["requestObligations", "sourceBoundaryRef", "approvedLayoutHash", "grammarGapIds"];
const obligationKeys = ["stableId", "kind", "targetTier", "ownerRef", "reason", "evidenceRefs", "decisionRef"];
const obligationKinds = new Set(["block-create", "lower-tier-extension", "grammar-gap"]);
const tiers = new Set(["block", "composite", "branch", "leaf", "grammar"]);

function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) {
  if (!object(value)) { errors.push(`${at}: expected object`); return false; }
  for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`);
  return true;
}
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors, min = 0) {
  if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; }
  if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`);
  value.forEach((item, index) => text(item, `${at}/${index}`, errors));
  if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`);
  return value;
}

export function validateInput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.request-emission.input") errors.push("/kind: expected fe.request-emission.input");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  if (value.stage !== "requests.review") errors.push("/stage: expected requests.review");
  if (value.status !== "ready") errors.push("/status: expected ready");
  const facts = strings(value.facts, "/facts", errors);
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  text(value.payload.sourceBoundaryRef, "/payload/sourceBoundaryRef", errors);
  text(value.payload.approvedLayoutHash, "/payload/approvedLayoutHash", errors);
  const gapIds = strings(value.payload.grammarGapIds, "/payload/grammarGapIds", errors);
  const obligations = value.payload.requestObligations;
  if (!Array.isArray(obligations) || obligations.length === 0) errors.push("/payload/requestObligations: expected non-empty array");
  const ids = [];
  if (Array.isArray(obligations)) obligations.forEach((item, index) => {
    const at = `/payload/requestObligations/${index}`;
    if (!exact(item, obligationKeys, at, errors)) return;
    if (typeof item.stableId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.stableId)) errors.push(`${at}/stableId: expected stable kebab-case ID`);
    else ids.push(item.stableId);
    if (!obligationKinds.has(item.kind)) errors.push(`${at}/kind: unsupported obligation kind`);
    if (!tiers.has(item.targetTier)) errors.push(`${at}/targetTier: unsupported target tier`);
    text(item.ownerRef, `${at}/ownerRef`, errors);
    text(item.reason, `${at}/reason`, errors);
    strings(item.evidenceRefs, `${at}/evidenceRefs`, errors, 1);
    text(item.decisionRef, `${at}/decisionRef`, errors);
  });
  if (new Set(ids).size !== ids.length) errors.push("/payload/requestObligations: stableId values must be unique");
  const hasGapFact = facts.includes("grammar-gap");
  const hasCreateFact = facts.includes("create-required");
  const hasGapObligation = Array.isArray(obligations) && obligations.some((item) => object(item) && item.kind === "grammar-gap");
  if (hasGapFact) {
    if (gapIds.length === 0 || !hasGapObligation) errors.push("/payload: grammar-gap route requires gap IDs and a grammar-gap obligation");
  } else {
    if (!hasCreateFact) errors.push("/facts: expected create-required when grammar-gap is absent");
    if (gapIds.length || hasGapObligation) errors.push("/payload: non-gap route cannot carry Grammar gaps");
  }
  return { valid: errors.length === 0, errors };
}

async function cli() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: node validate-input.mjs <input.json>");
  const value = JSON.parse(await readFile(path.resolve(file), "utf8"));
  const result = validateInput(value);
  if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
