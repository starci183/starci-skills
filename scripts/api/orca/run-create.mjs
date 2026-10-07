#!/usr/bin/env node
// Deep map WRAP R1, R2: Run creation is Orca's; which Run a workflow or seat reuses is the runtime's record.
// run-create.mjs — the calls.yaml `run-create` call as a callable function.
// Internal entry: spawned by scripts/agent/lib.mjs; not invoked directly.
// Args: --objective <text> --request <identity json> [--from <handle>]
// Returns {ok, runId, result, request} — runId is result.run.id. `request` is the caller's ledger identity: calls.yaml
// declares run-create replay: request, so the first issue carries the --retry-request id derived from it.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';
import { isMain } from '../../lib/is-main.mjs';

/**
 * Creates an Orca Run for objective using the caller's durable request identity.
 * The caller decides whether creation is needed and names the coordinator through from when provided.
 * ok requires a zero exit and a Run id; the result also preserves outcome, the classified effectState (an answer Orca or its CLI
 * produced before any mutation, such as no_active_sender_terminal, is none), the typed error code and request-replay metadata.
 * Keep the same request identity while reconciling an unsettled call instead of creating a replacement Run.
 */
export function runCreate({ objective, from, request }) {
  const r = orcaCall('run-create', { objective, from }, { request });
  const result = r.result;
  const runId = result?.run?.id ?? null;
  let receiptError = null;
  if (typeof r.receipt?.error === 'string') receiptError = r.receipt.error;
  else if (r.receipt?.error) receiptError = JSON.stringify(r.receipt.error);
  const error = r.error || receiptError || (!runId ? r.stdout : null);
  return { ok: r.exitCode === 0 && Boolean(runId), runId, result, error, outcome: r.outcome, effectState: r.effectState, reason: r.reason ?? null,
    errorCode: r.receipt?.error?.code ?? null, request: r.request, hostUnavailable: r.hostUnavailable === true };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = runCreate({ objective: arg(argv, 'objective'), from: arg(argv, 'from'), request: JSON.parse(arg(argv, 'request') ?? 'null') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
