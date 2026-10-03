// A workflow rebase proposes in a detached internal scratch tree, then applies one durable SQLite intent.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { rebase as gitRebase } from '../api/git/rebase.mjs';
import { reset as gitReset } from '../api/git/reset.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { statusQuery as gitStatus } from '../api/git/status-query.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { lsTree } from '../api/git/ls-tree.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { createScratchWorktree, removeScratchWorktree } from '../machine/worktree-git.mjs';
import { landRoot } from '../machine/home.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { literalPaths, pendingRebaseOf, phaseOf, requireCompletedEffects, requireReceiptBytes, saveRebase } from './workflow-checkpoint-state.mjs';

const fail = ({ code }, message) => Object.assign(new Error(message), { code });
const lines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);

/** A hard reset may replace a directory with a file; private untracked bytes must survive that application. */
function requireUntrackedSafe(rec, receipt, git) {
  if (!receipt.files.length) return;
  const query = (call, args) => {
    const result = git(call, rec.path, args);
    if (!result.ok) throw fail({ code: 'workflow-rebase-failed' }, `the prepared rebase cannot inspect untracked obstructions: ${result.stderr.slice(0, 200)}`);
    return result.stdout.split('\0').filter(Boolean);
  };
  const targets = query(lsTree, ['-r', '--name-only', '-z', receipt.proposed, '--', ...literalPaths(receipt.files)]);
  const targetKeys = targets.map((file) => pathKey(path.resolve(rec.path, file)));
  const collides = (file) => { const key = pathKey(path.resolve(rec.path, file)); return targetKeys.some((target) => key === target || key.startsWith(`${target}/`) || target.startsWith(`${key}/`)); };
  const possible = query(lsFiles, ['--others', '--directory', '--no-empty-directory', '-z']).filter((file) => collides(file.replace(/\/$/, '')));
  const dirs = possible.filter((file) => file.endsWith('/'));
  const leaves = possible.filter((file) => !file.endsWith('/'));
  if (dirs.length) leaves.push(...query(lsFiles, ['--others', '-z', '--', ...literalPaths(dirs)]));
  const tracked = new Set(query(lsFiles, ['--cached', '-z']).map((file) => pathKey(path.resolve(rec.path, file))));
  const leaf = (full) => { if (!tracked.has(pathKey(full))) leaves.push(path.relative(rec.path, full).split(path.sep).join('/')); };
  try {
    const root = fs.lstatSync(rec.path);
    if (!root.isDirectory() || isLinkLike(rec.path, { stat: root })) throw new Error('the registered workflow root is not a plain directory');
    for (const target of targets) {
      const parts = target.split('/');
      let full = rec.path;
      for (let i = 0; i < parts.length; i++) {
        full = path.join(full, parts[i]);
        const stat = fs.lstatSync(full, { throwIfNoEntry: false });
        if (!stat) break;
        if (isLinkLike(full, { stat }) || !stat.isDirectory()) { leaf(full); break; }
        if (i !== parts.length - 1) continue;
        const found = walkFiles(full, { exclude: (_name, entry) => {
          if (!isLinkLike(entry, { stat: fs.lstatSync(entry) })) return false;
          leaf(entry);
          return true;
        } });
        found.forEach(leaf);
      }
    }
  } catch (error) { throw fail({ code: 'workflow-rebase-failed' }, `the prepared rebase cannot inspect actual obstruction paths: ${String(error.message).slice(0, 200)}`); }
  const files = [...new Set(leaves.filter(collides))];
  if (files.length) throw Object.assign(fail({ code: 'workflow-checkpoint-recovery-conflict' }, `untracked files obstruct the prepared rebase: ${files.slice(0, 3).join(', ')}`), { files });
}

/** Compute an exact replayed SHA without moving the workflow branch, index or working files. */
function propose(ctx, rec, { workflowId, opId, before, onto }, api) {
  const env = ctx?.env ?? process.env, root = landRoot(env);
  fs.mkdirSync(root, { recursive: true });
  const parent = path.join(root, `workflow-rebase-${crypto.randomUUID()}`), scratch = path.join(parent, 'tree');
  let result;
  try {
    const made = createScratchWorktree({ repoRoot: rec.path, dir: scratch, kind: 'land-scratch', detach: true, base: before,
      owner: { workflowId, jobId: opId, ledgerId: ctx?.ledger?.ledgerId }, env });
    if (!made.ok) return { ok: false, code: 'workflow-rebase-failed', onto, detail: made.detail ?? made.reason };
    const run = api.git(gitRebase, scratch, ['--no-autostash', onto], { config: api.identity });
    if (run.ok) result = { ok: true, head: api.revParse(scratch, 'HEAD') };
    else {
      const files = lines(api.git(gitDiff, scratch, ['--name-only', '--diff-filter=U']).stdout).slice(0, 20);
      api.git(gitRebase, scratch, ['--abort']);
      result = { ok: false, code: files.length ? 'workflow-rebase-conflict' : 'workflow-rebase-failed', onto, files, detail: run.stderr.slice(-300) };
    }
  } finally {
    const removed = removeScratchWorktree({ repoRoot: rec.path, dir: scratch, env });
    if (!removed.ok) throw fail({ code: 'workflow-rebase-failed' }, `the detached rebase scratch could not be safely removed: ${removed.reason}`);
    try { fs.rmdirSync(parent); } catch { /* empty parent is collected later */ }
  }
  return result;
}

