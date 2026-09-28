// runtime-rev.mjs — which runtime revision a long-lived Kernel has read, and what changed since.
//
// Owner, 2026-09-27: a Kernel reads modules/kernel/kernel-prompt.md and driver-loop.yaml ONCE at boot,
// so a later runtime change (grammar, knowledge, prompts, op manifests) never reached a running Kernel
// without a restart (nine Kernels were restarted that day). Instead the runtime tells it what to re-read:
//   - the runtime revision is the runtime root's git HEAD (contract-version.mjs runtimeShaOf);
//   - the Kernel records the revision it has read with `api kernel-ack-rev` (event runtime-rev-acked);
//     start-workflow records the boot revision the same way (source boot);
//   - every Kernel wake carries `Runtime rev <short-sha>` (revWakeLine) and, when the acked revision is
//     behind, the kernel-relevant files that changed in between (KERNEL_REV_PATHS) plus the
//     contract-changes.yaml entries added in between, one line each - or, past REV_DIFF_MAX_FILES or
//     for a revision git no longer knows, "re-read kernel-prompt.md and driver-loop.yaml in full";
//   - until the Kernel acks the current revision, api enqueue / dispatch of a leg whose op contract
//     (contractFilesOf: its brief, _common, the verdict contract, the schemas and checks it cites, the
//     op prompt builder) or a contract change scoped to that op changed in between is refused
//     kernel-rev-stale (opRevStale); every other leg is unaffected;
//   - api settle compares the revision a leg was dispatched under (contracts.context_json.contract
//     runtimeSha) with the current one and WARNs op-rev-drift when that op's contract files changed
//     in between (opRevDrift) - never a refusal.
// A workflow with no runtime-rev-acked event yet (a Kernel booted before this module) is `unacked`: its
// wake asks for one full re-read and an ack, and nothing is gated until it has acked once.
//
// Runtime churn (2026-09-28: ~12 .claude lands in 90 min each made the fe-canon Kernel re-read and ack): a new
// runtime rev asks the Kernel to re-read (kernelRev.stale, the wake line, the reread next action) ONLY when the land
// touched the Kernel's own contract - KERNEL_CONTRACT_FILES (kernel-prompt.md, driver-loop.yaml, api.yaml,
// api-commands/, owner-rulings.yaml), the op contract files of an op this workflow has dispatched (opRevFiles), or a
// contract change with reach new-legs|follow-up that applies to it (its ops, an every-op change, or its paths in
// that set). Every other land (reconciler, ui, gc, specs, docs, knowledge, runtimes.yaml numbers) updates the code
// silently. Coalescing: a re-read that touches no KERNEL_CONTRACT_FILES waits until REV_ACK_COALESCE_MS after the
// last ack (kernelRev.deferred), so a Kernel is asked at most once per 30 min unless its contract file changed.
// The kernel-rev-stale gate (opRevStale) is unchanged: it still reads every op contract change since the ack
// (the non-enumerable kernelRev.gate), so a leg is never built from a contract its Kernel has not read.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contractFilesOf, runtimeShaOf } from './contract-version.mjs';
import { isContractChangesPath, readContractChangesDocAt } from './contract-changes-store.mjs';
import { parseJson } from '../lib/json.mjs';

