#!/usr/bin/env node
// Deep map WRAP A2, W7: the live-worker count and the exited verdict are Orca's; admission policy and seat replacement stay the runtime's.
// worker-list.mjs — the calls.yaml `worker-list` call as a callable function: Orca's supervised worker
// terminal resource accounting (orchestration worker-list), the authority on which worker terminal is
// active, reclaimable, retained or released, and on each worker's liveness and next action.
//   node scripts/api/orca/worker-list.mjs [--run <run_id>] [--terminal-state <state>] [--cursor <c>]
//
// workerList reads one page ({ok, workers, counts, scope, page, error, hostUnavailable}); Orca returns at most 100
// rows a page, newest first. Every page is scripts/machine/worker-list-all.mjs workerListAll.
// Without `run` Orca scopes the list to the Run bound to the calling terminal, or to every Run when there is no
// binding; `scope.source` (flag | bound | all) says which, and callers that need every Run check it.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

const PAGE_LIMIT = 100;

export function workerList({ run, terminalState, cursor, limit = PAGE_LIMIT } = {}) {
  const r = orcaCall('worker-list', { run, 'terminal-state': terminalState, cursor, limit: limit == null ? undefined : String(limit) });
  const result = r.result;
  return {
    ok: r.exitCode === 0 && Array.isArray(result?.workers),
    workers: result?.workers ?? [],
    counts: result?.counts ?? null,
    scope: result?.scope ?? null,
    page: result?.page ?? null,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1]?.endsWith('worker-list.mjs')) {
  const argv = process.argv.slice(2);
  const out = workerList({ run: arg(argv, 'run'), terminalState: arg(argv, 'terminal-state'), cursor: arg(argv, 'cursor') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
