#!/usr/bin/env node
// worker-abandon.mjs — `orca orchestration worker-abandon` as a callable function.
//   node scripts/api/orca/worker-abandon.mjs --dispatch <dispatch_id>
// Fences a stop_unknown Dispatch without any process action. Returns {ok, result}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function workerAbandon({ dispatch }) {
  if (!dispatch) throw new Error('workerAbandon: missing required --dispatch');
  const r = orcaRun(['orchestration', 'worker-abandon', '--dispatch', dispatch, '--json']);
  const result = jsonOf(r.stdout)?.result ?? null;
  return { ok: r.status === 0 && Boolean(result), result, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-abandon.mjs')) {
  const out = workerAbandon({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
