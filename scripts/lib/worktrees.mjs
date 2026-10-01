// worktrees.mjs — the registry, cap and GC of every worktree the runtime owns, and the ONE place a worktree is created or
// removed (owner decision WFWT, final: one worktree per Kernel workflow; never write it ourselves when Orca has it).
//
// Two homes, decided by who works in the tree:
//   Orca     an agent's workspace. The Kernel's workflow worktree (kind workflow) is created by Orca itself - the Kernel's
//            `orchestration worker-start --worktree new-child --repo <app> --base-branch main --name wf-<id>`
//            (scripts/kernel/workflow-worktree.mjs) - and the draw critic's placement (kind critic) by `orca worktree
//            create` (createOrcaWorktree). Orca owns the resource and lists it in its sidebar; the registry keys the row by
//            Orca's worktree id (orca_id) and the path Orca reported. reserveOrcaSlot takes the per-repo cap slot BEFORE
//            Orca creates anything (a pending row); bindOrcaWorktree turns it into the real row. removeOrcaWorktree:
//            every link removed as a link and zero asserted (safe-remove.mjs removeLinksUnder), then `orca worktree rm`,
//            the main checkout asserted untouched. Never git, never a raw delete.
//   git      a runtime-internal scratch tree no agent ever works in (land/push scratch, the verify-proof base tree, the
//            supervisor's revert lane, the [Worker] staging checkout until it moves to Orca): createScratchWorktree holds
//            the only `git worktree add` of the runtime scripts (scripts/checks/check-worktree-add.mjs fails any other,
//            in this file outside that function too), removeScratchWorktree the git removal (safe-remove.mjs
//            safeRemoveWorktree). Such a tree is created and removed by the same process; Orca never needs to see it.
//
//   cap      every row is reserved in machine.sqlite `worktrees` (owner, repo, branch, kind, created-at) atomically against
//            the per-repo cap (modules/kernel/product-land.yaml worktrees.capPerRepo): a workflow over the cap is refused
//            worktree-cap and its Kernel waits; the other kinds are counted, never refused.
//   gc       gcWorktrees removes a live tree whose owner ended - a workflow: its phase is stopped, finished or archived;
//            a critic: its owner job settled; a scratch tree: its branch is in main or its creating process has been
//            gone for worktrees.ownerGoneMs - always after preserving its work, each through the home that made it
//            (orca_id -> Orca, none -> git). It also reclaims unregistered git trees under <repo>/.starciwork/worktrees
//            whose job is not live. The reconciler GC controller runs it ACTIVE (controllers/gc.mjs key gc:worktrees).
//   counts   worktreeCounts: each repo's live count against its cap and its orphans (start.mjs --check).
//
// State of a row: pending (an Orca kind with no orca_id yet), live (removed_at NULL), removed, remove-failed
// (remove_error), preserved (archived_ref names the preserved/<name> branch).
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
import { safeRemoveWorktree, isLinkLike, removeLinksUnder, mainCheckoutGuard, mainCheckoutDamage } from './safe-remove.mjs';
import { WORKTREES_REL } from './worktree-exclude.mjs';
import { worktreeCreate } from '../api/orca/worktree-create.mjs';
import { worktreeRm } from '../api/orca/worktree-rm.mjs';
import { worktreeList as orcaWorktreeList } from '../api/orca/worktree-list.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { withMachine, pidAlive } from '../../engine/machine-db.mjs';
import { openLedgerReader } from '../../engine/ledger-db.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETTINGS_FILE = path.join(SKILL_ROOT, 'modules', 'kernel', 'product-land.yaml');
export const PRESERVED_PREFIX = 'preserved';
/** The registry kinds (machine.sqlite worktrees.kind CHECK, 0003-worktrees-workflow-orca). */
export const WORKTREE_KINDS = Object.freeze(['workflow', 'critic', 'land-scratch', 'push-scratch', 'supervisor-staging', 'lane']);
/** The kinds Orca creates and removes: an agent's workspace. */
export const ORCA_KINDS = Object.freeze(['workflow', 'critic']);
/** The kinds the runtime creates with git: a runtime-internal scratch tree no agent works in. */
export const SCRATCH_KINDS = Object.freeze(WORKTREE_KINDS.filter((k) => !ORCA_KINDS.includes(k)));
/** The workflow phases after which its worktree is collectable (runtime 0001-init workflows.phase). */
export const ENDED_WORKFLOW_PHASES = Object.freeze(['stopped', 'finished', 'archived']);
const ENDED = new Set(ENDED_WORKFLOW_PHASES);
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
const sameTree = (a, b) => key(a) === key(b);
const inside = (child, parent) => { const rel = path.relative(key(parent), key(child)); return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel); };
const posixPath = (p) => String(p).replace(/\\/g, '/');
const gone = (p) => { try { fs.lstatSync(p); return false; } catch { return true; } };

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
export const registeredAt = (repoRoot, dir, opts) => worktreeList(repoRoot, opts).find((w) => sameTree(w.path, dir)) ?? null;
export const worktreesRootOf = (repoRoot) => path.join(repoRoot, ...WORKTREES_REL.split('/'));

