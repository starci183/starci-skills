#!/usr/bin/env node

import {existsSync, readFileSync, readdirSync, statSync} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestsRoot = join(trustRoot, "requests");
const statusValues = new Set(["open", "in-progress", "blocked", "resolved", "superseded"]);
const kindValues = new Set(["ui", "user-flow"]);
const evidenceKinds = new Set(["screenshot", "conversation", "route", "runtime", "code", "other"]);
const authorityValues = new Set(["pending", "grammar", "principle", "both"]);
const implementationValues = new Set(["pending", "planned", "applied"]);
const proofValues = new Set(["pending", "passed", "failed", "blocked"]);
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const date = /^\d{4}-\d{2}-\d{2}$/;

function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["must be an object"];
  const allowed = new Set([...required, ...optional]);
  return [
    ...required.filter((key) => !(key in value)).map((key) => `missing ${key}`),
    ...Object.keys(value).filter((key) => !allowed.has(key)).map((key) => `unknown ${key}`),
  ];
}

function strings(value, {min = 0, unique = false} = {}) {
  if (!Array.isArray(value)) return false;
  if (value.length < min || value.some((item) => typeof item !== "string" || item.length === 0)) return false;
  return !unique || new Set(value).size === value.length;
}

export function validateRejectsTable(value, knownRequestIds = new Set()) {
  const failures = exactKeys(value, ["schemaVersion", "rejects"]);
  if (value?.schemaVersion !== 1) failures.push("rejects schemaVersion must be 1");
  if (!Array.isArray(value?.rejects)) return [...failures, "rejects must be an array"];
  const ids = new Set();
  value.rejects.forEach((item, index) => {
    exactKeys(item, ["id", "requestId", "rejectedOn", "reason", "sourcePaths", "evidence"]).forEach((x) => failures.push(`rejects[${index}] ${x}`));
    if (!slug.test(item?.id ?? "") || ids.has(item.id)) failures.push(`rejects[${index}] id is invalid or duplicate`);
    ids.add(item?.id);
    if (!slug.test(item?.requestId ?? "") || (knownRequestIds.size && !knownRequestIds.has(item.requestId))) failures.push(`rejects[${index}] requestId is invalid or missing`);
    if (!date.test(item?.rejectedOn ?? "")) failures.push(`rejects[${index}] rejectedOn is invalid`);
    if (typeof item?.reason !== "string" || item.reason.length < 8) failures.push(`rejects[${index}] reason is too short`);
    if (!strings(item?.sourcePaths, {min: 1, unique: true}) || !strings(item?.evidence, {min: 1, unique: true})) failures.push(`rejects[${index}] sourcePaths/evidence are invalid`);
  });
  return failures;
}

export function validateRejectLinks(requests, table) {
  const failures = [];
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  const rejectIds = new Set(table.rejects.map((reject) => reject.id));
  for (const request of requests) {
    for (const ref of request.implementation.rejectRefs) {
      if (!rejectIds.has(ref)) failures.push(`${request.id}: missing reject ref ${ref}`);
    }
  }
  for (const reject of table.rejects) {
    const request = requestsById.get(reject.requestId);
    if (request && !request.implementation.rejectRefs.includes(reject.id)) failures.push(`${reject.id}: owning request ${reject.requestId} is missing the reject ref`);
  }
  return failures;
}

