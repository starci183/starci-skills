#!/usr/bin/env node
// run-list.mjs — the calls.yaml `run-list` call as a callable function.
// Internal entry: called by scripts/kernel/workflow-launch-no-effect.mjs; not invoked directly.
// Args: [--cursor <cursor>]
// Returns {ok, runs, nextCursor, error, hostUnavailable}: one page of Runs, newest first; nextCursor is the cursor of the
// next older page, or null on the last one.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';
import { isMain } from '../../lib/is-main.mjs';

/**
 * Reads one page of Orca Runs, newest first.
 * ok requires a completed read that carries a runs array; a failed or unreadable page never proves a Run absent.
 */
export function runList({ cursor = null } = {}) {
  const r = orcaCall('run-list', cursor ? { cursor } : {});
  const runs = Array.isArray(r.result?.runs) ? r.result.runs : null;
  return { ok: r.outcome === 'ok' && runs !== null, runs: runs ?? [], nextCursor: r.result?.nextCursor ?? null, error: r.error,
    hostUnavailable: r.hostUnavailable === true };
}

if (isMain(import.meta.url)) {
  const out = runList({ cursor: arg(process.argv.slice(2), 'cursor') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
