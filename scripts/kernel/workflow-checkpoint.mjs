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
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runGit } from '../api/git/lib.mjs';
import { mainRootOf } from '../api/git/worktree-list.mjs';
import { TERMINAL_JOB_STATUSES } from '../lib/worktree-registry.mjs';
import { mergeGuard } from '../checks/gate.mjs';
import { fastForwardLive } from '../supervisor/land.mjs';
import { claimManager } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { workflowWorktreeOf, workflowWorktreeAt, setCheckpoint, markReleasePending } from './workflow-worktree.mjs';
import { normalizeOwnedPath } from '../../engine/admission.mjs';
import { ownedPathsOf } from './api-lib/rows.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'checks', 'gate.mjs');
export const PRESERVED_WORKFLOW_PREFIX = 'preserved';
export const FINISH_STEPS = Object.freeze(['gate', 'merge-guard', 'review-verify', 'rebase', 'fast-forward', 'push', 'release-pending']);
export const CHECKPOINT_EVENTS = Object.freeze({ checkpoint: 'workflow-checkpoint', preserved: 'workflow-op-preserved', landed: 'workflow-landed' });
const RUNTIME_IDENTITY = ['-c', 'user.name=starci', '-c', 'user.email=runtime@starci.local'];
const NO_MODULES = [':(exclude,glob)**/node_modules', ':(exclude,glob)**/node_modules/**'];
const SHA = /^[0-9a-f]{40,64}$/;

/* ------------------------------------------------------------ plumbing */

/** Hold the named host lock around fn (poll until waitMs). {ok:false, reason:'lock-busy', lock, holder} when it never frees. */
function withLock(name, fn, { waitMs = 600_000, pollMs = 1000, env = process.env } = {}) {
  const end = Date.now() + waitMs;
  for (;;) {
    const held = claimManager(name, { env });
    if (held.ok) { try { return fn(); } finally { held.release(); } }
    if (Date.now() >= end) return { ok: false, reason: 'lock-busy', lock: name, holder: held.holder ?? null };
    sleepSync(pollMs);
  }
}
/** The per-repository land lock: one workflow lands into a repository's main at a time. */
export const landLockName = (repoRoot) => `product-land-${crypto.createHash('sha1').update(String(path.resolve(repoRoot)).replace(/\\/g, '/').toLowerCase()).digest('hex').slice(0, 10)}`;

