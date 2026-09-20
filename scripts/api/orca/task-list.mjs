#!/usr/bin/env node
// task-list.mjs — `orca orchestration task-list` as a callable function.
//   node scripts/api/orca/task-list.mjs [--run <run_id>] [--status <status>] [--ready] [--brief]
// Returns {ok, tasks} — tasks is result.tasks.
import { orcaRun, jsonOf, arg, flag } from './lib.mjs';

export function taskList({ run, status, ready, brief } = {}) {
  const argv = ['orchestration', 'task-list', '--json'];
  if (run) argv.push('--run', run);
  if (status) argv.push('--status', status);
  if (ready) argv.push('--ready');
  if (brief) argv.push('--brief');
  const r = orcaRun(argv);
  const tasks = jsonOf(r.stdout)?.result?.tasks ?? [];
  return { ok: r.status === 0, tasks, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('task-list.mjs')) {
  const argv = process.argv.slice(2);
  const out = taskList({ run: arg(argv, 'run'), status: arg(argv, 'status'), ready: flag(argv, 'ready'), brief: flag(argv, 'brief') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
