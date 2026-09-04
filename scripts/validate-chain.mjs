// A chain is never chosen from an example: scripts/plan-chain.mjs derives it from the mission's
// done-when lines, and this file is the gate every planned or replanned chain passes before a branch
// of it is dispatched. It reads the state.json shape (chain: [["1/1"], ["2/1", "2/2"]], steps:
// { "N/M": operatorId }) plus each branch's request.json, and enforces what the example-workflow
// validator used to enforce on files: every operator exists; every step is reached through a Next
// table of the step before it (or re-enters the same operator); every required Input of a branch is
// produced by an earlier step; every required @workspaces/<role> context was bound by an earlier
// workspace.bind of that role; a step runs at most the orchestrator's parallel cap; branches of one
// step share no write alias; a chain that applies frontend source and publishes it audits and walks
// the surface in between (the long-flow law); a publish or a deploy is the last step. On a mission
// every branch names its goal (a done-when line this operator produces, or a later branch it enables),
// and an execute branch runs after its domain's plan when the chain holds one. The unit a fan-out
// branch names is the request gate's business (scripts/validate-request.mjs#unitGateErrors), not this file's.
//
// The operator graph (what each operator produces, requires, binds, writes and may hand to) is built
// here, once, from the operator.md tables and operator.json, and scripts/plan-chain.mjs plans on the
// same graph, so the planner and the gate cannot disagree about a table.
//
// Two things a chain reads beside its own cells. An imported slot (scripts/producer-import.mjs: an
// evidence-only coordinate carrying import.json beside a copied producer bundle) never enters the
// chain, but a branch whose request names one of its outputs as an input has that kind produced —
// credited here only when the import gate accepts the reference, so this file learns that the kind
// exists and the gate stays the authority on the bytes. And the plan fixes a branch's requirements
// (state.json.planned["N/M"].requirements, from the planner's presets) before the branch's request
// exists: a bind's role is read from the request when written, else from the plan, so a chain drawn
// before step 1 validates, and a dispatched request carries the planned values unchanged.
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, cellAliases, kindOf, isYes } from './operator-md.mjs';
import { loadAliasRegistry, baseOf } from './alias-registry.mjs';
import { operatorEffects, planOperatorOf, plannedRequirementErrors } from './validate-request.mjs';
import { loadRetired } from './retired-operators.mjs';
import { validateImportedInput } from './producer-import.mjs';

// Only a fully quoted cell is unquoted: a sentence that opens with a code span keeps its backticks.
const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };
const OPERATOR_ID = /\b[a-z]+(?:\.[a-z]+)+\b/g;
export const stepOf = (cell) => Number(String(cell).split('/')[0]);
export const parallelOf = (cell) => Number(String(cell).split('/')[1]);
export const cellOf = (step, parallel) => `${step}/${parallel}`;

// The kinds the long-flow law is stated in: the surface that was written, the audit that looked at it.
// The law names kinds, never operator ids, so a renamed operator keeps the law.
export const SURFACE_KIND = 'frontend-source-application';
export const SURFACE_AUDIT_KIND = 'frontend-surface-audit';
export const WALK_OPERATOR = 'uat.verify';
export const PUBLISH_OPERATOR = 'git.publish';
export const DEPLOY_OPERATOR = 'release.deploy';
export const BIND_OPERATOR = 'workspace.bind';
export const PREFLIGHT_OPERATOR = 'environment.preflight';
export const UNITS_KIND = 'units';
// The per-step parallel cap: resources/orchestrator.json#concurrency.maxParallel when it is declared,
// else #maxConcurrentAgents (three agents at once is also three branches at once).
export async function loadMaxParallel(root) {
  const o = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
  return o.concurrency?.maxParallel ?? o.maxConcurrentAgents ?? 3;
}

