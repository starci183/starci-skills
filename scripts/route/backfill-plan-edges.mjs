#!/usr/bin/env node
// backfill-plan-edges.mjs — give each running workflow's approved plan the
// dependency edges route-plan now emits, so a leg waits only on its ancestors.
//
//   node scripts/route/backfill-plan-edges.mjs --repo <repo> [--dry-run|--apply] [--json]
//
// Per running workflow it re-runs route-plan on the input stored with the
// goal's opChain and writes the edges into goals.json.derivedPlan.edges
// (opChain.edges when the goal has no derivedPlan). Edges are written only
// when provable: the re-run holds exactly the approved legs (a trailing
// handover.review the approved plan lacks is dropped) and every edge runs
// forward in the approved leg order, so the edges only relax the linear
// chain. Otherwise the workflow keeps the linear chain and the report says
// why. Jobs, events and every other goal field are left as they are; a second
// run finds nothing to change. Default is --dry-run.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectLedger, openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { parseJson } from '../lib/json.mjs';
import { planGraphOf, planAncestorsOf, legOpsOf } from './plan-edges.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HANDOVER_OP = 'handover.review';
const USAGE = 'use: node scripts/route/backfill-plan-edges.mjs --repo <repo> [--dry-run|--apply] [--json]';

function parseArgs(argv) {
  const a = { apply: false, json: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--repo') a.repo = argv[++i];
    else if (k === '--apply') a.apply = true;
    else if (k === '--dry-run') a.apply = false;
    else if (k === '--json') a.json = true;
    else { console.error(USAGE); process.exit(2); }
  }
  if (!a.repo) { console.error(USAGE); process.exit(2); }
  return a;
}

function rerunRoutePlan(input, repo) {
  const args = [];
  if (input?.targetJson) args.push('--target-json', input.targetJson);
  for (const t of Array.isArray(input?.targets) ? input.targets : []) args.push('--target', t);
  if (!args.length && typeof input?.text === 'string' && input.text.trim()) args.push('--text', input.text);
  if (!args.length) return { error: 'stored opChain carries no route-plan input to re-run' };
  const work = path.join(repo, '.starciwork');
  if (fs.existsSync(work)) args.push('--work', work);
  const r = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', 'route', 'route-plan.mjs'), ...args, '--json'],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot, windowsHide: true });
  const out = parseJson(r.stdout);
  if (!out) return { error: `route-plan exited ${r.status} with no JSON${r.stderr ? `: ${r.stderr.trim().slice(0, 200)}` : ''}` };
  if (out.status !== 'ok') return { error: `route-plan status ${out.status}${out.reason ? ` (${out.reason})` : ''}` };
  if (!Array.isArray(out.edges)) return { error: 'route-plan emitted no edges' };
  return { plan: out };
}

/** Edges for the approved legs, or {reason} when the re-run cannot vouch for them. */
export function provableEdges(goalJson, rerun) {
  const target = goalJson?.derivedPlan?.legs ? goalJson.derivedPlan : goalJson?.opChain;
  const approved = legOpsOf(target?.legs);
  if (!approved.length) return { reason: 'goal has no approved legs' };
  let rerunOps = legOpsOf(rerun.legs);
  let rerunEdges = rerun.edges.map((edge) => edge.map((label) => String(label).split('#')[0]));
  if (!approved.includes(HANDOVER_OP) && rerunOps.at(-1) === HANDOVER_OP) {
    rerunOps = rerunOps.slice(0, -1);
    rerunEdges = rerunEdges.filter(([from, to]) => from !== HANDOVER_OP && to !== HANDOVER_OP);
  }
  const missing = approved.filter((op) => !rerunOps.includes(op));
  const extra = rerunOps.filter((op) => !approved.includes(op));
  if (missing.length || extra.length) {
    return { reason: `re-derived legs differ from the approved plan (${[missing.length ? `approved-only ${missing.join(',')}` : '', extra.length ? `re-run-only ${extra.join(',')}` : ''].filter(Boolean).join('; ')})` };
  }
  const graph = planGraphOf({ legs: approved, edges: rerunEdges });
  if (graph.source !== 'plan') return { reason: 're-derived edges do not cover every approved leg or form a cycle' };
  const at = new Map(approved.map((op, i) => [op, i]));
  const backward = graph.edges.filter(([from, to]) => at.get(from) > at.get(to));
  if (backward.length) return { reason: `re-derived edges run against the approved order (${backward.map((e) => e.join('->')).join(', ')})` };
  return { edges: graph.edges, field: target === goalJson.derivedPlan ? 'derivedPlan' : 'opChain', approved };
}

