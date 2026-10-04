// workflow-checkpoint.mjs - the checkpoints of ONE workflow worktree and its single land into main (WFWT part B, owner
// decision 2026-10-01: one worktree per Kernel workflow replaces the per-op worktrees and the per-op land).
//
// The workflow worktree (scripts/kernel/workflow-worktree.mjs, part A) is Orca's, on the workflow branch Orca named (wf-<id>;
// the runtime never constructs it: it reads registry.branch through workflowWorktreeOf), private to the workflow. Its registry row carries `checkpoint`: the commit of the last op that settled green.
//   checkpointOp      an op settled green: the changes under its OWNED paths (exactly what its leases hold: its be/ or
//                     fe/ paths and its owned .starciwork Work records) are committed on the workflow branch by the runtime (a
//                     temporary index, commit-tree, a compare-and-swap of the branch: no hook, no other op's in-flight
//                     file), then setCheckpoint. The runtime is the ONLY committer on the workflow branch: the branch head must be
//                     the registry's checkpoint (the checkpoint chain), else workflow-foreign-commit; a change under no
//                     live op's leases is workflow-foreign-change. Both refuse a pass; preserveAndReset folds both into
//                     a failed or blocked op's preserved ref.
//   gateBaseOf        the base gate.mjs measures an op against: the previous checkpoint (the merge-base with main before the
//                     first one), so only the op's own new findings block.
//   preserveAndReset  an op failed or was blocked: its owned paths' work (and any foreign change) is kept as
//                     preserved/<workflowId>/<op> (a snapshot commit) and put back on the last checkpoint.
//   rebaseWorkflow    the workflow branch rebased onto main's tip (a milestone when main moved, and the finish); the checkpoint follows.
//   (starci kernel settle runs these through scripts/kernel/workflow-settle.mjs: settleCheckpoint, the Work-record owner rule and
//                     the milestone rebase.)
//   finishWorkflow    main is touched only here, in this order: the full gate of the whole branch against its merge-base
//                     with main, the merge guard, review.verify of the exact head that lands, the rebase (a rebase that
//                     moves the head forces a re-review), the fast-forward of main and its push, then the worktree is
//                     marked release-pending. The finish never removes its own worktree: part A's GC removes it and
//                     deletes the workflow branch. Each refusal is typed.
//
// ctx is part A's context (its registry, its Orca client) plus optional seams: ctx.worktree (part A's functions),
// ctx.db (the ledger), ctx.gate, ctx.guard, ctx.verify, ctx.push, ctx.fastForward, ctx.main.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath } from 'node:url';
import { commitTree } from '../api/git/commit-tree.mjs';
import { mergeBase } from '../api/git/merge-base.mjs';
import { rmCached } from '../api/git/rm-cached.mjs';
import { symbolicRef } from '../api/git/symbolic-ref.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { lsTree } from '../api/git/ls-tree.mjs';
import { restore as gitRestore } from '../api/git/restore.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { reset as gitReset } from '../api/git/reset.mjs';
import { statusQuery as gitStatus } from '../api/git/status-query.mjs';
import { remote as gitRemote } from '../api/git/remote.mjs';
import { push as gitPush } from '../api/git/push.mjs';
import { mainRootOf } from '../machine/worktree-git.mjs';
import { TERMINAL_JOB_STATUSES } from '../machine/worktree-registry.mjs';
import { mergeGuard } from '../gates/gate.mjs';
import { fastForwardLive } from '../machine/live-fast-forward.mjs';
import { setCheckpoint, markReleasePending } from './workflow-worktree.mjs';
import { gateBaseOf, gateBasesOf, workflowWorktreeAt, workflowWorktreeOf } from '../machine/workflow-tree.mjs';
import { normalizeOwnedPath } from '../../engine/admission.mjs';
import { ownedPathsOf } from './verbs/shared/rows.mjs';
import { splitList } from '../lib/list.mjs';
import { underAny } from '../lib/path-key.mjs';
import { commitShaOf } from './commit-sha.mjs';
import { requireWorktreeRecord } from '../lib/worktree-record.mjs';
import { lockOperation } from '../lib/locked-operation.mjs';
import { acceptedDecision, completedRebaseOf, literalPaths, pendingRebaseOf, phaseOf, publicReceipt, receiptState, requireCompletedEffects, requireReceiptBytes, saveReceipt, snapshotTree, withLock, withWorkflowLock } from './workflow-checkpoint-state.mjs';
import { applyWorkflowRebase } from './workflow-rebase.mjs';
export { withWorkflowLock } from './workflow-checkpoint-state.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'gates', 'gate.mjs');
export const PRESERVED_WORKFLOW_PREFIX = 'preserved';
export const FINISH_STEPS = Object.freeze(['gate', 'merge-guard', 'review-verify', 'rebase', 'fast-forward', 'push', 'release-pending']);
export const CHECKPOINT_EVENTS = Object.freeze({ checkpoint: 'workflow-checkpoint', preserved: 'workflow-op-preserved', landed: 'workflow-landed' });
const RUNTIME_IDENTITY = { 'user.name': 'starci', 'user.email': 'runtime@starci.local' };
const NO_MODULES = [':(exclude,glob)**/node_modules', ':(exclude,glob)**/node_modules/**'];
const SHA = /^[0-9a-f]{40,64}$/;

