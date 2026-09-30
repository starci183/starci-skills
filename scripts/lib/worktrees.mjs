// worktrees.mjs — the ONE place the runtime creates a git worktree, and the registry and GC of every worktree it made.
//
// 600+ orphan worktrees piled up across the product repos because every script ran its own `git worktree add` and its
// own cleanup, and nothing counted them. Now (owner order, lane WT):
//   create   createWorktree is the only `git worktree add` in the runtime scripts (scripts/checks/check-worktree-add.mjs
//            fails any other). Each worktree is reserved first in machine.sqlite `worktrees` (owner op, repo, branch,
//            kind, created-at) with a `claims` row carrying the creating pid, atomically against the per-repo cap
//            (modules/kernel/product-land.yaml worktrees.capPerRepo, 10). An op worktree over the cap is refused
//            worktree-cap: its dispatch waits, the job stays queued. The other kinds (scratch, staging, lanes) are
//            registered and counted but never refused: they are created and removed by the same process.
//   remove   removeWorktree: the uncommitted work is preserved first when asked (preserveWork -> refs/heads/preserved/<name>),
//            every junction or symlink in the tree is removed as a link (`cmd /c rmdir` on Windows, never through it),
//            then the tree (safe-remove.mjs), `git worktree prune`, the removal verified, the branch deleted, the row
//            marked removed and its claim released.
//   gc       gcWorktrees removes a live worktree whose branch is merged into main, whose owner op has settled, or whose
//            owner process has been gone for more than worktrees.ownerGoneMs (30 min), always after preserving its
//            work; it also reclaims unregistered trees under <repo>/.starciwork/worktrees whose job is not live. The
//            reconciler GC controller runs it ACTIVE (controllers/gc.mjs key gc:worktrees).
//   counts   worktreeCounts: each repo's live count against its cap and its orphans (start.mjs --check).
//
// State of a row: live (removed_at NULL), removed, remove-failed (remove_error), preserved (archived_ref names the
// preserved/<name> branch).
//
//   node scripts/lib/worktrees.mjs counts [--json]          each repo's live count, cap and orphans
//   node scripts/lib/worktrees.mjs gc [--plan] [--json]     one GC pass now (--plan: what it would remove)
//   node scripts/lib/worktrees.mjs resume                   clear the stop a main-checkout violation set (after inspecting it)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runGit } from './git.mjs';
import { safeRemoveWorktree, isLinkLike } from './safe-remove.mjs';
import { WORKTREES_REL } from './worktree-exclude.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { withMachine } from '../../engine/machine-db.mjs';
import { openLedgerReader } from '../../engine/ledger-db.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETTINGS_FILE = path.join(SKILL_ROOT, 'modules', 'kernel', 'product-land.yaml');
export const PRESERVED_PREFIX = 'preserved';
/** The registry kinds (machine.sqlite worktrees.kind CHECK). */
export const WORKTREE_KIND_NAMES = Object.freeze(['op', 'land-scratch', 'push-scratch', 'supervisor-staging', 'lane']);
const SETTLED = new Set(SETTLED_JOB_LIST);
const DEFAULTS = Object.freeze({ capPerRepo: 10, ownerGoneMs: 1_800_000, gcEveryMs: 300_000, gcBudgetMs: 120_000 });

/** worktrees.{capPerRepo, ownerGoneMs, gcEveryMs, gcBudgetMs} of modules/kernel/product-land.yaml over the defaults. */
export function worktreeSettings(file = SETTINGS_FILE) {
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { doc = null; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) { const n = Number(doc?.worktrees?.[k]); if (Number.isFinite(n) && n > 0) out[k] = n; }
  return out;
}

/* ------------------------------------------------------------ git */

