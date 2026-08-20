import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const source = resolve(flag("source") ?? process.cwd());
const project = flag("project");
const inputPath = flag("input") ? resolve(flag("input")) : undefined;
const featureId = flag("feature");
const apply = args.includes("--apply");
const check = args.includes("--check");
const scriptDir = dirname(fileURLToPath(import.meta.url));
const claudeRoot = resolve(scriptDir, "..");

if (!project || (!inputPath && !check)) {
  console.error("usage: business-registry.mjs --source <Source> --project <project> (--input <feature.json> [--apply] | --check [--feature <featureId>])");
  process.exit(2);
}

const businessRoot = join(source, ".worktrees", project, "businesses");
const registryPath = join(businessRoot, "business-registry-v1.json");
const featureSchema = join(claudeRoot, "contexts", "business", "schema.json");
const registrySchema = join(claudeRoot, "contexts", "business", "registry.schema.json");
const validator = join(scriptDir, "validate-artifact.mjs");

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

const sha256 = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const git = (cwd, ...command) => execFileSync("git", ["-C", cwd, ...command], {encoding: "utf8"}).trim();
const validate = (schema, data) => execFileSync(process.execPath, [validator, "--schema", schema, "--data", data], {encoding: "utf8"});
const normalized = (path) => path.replaceAll("\\", "/");

function workspaceRoute(role) {
  const path = join(source, ".workspace", project, role, "config.json");
  if (!existsSync(path)) throw new Error(`workspace route is absent: ${relative(source, path)}`);
  const route = readJson(path);
  const diskPath = route?.repository?.diskPath;
  if (!diskPath || !existsSync(diskPath)) throw new Error(`workspace route ${role} has no readable repository.diskPath`);
  const head = git(diskPath, "rev-parse", "HEAD");
  const branch = git(diskPath, "branch", "--show-current");
  if (route.repository.branch !== branch) throw new Error(`${role} route branch is stale: recorded ${route.repository.branch}, actual ${branch}`);
  if (!head.startsWith(route.repository.head) && !route.repository.head.startsWith(head)) {
    throw new Error(`${role} route head is stale: recorded ${route.repository.head}, actual ${head}`);
  }
  return {role, path, route, diskPath, head};
}

function dirtyPaths(repo) {
  const output = git(repo, "status", "--porcelain=v1", "--untracked-files=all");
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => normalized(line.slice(3).split(" -> ").at(-1)));
}

function proveModel(model) {
  if (model.project !== project) throw new Error(`model project ${model.project} does not match --project ${project}`);
  const evidenceIds = new Set(model.evidence.map((row) => row.id));
  const refs = [];
  for (const group of [model.actors, model.flows, model.rules, model.states, model.entities, model.operations, model.surfaces, model.acceptance]) {
    for (const entry of group) refs.push(...entry.evidenceIds);
  }
  for (const surface of model.surfaces) for (const region of surface.regions) refs.push(...region.evidenceIds);
  const missing = [...new Set(refs.filter((id) => !evidenceIds.has(id)))];
  if (missing.length) throw new Error(`business claims cite absent evidence: ${missing.join(", ")}`);

  const routes = new Map();
  for (const sourceRef of model.sources) {
    const route = workspaceRoute(sourceRef.role);
    routes.set(sourceRef.role, route);
    if (sourceRef.head !== route.head) throw new Error(`${sourceRef.role} source head ${sourceRef.head} does not match routed HEAD ${route.head}`);
    const origin = route.route.repository.gitRepository;
    if (sourceRef.repository !== origin) throw new Error(`${sourceRef.role} repository does not match routed origin`);
  }

  for (const row of model.evidence) {
    const route = routes.get(row.role);
    if (!route) throw new Error(`${row.id} cites undeclared role ${row.role}`);
    const absolute = resolve(route.diskPath, row.path);
    const prefix = `${normalized(resolve(route.diskPath))}/`;
    if (!normalized(absolute).startsWith(prefix) || !existsSync(absolute)) throw new Error(`${row.id} cites absent or escaping path ${row.path}`);
    const lines = readFileSync(absolute, "utf8").split(/\r?\n/).length;
    if (row.endLine < row.startLine || row.endLine > lines) throw new Error(`${row.id} line range ${row.startLine}-${row.endLine} exceeds ${row.path} (${lines} lines)`);
  }

  for (const route of routes.values()) {
    const cited = new Set(model.evidence.filter((row) => row.role === route.role).map((row) => normalized(row.path)));
    const overlap = dirtyPaths(route.diskPath).filter((path) => cited.has(path));
    if (overlap.length) throw new Error(`${route.role} cited evidence is dirty and cannot back an immutable snapshot: ${overlap.join(", ")}`);
  }
}

