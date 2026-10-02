#!/usr/bin/env node
// Deep map WRAP R1: one Run per workflow; the rebind-once guard stays, because a repeated run-use fences live consumers.
// run-show.mjs — the calls.yaml `run-show` call as a callable function.
//   node scripts/api/orca/run-show.mjs --id <run_id>
// Returns {ok, run, coordinator, missing, errorCode, error, hostUnavailable}:
// `coordinator` is result.run.coordinator_handle, `missing` is Orca's typed
// run_not_found (the Run is gone, not the host).
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

export function runShow({ id }) {
  const r = orcaCall('run-show', { id });
  const run = r.result?.run ?? null;
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  return { ok: r.exitCode === 0 && Boolean(run?.id), run, coordinator: run?.coordinator_handle ?? null,
    missing: errorCode === 'run_not_found', errorCode, error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('run-show.mjs')) {
  const out = runShow({ id: arg(process.argv.slice(2), 'id') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
