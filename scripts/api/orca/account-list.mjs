#!/usr/bin/env node
// Deep map WRAP AC1, AC2: quota windows and the active account are Orca's; the quota circuit and credential fingerprint policy are the runtime's.
// account-list.mjs — the calls.yaml `account-list` call as a callable function.
//   node scripts/api/orca/account-list.mjs
// Returns {ok, accounts, rateLimits} — accounts is result minus rateLimits.
import { orcaCall } from './lib.mjs';
import { isMain } from '../../lib/is-main.mjs';

export function accountList() {
  const r = orcaCall('account-list');
  const { rateLimits = null, ...accounts } = r.result ?? {};
  return { ok: r.exitCode === 0, accounts, rateLimits, error: r.error };
}

if (isMain(import.meta.url)) {
  const out = accountList();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