/* ------------------------------------------------------------ registry */

/** fn(handle) over machine.sqlite (the registry's one writer, engine/machine-db.mjs). */
const withRegistry = (fn, env) => withMachine(fn, { env });

/** The owner-process claim of a registered worktree (claims.owner_pid): the GC's "owner gone" signal. */
function claim({ dir, ownerPid, env }) {
  try {
    withRegistry((m) => m.transaction((db) => {
      db.prepare('UPDATE claims SET released_at=? WHERE resource_path=? AND released_at IS NULL AND swept_at IS NULL').run(Date.now(), dir);
      const claimId = m.claimResource({ resourcePath: dir, kind: 'worktree', ownerPid: Number(ownerPid) || process.pid, hasJunctions: true });
      db.prepare('UPDATE worktrees SET claim_id=? WHERE path=?').run(claimId, dir);
    }), env);
  } catch { /* the row stands; the GC judges it by its owner or age */ }
}

/** Record a worktree gone (its row removed, its claim released). `error`: the removal failed and is retried. */
export function markRemoved(dir, { error = null, preservedRef = null, env = process.env } = {}) {
  try {
    return withRegistry((m) => m.transaction(() => {
      const row = m.worktreeRow(dir);
      if (!row) return false;
      m.removedWorktree(dir, { error, archivedRef: preservedRef });
      if (!error && row.claim_id != null) m.releaseClaim(row.claim_id);
      return true;
    }), env);
  } catch { return false; }
}

/* ------------------------------------------------------------ orca */

/** The Orca worktree calls the runtime makes (scripts/api/orca wrappers). Specs pass a fake with the same shape. */
export const orcaWorktreeClient = Object.freeze({ create: worktreeCreate, remove: worktreeRm, list: orcaWorktreeList });
/** The registry key of an Orca slot not bound yet (a row key, never a directory on disk). */
const pendingPathOf = (home, kind, owner) => path.join(home, '.starciwork', 'orca-pending', `${kind}-${String(owner).replace(/[^A-Za-z0-9._-]/g, '_')}`);
/** A reserved Orca slot whose worktree is not bound yet. */
export const isPendingRow = (row) => ORCA_KINDS.includes(row?.kind) && !row?.orca_id;

/**
 * Take the per-repo cap slot of an Orca worktree about to be created (a pending row). kind: one of ORCA_KINDS; slotKey:
 * the owner's id (a workflow id, a critic name). cap: default worktrees.capPerRepo for a workflow, none for a critic.
 * {ok, pending, repoRoot} | {ok:false, reason:'worktree-cap'|'worktree-registry-unavailable', live?, cap?, detail}
 */
export function reserveOrcaSlot({ repoRoot, kind, slotKey, owner = {}, cap = undefined, env = process.env, git = null, settings = worktreeSettings() }) {
  if (!ORCA_KINDS.includes(kind)) throw new Error(`reserveOrcaSlot: ${kind} is not an Orca kind (${ORCA_KINDS.join(', ')})`);
  const home = mainRootOf(repoRoot, { git });
  const pending = pendingPathOf(home, kind, slotKey);
  const limit = cap === undefined ? (kind === 'workflow' ? settings.capPerRepo : null) : cap;
  try {
    const r = withRegistry((m) => m.reserveWorktree({ path: pending, kind, repoRoot: home, branch: null, baseSha: null, ledgerId: owner.ledgerId ?? null,
      workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap: limit }), env);
    if (!r.ok) return { ok: false, reason: r.reason, live: r.live, cap: r.cap, detail: `${home} holds ${r.live} live worktree(s), cap ${r.cap}` };
    return { ok: true, pending, repoRoot: home };
  } catch (error) {
    return { ok: false, reason: 'worktree-registry-unavailable', detail: String(error?.message ?? error).slice(0, 300) };
  }
}

