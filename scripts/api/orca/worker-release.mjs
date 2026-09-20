#!/usr/bin/env node
// worker-release.mjs — `orca orchestration worker-release` as a callable function.
//   node scripts/api/orca/worker-release.mjs --dispatch <dispatch_id>
// Applies the calls.yaml classify rules; returns {ok, outcome, effectState, dispatchId, state, result}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function workerRelease({ dispatch }) {
  if (!dispatch) throw new Error('workerRelease: missing required --dispatch');
  const r = orcaRun(['orchestration', 'worker-release', '--dispatch', dispatch, '--json'], { timeout: 60000 });
  const j = jsonOf(r.stdout);
  const result = j?.result ?? null;
  const state = result?.state ?? null;
  // calls.yaml worker-release classify, evaluated in contract order — first match wins.
  let outcome, effectState;
  if (r.status === 0 && ['released', 'already_released'].includes(state)) {
    outcome = 'ok'; effectState = 'committed';
  } else if (['retained', 'release_pending'].includes(state)) {
    outcome = 'failed'; effectState = 'partial';
  } else if (state === 'release_unknown') {
    outcome = 'unknown'; effectState = 'unknown';
  } else if (r.status === 0) {
    outcome = 'unknown'; effectState = 'unknown'; // exited 0 without a classifiable state
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

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-release.mjs')) {
  const out = workerRelease({ dispatch: arg(process.argv.slice(2), 'dispatch') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
