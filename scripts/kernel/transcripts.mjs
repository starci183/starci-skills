#!/usr/bin/env node
// transcripts.mjs — terminal scrollback as redacted blobs (alpha.3, UI-API §2.10, ARCHITECTURE-DB §4.3).
//
//   op attempt, live    attempt_transcript_snapshots: one row per 60 s (TRANSCRIPT_SNAPSHOT_MS) while the attempt's
//                       terminal is open; an unchanged scrollback adds no row (UNIQUE attempt+sha).
//   op attempt, ended   op_attempts.transcript_sha: the full scrollback when the attempt ends — at api report, and
//                       again when the agent is quit (quit-agent.mjs), so the last one written is the fullest.
//   Kernel/Supervisor   machine.sqlite seat_transcript_snapshots, same cadence, for every live seat.
// Every scrollback passes scripts/lib/redact.mjs before the put (blobs.redaction='v1').
//
//   node scripts/kernel/transcripts.mjs snapshot --repo <repo> [--every-ms <ms>] [--json]
//     one pass over the repo ledger's open attempts; a periodic caller (the reconciler) runs it every minute.
import path from 'node:path';
import { frameText, terminalOf, orcaCall } from '../api/orca/lib.mjs';
import { stageText, registerBlob, recordAttemptSnapshot, recordFinalTranscript, TRANSCRIPT_SNAPSHOT_MS } from './evidence-store.mjs';

/** Rows of retained terminal output a scrollback read asks Orca for. */
export const SCROLLBACK_LIMIT = 100_000;

/**
 * The accumulated (not rendered) output of a terminal, escape sequences stripped, or null when Orca cannot read it.
 * `read` is terminal-read's raw call ({terminal, screen:false, limit}) → {ok, text}.
 */
export function readScrollback(handle, { limit = SCROLLBACK_LIMIT, read = null } = {}) {
  if (!handle) return null;
  try {
    if (read) { const r = read({ terminal: handle, screen: false, limit }); return r?.ok ? String(r.text ?? r.screen ?? '') : null; }
    const r = orcaCall('terminal-read', { terminal: handle, screen: false, limit });
    return r.exitCode === 0 ? frameText(terminalOf(r)) : null;
  } catch { return null; }
}

/** The scrollback of `handle`, redacted and put in the blob store (outside any transaction): {blob, text} or null. */
export function captureTerminal(handle, { read = null, repoRoots = [] } = {}) {
  const text = readScrollback(handle, { read });
  if (!text) return null;
  return { text, blob: stageText(text, { repoRoots }) };
}

/**
 * One snapshot pass over a ledger's open attempts (not settled, no end state, terminal not closed): each whose last
 * snapshot is older than `everyMs` gets a new one. Returns {checked, written, unchanged, unreadable}.
 */
export function snapshotOpenAttempts(ledger, { now = Date.now(), everyMs = TRANSCRIPT_SNAPSHOT_MS, read = null, repoRoots = [] } = {}) {
  const db = ledger.db;
  const open = db.prepare(`SELECT a.attempt_id,a.workflow_id,a.terminal_handle,a.worktree_path,
      (SELECT max(at) FROM attempt_transcript_snapshots s WHERE s.attempt_id=a.attempt_id) AS last_at
    FROM op_attempts a WHERE a.settled_at IS NULL AND a.end_state IS NULL AND a.terminal_handle IS NOT NULL AND a.terminal_closed_at IS NULL`).all();
  const out = { checked: open.length, written: 0, unchanged: 0, unreadable: 0 };
  for (const row of open) {
    if (row.last_at != null && now - row.last_at < everyMs) continue;
    const captured = captureTerminal(row.terminal_handle, { read, repoRoots: [...repoRoots, row.worktree_path].filter(Boolean) });
    if (!captured) { out.unreadable += 1; continue; }
    const r = ledger.transaction(() => recordAttemptSnapshot(db, { workflowId: row.workflow_id, attemptId: row.attempt_id, text: captured.text, blob: captured.blob, at: now }));
    if (r?.snapshotId) out.written += 1; else out.unchanged += 1;
  }
  return out;
}

/**
 * The attempt's full scrollback at its end → op_attempts.transcript_sha. `captured` is a captureTerminal result
 * taken while the terminal was still readable (quit-agent.mjs takes it before the quit input); without it the
 * terminal is read now. Never throws; returns the sha or null.
 */
export function finalizeAttemptTranscript(ledger, { attemptId, handle = null, captured = null, read = null, repoRoots = [], now = Date.now() }) {
  try {
    const got = captured ?? captureTerminal(handle, { read, repoRoots });
    if (!got || attemptId == null) return null;
    return ledger.transaction(() => recordFinalTranscript(ledger.db, { attemptId, blob: got.blob, text: got.text, at: now }));
  } catch { return null; }
}

/** The final transcript of the open attempt that holds terminal `handle` (a quit/close path that knows only the handle). */
export function finalizeTranscriptOfTerminal(ledger, { handle, captured = null, read = null, now = Date.now() }) {
  if (!handle) return null;
  const row = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE terminal_handle=? ORDER BY attempt_id DESC LIMIT 1').get(handle);
  return row ? finalizeAttemptTranscript(ledger, { attemptId: row.attempt_id, handle, captured, read, now }) : null;
}

/**
 * One snapshot pass over the machine's live Kernel/Supervisor seats → seat_transcript_snapshots (machine.sqlite).
 * `machine` is the machine writer handle ({db, transaction}). Returns {checked, written, unchanged, unreadable}.
 */
export function snapshotSeats(machine, { now = Date.now(), everyMs = TRANSCRIPT_SNAPSHOT_MS, read = null } = {}) {
  const db = machine.db;
  const seats = db.prepare(`SELECT s.seat_id,s.terminal_handle,(SELECT max(at) FROM seat_transcript_snapshots x WHERE x.seat_id=s.seat_id) AS last_at
    FROM seats s WHERE s.terminal_handle IS NOT NULL AND s.state IN ('booting','live','busy','stale','replacing')`).all();
  const out = { checked: seats.length, written: 0, unchanged: 0, unreadable: 0 };
  for (const seat of seats) {
    if (seat.last_at != null && now - seat.last_at < everyMs) continue;
    const captured = captureTerminal(seat.terminal_handle, { read });
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const argv = process.argv.slice(2);
  const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  const [cmd] = argv;
  if (cmd !== 'snapshot' || !arg('repo')) {
    console.error('usage: node scripts/kernel/transcripts.mjs snapshot --repo <repo> [--every-ms <ms>] [--json]');
    process.exit(2);
  }
  const { openLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const repo = path.resolve(arg('repo'));
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    const r = snapshotOpenAttempts(ledger, { everyMs: Number(arg('every-ms') ?? TRANSCRIPT_SNAPSHOT_MS), repoRoots: [repo] });
    console.log(argv.includes('--json') ? JSON.stringify({ ok: true, repo, ...r }) : `transcripts ${repo}: ${r.written} written, ${r.unchanged} unchanged, ${r.unreadable} unreadable of ${r.checked} open`);
  } finally { ledger.close(); }
}
