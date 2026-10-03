// The workflow checkpoint's serialization and durable, attempt-bound effect receipts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { claimManager } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { parseJson } from '../lib/json.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { add as gitAdd } from '../api/git/add.mjs';
import { readTree } from '../api/git/read-tree.mjs';
import { writeTree } from '../api/git/write-tree.mjs';
import { lsTree } from '../api/git/ls-tree.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { getBlob, putBlob } from '../../engine/db/blob.mjs';
import { redactData } from '../lib/redact.mjs';

const WORKFLOW_LOCK = Symbol('workflow-checkpoint-lock');
const SHA = /^[0-9a-f]{40,64}$/;
const fail = ({ code }, message) => Object.assign(new Error(message), { code });
export const literalPaths = (files) => files.map((file) => `:(literal)${file}`);

export function receiptPayload(row) {
  return row?.payload_sha ? JSON.parse(getBlob(row.payload_sha).toString('utf8')) : parseJson(row?.payload_json) ?? null;
}
export function appendEffectEvent(ctx, args) {
  try { return ctx.ledger.appendEvent(args); }
  catch (error) {
    if (error.code !== 'STARCI_EVENT_PAYLOAD_TOO_LARGE') throw error;
    const blob = putBlob(Buffer.from(JSON.stringify(redactData(args.payload))), { mediaType: 'application/json' });
    const { sha, before, committed, opId, attemptId, dispatchId, resetTo } = args.payload;
    return ctx.ledger.appendEvent({ ...args, payload: { spilled: true, sha256: blob.sha, sha, before, committed, opId, attemptId, dispatchId, resetTo }, payloadSha: blob.sha });
  }
}
export const preparedSettlementOf = (ctx, { workflowId, opId, attemptId }) => receiptPayload(ctx.db.prepare("SELECT payload_json,payload_sha FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=? AND attempt_id IS ? AND kind IN ('workflow-checkpoint-prepared','workflow-op-preserved-prepared') ORDER BY seq DESC LIMIT 1").get(workflowId, opId, attemptId))?.settlement ?? null;

/** Hold the existing host lock through one synchronous operation. */
export function withLock(name, fn, { waitMs = 600_000, pollMs = 1000, env = process.env } = {}) {
  const end = Date.now() + waitMs;
  for (;;) {
    const held = claimManager(name, { env });
    if (held.ok) { try { return fn(); } finally { held.release(); } }
    if (Date.now() >= end) return { ok: false, reason: 'lock-busy', lock: name, holder: held.holder ?? null };
    sleepSync(pollMs);
  }
}
/** Native acceptance and direct primitives share the authoritative ledger/workflow lock. */
export function withWorkflowLock(ctx, { workflowId }, fn) {
  const identity = ctx?.ledger?.ledgerId ?? ctx?.ledger?.path ?? ctx?.repo ?? '';
  const name = `workflow-checkpoint-${crypto.createHash('sha1').update(`${identity}:${workflowId}`).digest('hex').slice(0, 16)}`;
  if (ctx?.[WORKFLOW_LOCK] === name) return fn(ctx);
  const out = withLock(name, () => fn({ ...ctx, [WORKFLOW_LOCK]: name }), { waitMs: ctx?.lockWaitMs, env: ctx?.env ?? process.env });
  if (out?.reason === 'lock-busy') throw fail({ code: 'workflow-checkpoint-lock-busy' }, `another checkpoint holds ${name}`);
  return out;
}

