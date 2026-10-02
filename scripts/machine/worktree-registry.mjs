// worktree-registry.mjs — the worktree registry rows, settings and GC judgement: the pure and in-process part of the
// runtime's worktree lifecycle (the kinds are scripts/lib/worktree-kinds.mjs). It runs no external tool: the git home is
// scripts/machine/worktree-git.mjs, the Orca home scripts/machine/worktree-orca.mjs, and the GC pass over both is
// scripts/machine/worktrees.mjs.
//
//   cap      every row is reserved in machine.sqlite `worktrees` (owner, repo, branch, kind, created-at) atomically against
//            the per-repo cap (modules/kernel/product-land.yaml worktrees.capPerRepo): a workflow over the cap is refused
//            worktree-cap and its Kernel waits; the other kinds are counted, never refused.
//
// State of a row: pending (an Orca kind with no orca_id yet), live (removed_at NULL), removed, remove-failed
// (remove_error), preserved (archived_ref names the preserved/<name> branch).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKTREES_REL } from '../lib/worktree-exclude.mjs';
import { ORCA_KINDS } from '../lib/worktree-kinds.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { insidePath } from '../lib/path-key.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETTINGS_FILE = path.join(SKILL_ROOT, 'modules', 'kernel', 'product-land.yaml');
export const PRESERVED_PREFIX = 'preserved';
/** The workflow phases after which its worktree is collectable (runtime 0001-init workflows.phase). */
export const ENDED_WORKFLOW_PHASES = Object.freeze(['stopped', 'finished', 'archived']);
/** Op job statuses whose worker still holds a terminal (runtime 0001-init jobs.status). */
export const TERMINAL_JOB_STATUSES = Object.freeze(['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown']);
const ENDED = new Set(ENDED_WORKFLOW_PHASES);
export const SETTLED_JOBS = new Set(SETTLED_JOB_LIST);
const WORKTREE_DEFAULTS = Object.freeze({ capPerRepo: 10, ownerGoneMs: 1_800_000, gcEveryMs: 300_000, gcBudgetMs: 120_000, rebaseMilestoneBehind: 20 });

/** worktrees.{capPerRepo, ownerGoneMs, gcEveryMs, gcBudgetMs, rebaseMilestoneBehind} of modules/kernel/product-land.yaml over the defaults. */
export function worktreeSettings(file = SETTINGS_FILE) {
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { doc = null; }
  const out = { ...WORKTREE_DEFAULTS };
  for (const k of Object.keys(WORKTREE_DEFAULTS)) { const n = Number(doc?.worktrees?.[k]); if (Number.isFinite(n) && n > 0) out[k] = n; }
  return out;
}

/* ------------------------------------------------------------ paths */

/** A tree's comparable identity: resolved, real where it exists, case-folded on Windows. */
export const treeKey = (p) => { let r = path.resolve(p); try { r = fs.realpathSync.native(r); } catch { /* missing */ } return process.platform === 'win32' ? r.toLowerCase() : r; };
export const sameTree = (a, b) => treeKey(a) === treeKey(b);
export const insideTree = (child, parent) => insidePath(parent, child, { key: treeKey });
export const isGone = (p) => { try { fs.lstatSync(p); return false; } catch { return true; } };
export const worktreesRootOf = (repoRoot) => path.join(repoRoot, ...WORKTREES_REL.split('/'));

/* ------------------------------------------------------------ registry */

/** fn(handle) over machine.sqlite (the registry's one writer, engine/db/machine.mjs). */
export const withRegistry = (fn, env) => withMachine(fn, { env });

/** The owner-process claim of a registered worktree (claims.owner_pid): the GC's "owner gone" signal. */
export function claimWorktree({ dir, ownerPid, env }) {
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

/** The registry key of an Orca slot not bound yet (a row key, never a directory on disk). */
export const pendingPathOf = (home, kind, owner) => path.join(home, '.starciwork', 'orca-pending', `${kind}-${String(owner).replace(/[^A-Za-z0-9._-]/g, '_')}`);
/** A reserved Orca slot whose worktree is not bound yet. */
export const isPendingRow = (row) => ORCA_KINDS.includes(row?.kind) && !row?.orca_id;
/** A pending Orca slot older than ownerGoneMs: its creator died between the reservation and the bind. */
export const stalePending = (row, now, ownerGoneMs) => isPendingRow(row) && now - Number(row.created_at ?? now) > ownerGoneMs;

/** Give a pending slot back (Orca created nothing). */
export function releaseOrcaSlot(pending, { env = process.env } = {}) {
  try { return withRegistry((m) => m.dropWorktree(pending), env); } catch { return false; }
}

/* ------------------------------------------------------------ gc judgement */

/**
 * Why a live registry row is collectable, or null (keep). Pure over its inputs.
 *   release-pending a workflow row its finish marked for release, once no agent of the workflow holds a terminal
 *   owner-settled   a workflow row: its workflow phase ended and no agent of it holds a terminal; any other row with an
 *                   owner job: that job settled (a supervisor staging: its [Worker] sup job)
 *   owner-unknown   its owner is in no ledger and the row is older than ownerGoneMs
 *   branch-merged   (no owner) its branch moved past its base and is in main
 *   owner-gone      (no owner) its creating process is gone and the row is older than ownerGoneMs
 */
export function collectReason({ row, jobStatus = null, workflowPhase = null, terminalsLive = 0, merged = false, ownerAlive = true, now = Date.now(), ownerGoneMs = WORKTREE_DEFAULTS.ownerGoneMs }) {
  const age = now - Number(row.created_at ?? now);
  if (row.kind === 'workflow') {
    // Never removed while the Kernel or an op still works in it (a removal from inside itself is never made).
    if (Number(terminalsLive) > 0) return null;
    if (row.release_pending_at != null) return 'release-pending';
    if (workflowPhase && ENDED.has(workflowPhase)) return 'owner-settled';
    if (!workflowPhase && age > ownerGoneMs) return 'owner-unknown';
    return null; // a live workflow keeps its tree whatever its branch
  }
  if (row.job_id || (row.kind === 'supervisor-staging' && row.lane)) {
    if (jobStatus && SETTLED_JOBS.has(jobStatus)) return 'owner-settled';
    if (!jobStatus && age > ownerGoneMs) return 'owner-unknown';
    return null;
  }
  if (merged) return 'branch-merged';
  if (!ownerAlive && age > ownerGoneMs) return 'owner-gone';
  return null;
}
