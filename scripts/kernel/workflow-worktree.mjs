// workflow-worktree.mjs — ONE worktree per Kernel workflow (owner decision WFWT, final; part A: creation, registry,
// launches, side concurrency, release).
//
//   create     ensureWorkflowWorktree, before the Kernel launch (scripts/kernel/start-workflow.mjs): Orca creates and owns
//              the tree - `orca worktree create --repo path:<app repo> --name wf-<workflowId> --base-branch main
//              --setup run --no-parent` (the existing repository hooks run; start-workflow then installs through
//              the native npmCi owner before launch, without node_modules links) - through createOrcaWorktree, which takes the per-repo cap slot
//              first (worktrees.capPerRepo: a full repository refuses worktree-cap and the Kernel launch waits) and
//              registers the row keyed by Orca's worktree id (kind workflow). Orca names the branch after the worktree
//              (wf-<id>, its '/' rule): that branch IS the workflow branch, recorded as Orca reported it; every reader
//              takes it from workflowWorktreeOf().branch and never constructs one. The Kernel then starts with
//              `orchestration worker-start --worktree <that path>`: an existing worktree, so launch trust (the provider's
//              project config, a Devin model pin) is written into it before the agent starts, which a `--worktree
//              new-child` start cannot offer (the directory does not exist until the start returns).
//   ops        every op of the workflow launches with `--worktree <the workflow worktree>` (opWorktreeArgs); no op gets a
//              tree of its own. Ops on the same side (be/ or fe/, from their owned paths) run one at a time; ops on
//              different sides may run together; an op touching both sides (or the app root) runs alone
//              (canDispatchConcurrently, enforced by starci kernel dispatch as the typed wait workflow-side-busy).
//   checkpoint part B commits each green op on the workflow branch and calls setCheckpoint; the registry row keeps the sha.
//   release    never from inside the worktree (coordinator ruling): part B's finish marks the row release-pending
//              (markReleasePending); the host-side GC (scripts/machine/worktrees.mjs gcWorktrees, the reconciler GC
//              controller) removes it only once the Kernel's and every op's terminal is released, through
//              releaseWorkflowWorktree: every link removed as a link and zero asserted, `orca worktree rm`, the main
//              checkout asserted untouched, the registry row closed, then `git branch -d` of the workflow branch (Orca
//              deletes a branch it can prove merged itself; -d runs only when the branch is still there).
//
// ctx: {env, orca, git} - env selects machine.sqlite (the registry), orca the Orca worktree client
// (scripts/machine/worktree-orca.mjs orcaWorktreeClient; specs pass a fake), git the caller's git runner.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { createOrcaWorktree, bindOrcaWorktree, removeOrcaWorktree, orcaWorktreeClient } from '../machine/worktree-orca.mjs';
import { mainRootOf } from '../machine/worktree-git.mjs';
import { TERMINAL_JOB_STATUSES } from '../machine/worktree-registry.mjs';
import { projectBinding } from './target-repo.mjs';
import { workflowRecordOf, workflowWorktreeOf } from '../machine/workflow-tree.mjs';
import { isInside } from '../lib/walk.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { requireWorktreeRecord } from '../lib/worktree-record.mjs';

const WORKFLOW_WORKTREE_KIND = 'workflow';
/** The typed dispatch wait of an op whose side is busy in its workflow worktree (modules/kernel/failure-codes.yaml). */
export const WORKFLOW_SIDE_BUSY = 'workflow-side-busy';
const SIDES = Object.freeze(['be', 'fe']);
/** The side of an op that writes only the workflow's Work records (app-relative .starciwork/...). */
const WORK_SIDE = 'work';
const WORK_DIR = '.starciwork';

const posix = (p) => String(p).replaceAll('\\', '/');
const ctxOf = (ctx) => ({ env: ctx?.env ?? process.env, orca: ctx?.orca ?? orcaWorktreeClient, git: ctx?.git ?? null });
const gitIn = (call, cwd, args) => { const r = call(args, { cwd, timeout: 60_000 }); return { ok: !r.error && r.status === 0, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? r.error?.message ?? '').trim() }; };
const insidePath = (child, parent) => isInside(path.resolve(parent), path.resolve(child));

