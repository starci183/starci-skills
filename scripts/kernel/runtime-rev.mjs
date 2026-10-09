// runtime-rev.mjs — the runtime revision a Kernel acked, the enqueue/dispatch gate over an op's own contract, and already-admitted Op drift. What a Kernel owes for a
// revision change (the wake, the menu item, the status field) is decided ONCE, by the notice (scripts/machine/revision-notice.mjs over modules/kernel/revision-scope.yaml);
// required-read.mjs owns the current READ bytes.
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { kernelNotesOf } from '../machine/land-kernel-note.mjs';
import { fileURLToPath } from 'node:url';
import { contractFilesOf, runtimeShaOf } from '../machine/contract-version.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';

export const KERNEL_REV_ACKED_EVENT = 'runtime-rev-acked';
export const KERNEL_REV_STALE = 'kernel-rev-stale';
export const KERNEL_REV_UNKNOWN = 'kernel-rev-unknown';
export const OP_REV_DRIFT = 'op-rev-drift';
export { KERNEL_BOOT_FILES } from './required-read.mjs';
import { kernelReadManifest } from './required-read.mjs';
import { kernelAuthorityOf, kernelCustodyOf } from './verbs/shared/kernel-seat.mjs';
import fs from 'node:fs';
const OP_PROMPT_FILE = 'scripts/kernel/op-prompt.mjs';
const SHORT = 12;

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The runtime root whose HEAD is the current revision; STARCI_KERNEL_REV_ROOT is the spec seam. */
export const revRootOf = (env = process.env) => (env.STARCI_KERNEL_REV_ROOT ? path.resolve(env.STARCI_KERNEL_REV_ROOT) : defaultRoot);
export const shortRev = (sha) => (typeof sha === 'string' ? sha.slice(0, SHORT) : null);


const git = (call, root, args) => {
  try {
    const r = call(args, { dir: root, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
    return r.status === 0 ? String(r.stdout ?? '') : null;
  } catch { return null; }
};

/** The current runtime revision (full sha) of `root`, or null. */
export const currentRuntimeRev = (root = revRootOf()) => runtimeShaOf(root);

/** `rev` (a sha or a unique prefix) resolved to a full commit sha in `root`, or null. */
export function resolveRev(root, rev) {
  if (typeof rev !== 'string' || !/^[0-9a-f]{4,40}$/i.test(rev.trim())) return null;
  const out = git(revParseQuery, root, ['--verify', '--quiet', `${rev.trim()}^{commit}`]);
  const sha = out?.trim();
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/** The Kernel notes the lands between `from` (exclusive) and `to` carry, oldest first; [] when none or git cannot say. */
export function landKernelNotes(root, from, to) {
  if (!from || !to || from === to) return [];
  const out = git(gitLog, root, ['--reverse', '--notes=land', '--format=%x01%N', `${from}..${to}`]);
  return out == null ? [] : kernelNotesOf(out.split('\u0001'));
}

/** The latest runtime-rev-acked event of a workflow: {rev, at, source, files, attempt} or null. */
function latestRevAck(db, workflowId) {
  const row = db.prepare('SELECT payload_json,payload_sha,created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(workflowId, KERNEL_REV_ACKED_EVENT);
  const payload = eventPayloadOf(row);
  if (!payload?.rev) return null;
  return { rev: payload.rev, at: row.created_at, source: payload.source ?? 'ack', files: Array.isArray(payload.files) ? payload.files : [], attempt: payload.attempt ?? null, readManifest: payload.readManifest ?? null };
}

/** The contract files one op's leg is built from: contractFilesOf plus the op prompt builder. */
const opRevFiles = (root, op) => [...new Set([...contractFilesOf(root, op), OP_PROMPT_FILE])];

/** The manifest-derived installed revision for a root that has no .git (installed tree). */
const installedRev = (db, workflowId, { root, ack, ops }) => {
  const authority = kernelAuthorityOf(db, workflowId, kernelCustodyOf(db, workflowId).terminal);
  // An acknowledged upcoming op is still required before its first persisted job exists.
  const readOps = [...new Set([...(Array.isArray(ack?.readManifest?.ops) ? ack.readManifest.ops : []), ...(ops ?? [])])];
  return kernelReadManifest(db, workflowId, { root, authority, ops: readOps });
};

/**
 * The enqueue/dispatch gate: the files of `op`'s own contract that changed between the revision the Kernel acked (the one runtime-rev-acked event) and the current one,
 * {acked, current, files}; null when nothing of this op moved. A Kernel that never acked, an unknown current revision and legs of other ops pass; an acked revision git
 * does not know holds. It reads no wake, no window and no path list: what a Kernel owes for the revision is the notice's.
 */
export function opRevHold(db, workflowId, op, { root = revRootOf() } = {}) {
  const ack = latestRevAck(db, workflowId);
  let current = currentRuntimeRev(root);
  if (!current && !fs.existsSync(path.join(root, '.git'))) current = installedRev(db, workflowId, { root, ack, ops: [op] }).rev;
  if (!current || !ack || ack.rev === current) return null;
  if (!resolveRev(root, ack.rev) || !resolveRev(root, current)) return { acked: ack.rev, current, files: ['(the acked revision is unknown to git)'], unknown: true };
  const drift = opRevDrift(root, op, ack.rev, current);
  return drift ? { acked: ack.rev, current, files: drift.files } : null;
}

/**
 * op-rev-drift at settle: the op's contract files that changed on the runtime between the revision the
 * leg was dispatched under (`from`) and `to`. null when nothing moved or it cannot be told.
 */
export function opRevDrift(root, op, from, to) {
  if (!from || !to || from === to) return null;
  if (!resolveRev(root, from) || !resolveRev(root, to)) return null;
  const files = opRevFiles(root, op).filter((rel) => !rel.includes('..'));
  const out = git(gitDiff, root, ['--name-only', from, to, '--', ...files]);
  if (out == null) return null;
  const changed = out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return changed.length ? { from, to, files: changed } : null;
}
