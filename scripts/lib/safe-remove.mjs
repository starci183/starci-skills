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
// safeRemoveWorktree removes a git worktree: every link removed as a link first (found without following one), zero
// links asserted, only then `git worktree remove --force`, and the main checkout asserted untouched afterwards.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleepSync } from './sleep-sync.mjs';
import { samePath } from './path-key.mjs';
import { gitSpawn } from '../api/git/lib.mjs';
import { rmdirLink } from '../api/fs/rmdir-link.mjs';
import { artifactHoldReason } from './artifact-hold.mjs';
import { realpathOr } from './fs-kind.mjs';

const WIN = process.platform === 'win32';
const same = samePath;

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
  const parent = parentReal ?? realpathOr(path.dirname(p));
  const real = realpathOr(p);
  if (!parent || !real) return true; // cannot prove it is a plain directory: treat it as a link
  return !same(real, path.join(parent, path.basename(p)));
}

/** Remove a link itself, never its target. True when nothing is left at `p`. */
/** Every link (symlink, junction, other reparse point) under root, found with lstat; the walk never enters one. */
export function linksUnder(root) {
  const found = [];
  const visit = (p, parentReal) => {
    let stat;
    try { stat = fs.lstatSync(p); } catch { return; }
    if (isLinkLike(p, { parentReal, stat })) { found.push(p); return; }
    if (!stat.isDirectory()) return;
    let real, names;
    try { real = fs.realpathSync.native(p); names = fs.readdirSync(p); } catch { return; }
    for (const name of names) visit(path.join(p, name), real);
  };
  visit(path.resolve(root), null);
  return found;
}

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
      sleepSync(25 * (attempt + 1));
    }
  }
};
const removeFile = (p, retries) => retrying(() => {
  try { fs.unlinkSync(p); } catch (error) {
    if (WIN && (error?.code === 'EPERM' || error?.code === 'EACCES')) { fs.chmodSync(p, 0o666); fs.unlinkSync(p); } else throw error;
  }
}, retries);

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/**
 * True when `p` sits strictly below `root` by real path: no link on the way, not `root` itself. The one place a
 * primary checkout may be removed is a disposable fixture a caller names by its temp root (hk-tmp).
 */
export function strictlyInsideReal(p, root) {
  if (!root) return false;
  const rel = path.relative(path.resolve(root), path.resolve(p));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const real = realpathOr(p);
  const rootReal = realpathOr(root);
  // Its real path must be the same relative place under the root's real path: no link between them.
  return Boolean(real && rootReal) && same(real, path.join(rootReal, rel));
}

/**
 * A path the runtime must never remove whole: a filesystem root, the home or temp directory, the runtime, the
 * repository that hosts it, the repositories root, or a primary git checkout (its .git is a directory; the
 * scratch trees the runtime removes are temp directories and linked worktrees, whose .git is a file).
 * `checkoutsUnder` names a disposable root (hk-tmp's temp root): a checkout strictly inside it by real path
 * is a spec fixture, not a live repository, and is not refused for its .git. Every other refusal stands.
 * A tree holding an indexed job artifact, or inside an evidence directory holding one, is refused whatever the
 * workflow's phase (artifact-hold.mjs).
 */
export function forbiddenRoot(p, { checkoutsUnder = null } = {}) {
  const resolved = path.resolve(p);
  if (path.parse(resolved).root === resolved || same(path.dirname(resolved), resolved)) return 'a filesystem root';
  for (const [name, dir] of [['the home directory', os.homedir()], ['the temp directory', os.tmpdir()], ['the runtime', SKILL_ROOT],
    ['the repository hosting the runtime', path.dirname(SKILL_ROOT)], ['the repositories root', path.dirname(path.dirname(SKILL_ROOT))]]) {
    if (dir && same(path.resolve(dir), resolved)) return name;
  }
  const held = artifactHoldReason(resolved);
  if (held) return held;
  let checkout = false;
  try { checkout = fs.lstatSync(path.join(resolved, '.git')).isDirectory(); } catch { /* no .git directory */ }
  if (checkout && !strictlyInsideReal(resolved, checkoutsUnder)) return 'a git checkout';
  return null;
}

