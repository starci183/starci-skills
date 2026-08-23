import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";

const requiredDecisions = [
  "scope-decision", "authority-decision", "approval", "shared-integration", "final-verdict"
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
  if (value?.schemaVersion !== 3) failures.push("profiles.schemaVersion must equal 3");
  if (value?.common?.workerLimitKind !== "runtime-capacity" || value?.common?.scheduler !== "ready-disjoint-overhead-positive") failures.push("worker limit must be runtime capacity and scheduling must be overhead-positive");
  if (value?.common?.maxConcurrentWorkers !== 3) failures.push("maxConcurrentWorkers must equal 3");
  if (value?.common?.oneWriterPerTarget !== true) failures.push("oneWriterPerTarget must be true");
  if (value?.common?.workersMaySpawn !== false) failures.push("workersMaySpawn must be false");
  for (const decision of requiredDecisions) {
    if (!value?.common?.coordinatorOwns?.includes(decision)) failures.push(`coordinatorOwns is missing ${decision}`);
  }
  for (const capability of ["evidence-inventory", "bounded-materialization", "approved-disjoint-repository-write", "tests", "proof-capture"]) {
    if (!value?.common?.workerDefaults?.includes(capability)) failures.push(`workerDefaults is missing ${capability}`);
  }
  for (const [runtime, expected] of Object.entries(exactRuntimes)) {
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (value?.runtimes?.[runtime]?.[key] !== expectedValue) failures.push(`${runtime}.${key} must equal ${expectedValue}`);
    }
  }
  const allowedTopologies = new Set(["dual-track", "reconciliation", "linear"]);
  const allowedMaps = new Set(["frontend", "capabilities"]);
  const allowedWorkflows = new Set(["audit", "record", "repository", "provider", "block", "layout", "full"]);
  const allowedImpacts = new Set(["read-only", "record", "repository", "provider", "component", "page", "capability", "cross-domain"]);
  for (const [skill, map] of Object.entries(value?.skillMaps ?? {})) {
    if (!/^starci-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill)) failures.push(`invalid skill map key ${skill}`);
    if (!allowedTopologies.has(map?.topology)) failures.push(`${skill} has invalid topology`);
    if (!allowedMaps.has(map?.map)) failures.push(`${skill} has invalid phase map`);
    if (!allowedWorkflows.has(map?.workflow)) failures.push(`${skill} has invalid workflow`);
    if (!Array.isArray(map?.impactLevels) || !map.impactLevels.length || map.impactLevels.some((impact) => !allowedImpacts.has(impact))) failures.push(`${skill} has invalid impact levels`);
    if (!Array.isArray(map?.approvalModes) || !map.approvalModes.includes("manual") || map.approvalModes.some((mode) => !["manual", "auto"].includes(mode))) failures.push(`${skill} has invalid approval modes`);
    if (map?.approvalLabel !== null && !/^OK(?: #[12])?$/.test(map?.approvalLabel ?? "")) failures.push(`${skill} has invalid approval label`);
    if (map?.approvalModes?.includes("auto") && !/^OK #[12]$/.test(map?.approvalLabel ?? "")) failures.push(`${skill} enables auto without a staged approval label`);
    if (!Array.isArray(map?.steps) || map.steps.length < 2 || new Set(map.steps).size !== map.steps.length) failures.push(`${skill} has an invalid step map`);
  }
  return {ok: failures.length === 0, failures};
}

export function validateReceipt(receipt, profiles) {
  const failures = [];
  if (receipt?.schemaVersion !== 4) failures.push("receipt.schemaVersion must equal 4");
  const impact = receipt?.impact;
  const skillMap = profiles?.skillMaps?.[receipt?.skill];
  if (!skillMap || impact?.workflow !== skillMap.workflow || !skillMap.impactLevels.includes(impact?.level) || !/^[0-9a-f]{64}$/.test(impact?.classificationAt ?? "")) failures.push("receipt impact classification is missing or inconsistent with the selected skill map");
  const highRisk = ["capability", "cross-domain"].includes(impact?.level);
  if (!Array.isArray(receipt?.challenges)) failures.push("receipt challenges must be an explicit array");
  const approvalMode = receipt?.phaseGates?.approvalMode;
  const autoApprovalAt = receipt?.phaseGates?.autoApprovalAt;
  if (!skillMap?.approvalModes?.includes(approvalMode)) failures.push("phaseGates.approvalMode is not allowed by the selected skill map");
  if (approvalMode === "auto" && (!/^[0-9a-f]{64}$/.test(autoApprovalAt ?? "") || autoApprovalAt !== receipt?.envelopeAt)) failures.push("auto approval mode requires the immutable invocation envelope hash");
  if (approvalMode === "manual" && autoApprovalAt !== undefined) failures.push("manual approval mode cannot carry autoApprovalAt");
  const runtimeProfile = profiles?.runtimes?.[receipt?.runtime];
  if (receipt?.runtime !== "sequential" && !runtimeProfile) failures.push(`unknown runtime ${receipt?.runtime}`);
  if (!skillMap) failures.push(`unbound skill ${receipt?.skill}`);
  if (receipt?.runtime !== "sequential" && receipt?.coordinator?.model !== runtimeProfile?.coordinatorModel) failures.push("coordinator model does not match runtime profile");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(receipt?.coordinator?.id ?? "")) failures.push("coordinator id is missing");
  for (const decision of requiredDecisions) {
    if (!receipt?.coordinator?.owns?.includes(decision)) failures.push(`coordinator receipt is missing ${decision}`);
  }
  const ids = new Set();
  const writers = new Map();
  const writeTaskIds = [];
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
  const challengeById = new Map();
  for (const challenge of receipt?.challenges ?? []) {
    if (challengeById.has(challenge.id)) failures.push(`duplicate challenge ${challenge.id}`);
    challengeById.set(challenge.id, challenge);
    if (challenge.status !== "resolved" || !(challenge.evidence?.length) || !(challenge.resolutionEvidence?.length)) failures.push(`challenge ${challenge.id} is not evidence-resolved`);
  }
  if (highRisk) {
    const review = receipt?.independentReview;
    if (!review || review.reviewerId === receipt?.coordinator?.id || review.blindToRecommendation !== true || review.mayWrite !== false || review.status !== "passed") failures.push("high-risk work requires a blind read-only independent reviewer distinct from the coordinator");
    for (const id of review?.challengeIds ?? []) if (!challengeById.has(id)) failures.push(`independent review references unknown challenge ${id}`);
  }
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
    if (!Array.isArray(task.outputConsumers) || task.outputConsumers.length === 0) failures.push(`${task.id} produces an artifact with no declared consumer`);
    if (ids.has(task.id)) failures.push(`duplicate task id ${task.id}`);
    ids.add(task.id);
    if (task.skill !== receipt.skill) failures.push(`${task.id} skill does not match the receipt`);
    if (task.envelopeAt !== receipt.envelopeAt) failures.push(`${task.id} envelope is stale or mismatched`);
    if (!skillMap?.steps?.includes(task.step)) failures.push(`${task.id} uses invalid step ${task.step} for ${receipt.skill}`);
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
    if (task.kind === "cache-write" && (!task.qualityReviewAt || task.qualityReviewAt !== receipt?.phaseGates?.qualityReviewAt || !hasPassedGate("quality-review", task.qualityReviewAt))) failures.push(`${task.id} writes cache HTML without the passed integrated quality-review gate`);
    if (task.kind === "read" && task.writes?.length) failures.push(`${task.id} is read-only but declares writes`);
    if (task.kind === "cache-write" && (!(task.writes?.length) || task.writes.some((target) => !insideAnyRoot(target, receipt?.phaseGates?.cacheRoots)))) failures.push(`${task.id} writes outside declared cacheRoots`);
    if (["repository-write", "authority-write", "external-write"].includes(task.kind)) {
      writeTaskIds.push(task.id);
      const boundaryAt = receipt?.phaseGates?.writeBoundaryAt;
      const approvalLabel = skillMap?.approvalLabel;
      const expectedApproval = boundaryAt && approvalLabel
        ? approvalMode === "auto"
          ? `AUTO:${autoApprovalAt}:${approvalLabel}:${boundaryAt}`
          : `${approvalLabel}:${boundaryAt}`
        : undefined;
      if (!task.writeApprovalAt || task.writeApprovalAt !== receipt?.phaseGates?.writeApprovalAt || task.writeApprovalAt !== expectedApproval || !hasPassedGate("write-approval", task.writeApprovalAt)) failures.push(`${task.id} mutates state without the selected skill's approval bound to the exact boundary`);
      if (!hasPassedGate("impact-cone", receipt?.phaseGates?.impactConeAt)) failures.push(`${task.id} writes source without the passed impact-cone gate`);
      if (highRisk && !hasPassedGate("challenge-review", receipt?.independentReview?.reviewerId)) failures.push(`${task.id} writes high-risk source without the passed independent challenge-review gate`);
      if (receipt.skill === "starci-fe-layout-refactor" && receipt?.phaseGates?.authorityMode === "evolve" && (!task.authorityProofAt || task.authorityProofAt !== receipt?.phaseGates?.authorityProofAt || !hasPassedGate("authority-proof", task.authorityProofAt))) failures.push(`${task.id} writes FE before passed compiled authority proof`);
      if (["authority-write", "external-write"].includes(task.kind) && receipt.runtime !== "sequential") failures.push(`${task.id} assigns coordinator-only ${task.kind} to a worker runtime`);
    }
    if (task.kind === "proof" && (!task.stableStateAt || task.stableStateAt !== receipt?.phaseGates?.stableStateAt || !task.proofTargetsAt || task.proofTargetsAt !== receipt?.phaseGates?.proofTargetsAt || !hasPassedGate("stable-state", task.stableStateAt) || !hasPassedGate("proof-targets", task.proofTargetsAt))) failures.push(`${task.id} proves without passed stable-state and proof-target gates`);
    if (task.kind === "proof" && (!(task.writes?.length) || task.writes.some((target) => !insideAnyRoot(target, receipt?.phaseGates?.proofRoots)))) failures.push(`${task.id} writes outside declared proofRoots`);
    for (const target of task.writes ?? []) {
      const overlap = [...writers.entries()].find(([written]) => pathOverlaps(written, target));
      if (overlap) failures.push(`${target} overlaps writer path ${overlap[0]} owned by ${overlap[1]} and ${task.id}`);
      else writers.set(target, task.id);
      const shared = (receipt?.sharedPaths ?? []).find((reserved) => pathOverlaps(reserved, target));
      if (shared && receipt.runtime !== "sequential") failures.push(`${task.id} writes coordinator-only shared path ${shared}`);
    }
  }
  const taskById = new Map((receipt?.tasks ?? []).map((task) => [task.id, task]));
  const validRaisers = new Set([receipt?.coordinator?.id, receipt?.independentReview?.reviewerId, ...taskById.keys()].filter(Boolean));
  for (const challenge of receipt?.challenges ?? []) if (!validRaisers.has(challenge.raisedBy)) failures.push(`challenge ${challenge.id} has unknown raiser ${challenge.raisedBy}`);
  for (const task of receipt?.tasks ?? []) for (const consumer of task.outputConsumers ?? []) {
    if (consumer === "delivery") {
      if (!["repository-write", "authority-write", "external-write", "proof"].includes(task.kind)) failures.push(`${task.id} exposes an intermediate artifact as delivery`);
      continue;
    }
    const [kind, id] = consumer.split(":");
    if (kind === "task") {
      const target = taskById.get(id);
      if (!target || !target.dependsOn?.includes(task.id) || !target.requiredInputs?.includes(task.output)) failures.push(`${task.id} output is not consumed by downstream task ${id}`);
    } else if (kind === "gate") {
      const gate = gateEvents.get(id);
      if (!gate || !gate.requiredArtifacts?.includes(task.output)) failures.push(`${task.id} output is not consumed by gate ${id}`);
    }
  }
  if (writeTaskIds.length) {
    const approved = new Set((receipt?.phaseGates?.approvedWriteTargets ?? []).map(normalizePath));
    const assigned = new Set((receipt.tasks ?? []).filter((task) => ["repository-write", "authority-write", "external-write"].includes(task.kind)).flatMap((task) => task.writes ?? []).map(normalizePath));
    for (const target of assigned) if (!approved.has(target)) failures.push(`${target} is outside approvedWriteTargets`);
    for (const target of approved) if (!assigned.has(target)) failures.push(`${target} has no writer`);
    const impactCone = receipt?.phaseGates?.impactCone;
    if (!impactCone || receipt?.phaseGates?.impactConeAt !== canonicalHash(impactCone)) failures.push("source dispatch has a missing or stale impact-cone manifest");
    if (impactCone) {
      const required = new Set((impactCone.requiredTargets ?? []).map(normalizePath));
      const inventoryTargets = [...(impactCone.owners ?? []).map((owner) => owner.target), ...(impactCone.consumers ?? []), ...(impactCone.proofs ?? [])].map(normalizePath);
      if (required.size !== (impactCone.requiredTargets ?? []).length) failures.push("impactCone.requiredTargets contains canonical duplicates");
      for (const target of inventoryTargets) if (!required.has(target)) failures.push(`${target} is inventoried but absent from impactCone.requiredTargets`);
      if ([...required].some((target) => !approved.has(target)) || [...approved].some((target) => !required.has(target))) failures.push("approvedWriteTargets do not equal impactCone.requiredTargets");
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
    const metrics = receipt.metrics;
    const started = Date.parse(metrics?.startedAt ?? "");
    const finished = Date.parse(metrics?.finishedAt ?? "");
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started || metrics?.wallTimeMs !== finished - started) failures.push("complete receipt has invalid measured wall time");
    if (metrics?.tokenUsage?.status === "measured" && !Number.isInteger(metrics?.tokenUsage?.total)) failures.push("measured token usage requires a total");
    if (!['measured', 'unavailable'].includes(metrics?.tokenUsage?.status)) failures.push("complete receipt must record token measurement availability");
    const artifactsCreated = (receipt.tasks ?? []).length;
    const artifactsUsed = (receipt.tasks ?? []).filter((task) => task.outputConsumers?.length).length;
    if (metrics?.artifactsCreated !== artifactsCreated || metrics?.artifactsUsed !== artifactsUsed || metrics?.unusedArtifacts !== artifactsCreated - artifactsUsed || metrics?.unusedArtifacts !== 0) failures.push("complete receipt contains unused or miscounted artifacts");
    for (const name of ["coordinatorReworkCount", "approvalsChangedDecision", "uniqueDefectsCaught", "falsePositiveGates"]) if (!Number.isInteger(metrics?.[name]) || metrics[name] < 0) failures.push(`complete receipt lacks measured ${name}`);
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
    for (const writeId of writeTaskIds) if (!task.dependsOn?.includes(writeId)) failures.push(`${task.id} does not depend on write task ${writeId}`);
  }
  const visiting = new Set();
  const visited = new Set();
  const tasksById = taskById;
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
  const skillRoot = path.join(root, "skills");
  const physicalSkills = fs.readdirSync(skillRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  const mappedSkills = Object.keys(profiles.skillMaps ?? {}).sort();
  for (const skill of physicalSkills) if (!mappedSkills.includes(skill)) failures.push(`${skill} has no orchestration phase map`);
  for (const skill of mappedSkills) if (!physicalSkills.includes(skill)) failures.push(`${skill} phase map has no physical skill`);
  const receiptSchema = JSON.parse(fs.readFileSync(path.join(root, "orchestration", "receipt.schema.json"), "utf8"));
  const schemaSkills = [...(receiptSchema?.$defs?.skill?.enum ?? [])].sort();
  for (const skill of mappedSkills) if (!schemaSkills.includes(skill)) failures.push(`${skill} is absent from the orchestration receipt schema`);
  for (const skill of schemaSkills) if (!mappedSkills.includes(skill)) failures.push(`${skill} receipt schema entry has no phase map`);
  const rootAuthority = fs.readFileSync(path.join(root, "orchestration", "en.md"), "utf8");
  for (const load of ["orchestration/codex/en.md", "orchestration/claude/en.md", "orchestration/maps/en.md", "orchestration/receipt.schema.json"]) {
    if (!rootAuthority.includes(load)) failures.push(`orchestration/en.md does not load ${load}`);
  }
  const mapRouter = fs.readFileSync(path.join(root, "orchestration", "maps", "en.md"), "utf8");
  for (const target of ["orchestration/frontend/en.md", "orchestration/capabilities/en.md"]) if (!mapRouter.includes(target)) failures.push(`orchestration map router does not route ${target}`);
  const mapRecords = new Map(["frontend", "capabilities"].map((map) => [map, fs.readFileSync(path.join(root, "orchestration", map, "en.md"), "utf8")]));
  const pipeline = (source) => {
    const section = source.match(/## PIPELINE\s+([\s\S]*?)(?=\n## |$)/)?.[1] ?? "";
    const topology = section.match(/Topology:\s+`(dual-track|reconciliation|linear)`/)?.[1];
    const steps = [...section.matchAll(/^\|\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*\|/gm)]
      .map((match) => match[1])
      .filter((step) => step !== "step");
    return {topology, steps};
  };
  for (const skill of mappedSkills) {
    const map = profiles.skillMaps[skill];
    const skillPath = path.join(root, "skills", skill, "SKILL.md");
    const source = fs.readFileSync(skillPath, "utf8");
    if (!source.includes("`@skill-shape` | `skills/skill-shape/context.md`")) failures.push(`${skill} does not load @skill-shape and therefore cannot reach orchestration`);
    const actual = pipeline(source);
    if (actual.topology !== map.topology) failures.push(`${skill} topology does not match its PIPELINE`);
    if (JSON.stringify(actual.steps) !== JSON.stringify(map.steps)) failures.push(`${skill} step map does not match its ordered PIPELINE`);
    if (!mapRecords.get(map.map)?.includes(`\`${skill}\``)) failures.push(`${map.map} orchestration map does not publish ${skill}`);
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
