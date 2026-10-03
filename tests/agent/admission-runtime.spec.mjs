import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { admitAgent, consumeAgentAdmission, observeAgentAdmission, releaseAgentAdmission, ownerReserveGrant } from '../../scripts/agent/admission.mjs';
import { providerBudgetUsage } from '../../scripts/agent/provider-budget.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';
import { loadModelRegistry } from '../../scripts/agent/model-registry.mjs';

const group = [
  { provider: 'claude', model: 'claude-opus-5-5', maxParallel: 1, eligibility: { eligible: true, mode: 'operation-policy' } },
  { provider: 'codex', model: 'gpt-6.1-sol', maxParallel: 1, eligibility: { eligible: true, mode: 'operation-policy' } },
];
const fixture = t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'admission-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(directory, 'machine.sqlite') };
  openMachine({ env }).close();
  const fake = fakeAdmission({ used: { claude: 96, codex: 20 } });
  return { env, io: { quota: fake.quota, circuit: () => null } };
};
const request = (role, scopeId, extra = {}) => ({ role, scopeId, allowGroup: group,
  ...(role === 'critic' ? { author: { provider: 'claude', model: 'claude-opus-5-5' } } : {}), ...extra });
const launch = (options, role, scopeId, extra = {}) => admitAgent(request(role, scopeId, extra), options);

test('all five roles reserve the actual shared machine store after Claude reaches the reserve', t => {
  for (const role of ['kernel', 'op', 'supervisor', 'worker', 'critic']) {
    const options = fixture(t), admitted = launch(options, role, `${role}:attempt:1`);
    assert.equal(admitted.ok, true, JSON.stringify(admitted));
    assert.equal(admitted.selected.model, 'gpt-6.1-sol');
    assert.equal(admitted.receipt.role, role);
    assert.equal(providerBudgetUsage('codex', 'default', options).running, 1);
    assert.equal(providerBudgetUsage('claude', 'default', options).running, 0);
  }
});

test('a held Kernel slot blocks other roles until authoritative no-effect evidence releases it', t => {
  const options = fixture(t), first = launch(options, 'kernel', 'kernel:attempt:1');
  assert.equal(first.ok, true);
  for (const role of ['op', 'supervisor', 'worker', 'critic']) {
    const next = launch(options, role, `${role}:attempt:1`);
    assert.equal(next.ok, false, `${role} cannot spend the Kernel's held last slot`);
  }
  assert.equal(providerBudgetUsage('codex', 'default', options).running, 1);
  assert.equal(releaseAgentAdmission(first, { kind: 'failed-before-launch', confirmed: true }, options).ok, true);
  assert.equal(launch(options, 'worker', 'worker:attempt:2').ok, true);
});

test('an allowed member can lower but cannot raise the registered shared provider ceiling', t => {
  const options = fixture(t), registry = loadModelRegistry();
  const ceiling = registry.pools['codex-agent'].maxParallel;
  const allowGroup = [{ provider: 'codex', model: 'gpt-6.1-sol', maxParallel: ceiling + 1 }];
  for (let index = 0; index < ceiling; index++) {
    const admitted = launch(options, 'worker', `worker:ceiling:${index}`, { allowGroup });
    assert.equal(admitted.ok, true, JSON.stringify(admitted));
    assert.equal(admitted.selected.capacity.maxParallel, ceiling);
  }
  const denied = launch(options, 'worker', 'worker:ceiling:overflow', { allowGroup });
  assert.equal(denied.ok, false);
  assert.equal(denied.effectState, 'none');
  assert.equal(providerBudgetUsage('codex', 'default', options).running, ceiling);
  const lowerOptions = fixture(t), lowerGroup = [{ ...allowGroup[0], maxParallel: 1 }];
  assert.equal(launch(lowerOptions, 'worker', 'worker:lower:1', { allowGroup: lowerGroup }).ok, true);
  assert.equal(launch(lowerOptions, 'worker', 'worker:lower:2', { allowGroup: lowerGroup }).ok, false);
  assert.equal(providerBudgetUsage('codex', 'default', lowerOptions).running, 1);
});

