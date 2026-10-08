#!/usr/bin/env node
// transcripts.mjs — worker output as redacted blobs (docs/ledger-db.md), read by Dispatch.
//
//   op attempt, live    attempt_transcript_snapshots: one row per 60 s (TRANSCRIPT_SNAPSHOT_MS) while the attempt
//                       is open; an unchanged output adds no row (UNIQUE attempt+sha).
//   op attempt, ended   op_attempts.transcript_sha: the full output when the attempt ends — at starci kernel report, before
//                       an unmanaged worker's terminal is closed, and after a managed worker's release (from Orca's
//                       archive), so the last one written is the fullest.
//   Kernel/Supervisor   machine.sqlite seat_transcript_snapshots, same cadence, for every live seat whose record
//                       names its Dispatch (seats.detail_json value.dispatch).
//
// The source is Orca's `worker-read --source auto` (scripts/machine/worker-output.mjs workerOutput, paged by its
// cursor; deep map T1): the exact hook-reported transcript when the provider has one, else labelled terminal output.
// Orca's archive is unredacted and on Orca's retention, so the sink stays ours: every output passes
// scripts/lib/redact.mjs before the put (blobs.redaction='v1'). The first line of every stored text is a header
// that keeps Orca's completeness verdict with the bytes (contentComplete, clipping): a bounded tail or a terminal
// fallback is never stored as if it were the whole transcript.
//
// Internal entry: spawned by scripts/kernel/verbs/report.mjs; not invoked directly.
// Args: snapshot --repo <repo> [--every-ms <ms>] [--json].
//     one pass over the repo ledger's open attempts; a periodic caller (the reconciler) runs it every minute.
import path from 'node:path';
import { workerOutput } from '../machine/worker-output.mjs';
import { stageText, registerBlob, recordAttemptSnapshot, recordFinalTranscript, TRANSCRIPT_SNAPSHOT_MS } from '../machine/evidence-store.mjs';
import { parseJson } from '../lib/json.mjs';
import { operationDispatchOf } from './verbs/shared/rows.mjs';
import { isMain } from '../lib/is-main.mjs';

/** The header line that keeps Orca's completeness verdict with the stored output. */
export const outputHeader = (out) => {
  const fallback = out.fallbackReason ? ` fallback=${out.fallbackReason}` : '';
  const clipping = out.clipping?.length ? ` clipping=${out.clipping.join(',')}` : '';
  return `[worker-read dispatch=${out.dispatch} source=${out.source}${fallback} contentComplete=${out.contentComplete === true}${clipping}]`;
};

/**
 * The whole output of the worker that holds Dispatch `dispatch` (every page), or null when Orca cannot read it.
 * `read` is worker-read's one-page call ({dispatch, source, cursor, limit}) → workerRead's shape (specs inject it).
 * Returns {text, source, contentComplete, clipping} where text starts with outputHeader.
 */
export function readWorkerOutput(dispatch, { read = undefined } = {}) {
  if (!dispatch) return null;
  try {
    const out = workerOutput({ dispatch, ...(read ? { read } : {}) });
    if (!out.ok || !out.rows.length) return null;
    return { text: `${outputHeader(out)}\n${out.text}`, source: out.source, contentComplete: out.contentComplete, clipping: out.clipping };
  } catch { return null; }
}

/** The output of Dispatch `dispatch`, redacted and put in the blob store (outside any transaction): {text, blob, ...} or null. */
export function captureWorker(dispatch, { read = undefined, repoRoots = [] } = {}) {
  const got = readWorkerOutput(dispatch, { read });
  if (!got) return null;
  return { ...got, blob: stageText(got.text, { repoRoots }) };
}

/**
 * One snapshot pass over a ledger's open attempts (not settled, no end state, terminal not closed): each whose last
 * snapshot is older than `everyMs` gets a new one, read by the job's Dispatch. Returns {checked, written, unchanged, unreadable}.
 */
