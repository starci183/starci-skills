#!/usr/bin/env node
// starci supervisor gc — the Supervisor's garbage collection (owner, 2026-09-28: "why doesn't the supervisor delete the workers,
// the ops are so full of garbage!!! there has to be a garbage collection"). Every supervisor tick runs it (tick.mjs, duty gc); an operator runs it by hand.
//
//   starci supervisor gc [--dry-run] [--apply] [--only agents,shells,lanes,tmp] [--json]
//                        [--plan] [--holder <name>] [--trigger <name>]
//
// --plan is a dry run that writes NOTHING (no seen-state, no machine-log rows, no lessons): the reconciler's gc controller
// runs its shadow sweep this way. --holder names the host-lock holder of an --apply run, --trigger the run's trigger. The
// controller always runs the sweep as this child process: a sweep walks every lane worktree and Orca terminal with
// synchronous git and CLI calls (minutes on a loaded host), and in the engine's one thread that stalled the lease.
//
// Default is the dry run: every collector reports what it WOULD close or remove and mutates nothing (it only records
// when it first saw a candidate, so the age rules below can hold). --apply closes and removes.
//
// Ownership (owner clarification 2026-09-28): a Kernel closes its own op workers at settle, the Supervisor closes its
// own [Worker]s at report/cancel/land (both through scripts/machine/close-verify.mjs). This GC is the periodic scan for the
// leftovers that slipped past both; every leftover it collects is recorded as a self-derived lesson
// (lessons.mjs recordLeftover): a leftover is a bug in the step that owned it.
//
// Collectors:
//   agents    Orca's own worker accounting (orchestration worker-list, scripts/api/orca/worker-list.mjs), read Run by
//             Run for every Orca Run the ledgers and the Supervisor's jobs name and paged past 100 rows: a worker Orca
//             holds as reclaimable (settled, terminal not released) whose liveness is live, exited or unverifiable and whose literal
//             nextAction is `worker-release --dispatch <id>` is released (worker-release archives its output, then
//             closes only that terminal). A row with no liveness verdict, whose next action is anything else, or
//             whose release Orca could not confirm (release_unknown) is reported and never touched (lib/
//             worker-accounting.mjs releasePlan). A terminal the ledgers bind to a settled job, an ended workflow or a
//             finished [Worker] job that Orca does not account for as a worker is closed and verified; a terminal Orca
//             accounts for is left to the release above. Nothing is identified by its tab title or its screen.
//             Never: the live Supervisor seat, a live Kernel, the terminal of a queued/leased/running/answering/reported
//             job, and nothing the runtime did not create.
//   shells    idle bare shells: a plain Orca shell tab (title "Terminal <n>" or the worktree's name), no agent, bound to
//             nothing, whose screen holds nothing but prompts, older than gcMinAgeMs (by first sight, or by the age of
//             every child-less `powershell -NoExit` under the Orca daemon). 322 of them held ~20 GB on 2026-09-28.
//   lanes     worktrees under the lanes root (home.mjs lanesRoot): a lane/* branch landed by patch, ledger or
//             file content with a clean tree, idle for gcLaneGraceMs; a detached land scratch while no land runs; an
//             empty leftover directory. A [Worker] staging checkout is an Orca worktree registered as supervisor-staging:
//             the worktree GC (scripts/machine/worktrees.mjs gcWorktrees) removes it once its job settled, never this one.
//             The node_modules junction is unlinked first, then the tree goes through safeRemove (links unlinked, never followed; never
//             `git worktree remove --force`), then the registration is pruned. Lane branches
//             are kept as commit evidence. Unmerged or dirty lanes are kept and reported.
//   (ended workflows are NOT purged here: housekeeping is the only purger — 30 days, zipped and verified first, Q6 —
//    through scripts/housekeeping/hk-ledger.mjs and scripts/work/purge-workflow.mjs.)
//   tmp       %TEMP% entries with a runtime prefix past tmpMaxAgeMs (hk-tmp.mjs sweepTmp).
//   leases    lease rows (product ledgers and machine.sqlite sup_leases) of a settled job, a job the ledger no longer
//             has, or an ended workflow, older than leaseMinAgeMs (DESIGN §15.2, LEASE_LEAK). No api path deletes
//             the lease of an already-settled job, so this collector REPORTS them (verdict refuse, reportOnly) and
//             never deletes; the reconciler GC controller opens a runtime-defect Decision Item for the Supervisor.
//   lanelogs  *.err / *.json / *.log files at the top level of the lanes root older than laneLogMinAgeMs (24 h):
//             moved to <archiveRoot>/lane-logs/; archived lane logs older than laneLogRetentionMs (14 days, by
//             their last write) are deleted. Subdirectories (the lane worktrees) are never touched.
//
// Host lock `gc` (reconciler lane rc-gc-resource): a live --apply run holds machine.sqlite host_locks 'gc', so the tick, a
// hand-run gc.mjs and the reconciler GC controller never overlap; a busy lock returns ok:false, busy:true untouched.
//
// Output: the report {schema, apply, ok, counts, freedBytes, ramFreedBytes, items: [{class, action, target, ...}],
// refused, errors, line}. Every item and one summary are typed rows of the machine log (gc.collect, gc.summary).
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { workerListAll, activeWorkersAllRuns } from '../machine/worker-list-all.mjs';
import { closeWorker } from '../machine/worker-close.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { closeAndVerify, isAgentProcess, processTable } from '../machine/close-verify.mjs';
import { killTree } from '../api/process/kill-tree.mjs';
import { fmtGb } from '../lib/time.mjs';
import { archiveRoot as archiveRootOf, lanesRoot, productRepos, readSupervisor, withSupervisor } from '../machine/home.mjs';
import { readState, writeState, supervisorView, ledgerView } from './gc-registry.mjs';
import { LANE_DEFAULTS, collectLanes, readLaneCursor, writeLaneCursor } from './gc-lanes.mjs';
export { readState, writeState, supervisorView, ledgerView, collectLanes, readLaneCursor, writeLaneCursor };
import { acquireGcLock } from '../machine/gc-lock.mjs';
import { LANE_IDLE_MS } from '../machine/lane-owner.mjs';
import { releasePlan, workerTerminalHandles, distinctRuns } from '../lib/worker-accounting.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs'; import { isMain } from '../lib/is-main.mjs';
import { positiveNumber } from '../lib/number.mjs';

export const SCHEMA = 'starci/gc-report@1';
/** The supervisor-ledger event the tick records per GC run (tick.mjs); the owner digest sums them (actions.mjs). */
export const GC_EVENT_KIND = 'supervisor-gc';
export const COLLECTORS = Object.freeze(['agents', 'shells', 'lanes', 'tmp', 'leases', 'lanelogs']);
export const DEFAULTS = Object.freeze({ gcMinAgeMs: 600_000, gcLaneGraceMs: 1_800_000, sweepMs: 1_800_000,
  leaseMinAgeMs: 60_000, laneLogMinAgeMs: 86_400_000, laneLogRetentionMs: 1_209_600_000, laneIdleMs: LANE_IDLE_MS, ...LANE_DEFAULTS });