export function validateDesignRequest(value, file = "request.json") {
  const failures = exactKeys(
    value,
    ["schemaVersion", "id", "status", "createdOn", "updatedOn", "project", "role", "scope", "feedback", "authority", "implementation", "proof"],
    ["resolution"],
  );
  if (value?.schemaVersion !== 1) failures.push("schemaVersion must be 1");
  if (!slug.test(value?.id ?? "")) failures.push("id must be a lowercase slug");
  if (basename(file) !== `${value?.id}.request.json`) failures.push("filename must match id");
  if (!statusValues.has(value?.status)) failures.push("status is invalid");
  if (!date.test(value?.createdOn ?? "") || !date.test(value?.updatedOn ?? "")) failures.push("createdOn and updatedOn must be ISO dates");
  if ((value?.updatedOn ?? "") < (value?.createdOn ?? "")) failures.push("updatedOn precedes createdOn");
  if (!slug.test(value?.project ?? "")) failures.push("project must be a lowercase slug");
  if (value?.role !== "fe") failures.push("role must be fe");

  failures.push(...exactKeys(value?.scope, ["kinds", "feature", "surfaces"], ["sourceBoundary"]).map((x) => `scope ${x}`));
  if (!Array.isArray(value?.scope?.kinds) || value.scope.kinds.length === 0 || value.scope.kinds.some((x) => !kindValues.has(x)) || new Set(value.scope.kinds).size !== value.scope.kinds.length) failures.push("scope kinds are invalid");
  if (typeof value?.scope?.feature !== "string" || value.scope.feature.length < 3) failures.push("scope feature is too short");
  if (!strings(value?.scope?.surfaces, {min: 1, unique: true})) failures.push("scope surfaces are invalid");
  if (value?.scope?.sourceBoundary !== undefined && !strings(value.scope.sourceBoundary, {unique: true})) failures.push("scope sourceBoundary is invalid");

  failures.push(...exactKeys(value?.feedback, ["summary", "expectedOutcome", "evidence"]).map((x) => `feedback ${x}`));
  if (typeof value?.feedback?.summary !== "string" || value.feedback.summary.length < 8) failures.push("feedback summary is too short");
  if (typeof value?.feedback?.expectedOutcome !== "string" || value.feedback.expectedOutcome.length < 8) failures.push("feedback expectedOutcome is too short");
  if (!Array.isArray(value?.feedback?.evidence) || value.feedback.evidence.length === 0) failures.push("feedback evidence is required");
  else value.feedback.evidence.forEach((item, index) => {
    exactKeys(item, ["kind", "ref"]).forEach((x) => failures.push(`feedback evidence[${index}] ${x}`));
    if (!evidenceKinds.has(item?.kind) || typeof item?.ref !== "string" || item.ref.length === 0) failures.push(`feedback evidence[${index}] is invalid`);
  });

  failures.push(...exactKeys(value?.authority, ["disposition", "grammarTargets", "principleTargets", "evidence"]).map((x) => `authority ${x}`));
  const disposition = value?.authority?.disposition;
  if (!authorityValues.has(disposition)) failures.push("authority disposition is invalid");
  if (!strings(value?.authority?.grammarTargets, {unique: true}) || !strings(value?.authority?.principleTargets, {unique: true}) || !strings(value?.authority?.evidence, {unique: true})) failures.push("authority arrays are invalid");
  if (["grammar", "both"].includes(disposition) && value.authority.grammarTargets.length === 0) failures.push("grammar disposition requires grammarTargets");
  if (["principle", "both"].includes(disposition) && value.authority.principleTargets.length === 0) failures.push("principle disposition requires principleTargets");
  if (disposition === "pending" && (value.authority.grammarTargets.length || value.authority.principleTargets.length)) failures.push("pending authority cannot claim targets");

  failures.push(...exactKeys(value?.implementation, ["status", "paths", "rejectRefs"]).map((x) => `implementation ${x}`));
  if (!implementationValues.has(value?.implementation?.status) || !strings(value?.implementation?.paths, {unique: true}) || !strings(value?.implementation?.rejectRefs, {unique: true}) || value?.implementation?.rejectRefs?.some((id) => !slug.test(id))) failures.push("implementation is invalid");
  failures.push(...exactKeys(value?.proof, ["status", "evidence"]).map((x) => `proof ${x}`));
  if (!proofValues.has(value?.proof?.status) || !strings(value?.proof?.evidence, {unique: true})) failures.push("proof is invalid");

  if (value?.status === "open" && (disposition !== "pending" || value?.implementation?.status !== "applied" || !strings(value?.implementation?.paths, {min: 1, unique: true}) || value?.proof?.status !== "passed" || !strings(value?.proof?.evidence, {min: 1, unique: true}))) {
    failures.push("open request requires pending authority, source-first applied implementation and passing proof");
  }

  if (value?.status === "resolved") {
    failures.push(...exactKeys(value?.resolution, ["verdict", "summary", "authorityChanged", "sourceChanged", "proofRefs"]).map((x) => `resolution ${x}`));
    if (value?.resolution?.verdict !== "applied") failures.push("resolved request verdict must be applied");
    if (typeof value?.resolution?.summary !== "string" || value.resolution.summary.length < 8) failures.push("resolution summary is too short");
    if (disposition === "pending") failures.push("resolved request requires authority disposition");
    if (value?.implementation?.status !== "applied" || !strings(value?.implementation?.paths, {min: 1, unique: true})) failures.push("resolved request requires applied implementation paths");
    if (value?.proof?.status !== "passed" || !strings(value?.proof?.evidence, {min: 1, unique: true})) failures.push("resolved request requires passing proof");
    if (!strings(value?.resolution?.authorityChanged, {min: 1, unique: true}) || !strings(value?.resolution?.sourceChanged, {min: 1, unique: true}) || !strings(value?.resolution?.proofRefs, {min: 1, unique: true})) failures.push("resolved request requires authority, source and proof references");
  }
  return failures;
}

function requestFiles(target) {
  const absolute = resolve(target);
  if (!existsSync(absolute)) throw new Error(`target does not exist: ${target}`);
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute, {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith(".request.json"))
    .map((entry) => join(absolute, entry.name))
    .sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--file");
  const targets = process.argv.includes("--all") ? [requestsRoot] : index >= 0 && process.argv[index + 1] ? [process.argv[index + 1]] : [];
  if (!targets.length) {
    console.error("Usage: node scripts/validate-design-request.mjs (--all|--file <request.json>)");
    process.exit(2);
  }
  const failures = [];
  const parsedRequests = [];
  for (const target of targets) {
    for (const file of requestFiles(target)) {
      try {
        const value = JSON.parse(readFileSync(file, "utf8"));
        parsedRequests.push(value);
        validateDesignRequest(value, file).forEach((failure) => failures.push(`${file}: ${failure}`));
      } catch (error) {
        failures.push(`${file}: ${error.message}`);
      }
    }
  }
  if (process.argv.includes("--all")) {
    const rejectsFile = join(requestsRoot, "rejects.json");
    try {
      const table = JSON.parse(readFileSync(rejectsFile, "utf8"));
      const requestIds = new Set(parsedRequests.map((request) => request.id));
      validateRejectsTable(table, requestIds).forEach((failure) => failures.push(`${rejectsFile}: ${failure}`));
      validateRejectLinks(parsedRequests, table).forEach((failure) => failures.push(failure));
    } catch (error) {
      failures.push(`${rejectsFile}: ${error.message}`);
    }
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }
  console.log(`validated ${targets.flatMap(requestFiles).length} design request(s) and rejects table`);
}