test('production Op admission cannot lower the difficulty floor through an explicit request', t => {
  for (const difficulty of ['hard', 'insane']) {
    const options = fixture(t);
    options.io.quota = fakeAdmission({ used: { claude: 20, codex: 20 } }).quota;
    const scopeId = `op:${difficulty}:attempt:1`;
    const lowGroup = [{ provider: 'claude', model: 'claude-sonnet-5-5', maxParallel: 1,
      eligibility: { eligible: true, mode: 'operation-policy' } }];
    const denied = launch(options, 'op', scopeId, { difficulty, qualityFloor: 'standard', allowGroup: lowGroup });
    assert.equal(denied.ok, false, 'an explicit standard floor cannot weaken hard operation policy');
    assert.equal(denied.effectState, 'none');
    assert.equal(providerBudgetUsage('claude', 'default', options).running, 0, 'refusal cannot reserve capacity');
    const admitted = launch(options, 'op', scopeId, { difficulty, qualityFloor: 'frontier' });
    assert.equal(admitted.ok, true, JSON.stringify(admitted));
    assert.equal(admitted.selected.qualityFloor, 'frontier');
  }
});

test('a canonical zero ceiling refuses every role even when an allowed member requests headroom', t => {
  const registry = structuredClone(loadModelRegistry());
  registry.pools['codex-agent'].maxParallel = 0;
  for (const role of ['kernel', 'op', 'supervisor', 'worker', 'critic']) {
    const options = { ...fixture(t), registry };
    const denied = launch(options, role, `${role}:zero:attempt`, { allowGroup: [{
      provider: 'codex', model: 'gpt-6.1-sol', maxParallel: 5,
      eligibility: { eligible: true, mode: 'operation-policy' },
    }] });
    assert.equal(denied.ok, false, JSON.stringify(denied));
    assert.equal(denied.effectState, 'none');
    assert.ok(denied.decision.rejected[0].codes.includes('capacity-full'));
    assert.equal(providerBudgetUsage('codex', 'default', options).running, 0);
  }
});

test('an unknown or another-provider pool cannot bypass the canonical provider ceiling', t => {
  const registry = loadModelRegistry();
  for (const pool of ['unknown-pool', 'claude-agent']) {
    const options = fixture(t);
    const denied = launch(options, 'worker', `worker:${pool}:attempt`, { allowGroup: [{
      provider: 'codex', model: 'gpt-6.1-sol', pool, maxParallel: registry.pools['codex-agent'].maxParallel + 1,
    }] });
    assert.equal(denied.ok, false, JSON.stringify(denied));
    assert.equal(denied.effectState, 'none');
    assert.equal(providerBudgetUsage('codex', 'default', options).running, 0, 'an invalid pool cannot reserve even the first slot');
  }
});

test('hard require and scoped owner authority survive the plan to actual SQLite receipt', t => {
  const options = fixture(t), scopeId = 'ledger/workflow/job:attempt:1';
  const grant = { authorized: true, scopeId, role: 'op', provider: 'claude', model: 'claude-opus-5-5', reason: 'owner permits this exact recovery attempt' };
  const bias = { require: { provider: 'claude' }, reserveOverride: grant };
  const noGrant = launch(options, 'op', scopeId, { bias });
  assert.equal(noGrant.ok, false);
  assert.equal(providerBudgetUsage('claude', 'default', options).running, 0);
  const provisional = ownerReserveGrant({ approved_by: 'supervisor', json: { routing_bias: bias } });
  assert.equal(provisional, null);
  const ownerGrant = ownerReserveGrant({ approved_by: 'owner', json: { routing_bias: bias } });
  const granted = launch(options, 'op', scopeId, { bias, ownerGrant });
  assert.equal(granted.ok, true, JSON.stringify(granted));
  assert.equal(granted.selected.provider, 'claude');
  const rows = providerBudgetUsage('claude', 'default', options).reservations;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scope.scopeId, scopeId);
  assert.equal(rows[0].override.reason, grant.reason);
  assert.equal(launch(options, 'worker', 'worker:attempt:1', { bias, ownerGrant }).selected.provider, 'codex');
});