/** The DESIGN §15.3 leftover class of each new collector's item and the step whose bug it points at. */
const LEFTOVER_OWNERS = Object.freeze({
  lease: 'settle/reconcile did not release the job lease (scripts/kernel/cli.mjs cmdSettle/cmdReconcile DELETE FROM leases, workers.mjs releaseLeases)',
  'lane-log': 'the lane process left its log at the lanes root instead of cleaning it after land',
});
const SETTLED_JOB = new Set(SETTLED_JOB_LIST);
const LANE_LOG = /\.(err|json|log)$/i;
const LIVE_JOB = new Set(['queued', 'leased', 'running', 'answering', 'effect_unknown']);
const SUP_LIVE = new Set(['queued', 'spawning', 'running', 'reported']);
const ORCA_DAEMON = /[\\/]daemon-host[\\/]/i;
const SHELL_TITLE = /^Terminal \d+$/;
const PROMPT = /PS [A-Za-z]:\\[^>\r\n]*>/g;

/** The gc windows of runtimes.yaml allocation.housekeeping, with their defaults. */
export function gcSettings(allocation = allocationSettings()) {
  const hk = allocation?.housekeeping ?? {};
  const gc = allocation?.gc ?? {};
  const keepTitles = (Array.isArray(gc.keepTitles) ? gc.keepTitles : []).map((p) => { try { return new RegExp(String(p)); } catch { return null; } }).filter(Boolean);
  return { minAgeMs: positiveNumber(hk.gcMinAgeMs, DEFAULTS.gcMinAgeMs), laneGraceMs: positiveNumber(hk.gcLaneGraceMs, DEFAULTS.gcLaneGraceMs),
    archiveRoot: archiveRootOf(), housekeeping: hk,
    sweepMs: positiveNumber(gc.sweepMs, DEFAULTS.sweepMs), keepTitles,
    leaseMinAgeMs: positiveNumber(gc.leaseMinAgeMs, DEFAULTS.leaseMinAgeMs), laneLogMinAgeMs: positiveNumber(gc.laneLogMinAgeMs, DEFAULTS.laneLogMinAgeMs),
    laneLogRetentionMs: positiveNumber(gc.laneLogRetentionMs, DEFAULTS.laneLogRetentionMs),
    // A landed lane worktree goes only after laneIdleMs (60 min) with no git activity, never below gcLaneGraceMs.
    laneIdleMs: Math.max(positiveNumber(gc.laneIdleMs, DEFAULTS.laneIdleMs), positiveNumber(hk.gcLaneGraceMs, DEFAULTS.gcLaneGraceMs)),
    // One pass judges lanes for at most laneBudgetMs, then resumes there; laneCap: most lanes that stay registered (lane-cap.mjs).
    laneBudgetMs: positiveNumber(gc.laneBudgetMs, DEFAULTS.laneBudgetMs), laneCap: positiveNumber(gc.laneCap, DEFAULTS.laneCap) };
}

/* ------------------------------------------------------------ pure classification */

// laneOwnerOf lives in scripts/machine/lane-owner.mjs (the one lane-removal rule, shared with hk-lanes.mjs).
export { laneOwnerOf } from '../machine/lane-owner.mjs';

/** Tab titles by handle from terminal-list visualLayouts (the title Orca gave the tab, which agents never rewrite). */
export function tabTitles(visualLayouts = []) {
  const out = new Map();
  const panes = (p, tab) => {
    if (!p) return;
    if (p.type === 'terminal' && p.handle) out.set(p.handle, tab);
    for (const c of p.children ?? []) panes(c, tab);
    if (p.first) panes(p.first, tab);
    if (p.second) panes(p.second, tab);
  };
  const walk = (n) => {
    if (!n) return;
    for (const t of n.tabs ?? []) panes(t.panes, t.title ?? null);
    for (const c of n.children ?? []) walk(c);
    if (n.first) walk(n.first);
    if (n.second) walk(n.second);
  };
  for (const l of visualLayouts ?? []) walk(l.root);
  return out;
}

/** True when a title is a plain Orca shell tab's: "Terminal <n>", or the name of its worktree folder. */
export function isShellTitle(title, { worktreeName = null } = {}) {
  const t = String(title ?? '').trim();
  return SHELL_TITLE.test(t) || Boolean(worktreeName && t === worktreeName);
}

/** True when a terminal screen holds nothing but PowerShell prompts (wrapped lines joined back). */
export function onlyPrompts(screen) {
  if (screen == null) return false;
  const joined = String(screen).replace(/\r?\n/g, '');
  if (!PROMPT.test(joined)) return false;
  return joined.replace(PROMPT, '').trim() === '';
}

/**
 * The leaked leases. Pure. `rows` from leaseRowsOf (each may carry `ledger`). A lease leaks when its job is settled
 * or gone, or its workflow ended, and the settle/end is older than minAgeMs. A lease of a live job (queued, leased,
 * running, answering, reported, effect_unknown) of a live workflow is never one. [{ledger, resourceKey, jobId,
 * workflowId, why, sinceMs}].
 */
export function classifyLeases({ rows = [], now = Date.now(), minAgeMs = DEFAULTS.leaseMinAgeMs }) {
  const out = [];
  for (const r of rows) {
    const ended = r.phase === 'finished' || r.archivedAt != null;
    const settled = r.jobStatus == null || SETTLED_JOB.has(r.jobStatus);
    if (!settled && !ended) continue;
    const since = settled ? (r.jobUpdatedAt ?? r.acquiredAt ?? null) : (r.archivedAt ?? r.workflowUpdatedAt ?? null);
    if (since == null || now - Number(since) < minAgeMs) continue;
    const why = (r.jobStatus == null && 'its job is gone from the ledger') || (settled && 'its job ' + String(r.jobId) + ' is ' + String(r.jobStatus)) || 'its workflow ' + String(r.workflowId) + ' ended';
    out.push({ ledger: r.ledger ?? null, resourceKey: r.resourceKey, jobId: r.jobId, workflowId: r.workflowId, why, sinceMs: now - Number(since) });
  }
  return out;
}

/**
 * The lane-log plan. Pure. `top`: [{name, mtimeMs, isFile}] at the lanes root; `archived`: the same in
 * <archiveRoot>/lane-logs. {move: [name], purge: [name]}: only plain files named *.err/*.json/*.log, never a directory.
 */
export function planLaneLogs({ top = [], archived = [], now = Date.now(), minAgeMs = DEFAULTS.laneLogMinAgeMs, retentionMs = DEFAULTS.laneLogRetentionMs }) {
  const old = (e, ms) => e.isFile === true && Number(e.mtimeMs) > 0 && now - Number(e.mtimeMs) >= ms;
  return { move: top.filter((e) => LANE_LOG.test(e.name) && old(e, minAgeMs)).map((e) => e.name),
    purge: archived.filter((e) => LANE_LOG.test(e.name) && old(e, retentionMs)).map((e) => e.name) };
}

const dirEntries = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
      let st = null; try { st = fs.statSync(path.join(dir, d.name)); } catch { st = null; }
      return { name: d.name, isFile: d.isFile(), mtimeMs: st?.mtimeMs ?? 0, bytes: st?.size ?? 0 };
    });
  } catch { return []; }
};