/** Every caller's git runner folded to {ok, stdout, stderr}. Default: runGit in `cwd`. */
const runnerOf = (git) => (args, opts = {}) => {
  const r = git ? git(args, opts) : runGit(args, { timeout: 300_000, maxBuffer: 64 * 1024 * 1024, ...opts });
  return { ok: r?.ok ?? (!r?.error && r?.status === 0), stdout: String(r?.stdout ?? r?.out ?? '').trim(), stderr: String(r?.stderr ?? r?.err ?? r?.error?.message ?? r?.error ?? '').trim() };
};
const plain = runnerOf(null);
const revParse = (cwd, ref) => { const r = plain(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd }); return r.ok && r.stdout ? r.stdout : null; };
const isAncestor = (cwd, a, b) => plain(['merge-base', '--is-ancestor', a, b], { cwd }).ok;
const key = (p) => { let r = path.resolve(p); try { r = fs.realpathSync.native(r); } catch { /* missing */ } return process.platform === 'win32' ? r.toLowerCase() : r; };
export const samePath = (a, b) => key(a) === key(b);
const inside = (child, parent) => { const rel = path.relative(key(parent), key(child)); return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel); };

/** {path, branch, head, prunable} of every registered worktree of the repository (the main checkout first). */
export function worktreeList(repoRoot, { git = null } = {}) {
  const r = runnerOf(git)(['worktree', 'list', '--porcelain'], { cwd: repoRoot });
  const out = [];
  let cur = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) { cur = { path: path.resolve(line.slice(9).trim()), branch: null, head: null, prunable: false }; out.push(cur); }
    else if (cur && line.startsWith('HEAD ')) cur.head = line.slice(5).trim();
    else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '');
    else if (cur && line.startsWith('prunable')) cur.prunable = true;
  }
  return out;
}
/** The repository's main checkout (the first `git worktree list` entry): the registry's repo key, from any of its trees. */
export const mainRootOf = (repoRoot, opts) => worktreeList(repoRoot, opts)[0]?.path ?? path.resolve(repoRoot);
export const registeredAt = (repoRoot, dir, opts) => worktreeList(repoRoot, opts).find((w) => samePath(w.path, dir)) ?? null;
export const worktreesRootOf = (repoRoot) => path.join(repoRoot, ...WORKTREES_REL.split('/'));

/* ------------------------------------------------------------ registry */

/** fn(handle) over machine.sqlite (the registry's one writer, engine/machine-db.mjs). */
const withRegistry = (fn, env) => withMachine(fn, { env });

/* ------------------------------------------------------------ create */

/**
 * Create one worktree (the only `git worktree add` of the runtime). kind: one of WORKTREE_KIND_NAMES. Exactly one of
 * `detach` (a detached HEAD at `base`), `newBranch` (branch `branch` created at `base`) or an existing `branch`.
 * owner: {ledgerId, workflowId, jobId, lane}. cap: the per-repo cap to enforce (default: worktrees.capPerRepo for an
 * op, none for the other kinds). git: the caller's runner (args, {cwd}) -> {ok|status, stdout|out, stderr|err}.
 * {ok, path, created, registered} | {ok:false, reason: 'worktree-cap'|'worktree-registry-unavailable'|
 * 'worktree-path-occupied'|'worktree-add-failed', detail?, live?, cap?}
 */
export function createWorktree({ repoRoot, dir, kind, base = null, branch = null, newBranch = false, detach = false, owner = {}, ownerPid = process.pid,
  cap = undefined, env = process.env, git = null, settings = worktreeSettings() }) {
  if (!WORKTREE_KIND_NAMES.includes(kind)) throw new Error(`createWorktree: unknown kind ${kind} (one of ${WORKTREE_KIND_NAMES.join(', ')})`);
  const run = runnerOf(git);
  const target = path.resolve(dir);
  const limit = cap === undefined ? (kind === 'op' ? settings.capPerRepo : null) : cap;
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
      ledgerId: owner.ledgerId ?? null, workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap: limit }), env);
    if (!r.ok) return { ok: false, reason: r.reason, live: r.live, cap: r.cap, detail: `${home} holds ${r.live} live worktree(s), cap ${r.cap}` };
    registered = true;
  } catch (error) {
    // An op worktree is never created unregistered: the cap and the GC depend on the row.
    if (kind === 'op') return { ok: false, reason: 'worktree-registry-unavailable', detail: String(error?.message ?? error).slice(0, 300) };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  run(['worktree', 'prune'], { cwd: repoRoot });
  const args = detach ? ['worktree', 'add', '--detach', target, base]
    : newBranch ? ['worktree', 'add', '-b', branch, target, base]
      : ['worktree', 'add', target, branch];
  const added = run(args, { cwd: repoRoot });
  if (!added.ok) {
    if (registered) { try { withRegistry((m) => m.dropWorktree(target), env); } catch { /* the GC marks it: its dir is gone */ } }
    return { ok: false, reason: 'worktree-add-failed', detail: added.stderr.slice(0, 400) };
  }
  if (registered) claim({ dir: target, ownerPid, env });
  return { ok: true, path: target, created: true, registered };
}

