// safe-remove.mjs — the ONE way the runtime deletes a directory tree.
//
// A product repository once lost 674 tracked working-tree files and its node_modules: a
// recursive delete of a scratch tree followed directory links (Windows junctions) into the live repository.
// Git for Windows' `git worktree remove --force` follows a junction inside the worktree and empties its target
// (proven on this host, git 2.52), and a PowerShell/cmd/third-party recursive delete may do the same. A tree
// that holds links to live checkouts is exactly what the runtime makes (node_modules junctions in land and
// worker staging checkouts, push-mains scratch worktrees, dependency mirrors).
//
// safeRemove walks the tree itself with lstat and NEVER descends into a link: every symlink, junction or
// other reparse point is unlinked as a link (the link only, never what it points at) and verified gone. A
// directory counts as a link when lstat says so, when readlink resolves it, or when its real path is not
// its own path under its parent's real path (any name-surrogate reparse point). A link that cannot be
// unlinked stops the removal of everything above it; nothing is ever deleted through it.
//
// A worktree's removal composes this with git (scripts/machine/worktree-git.mjs safeRemoveWorktree, the Orca home in
// scripts/machine/worktree-orca.mjs): every link removed as a link first (remove-links-under.mjs), zero asserted, only then
// git or Orca. The link test is is-link-like.mjs, the refused roots forbidden-root.mjs. Whether a tree holds an indexed
// job artifact is the caller's decision (`hold`: scripts/machine/artifact-hold.mjs artifactHoldReason), taken before
// anything is deleted.
import fs from 'node:fs';
import path from 'node:path';
import { sleepSync } from '../../lib/sleep-sync.mjs';
import { samePath } from '../../lib/path-key.mjs';
import { realpathOr } from '../../lib/fs-kind.mjs';
import { FS_BUSY, unlinkOnly } from './lib.mjs';
import { isLinkLike } from './is-link-like.mjs';
import { forbiddenRoot } from './forbidden-root.mjs';

const WIN = process.platform === 'win32';
const same = samePath;

const retrying = (fn, retries) => {
  for (let attempt = 0; ; attempt += 1) {
    try { fn(); return null; } catch (error) {
      if (error?.code === 'ENOENT') return null;
      if (attempt >= retries || ![...FS_BUSY, 'ENOTEMPTY'].includes(error?.code)) return error;
      sleepSync(25 * (attempt + 1));
    }
  }
};
const removeFile = (p, retries) => retrying(() => {
  try { fs.unlinkSync(p); } catch (error) {
    if (WIN && (error?.code === 'EPERM' || error?.code === 'EACCES')) { fs.chmodSync(p, 0o600); fs.unlinkSync(p); } else throw error;
  }
}, retries);

/**
 * Remove `root` and everything under it without ever following a link. Links are unlinked (the link only);
 * plain files and directories are deleted bottom-up. `checkoutsUnder` and `hold` (required) are forbidden-root.mjs forbiddenRoot's. Returns {ok, root, removed: {files, dirs, links},
 * errors: [{path, code, message}]}; ok is true only when `root` is gone. A missing root is ok.
 */
export function safeRemove(root, { retries = 5, checkoutsUnder = null, hold } = {}) {
  const target = path.resolve(String(root ?? ''));
  const out = { ok: false, root: target, removed: { files: 0, dirs: 0, links: 0 }, errors: [] };
  const fail = (p, error) => { out.errors.push({ path: p, code: error?.code ?? 'ERROR', message: String(error?.message ?? error) }); };
  const refused = root ? forbiddenRoot(target, { checkoutsUnder, hold }) : 'no path';
  if (refused) { fail(target, { code: 'REFUSED', message: `refusing to remove ${refused}` }); return out; }
  let st;
  try { st = fs.lstatSync(target); } catch (error) {
    if (error?.code === 'ENOENT') { out.ok = true; return out; }
    fail(target, error); return out;
  }
  // CONTAINMENT (the .claude/node_modules wipe, 2026-09-28): nothing is ever deleted whose real path is not
  // the root itself or strictly under the root's real path. A link is unlinked above (the link only); any other
  // entry that resolves outside the tree is refused, whatever made it look like a plain entry.
  const rootReal = realpathOr(target);
  const ctx = { out, fail, retries, rootReal, target };
  walk(ctx, target, st, null);
  out.ok = !fs.existsSync(target) && (() => { try { fs.lstatSync(target); return false; } catch { return true; } })();
  return out;
}

function insideRoot({ rootReal }, p) {
  const real = realpathOr(p);
  if (!real || !rootReal) return false;
  if (same(real, rootReal)) return true;
  const rel = path.relative(rootReal, real);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Removes each child of `dir` (real path `real`); false when any child stays.
function removeChildren(ctx, dir, entries, real) {
  let clear = true;
  for (const name of entries) {
    const child = path.join(dir, name);
    let childStat;
    try { childStat = fs.lstatSync(child); } catch (error) { if (error?.code !== 'ENOENT') { ctx.fail(child, error); clear = false; } continue; }
    if (!walk(ctx, child, childStat, real)) clear = false;
  }
  return clear;
}

function walkDirectory(ctx, dir) {
  const { out, fail, retries } = ctx;
  const real = realpathOr(dir);
  if (!real) { fail(dir, { code: 'REALPATH', message: 'cannot resolve the directory' }); return false; }
  let entries;
  try { entries = fs.readdirSync(dir); } catch (error) { fail(dir, error); return false; }
  if (!removeChildren(ctx, dir, entries, real)) return false;
  const error = retrying(() => fs.rmdirSync(dir), retries);
  if (error) { fail(dir, error); return false; }
  out.removed.dirs += 1; return true;
}

function walk(ctx, dir, st, parentReal) {
  const { out, fail, retries, rootReal, target } = ctx;
  if (isLinkLike(dir, { parentReal, stat: st })) {
    if (unlinkOnly(dir)) { out.removed.links += 1; return true; }
    fail(dir, { code: 'LINK_STUCK', message: 'a link could not be unlinked; nothing above it is removed' });
    return false;
  }
  if (!insideRoot(ctx, dir)) {
    fail(dir, { code: 'OUTSIDE_ROOT', message: `refusing to delete ${dir}: its real path ${realpathOr(dir) ?? '?'} is outside ${rootReal ?? target}` });
    return false;
  }
  if (st.isDirectory()) return walkDirectory(ctx, dir);
  const error = removeFile(dir, retries);
  if (error) { fail(dir, error); return false; }
  out.removed.files += 1; return true;
}
