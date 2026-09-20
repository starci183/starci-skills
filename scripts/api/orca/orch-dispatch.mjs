#!/usr/bin/env node
// orch-dispatch.mjs — `orca orchestration dispatch` as a callable function.
//   node scripts/api/orca/orch-dispatch.mjs --task <task_id> --to <handle> [--from <handle>] [--run <run_id>]
// Always appends --return-preamble (contract-required). Returns {ok, dispatchId, preamble}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function orchDispatch({ task, to, from, run }) {
  if (!task) throw new Error('orchDispatch: missing required --task');
  if (!to) throw new Error('orchDispatch: missing required --to');
  const argv = ['orchestration', 'dispatch', '--task', task, '--to', to, '--return-preamble'];
  if (from) argv.push('--from', from);
  if (run) argv.push('--run', run);
  argv.push('--json');
  const r = orcaRun(argv);
  const result = jsonOf(r.stdout)?.result ?? null;
  const dispatchId = result?.dispatch?.id ?? null;
  return {
    ok: r.status === 0 && Boolean(dispatchId),
    dispatchId,
    preamble: result?.preamble ?? null,
    result,
    error: r.error ?? r.stderr,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('orch-dispatch.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchDispatch({ task: arg(argv, 'task'), to: arg(argv, 'to'), from: arg(argv, 'from'), run: arg(argv, 'run') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
