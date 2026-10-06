// scripts/agent/credential-probe.mjs — one cheap live proof that a provider's
// credential in effect is accepted, for `starci kernel provider-health --recover --probe`.
//
//   probeProviderCredential(provider) -> {ok, provider, kind, status?, detail,
//                                         credentialFingerprint, credentialSource}
//
// A provider is probed with its quota probe (scripts/agent/quota): 'ok' or 'limited' passes, 'dead' and
// 'unknown' do not — an unanswered probe is not proof.
// No result field, error text or log line carries a key.
//
//   probeProviderQuota(provider) -> {ok, provider, kind, state, status?, detail, ...}
//
// The QUOTA proof: a card whose probe kind is
// orca-account (codex) reads the Orca account's weekly window instead
// (scripts/agent/quota/orca-account.mjs, no tokens spent): ok while the account
// answers auth ok under 100% used, quota-exhausted at 100%, auth for a missing
// account or credential, inconclusive otherwise.
import { agentCardOf, credentialFingerprintOf } from './credential-fingerprint.mjs';
import { normalizeProvider } from '../lib/provider.mjs';
import { probeQuota } from './quota/index.mjs';
import { quotaSpecOf } from './provider-outage.mjs';

export async function probeProviderCredential(provider, { accounts } = {}) {
  const key = normalizeProvider(provider);
  const card = agentCardOf(key);
  if (!card) return { ok: false, provider: key, kind: null, detail: `no agent card modules/models/agents/${key}.yaml` };
  const quota = probeQuota(key);
  const current = credentialFingerprintOf(key, { card, accounts });
  const ok = quota?.state === 'ok' || quota?.state === 'limited';
  return { ok, provider: key, kind: `quota:${card.quota?.probe ?? 'none'}`, status: quota?.state ?? null,
    detail: `quota probe ${quota?.state ?? 'unknown'}: ${quota?.detail ?? 'no detail'}`,
    credentialFingerprint: current.fingerprint, credentialSource: current.source };
}

/** The orca-account quota proof: the Orca account's weekly window, read through the provider's quota probe. */
export async function orcaAccountQuota(key, { quota = probeQuota } = {}) {
  const q = (await quota(key)) ?? {};
  const used = typeof q.usedPercent === 'number' ? q.usedPercent : null;
  const base = { provider: key, kind: 'orca-account', usedPercent: used };
  const weekly = used === null ? '' : ` (weekly ${used}% used)`;
  const detail = `orca account ${key}: ${q.detail ?? q.state ?? 'no answer'}${weekly}`;
  if (q.state === 'dead') return { ok: false, ...base, state: 'auth', detail };
  if (used !== null && used >= 100) return { ok: false, ...base, state: 'quota-exhausted', detail };
  if (q.auth === 'ok' && used !== null) return { ok: true, ...base, state: 'ok', detail };
  return { ok: false, ...base, state: 'inconclusive', detail };
}

export async function probeProviderQuota(provider, { card: given, quota = probeQuota } = {}) {
  const key = normalizeProvider(provider);
  const card = given ?? agentCardOf(key);
  const spec = card ? quotaSpecOf(key, { card }) : null;
  if (!spec?.probe) return { ok: false, provider: key, kind: null, state: 'inconclusive', detail: `no quotaExhausted.probe on modules/models/agents/${key}.yaml` };
  if (spec.probe.kind === 'orca-account') return orcaAccountQuota(key, { quota });
  return { ok: false, provider: key, kind: spec.probe.kind ?? null, state: 'inconclusive', detail: `unknown quota probe kind '${spec.probe.kind}'` };
}
