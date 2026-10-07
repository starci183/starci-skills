#!/usr/bin/env node
// Deep map WRAP R1: the rebind-once guard stays, because a repeated run-use fences live consumers.
// run-use.mjs — the calls.yaml `run-use` call as a callable function.
// Internal entry: spawned by scripts/kernel/orca-runs.mjs; not invoked directly.
// Args: --id <run_id> --from <coordinator terminal>
// Binds the Run to --from as its coordinator. Returns {ok, run, errorCode, error, request, hostUnavailable}.
// calls.yaml declares run-use replay: request (a repeated run-use fences live Dispatches): its ledger identity is the
// pair it binds, {run, from}, so a lost receipt replays the recorded rebind instead of issuing a second one.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Binds a Run to the named coordinator terminal with request identity derived from the Run and terminal pair.
 * Callers issue it after a read establishes a different coordinator; a fresh repeated rebind can fence live Dispatches.
 * Returns a nullable Run, error fields and request metadata; ok follows exit and outcome without requiring a Run receipt.
 * Reconcile a lost receipt under the same identity rather than issuing another coordinator bind.
 */
export function runUse({ id, from }) {
  const r = orcaCall('run-use', { id, from }, { request: { run: id, from } });
  const run = r.result?.run ?? null;
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  return { ok: r.exitCode === 0 && r.outcome !== 'failed', run, effectState: r.effectState, errorCode, error: r.error, request: r.request, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('run-use.mjs')) {
  const argv = process.argv.slice(2);
  const out = runUse({ id: arg(argv, 'id'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
