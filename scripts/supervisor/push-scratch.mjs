// push-scratch.mjs — `git push origin main` from a scratch detached worktree of committed main (see push-mains.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { safeRemoveWorktree, createScratchWorktree } from '../machine/worktree-git.mjs';
import { ci } from '../api/npm/ci.mjs';
import { markRemoved } from '../machine/worktree-registry.mjs';
import { git } from './workers.mjs';
import { FORBIDDEN_FILES } from '../lib/secret-patterns.mjs';
import { failureOf, PUSH_TIMEOUT_MS } from './push-failure.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';

const headOf = (repo, run) => run(['rev-parse', '--short', 'main'], { cwd: repo }).stdout;
const TRAILING_SLASHES = new RegExp([String.raw`\/+`, '$'].join(''));

/** A directory link (junction on Windows, symlink elsewhere): a git-ignored local-state directory of the live checkout
 *  made visible to the scratch worktree, never copied and never the other way round. Never a node_modules: the scratch
 *  installs its own (npm ci), RT_NODE_MODULES_LINK. */
const linkDir = (target, link) => { fs.mkdirSync(path.dirname(link), { recursive: true }); fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); };

/** Unlink a link: the link only, never what it points at (as safe-remove.mjs unlinkNodeModulesLink). */
const unlinkLink = (link) => { try { fs.unlinkSync(link); } catch { try { fs.rmdirSync(link); } catch { /* best effort */ } } };

/** Installed dependencies, build and tool output a scratch never borrows from the live tree: the hook judges the commit,
 *  not a stale build of the working tree, and the scratch installs its own dependencies. Matched against every path
 *  segment of an ignored entry. */
const LOCAL_STATE_EXCLUDED = /^(?:node_modules|dist|build|coverage|\.turbo|\.next|\.scannerwork|test-results|tmp|target|\.git)$|\.log$/i;

/** A local-state path that is linked in place or not at all, never copied: the stack runtime and every file
 *  the outgoing scan forbids (env files, keys, credentials, .secrets). */
const neverCopied = (rel) => /(^|\/)\.starcistacks\//i.test(rel) || FORBIDDEN_FILES.some((rule) => rule.test(rel));

const statOrNull = (target) => { try { return fs.statSync(target); } catch { return null; } };

/** A directory git reports whole may hold installed dependencies (a workspace package's node_modules): it is descended
 *  into, so only its own local state is linked, never a node_modules below it (RT_NODE_MODULES_LINK). */
function holdsExcluded(repo, rel) {
  try {
    return fs.readdirSync(path.join(repo, rel), { withFileTypes: true }).some((e) => LOCAL_STATE_EXCLUDED.test(e.name) || (e.isDirectory() && holdsExcluded(repo, `${rel}/${e.name}`)));
  } catch { return false; }
}

const isCovered = (points, rel) => [...points.keys()].some((p) => rel === p || rel.startsWith(`${p}/`));

const queueChildren = (repo, rel, entries) => {
  for (const child of fs.readdirSync(path.join(repo, rel))) entries.push(`${rel}/${child}`);
};

/** Walk one ignored entry from its shallowest prefix down: record the point to link, or queue the children of a
 *  directory that holds excluded output. */
function claimEntry(parts, { repo, worktree, points, entries }) {
  for (let i = 1; i <= parts.length; i += 1) {
    const rel = parts.slice(0, i).join('/');
    if (isCovered(points, rel)) return;
    if (fs.existsSync(path.join(worktree, rel))) continue;
    const stat = statOrNull(path.join(repo, rel));
    if (!stat) return;
    if (stat.isDirectory() && holdsExcluded(repo, rel)) {
      if (i === parts.length) queueChildren(repo, rel, entries);
      continue;
    }
    points.set(rel, { rel, dir: stat.isDirectory() });
    return;
  }
}

/**
 * The live checkout's git-ignored local state, as the points to link into a fresh worktree of `repo` at
 * `worktree`: every entry of `git ls-files --others --ignored --exclude-standard --directory` (which reaches
 * inside each workspace package too), mapped to its shallowest path the worktree does not hold — a directory
 * git ignores whole is one link, a file inside a tracked directory is linked by itself. Installed dependencies,
 * excluded output and anything the worktree already holds (its own npm ci install, the hooks link) are skipped.
 * Returns [{rel, dir}], `rel` '/'-separated, one point per subtree.
 */