/** Move one file, across drives too (copy, then unlink). An archived name already taken gets a time suffix. */
function moveFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  let dest = to;
  if (fs.existsSync(dest)) { const ext = path.extname(to); dest = `${to.slice(0, -ext.length || undefined)}.${Date.now()}${ext}`; }
  try { fs.renameSync(from, dest); } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    fs.copyFileSync(from, dest); fs.unlinkSync(from);
  }
}

const bytesOf = (entries, name) => entries.find((e) => e.name === name)?.bytes ?? 0;

/** Archive one lane log: move it under the archive root (apply) or report it. Records into `acc` ({items, errors}). */
function archiveLaneLog(acc, { apply, fsx, settings, base, archiveDir, top }, name) {
  const from = path.join(base, name), to = path.join(archiveDir, name);
  let ok = null;
  if (apply) { try { (fsx?.move ?? moveFile)(from, to); ok = true; } catch (error) { ok = false; acc.errors.push(`lane log ${from}: ${String(error?.message ?? error).slice(0, 160)}`); } }
  acc.items.push({ class: 'lane-log', action: 'archive-file', target: from, verdict: ok === false ? 'refuse' : 'collect', reason: `${apply ? 'moved' : 'would move'} to ${archiveDir} (older than ${Math.round(settings.laneLogMinAgeMs / 3_600_000)}h)`, ok, leftover: true, bytes: bytesOf(top, name) });
}

/** Delete one archived lane log past its retention (apply) or report it. Records into `acc` ({items, errors, freedBytes}). */
function purgeLaneLog(acc, { apply, fsx, settings, archiveDir, archived }, name) {
  const p = path.join(archiveDir, name);
  let ok = null;
  if (apply) { try { (fsx?.remove ?? ((f) => fs.unlinkSync(f)))(p); ok = true; acc.freedBytes += bytesOf(archived, name); } catch (error) { ok = false; acc.errors.push(`archived lane log ${p}: ${String(error?.message ?? error).slice(0, 160)}`); } }
  else acc.freedBytes += bytesOf(archived, name);
  acc.items.push({ class: 'lane-log', action: 'remove-file', target: p, verdict: ok === false ? 'refuse' : 'collect', reason: `${apply ? 'deleted' : 'would delete'}: archived lane log older than ${Math.round(settings.laneLogRetentionMs / 86_400_000)} days`, ok, bytes: bytesOf(archived, name) });
}

/** Decide and (apply) archive the lane logs. `fsx` {list(dir), move(from, to), remove(file)} is the spec seam. {items, freedBytes, errors}. */
export function collectLaneLogs({ apply = false, env = process.env, now = Date.now(), settings, fsx = null }) {
  const base = lanesRoot({ env });
  const archiveDir = path.join(settings.archiveRoot, 'lane-logs');
  const list = fsx?.list ?? dirEntries;
  const top = list(base), archived = list(archiveDir);
  const plan = planLaneLogs({ top, archived, now, minAgeMs: settings.laneLogMinAgeMs, retentionMs: settings.laneLogRetentionMs });
  const acc = { items: [], errors: [], freedBytes: 0 };
  for (const name of plan.move) archiveLaneLog(acc, { apply, fsx, settings, base, archiveDir, top }, name);
  for (const name of plan.purge) purgeLaneLog(acc, { apply, fsx, settings, archiveDir, archived }, name);
  return { items: acc.items, freedBytes: acc.freedBytes, errors: acc.errors };
}

/** Every child-less `powershell -NoExit` under the Orca daemon older than minAgeMs: no shell can be younger. */
const shellsAllOld = (procs, now, minAgeMs) => {
  if (!Array.isArray(procs)) return false;
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const hasKids = new Set(procs.map((p) => p.ppid));
  const shells = procs.filter((p) => /^(powershell|pwsh)\.exe$/i.test(p.name ?? '') && /-NoExit/i.test(p.cmd ?? '') && ORCA_DAEMON.test(byPid.get(p.ppid)?.exe ?? '') && !hasKids.has(p.pid));
  return shells.length > 0 && shells.every((p) => p.created && now - p.created >= minAgeMs);
};

const addLedgerOwners = ({ ownerOf, liveJobHandles }, l) => {
  for (const j of l.jobs) for (const h of j.handles) {
    if (!ownerOf.has(h) || LIVE_JOB.has(j.status)) ownerOf.set(h, { type: 'job', repo: l.repo, job: j });
    if (LIVE_JOB.has(j.status)) liveJobHandles.add(h);
  }
  for (const w of l.workflows) if (w.kernelHandle) ownerOf.set(w.kernelHandle, { type: 'kernel', repo: l.repo, workflow: w });
};

const addSupOwners = ({ ownerOf, liveJobHandles }, sup) => {
  for (const j of sup.jobs) if (j.handle && j.handle !== 'supervisor') {
    if (!ownerOf.has(j.handle) || SUP_LIVE.has(j.status)) ownerOf.set(j.handle, { type: 'sup-job', job: j });
    if (SUP_LIVE.has(j.status)) liveJobHandles.add(j.handle);
  }
};

/** The owner of each terminal handle the ledgers and the Supervisor bind, and the handles of live jobs. */
const terminalOwners = (ledgers, sup) => {
  const owners = { ownerOf: new Map(), liveJobHandles: new Set() };
  for (const l of ledgers) addLedgerOwners(owners, l);
  addSupOwners(owners, sup);
  return owners;
};

const kernelOwnerDecision = (owner) => {
  if (owner.workflow.ended) return ['collect', 'kernel', `Kernel of ${owner.workflow.workflowId}, which is finished/archived`, { owner: owner.workflow.workflowId }];
  return ['keep', 'kernel', `live Kernel seat of ${owner.workflow.workflowId}`];
};

const jobOwnerDecision = (cx, owner, h) => {
  const { job } = owner;
  if (cx.liveJobHandles.has(h)) return ['keep', job.kind === 'kernel' ? 'kernel' : 'op-worker', `terminal of ${job.status} job ${job.jobId}`];
  if (job.kind !== 'kernel') return ['collect', 'op-worker', `terminal of settled op job ${job.jobId} (${job.status})`, { owner: job.jobId }];
  const wf = cx.ledgers.find((l) => l.repo === owner.repo)?.workflows.find((w) => w.workflowId === job.workflowId);
  if (wf && !wf.ended && wf.kernelHandle && !cx.listed.has(wf.kernelHandle)) return ['refuse', 'kernel', `settled Kernel job of live ${wf.workflowId} whose seat terminal Orca does not list: it may be this one`];
  return ['collect', 'kernel', `terminal of settled Kernel job ${job.jobId} (${job.status})`, { owner: job.workflowId }];
};

const supJobOwnerDecision = ({ job }) => {
  const reason = `[Worker] of ${job.status} job ${job.jobId}`;
  if (SUP_LIVE.has(job.status)) return ['keep', 'sup-worker', reason];
  return ['collect', 'sup-worker', reason, { owner: job.jobId }];
};

/** A terminal bound to a ledger job, a Kernel seat or a Supervisor job: [verdict, klass, reason, extra?], or null for an owner of another type. */
const ownedDecision = (cx, owner, h) => {
  if (owner.type === 'kernel') return kernelOwnerDecision(owner);
  if (owner.type === 'job') return jobOwnerDecision(cx, owner, h);
  if (owner.type === 'sup-job') return supJobOwnerDecision(owner);
  return null;
};