const independentPairs = (ops, ancestors) => {
  let n = 0;
  for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) {
    if (!ancestors.get(ops[j]).includes(ops[i]) && !ancestors.get(ops[i]).includes(ops[j])) n++;
  }
  return n;
};

function assess(repo, row, goal) {
  const base = { workflowId: row.workflow_id, revision: goal?.revision ?? null };
  const goalJson = goal ? parseJson(goal.json) : null;
  if (!goalJson) return { ...base, outcome: 'linear', reason: 'workflow has no goal json' };
  if (!goalJson.opChain) return { ...base, outcome: 'linear', reason: 'goal has no stored opChain to re-run' };
  const rerun = rerunRoutePlan(goalJson.opChain.input, repo);
  if (rerun.error) return { ...base, outcome: 'linear', reason: rerun.error };
  const proof = provableEdges(goalJson, rerun.plan);
  if (!proof.edges) return { ...base, outcome: 'linear', reason: proof.reason };
  const current = goalJson[proof.field]?.edges;
  const ancestors = planAncestorsOf({ legs: proof.approved, edges: proof.edges });
  const summary = { field: `${proof.field}.edges`, legs: proof.approved.length, edges: proof.edges.length, independentPairs: independentPairs(proof.approved, ancestors) };
  if (JSON.stringify(current) === JSON.stringify(proof.edges)) return { ...base, outcome: 'unchanged', ...summary };
  return { ...base, outcome: 'edges', ...summary, write: { goalSeq: goal.goal_seq, field: proof.field, edges: proof.edges } };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(args.repo);
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) { console.error(`no ledger at ${file}`); process.exit(2); }
  const read = inspectLedger({ file });
  let results;
  try {
    const rows = read.db.prepare("SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all();
    results = rows.map((row) => assess(repo, row, read.db.prepare('SELECT goal_seq,revision,json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(row.workflow_id)));
  } finally { read.close(); }

  const pending = results.filter((r) => r.write);
  if (args.apply && pending.length) {
    const ledger = openLedger({ file });
    try {
      ledger.transaction(() => {
        for (const r of pending) {
          const goal = ledger.db.prepare('SELECT goal_seq,json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(r.workflowId);
          if (goal?.goal_seq !== r.write.goalSeq) { r.outcome = 'linear'; r.reason = 'goal revised during backfill; re-run'; continue; }
          const gj = parseJson(goal.json);
          gj[r.write.field] = { ...gj[r.write.field], edges: r.write.edges, edgesBackfilledAt: Date.now() };
          ledger.db.prepare('UPDATE goals SET json=? WHERE goal_seq=?').run(JSON.stringify(gj), goal.goal_seq);
          r.outcome = 'written';
        }
      });
    } finally { ledger.close(); }
  }
  for (const r of results) delete r.write;

  const counts = results.reduce((acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome] ?? 0) + 1 }), {});
  const out = { ok: true, repo, ledger: file, mode: args.apply ? 'apply' : 'dry-run', running: results.length, counts, workflows: results };
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`${out.mode} ${repo}: ${results.length} running — ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ') || 'nothing to do'}`);
    for (const r of results) {
      console.log(`  ${r.workflowId} rev ${r.revision ?? '-'} ${r.outcome}${r.edges !== undefined ? ` ${r.field} ${r.edges} edges over ${r.legs} legs, ${r.independentPairs} independent pairs` : ''}${r.reason ? ` — keeps the linear chain: ${r.reason}` : ''}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
