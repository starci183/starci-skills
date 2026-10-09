// Replay of the first live deploy with the role-scoped revision notice (2026-10-09, runtime 70b853e44; registry: contract-replace-leaves-no-kernel-and-no-cause): the deploy changed
// the Kernel's contract, the watchdog replaced both Kernels (contract-changed), closed the old seats, and the start of the new ones ended after ~130 s with an EMPTY detail:
// the watchdog's fixed 120 s bound killed `start-workflow` (which prints its answer only at the end), nothing was journalled, no start hold counted it, and both workflows stood
// without a Kernel for 25 minutes while the Host retried the same killed start every two minutes.
// Sequence: a live Kernel, the contract-changing revision, the watchdog pass the Host controller runs (--once --repair).
//   1. the start never answers (the launch stub): the pass says why (start-timeout, the last phase), journals kernel-start-failed under the revision, and the seat
//      the rotation closed has that fact as its owner's record;
//   2. with the launches of this revision already failing for one cause (the start-hold bound spent), the same deploy leaves the working Kernel in place: the seat is closed
//      only when a start may run.
// Real: the revision notice, the watchdog and its rotation, the start-hold rule, the ledger. Stubbed: the Orca binary and the Kernel launch (a start that never answers).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadFixture, replayWorld, ROOT } from '../helpers/replay-world.mjs';
import { runtimeRevNow } from '../../scripts/kernel/start-hold.mjs';

const HANGS = pathToFileURL(path.join(ROOT, 'tests', 'helpers', 'replay-start-hangs.mjs')).href;
const WATCHDOG = path.join(ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs');
const changed = { 'modules/kernel/kernel-prompt.md': 'Kernel prompt, a rule reversed\n' };

/** A world with a live Kernel (its terminal known to the Orca stub), the notice baseline adopted, and the contract-changing revision deployed. */
function deployed(t) {
  const world = replayWorld(t, loadFixture('leg-ready'), { tree: true, launch: true });
  fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({ terminals: {
    'term-runtime-shell': { handle: 'term-runtime-shell', worktree: ROOT, title: 'shell' },
    'term-kernel-current': { handle: 'term-kernel-current', worktree: world.tree.dir, title: '[Kernel] wf-1' } } }));
  assert.equal(world.ack([]).status, 0);
  assert.equal(world.status().revisionNotice.state, 'current', 'the Kernel stands at the revision it acked: the baseline');
  world.reviseRuntime(changed, 'a revision that reverses a rule of the Kernel contract');
  return world;
}
const watchdog = (world) => {
  const run = spawnSync(process.execPath, ['--import', HANGS, WATCHDOG, '--repo', world.repo, '--workflow', world.wf, '--once', '--repair', '--json'],
    { cwd: ROOT, encoding: 'utf8', env: { ...world.env, ORCA_TERMINAL_HANDLE: 'term-kernel-current' }, timeout: 300_000 });
  assert.ok(run.stdout.trim(), `watchdog said nothing (exit ${run.status}): ${run.stderr.slice(0, 800)}`);
  return { status: run.status, answer: JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1)) };
};
const events = (world, kind) => world.ledger((ledger) => ledger.db.prepare('SELECT payload_json FROM events WHERE kind=? ORDER BY seq').all(kind).map((row) => JSON.parse(row.payload_json)));

test('a contract-changing deploy whose start never answers is named, journalled once and counted by the start hold, never an empty detail', (t) => {
  const world = deployed(t);
  const { answer } = watchdog(world);
  assert.equal(answer.rotation.reason.startsWith('contract-changed:'), true, 'the deploy is a contract-changed replacement');
  assert.equal(answer.action, 'restart-failed');
  assert.notEqual(answer.detail, '', 'a failed start names its cause');
  assert.deepEqual([answer.detail.reason, answer.detail.timedOut], ['start-timeout', true]);
  assert.match(answer.detail.error, /phase workflow-host/, 'and the phase it stood in');
  assert.equal(answer.nextWake, undefined, 'the closed seat is not addressed by a wake any more');
  assert.equal(events(world, 'kernel-rotated').length, 1, 'exactly one replacement');
  const [failed] = events(world, 'kernel-start-failed');
  assert.deepEqual([failed.step, failed.reason, failed.runtimeRev], ['start-workflow', 'start-timeout', runtimeRevNow()], 'journalled under the revision it failed at');
});

test('while the launches of this revision are held for their cause, the working Kernel is not closed by a contract replacement', (t) => {
  const world = deployed(t);
  const rev = runtimeRevNow();
  world.ledger((ledger) => ledger.transaction(() => {
    for (let i = 0; i < 3; i += 1) ledger.appendEvent({ workflowId: world.wf, entityType: 'kernel', entityId: world.wf, kind: 'kernel-start-failed',
      payload: { step: 'start-workflow', reason: 'start-timeout', error: 'killed at its bound', runtimeRev: rev } });
  }));
  const { answer } = watchdog(world);
  assert.equal(answer.action, 'replacement-held', 'the replacement waits for a start that may run');
  assert.equal(answer.terminalClosed, undefined, 'the seat that works was not closed');
  assert.equal(events(world, 'kernel-rotated').length, 0, 'no replacement was recorded');
  assert.equal(world.orca().terminals['term-kernel-current'].closed, undefined, 'the Kernel terminal is still open');
});