/** A terminal nothing binds: only an idle bare shell with prompts on its screen, seen long enough, is collected. */
const unownedDecision = (cx, t, h, shellTitled) => {
  const { now, minAgeMs } = cx;
  if (!shellTitled) return ['keep', 'unknown', 'not a worker Orca accounts for, bound to no ledger and not a plain shell'];
  if (t.agentIdentity) return ['keep', 'unknown', `shell-titled terminal running ${t.agentIdentity}`];
  // A shell no registry knows with output in the last minAgeMs may be the owner's own: reported, never closed.
  if (Number(t.lastOutputAt) > 0 && now - Number(t.lastOutputAt) < minAgeMs) return ['refuse', 'idle-shell', `recent activity ${Math.round((now - Number(t.lastOutputAt)) / 60000)}m ago: may be the owner's, reported not closed`];
  const screen = cx.screenOf(h);
  const s = screen == null ? null : String(screen);
  if (!onlyPrompts(s)) return ['keep', 'unknown', s == null ? 'screen unreadable' : 'shell with something on its screen besides prompts'];
  if (!(cx.shellsAllOld || cx.aged(h))) return ['refuse', 'idle-shell', `idle bare shell seen for less than ${Math.round(minAgeMs / 60000)}m`, { pendingAge: true }];
  return ['collect', 'idle-shell', 'idle bare shell: no agent, bound to nothing, only prompts on screen'];
};

/** The decision for one terminal: [verdict, klass, reason, extra?], or null. */
const terminalDecision = (cx, t, { h, title, shellTitled, role }) => {
  const { sup, workers } = cx;
  if (sup.seat?.handle === h) return ['keep', 'supervisor-seat', 'the live Supervisor seat'];
  if (sup.seatHandles?.includes(h)) return ['keep', 'supervisor-seat', 'an owned supervised seat with unresolved native custody'];
  if (cx.keepTitles.some((re) => re.test(String(title)) || re.test(String(t.title ?? '')))) return ['keep', 'unknown', 'allowlisted (allocation.gc.keepTitles)'];
  if (t.connected === false) return ['keep', role ?? 'unknown', 'already disconnected'];
  if (workers.has(h)) return ['keep', 'orca-worker', 'a worker Orca accounts for (worker-list): released by the agents collector once Orca holds it reclaimable'];
  const owner = cx.ownerOf.get(h);
  return owner ? ownedDecision(cx, owner, h) : unownedDecision(cx, t, h, shellTitled);
};

/** The row of one terminal, or null when no rule decides it. */
const terminalRow = (cx, t) => {
  const h = t.handle;
  const title = cx.titles.get(h) ?? t.title ?? '';
  const worktreeName = path.basename(String(t.worktreePath ?? ''));
  const shellTitled = isShellTitle(title, { worktreeName }) || isShellTitle(t.title, { worktreeName });
  const role = shellTitled ? 'shell' : null;
  const decision = terminalDecision(cx, t, { h, title, shellTitled, role });
  if (!decision) return null;
  const [verdict, klass, reason, extra = {}] = decision;
  return { handle: h, role, klass, verdict, reason, title: String(title).slice(0, 120), worktree: t.worktreePath ?? null, ...extra };
};

/**
 * Decide every listed terminal. Pure over its inputs: terminals (terminal-list rows), titles (handle -> tab title),
 * sup (supervisorView), ledgers (ledgerView[]), workers (the handles Orca accounts for as workers it has not released,
 * lib/worker-accounting.mjs workerTerminalHandles), screenOf(handle) -> screen text | null, procs (host-health rows |
 * null), seen ({handle: firstSeenMs}), now, minAgeMs. Returns [{handle, role, klass, verdict: 'collect'|'keep'|'refuse',
 * reason, owner?, title}]. A worker terminal is Orca's to account for (the agents collector releases it from
 * worker-list); this decides only the terminals the ledgers bind by handle and Orca does not account for, and the
 * idle bare shells. Nothing is identified by a tab title beyond the plain shell title.
 */
export function classifyTerminals({ terminals, titles, sup, ledgers, workers = new Set(), screenOf, procs = null, seen = {}, now = Date.now(), minAgeMs = DEFAULTS.gcMinAgeMs, keepTitles = [] }) {
  const { ownerOf, liveJobHandles } = terminalOwners(ledgers, sup);
  const cx = { titles, sup, ledgers, workers, screenOf, now, minAgeMs, keepTitles, ownerOf, liveJobHandles,
    listed: new Set(terminals.filter((t) => t.connected !== false).map((t) => t.handle)),
    aged: (h) => seen[h] != null && now - seen[h] >= minAgeMs, shellsAllOld: shellsAllOld(procs, now, minAgeMs) };
  return terminals.map((t) => terminalRow(cx, t)).filter(Boolean);
}

/** The typed failure of a Run whose worker-list did not answer (modules/kernel/failure-codes.yaml). */
export const WORKER_LIST_UNAVAILABLE = 'WORKER_LIST_UNAVAILABLE';

/** The Orca Runs the runtime owns: every Run a product ledger's job or a Supervisor job names, first-seen order. */
const runtimeRuns = ({ sup, ledgers }) => distinctRuns([...ledgers.flatMap((l) => l.jobs.map((j) => j.task?.runId)), ...sup.jobs.map((j) => j.runId)]);

/**
 * Orca's worker accounting for the runtime's Runs: every Orca Run a product ledger's job or a Supervisor job names,
 * each listed with --run (never the caller's bound Run) and paged past 100 rows. {rows, runs, errors}: a Run whose
 * listing failed contributes no row, so none of its workers is touched.
 */
function runtimeWorkers({ sup, ledgers, list = (run) => workerListAll({ run }) }) {
  const runs = runtimeRuns({ sup, ledgers });
  const rows = [], errors = [];
  for (const run of runs) {
    let listed;
    try { listed = list(run); } catch (error) { listed = { ok: false, error: String(error?.message ?? error) }; }
    if (!listed?.ok) { errors.push(`${WORKER_LIST_UNAVAILABLE}: worker-list --run ${run}: ${listed?.error ?? 'Orca did not answer'} - no worker of that Run was touched`); continue; }
    rows.push(...listed.workers);
  }
  return { rows, runs, errors };
}

/* ------------------------------------------------------------ processes */

/**
 * The leaked processes of a process table. Pure. [{pid, name, kind, reason, ws}]:
 *   orphan-agent  an agent CLI (isAgentProcess) whose parent is gone, older than minAgeMs - never the Claude desktop
 *                 app (WindowsApps, --type= helpers)
 *   orphan-shell  a child-less `powershell -NoExit` under the Orca daemon, older than minAgeMs, beyond the number of
 *                 terminals Orca lists (`listedCount`): no tab owns that many shells; the oldest go first
 */