const bullets = (items) => items.length ? items.map((item) => `- ${item}`).join("\n") : "- None observed.";
const evidenceRefs = (ids) => ids.map((id) => `\`${id}\``).join(", ");

function renderSpec(model, hash) {
  const sourceRows = model.sources.map((item) => `| ${item.role} | ${item.repository} | \`${item.head}\` |`).join("\n");
  const actors = model.actors.map((actor) => `### ${actor.label}\n\n${bullets(actor.capabilities)}\n\nEvidence: ${evidenceRefs(actor.evidenceIds)}`).join("\n\n");
  const flows = model.flows.map((flow) => `### ${flow.title}\n\nTrigger: ${flow.trigger}\n\n${flow.steps.map((step, index) => `${index + 1}. **${step.actor}** — ${step.action} → ${step.result}`).join("\n")}\n\nOutcomes:\n${bullets(flow.outcomes)}\n\nEvidence: ${evidenceRefs(flow.evidenceIds)}`).join("\n\n");
  const surfaces = model.surfaces.map((surface) => `### ${surface.title}\n\n- ID: \`${surface.id}\`\n- Route: \`${surface.routePattern}\`\n- Purpose: ${surface.purpose}\n- Regions: ${surface.regions.map((region) => `\`${region.id}\``).join(", ")}\n- Navigation: ${surface.navigation.map((item) => `${item.label} (${item.availability})`).join(", ") || "none"}\n\nEvidence: ${evidenceRefs(surface.evidenceIds)}`).join("\n\n");
  const rules = model.rules.map((rule) => `### ${rule.id}\n\n${rule.statement}\n\nStrength: **${rule.strength}** · Evidence: ${evidenceRefs(rule.evidenceIds)}`).join("\n\n");
  const states = model.states.map((state) => `- **${state.label}** (\`${state.id}\`, ${state.kind}) → ${state.transitions.join(", ") || "terminal"} — ${evidenceRefs(state.evidenceIds)}`).join("\n");
  const entities = model.entities.map((entity) => `- **${entity.label}**: ${entity.fields.join(", ")} — ${evidenceRefs(entity.evidenceIds)}`).join("\n");
  const operations = model.operations.map((operation) => `- **${operation.name}** (${operation.kind}, ${operation.owner}) — input: ${operation.inputs.join(", ") || "none"}; output: ${operation.outputs.join(", ") || "none"}; failures: ${operation.failures.join(", ") || "none"} — ${evidenceRefs(operation.evidenceIds)}`).join("\n");
  const acceptance = model.acceptance.map((item) => `- **${item.id}** ${item.statement} — ${evidenceRefs(item.evidenceIds)}`).join("\n");
  const unknowns = model.unknowns.map((item) => `- **${item.question}** — ${item.impact}`).join("\n");
  const evidence = model.evidence.map((row) => `| ${row.id} | ${row.role} | \`${row.path}:${row.startLine}\` | ${row.kind} | ${row.claim} |`).join("\n");
  return `# ${model.title}\n\n> Business head: \`${hash}\`\n>\n> This document is generated from the immutable business model. Update the model through \`starci-business-analyze\`; do not hand-edit this view.\n\n## 1. Overview\n\n${model.summary}\n\nIncluded:\n${bullets(model.scope.includes)}\n\nExcluded:\n${bullets(model.scope.excludes)}\n\n## 2. Source heads\n\n| Role | Repository | Head |\n|---|---|---|\n${sourceRows}\n\n## 3. Actors and access\n\n${actors || "No actor is confirmed."}\n\n## 4. Entry points and surfaces\n\n${surfaces}\n\n## 5. Business flows\n\n${flows}\n\n## 6. Business rules\n\n${rules || "No business rule is confirmed."}\n\n## 7. State model\n\n${states || "No state is confirmed."}\n\n## 8. Entities and data\n\n${entities || "No entity is confirmed."}\n\n## 9. Operations and APIs\n\n${operations || "No operation is confirmed."}\n\n## 10. Acceptance conditions\n\n${acceptance}\n\n## 11. Explicit unknowns\n\n${unknowns || "No unresolved question is recorded."}\n\n## 12. Evidence index\n\n| ID | Role | Source | Kind | Claim |\n|---|---|---|---|---|\n${evidence}\n`;
}

