#!/usr/bin/env node
// worker-read.mjs — the calls.yaml `worker-read` call as a callable function.
//   node scripts/api/orca/worker-read.mjs --dispatch <dispatch_id> [--source <auto|transcript|terminal>] [--cursor <c>] [--limit <n>]
// Returns {ok, source, status, rows, cursor, result, error, hostUnavailable}: Orca's bounded output of one supervised
// worker. Read it before worker-release (a Dispatch released without an output archive has none).
import { orcaCall, arg } from './lib.mjs';

export function workerRead({ dispatch, source = null, cursor = null, limit = null }) {
  const r = orcaCall('worker-read', { dispatch, source, cursor, limit });
  const result = r.result;
  // A transcript source returns result.transcript.messages; a terminal source returns its labelled lines.
  const rows = result?.transcript?.messages ?? result?.terminal?.lines ?? result?.lines ?? null;
  return {
    ok: r.exitCode === 0 && Boolean(result),
    source: result?.source ?? null,
    status: result?.status ?? null,
    rows: Array.isArray(rows) ? rows : [],
    cursor: result?.cursor ?? result?.transcript?.nextCursor ?? null,
    result,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-read.mjs')) {
  const argv = process.argv.slice(2);
  const out = workerRead({ dispatch: arg(argv, 'dispatch'), source: arg(argv, 'source'), cursor: arg(argv, 'cursor'), limit: arg(argv, 'limit') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