export function orphanProcesses({ table, now = Date.now(), minAgeMs = DEFAULTS.gcMinAgeMs, listedCount = null }) {
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const parentOf = (p) => { const q = byPid.get(p.ppid); return q && !(q.created && p.created && q.created > p.created) ? q : null; };
  const old = (p) => Number(p.created) > 0 && now - Number(p.created) >= minAgeMs;
  const out = [];
  for (const p of table) {
    if (!isAgentProcess(p) || !old(p) || parentOf(p)) continue;
    if (/WindowsApps/i.test(String(p.exe ?? p.cmd ?? '')) || /--type=/.test(String(p.cmd ?? ''))) continue;
    out.push({ pid: p.pid, name: p.name, kind: 'orphan-agent', reason: 'agent CLI whose parent process is gone (leaked from a closed terminal)', ws: Number(p.ws) || null });
  }
  if (Number.isInteger(listedCount)) {
    const hasKids = new Set(table.map((p) => p.ppid));
    const shells = table.filter((p) => /^(powershell|pwsh)\.exe$/i.test(p.name ?? '') && /-NoExit/i.test(p.cmd ?? '') && ORCA_DAEMON.test(String(parentOf(p)?.exe ?? '')));
    const surplus = shells.length - listedCount;
    if (surplus > 0) {
      const idle = shells.filter((p) => !hasKids.has(p.pid) && old(p)).sort((a, b) => a.created - b.created).slice(0, surplus);
      for (const p of idle) out.push({ pid: p.pid, name: p.name, kind: 'orphan-shell', reason: `child-less PowerShell under the Orca daemon with no tab (${shells.length} shells, ${listedCount} terminals listed)`, ws: Number(p.ws) || null });
    }
  }
  return out;
}

/* ------------------------------------------------------------ the run */

/** The one owner-digest line (Vietnamese per config.yaml language vi; English otherwise). */
export function gcLine(counts, { language = ownerLanguage(), apply = true } = {}) {
  const bytes = (counts.freedBytes ?? 0) + (counts.ramFreedBytes ?? 0);
  return translator(language)(
    apply ? 'Garbage collected: {agents} agent(s), {terminals} terminal(s), {worktrees} worktree(s), {bytes}'
      : 'Garbage collected (dry run): {agents} agent(s), {terminals} terminal(s), {worktrees} worktree(s), {bytes}',
    { agents: counts.agents, terminals: counts.terminals, worktrees: counts.worktrees, bytes: fmtGb(bytes) });
}

const wantsProcesses = (want) => want.has('shells') || want.has('agents');

/** Orca's worker accounting for the runtime's Runs: the agents collector releases from it, and every terminal it
 *  accounts for is Orca's (the terminal decisions leave it alone). */
function loadWorkerRows(rc) {
  const { want, sup, ledgers, deps, report } = rc;
  if (!wantsProcesses(want)) return;
  const w = runtimeWorkers({ sup, ledgers, list: deps.workers ?? ((run) => workerListAll({ run })) });
  rc.workerRows = w.rows;
  if (w.errors.length) { report.ok = false; report.errors.push(...w.errors); }
}

const releaseWorkerOf = (deps, d) => {
  try { return (deps.release ?? closeWorker)({ dispatch: d.dispatchId }); } catch (error) { return { ok: false, error: String(error?.message ?? error) }; }
};

/** One worker Orca holds reclaimable: released (apply) or reported. */
function releaseWorker(rc, settledAt, d) {
  const { report, apply, deps, now } = rc;
  if (d.verdict === 'keep') return;
  const since = Number(settledAt.get(d.terminalHandle)) || null;
  const it = { class: 'worker', action: 'release-worker', target: d.dispatchId, terminal: d.terminalHandle, run: d.runId, reason: d.reason, verdict: d.verdict === 'release' ? 'collect' : 'refuse',
    terminalState: d.terminalState, liveness: d.liveness, leftover: d.verdict === 'release' };
  if (d.verdict === 'refuse') { report.items.push({ ...it, code: 'WORKER_RELEASE_REFUSED', since, ageMs: since == null ? null : Math.max(0, now - since) }); report.counts.refused += 1; return; }
  if (!apply) { report.items.push({ ...it, ok: null }); }
  else {
    const r = releaseWorkerOf(deps, d);
    report.items.push({ ...it, ok: r?.ok === true, state: r?.state ?? null, ...(r?.ok ? {} : { code: 'WORKER_RELEASE_FAILED', error: r?.error ?? r?.outcome ?? 'release failed' }) });
    if (!r?.ok) { report.errors.push(`WORKER_RELEASE_FAILED: worker-release --dispatch ${d.dispatchId}: ${r?.error ?? r?.outcome ?? 'failed'}`); return; }
  }
  report.counts.agents += 1;
  report.counts.leftovers += 1;
}

/** The agents collector: release every worker Orca holds reclaimable. */
function releaseWorkers(rc) {
  if (!rc.want.has('agents')) return;
  // When the job that held a worker's terminal last changed (its settle): the age of a worker Orca still holds.
  const settledAt = new Map([...rc.ledgers.flatMap((l) => l.jobs.flatMap((j) => j.handles.map((h) => [h, j.updatedAt ?? null]))),
    ...rc.sup.jobs.filter((j) => j.handle).map((j) => [j.handle, j.updatedAt ?? null])]);
  for (const d of releasePlan(rc.workerRows)) releaseWorker(rc, settledAt, d);
}

const readScreen = (deps, h) => {
  try { const r = (deps.read ?? terminalRead)({ terminal: h, screen: true }); return r?.ok ? r.screen ?? '' : null; } catch { return null; }
};
/** The screen of a terminal, read once per run. */
const screenReader = (deps) => {
  const screens = new Map();
  return (h) => {
    if (!screens.has(h)) screens.set(h, readScreen(deps, h));
    return screens.get(h);
  };
};
const processesOf = async (deps) => {
  try { return await (deps.procs ?? (async () => (await import('./host-health.mjs')).listProcessesAsync()))(); } catch { return null; }
};

/** Close one decided terminal and verify it: true when it is gone (its sighting is dropped), false with the error recorded. */
function closeVerified(rc, d, it, isShell) {
  const { report, deps, seenNow, closedNow } = rc;
  const r = (deps.close ?? closeAndVerify)(d.handle);
  report.items.push({ ...it, ok: r?.ok === true, proof: r?.proof ?? null, ...(r?.ok ? {} : { error: r?.reason ?? r?.error ?? 'close failed' }) });
  if (!r?.ok) { report.errors.push(`close ${d.handle} (${d.klass}): ${r?.reason ?? r?.error ?? 'failed'}`); return false; }
  delete seenNow[d.handle];
  if (isShell) closedNow.push(d.handle);
  return true;
}