function renderContext(model, hash) {
  const primary = model.flows[0];
  const sourceHeads = model.sources.map((item) => `\`${item.role}@${item.head.slice(0, 12)}\``).join(", ");
  const invariants = model.rules.slice(0, 5).map((rule) => `- \`${rule.id}\` — ${rule.statement}`).join("\n") || "- No confirmed invariant.";
  const flow = primary.steps.map((step) => step.stateId ?? step.action).join(" → ");
  const surfaces = model.surfaces.map((surface) => `| \`${surface.id}\` | \`${surface.routePattern}\` | ${surface.purpose} | [surface](surfaces/${surface.id}.md) |`).join("\n");
  const operations = model.operations.slice(0, 8).map((operation) => `| \`${operation.name}\` | ${operation.owner} | ${operation.inputs.join(", ") || "none"} | ${operation.outputs.join(", ") || "none"} |`).join("\n") || "| — | — | — | — |";
  const unknowns = model.unknowns.map((item) => `- \`${item.id}\` — ${item.question} Impact: ${item.impact}`).join("\n") || "- No unresolved question is recorded.";
  return `# ${model.title}\n\n> Business identity: \`${model.project}/${model.featureId}@${hash}\`\n>\n> Source heads: ${sourceHeads}\n>\n> Load this file first. Load only the modules named by the current task.\n\n## Decision capsule\n\n**Purpose.** ${model.summary}\n\n**Primary actor.** ${model.actors[0]?.label ?? "Unknown"}\n\n**Primary outcome.** ${primary.outcomes[0]}\n\n**Never does.** ${model.scope.excludes[0] ?? "No additional behavior without evidence."}\n\n## Invariants\n\n${invariants}\n\n## Primary flow\n\n\`\`\`text\n${flow}\n\`\`\`\n\n## Surface map\n\n| Surface | Route | Owns | Module |\n|---|---|---|---|\n${surfaces}\n\n## Data and operation map\n\n| Operation | Owner | Input | Result |\n|---|---|---|---|\n${operations}\n\n## Explicit unknowns\n\n${unknowns}\n\n## LOADS\n\n| Need | Read |\n|---|---|\n| Scope, terminology and exclusions | [overview.md](overview.md) |\n| Actor permissions and ownership | [actors.md](actors.md) |\n| One user journey | \`flows/<flow-id>.md\` |\n| One renderable screen | \`surfaces/<surface-id>.md\` |\n| Business invariants | [rules.md](rules.md) |\n| State transitions | [states.md](states.md) |\n| Entities, inputs, outputs and failures | [contracts.md](contracts.md) |\n| Completion and regression proof | [acceptance.md](acceptance.md) |\n| Machine rendering/query | [model.json](model.json) |\n| Exact source provenance | [evidence.json](evidence.json) |\n\n## Context rule\n\nDo not load every module by default. \`CONTEXT.md\` plus the one flow or surface being changed is the normal prompt. \`model.json\` is authoritative for machines; Markdown files are generated projections. Unknowns remain unknown until routed source or an explicit owner decision resolves them.\n`;
}

function renderOverview(model) {
  const sourceRows = model.sources.map((item) => `| ${item.role} | ${item.repository} | \`${item.head}\` |`).join("\n");
  return `# Overview · ${model.title}\n\n## Purpose\n\n${model.summary}\n\n## Included\n\n${bullets(model.scope.includes)}\n\n## Excluded\n\n${bullets(model.scope.excludes)}\n\n## Source heads\n\n| Role | Repository | Head |\n|---|---|---|\n${sourceRows}\n`;
}

function renderActors(model) {
  const rows = model.actors.map((actor) => `## ${actor.label} (\`${actor.id}\`)\n\nCan:\n\n${bullets(actor.capabilities)}\n\nEvidence: ${evidenceRefs(actor.evidenceIds)}`).join("\n\n");
  return `# Actors · ${model.title}\n\n${rows || "No actor is confirmed."}\n`;
}

