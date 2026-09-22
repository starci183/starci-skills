#!/usr/bin/env node
// worker-stop.mjs — the calls.yaml `worker-stop` call as a callable function.
//   node scripts/api/orca/worker-stop.mjs --dispatch <dispatch_id>
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, state, result}.
import { orcaCall, arg } from './lib.mjs';

export function workerStop({ dispatch }) {
  const r = orcaCall('worker-stop', { dispatch });
  const result = r.result;
  return {
    ok: r.outcome === 'ok',
    outcome: r.outcome,
    effectState: r.effectState,
    dispatchId: result?.dispatchId ?? null,
    state: result?.state ?? null,
    result,
    error: r.error,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-stop.mjs')) {
  const out = workerStop({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