/**
 * The Orca creation of a workflow's worktree. {name: 'wf-<id>', baseBranch: 'main', branch: 'wf-<id>' (the branch Orca
 * creates for that name; the registry records the one Orca reported), args}: `args` is
 * the `orca` argv that creates it (worktree create, issued through scripts/api/orca/worktree-create.mjs); the Kernel's
 * own worker-start then takes `--worktree <path>` (opWorktreeArgs gives the same to every op).
 */
export function workflowWorktreeSpec({ workflowId, appRepo }) {
  const name = `wf-${workflowId}`;
  return { name, baseBranch: 'main', branch: name,
    args: ['worktree', 'create', '--repo', `path:${posix(path.resolve(appRepo))}`, '--name', name, '--base-branch', 'main', '--setup', 'run', '--no-parent'] };
}

/**
 * The repository a workflow of the ledger repo `repo` gets its worktree in: EVERY workflow has one (coordinator ruling).
 * The bound app checkout; else the git checkout `repo` is in - the runtime repository (.claude) included, its workflows
 * (grammar.update, the runtime-repo ops) get a wf-<id> worktree of it the same way. null only when neither is a git
 * checkout: the Kernel start then refuses workflow-worktree-missing.
 */
export function workflowAppRepo(repo, { binding = undefined } = {}) {
  const b = binding === undefined ? (() => { try { return projectBinding(repo); } catch { return null; } })() : binding;
  const appRoot = b?.appRoot ?? null;
  if (appRoot && fs.existsSync(path.join(appRoot, '.git'))) return path.resolve(appRoot);
  if (!repo) return null;
  const top = gitIn(revParseQuery, path.resolve(repo), ['--show-toplevel']);
  return top.ok && top.stdout ? mainRootOf(path.resolve(top.stdout)) : null;
}

/**
 * Register a workflow worktree Orca created (a row keyed by its Orca id, kind workflow, uncapped: the slot is taken by
 * ensureWorkflowWorktree before the creation). {workflowId, orcaWorktreeId, path, branch, checkpoint, repoRoot}
 */
export function registerWorkflowWorktree(ctx, { workflowId, orcaWorktreeId, path: dir, branch, ledgerId = null, pending = null }) {
  const { env, git } = ctxOf(ctx);
  const bound = bindOrcaWorktree({ pending, repoRoot: mainRootOf(dir, { git }), kind: WORKFLOW_WORKTREE_KIND, orcaId: orcaWorktreeId, dir, branch: branch ?? null,
    owner: { workflowId, ledgerId }, env, git });
  if (!bound.ok) throw Object.assign(new Error(`workflow worktree ${workflowId}: ${bound.detail}`), { code: bound.reason });
  return workflowRecordOf(bound.row);
}

/**
 * The workflow's worktree, created through Orca when it has none. {ok, created, record} | {ok:false, reason:
 * 'worktree-cap'|'worktree-registry-unavailable'|'orca-worktree-create-failed', detail, live?, cap?}
 */
export function ensureWorkflowWorktree(ctx, { workflowId, appRepo, ledgerId = null }) {
  const { env, orca, git } = ctxOf(ctx);
  const existing = workflowWorktreeOf({ env }, workflowId);
  if (existing && fs.existsSync(existing.path)) return { ok: true, created: false, record: existing };
  const spec = workflowWorktreeSpec({ workflowId, appRepo });
  const made = createOrcaWorktree({ repoRoot: appRepo, kind: WORKFLOW_WORKTREE_KIND, name: spec.name, base: spec.baseBranch, setup: 'run', owner: { workflowId, ledgerId }, env, git, orca });
  if (!made.ok) return { ok: false, reason: made.reason, detail: made.detail ?? null, ...(made.cap != null ? { live: made.live, cap: made.cap } : {}) };
  const record = registerWorkflowWorktree({ env, git }, { workflowId, orcaWorktreeId: made.id, path: made.path, branch: made.branch ?? spec.branch, ledgerId });
  return { ok: true, created: true, record };
}