/**
 * Remove `root` and everything under it without ever following a link. Links are unlinked (the link only);
 * plain files and directories are deleted bottom-up. `checkoutsUnder` is forbiddenRoot's disposable root. Returns {ok, root, removed: {files, dirs, links},
 * errors: [{path, code, message}]}; ok is true only when `root` is gone. A missing root is ok.
 */
export function safeRemoveTree(root, { retries = 5, checkoutsUnder = null } = {}) {
  const target = path.resolve(String(root ?? ''));
  const out = { ok: false, root: target, removed: { files: 0, dirs: 0, links: 0 }, errors: [] };
  const fail = (p, error) => { out.errors.push({ path: p, code: error?.code ?? 'ERROR', message: String(error?.message ?? error) }); };
  const refused = root ? forbiddenRoot(target, { checkoutsUnder }) : 'no path';
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
  const insideRoot = (p) => { const real = realpathOr(p); if (!real || !rootReal) return false; if (same(real, rootReal)) return true;
    const rel = path.relative(rootReal, real); return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel); };
  const walk = (dir, st, parentReal) => {
    if (isLinkLike(dir, { parentReal, stat: st })) {
      if (unlinkOnly(dir)) { out.removed.links += 1; return true; }
      fail(dir, { code: 'LINK_STUCK', message: 'a link could not be unlinked; nothing above it is removed' });
      return false;
    }
    if (!insideRoot(dir)) {
      fail(dir, { code: 'OUTSIDE_ROOT', message: `refusing to delete ${dir}: its real path ${realpathOr(dir) ?? '?'} is outside ${rootReal ?? target}` });
      return false;
    }
    if (!st.isDirectory()) {
      const error = removeFile(dir, retries);
      if (error) { fail(dir, error); return false; }
      out.removed.files += 1; return true;
    }
    const real = realpathOr(dir);
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

/** Remove one link as a link, never its target: `cmd /c rmdir <link>` on Windows (no /s), then unlinkOnly. */
export function removeLink(p) {
  if (WIN) {
    let st = null;
    try { st = fs.lstatSync(p); } catch { return true; }
    if (st.isDirectory() || st.isSymbolicLink()) rmdirLink(p);
  }
  return unlinkOnly(p);
}

/** The main checkout's state a removal must never change: its tracked deletions and its node_modules entry counts. */
export function mainCheckoutGuard(mainRoot, { git = null } = {}) {
  const run = git ?? ((args, opts) => gitSpawn('git', args, { cwd: opts.cwd, maxBuffer: 64 * 1024 * 1024 }));
  const count = (rel) => { try { return fs.readdirSync(path.join(mainRoot, rel)).length; } catch { return null; } };
  // porcelain v2 ("1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>"): no leading blank a runner's trim could eat.
  const st = run(['status', '--porcelain=v2', '--untracked-files=no'], { cwd: mainRoot });
  const text = String(st?.stdout ?? st?.out ?? '');
  const ok = st?.ok ?? (!st?.error && st?.status === 0);
  const deleted = text.split(/\r?\n/).map((l) => l.trim().split(' ')).filter((f) => f[0] === '1' && f.length >= 9 && f[1].includes('D')).map((f) => f.slice(8).join(' '));
  return { ok: Boolean(ok), deleted: new Set(deleted),
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

/**
 * The link step of every worktree removal (git's here, Orca's in scripts/api/orca/worktree-remove.mjs removeOrcaWorktree): every link
 * under `target` found WITHOUT following one (linksUnder), each removed as a link (removeLink: `cmd /c rmdir <link>`, never
 * /s), outermost first, then a re-scan that must find ZERO. {ok, links, errors: [{path, code, message}]}; ok false: a link
 * is stuck and the caller removes nothing.
 */
export function removeLinksUnder(target) {
  const out = { ok: false, links: 0, errors: [] };
  if (!fs.existsSync(target)) { out.ok = true; return out; }
  for (const link of linksUnder(target)) { if (removeLink(link)) out.links += 1; else out.errors.push({ path: link, code: 'LINK_STUCK', message: 'a link could not be removed' }); }
  for (const l of linksUnder(target)) if (!out.errors.some((e) => e.path === l)) out.errors.push({ path: l, code: 'LINK_STUCK', message: 'a link is still there after removal' });
  out.ok = out.errors.length === 0;
  return out;
}

/**
 * Remove a git worktree (the one algorithm; the 490-file .claude incident and nivo-fe inc-c8fbf76aa499):
 *   1. enumerate every link in it WITHOUT following one (linksUnder);
 *   2. remove each as a link (removeLink: `cmd /c rmdir <link>`, never /s), outermost first;
 *   3. re-scan the same way and refuse (link-stuck, nothing deleted) unless ZERO links remain;
 *   4. only then `git worktree remove --force` (a link-free tree: git cannot walk out of it); a directory git does not know
 *      goes through safeRemoveTree (never follows a link); `git worktree prune`;
 *   5. assert the main checkout is untouched: no new tracked deletion, node_modules and packages/node_modules entry counts
 *      unchanged - a violation is {ok:false, fatal:true, reason:'main-checkout-damaged'}: the caller (the GC) stops.
 * Never robocopy, rm -rf or rmdir /s. `git(args, {cwd})` is the caller's git runner; `repo` any checkout of the repository.
 * {ok, root, links, removed, errors, damage?}
 */
export function safeRemoveWorktree(worktree, { repo, git = null, retries = 5 } = {}) {
  const target = path.resolve(String(worktree ?? ''));
  const run = git ?? ((args, opts) => gitSpawn('git', args, { cwd: opts.cwd, maxBuffer: 64 * 1024 * 1024 }));
  const out = { ok: false, root: target, links: 0, removed: { files: 0, dirs: 0, links: 0 }, errors: [] };
  const list = repo ? String((run(['worktree', 'list', '--porcelain'], { cwd: repo }) ?? {}).stdout ?? '') : '';
  const trees = list.split(/\r?\n/).filter((l) => l.startsWith('worktree ')).map((l) => path.resolve(l.slice(9).trim()));
  const mainRoot = trees[0] ?? null;
  if (mainRoot && same(mainRoot, target)) { out.errors.push({ path: target, code: 'REFUSED', message: 'refusing to remove the main checkout' }); return out; }
  const refused = forbiddenRoot(target);
  if (refused) { out.errors.push({ path: target, code: 'REFUSED', message: `refusing to remove ${refused}` }); return out; }
  const before = mainRoot ? mainCheckoutGuard(mainRoot, { git: run }) : null;
  if (fs.existsSync(target)) {
    const unlinked = removeLinksUnder(target);
    out.links = unlinked.links;
    if (!unlinked.ok) { out.errors.push(...unlinked.errors); out.reason = 'link-stuck'; return out; }
    out.removed.links = out.links;
    const registered = trees.some((t) => same(t, target));
    if (registered && repo) run(['worktree', 'remove', '--force', target], { cwd: repo });
    if (fs.existsSync(target)) {
      if (linksUnder(target).length) { out.errors.push({ path: target, code: 'LINK_STUCK', message: 'a link appeared during removal' }); out.reason = 'link-stuck'; return out; }
      const rm = safeRemoveTree(target, { retries });
      out.removed.files += rm.removed.files; out.removed.dirs += rm.removed.dirs;
      out.errors.push(...rm.errors);
    }
  }
  if (repo) { try { run(['worktree', 'prune'], { cwd: repo }); } catch { /* the registration is pruned on the next prune */ } }
  if (before) {
    const damage = mainCheckoutDamage(before, mainCheckoutGuard(mainRoot, { git: run }));
    if (damage.length) { out.damage = damage; out.fatal = true; out.reason = 'main-checkout-damaged'; out.errors.push({ path: mainRoot, code: 'main-checkout-damaged', message: damage.join('; ') }); return out; }
  }
  out.ok = !fs.existsSync(target) && (() => { try { fs.lstatSync(target); return false; } catch { return true; } })();
  if (!out.ok && !out.reason) out.reason = 'remove-failed';
  return out;
}

/**
 * Unlink `<dir>/node_modules` when it is a link (one an older runtime made; no runtime code makes one, RT_NODE_MODULES_LINK).
 * true when no link is left there; a real directory is left alone (true: it is the checkout's own).
 */
export function unlinkNodeModulesLink(dir) {
  const nm = path.join(dir, 'node_modules');
  let st;
  try { st = fs.lstatSync(nm); } catch { return true; }
  if (!st.isSymbolicLink()) return true;
  try { fs.unlinkSync(nm); } catch { try { fs.rmdirSync(nm); } catch { /* checked below */ } }
  try { fs.lstatSync(nm); return false; } catch { return true; }
}