/** Give a pending slot back (Orca created nothing). */
export function releaseOrcaSlot(pending, { env = process.env } = {}) {
  try { return withRegistry((m) => m.dropWorktree(pending), env); } catch { return false; }
}

/**
 * Bind a reserved slot to the worktree Orca created: the pending row goes and the row keyed by Orca's id, at the path
 * Orca reported, takes its place with its branch. Without a pending slot (an Orca worktree found again after a crash)
 * the row is registered uncapped. {ok, row} | {ok:false, reason:'worktree-registry-unavailable', detail}
 */
export function bindOrcaWorktree({ pending = null, repoRoot, kind, orcaId, dir, branch = null, baseSha = null, owner = {}, ownerPid = process.pid, env = process.env, git = null }) {
  if (!ORCA_KINDS.includes(kind)) throw new Error(`bindOrcaWorktree: ${kind} is not an Orca kind (${ORCA_KINDS.join(', ')})`);
  const target = path.resolve(dir);
  const home = mainRootOf(repoRoot, { git });
  try {
    const row = withRegistry((m) => m.transaction((db) => {
      const held = pending ? m.worktreeRow(pending) : null;
      if (pending) db.prepare('DELETE FROM worktrees WHERE path=? AND orca_id IS NULL').run(path.resolve(pending));
      db.prepare('UPDATE worktrees SET orca_id=NULL WHERE orca_id=? AND path<>?').run(orcaId, target);
      m.reserveWorktree({ path: target, kind, repoRoot: home, branch, baseSha, ledgerId: owner.ledgerId ?? held?.ledger_id ?? null,
        workflowId: owner.workflowId ?? held?.workflow_id ?? null, jobId: owner.jobId ?? held?.job_id ?? null, lane: owner.lane ?? held?.lane ?? null }, { cap: null });
      db.prepare('UPDATE worktrees SET orca_id=?, created_at=COALESCE(?,created_at) WHERE path=?').run(orcaId, held?.created_at ?? null, target);
      return m.worktreeRow(target);
    }), env);
    claim({ dir: target, ownerPid, env });
    return { ok: true, row };
  } catch (error) {
    return { ok: false, reason: 'worktree-registry-unavailable', detail: String(error?.message ?? error).slice(0, 300) };
  }
}

/** The live registry row Orca knows by `orcaId`, or null. */
export function orcaRowOf(orcaId, { env = process.env } = {}) {
  try { return withRegistry((m) => m.db.prepare('SELECT * FROM worktrees WHERE orca_id=? AND removed_at IS NULL').get(orcaId) ?? null, env); } catch { return null; }
}

/**
 * Create an Orca worktree (a Kernel workflow's, scripts/kernel/workflow-worktree.mjs; the draw critic's placement): the
 * slot reserved, `orca worktree create --repo path:<repo> --name <name> --base-branch <base> --setup <setup> --no-parent`,
 * the row bound to what Orca returned (its id, path and branch).
 * {ok, id, path, branch, head} | {ok:false, reason:'worktree-cap'|'worktree-registry-unavailable'|'orca-worktree-create-failed', detail}
 */
export function createOrcaWorktree({ repoRoot, kind, name, base, setup = 'skip', owner = {}, ownerPid = process.pid, cap = undefined, comment = null, env = process.env, git = null,
  orca = orcaWorktreeClient, settings = worktreeSettings() }) {
  const slot = reserveOrcaSlot({ repoRoot, kind, slotKey: name, owner, cap, env, git, settings });
  if (!slot.ok) return slot;
  const made = orca.create({ repo: `path:${posixPath(slot.repoRoot)}`, name, baseBranch: base, setup, ...(comment ? { comment } : {}) });
  if (!made?.ok || !made.worktree?.id || !made.worktree?.path) {
    releaseOrcaSlot(slot.pending, { env });
    return { ok: false, reason: 'orca-worktree-create-failed', detail: String(made?.error ?? made?.errorCode ?? 'no worktree in the receipt').slice(0, 400) };
  }
  const w = made.worktree;
  const bound = bindOrcaWorktree({ pending: slot.pending, repoRoot: slot.repoRoot, kind, orcaId: w.id, dir: w.path, branch: w.branch ?? null, baseSha: w.head ?? null, owner, ownerPid, env, git });
  if (!bound.ok) {
    // An unregistered Orca tree is a leak no GC pass sees: it goes straight back.
    removeOrcaWorktree({ repoRoot: slot.repoRoot, orcaId: w.id, dir: w.path, env, git, orca });
    return { ok: false, reason: bound.reason, detail: bound.detail };
  }
  return { ok: true, id: w.id, path: path.resolve(w.path), branch: w.branch ?? null, head: w.head ?? null };
}

