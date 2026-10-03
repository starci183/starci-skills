import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuotaSnapshot } from '../../scripts/agent/quota/snapshot.mjs';
import { probeOrcaAccount } from '../../scripts/agent/quota/orca-account.mjs';
import { probeQuota } from '../../scripts/agent/quota/index.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { selectAdmission } from '../../scripts/lib/agent-admission.mjs';

const now = Date.parse('2026-10-03T08:00:00Z');
const policy = allocationSettings().admission;
const sample = (windows, extra = {}) => ({ provider: 'claude', account: 'a', auth: 'ok', observedAt: now, windows, ...extra });
const window = (id, usedPercent, extra = {}) => ({ id, usedPercent, observedAt: now, resetsAt: now + 600000, ...extra });

test('the shortest exhausted or reserve window governs even with an abundant weekly window', () => {
  const limited = normalizeQuotaSnapshot(sample([window('weekly', 4), window('five-hour', 96)]), { policy, now });
  assert.equal(limited.state, 'limited');
  assert.equal(limited.normalAdmission, false);
  assert.equal(limited.usedPercent, 96);
  assert.equal(normalizeQuotaSnapshot(sample([window('weekly', 4), window('five-hour', 100)]), { policy, now }).state, 'dead');
});

test('freshness, reset rollover, missing windows and malformed percentages are unknown, never admission', () => {
  for (const windows of [[], [window('weekly', null)], [window('weekly', -1)], [window('weekly', 101)],
    [window('weekly', 3, { observedAt: now - policy.maxAgeMs - 1 })], [window('weekly', 3, { resetsAt: null })], [window('weekly', 3, { resetsAt: now })]]) {
    const result = normalizeQuotaSnapshot(sample(windows), { policy, now });
    assert.equal(result.state, 'unknown');
    assert.equal(result.normalAdmission, false);
  }
  assert.equal(normalizeQuotaSnapshot(sample([window('weekly', 1)], { observedAt: now + 1 }), { policy, now }).state, 'unknown');
  assert.equal(normalizeQuotaSnapshot(sample([window('weekly', 1)]), { now }).normalAdmission, false, 'no second policy default');
  assert.equal(probeOrcaAccount('claude', { policy, now, accountList: () => ({ ok: true, rateLimits: { claude: { status: 'ok', weekly: window('weekly', 1) } } }) }).state, 'unknown', 'reading a cached account response does not invent an observation timestamp');
});

test('all nested Orca windows retain provider, account and observation identity', () => {
  const result = probeOrcaAccount('codex', { policy, now, accountList: () => ({ ok: true, rateLimits: { codex: {
    status: 'ok', accountId: 'signed-in-a', observedAt: now, weekly: window('weekly', 3),
    rateLimitsByLimitId: { shared: { primaryWindow: window('short', 95), secondaryWindow: window('long', 4) } },
  } } }) });
  assert.equal(result.account, 'signed-in-a');
  assert.equal(result.provider, 'codex');
  assert.equal(result.windows.length, 3);
  assert.equal(result.state, 'limited');
  assert.equal(result.allowLaunchAttempt, false);
});

test('unknown auth and stale token do not become an authorized reserve launch', () => {
  const result = probeOrcaAccount('claude', { policy, now, accountList: () => ({ ok: true, rateLimits: { claude: {
    status: 'error', weekly: window('weekly', 3), usageMetadata: { failureKind: 'stale-token' },
  } } }) });
  assert.equal(result.auth, 'refreshable');
  assert.equal(result.state, 'unknown');
  assert.equal(result.normalAdmission, false);
});

test('renormalizing a canonical snapshot preserves every window and its original freshness/expiry', () => {
  for (const percent of [4, 96, 100]) {
    const snapshot = normalizeQuotaSnapshot(sample([window('short', percent), window('long', 4)], { expiresAt: now + 30000 }), { policy, now });
    assert.deepEqual(normalizeQuotaSnapshot(snapshot, { policy, now }), snapshot);
    assert.equal(normalizeQuotaSnapshot(snapshot, { policy, now: now + 30001 }).fresh, false);
  }
});

test('malformed expiry, duplicate or missing window identity and unknown authority fail closed', () => {
  for (const observation of [
    sample([window('weekly', 3)], { expiresAt: 'bad-date' }),
    sample([window('weekly', 3), window('weekly', 4)]),
    sample([window('', 3)]), sample([window('weekly', 3)], { authority: 'self-asserted' }),
    sample([window('weekly', 3, { observedAt: 'bad-date' })]),
    sample([window('weekly', 3)], { normalAdmission: false }),
    sample([window('weekly', 3)], { fresh: false }),
  ]) {
    const result = normalizeQuotaSnapshot(observation, { policy, now });
    assert.equal(result.state, 'unknown');
    assert.equal(result.normalAdmission, false);
    assert.equal(normalizeQuotaSnapshot(result, { policy, now }).normalAdmission, false);
  }
  assert.equal(normalizeQuotaSnapshot(sample([window('weekly', 3)]), { policy: { ...policy, exhaustedPercent: 101 }, now }).normalAdmission, false);
});

test('explicit falsy quota authority is refused by normalization and pure admission; absent authority defaults to windows', () => {
  const healthy = normalizeQuotaSnapshot(sample([window('short', 3)]), { policy, now });
  const select = quota => selectAdmission({
    request: { role: 'worker', scopeId: 'quota-authority', attemptId: 'quota-authority-1',
      allowGroup: [{ provider: 'claude', model: 'claude-opus-5-5' }] },
    candidates: [{ id: 'claude', provider: 'claude', account: 'a', model: 'claude-opus-5-5',
      modelAuthority: 'supported-model-argument', qualityFloor: 'frontier',
      eligibility: { eligible: true, mode: 'scoped-control-plane' }, quota,
      capacity: { running: 0, maxParallel: 1 } }], policy, now,
  });
  for (const authority of [undefined, null]) {
    const normalized = normalizeQuotaSnapshot(sample([window('short', 3)], { authority }), { policy, now });
    assert.equal(normalized.authority, 'provider-windows');
    assert.equal(normalized.normalAdmission, true);
    assert.equal(select(normalized).ok, true);
  }
  for (const authority of [false, 0, '']) {
    const decision = select({ ...healthy, authority });
    assert.equal(decision.ok, false, `pure admission must reject explicit authority ${JSON.stringify(authority)}`);
    assert.ok(decision.rejected[0].codes.includes('quota-authority-unknown'));
    const normalized = normalizeQuotaSnapshot(sample([window('short', 3)], { authority }), { policy, now });
    assert.equal(normalized.normalAdmission, false);
    assert.equal(normalized.state, 'unknown');
    assert.equal(normalizeQuotaSnapshot(normalized, { policy, now }).normalAdmission, false);
  }
});

test('a live clock is evaluated after the query while a fixed clock retains future-observation refusal', () => {
  let current = now;
  const options = { policy, now: () => current, accountList: () => {
    current += 200;
    return { ok: true, rateLimits: { codex: { status: 'ok', observedAt: current,
      weekly: window('weekly', 3, { observedAt: current }) } } };
  } };
  const fresh = probeQuota('codex', options);
  assert.equal(fresh.state, 'ok');
  assert.equal(fresh.observedAt, current);
  assert.equal(probeOrcaAccount('codex', { ...options, now }).state, 'unknown', 'explicit fixed now does not bless future evidence');
});
