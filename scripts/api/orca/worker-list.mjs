#!/usr/bin/env node
// worker-list.mjs — `orca orchestration worker-list` as a callable function.
//   node scripts/api/orca/worker-list.mjs [--run <run_id>]
// Returns {ok, workers} — workers is result.workers.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function workerList({ run } = {}) {
  const argv = ['orchestration', 'worker-list', '--json'];
  if (run) argv.push('--run', run);
  const r = orcaRun(argv);
  const workers = jsonOf(r.stdout)?.result?.workers ?? [];
  return { ok: r.status === 0, workers, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-list.mjs')) {
  const out = workerList({ run: arg(process.argv.slice(2), 'run') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
