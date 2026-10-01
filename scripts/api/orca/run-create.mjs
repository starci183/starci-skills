#!/usr/bin/env node
// Deep map WRAP R1, R2: Run creation is Orca's; which Run a workflow or seat reuses is the runtime's record.
// run-create.mjs — the calls.yaml `run-create` call as a callable function.
//   node scripts/api/orca/run-create.mjs --objective <text> --request <identity json> [--from <handle>]
// Returns {ok, runId, result, request} — runId is result.run.id. `request` is the caller's ledger identity: calls.yaml
// declares run-create replay: request, so the first issue carries the --retry-request id derived from it.
import { orcaCall, arg } from './lib.mjs';
import { isMain } from '../../lib/is-main.mjs';

export function runCreate({ objective, from, request }) {
  const r = orcaCall('run-create', { objective, from }, { request });
  const result = r.result;
  const runId = result?.run?.id ?? null;
  const receiptError = typeof r.receipt?.error === 'string'
    ? r.receipt.error
    : (r.receipt?.error ? JSON.stringify(r.receipt.error) : null);
  const error = r.error || receiptError || (!runId ? r.stdout : null);
  return { ok: r.exitCode === 0 && Boolean(runId), runId, result, error, outcome: r.outcome, request: r.request, hostUnavailable: r.hostUnavailable === true };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = runCreate({ objective: arg(argv, 'objective'), from: arg(argv, 'from'), request: JSON.parse(arg(argv, 'request') ?? 'null') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
