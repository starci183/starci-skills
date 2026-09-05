// The chain is derived from the goal, never chosen from an example. planChain starts from the
// operators the mission's done-when lines name (state.json.mission.doneWhen[i].producedBy) and walks
// backwards through the operator tables scripts/validate-chain.mjs reads: a required Input pulls in
// the operator whose primary output is that kind (an in-chain producer first, then the one primary
// producer — several primaries settled by the operator the Inputs row names — then the only producer,
// else the planner refuses and names the ambiguity); a required @workspaces/<role> context pulls in a
// workspace.bind of that role; an operator with a `<domain>.plan` sibling that more than one done-when
// line names is executed after that plan, one unit per branch (the threshold is the request gate's,
// scripts/validate-request.mjs#unitGateErrors); a mission that names git.publish while a branch
// writes frontend source for real owes the audit and the walk in between (the long-flow law, stated
// in kinds); and a chain that holds any operator with an effect tool
// (scripts/validate-request.mjs#operatorEffects, the predicate the mission gate uses) opens with
// environment.preflight. Two ties the required inputs leave open are settled by the tables too: an
// optional Input orders its consumer after a producer already in the chain, and a one-way Next row
// orders the operator that hands over before the one it hands to — each unless it would close a
// cycle, in which case the hard edges win and the dropped edge is recorded. The nodes are then packed
// into steps: only branches whose dependencies all ran earlier, reached through a Next table of the
// step before, at most the orchestrator's parallel cap per step, never two writers of one alias in
// one step, a fan-out branch alone in its step so its units can expand in place. Every branch gets a
// goal: the done-when line it evidences, or the earliest later branch it enables. A kind an imported
// slot of the session already carries (scripts/validate-chain.mjs#readImportedSlots) is already
// produced: no producer is added for it when no branch of the chain produces it, the consuming
// branch records which slot it reads (`imports`), and the preview says where the kind came from.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages } from './operator-md.mjs';
import { operatorEffects } from './validate-request.mjs';
import { operatorGraph, loadOperatorGraph, loadMaxParallel, readImportedSlots, producersOf, primaryProducerOf, writesSurface, planOf, cellOf, stepOf, parallelOf, SURFACE_AUDIT_KIND, WALK_OPERATOR, PUBLISH_OPERATOR, DEPLOY_OPERATOR, BIND_OPERATOR, PREFLIGHT_OPERATOR, UNITS_KIND } from './validate-chain.mjs';

export class PlanError extends Error { constructor(errors) { super(errors.join('\n')); this.errors = errors; } }

const bindKey = (role) => `${BIND_OPERATOR}#${role}`;
const byKey = (a, b) => a.localeCompare(b);

// The operators that touch a runtime: their presence makes the preflight check the runtime family of every bound role.
const RUNTIME_OPERATORS = new Set(['runtime.serve', 'interface.audit', 'uat.verify']);