// One node per operator.md package: what it produces, what it requires and from whom, which checkout
// roles it binds, where it may hand to, what it writes, and whether it writes source or touches a runtime.
export function operatorGraph(packages, aliases = {}) {
  const graph = new Map();
  for (const p of packages.filter((x) => x.shape === 'v9')) {
    const op = p.en;
    const writes = new Set();
    for (const s of op.tables.steps?.rows ?? []) for (const a of cellAliases(s.writes)) writes.add(baseOf(aliases, a) ?? a);
    const roles = new Set();
    for (const r of op.tables.context?.rows ?? []) { const a = cellAliases(r.alias)[0]; const m = a && /^@workspaces\/(fe|be)\b/.exec(a); if (m && isYes(r.required)) roles.add(m[1]); }
    const inputs = (op.tables.inputs?.rows ?? []).filter((r) => kindOf(r.kind) && kindOf(r.kind) !== '—').map((r) => ({ kind: kindOf(r.kind), required: isYes(r.required), from: [...new Set([...r.from.matchAll(OPERATOR_ID)].map((m) => m[0]))] }));
    graph.set(p.manifest.id, {
      id: p.manifest.id,
      domain: p.manifest.id.split('.')[0],
      primary: p.manifest.primaryOutput ?? null,
      outputs: new Set((op.tables.outputs?.rows ?? []).map((r) => kindOf(r.kind))),
      inputs,
      required: inputs.filter((i) => i.required),
      optional: inputs.filter((i) => !i.required),
      roles,
      next: new Set((op.tables.next?.rows ?? []).map((r) => unquote(r.operator))),
      writes,
      fields: new Set((op.tables.requirements?.rows ?? []).map((r) => unquote(r.field))),
      effects: operatorEffects(p).length > 0,
      pkg: p,
    });
  }
  return graph;
}
export async function loadOperatorGraph(root, packages) {
  packages ??= await loadOperatorPackages(root);
  const aliases = (await loadAliasRegistry(root)).aliases;
  return operatorGraph(packages, aliases);
}

// Which operators produce a kind, apart from the consumer itself (an operator's own earlier run is
// history, never a producer the planner adds).
export const producersOf = (graph, kind, consumerId = null) => [...graph.values()].filter((o) => o.outputs.has(kind) && o.id !== consumerId).map((o) => o.id);
// The operator whose primary output is a kind, when exactly one declares it.
export const primaryProducerOf = (graph, kind) => { const ids = [...graph.values()].filter((o) => o.primary === kind).map((o) => o.id); return ids.length === 1 ? ids[0] : null; };
// Whether a branch writes a surface for real: its operator's primary output is the surface kind, it
// holds a source-writing tool, and its request does not run it under mode dry.
export function writesSurface(node, requirements = {}) {
  if (!node || node.primary !== SURFACE_KIND) return false;
  if (!operatorEffects(node.pkg).some((t) => t.id === 'sourcewrite')) return false;
  return ((requirements ?? {}).mode ?? 'apply') !== 'dry';
}
// The plan operator of an execute operator: the `<domain>.plan` package that outputs units
// (scripts/validate-request.mjs#planOperatorOf), read through the graph; a plan is not its own execute.
export function planOf(graph, id) {
  const pkg = planOperatorOf(id, [...graph.values()].map((o) => o.pkg));
  return pkg && pkg.manifest.id !== id ? graph.get(pkg.manifest.id) ?? null : null;
}

