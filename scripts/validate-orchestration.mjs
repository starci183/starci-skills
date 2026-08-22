import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";

const requiredDecisions = [
  "journey-decision", "ui-direction", "state-ownership", "approval",
  "claude-authority", "shared-integration", "final-verdict"
];

const exactRuntimes = {
  codex: {coordinatorModel: "gpt-5.6-sol", workerModel: "gpt-5.6-luna"},
  claude: {coordinatorModel: "opus", workerModel: "sonnet"}
};

const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value;

export const canonicalHash = (value) => crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");

export function validateProfiles(value) {
  const failures = [];
  if (value?.schemaVersion !== 1) failures.push("profiles.schemaVersion must equal 1");
  if (value?.common?.maxConcurrentWorkers !== 3) failures.push("maxConcurrentWorkers must equal 3");
  if (value?.common?.oneWriterPerPath !== true) failures.push("oneWriterPerPath must be true");
  if (value?.common?.workersMaySpawn !== false) failures.push("workersMaySpawn must be false");
  for (const decision of requiredDecisions) {
    if (!value?.common?.coordinatorOwns?.includes(decision)) failures.push(`coordinatorOwns is missing ${decision}`);
  }
  for (const capability of ["cache-html", "approved-disjoint-code", "tests", "browser-capture"]) {
    if (!value?.common?.workerDefaults?.includes(capability)) failures.push(`workerDefaults is missing ${capability}`);
  }
  for (const [runtime, expected] of Object.entries(exactRuntimes)) {
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (value?.runtimes?.[runtime]?.[key] !== expectedValue) failures.push(`${runtime}.${key} must equal ${expectedValue}`);
    }
  }
  for (const skill of value?.boundSkills ?? []) {
    const steps = value?.stepMaps?.[skill];
    if (!Array.isArray(steps) || steps.length < 2 || steps[1] !== "orchestration") failures.push(`${skill} must declare orchestration as its second step`);
  }
  return {ok: failures.length === 0, failures};
}

