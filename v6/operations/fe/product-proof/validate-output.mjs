import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["proofRef", "proofHash", "result", "checkResults", "failedCheckIds", "repairClass", "boundaryDriftReasons", "approvalRequired"];
const checkKeys = ["checkId", "kind", "status", "evidenceRefs"];
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors, min = 0) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`); value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateOutput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.product-proof.output") errors.push("/kind: expected fe.product-proof.output");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  const route = `${value.stage}/${value.status}`;
  if (!["proof.review/complete", "code.repair/repair", "layout.review/rejected", "proof.review/blocked"].includes(route)) errors.push("/stage: stage and status do not form a declared emission");
  const facts = strings(value.facts, "/facts", errors);
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  text(value.payload.proofRef, "/payload/proofRef", errors); text(value.payload.proofHash, "/payload/proofHash", errors);
  if (!["pass", "repair", "boundary-drift", "blocked"].includes(value.payload.result)) errors.push("/payload/result: unsupported result");
  if (!["none", "in-boundary", "boundary-drift"].includes(value.payload.repairClass)) errors.push("/payload/repairClass: unsupported repair class");
  if (!["none", "layout"].includes(value.payload.approvalRequired)) errors.push("/payload/approvalRequired: expected none or layout");
  const failed = strings(value.payload.failedCheckIds, "/payload/failedCheckIds", errors);
  const drifts = strings(value.payload.boundaryDriftReasons, "/payload/boundaryDriftReasons", errors);
  const checks = value.payload.checkResults;
  if (!Array.isArray(checks) || checks.length === 0) errors.push("/payload/checkResults: expected non-empty array");
  const ids = [];
  if (Array.isArray(checks)) checks.forEach((item, index) => { const at = `/payload/checkResults/${index}`; if (!exact(item, checkKeys, at, errors)) return; text(item.checkId, `${at}/checkId`, errors); if (!["gate", "browser"].includes(item.kind)) errors.push(`${at}/kind: expected gate or browser`); if (!["pass", "fail", "blocked"].includes(item.status)) errors.push(`${at}/status: expected pass, fail or blocked`); strings(item.evidenceRefs, `${at}/evidenceRefs`, errors, 1); if (typeof item.checkId === "string") ids.push(item.checkId); });
  if (new Set(ids).size !== ids.length) errors.push("/payload/checkResults: checkId values must be unique");
  if (failed.some((id) => !ids.includes(id))) errors.push("/payload/failedCheckIds: every failed ID must name a check result");
  const failedByResult = Array.isArray(checks) ? checks.filter((item) => object(item) && item.status !== "pass").map((item) => item.checkId).sort() : [];
  if ([...failed].sort().join("\n") !== failedByResult.join("\n")) errors.push("/payload/failedCheckIds: must exactly match non-pass check results");
  if (value.status === "complete") {
    if (!facts.includes("proof-pass") || value.payload.result !== "pass" || value.payload.repairClass !== "none" || value.payload.approvalRequired !== "none" || failed.length || drifts.length) errors.push("/payload: complete route has inconsistent proof semantics");
  } else if (value.status === "repair") {
    if (!facts.includes("in-boundary-repair") || value.payload.result !== "repair" || value.payload.repairClass !== "in-boundary" || value.payload.approvalRequired !== "none" || failed.length === 0 || drifts.length) errors.push("/payload: repair route must be in-boundary with failed checks and no approval");
  } else if (value.status === "rejected") {
    if (!facts.includes("boundary-drift") || !facts.includes("layout-feedback-recorded") || value.payload.result !== "boundary-drift" || value.payload.repairClass !== "boundary-drift" || value.payload.approvalRequired !== "layout" || failed.length === 0 || drifts.length === 0) errors.push("/payload: boundary drift must return through layout regeneration to the existing approval");
  } else if (!facts.includes("proof-blocked") || value.payload.result !== "blocked" || value.payload.repairClass !== "none" || value.payload.approvalRequired !== "none" || failed.length === 0) errors.push("/payload: blocked route has inconsistent proof semantics");
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-output.mjs <output.json>"); const result = validateOutput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
