// The Kernel launch that fails again for the same cause is bounded: it backs off, is held after the declared number of failures,
// and one launch is let through when the hold has passed (scripts/kernel/start-hold.mjs, the workflow start's startBar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startBar } from '../../scripts/kernel/workflow-startup.mjs';
import { startCauseOf, startFailureRun, startHoldBudget, startHoldOf, holdSummary } from '../../scripts/kernel/start-hold.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const budget = { intervalMs: 60_000, maxIntervalMs: 900_000, maxAttempts: 3, heldRetryMs: 3_600_000 };
const T0 = 1_800_000_000_000;
const workflowId = 'wf-start-hold';
const locked = (path) => ({ step: 'workflow-worktree-install', reason: 'workflow-worktree-install-locked', error: `npm error code EPERM\nnpm error path ${path}`,
  install: { receipt: { cause: 'file-locked', code: 'EPERM', path, holders: [{ pid: 4242, name: 'node.exe' }] } } });

function fail(ledger, at, payload) {
  ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: 1, kind: 'kernel-start-failed', payload, createdAt: at });
}
const world = (t, fn) => withLedger(t, ({ ledger }) => { seedWorkflow(ledger, { id: workflowId, now: T0 - 10 }); return fn(ledger); });

test('the bound is declared in host.yaml and refuses a missing number by its key', () => {
  assert.deepEqual(startHoldBudget(), { intervalMs: 60_000, maxIntervalMs: 900_000, maxAttempts: 3, heldRetryMs: 3_600_000 });
  assert.throws(() => startHoldBudget(() => ({ seats: { kernel: { startRetryMs: 1, startRetryMaxMs: 1, startSameCauseMax: 0, startHeldRetryMs: 1 } } })), /startSameCauseMax/);
});

test('one failure backs the next launch off, and the launch is free again once the interval has passed', (t) => world(t, (ledger) => {
  fail(ledger, T0, locked('D:/tree/node_modules/a.node'));
  const run = startFailureRun(ledger.db, workflowId);
  assert.equal(run.length, 1);
  const hold = startHoldOf(run, { now: T0 + 10_000, budget });
  assert.equal(hold.state, 'backoff');
  assert.equal(hold.retryAtMs, T0 + 60_000);
  assert.equal(startHoldOf(run, { now: T0 + 60_000, budget }), null);
}));

test('the same cause failing the declared number of times holds the launch, with the cause and the evidence', (t) => world(t, (ledger) => {
  fail(ledger, T0, locked('D:/tree/node_modules/a.node'));
  fail(ledger, T0 + 100_000, locked('D:/tree/node_modules/b.node'));
  fail(ledger, T0 + 300_000, locked('D:/tree/node_modules/c.node'));
  const hold = startHoldOf(startFailureRun(ledger.db, workflowId), { now: T0 + 400_000, budget });
  assert.equal(hold.state, 'held');
  assert.equal(hold.count, 3);
  assert.equal(hold.step, 'workflow-worktree-install');
  assert.equal(hold.reason, 'workflow-worktree-install-locked');
  assert.equal(hold.lockedPath, 'D:/tree/node_modules/c.node');
  assert.deepEqual(hold.holders, [{ pid: 4242, name: 'node.exe' }]);
  assert.equal(hold.retryAtMs, T0 + 300_000 + budget.heldRetryMs);
  assert.match(holdSummary(hold), /3 Kernel launches failed at workflow-worktree-install for one cause, held/);
  assert.equal(startHoldOf(startFailureRun(ledger.db, workflowId), { now: T0 + 300_000 + budget.heldRetryMs, budget }), null, 'one launch is let through when the hold has passed');
}));

test('303 ticks of a seat pass launch a handful of times, not 303', (t) => world(t, (ledger) => {
  let launches = 0;
  for (let now = T0; now < T0 + 3 * 3_600_000; now += 51_000) {
    if (startHoldOf(startFailureRun(ledger.db, workflowId), { now, budget })) continue;
    launches += 1;
    fail(ledger, now, locked('D:/tree/node_modules/a.node'));
  }
  assert.ok(launches <= 7, `launched ${launches} times in three hours`);
  assert.ok(launches >= 3);
}));

test('two causes that alternate are still a loop, and a fall-through to the next member is not a launch', (t) => world(t, (ledger) => {
  const a = { step: 'launch-trust', error: 'hooks do not show the guard' };
  const b = { step: 'admission', error: 'no eligible candidate' };
  fail(ledger, T0, a); fail(ledger, T0 + 1000, { ...b, fellThroughTo: { agent: 'claude' } }); fail(ledger, T0 + 2000, b);
  fail(ledger, T0 + 200_000, a); fail(ledger, T0 + 400_000, b); fail(ledger, T0 + 600_000, a);
  const run = startFailureRun(ledger.db, workflowId);
  assert.equal(run.length, 5, 'the fall-through row is not counted');
  const hold = startHoldOf(run, { now: T0 + 601_000, budget });
  assert.equal(hold.state, 'held');
  assert.equal(hold.step, 'launch-trust');
  assert.equal(hold.count, 3);
}));

test('a Kernel launch that stands ends the run', (t) => world(t, (ledger) => {
  fail(ledger, T0, locked('D:/tree/node_modules/a.node'));
  fail(ledger, T0 + 100_000, locked('D:/tree/node_modules/a.node'));
  fail(ledger, T0 + 300_000, locked('D:/tree/node_modules/a.node'));
  ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: 1, kind: 'kernel-booted', payload: {}, createdAt: T0 + 310_000 });
  assert.deepEqual(startFailureRun(ledger.db, workflowId), []);
  assert.equal(startHoldOf([], { now: T0 + 311_000, budget }), null);
}));

test('the cause is the step and the typed reason, else the first line of the error with its numbers folded', () => {
  assert.equal(startCauseOf({ step: 'a', reason: 'r', error: 'x' }), 'a|r');
  assert.equal(startCauseOf({ step: 'a', error: 'port 3001 busy\nmore' }), 'a|error:port #### busy'.replace('####', '#'));
});

test('startBar refuses the watchdog launch of a held cause and leaves the Supervisor and a startable goal alone', (t) => world(t, (ledger) => {
  for (const [i, at] of [T0, T0 + 100_000, T0 + 300_000].entries()) fail(ledger, at, locked(`D:/tree/node_modules/${i}.node`));
  const ok = { ok: true };
  const now = T0 + 400_000;
  const barred = startBar({ authority: ok, launchedBy: 'watchdog', db: ledger.db, workflowId, now, budget: () => budget });
  assert.equal(barred.step, 'kernel-start-held');
  assert.equal(barred.fields.hold.state, 'held');
  assert.match(barred.fields.error, /held/);
  assert.equal(startBar({ authority: ok, launchedBy: 'supervisor', db: ledger.db, workflowId, now, budget: () => budget }), null);
  assert.equal(startBar({ authority: { ok: false, reason: 'workflow-approval-required' }, launchedBy: 'watchdog', db: ledger.db, workflowId, now, budget: () => budget }).step, 'workflow-approval-required');
}));