/** Record the workflow's last checkpoint (part B, after committing a green op on the workflow branch). true when a live row took it. */
export function setCheckpoint(ctx, workflowId, sha) {
  const { env } = ctxOf(ctx);
  return withMachine((m) => m.db.prepare("UPDATE worktrees SET checkpoint_sha=? WHERE kind='workflow' AND workflow_id=? AND orca_id IS NOT NULL AND removed_at IS NULL").run(sha, workflowId).changes > 0, { env });
}

/** An accepted Git placement is the registered workflow tree; immutable recorded placements must agree with it. */
export function requireWorkflowPlacement(ctx, { workflowId, placements = [], required = false }) {
  const found = workflowWorktreeOf(ctx, workflowId);
  if (!found && !required) return null;
  const rec = requireWorktreeRecord(found, workflowId);
  const different = placements.filter(Boolean).filter((dir) => pathKey(dir) !== pathKey(rec.path));
  if (different.length) throw Object.assign(new Error(`workflow ${workflowId} placement ${different.join(', ')} is outside its registered worktree ${rec.path}`), { code: 'workflow-worktree-mismatch' });
  return rec;
}

/** The `--worktree <path>` arguments of an op launch of `workflowId` ([] when the workflow has no worktree). */
export function opWorktreeArgs(ctx, { workflowId }) {
  const rec = workflowWorktreeOf(ctx, workflowId);
  return rec ? ['--worktree', rec.path] : [];
}

