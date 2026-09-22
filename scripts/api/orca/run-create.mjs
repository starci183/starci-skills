#!/usr/bin/env node
// run-create.mjs — the calls.yaml `run-create` call as a callable function.
//   node scripts/api/orca/run-create.mjs --objective <text> [--from <handle>]
// Returns {ok, runId, result} — runId is result.run.id.
import { orcaCall, arg } from './lib.mjs';

export function runCreate({ objective, from }) {
  const r = orcaCall('run-create', { objective, from });
  const result = r.result;
  const runId = result?.run?.id ?? null;
  const receiptError = typeof r.receipt?.error === 'string'
    ? r.receipt.error
    : (r.receipt?.error ? JSON.stringify(r.receipt.error) : null);
  const error = r.error || receiptError || (!runId ? r.stdout : null);
  return { ok: r.exitCode === 0 && Boolean(runId), runId, result, error };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('run-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = runCreate({ objective: arg(argv, 'objective'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
