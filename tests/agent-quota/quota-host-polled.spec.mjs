import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeOrcaAccount } from '../../scripts/agent/quota/orca-account.mjs';
import { normalizeQuotaSnapshot } from '../../scripts/agent/quota/snapshot.mjs';
import { reserveProviderBudget, markProviderBudget } from '../../scripts/agent/provider-budget.mjs';
import { quotaPolicyValid } from '../../scripts/lib/quota-evidence.mjs';
import { allocationSettings } from '../../engine/config.mjs';

// The host-polled age limit (allocation.admission.hostPolledMaxAgeMs) applies to Orca account entries only.
const real = JSON.parse(fs.readFileSync(new URL('../fixtures/orca/account-list-1.4.209.json', import.meta.url), 'utf8'));
const policy = allocationSettings().admission;
const updatedAt = real.rateLimits.codex.updatedAt;
const MIN = 60_000, HOUR = 60 * MIN;
const probe = (age, entry = real.rateLimits.codex, options = {}) => probeOrcaAccount('codex', { policy: options.policy ?? policy, now: updatedAt + age,
  accountList: () => ({ ok: true, accounts: {}, rateLimits: { codex: structuredClone(entry) } }) });

test('the policy declares a host-polled limit of 24 hours that never undercuts maxAgeMs', () => {
  assert.equal(policy.hostPolledMaxAgeMs, 24 * HOUR);
  assert.equal(quotaPolicyValid(policy), true);
  assert.equal(quotaPolicyValid({ ...policy, hostPolledMaxAgeMs: policy.maxAgeMs - 1 }), false);
  assert.equal(quotaPolicyValid({ ...policy, hostPolledMaxAgeMs: Number.NaN }), false);
  const { hostPolledMaxAgeMs, ...without } = policy;
  assert.equal(quotaPolicyValid(without), true);
});

test('Orca account entries are admissible up to hostPolledMaxAgeMs and stale after it', () => {
  for (const age of [4 * MIN, 33 * MIN, 24 * HOUR - MIN]) {
    const quota = probe(age);
    assert.equal(quota.observation, 'host-polled');
    assert.equal(quota.fresh, true, `age ${age}`);
    assert.equal(quota.normalAdmission, true, `age ${age}`);
  }
  const stale = probe(24 * HOUR + MIN);
  assert.equal(stale.fresh, false);
  assert.equal(stale.normalAdmission, false);
  assert.equal(stale.detail, 'quota observed 86460 s ago by Orca, limit 86400 s; Orca refreshes usage while its window is focused');
  const missing = probe(MIN, { ...real.rateLimits.codex, updatedAt: undefined });
  assert.equal(missing.fresh, false);
  assert.match(missing.detail, /^quota has no observation time by Orca; limit 86400 s; Orca refreshes usage/);
});

test('a policy without hostPolledMaxAgeMs keeps maxAgeMs for Orca entries', () => {
  const { hostPolledMaxAgeMs, ...without } = policy;
  assert.equal(probe(4 * MIN, undefined, { policy: without }).fresh, true);
  const stale = probe(33 * MIN, undefined, { policy: without });
  assert.equal(stale.fresh, false);
  assert.match(stale.detail, /limit 300 s; Orca refreshes usage/);
});

test('direct probes and owner grants keep maxAgeMs and cannot claim the host-polled limit', () => {
  const now = updatedAt + 6 * MIN, windows = [{ id: 'weekly', usedPercent: 3, observedAt: updatedAt, resetsAt: now + HOUR }];
  const direct = normalizeQuotaSnapshot({ provider: 'devin', account: 'a', auth: 'ok', observedAt: updatedAt, windows }, { policy, now });
  assert.equal(direct.observation, 'direct');
  assert.equal(direct.fresh, false);
  const grant = { owner: 'config.yaml', scopeId: 's', roles: ['worker'], slots: 1, observedAt: updatedAt };
  const claimed = normalizeQuotaSnapshot({ provider: 'codex', account: 'a', auth: 'ok', observedAt: updatedAt, observation: 'host-polled',
    authority: 'owner-grant', grant, state: 'ok' }, { policy, now });
  assert.equal(claimed.observation, 'direct');
  assert.equal(claimed.fresh, false);
  assert.equal(claimed.normalAdmission, false);
});

test('a reservation and its launching mark agree with admission for a 33-minute-old Orca snapshot', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-host-polled-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const now = updatedAt + 33 * MIN;
  const options = { env: { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(directory, 'machine.sqlite') }, policy, now: () => now };
  const quota = probe(33 * MIN, { ...real.rateLimits.codex, accountId: 'a' });
  assert.equal(quota.fresh, true);
  const reserved = reserveProviderBudget({ provider: 'codex', account: 'a', model: 'gpt-6.1-sol', role: 'worker', scopeId: 'scope-a',
    attemptId: 'worker:a', maxParallel: 1, quota }, options);
  assert.equal(reserved.ok, true, JSON.stringify(reserved));
  const marked = markProviderBudget(reserved.reservation, { state: 'launching', launchIdentity: 'run-a:worker-request-a' }, { ...options, now: () => now + MIN });
  assert.equal(marked.ok, true, JSON.stringify(marked));
  const late = markProviderBudget(reserved.reservation, { state: 'launching', launchIdentity: 'run-a:worker-request-a' }, { ...options, now: () => updatedAt + 25 * HOUR });
  assert.equal(late.ok, false);
});
