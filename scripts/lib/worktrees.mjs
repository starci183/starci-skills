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
//            (orca_id -> Orca, none -> git). Orca's `worktree ps` is the source of truth for Orca trees: a workflow
//            tree's live terminals are its liveTerminalCount; a tree stamped as the runtime's (scripts/lib/orca-orphans.mjs,
//            written by worktree-provision.mjs at create) with no registry row - a crash between Orca's create and the bind
//            - is adopted while its owner lives, or preserved to preserved/orphan/<id> and removed once its owner ended
//            or is unknown, its row created then closed and an incident logged; an unstamped tree is foreign and never
//            touched; a registered Orca tree that a complete ps page no longer lists is reported (orca-tree-unlisted),
//            never removed by other means. It also reclaims unregistered git trees under <repo>/.starciwork/worktrees
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
  worktreeSettings, withRegistry, markRemoved, isPendingRow, stalePending, releaseOrcaSlot, collectReason, pendingPathOf,
  treeKey, sameTree, insideTree, worktreesRootOf, SETTLED_JOBS, ORCA_KINDS, ENDED_WORKFLOW_PHASES,
} from './worktree-registry.mjs';
import { parseRuntimeStamp, psCoverage, orphanPreserveName, orphanVerdict } from './orca-orphans.mjs';
import { gitWorktreeList, mainRootOf, registeredAt } from '../api/git/worktree-list.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { isAncestor } from '../api/git/merge-base.mjs';
import { branchDescription } from '../api/git/branch-description.mjs';
import { removeScratchWorktree } from '../api/git/worktree-remove.mjs';
import { removeOrcaWorktree } from '../api/orca/worktree-remove.mjs';
import { orcaWorktreeClient } from '../api/orca/worktree-client.mjs';
import { bindOrcaWorktree } from '../api/orca/worktree-provision.mjs';
import { pidAlive, machineLog } from '../../engine/machine-db.mjs';
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
 * The default owner lookups over every registered ledger, read-only, cached for one pass: a job's status and a
 * workflow's phase. Whether an agent still works in a tree is Orca's fact (`worktree ps` liveTerminalCount).
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
  jobStatus.close = () => { for (const h of readers.values()) { try { h?.close?.(); } catch { /* closed */ } } };
  return jobStatus;
}

const hashOf = (p) => crypto.createHash('sha1').update(treeKey(p)).digest('hex').slice(0, 10);
const ageOf = (p, now) => { try { return now - fs.statSync(p).mtimeMs; } catch { return Infinity; } };
const supLookup = (jobId, env) => { try { return withRegistry((m) => m.supJob(jobId)?.status ?? null, env); } catch { return null; } };

/**
 * One GC pass over every worktree the runtime owns, run on the host (the reconciler GC controller). Seams:
 * jobStatusOf(ledgerId, jobId) -> status | null (its .workflowPhase(ledgerId, workflowId) -> phase | null),
 * supStatusOf(supJobId), ownerAlive(pid) -> bool, now, orca (the Orca client: ps, remove). Orca's `worktree ps` is read
 * FIRST and the registry after it: a tree Orca lists was created before the registry read, so its pending slot or its
 * bound row is in that read unless its creator crashed. A workflow worktree goes once Orca reports no live terminal in
 * it (an unreadable or incomplete ps keeps it): links unlinked, `orca worktree rm`, the row closed, then `git branch -d`
 * of its branch (a release-pending one is merged; an abandoned one is preserved first and `-D`). Then the orphan pass
 * (collectOrcaOrphans). apply false: the plan only. [{path, repoRoot, reason, action, ok, preserved, error}]
 */