test('the production receipt fence retains uncertain launches and rejects unrelated closure', t => {
  const options = fixture(t), admitted = launch(options, 'kernel', 'kernel:attempt:1');
  assert.equal(admitted.ok, true);
  const identity = { provider: 'codex', model: 'gpt-6.1-sol', role: 'kernel', launchIdentity: 'run-a/request-a', ...options };
  assert.equal(consumeAgentAdmission(admitted, identity).ok, true);
  assert.equal(consumeAgentAdmission(admitted, identity).ok, true, 'an exact replay keeps its bound launch identity');
  const anotherRun = consumeAgentAdmission(admitted, { ...identity, launchIdentity: 'run-b/request-a' });
  assert.equal(anotherRun.ok, false, 'the same original receipt cannot launch under another Run');
  assert.equal(anotherRun.reason, 'launch-identity-conflict');
  assert.equal(observeAgentAdmission(admitted, { state: 'unknown', handle: 'terminal-a' }, options).ok, true);
  assert.equal(releaseAgentAdmission(admitted, { kind: 'closed', confirmed: true, handle: 'terminal-b' }, options).ok, false);
  assert.equal(releaseAgentAdmission({ ...admitted, receipt: { ...admitted.receipt, fence: admitted.receipt.fence + 1 } },
    { kind: 'closed', confirmed: true, handle: 'terminal-a' }, options).ok, false);
  assert.equal(providerBudgetUsage('codex', 'default', options).running, 1);
  assert.equal(releaseAgentAdmission(admitted, { kind: 'closed', confirmed: true, handle: 'terminal-a',
    terminalProof: 'gone', processVerdict: 'none' }, options).ok, true);
  assert.equal(providerBudgetUsage('codex', 'default', options).running, 0);
});

test('a stale short window cannot be hidden by a fresh weekly window or owner requirement', t => {
  const options = fixture(t), fresh = options.io.quota;
  options.io.quota = (provider, args) => {
    const snapshot = fresh(provider, args);
    if (provider === 'codex') snapshot.windows.push({ id: 'short', usedPercent: 5,
      observedAt: snapshot.observedAt - allocationSettings().admission.maxAgeMs - 1,
      resetsAt: snapshot.observedAt + 600000 });
    return snapshot;
  };
  const result = launch(options, 'worker', 'worker:attempt:1', { bias: { roles: ['worker'], require: { provider: 'codex' } } });
  assert.equal(result.ok, false);
  assert.equal(providerBudgetUsage('codex', 'default', options).running, 0);
});

test('the common adapter reads the actual provider circuit before reserving any role', t => {
  const options = fixture(t);
  delete options.io.circuit;
  const machine = openMachine({ env: options.env });
  try {
    machine.setProviderHealth({ provider: 'codex', status: 'unavailable', failureKind: 'capacity',
      circuitOpenUntil: Date.now() + 600000, reason: 'provider refused service' });
  } finally { machine.close(); }
  const refused = launch(options, 'worker', 'worker:attempt:1');
  assert.equal(refused.ok, false);
  assert.ok(refused.decision.rejected.find(candidate => candidate.provider === 'codex').codes.includes('incident-open'));
  assert.equal(providerBudgetUsage('codex', 'default', options).running, 0);
});

test('unreadable circuit evidence cannot be turned into provider fallback or a slot', t => {
  const options = fixture(t);
  options.io.circuit = () => { throw new Error('circuit observation unavailable'); };
  const refused = launch(options, 'kernel', 'kernel:attempt:1');
  assert.equal(refused.ok, false);
  assert.equal(refused.effectState, 'none');
  assert.equal(providerBudgetUsage('codex', 'default', options).running, 0);
  assert.equal(providerBudgetUsage('claude', 'default', options).running, 0);
});