/** Register a worktree that exists (a requeued attempt reusing its tree): the row is refreshed, never capped. */
function registerExisting({ repoRoot, dir, kind, branch, base, owner, ownerPid, env }) {
  try {
    const row = withRegistry((m) => m.worktreeRow(dir), env);
    if (row && row.removed_at == null) return true;
    withRegistry((m) => m.reserveWorktree({ path: dir, kind, repoRoot, branch: branch ?? null, baseSha: base ?? null, ledgerId: owner.ledgerId ?? null,
      workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap: null }), env);
    claim({ dir, ownerPid, env });
    return true;
  } catch { return false; }
}

/** The owner-process claim of a registered worktree (claims.owner_pid): the GC's "owner gone" signal. */
function claim({ dir, ownerPid, env }) {
  try {
    withRegistry((m) => m.transaction((db) => {
      db.prepare('UPDATE claims SET released_at=? WHERE resource_path=? AND released_at IS NULL AND swept_at IS NULL').run(Date.now(), dir);
      const claimId = m.claimResource({ resourcePath: dir, kind: 'worktree', ownerPid: Number(ownerPid) || process.pid, hasJunctions: true });
      db.prepare('UPDATE worktrees SET claim_id=? WHERE path=?').run(claimId, dir);
    }), env);
  } catch { /* the row stands; the GC judges it by its owner op or age */ }
}

/** Record a worktree gone (its row removed, its claim released). `error`: the removal failed and is retried. */
export function markRemoved(dir, { error = null, preservedRef = null, env = process.env } = {}) {
  try {
    return withRegistry((m) => m.transaction((db) => {
      const row = m.worktreeRow(dir);
      if (!row) return false;
      m.removedWorktree(dir, { error, archivedRef: preservedRef });
      if (!error && row.claim_id != null) m.releaseClaim(row.claim_id);
      return true;
    }), env);
  } catch { return false; }
}

/* ------------------------------------------------------------ preserve + remove */

const tmpIndex = () => path.join(os.tmpdir(), `starci-preserve-${process.pid}-${crypto.randomBytes(4).toString('hex')}.index`);

/**
 * Preserve what a worktree holds that main does not: its uncommitted changes (tracked and untracked, .gitignore
 * respected) as one commit on top of its HEAD, written through a private index (no hook, the tree untouched), and
 * its unlanded commits. The result is refs/heads/preserved/<name>. Nothing to preserve (clean and in main) -> no ref.
 * {ok, ref|null, sha|null, dirty}
 */
