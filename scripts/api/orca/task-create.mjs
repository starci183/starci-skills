#!/usr/bin/env node
// task-create.mjs — the calls.yaml `task-create` call as a callable function.
//   node scripts/api/orca/task-create.mjs --run <run_id> --spec <text|path> [--task-title <t>] [--display-name <n>] [--deps <json_array>] [--parent <task_id>] [--from <handle>]
// Returns {ok, taskId, task} — taskId is result.task.id. --spec is passed through verbatim.
import { orcaCall, arg } from './lib.mjs';

export function taskCreate({ run, spec, taskTitle, displayName, deps, parent, from }) {
  const r = orcaCall('task-create', {
    spec, run, 'task-title': taskTitle, 'display-name': displayName, deps, parent, from,
  });
  const task = r.result?.task ?? null;
  return { ok: r.exitCode === 0 && Boolean(task?.id), taskId: task?.id ?? null, task, error: r.error };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('task-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = taskCreate({
    run: arg(argv, 'run'),
    spec: arg(argv, 'spec'),
    taskTitle: arg(argv, 'task-title'),
    displayName: arg(argv, 'display-name'),
    deps: arg(argv, 'deps'),
    parent: arg(argv, 'parent'),
    from: arg(argv, 'from'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