/** One decided terminal: closed and verified (apply) or reported; first sightings of idle shells are kept. */
function closeDecided(rc, d) {
  const { want, report, apply, now, seenNow, state } = rc;
  const isShell = d.klass === 'idle-shell';
  if (isShell ? !want.has('shells') : !want.has('agents')) return;
  // First sightings are kept for shells only: they alone wait out an age before they are closed.
  if (isShell && d.verdict !== 'keep') seenNow[d.handle] = { at: state.seen[d.handle] ?? now, title: d.title ?? null };
  if (d.verdict === 'keep') {
    // Not the runtime's: named in the report (never touched) so the owner sees what was left alone and why.
    if (d.klass === 'unknown') report.items.push({ class: 'unknown', action: 'none', target: d.handle, title: d.title, reason: d.reason, verdict: 'keep' });
    return;
  }
  const it = { class: d.klass, action: 'close-terminal', target: d.handle, title: d.title, reason: d.reason, owner: d.owner ?? null, verdict: d.verdict, leftover: !isShell,
    ...(isShell ? { firstSeenAt: seenNow[d.handle]?.at ?? now } : {}) };
  if (d.verdict === 'refuse') { report.items.push(it); if (!d.pendingAge) { report.counts.refused += 1; } return; }
  if (!apply) report.items.push({ ...it, ok: null });
  else if (!closeVerified(rc, d, it, isShell)) return;
  report.counts[isShell ? 'terminals' : 'agents'] += 1;
  if (!isShell) report.counts.leftovers += 1;
}

/** The agents and shells collectors over Orca's terminal list. */
async function closeTerminals(rc) {
  const { want, deps, report, sup, ledgers, now, settings, state, workerRows } = rc;
  if (!wantsProcesses(want)) return;
  const listed = (deps.list ?? (() => terminalList({ includeVisualLayouts: true })))();
  if (!listed?.ok) { report.ok = false; report.errors.push(`terminal list: ${listed?.error ?? 'Orca did not answer'} - no terminal was touched`); return; }
  const procs = want.has('shells') ? await processesOf(deps) : null;
  const decided = classifyTerminals({ terminals: listed.terminals ?? [], titles: tabTitles(listed.visualLayouts), sup, ledgers, workers: workerTerminalHandles(workerRows), screenOf: screenReader(deps), procs, seen: state.seen, now, minAgeMs: settings.minAgeMs, keepTitles: settings.keepTitles });
  rc.lastListedCount = (listed.terminals ?? []).filter((t) => t.connected !== false).length;
  for (const d of decided) closeDecided(rc, d);
}

/** Kill one leaked process (apply) or report it. */
function killLeaked(rc, p) {
  const { apply, deps, report } = rc;
  let ok = null;
  if (apply) { ok = deps.kill ? deps.kill(p.pid) : killTree(p.pid).ok; if (ok) report.counts.processes += 1; else report.errors.push(`kill ${p.pid} (${p.kind}) failed`); }
  report.items.push({ class: 'process', action: 'kill-tree', target: `pid ${p.pid} ${p.name}`, verdict: 'collect', reason: p.reason, ok, ramBytes: p.ws ?? null });
}

// Processes (owner 2026-09-28: closing a tab while the agent process lingers doesn't count; free orphan PowerShell
// under the Orca daemon): after the closes, (1) agent CLIs whose parent is gone, older than minAgeMs, are killed; (2) child-less
// `powershell -NoExit` shells under the Orca daemon beyond the number of terminals Orca lists (no tab owns them),
// older than minAgeMs, oldest first, are killed.
function killOrphans(rc) {
  const { want, deps, apply, now, settings, report } = rc;
  if (!wantsProcesses(want)) return;
  try {
    const table = (deps.table ?? processTable)();
    const listedNow = apply ? (deps.list ?? (() => terminalList({})))() : null;
    if (!table) return;
    const listedCount = listedNow?.ok ? listedNow.terminals.filter((t) => t.connected !== false).length : rc.lastListedCount;
    for (const p of orphanProcesses({ table, now, minAgeMs: settings.minAgeMs, listedCount })) killLeaked(rc, p);
  } catch (error) { report.errors.push(`processes: ${String(error?.message ?? error).slice(0, 200)}`); }
}

const laneReportItem = (i) => ({ class: 'lane', action: 'remove-worktree', target: i.target, reason: i.reason, verdict: i.verdict === 'keep' ? 'refuse' : i.verdict,
  ...(i.branch ? { branch: i.branch } : {}), ...(i.bytes != null ? { bytes: i.bytes } : {}), ...(i.ok != null ? { ok: i.ok } : { ok: null }), ...(i.unmerged ? { unmerged: true } : {}), ...(i.worktree ? { worktree: true } : {}) });

/** The lane items of the lanes collector as report items; kept lanes only when unmerged or owned. */
function reportLaneItems(report, items) {
  for (const i of items) {
    if (i.verdict === 'keep' && !i.unmerged && !i.liveOwner) continue;
    report.items.push(laneReportItem(i));
    if (i.verdict === 'collect' && i.worktree) report.counts.worktrees += 1;
    if (i.verdict === 'keep') report.counts.refused += 1;
  }
}

const skippedLanes = (stoppedMark) => ({ items: [], freedBytes: 0, errors: [`lanes skipped: the worktree GC is stopped since ${new Date(stoppedMark.at).toISOString()} (${(stoppedMark.damage ?? []).join('; ').slice(0, 200)})`], progress: { total: 0, done: 0, complete: false, next: null, stopped: true } });

/** The lanes collector. */
async function sweepLanes(rc) {
  const { want, deps, env, apply, now, settings, sup, report } = rc;
  if (!want.has('lanes')) return;
  let landBusy = false;
  try { landBusy = await Promise.resolve((deps.landBusy ?? (async () => (await import('./land.mjs')).landStatus({ env }).busy))()); } catch { landBusy = true; }
  // The live owners of a lane: Orca's active workers over every Run (null when Orca is down or answers for one Run).
  const laneWorkers = (deps.activeWorkers ?? (() => activeWorkersAllRuns()))();
  // A removal that ever changed a main checkout stops every worktree removal until an operator clears it
  // (starci machine worktrees resume): the same stop mark as the worktree GC.
  const stoppedMark = (deps.gcStop ?? (() => readSupervisor((m) => m.worktreeGcStop(), null, { env })))();
  const cursor = (deps.laneCursor ?? readLaneCursor)(env);
  const l = stoppedMark ? skippedLanes(stoppedMark) : collectLanes({ apply, env, now, settings, sup, git: deps.git ?? null, landBusy, workers: laneWorkers, cursor, clock: deps.clock ?? Date.now });
  report.progress = { ...report.progress, lanes: l.progress };
  // A partial pass resumes where it stopped; a complete one starts over next time (a dry run never moves the cursor).
  if (apply && !stoppedMark) (deps.writeLaneCursor ?? writeLaneCursor)(l.progress.complete ? null : l.progress.next, env);
  if (stoppedMark) { report.ok = false; report.stopped = { reason: 'main-checkout-damaged', ...stoppedMark, since: stoppedMark.at }; }
  if (l.fatal) {
    report.ok = false; report.stopped = { reason: 'main-checkout-damaged', ...l.fatal };
    try { (deps.setGcStop ?? ((stop) => withSupervisor((m) => m.setWorktreeGcStop(stop), { env })))({ at: Date.now(), ...l.fatal }); } catch { /* the report carries it */ }
  }
  reportLaneItems(report, l.items);
  report.counts.freedBytes += l.freedBytes;
  report.errors.push(...l.errors);
}

