#!/usr/bin/env node
// task-list.mjs — the calls.yaml `task-list` call as a callable function.
//   node scripts/api/orca/task-list.mjs --run <run_id> [--status <s>]
// Always --brief (specs capped at 160 chars): the caller needs ids, titles and statuses.
// Returns {ok, tasks, errorCode, error, hostUnavailable}.
import { orcaCall, arg } from './lib.mjs';

export function taskList({ run, status }) {
  const r = orcaCall('task-list', { run, status, brief: true });
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  return { ok: r.exitCode === 0 && Array.isArray(r.result?.tasks), tasks: r.result?.tasks ?? [], errorCode,
    error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('task-list.mjs')) {
  const argv = process.argv.slice(2);
  const out = taskList({ run: arg(argv, 'run'), status: arg(argv, 'status') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
