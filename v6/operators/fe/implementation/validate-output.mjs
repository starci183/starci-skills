import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const topKeys = ["kind", "schemaVersion", "appId", "runId", "stage", "status", "facts", "payload"];
const payloadKeys = ["changeSetRef", "changeSetHash", "changedFiles", "consumedContractRefs", "usedLowerTierExtensions", "staticChecks", "stopReasons"];
const extensionKeys = ["path", "tier", "extensionAxis", "effectiveContractRef", "requestPath"];
const checkKeys = ["name", "commandRef", "status", "evidenceRef"];
const requestPattern = /^\.claude\/requests\/[a-z0-9]+(?:-[a-z0-9]+)*\.request\.json$/;
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value, keys, at, errors) { if (!object(value)) { errors.push(`${at}: expected object`); return false; } for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`); for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`); return true; }
function text(value, at, errors) { if (typeof value !== "string" || value.length === 0) errors.push(`${at}: expected non-empty string`); }
function strings(value, at, errors, min = 0) { if (!Array.isArray(value)) { errors.push(`${at}: expected array`); return []; } if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`); value.forEach((item, index) => text(item, `${at}/${index}`, errors)); if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`); return value; }

export function validateOutput(value) {
  const errors = [];
  if (!exact(value, topKeys, "", errors)) return { valid: false, errors };
  if (value.kind !== "fe.implementation.output") errors.push("/kind: expected fe.implementation.output");
  if (value.schemaVersion !== 6) errors.push("/schemaVersion: expected 6");
  if (value.appId !== "fe-design-layout") errors.push("/appId: expected fe-design-layout");
  text(value.runId, "/runId", errors);
  const route = `${value.stage}/${value.status}`;
  if (!["seed.materialize/ready", "code.result/blocked"].includes(route)) errors.push("/stage: stage and status do not form a declared emission");
  const facts = strings(value.facts, "/facts", errors);
  if (!exact(value.payload, payloadKeys, "/payload", errors)) return { valid: false, errors };
  text(value.payload.changeSetRef, "/payload/changeSetRef", errors); text(value.payload.changeSetHash, "/payload/changeSetHash", errors);
  const files = strings(value.payload.changedFiles, "/payload/changedFiles", errors);
  strings(value.payload.consumedContractRefs, "/payload/consumedContractRefs", errors);
  const stops = strings(value.payload.stopReasons, "/payload/stopReasons", errors);
  const extensions = value.payload.usedLowerTierExtensions;
  if (!Array.isArray(extensions)) errors.push("/payload/usedLowerTierExtensions: expected array");
  if (Array.isArray(extensions)) extensions.forEach((item, index) => { const at = `/payload/usedLowerTierExtensions/${index}`; if (!exact(item, extensionKeys, at, errors)) return; text(item.path, `${at}/path`, errors); text(item.extensionAxis, `${at}/extensionAxis`, errors); text(item.effectiveContractRef, `${at}/effectiveContractRef`, errors); if (!["composite", "branch", "leaf"].includes(item.tier)) errors.push(`${at}/tier: unsupported tier`); if (typeof item.requestPath !== "string" || !requestPattern.test(item.requestPath)) errors.push(`${at}/requestPath: invalid request path`); });
  const checks = value.payload.staticChecks;
  if (!Array.isArray(checks)) errors.push("/payload/staticChecks: expected array");
  if (Array.isArray(checks)) checks.forEach((item, index) => { const at = `/payload/staticChecks/${index}`; if (!exact(item, checkKeys, at, errors)) return; text(item.name, `${at}/name`, errors); text(item.commandRef, `${at}/commandRef`, errors); text(item.evidenceRef, `${at}/evidenceRef`, errors); if (!["pass", "fail"].includes(item.status)) errors.push(`${at}/status: expected pass or fail`); });
  if (value.status === "ready") {
    if (!facts.includes("source-written")) errors.push("/facts: ready output requires source-written");
    if (files.length === 0 || stops.length) errors.push("/payload: ready output requires changed files and no stop reasons");
    if (Array.isArray(checks) && checks.some((item) => object(item) && item.status !== "pass")) errors.push("/payload/staticChecks: ready output requires every check to pass");
  } else {
    if (!facts.includes("implementation-blocked")) errors.push("/facts: blocked output requires implementation-blocked");
    if (stops.length === 0) errors.push("/payload/stopReasons: blocked output requires a reason");
  }
  return { valid: errors.length === 0, errors };
}

async function cli() { const file = process.argv[2]; if (!file) throw new Error("usage: node validate-output.mjs <output.json>"); const result = validateOutput(JSON.parse(await readFile(path.resolve(file), "utf8"))); if (!result.valid) { console.error(result.errors.join("\n")); process.exitCode = 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