/* ------------------------------------------------------------ plumbing */

/** The per-repository land lock: one workflow lands into a repository's main at a time. */
const landLockName = (repoRoot) => `product-land-${crypto.createHash('sha1').update(String(path.resolve(repoRoot)).replace(/\\/g, '/').toLowerCase()).digest('hex').slice(0, 10)}`;

const fail = ({ code }, message) => Object.assign(new Error(message), { code });
/** One git call (a scripts/api/git call file) in `cwd`: {ok, status, stdout, stderr}. */
function git(call, cwd, args, { env = null, timeout = 600_000, input, config = null } = {}) {
  const r = call(args, { cwd, timeout, input, config, env: env ? { ...process.env, ...env } : process.env, maxBuffer: 256 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
}
const revParse = (cwd, ref) => commitShaOf(git, cwd, ref);
const lines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);
const mainOf = (ctx) => ctx?.main ?? 'main';
/** Part A's functions: ctx.worktree in a spec, the module itself in the runtime. */
const wt = (ctx) => ({ workflowWorktreeOf, workflowWorktreeAt, setCheckpoint, markReleasePending, TERMINAL_JOB_STATUSES, ...(ctx?.worktree ?? {}) });

/** The registry row of the workflow's worktree, its directory present: {workflowId, orcaWorktreeId, path, branch, checkpoint}. */
export function recordOf(ctx, workflowId) {
  return requireWorktreeRecord(wt(ctx).workflowWorktreeOf(ctx, workflowId), workflowId);
}
/** The branch the worktree is on must be the workflow branch: a checkpoint never lands on another branch. */
function requireOnBranch(rec) {
  const head = symbolicRef(rec.path);
  if (head !== `refs/heads/${rec.branch}`) throw fail({ code: 'workflow-branch-mismatch' }, `the workflow worktree ${rec.path} is on ${head || 'a detached HEAD'}, not ${rec.branch}`);
}

const ownedOf = (payloadJson) => {
  let payload = null;
  try { payload = payloadJson ? JSON.parse(payloadJson) : null; } catch { payload = null; }
  return ownedPathsOf(payload).flatMap((p) => { try { return [normalizeOwnedPath(p)]; } catch { return []; } });
};
/**
 * The leases of the workflow's ops in its worktree: `own`, the owned paths of `opId` (exactly what its leases hold: its
 * be/ or fe/ paths and its owned .starciwork Work records; the whole tree for an op the ledger does not know), and
 * `others`, the owned paths of every other op of the workflow still occupying the tree (part A's TERMINAL_JOB_STATUSES, scripts/machine/worktree-registry.mjs).
 */
export function leasesOf(ctx, { workflowId, opId }) {
  const row = ctx?.db?.prepare?.('SELECT job_id, payload_json FROM jobs WHERE job_id=?').get(opId) ?? null;
  if (!row) return { own: ['.'], others: [] };
  const statuses = wt(ctx).TERMINAL_JOB_STATUSES;
  const live = ctx.db.prepare(`SELECT job_id, payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND job_id<>? AND status IN (${statuses.map(() => '?').join(',')})`).all(workflowId, opId, ...statuses);
  return { own: ownedOf(row.payload_json), others: live.flatMap((r) => ownedOf(r.payload_json)) };
}
/** The gate bases an op's settle accepts (gateBasesOf over its owned paths), newest first; [] outside a workflow worktree. */
export const opGateBasesOf = (ctx, { workflowId, opId }) => (wt(ctx).workflowWorktreeOf(ctx, workflowId) ? gateBasesOf(ctx, workflowId, { owned: leasesOf(ctx, { workflowId, opId }).own }) : []);
const under = (file, owned) => underAny(file, owned, { dot: true });
const zlist = (text) => splitList(text, { sep: '\0' });
/** Every path of the worktree that differs from HEAD: tracked changes (staged or not, deletions included) and untracked files. */
function changedFiles(dir) {
  const tracked = git(gitDiff, dir, ['--name-only', '--no-renames', '-z', 'HEAD', '--', '.', ...NO_MODULES]);
  const untracked = git(lsFiles, dir, ['--others', '--exclude-standard', '-z', '--', '.', ...NO_MODULES]);
  if (!tracked.ok || !untracked.ok) throw fail({ code: 'workflow-snapshot-failed' }, `the changes of ${dir} could not be listed: ${(tracked.stderr || untracked.stderr).slice(0, 200)}`);
  return [...new Set([...zlist(tracked.stdout), ...zlist(untracked.stdout)])].sort();
}
/** The changed files an op answers for: `mine` under its owned paths, `stray` under no live op's leases at all. */
export function splitChanges(dir, { own, others }) {
  const files = changedFiles(dir);
  return { mine: files.filter((f) => under(f, own)), stray: files.filter((f) => !under(f, own) && !under(f, others)) };
}

/**
 * `files` as they are in the working tree, committed on `parent` through a temporary index (the worktree's own index and
 * files are untouched; node_modules is never staged). {tree, sha|null}: sha null when nothing differs from the parent.
 */
function snapshotFiles(dir, parent, files, message) {
  if (!files.length) return { tree: null, sha: null };
  const tree = snapshotTree(dir, parent, files, git);
  if (tree === git(revParseQuery, dir, [`${parent}^{tree}`]).stdout) return { tree, sha: null };
  const sha = git(commitTree, dir, [tree, '-p', parent, '-m', message], { config: RUNTIME_IDENTITY }).stdout;
  if (!SHA.test(sha)) throw fail({ code: 'workflow-snapshot-failed' }, `git commit-tree in ${dir} printed no commit`);
  return { tree, sha };
}

/** `files` put back as they are at `base`: restored when base has them, removed (index and disk) when it does not. */
function resetFiles(dir, base, files) {
  if (!files.length) return;
  const inBase = new Set(zlist(git(lsTree, dir, ['-r', '-z', '--name-only', base, '--', ...literalPaths(files)]).stdout));
  const restore = files.filter((f) => inBase.has(f)), remove = files.filter((f) => !inBase.has(f));
  if (restore.length) {
    const r = git(gitRestore, dir, [`--source=${base}`, '--staged', '--worktree', '--', ...literalPaths(restore)]);
    if (!r.ok) throw fail({ code: 'workflow-reset-failed' }, `git restore in ${dir}: ${r.stderr.slice(0, 200)}`);
  }
  if (remove.length) {
    const r = rmCached(dir, remove);
    if (!r.ok) throw fail({ code: 'workflow-reset-failed' }, `git rm --cached in ${dir}: ${r.stderr.slice(0, 200)}`);
    for (const f of remove) fs.rmSync(path.join(dir, f), { force: true });
  }
}

/* ------------------------------------------------------------ checkpoints */

/**
 * The checkpoint chain: the workflow branch's head must be the last checkpoint (the merge-base with main before the first one) - only
 * checkpointOp commits there. Throws workflow-foreign-commit naming the commits it did not make.
 */
function requireCheckpointChain(ctx, rec, workflowId) {
  const base = gateBaseOf(ctx, workflowId);
  const head = revParse(rec.path, 'HEAD');
  if (head === base) return base;
  const foreign = lines(git(revList, rec.path, ['--max-count=20', head, `^${base}`]).stdout);
  throw Object.assign(fail({ code: 'workflow-foreign-commit' }, `${rec.branch} carries ${foreign.length || 'a'} commit(s) the runtime did not make past its checkpoint ${base.slice(0, 12)} (${foreign.slice(0, 3).map((c) => c.slice(0, 12)).join(', ') || head.slice(0, 12)}): only checkpointOp commits on a workflow branch`), { commits: foreign });
}

function followCheckpoint(ctx, workflowId, sha) {
  if (wt(ctx).setCheckpoint(ctx, workflowId, sha) === false) throw fail({ code: 'workflow-worktree-missing' }, `workflow ${workflowId} has no live registry row to record checkpoint ${sha}`);
}
function requireReceiptScope(ctx, rec, receipt) {
  const leases = leasesOf(ctx, receipt);
  const { mine, stray } = splitChanges(rec.path, { own: receipt.scope, others: leases.others });
  const newer = [...mine, ...stray].filter((file) => !receipt.files.includes(file));
  if (newer.length) throw Object.assign(fail({ code: 'workflow-checkpoint-recovery-conflict' }, `newer files conflict with the prepared effect of ${receipt.opId}: ${newer.slice(0, 3).join(', ')}`), { files: newer });
}

/**
 * Commit a green op's changes on the workflow branch as the new checkpoint, then setCheckpoint. Nothing changed in its scope: the
 * checkpoint is the current head. {sha, committed, scope}
 */
export const checkpointOp = lockOperation(withWorkflowLock, checkpointOwned);
function checkpointOwned(ctx, { workflowId, opId }) {
  requireCompletedEffects(ctx, { workflowId, opId });
  const rec = recordOf(ctx, workflowId);
  requireOnBranch(rec);
  const head = revParse(rec.path, 'HEAD');
  if (!head) throw fail({ code: 'workflow-checkpoint-failed' }, `the workflow worktree ${rec.path} has no HEAD commit`);
  const state = receiptState(ctx, { workflowId, opId }, CHECKPOINT_EVENTS.checkpoint);
  if (state?.applied) {
    requireCheckpointChain(ctx, rec, workflowId);
    requireReceiptScope(ctx, rec, state.applied);
    requireReceiptBytes(rec, state.applied, [head], git);
    return publicReceipt(state.applied);
  }
  let receipt = state?.prepared;
  if (!receipt) {
    requireCheckpointChain(ctx, rec, workflowId);
    const leases = leasesOf(ctx, { workflowId, opId });
    const { mine, stray } = splitChanges(rec.path, leases);
    if (stray.length) throw Object.assign(fail({ code: 'workflow-foreign-change' }, `${rec.path} has ${stray.length} change(s) under no live op's leases (${stray.slice(0, 3).join(', ')}): a green op commits only its owned paths`), { files: stray.slice(0, 40) });
    const snap = snapshotFiles(rec.path, head, mine, `checkpoint ${workflowId}: ${opId}`);
    receipt = { ...(state?.identity ?? { workflowId, opId }), ...acceptedDecision(ctx), path: rec.path, branch: rec.branch, before: head, sha: snap.sha ?? head, committed: Boolean(snap.sha), scope: leases.own, files: mine };
    saveReceipt(ctx, CHECKPOINT_EVENTS.checkpoint, 'prepared', receipt);
  }
  if (head !== receipt.before && head !== receipt.sha) throw fail({ code: 'workflow-foreign-commit' }, `${rec.branch} moved outside the prepared checkpoint of ${opId}: ${head}`);
  requireReceiptScope(ctx, rec, receipt);
  requireReceiptBytes(rec, receipt, [receipt.sha], git);
  if (head !== receipt.sha) {
    const cas = updateRef(rec.path, `refs/heads/${rec.branch}`, receipt.sha, { message: `checkpoint ${opId}`, old: receipt.before });
    if (!cas.ok) throw fail({ code: 'workflow-checkpoint-failed' }, `${rec.branch} moved during the checkpoint of ${opId}: ${cas.stderr.slice(0, 200)}`);
  }
  phaseOf(ctx, 'branch-applied', receipt);
  if (receipt.files.length) {
    const idx = git(gitReset, rec.path, ['-q', receipt.sha, '--', ...literalPaths(receipt.files)]);
    if (!idx.ok) throw fail({ code: 'workflow-checkpoint-failed' }, `the index of ${rec.path} could not follow ${receipt.sha}: ${idx.stderr.slice(0, 200)}`);
  }
  phaseOf(ctx, 'index-applied', receipt);
  followCheckpoint(ctx, workflowId, receipt.sha);
  phaseOf(ctx, 'registry-applied', receipt);
  saveReceipt(ctx, CHECKPOINT_EVENTS.checkpoint, 'applied', receipt);
  return publicReceipt(receipt);
}

/**
 * A failed or blocked op: the changes under its owned paths, any change under no live op's leases and any foreign commit
 * past the checkpoint, kept as refs/heads/preserved/<workflowId>/<op>, then put back on the last checkpoint (files restored
 * from it or removed; ignored files and node_modules untouched; other live ops' files untouched).
 * {preservedRef|null, resetTo, sha|null}
 */
export const preserveAndReset = lockOperation(withWorkflowLock, preserveOwned);
function preserveOwned(ctx, { workflowId, opId }) {
  requireCompletedEffects(ctx, { workflowId, opId });
  const rec = recordOf(ctx, workflowId);
  requireOnBranch(rec);
  const head = revParse(rec.path, 'HEAD');
  const state = receiptState(ctx, { workflowId, opId }, CHECKPOINT_EVENTS.preserved);
  if (state?.applied) {
    requireCheckpointChain(ctx, rec, workflowId);
    requireReceiptScope(ctx, rec, state.applied);
    requireReceiptBytes(rec, state.applied, [head], git);
    return publicReceipt(state.applied);
  }
  const leases = leasesOf(ctx, { workflowId, opId });
  const answer = () => { const { mine, stray } = splitChanges(rec.path, leases); return [...mine, ...stray]; };
  let receipt = state?.prepared;
  if (!receipt) {
    const base = gateBaseOf(ctx, workflowId), files = answer();
    const snap = snapshotFiles(rec.path, head, files, `preserve ${workflowId}/${opId}: the work of a failed or blocked op`);
    const kept = snap.sha ?? head;
    const hasWork = kept !== base && git(gitDiff, rec.path, ['--quiet', base, kept]).status === 1;
    const committedFiles = head === base ? [] : lines(git(gitDiff, rec.path, ['--name-only', '--no-renames', base, head]).stdout).filter((f) => under(f, leases.own) || !under(f, leases.others));
    receipt = { ...(state?.identity ?? { workflowId, opId }), ...acceptedDecision(ctx), path: rec.path, branch: rec.branch, before: head, resetTo: base, preservedRef: hasWork ? `refs/heads/${PRESERVED_WORKFLOW_PREFIX}/${workflowId}/${opId}` : null,
      sha: hasWork ? kept : null, scope: leases.own, files: [...new Set([...files, ...committedFiles])] };
    saveReceipt(ctx, CHECKPOINT_EVENTS.preserved, 'prepared', receipt);
  }
  if (head !== receipt.before && head !== receipt.resetTo) throw fail({ code: 'workflow-foreign-commit' }, `${rec.branch} moved outside the prepared reset of ${opId}: ${head}`);
  requireReceiptScope(ctx, rec, receipt);
  requireReceiptBytes(rec, receipt, [receipt.sha ?? receipt.before, receipt.resetTo], git);
  if (receipt.preservedRef) {
    const u = updateRef(rec.path, receipt.preservedRef, receipt.sha);
    if (!u.ok) throw fail({ code: 'workflow-preserve-failed' }, `${receipt.preservedRef} could not be written: ${u.stderr.slice(0, 200)}`);
  }
  if (head !== receipt.resetTo) {
    // Foreign commits past the checkpoint: the branch goes back; their changes now show against HEAD and are reset below
    // with the op's own. Another op's files are untouched by a soft reset.
    const soft = git(gitReset, rec.path, ['--soft', receipt.resetTo]);
    if (!soft.ok) throw fail({ code: 'workflow-reset-failed' }, `${rec.branch} could not go back to ${receipt.resetTo}: ${soft.stderr.slice(0, 200)}`);
  }
  phaseOf(ctx, 'branch-applied', receipt);
  resetFiles(rec.path, receipt.resetTo, receipt.files);
  phaseOf(ctx, 'index-applied', receipt);
  const left = answer();
  if (left.length || revParse(rec.path, 'HEAD') !== receipt.resetTo) throw fail({ code: 'workflow-reset-failed' }, `${rec.path} is not back on ${receipt.resetTo}: ${left.slice(0, 3).join('; ') || 'HEAD moved'}`);
  saveReceipt(ctx, CHECKPOINT_EVENTS.preserved, 'applied', receipt);
  return publicReceipt(receipt);
}

/* ------------------------------------------------------------ rebase + finish */

/**
 * The workflow branch rebased onto main's tip in its worktree (a no-op when main is already in it). The tracked tree must be clean (no
 * op in flight); a conflict aborts the rebase and the branch stays where it was. The checkpoint follows the new head.
 * {ok, onto, head, already?} | {ok:false, code, onto, files?, detail?}
 */
export function rebaseWorkflow(ctx, args) {
  return withWorkflowLock(ctx, args, (locked) => applyWorkflowRebase(locked, args, { recordOf, requireOnBranch, git, revParse,
    followCheckpoint, noModules: NO_MODULES, identity: RUNTIME_IDENTITY }));
}
/** Resume only the same operation's durable rebase before interpreting its original checkpoint receipt. */
export function recoverWorkflowRebase(ctx, { workflowId, opId }) {
  if (pendingRebaseOf(ctx, workflowId)) return rebaseWorkflow(ctx, { workflowId, opId });
  const completed = completedRebaseOf(ctx, { workflowId, opId });
  return completed ? { ok: true, onto: completed.onto, head: completed.proposed, milestone: completed.milestone, recovered: true } : null;
}

/** The whole-branch gate: scripts/gates/gate.mjs over the worktree against `base`; its starci/gate@1 report. */
function runWorkflowGate({ root, base, timeoutMs = 1_800_000 }) {
  const run = runNode([GATE_SCRIPT, '--root', root, '--base', base], { cwd: root, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
  try { return JSON.parse(run.stdout); } catch { return { exit: 2, errors: [`gate.mjs printed no report (exit ${run.status ?? 'timeout'}): ${String(run.stderr || run.error?.message || '').trim().split(/\r?\n/).slice(-1)[0]}`], findings: [], counts: { new: 0 } }; }
}

/**
 * review.verify passed on what lands, pinned to the head (WFWT2 2.5): the workflow's last settled op is a succeeded
 * review.verify (no op settled after it); the head the runtime recorded at its settle (its workflow-checkpoint event: a
 * review.verify owns no path, so that checkpoint is the tree it verified) equals the head its report names (no op
 * checkpointed while it ran), and both equal the head that lands. {ok, jobId?, verifiedHead?, code?, detail?}
 */
export function reviewVerifiedOf(ctx, { workflowId, head }) {
  if (!ctx?.db?.prepare) return { ok: false, code: 'workflow-finish-verify-missing', detail: 'no ledger to read review.verify from' };
  const last = ctx.db.prepare("SELECT job_id, op_id, status FROM jobs WHERE workflow_id=? AND kind='op' AND status IN ('succeeded','failed') ORDER BY updated_at DESC, job_id DESC LIMIT 1").get(workflowId);
  if (!last) return { ok: false, code: 'workflow-finish-verify-missing', detail: `workflow ${workflowId} has no settled op` };
  if (last.op_id !== 'review.verify' || last.status !== 'succeeded') return { ok: false, code: 'workflow-finish-verify-missing', detail: `the last settled op is ${last.job_id} (${last.op_id} ${last.status}), not a passing review.verify` };
  const reported = ctx.db.prepare("SELECT json_extract(report_json,'$.head') AS head FROM reports WHERE job_id=? ORDER BY report_id DESC LIMIT 1").get(last.job_id)?.head ?? null;
  const settledAt = ctx.db.prepare("SELECT json_extract(payload_json,'$.sha') AS sha FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=? AND kind=? ORDER BY seq DESC LIMIT 1").get(workflowId, last.job_id, CHECKPOINT_EVENTS.checkpoint)?.sha ?? null;
  const stale = (detail) => ({ ok: false, code: 'workflow-finish-verify-stale', jobId: last.job_id, verifiedHead: settledAt ?? reported, detail });
  if (!settledAt) return stale(`the runtime recorded no checkpoint at the settle of review.verify ${last.job_id}: run review.verify again`);
  if (!reported || !settledAt.startsWith(reported)) return stale(`review.verify ${last.job_id} reported ${reported ?? 'no head'}, but the tree at its settle was ${settledAt}: an op checkpointed while it ran; run review.verify again`);
  if (settledAt !== head) return stale(`review.verify ${last.job_id} verified ${settledAt}, not the head ${head} that lands: run review.verify again`);
  return { ok: true, jobId: last.job_id, verifiedHead: settledAt };
}

function pushMain(repoRoot, main) {
  if (!git(gitRemote, repoRoot, ['get-url', 'origin']).ok) return { ok: true, pushed: false, skipped: 'no-origin' };
  const p = git(gitPush, repoRoot, ['origin', `refs/heads/${main}:refs/heads/${main}`]);
  return p.ok ? { ok: true, pushed: true } : { ok: false, pushed: false, detail: p.stderr.slice(-300) };
}

/** main compare-and-swap fast-forwarded to `head` (the live checkout's changed paths with it when main is checked out there). */
function fastForwardMain(ctx, { repoRoot, from, head }) {
  const main = mainOf(ctx);
  const checkedOut = symbolicRef(repoRoot) === `refs/heads/${main}`;
  if (!checkedOut) {
    const cas = updateRef(repoRoot, `refs/heads/${main}`, head, { message: `land wf ${head}`, old: from });
    return cas.ok ? { ok: true } : { ok: false, reason: 'main-moved', detail: cas.stderr.slice(0, 200) };
  }
  const rows = lines(git(gitDiff, repoRoot, ['--name-status', '--no-renames', from, head]).stdout).map((l) => l.split('\t'));
  return (ctx?.fastForward ?? fastForwardLive)({ root: repoRoot, base: from, head, rows });
}

/**
 * Land the workflow into main, in the design's order. Each step is recorded in steps[] ({step, ok, ...}); the first refusal
 * stops the sequence: {ok:false, steps, refusal: {step, code, detail, ...}}. main moves only at fast-forward, after the gate,
 * the guard, review.verify and the rebase; a rebase that moved the branch re-runs the gate on what lands. Idempotent: a
 * finish refused at push or later runs again from the top with nothing new to land.
 */
export const finishWorkflow = lockOperation(withWorkflowLock, finishOwned);
function finishOwned(ctx, { workflowId }) {
  const steps = [];
  const main = mainOf(ctx);
  const refuse = (step, code, detail, extra = {}) => { steps.push({ step, ok: false, code }); return { ok: false, steps, refusal: { step, code, detail, ...extra } }; };
  let rec;
  try { requireCompletedEffects(ctx, { workflowId, opId: null }); recoverWorkflowRebase(ctx, { workflowId, opId: null }); rec = recordOf(ctx, workflowId); requireOnBranch(rec); } catch (error) { return refuse('gate', error.code ?? 'workflow-worktree-missing', error.message); }
  const dir = rec.path;
  const repoRoot = mainRootOf(dir);
  const out = withLock(landLockName(repoRoot), () => {
    const gate = ctx?.gate ?? runWorkflowGate;
    const dirty = lines(git(gitStatus, dir, ['--porcelain', '--untracked-files=all', '--', '.', ...NO_MODULES]).stdout);
    if (dirty.length) return refuse('gate', 'workflow-finish-dirty', `${dir} has work no checkpoint carries: ${dirty.slice(0, 3).join('; ')}`, { files: dirty.slice(0, 20) });
    try { requireCheckpointChain(ctx, rec, workflowId); } catch (error) { return refuse('gate', 'workflow-foreign-commit', error.message, { commits: error.commits ?? [] }); }
    const gateOn = (step) => {
      const head = revParse(dir, 'HEAD');
      const base = mergeBase(dir, `refs/heads/${main}`, head) ?? '';
      const g = gate({ root: dir, base });
      const summary = { exit: g.exit, base, head, counts: g.counts ?? null, findings: (g.findings ?? []).slice(0, 40), errors: g.errors ?? [] };
      if (g.exit === 1) return refuse(step, 'workflow-finish-gate-red', `the whole branch ${rec.branch} has ${g.counts?.new ?? summary.findings.length} new finding(s) against ${main}`, { gate: summary });
      if (g.exit !== 0) return refuse(step, 'workflow-finish-gate-unavailable', `the gate could not run a tool: ${summary.errors[0] ?? 'no report'}`, { gate: summary });
      steps.push({ step, ok: true, base, head, counts: summary.counts });
      return null;
    };
    // 1. the full gate on the whole branch against its merge-base with main.
    const red = gateOn('gate');
    if (red) return red;
    // 2. the merge guard over the branch's own history.
    const tip = revParse(dir, `refs/heads/${main}`);
    const head = revParse(dir, 'HEAD');
    const guarded = (ctx?.guard ?? mergeGuard)(dir, { base: mergeBase(dir, tip, head) ?? '', head, mainTip: tip });
    if (guarded.errors?.length) return refuse('merge-guard', 'workflow-finish-guard-unavailable', `the merge guard could not recompute a merge: ${guarded.errors[0]}`);
    if (guarded.findings?.length) return refuse('merge-guard', 'workflow-finish-merge-dropped-main', `a merge on ${rec.branch} kept the lane side over main's change of ${guarded.findings.length} path(s)`, { paths: guarded.findings.slice(0, 40).map((f) => f.path) });
    steps.push({ step: 'merge-guard', ok: true, merges: (guarded.checked ?? []).length });
    // 3. review.verify passed on exactly this head.
    const verified = (ctx?.verify ?? reviewVerifiedOf)(ctx, { workflowId, head });
    if (!verified.ok && verified.code === 'workflow-finish-verify-stale') return refuse('review-verify', 'workflow-finish-verify-stale', verified.detail, { verifiedHead: verified.verifiedHead ?? null, head });
    if (!verified.ok) return refuse('review-verify', 'workflow-finish-verify-missing', verified.detail ?? 'no passing review.verify');
    steps.push({ step: 'review-verify', ok: true, jobId: verified.jobId ?? null, head });
    // 4. rebase onto main's tip. A rebase that moves the head lands nothing: the new head is gated and reviewed again first.
    const rebased = rebaseWorkflow(ctx, { workflowId });
    if (rebased.code === 'workflow-rebase-conflict') return refuse('rebase', 'workflow-finish-rebase-conflict', `${rec.branch} conflicts with ${main} on ${rebased.files.slice(0, 3).join(', ')}`, { files: rebased.files });
    if (!rebased.ok) return refuse('rebase', 'workflow-finish-rebase-failed', rebased.detail ?? `${rec.branch} does not rebase onto ${main}`, { files: rebased.files ?? [] });
    if (!rebased.already) {
      const again = gateOn('gate');
      if (again) return again;
      return refuse('rebase', 'workflow-finish-verify-stale', `the rebase onto ${main} moved ${rec.branch} from ${head} to ${rebased.head}: run review.verify on the new head, then finish again`, { verifiedHead: head, head: rebased.head });
    }
    steps.push({ step: 'rebase', ok: true, onto: rebased.onto, head: rebased.head, already: true });
    // 5. main fast-forwarded (compare-and-swap), then pushed.
    const from = revParse(repoRoot, `refs/heads/${main}`);
    if (from !== rebased.onto) return refuse('fast-forward', 'workflow-finish-main-moved', `${main} moved from ${rebased.onto} to ${from} during the finish: run the finish again`);
    if (from !== rebased.head) {
      const ff = fastForwardMain(ctx, { repoRoot, from, head: rebased.head });
      if (ff.reason === 'main-moved') return refuse('fast-forward', 'workflow-finish-main-moved', `${main} moved during the fast-forward: run the finish again`);
      if (!ff.ok) return refuse('fast-forward', 'workflow-finish-main-refused', `${main} could not be fast-forwarded: ${ff.reason ?? ''} ${ff.detail ?? ''}`.trim(), { dirty: ff.dirty ?? null });
    }
    steps.push({ step: 'fast-forward', ok: true, before: from, after: rebased.head });
    const pushed = (ctx?.push ?? pushMain)(repoRoot, main);
    if (!pushed.ok) return refuse('push', 'workflow-finish-push-failed', `${main} is advanced but its push failed: ${pushed.detail ?? ''}`);
    steps.push({ step: 'push', ok: true, pushed: Boolean(pushed.pushed), ...(pushed.skipped ? { skipped: pushed.skipped } : {}) });
    // 6. the worktree marked release-pending: the finish runs inside it (the Kernel's own terminal), so it never removes it;
    // part A's GC removes it (link check, orca worktree rm) and deletes the workflow branch once the Kernel has left.
    let pending;
    try { pending = wt(ctx).markReleasePending(ctx, workflowId) ?? { ok: true }; } catch (error) { pending = { ok: false, detail: String(error?.message ?? error) }; }
    if (pending === false || pending.ok === false) return refuse('release-pending', 'workflow-finish-release-pending-failed', `main is landed but ${dir} was not marked release-pending: ${pending?.detail ?? pending?.reason ?? ''}`.trim());
    steps.push({ step: 'release-pending', ok: true });
    return { ok: true, landed: true, releasePending: true, steps, head: rebased.head, main, repoRoot };
  }, { waitMs: ctx?.lockWaitMs ?? 1_800_000, env: ctx?.env ?? process.env });
  return out.reason === 'lock-busy' ? refuse('gate', 'workflow-finish-lock-busy', `another land into ${repoRoot} holds ${out.lock}`) : out;
}