function renderFlow(flow) {
  const steps = flow.steps.map((step, index) => `| ${index + 1} | \`${step.actor}\` | ${step.surfaceId ? `\`${step.surfaceId}\`` : "—"} | ${step.action} | ${step.result} |`).join("\n");
  return `# Flow · ${flow.title}\n\n> ID: \`${flow.id}\` · Trigger: ${flow.trigger}\n\n| # | Actor | Surface | Action | Result |\n|---:|---|---|---|---|\n${steps}\n\n## Outcomes\n\n${bullets(flow.outcomes)}\n\nEvidence: ${evidenceRefs(flow.evidenceIds)}\n`;
}

function renderSurface(surface) {
  const regions = surface.regions.map((region) => `| \`${region.id}\` | ${region.kind} | ${region.items.map((item) => [item.label, item.value, item.status].filter(Boolean).join(": ")).join("; ") || region.summary} | ${region.states.join(", ") || "resting"} | ${region.actions.map((action) => action.label).join(", ") || "none"} | ${evidenceRefs(region.evidenceIds)} |`).join("\n");
  const navigation = surface.navigation.map((item) => `- ${item.group} / ${item.label} — ${item.availability}`).join("\n") || "- none";
  return `# Surface · ${surface.title}\n\n> ID: \`${surface.id}\` · Route: \`${surface.routePattern}\`\n\n## Job\n\n${surface.purpose}\n\n## Navigation\n\n${navigation}\n\n## Prototype contract\n\n| Region | Kind | Real representative content | States | Actions | Evidence |\n|---|---|---|---|---|---|\n${regions}\n\n## Context rule\n\nLayout preview may use these identities, values, statuses and actions to show density and hierarchy. Block design owns final anatomy.\n`;
}

function renderRules(model) {
  const rows = model.rules.map((rule) => `## ${rule.id}\n\n${rule.statement}\n\n- Strength: \`${rule.strength}\`\n- Evidence: ${evidenceRefs(rule.evidenceIds)}`).join("\n\n");
  return `# Business rules · ${model.title}\n\n${rows || "No business rule is confirmed."}\n`;
}

function renderStates(model) {
  const rows = model.states.map((state) => `| \`${state.id}\` | ${state.kind} | ${state.label} | ${state.transitions.join(", ") || "terminal"} | ${evidenceRefs(state.evidenceIds)} |`).join("\n");
  return `# States · ${model.title}\n\n| State | Kind | Reader sees | Transitions | Evidence |\n|---|---|---|---|---|\n${rows || "| — | — | — | — | — |"}\n`;
}

function renderContracts(model) {
  const entities = model.entities.map((entity) => `## Entity · ${entity.label} (\`${entity.id}\`)\n\nFields: ${entity.fields.map((field) => `\`${field}\``).join(", ")}\n\nEvidence: ${evidenceRefs(entity.evidenceIds)}`).join("\n\n");
  const operations = model.operations.map((operation) => `## Operation · ${operation.name}\n\n- Kind/owner: \`${operation.kind}\` / \`${operation.owner}\`\n- Inputs: ${operation.inputs.join(", ") || "none"}\n- Outputs: ${operation.outputs.join(", ") || "none"}\n- Failures: ${operation.failures.join(", ") || "none"}\n- Evidence: ${evidenceRefs(operation.evidenceIds)}`).join("\n\n");
  return `# Contracts · ${model.title}\n\n${entities || "No entity is confirmed."}\n\n${operations || "No operation is confirmed."}\n\nNo field, failure or operation may appear here without routed source evidence.\n`;
}

function renderAcceptance(model) {
  const rows = model.acceptance.map((item) => `| \`${item.id}\` | ${item.statement} | ${evidenceRefs(item.evidenceIds)} |`).join("\n");
  return `# Acceptance · ${model.title}\n\n| ID | Observable result | Evidence/test |\n|---|---|---|\n${rows}\n\n## Completion\n\n- Every current surface state is represented.\n- Every business rule has evidence.\n- Every operation has input, output and failure ownership.\n- Unknowns are explicit and never rendered as facts.\n- FE/BE source heads match the business head.\n`;
}

function writeFeatureViews(featureRoot, model, hash) {
  mkdirSync(join(featureRoot, "flows"), {recursive: true});
  mkdirSync(join(featureRoot, "surfaces"), {recursive: true});
  const views = new Map([
    ["CONTEXT.md", renderContext(model, hash)],
    ["overview.md", renderOverview(model)],
    ["actors.md", renderActors(model)],
    ["rules.md", renderRules(model)],
    ["states.md", renderStates(model)],
    ["contracts.md", renderContracts(model)],
    ["acceptance.md", renderAcceptance(model)],
    ["spec.md", renderSpec(model, hash)],
  ]);
  for (const flow of model.flows) views.set(`flows/${flow.id}.md`, renderFlow(flow));
  for (const surface of model.surfaces) views.set(`surfaces/${surface.id}.md`, renderSurface(surface));
  for (const [path, content] of views) writeFileSync(join(featureRoot, path), content, "utf8");
}