/** Called under the same workflow lock as checkpoint acceptance and finish. */
export function applyWorkflowRebase(ctx, { workflowId, opId = null, milestone = null }, api) {
  requireCompletedEffects(ctx, { workflowId, opId });
  const rec = api.recordOf(ctx, workflowId);
  api.requireOnBranch(rec);
  let receipt = pendingRebaseOf(ctx, workflowId);
  const recovering = Boolean(receipt);
  if (receipt && receipt.opId !== opId) throw fail({ code: 'workflow-checkpoint-recovery-required' }, `workflow ${workflowId} must recover the rebase of ${receipt.opId ?? 'finish'} before another operation`);
  if (!receipt) {
    const onto = api.revParse(rec.path, `refs/heads/${ctx?.main ?? 'main'}`), before = api.revParse(rec.path, 'HEAD');
    if (!onto) return { ok: false, code: 'workflow-rebase-failed', onto: null, detail: `${ctx?.main ?? 'main'} does not resolve in ${rec.path}` };
    if (isAncestor(rec.path, onto, before)) return { ok: true, onto, head: before, already: true };
    const dirty = lines(api.git(gitStatus, rec.path, ['--porcelain', '--untracked-files=no', '--', '.', ...api.noModules]).stdout);
    if (dirty.length) return { ok: false, code: 'workflow-rebase-dirty', onto, files: dirty.slice(0, 20) };
    const proposal = propose(ctx, rec, { workflowId, opId, before, onto }, api);
    if (!proposal.ok) return proposal;
    const attempt = opId && ctx?.db?.prepare ? ctx.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE workflow_id=? AND job_id=? ORDER BY attempt_id DESC LIMIT 1').get(workflowId, opId) : null;
    receipt = { workflowId, opId, attemptId: attempt?.attempt_id ?? null, dispatchId: attempt?.dispatch_id ?? null,
      path: rec.path, branch: rec.branch, before, proposed: proposal.head, sha: proposal.head, onto, milestone, scope: ['.'],
      files: lines(api.git(gitDiff, rec.path, ['--name-only', '--no-renames', before, proposal.head]).stdout) };
    requireUntrackedSafe(rec, receipt, api.git);
    saveRebase(ctx, 'prepared', receipt);
  }
  try {
    const head = api.revParse(rec.path, 'HEAD');
    if (head !== receipt.before && head !== receipt.proposed) throw fail({ code: 'workflow-foreign-commit' }, `${rec.branch} moved outside its prepared rebase: ${head}`);
    const dirty = lines(api.git(gitDiff, rec.path, ['--name-only', '--no-renames', 'HEAD', '--', '.', ...api.noModules]).stdout).filter((file) => !receipt.files.includes(file));
    if (dirty.length) throw fail({ code: 'workflow-checkpoint-recovery-conflict' }, `newer edits outside the prepared rebase are held: ${dirty.slice(0, 3).join(', ')}`);
    requireUntrackedSafe(rec, receipt, api.git);
    requireReceiptBytes(rec, receipt, [receipt.before, receipt.proposed], api.git);
    if (head !== receipt.proposed) {
      const moved = updateRef(rec.path, `refs/heads/${rec.branch}`, receipt.proposed, { old: receipt.before, message: `rebase workflow ${workflowId}` });
      if (!moved.ok) throw fail({ code: 'workflow-rebase-failed' }, `the prepared rebase could not move ${rec.branch}: ${moved.stderr.slice(0, 200)}`);
    }
    phaseOf(ctx, 'rebase-branch-applied', receipt);
    requireUntrackedSafe(rec, receipt, api.git);
    const reset = api.git(gitReset, rec.path, ['--hard', receipt.proposed]);
    if (!reset.ok) throw fail({ code: 'workflow-rebase-failed' }, `the prepared rebase index could not follow ${receipt.proposed}: ${reset.stderr.slice(0, 200)}`);
    phaseOf(ctx, 'rebase-index-applied', receipt);
    api.followCheckpoint(ctx, workflowId, receipt.proposed);
    phaseOf(ctx, 'rebase-registry-applied', receipt);
    saveRebase(ctx, 'applied', receipt);
    return { ok: true, onto: receipt.onto, head: receipt.proposed, ...(recovering ? { recovered: true } : {}), ...(receipt.milestone ? { milestone: receipt.milestone } : {}) };
  } catch (error) { throw Object.assign(error, { effectState: 'unknown', rebase: receipt }); }
}