/** The owned paths of an op record (a job payload, {payload}, {ownedPaths} or an array of paths). */
const ownedPathsOfRecord = (rec) => {
  if (Array.isArray(rec)) return rec;
  if (Array.isArray(rec?.ownedPaths)) return rec.ownedPaths;
  const payload = rec?.payload_json ? (() => { try { return JSON.parse(rec.payload_json); } catch { return {}; } })() : (rec?.payload ?? rec);
  return (payload?.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
};

/**
 * The side of the workflow worktree an op writes, from its owned paths (app-relative be/..., fe/..., .starciwork/...):
 * 'be' | 'fe'; 'both' when it writes both or anything else in the app root; 'work' when it writes only the workflow's
 * Work records under .starciwork/ (a Work-owner op: scope.define, work.author, the decide ops) - those records ride
 * along with a be/fe op's side; null when it owns no path.
 */
export function sideOf(opRecord) {
  const sides = new Set();
  let work = false;
  for (const raw of ownedPathsOfRecord(opRecord)) {
    const p = posix(raw).replace(/^\.\//, '').replace(/^\/+/, '');
    const head = p.split('/')[0];
    if (!head) continue;
    if (head === WORK_DIR) { work = true; continue; }
    sides.add(SIDES.includes(head) ? head : 'both');
  }
  if (sides.has('both') || sides.size > 1) return 'both';
  if (sides.size) return [...sides][0];
  return work ? WORK_SIDE : null;
}

/**
 * Whether `next` may run while `running` ops of the same workflow work in its worktree. be/fe: same side no, across
 * sides yes, 'both' (the whole app) never with another be/fe/both op. 'work' (Work records only) is its own side: it
 * runs beside be/fe/both ops, and two Work ops are serialised with each other by their path leases, not by the side.
 */
export function canDispatchConcurrently(running, next) {
  const n = sideOf(next);
  if (n === null || n === WORK_SIDE) return true;
  for (const r of running ?? []) {
    const s = sideOf(r);
    if (s === null || s === WORK_SIDE) continue;
    if (s === 'both' || n === 'both' || s === n) return false;
  }
  return true;
}

/**
 * The typed wait of an op whose side is busy in its workflow worktree, or null. `db` is the workflow's ledger; `job` the
 * op's jobs row and `payload` its payload. {reason: 'workflow-side-busy', side, busy: [{jobId, op, side}], detail}
 */
export function workflowSideWait(db, job, payload) {
  const rows = db.prepare(`SELECT job_id, op_id, payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND job_id<>? AND status IN (${TERMINAL_JOB_STATUSES.map(() => '?').join(',')})`)
    .all(job.workflow_id, job.job_id, ...TERMINAL_JOB_STATUSES);
  if (canDispatchConcurrently(rows, payload)) return null;
  const side = sideOf(payload);
  const busy = rows.map((r) => ({ jobId: r.job_id, op: r.op_id, side: sideOf(r) })).filter((r) => r.side && r.side !== WORK_SIDE && (r.side === 'both' || side === 'both' || r.side === side));
  const sideText = side === 'both' ? 'whole app' : `${side}/ side`;
  const busyText = busy.map((b) => `${b.jobId} (${b.side})`).join(', ');
  return { reason: WORKFLOW_SIDE_BUSY, side, busy,
    detail: `the workflow worktree's ${sideText} is in use by ${busyText}; the job stays queued and reads ready when that op settles` };
}

/** The rules every op prompt of a workflow with a worktree carries (the path is explicit to every tool). '' without one. */
export function workflowWorktreePromptRules(rec) {
  if (!rec) return '';
  const wt = posix(rec.path);
  return [
    '',
    '## Your workflow worktree',
    `- Edit and check ONLY in ${wt} (branch ${rec.branch ?? 'the workflow branch'}): the one worktree of this workflow, shared with the ops of the other side. Never edit ${posix(rec.repoRoot)} itself.`,
    `- Run checks and commands from ${wt}, the app root: every owned path is app-relative (be/..., fe/..., .starciwork/...).`,
    '- Write only your owned paths: an op of the other side may be working in this tree at the same time.',
    "- node_modules here is the worktree's own install (workflow start ran starci npm ci): never run npm/pnpm install, never create a junction or symlink.",
    '- Never commit, merge, push, rebase or reset: leave your changes in the tree. Only the runtime commits - a checkpoint of your green work on the workflow branch - and it lands the branch on main when the workflow finishes.',
  ].join('\n');
}

/**
 * Mark the workflow's worktree release-pending (part B's finish, after the merge): the host-side GC removes it once no
 * agent of the workflow holds a terminal - link check, `orca worktree rm`, the row closed, `git branch -d <its branch>`.
 * {ok}: ok false when the workflow has no live worktree to mark.
 */
export function markReleasePending(ctx, workflowId, { at = Date.now() } = {}) {
  const { env } = ctxOf(ctx);
  const changed = withMachine((m) => m.db.prepare("UPDATE worktrees SET release_pending_at=COALESCE(release_pending_at, ?) WHERE kind='workflow' AND workflow_id=? AND orca_id IS NOT NULL AND removed_at IS NULL").run(at, workflowId).changes, { env });
  return { ok: changed > 0 };
}

/**
 * Release the workflow's worktree, from the host (the GC; never from inside the worktree: refused release-from-inside):
 * every link removed as a link and zero asserted, `orca worktree rm`, the main checkout asserted untouched, the registry
 * row closed (scripts/machine/worktree-orca.mjs removeOrcaWorktree), then `git branch -d` of the workflow branch when Orca kept it.
 * {ok, released, path?, links?, branch?} | {ok:false, reason, fatal?, ...}
 */
export function releaseWorkflowWorktree(ctx, workflowId, { cwd = process.cwd() } = {}) {
  const { env, orca, git } = ctxOf(ctx);
  const rec = workflowWorktreeOf({ env }, workflowId);
  if (!rec) return { ok: true, released: false, note: 'the workflow has no worktree' };
  if (insidePath(cwd, rec.path)) return { ok: false, released: false, reason: 'release-from-inside', path: rec.path };
  const r = removeOrcaWorktree({ repoRoot: rec.repoRoot, orcaId: rec.orcaWorktreeId, dir: rec.path, branch: rec.branch, deleteBranch: rec.branch ? 'merged' : null, env, git, orca });
  return r.ok ? { ok: true, released: true, path: rec.path, orcaWorktreeId: rec.orcaWorktreeId, links: r.links, branch: r.branch } : { ...r, released: false };
}
