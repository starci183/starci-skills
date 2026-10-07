import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeOrcaAccount } from '../../scripts/agent/quota/orca-account.mjs';
import { selectAdmission, rejectionSummary } from '../../scripts/lib/agent-admission.mjs';
import { allocationSettings } from '../../engine/config.mjs';

// Orca 1.4.209: the observation time is the entry's `updatedAt`; its windows carry no timestamp of their own.
const real = JSON.parse(readFileSync(new URL('../fixtures/orca/account-list-1.4.209.json', import.meta.url), 'utf8'));
const policy = allocationSettings().admission;
const updatedAt = real.rateLimits.claude.updatedAt;
const probe = (at, mutate = (entry) => entry) => probeOrcaAccount('claude', { policy, now: at,
  accountList: () => ({ ok: true, accounts: {}, rateLimits: { claude: mutate(structuredClone(real.rateLimits.claude)) } }) });

test('a fresh updatedAt admits the real Orca entry with normal headroom', () => {
  const quota = probe(updatedAt + 60_000);
  assert.equal(quota.auth, 'ok');
  assert.equal(quota.observedAt, updatedAt);
  assert.equal(quota.fresh, true);
  assert.equal(quota.state, 'ok');
  assert.equal(quota.normalAdmission, true);
  assert.deepEqual(quota.windows.map((window) => window.id).sort(), ['fableWeekly', 'session', 'weekly']);
  assert.ok(quota.windows.every((window) => window.observedAt === updatedAt), 'windows inherit the entry observation');
});

test('an updatedAt older than maxAgeMs is stale and the detail names its age and the limit', () => {
  const quota = probe(updatedAt + policy.maxAgeMs + 1_000_000);
  assert.equal(quota.fresh, false);
  assert.equal(quota.normalAdmission, false);
  assert.equal(quota.allowLaunchAttempt, false);
  assert.equal(quota.detail, `quota observed ${Math.round((policy.maxAgeMs + 1_000_000) / 1000)} s ago by Orca, limit ${policy.maxAgeMs / 1000} s`);
});

test('a missing updatedAt is stale and says there is no observation time', () => {
  const quota = probe(updatedAt, (entry) => { delete entry.updatedAt; return entry; });
  assert.equal(quota.observedAt, null);
  assert.equal(quota.fresh, false);
  assert.equal(quota.normalAdmission, false);
  assert.match(quota.detail, /^quota has no observation time by Orca; limit 300 s$/);
});

test('a stale-token entry is refreshable, never admissible', () => {
  const quota = probe(updatedAt + 1_000, (entry) => ({ ...entry, status: 'error', error: 'OAuth token expired', session: null, weekly: null,
    fableWeekly: null, usageMetadata: { failureKind: 'stale-token' } }));
  assert.equal(quota.auth, 'refreshable');
  assert.equal(quota.normalAdmission, false);
  assert.equal(quota.allowLaunchAttempt, false);
});

test('the admission receipt carries the staleness detail of a rejected candidate', () => {
  const at = updatedAt + policy.maxAgeMs + 1_000_000;
  const quota = probeOrcaAccount('claude', { policy, now: at, account: 'a',
    accountList: () => ({ ok: true, accounts: {}, rateLimits: { claude: { ...real.rateLimits.claude, accountId: 'a' } } }) });
  const receipt = selectAdmission({ request: { role: 'supervisor', scopeId: 'orca-real-shape', attemptId: 'orca-real-shape-1',
    allowGroup: [{ provider: 'claude', model: 'claude-opus-5-5' }] },
  candidates: [{ id: 'claude-opus', provider: 'claude', account: 'a', model: 'claude-opus-5-5', modelAuthority: 'supported-model-argument',
    qualityFloor: 'frontier', eligibility: { eligible: true, mode: 'scoped-control-plane' }, quota, capacity: { running: 0, maxParallel: 1 } }],
  policy, now: at });
  assert.equal(receipt.ok, false);
  assert.equal(receipt.reason, 'no-eligible-candidate');
  assert.ok(receipt.rejected[0].codes.includes('quota-stale'));
  assert.match(receipt.rejected[0].detail, /^quota observed \d+ s ago by Orca, limit 300 s$/);
  assert.equal(rejectionSummary(receipt), `claude-opus: ${receipt.rejected[0].detail}`);
});
