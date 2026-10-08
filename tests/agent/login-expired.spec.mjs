// An expired provider login is the owner's to fix and the refusal must say so in plain words. Live shape (2026-10-08): Orca's
// rate-limit snapshot for claude said status error, "OAuth access token has expired. Re-authenticate to continue.", and the
// owner only saw no-eligible-candidate with auth-unknown, quota-windows-missing, quota-stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeOrcaAccount } from '../../scripts/agent/quota/orca-account.mjs';
import { admitAgent } from '../../scripts/agent/admission.mjs';
import { loginExpiredOf, loginExpiredText } from '../../scripts/lib/login-expired.mjs';
import { loginRows } from '../../scripts/reconciler/login-items.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';
import { incidentPolicy } from '../../scripts/kernel/op-incident-policy.mjs';

const MESSAGE = 'OAuth access token has expired. Re-authenticate to continue.';
const expiredEntry = { status: 'error', error: MESSAGE, updatedAt: Date.now() };
const listOf = (claude) => () => ({ ok: true, rateLimits: { claude, codex: { status: 'ok', updatedAt: Date.now() } } });

test('the expired login is detected from the host message and named with provider, message and action', () => {
  const expired = loginExpiredOf('claude', expiredEntry);
  assert.equal(expired.provider, 'claude');
  assert.equal(expired.hostMessage, MESSAGE);
  assert.match(loginExpiredText(expired), /^the claude login has expired \(Orca says: "OAuth access token has expired\. Re-authenticate to continue\."\); log in to claude again in Orca/);
  assert.equal(loginExpiredOf('claude', { status: 'ok' }), null);
  assert.equal(loginExpiredOf('claude', { status: 'error', error: 'rate limited' }), null);
});

test('the quota probe carries the plain sentence and the failure kind', () => {
  const quota = probeOrcaAccount('claude', { accountList: listOf(expiredEntry) });
  assert.equal(quota.failureKind, 'login-expired');
  assert.match(quota.detail, /the claude login has expired/);
  assert.equal(quota.state, 'dead');
});

test('the admission refusal names the provider login instead of bare codes', () => {
  const quotas = { claude: probeOrcaAccount('claude', { accountList: listOf(expiredEntry) }) };
  const fake = fakeAdmission({ used: { codex: 20 } });
  const io = { ...fake, quota: (provider, options) => quotas[provider] ?? fake.quota(provider, options), circuit: () => null, reap: { status: () => ({ reachable: false }) } };
  const refused = admitAgent({ role: 'supervisor', scopeId: 'supervisor:main', allowGroup: [{ provider: 'claude', model: 'claude-opus-5-5', maxParallel: 99, eligibility: { eligible: true, mode: 'operation-policy' } }] }, { io });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'provider-login-expired');
  assert.deepEqual(refused.providers, ['claude']);
  assert.match(refused.detail, /the claude login has expired \(Orca says: "OAuth access token has expired/);
});

test('the host checklist row is red and carries the same sentence and the action', () => {
  const [row] = loginRows({ list: listOf(expiredEntry) });
  assert.deepEqual([row.id, row.status, row.required], ['login:claude', 'red', true]);
  assert.match(row.detail, /the claude login has expired/);
  assert.match(row.fix, /log in to claude again in Orca/);
  assert.deepEqual(loginRows({ list: listOf({ status: 'ok' }) }), []);
  assert.deepEqual(loginRows({ list: () => ({ ok: false }) }), []);
});

test('the hold policy classifies it as an owner-handled credential row', () => {
  const row = incidentPolicy().rows.find((entry) => entry.id === 'error-login-expired');
  assert.deepEqual([row.cause, row.handler, row.next], ['credentials', 'owner', 'owner']);
  assert.match(row.action, /next eligible member/);
});
