#!/usr/bin/env node
// request-show.mjs — the calls.yaml `request-show` call as a callable function.
//   node scripts/api/orca/request-show.mjs --request <request_id>
// Read-only: did one replay-request mutation (its --retry-request id, scripts/api/orca/lib.mjs orcaRequestIdOf) take
// effect? Returns {ok, requestId, state, hostUnavailable}; state is completed | pending | absent (absent is not proof
// that nothing happened). orcaCall asks it itself after a lost receipt; this wrapper serves reconciliation reads.
import { orcaCall, arg } from './lib.mjs';

export function requestShow({ request }) {
  const r = orcaCall('request-show', { request });
  const state = r.result?.state ?? null;
  return { ok: r.exitCode === 0 && ['completed', 'pending', 'absent'].includes(state), requestId: r.result?.requestId ?? request, state,
    error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('request-show.mjs')) {
  const out = requestShow({ request: arg(process.argv.slice(2), 'request') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
