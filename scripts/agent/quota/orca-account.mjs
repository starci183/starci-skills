// Orca owns the observed account windows; runtime admission owns their normalized policy.
import { accountList } from '../../api/orca/account-list.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { normalizeQuotaSnapshot } from './snapshot.mjs';

export function probeOrcaAccount(provider, options = {}) {
  const policy = options.policy ?? allocationSettings()?.admission;
  const clock = typeof options.now === 'function' ? options.now : () => options.now ?? Date.now();
  const normalized = (input) => {
    const now = clock();
    return normalizeQuotaSnapshot({ provider, account: options.account ?? 'default', observedAt: now, ...input }, { policy, now });
  };
  let list;
  try { list = (options.accountList ?? accountList)(); }
  catch (error) { return normalized({ state: 'unknown', detail: `orca account list failed: ${error?.message ?? error}` }); }
  if (!list?.ok) return normalized({ state: 'unknown', detail: 'orca account list did not return account evidence' });
  const entry = list.rateLimits?.[provider];
  if (!entry) return normalized({ state: 'dead', auth: 'unavailable', failureKind: 'missing-account', detail: `no account quota entry for ${provider}` });
  const account = entry.accountId ?? options.account ?? 'default';
  const observedAt = entry.observedAt ?? entry.usageMetadata?.observedAt ?? list.observedAt ?? list.accounts?.observedAt ?? null;
  if (entry.status === 'unavailable' || entry.usageMetadata?.failureKind === 'missing-credentials')
    return normalized({ account, observedAt, entry, state: 'dead', auth: 'unavailable', failureKind: entry.usageMetadata?.failureKind ?? 'unavailable', detail: entry.error ?? 'provider unavailable' });
  if (entry.status !== 'ok') return normalized({ account, observedAt, entry, state: 'unknown',
    auth: entry.usageMetadata?.failureKind === 'stale-token' ? 'refreshable' : 'unknown',
    failureKind: entry.usageMetadata?.failureKind ?? null, detail: entry.error ?? 'account quota status unknown' });
  return normalized({ account, observedAt, entry, auth: 'ok' });
}
