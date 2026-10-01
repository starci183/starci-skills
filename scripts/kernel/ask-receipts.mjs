// ask-receipts.mjs — where the answer to an ask is kept (alpha.3, ARCHITECTURE-DB §5.2: serve-ask answers →
// decisions + blobs; never a file under .starciwork/kernel-evidence).
//
// An answer (owner form, Telegram reply, config auto-accept, autopilot) is one starci/ask-answer@1 receipt. It is put
// in the blob store (redacted), indexed as a kernel artifact of the attempt that asked - job_artifacts name
// asks/<dispatchId>/answer-<ms>.json, origin kernel - and recorded as one `decisions` row (decider owner | the
// answering actor, subject the attempt, result {receiptSha256, artifactId, ...}). The receipt's file is the blob
// file (receiptPath, read-only), and a Work record cites it as `blob:<sha256>` (or by its decision id), never by a
// repository path.
import fs from 'node:fs';
import path from 'node:path';
import { recordDecision } from '../../engine/db/ledger.mjs';
import { artifactRoot, blobPath } from '../../engine/db/blob.mjs';
import { stageBlob, putArtifact } from './evidence-store.mjs';

export const ASK_ANSWER_SCHEMA = 'starci/ask-answer@1';
export const RECEIPT_PREFIX = 'asks/';
export const receiptNameOf = (dispatchId, at) => `${RECEIPT_PREFIX}${dispatchId}/answer-${at}.json`;
const BLOB_REF = /^blob:([a-f0-9]{64})$/;

/** The receipt as a staged blob (outside any transaction). */
export const stageReceipt = (receipt) => stageBlob(Buffer.from(JSON.stringify(receipt, null, 2)), { mediaType: 'application/json' });

/**
 * Inside the caller's transaction: index a staged receipt as the asking attempt's kernel artifact and record the
 * answer as a decisions row. Returns {receiptPath, receiptSha, receiptRef, artifactId, decisionId}.
 */
export function fileAskReceipt(db, { workflowId, dispatchId, receipt, blob, at = Date.now() }) {
  const report = db.prepare('SELECT attempt_id,job_id FROM reports WHERE workflow_id=? AND dispatch_id=?').get(workflowId, dispatchId) ?? null;
  const attempt = report ? db.prepare('SELECT attempt_id,job_id,op_id FROM op_attempts WHERE attempt_id=?').get(report.attempt_id) : null;
  let name = receiptNameOf(dispatchId, at);
  for (let n = at + 1; db.prepare('SELECT 1 FROM job_artifacts WHERE workflow_id=? AND name=?').get(workflowId, name); n += 1) name = receiptNameOf(dispatchId, n);
  const { artifactId } = putArtifact(db, { workflowId, attemptId: attempt?.attempt_id ?? null, jobId: attempt?.job_id ?? report?.job_id ?? null, opId: attempt?.op_id ?? null,
    role: 'other', kind: 'report', name, blob, origin: 'kernel', now: at });
  const answeredBy = String(receipt.answeredBy ?? 'unknown');
  const option = receipt.option ?? (receipt.optionIndex != null ? `option ${Number(receipt.optionIndex) + 1}` : 'answered');
  const decisionId = recordDecision(db, { workflowId, decider: answeredBy === 'owner' ? 'owner' : answeredBy, subjectType: attempt ? 'attempt' : null,
    subjectId: attempt ? String(attempt.attempt_id) : null, choice: String(option), rationale: typeof receipt.note === 'string' ? receipt.note.slice(0, 2000) : null,
    result: { kind: 'ask-answer', dispatchId, answeredBy, optionIndex: receipt.optionIndex ?? null, receiptSha256: blob.sha, artifactId }, decidedAt: at });
  return { receiptPath: blob.fileUri, receiptSha: blob.sha, receiptRef: `blob:${blob.sha}`, artifactId, decisionId };
}

/** Stage and file one receipt: in the caller's open ledger transaction, else in its own (`ledger.transaction`). */
export function writeAskReceipt(ledger, { workflowId, dispatchId, receipt, at = Date.now() }) {
  const blob = stageReceipt(receipt);
  const file = (db) => fileAskReceipt(db, { workflowId, dispatchId, receipt, blob, at });
  return ledger.transaction.active() ? file(ledger.db) : ledger.transaction(file);
}

/** True when `file` is a blob in the store (a receipt's file lives there). */
export const isBlobFile = (file) => {
  const rel = path.relative(artifactRoot(), path.resolve(file));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

/** The file a receipt reference names: `blob:<sha256>`, a blob file, or a path (resolved against `base`). */
export function receiptFileOf(ref, { base = process.cwd() } = {}) {
  if (typeof ref !== 'string' || !ref.trim()) return null;
  const m = BLOB_REF.exec(ref.trim());
  if (m) return blobPath(m[1]);
  const abs = path.resolve(base, ref);
  return fs.existsSync(abs) ? abs : null;
}

/** How a Work record cites a receipt file: `blob:<sha256>` for a blob, else the path relative to `repoRoot`. */
export const receiptRefOf = (file, repoRoot) => (isBlobFile(file) ? `blob:${path.basename(file)}` : path.relative(repoRoot, file).replace(/\\/g, '/'));

/** Every receipt answering `dispatchId` in a ledger, newest first: [{file, receipt, name}]. */
export function receiptsAnswering(db, dispatchId) {
  return db.prepare(`SELECT a.name,a.sha256 FROM job_artifacts a WHERE a.origin='kernel' AND a.name LIKE ? ORDER BY a.artifact_id DESC`).all(`${RECEIPT_PREFIX}${dispatchId}/answer-%`)
    .map((r) => { const file = blobPath(r.sha256); let receipt = null; try { receipt = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { receipt = null; } return { file, receipt, name: r.name }; })
    .filter((r) => r.file && r.receipt);
}
