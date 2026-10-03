import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, MACHINE_VERSION } from '../../engine/db/machine.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { reserveProviderBudget, markProviderBudget, releaseProviderBudget, reconcileProviderBudget, providerBudgetUsage } from '../../scripts/agent/provider-budget.mjs';
import { closeWorker } from '../../scripts/machine/worker-close.mjs';
import { planAgentAdmission } from '../../scripts/agent/admission.mjs';
import { spawnAgent } from '../../scripts/agent/lib.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

const now = Date.parse('2026-10-03T08:00:00Z'), policy = allocationSettings().admission;
const root = path.resolve(import.meta.dirname, '../..');
const fixture = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-provider-budget-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = path.join(directory, 'machine.sqlite');
  return { file, env: { ...process.env, STARCI_TEST_MACHINE_FILE: file }, policy, now: () => now };
};
const input = (attemptId = 'worker:a', extra = {}) => ({ provider: 'codex', account: 'a', model: 'gpt-6.1-sol', role: 'worker',
  scopeId: 'scope-a', attemptId, maxParallel: 1, quota: { provider: 'codex', account: 'a', auth: 'ok', observedAt: now,
    windows: [{ id: 'weekly', usedPercent: 4, observedAt: now, resetsAt: now + 600000 }] }, ...extra });

const firstLaunch = (options) => {
  const fake = fakeAdmission(), calls = { quota: 0, start: 0 };
  const io = { circuit: () => null, quota: (provider, args) => { calls.quota++; return fake.quota(provider, args); } };
  const request = { role: 'worker', scopeId: 'first-worker', attemptId: 'first-worker',
    allowGroup: [{ provider: 'codex', model: 'gpt-6.1-sol', account: 'a', maxParallel: 1 }] };
  return { calls, plan: () => planAgentAdmission({ ...request, env: options.env, io }),
    launch: () => spawnAgent({ ...request, env: options.env, provider: 'codex', model: 'gpt-6.1-sol',
      worktree: path.dirname(options.file), title: '[Worker] first launch', spec: 'isolated fixture brief', run: 'fixture-run',
      request: { worker: 'first-worker' }, io: { admission: io, hostAgent: () => ({ ok: true }),
        trust: () => ({ status: 'ok', paths: [] }), rename: () => ({ ok: true }), recordLaunch: () => {},
        start: () => { calls.start++; return { ok: true, outcome: 'ok', dispatchId: 'fixture-dispatch',
          taskId: 'fixture-task', agentTerminalHandle: 'fixture-terminal' }; },
        show: () => ({ ok: true, state: 'ready', dispatch: { assigneeHandle: 'fixture-terminal' },
          effective: { agent: 'codex', model: 'gpt-6.1-sol' } }),
      } }),
  };
};
const legacyStore = (options) => {
  const machine = openMachine(options);
  try { machine.setService({ name: 'preserved-service', kind: 'http', state: 'healthy', port: 41001 }); }
  finally { machine.close(); }
  const raw = new DatabaseSync(options.file);
  try { raw.exec("DROP TABLE provider_reservation_events; DROP TABLE provider_reservations; DELETE FROM schema_migrations WHERE version=2; PRAGMA user_version=1; INSERT INTO machine_meta VALUES('test-preserved','host-data');"); }
  finally { raw.close(); }
};

test('the first actual worker launch prepares an absent store while its plan remains read-only', (t) => {
  const options = fixture(t), worker = firstLaunch(options);
  const plan = worker.plan();
  assert.equal(plan.ok, false);
  assert.ok(plan.rejected[0].codes.includes('capacity-unknown'));
  assert.equal(fs.existsSync(options.file), false, 'a plan cannot create the machine store');
  const launched = worker.launch();
  assert.equal(launched.ok, true, JSON.stringify(launched));
  assert.equal(worker.calls.start, 1);
  const usage = providerBudgetUsage('codex', 'a', options);
  assert.equal(usage.running, 1);
  assert.equal(usage.reservations[0].state, 'live');
  assert.equal(usage.reservations[0].handle, 'fixture-terminal');
});

