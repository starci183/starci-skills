#!/usr/bin/env node
// run-create.mjs — `orca orchestration run-create` as a callable function.
//   node scripts/api/orca/run-create.mjs --objective <text> [--from <handle>]
// Returns {ok, runId, result} — runId is result.run.id.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function runCreate({ objective, from }) {
  if (!objective) throw new Error('runCreate: missing required --objective');
  const argv = ['orchestration', 'run-create', '--objective', objective, '--json'];
  if (from) argv.push('--from', from);
  const r = orcaRun(argv);
  const result = jsonOf(r.stdout)?.result ?? null;
  const runId = result?.run?.id ?? null;
  return { ok: r.status === 0 && Boolean(runId), runId, result, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('run-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = runCreate({ objective: arg(argv, 'objective'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
