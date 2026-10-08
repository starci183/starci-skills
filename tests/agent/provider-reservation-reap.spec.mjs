import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { admitAgent, observeAgentAdmission } from '../../scripts/agent/admission.mjs';
import { providerBudgetUsage } from '../../scripts/agent/provider-budget.mjs';
import { reapProviderReservations } from '../../scripts/machine/provider-reservation-reap.mjs';
import { loadModelRegistry } from '../../scripts/agent/model-registry.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

// An Orca that never answers: the restart proof (provider-reservation-restart.mjs) reads nothing from the real host.
const NO_ORCA = { status: () => ({ reachable: false }) };
const HOST_DOWN = { ...NO_ORCA, list: () => ({ ok: false, hostUnavailable: true, terminals: [] }) };
const member = { provider: 'codex', model: 'gpt-6.1-sol', maxParallel: 99, eligibility: { eligible: true, mode: 'operation-policy' } };
const fixture = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reservation-reap-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(directory, 'machine.sqlite') };
  openMachine({ env }).close();
  // Admission reaps before it plans: every admission here names its Orca view, none reads the real host.
  return { env, io: { quota: fakeAdmission({ used: { claude: 96, codex: 20 } }).quota, circuit: () => null, reap: HOST_DOWN } };
};
const admit = (options, role, scopeId) => admitAgent({ role, scopeId, allowGroup: [member] }, options);
const launchLive = (options, role, scopeId, handle) => {
  const admitted = admit(options, role, scopeId);
  assert.equal(admitted.ok, true, JSON.stringify(admitted));
  assert.equal(observeAgentAdmission(admitted, { state: 'live', handle }, options).ok, true);
  return admitted;
};
const ceiling = () => loadModelRegistry().pools['codex-agent'].maxParallel;
const seeded = (options, names) => names.map((name, index) => launchLive(options, index < 2 ? 'supervisor' : 'worker', `${name}:attempt`, name));
const listing = (rows) => () => ({ ok: true, terminals: rows });
const noProcess = { ...NO_ORCA, table: () => [], env: () => [] };
const usage = (options) => providerBudgetUsage('codex', 'default', options).running;

test('slots of reported or replaced launches whose terminals ended are released, so a later start is no longer refused', (t) => {
  const options = fixture(t);
  const handles = Array.from({ length: ceiling() }, (_, index) => `term_${index}`);
  seeded(options, handles);
  assert.equal(admit(options, 'worker', 'worker:late').ok, false, 'the provider cap is full');
  // two seats stay connected; every worker terminal is disconnected or no longer listed
  const rows = [{ handle: 'term_0', connected: true }, { handle: 'term_1', connected: true }, { handle: 'term_2', connected: false }];
  const admittedLate = admitAgent({ role: 'worker', scopeId: 'worker:late', allowGroup: [member] }, { ...options, io: { ...options.io, reap: { list: listing(rows), ...noProcess } } });
  assert.equal(admittedLate.ok, true, JSON.stringify(admittedLate));
  assert.equal(usage(options), 3, 'the two connected seats and the new worker');
});

test('a terminal that still carries a live process, or a connected one, keeps its slot', (t) => {
  const options = fixture(t);
  seeded(options, ['term_a', 'term_b']);
  const alive = [{ pid: 7, ppid: 1, name: 'claude', created: 1, exe: 'claude.exe' }];
  const kept = reapProviderReservations(options, { ...NO_ORCA, list: listing([{ handle: 'term_a', connected: true }]),
    table: () => alive, env: () => [{ pid: 7, readable: true, values: { ORCA_TERMINAL_HANDLE: 'term_b' } }] });
  assert.deepEqual(kept.released, []);
  assert.deepEqual(kept.kept.map((row) => row.why).sort(), ['process-alive', 'terminal-connected']);
  assert.equal(usage(options), 2);
});

test('an unanswering host or an unreadable census proves nothing and keeps every slot', (t) => {
  const options = fixture(t);
  seeded(options, ['term_a']);
  assert.deepEqual(reapProviderReservations(options, HOST_DOWN).released, []);
  assert.deepEqual(reapProviderReservations(options, { ...NO_ORCA, list: listing([]), table: () => null, env: () => null }).released, []);
  assert.equal(usage(options), 1);
});

test('a receipt that stayed reserved past the stale window never launched and is released', (t) => {
  const options = fixture(t);
  assert.equal(admit(options, 'worker', 'worker:died').ok, true);
  assert.deepEqual(reapProviderReservations(options, { list: listing([]), ...noProcess }).released, [], 'a fresh reservation is a launch in progress');
  const later = { ...options, now: Date.now() + 3_600_000 };
  const reaped = reapProviderReservations(later, { list: listing([]), ...noProcess });
  assert.equal(reaped.released.length, 1);
  assert.equal(reaped.released[0].why, 'never-launched');
  assert.equal(usage(options), 0);
});
