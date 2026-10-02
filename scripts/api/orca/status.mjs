#!/usr/bin/env node
// status.mjs — the calls.yaml `status` call as a callable function.
//   node scripts/api/orca/status.mjs
// Returns {ok, reachable, state, error, spawnError, appExe}: reachable when the Orca runtime answers and is ready.
// appExe is the Orca desktop app beside the CLI this runner resolves (<app>/resources/bin/orca.exe -> <app>/Orca.exe),
// or null; it is read from disk, so it is there even when the runtime does not answer (the Orca restart needs it then).
import { orcaCall, orcaAppExe } from './lib.mjs';
import { isMain } from '../../lib/is-main.mjs';

export function status({ timeout } = {}) {
  const r = orcaCall('status', {}, { timeout });
  const runtime = r.result?.runtime ?? null;
  return { ok: r.outcome === 'ok', reachable: runtime?.reachable === true, state: runtime?.state ?? null, error: r.error,
    spawnError: r.outcome !== 'ok' && !r.receipt ? r.error : null, appExe: orcaAppExe() };
}

if (isMain(import.meta.url)) {
  const out = status();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
