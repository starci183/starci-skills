#!/usr/bin/env node
// worker-show.mjs — the calls.yaml `worker-show` call as a callable function.
//   node scripts/api/orca/worker-show.mjs --dispatch <dispatch_id>
// Returns {ok, state, dispatch, effective} — state is result.worker.state.
import { orcaCall, arg } from './lib.mjs';

export function workerShow({ dispatch }) {
  const r = orcaCall('worker-show', { dispatch });
  const result = r.result;
  let rawStartOptions = null;
  try { rawStartOptions = JSON.parse(result?.worker?.start_options ?? 'null'); } catch { /* malformed host detail is not attestation */ }
  // Current Orca receipts expose the requested/effective launch on the worker
  // start options, while older receipts exposed it at result.launch. Accept
  // both typed locations; never infer a model from terminal text or titles.
  const effective = result?.launch?.effective
    ?? result?.worker?.startOptions?.launch?.effective
    ?? rawStartOptions?.launch?.effective
    ?? result?.effective
    ?? null;
  return {
    ok: r.exitCode === 0 && Boolean(result),
    state: result?.worker?.state ?? null,
    dispatch: result?.dispatch ?? null,
    effective,
    result,
    error: r.error,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-show.mjs')) {
  const out = workerShow({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