export function planChain({ packages, mission, options = {} }) {
  const graph = options.graph ?? operatorGraph(packages, options.aliases ?? {});
  const maxParallel = options.maxParallel ?? 3;
  const presetsOf = (id) => ({ ...(options.requirements?.[id] ?? {}) });
  const errors = [];
  const lines = mission?.doneWhen ?? [];
  if (!lines.length) throw new PlanError(['mission.doneWhen is empty; a chain is planned from the done-when lines, and a mission with none does not start']);
  const nodes = new Map(); // key -> { key, operator, presets, deps (hard), soft (optional inputs), order (Next direction), reasons, target, lines, fanout, dropped, imports (kind -> imported slot) }
  // The session's imported slots (options.imported, readImportedSlots): a required kind one of them carries is already produced.
  const importedSlotFor = (kind) => (options.imported ?? []).find((s) => s.outputs?.[kind] !== undefined) ?? null;
  const add = (key, operator, presets = {}, reason = null) => {
    if (!graph.has(operator)) { errors.push(`${operator} is not an operator of this tree`); return null; }
    let n = nodes.get(key);
    if (!n) { n = { key, operator, presets: { ...presetsOf(operator), ...presets }, deps: new Set(), soft: new Set(), order: new Set(), reasons: [], target: null, lines: [], fanout: null, dropped: [], imports: {} }; nodes.set(key, n); }
    if (reason && !n.reasons.includes(reason)) n.reasons.push(reason);
    return n;
  };
  const inChain = (operator) => [...nodes.values()].filter((n) => n.operator === operator).map((n) => n.key);
  // The in-chain producers of a kind for one consumer. When the consumer's Inputs row names operators
  // and some of them are in the chain, only those count: a shared kind (units, changes) is read from
  // the producer the row names, never from every branch that happens to emit it.
  const producersInChain = (input, consumer) => {
    const all = [...nodes.values()].filter((n) => n.key !== consumer.key && n.operator !== consumer.operator && graph.get(n.operator).outputs.has(input.kind));
    const named = all.filter((n) => input.from.includes(n.operator));
    let picked = named.length ? named : all;
    // Several bindings in the chain: a consumer that requires a role reads the binding of that role.
    const roles = graph.get(consumer.operator).roles;
    const binds = picked.filter((n) => n.operator === BIND_OPERATOR);
    if (binds.length > 1 && roles.size) { const mine = binds.filter((n) => roles.has(n.presets.role)); if (mine.length) picked = [...picked.filter((n) => n.operator !== BIND_OPERATOR), ...mine]; }
    // Several branches of one operator: which of them a consumer reads is settled by the mission's own
    // order of done-when lines. A consumer that evidences line n reads the branches whose lines come
    // before it, and not the ones that come after — a later branch of the same operator is another
    // route, another finding or a later head, and depending on it would order every consumer after work
    // it never reads. A consumer with no line of its own (a bind, a preflight) reads them all, and a
    // consumer whose producers all come after it still reads the earliest, because it must read one.
    const line = consumer.target ?? Infinity;
    const byOperator = new Map();
    for (const n of picked) if (n.operator !== BIND_OPERATOR) byOperator.set(n.operator, [...(byOperator.get(n.operator) ?? []), n]);
    for (const [operator, branches] of byOperator) {
      if (branches.length < 2) continue;
      const earlier = branches.filter((n) => (n.target ?? -1) < line);
      const kept = new Set((earlier.length ? earlier : [branches[0]]).map((n) => n.key));
      picked = picked.filter((n) => n.operator !== operator || kept.has(n.key));
    }
    return picked.map((n) => n.key);
  };
  const depend = (n, key) => { if (key !== n.key) n.deps.add(key); };

  // 1. Targets: one node per operator the done-when lines name; a second line for the same operator
  //    is a unit of its fan-out when the operator has a plan, else a second branch after the first.
  const fanned = new Set(); // operators more than one line names and whose domain has a plan
  lines.forEach((line, i) => {
    const id = line.producedBy;
    if (!graph.has(id)) { errors.push(`doneWhen[${i}] "${line.evidence}" names ${id}, which is not an operator`); return; }
    const existing = inChain(id);
    if (existing.length && planOf(graph, id)) fanned.add(id);
    if (existing.length && !planOf(graph, id)) {
      const n = add(`${id}#${i}`, id, {}, `evidence for done-when ${i}: "${line.evidence}"`);
      n.target = i; n.lines.push(i); depend(n, existing[existing.length - 1]);
      return;
    }
    const n = add(existing[0] ?? id, id, {}, `evidence for done-when ${i}: "${line.evidence}"`);
    if (n.target === null) n.target = i;
    n.lines.push(i);
  });
  if (errors.length) throw new PlanError(errors);

  // 2. Closure: every node's required inputs, context roles and plan sibling, until nothing is added.
  const resolved = new Set();
  const producerFor = (consumer, input) => {
    const found = producersInChain(input, consumer);
    if (found.length) return found;
    const candidates = producersOf(graph, input.kind, consumer.operator);
    if (!candidates.length) { errors.push(`${consumer.operator} requires input ${input.kind}, which no operator produces`); return []; }
    const primaries = candidates.filter((id) => graph.get(id).primary === input.kind);
    if (primaries.length === 1) return primaries;
    if (primaries.length > 1) {
      const named = input.from.find((id) => primaries.includes(id));
      if (named) return [named];
      errors.push(`${consumer.operator} requires input ${input.kind}, and ${primaries.join(', ')} all name it as their primary output; the Inputs row of ${consumer.operator} must name which one it reads from`);
      return [];
    }
    if (candidates.length === 1) return candidates;
    errors.push(`${consumer.operator} requires input ${input.kind}, which ${candidates.join(', ')} produce and none as its primary output; the planner cannot choose between them`);
    return [];
  };
  const closure = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of [...nodes.values()]) {
        if (resolved.has(n.key)) continue;
        resolved.add(n.key); changed = true;
        const op = graph.get(n.operator);
        for (const role of op.roles) {
          const b = add(bindKey(role), BIND_OPERATOR, { role }, `binds @workspaces/${role}, which ${n.operator} requires`);
          if (b) depend(n, b.key);
        }
        for (const input of op.required) {
          // A producer already in the chain first; else a slot the session imported; else the tables.
          const slot = producersInChain(input, n).length ? null : importedSlotFor(input.kind);
          if (slot) { n.imports[input.kind] = slot; continue; }
          for (const key of producerFor(n, input)) {
            const p = nodes.get(key) ?? add(key, key, {}, `produces ${input.kind}, which ${n.operator} requires`);
            if (!p) continue;
            const why = `produces ${input.kind}, which ${n.operator} requires`;
            if (!p.reasons.includes(why) && !p.reasons.some((r) => r.startsWith(`produces ${input.kind},`))) p.reasons.push(why);
            depend(n, p.key);
          }
        }
        // More than one done-when line names this operator and its domain has a plan: the plan runs first and
        // this branch fans out by unit (one line needs no map; validate-request#unitGateErrors draws the same line).
        const plan = fanned.has(n.operator) ? planOf(graph, n.operator) : null;
        if (plan) {
          const p = add(plan.id, plan.id, {}, `lists the ${UNITS_KIND} ${n.operator} fans out over, one unit per branch`);
          if (p) { depend(n, p.key); n.fanout = UNITS_KIND; }
        }
      }
    }
  };
  closure();
  if (errors.length) throw new PlanError(errors);

  // 3. The long-flow law: a published surface that was written for real is audited and walked in between.
  const publish = nodes.get(PUBLISH_OPERATOR);
  const writers = [...nodes.values()].filter((n) => writesSurface(graph.get(n.operator), n.presets));
  if (publish && writers.length) {
    const auditId = primaryProducerOf(graph, SURFACE_AUDIT_KIND);
    if (!auditId) errors.push(`the long-flow law needs an operator whose primary output is ${SURFACE_AUDIT_KIND}, and none declares it`);
    if (!graph.has(WALK_OPERATOR)) errors.push(`the long-flow law needs ${WALK_OPERATOR}, which is not an operator of this tree`);
    if (errors.length) throw new PlanError(errors);
    const why = `the long-flow law: ${writers.map((w) => w.operator).join(', ')} writes a surface that ${PUBLISH_OPERATOR} publishes, so it is audited and walked first`;
    const audit = add(auditId, auditId, {}, why);
    const walk = add(WALK_OPERATOR, WALK_OPERATOR, {}, why);
    for (const w of writers) depend(audit, w.key);
    depend(walk, audit.key);
    depend(publish, audit.key); depend(publish, walk.key);
    closure();
    if (errors.length) throw new PlanError(errors);
  }
  // 4. The roles the mission declares are bound even when no table pulls them in, and every working
  //    branch runs after that binding: the mission said which checkout the work is on.
  for (const role of options.roles ?? []) {
    const b = add(bindKey(role), BIND_OPERATOR, { role }, `binds @workspaces/${role}, which the mission declares`);
    if (b) for (const n of nodes.values()) if (n.operator !== BIND_OPERATOR && n.operator !== PREFLIGHT_OPERATOR) depend(n, b.key);
  }
  closure();
  if (errors.length) throw new PlanError(errors);
  // 5. Readiness opens every chain that writes source or touches a runtime.
  const effectful = [...new Set([...nodes.values()].filter((n) => graph.get(n.operator).effects).map((n) => n.operator))].sort();
  if (effectful.length && graph.has(PREFLIGHT_OPERATOR)) {
    const roles = [...new Set([...nodes.values()].filter((n) => n.operator === BIND_OPERATOR).map((n) => n.presets.role))].sort();
    const tools = [...new Set(effectful.flatMap((id) => operatorEffects(graph.get(id).pkg).map((t) => t.id)))].sort();
    // A runtime is owed only by a chain that serves, observes or walks one: then every bound role's runtime is checked, else none.
    const touchesRuntime = [...nodes.values()].some((n) => RUNTIME_OPERATORS.has(n.operator));
    const pre = add(PREFLIGHT_OPERATOR, PREFLIGHT_OPERATOR, roles.length ? { roles, runtimeRoles: touchesRuntime ? roles : [] } : {}, `opens the chain: ${effectful.join(', ')} hold ${tools.join(', ')}`);
    for (const n of nodes.values()) if (n.key !== pre.key) depend(n, pre.key);
    closure();
  }
  if (errors.length) throw new PlanError(errors);
  // 6. Soft edges: an optional input orders its consumer after an in-chain producer, unless that closes a cycle.
  const reaches = (from, to, edges) => { const seen = new Set(); const stack = [from]; while (stack.length) { const k = stack.pop(); if (k === to) return true; if (seen.has(k)) continue; seen.add(k); for (const d of edges.get(k) ?? []) stack.push(d); } return false; };
  const edges = new Map([...nodes.values()].map((n) => [n.key, new Set(n.deps)]));
  const sorted = [...nodes.values()].sort((a, b) => byKey(a.key, b.key));
  for (const n of sorted) {
    for (const input of graph.get(n.operator).optional) {
      for (const key of producersInChain(input, n).sort(byKey)) {
        if (edges.get(n.key).has(key)) continue;
        // n after key: illegal when key already runs after n.
        if (reaches(key, n.key, edges)) { n.dropped.push(`${key} → ${n.key} (optional ${input.kind}) would close a cycle`); continue; }
        edges.get(n.key).add(key); n.soft.add(key);
      }
    }
  }
  // A one-way Next row between two in-chain operators (A hands to B, B never hands to A) orders A first,
  // again unless that closes a cycle: the tables' own direction decides ties the inputs leave open.
  for (const a of sorted) {
    for (const b of sorted) {
      if (a.key === b.key || a.operator === b.operator) continue;
      const ab = graph.get(a.operator).next.has(b.operator); const ba = graph.get(b.operator).next.has(a.operator);
      if (!ab || ba || edges.get(b.key).has(a.key)) continue;
      if (reaches(a.key, b.key, edges)) { b.dropped.push(`${a.key} → ${b.key} (Next) would close a cycle`); continue; }
      edges.get(b.key).add(a.key); b.order.add(a.key);
    }
  }
  // 7. Packing.
  const descendants = (key) => { const seen = new Set(); const stack = [key]; while (stack.length) { const k = stack.pop(); for (const [other, deps] of edges) if (deps.has(k) && !seen.has(other)) { seen.add(other); stack.push(other); } } return seen.size; };
  const weight = new Map([...nodes.keys()].map((k) => [k, descendants(k)]));
  const placed = new Map(); // key -> step index
  const steps = [];
  while (placed.size < nodes.size) {
    const ready = [...nodes.keys()].filter((k) => !placed.has(k) && [...edges.get(k)].every((d) => placed.has(d))).sort((a, b) => weight.get(b) - weight.get(a) || byKey(a, b));
    if (!ready.length) throw new PlanError([`the chain has a cycle among ${[...nodes.keys()].filter((k) => !placed.has(k)).join(', ')}`]);
    const previous = steps.length ? steps[steps.length - 1].map((k) => nodes.get(k).operator) : null;
    // A publish or a deploy ends the chain: it is placed only when nothing else is left to place —
    // that is, when every node still unplaced is itself a boundary. A mission that publishes two routes
    // holds two of them, one after the other, and the second is not a reason to hold the first back.
    const terminal = (k) => [PUBLISH_OPERATOR, DEPLOY_OPERATOR].includes(nodes.get(k).operator);
    const working = [...nodes.keys()].some((k) => !placed.has(k) && !terminal(k));
    const pending = ready.filter((k) => !terminal(k) || !working);
    const allowed = previous ? pending.filter((k) => previous.some((p) => p === nodes.get(k).operator || graph.get(p).next.has(nodes.get(k).operator))) : pending;
    if (!allowed.length) throw new PlanError([`${(pending.length ? pending : ready).map((k) => nodes.get(k).operator).join(', ')} could run next, and no Next table of ${(previous ?? []).join(', ')} permits any of them${pending.length ? '' : ' before the chain ends'}`]);
    const chosen = [];
    const writes = new Set();
    for (const k of allowed) {
      if (chosen.length >= maxParallel) break;
      const n = nodes.get(k);
      if (n.fanout) { if (!chosen.length) chosen.push(k); break; } // a fan-out branch stands alone so its units expand in place
      const w = graph.get(n.operator).writes;
      if ([...w].some((a) => writes.has(a))) continue;
      for (const a of w) writes.add(a);
      chosen.push(k);
    }
    chosen.sort(byKey);
    steps.push(chosen);
    for (const k of chosen) placed.set(k, steps.length - 1);
  }
  // 8. Cells, goals, reasons.
  const cell = new Map();
  steps.forEach((step, n) => step.forEach((k, m) => cell.set(k, cellOf(n + 1, m + 1))));
  const chain = steps.map((step) => step.map((k) => cell.get(k)));
  const out = { chain, steps: {}, goals: {}, reasons: {}, presets: {}, fanout: {}, imports: {}, dropped: [], ends: 'user' };
  for (const step of chain) for (const c of step) {
    const k = [...cell].find(([, v]) => v === c)[0];
    const n = nodes.get(k);
    out.steps[c] = n.operator;
    if (Object.keys(n.presets).length) out.presets[c] = n.presets;
    if (n.fanout) out.fanout[c] = n.fanout;
    // What the branch reads from an imported slot: kind -> { input (the request's inputs.<kind> path), the slot's cell and origin }.
    for (const [kind, slot] of Object.entries(n.imports)) (out.imports[c] ??= {})[kind] = { input: slot.outputs[kind], cell: slot.cell, sourceSessionId: slot.sourceSessionId, sourceStep: slot.sourceStep, sourceParallel: slot.sourceParallel };
    if (n.target !== null) out.goals[c] = { doneWhen: n.target };
    else {
      // What this branch enables: the earliest later branch that depends on it through a required input, a
      // bound role, the law or an optional input — never through the Next-direction ordering alone.
      const enabled = [...nodes.values()].filter((o) => o.deps.has(k) || o.soft.has(k)).map((o) => cell.get(o.key)).filter((x) => stepOf(x) > stepOf(c)).sort((a, b) => stepOf(a) - stepOf(b) || parallelOf(a) - parallelOf(b))[0];
      const next = chain[stepOf(c)]?.[0];
      if (enabled ?? next) out.goals[c] = { prerequisite: enabled ?? next };
      else errors.push(`${c} ${n.operator} evidences no done-when line and enables no later branch; the planner cannot say what it is for`);
    }
    out.reasons[c] = n.reasons.join('; ');
    for (const d of n.dropped) out.dropped.push(d);
  }
  if (errors.length) throw new PlanError(errors);
  const lastOps = chain[chain.length - 1].map((c) => out.steps[c]);
  out.ends = lastOps.includes(PUBLISH_OPERATOR) ? PUBLISH_OPERATOR : lastOps.includes(DEPLOY_OPERATOR) ? DEPLOY_OPERATOR : 'user';
  return out;
}

