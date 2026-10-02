#!/usr/bin/env node
// task-list.mjs — the calls.yaml `task-list` call as a callable function.
//   node scripts/api/orca/task-list.mjs --run <run_id>
// Returns {ok, tasks, errorCode, error, hostUnavailable}: `tasks` is result.tasks (Orca's own Task status).
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

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