/** The tmp collector: runtime-prefixed %TEMP% entries past tmpMaxAgeMs. */
async function sweepTmpEntries(rc) {
  const { want, deps, apply, now, env, settings, report } = rc;
  if (!want.has('tmp')) return;
  try {
    const sweep = deps.sweepTmp ?? (await import('../housekeeping/hk-tmp.mjs')).sweepTmp;
    const r = await sweep({ apply, now, env, allocation: settings.housekeeping });
    const n = apply ? (r.deleted?.length ?? 0) : (r.skipped ?? []).filter((s) => /dry run/.test(s.reason ?? '')).length;
    report.counts.tmp += n;
    report.counts.freedBytes += Number(r.freedBytes) || 0;
    if (n) report.items.push({ class: 'tmp', action: 'remove-temp', target: `%TEMP% (${n} entr${n === 1 ? 'y' : 'ies'})`, verdict: 'collect', reason: apply ? 'runtime-prefixed temp entries past tmpMaxAgeMs removed' : 'would remove runtime-prefixed temp entries past tmpMaxAgeMs', bytes: Number(r.freedBytes) || 0, ok: apply ? r.ok !== false : null });
    for (const e of r.errors ?? []) report.errors.push(('tmp: ' + (typeof e === 'string' ? e : String(e.path ?? '') + ' ' + String(e.error ?? e.message ?? ''))).slice(0, 200));
  } catch (error) { report.errors.push(`tmp: ${String(error?.message ?? error).slice(0, 200)}`); }
}

/** The leases collector: report-only. */
function reportLeaseLeaks(rc) {
  const { want, sup, ledgers, now, settings, report } = rc;
  if (!want.has('leases')) return;
  const rows = [...(sup.leases ?? []).map((r) => ({ ...r, ledger: 'supervisor' })), ...ledgers.flatMap((l) => (l.leases ?? []).map((r) => ({ ...r, ledger: path.basename(l.repo) })))];
  for (const lk of classifyLeases({ rows, now, minAgeMs: settings.leaseMinAgeMs })) {
    report.items.push({ class: 'lease', action: 'report-lease', target: `${lk.ledger}:${lk.resourceKey}`, owner: lk.jobId, verdict: 'refuse', reportOnly: true, leftover: true, ok: null,
      ledger: lk.ledger, jobId: lk.jobId, workflowId: lk.workflowId,
      reason: `LEASE_LEAK: lease ${lk.resourceKey} still held although ${lk.why}; no api path deletes a settled job's lease - reported, not deleted` });
    report.counts.leases += 1;
  }
}

/** The lanelogs collector. */
function archiveLogs(rc) {
  const { want, apply, env, now, settings, deps, report } = rc;
  if (!want.has('lanelogs')) return;
  try {
    const r = collectLaneLogs({ apply, env, now, settings, fsx: deps.fsx ?? null });
    report.items.push(...r.items);
    report.counts.laneLogs += r.items.filter((i) => i.verdict === 'collect').length;
    report.counts.refused += r.items.filter((i) => i.verdict === 'refuse').length;
    report.counts.freedBytes += r.freedBytes;
    report.errors.push(...r.errors);
  } catch (error) { report.errors.push(`lanelogs: ${String(error?.message ?? error).slice(0, 200)}`); }
}

/** The machine log rows of a run: one gc.collect per item, one gc.summary. */
const gcLogRows = (report, { now, apply }) => {
  const rows = report.items.map((i) => ({ kind: 'gc.collect', at: now, level: i.ok === false ? 'warn' : 'info',
    msg: `${apply ? '' : '[dry-run] '}${i.verdict} ${i.class} ${i.action} ${i.target}${i.title ? ' "' + String(i.title).slice(0, 60) + '"' : ''}: ${String(i.reason ?? '').slice(0, 160)}`,
    data: { class: i.class, action: i.action, target: String(i.target), ...(i.owner ? { owner: String(i.owner) } : {}), ...(typeof i.ok === 'boolean' ? { ok: i.ok } : {}),
      ...(i.proof ? { proof: i.proof } : {}), reason: `${i.verdict}: ${String(i.reason ?? '').slice(0, 400)}`, ...(i.bytes != null ? { bytes: i.bytes } : {}), apply, ...(i.leftover ? { leftover: true } : {}) },
    refs: i.owner ? String(i.owner).split(',').map((o) => (o.startsWith('wf-') ? `workflow:${o}` : `job:${o}`)) : [] }));
  rows.push({ kind: 'gc.summary', at: now, level: report.errors.length ? 'warn' : 'info', msg: report.line,
    data: { agents: report.counts.agents, terminals: report.counts.terminals, worktrees: report.counts.worktrees, freedBytes: report.counts.freedBytes,
      apply, ramFreedBytes: report.counts.ramFreedBytes, refused: report.counts.refused, errors: report.errors.length, leftovers: report.counts.leftovers,
      evidence: report.counts.evidence, tmp: report.counts.tmp, leases: report.counts.leases, laneLogs: report.counts.laneLogs, line: report.line } });
  return rows;
};

/** The leftovers of an apply run grouped by class, for the lessons (a leftover is a bug in its owner step). */
const leftoversByClass = (report) => {
  const byClass = {};
  for (const i of report.items) if (i.leftover && (i.ok || i.reportOnly)) { byClass[i.class] ??= []; byClass[i.class].push(`${i.target} ${String(i.title ?? '').slice(0, 50)}`.trim()); }
  if (report.counts.terminals) byClass['idle-shell'] = report.items.filter((i) => i.class === 'idle-shell' && i.ok).map((i) => i.target);
  return byClass;
};

/** One lesson per class (lessons.mjs recordLeftover, deduped per day). */
async function recordLessons(rc) {
  const { apply, report, deps, env, now } = rc;
  if (!apply) return;
  const byClass = leftoversByClass(report);
  try {
    const record = deps.lesson ?? (await import('../machine/lessons.mjs')).recordLeftover;
    for (const [klass, examples] of Object.entries(byClass)) {
      if (examples.length) record({ klass, count: examples.length, examples: LEFTOVER_OWNERS[klass] ? [`owner step: ${LEFTOVER_OWNERS[klass]}`, ...examples] : examples, env, now });
    }
  } catch { /* the lesson is best effort */ }
}

const languageOf = (language, deps) => language ?? (() => { try { return deps.language ?? null; } catch { return null; } })() ?? ownerLanguage();

/** After the collectors: free RAM read back, the summary line, the machine log and records, the lessons. */
async function finishRun(rc) {
  const { apply, report, deps, env, now, trigger, started, language, freeBefore, seenNow, closedNow } = rc;
  if (apply && (report.counts.agents || report.counts.terminals)) {
    // Orca stops the PTY trees on close; give the OS a moment before reading free RAM back.
    await new Promise((r) => setTimeout(r, deps.settleMs ?? 3000));
    report.counts.ramFreedBytes = Math.max(0, (deps.freemem ?? os.freemem)() - freeBefore);
  }
  report.ok = report.ok && report.errors.length === 0;
  report.line = gcLine(report.counts, { language: languageOf(language, deps), apply });
  report.durationMs = Date.now() - started;
  // The machine log: one gc.collect per item, one gc.summary.
  const rows = gcLogRows(report, { now, apply });
  try { if (deps.log) deps.log(rows, { env }); else withSupervisor((m) => m.log(rows.map((r) => ({ actor: 'gc', ...r }))), { env }); } catch { /* best effort */ }
  // The run's machine records (first sightings, closed terminals, gc_runs + gc_items of an apply run).
  report.runId = (deps.writeState ?? writeState)({ seen: seenNow, closed: closedNow, report, trigger, startedAt: now }, env);
  await recordLessons(rc);
}

