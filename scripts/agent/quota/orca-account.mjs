// Orca owns the observed account windows; runtime admission owns their normalized policy.
// Every snapshot built here is host-polled: Orca, not the runtime, fetched the usage at entry.updatedAt.
import { accountList } from '../../api/orca/account-list.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { normalizeQuotaSnapshot } from './snapshot.mjs';
import { loginExpiredOf, loginExpiredText, LOGIN_EXPIRED_KIND } from '../../lib/login-expired.mjs';

export function probeOrcaAccount(provider, options = {}) {
  const policy = options.policy ?? allocationSettings()?.admission;
  const clock = typeof options.now === 'function' ? options.now : () => options.now ?? Date.now();
  const normalized = (input) => {
    const now = clock();
    return normalizeQuotaSnapshot({ provider, account: options.account ?? 'default', observedAt: now, observation: 'host-polled', observedBy: 'Orca', ...input }, { policy, now });
  };
  let list;
  try { list = (options.accountList ?? accountList)(); }
  catch (error) { return normalized({ state: 'unknown', detail: `orca account list failed: ${error?.message ?? error}` }); }
  if (!list?.ok) return normalized({ state: 'unknown', detail: 'orca account list did not return account evidence' });
  const entry = list.rateLimits?.[provider];
  if (!entry) return normalized({ state: 'dead', auth: 'unavailable', failureKind: 'missing-account', detail: `no account quota entry for ${provider}` });
  const account = entry.accountId ?? options.account ?? 'default';
  const observedAt = entry.updatedAt ?? entry.observedAt ?? entry.usageMetadata?.observedAt ?? list.observedAt ?? list.accounts?.observedAt ?? null;
  const failing = failingEntryOf(provider, entry);
  return normalized({ account, observedAt, entry, ...(failing ?? { auth: 'ok' }) });
}

// The quota fields of an account entry that cannot supply windows, or null for a healthy one.
function failingEntryOf(provider, entry) {
  if (entry.status === 'unavailable' || entry.usageMetadata?.failureKind === 'missing-credentials')
    return { state: 'dead', auth: 'unavailable', failureKind: entry.usageMetadata?.failureKind ?? 'unavailable', detail: entry.error ?? 'provider unavailable' };
  const expired = loginExpiredOf(provider, entry);
  if (expired) return { state: 'unknown', auth: 'unavailable', failureKind: LOGIN_EXPIRED_KIND, detail: loginExpiredText(expired) };
  if (entry.status === 'ok') return null;
  return { state: 'unknown', auth: entry.usageMetadata?.failureKind === 'stale-token' ? 'refreshable' : 'unknown',
    failureKind: entry.usageMetadata?.failureKind ?? null, detail: entry.error ?? 'account quota status unknown' };
}
