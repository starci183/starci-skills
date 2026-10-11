// Replay of the silent Kernel start refusal (2026-10-09, alpha.8 live; registry: kernel-start-refusals-are-not-counted): a Kernel launch of unknown outcome keeps the signal `launch-unknown`,
// and `start-workflow` answers `kernel-launch-unreconciled` to the watchdog on every pass, every two minutes, for hours. The refusal was printed before the start claimed anything,
// so it recorded no `kernel-start-failed`; the start-hold rule counts only that event, so no bound was ever spent, the seat was never held, no Decision Item was opened and the
// digest could not name a loop. The same held for every refusal that was not on the watchdog's list of four (the sender terminal missing, a terminal that cannot be verified).
// Real: the watchdog and its rotation, the start-hold rule, the ledger. Stubbed: the Orca binary and the Kernel launch (the start answers the refusal the live host printed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadFixture, replayWorld, ROOT } from '../helpers/replay-world.mjs';
import { runtimeRevNow, startFailureRun, startHoldBudget, startHoldOf } from '../../scripts/kernel/start-hold.mjs';

const HANGS = pathToFileURL(path.join(ROOT, 'tests', 'helpers', 'replay-start-hangs.mjs')).href;
const WATCHDOG = path.join(ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs');
const changed = { 'modules/kernel/kernel-prompt.md': 'Kernel prompt, a rule reversed\n' };

/** A world with a live Kernel, the notice baseline adopted, and a contract-changing revision deployed: the watchdog will try to replace the Kernel. */
function deployed(t) {
  const world = replayWorld(t, loadFixture('leg-ready'), { tree: true, launch: true });
  fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({ terminals: {
    'term-runtime-shell': { handle: 'term-runtime-shell', worktree: ROOT, title: 'shell' },
    'term-kernel-current': { handle: 'term-kernel-current', worktree: world.tree.dir, title: '[Kernel] wf-1' } } }));
  assert.equal(world.ack([]).status, 0);
  world.reviseRuntime(changed, 'a revision that reverses a rule of the Kernel contract');
  return world;
}
const watchdog = (world, refusal) => {
  const run = spawnSync(process.execPath, ['--import', HANGS, WATCHDOG, '--repo', world.repo, '--workflow', world.wf, '--once', '--repair', '--json'],
    { cwd: ROOT, encoding: 'utf8', env: { ...world.env, ORCA_TERMINAL_HANDLE: 'term-kernel-current', STARCI_REPLAY_START_ANSWER: JSON.stringify(refusal) }, timeout: 300_000 });
  assert.ok(run.stdout.trim(), `watchdog said nothing (exit ${run.status}): ${run.stderr.slice(0, 800)}`);
  return JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
};
const failures = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-start-failed' ORDER BY seq").all().map((row) => JSON.parse(row.payload_json)));
const holdOf = (world) => world.ledger((ledger) => startHoldOf(startFailureRun(ledger.db, world.wf), { now: Date.now(), budget: startHoldBudget(), rev: runtimeRevNow() }));
const unreconciled = (world) => ({ ok: false, step: 'kernel-launch-unreconciled', workflowId: world.wf,
  recovery: { ok: false, reason: 'kernel-launch-custody-incomplete', effectState: 'unknown' } });

test('a start refused as kernel-launch-unreconciled is journalled as a failed launch under the revision, with the reason the recovery gave', (t) => {
  const world = deployed(t);
  const answer = watchdog(world, unreconciled(world));
  assert.equal(answer.action, 'restart-failed');
  assert.equal(answer.reason, 'kernel-launch-unreconciled');
  const [failed, ...rest] = failures(world);
  assert.equal(rest.length, 0, 'one refusal, one journal row');
  assert.deepEqual([failed.step, failed.reason, failed.runtimeRev], ['kernel-launch-unreconciled', 'kernel-launch-unreconciled', runtimeRevNow()]);
  assert.match(failed.error, /kernel-launch-custody-incomplete/, 'the cause the recovery named is kept');
});

