#!/usr/bin/env node
// worker-release.mjs — the calls.yaml `worker-release` call as a callable function.
// Internal entry: spawned by scripts/agent/lib.mjs; not invoked directly.
// Args: --dispatch <dispatch_id>
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, state, result}.
import { workerVerb, runAsCli } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Request release of one caller-owned Dispatch using the host contract's state classification.
 * ok requires a released/already-released receipt; retained or pending is partial and release_unknown
 * is unknown. This API alone does not prove terminal/process exit: complete cleanup uses closeWorker.
 * @param {object} input - Required Dispatch identity; caller custody is established before this call.
 * @returns {object} Classified outcome/effectState, Dispatch/state, host result, and error.
 */
export function workerRelease({ dispatch }) {
  return workerVerb('worker-release', dispatch);
}

runAsCli('worker-release.mjs', (argv) => workerRelease({ dispatch: arg(argv, 'dispatch') }));
