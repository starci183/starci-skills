// worktree-git.mjs — the git home of the runtime's worktree lifecycle: a runtime-internal scratch tree no agent ever works in
// (land/push scratch, the verify-proof base tree, the supervisor's revert lane), made and removed by the same process,
// registered in machine.sqlite (worktree-registry.mjs) and collected by the GC (worktrees.mjs). Each git command is one
// scripts/api/git/ call file and each filesystem step one scripts/api/fs/ call; the functions here compose them with the
// registry, the preserve step, the artifact hold and the link-safe removal. createScratchWorktree is the one caller of
// api/git/worktree-add.mjs worktreeAdd and safeRemoveWorktree the one caller of api/git/worktree-remove.mjs worktreeRemove.
// An agent's workspace is an Orca kind: worktree-orca.mjs creates and removes it through Orca.
import fs from 'node:fs';
import path from 'node:path';
import { SCRATCH_KINDS } from '../lib/worktree-kinds.mjs';
import { samePath } from '../lib/path-key.mjs';
import { PRESERVED_PREFIX, sameTree, withRegistry, claimWorktree, markRemoved } from './worktree-registry.mjs';
import { artifactHoldReason } from './artifact-hold.mjs';
import { forbiddenRoot, linksUnder, removeLinksUnder, safeRemoveTree } from '../api/fs/safe-remove.mjs';
import { worktreeListPorcelain } from '../api/git/worktree-list-porcelain.mjs';
import { worktreeAdd } from '../api/git/worktree-add.mjs';
import { worktreePrune } from '../api/git/worktree-prune.mjs';
import { worktreeRemove } from '../api/git/worktree-remove.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { isAncestor } from '../api/git/merge-base.mjs';
import { deleteBranch } from '../api/git/branch-delete.mjs';
import { snapshotCommit } from '../api/git/snapshot-commit.mjs';

/** The repository's main checkout (the first `git worktree list` entry): the registry's repo key, from any of its trees. */
export const mainRootOf = (repoRoot, opts) => worktreeListPorcelain(repoRoot, opts)[0]?.path ?? path.resolve(repoRoot);

/** The registration of `dir` in the repository, or null. */
export const registeredAt = (repoRoot, dir, opts) => worktreeListPorcelain(repoRoot, opts).find((w) => sameTree(w.path, dir)) ?? null;

/** The main checkout's state a removal must never change: its tracked deletions and its node_modules entry counts. */
export function mainCheckoutGuard(mainRoot, { git = null } = {}) {
  const count = (rel) => { try { return fs.readdirSync(path.join(mainRoot, rel)).length; } catch { return null; } };
  // porcelain v2 ("1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>"): no leading blank a runner's trim could eat.
  const st = porcelainStatus(mainRoot, { version: 2, untracked: 'no', git });
  const deleted = st.stdout.split(/\r?\n/).map((l) => l.trim().split(' ')).filter((f) => f[0] === '1' && f.length >= 9 && f[1].includes('D')).map((f) => f.slice(8).join(' '));
  return { ok: Boolean(st.ok), deleted: new Set(deleted),
    nodeModules: count('node_modules'), packagesNodeModules: count(path.join('packages', 'node_modules')) };
}

/** What changed in the main checkout between two guards: [] when nothing. */
export function mainCheckoutDamage(before, after) {
  const out = [];
  if (before.ok && after.ok) for (const f of after.deleted) if (!before.deleted.has(f)) out.push(`tracked file deleted: ${f}`);
  if (before.nodeModules !== after.nodeModules) out.push(`node_modules entries ${before.nodeModules} -> ${after.nodeModules}`);
  if (before.packagesNodeModules !== after.packagesNodeModules) out.push(`packages/node_modules entries ${before.packagesNodeModules} -> ${after.packagesNodeModules}`);
  return out;
}

const gone = (p) => !fs.existsSync(p) && (() => { try { fs.lstatSync(p); return false; } catch { return true; } })();

/**
 * Remove a git worktree (the one algorithm; the 490-file .claude incident and a live checkout emptied through a junction):
 *   1. enumerate every link in it WITHOUT following one (linksUnder);
 *   2. remove each as a link (removeLink: `cmd /c rmdir <link>`, never /s), outermost first;
 *   3. re-scan the same way and refuse (link-stuck, nothing deleted) unless ZERO links remain;
 *   4. only then `git worktree remove --force` (a link-free tree: git cannot walk out of it); a directory git does not know
 *      goes through safeRemoveTree (never follows a link); `git worktree prune`;
 *   5. assert the main checkout is untouched: no new tracked deletion, node_modules and packages/node_modules entry counts
 *      unchanged - a violation is {ok:false, fatal:true, reason:'main-checkout-damaged'}: the caller (the GC) stops.
 * A tree holding an indexed job artifact is refused (artifact-hold.mjs). Never robocopy, rm -rf or rmdir /s. `git(args,
 * {cwd})` is the caller's git runner (null: git itself); `repo` any checkout of the repository.
 * {ok, root, links, removed, errors, damage?}
 */
