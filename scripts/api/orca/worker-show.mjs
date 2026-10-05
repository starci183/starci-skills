#!/usr/bin/env node
// Deep map WRAP W2, W7, M6: the effective launch, the seat liveness and the Dispatch heartbeat are Orca's; the route-versus-effective policy, the seat state machine and lease renewal stay the runtime's.
// worker-show.mjs — the calls.yaml `worker-show` call as a callable function.
// Internal entry: spawned by scripts/agent/lib.mjs; not invoked directly.
// Args: --dispatch <dispatch_id>
// Returns {ok, state, dispatch, effective, hostUnavailable} — state is result.worker.state; hostUnavailable is an Orca that
// did not answer (proves nothing about the worker).
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';
import { isMain } from '../../lib/is-main.mjs';

/**
 * Read a Dispatch's worker state and effective launch from typed host receipt fields.
 * Malformed start-options JSON does not become attestation; titles and terminal text are never
 * substituted. A failed or hostUnavailable read proves no worker exit and grants no replacement.
 * @param {object} input - Required Dispatch identity.
 * @returns {object} ok, state, Dispatch, effective launch, raw result, error, and hostUnavailable.
 */
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
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (isMain(import.meta.url)) {
  const out = workerShow({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