// The gate. `chain` and `steps` are state.json's; `byBranch` maps "N/M" to that branch's request.json
// (operatorId, requirements, goal) or to null when the request is not written yet. Options: mission
// (state.json.mission; goal rules apply only when present), maxParallel, graph or aliases, planned
// (state.json.planned), imported ({ "N/M": Set of kinds the branch draws from accepted imported slots,
// readImportedInputs).
export function validateChain(root, packages, chain, steps, byBranch = {}, options = {}) {
  const errors = [];
  const graph = options.graph ?? operatorGraph(packages, options.aliases ?? {});
  const maxParallel = options.maxParallel ?? 3;
  const mission = options.mission ?? null;
  const planned = options.planned ?? {};
  const imported = options.imported ?? {};
  if (!Array.isArray(chain) || !chain.length) { errors.push('state.json: chain must be a non-empty array of steps'); return errors; }
  const req = (cell) => byBranch[cell] ?? null;
  const opOf = (cell) => steps?.[cell];
  // Shape: every cell sits in the step its number names, every cell has an operator, every recorded branch is in the chain.
  const cells = new Set();
  chain.forEach((step, n) => {
    if (!Array.isArray(step) || !step.length) { errors.push(`state.json: chain[${n}] must be a non-empty array of branches`); return; }
    step.forEach((cell) => {
      cells.add(cell);
      if (stepOf(cell) !== n + 1) errors.push(`state.json: chain[${n}] holds ${cell}, whose step number is not ${n + 1}`);
      if (opOf(cell) === undefined) errors.push(`state.json: chain names ${cell} and steps records no operator for it`);
      else if (req(cell)?.operatorId && req(cell).operatorId !== opOf(cell)) errors.push(`${cell}: request.json runs ${req(cell).operatorId}, state.json.steps says ${opOf(cell)}`);
    });
  });
  for (const cell of Object.keys(steps ?? {})) if (!cells.has(cell)) errors.push(`state.json: steps records ${cell}, which the chain does not name`);
  // Evidence is not a step: a chain that grows onto an imported slot's coordinate would overwrite the producer it was planned on.
  for (const cell of options.evidenceCells ?? []) if (cells.has(cell)) errors.push(`state.json: chain names ${cell}, which is an imported evidence slot; imported slots live from step ${options.importStepBase ?? 100} upward and a chain never reaches them`);
  for (const cell of Object.keys(planned)) if (!cells.has(cell)) errors.push(`state.json: planned records ${cell}, which the chain does not name`);
  const produced = new Set(); // kinds produced by earlier steps
  const boundRoles = new Set(); // roles bound by earlier workspace.bind branches
  const position = new Map(); // operator -> first step index it runs in, over the whole chain
  chain.forEach((step, n) => { if (Array.isArray(step)) for (const cell of step) { const id = opOf(cell); if (id !== undefined && !position.has(id)) position.set(id, n); } });
  let previous = null;
  chain.forEach((step, n) => {
    if (!Array.isArray(step) || !step.length) return;
    if (step.length > maxParallel) errors.push(`state.json: step ${n + 1} has ${step.length} branches; at most ${maxParallel} run in parallel`);
    const stepProduces = new Set();
    const seenWrites = new Map();
    for (const cell of step) {
      const id = opOf(cell); if (id === undefined) continue;
      const node = graph.get(id);
      if (!node) { errors.push(`${cell}: unknown operator ${id}`); continue; }
      const r = req(cell);
      if (previous && !previous.some((prev) => prev === id || (graph.get(prev)?.next ?? new Set()).has(id))) errors.push(`${cell}: step ${n + 1} runs ${id}, which no Next table of step ${n} (${previous.join(', ')}) permits`);
      for (const input of node.required) if (!produced.has(input.kind) && !imported[cell]?.has(input.kind)) errors.push(`${cell}: ${id} requires input ${input.kind}, which no earlier step produces and no imported slot the request names supplies`);
      if (id !== BIND_OPERATOR) for (const role of node.roles) if (!boundRoles.has(role)) errors.push(`${cell}: ${id} requires @workspaces/${role}, which no earlier ${BIND_OPERATOR} (role ${role}) bound or is planned to bind`);
      if (r && planned[cell]) errors.push(...plannedRequirementErrors(planned[cell], r, `${cell}: request.json`));
      for (const w of node.writes) {
        if (seenWrites.has(w)) errors.push(`${cell}: ${id} and ${seenWrites.get(w)} both write ${w} in step ${n + 1}; branches of one step must not share a write alias`);
        seenWrites.set(w, id);
      }
      for (const k of node.outputs) stepProduces.add(k);
      // Goals: on a mission every branch says what it is for.
      if (mission && r) {
        const lines = mission.doneWhen ?? [];
        const goal = r.goal;
        if (!goal) errors.push(`${cell}: request.json names no goal; on a mission a branch cites the done-when line it evidences or the later branch it enables`);
        else if (goal.doneWhen !== undefined) {
          const line = lines[goal.doneWhen];
          if (!line) errors.push(`${cell}: goal.doneWhen ${goal.doneWhen} is not a line of the mission (${lines.length} lines)`);
          else if (line.producedBy !== id) errors.push(`${cell}: goal.doneWhen ${goal.doneWhen} is produced by ${line.producedBy}, not by ${id}`);
        } else if (goal.prerequisite !== undefined) {
          if (opOf(goal.prerequisite) === undefined) errors.push(`${cell}: goal.prerequisite names ${goal.prerequisite}, which the chain does not have`);
          else if (stepOf(goal.prerequisite) <= n + 1) errors.push(`${cell}: goal.prerequisite names ${goal.prerequisite}, which does not run after this branch; a prerequisite enables a later branch`);
        }
      }
      // Fan-out: when the chain holds the plan of this operator's domain, the plan runs in an earlier step
      // than every branch that executes its units. Which unit the branch runs, and that the id is one the
      // plan listed, is the request gate's (scripts/validate-request.mjs#unitGateErrors).
      const plan = planOf(graph, id);
      if (plan && position.has(plan.id) && position.get(plan.id) >= n) errors.push(`${cell}: ${id} runs in step ${n + 1} and ${plan.id}, whose ${UNITS_KIND} it executes, runs in step ${position.get(plan.id) + 1}; a plan runs before the branches that take its units`);
    }
    for (const k of stepProduces) produced.add(k);
    // A bind's role: the request when it is written, else the plan; a chain drawn before step 1 has only the plan.
    for (const cell of step) { const role = opOf(cell) === BIND_OPERATOR ? req(cell)?.requirements?.role ?? planned[cell]?.requirements?.role : undefined; if (role) boundRoles.add(role); }
    previous = step.map(opOf).filter(Boolean);
  });
  // The long-flow law: a surface written for real and published is audited and walked in between.
  const writerAt = chain.findIndex((step) => Array.isArray(step) && step.some((cell) => writesSurface(graph.get(opOf(cell)), req(cell)?.requirements)));
  const publishAt = position.get(PUBLISH_OPERATOR);
  if (writerAt !== -1 && publishAt !== undefined) {
    const auditId = primaryProducerOf(graph, SURFACE_AUDIT_KIND);
    for (const owed of [auditId ?? SURFACE_AUDIT_KIND, WALK_OPERATOR]) {
      const at = position.get(owed);
      if (at === undefined) errors.push(`state.json: step ${writerAt + 1} writes frontend source under mode apply and step ${publishAt + 1} publishes it with no ${owed} anywhere in the chain; a surface nobody proved is not publishable`);
      else if (!(at > writerAt && at < publishAt)) errors.push(`state.json: ${owed} runs at step ${at + 1}, outside the write at step ${writerAt + 1} and the publish at step ${publishAt + 1}; it proves nothing about what is being published`);
    }
  }
  // A publish or a deploy ends the chain: nothing runs after the boundary left the session.
  const last = chain[chain.length - 1];
  const lastOps = Array.isArray(last) ? last.map(opOf) : [];
  for (const terminal of [PUBLISH_OPERATOR, DEPLOY_OPERATOR]) if (position.has(terminal) && !lastOps.includes(PUBLISH_OPERATOR) && !lastOps.includes(DEPLOY_OPERATOR)) errors.push(`state.json: ${terminal} runs at step ${position.get(terminal) + 1} and the chain goes on to step ${chain.length} (${lastOps.join(', ')}); a chain ends at ${PUBLISH_OPERATOR}, ${DEPLOY_OPERATOR} or a person`);
  return errors;
}