function localStateEntries(repo, worktree, { run = git } = {}) {
  const listed = run(['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'], { cwd: repo });
  if (!listed.ok) return [];
  const state = { repo, worktree, points: new Map(), entries: listed.stdout.split('\0').map((e) => e.replace(TRAILING_SLASHES, '')).filter(Boolean) };
  while (state.entries.length) {
    const parts = state.entries.shift().split('/');
    if (!parts.some((part) => LOCAL_STATE_EXCLUDED.test(part))) claimEntry(parts, state);
  }
  return [...state.points.values()];
}

/** Link one local-state point of `repo` into `worktree`: a directory by junction/symlink, a file by hard
 *  link, else (another volume) by copy unless it is a secret, which is then left out. Returns the path
 *  made, or null when nothing was. */
const linkLocalState = (repo, worktree, { rel, dir }) => {
  const target = path.join(repo, rel), link = path.join(worktree, rel);
  if (dir) { linkDir(target, link); return link; }
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try { fs.linkSync(target, link); return link; }
  catch {
    if (neverCopied(rel)) return null;
    fs.copyFileSync(target, link);
    return link;
  }
};

/** Where a repository's scratch goes: the temp root when it shares the checkout's volume, else
 *  `.starci-tmp` at that volume's root — a hard link cannot cross volumes. Never under the git dir: jest's
 *  haste map ignores every path with a `.git` segment and finds no tests there. */
const scratchBaseOf = (repo) => {
  const tmp = tempRoot();
  const volume = (p) => path.parse(path.resolve(p)).root.toLowerCase();
  if (volume(repo) !== volume(tmp)) {
    try {
      const parent = path.join(path.parse(path.resolve(repo)).root, '.starci-tmp');
      fs.mkdirSync(parent, { recursive: true });
      return fs.mkdtempSync(path.join(parent, 'starci-push-'));
    } catch { /* the temp dir below; files then fall back to copy, secrets to nothing */ }
  }
  return makeTempDir('starci-push-');
};

/** The runner the worktree helpers get: a spec's runner, else null so they use their own. */
const runnerOverride = (run) => (run === git ? null : run);

/** Remove the scratch: its links first, then the worktree and its directory; best effort. */
function removeScratch({ links, worktree, base, repo, run }) {
  for (const link of links.splice(0).reverse()) unlinkLink(link);
  // safeRemoveWorktree: every link left (recorded or not) removed as a link, found without following one; zero links
  // asserted; only then `git worktree remove`; the main checkout asserted untouched.
  try { safeRemoveWorktree(worktree, { repo, git: runnerOverride(run) }); } catch { /* best effort */ }
  try { safeRemove(base, { hold: artifactHoldReason }); } catch { /* best effort */ }
  if (!fs.existsSync(worktree)) markRemoved(worktree);
}

/** The scratch installs its own dependencies from the lockfile (a real npm ci from the cache), never a link to the
 *  live node_modules (RT_NODE_MODULES_LINK). Returns the failure text, or null. */
function installScratch(worktree) {
  if (!fs.existsSync(path.join(worktree, 'package-lock.json'))) return null;
  const installed = ci(worktree);
  return installed.ok ? null : `npm ci in the scratch failed (exit ${installed.status ?? 'unknown'}): ${installed.stderr.slice(-400)}`;
}

/** Husky's core.hooksPath (.husky/_ in every product repo) is a gitignored install artifact: without it the scratch has
 *  no pre-push hook at all and the push would be --no-verify in all but name. Returns the failure text, or null. */
function linkHooksPath(repo, worktree, links, run) {
  const configured = run(['config', '--get', 'core.hooksPath'], { cwd: repo });
  const hooksPath = configured.ok ? configured.stdout.trim() : '';
  if (!hooksPath || path.isAbsolute(hooksPath)) return null;
  const target = path.resolve(repo, hooksPath), link = path.resolve(worktree, hooksPath);
  if (!fs.existsSync(target) || fs.existsSync(link)) return null;
  try { linkDir(target, link); links.push(link); }
  catch (error) { return `cannot link ${hooksPath}: ${String(error?.message ?? error)}`; }
  return null;
}

