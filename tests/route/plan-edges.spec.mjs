import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { planEdgesOf, planGraphOf, planAncestorsOf } from '../../scripts/route/plan-edges.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROUTE_PLAN = path.join(ROOT, 'scripts', 'route', 'route-plan.mjs');
const DEFINE_GOAL = path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs');
const AUTH_TEXT = 'build the sign-in and sign-up authentication feature full-stack: backend api and frontend screens, with e2e and UAT proof';
const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
const json = r => JSON.parse(r.stdout);
const labelOf = l => `${l.op}${l.instance ? '#' + l.instance : ''}`;
const tmpRepo = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-edges-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};

let authPlan;
const auth = () => {
  if (!authPlan) {
    const r = run(ROUTE_PLAN, '--text', AUTH_TEXT, '--json');
    assert.equal(r.status, 0, r.stderr);
    authPlan = json(r);
  }
  return authPlan;
};

test('route-plan emits edges over its legs, each running forward in leg order', () => {
  const plan = auth();
  assert.equal(plan.status, 'ok');
  const labels = plan.legs.map(labelOf);
  assert.ok(plan.edges.length > 0);
  for (const [from, to] of plan.edges) {
    assert.ok(labels.includes(from) && labels.includes(to), `${from}->${to} names a leg`);
    assert.ok(labels.indexOf(from) < labels.indexOf(to), `${from}->${to} runs forward`);
  }
  const touched = new Set(plan.edges.flat());
  assert.deepEqual(labels.filter(l => !touched.has(l)), []);
  assert.equal(new Set(plan.edges.map(e => e.join('>'))).size, plan.edges.length);
});

test('AUTH: unrelated legs no longer depend on each other', () => {
  const plan = auth();
  const ancestors = planAncestorsOf({ legs: plan.legs, edges: plan.edges });
  const ops = plan.legs.map(l => l.op);
  assert.ok(ops.indexOf('backend.implement') < ops.indexOf('interface.implement'));
  assert.ok(!ancestors.get('interface.implement').includes('backend.implement'), 'UI build does not wait on the backend build');
  assert.ok(ancestors.get('backend.implement').includes('interface.draw'), 'backend build waits behind the same draw gate as the UI build (owner MVP flow: draw, then code FE and BE)');
  for (const op of ['business.decide', 'architecture.decide', 'interface.draw']) assert.ok(ancestors.get('work.author').includes(op), `work.author proves against the records ${op} authors`);
  assert.ok(ancestors.get('interface.implement').includes('interface.draw'), 'UI build still waits on its drawing');
  assert.ok(ancestors.get('uat.verify').includes('interface.audit'));
  assert.deepEqual(ancestors.get('handover.review'), ops.filter(op => op !== 'handover.review'));
});

test('planGraphOf: a plan without provable edges is refused plan-edges-missing (no linear fallback)', () => {
  const legs = [{ op: 'a' }, { op: 'b' }, { op: 'c' }];
  const edges = [['a', 'b'], ['a', 'c']];
  const refused = (plan) => assert.throws(() => planGraphOf(plan), { code: 'plan-edges-missing' });
  refused({ opChain: { legs } });
  refused({ derivedPlan: { legs }, opChain: null });
  // opChain's edges no longer stand in for a derivedPlan without them
  refused({ derivedPlan: { legs }, opChain: { legs, edges } });
  // edges that leave a leg untouched, name an unknown leg, or cycle are not trusted
  refused({ derivedPlan: { legs, edges: [['a', 'b']] } });
  refused({ derivedPlan: { legs, edges: [['a', 'x'], ['b', 'c']] } });
  refused({ derivedPlan: { legs, edges: [['a', 'b'], ['b', 'c'], ['c', 'a']] } });
  refused({ legs });
  assert.throws(() => planAncestorsOf({ derivedPlan: { legs } }), { code: 'plan-edges-missing' });
  // no legs, no graph; a single leg needs no edges
  assert.equal(planGraphOf({ derivedPlan: null, opChain: null }).edges.length, 0);
  assert.deepEqual(planGraphOf({ derivedPlan: { legs: [{ op: 'a' }], edges: [] } }).edges, []);
  assert.deepEqual(planGraphOf({ derivedPlan: { legs, edges } }), { ops: ['a', 'b', 'c'], edges, source: 'derivedPlan' });
  // leg labels collapse to op ids
  const staged = { legs: [{ op: 'x' }, { op: 'w', instance: 'stacks' }, { op: 'y' }], edges: [['x', 'w#stacks'], ['w#stacks', 'y']] };
  assert.deepEqual(planEdgesOf(staged), [['x', 'w'], ['w', 'y']]);
});

test('define-goal persists derivedPlan.edges alongside the opChain', t => {
  const repo = tmpRepo(t);
  const r = run(DEFINE_GOAL, '--repo', repo, '--text', AUTH_TEXT, '--json');
  assert.equal(r.status, 0, r.stderr);
  const { workflowId } = json(r);
  const ledger = inspectLedger({ file: ledgerFileFor(repo) });
  let goal;
  try { goal = JSON.parse(ledger.db.prepare('SELECT json FROM goals WHERE workflow_id=?').get(workflowId).json); }
  finally { ledger.close(); }
  assert.deepEqual(goal.derivedPlan.edges, goal.opChain.edges);
  assert.deepEqual(goal.derivedPlan.legs.map(l => l.op), goal.opChain.legs.map(l => l.op));
  assert.equal(goal.derivedPlan.derivedFrom, 'route-plan');
  assert.equal(planGraphOf(goal).source, 'derivedPlan');
  assert.ok(!planAncestorsOf(goal).get('interface.implement').includes('backend.implement'));
});
