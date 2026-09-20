#!/usr/bin/env node
// run-show.mjs — `orca orchestration run-show` as a callable function.
//   node scripts/api/orca/run-show.mjs --id <run_id>
// Returns {ok, run} — run is result.run.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function runShow({ id }) {
  if (!id) throw new Error('runShow: missing required --id');
  const r = orcaRun(['orchestration', 'run-show', '--id', id, '--json']);
  const run = jsonOf(r.stdout)?.result?.run ?? null;
  return { ok: r.status === 0 && Boolean(run?.id), run, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('run-show.mjs')) {
  const out = runShow({ id: arg(process.argv.slice(2), 'id') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
