// runtime-rev.mjs — scoped revision wakes and already-admitted Op drift; required-read.mjs owns current READ bytes.
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { kernelNotesOf } from '../machine/land-kernel-note.mjs';
import { fileURLToPath } from 'node:url';
import { contractFilesOf, runtimeShaOf } from '../machine/contract-version.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import { underAny } from '../lib/path-key.mjs';

export const KERNEL_REV_ACKED_EVENT = 'runtime-rev-acked';
export const KERNEL_REV_STALE = 'kernel-rev-stale';
export const KERNEL_REV_UNKNOWN = 'kernel-rev-unknown';
export const OP_REV_DRIFT = 'op-rev-drift';
/** The runtime paths a Kernel's contract is read from (a directory covers what is inside it). */
const KERNEL_REV_PATHS = Object.freeze(['modules/kernel', 'modules/cli/commands/kernel', 'modules/ops', 'knowledge', 'modules/models', 'scripts/kernel/op-prompt.mjs']);
export { KERNEL_BOOT_FILES } from './required-read.mjs';
/** The Kernel's own contract: a change to one of these always asks for a re-read (a directory covers what is inside it). */
import { KERNEL_BOOT_FILES, KERNEL_CONTRACT_FILES, kernelReadManifest } from './required-read.mjs';
import { kernelAuthorityOf, kernelCustodyOf } from './verbs/shared/kernel-seat.mjs';
import fs from 'node:fs';
/** A re-read of op contracts alone is asked at most once per this window after the last ack. */
const REV_ACK_COALESCE_MS = 30 * 60_000;
const OP_PROMPT_FILE = 'scripts/kernel/op-prompt.mjs';
/** Past this many changed files the wake asks for the full re-read instead of a list. */
export const REV_DIFF_MAX_FILES = 12;
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

