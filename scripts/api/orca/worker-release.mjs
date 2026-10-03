#!/usr/bin/env node
// worker-release.mjs — the calls.yaml `worker-release` call as a callable function.
// Internal entry: spawned by scripts/agent/lib.mjs; not invoked directly.
// Args: --dispatch <dispatch_id>
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, state, result}.
import { workerVerb, runAsCli } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

export function workerRelease({ dispatch }) {
  return workerVerb('worker-release', dispatch);
}

runAsCli('worker-release.mjs', (argv) => workerRelease({ dispatch: arg(argv, 'dispatch') }));