/** The rest of the ignored local state the hook's tests read (a data clone, env overrides, stack runtime files):
 *  linked, never written through here, unlinked before the worktree is removed. Returns the failure text, or null. */
function linkLocalStatePoints(repo, worktree, links, linked, run) {
  for (const point of localStateEntries(repo, worktree, { run })) {
    try { const link = linkLocalState(repo, worktree, point); if (link) { links.push(link); linked.push(point.rel); } }
    catch (error) { return `cannot link ${point.rel}: ${String(error?.message ?? error)}`; }
  }
  return null;
}

/** The pre-push hook alone (`hooksOnly`) or the push itself, run inside the prepared worktree. */
function judgeInScratch({ repo, worktree, base, linked, run, hooksOnly }) {
  if (hooksOnly) {
    const url = run(['remote', 'get-url', 'origin'], { cwd: repo });
    const hook = run(['hook', 'run', '--ignore-missing', 'pre-push', '--', 'origin', url.ok ? url.stdout : 'origin'], { cwd: worktree, input: '', timeoutMs: PUSH_TIMEOUT_MS });
    const hookOut = { ok: true, green: hook.ok, scratch: base, linked };
    if (!hook.ok) Object.assign(hookOut, failureOf(hook));
    return hookOut;
  }
  // The hook's stdout is kept too (MB-03: husky prints the failing lint/test there, while stderr alone said only
  // "failed to push some refs"), in full, as a blob.
  const pushed = run(['push', 'origin', 'main'], { cwd: worktree, timeoutMs: PUSH_TIMEOUT_MS });
  const out = { ok: true, pushed: pushed.ok, scratch: base, linked };
  if (pushed.ok) out.head = headOf(worktree, run);
  else Object.assign(out, failureOf(pushed));
  return out;
}

/**
 * `git push origin main` of `repo` from a scratch detached worktree of committed main — the same ref, a tree
 * the workers cannot dirty — so the repository's pre-push hook judges the commits and nothing else. The
 * worktree is removed whatever happens, its links unlinked first so the removal can never reach the live
 * checkout. `scratch` in the result is the directory that was used (already removed; it is kept in the tick's
 * JSON and the ledger payload so a deferred push can be inspected). Returns {ok:true, pushed, head?, scratch}
 * | {ok:true, pushed:false, error, scratch} (the remote or the hook refused) | {ok:false, unavailable,
 * error, scratch} (no scratch could be prepared here).
 */
export function pushFromScratch(repo, { run = git, scratch = null, hooksOnly = false } = {}) {
  const base = scratch ?? scratchBaseOf(repo);
  const worktree = path.join(base, 'wt');
  const links = [];
  const cleanup = () => removeScratch({ links, worktree, base, repo, run });
  const unavailable = (error) => { cleanup(); return { ok: false, unavailable: true, error, scratch: base }; };
  try {
    // The one scratch worktree API (scripts/api/git/worktree-add.mjs): registered for the GC, removed by cleanup().
    const added = createScratchWorktree({ repoRoot: repo, dir: worktree, kind: 'push-scratch', detach: true, base: 'main', git: runnerOverride(run) });
    if (!added.ok) return unavailable(added.detail || added.reason || 'git worktree add failed');
    const installFailure = installScratch(worktree);
    if (installFailure) return unavailable(installFailure);
    const hooksFailure = linkHooksPath(repo, worktree, links, run);
    if (hooksFailure) return unavailable(hooksFailure);
    const linked = [];
    const stateFailure = linkLocalStatePoints(repo, worktree, links, linked, run);
    if (stateFailure) return unavailable(stateFailure);
    const out = judgeInScratch({ repo, worktree, base, linked, run, hooksOnly });
    cleanup();
    return out;
  } catch (error) { return unavailable(String(error?.message ?? error)); }
}
