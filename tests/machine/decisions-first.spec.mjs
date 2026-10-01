// decisions-first.spec.mjs — the api guard (scripts/machine/decisions.mjs refuseDecisionsFirst; coordinator
// 2026-09-28, fe-canon Kernel ignoring its Decision Items): an open, unclaimed Kernel DI older than 2 min refuses new
// work with its copy-paste commands; a ruling never blocks and closes once the Kernel acks the rev; a job DI whose job
// was decided closes itself; the doorbell carries the oldest item.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { BLOCK_AGE_MS, CHILD_ENV, blockingDecisions, claimDecision, getDecision, openDecisionRow, refuseDecisionsFirst, ringDoorbellWith, sweepDecisions } from '../../scripts/machine/decisions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const WF = 'wf-first';
const T0 = Date.now() - 10 * 60_000;
const fixture = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-first-'));
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  ledger.ensureWorkflow({ workflowId: WF, title: 'first' });
  return { repo, ledger };
};
const stall = (ledger, extra = {}, now = T0) => openDecisionRow(ledger, { workflowId: WF, kind: 'progress-stall', entity: { type: 'workflow', id: WF }, summary: 'no unit passed in 60 min',
  options: [{ key: 'dispatch-ready', verb: `node scripts/kernel/cli.mjs dispatch-ready --workflow ${WF}`, title: 'push the ready units' }], by: 'reconciler/workflow', ...extra }, { now }).di;
const kernelEnv = {};

test('an open, unclaimed Kernel DI older than 2 min refuses new work with the top item and its commands', (t) => {
  const { ledger } = fixture(t);
  const di = stall(ledger);
  assert.throws(() => refuseDecisionsFirst(ledger.db, WF, 'dispatch', { env: kernelEnv, resolves: null, repo: 'repo-r' }), (e) => {
    assert.equal(e.code, 'decisions-first');
    assert.equal(e.decision.id, di.id);
    assert.match(e.message, new RegExp(`Oldest: ${di.id}`));
    assert.match(e.message, /dispatch-ready --workflow wf-first/, 'the item\'s own command is in the refusal');
    assert.match(e.message, new RegExp(`decisions --repo repo-r --resolve ${di.id}`));
    return true;
  });
});

test('exempt: --resolves of a blocking item, a resolving verb\'s child, a controller, a young, a claimed item, a ruling', (t) => {
  const { ledger } = fixture(t);
  const di = stall(ledger);
  const now = Date.now();
  refuseDecisionsFirst(ledger.db, WF, 'enqueue', { env: kernelEnv, resolves: di.id, now });
  refuseDecisionsFirst(ledger.db, WF, 'enqueue', { env: { [CHILD_ENV]: '1' }, resolves: null, now });
  refuseDecisionsFirst(ledger.db, WF, 'dispatch', { env: { STARCI_ACTOR: 'reconciler/job' }, resolves: null, now });
  assert.throws(() => refuseDecisionsFirst(ledger.db, WF, 'enqueue', { env: kernelEnv, resolves: 'di-other', now }), { code: 'decisions-first' });
  claimDecision(ledger, di.id, { by: `kernel:${WF}`, now });
  assert.deepEqual(blockingDecisions(ledger.db, WF, { now }), [], 'a claimed item does not block');
  const young = stall(ledger, { idempotencyKey: 'young' }, now - BLOCK_AGE_MS + 5_000);
  assert.deepEqual(blockingDecisions(ledger.db, WF, { now }).map((d) => d.id), [], `${young.id} is younger than 2 min`);
  openDecisionRow(ledger, { workflowId: WF, kind: 'supervisor-ruling', entity: { type: 'job', id: 'op-z' }, summary: '[supervisor] a notice', by: 'supervisor' }, { now: T0 });
  assert.deepEqual(blockingDecisions(ledger.db, WF, { now }), [], 'a supervisor-ruling is a notice, never blocking');
});

test('sweep: a ruling closes once the Kernel acks the rev; a job DI whose job no longer waits on the Kernel closes', (t) => {
  const { ledger } = fixture(t);
  const ruling = openDecisionRow(ledger, { workflowId: WF, kind: 'supervisor-ruling', summary: '[supervisor] runtime landed', by: 'supervisor' }, { now: T0 }).di;
  const jobDi = openDecisionRow(ledger, { workflowId: WF, kind: 'settle-nongreen', entity: { type: 'job', id: 'op-code.refactor-gone' }, summary: 'reported done', by: 'reconciler/job' }, { now: T0 }).di;
  assert.deepEqual(blockingDecisions(ledger.db, WF), [], 'a job DI whose job is not waiting does not block');
  assert.deepEqual(sweepDecisions(ledger, WF), [jobDi.id], 'the ruling stays until the Kernel acks the rev');
  ledger.transaction(() => ledger.appendEvent({ workflowId: WF, entityType: 'workflow', entityId: WF, kind: 'runtime-rev-acked', payload: { rev: 'abc' }, createdAt: T0 + 1000 }));
  assert.deepEqual(sweepDecisions(ledger, WF), [ruling.id]);
  assert.equal(getDecision(ledger.db, ruling.id).resolution.verb, 'kernel-ack-rev');
  assert.equal(getDecision(ledger.db, jobDi.id).resolution.verb, 'job-decided');
});

test('the doorbell carries the oldest item in copy-paste form', (t) => {
  const { ledger } = fixture(t);
  const di = stall(ledger);
  const sent = [];
  const r = ringDoorbellWith({ ledger, workflowId: WF, wake: ({ text }) => { sent.push(text); return { action: 'kernel-woken', delivered: true }; }, repo: 'repo-r' });
  assert.equal(r.action, 'rung');
  assert.match(sent[0], /^\[decide\] 1 waiting: api decisions --workflow wf-first \| oldest /);
  assert.match(sent[0], new RegExp(`oldest ${di.id}`));
  assert.match(sent[0], /pick ONE: \(a\) push the ready units: node scripts\/kernel\/cli\.mjs dispatch-ready/);
  assert.match(sent[0], new RegExp(`then: node scripts/kernel/cli.mjs decisions --repo repo-r --resolve ${di.id}`));
});

test('api enqueue and dispatch-ready refuse decisions-first through the CLI; api decisions --next prints the commands', (t) => {
  const { repo, ledger } = fixture(t);
  const di = stall(ledger);
  ledger.close();
  const env = { ...process.env, NODE_NO_WARNINGS: '1' };
  delete env[CHILD_ENV]; delete env.STARCI_ACTOR;
  const run = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'kernel', 'cli.mjs'), ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, env });
  const enq = run('enqueue', '--workflow', WF, '--op', 'code.refactor', '--paths', 'src/a.ts');
  assert.equal(enq.status, 1);
  assert.match(enq.stderr, /decisions-first/);
  const push = run('dispatch-ready', '--workflow', WF, '--foreground');
  assert.equal(push.status, 1);
  assert.match(push.stderr, /decisions-first/);
  const next = run('decisions', '--workflow', WF, '--next');
  assert.equal(next.status, 0, next.stderr);
  assert.equal(JSON.parse(next.stdout).next.id, di.id);
});
