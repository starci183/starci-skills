// safe-remove.mjs — the ONE way the runtime deletes a directory tree (nivo-fe inc-c8fbf76aa499).
//
// At 05:47 on 2026-09-25 D:/Repositories/nivo-fe lost 674 tracked working-tree files and its node_modules: a
// recursive delete of a scratch tree followed directory links (Windows junctions) into the live repository.
// Git for Windows' `git worktree remove --force` follows a junction inside the worktree and empties its target
// (proven on this host, git 2.52), and a PowerShell/cmd/third-party recursive delete may do the same. A tree
// that holds links to live checkouts is exactly what the runtime makes (node_modules junctions in land and
// worker staging checkouts, push-mains scratch worktrees, dependency mirrors).
//
// safeRemoveTree walks the tree itself with lstat and NEVER descends into a link: every symlink, junction or
// other reparse point is unlinked as a link (the link only, never what it points at) and verified gone. A
// directory counts as a link when lstat says so, when readlink resolves it, or when its real path is not
// its own path under its parent's real path (any name-surrogate reparse point). A link that cannot be
// unlinked stops the removal of everything above it; nothing is ever deleted through it.
//
// safeRemoveWorktree removes a git worktree's directory with safeRemoveTree and then prunes the registration,
// so `git worktree remove --force` never walks the tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WIN = process.platform === 'win32';
const same = (a, b) => (WIN ? a.toLowerCase() === b.toLowerCase() : a === b);
const pause = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* no wait available */ } };
const realOf = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };

/**
 * True when `p` is a link of any kind: a symlink, a junction, or another reparse point that redirects it.
 * `parentReal` (the real path of p's parent, when the caller walked to it through real directories) lets the
 * real-path test catch a reparse point lstat and readlink do not report. A missing path is not a link.
 */
export function isLinkLike(p, { parentReal = null, stat = null } = {}) {
  let st = stat;
  if (!st) { try { st = fs.lstatSync(p); } catch { return false; } }
  if (st.isSymbolicLink()) return true;
  if (!st.isDirectory()) return false;
  try { fs.readlinkSync(p); return true; } catch { /* not a link readlink can read */ }
  const parent = parentReal ?? realOf(path.dirname(p));
  const real = realOf(p);
  if (!parent || !real) return true; // cannot prove it is a plain directory: treat it as a link
  return !same(real, path.join(parent, path.basename(p)));
}

/** Remove a link itself, never its target. True when nothing is left at `p`. */
export function unlinkOnly(p) {
  try { fs.lstatSync(p); } catch (error) { return error?.code === 'ENOENT'; }
  try { fs.unlinkSync(p); } catch { try { fs.rmdirSync(p); } catch { /* verified below */ } }
  try { fs.lstatSync(p); return false; } catch (error) { return error?.code === 'ENOENT'; }
}