const fail = ({ code }, message) => Object.assign(new Error(message), { code });
function git(cwd, args, { env = null, timeout = 600_000, input } = {}) {
  const r = runGit(args, { cwd, timeout, input, env: env ? { ...process.env, ...env } : process.env, maxBuffer: 256 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
}
const revParse = (cwd, ref) => { const r = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return r.ok && SHA.test(r.stdout) ? r.stdout : null; };
const isAncestor = (cwd, a, b) => git(cwd, ['merge-base', '--is-ancestor', a, b]).ok;
const lines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);
const mainOf = (ctx) => ctx?.main ?? 'main';
/** Part A's functions: ctx.worktree in a spec, the module itself in the runtime. */
const wt = (ctx) => ({ workflowWorktreeOf, workflowWorktreeAt, setCheckpoint, markReleasePending, TERMINAL_JOB_STATUSES, ...(ctx?.worktree ?? {}) });

/** The registry row of the workflow's worktree, its directory present: {workflowId, orcaWorktreeId, path, branch, checkpoint}. */
function recordOf(ctx, workflowId) {
  const rec = wt(ctx).workflowWorktreeOf(ctx, workflowId);
  if (!rec) throw fail({ code: 'workflow-worktree-missing' }, `workflow ${workflowId} has no workflow worktree in the registry`);
  if (!rec.path || !fs.existsSync(rec.path)) throw fail({ code: 'workflow-worktree-missing' }, `the worktree of workflow ${workflowId} (${rec.path ?? '-'}) is gone`);
  if (!rec.branch) throw fail({ code: 'workflow-worktree-missing' }, `the registry records no branch for the worktree of workflow ${workflowId} (${rec.path})`);
  return rec;
}
/** The branch the worktree is on must be the workflow branch: a checkpoint never lands on another branch. */
function requireOnBranch(rec) {
  const head = git(rec.path, ['symbolic-ref', '-q', 'HEAD']).stdout;
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
 * `others`, the owned paths of every other op of the workflow still occupying the tree (part A's TERMINAL_JOB_STATUSES, scripts/lib/worktree-registry.mjs).
 */
export function leasesOf(ctx, { workflowId, opId }) {
  const row = ctx?.db?.prepare?.('SELECT job_id, payload_json FROM jobs WHERE job_id=?').get(opId) ?? null;
  if (!row) return { own: ['.'], others: [] };
  const statuses = wt(ctx).TERMINAL_JOB_STATUSES;
  const live = ctx.db.prepare(`SELECT job_id, payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND job_id<>? AND status IN (${statuses.map(() => '?').join(',')})`).all(workflowId, opId, ...statuses);
  return { own: ownedOf(row.payload_json), others: live.flatMap((r) => ownedOf(r.payload_json)) };
}
const under = (file, owned) => owned.some((o) => o === '.' || file === o || file.startsWith(`${o}/`));
const literal = (files) => files.map((f) => `:(literal)${f}`);
const zlist = (text) => String(text ?? '').split('\0').map((l) => l.trim()).filter(Boolean);
/** Every path of the worktree that differs from HEAD: tracked changes (staged or not, deletions included) and untracked files. */
function changedFiles(dir) {
  const tracked = git(dir, ['diff', '--name-only', '--no-renames', '-z', 'HEAD', '--', '.', ...NO_MODULES]);
  const untracked = git(dir, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...NO_MODULES]);
  if (!tracked.ok || !untracked.ok) throw fail({ code: 'workflow-snapshot-failed' }, `the changes of ${dir} could not be listed: ${(tracked.stderr || untracked.stderr).slice(0, 200)}`);
  return [...new Set([...zlist(tracked.stdout), ...zlist(untracked.stdout)])].sort();
}
/** The changed files an op answers for: `mine` under its owned paths, `stray` under no live op's leases at all. */
function splitChanges(dir, { own, others }) {
  const files = changedFiles(dir);
  return { mine: files.filter((f) => under(f, own)), stray: files.filter((f) => !under(f, own) && !under(f, others)) };
}

/**
 * `files` as they are in the working tree, committed on `parent` through a temporary index (the worktree's own index and
 * files are untouched; node_modules is never staged). {tree, sha|null}: sha null when nothing differs from the parent.
 */
function snapshotFiles(dir, parent, files, message) {
  if (!files.length) return { tree: null, sha: null };
  const index = path.join(os.tmpdir(), `starci-wf-${process.pid}-${crypto.randomBytes(4).toString('hex')}.index`);
  const env = { GIT_INDEX_FILE: index };
  try {
    for (const args of [['read-tree', parent], ['add', '-A', '--', ...literal(files)]]) {
      const r = git(dir, args, { env });
      if (!r.ok) throw fail({ code: 'workflow-snapshot-failed' }, `git ${args.slice(0, 2).join(' ')} in ${dir}: ${r.stderr.slice(0, 200)}`);
    }
    const tree = git(dir, ['write-tree'], { env }).stdout;
    if (!SHA.test(tree)) throw fail({ code: 'workflow-snapshot-failed' }, `git write-tree in ${dir} printed no tree`);
    if (tree === git(dir, ['rev-parse', `${parent}^{tree}`]).stdout) return { tree, sha: null };
    const sha = git(dir, [...RUNTIME_IDENTITY, 'commit-tree', tree, '-p', parent, '-m', message]).stdout;
    if (!SHA.test(sha)) throw fail({ code: 'workflow-snapshot-failed' }, `git commit-tree in ${dir} printed no commit`);
    return { tree, sha };
  } finally { try { fs.rmSync(index, { force: true }); } catch { /* temp */ } }
}

/** `files` put back as they are at `base`: restored when base has them, removed (index and disk) when it does not. */
function resetFiles(dir, base, files) {
  if (!files.length) return;
  const inBase = new Set(zlist(git(dir, ['ls-tree', '-r', '-z', '--name-only', base, '--', ...literal(files)]).stdout));
  const restore = files.filter((f) => inBase.has(f)), remove = files.filter((f) => !inBase.has(f));
  if (restore.length) {
    const r = git(dir, ['restore', `--source=${base}`, '--staged', '--worktree', '--', ...literal(restore)]);
    if (!r.ok) throw fail({ code: 'workflow-reset-failed' }, `git restore in ${dir}: ${r.stderr.slice(0, 200)}`);
  }
  if (remove.length) {
    const r = git(dir, ['rm', '--cached', '-q', '--ignore-unmatch', '--', ...literal(remove)]);
    if (!r.ok) throw fail({ code: 'workflow-reset-failed' }, `git rm --cached in ${dir}: ${r.stderr.slice(0, 200)}`);
    for (const f of remove) fs.rmSync(path.join(dir, f), { force: true });
  }
}

/* ------------------------------------------------------------ checkpoints */

/**
 * The checkpoint chain: the workflow branch's head must be the last checkpoint (the merge-base with main before the first one) - only
 * checkpointOp commits there. Throws workflow-foreign-commit naming the commits it did not make.
 */
export function requireCheckpointChain(ctx, rec, workflowId) {
  const base = gateBaseOf(ctx, workflowId);
  const head = revParse(rec.path, 'HEAD');
  if (head === base) return base;
  const foreign = lines(git(rec.path, ['rev-list', '--max-count=20', head, `^${base}`]).stdout);
  throw Object.assign(fail({ code: 'workflow-foreign-commit' }, `${rec.branch} carries ${foreign.length || 'a'} commit(s) the runtime did not make past its checkpoint ${base.slice(0, 12)} (${foreign.slice(0, 3).map((c) => c.slice(0, 12)).join(', ') || head.slice(0, 12)}): only checkpointOp commits on a workflow branch`), { commits: foreign });
}

/**
 * The gate base of the workflow worktree that holds `dir` (part A's workflowWorktreeAt over the registry), or null when
 * `dir` is no workflow worktree: scripts/checks/gate.mjs measures an op there against its previous checkpoint.
 */
export function gateBaseAt(ctx, dir) {
  const rec = wt(ctx).workflowWorktreeAt(ctx, dir);
  return rec ? gateBaseOf(ctx, rec.workflowId) : null;
}

/** The base an op's gate measures against: the previous checkpoint, else the merge-base of the workflow branch with main. */
export function gateBaseOf(ctx, workflowId) {
  const rec = recordOf(ctx, workflowId);
  if (rec.checkpoint) {
    const sha = revParse(rec.path, rec.checkpoint);
    if (!sha) throw fail({ code: 'workflow-gate-base-unknown' }, `the checkpoint ${rec.checkpoint} of workflow ${workflowId} is not a commit of ${rec.path}`);
    return sha;
  }
  const base = git(rec.path, ['merge-base', `refs/heads/${mainOf(ctx)}`, 'HEAD']).stdout;
  if (!SHA.test(base)) throw fail({ code: 'workflow-gate-base-unknown' }, `workflow ${workflowId} has no checkpoint and ${rec.branch} has no merge-base with ${mainOf(ctx)}`);
  return base;
}

/**
 * Commit a green op's changes on the workflow branch as the new checkpoint, then setCheckpoint. Nothing changed in its scope: the
 * checkpoint is the current head. {sha, committed, scope}
 */
export function checkpointOp(ctx, { workflowId, opId }) {
  const rec = recordOf(ctx, workflowId);
  requireOnBranch(rec);
  const head = revParse(rec.path, 'HEAD');
  if (!head) throw fail({ code: 'workflow-checkpoint-failed' }, `the workflow worktree ${rec.path} has no HEAD commit`);
  requireCheckpointChain(ctx, rec, workflowId);
  const leases = leasesOf(ctx, { workflowId, opId });
  const { mine, stray } = splitChanges(rec.path, leases);
  if (stray.length) throw Object.assign(fail({ code: 'workflow-foreign-change' }, `${rec.path} has ${stray.length} change(s) under no live op's leases (${stray.slice(0, 3).join(', ')}): a green op commits only its owned paths`), { files: stray.slice(0, 40) });
  const snap = snapshotFiles(rec.path, head, mine, `checkpoint ${workflowId}: ${opId}`);
  let sha = head;
  if (snap.sha) {
    const cas = git(rec.path, ['update-ref', '-m', `checkpoint ${opId}`, `refs/heads/${rec.branch}`, snap.sha, head]);
    if (!cas.ok) throw fail({ code: 'workflow-checkpoint-failed' }, `${rec.branch} moved during the checkpoint of ${opId}: ${cas.stderr.slice(0, 200)}`);
    // The worktree's index follows the new commit for the scope only; the files already are the commit's.
    const idx = git(rec.path, ['reset', '-q', snap.sha, '--', ...literal(mine)]);
    if (!idx.ok) throw fail({ code: 'workflow-checkpoint-failed' }, `the index of ${rec.path} could not follow ${snap.sha}: ${idx.stderr.slice(0, 200)}`);
    sha = snap.sha;
  }
  wt(ctx).setCheckpoint(ctx, workflowId, sha);
  return { sha, committed: Boolean(snap.sha), scope: leases.own, files: mine };
}

/**
 * A failed or blocked op: the changes under its owned paths, any change under no live op's leases and any foreign commit
 * past the checkpoint, kept as refs/heads/preserved/<workflowId>/<op>, then put back on the last checkpoint (files restored
 * from it or removed; ignored files and node_modules untouched; other live ops' files untouched).
 * {preservedRef|null, resetTo, sha|null}
 */
export function preserveAndReset(ctx, { workflowId, opId }) {
  const rec = recordOf(ctx, workflowId);
  requireOnBranch(rec);
  const base = gateBaseOf(ctx, workflowId);
  const head = revParse(rec.path, 'HEAD');
  const leases = leasesOf(ctx, { workflowId, opId });
  const answer = () => { const { mine, stray } = splitChanges(rec.path, leases); return [...mine, ...stray]; };
  const snap = snapshotFiles(rec.path, head, answer(), `preserve ${workflowId}/${opId}: the work of a failed or blocked op`);
  const kept = snap.sha ?? head;
  const hasWork = kept !== base && git(rec.path, ['diff', '--quiet', base, kept]).status === 1;
  let preservedRef = null;
  if (hasWork) {
    preservedRef = `refs/heads/${PRESERVED_WORKFLOW_PREFIX}/${workflowId}/${opId}`;
    const u = git(rec.path, ['update-ref', preservedRef, kept]);
    if (!u.ok) throw fail({ code: 'workflow-preserve-failed' }, `${preservedRef} could not be written: ${u.stderr.slice(0, 200)}`);
  }
  if (head !== base) {
    // Foreign commits past the checkpoint: the branch goes back; their changes now show against HEAD and are reset below
    // with the op's own. Another op's files are untouched by a soft reset.
    const soft = git(rec.path, ['reset', '--soft', base]);
    if (!soft.ok) throw fail({ code: 'workflow-reset-failed' }, `${rec.branch} could not go back to ${base}: ${soft.stderr.slice(0, 200)}`);
  }
  resetFiles(rec.path, base, answer());
  const left = answer();
  if (left.length || revParse(rec.path, 'HEAD') !== base) throw fail({ code: 'workflow-reset-failed' }, `${rec.path} is not back on ${base}: ${left.slice(0, 3).join('; ') || 'HEAD moved'}`);
  return { preservedRef, resetTo: base, sha: hasWork ? kept : null };
}

/* ------------------------------------------------------------ rebase + finish */

const conflictFiles = (dir) => lines(git(dir, ['diff', '--name-only', '--diff-filter=U']).stdout).slice(0, 20);

/**
 * The workflow branch rebased onto main's tip in its worktree (a no-op when main is already in it). The tracked tree must be clean (no
 * op in flight); a conflict aborts the rebase and the branch stays where it was. The checkpoint follows the new head.
 * {ok, onto, head, already?} | {ok:false, code, onto, files?, detail?}
 */
export function rebaseWorkflow(ctx, { workflowId }) {
  const rec = recordOf(ctx, workflowId);
  requireOnBranch(rec);
  const main = mainOf(ctx);
  const onto = revParse(rec.path, `refs/heads/${main}`);
  if (!onto) return { ok: false, code: 'workflow-rebase-failed', onto: null, detail: `${main} does not resolve in ${rec.path}` };
  const before = revParse(rec.path, 'HEAD');
  if (isAncestor(rec.path, onto, before)) return { ok: true, onto, head: before, already: true };
  const dirty = lines(git(rec.path, ['status', '--porcelain', '--untracked-files=no', '--', '.', ...NO_MODULES]).stdout);
  if (dirty.length) return { ok: false, code: 'workflow-rebase-dirty', onto, files: dirty.slice(0, 20) };
  const r = git(rec.path, [...RUNTIME_IDENTITY, 'rebase', '--no-autostash', onto]);
  if (!r.ok) {
    const files = conflictFiles(rec.path);
    git(rec.path, ['rebase', '--abort']);
    if (files.length) return { ok: false, code: 'workflow-rebase-conflict', onto, files, detail: r.stderr.slice(-300) };
    return { ok: false, code: 'workflow-rebase-failed', onto, files, detail: r.stderr.slice(-300) };
  }
  const head = revParse(rec.path, 'HEAD');
  wt(ctx).setCheckpoint(ctx, workflowId, head);
  return { ok: true, onto, head };
}

/** The whole-branch gate: scripts/checks/gate.mjs over the worktree against `base`; its starci/gate@1 report. */
export function runWorkflowGate({ root, base, timeoutMs = 1_800_000 }) {
  const run = spawnSync(process.execPath, [GATE_SCRIPT, '--root', root, '--base', base], { cwd: root, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  try { return JSON.parse(run.stdout); } catch { return { exit: 2, errors: [`gate.mjs printed no report (exit ${run.status ?? 'timeout'}): ${String(run.stderr || run.error?.message || '').trim().split(/\r?\n/).slice(-1)[0]}`], findings: [], counts: { new: 0 } }; }
}

/**
 * review.verify passed on what lands: the workflow's last settled op is a succeeded review.verify (no op settled after it),
 * and the head its report names is the head that lands. {ok, jobId?, verifiedHead?, code?, detail?}
 */
export function reviewVerifiedOf(ctx, { workflowId, head }) {
  if (!ctx?.db?.prepare) return { ok: false, code: 'workflow-finish-verify-missing', detail: 'no ledger to read review.verify from' };
  const last = ctx.db.prepare("SELECT job_id, op_id, status FROM jobs WHERE workflow_id=? AND kind='op' AND status IN ('succeeded','failed') ORDER BY updated_at DESC, job_id DESC LIMIT 1").get(workflowId);
  if (!last) return { ok: false, code: 'workflow-finish-verify-missing', detail: `workflow ${workflowId} has no settled op` };
  if (last.op_id !== 'review.verify' || last.status !== 'succeeded') return { ok: false, code: 'workflow-finish-verify-missing', detail: `the last settled op is ${last.job_id} (${last.op_id} ${last.status}), not a passing review.verify` };
  const verifiedHead = ctx.db.prepare("SELECT json_extract(report_json,'$.head') AS head FROM reports WHERE job_id=? ORDER BY report_id DESC LIMIT 1").get(last.job_id)?.head ?? null;
  if (!verifiedHead || verifiedHead !== head) return { ok: false, code: 'workflow-finish-verify-stale', jobId: last.job_id, verifiedHead, detail: `review.verify ${last.job_id} verified ${verifiedHead ?? 'no head'}, not the head ${head} that lands: run review.verify again` };
  return { ok: true, jobId: last.job_id, verifiedHead };
}

function pushMain(repoRoot, main) {
  if (!git(repoRoot, ['remote', 'get-url', 'origin']).ok) return { ok: true, pushed: false, skipped: 'no-origin' };
  const p = git(repoRoot, ['push', 'origin', `refs/heads/${main}:refs/heads/${main}`]);
  return p.ok ? { ok: true, pushed: true } : { ok: false, pushed: false, detail: p.stderr.slice(-300) };
}

/** main compare-and-swap fast-forwarded to `head` (the live checkout's changed paths with it when main is checked out there). */
function fastForwardMain(ctx, { repoRoot, from, head }) {
  const main = mainOf(ctx);
  const checkedOut = git(repoRoot, ['symbolic-ref', '-q', 'HEAD']).stdout === `refs/heads/${main}`;
  if (!checkedOut) {
    const cas = git(repoRoot, ['update-ref', '-m', `land wf ${head}`, `refs/heads/${main}`, head, from]);
    return cas.ok ? { ok: true } : { ok: false, reason: 'main-moved', detail: cas.stderr.slice(0, 200) };
  }
  const rows = lines(git(repoRoot, ['diff', '--name-status', '--no-renames', from, head]).stdout).map((l) => l.split('\t'));
  return (ctx?.fastForward ?? fastForwardLive)({ root: repoRoot, base: from, head, rows });
}

/**
 * Land the workflow into main, in the design's order. Each step is recorded in steps[] ({step, ok, ...}); the first refusal
 * stops the sequence: {ok:false, steps, refusal: {step, code, detail, ...}}. main moves only at fast-forward, after the gate,
 * the guard, review.verify and the rebase; a rebase that moved the branch re-runs the gate on what lands. Idempotent: a
 * finish refused at push or later runs again from the top with nothing new to land.
 */
export function finishWorkflow(ctx, { workflowId }) {
  const steps = [];
  const main = mainOf(ctx);
  const refuse = (step, code, detail, extra = {}) => { steps.push({ step, ok: false, code }); return { ok: false, steps, refusal: { step, code, detail, ...extra } }; };
  let rec;
  try { rec = recordOf(ctx, workflowId); requireOnBranch(rec); } catch (error) { return refuse('gate', error.code ?? 'workflow-worktree-missing', error.message); }
  const dir = rec.path;
  const repoRoot = mainRootOf(dir);
  const out = withLock(landLockName(repoRoot), () => {
    const gate = ctx?.gate ?? runWorkflowGate;
    const dirty = lines(git(dir, ['status', '--porcelain', '--untracked-files=all', '--', '.', ...NO_MODULES]).stdout);
    if (dirty.length) return refuse('gate', 'workflow-finish-dirty', `${dir} has work no checkpoint carries: ${dirty.slice(0, 3).join('; ')}`, { files: dirty.slice(0, 20) });
    try { requireCheckpointChain(ctx, rec, workflowId); } catch (error) { return refuse('gate', 'workflow-foreign-commit', error.message, { commits: error.commits ?? [] }); }
    const gateOn = (step) => {
      const head = revParse(dir, 'HEAD');
      const base = git(dir, ['merge-base', `refs/heads/${main}`, head]).stdout;
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
    const guarded = (ctx?.guard ?? mergeGuard)(dir, { base: git(dir, ['merge-base', tip, head]).stdout, head, mainTip: tip });
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
