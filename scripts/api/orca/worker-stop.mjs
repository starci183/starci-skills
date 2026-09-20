#!/usr/bin/env node
// worker-stop.mjs — `orca orchestration worker-stop` as a callable function.
//   node scripts/api/orca/worker-stop.mjs --dispatch <dispatch_id>
// Applies the calls.yaml classify rules; returns {ok, outcome, effectState, dispatchId, state, result}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function workerStop({ dispatch }) {
  if (!dispatch) throw new Error('workerStop: missing required --dispatch');
  const r = orcaRun(['orchestration', 'worker-stop', '--dispatch', dispatch, '--json'], { timeout: 60000 });
  const j = jsonOf(r.stdout);
  const result = j?.result ?? null;
  const state = result?.state ?? null;
  const errCode = j?.error?.code;
  // calls.yaml worker-stop classify, evaluated in contract order — first match wins.
  let outcome, effectState;
  if (['stop_unknown', 'unverifiable', 'outcome_unknown'].includes(state) || errCode === 'dispatch_inactive') {
    outcome = 'unknown'; effectState = 'unknown'; // reconcile, then abandon after the own terminal is closed
  } else if (r.status === 0 && state !== null && state !== undefined) {
    outcome = 'ok'; effectState = 'committed';
  } else if (r.status === 0) {
    outcome = 'unknown'; effectState = 'unknown'; // exited 0 without a state receipt
  } else {
    outcome = 'failed'; effectState = 'none';
  }
  return {
    ok: outcome === 'ok',
    outcome,
    effectState,
    dispatchId: result?.dispatchId ?? null,
    state,
    result,
    error: r.error ?? r.stderr,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-stop.mjs')) {
  const out = workerStop({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
