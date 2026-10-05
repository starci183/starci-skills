// ask-receipts.mjs — where the answer to an ask is kept (docs/ledger-db.md §§5–6): serve-ask answers →
// decisions + blobs; never a file under .starciwork/kernel-evidence.
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
import { sha256 } from '../../engine/digest.mjs';
import { artifactRoot, blobPath } from '../../engine/db/blob.mjs';
import { stageBlob, putArtifact } from './evidence-store.mjs';
import { slash } from '../lib/path-key.mjs';

const RECEIPT_PREFIX = 'asks/';
const receiptNameOf = (dispatchId, at) => `${RECEIPT_PREFIX}${dispatchId}/answer-${at}.json`;
const BLOB_REF = /^blob:([a-f0-9]{64})$/;

/** The receipt as a staged blob (outside any transaction). */
export const stageReceipt = (receipt) => stageBlob(Buffer.from(JSON.stringify(receipt, null, 2)), { mediaType: 'application/json' });

/**
 * Inside the caller's transaction: index a staged receipt as the asking attempt's kernel artifact and record the
 * answer as a decisions row. Returns {receiptPath, receiptSha, receiptRef, artifactId, decisionId}.
 */
function fileAskReceipt(db, { workflowId, dispatchId, receipt, blob, at = Date.now() }) {
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

/** Atomically accept one answer with its receipt, decision and terminal lifecycle event. */
export function commitAskAnswer(ledger, { workflowId, dispatchId, receipt, at = Date.now(), payload = {}, events = [], blob: staged = null }) {
  const blob = staged ?? stageReceipt(receipt);
  const answerDigest = sha256(JSON.stringify({ ...receipt, at: null }));
  return ledger.transaction(db => {
    const latest = db.prepare(`SELECT kind,payload_json FROM events WHERE workflow_id=?
      AND kind IN ('ask-answered','ask-superseded')
      AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, dispatchId);
    if (latest?.kind === 'ask-answered' || latest?.kind === 'ask-superseded') {
      const prior = JSON.parse(latest.payload_json);
      return prior.answerDigest === answerDigest
        ? { accepted: true, replayed: true, ...prior }
        : { accepted: false, why: latest.kind === 'ask-answered' ? 'already-answered' : 'retired' };
    }
    const filed = fileAskReceipt(db, { workflowId, dispatchId, receipt, blob, at });
    const answer = { dispatchId, receiptPath: filed.receiptPath, receiptSha: filed.receiptSha, decisionId: filed.decisionId,
      answeredBy: receipt.answeredBy, optionIndex: receipt.optionIndex ?? null,
      custodyWritten: receipt.custodyWritten ?? [], envWritten: receipt.envWritten ?? [], pointersWritten: receipt.pointersWritten ?? [], errors: receipt.errors ?? [],
      ...payload, answerDigest };
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: 'ask-answered', payload: answer });
    for (const event of events) ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, ...event,
      payload: { ...event.payload, receiptPath: filed.receiptPath } });
    return { accepted: true, replayed: false, ...filed };
  });
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

/**
 * The prelude of every `apply` that settles from a serve-ask answer (scripts/work/draw-review.mjs,
 * scripts/work/brand-direction.mjs): resolve the receipt ref (a `blob:<sha256>` the store kept, or a path inside
 * `repoRoot`), refuse a file outside the repository, and parse it as the `schema` receipt. Returns
 * {receipt, receiptAbs, receiptRel} - receiptRel is how the record cites it.
 */
export function readAnswerReceipt(receiptFile, { repoRoot, base = process.cwd(), schema = 'starci/ask-answer@1' } = {}) {
  // The receipt is the blob serve-ask stored (receiptPath, or `blob:<sha256>`); a Work record cites it as
  // blob:<sha256>. A path inside the repository is still read (an example tree's own receipt).
  const receiptAbs = receiptFileOf(String(receiptFile), { base }) ?? path.resolve(String(receiptFile));
  const receiptRel = receiptRefOf(receiptAbs, repoRoot);
  if (!isBlobFile(receiptAbs) && (receiptRel.startsWith('../') || path.isAbsolute(receiptRel))) throw new Error(`receipt ${slash(receiptFile)} is neither a stored answer (blob:<sha256>, the receiptPath serve-ask returned) nor a file inside the repository ${slash(repoRoot)}`);
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(receiptAbs, 'utf8')); } catch (error) { throw new Error(`receipt ${slash(receiptFile)} is unreadable: ${error.message}`); }
  if (receipt?.schema !== schema) throw new Error(`${slash(receiptFile)} is ${receipt?.schema ?? 'not a receipt'}, not ${schema}`);
  return { receipt, receiptAbs, receiptRel };
}

/** Every receipt answering `dispatchId` in a ledger, newest first: [{file, receipt, name}]. */
export function receiptsAnswering(db, dispatchId) {
  return db.prepare(`SELECT a.name,a.sha256 FROM job_artifacts a WHERE a.origin='kernel' AND a.name LIKE ? ORDER BY a.artifact_id DESC`).all(`${RECEIPT_PREFIX}${dispatchId}/answer-%`)
    .map((r) => { const file = blobPath(r.sha256); let receipt = null; try { receipt = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { receipt = null; } return { file, receipt, name: r.name }; })
    .filter((r) => r.file && r.receipt);
}