export function validateReceipt(receipt, profiles) {
  const failures = [];
  const runtimeProfile = profiles?.runtimes?.[receipt?.runtime];
  if (receipt?.runtime !== "sequential" && !runtimeProfile) failures.push(`unknown runtime ${receipt?.runtime}`);
  if (!profiles?.boundSkills?.includes(receipt?.skill)) failures.push(`unbound skill ${receipt?.skill}`);
  if (receipt?.runtime !== "sequential" && receipt?.coordinator?.model !== runtimeProfile?.coordinatorModel) failures.push("coordinator model does not match runtime profile");
  for (const decision of requiredDecisions) {
    if (!receipt?.coordinator?.owns?.includes(decision)) failures.push(`coordinator receipt is missing ${decision}`);
  }
  const ids = new Set();
  const writers = new Map();
  const sourceTaskIds = [];
  const normalizePath = (value) => {
    const raw = String(value);
    const windowsPath = /^[A-Za-z]:[\\/]/.test(raw);
    const normalized = windowsPath
      ? path.win32.normalize(raw).replaceAll("\\", "/")
      : path.posix.normalize(raw.replaceAll("\\", "/"));
    const trimmed = normalized.replace(/\/$/, "");
    return (process.platform === "win32" || windowsPath) ? trimmed.toLowerCase() : trimmed;
  };
  const gateEvents = new Map();
  for (const event of receipt?.gateEvents ?? []) {
    if (gateEvents.has(event.id)) failures.push(`duplicate gate event ${event.id}`);
    gateEvents.set(event.id, event);
    if (event.status !== "passed") failures.push(`gate event ${event.id} has not passed`);
  }
  for (const event of receipt?.gateEvents ?? []) for (const dependency of event.dependsOn ?? []) {
    if (!gateEvents.has(dependency)) failures.push(`gate event ${event.id} depends on unknown gate ${dependency}`);
  }
  const visitingGates = new Set();
  const visitedGates = new Set();
  const visitGate = (id) => {
    if (visitingGates.has(id)) { failures.push(`gate dependency cycle includes ${id}`); return; }
    if (visitedGates.has(id) || !gateEvents.has(id)) return;
    visitingGates.add(id);
    for (const dependency of gateEvents.get(id).dependsOn ?? []) visitGate(dependency);
    visitingGates.delete(id);
    visitedGates.add(id);
  };
  for (const id of gateEvents.keys()) visitGate(id);
  const pathOverlaps = (left, right) => {
    const a = normalizePath(left);
    const b = normalizePath(right);
    return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
  };
  const insideAnyRoot = (target, roots) => (roots ?? []).some((root) => {
    const normalizedTarget = normalizePath(target);
    const normalizedRoot = normalizePath(root);
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
  });
  for (const task of receipt?.tasks ?? []) {
    if (ids.has(task.id)) failures.push(`duplicate task id ${task.id}`);
    ids.add(task.id);
    if (task.skill !== receipt.skill) failures.push(`${task.id} skill does not match the receipt`);
    if (task.envelopeAt !== receipt.envelopeAt) failures.push(`${task.id} envelope is stale or mismatched`);
    if (!profiles?.stepMaps?.[receipt.skill]?.includes(task.step)) failures.push(`${task.id} uses invalid step ${task.step} for ${receipt.skill}`);
    if (!task.objective || !task.requiredInputs?.length || !task.requiredProof?.length) failures.push(`${task.id} has an incomplete dispatch contract`);
    for (const gateId of task.dependsOnGates ?? []) if (!gateEvents.has(gateId)) failures.push(`${task.id} depends on unknown gate ${gateId}`);
    if (receipt.runtime !== "sequential" && task.model !== runtimeProfile?.workerModel) failures.push(`${task.id} uses a non-worker model`);
    for (const decision of requiredDecisions) {
      if (!task?.forbiddenDecisions?.includes(decision)) failures.push(`${task.id} may accidentally own ${decision}`);
    }
    const hasPassedGate = (kind, at) => (task.dependsOnGates ?? []).some((gateId) => {
      const gate = gateEvents.get(gateId);
      return gate?.kind === kind && gate?.at === at && gate?.status === "passed";
    });
    if (task.kind === "cache-write" && (!task.frozenContractAt || task.frozenContractAt !== receipt?.phaseGates?.frozenContractAt || !hasPassedGate("contract-freeze", task.frozenContractAt))) failures.push(`${task.id} writes cache HTML without the passed coordinator freeze gate`);
    if (task.kind === "read" && task.writes?.length) failures.push(`${task.id} is read-only but declares writes`);
    if (task.kind === "cache-write" && (!(task.writes?.length) || task.writes.some((target) => !insideAnyRoot(target, receipt?.phaseGates?.cacheRoots)))) failures.push(`${task.id} writes outside declared cacheRoots`);
    if (task.kind === "source-write") {
      sourceTaskIds.push(task.id);
      const boundaryAt = receipt?.phaseGates?.sourceBoundaryAt;
      const expectedApproval = boundaryAt ? `OK #2:${boundaryAt}` : undefined;
      if (!task.sourceApprovalAt || task.sourceApprovalAt !== receipt?.phaseGates?.sourceApprovalAt || task.sourceApprovalAt !== expectedApproval || !hasPassedGate("source-approval", task.sourceApprovalAt)) failures.push(`${task.id} writes source without passed OK #2 bound to the approved boundary`);
      if (!hasPassedGate("impact-cone", receipt?.phaseGates?.impactConeAt)) failures.push(`${task.id} writes source without the passed impact-cone gate`);
      if (receipt.skill === "starci-fe-layout-refactor" && receipt?.phaseGates?.authorityMode === "evolve" && (!task.authorityProofAt || task.authorityProofAt !== receipt?.phaseGates?.authorityProofAt || !hasPassedGate("authority-proof", task.authorityProofAt))) failures.push(`${task.id} writes FE before passed compiled authority proof`);
    }
    if (task.kind === "proof" && (!task.stableBuildAt || task.stableBuildAt !== receipt?.phaseGates?.stableBuildAt || !task.proofTargetsAt || task.proofTargetsAt !== receipt?.phaseGates?.proofTargetsAt || !hasPassedGate("stable-build", task.stableBuildAt) || !hasPassedGate("proof-targets", task.proofTargetsAt))) failures.push(`${task.id} proves without passed stable-build and proof-target gates`);
    if (task.kind === "proof" && (!(task.writes?.length) || task.writes.some((target) => !insideAnyRoot(target, receipt?.phaseGates?.proofRoots)))) failures.push(`${task.id} writes outside declared proofRoots`);
    for (const target of task.writes ?? []) {
      const overlap = [...writers.entries()].find(([written]) => pathOverlaps(written, target));
      if (overlap) failures.push(`${target} overlaps writer path ${overlap[0]} owned by ${overlap[1]} and ${task.id}`);
      else writers.set(target, task.id);
      const shared = (receipt?.sharedPaths ?? []).find((reserved) => pathOverlaps(reserved, target));
      if (shared) failures.push(`${task.id} writes coordinator-only shared path ${shared}`);
    }
  }
  if (sourceTaskIds.length) {
    const approved = new Set((receipt?.phaseGates?.approvedSourcePaths ?? []).map(normalizePath));
    const assigned = new Set((receipt.tasks ?? []).filter((task) => task.kind === "source-write").flatMap((task) => task.writes ?? []).map(normalizePath));
    for (const target of assigned) if (!approved.has(target)) failures.push(`${target} is outside approvedSourcePaths`);
    for (const target of approved) if (!assigned.has(target)) failures.push(`${target} has no source writer`);
    const impactCone = receipt?.phaseGates?.impactCone;
    if (!impactCone || receipt?.phaseGates?.impactConeAt !== canonicalHash(impactCone)) failures.push("source dispatch has a missing or stale impact-cone manifest");
    if (impactCone) {
      const required = new Set((impactCone.requiredPaths ?? []).map(normalizePath));
      const inventoryPaths = [...(impactCone.owners ?? []).map((owner) => owner.path), ...(impactCone.consumers ?? []), ...(impactCone.tests ?? [])].map(normalizePath);
      if (required.size !== (impactCone.requiredPaths ?? []).length) failures.push("impactCone.requiredPaths contains canonical duplicates");
      for (const target of inventoryPaths) if (!required.has(target)) failures.push(`${target} is inventoried but absent from impactCone.requiredPaths`);
      if ([...required].some((target) => !approved.has(target)) || [...approved].some((target) => !required.has(target))) failures.push("approvedSourcePaths do not equal impactCone.requiredPaths");
      if (!(impactCone.inventoryProof?.length)) failures.push("impact cone has no inventory proof");
    }
  }
  const taskByIdForResults = new Map((receipt?.tasks ?? []).map((task) => [task.id, task]));
  const resultIds = new Set();
  for (const result of receipt?.results ?? []) {
    if (!taskByIdForResults.has(result.taskId)) failures.push(`result references unknown task ${result.taskId}`);
    if (resultIds.has(result.taskId)) failures.push(`duplicate result for ${result.taskId}`);
    resultIds.add(result.taskId);
    const task = taskByIdForResults.get(result.taskId);
    const assignedResultPaths = new Set((task?.writes ?? []).map(normalizePath));
    for (const changed of result.changedPaths ?? []) if (!assignedResultPaths.has(normalizePath(changed))) failures.push(`${result.taskId} reports changed path outside its exact assignment: ${changed}`);
    if (!result.inputHashes?.includes(receipt.envelopeAt)) failures.push(`${result.taskId} result is not bound to the receipt envelope`);
    if (result.status === "passed") {
      const declared = new Set((task?.writes ?? []).map(normalizePath));
      const observed = new Set((result.changedPaths ?? []).map(normalizePath));
      for (const target of declared) if (!observed.has(target)) failures.push(`${result.taskId} passed without reporting assigned output ${target}`);
    }
    if (result.boundaryDrift === true) failures.push(`${result.taskId} reports boundary drift`);
    if (result.status === "passed" && (result.unresolvedFindings?.length ?? 0) > 0) failures.push(`${result.taskId} passed with unresolved findings`);
  }
  if (receipt?.status === "complete") {
    for (const id of ids) if (!resultIds.has(id)) failures.push(`complete receipt is missing result for ${id}`);
    for (const result of receipt.results ?? []) if (result.status !== "passed") failures.push(`complete receipt contains non-passing result ${result.taskId}`);
  }
  for (const task of receipt?.tasks ?? []) {
    for (const dependency of task.dependsOn ?? []) if (!ids.has(dependency)) failures.push(`${task.id} depends on unknown task ${dependency}`);
  }
  const batchOf = new Map();
  for (const [batchIndex, batch] of (receipt?.batches ?? []).entries()) {
    if (batch.length > profiles.common.maxConcurrentWorkers) failures.push("a batch exceeds maxConcurrentWorkers");
    for (const id of batch) {
      if (!ids.has(id)) failures.push(`batch references unknown task ${id}`);
      if (batchOf.has(id)) failures.push(`${id} appears in multiple batches`);
      else batchOf.set(id, batchIndex);
    }
  }
  for (const id of ids) if (!batchOf.has(id)) failures.push(`${id} is omitted from execution batches`);
  for (const task of receipt?.tasks ?? []) for (const dependency of task.dependsOn ?? []) {
    if (batchOf.has(task.id) && batchOf.has(dependency) && batchOf.get(dependency) >= batchOf.get(task.id)) failures.push(`${task.id} is batched before dependency ${dependency}`);
  }
  for (const task of receipt?.tasks ?? []) if (task.kind === "proof") {
    for (const sourceId of sourceTaskIds) if (!task.dependsOn?.includes(sourceId)) failures.push(`${task.id} does not depend on source task ${sourceId}`);
  }
  const visiting = new Set();
  const visited = new Set();
  const tasksById = new Map((receipt?.tasks ?? []).map((task) => [task.id, task]));
  const visit = (id) => {
    if (visiting.has(id)) { failures.push(`dependency cycle includes ${id}`); return; }
    if (visited.has(id) || !tasksById.has(id)) return;
    visiting.add(id);
    for (const dependency of tasksById.get(id).dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  const fallbackOrder = receipt?.sequentialFallback?.order ?? [];
  const fallbackAt = new Map(fallbackOrder.map((id, index) => [id, index]));
  for (const id of ids) if (!fallbackAt.has(id)) failures.push(`${id} is omitted from sequential fallback`);
  for (const id of fallbackOrder) if (!ids.has(id)) failures.push(`sequential fallback references unknown task ${id}`);
  for (const task of receipt?.tasks ?? []) for (const dependency of task.dependsOn ?? []) {
    if (fallbackAt.has(task.id) && fallbackAt.has(dependency) && fallbackAt.get(dependency) >= fallbackAt.get(task.id)) failures.push(`sequential fallback orders ${task.id} before ${dependency}`);
  }
  if (receipt?.sequentialFallback?.owner !== "coordinator" || receipt?.sequentialFallback?.preservesDependencies !== true || receipt?.sequentialFallback?.preservesWriterRegistry !== true) failures.push("sequential fallback does not preserve coordinator authority, dependencies and writer registry");
  return {ok: failures.length === 0, failures};
}

export function validateWorkspace(root) {
  const failures = [];
  const profilesPath = path.join(root, "orchestration", "profiles.json");
  const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
  failures.push(...validateProfiles(profiles).failures);
  const rootAuthority = fs.readFileSync(path.join(root, "orchestration", "en.md"), "utf8");
  for (const load of ["orchestration/codex/en.md", "orchestration/claude/en.md", "orchestration/frontend/en.md", "orchestration/receipt.schema.json"]) {
    if (!rootAuthority.includes(load)) failures.push(`orchestration/en.md does not load ${load}`);
  }
  const frontendMap = fs.readFileSync(path.join(root, "orchestration", "frontend", "en.md"), "utf8");
  for (const skill of profiles.boundSkills) {
    const skillPath = path.join(root, "skills", skill, "SKILL.md");
    const source = fs.readFileSync(skillPath, "utf8");
    if (!source.includes("`@orchestration` | `orchestration/context.md`")) failures.push(`${skill} does not load @orchestration`);
    let cursor = -1;
    for (const step of profiles.stepMaps[skill]) {
      const next = source.indexOf(`| ${step} |`, cursor + 1);
      if (next < 0) failures.push(`${skill} is missing ordered pipeline step ${step}`);
      else cursor = next;
    }
    if (!frontendMap.includes(`## ${skill === "starci-fe-design-layout" ? "Layout" : skill === "starci-fe-design-block" ? "Block" : "Refactor"} map`)) failures.push(`frontend map is missing ${skill}`);
  }
  return {ok: failures.length === 0, failures};
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const rootArg = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const verdict = validateWorkspace(rootArg);
  if (!verdict.ok) {
    for (const failure of verdict.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else console.log("orchestration: valid");
}
