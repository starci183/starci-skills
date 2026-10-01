// worktrees.mjs — the GC and the counts of every worktree the runtime owns (owner decision WFWT, final: one worktree per
// Kernel workflow; never write it ourselves when Orca has it).
//
// Two homes, decided by who works in the tree, each created and removed only through its api:
//   Orca     an agent's workspace (kind workflow, critic, supervisor-staging): scripts/api/orca/worktree-provision.mjs creates and binds it,
//            scripts/api/orca/worktree-remove.mjs removes it (links first, then `orca worktree rm`). Never git.
//   git      a runtime-internal scratch tree no agent ever works in: scripts/api/git/worktree-add.mjs createScratchWorktree
//            holds the only `git worktree add` of the runtime (scripts/checks/check-worktree-add.mjs fails any other),
//            scripts/api/git/worktree-remove.mjs removeScratchWorktree the git removal.
// The registry rows, kinds, settings and the collect judgement are scripts/lib/worktree-registry.mjs.
//
//   gc       gcWorktrees removes a live tree whose owner ended - a workflow: its phase is stopped, finished or archived;
//            a critic: its owner job settled; a scratch tree: its branch is in main or its creating process has been
//            gone for worktrees.ownerGoneMs - always after preserving its work, each through the home that made it
//            (orca_id -> Orca, none -> git). It also reclaims unregistered git trees under <repo>/.starciwork/worktrees
//            whose job is not live. The reconciler GC controller runs it ACTIVE (controllers/gc.mjs key gc:worktrees).
//   counts   worktreeCounts: each repo's live count against its cap and its orphans (start.mjs --check).
//
//   node scripts/lib/worktrees.mjs counts [--json]          each repo's live count, cap and orphans
//   node scripts/lib/worktrees.mjs gc [--plan] [--json]     one GC pass now (--plan: what it would remove)
//   node scripts/lib/worktrees.mjs resume                   clear the stop a main-checkout violation set (after inspecting it)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isLinkLike } from './safe-remove.mjs';
import {
  worktreeSettings, withRegistry, markRemoved, isPendingRow, stalePending, releaseOrcaSlot, collectReason,
  treeKey, sameTree, insideTree, worktreesRootOf, TERMINAL_JOB_STATUSES, SETTLED_JOBS,
} from './worktree-registry.mjs';
import { gitWorktreeList, mainRootOf, registeredAt } from '../api/git/worktree-list.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { isAncestor } from '../api/git/merge-base.mjs';
import { branchDescription } from '../api/git/branch-description.mjs';
import { removeScratchWorktree } from '../api/git/worktree-remove.mjs';
import { removeOrcaWorktree } from '../api/orca/worktree-remove.mjs';
import { orcaWorktreeClient } from '../api/orca/worktree-client.mjs';
import { pidAlive } from '../../engine/machine-db.mjs';
import { openLedgerReader } from '../../engine/ledger-db.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ------------------------------------------------------------ counts */

/** Registered linked worktrees under the runtime's git worktrees root of `repoRoot`. */
const runtimeTreesOf = (repoRoot, opts) => { const root = worktreesRootOf(repoRoot); return gitWorktreeList(repoRoot, opts).filter((w) => insideTree(w.path, root)); };

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
  for (const r of [...known, ...repos.filter(Boolean)]) { if (!fs.existsSync(r)) continue; const home = mainRootOf(r, { git }); const k = treeKey(home); if (!all.has(k)) all.set(k, home); }
  const out = [];
  for (const repoRoot of all.values()) {
    const mine = rows.filter((r) => sameTree(r.repo_root, repoRoot));
    const orphans = mine.filter((r) => (isPendingRow(r) ? stalePending(r, now, settings.ownerGoneMs) : !fs.existsSync(r.path)))
      .map((r) => ({ path: r.path, why: isPendingRow(r) ? 'Orca slot reserved, never bound' : 'registered, directory gone' }));
    for (const w of runtimeTreesOf(repoRoot, { git })) if (!mine.some((r) => sameTree(r.path, w.path))) orphans.push({ path: w.path, why: w.prunable ? 'prunable registration' : 'no live registry row' });
    const linked = Math.max(0, gitWorktreeList(repoRoot, { git }).length - 1);
    out.push({ repoRoot, live: mine.length, linked, cap: settings.capPerRepo, orphans, over: Math.max(mine.length, linked) > settings.capPerRepo });
  }
  return out;
}

/* ------------------------------------------------------------ gc */

/**
 * The default owner lookups over every registered ledger, read-only, cached for one pass: a job's status, a workflow's
 * phase, how many of a workflow's agents still hold a terminal.
 */
