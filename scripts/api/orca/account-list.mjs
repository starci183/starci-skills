#!/usr/bin/env node
// account-list.mjs — the calls.yaml `account-list` call as a callable function.
//   node scripts/api/orca/account-list.mjs
// Returns {ok, accounts, rateLimits} — accounts is result minus rateLimits.
import { orcaCall } from './lib.mjs';

export function accountList() {
  const r = orcaCall('account-list');
  const { rateLimits = null, ...accounts } = r.result ?? {};
  return { ok: r.exitCode === 0, accounts, rateLimits, error: r.error };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('account-list.mjs')) {
  const out = accountList();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
