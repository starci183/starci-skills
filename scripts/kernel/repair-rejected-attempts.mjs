#!/usr/bin/env node
// repair-rejected-attempts.mjs - one-shot repair for op attempts whose dispatch was refused (dispatch-rejected) and that
// the refusal left open: end_state NULL, or the legacy end_state requeued with settled_at / released_at never stamped.
// Every reader that asks "is this attempt still running?" (the UI, the frontier) read those rows as running for hours
// (nivo wf-nivo-collab-mum8xsop, op-scope.define try 3, attempt 28: "prompt-stuck" at submission, retried as attempt 29).
// Since the fix rejectDispatch ends the attempt itself (engine/ledger-db.mjs endRejectedAttempt); this seals the ones
// written before it, once.
//
//   node scripts/kernel/repair-rejected-attempts.mjs --repo <work repo> | --file <runtime.sqlite> [--json]
//       dry run (the default): opens the ledger read-only and lists what would be sealed
//   node scripts/kernel/repair-rejected-attempts.mjs --repo <work repo> --apply [--json]
//       seals each attempt through the ledger writer, one transaction per attempt
//
// A candidate is an attempt that never reached attestation (attested_at, started_at, reported_at all NULL), is not settled
// and has no end state (or requeued), and carries a dispatch-rejected record: its settle_json.reason, or a dispatch-rejected
// event of its job between its own dispatch and the job's next dispatch (older events carry no attempt id).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { endRejectedAttempt, ledgerFileFor, openLedger, openLedgerReader } from '../../engine/ledger-db.mjs';

const CANDIDATES = `
  SELECT a.attempt_id, a.workflow_id, a.job_id, a.unit_id, a.op_id, a.try_no, a.dispatch_seq, a.dispatched_at, a.end_state, a.terminal_handle,
         json_extract(a.settle_json,'$.detail') AS detail, json_extract(a.settle_json,'$.step') AS step,
         (SELECT min(e.created_at) FROM events e WHERE e.kind='dispatch-rejected' AND e.entity_id=a.job_id AND e.created_at>=a.dispatched_at
            AND e.created_at < COALESCE((SELECT min(n.dispatched_at) FROM op_attempts n WHERE n.job_id=a.job_id AND n.dispatch_seq>a.dispatch_seq), 9e18)) AS rejected_at
    FROM op_attempts a
   WHERE a.settled_at IS NULL AND (a.end_state IS NULL OR a.end_state='requeued')
     AND a.attested_at IS NULL AND a.started_at IS NULL AND a.reported_at IS NULL AND a.dispatched_at IS NOT NULL
   ORDER BY a.attempt_id`;

/** The refused-launch attempts still open: [{attemptId, workflowId, jobId, unitId, op, tryNo, dispatchSeq, dispatchedAt, endState, rejectedAt, step, reason}]. */
export function findRejectedOpenAttempts(db) {
  return db.prepare(CANDIDATES).all()
    .filter((row) => row.rejected_at != null || row.step != null)
    .map((row) => ({ attemptId: row.attempt_id, workflowId: row.workflow_id, jobId: row.job_id, unitId: row.unit_id, op: row.op_id,
      tryNo: row.try_no, dispatchSeq: row.dispatch_seq, dispatchedAt: row.dispatched_at, endState: row.end_state,
      terminal: row.terminal_handle, rejectedAt: row.rejected_at ?? row.dispatched_at, step: row.step ?? null, reason: row.detail ?? null }));
}

/** Dry run (apply false) reads the ledger read-only; apply seals each candidate through the ledger writer. Returns {file, apply, found, sealed}. */
export function repairRejectedAttempts({ file, apply = false }) {
  if (!apply) {
    const db = openLedgerReader(file);
    try { const found = findRejectedOpenAttempts(db); return { ok: true, file, apply: false, found, sealed: [] }; } finally { db.close(); }
  }
  const ledger = openLedger({ file });
  try {
    const found = findRejectedOpenAttempts(ledger.db), sealed = [];
    for (const item of found) {
      ledger.transaction(() => {
        if (endRejectedAttempt(ledger.db, { attemptId: item.attemptId, endState: 'requeued', effectState: 'none', releasedAt: item.rejectedAt, at: Date.now() })) sealed.push(item.attemptId);
      });
    }
    return { ok: true, file, apply: true, found, sealed };
  } finally { try { ledger.db.close(); } catch { /* closed */ } }
}

const argOf = (argv, name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const repo = argOf(argv, 'repo'), fileArg = argOf(argv, 'file');
  if (!repo && !fileArg) { console.error('use: node scripts/kernel/repair-rejected-attempts.mjs --repo <work repo> | --file <runtime.sqlite> [--apply] [--json]'); process.exit(2); }
  const file = fileArg ? path.resolve(fileArg) : ledgerFileFor(repo);
  const out = repairRejectedAttempts({ file, apply: argv.includes('--apply') });
  if (argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else {
    console.log(`${out.apply ? 'applied' : 'dry run'} on ${out.file}: ${out.found.length} refused-launch attempt(s) left open${out.apply ? `, ${out.sealed.length} sealed` : ''}`);
    for (const a of out.found) console.log(`  attempt ${a.attemptId} ${a.op} try ${a.tryNo} dispatch ${a.dispatchSeq} (${a.jobId}) end_state=${a.endState ?? 'NULL'} rejected ${new Date(a.rejectedAt).toISOString()} step=${a.step ?? '-'}${a.reason ? `: ${String(a.reason).slice(0, 160)}` : ''}`);
    if (!out.apply && out.found.length) console.log('re-run with --apply to seal them');
  }
}