export function preserveWork({ repoRoot, dir, name, main = 'main' }) {
  const ref = `refs/heads/${PRESERVED_PREFIX}/${name}`;
  if (!fs.existsSync(dir)) return { ok: true, ref: null, sha: null, dirty: false, missing: true };
  const head = revParse(dir, 'HEAD');
  if (!head) return { ok: false, reason: 'preserve-failed', step: 'head' };
  const status = plain(['status', '--porcelain', '--untracked-files=all'], { cwd: dir });
  if (!status.ok) return { ok: false, reason: 'preserve-failed', step: 'status', detail: status.stderr.slice(0, 200) };
  const dirty = status.stdout.split(/\r?\n/).filter((l) => l && !/^\?\? \.starciwork\/worktrees\//.test(l)).length > 0;
  let sha = head;
  if (dirty) {
    const index = tmpIndex();
    const env = { ...process.env, GIT_INDEX_FILE: index };
    try {
      const steps = [['read-tree', 'HEAD'], ['add', '-A', '--', '.']];
      for (const args of steps) { const r = plain(args, { cwd: dir, env }); if (!r.ok) return { ok: false, reason: 'preserve-failed', step: 'index', detail: `${args.join(' ')}: ${r.stderr.slice(0, 200)}` }; }
      const tree = plain(['write-tree'], { cwd: dir, env });
      if (!tree.ok || !tree.stdout) return { ok: false, reason: 'preserve-failed', step: 'write-tree', detail: tree.stderr.slice(0, 200) };
      const commit = plain(['-c', 'user.name=starci', '-c', 'user.email=runtime@starci.local', 'commit-tree', tree.stdout, '-p', head, '-m', `preserve ${name}: uncommitted work of its worktree`], { cwd: dir, env });
      if (!commit.ok || !commit.stdout) return { ok: false, reason: 'preserve-failed', step: 'commit-tree', detail: commit.stderr.slice(0, 200) };
      sha = commit.stdout;
    } finally { try { fs.rmSync(index, { force: true }); } catch { /* temp */ } }
  }
  const mainSha = revParse(repoRoot, main);
  if (!dirty && mainSha && isAncestor(repoRoot, sha, mainSha)) return { ok: true, ref: null, sha: null, dirty: false };
  const u = plain(['update-ref', ref, sha], { cwd: repoRoot });
  if (!u.ok) return { ok: false, reason: 'preserve-failed', step: 'update-ref', detail: u.stderr.slice(0, 200) };
  return { ok: true, ref, sha, dirty };
}

/**
 * Remove a worktree the runtime made. preserve: {name} -> preserveWork first (a failure keeps the tree). Then
 * safe-remove.mjs safeRemoveWorktree: every link removed as a link (found without following one), zero links asserted,
 * `git worktree remove --force`, prune, and the main checkout asserted untouched (a violation is fatal: {fatal:true,
 * reason:'main-checkout-damaged'} and the GC stops). The removal is verified, and the branch is deleted: 'merged' ->
 * `git branch -d` (git refuses an unmerged one), 'force' -> `git branch -D` (only after a preserve).
 * {ok, path, verified: {dirGone, pruned}, links, preserved, branch} | {ok:false, reason, fatal?, ...}
 */
export function removeWorktree({ repoRoot, dir, branch = null, deleteBranch = null, preserve = null, main = 'main', env = process.env, git = null }) {
  const run = runnerOf(git);
  const target = path.resolve(dir);
  const out = { ok: false, path: target, verified: { dirGone: false, pruned: false }, links: 0, preserved: null, branch: branch ? { name: branch, deleted: false } : null };
  if (preserve && fs.existsSync(target)) {
    const p = preserveWork({ repoRoot, dir: target, name: preserve.name, main });
    if (!p.ok) { markRemoved(target, { error: `preserve: ${p.step ?? p.reason}`, env }); return { ...out, reason: 'preserve-failed', detail: p }; }
    out.preserved = p.ref ? { ref: p.ref, sha: p.sha, dirty: p.dirty } : null;
  }
  const rm = safeRemoveWorktree(target, { repo: repoRoot, git: run });
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
  if (branch && deleteBranch && revParse(repoRoot, `refs/heads/${branch}`)) {
    const flag = deleteBranch === 'force' ? '-D' : '-d';
    let d = run(['branch', flag, branch], { cwd: repoRoot });
    // `branch -d` judges "merged" against the repo's HEAD; a repo not on main is judged against main here.
    if (!d.ok && flag === '-d') { const tip = revParse(repoRoot, `refs/heads/${branch}`), m = revParse(repoRoot, main); if (tip && m && isAncestor(repoRoot, tip, m)) d = run(['branch', '-D', branch], { cwd: repoRoot }); }
    out.branch.deleted = d.ok;
    if (!d.ok) { markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env }); return { ...out, ok: false, reason: 'branch-delete-failed', detail: d.stderr.slice(0, 200) }; }
    run(['config', '--remove-section', `branch.${branch}`], { cwd: repoRoot });
  } else if (out.branch) out.branch.deleted = !revParse(repoRoot, `refs/heads/${branch}`);
  markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env });
  out.ok = true;
  return out;
}

/* ------------------------------------------------------------ counts */

/** Registered linked worktrees under the runtime's worktrees root of `repoRoot` (what the runtime makes there). */
const runtimeTreesOf = (repoRoot, opts) => { const root = worktreesRootOf(repoRoot); return worktreeList(repoRoot, opts).filter((w) => inside(w.path, root)); };

