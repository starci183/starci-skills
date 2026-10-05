#!/usr/bin/env node
// task-list.mjs — the calls.yaml `task-list` call as a callable function.
// Internal entry: spawned by scripts/kernel/cli.mjs; not invoked directly.
// Args: --run <run_id>
// Returns {ok, tasks, errorCode, error, hostUnavailable}: `tasks` is result.tasks (Orca's own Task status).
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Reads Tasks for the named Run rather than relying on an inferred sender terminal.
 * ok requires an actual tasks array, including a valid empty array.
 * A failed or malformed response falls back to an empty array without proving that the Run has no Tasks; callers retain error and outage detail.
 */
export function taskList({ run }) {
  const r = orcaCall('task-list', { run });
  const tasks = Array.isArray(r.result?.tasks) ? r.result.tasks : null;
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  return { ok: r.exitCode === 0 && tasks !== null, tasks: tasks ?? [], errorCode, error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('task-list.mjs')) {
  const out = taskList({ run: arg(process.argv.slice(2), 'run') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