/** Read the prepared/applied receipt for the same job dispatch attempt. */
export function receiptState(ctx, { workflowId, opId }, kind) {
  if (!ctx?.ledger) return null;
  const acceptedAttempt = ctx.settlement?.state?.settledAttemptId;
  const attempt = acceptedAttempt == null
    ? ctx.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE workflow_id=? AND job_id=? ORDER BY attempt_id DESC LIMIT 1').get(workflowId, opId)
    : ctx.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE workflow_id=? AND job_id=? AND attempt_id=?').get(workflowId, opId, acceptedAttempt);
  const identity = { workflowId, opId, attemptId: attempt?.attempt_id ?? null, dispatchId: attempt?.dispatch_id ?? null };
  const other = ctx.db.prepare("SELECT kind FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=? AND attempt_id IS ? AND kind IN ('workflow-checkpoint-prepared','workflow-op-preserved-prepared') AND kind<>? LIMIT 1").get(workflowId, opId, identity.attemptId, `${kind}-prepared`);
  if (other) throw fail({ code: 'workflow-checkpoint-recovery-conflict' }, `dispatch ${identity.dispatchId ?? opId} must recover its ${other.kind} effect before changing its verdict`);
  const read = (phase) => receiptPayload(ctx.db.prepare("SELECT payload_json,payload_sha FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=? AND attempt_id IS ? AND kind=? ORDER BY seq DESC LIMIT 1").get(workflowId, opId, identity.attemptId, `${kind}-${phase}`));
  return { identity, prepared: read('prepared'), applied: read('applied') };
}
export function saveReceipt(ctx, kind, phase, receipt) {
  if (ctx?.ledger) appendEffectEvent(ctx, { workflowId: receipt.workflowId, entityType: 'job', entityId: receipt.opId,
    attemptId: receipt.attemptId, kind: `${kind}-${phase}`, payload: receipt });
  phaseOf(ctx, phase, receipt);
}
export const phaseOf = (ctx, phase, receipt) => ctx?.checkpointPhase?.(phase, receipt);
export const publicReceipt = ({ settlement: _settlement, ...receipt }) => receipt;
export const acceptedDecision = (ctx) => ctx?.settlement ? { settlement: JSON.parse(JSON.stringify(ctx.settlement)) } : {};

/** A private index observes exact worktree bytes without changing the real index or creating another commit. */
export function snapshotTree(dir, parent, files, git) {
  const index = path.join(os.tmpdir(), `starci-wf-${process.pid}-${crypto.randomBytes(4).toString('hex')}.index`);
  const env = { GIT_INDEX_FILE: index };
  try {
    const seeded = git(readTree, dir, [parent], { env });
    if (!seeded.ok) throw fail({ code: 'workflow-snapshot-failed' }, `git read-tree in ${dir}: ${seeded.stderr.slice(0, 200)}`);
    const listed = git(lsFiles, dir, ['--cached', '-z'], { env });
    if (!listed.ok) throw fail({ code: 'workflow-snapshot-failed' }, `git ls-files in ${dir}: ${listed.stderr.slice(0, 200)}`);
    const tracked = new Set(listed.stdout.split('\0').filter(Boolean));
    const stage = files.filter((file) => {
      if (tracked.has(file)) return true;
      try { return Boolean(fs.lstatSync(path.join(dir, file), { throwIfNoEntry: false })); }
      catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
    });
    if (stage.length) {
      const result = git(gitAdd, dir, ['-A', '--', ...literalPaths(stage)], { env });
      if (!result.ok) throw fail({ code: 'workflow-snapshot-failed' }, `git add -A in ${dir}: ${result.stderr.slice(0, 200)}`);
    }
    const tree = git(writeTree, dir, [], { env }).stdout;
    if (!SHA.test(tree)) throw fail({ code: 'workflow-snapshot-failed' }, `git write-tree in ${dir} printed no tree`);
    return tree;
  } finally { try { fs.rmSync(index, { force: true }); } catch { /* temp */ } }
}
/** A partial preserve can contain either saved bytes or already reset bytes; newer edits are held visibly. */
export function requireReceiptBytes(rec, receipt, bases, git) {
  if (receipt.path && (pathKey(receipt.path) !== pathKey(rec.path) || receipt.branch !== rec.branch)) throw fail({ code: 'workflow-checkpoint-recovery-conflict' }, `the registered tree of ${receipt.opId} no longer matches its prepared effect`);
  if (!receipt.files.length) return;
  const tree = snapshotTree(rec.path, bases[0], receipt.files, git);
  const entries = (ref) => new Map(String(git(lsTree, rec.path, ['-r', '-z', ref, '--', ...literalPaths(receipt.files)]).stdout).split('\0').filter(Boolean).map((row) => [row.slice(row.indexOf('\t') + 1), row]));
  const current = entries(tree), allowed = bases.map(entries);
  const changed = receipt.files.filter((file) => !allowed.some((map) => map.get(file) === current.get(file)));
  if (changed.length) throw Object.assign(fail({ code: 'workflow-checkpoint-recovery-conflict' }, `newer edits conflict with the prepared effect of ${receipt.opId}: ${changed.slice(0, 3).join(', ')}`), { files: changed });
}

