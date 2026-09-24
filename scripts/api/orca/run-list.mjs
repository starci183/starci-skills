#!/usr/bin/env node
// run-list.mjs — the calls.yaml `run-list` call as a callable function.
//   node scripts/api/orca/run-list.mjs
// Returns {ok, runs, error, hostUnavailable}.
import { orcaCall } from './lib.mjs';

export function runList() {
  const r = orcaCall('run-list', {});
  return { ok: r.exitCode === 0 && Array.isArray(r.result?.runs), runs: r.result?.runs ?? [], error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('run-list.mjs')) {
  const out = runList();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
