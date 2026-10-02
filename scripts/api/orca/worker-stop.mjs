#!/usr/bin/env node
// Deep map WRAP RR4: Orca proves the exit; the no-effect proof on owned paths and the settle are the runtime's.
// worker-stop.mjs — the calls.yaml `worker-stop` call as a callable function.
//   node scripts/api/orca/worker-stop.mjs --dispatch <dispatch_id>
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, state, result}.
import { workerVerb, runAsCli } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

export function workerStop({ dispatch }) {
  return workerVerb('worker-stop', dispatch);
}

runAsCli('worker-stop.mjs', (argv) => workerStop({ dispatch: arg(argv, 'dispatch') }));
