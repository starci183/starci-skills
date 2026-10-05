#!/usr/bin/env node
// task-update.mjs — the calls.yaml `task-update` call as a callable function.
// Called by the launch smoke and draw critic for their own Tasks.
// Args: --id <task_id> --status <status> [--result <json>] [--run <run_id>] [--from <handle>]
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Updates an explicitly owned smoke or critic Task; operation Tasks settle through their own worker_done.
 * id and status are required; pass serialized JSON text for result when it is provided.
 * Returns the nullable Task and id, error detail and the requested status echoed back; ok requires a zero exit and Task id.
 * The shared runner may reissue this naturally idempotent state write after a lost receipt.
 */
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
