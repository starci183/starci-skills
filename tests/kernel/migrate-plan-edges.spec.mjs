import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { planGraphOf } from '../../scripts/route/plan-edges.mjs';
import { projectEdges } from '../../scripts/kernel/migrate-plan-edges.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'kernel', 'migrate-plan-edges.mjs');
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
const L = (ops) => ops.map((op) => ({ op }));
const CHAIN = { legs: L(['a', 'b', 'c', 'd', 'e']), edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'e'], ['d', 'e']] };

const scratch = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-mig-edges-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = ledgerFileFor(repo);
  const ledger = openLedger({ file });
  try {
    const seed = (workflowId, goal, phase = 'running') => {
      ledger.ensureWorkflow({ workflowId, title: workflowId });
      for (const to of phase === 'finished' ? ['running', 'finished'] : ['running'])
        ledger.write.changeWorkflowPhase({ workflowId, to, by: 'test', reason: 'seed' });
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId, 0, 'g', '# goal', JSON.stringify(goal), Date.now());
    };
    // b is dropped by the plan: its paths a->b->c stay a->c; an edge-carrying plan is left alone.
    seed('wf-derivable', { opChain: CHAIN, derivedPlan: { legs: L(['a', 'c', 'd', 'e']) } });
    seed('wf-underivable', { opChain: CHAIN, derivedPlan: { legs: L(['a', 'z']) } });
    seed('wf-ok', { opChain: CHAIN, derivedPlan: { legs: L(['a', 'b']), edges: [['a', 'b']] } });
    seed('wf-finished', { opChain: CHAIN, derivedPlan: { legs: L(['a', 'c', 'd', 'e']) } }, 'finished');
  } finally { ledger.close(); }
  return file;
};
const goalOf = (file, wf) => { const l = inspectLedger({ file }); try { return JSON.parse(l.db.prepare('SELECT json FROM goals WHERE workflow_id=?').get(wf).json); } finally { l.close(); } };

test('projectEdges keeps edges through dropped legs and never invents', () => {
  const p = projectEdges({ opChain: CHAIN, derivedPlan: { legs: L(['a', 'c', 'd', 'e']) } });
  assert.deepEqual(p.edges.map((e) => e.join('>')).sort(), ['a>c', 'a>e', 'c>d', 'd>e']);
  assert.deepEqual(planGraphOf({ derivedPlan: { legs: L(['a', 'c', 'd', 'e']), edges: p.edges } }).ops, ['a', 'c', 'd', 'e']);
  assert.match(projectEdges({ opChain: CHAIN, derivedPlan: { legs: L(['a', 'z']) } }).underivable, /not in the opChain/);
  assert.match(projectEdges({ opChain: { legs: L(['a', 'b']) }, derivedPlan: { legs: L(['a', 'b']) } }).underivable, /no edges/);
});

test('dry-run reports and writes nothing; --apply writes the derivable through the ledger writer with an event', (t) => {
  const file = scratch(t);
  const before = fs.readFileSync(file);
  const dry = run('--ledger', file, '--json');
  assert.equal(dry.status, 1, 'an underivable workflow makes the exit non-zero');
  const report = JSON.parse(dry.stdout);
  assert.equal(report.mode, 'dry-run');
  const status = Object.fromEntries(report.ledgers[0].findings.map((f) => [f.workflowId, f.status]));
  assert.deepEqual(status, { 'wf-derivable': 'derivable', 'wf-underivable': 'underivable', 'wf-ok': 'ok' });
  assert.equal(goalOf(file, 'wf-derivable').derivedPlan.edges, undefined, 'dry-run wrote nothing');
  assert.ok(before.length > 0);

  const applied = run('--ledger', file, '--apply', '--json');
  assert.deepEqual(JSON.parse(applied.stdout).ledgers[0].applied, ['wf-derivable']);
  assert.deepEqual(goalOf(file, 'wf-derivable').derivedPlan.edges.map((e) => e.join('>')).sort(), ['a>c', 'a>e', 'c>d', 'd>e']);
  assert.equal(goalOf(file, 'wf-underivable').derivedPlan.edges, undefined, 'underivable is left untouched');
  assert.equal(goalOf(file, 'wf-finished').derivedPlan.edges, undefined, 'finished workflows are not migrated');
  const l = inspectLedger({ file });
  try {
    const ev = l.db.prepare("SELECT payload_json FROM events WHERE workflow_id='wf-derivable' AND kind='plan-edges-migrated'").get();
    assert.deepEqual([JSON.parse(ev.payload_json).by, JSON.parse(ev.payload_json).reason], ['supervisor', 'plan-edges migration']);
  } finally { l.close(); }
  assert.equal(run('--ledger', file, '--json').status, 1, 'the underivable one still reports');
  assert.equal(JSON.parse(run('--ledger', file, '--json').stdout).ledgers[0].findings.find((f) => f.workflowId === 'wf-derivable').status, 'ok');
});