const underRevPaths = (file) => KERNEL_REV_PATHS.some((p) => file === p || file.startsWith(`${p}/`));
const diffMemo = new Map();
/** Actual Kernel-relevant changed paths; unknown revisions remain unavailable. */
function revDiff(root, from, to) {
  const key = `${root}\0${from}\0${to}`;
  if (diffMemo.has(key)) return diffMemo.get(key);
  let result;
  if (!resolveRev(root, from) || !resolveRev(root, to)) result = { known: false, files: [] };
  else {
    const out = git(gitDiff, root, ['--name-only', from, to, '--', ...KERNEL_REV_PATHS]);
    if (out == null) result = { known: false, files: [] };
    else {
      const files = out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter(underRevPaths);
      result = { known: true, files };
    }
  }
  diffMemo.set(key, result);
  return result;
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

/** Current revision and scoped READ drift; complete paths are retained for admission. */
/** The ops this workflow has enqueued or dispatched (jobs.op_id); [] when unreadable. */
function workflowOpsOf(db, workflowId) {
  try { return db.prepare('SELECT DISTINCT op_id FROM jobs WHERE workflow_id=? AND op_id IS NOT NULL').all(workflowId).map((r) => r.op_id).filter(Boolean); } catch { return []; }
}

/** The required Kernel and selected operation paths affected by a revision. */
function kernelRelevantOf(diff, ops, { root = revRootOf() } = {}) {
  const opFiles = new Set(ops.flatMap((op) => { try { return opRevFiles(root, op); } catch { return []; } }));
  const mine = (file) => underAny(file, KERNEL_CONTRACT_FILES) || opFiles.has(file);
  const files = (diff.files ?? []).filter(mine);
  return { files, contract: files.some((file) => underAny(file, KERNEL_CONTRACT_FILES)) };
}

/** The manifest-derive installed revision for a root that has no .git (installed tree). */
const installedRev = (db, workflowId, { root, ack, ops }) => {
  const authority = kernelAuthorityOf(db, workflowId, kernelCustodyOf(db, workflowId).terminal);
  // An acknowledged upcoming op is still required before its first persisted job exists.
  const readOps = [...new Set([...(Array.isArray(ack?.readManifest?.ops) ? ack.readManifest.ops : []), ...(ops ?? [])])];
  return kernelReadManifest(db, workflowId, { root, authority, ops: readOps });
};

/** What the acked->current diff asks the wake for (state patch) and what the gate (opRevStale) sees. */
const revGate = ({ root, db, workflowId, ack, current, now, ops }) => {
  const diff = revDiff(root, ack.rev, current);
  if (!diff.known) return { patch: { stale: true, full: true, unknownDiff: true }, gate: { stale: true, unknownDiff: true, allFiles: [] } };
  const gate = { stale: diff.files.length > 0, unknownDiff: false, allFiles: diff.files };
  const rel = kernelRelevantOf(diff, ops ?? workflowOpsOf(db, workflowId), { root });
  const wants = rel.files.length > 0;
  const coalesced = wants && !rel.contract && Number.isFinite(ack.at) && now - ack.at < REV_ACK_COALESCE_MS;
  if (coalesced) return { patch: { deferred: { files: rel.files.slice(0, REV_DIFF_MAX_FILES), until: ack.at + REV_ACK_COALESCE_MS } }, gate };
  const patch = {};
  if (wants) Object.assign(patch, { stale: true, files: rel.files.slice(0, REV_DIFF_MAX_FILES), fileCount: rel.files.length,
    ...(rel.files.length > REV_DIFF_MAX_FILES ? { full: true } : {}) });
  if (!wants && diff.files.length) patch.silent = diff.files.length; // kernel-path files moved that are not this Kernel's contract
  return { patch, gate };
};

export function kernelRevState(db, workflowId, { root = revRootOf(), current = currentRuntimeRev(root), now = Date.now(), ops = null } = {}) {
  const ack = latestRevAck(db, workflowId);
  let installedRead = null, readUnavailable = null;
  if (!current && !fs.existsSync(path.join(root,'.git'))) {
    try {
      installedRead = installedRev(db, workflowId, { root, ack, ops });
      current = installedRead.rev;
    } catch (error) { readUnavailable = String(error?.message ?? error); }
  }
  const state = { current: current ?? null, acked: ack?.rev ?? null, ackedAt: ack?.at ?? null, ackSource: ack?.source ?? null,
    stale: false, files: [], fileCount: 0 };
  if (installedRead) state.revision = installedRead.revision;
  if (readUnavailable) state.readUnavailable = readUnavailable;
  // The gate (opRevStale) reads every kernel-path file since the ack, whatever the wake asks.
  let gate = { stale: false, unknownDiff: false, allFiles: [] };
  if (!current) state.unknownCurrent = true;
  else if (!ack) state.unacked = true;
  else if (ack.rev !== current) {
    const r = revGate({ root, db, workflowId, ack, current, now, ops });
    Object.assign(state, r.patch);
    gate = r.gate;
    // A land that carries a note for the Kernels is always a re-read: the note rides the wake until the Kernel acknowledges the revision.
    const notes = landKernelNotes(root, ack.rev, current);
    if (notes.length) Object.assign(state, { notes, stale: true });
  }
  Object.defineProperty(state, 'allFiles', { value: gate.allFiles, enumerable: false });
  Object.defineProperty(state, 'gate', { value: gate, enumerable: false });
  return state;
}

/** The contract files one op's leg is built from: contractFilesOf plus the op prompt builder. */
const opRevFiles = (root, op) => [...new Set([...contractFilesOf(root, op), OP_PROMPT_FILE])];

/** Refuse an affected operation until its actual current contract files are read. */
export function opRevStale(state, op, { root = revRootOf() } = {}) {
  const gate = state?.gate ?? state;
  if (!gate?.stale) return null;
  if (gate.unknownDiff) return { files: ['(the acked revision is unknown to git)'] };
  const mine = new Set(opRevFiles(root, op));
  const files = (gate.allFiles ?? state.allFiles ?? state.files ?? []).filter((file) => mine.has(file));
  return files.length ? { files } : null;
}

const ackCommand = (workflowId, rev) => `starci kernel kernel-ack-rev --workflow ${workflowId} --plan; read every returned path, then attest with --rev ${rev} --read-manifest <file>`;

/** What the lands since the acknowledged revision say a Kernel must do differently, verbatim; an empty string when no land carried a note. */
const noteSentence = (notes) => (notes?.length ? ` What a Kernel must do differently: ${notes.join(' | ')}` : '');

/** The one sentence a Kernel wake carries about the runtime revision (no newline); null without a revision. */
export function revWakeLine(state, workflowId) {
  if (!state?.current) return null;
  const rev = shortRev(state.current);
  if (!state.stale && !state.unacked) return `Runtime rev ${rev}.`;
  const reason = state.unacked ? 'no complete runtime READ is acknowledged' : `your acknowledged rev is ${shortRev(state.acked)}`;
  const files = state.full || state.unacked ? KERNEL_BOOT_FILES : state.files;
  const reread = files.length ? `re-read ${files.join(' and ')}, then ` : '';
  return `Runtime rev ${rev}: ${reason}; ${reread}${ackCommand(workflowId, state.current)}. Enqueue/dispatch of an affected op is refused ${KERNEL_REV_STALE} until its complete required READ is acknowledged.${noteSentence(state.notes)}`;
}

/** revWakeLine read from the ledger; null when it cannot be read (a db with no events table, no git). */
export function kernelRevWakeLine(db, workflowId, opts = {}) {
  try { return revWakeLine(kernelRevState(db, workflowId, opts), workflowId); } catch { return null; }
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