export const KERNEL_REV_ACKED_EVENT = 'runtime-rev-acked';
export const KERNEL_REV_STALE = 'kernel-rev-stale';
export const KERNEL_REV_UNKNOWN = 'kernel-rev-unknown';
export const OP_REV_DRIFT = 'op-rev-drift';
/** The runtime paths a Kernel's contract is read from (a directory covers what is inside it). */
export const KERNEL_REV_PATHS = Object.freeze(['modules/kernel', 'modules/ops', 'knowledge', 'modules/models', 'scripts/kernel/op-prompt.mjs']);
export const KERNEL_BOOT_FILES = Object.freeze(['modules/kernel/kernel-prompt.md', 'modules/kernel/driver-loop.yaml']);
/** The Kernel's own contract: a change to one of these always asks for a re-read (a directory covers what is inside it). */
export const KERNEL_CONTRACT_FILES = Object.freeze([...KERNEL_BOOT_FILES, 'modules/kernel/api.yaml', 'modules/kernel/api-commands', 'modules/kernel/owner-rulings.yaml']);
/** A re-read of op contracts / contract changes alone is asked at most once per this window after the last ack. */
export const REV_ACK_COALESCE_MS = 30 * 60_000;
/** Contract changes with these reaches can require a Kernel re-read. */
export const REV_REACHES = Object.freeze(['new-legs', 'follow-up']);
export const OP_PROMPT_FILE = 'scripts/kernel/op-prompt.mjs';
/** Past this many changed files the wake asks for the full re-read instead of a list. */
export const REV_DIFF_MAX_FILES = 12;
const WAKE_CHANGES_MAX = 5;
const SUMMARY_MAX = 90;
const SHORT = 12;

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The runtime root whose HEAD is the current revision; STARCI_KERNEL_REV_ROOT is the spec seam. */
export const revRootOf = (env = process.env) => (env.STARCI_KERNEL_REV_ROOT ? path.resolve(env.STARCI_KERNEL_REV_ROOT) : defaultRoot);
export const shortRev = (sha) => (typeof sha === 'string' ? sha.slice(0, SHORT) : null);
const clip = (text, max) => { const one = String(text ?? '').replace(/\s+/g, ' ').trim(); return one.length > max ? `${one.slice(0, max - 1)}…` : one; };

const git = (root, args) => {
  try {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
    return r.status === 0 ? String(r.stdout ?? '') : null;
  } catch { return null; }
};

/** The current runtime revision (full sha) of `root`, or null. */
export const currentRuntimeRev = (root = revRootOf()) => runtimeShaOf(root);