// The requests of a session, keyed by cell, as validateChain reads them.
export async function readBranchRequests(session, steps) {
  const out = {};
  for (const cell of Object.keys(steps ?? {})) {
    const file = path.join(session, `step-${stepOf(cell)}`, `parallel-${parallelOf(cell)}`, 'request', 'request.json');
    if (!existsSync(file)) { out[cell] = null; continue; }
    try { out[cell] = JSON.parse(await readFile(file, 'utf8')); } catch { out[cell] = null; }
  }
  return out;
}
// The imported slots of a session: every step-N/parallel-M that carries import.json, with the origin
// coordinate the manifest names and the outputs the copied response.json declares under fields,
// kept to the kinds the origin operator's Outputs table publishes when the graph knows the operator
// (an origin this tree cannot name declares nothing the gate would accept). Each output is the
// session-relative path a consuming request binds as inputs.<kind>. The planner reads this to treat
// the kinds as already produced; the bytes are the import gate's (validateImportedInput).
export async function readImportedSlots(session, graph = null, root = null) {
  const out = [];
  if (!existsSync(session)) return out;
  const retired = root ? loadRetired(root) : {};
  const numbered = (prefix) => (names) => names.filter((n) => new RegExp(`^${prefix}-\\d+$`).test(n)).sort((a, b) => Number(a.slice(prefix.length + 1)) - Number(b.slice(prefix.length + 1)));
  for (const stepDir of numbered('step')(await readdir(session))) {
    for (const parallelDir of numbered('parallel')(await readdir(path.join(session, stepDir)))) {
      const dir = path.join(session, stepDir, parallelDir);
      if (!existsSync(path.join(dir, 'import.json'))) continue;
      let manifest; let response;
      try { manifest = JSON.parse(await readFile(path.join(dir, 'import.json'), 'utf8')); response = JSON.parse(await readFile(path.join(dir, 'response', 'response.json'), 'utf8')); } catch { continue; }
      const cell = cellOf(Number(stepDir.slice(5)), Number(parallelDir.slice(9)));
      // The operator standing for the origin today: itself, else the successors of a retired id (operators/retired.json).
      const standing = graph ? (graph.has(response.operatorId) ? [graph.get(response.operatorId)] : (retired[response.operatorId] ?? []).map((id) => graph.get(id)).filter(Boolean)) : [];
      const outputs = {};
      for (const [kind, ref] of Object.entries(response.fields ?? {})) if (!graph || standing.some((n) => n.outputs.has(kind))) outputs[kind] = `${stepDir}/${parallelDir}/${Array.isArray(ref) ? ref[0] : ref}`;
      out.push({ cell, operatorId: response.operatorId ?? null, sourceSessionId: manifest.sourceSessionId ?? null, sourceStep: manifest.sourceStep ?? null, sourceParallel: manifest.sourceParallel ?? null, outputs });
    }
  }
  return out;
}
// The kinds each branch draws from imported slots, credited only when the import gate accepts the
// reference: { "N/M": Set(kind) }. The references come from the branch's request when it is written,
// else from the plan (state.json.planned["N/M"].inputs), so a chain drawn before step 1 is fed. A slot
// without import.json is a local input and is not credited here; a slot the gate refuses is not
// credited at all.
export async function readImportedInputs(root, session, byBranch, { hostRoot, planned } = {}) {
  const out = {};
  const cells = new Set([...Object.keys(byBranch ?? {}), ...Object.keys(planned ?? {})]);
  for (const cell of cells) {
    const request = byBranch?.[cell] ?? null;
    const refs = request ? request.inputs ?? {} : planned?.[cell]?.inputs ?? {};
    for (const [kind, ref] of Object.entries(refs)) {
      const m = /^step-(\d+)\/parallel-(\d+)\//.exec(String(ref));
      if (!m || !existsSync(path.join(session, `step-${m[1]}`, `parallel-${m[2]}`, 'import.json'))) continue;
      const errors = await validateImportedInput(root, session, ref, kind, { ...(hostRoot ? { hostRoot } : {}), receivingSessionId: request?.sessionId ?? path.basename(session) });
      if (!errors.length) (out[cell] ??= new Set()).add(kind);
    }
  }
  return out;
}
export async function validateSessionChain(root, session, state, packages) {
  packages ??= await loadOperatorPackages(root);
  const graph = await loadOperatorGraph(root, packages);
  const byBranch = await readBranchRequests(session, state.steps);
  const slots = await readImportedSlots(session, graph, root);
  return validateChain(root, packages, state.chain, state.steps, byBranch, { graph, mission: state.mission ?? null, maxParallel: await loadMaxParallel(root), planned: state.planned ?? {}, imported: await readImportedInputs(root, session, byBranch, { planned: state.planned ?? {} }), evidenceCells: slots.map((s) => s.cell) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-chain.mjs <session>\n'); process.exit(2); }
  const session = path.resolve(target);
  readFile(path.join(session, 'state.json'), 'utf8').then((text) => validateSessionChain(root, session, JSON.parse(text))).then((errors) => {
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('chain valid\n');
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
