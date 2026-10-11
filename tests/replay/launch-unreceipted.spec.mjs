// Replay of the stall of 2026-10-09 (registry: held-kernel-launch-without-a-terminal-has-no-owner): both workflows had no Kernel and could not get one. The codex Kernel launches
// ended outcome_unknown / turn_start_unobserved; Orca had created the worker and its terminal (the Codex TUI idle with the unsubmitted paste chip) but its answer named no
// terminal, so the held launch-unknown signal stored a Dispatch with no terminal and the provider receipt had state unknown and no handle. Recovery found no identity it could
// close (isUnboundLaunch needs no Dispatch, isUnadopted needs a receipt handle, isBoundLaunch needs both): kernel-launch-custody-incomplete for ever, the provider capacity held,
// every start refused kernel-launch-unreconciled, and no item for the Supervisor.
// Sequence: the held signal as the live ledger left it, then the Kernel start's recovery (recoverWorkflowLaunch, as scripts/kernel/start-workflow.mjs runs it, in a fresh process).
// Real: the recovery, worker-show of the exact Dispatch, the stop and release with their closure proof, the provider reservation in the machine store, the ledger, the Supervisor
// items. Stubbed: the Orca binary only (tests/helpers/fake-orca.mjs, its worker state seeded as the live host reported the stuck Dispatch: start_unknown, stage turn_start_unobserved,
// status pending, no heartbeat). The stub has no process tree, so the closure proof of a terminal that Orca closed stays "unverifiable" here: the replay stops at the unproven closure
// and shows custody kept with one Supervisor item; the release of the reservation and the clearing of the signal on a proven closure are the unit spec
// tests/kernel/workflow-launch-unreceipted.spec.mjs (injected closure proof).
// Fixture: tests/fixtures/replay/launch-unreceipted.json (extracted from a read-only copy of the ledger, neutral).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openMachine } from '../../engine/db/machine.mjs';
import { setSignal } from '../../engine/db/ledger.mjs';
import { ROOT, loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const RECOVER = path.join(ROOT, 'tests', 'helpers', 'replay-recover.mjs');
/** The recovery in a fresh process over the world: the real worker-show, stop and release against the Orca stub. */
const recover = (world) => {
  const r = spawnSync(process.execPath, [RECOVER, JSON.stringify({ ledgerFile: world.ledgerFile, workflowId: world.wf })], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: { ...world.env, STARCI_ORCA_SKIP_LIVE_CHECK: '1' } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split(String.fromCharCode(10)).at(-1));
};

const fixture = loadFixture('launch-unreceipted');
const DISPATCH = 'ctx_stuck_kernel', TERMINAL = 'fake-terminal-1';

/** The machine store for `fn`, closed after (an open handle would hold the world's directory on Windows). */
const machineOf = (world, fn) => { const machine = openMachine({ file: world.machineFile }); try { return fn(machine); } finally { machine.close(); } };

/** The world as the live ledger left it: the held signal, the unknown receipt without a handle, and Orca's record of the Dispatch. */
function heldWorld(t, { workerState = 'start_unknown', heartbeat = null } = {}) {
  assert.deepEqual([fixture.launch.terminalNamed, fixture.launch.dispatchNamed, fixture.launch.receiptHandleNamed, fixture.launch.receiptState], [false, true, false, 'unknown'], 'the fixture is the live shape');
  const world = replayWorld(t, fixture, { bindKernel: false });
  world.ledger((ledger) => ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(world.wf));
  const receipt = machineOf(world, (machine) => {
    const reserved = machine.reserveProvider({ provider: fixture.launch.provider, model: 'gpt-6.1-sol', role: fixture.launch.role, attemptId: 'kernel-attempt', maxParallel: 2, scope: { workflowId: world.wf } });
    return machine.markProviderReservation({ ...reserved.reservation, state: fixture.launch.receiptState, launchIdentity: 'launch-identity', hostRequestId: 'host-request' }).reservation;
  });
  world.ledger((ledger) => setSignal(ledger.db, { scope: 'kernel', key: world.wf, workflowId: world.wf, holderPid: 4123, token: 'kernel-held',
    value: { state: fixture.launch.state, terminal: null, dispatch: DISPATCH, admission: { ok: true, receipt } }, expiresAt: null }));
  fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({ terminals: { [TERMINAL]: { handle: TERMINAL, connected: true, writable: true } },
    workerStates: { [DISPATCH]: workerState }, assignees: { [DISPATCH]: TERMINAL }, releaseClosesTerminal: true, heartbeatAt: heartbeat, sends: 0 }));
  return { world,
    signal: () => world.ledger((ledger) => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(world.wf)),
    reservation: () => machineOf(world, (machine) => machine.providerReservations().find((row) => row.id === receipt.id)),
    items: () => machineOf(world, (machine) => machine.db.prepare("SELECT * FROM sup_decision_items WHERE kind='runtime-defect' AND opened_by='kernel-start'").all()) };
}

test('the stuck Dispatch is found in Orca by its own id: its terminal adopted, its worker stopped and released, and an unproven closure keeps custody with one Supervisor item', (t) => {
  const { world, signal, reservation, items } = heldWorld(t);
  const result = recover(world);
  assert.notEqual(result.reason, 'kernel-launch-custody-incomplete', 'the live shape is no longer called incomplete');
  assert.equal(result.reason, 'kernel-launch-closure-unverified');
  assert.equal(result.terminal, TERMINAL, 'the terminal Orca reports for that Dispatch');
  assert.equal(result.closure.closed.proof, 'disconnected', 'it was closed through the closure path');
  assert.equal(world.orca().workerStates[DISPATCH], 'released', 'Orca\'s worker was stopped and released');
  assert.notEqual(signal(), undefined, 'custody stays until the closure is proven');
  assert.equal(reservation().handle, TERMINAL, 'the terminal was bound to the original reservation');
  assert.notEqual(reservation().state, 'released');
  assert.equal(items().length, 1, 'one item for the Supervisor: held always has an owner');
  assert.match(items()[0].summary, new RegExp(DISPATCH));
  assert.equal(JSON.parse(items()[0].evidence_json).terminal, TERMINAL);
  recover(world);
  assert.equal(items().length, 1, 'a second start opens no second item');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the held workflow');
});

test('a Dispatch whose worker shows a heartbeat is a live seat: it is not closed, custody stays and the Supervisor owns the item', (t) => {
  const { world, signal, reservation, items } = heldWorld(t, { workerState: 'ready', heartbeat: Date.now() });
  const result = recover(world);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'kernel-launch-worker-live');
  assert.notEqual(signal(), undefined);
  assert.notEqual(reservation().state, 'released');
  assert.equal(world.orca().workerStates[DISPATCH], 'ready', 'nothing was stopped');
  assert.equal(items().length, 1);
  assert.equal(JSON.parse(items()[0].evidence_json).terminal, TERMINAL);
});