export function safeRemoveWorktree(worktree, { repo, git = null, retries = 5 } = {}) {
  const target = path.resolve(String(worktree ?? ''));
  const out = { ok: false, root: target, links: 0, removed: { files: 0, dirs: 0, links: 0 }, errors: [] };
  const trees = repo ? worktreeListPorcelain(repo, { git }).map((w) => w.path) : [];
  const mainRoot = trees[0] ?? null;
  if (mainRoot && samePath(mainRoot, target)) { out.errors.push({ path: target, code: 'REFUSED', message: 'refusing to remove the main checkout' }); return out; }
  const refused = forbiddenRoot(target, { hold: artifactHoldReason });
  if (refused) { out.errors.push({ path: target, code: 'REFUSED', message: `refusing to remove ${refused}` }); return out; }
  const before = mainRoot ? mainCheckoutGuard(mainRoot, { git }) : null;
  if (fs.existsSync(target)) {
    const unlinked = removeLinksUnder(target);
    out.links = unlinked.links;
    if (!unlinked.ok) { out.errors.push(...unlinked.errors); out.reason = 'link-stuck'; return out; }
    out.removed.links = out.links;
    if (repo && trees.some((t) => samePath(t, target))) worktreeRemove(repo, target, { git });
    if (fs.existsSync(target)) {
      if (linksUnder(target).length) { out.errors.push({ path: target, code: 'LINK_STUCK', message: 'a link appeared during removal' }); out.reason = 'link-stuck'; return out; }
      const rm = safeRemoveTree(target, { retries, hold: artifactHoldReason });
      out.removed.files += rm.removed.files; out.removed.dirs += rm.removed.dirs;
      out.errors.push(...rm.errors);
    }
  }
  if (repo) { try { worktreePrune(repo, { git }); } catch { /* the registration is pruned on the next prune */ } }
  if (before) {
    const damage = mainCheckoutDamage(before, mainCheckoutGuard(mainRoot, { git }));
    if (damage.length) { out.damage = damage; out.fatal = true; out.reason = 'main-checkout-damaged'; out.errors.push({ path: mainRoot, code: 'main-checkout-damaged', message: damage.join('; ') }); return out; }
  }
  out.ok = gone(target);
  if (!out.ok && !out.reason) out.reason = 'remove-failed';
  return out;
}

/**
 * Preserve what a worktree holds that main does not: its uncommitted changes (api/git/snapshot-commit.mjs) and its unlanded
 * commits, as refs/heads/preserved/<name>. Nothing to preserve (clean and in main) -> no ref. {ok, ref|null, sha|null, dirty}
 */
export function preserveWork({ repoRoot, dir, name, main = 'main' }) {
  const ref = `refs/heads/${PRESERVED_PREFIX}/${name}`;
  if (!fs.existsSync(dir)) return { ok: true, ref: null, sha: null, dirty: false, missing: true };
  const head = revParse(dir, 'HEAD');
  if (!head) return { ok: false, reason: 'preserve-failed', step: 'head' };
  const snap = snapshotCommit(dir, head, `preserve ${name}: uncommitted work of its worktree`);
  if (!snap.ok) return { ok: false, reason: 'preserve-failed', step: snap.step, detail: snap.detail };
  const { sha, dirty } = snap;
  const mainSha = revParse(repoRoot, main);
  if (!dirty && mainSha && isAncestor(repoRoot, sha, mainSha)) return { ok: true, ref: null, sha: null, dirty: false };
  const u = updateRef(repoRoot, ref, sha);
  if (!u.ok) return { ok: false, reason: 'preserve-failed', step: 'update-ref', detail: u.stderr.slice(0, 200) };
  return { ok: true, ref, sha, dirty };
}

/**
 * Create one runtime-internal scratch worktree. kind: one of SCRATCH_KINDS - an agent's workspace is an Orca kind and is
 * refused here. Exactly one of `detach` (a detached HEAD at `base`), `newBranch` (branch `branch` created at `base`) or an
 * existing `branch`. owner: {ledgerId, workflowId, jobId, lane}. cap: none unless given. git: the caller's runner (args,
 * {cwd}) -> {ok|status, stdout|out, stderr|err}.
 * {ok, path, created, registered} | {ok:false, reason: 'worktree-cap'|'worktree-path-occupied'|'worktree-add-failed', detail?, live?, cap?}
 */