/**
 * Remove a worktree Orca made (the one Orca removal; scripts/kernel/workflow-worktree.mjs releaseWorkflowWorktree, the
 * critic, the GC). preserve: {name} -> preserveWork first (a failure keeps the tree). Then every link in the tree removed
 * as a link and ZERO asserted (safe-remove.mjs removeLinksUnder; a stuck link keeps the tree: link-stuck), `orca worktree
 * rm --worktree id:<orcaId> --force`, the main checkout asserted untouched (a violation is fatal: main-checkout-damaged,
 * and the GC stops), the directory and its git registration verified gone, the row marked removed. Orca deletes the
 * branch itself when it can prove it merged; `deleteBranch` 'merged' (`git branch -d`) or 'force' (`-D`, only after a
 * preserve) handles a branch it kept. {ok, path, links, preserved, branch} | {ok:false, reason, fatal?, ...}
 */
export function removeOrcaWorktree({ repoRoot, orcaId, dir, branch = null, deleteBranch = null, preserve = null, main = 'main', env = process.env, git = null, orca = orcaWorktreeClient }) {
  const target = path.resolve(dir);
  const out = { ok: false, path: target, orcaId, links: 0, preserved: null, branch: branch ? { name: branch, deleted: false } : null };
  const home = fs.existsSync(repoRoot) ? mainRootOf(repoRoot, { git }) : path.resolve(repoRoot);
  if (sameTree(home, target)) return { ...out, reason: 'remove-failed', errors: [{ path: target, code: 'REFUSED', message: 'refusing to remove the main checkout' }] };
  if (preserve && fs.existsSync(target)) {
    const p = preserveWork({ repoRoot: home, dir: target, name: preserve.name, main });
    if (!p.ok) { markRemoved(target, { error: `preserve: ${p.step ?? p.reason}`, env }); return { ...out, reason: 'preserve-failed', detail: p }; }
    out.preserved = p.ref ? { ref: p.ref, sha: p.sha, dirty: p.dirty } : null;
  }
  const before = fs.existsSync(home) ? mainCheckoutGuard(home, { git: runnerOf(git) }) : null;
  const unlinked = removeLinksUnder(target);
  out.links = unlinked.links;
  if (!unlinked.ok) {
    markRemoved(target, { error: `link-stuck: ${unlinked.errors[0]?.path ?? ''}`.slice(0, 300), env });
    return { ...out, reason: 'link-stuck', errors: unlinked.errors.slice(0, 5) };
  }
  const rm = fs.existsSync(target) || (fs.existsSync(home) && registeredAt(home, target, { git })) ? orca.remove({ worktree: `id:${orcaId}`, force: true }) : { ok: true, removed: true };
  if (before) {
    const damage = mainCheckoutDamage(before, mainCheckoutGuard(home, { git: runnerOf(git) }));
    if (damage.length) {
      markRemoved(target, { error: `main checkout damaged: ${damage.join('; ').slice(0, 200)}`, env });
      return { ...out, reason: 'main-checkout-damaged', fatal: true, damage };
    }
  }
  if (!rm?.ok) {
    markRemoved(target, { error: `orca worktree rm: ${String(rm?.error ?? rm?.errorCode ?? 'refused').slice(0, 200)}`, env });
    return { ...out, reason: 'orca-worktree-rm-failed', detail: String(rm?.error ?? rm?.errorCode ?? '').slice(0, 300), hostUnavailable: rm?.hostUnavailable === true };
  }
  const dirGone = gone(target);
  const pruned = !(fs.existsSync(home) && registeredAt(home, target, { git }));
  if (!dirGone || !pruned) {
    const reason = dirGone ? 'prune-unverified' : 'dir-remains';
    markRemoved(target, { error: reason, env });
    return { ...out, reason };
  }
  if (branch && deleteBranch && revParse(home, `refs/heads/${branch}`)) {
    const deleted = deleteBranchOf({ repoRoot: home, branch, mode: deleteBranch, main, git });
    out.branch.deleted = deleted.ok;
    if (!deleted.ok) { markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env }); return { ...out, reason: 'branch-delete-failed', detail: deleted.detail }; }
  } else if (out.branch) out.branch.deleted = !revParse(home, `refs/heads/${branch}`);
  markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env });
  out.ok = true;
  return out;
}

