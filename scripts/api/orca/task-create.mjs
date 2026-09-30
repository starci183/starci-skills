#!/usr/bin/env node
// task-create.mjs — the calls.yaml `task-create` call as a callable function.
//   node scripts/api/orca/task-create.mjs --run <run_id> --spec <text|path> [--task-title <t>] [--display-name <n>] [--deps <json_array>] [--from <handle>]
// No --parent (the nested Run rule): every agent files its Tasks in the Run it coordinates, and Orca nests that Run
// under the agent's own Dispatch (modules/host/orca/calls.yaml task-create).
// Returns {ok, taskId, task} — taskId is result.task.id. --spec is passed through verbatim.
import { orcaCall, arg } from './lib.mjs';

export function taskCreate({ run, spec, taskTitle, displayName, deps, from }) {
  const r = orcaCall('task-create', {
    spec, run, 'task-title': taskTitle, 'display-name': displayName, deps, from,
  });
  const task = r.result?.task ?? null;
  return { ok: r.exitCode === 0 && Boolean(task?.id), taskId: task?.id ?? null, task, error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('task-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = taskCreate({
    run: arg(argv, 'run'),
    spec: arg(argv, 'spec'),
    taskTitle: arg(argv, 'task-title'),
    displayName: arg(argv, 'display-name'),
    deps: arg(argv, 'deps'),
    from: arg(argv, 'from'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
