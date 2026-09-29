#!/usr/bin/env node
// migrate-plan-edges.mjs - one-shot data migration for the "plan edges are required" rule
// (contract change router-no-compat-args). A goal whose latest derivedPlan has no provable edges is
// refused plan-edges-missing by api status; this gives every such live workflow its edges once.
//
//   node scripts/kernel/migrate-plan-edges.mjs [--apply] [--machine <machine.sqlite>] [--ledger <runtime.sqlite>] [--json]
//
// Dry-run by default: reads every registered (non-retired) ledger read-only and reports; --apply writes.
// For every non-finished, non-archived workflow whose latest goal derivedPlan lacks provable edges, the
// edges are PROJECTED from the goal's own route-plan output (goals.json opChain.edges, the edges
// define-goal persisted from route-plan for the approved chain) onto the derivedPlan legs: an edge
// between two legs stays; a path through op(s) the plan no longer holds becomes an edge between the legs
// it connected. Nothing is invented: a workflow whose derivedPlan holds an op the opChain does not, whose
// opChain has no edges, or whose projection is not a provable graph is reported `underivable` and left
// untouched. A write goes through the ledger writer (updateGoalJson) inside one transaction and records
// a 'plan-edges-migrated' event {by:'supervisor', reason:'plan-edges migration', edges, source}.
import { inspectLedger, openLedger } from '../../engine/ledger-db.mjs';
import { updateGoalJson } from '../../engine/ledger-db.mjs';
import { machineFileFor, openMachine, listLedgers } from '../../engine/machine-db.mjs';
import { pathToFileURL } from 'node:url';
import { legOpsOf, planGraphOf } from '../route/plan-edges.mjs';

const opOfLabel = (label) => String(label).split('#')[0];

/** Edges of derivedPlan legs projected from the opChain edges; {edges} or {underivable: reason}. */
export function projectEdges(goal) {
  const dp = goal?.derivedPlan;
  const ops = legOpsOf(dp?.legs);
  if (!ops.length) return { underivable: 'derivedPlan holds no legs' };
  const chain = goal?.opChain;
  const chainOps = legOpsOf(chain?.legs);
  if (!Array.isArray(chain?.edges) || !chain.edges.length) return { underivable: 'opChain carries no edges to project' };
  const missing = ops.filter((op) => !chainOps.includes(op));
  if (missing.length) return { underivable: `derivedPlan legs [${missing.join(', ')}] are not in the opChain the edges describe` };
  const next = new Map(chainOps.map((op) => [op, new Set()]));
  for (const edge of chain.edges) {
    if (!Array.isArray(edge) || edge.length !== 2) return { underivable: 'opChain has a malformed edge' };
    const [from, to] = edge.map(opOfLabel);
    if (!next.has(from) || !next.has(to)) return { underivable: `opChain edge ${from}->${to} names an op outside its legs` };
    if (from !== to) next.get(from).add(to);
  }
  const kept = new Set(ops), out = new Map();
  for (const from of ops) {
    // Walk out of `from` through ops the plan no longer holds; the first held op on each path is a successor.
    const seen = new Set([from]), stack = [...next.get(from)];
    while (stack.length) {
      const op = stack.pop();
      if (seen.has(op)) continue;
      seen.add(op);
      if (kept.has(op)) out.set(`${from}\u0000${op}`, [from, op]);
      else stack.push(...next.get(op));
    }
  }
  const edges = [...out.values()];
  try { planGraphOf({ legs: ops.map((op) => ({ op })), edges }); }
  catch (error) { return { underivable: `the projected edges are not a provable graph (${error.message})` }; }
  return { edges, source: 'opChain.edges projected onto derivedPlan legs' };
}

