#!/usr/bin/env node
// task-update.mjs — `orca orchestration task-update` as a callable function.
//   node scripts/api/orca/task-update.mjs --id <task_id> --status <status> [--result <json>] [--run <run_id>] [--from <handle>]
// Returns {ok, taskId} — taskId is result.task.id. --result is JSON; objects are serialized.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function taskUpdate({ id, status, result, run, from }) {
  if (!id) throw new Error('taskUpdate: missing required --id');
  if (!status) throw new Error('taskUpdate: missing required --status');
  const argv = ['orchestration', 'task-update', '--id', id, '--status', status, '--json'];
  if (result !== undefined && result !== null) argv.push('--result', typeof result === 'string' ? result : JSON.stringify(result));
  if (run) argv.push('--run', run);
  if (from) argv.push('--from', from);
  const r = orcaRun(argv);
  const taskId = jsonOf(r.stdout)?.result?.task?.id ?? null;
  return { ok: r.status === 0 && Boolean(taskId), taskId, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('task-update.mjs')) {
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