/** Delete a tree's branch after its removal: 'merged' -> `git branch -d` (judged against `main`), 'force' -> `-D`. {ok, detail?} */
function deleteBranchOf({ repoRoot, branch, mode, main, git }) {
  const run = runnerOf(git);
  const flag = mode === 'force' ? '-D' : '-d';
  let d = run(['branch', flag, branch], { cwd: repoRoot });
  // `branch -d` judges "merged" against the repo's HEAD; a repo not on main is judged against main here.
  if (!d.ok && flag === '-d') { const tip = revParse(repoRoot, `refs/heads/${branch}`), m = revParse(repoRoot, main); if (tip && m && isAncestor(repoRoot, tip, m)) d = run(['branch', '-D', branch], { cwd: repoRoot }); }
  if (d.ok) run(['config', '--remove-section', `branch.${branch}`], { cwd: repoRoot });
  return d.ok ? { ok: true } : { ok: false, detail: d.stderr.slice(0, 200) };
}

/* ------------------------------------------------------------ scratch (git) */

/**
 * Create one runtime-internal scratch worktree: the only `git worktree add` of the runtime. kind: one of SCRATCH_KINDS -
 * an agent's workspace is an Orca kind and is refused here. Exactly one of `detach` (a detached HEAD at `base`),
 * `newBranch` (branch `branch` created at `base`) or an existing `branch`. owner: {ledgerId, workflowId, jobId, lane}.
 * cap: none unless given. git: the caller's runner (args, {cwd}) -> {ok|status, stdout|out, stderr|err}.
 * {ok, path, created, registered} | {ok:false, reason: 'worktree-cap'|'worktree-path-occupied'|'worktree-add-failed', detail?, live?, cap?}
 */
export function createScratchWorktree({ repoRoot, dir, kind, base = null, branch = null, newBranch = false, detach = false, owner = {}, ownerPid = process.pid,
  cap = null, env = process.env, git = null }) {
  if (!SCRATCH_KINDS.includes(kind)) throw new Error(`createScratchWorktree: ${kind} is not a scratch kind (${SCRATCH_KINDS.join(', ')}); an agent's workspace is created by Orca`);
  const run = runnerOf(git);
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

/** Register a scratch worktree that exists (a requeued attempt reusing its tree): the row is refreshed, never capped. */
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

/* ------------------------------------------------------------ preserve */

const tmpIndex = () => path.join(os.tmpdir(), `starci-preserve-${process.pid}-${crypto.randomBytes(4).toString('hex')}.index`);

/**
 * One commit holding everything a worktree has: `head` plus every tracked and untracked (not ignored) change, written
 * through a temporary index - the worktree's own index, files and hooks are untouched; `head` itself when nothing is
 * dirty. node_modules and the worktrees container are never staged.
 * {ok, sha, dirty} | {ok:false, step, detail}
 */
export function snapshotCommit(worktree, head, message) {
  const status = plain(['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude,glob)**/node_modules', ':(exclude,glob)**/node_modules/**', `:(exclude)${WORKTREES_REL}`], { cwd: worktree });
  if (!status.ok) return { ok: false, step: 'status', detail: status.stderr.slice(0, 200) };
  if (!status.stdout) return { ok: true, sha: head, dirty: false };
  const index = tmpIndex();
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    for (const args of [['read-tree', head], ['add', '-A', '--', '.', ':(exclude,glob)**/node_modules', ':(exclude,glob)**/node_modules/**', `:(exclude)${WORKTREES_REL}`]]) {
      const r = plain(args, { cwd: worktree, env });
      if (!r.ok) return { ok: false, step: 'index', detail: `${args.slice(0, 2).join(' ')}: ${r.stderr.slice(0, 200)}` };
    }
    const tree = plain(['write-tree'], { cwd: worktree, env });
    if (!tree.ok || !tree.stdout) return { ok: false, step: 'write-tree', detail: tree.stderr.slice(0, 200) };
    const commit = plain(['-c', 'user.name=starci', '-c', 'user.email=runtime@starci.local', 'commit-tree', tree.stdout, '-p', head, '-m', message], { cwd: worktree, env });
    if (!commit.ok || !commit.stdout) return { ok: false, step: 'commit-tree', detail: commit.stderr.slice(0, 200) };
    return { ok: true, sha: commit.stdout, dirty: true };
  } finally { try { fs.rmSync(index, { force: true }); } catch { /* temp */ } }
}

