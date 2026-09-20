// scripts/api/quota/orca-account.mjs — quota probe for orca-managed providers
// (codex, claude). Source of truth is accountList() from
// scripts/api/orca/account-list.mjs — pinned shape:
//   { ok, rateLimits: { <provider>: { status, weekly: { usedPercent,
//     windowMinutes, resetsAt }, error, usageMetadata } } }
// While that wrapper is absent the same data is read inline via
// `orca account list --json` through orcaRun — the receipt nests the map under
// result.rateLimits, so the fallback normalizes it to the pinned shape.
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
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { orcaRun, jsonOf } from '../orca/lib.mjs';

const accountListFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'orca', 'account-list.mjs');

function accountList() {
  // Prefer the pinned wrapper once it lands. require() can load the ESM wrapper
  // synchronously on Node >= 22.12; a top-level-await or promise-returning
  // variant falls through to the inline CLI read.
  if (fs.existsSync(accountListFile)) {
    try {
      const mod = createRequire(import.meta.url)(accountListFile);
      if (typeof mod.accountList === 'function') {
        const out = mod.accountList();
        if (out && typeof out.then !== 'function') return out;
      }
    } catch { /* fall through to the inline receipt read */ }
  }
  const r = orcaRun(['account', 'list', '--json']);
  const receipt = jsonOf(r.stdout);
  if (r.status !== 0 || !receipt) {
    return { ok: false, error: r.error || r.stderr || `orca exited ${r.status}` };
  }
  return { ok: receipt.ok === true, rateLimits: receipt?.result?.rateLimits ?? {} };
}

export function probeOrcaAccount(provider) {
  let list;
  try {
    list = accountList();
  } catch (e) {
    return { state: 'unknown', usedPercent: null, detail: `orca account list failed: ${e?.message ?? e}` };
  }
  if (!list?.ok) {
    return { state: 'unknown', usedPercent: null, detail: `orca account list not ok${list?.error ? `: ${list.error}` : ''}` };
  }
  const entry = list.rateLimits?.[provider];
  if (!entry) {
    return { state: 'dead', usedPercent: null, detail: `no orca account/rate-limit entry for '${provider}'` };
  }
  const usedPercent = typeof entry.weekly?.usedPercent === 'number' ? entry.weekly.usedPercent : null;

  if (entry.status === 'ok') {
    if (usedPercent !== null && usedPercent >= 90) {
      return { state: 'limited', usedPercent, detail: `weekly quota ${usedPercent}% used (resets ${entry.weekly?.resetsAt ? new Date(entry.weekly.resetsAt).toISOString() : 'unknown'})` };
    }
    return { state: 'ok', usedPercent, detail: 'orca account rate-limit status ok' };
  }
  if (entry.status === 'error') {
    const failureKind = entry.usageMetadata?.failureKind ?? null;
    if (failureKind === 'stale-token') {
      return { state: 'limited', usedPercent, detail: `stale token (refreshable): ${entry.error ?? 'oauth token expired'}` };
    }
    if (failureKind === 'missing-credentials') {
      return { state: 'dead', usedPercent, detail: `missing credentials: ${entry.error ?? 'no credentials'}` };
    }
    return { state: 'unknown', usedPercent, detail: `rate-limit error, failureKind=${failureKind ?? 'absent'}: ${entry.error ?? 'no detail'}` };
  }
  if (entry.status === 'unavailable') {
    return { state: 'dead', usedPercent, detail: `provider unavailable: ${entry.error ?? 'unavailable'}` };
  }
  return { state: 'unknown', usedPercent, detail: `unrecognized rate-limit status '${entry.status}'` };
}