/**
 * Each repo's live worktree count against its cap, with its orphans: a live row whose directory is gone, or a git
 * worktree under <repo>/.starciwork/worktrees no live row owns. `linked` counts every linked worktree git knows (agent
 * lanes too); `over` when either count passes the cap. `repos`: extra repo roots to include (ledger and bound repos, the
 * runtime's own). [{repoRoot, live, linked, cap, orphans: [{path, why}], over}]
 */
export function worktreeCounts({ repos = [], env = process.env, settings = worktreeSettings(), git = null } = {}) {
  let rows = [], known = [];
  try { rows = withRegistry((m) => m.liveWorktrees(), env); known = withRegistry((m) => m.worktreeRepos(), env); } catch { rows = []; known = []; }
  const all = new Map();
  for (const r of [...known, ...repos.filter(Boolean)]) { if (!fs.existsSync(r)) continue; const home = mainRootOf(r, { git }); const k = key(home); if (!all.has(k)) all.set(k, home); }
  const out = [];
  for (const repoRoot of all.values()) {
    const mine = rows.filter((r) => samePath(r.repo_root, repoRoot));
    const orphans = mine.filter((r) => !fs.existsSync(r.path)).map((r) => ({ path: r.path, why: 'registered, directory gone' }));
    for (const w of runtimeTreesOf(repoRoot, { git })) if (!mine.some((r) => samePath(r.path, w.path))) orphans.push({ path: w.path, why: w.prunable ? 'prunable registration' : 'no live registry row' });
    // Every linked worktree git knows, the runtime's or not (agent lanes): the cap is the repository's.
    const linked = Math.max(0, worktreeList(repoRoot, { git }).length - 1);
    out.push({ repoRoot, live: mine.length, linked, cap: settings.capPerRepo, orphans, over: Math.max(mine.length, linked) > settings.capPerRepo });
  }
  return out;
}

/* ------------------------------------------------------------ gc */

/** The default owner-op status lookup: every registered ledger, read-only, cached for one pass. */
function ledgerStatusLookup(env) {
  const cache = new Map();
  let ledgers = null;
  const readers = new Map();
  const lookup = (ledgerId, jobId) => {
    const k = `${ledgerId ?? '*'}\0${jobId}`;
    if (cache.has(k)) return cache.get(k);
    let status = null;
    try {
      ledgers ??= withRegistry((m) => m.listLedgers(), env);
      for (const l of ledgers.filter((x) => !ledgerId || x.ledgerId === ledgerId)) {
        if (!l.file || !fs.existsSync(l.file)) continue;
        if (!readers.has(l.file)) { try { readers.set(l.file, openLedgerReader(l.file)); } catch { readers.set(l.file, null); } }
        const h = readers.get(l.file);
        const row = h?.db?.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
        if (row) { status = row.status; break; }
      }
    } catch { status = null; }
    cache.set(k, status);
    return status;
  };
  lookup.close = () => { for (const h of readers.values()) { try { h?.close?.(); } catch { /* closed */ } } };
  return lookup;
}

const hashOf = (p) => crypto.createHash('sha1').update(key(p)).digest('hex').slice(0, 10);
const pidAlive = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; } };
const descriptionOf = (repoRoot, branch) => (branch ? plain(['config', '--get', `branch.${branch}.description`], { cwd: repoRoot }).stdout || null : null);
const ageOf = (p, now) => { try { return now - fs.statSync(p).mtimeMs; } catch { return Infinity; } };

/**
 * Why a live registry row is collectable, or null (keep). Pure over its inputs.
 *   owner-settled   its owner job is settled (an op: its ledger job; a supervisor staging: its [Worker] sup job)
 *   owner-unknown   its owner job is in no ledger and the row is older than ownerGoneMs
 *   branch-merged   (no owner op) its branch moved past its base and is in main
 *   owner-gone      (non-op kinds) its creating process is gone and the row is older than ownerGoneMs
 */
export function collectReason({ row, jobStatus = null, merged = false, ownerAlive = true, now = Date.now(), ownerGoneMs = DEFAULTS.ownerGoneMs }) {
  const age = now - Number(row.created_at ?? now);
  if (row.job_id || (row.kind === 'supervisor-staging' && row.lane)) {
    if (jobStatus && SETTLED.has(jobStatus)) return 'owner-settled';
    if (!jobStatus && age > ownerGoneMs) return 'owner-unknown';
    return null; // a live owner op keeps its tree whatever its branch (it is removed after its settle)
  }
  if (merged) return 'branch-merged';
  if (row.kind !== 'op' && !ownerAlive && age > ownerGoneMs) return 'owner-gone';
  return null;
}