/** Findings for one ledger file (read-only): [{workflowId, status, ...}]. */
export function inspectPlanEdges(file) {
  const ledger = inspectLedger({ file });
  const findings = [];
  try {
    const workflows = ledger.db.prepare("SELECT workflow_id, phase, archived_at FROM workflows ORDER BY workflow_id").all();
    for (const wf of workflows) {
      if (wf.phase === 'finished' || wf.archived_at !== null) continue;
      const goal = ledger.db.prepare('SELECT goal_seq, revision, json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(wf.workflow_id);
      if (!goal) continue;
      let json; try { json = JSON.parse(goal.json); } catch { findings.push({ workflowId: wf.workflow_id, status: 'underivable', reason: 'goal json unreadable' }); continue; }
      if (!json.derivedPlan?.legs?.length) continue;
      try { planGraphOf({ derivedPlan: json.derivedPlan }); findings.push({ workflowId: wf.workflow_id, goalSeq: goal.goal_seq, status: 'ok', legs: legOpsOf(json.derivedPlan.legs).length }); continue; }
      catch { /* missing edges: derive below */ }
      const p = projectEdges(json);
      findings.push(p.edges
        ? { workflowId: wf.workflow_id, goalSeq: goal.goal_seq, status: 'derivable', legs: legOpsOf(json.derivedPlan.legs).length, edges: p.edges, source: p.source }
        : { workflowId: wf.workflow_id, goalSeq: goal.goal_seq, status: 'underivable', legs: legOpsOf(json.derivedPlan.legs).length, reason: p.underivable });
    }
  } finally { ledger.close(); }
  return findings;
}

/** Writes the derivable findings of one ledger through the ledger writer; returns the applied workflow ids. */
export function applyPlanEdges(file, findings, { now = Date.now() } = {}) {
  const ledger = openLedger({ file });
  const applied = [];
  try {
    for (const f of findings.filter((item) => item.status === 'derivable')) {
      ledger.transaction(() => {
        const row = ledger.db.prepare('SELECT json FROM goals WHERE goal_seq=?').get(f.goalSeq);
        const goal = JSON.parse(row.json);
        goal.derivedPlan = { ...goal.derivedPlan, edges: f.edges };
        updateGoalJson(ledger.db, { goalSeq: f.goalSeq, goal, at: now });
        ledger.appendEvent({ workflowId: f.workflowId, entityType: 'workflow', entityId: f.workflowId, kind: 'plan-edges-migrated',
          payload: { by: 'supervisor', reason: 'plan-edges migration', edges: f.edges, source: f.source }, createdAt: now });
      });
      applied.push(f.workflowId);
    }
  } finally { ledger.close(); }
  return applied;
}

function main(argv) {
  const opt = { apply: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') opt.apply = true;
    else if (argv[i] === '--json') opt.json = true;
    else if (argv[i] === '--machine' || argv[i] === '--ledger') opt[argv[i].slice(2)] = argv[++i];
    else { console.error(`migrate-plan-edges: unknown option ${argv[i]}`); process.exit(2); }
  }
  let files;
  if (opt.ledger) files = [{ name: opt.ledger, file: opt.ledger }];
  else {
    const machine = openMachine({ file: opt.machine ?? machineFileFor() });
    try { files = listLedgers(machine).map((l) => ({ name: l.name, file: l.file })); } finally { machine.close(); }
  }
  const report = { mode: opt.apply ? 'apply' : 'dry-run', ledgers: [] };
  for (const { name, file } of files) {
    const entry = { name, file };
    try {
      entry.findings = inspectPlanEdges(file);
      if (opt.apply) entry.applied = applyPlanEdges(file, entry.findings);
    } catch (error) { entry.error = String(error?.message ?? error); }
    report.ledgers.push(entry);
  }
  if (opt.json) console.log(JSON.stringify(report, null, 2));
  else for (const l of report.ledgers) {
    console.log(`${l.name} (${l.file})${l.error ? ` ERROR ${l.error}` : ''}`);
    for (const f of l.findings ?? []) console.log(`  ${f.workflowId}: ${f.status}${f.legs ? ` (${f.legs} legs)` : ''}${f.edges ? `, ${f.edges.length} edges from ${f.source}` : ''}${f.reason ? `, ${f.reason}` : ''}`);
    if (l.applied) console.log(`  applied: ${l.applied.join(', ') || '(none)'}`);
  }
  if (report.ledgers.some((l) => l.error || (l.findings ?? []).some((f) => f.status === 'underivable'))) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
