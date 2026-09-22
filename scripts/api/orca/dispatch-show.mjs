#!/usr/bin/env node
// dispatch-show.mjs — the calls.yaml `dispatch-show` call as a callable function.
//   node scripts/api/orca/dispatch-show.mjs --task <task_id> [--preamble] [--from <handle>]
// Returns {ok, dispatchId, assigneeHandle, dispatch}.
import { orcaCall, arg, flag } from './lib.mjs';

export function dispatchShow({ task, preamble, from }) {
  const r = orcaCall('dispatch-show', { task, preamble: Boolean(preamble), from });
  const d = r.result?.dispatch ?? null;
  return {
    ok: r.exitCode === 0 && Boolean(d?.id),
    dispatchId: d?.id ?? null,
    assigneeHandle: d?.assignee_handle ?? null,
    dispatch: d,
    error: r.error,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('dispatch-show.mjs')) {
  const argv = process.argv.slice(2);
  const out = dispatchShow({ task: arg(argv, 'task'), preamble: flag(argv, 'preamble'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