/**
 * Preserve what a worktree holds that main does not: its uncommitted changes (snapshotCommit) and its unlanded commits,
 * as refs/heads/preserved/<name>. Nothing to preserve (clean and in main) -> no ref. {ok, ref|null, sha|null, dirty}
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
  const u = plain(['update-ref', ref, sha], { cwd: repoRoot });
  if (!u.ok) return { ok: false, reason: 'preserve-failed', step: 'update-ref', detail: u.stderr.slice(0, 200) };
  return { ok: true, ref, sha, dirty };
}

/* ------------------------------------------------------------ remove (scratch) */

/**
 * Remove a scratch worktree the runtime made with git. preserve: {name} -> preserveWork first (a failure keeps the
 * tree). Then safe-remove.mjs safeRemoveWorktree: every link removed as a link (found without following one), zero links
 * asserted, `git worktree remove --force`, prune, and the main checkout asserted untouched (a violation is fatal:
 * {fatal:true, reason:'main-checkout-damaged'} and the GC stops). The removal is verified, and the branch is deleted:
 * 'merged' -> `git branch -d` (git refuses an unmerged one), 'force' -> `git branch -D` (only after a preserve).
 * {ok, path, verified: {dirGone, pruned}, links, preserved, branch} | {ok:false, reason, fatal?, ...}
 */
export function removeScratchWorktree({ repoRoot, dir, branch = null, deleteBranch = null, preserve = null, main = 'main', env = process.env, git = null }) {
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
    const deleted = deleteBranchOf({ repoRoot, branch, mode: deleteBranch, main, git });
    out.branch.deleted = deleted.ok;
    if (!deleted.ok) { markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env }); return { ...out, ok: false, reason: 'branch-delete-failed', detail: deleted.detail }; }
  } else if (out.branch) out.branch.deleted = !revParse(repoRoot, `refs/heads/${branch}`);
  markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env });
  out.ok = true;
  return out;
}

/* ------------------------------------------------------------ counts */

/** Registered linked worktrees under the runtime's git worktrees root of `repoRoot`. */
const runtimeTreesOf = (repoRoot, opts) => { const root = worktreesRootOf(repoRoot); return worktreeList(repoRoot, opts).filter((w) => inside(w.path, root)); };
/** A pending Orca slot older than ownerGoneMs: its creator died between the reservation and the bind. */
const stalePending = (row, now, ownerGoneMs) => isPendingRow(row) && now - Number(row.created_at ?? now) > ownerGoneMs;

/**
 * Each repo's live worktree count against its cap, with its orphans: a live row whose directory is gone (a pending Orca
 * slot only once it is stale), or a git worktree under <repo>/.starciwork/worktrees no live row owns. `linked` counts
 * every linked worktree git knows (Orca's and agent lanes too); `over` when either count passes the cap. `repos`: extra
 * repo roots to include. [{repoRoot, live, linked, cap, orphans: [{path, why}], over}]
 */
export function worktreeCounts({ repos = [], env = process.env, settings = worktreeSettings(), git = null, now = Date.now() } = {}) {
  let rows = [], known = [];
  try { rows = withRegistry((m) => m.liveWorktrees(), env); known = withRegistry((m) => m.worktreeRepos(), env); } catch { rows = []; known = []; }
  const all = new Map();
  for (const r of [...known, ...repos.filter(Boolean)]) { if (!fs.existsSync(r)) continue; const home = mainRootOf(r, { git }); const k = key(home); if (!all.has(k)) all.set(k, home); }
  const out = [];
  for (const repoRoot of all.values()) {
    const mine = rows.filter((r) => sameTree(r.repo_root, repoRoot));
    const orphans = mine.filter((r) => (isPendingRow(r) ? stalePending(r, now, settings.ownerGoneMs) : !fs.existsSync(r.path)))
      .map((r) => ({ path: r.path, why: isPendingRow(r) ? 'Orca slot reserved, never bound' : 'registered, directory gone' }));
    for (const w of runtimeTreesOf(repoRoot, { git })) if (!mine.some((r) => sameTree(r.path, w.path))) orphans.push({ path: w.path, why: w.prunable ? 'prunable registration' : 'no live registry row' });
    const linked = Math.max(0, worktreeList(repoRoot, { git }).length - 1);
    out.push({ repoRoot, live: mine.length, linked, cap: settings.capPerRepo, orphans, over: Math.max(mine.length, linked) > settings.capPerRepo });
  }
  return out;
}

/* ------------------------------------------------------------ gc */

