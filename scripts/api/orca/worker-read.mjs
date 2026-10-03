#!/usr/bin/env node
// Deep map WRAP RR5, RR6: Orca's archive is unredacted and on Orca's retention, so the blob store plus redact.mjs stay the sink.
// worker-read.mjs — the calls.yaml `worker-read` call as a callable function: Orca's bounded output of one
// supervised worker, read by its Dispatch (deep map T1, REPLACE: the one read of a worker's output).
// Internal entry: spawned by scripts/kernel/verbs/observe.mjs; not invoked directly.
// Args: --dispatch <dispatch_id> [--source <auto|transcript|terminal>] [--cursor <c>] [--limit <n>]
//
// Every worker is read by Dispatch, never by terminal handle: Orca 1.4.209 states that not every worker has a
// terminal and that `orca terminal` verbs do not accept every worker handle, while `worker-read --source auto`
// always works (it serves the exact hook-reported transcript when there is one, else labelled terminal output
// with a typed fallbackReason). Reads still work after worker-release, from Orca's archive.
//
// workerRead reads ONE page: {ok, source, status, rows, draft, cursor, contentComplete, clipping, warnings,
//   fallbackReason, archived, sourceChanged, errorCode, error, hostUnavailable, result}.
//   rows are plain text: terminal tail lines, or transcript messages rendered `[role] text` (Orca's own text form).
// Every page: scripts/machine/worker-output.mjs workerOutput.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';
import { messageText } from '../../lib/transcript-text.mjs';

const SOURCE_CHANGED = 'source_changed';

export function workerRead({ dispatch, source = null, cursor = null, limit = null }) {
  const r = orcaCall('worker-read', { dispatch, source, cursor, limit: limit == null ? undefined : String(limit) });
  const result = r.result;
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  const kind = result?.source ?? null;
  const rows = kind === 'transcript'
    ? (Array.isArray(result?.transcript?.messages) ? result.transcript.messages.map(messageText) : [])
    : (Array.isArray(result?.terminal?.tail) ? result.terminal.tail.map((l) => String(l ?? '')) : []);
  return {
    ok: r.exitCode === 0 && Boolean(result) && (kind === 'transcript' || kind === 'terminal'),
    source: kind,
    status: result?.status ?? null,
    rows,
    draft: typeof result?.terminal?.draft === 'string' && result.terminal.draft.trim() ? result.terminal.draft : null,
    cursor: result?.cursor ?? null,
    contentComplete: result?.contentComplete === true,
    clipping: Array.isArray(result?.clipping) ? result.clipping.map(String) : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings.map(String) : [],
    fallbackReason: result?.fallbackReason ?? null,
    archived: result?.archived === true,
    sourceChanged: errorCode === SOURCE_CHANGED,
    errorCode,
    result,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1]?.endsWith('worker-read.mjs')) {
  const argv = process.argv.slice(2);
  const out = workerRead({ dispatch: arg(argv, 'dispatch'), source: arg(argv, 'source'), limit: arg(argv, 'limit'), cursor: arg(argv, 'cursor') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
