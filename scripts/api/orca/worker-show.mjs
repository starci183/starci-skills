#!/usr/bin/env node
// worker-show.mjs — `orca orchestration worker-show` as a callable function.
//   node scripts/api/orca/worker-show.mjs --dispatch <dispatch_id>
// Returns {ok, state, dispatch, effective} — state is result.worker.state.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function workerShow({ dispatch }) {
  if (!dispatch) throw new Error('workerShow: missing required --dispatch');
  const r = orcaRun(['orchestration', 'worker-show', '--dispatch', dispatch, '--json']);
  const result = jsonOf(r.stdout)?.result ?? null;
  return {
    ok: r.status === 0 && Boolean(result),
    state: result?.worker?.state ?? null,
    dispatch: result?.dispatch ?? null,
    effective: result?.launch?.effective ?? result?.effective ?? null,
    result,
    error: r.error ?? r.stderr,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-show.mjs')) {
  const out = workerShow({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