/** The default owner lookups over every registered ledger, read-only, cached for one pass: a job's status, a workflow's phase. */
function ledgerLookup(env) {
  const cache = new Map();
  let ledgers = null;
  const readers = new Map();
  const ask = (ledgerId, k, sql, arg) => {
    const ck = `${k}\0${ledgerId ?? '*'}\0${arg}`;
    if (cache.has(ck)) return cache.get(ck);
    let value = null;
    try {
      ledgers ??= withRegistry((m) => m.listLedgers(), env);
      for (const l of ledgers.filter((x) => !ledgerId || x.ledgerId === ledgerId)) {
        if (!l.file || !fs.existsSync(l.file)) continue;
        if (!readers.has(l.file)) { try { readers.set(l.file, openLedgerReader(l.file)); } catch { readers.set(l.file, null); } }
        const row = readers.get(l.file)?.db?.prepare(sql).get(arg);
        if (row) { value = Object.values(row)[0] ?? null; break; }
      }
    } catch { value = null; }
    cache.set(ck, value);
    return value;
  };
  const jobStatus = (ledgerId, jobId) => ask(ledgerId, 'job', 'SELECT status FROM jobs WHERE job_id=?', jobId);
  jobStatus.workflowPhase = (ledgerId, workflowId) => ask(ledgerId, 'wf', 'SELECT phase FROM workflows WHERE workflow_id=?', workflowId);
  jobStatus.close = () => { for (const h of readers.values()) { try { h?.close?.(); } catch { /* closed */ } } };
  return jobStatus;
}

const hashOf = (p) => crypto.createHash('sha1').update(key(p)).digest('hex').slice(0, 10);
const descriptionOf = (repoRoot, branch) => (branch ? plain(['config', '--get', `branch.${branch}.description`], { cwd: repoRoot }).stdout || null : null);
const ageOf = (p, now) => { try { return now - fs.statSync(p).mtimeMs; } catch { return Infinity; } };

/**
 * Why a live registry row is collectable, or null (keep). Pure over its inputs.
 *   owner-settled   a workflow row: its workflow phase ended; any other row with an owner job: that job settled (a
 *                   supervisor staging: its [Worker] sup job)
 *   owner-unknown   its owner is in no ledger and the row is older than ownerGoneMs
 *   branch-merged   (no owner) its branch moved past its base and is in main
 *   owner-gone      (no owner) its creating process is gone and the row is older than ownerGoneMs
 */
export function collectReason({ row, jobStatus = null, workflowPhase = null, merged = false, ownerAlive = true, now = Date.now(), ownerGoneMs = DEFAULTS.ownerGoneMs }) {
  const age = now - Number(row.created_at ?? now);
  if (row.kind === 'workflow') {
    if (workflowPhase && ENDED.has(workflowPhase)) return 'owner-settled';
    if (!workflowPhase && age > ownerGoneMs) return 'owner-unknown';
    return null; // a live workflow keeps its tree whatever its branch (finishWorkflow releases it)
  }
  if (row.job_id || (row.kind === 'supervisor-staging' && row.lane)) {
    if (jobStatus && SETTLED.has(jobStatus)) return 'owner-settled';
    if (!jobStatus && age > ownerGoneMs) return 'owner-unknown';
    return null;
  }
  if (merged) return 'branch-merged';
  if (!ownerAlive && age > ownerGoneMs) return 'owner-gone';
  return null;
}

const supLookup = (jobId, env) => { try { return withRegistry((m) => m.supJob(jobId)?.status ?? null, env); } catch { return null; } };

/**
 * One GC pass over every worktree the runtime owns. Seams: jobStatusOf(ledgerId, jobId) -> status | null (its
 * .workflowPhase(ledgerId, workflowId) -> phase | null), supStatusOf(supJobId), ownerAlive(pid) -> bool, now, orca (the
 * Orca client of removeOrcaWorktree). apply false: the plan only. [{path, repoRoot, reason, action, ok, preserved, error}]
 */
