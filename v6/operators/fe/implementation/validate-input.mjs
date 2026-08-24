import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["approvedLayoutRef", "approvedLayoutHash", "exactSourceBoundary", "sourceFitRef", "implementationPlanRef", "effectiveContractRefs", "permittedLowerTierExtensions", "requestPaths", "repairEvidenceRefs"];
const extensionKeys = ["path", "tier", "extensionAxis", "effectiveContractRef", "requestPath"];
const requestPattern = /^\.claude\/requests\/[a-z0-9]+(?:-[a-z0-9]+)*\.request\.json$/;
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors, min = 0) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`); value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateInput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.implementation.input") errors.push("/kind: expected fe.implementation.input");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  const route = `${value.stage}/${value.status}`;
  if (!["requests.review/ready", "request.result/ready", "code.repair/repair"].includes(route)) errors.push("/stage: stage and status do not form an accepted route");
  const facts = strings(value.facts, "/facts", errors);
  if (facts.includes("grammar-gap")) errors.push("/facts: Grammar gap blocks implementation");
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  for (const key of ["approvedLayoutRef", "approvedLayoutHash", "sourceFitRef", "implementationPlanRef"]) text(value.payload[key], `/payload/${key}`, errors);
  const boundary = strings(value.payload.exactSourceBoundary, "/payload/exactSourceBoundary", errors, 1);
  const contractRefs = strings(value.payload.effectiveContractRefs, "/payload/effectiveContractRefs", errors);
  const requestPaths = strings(value.payload.requestPaths, "/payload/requestPaths", errors);
  requestPaths.forEach((item, index) => { if (!requestPattern.test(item)) errors.push(`/payload/requestPaths/${index}: invalid request path`); });
  const repairs = strings(value.payload.repairEvidenceRefs, "/payload/repairEvidenceRefs", errors);
  const extensions = value.payload.permittedLowerTierExtensions;
  if (!Array.isArray(extensions)) errors.push("/payload/permittedLowerTierExtensions: expected array");
  const extensionPaths = [];
  if (Array.isArray(extensions)) extensions.forEach((item, index) => {
    const at = `/payload/permittedLowerTierExtensions/${index}`;
    if (!exact(item, extensionKeys, at, errors)) return;
    text(item.path, `${at}/path`, errors); text(item.extensionAxis, `${at}/extensionAxis`, errors); text(item.effectiveContractRef, `${at}/effectiveContractRef`, errors);
    if (!["composite", "branch", "leaf"].includes(item.tier)) errors.push(`${at}/tier: expected composite, branch or leaf`);
    if (typeof item.requestPath !== "string" || !requestPattern.test(item.requestPath)) errors.push(`${at}/requestPath: invalid request path`);
    if (!boundary.includes(item.path)) errors.push(`${at}/path: extension path must be in exactSourceBoundary`);
    if (!contractRefs.includes(item.effectiveContractRef)) errors.push(`${at}/effectiveContractRef: contract must be declared by the input`);
    if (!requestPaths.includes(item.requestPath)) errors.push(`${at}/requestPath: request must be declared by the input`);
    extensionPaths.push(item.path);
  });
  if (new Set(extensionPaths).size !== extensionPaths.length) errors.push("/payload/permittedLowerTierExtensions: duplicate paths are forbidden");
  if (value.stage === "requests.review") {
    if (facts.includes("create-required") || facts.includes("grammar-gap")) errors.push("/facts: direct route requires no creation or Grammar gap");
    if (requestPaths.length) errors.push("/payload/requestPaths: direct route must not claim emitted requests");
  }
  if (value.stage === "request.result") {
    if (!facts.includes("create-required") || !facts.includes("requests-emitted")) errors.push("/facts: request result requires create-required and requests-emitted");
    if (requestPaths.length === 0) errors.push("/payload/requestPaths: emitted request route requires request paths");
  }
  if (value.stage === "code.repair") {
    if (!facts.includes("in-boundary-repair") || facts.includes("boundary-drift")) errors.push("/facts: repair route must be in-boundary and not boundary drift");
    if (repairs.length === 0) errors.push("/payload/repairEvidenceRefs: repair route requires failed proof evidence");
  } else if (repairs.length) errors.push("/payload/repairEvidenceRefs: initial implementation cannot carry repair evidence");
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-input.mjs <input.json>"); const result = validateInput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