/**
 * One GC pass over every worktree the runtime made. Seams: jobStatusOf(ledgerId, jobId) -> status | null, supStatusOf(supJobId),
 * ownerAlive(pid) -> bool, now. apply false: the plan only. [{path, repoRoot, reason, action, ok, preserved, error}]
 */
const supLookup = (jobId, env) => { try { return withRegistry((m) => m.supJob(jobId)?.status ?? null, env); } catch { return null; } };

export function gcWorktrees({ env = process.env, now = Date.now(), apply = true, jobStatusOf = null, supStatusOf = null, ownerAlive = pidAlive, settings = worktreeSettings(), repos = [], git = null,
  budgetMs = settings.gcBudgetMs, clock = Date.now } = {}) {
  const lookup = jobStatusOf ?? ledgerStatusLookup(env);
  const items = [];
  const started = clock();
  // A removal that ever changed a main checkout stops the worktree GC until an operator clears it (worktrees.mjs resume).
  let stopped = null;
  try { stopped = withRegistry((m) => m.worktreeGcStop(), env); } catch { stopped = null; }
  if (stopped) return [{ action: 'stopped', ok: false, reason: 'main-checkout-damaged', error: `stopped since ${new Date(stopped.at).toISOString()}: ${(stopped.damage ?? []).join('; ').slice(0, 200)}; inspect ${stopped.path}, then node scripts/lib/worktrees.mjs resume` }];
  // A bounded pass: removals stop once the time budget is spent (the rest waits for the next pass), and a removal that
  // touched the main checkout stops the GC at once.
  const halt = () => {
    const bad = items.at(-1)?.fatal ? items.at(-1) : null;
    if (bad) {
      try { withRegistry((m) => m.setWorktreeGcStop({ at: clock(), path: bad.path, damage: bad.damage ?? [] }), env); } catch { /* the item itself reports it */ }
      items.push({ action: 'stopped', ok: false, reason: 'main-checkout-damaged', error: 'a removal changed the main checkout: the worktree GC stopped' });
      return true;
    }
    if (apply && clock() - started > budgetMs) { items.push({ action: 'deferred', ok: null, reason: 'time-budget', error: null }); return true; }
    return false;
  };
  try {
    let rows = [];
    try { rows = withRegistry((m) => m.liveWorktrees(), env); } catch (error) { return [{ action: 'error', ok: false, error: String(error?.message ?? error).slice(0, 200) }]; }
    for (const row of rows) {
      const repoRoot = path.resolve(row.repo_root);
      if (!fs.existsSync(row.path)) {
        const reg = fs.existsSync(repoRoot) ? registeredAt(repoRoot, row.path, { git }) : null;
        if (!reg) { if (apply) markRemoved(row.path, { env }); items.push({ path: row.path, repoRoot, reason: 'directory-gone', action: 'unregister', ok: true }); continue; }
      }
      const tip = row.branch ? revParse(repoRoot, `refs/heads/${row.branch}`) : revParse(row.path, 'HEAD');
      const main = revParse(repoRoot, 'main');
      const merged = Boolean(tip && main && row.base_sha && tip !== row.base_sha && isAncestor(repoRoot, tip, main));
      let pid = null;
      if (row.claim_id != null) { try { pid = withRegistry((m) => m.db.prepare('SELECT owner_pid FROM claims WHERE claim_id=?').get(row.claim_id)?.owner_pid ?? null, env); } catch { pid = null; } }
      const ownerStatus = row.job_id ? lookup(row.ledger_id, row.job_id)
        : row.kind === 'supervisor-staging' && row.lane ? (supStatusOf ?? supLookup)(row.lane, env) : null;
      const reason = collectReason({ row, jobStatus: ownerStatus, merged, ownerAlive: pid == null ? false : ownerAlive(Number(pid)), now, ownerGoneMs: settings.ownerGoneMs });
      if (!reason) continue;
      if (halt()) return items;
      items.push(collect({ repoRoot, dir: row.path, branch: row.branch, name: row.job_id ?? row.lane ?? `${row.kind}-${hashOf(row.path)}`, reason, merged, apply, env, git }));
    }
    // Trees under <repo>/.starciwork/worktrees that no live row owns (made before the registry, or by a crashed run).
    const live = new Set(rows.map((r) => key(r.path)));
    const repoSet = new Map();
    for (const r of [...rows.map((x) => x.repo_root), ...repos]) if (r && fs.existsSync(r)) repoSet.set(key(r), path.resolve(r));
    try { for (const r of withRegistry((m) => m.worktreeRepos(), env)) if (fs.existsSync(r)) repoSet.set(key(r), path.resolve(r)); } catch { /* registry read failed above already */ }
    for (const repoRoot of repoSet.values()) {
      for (const w of runtimeTreesOf(repoRoot, { git })) {
        if (live.has(key(w.path))) continue;
        const jobId = descriptionOf(repoRoot, w.branch);
        const status = jobId ? lookup(null, jobId) : null;
        if (status && !SETTLED.has(status)) continue;
        if (!status && ageOf(w.path, now) <= settings.ownerGoneMs) continue;
        if (halt()) return items;
        items.push(collect({ repoRoot, dir: w.path, branch: w.branch, name: jobId ?? `orphan-${hashOf(w.path)}`, reason: status ? 'owner-settled' : 'orphan', merged: false, apply, env, git }));
      }
      if (apply) removeEmptyDirs(worktreesRootOf(repoRoot));
    }
    if (items.at(-1)?.fatal) halt();
  } finally { lookup.close?.(); }
  return items;
}

