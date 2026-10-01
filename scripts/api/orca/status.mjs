#!/usr/bin/env node
// status.mjs — the calls.yaml `status` call as a callable function.
//   node scripts/api/orca/status.mjs
// Returns {ok, reachable, state, error}: reachable when the Orca runtime answers and is ready.
import { orcaCall } from './lib.mjs';

export function orcaStatus() {
  const r = orcaCall('status', {});
  const runtime = r.result?.runtime ?? null;
  return { ok: r.outcome === 'ok', reachable: runtime?.reachable === true, state: runtime?.state ?? null, error: r.error, spawnError: r.outcome !== 'ok' && !r.receipt ? r.error : null };
}

if (process.argv[1]?.endsWith('status.mjs')) {
  const out = orcaStatus();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
