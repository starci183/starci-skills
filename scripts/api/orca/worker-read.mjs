#!/usr/bin/env node
// worker-read.mjs — `orca orchestration worker-read` as a callable function.
//   node scripts/api/orca/worker-read.mjs --dispatch <dispatch_id> [--limit <n>] [--cursor <c>] [--source <auto|transcript|terminal>]
// Returns {ok, result} — result is the bounded read receipt (output, cursor, source).
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function workerRead({ dispatch, limit, cursor, source }) {
  if (!dispatch) throw new Error('workerRead: missing required --dispatch');
  const argv = ['orchestration', 'worker-read', '--dispatch', dispatch, '--json'];
  if (limit) argv.push('--limit', String(limit));
  if (cursor) argv.push('--cursor', cursor);
  if (source) argv.push('--source', source);
  const r = orcaRun(argv);
  const result = jsonOf(r.stdout)?.result ?? null;
  return { ok: r.status === 0 && Boolean(result), result, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-read.mjs')) {
  const argv = process.argv.slice(2);
  const out = workerRead({
    dispatch: arg(argv, 'dispatch'),
    limit: arg(argv, 'limit'),
    cursor: arg(argv, 'cursor'),
    source: arg(argv, 'source'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
