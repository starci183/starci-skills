#!/usr/bin/env node
// run-use.mjs — `orca orchestration run-use` as a callable function.
//   node scripts/api/orca/run-use.mjs --id <run_id> [--from <handle>]
// Returns {ok, runId} — runId is result.run.id.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function runUse({ id, from }) {
  if (!id) throw new Error('runUse: missing required --id');
  const argv = ['orchestration', 'run-use', '--id', id, '--json'];
  if (from) argv.push('--from', from);
  const r = orcaRun(argv);
  const runId = jsonOf(r.stdout)?.result?.run?.id ?? null;
  return { ok: r.status === 0 && Boolean(runId), runId, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('run-use.mjs')) {
  const argv = process.argv.slice(2);
  const out = runUse({ id: arg(argv, 'id'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