/** A sibling may not step through another dispatch's unfinished cross-store effect. */
export function requireCompletedEffects(ctx, { workflowId, opId }) {
  if (!ctx?.ledger) return;
  const prepared = ctx.db.prepare("SELECT entity_id, attempt_id, kind, payload_json,payload_sha FROM events WHERE workflow_id=? AND entity_type='job' AND kind IN ('workflow-checkpoint-prepared','workflow-op-preserved-prepared') ORDER BY seq").all(workflowId);
  for (const row of prepared) {
    const receipt = receiptPayload(row);
    if (row.entity_id === opId && (!receipt?.settlement || ctx?.settlement?.job?.job_id === opId)) continue;
    const kind = row.kind.slice(0, -'-prepared'.length);
    const completion = receipt?.settlement ? kind : `${kind}-applied`;
    const complete = ctx.db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=? AND attempt_id IS ? AND kind=? LIMIT 1").get(workflowId, row.entity_id, row.attempt_id, completion);
    if (!complete) throw fail({ code: 'workflow-checkpoint-recovery-required' }, `workflow ${workflowId} must recover the prepared effect of ${row.entity_id} before ${opId}`);
  }
  const rebase = pendingRebaseOf(ctx, workflowId);
  if (rebase && rebase.opId !== opId) throw fail({ code: 'workflow-checkpoint-recovery-required' }, `workflow ${workflowId} must recover the rebase of ${rebase.opId ?? 'finish'} first`);
}

/** The latest unfinished workflow rebase has one exact proposal, even after the process loses its acknowledgement. */
export function pendingRebaseOf(ctx, workflowId) {
  if (!ctx?.ledger) return null;
  const row = ctx.db.prepare("SELECT seq,payload_json,payload_sha FROM events WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? AND kind='workflow-rebase-prepared' ORDER BY seq DESC LIMIT 1").get(workflowId, workflowId);
  if (!row) return null;
  const applied = ctx.db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? AND kind='workflow-rebase-applied' AND seq>? LIMIT 1").get(workflowId, workflowId, row.seq);
  return applied ? null : receiptPayload(row);
}
export function saveRebase(ctx, phase, receipt) {
  if (ctx?.ledger) appendEffectEvent(ctx, { workflowId: receipt.workflowId, entityType: 'workflow', entityId: receipt.workflowId,
    attemptId: receipt.attemptId, kind: `workflow-rebase-${phase}`, payload: receipt });
  phaseOf(ctx, `rebase-${phase}`, receipt);
}
export function completedRebaseOf(ctx, { workflowId, opId }) {
  if (!ctx?.ledger || !opId) return null;
  const attemptId = ctx.settlement?.state?.settledAttemptId ?? ctx.db.prepare('SELECT attempt_id FROM op_attempts WHERE workflow_id=? AND job_id=? ORDER BY attempt_id DESC LIMIT 1').get(workflowId, opId)?.attempt_id ?? null;
  const row = ctx.db.prepare("SELECT payload_json,payload_sha FROM events WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? AND attempt_id IS ? AND kind='workflow-rebase-applied' AND json_extract(payload_json,'$.opId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, workflowId, attemptId, opId);
  return receiptPayload(row);
}