function assertBusinessWorktree() {
  if (!existsSync(businessRoot)) throw new Error(`business root is absent: ${relative(source, businessRoot)}; initialize it with starci-init`);
  const common = normalized(git(source, "rev-parse", "--git-common-dir"));
  const owned = git(source, "worktree", "list", "--porcelain").split(/\r?\n\r?\n/).find((entry) => entry.split(/\r?\n/)[0] === `worktree ${normalized(businessRoot)}` || entry.split(/\r?\n/)[0] === `worktree ${businessRoot}`);
  if (!owned) throw new Error(`business root is not owned by Source git: ${businessRoot}`);
  const branch = git(businessRoot, "branch", "--show-current");
  if (branch !== `codex/businesses/${project}`) throw new Error(`business root branch must be codex/businesses/${project}, got ${branch}`);
  const status = git(businessRoot, "status", "--porcelain");
  if (status) throw new Error(`business worktree must be clean before publication:\n${status}`);
  return common;
}

function checkRegistry() {
  assertBusinessWorktree();
  if (!existsSync(registryPath)) throw new Error(`business registry is absent: ${relative(source, registryPath)}`);
  validate(registrySchema, registryPath);
  const registry = readJson(registryPath);
  if (registry.project !== project) throw new Error(`business registry project is ${registry.project}, expected ${project}`);
  const selected = featureId ? {[featureId]: registry.featureHeads[featureId]} : registry.featureHeads;
  for (const [id, head] of Object.entries(selected)) {
    if (!head) throw new Error(`business feature is absent: ${id}`);
    const objectPath = join(businessRoot, registry.objects.byHash[head.head]?.path ?? "");
    if (!existsSync(objectPath)) throw new Error(`business object is absent for ${id}@${head.head}`);
    const model = readJson(objectPath);
    if (sha256(model) !== head.head) throw new Error(`business object hash mismatch for ${id}`);
    proveModel(model);
  }
  console.log(`business registry ${project}: ${Object.keys(selected).length} feature(s) current`);
}

if (check) {
  checkRegistry();
} else {
  assertBusinessWorktree();
  validate(featureSchema, inputPath);
  const model = readJson(inputPath);
  proveModel(model);
  const hash = sha256(model);
  if (!apply) {
    console.log(`${hash}  ${model.featureId}`);
  } else {
    const registry = existsSync(registryPath) ? readJson(registryPath) : {schemaVersion: 1, project, hashAlgorithm: "sha256", canonicalization: "RFC8785-JCS", featureHeads: {}, objects: {immutable: true, byHash: {}}};
    if (registry.project !== project) throw new Error(`business registry project is ${registry.project}, expected ${project}`);
    const objectRelative = `objects/sha256/${hash}.json`;
    const objectPath = join(businessRoot, objectRelative);
    if (existsSync(objectPath) && sha256(readJson(objectPath)) !== hash) throw new Error(`immutable business object collision at ${objectRelative}`);
    writeJson(objectPath, model);
    registry.featureHeads[model.featureId] = {featureId: model.featureId, head: hash, sources: model.sources.map(({role, head}) => ({role, head}))};
    registry.objects.byHash[hash] = {hash, path: objectRelative};
    writeJson(registryPath, registry);
    const featureRoot = join(businessRoot, "features", model.featureId);
    writeJson(join(featureRoot, "model.json"), model);
    writeJson(join(featureRoot, "evidence.json"), {schemaVersion: 1, project, featureId: model.featureId, head: hash, sources: model.sources, evidence: model.evidence});
    writeFeatureViews(featureRoot, model, hash);
    const historyPath = join(businessRoot, "history", "by-id.json");
    const history = existsSync(historyPath) ? readJson(historyPath) : {schemaVersion: 1, project, features: {}};
    history.features[model.featureId] ??= [];
    if (!history.features[model.featureId].includes(hash)) history.features[model.featureId].push(hash);
    writeJson(historyPath, history);
    console.log(`business ${project}/${model.featureId}@${hash} -> ${relative(source, featureRoot)}`);
  }
}