test('the first actual worker launch upgrades a compatible v1 store and preserves host rows', (t) => {
  const options = fixture(t);
  legacyStore(options);
  const before = new DatabaseSync(options.file, { readOnly: true });
  let service, events;
  try { service = before.prepare('SELECT * FROM services').all(); events = before.prepare('SELECT * FROM service_events').all(); }
  finally { before.close(); }
  const worker = firstLaunch(options), plan = worker.plan();
  assert.equal(plan.ok, false);
  assert.ok(plan.rejected[0].codes.includes('capacity-unknown'));
  assert.equal(providerBudgetUsage('codex', 'a', options).observed, false, 'a v1 reader cannot invent zero usage');
  const unchanged = new DatabaseSync(options.file, { readOnly: true });
  try { assert.equal(unchanged.prepare('PRAGMA user_version').get().user_version, 1, 'planning does not upgrade'); }
  finally { unchanged.close(); }
  const launched = worker.launch();
  assert.equal(launched.ok, true, JSON.stringify(launched));
  assert.equal(worker.calls.start, 1);
  const after = new DatabaseSync(options.file, { readOnly: true });
  try {
    assert.equal(after.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
    assert.equal(after.prepare('SELECT count(*) n FROM schema_migrations WHERE version=2').get().n, 1);
    assert.equal(after.prepare("SELECT value FROM machine_meta WHERE key='test-preserved'").get().value, 'host-data');
    assert.deepEqual(after.prepare('SELECT * FROM services').all(), service);
    assert.deepEqual(after.prepare('SELECT * FROM service_events').all(), events);
    assert.equal(after.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { after.close(); }
  assert.equal(providerBudgetUsage('codex', 'a', options).reservations[0].state, 'live');
});

test('actual launch preparation refuses foreign and future stores without discarding host data', (t) => {
  for (const incompatible of ['foreign', 'future']) {
    const options = fixture(t);
    legacyStore(options);
    const raw = new DatabaseSync(options.file);
    try {
      if (incompatible === 'foreign') raw.prepare("UPDATE machine_meta SET value=? WHERE key='schema'").run('foreign/schema@1');
      else raw.exec('PRAGMA user_version=77');
    } finally { raw.close(); }
    const worker = firstLaunch(options), launched = worker.launch();
    assert.equal(launched.ok, false);
    assert.equal(launched.effectState, 'none');
    assert.match(launched.error, /machine-schema-old/);
    assert.equal(worker.calls.quota, 0, 'schema refusal precedes provider probing');
    assert.equal(worker.calls.start, 0, 'schema refusal cannot call the host launcher');
    const check = new DatabaseSync(options.file, { readOnly: true });
    try {
      assert.equal(check.prepare('PRAGMA user_version').get().user_version, incompatible === 'future' ? 77 : 1);
      assert.equal(check.prepare("SELECT value FROM machine_meta WHERE key='schema'").get().value,
        incompatible === 'foreign' ? 'foreign/schema@1' : 'starci/machine@1');
      assert.equal(check.prepare("SELECT value FROM machine_meta WHERE key='test-preserved'").get().value, 'host-data');
      assert.equal(check.prepare('SELECT count(*) n FROM services').get().n, 1);
      assert.equal(check.prepare("SELECT count(*) n FROM sqlite_master WHERE name='provider_reservations'").get().n, 0);
    } finally { check.close(); }
  }
});

test('five roles share one account slot; retries do not charge twice and changed intent refuses', (t) => {
  const options = fixture(t), first = reserveProviderBudget(input(), options);
  assert.equal(first.ok, true);
  assert.equal(reserveProviderBudget(input(), options).reused, true);
  assert.equal(reserveProviderBudget(input('worker:a', { model: 'another-model' }), options).reason, 'attempt-conflict');
  for (const role of ['kernel', 'op', 'supervisor', 'critic']) assert.equal(reserveProviderBudget(input(`${role}:a`, { role }), options).reason, 'capacity');
  assert.equal(providerBudgetUsage('codex', 'a', options).running, 1);
  assert.equal(reserveProviderBudget(input('worker:b', { account: 'b', quota: { ...input().quota, account: 'b' } }), options).ok, true, 'separate account has its own slots');
});

test('cap zero, stale evidence and exhausted quota cannot be bypassed by an override', (t) => {
  const options = fixture(t), override = { authorized: true, scopeId: 'scope-a', role: 'worker', provider: 'codex', account: 'a', model: 'gpt-6.1-sol', reason: 'recover an existing critical operation' };
  assert.equal(reserveProviderBudget(input('zero', { maxParallel: 0, override }), options).reason, 'capacity');
  const limited = { ...input().quota, windows: [{ ...input().quota.windows[0], usedPercent: 96 }] };
  assert.equal(reserveProviderBudget(input('limited', { quota: limited }), options).reason, 'quota-reserve');
  assert.equal(reserveProviderBudget(input('wrong-scope', { quota: limited, override: { ...override, scopeId: 'elsewhere' } }), options).ok, false);
  assert.equal(reserveProviderBudget(input('forged', { quota: limited, override }), options).reason, 'quota-reserve', 'self-asserted authority is not a trusted grant');
  assert.equal(reserveProviderBudget(input('recovery', { quota: limited, override }), { ...options, authorizeOverride: (requested) => requested === override }).ok, true);
  assert.equal(reserveProviderBudget(input('exhausted', { quota: { ...limited, windows: [{ ...limited.windows[0], usedPercent: 100 }] }, override }), options).reason, 'quota-ineligible');
  assert.equal(reserveProviderBudget(input('stale', { quota: { ...input().quota, observedAt: now - policy.maxAgeMs - 1 }, override }), options).reason, 'quota-ineligible');
});

test('direct admission rejects malformed observations and self-asserted owner grants', (t) => {
  const options = fixture(t);
  for (const quota of [
    { ...input().quota, expiresAt: 'bad-date' },
    { ...input().quota, windows: [input().quota.windows[0], input().quota.windows[0]] },
    { ...input().quota, authority: 'unrecognized' },
  ]) assert.equal(reserveProviderBudget(input('malformed', { quota }), options).ok, false);
  const quota = { provider: 'devin', account: 'a', authority: 'owner-grant', auth: 'ok', observedAt: now,
    grant: { owner: 'owner', scopeId: 'scope-a', roles: ['worker'], slots: 1, observedAt: now } };
  const request = input('grant', { provider: 'devin', model: 'devin-default', quota });
  assert.equal(reserveProviderBudget(request, options).reason, 'grant-ineligible');
  assert.equal(reserveProviderBudget(request, { ...options, authorizeGrant: () => true }).ok, true);
});

test('unknown/crashed attempts retain their slot; fences and real matching closure govern release', (t) => {
  const options = fixture(t), receipt = reserveProviderBudget(input(), options).reservation;
  assert.equal(markProviderBudget(receipt, { state: 'launching', launchIdentity: 'run-a:worker-request-a' }, options).ok, true);
  assert.equal(markProviderBudget(receipt, { state: 'unknown', handle: 'terminal-a', pid: 1234 }, options).ok, true);
  const later = { ...options, now: () => now + 86400000 };
  assert.equal(reconcileProviderBudget([{ receipt }], later)[0].reason, 'observation-unknown');
  assert.equal(providerBudgetUsage('codex', 'a', later).running, 1, 'a day elapsed is not exit evidence');
  assert.equal(releaseProviderBudget({ ...receipt, fence: receipt.fence + 1 }, { kind: 'closed', confirmed: true, handle: 'terminal-a' }, options).reason, 'fenced');
  assert.equal(releaseProviderBudget(receipt, { kind: 'closed', confirmed: true, handle: 'terminal-b' }, options).reason, 'exit-unproven');
  assert.equal(releaseProviderBudget(receipt, { kind: 'failed-before-launch', confirmed: true }, options).reason, 'exit-unproven');
  assert.equal(releaseProviderBudget(receipt, { kind: 'closed', confirmed: true, handle: 'terminal-a',
    terminalProof: 'gone', processVerdict: 'none' }, options).ok, true);
  assert.equal(reserveProviderBudget(input(), options).reason, 'attempt-released', 'a released attempt cannot silently start again');
  assert.equal(reserveProviderBudget(input('fresh-attempt'), options).ok, true);
});

test('proof of no launch effect releases an unstarted reservation idempotently', (t) => {
  const options = fixture(t), receipt = reserveProviderBudget(input(), options).reservation;
  assert.equal(releaseProviderBudget(receipt, { kind: 'failed-before-launch', confirmed: true }, options).ok, true);
  assert.equal(releaseProviderBudget(receipt, { kind: 'failed-before-launch', confirmed: true }, options).reused, true);
  assert.equal(markProviderBudget(receipt, { state: 'live' }, options).reason, 'released');
});

test('a bound terminal cannot release capacity without both exact terminal and process closure evidence', (t) => {
  const options = fixture(t), receipt = reserveProviderBudget(input(), options).reservation;
  markProviderBudget(receipt, { state: 'unknown', handle: 'terminal-a', pid: 1234 }, options);
  const proof = { kind: 'closed', confirmed: true, handle: 'terminal-a', terminalProof: 'gone', processVerdict: 'none' };
  for (const denied of [
    { kind: 'closed', confirmed: true, handle: 'terminal-a' },
    { ...proof, terminalProof: null },
    { ...proof, terminalProof: 'self-detached' },
    { ...proof, processVerdict: 'unverifiable' },
    { ...proof, processVerdict: 'survived' },
    { ...proof, handle: 'another-terminal' },
    { ...proof, pid: 5678 },
    { kind: 'process-exited', confirmed: true, pid: 1234 },
  ]) {
    assert.equal(releaseProviderBudget(receipt, denied, options).reason, 'exit-unproven', JSON.stringify(denied));
    assert.equal(providerBudgetUsage('codex', 'a', options).running, 1);
  }
  assert.equal(releaseProviderBudget(receipt, proof, options).ok, true);
  assert.equal(providerBudgetUsage('codex', 'a', options).running, 0);
});

test('a delayed consume revalidates stored quota and holds the slot on stale evidence', (t) => {
  const options = fixture(t), receipt = reserveProviderBudget(input(), options).reservation;
  const later = { ...options, now: () => now + policy.maxAgeMs + 1 };
  assert.equal(markProviderBudget(receipt, { state: 'launching', launchIdentity: 'run-a:worker-request-a' }, later).reason, 'quota-ineligible');
  assert.equal(providerBudgetUsage('codex', 'a', later).running, 1);
  assert.equal(markProviderBudget(receipt, { state: 'launching' }, options).reason, 'launch-identity-required');
  assert.equal(markProviderBudget(receipt, { state: 'launching', launchIdentity: 'run-a:worker-request-a' }, options).ok, true);
  assert.equal(markProviderBudget(receipt, { state: 'launching', launchIdentity: 'run-a:worker-request-a' }, options).ok, true, 'same fresh consume is idempotent');
  assert.equal(markProviderBudget(receipt, { state: 'launching', launchIdentity: 'run-b:worker-request-a' }, options).reason, 'launch-identity-conflict', 'same admission cannot start a second Run');
});

test('resolved unknown releases only on a matching affirmative host replay, never absence or self-confirmation', (t) => {
  const options = fixture(t), receipt = reserveProviderBudget(input(), options).reservation;
  const bound = markProviderBudget(receipt, { state: 'launching', launchIdentity: 'run-a:request-a', hostRequestId: 'host-request-a' }, options).reservation;
  markProviderBudget(bound, { state: 'unknown' }, options);
  assert.equal(reconcileProviderBudget([{ receipt: bound }], options)[0].reason, 'observation-unknown');
  assert.equal(releaseProviderBudget(bound, { kind: 'failed-before-launch', confirmed: true }, options).reason, 'exit-unproven');
  const proof = { kind: 'failed-before-launch', confirmed: true, launchIdentity: 'run-a:request-a', hostAffirmation: {
    kind: 'worker-start-replay', requestId: 'host-request-a', replayed: true, outcome: 'failed', effectState: 'none',
    receipt: { result: { state: 'failed', failedStage: 'host-preflight', mutation: { replayed: true } } },
  } };
  assert.equal(releaseProviderBudget(bound, { ...proof, launchIdentity: 'run-b:request-a' }, options).reason, 'exit-unproven');
  assert.equal(releaseProviderBudget(bound, { ...proof, hostAffirmation: { ...proof.hostAffirmation, requestId: 'unrelated-host-request' } }, options).reason, 'exit-unproven');
  assert.equal(releaseProviderBudget(bound, { ...proof, hostAffirmation: { ...proof.hostAffirmation, replayed: false } }, options).reason, 'exit-unproven');
  for (const result of [{}, { state: 'unknown', failedStage: 'host-preflight' }, { failedStage: 'host-preflight', residualResources: [{ terminal: 'maybe-live' }] },
    ...['agentTerminalHandle', 'terminalHandle', 'handle', 'pid', 'processId', 'dispatchId'].flatMap((key) => [
      { failedStage: 'host-preflight', [key]: key === 'pid' ? 42 : 'maybe-live' },
      { failedStage: 'host-preflight', worker: { [key]: key === 'pid' ? 42 : 'maybe-live' } },
    ])])
    assert.equal(releaseProviderBudget(bound, { ...proof, hostAffirmation: { ...proof.hostAffirmation, receipt: { result } } }, options).reason, 'exit-unproven');
  assert.equal(providerBudgetUsage('codex', 'a', options).running, 1);
  assert.equal(reconcileProviderBudget([{ receipt: bound, proof }], options)[0].ok, true);
  assert.equal(providerBudgetUsage('codex', 'a', options).running, 0);
});

test('a store failure never produces a fallback admission or optimistic capacity observation', (t) => {
  const options = fixture(t), invalid = { ...options, file: path.dirname(options.file), env: { ...options.env, STARCI_TEST_MACHINE_FILE: path.dirname(options.file) } };
  assert.throws(() => reserveProviderBudget(input(), invalid));
  assert.equal(providerBudgetUsage('codex', 'a', invalid).running, null);
  assert.equal(providerBudgetUsage('codex', 'a', invalid).observed, false);
});

test('generic closure releases capacity only after both terminal and process-tree exit are proved', (t) => {
  for (const verifiable of [true, false]) {
    const options = fixture(t), receipt = reserveProviderBudget(input(), options).reservation;
    markProviderBudget(receipt, { state: 'live', handle: 'terminal-a', pid: 1234 }, options);
    let closed = false;
    const out = closeWorker({ dispatch: 'dispatch-a', env: options.env, deps: {
      show: () => ({ ok: true, result: { worker: { agentTerminalHandle: 'terminal-a' } } }),
      release: () => ({ ok: true, state: 'released' }),
      close: () => { closed = true; return { ok: true, proof: 'gone' }; },
      tableOf: () => verifiable ? closed ? [] : [{ pid: 1234, ppid: 1, created: 10 }] : null,
      envOf: () => [{ pid: 1234, values: { ORCA_TERMINAL_HANDLE: 'terminal-a' } }],
      verifyMs: 0, pollMs: 1, stopVerifyMs: 0, sleep: () => {},
    } });
    assert.equal(out.ok, true, 'worker outcome alone does not imply its provider slot is released');
    assert.equal(providerBudgetUsage('codex', 'a', options).running, verifiable ? 0 : 1);
    if (verifiable) assert.equal(out.providerBudget.released, 1);
    else assert.equal(out.processes.verdict, 'unverifiable');
  }
});

const childReserve = (options, attemptId) => new Promise((resolve, reject) => {
  const code = `import {reserveProviderBudget} from ${JSON.stringify(new URL('../../scripts/agent/provider-budget.mjs', import.meta.url).href)}; console.log(JSON.stringify(reserveProviderBudget(${JSON.stringify(input(attemptId))}, {env:process.env,policy:${JSON.stringify(policy)},now:()=>${now}})));`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env: options.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
  child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve(JSON.parse(stdout.trim())) : reject(Error(stderr)));
});
test('two independent processes competing for the last account slot admit exactly one', async (t) => {
  const options = fixture(t), machine = openMachine(options);
  try {
    const results = await Promise.all([childReserve(options, 'process-a'), childReserve(options, 'process-b')]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => result.reason === 'capacity').length, 1);
    assert.equal(machine.providerReservations({ activeOnly: true }).length, 1);
  } finally { machine.close(); }
});