/** Every collector of one run over the views of the machine, the Supervisor and the ledgers; the report. */
async function sweepAll(rc) {
  const { deps, env, now, report } = rc;
  rc.state = (deps.readState ?? readState)(env);
  rc.sup = (deps.sup ?? supervisorView)({ env, now });
  const repos = deps.repos ?? productRepos();
  rc.ledgers = (deps.ledgers ?? (() => repos.map((r) => { try { return ledgerView(r); } catch { return null; } }).filter(Boolean)))();
  rc.freeBefore = (deps.freemem ?? os.freemem)();
  loadWorkerRows(rc);
  releaseWorkers(rc);
  await closeTerminals(rc);
  killOrphans(rc);
  await sweepLanes(rc);
  await sweepTmpEntries(rc);
  reportLeaseLeaks(rc);
  archiveLogs(rc);
  await finishRun(rc);
  return report;
}

/** A run refused because another GC apply holds the host lock: the report names it, nothing was touched. */
const busyReport = (report, lock, { language, apply, started }) => {
  report.ok = false; report.busy = true;
  report.errors.push(`gc-busy: another GC apply holds the host lock (${JSON.stringify(lock?.holder ?? null).slice(0, 160)}); nothing was touched`);
  report.line = gcLine(report.counts, { language: language ?? ownerLanguage(), apply }); report.durationMs = Date.now() - started;
  return report;
};

/**
 * One GC run. `only` restricts the collectors; `deps` replaces the host seams (workers (run) -> worker-list of one Run,
 * release, activeWorkers, list, read, close, procs, ledgers, sup, git, purge, sweepTmp, log, lesson, freemem). Returns the report (see the header).
 */
export async function runGc({ apply = false, only = null, env = process.env, now = Date.now(), deps = {}, allocation = null, language = null, trigger = 'sweep' } = {}) {
  const started = Date.now();
  const settings = gcSettings(allocation ?? allocationSettings());
  const want = new Set(only ?? COLLECTORS);
  const report = { schema: SCHEMA, apply: apply === true, at: new Date(now).toISOString(), ok: true, items: [], errors: [],
    counts: { agents: 0, terminals: 0, worktrees: 0, processes: 0, evidence: 0, tmp: 0, leases: 0, laneLogs: 0, refused: 0, leftovers: 0, freedBytes: 0, ramFreedBytes: 0 } };
  // The host lock `gc` (live apply runs only: a spec's injected deps never take the host lock unless it passes deps.lock).
  const lockFn = deps.lock ?? (Object.keys(deps).some((k) => k !== 'holder') ? null : acquireGcLock);
  let lock = null;
  if (apply && lockFn) {
    lock = lockFn({ env, holder: deps.holder ?? 'gc.mjs' });
    if (!lock?.ok) return busyReport(report, lock, { language, apply, started });
  }
  try {
    return await sweepAll({ apply, want, env, now, deps, settings, report, trigger, language, started, seenNow: {}, closedNow: [], lastListedCount: 0, workerRows: [] });
  } finally { try { lock?.release?.(); } catch { /* released or taken over */ } }
}

const sectionTitle = (verdict, apply) => (verdict === 'collect' && (apply && 'collected' || 'would collect') || verdict === 'refuse' && 'refused (runtime-owned, kept for a reason)' || 'left alone (not created by the runtime)');
const itemLine = (i) => '  [' + String(i.class) + '] ' + String(i.target) + (i.title ? ' "' + String(i.title).slice(0, 70) + '"' : '') + (i.branch ? ' (' + String(i.branch) + ')' : '') + (i.bytes ? ' ' + (i.bytes / 1024 ** 2).toFixed(0) + ' MB' : '') + ': ' + String(i.reason) + (i.ok === false ? ' FAILED ' + String(i.error ?? '') : '');

/** The report as lines for a human. */
export function describe(report) {
  const lines = [`===== GC ${report.apply ? 'APPLY' : 'DRY-RUN'} ${report.at} ${report.ok ? 'ok' : 'WITH ERRORS'} =====`, report.line,
    `counts: agents ${report.counts.agents}, idle shells ${report.counts.terminals}, worktrees ${report.counts.worktrees}, processes ${report.counts.processes}, evidence ${report.counts.evidence}, tmp ${report.counts.tmp}, leases ${report.counts.leases ?? 0} (report-only), lane logs ${report.counts.laneLogs ?? 0}, refused ${report.counts.refused}; disk ${fmtGb(report.counts.freedBytes)}, RAM ${fmtGb(report.counts.ramFreedBytes)}`];
  const order = ['collect', 'refuse', 'keep'];
  for (const v of order) {
    const rows = report.items.filter((i) => i.verdict === v);
    if (!rows.length) continue;
    lines.push('--- ' + sectionTitle(v, report.apply) + ' (' + rows.length + ') ---');
    for (const i of rows) lines.push(itemLine(i));
  }
  for (const e of report.errors) lines.push(`ERROR ${e}`);
  return lines.join('\n');
}

export function parseArgs(argv = []) {
  const known = new Set(['dry-run', 'apply', 'json', 'only', 'plan', 'holder', 'trigger']);
  const bad = argv.filter((a) => a.startsWith('--') && !known.has(a.slice(2)));
  if (bad.length) return { ok: false, error: `unknown flag(s): ${bad.join(' ')}` };
  const i = argv.indexOf('--only');
  const only = i >= 0 ? String(argv[i + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const unknown = (only ?? []).filter((c) => !COLLECTORS.includes(c));
  if (unknown.length) return { ok: false, error: `unknown collector(s): ${unknown.join(', ')} (known: ${COLLECTORS.join(', ')})` };
  if (argv.includes('--apply') && (argv.includes('--dry-run') || argv.includes('--plan'))) return { ok: false, error: '--apply and --dry-run/--plan together' };
  const value = (name) => { const j = argv.indexOf(name); return j >= 0 && argv[j + 1] && !argv[j + 1].startsWith('--') ? argv[j + 1] : null; };
  return { ok: true, apply: argv.includes('--apply'), plan: argv.includes('--plan'), only, json: argv.includes('--json'), holder: value('--holder'), trigger: value('--trigger') };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) { console.error(`use: starci supervisor gc [--dry-run|--apply] [--only ${COLLECTORS.join(',')}] [--json] (${args.error})`); process.exit(2); }
  const language = ownerLanguage();
  // --plan: no seen-state, no log rows, no lessons; --holder: the host-lock holder of an apply (deps other than holder drop the lock, so name only it)
  const deps = args.plan && { writeState: () => {}, log: () => {}, lesson: () => null } || args.holder && { holder: args.holder } || {};
  const report = await runGc({ apply: args.apply, only: args.only, language, trigger: args.trigger ?? 'manual', deps });
  console.log(args.json ? JSON.stringify(report, null, 2) : describe(report));
  process.exit(report.ok ? 0 : 1);
}