export function snapshotOpenAttempts(ledger, { now = Date.now(), everyMs = TRANSCRIPT_SNAPSHOT_MS, read = undefined, repoRoots = [] } = {}) {
  const db = ledger.db;
  const open = db.prepare(`SELECT a.attempt_id,a.workflow_id,a.worktree_path,j.payload_json,
      (SELECT max(at) FROM attempt_transcript_snapshots s WHERE s.attempt_id=a.attempt_id) AS last_at
    FROM op_attempts a JOIN jobs j ON j.job_id=a.job_id
    WHERE a.settled_at IS NULL AND a.end_state IS NULL AND a.terminal_handle IS NOT NULL AND a.terminal_closed_at IS NULL`).all();
  const out = { checked: open.length, written: 0, unchanged: 0, unreadable: 0 };
  for (const row of open) {
    if (row.last_at != null && now - row.last_at < everyMs) continue;
    const dispatch = operationDispatchOf(parseJson(row.payload_json) ?? {});
    const captured = captureWorker(dispatch, { read, repoRoots: [...repoRoots, row.worktree_path].filter(Boolean) });
    if (!captured) { out.unreadable += 1; continue; }
    const r = ledger.transaction(() => recordAttemptSnapshot(db, { attemptId: row.attempt_id, text: captured.text, blob: captured.blob, at: now }));
    if (r?.written) out.written += 1; else out.unchanged += 1;
  }
  return out;
}

/**
 * The attempt's full output at its end → op_attempts.transcript_sha. `captured` is a captureWorker result taken
 * before the worker's terminal was closed; without it Dispatch `dispatch` is read now (Orca serves a released
 * worker from its archive). Never throws; returns the sha or null.
 */
export function finalizeAttemptTranscript(ledger, { attemptId, dispatch = null, captured = null, read = undefined, repoRoots = [], now = Date.now() }) {
  try {
    const got = captured ?? captureWorker(dispatch, { read, repoRoots });
    if (!got || attemptId == null) return null;
    return ledger.transaction(() => recordFinalTranscript(ledger.db, { attemptId, blob: got.blob, text: got.text, at: now }));
  } catch { return null; }
}

/**
 * One snapshot pass over the machine's live Kernel/Supervisor seats → seat_transcript_snapshots (machine.sqlite),
 * read by each seat's Dispatch. `machine` is the machine writer handle ({db, transaction}). A seat whose record
 * names no Dispatch is unreadable (every seat is a worker-start worker). Returns {checked, written, unchanged, unreadable}.
 */
export function snapshotSeats(machine, { now = Date.now(), everyMs = TRANSCRIPT_SNAPSHOT_MS, read = undefined } = {}) {
  const db = machine.db;
  const seats = db.prepare(`SELECT s.seat_id,s.terminal_handle,json_extract(s.detail_json,'$.value.dispatch') AS dispatch,
      (SELECT max(at) FROM seat_transcript_snapshots x WHERE x.seat_id=s.seat_id) AS last_at
    FROM seats s WHERE s.terminal_handle IS NOT NULL AND s.state IN ('booting','live','busy','stale','replacing')`).all();
  const out = { checked: seats.length, written: 0, unchanged: 0, unreadable: 0 };
  for (const seat of seats) {
    if (seat.last_at != null && now - seat.last_at < everyMs) continue;
    const captured = captureWorker(seat.dispatch, { read });
    if (!captured) { out.unreadable += 1; continue; }
    const changes = machine.transaction(() => {
      registerBlob(db, captured.blob, { now });
      return db.prepare(`INSERT INTO seat_transcript_snapshots(seat_id,terminal_handle,at,lines,bytes,sha256) VALUES(?,?,?,?,?,?)
        ON CONFLICT(seat_id,sha256) DO NOTHING`).run(seat.seat_id, seat.terminal_handle, now, captured.text.split('\n').length, captured.blob.bytes, captured.blob.sha).changes;
    });
    if (changes) out.written += 1; else out.unchanged += 1;
  }
  return out;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  const [cmd] = argv;
  if (cmd !== 'snapshot' || !arg('repo')) {
    console.error('args: snapshot --repo <repo> [--every-ms <ms>] [--json]');
    process.exit(2);
  }
  const { openLedger, ledgerFileFor } = await import('../../engine/db/ledger.mjs');
  const repo = path.resolve(arg('repo'));
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    const r = snapshotOpenAttempts(ledger, { everyMs: Number(arg('every-ms') ?? TRANSCRIPT_SNAPSHOT_MS), repoRoots: [repo] });
    // The same poll reads the token spend of the running attempts: an attempt past its budget is seen while it runs.
    const { measureOpenAttempts } = await import('./attempt-live-usage.mjs');
    r.live = measureOpenAttempts(ledger);
    console.log(argv.includes('--json') ? JSON.stringify({ ok: true, repo, ...r }) : `transcripts ${repo}: ${r.written} written, ${r.unchanged} unchanged, ${r.unreadable} unreadable of ${r.checked} open`);
  } finally { ledger.close(); }
}