/** `rev` (a sha or a unique prefix) resolved to a full commit sha in `root`, or null. */
export function resolveRev(root, rev) {
  if (typeof rev !== 'string' || !/^[0-9a-f]{4,40}$/i.test(rev.trim())) return null;
  const out = git(root, ['rev-parse', '--verify', '--quiet', `${rev.trim()}^{commit}`]);
  const sha = out?.trim();
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

const underRevPaths = (file) => KERNEL_REV_PATHS.some((p) => file === p || file.startsWith(`${p}/`));
// The registry at a revision: the entry files plus the old single-file list (contract-changes-store.mjs).
const registryAt = (root, rev) => { try { return readContractChangesDocAt(root, rev)?.doc?.changes ?? []; } catch { return []; } };
const changeIdsAt = (root, rev) => registryAt(root, rev).map((c) => c?.id).filter((id) => typeof id === 'string');
const changesAt = (root, rev) => {
  try {
    return registryAt(root, rev).filter((c) => typeof c?.id === 'string')
      .map((c) => {
        const ops = Array.isArray(c.ops) ? c.ops.filter((op) => typeof op === 'string') : [];
        // An unscoped change reaches every op's contract only when it adds a check or code or is safety-critical.
        const everyOp = !ops.length && (Boolean(c.adds?.checks?.length || c.adds?.codes?.length) || c.safetyCritical === true);
        const paths = Array.isArray(c.paths) ? c.paths.filter((p) => typeof p === 'string') : [];
        const out = { id: c.id, summary: clip(c.summary, SUMMARY_MAX), ops, ...(everyOp ? { everyOp: true } : {}) };
        // reach and paths ride non-enumerable: the wake and api status keep their shape.
        Object.defineProperty(out, 'reach', { value: typeof c.reach === 'string' ? c.reach : null, enumerable: false });
        Object.defineProperty(out, 'paths', { value: paths, enumerable: false });
        return out;
      });
  } catch { return []; }
};

const diffMemo = new Map();
/**
 * What changed for a Kernel between `from` and `to`: {known, files[] (kernel-relevant, every one),
 * changes[] ({id, summary, ops} of contract-changes.yaml entries present at `to` and absent at `from`)}.
 * known:false when git cannot compare the two (a revision it no longer has).
 */
export function revDiff(root, from, to) {
  const key = `${root}\0${from}\0${to}`;
  if (diffMemo.has(key)) return diffMemo.get(key);
  let result;
  if (!resolveRev(root, from) || !resolveRev(root, to)) result = { known: false, files: [], changes: [] };
  else {
    const out = git(root, ['diff', '--name-only', from, to, '--', ...KERNEL_REV_PATHS]);
    if (out == null) result = { known: false, files: [], changes: [] };
    else {
      const files = out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter(underRevPaths);
      const before = new Set(changeIdsAt(root, from));
      const changes = files.some(isContractChangesPath) ? changesAt(root, to).filter((c) => !before.has(c.id)) : [];
      result = { known: true, files, changes };
    }
  }
  diffMemo.set(key, result);
  return result;
}

/** The latest runtime-rev-acked event of a workflow: {rev, at, source, files, attempt} or null. */
export function latestRevAck(db, workflowId) {
  const row = db.prepare('SELECT payload_json,created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(workflowId, KERNEL_REV_ACKED_EVENT);
  const payload = parseJson(row?.payload_json);
  if (!payload?.rev) return null;
  return { rev: payload.rev, at: row.created_at, source: payload.source ?? 'ack', files: Array.isArray(payload.files) ? payload.files : [], attempt: payload.attempt ?? null };
}

/**
 * api status kernelRev: {current, acked, ackedAt, ackSource, stale, unacked?, full?, files[], fileCount,
 * changes[]}. stale: the acked revision is behind and a kernel-relevant file or a contract change moved
 * in between (a revision git cannot compare is stale and full). `files` is capped at REV_DIFF_MAX_FILES;
 * the whole list rides as the non-enumerable `allFiles` for the gate.
 */
const within = (file, list) => list.some((p) => file === p || file.startsWith(`${p}/`));
/** The ops this workflow has enqueued or dispatched (jobs.op_id); [] when unreadable. */
export function workflowOpsOf(db, workflowId) {
  try { return db.prepare('SELECT DISTINCT op_id FROM jobs WHERE workflow_id=? AND op_id IS NOT NULL').all(workflowId).map((r) => r.op_id).filter(Boolean); } catch { return []; }
}

/**
 * The part of a rev diff that asks THIS Kernel to re-read: {files, changes, contract} - files in KERNEL_CONTRACT_FILES
 * or in the op contract files of `ops`, the contract changes (reach new-legs|follow-up) scoped to `ops`, every-op, or
 * whose paths touch that set (their registry file then counts too); contract: a KERNEL_CONTRACT_FILES file moved. Pure
 * but for opRevFiles.
 */
export function kernelRelevantOf(diff, ops, { root = revRootOf() } = {}) {
  const opFiles = new Set(ops.flatMap((op) => { try { return opRevFiles(root, op); } catch { return []; } }));
  const mine = (file) => within(file, KERNEL_CONTRACT_FILES) || opFiles.has(file);
  const changes = (diff.changes ?? []).filter((c) => REV_REACHES.includes(c.reach)
    && ((c.ops?.length ? c.ops.some((op) => ops.includes(op)) : c.everyOp === true) || (c.paths ?? []).some((p) => mine(p) && !isContractChangesPath(p))));
  const files = (diff.files ?? []).filter((file) => (isContractChangesPath(file) ? changes.length > 0 : mine(file)));
  return { files, changes, contract: files.some((file) => within(file, KERNEL_CONTRACT_FILES)) };
}

export function kernelRevState(db, workflowId, { root = revRootOf(), current = currentRuntimeRev(root), now = Date.now(), ops = null } = {}) {
  const ack = latestRevAck(db, workflowId);
  const state = { current: current ?? null, acked: ack?.rev ?? null, ackedAt: ack?.at ?? null, ackSource: ack?.source ?? null,
    stale: false, files: [], fileCount: 0, changes: [] };
  // The gate (opRevStale) reads every kernel-path file and contract change since the ack, whatever the wake asks.
  let gate = { stale: false, unknownDiff: false, allFiles: [], changes: [] };
  if (!current) state.unknownCurrent = true;
  else if (!ack) state.unacked = true;
  else if (ack.rev !== current) {
    const diff = revDiff(root, ack.rev, current);
    if (!diff.known) {
      Object.assign(state, { stale: true, full: true, unknownDiff: true });
      gate = { stale: true, unknownDiff: true, allFiles: [], changes: [] };
    } else {
      gate = { stale: diff.files.length > 0 || diff.changes.length > 0, unknownDiff: false, allFiles: diff.files, changes: diff.changes };
      const rel = kernelRelevantOf(diff, ops ?? workflowOpsOf(db, workflowId), { root });
      const wants = rel.files.length > 0 || rel.changes.length > 0;
      const coalesced = wants && !rel.contract && Number.isFinite(ack.at) && now - ack.at < REV_ACK_COALESCE_MS;
      if (coalesced) state.deferred = { files: rel.files.slice(0, REV_DIFF_MAX_FILES), changes: rel.changes.map((c) => c.id), until: ack.at + REV_ACK_COALESCE_MS };
      else if (wants) Object.assign(state, { stale: true, files: rel.files.slice(0, REV_DIFF_MAX_FILES), fileCount: rel.files.length, changes: rel.changes,
        ...(rel.files.length > REV_DIFF_MAX_FILES ? { full: true } : {}) });
      if (!wants && diff.files.length) state.silent = diff.files.length; // kernel-path files moved that are not this Kernel's contract
    }
  }
  Object.defineProperty(state, 'allFiles', { value: gate.allFiles, enumerable: false });
  Object.defineProperty(state, 'gate', { value: gate, enumerable: false });
  return state;
}

/** The contract files one op's leg is built from: contractFilesOf plus the op prompt builder. */
export const opRevFiles = (root, op) => [...new Set([...contractFilesOf(root, op), OP_PROMPT_FILE])];

/**
 * Whether a stale Kernel may not enqueue or dispatch `op`: null when it may, else {files, changes}
 * - the op's contract files and the contract changes scoped to it (or unscoped ones that add a check or
 * code, or are safety-critical) that moved since
 * the acked revision. A revision git cannot compare holds every leg.
 */
export function opRevStale(state, op, { root = revRootOf() } = {}) {
  const gate = state?.gate ?? state;
  if (!gate?.stale) return null;
  if (gate.unknownDiff) return { files: ['(the acked revision is unknown to git)'], changes: [] };
  const mine = new Set(opRevFiles(root, op));
  const files = (gate.allFiles ?? state.allFiles ?? state.files ?? []).filter((file) => mine.has(file));
  const changes = (gate.changes ?? []).filter((c) => (c.ops?.length ? c.ops.includes(op) : c.everyOp === true)).map((c) => c.id);
  return files.length || changes.length ? { files, changes } : null;
}

const ackCommand = (workflowId, rev) => `api kernel-ack-rev --workflow ${workflowId} --rev ${shortRev(rev)}`;

/** The one sentence a Kernel wake carries about the runtime revision (no newline); null without a revision. */
export function revWakeLine(state, workflowId) {
  if (!state?.current) return null;
  const rev = shortRev(state.current);
  const full = `re-read ${KERNEL_BOOT_FILES.join(' and ')} in full`;
  if (state.unacked) return `Runtime rev ${rev}: no runtime rev acked yet - ${full}, then ${ackCommand(workflowId, state.current)} --files kernel-prompt.md,driver-loop.yaml.`;
  if (!state.stale) return `Runtime rev ${rev}.`;
  const since = `Runtime rev ${rev} is newer than your acked rev ${shortRev(state.acked)}`;
  const ids = state.changes.length ? ` (new contract changes: ${state.changes.slice(0, WAKE_CHANGES_MAX * 2).map((c) => c.id).join(', ')})` : '';
  if (state.full) return `${since}${ids}: ${full}, then ${ackCommand(workflowId, state.current)}; enqueue/dispatch of a leg whose op contract changed is refused ${KERNEL_REV_STALE} until then.`;
  const changes = state.changes.slice(0, WAKE_CHANGES_MAX).map((c) => `${c.id} (${c.summary})`);
  const more = state.changes.length > WAKE_CHANGES_MAX ? ` (+${state.changes.length - WAKE_CHANGES_MAX})` : '';
  return `${since}: re-read ${state.files.join(', ')}${changes.length ? `; new contract changes: ${changes.join('; ')}${more}` : ''}; then ${ackCommand(workflowId, state.current)} --files <what you re-read>. Until then enqueue/dispatch of a leg whose op contract changed is refused ${KERNEL_REV_STALE}.`;
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
  const out = git(root, ['diff', '--name-only', from, to, '--', ...files]);
  if (out == null) return null;
  const changed = out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return changed.length ? { from, to, files: changed } : null;
}
