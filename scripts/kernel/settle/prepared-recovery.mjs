// prepared-recovery.mjs - what the runtime does with a prepared fail decision whose apply never completed.
//
// `starci kernel settle --verdict fail|blocked` prepares a durable receipt (workflow-op-preserved-prepared: the branch it resets, the commit it resets
// to, the files it puts back) and then applies it. When the apply dies, the receipt stays and every later settle of that attempt must recover it
// (workflow-checkpoint-recovery-conflict) - it can no longer pass, however green the report has since become. Live (Nivo, 2026-10-09): a Kernel chose
// settle-fail on a done report of a 26 million token leg, only because a menu offered a choice the runtime had no business offering; its receipt aimed the
// reset at the merge-base with main (the registry record had lost its checkpoint pointer), behind two settled ops, and the apply left the index half reset.
//
// A prepared receipt whose reset target is not the workflow's gate base now is void: it was prepared against a base the tree no longer has. The settler
// withdraws it (journal event workflow-op-preserved-withdrawn with the code prepared-settlement-withdrawn), puts the index of the files it had touched back
// on HEAD when the branch never moved, and judges the report afresh. A receipt that still aims at the live gate base is kept: it is an apply to finish,
// recorded as workflow-op-preserved-kept so that it is looked at once.
import { gateBaseOf, workflowWorktreeOf } from '../../machine/workflow-tree.mjs';
import { receiptPayload, PREPARED_WITHDRAWN, literalPaths } from '../workflow-checkpoint-state.mjs';
import { revParse } from '../../api/git/rev-parse.mjs';
import { runGit } from '../../api/git/lib.mjs';

/** The typed code of a withdrawal. */
export const PREPARED_WITHDRAWN_CODE = 'prepared-settlement-withdrawn';
/** The event that records a prepared receipt the runtime looked at and kept. */
export const PREPARED_KEPT = 'workflow-op-preserved-kept';

const PREPARED = 'workflow-op-preserved-prepared';

/** The open prepared preserve receipt of a job's latest attempt - prepared, not applied, withdrawn or kept after it - as {seq, attemptId, receipt}, or null (`read: false` skips the receipt). */
export function openPreparedOf(db, jobId, { read = true } = {}) {
  const attempt = db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId)?.attempt_id ?? null;
  const row = db.prepare('SELECT seq, payload_json, payload_sha FROM events WHERE entity_id=? AND attempt_id IS ? AND kind=? ORDER BY seq DESC LIMIT 1').get(jobId, attempt, PREPARED);
  if (!row) return null;
  const later = db.prepare("SELECT 1 FROM events WHERE entity_id=? AND attempt_id IS ? AND seq>? AND kind IN ('workflow-op-preserved-applied', ?, ?) LIMIT 1").get(jobId, attempt, row.seq, PREPARED_WITHDRAWN, PREPARED_KEPT);
  if (later) return null;
  if (!read) return { seq: Number(row.seq), attemptId: attempt, receipt: null };
  const receipt = receiptPayload(row);
  return receipt ? { seq: Number(row.seq), attemptId: attempt, receipt } : null;
}

/** The index of `files` put back on HEAD (a path reset: the working files stay as they are). */
function restoreIndex(dir, files) {
  if (!files.length) return { ok: true };
  const r = runGit(['reset', '-q', 'HEAD', '--', ...literalPaths(files)], { cwd: dir, timeout: 120_000 });
  return { ok: !r.error && r.status === 0, error: String(r.stderr ?? r.error?.message ?? '').slice(0, 200) };
}

/**
 * Looks at the open prepared preserve receipt of `item` (a reported job): withdraws it when its reset target is not the live gate base, keeps it otherwise.
 * Returns null (nothing prepared), {withdrawn: true, ...} or {kept: true}. Never throws: a tree the runtime cannot read keeps the receipt and says why.
 */
export function recoverPreparedSettlement(ledger, item, { env = process.env, now = Date.now(), baseOf = (workflowId) => gateBaseOf({ env }, workflowId),
  headOf = (workflowId, fallback) => revParse(workflowWorktreeOf({ env }, workflowId)?.path ?? fallback, 'HEAD') } = {}) {
  const open = openPreparedOf(ledger.db, item.jobId);
  if (!open) return null;
  const { receipt } = open;
  const record = (kind, payload) => ledger.transaction(() => ledger.appendEvent({ workflowId: item.workflowId, entityType: 'job', entityId: item.jobId, attemptId: open.attemptId, kind, createdAt: now, payload }));
  let base = null, head = null;
  try {
    base = baseOf(item.workflowId);
    head = headOf(item.workflowId, receipt.path);
  } catch (error) { record(PREPARED_KEPT, { reason: `the gate base could not be read: ${String(error?.message ?? error).slice(0, 200)}`, resetTo: receipt.resetTo }); return { kept: true }; }
  if (receipt.resetTo === base) { record(PREPARED_KEPT, { reason: 'the receipt aims at the live gate base: an apply to finish', resetTo: receipt.resetTo, gateBase: base }); return { kept: true }; }
  const restored = head === receipt.before ? restoreIndex(receipt.path, receipt.files ?? []) : { ok: true, skipped: 'the branch moved' };
  record(PREPARED_WITHDRAWN, { code: PREPARED_WITHDRAWN_CODE, reason: 'the receipt aims at a reset target that is not the workflow gate base', resetTo: receipt.resetTo, gateBase: base, before: receipt.before,
    head, indexRestored: restored.ok, ...(restored.skipped ? { indexNote: restored.skipped } : {}), ...(restored.error ? { indexError: restored.error } : {}), settlement: receipt.settlement?.verdict ?? null });
  return { withdrawn: true, resetTo: receipt.resetTo, gateBase: base, indexRestored: restored.ok };
}
