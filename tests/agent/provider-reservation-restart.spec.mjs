// A host restart ends every launch the previous incarnation started. The shape of the real stall (2026-10-08 after an overnight
// shutdown): ten handle-less codex worker receipts, nine `unknown` and one `launching`, each naming a host request the new Orca
// runtime has never seen, filled the pool's ten slots for good because only a listed terminal ever proved a receipt dead.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine, readMachine } from '../../engine/db/machine.mjs';
import { reapProviderReservations } from '../../scripts/machine/provider-reservation-reap.mjs';
import { hostIncarnation, HELD_CLOCK, heldEntity } from '../../scripts/machine/provider-reservation-restart.mjs';

const MODEL = 'gpt-6.1-sol', CAP = 10, ORCA_PID = 4242;
const fixture = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reservation-restart-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(directory, 'machine.sqlite') };
  openMachine({ env }).close();
  return { env };
};
// The receipt's lifecycle when worker-start answered an uncertain effect: reserved -> launching -> (unknown); no handle is ever bound.
const seed = (options, index, state) => {
  const attemptId = `worker:worker:${index}:codex:default:${MODEL}`;
  const m = openMachine({ env: options.env });
  try {
    const reserved = m.reserveProvider({ provider: 'codex', account: 'default', attemptId, role: 'worker', model: MODEL, maxParallel: CAP, scope: { scopeId: `worker:${index}` } });
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
    const { id, fence } = reserved.reservation;
    const base = { id, fence, attemptId, provider: 'codex', account: 'default', model: MODEL, role: 'worker' };
    assert.equal(m.markProviderReservation({ ...base, state: 'launching', launchIdentity: `launch-${index}`, hostRequestId: `request-${index}` }).ok, true);
    if (state === 'unknown') assert.equal(m.markProviderReservation({ ...base, state: 'unknown' }).ok, true);
    return id;
  } finally { m.close(); }
};
const seedPool = (options) => Array.from({ length: CAP }, (_, index) => seed(options, index, index === CAP - 1 ? 'launching' : 'unknown'));
const active = (options) => readMachine((m) => m.providerReservations({ activeOnly: true }), [], options);
const absent = () => ({ ok: true, state: 'absent' });
// The host the census describes: Orca's app process was created at orcaCreatedAt; the operating system booted at bootAt.
const host = ({ bootAt, orcaCreatedAt = null, reachable = true, table, request = absent }) => ({
  status: () => ({ reachable, appPid: ORCA_PID }), bootAt: () => bootAt, request,
  table: table ?? (() => [{ pid: ORCA_PID, ppid: 1, name: 'Orca.exe', created: orcaCreatedAt }]),
  list: () => ({ ok: true, terminals: [] }), env: () => [] });
const hoursAhead = (hours) => Date.now() + hours * 3_600_000;

test('the ten handle-less receipts of the overnight shutdown are released once the host restarted after them', (t) => {
  const options = fixture(t);
  seedPool(options);
  assert.equal(active(options).length, CAP);
  const reaped = reapProviderReservations(options, host({ bootAt: hoursAhead(-1), orcaCreatedAt: hoursAhead(1) }));
  assert.equal(reaped.released.length, CAP, JSON.stringify(reaped.kept));
  assert.ok(reaped.released.every((entry) => entry.why === 'host-restarted'));
  assert.deepEqual(active(options), []);
  const events = readMachine((m) => m.db.prepare("SELECT proof_json FROM provider_reservation_events WHERE to_state='released'").all(), [], options);
  const proof = JSON.parse(events[0].proof_json);
  assert.equal(proof.kind, 'host-restarted');
  assert.equal(proof.requestState, 'absent');
  assert.ok(proof.restartedAt > proof.receiptUpdatedAt, 'the proof names the restart instant and the receipt update it follows');
});

test('the operating-system boot alone proves the restart when Orca reports no creation time', (t) => {
  const options = fixture(t);
  seed(options, 0, 'unknown');
  const reaped = reapProviderReservations(options, host({ bootAt: hoursAhead(1) }));
  assert.equal(reaped.released.length, 1);
});

test('a receipt written after the host came up keeps its slot', (t) => {
  const options = fixture(t);
  seed(options, 0, 'unknown');
  const reaped = reapProviderReservations(options, host({ bootAt: hoursAhead(-3), orcaCreatedAt: hoursAhead(-2) }));
  assert.deepEqual(reaped.released, []);
  assert.deepEqual(reaped.kept.map((entry) => entry.why), ['host-not-restarted']);
  assert.equal(active(options).length, 1);
});