/** Empty directories left under the worktrees root (a removed tree's parent of the old <wf>/<op> layout), deepest first. */
function removeEmptyDirs(root) {
  const visit = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory() && !isLinkLike(path.join(dir, e.name)) && !fs.existsSync(path.join(dir, e.name, '.git'))) visit(path.join(dir, e.name));
    if (dir !== root) { try { if (!fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch { /* busy or not empty */ } }
  };
  visit(root);
}

function collect({ repoRoot, dir, branch, name, reason, merged, apply, env, git }) {
  if (!apply) return { path: dir, repoRoot, reason, action: 'would-remove', ok: null };
  const r = removeWorktree({ repoRoot, dir, branch, deleteBranch: branch ? (merged ? 'merged' : 'force') : null, preserve: { name }, env, git });
  return { path: dir, repoRoot, reason, action: 'remove', ok: r.ok, preserved: r.preserved?.ref ?? null, ...(r.ok ? {} : { error: r.reason }), ...(r.fatal ? { fatal: true, damage: r.damage } : {}) };
}

/* ------------------------------------------------------------ cli */

function main(argv) {
  const [verb, ...rest] = argv;
  const json = rest.includes('--json');
  if (verb === 'counts') {
    const rows = worktreeCounts({ repos: [path.resolve(SKILL_ROOT)] });
    console.log(json ? JSON.stringify(rows, null, 2) : rows.map((r) => `${r.over || r.orphans.length ? 'RED  ' : 'ok   '} ${r.repoRoot}: ${r.live}/${r.cap} runtime, ${r.linked} linked, ${r.orphans.length} orphan(s)`).join('\n') || 'no runtime worktree');
    return rows.some((r) => r.over || r.orphans.length) ? 1 : 0;
  }
  if (verb === 'gc') {
    const items = gcWorktrees({ apply: !rest.includes('--plan') });
    console.log(json ? JSON.stringify(items, null, 2) : items.map((i) => `${i.action} ${i.path} (${i.reason})${i.ok === false ? ` FAILED ${i.error}` : ''}${i.preserved ? ` preserved ${i.preserved}` : ''}`).join('\n') || 'nothing to collect');
    return items.some((i) => i.ok === false) ? 1 : 0;
  }
  if (verb === 'resume') {
    const cleared = withRegistry((m) => m.setWorktreeGcStop(null), process.env);
    console.log(cleared ? 'worktree GC resumed' : 'the worktree GC was not stopped');
    return 0;
  }
  console.error('use: worktrees.mjs counts [--json] | gc [--plan] [--json] | resume');
  return 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