test('the same refusal again and again spends the bound: the launch is held for its cause instead of repeating silently', (t) => {
  const world = deployed(t);
  const rev = runtimeRevNow();
  world.ledger((ledger) => ledger.transaction(() => {
    for (let i = 0; i < 2; i += 1) ledger.appendEvent({ workflowId: world.wf, entityType: 'kernel', entityId: world.wf, kind: 'kernel-start-failed', createdAt: Date.now() - (3 - i) * 3_600_000,
      payload: { step: 'kernel-launch-unreconciled', reason: 'kernel-launch-unreconciled', error: 'kernel-launch-custody-incomplete', runtimeRev: rev } });
  }));
  assert.equal(holdOf(world), null, 'two refusals have not spent the bound');
  watchdog(world, unreconciled(world));
  const hold = holdOf(world);
  assert.equal(hold?.state, 'held', 'the third refusal of one cause holds the launch');
  assert.equal(hold.step, 'kernel-launch-unreconciled');
  assert.equal(hold.count, 3);
});

test('a start refused for a missing sender terminal is counted too, not only the four refusals the watchdog used to list', (t) => {
  const world = deployed(t);
  watchdog(world, { ok: false, step: 'workflow-sender-terminal-missing', workflowId: world.wf, error: 'no terminal to launch from' });
  const [failed] = failures(world);
  assert.deepEqual([failed.step, failed.error], ['workflow-sender-terminal-missing', 'no terminal to launch from']);
});

test('an answer that is not a failed launch (Orca not answering, a Kernel whose Dispatch lives) leaves the journal alone', (t) => {
  const world = deployed(t);
  watchdog(world, { ok: false, step: 'host-unavailable', workflowId: world.wf, error: 'orca does not answer' });
  watchdog(world, { ok: false, step: 'kernel-worker-alive', workflowId: world.wf, error: 'the Dispatch is alive' });
  assert.deepEqual(failures(world), []);
});

// The codes on the Kernel-launch chain (catalogued surfacedBy decision-item / seat-unrecoverable): each reaches the start-hold through the watchdog journal.
// The recovery's reasons ride in the refusal kernel-launch-unreconciled; the others are the refusal's own step.
const RECOVERY_REASONS = ['kernel-launch-custody-incomplete', 'kernel-launch-host-unavailable', 'kernel-launch-dispatch-unsettled', 'kernel-launch-terminal-unproven',
  'kernel-launch-runs-unreadable', 'kernel-launch-run-exists', 'kernel-launch-worker-live', 'kernel-launch-terminal-unnamed', 'kernel-launch-dispatch-mismatch'];
const OWN_STEPS = ['kernel-start-reservation-lost', 'kernel-guard-unbound', 'kernel-seat-publication-failed', 'worktree-registry-unavailable'];

for (const reason of RECOVERY_REASONS) {
  test(`${reason}: the refusal that carries it is journalled with that reason`, (t) => {
    const world = deployed(t);
    watchdog(world, { ok: false, step: 'kernel-launch-unreconciled', workflowId: world.wf, recovery: { ok: false, reason, effectState: 'unknown' } });
    const [failed, ...rest] = failures(world);
    assert.equal(rest.length, 0);
    assert.deepEqual([failed.step, failed.runtimeRev], ['kernel-launch-unreconciled', runtimeRevNow()]);
    assert.match(failed.error, new RegExp(reason));
  });
}

for (const step of OWN_STEPS) {
  test(`${step}: the refusal is journalled under its own step and, repeated, holds the launch`, (t) => {
    const world = deployed(t);
    const rev = runtimeRevNow();
    world.ledger((ledger) => ledger.transaction(() => {
      for (let i = 0; i < 2; i += 1) ledger.appendEvent({ workflowId: world.wf, entityType: 'kernel', entityId: world.wf, kind: 'kernel-start-failed', createdAt: Date.now() - (3 - i) * 3_600_000,
        payload: { step, reason: step, error: step, runtimeRev: rev } });
    }));
    watchdog(world, { ok: false, step, workflowId: world.wf, error: `${step} refused` });
    assert.equal(failures(world).at(-1).step, step);
    assert.deepEqual([holdOf(world)?.state, holdOf(world)?.step], ['held', step]);
  });
}