export function createScratchWorktree({ repoRoot, dir, kind, base = null, branch = null, newBranch = false, detach = false, owner = {}, ownerPid = process.pid,
  cap = null, env = process.env, git = null }) {
  if (!SCRATCH_KINDS.includes(kind)) throw new Error(`createScratchWorktree: ${kind} is not a scratch kind (${SCRATCH_KINDS.join(', ')}); an agent's workspace is created by Orca`);
  const target = path.resolve(dir);
  const home = mainRootOf(repoRoot, { git });
  const reg = registeredAt(repoRoot, target, { git });
  if (reg && fs.existsSync(target)) return { ok: true, path: target, created: false, registered: registerExisting({ repoRoot: home, dir: target, kind, branch, base, owner, ownerPid, env }) };
  if (fs.existsSync(target)) {
    let entries = [];
    try { entries = fs.readdirSync(target); } catch { /* unreadable */ }
    if (entries.length) return { ok: false, reason: 'worktree-path-occupied', detail: `${target} exists and is not a registered worktree` };
    try { fs.rmdirSync(target); } catch { /* git recreates it */ }
  }
  let registered = false;
  try {
    const r = withRegistry((m) => m.reserveWorktree({ path: target, kind, repoRoot: home, branch: branch ?? null, baseSha: base ? revParse(repoRoot, base) ?? base : null,
      ledgerId: owner.ledgerId ?? null, workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap }), env);
    if (!r.ok) return { ok: false, reason: r.reason, live: r.live, cap: r.cap, detail: `${home} holds ${r.live} live worktree(s), cap ${r.cap}` };
    registered = true;
  } catch { /* a scratch tree is created and removed by the same process: it is made even while the registry is busy */ }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  worktreePrune(repoRoot, { git });
  const added = worktreeAdd({ repoRoot, target, base, branch, newBranch, detach, git });
  if (!added.ok) {
    if (registered) { try { withRegistry((m) => m.dropWorktree(target), env); } catch { /* the GC marks it: its dir is gone */ } }
    return { ok: false, reason: 'worktree-add-failed', detail: added.stderr.slice(0, 400) };
  }
  if (registered) claimWorktree({ dir: target, ownerPid, env });
  return { ok: true, path: target, created: true, registered };
}

/** Register a scratch worktree that exists (a requeued attempt reusing its tree): the row is refreshed, never capped. */
function registerExisting({ repoRoot, dir, kind, branch, base, owner, ownerPid, env }) {
  try {
    const row = withRegistry((m) => m.worktreeRow(dir), env);
    if (row && row.removed_at == null) return true;
    withRegistry((m) => m.reserveWorktree({ path: dir, kind, repoRoot, branch: branch ?? null, baseSha: base ?? null, ledgerId: owner.ledgerId ?? null,
      workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap: null }), env);
    claimWorktree({ dir, ownerPid, env });
    return true;
  } catch { return false; }
}

/**
 * Remove a scratch worktree the runtime made with git. preserve: {name} -> preserveWork first (a failure keeps the
 * tree). Then safeRemoveWorktree: every link removed as a link (found without following one), zero links asserted,
 * `git worktree remove --force`, prune, and the main checkout asserted untouched (a violation is fatal:
 * {fatal:true, reason:'main-checkout-damaged'} and the GC stops). The removal is verified, and the branch is deleted:
 * 'merged' -> `git branch -d` (git refuses an unmerged one), 'force' -> `git branch -D` (only after a preserve).
 * {ok, path, verified: {dirGone, pruned}, links, preserved, branch} | {ok:false, reason, fatal?, ...}
 */
export function removeScratchWorktree({ repoRoot, dir, branch = null, deleteBranch: mode = null, preserve = null, main = 'main', env = process.env, git = null }) {
  const target = path.resolve(dir);
  const out = { ok: false, path: target, verified: { dirGone: false, pruned: false }, links: 0, preserved: null, branch: branch ? { name: branch, deleted: false } : null };
  if (preserve && fs.existsSync(target)) {
    const p = preserveWork({ repoRoot, dir: target, name: preserve.name, main });
    if (!p.ok) { markRemoved(target, { error: `preserve: ${p.step ?? p.reason}`, env }); return { ...out, reason: 'preserve-failed', detail: p }; }
    out.preserved = p.ref ? { ref: p.ref, sha: p.sha, dirty: p.dirty } : null;
  }
  const rm = safeRemoveWorktree(target, { repo: repoRoot, git });
  out.links = rm.links ?? 0;
  if (rm.fatal) { markRemoved(target, { error: `main checkout damaged: ${(rm.damage ?? []).join('; ').slice(0, 200)}`, env }); return { ...out, reason: 'main-checkout-damaged', fatal: true, damage: rm.damage }; }
  if (!rm.ok) {
    markRemoved(target, { error: `${rm.reason ?? 'remove-failed'}: ${rm.errors[0]?.path ?? ''}`.slice(0, 300), env });
    if (rm.reason === 'link-stuck') return { ...out, reason: 'link-stuck', errors: rm.errors.slice(0, 5) };
    return { ...out, reason: 'remove-failed', errors: rm.errors.slice(0, 5) };
  }
  out.verified.dirGone = !fs.existsSync(target);
  out.verified.pruned = !registeredAt(repoRoot, target, { git });
  if (!out.verified.dirGone || !out.verified.pruned) {
    const reason = out.verified.dirGone ? 'prune-unverified' : 'dir-remains';
    markRemoved(target, { error: reason, env });
    return { ...out, reason };
  }
  if (branch && mode && revParse(repoRoot, `refs/heads/${branch}`)) {
    const deleted = deleteBranch({ repoRoot, branch, mode, main, git });
    out.branch.deleted = deleted.ok;
    if (!deleted.ok) { markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env }); return { ...out, ok: false, reason: 'branch-delete-failed', detail: deleted.detail }; }
  } else if (out.branch) out.branch.deleted = !revParse(repoRoot, `refs/heads/${branch}`);
  markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env });
  out.ok = true;
  return out;
}
