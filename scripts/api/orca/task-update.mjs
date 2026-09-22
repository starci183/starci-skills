#!/usr/bin/env node
// task-update.mjs — the calls.yaml `task-update` call as a callable function.
//   node scripts/api/orca/task-update.mjs --id <task_id> --status <status> [--result <json>] [--run <run_id>] [--from <handle>]
// Returns {ok, taskId, status} — taskId is result.task.id. --result is JSON;
// objects are serialized by orcaCall. Settle and finish use it to close the
// operation Task they opened, so a job that ends leaves no open Task in the
// workflow Run.
import { orcaCall, arg } from './lib.mjs';

export function taskUpdate({ id, status, result, run, from }) {
  const r = orcaCall('task-update', { id, status, result, run, from });
  const task = r.result?.task ?? null;
  return { ok: r.exitCode === 0 && Boolean(task?.id), taskId: task?.id ?? null, status, task, error: r.error };
}

if (process.argv[1]?.endsWith('task-update.mjs')) {
  const argv = process.argv.slice(2);
  const out = taskUpdate({
    id: arg(argv, 'id'),
    status: arg(argv, 'status'),
    result: arg(argv, 'result'),
    run: arg(argv, 'run'),
    from: arg(argv, 'from'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