// The two-line preview of a planned chain, one pair per branch: the goal, then why the branch is there.
export function previewChain(plan, mission) {
  const out = [];
  for (const step of plan.chain) for (const c of step) {
    const op = plan.steps[c];
    const goal = plan.goals[c];
    const line = goal.doneWhen !== undefined ? `doneWhen:${goal.doneWhen} ${mission?.doneWhen?.[goal.doneWhen]?.evidence ?? ''}`.trim() : `prerequisite: ${goal.prerequisite}`;
    const extras = [plan.reasons[c], plan.presets[c] ? Object.entries(plan.presets[c]).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') : null, plan.fanout[c] ? `fanout: ${plan.fanout[c]}` : null].filter(Boolean);
    out.push(`[${c} ${op}] goal: ${line}`);
    out.push(`[${c} ${op}] ${extras.join(' · ')}`);
    for (const [kind, from] of Object.entries(plan.imports?.[c] ?? {})) out.push(`[${c} ${op}] ${kind} imported from ${from.sourceSessionId} step ${from.sourceStep} (${from.input})`);
  }
  out.push(`ends: ${plan.ends}`);
  return out.join('\n');
}

export async function planSession(root, session, flags = {}) {
  const state = JSON.parse(await readFile(path.join(session, 'state.json'), 'utf8'));
  if (!state.mission) throw new PlanError(['state.json carries no mission; the chain is planned from mission.doneWhen']);
  const packages = await loadOperatorPackages(root);
  const graph = await loadOperatorGraph(root, packages);
  const imported = await readImportedSlots(session, graph, root);
  const plan = planChain({ packages, mission: state.mission, options: { graph, maxParallel: await loadMaxParallel(root), roles: flags.roles ?? [], requirements: flags.requirements ?? {}, imported } });
  return { state, plan };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--') && !(args[args.indexOf(a) - 1] ?? '').startsWith('--'));
  if (!target) { process.stderr.write('usage: node scripts/plan-chain.mjs <session> [--roles fe,be] [--preset <operator>.<field>=<value>]...\n'); process.exit(2); }
  const flags = { roles: [], requirements: {} };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--roles') flags.roles = (args[++i] ?? '').split(',').filter(Boolean);
    else if (args[i] === '--preset') { const m = /^(.+)\.([^.=]+)=(.*)$/.exec(args[++i] ?? ''); if (m) (flags.requirements[m[1]] ??= {})[m[2]] = m[3]; }
  }
  planSession(root, path.resolve(target), flags).then(({ state, plan }) => {
    process.stdout.write(`${previewChain(plan, state.mission)}\n\n${JSON.stringify(plan, null, 2)}\n`);
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
