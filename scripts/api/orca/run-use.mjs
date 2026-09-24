#!/usr/bin/env node
// run-use.mjs — the calls.yaml `run-use` call as a callable function.
//   node scripts/api/orca/run-use.mjs --id <run_id> --from <coordinator terminal>
// Binds the Run to --from as its coordinator. Returns {ok, run, errorCode, error, hostUnavailable}.
import { orcaCall, arg } from './lib.mjs';

export function runUse({ id, from }) {
  const r = orcaCall('run-use', { id, from });
  const run = r.result?.run ?? null;
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  return { ok: r.exitCode === 0 && r.outcome !== 'failed', run, errorCode, error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('run-use.mjs')) {
  const argv = process.argv.slice(2);
  const out = runUse({ id: arg(argv, 'id'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
