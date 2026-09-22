// scripts/api/quota/orca-account.mjs — quota probe for orca-managed providers
// (codex, claude). Source of truth is accountList() from
// scripts/api/orca/account-list.mjs — pinned shape:
//   { ok, rateLimits: { <provider>: { status, weekly: { usedPercent,
//     windowMinutes, resetsAt }, error, usageMetadata } } }
//
// Mapping (pinned):
//   status 'ok'          -> state 'ok' + usedPercent; usedPercent >= 90 -> 'limited'
//   status 'error'       -> usageMetadata.failureKind decides:
//                             'stale-token'         -> 'limited' (refreshable — a
//                               real call may refresh it; NOT dead)
//                             'missing-credentials' -> 'dead'
//                             absent / other kinds  -> 'unknown' (never blocks)
//   status 'unavailable' -> 'dead'
//   provider absent from rateLimits (absent account) -> 'dead'
//   account list itself unreachable -> 'unknown'
import { accountList } from '../orca/account-list.mjs';

export function probeOrcaAccount(provider) {
  let list;
  try {
    list = accountList();
  } catch (e) {
    return { state: 'unknown', usedPercent: null, auth: 'unknown', failureKind: null,
      allowLaunchAttempt: true, detail: `orca account list failed: ${e?.message ?? e}` };
  }
  if (!list?.ok) {
    return { state: 'unknown', usedPercent: null, auth: 'unknown', failureKind: null,
      allowLaunchAttempt: true, detail: `orca account list not ok${list?.error ? `: ${list.error}` : ''}` };
  }
  const entry = list.rateLimits?.[provider];
  if (!entry) {
    return { state: 'dead', usedPercent: null, auth: 'unavailable', failureKind: 'missing-account',
      allowLaunchAttempt: false, detail: `no orca account/rate-limit entry for '${provider}'` };
  }
  const usedPercent = typeof entry.weekly?.usedPercent === 'number' ? entry.weekly.usedPercent : null;

  if (entry.status === 'ok') {
    if (usedPercent !== null && usedPercent >= 90) {
      return { state: 'limited', usedPercent, auth: 'ok', failureKind: null, allowLaunchAttempt: true,
        detail: `weekly quota ${usedPercent}% used (resets ${entry.weekly?.resetsAt ? new Date(entry.weekly.resetsAt).toISOString() : 'unknown'})` };
    }
    return { state: 'ok', usedPercent, auth: 'ok', failureKind: null, allowLaunchAttempt: true,
      detail: 'orca account rate-limit status ok' };
  }
  if (entry.status === 'error') {
    const failureKind = entry.usageMetadata?.failureKind ?? null;
    if (failureKind === 'stale-token') {
      return { state: 'limited', usedPercent, auth: 'refreshable', failureKind, allowLaunchAttempt: true,
        detail: `stale token (refreshable): ${entry.error ?? 'oauth token expired'}` };
    }
    if (failureKind === 'missing-credentials') {
      return { state: 'dead', usedPercent, auth: 'unavailable', failureKind, allowLaunchAttempt: false,
        detail: `missing credentials: ${entry.error ?? 'no credentials'}` };
    }
    return { state: 'unknown', usedPercent, auth: 'unknown', failureKind, allowLaunchAttempt: true,
      detail: `rate-limit error, failureKind=${failureKind ?? 'absent'}: ${entry.error ?? 'no detail'}` };
  }
  if (entry.status === 'unavailable') {
    return { state: 'dead', usedPercent, auth: 'unavailable',
      failureKind: entry.usageMetadata?.failureKind ?? 'unavailable', allowLaunchAttempt: false,
      detail: `provider unavailable: ${entry.error ?? 'unavailable'}` };
  }
  return { state: 'unknown', usedPercent, auth: 'unknown', failureKind: null, allowLaunchAttempt: true,
    detail: `unrecognized rate-limit status '${entry.status}'` };
}