const retrying = (fn, retries) => {
  for (let attempt = 0; ; attempt += 1) {
    try { fn(); return null; } catch (error) {
      if (error?.code === 'ENOENT') return null;
      if (attempt >= retries || !['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(error?.code)) return error;
      pause(25 * (attempt + 1));
    }
  }
};
const removeFile = (p, retries) => retrying(() => {
  try { fs.unlinkSync(p); } catch (error) {
    if (WIN && (error?.code === 'EPERM' || error?.code === 'EACCES')) { fs.chmodSync(p, 0o666); fs.unlinkSync(p); } else throw error;
  }
}, retries);

/** A path the runtime must never remove whole: a filesystem root, the home or temp directory itself. */
export function forbiddenRoot(p) {
  const resolved = path.resolve(p);
  if (path.parse(resolved).root === resolved || same(path.dirname(resolved), resolved)) return 'a filesystem root';
  for (const [name, dir] of [['the home directory', os.homedir()], ['the temp directory', os.tmpdir()]]) {
    if (dir && same(path.resolve(dir), resolved)) return name;
  }
  return null;
}

/**
 * Remove `root` and everything under it without ever following a link. Links are unlinked (the link only);
 * plain files and directories are deleted bottom-up. Returns {ok, root, removed: {files, dirs, links},
 * errors: [{path, code, message}]}; ok is true only when `root` is gone. A missing root is ok.
 */
export function safeRemoveTree(root, { retries = 5 } = {}) {
  const target = path.resolve(String(root ?? ''));
  const out = { ok: false, root: target, removed: { files: 0, dirs: 0, links: 0 }, errors: [] };
  const fail = (p, error) => { out.errors.push({ path: p, code: error?.code ?? 'ERROR', message: String(error?.message ?? error) }); };
  const refused = root ? forbiddenRoot(target) : 'no path';
  if (refused) { fail(target, { code: 'REFUSED', message: `refusing to remove ${refused}` }); return out; }
  let st;
  try { st = fs.lstatSync(target); } catch (error) {
    if (error?.code === 'ENOENT') { out.ok = true; return out; }
    fail(target, error); return out;
  }
  const walk = (dir, st, parentReal) => {
    if (isLinkLike(dir, { parentReal, stat: st })) {
      if (unlinkOnly(dir)) { out.removed.links += 1; return true; }
      fail(dir, { code: 'LINK_STUCK', message: 'a link could not be unlinked; nothing above it is removed' });
      return false;
    }
    if (!st.isDirectory()) {
      const error = removeFile(dir, retries);
      if (error) { fail(dir, error); return false; }
      out.removed.files += 1; return true;
    }
    const real = realOf(dir);
    if (!real) { fail(dir, { code: 'REALPATH', message: 'cannot resolve the directory' }); return false; }
    let entries;
    try { entries = fs.readdirSync(dir); } catch (error) { fail(dir, error); return false; }
    let clear = true;
    for (const name of entries) {
      const child = path.join(dir, name);
      let childStat;
      try { childStat = fs.lstatSync(child); } catch (error) { if (error?.code !== 'ENOENT') { fail(child, error); clear = false; } continue; }
      if (!walk(child, childStat, real)) clear = false;
    }
    if (!clear) return false;
    const error = retrying(() => fs.rmdirSync(dir), retries);
    if (error) { fail(dir, error); return false; }
    out.removed.dirs += 1; return true;
  };
  walk(target, st, null);
  out.ok = !fs.existsSync(target) && (() => { try { fs.lstatSync(target); return false; } catch { return true; } })();
  return out;
}

/**
 * Unlink every link under `root` (the links only; nothing else is deleted, nothing is entered through a link),
 * so a tool that follows links - `git worktree remove`, a shell's recursive delete - can then walk the tree
 * safely. Returns {ok, links: [paths unlinked], errors}; ok is false when a link could not be unlinked.
 */
export function unlinkLinksUnder(root) {
  const target = path.resolve(String(root ?? ''));
  const out = { ok: true, links: [], errors: [] };
  const visit = (p, parentReal) => {
    let st;
    try { st = fs.lstatSync(p); } catch { return; }
    if (isLinkLike(p, { parentReal, stat: st })) {
      if (unlinkOnly(p)) out.links.push(p);
      else { out.ok = false; out.errors.push({ path: p, code: 'LINK_STUCK', message: 'a link could not be unlinked' }); }
      return;
    }
    if (!st.isDirectory()) return;
    const real = realOf(p);
    if (!real) { out.ok = false; out.errors.push({ path: p, code: 'REALPATH', message: 'cannot resolve the directory' }); return; }
    let entries;
    try { entries = fs.readdirSync(p); } catch (error) { out.ok = false; out.errors.push({ path: p, code: error?.code ?? 'ERROR', message: String(error?.message ?? error) }); return; }
    for (const name of entries) visit(path.join(p, name), real);
  };
  visit(target, null);
  return out;
}

/**
 * Remove a git worktree without letting git walk it: its directory goes through safeRemoveTree, then
 * `git worktree prune` (run in `repo`) drops the registration. `git(args, {cwd})` is the caller's git runner;
 * omitted, git is spawned directly.
 */
export function safeRemoveWorktree(worktree, { repo, git = null, retries = 5 } = {}) {
  const removed = safeRemoveTree(worktree, { retries });
  if (repo) {
    const run = git ?? ((args, opts) => spawnSync('git', args, { cwd: opts.cwd, encoding: 'utf8', windowsHide: true }));
    try { run(['worktree', 'prune'], { cwd: repo }); } catch { /* the registration is pruned on the next prune */ }
  }
  return removed;
}