export function gcWorktrees({ env = process.env, now = Date.now(), apply = true, jobStatusOf = null, supStatusOf = null, ownerAlive = pidAlive, settings = worktreeSettings(), repos = [], git = null,
  budgetMs = settings.gcBudgetMs, clock = Date.now, orca = orcaWorktreeClient } = {}) {
  const lookup = jobStatusOf ?? ledgerLookup(env);
  const phaseOf = lookup.workflowPhase ?? (() => null);
  const supOf = supStatusOf ?? ((jobId) => supLookup(jobId, env));
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
  // Orca's view before the registry's (see above). An unreadable page proves nothing: no Orca tree is judged from it.
  let ps = null;
  try { ps = orca.ps(); } catch (error) { ps = { ok: false, error: String(error?.message ?? error) }; }
  const cover = psCoverage(ps);
  const byId = new Map(), byPath = new Map();
  if (cover.ok) for (const w of ps.worktrees) { if (w.id) byId.set(w.id, w); if (w.path) byPath.set(treeKey(w.path), w); }
  const orcaTreeOf = (row) => (cover.ok ? byId.get(row.orca_id) ?? byPath.get(treeKey(row.path)) ?? null : null);
  // A workflow tree's live terminals are Orca's count; a tree a complete page does not list holds none; otherwise unknown
  // (Infinity: kept).
  const liveTerminalsOf = (row) => { const w = orcaTreeOf(row); return w ? w.liveTerminalCount : cover.complete ? 0 : Infinity; };
  try {
    let rows = [];
    try { rows = withRegistry((m) => m.liveWorktrees(), env); } catch (error) { return [{ action: 'error', ok: false, error: String(error?.message ?? error).slice(0, 200) }]; }
    for (const row of rows) {
      const repoRoot = path.resolve(row.repo_root);
      if (isPendingRow(row)) {
        // A slot whose creator died before Orca answered: the slot goes back. A tree Orca may have made for it carries the
        // runtime's stamp, and the orphan pass below adopts or removes it.
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
      const terminalsLive = row.kind === 'workflow' ? liveTerminalsOf(row) : 0;
      const ownerStatus = row.kind === 'workflow' ? null : row.job_id ? lookup(row.ledger_id, row.job_id)
        : row.kind === 'supervisor-staging' && row.lane ? supOf(row.lane) : null;
      const reason = collectReason({ row, jobStatus: ownerStatus, workflowPhase, terminalsLive, merged, ownerAlive: pid == null ? false : ownerAlive(Number(pid)), now, ownerGoneMs: settings.ownerGoneMs });
      if (!reason) continue;
      if (halt()) return items;
      // A registered Orca tree that a complete ps page no longer lists cannot be removed through Orca, and is never
      // removed by any other means: reported, its row marked, an incident logged.
      if (row.orca_id && cover.complete && !orcaTreeOf(row)) { items.push(unlisted({ row, repoRoot, reason, apply, env })); continue; }
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
    if (cover.ok && collectOrcaOrphans({ ps, items, halt, lookup, phaseOf, supOf, now, apply, settings, env, git, orca })) return items;
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

const ENDED = new Set(ENDED_WORKFLOW_PHASES);

/** One incident line in machine_logs (actor gc, kind worktree.orphan): what the orphan scan found and did. */
function orphanIncident({ level = 'warn', msg, owner = {}, data, env }) {
  machineLog({ actor: 'gc', kind: 'worktree.orphan', level, msg: msg.slice(0, 500), ledgerId: owner.ledgerId ?? null, workflowId: owner.workflowId ?? null,
    jobId: owner.jobId ?? null, data }, { env });
}

/** A registered Orca tree Orca no longer lists (orca-tree-unlisted): reported and marked, never removed by other means. */
function unlisted({ row, repoRoot, reason, apply, env }) {
  if (apply) {
    markRemoved(row.path, { error: 'orca-tree-unlisted', env });
    orphanIncident({ level: 'error', msg: `registered Orca tree ${row.orca_id} at ${row.path} is collectable (${reason}) but Orca no longer lists it: left in place`,
      owner: { ledgerId: row.ledger_id, workflowId: row.workflow_id, jobId: row.job_id }, data: { orcaId: row.orca_id, path: row.path, collectReason: reason }, env });
  }
  return { path: row.path, repoRoot, reason: 'orca-tree-unlisted', action: 'keep', home: 'orca', ok: false, error: 'orca-tree-unlisted' };
}

/**
 * The orphan pass over Orca's `worktree ps` page: every STAMPED tree on this host with no registry row (a crash between
 * Orca's create and the bind, or a slot the GC gave back as slot-never-bound). An unstamped tree is foreign and never
 * touched; a stamped kind that is not an Orca kind on this runtime is left for the lane that makes it one. The registry
 * is re-read here, after the page. Its owner (from the stamp: a workflow's phase, a critic's op job, a staging tree's
 * Supervisor job) decides (orca-orphans.mjs orphanVerdict): live -> adopted (the row created, so its owner's next lookup
 * finds it); ended, or unknown past ownerGoneMs -> the row created, its work preserved to preserved/orphan/<id>, removed
 * through removeOrcaWorktree (links first, then Orca), the row closed; a fresh pending slot of the same owner -> its
 * creation is still running, left alone. Every adoption and removal logs an incident. true when the pass must stop.
 */
function collectOrcaOrphans({ ps, items, halt, lookup, phaseOf, supOf, now, apply, settings, env, git, orca }) {
  let fresh;
  try { fresh = withRegistry((m) => m.liveWorktrees(), env); } catch { return false; }
  const mains = new Map(ps.worktrees.filter((w) => w.isMainWorktree && w.repoId && w.path).map((w) => [w.repoId, w.path]));
  for (const w of ps.worktrees) {
    if (w.isMainWorktree || !w.id || !w.path || w.hostId !== 'local') continue;
    const stamp = parseRuntimeStamp(w.comment);
    if (!stamp || !ORCA_KINDS.includes(stamp.kind)) continue; // foreign: never touched
    if (fresh.some((r) => r.orca_id === w.id || (!isPendingRow(r) && sameTree(r.path, w.path)))) continue; // registered
    const slotName = path.basename(pendingPathOf('', stamp.kind, stamp.slot));
    const inFlight = fresh.some((r) => isPendingRow(r) && r.kind === stamp.kind && path.basename(r.path) === slotName && !stalePending(r, now, settings.ownerGoneMs));
    const staging = stamp.kind === 'supervisor-staging';
    const owner = { workflowId: stamp.workflowId ?? (stamp.kind === 'workflow' ? stamp.slot : null), jobId: stamp.jobId, ledgerId: stamp.ledgerId,
      lane: staging ? stamp.supJobId ?? stamp.slot : null };
    const ageMs = Math.min(ageOf(w.path, now), w.lastActivityAt ? now - w.lastActivityAt : Infinity);
    const v = orphanVerdict({ stamp, inFlight, liveTerminals: w.liveTerminalCount, ageMs, ownerGoneMs: settings.ownerGoneMs, endedPhases: ENDED,
      settledStatuses: SETTLED_JOBS,
      workflowPhase: stamp.kind === 'workflow' && owner.workflowId ? phaseOf(owner.ledgerId, owner.workflowId) : null,
      jobStatus: staging ? (owner.lane ? supOf(owner.lane) : null) : owner.jobId ? lookup(owner.ledgerId, owner.jobId) : null });
    if (v.verdict !== 'adopt' && v.verdict !== 'collect') continue;
    const repoRoot = mains.get(w.repoId) ?? (fs.existsSync(w.path) ? mainRootOf(w.path, { git }) : null);
    if (!repoRoot) continue;
    const dir = path.resolve(w.path);
    const base = { path: dir, repoRoot: path.resolve(repoRoot), home: 'orca', owner: v.owner };
    if (!apply) { items.push({ ...base, reason: v.verdict === 'adopt' ? 'orca-orphan-adopted' : 'orca-orphan', action: v.verdict === 'adopt' ? 'would-adopt' : 'would-remove', ok: null }); continue; }
    if (halt()) return true;
    const bound = bindOrcaWorktree({ repoRoot, kind: stamp.kind, orcaId: w.id, dir, branch: w.branch, owner, env, git });
    if (!bound.ok) { items.push({ ...base, reason: bound.reason, action: v.verdict === 'adopt' ? 'adopt' : 'remove', ok: false, error: bound.reason }); continue; }
    if (v.verdict === 'adopt') {
      orphanIncident({ msg: `adopted the unregistered Orca tree ${w.id} (${w.comment}): its owner is live`, owner, data: { orcaId: w.id, path: dir, stamp: w.comment }, env });
      items.push({ ...base, reason: 'orca-orphan-adopted', action: 'adopt', ok: true });
      continue;
    }
    const r = removeOrcaWorktree({ repoRoot, orcaId: w.id, dir, branch: w.branch, deleteBranch: w.branch ? 'force' : null,
      preserve: { name: orphanPreserveName({ slot: stamp.slot, orcaId: w.id, digest: (x) => crypto.createHash('sha1').update(x).digest('hex') }) }, env, git, orca });
    orphanIncident({ level: r.ok ? 'warn' : 'error', msg: `orphaned Orca tree ${w.id} (${w.comment}), owner ${v.owner}: ${r.ok ? 'preserved and removed' : `removal failed: ${r.reason}`}`,
      owner, data: { orcaId: w.id, path: dir, stamp: w.comment, preserved: r.preserved?.ref ?? null, error: r.ok ? null : r.reason }, env });
    items.push({ ...base, reason: 'orca-orphan', action: 'remove', ok: r.ok, preserved: r.preserved?.ref ?? null, ...(r.ok ? {} : { error: r.reason }), ...(r.fatal ? { fatal: true, damage: r.damage } : {}) });
    if (r.fatal) return halt();
  }
  return false;
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
