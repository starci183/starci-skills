#!/usr/bin/env node
// orch-dispatch.mjs — the calls.yaml `dispatch` call as a callable function.
//   node scripts/api/orca/orch-dispatch.mjs --task <task_id> --to <handle> [--from <handle>] [--run <run_id>]
// return-preamble is required by the contract, so it is always sent. Returns {ok, dispatchId, preamble}.
import { orcaCall, arg } from './lib.mjs';

export function orchDispatch({ task, to, from, run }) {
  const r = orcaCall('dispatch', { task, to, from, run, 'return-preamble': true });
  const result = r.result;
  const dispatchId = result?.dispatch?.id ?? null;
  return {
    ok: r.exitCode === 0 && Boolean(dispatchId),
    dispatchId,
    preamble: result?.preamble ?? null,
    result,
    error: r.error,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('orch-dispatch.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchDispatch({ task: arg(argv, 'task'), to: arg(argv, 'to'), from: arg(argv, 'from'), run: arg(argv, 'run') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
