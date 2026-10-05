#!/usr/bin/env node
// Deep map WRAP RR4: Orca proves the exit; the no-effect proof on owned paths and the settle are the runtime's.
// worker-stop.mjs — the calls.yaml `worker-stop` call as a callable function.
// Internal entry: spawned by scripts/agent/lib.mjs; not invoked directly.
// Args: --dispatch <dispatch_id>
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, state, result}.
import { workerVerb, runAsCli } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Request stop of one caller-owned Dispatch through the host's lifecycle classification.
 * ok requires a classifiable state receipt, not merely exit zero. stop_unknown, unverifiable and
 * outcome_unknown remain unknown; reconciliation and complete release are owned by closeWorker.
 * @param {object} input - Required Dispatch identity; this call does not establish ownership.
 * @returns {object} Classified outcome/effectState, Dispatch/state, host result, and error.
 */
export function workerStop({ dispatch }) {
  return workerVerb('worker-stop', dispatch);
}

runAsCli('worker-stop.mjs', (argv) => workerStop({ dispatch: arg(argv, 'dispatch') }));