export function gcWorktrees({ env = process.env, now = Date.now(), apply = true, jobStatusOf = null, supStatusOf = null, ownerAlive = pidAlive, settings = worktreeSettings(), repos = [], git = null,
  budgetMs = settings.gcBudgetMs, clock = Date.now, orca = orcaWorktreeClient } = {}) {
  const lookup = jobStatusOf ?? ledgerLookup(env);
  const phaseOf = lookup.workflowPhase ?? (() => null);
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
      if (isPendingRow(row)) {
        // A slot whose creator died before Orca answered: the slot goes back (an Orca tree it may have left is listed by
        // `orca worktree list` and released by hand; alpha.5 adopts it).
        if (stalePending(row, now, settings.ownerGoneMs)) { if (apply) markRemoved(row.path, { error: 'orca slot never bound', env }); items.push({ path: row.path, repoRoot, reason: 'slot-never-bound', action: 'unregister', ok: true }); }
        continue;
      }
      if (!fs.existsSync(row.path)) {
        const reg = fs.existsSync(repoRoot) ? registeredAt(repoRoot, row.path, { git }) : null;
        if (!reg) { if (apply) markRemoved(row.path, { env }); items.push({ path: row.path, repoRoot, reason: 'directory-gone', action: 'unregister', ok: true }); continue; }
      }
      const tip = row.branch ? revParse(repoRoot, `refs/heads/${row.branch}`) : revParse(row.path, 'HEAD');
      const main = revParse(repoRoot, 'main');
      const merged = Boolean(tip && main && row.base_sha && tip !== row.base_sha && isAncestor(repoRoot, tip, main));
      let pid = null;
      if (row.claim_id != null) { try { pid = withRegistry((m) => m.db.prepare('SELECT owner_pid FROM claims WHERE claim_id=?').get(row.claim_id)?.owner_pid ?? null, env); } catch { pid = null; } }
      const workflowPhase = row.kind === 'workflow' && row.workflow_id ? phaseOf(row.ledger_id, row.workflow_id) : null;
      const ownerStatus = row.kind === 'workflow' ? null : row.job_id ? lookup(row.ledger_id, row.job_id)
        : row.kind === 'supervisor-staging' && row.lane ? (supStatusOf ?? supLookup)(row.lane, env) : null;
      const reason = collectReason({ row, jobStatus: ownerStatus, workflowPhase, merged, ownerAlive: pid == null ? false : ownerAlive(Number(pid)), now, ownerGoneMs: settings.ownerGoneMs });
      if (!reason) continue;
      if (halt()) return items;
      items.push(collect({ row, repoRoot, dir: row.path, branch: row.branch, name: row.workflow_id && row.kind === 'workflow' ? `${row.workflow_id}/gc` : row.job_id ?? row.lane ?? `${row.kind}-${hashOf(row.path)}`,
        reason, merged, apply, env, git, orca }));
    }
    // git trees under <repo>/.starciwork/worktrees that no live row owns (made before the registry, or by a crashed run).
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
        items.push(collect({ row: null, repoRoot, dir: w.path, branch: w.branch, name: jobId ?? `orphan-${hashOf(w.path)}`, reason: status ? 'owner-settled' : 'orphan', merged: false, apply, env, git, orca }));
      }
      if (apply) removeEmptyDirs(worktreesRootOf(repoRoot));
    }
    if (items.at(-1)?.fatal) halt();
  } finally { lookup.close?.(); }
  return items;
}

/** Empty directories left under the worktrees root (a removed tree's parent), deepest first. */
function removeEmptyDirs(root) {
  const visit = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory() && !isLinkLike(path.join(dir, e.name)) && !fs.existsSync(path.join(dir, e.name, '.git'))) visit(path.join(dir, e.name));
    if (dir !== root) { try { if (!fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch { /* busy or not empty */ } }
  };
  visit(root);
}

/** Remove one collectable tree through the home that made it: Orca (the row has an orca_id) or git. */
function collect({ row, repoRoot, dir, branch, name, reason, merged, apply, env, git, orca }) {
  if (!apply) return { path: dir, repoRoot, reason, action: 'would-remove', ok: null, home: row?.orca_id ? 'orca' : 'git' };
  const deleteBranch = branch ? (merged ? 'merged' : 'force') : null;
  const r = row?.orca_id
    ? removeOrcaWorktree({ repoRoot, orcaId: row.orca_id, dir, branch, deleteBranch, preserve: { name }, env, git, orca })
    : removeScratchWorktree({ repoRoot, dir, branch, deleteBranch, preserve: { name }, env, git });
  return { path: dir, repoRoot, reason, action: 'remove', home: row?.orca_id ? 'orca' : 'git', ok: r.ok, preserved: r.preserved?.ref ?? null, ...(r.ok ? {} : { error: r.reason }), ...(r.fatal ? { fatal: true, damage: r.damage } : {}) };
}

/* ------------------------------------------------------------ cli */

function main(argv) {
  const [verb, ...rest] = argv;
  const json = rest.includes('--json');
  if (verb === 'counts') {
    const rows = worktreeCounts({ repos: [SKILL_ROOT] });
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
