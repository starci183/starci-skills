#!/usr/bin/env node
// account-list.mjs — `orca account list` as a callable function.
//   node scripts/api/orca/account-list.mjs
// Returns {ok, accounts, rateLimits} — accounts is result minus rateLimits.
import { orcaRun, jsonOf } from './lib.mjs';

export function accountList() {
  const r = orcaRun(['account', 'list', '--json']);
  const { rateLimits = null, ...accounts } = jsonOf(r.stdout)?.result ?? {};
  return { ok: r.status === 0, accounts, rateLimits, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('account-list.mjs')) {
  const out = accountList();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