function ledgerLookup(env) {
  const cache = new Map();
  let ledgers = null;
  const readers = new Map();
  const ask = (ledgerId, k, sql, ...args) => {
    const ck = `${k}\0${ledgerId ?? '*'}\0${args.join('\0')}`;
    if (cache.has(ck)) return cache.get(ck);
    let value = null;
    try {
      ledgers ??= withRegistry((m) => m.listLedgers(), env);
      for (const l of ledgers.filter((x) => !ledgerId || x.ledgerId === ledgerId)) {
        if (!l.file || !fs.existsSync(l.file)) continue;
        if (!readers.has(l.file)) { try { readers.set(l.file, openLedgerReader(l.file)); } catch { readers.set(l.file, null); } }
        const row = readers.get(l.file)?.db?.prepare(sql).get(...args);
        if (row) { value = Object.values(row)[0] ?? null; break; }
      }
    } catch { value = null; }
    cache.set(ck, value);
    return value;
  };
  const jobStatus = (ledgerId, jobId) => ask(ledgerId, 'job', 'SELECT status FROM jobs WHERE job_id=?', jobId);
  jobStatus.workflowPhase = (ledgerId, workflowId) => ask(ledgerId, 'wf', 'SELECT phase FROM workflows WHERE workflow_id=?', workflowId);
  // The workflow's agents still holding a terminal: its Kernel job running, or an op holding a worker. A row only when
  // the ledger has the workflow, so another ledger never answers 0 for it.
  jobStatus.workflowTerminalsLive = (ledgerId, workflowId) => ask(ledgerId, 'terms',
    `SELECT (SELECT COUNT(*) FROM jobs WHERE workflow_id=? AND ((kind='kernel' AND status='running') OR (kind='op' AND status IN (${TERMINAL_JOB_STATUSES.map((s) => `'${s}'`).join(',')})))) AS live FROM workflows WHERE workflow_id=?`,
    workflowId, workflowId);
  jobStatus.close = () => { for (const h of readers.values()) { try { h?.close?.(); } catch { /* closed */ } } };
  return jobStatus;
}

const hashOf = (p) => crypto.createHash('sha1').update(treeKey(p)).digest('hex').slice(0, 10);
const ageOf = (p, now) => { try { return now - fs.statSync(p).mtimeMs; } catch { return Infinity; } };
const supLookup = (jobId, env) => { try { return withRegistry((m) => m.supJob(jobId)?.status ?? null, env); } catch { return null; } };

/**
 * One GC pass over every worktree the runtime owns, run on the host (the reconciler GC controller). Seams:
 * jobStatusOf(ledgerId, jobId) -> status | null (its .workflowPhase(ledgerId, workflowId) -> phase | null and
 * .workflowTerminalsLive(ledgerId, workflowId) -> count), supStatusOf(supJobId), ownerAlive(pid) -> bool, now, orca (the
 * Orca client of removeOrcaWorktree). A workflow worktree goes: links unlinked, `orca worktree rm`, the row closed, then
 * `git branch -d` of its branch (a release-pending one is merged; an abandoned one is preserved first and `-D`).
 * apply false: the plan only. [{path, repoRoot, reason, action, ok, preserved, error}]
 */
export function gcWorktrees({ env = process.env, now = Date.now(), apply = true, jobStatusOf = null, supStatusOf = null, ownerAlive = pidAlive, settings = worktreeSettings(), repos = [], git = null,
  budgetMs = settings.gcBudgetMs, clock = Date.now, orca = orcaWorktreeClient } = {}) {
  const lookup = jobStatusOf ?? ledgerLookup(env);
  const phaseOf = lookup.workflowPhase ?? (() => null);
  const terminalsOf = lookup.workflowTerminalsLive ?? (() => 0);
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
        if (stalePending(row, now, settings.ownerGoneMs)) { if (apply) releaseOrcaSlot(row.path, { env }); items.push({ path: row.path, repoRoot, reason: 'slot-never-bound', action: 'unregister', ok: true }); }
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
      const terminalsLive = row.kind === 'workflow' && row.workflow_id ? Number(terminalsOf(row.ledger_id, row.workflow_id) ?? 0) : 0;
      const ownerStatus = row.kind === 'workflow' ? null : row.job_id ? lookup(row.ledger_id, row.job_id)
        : row.kind === 'supervisor-staging' && row.lane ? (supStatusOf ?? supLookup)(row.lane, env) : null;
      const reason = collectReason({ row, jobStatus: ownerStatus, workflowPhase, terminalsLive, merged, ownerAlive: pid == null ? false : ownerAlive(Number(pid)), now, ownerGoneMs: settings.ownerGoneMs });
      if (!reason) continue;
      if (halt()) return items;
      items.push(collect({ row, repoRoot, dir: row.path, branch: row.branch, name: row.workflow_id && row.kind === 'workflow' ? `${row.workflow_id}/gc` : row.job_id ?? row.lane ?? `${row.kind}-${hashOf(row.path)}`,
        reason, merged, apply, env, git, orca }));
    }
    // git trees under <repo>/.starciwork/worktrees that no live row owns (made before the registry, or by a crashed run).
    const live = new Set(rows.map((r) => treeKey(r.path)));
    const repoSet = new Map();
    for (const r of [...rows.map((x) => x.repo_root), ...repos]) if (r && fs.existsSync(r)) repoSet.set(treeKey(r), path.resolve(r));
    try { for (const r of withRegistry((m) => m.worktreeRepos(), env)) if (fs.existsSync(r)) repoSet.set(treeKey(r), path.resolve(r)); } catch { /* registry read failed above already */ }
    for (const repoRoot of repoSet.values()) {
      for (const w of runtimeTreesOf(repoRoot, { git })) {
        if (live.has(treeKey(w.path))) continue;
        const jobId = branchDescription(repoRoot, w.branch);
        const status = jobId ? lookup(null, jobId) : null;
        if (status && !SETTLED_JOBS.has(status)) continue;
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
  const deleteBranch = branch ? (merged || row?.release_pending_at != null ? 'merged' : 'force') : null;
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
