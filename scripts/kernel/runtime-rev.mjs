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
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { CONTRACT_CHANGES_FILE, contractFilesOf, runtimeShaOf } from './contract-version.mjs';
import { parseJson } from '../lib/json.mjs';

export const KERNEL_REV_ACKED_EVENT = 'runtime-rev-acked';
export const KERNEL_REV_STALE = 'kernel-rev-stale';
export const KERNEL_REV_UNKNOWN = 'kernel-rev-unknown';
export const OP_REV_DRIFT = 'op-rev-drift';
/** The runtime paths a Kernel's contract is read from (a directory covers what is inside it). */
export const KERNEL_REV_PATHS = Object.freeze(['modules/kernel', 'modules/ops', 'knowledge', 'modules/models', 'scripts/kernel/op-prompt.mjs']);
export const KERNEL_BOOT_FILES = Object.freeze(['modules/kernel/kernel-prompt.md', 'modules/kernel/driver-loop.yaml']);
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
const changeIdsAt = (root, rev) => {
  const text = git(root, ['show', `${rev}:${CONTRACT_CHANGES_FILE}`]);
  if (text == null) return [];
  try { return (parseYaml(text)?.changes ?? []).map((c) => c?.id).filter((id) => typeof id === 'string'); } catch { return []; }
};
const changesAt = (root, rev) => {
  const text = git(root, ['show', `${rev}:${CONTRACT_CHANGES_FILE}`]);
  if (text == null) return [];
  try {
    return (parseYaml(text)?.changes ?? []).filter((c) => typeof c?.id === 'string')
      .map((c) => {
        const ops = Array.isArray(c.ops) ? c.ops.filter((op) => typeof op === 'string') : [];
        // An unscoped change reaches every op's contract only when it adds a check or code or is safety-critical.
        const everyOp = !ops.length && (Boolean(c.adds?.checks?.length || c.adds?.codes?.length) || c.safetyCritical === true);
        return { id: c.id, summary: clip(c.summary, SUMMARY_MAX), ops, ...(everyOp ? { everyOp: true } : {}) };
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
      const changes = files.includes(CONTRACT_CHANGES_FILE) ? changesAt(root, to).filter((c) => !before.has(c.id)) : [];
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
export function kernelRevState(db, workflowId, { root = revRootOf(), current = currentRuntimeRev(root) } = {}) {
  const ack = latestRevAck(db, workflowId);
  const state = { current: current ?? null, acked: ack?.rev ?? null, ackedAt: ack?.at ?? null, ackSource: ack?.source ?? null,
    stale: false, files: [], fileCount: 0, changes: [] };
  let all = [];
  if (!current) state.unknownCurrent = true;
  else if (!ack) state.unacked = true;
  else if (ack.rev !== current) {
    const diff = revDiff(root, ack.rev, current);
    if (!diff.known) Object.assign(state, { stale: true, full: true, unknownDiff: true });
    else {
      all = diff.files;
      Object.assign(state, { stale: diff.files.length > 0 || diff.changes.length > 0, files: diff.files.slice(0, REV_DIFF_MAX_FILES),
        fileCount: diff.files.length, changes: diff.changes, ...(diff.files.length > REV_DIFF_MAX_FILES ? { full: true } : {}) });
    }
  }
  Object.defineProperty(state, 'allFiles', { value: all, enumerable: false });
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
  if (!state?.stale) return null;
  if (state.unknownDiff) return { files: ['(the acked revision is unknown to git)'], changes: [] };
  const mine = new Set(opRevFiles(root, op));
  const files = (state.allFiles ?? state.files).filter((file) => mine.has(file));
  const changes = state.changes.filter((c) => (c.ops.length ? c.ops.includes(op) : c.everyOp === true)).map((c) => c.id);
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