test('an Orca that does not answer or a process table that cannot be read proves nothing', (t) => {
  const options = fixture(t);
  seed(options, 0, 'unknown');
  const restarted = { bootAt: hoursAhead(1) };
  assert.deepEqual(reapProviderReservations(options, host({ ...restarted, reachable: false })).kept.map((entry) => entry.why), ['host-unavailable']);
  assert.deepEqual(reapProviderReservations(options, host({ ...restarted, table: () => null })).kept.map((entry) => entry.why), ['census-unreadable']);
  assert.deepEqual(reapProviderReservations(options, host({ ...restarted, request: () => ({ ok: false, state: null }) })).kept.map((entry) => entry.why), ['host-unavailable']);
  assert.equal(active(options).length, 1);
});

test('a host request the current runtime still knows is a launch it ran: the slot stays', (t) => {
  const options = fixture(t);
  seed(options, 0, 'unknown');
  const reaped = reapProviderReservations(options, host({ bootAt: hoursAhead(1), request: () => ({ ok: true, state: 'completed' }) }));
  assert.deepEqual(reaped.released, []);
  assert.deepEqual(reaped.kept.map((entry) => entry.why), ['request-known']);
});

test('the machine refuses a restart proof for a receipt that progressed after the proof was read', (t) => {
  const options = fixture(t);
  const id = seed(options, 0, 'unknown');
  const [row] = active(options);
  const proof = { kind: 'host-restarted', confirmed: true, restartedAt: hoursAhead(1), receiptUpdatedAt: row.updatedAt, hostRequestId: row.hostRequestId, requestState: 'absent' };
  const m = openMachine({ env: options.env });
  try {
    assert.equal(m.releaseProviderReservation({ ...row, proof: { ...proof, receiptUpdatedAt: row.updatedAt - 1 } }).reason, 'exit-unproven', 'a proof of another update instant');
    assert.equal(m.releaseProviderReservation({ ...row, proof: { ...proof, requestState: 'completed' } }).reason, 'exit-unproven', 'a request the runtime knows');
    assert.equal(m.releaseProviderReservation({ ...row, proof: { ...proof, restartedAt: row.updatedAt - 1 } }).reason, 'exit-unproven', 'a restart before the receipt');
    assert.equal(m.releaseProviderReservation({ ...row, proof: { ...proof, confirmed: false } }).reason, 'exit-unproven');
    assert.equal(m.releaseProviderReservation({ ...row, proof }).ok, true);
    assert.equal(m.providerReservations().find((entry) => entry.id === id).state, 'released');
  } finally { m.close(); }
});

test('a receipt bound to a terminal handle is never released by a restart proof', (t) => {
  const options = fixture(t);
  const id = seed(options, 0, 'launching');
  const m = openMachine({ env: options.env });
  try {
    const [row] = m.providerReservations({ activeOnly: true });
    assert.equal(m.markProviderReservation({ id, fence: row.fence, attemptId: row.attemptId, state: 'live', handle: 'term_a' }).ok, true);
    const bound = m.providerReservations({ activeOnly: true })[0];
    const proof = { kind: 'host-restarted', confirmed: true, restartedAt: hoursAhead(1), receiptUpdatedAt: bound.updatedAt, hostRequestId: bound.hostRequestId, requestState: 'absent' };
    assert.equal(m.releaseProviderReservation({ ...bound, proof }).reason, 'exit-unproven');
  } finally { m.close(); }
});

test('an unproven receipt held past its declared bound opens one escalation clock, and its release clears the clock', (t) => {
  const options = fixture(t);
  const id = seed(options, 0, 'unknown');
  const unrestarted = host({ bootAt: 0 });
  const early = reapProviderReservations(options, unrestarted);
  assert.deepEqual(early.held ?? [], [], 'a fresh hold is inside its bound');
  const later = { ...options, now: hoursAhead(2) };
  const held = reapProviderReservations(later, unrestarted);
  assert.deepEqual(held.held, [id]);
  assert.equal(readMachine((m) => m.openSla().filter((row) => row.entity === heldEntity(id) && row.state === HELD_CLOCK).length, 0, options), 1);
  reapProviderReservations(later, unrestarted);
  assert.equal(readMachine((m) => m.openSla().filter((row) => row.entity === heldEntity(id)).length, 0, options), 1, 'one clock per receipt');
  assert.equal(reapProviderReservations(later, host({ bootAt: hoursAhead(3) })).released.length, 1);
  assert.equal(readMachine((m) => m.openSla().filter((row) => row.entity === heldEntity(id)).length, 0, options), 0, 'the release clears the clock');
});

test('the incarnation start is the later of the boot instant and the Orca app creation instant', () => {
  const both = hostIncarnation(host({ bootAt: 100, orcaCreatedAt: 500 }));
  assert.deepEqual([both.ok, both.bootAt, both.orcaStartedAt, both.startedAt], [true, 100, 500, 500]);
  assert.equal(hostIncarnation(host({ bootAt: 900, orcaCreatedAt: 500 })).startedAt, 900);
  assert.equal(hostIncarnation({ status: () => { throw new Error('orca down'); } }).why, 'host-unavailable');
});
