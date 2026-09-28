#!/usr/bin/env node
// gc.mjs — the Supervisor's garbage collection ("dọn rác"; owner, 2026-09-28: "sao supervisor không xóa worker, và op
// đầy rác thế!!! phải có dọn rác chứ"). Every supervisor tick runs it (tick.mjs, duty gc); an operator runs it by hand.
//
//   node scripts/supervisor/gc.mjs [--dry-run] [--apply] [--only agents,shells,lanes,evidence,tmp,tasks] [--json]
//
// Default is the dry run: every collector reports what it WOULD close or remove and mutates nothing (it only records
// when it first saw a candidate, so the age rules below can hold). --apply closes and removes.
//
// Ownership (owner clarification 2026-09-28): a Kernel closes its own op workers at settle, the Supervisor closes its
// own [Worker]s at report/cancel/land (both through scripts/lib/close-verify.mjs). This GC is the periodic scan for the
// leftovers that slipped past both; every leftover it collects is recorded as a self-derived lesson
// (lessons.mjs recordLeftover): a leftover is a bug in the step that owned it.
//
// Collectors:
//   agents    Orca terminals the runtime created whose owner is done, identified by the ledgers (worker_id, launch
//             handle, kernel signal) and by the tab title the runtime gave them ([Worker] / [Kernel] / [Op] /
//             [Supervisor]) or, for a [Worker] whose agent rewrote its title, the staging path on its screen:
//               sup-worker       a [Worker] whose job is succeeded/failed/cancelled, or a duplicate of a live job's worker
//               supervisor-seat  a [Supervisor] terminal that is not the live seat (a replaced seat)
//               kernel           a [Kernel] of a finished/archived workflow, or one that is not the seat of its live workflow
//               op-worker        an [Op] of a settled job / an ended workflow, or an unbound [Op] of a live workflow
//             Never: the live Supervisor seat, a live Kernel, the terminal of a queued/leased/running/answering/reported
//             job, and nothing the runtime did not create (an owner's own terminal has none of those marks). A live
//             workflow whose running job's registered terminal Orca no longer lists (an Orca restart re-issued handles)
//             is left alone entirely: its unbound tab may be that job. An unbound terminal of a live workflow must have
//             been seen for gcMinAgeMs first.
//   shells    idle bare shells: a plain Orca shell tab (title "Terminal <n>" or the worktree's name), no agent, bound to
//             nothing, whose screen holds nothing but prompts, older than gcMinAgeMs (by first sight, or by the age of
//             every child-less `powershell -NoExit` under the Orca daemon). 322 of them held ~20 GB on 2026-09-28.
//   lanes     worktrees under the lanes root (hk-lanes.mjs lanesRoot): a lane/* branch landed by patch, ledger or
//             file content with a clean tree, idle for gcLaneGraceMs; a sup/<job> staging checkout whose job is finished;
//             a detached land scratch while no land runs; an empty leftover directory. The node_modules junction is
//             unlinked first, then the tree goes through safeRemoveTree (links unlinked, never followed; never
//             `git worktree remove --force`, nivo-fe inc-c8fbf76aa499), then the registration is pruned. Lane branches
//             are kept as commit evidence. Unmerged or dirty lanes are kept and reported.
//   evidence  a finished or archived workflow with no live job, ended longer than gcEvidenceRetentionMs ago: zipped to
//             archiveRoot, verified and purged by scripts/work/purge-workflow.mjs (the one sanctioned delete; the owner
//             approved zip-then-purge on 2026-09-28).
//   tmp       %TEMP% entries with a runtime prefix past tmpMaxAgeMs (hk-tmp.mjs sweepTmp).
//   tasks     Orca Tasks of settled jobs whose close was refused: closed again (task-update completed).
//   leases    lease rows (product ledgers and the supervisor ledger) of a settled job, a job the ledger no longer
//             has, or an ended workflow, older than leaseMinAgeMs (DESIGN §15.2, LEASE_LEAK). No api path deletes
//             the lease of an already-settled job, so this collector REPORTS them (verdict refuse, reportOnly) and
//             never deletes; the reconciler GC controller opens a runtime-defect Decision Item for the Supervisor.
//   lanelogs  *.err / *.json / *.log files at the top level of the lanes root older than laneLogMinAgeMs (24 h):
//             moved to <archiveRoot>/lane-logs/; archived lane logs older than laneLogRetentionMs (14 days, by
//             their last write) are deleted. Subdirectories (the lane worktrees) are never touched.
//
// Host lock `gc` (reconciler lane rc-gc-resource): a live --apply run holds <supervisorHome>/gc.lock, so the tick, a
// hand-run gc.mjs and the reconciler GC controller never overlap; a busy lock returns ok:false, busy:true untouched.
//
// Output: the report {schema, apply, ok, counts, freedBytes, ramFreedBytes, items: [{class, action, target, ...}],
// refused, errors, line}. Every item and one summary are typed rows of the machine log (gc.collect, gc.summary).
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { allocationSettings } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { taskUpdate } from '../api/orca/task-update.mjs';
import { closeAndVerify, isAgentProcess, orcaAgents, processTable, reapOrphaned } from '../lib/close-verify.mjs';
import { gitResult } from '../lib/git.mjs';
import { killProcessTree } from '../lib/kill-tree.mjs';
import { lanesRoot, parseWorktreeList, laneActivity, treeBytes } from '../lib/hk-lanes.mjs';
import { safeRemoveWorktree } from '../lib/safe-remove.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { parseJson, parseJsonOr, readJsonFile } from '../lib/json.mjs';
import { fmtGb } from '../lib/time.mjs';
import { workflowNameOf } from '../lib/display-names.mjs';
import { jobTerminalHandles, ledgerJobs, kernelSignalRows, pathUnder } from '../lib/terminal-ledger.mjs';
import { SKILL_ROOT, SUPERVISOR_WF, FIX_KIND, landRoot, productRepos, seatOf, stagingRoot, supervisorHome, withSupervisorRead } from './home.mjs';
import { removeStaging, unlinkNodeModulesLink } from './workers.mjs';
import { acquireDepsLock } from '../guards/deps-guard.mjs';
import { LANE_IDLE_MS, laneOwnerOf, tabTitles } from '../lib/lane-owner.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const SCHEMA = 'starci/gc-report@1';
/** The supervisor-ledger event the tick records per GC run (tick.mjs); the owner digest sums them (actions.mjs). */
export const GC_EVENT_KIND = 'supervisor-gc';
export const COLLECTORS = Object.freeze(['agents', 'shells', 'lanes', 'evidence', 'tmp', 'tasks', 'leases', 'lanelogs']);
export const DEFAULTS = Object.freeze({ gcMinAgeMs: 600_000, gcLaneGraceMs: 1_800_000, gcEvidenceRetentionMs: 259_200_000, sweepMs: 1_800_000,
  leaseMinAgeMs: 60_000, laneLogMinAgeMs: 86_400_000, laneLogRetentionMs: 1_209_600_000, laneIdleMs: LANE_IDLE_MS });
/** The DESIGN §15.3 leftover class of each new collector's item and the step whose bug it points at. */
export const LEFTOVER_OWNERS = Object.freeze({
  lease: 'settle/reconcile did not release the job lease (scripts/kernel/api.mjs cmdSettle/cmdReconcile DELETE FROM leases, workers.mjs releaseLeases)',
  'lane-log': 'the lane process left its log at the lanes root instead of cleaning it after land',
});
const SETTLED_JOB = new Set(['succeeded', 'failed', 'cancelled']);
const LANE_LOG = /\.(err|json|log)$/i;
export const APPROVAL = Object.freeze({ by: 'owner', ref: 'owner chat 2026-09-28: zip-then-purge approved for finished/archived workflow evidence past retention (gc.mjs)' });
const LIVE_JOB = new Set(['queued', 'leased', 'running', 'answering', 'effect_unknown']);
const HOLDING_JOB = new Set(['running', 'answering']);
const SUP_LIVE = new Set(['queued', 'leased', 'running', 'reported']);
const SUP_FINAL = new Set(['succeeded', 'failed', 'cancelled']);
const ORCA_DAEMON = /[\\/]daemon-host[\\/]/i;
const SHELL_TITLE = /^Terminal \d+$/;
const PROMPT = /PS [A-Za-z]:\\[^>\r\n]*>/g;
const STAGING_ON_SCREEN = /starci-lanes[\\/]+staging[\\/]+(fix-[a-z0-9-]+?-[0-9a-f]{6})\b/i;

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
/** The gc windows of runtimes.yaml allocation.housekeeping, with their defaults. */
export function gcSettings(allocation = allocationSettings()) {
  const hk = allocation?.housekeeping ?? {};
  const gc = allocation?.gc ?? {};
  const keepTitles = (Array.isArray(gc.keepTitles) ? gc.keepTitles : []).map((p) => { try { return new RegExp(String(p)); } catch { return null; } }).filter(Boolean);
  return { minAgeMs: num(hk.gcMinAgeMs, DEFAULTS.gcMinAgeMs), laneGraceMs: num(hk.gcLaneGraceMs, DEFAULTS.gcLaneGraceMs),
    evidenceRetentionMs: num(hk.gcEvidenceRetentionMs, DEFAULTS.gcEvidenceRetentionMs), archiveRoot: hk.archiveRoot || 'D:/starci-archive', housekeeping: hk,
    sweepMs: num(gc.sweepMs, DEFAULTS.sweepMs), keepTitles,
    leaseMinAgeMs: num(gc.leaseMinAgeMs, DEFAULTS.leaseMinAgeMs), laneLogMinAgeMs: num(gc.laneLogMinAgeMs, DEFAULTS.laneLogMinAgeMs),
    laneLogRetentionMs: num(gc.laneLogRetentionMs, DEFAULTS.laneLogRetentionMs),
    // A landed lane worktree goes only after laneIdleMs (60 min) with no git activity, never below gcLaneGraceMs.
    laneIdleMs: Math.max(num(gc.laneIdleMs, DEFAULTS.laneIdleMs), num(hk.gcLaneGraceMs, DEFAULTS.gcLaneGraceMs)) };
}


/* ------------------------------------------------------------ host lock: one GC apply at a time */

export const gcLockFile = (env = process.env) => path.join(supervisorHome(env), 'gc.lock');
/**
 * The host lock `gc`: an apply run (the tick, a hand-run `gc.mjs --apply`, the reconciler GC controller) holds it so
 * two never overlap. {ok, release()} | {ok:false, holder}. A lock whose holder process is gone is taken over.
 */
export function acquireGcLock({ env = process.env, holder = 'gc', waitMs = 0, staleMs = 3_600_000, pollMs = 250 } = {}) {
  return acquireDepsLock({ lockFile: gcLockFile(env), holder: { holder }, waitMs, staleMs, pollMs });
}

/**
 * Whether the periodic sweep is due (owner 2026-09-28: every allocation.gc.sweepMs, default 30 minutes; the tick only
 * checks): true when no supervisor-gc event is younger than sweepMs. {due, lastAt, nextAt}.
 */
export function sweepDue({ env = process.env, now = Date.now(), sweepMs = DEFAULTS.sweepMs } = {}) {
  const lastAt = withSupervisorRead((db) => db.prepare('SELECT created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(SUPERVISOR_WF, GC_EVENT_KIND)?.created_at ?? null, null, { env });
  return { due: lastAt == null || now - lastAt >= sweepMs, lastAt, nextAt: lastAt == null ? now : lastAt + sweepMs };
}

/* ------------------------------------------------------------ state: when a candidate was first seen */

export const stateFile = (env = process.env) => path.join(supervisorHome(env), 'gc-state.json');
export function readState(env = process.env) {
  const s = readJsonFile(stateFile(env));
  return { seen: s?.seen && typeof s.seen === 'object' ? s.seen : {} };
}
export function writeState(state, env = process.env) {
  try { fs.mkdirSync(path.dirname(stateFile(env)), { recursive: true }); fs.writeFileSync(stateFile(env), JSON.stringify(state)); } catch { /* next run re-learns */ }
}

/* ------------------------------------------------------------ pure classification */

// tabTitles and laneOwnerOf live in scripts/lib/lane-owner.mjs (the one lane-removal rule, shared with hk-lanes.mjs).
export { tabTitles, laneOwnerOf };

/** The runtime role a title marks: supervisor | worker | kernel | op | shell | null. `worktreeName` is the tab's worktree folder. */
export function roleOfTitle(title, { worktreeName = null } = {}) {
  const t = String(title ?? '').trim();
  if (/^\[Supervisor\]/.test(t) || /You are the \[Supervisor\] kernel/.test(t)) return 'supervisor';
  if (/^\[Worker\]\s/.test(t)) return 'worker';
  if (/^\[Kernel\]\s/.test(t)) return 'kernel';
  if (/^\[Op\]\s/.test(t)) return 'op';
  if (SHELL_TITLE.test(t) || (worktreeName && t === worktreeName)) return 'shell';
  return null;
}

/** True when a terminal screen holds nothing but PowerShell prompts (wrapped lines joined back). */
export function onlyPrompts(screen) {
  if (screen == null) return false;
  const joined = String(screen).replace(/\r?\n/g, '');
  if (!PROMPT.test(joined)) return false;
  return joined.replace(PROMPT, '').trim() === '';
}

/** The workflows of a ledger view whose display name the title names ([Kernel] <name> / [Op] ... · <name>). */
export function workflowsNamed(title, workflows) {
  const rest = String(title ?? '').replace(/^\[(?:Kernel|Op)\]\s*/, '').trim();
  const clipped = rest.endsWith('…') ? rest.slice(0, -1).trim() : null;
  return workflows.filter((w) => {
    const name = String(w.name ?? '').trim();
    if (!name) return false;
    if (rest === name || rest.endsWith(` · ${name}`) || rest === w.workflowId) return true;
    if (clipped && (name.startsWith(clipped) || clipped.endsWith(name))) return true;
    return false;
  });
}

/* ------------------------------------------------------------ registry: what the ledgers own */

/** The supervisor ledger's view: {seat, jobs: [{jobId, status, cluster, handle, stagingPath, branch, base}]}. */
export function supervisorView({ env = process.env, now = Date.now() } = {}) {
  return withSupervisorRead((db) => {
    const seat = seatOf(db, now);
    const jobs = db.prepare('SELECT job_id, status, worker_id, payload_json, updated_at FROM jobs WHERE workflow_id=? AND kind=?').all(SUPERVISOR_WF, FIX_KIND).map((r) => {
      const p = parseJsonOr(r.payload_json);
      return { jobId: r.job_id, status: r.status, cluster: p.cluster ?? null, handle: r.worker_id ?? null, self: p.self === true,
        stagingPath: p.staging?.path ?? null, branch: p.staging?.branch ?? null, base: p.staging?.base ?? null, updatedAt: r.updated_at };
    });
    return { seat: seat ? { handle: seat.value?.terminal ?? null, live: !seat.expired && !seat.starting } : null, jobs, leases: leaseRowsOf(db) };
  }, { seat: null, jobs: [], leases: [] }, { env });
}

/** One product ledger's view: {repo, workflows: [{workflowId, name, ended, endedAt, kernelHandle}], jobs: [{jobId, workflowId, kind, status, handles}]}. */
export function ledgerView(repo) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) return null;
  const h = inspectLedger({ file });
  try {
    const db = h.db;
    const signals = new Map(kernelSignalRows(db).map((s) => [s.key, s.value?.terminal ?? null]));
    const purged = new Set((() => { try { return db.prepare("SELECT workflow_id FROM workflow_purges WHERE state='purged'").all().map((r) => r.workflow_id); } catch { return []; } })());
    const workflows = db.prepare('SELECT workflow_id, phase, archived_at, updated_at FROM workflows').all().map((w) => ({
      workflowId: w.workflow_id, name: (() => { try { return workflowNameOf(db, w.workflow_id); } catch { return null; } })(),
      ended: w.phase === 'finished' || w.archived_at != null, endedAt: w.archived_at ?? (w.phase === 'finished' ? w.updated_at : null),
      purged: purged.has(w.workflow_id), kernelHandle: signals.get(w.workflow_id) ?? null }));
    const updatedAt = new Map((() => { try { return db.prepare('SELECT job_id, updated_at FROM jobs').all().map((r) => [r.job_id, r.updated_at]); } catch { return []; } })());
    const jobs = ledgerJobs(db).map((j) => ({ jobId: j.job_id, workflowId: j.workflow_id, kind: j.kind, status: j.status, updatedAt: updatedAt.get(j.job_id) ?? null,
      handles: [...new Set([...jobTerminalHandles(j, j.payload), j.payload?.launchTerminal?.handle].filter(Boolean))],
      task: (() => { const p = j.payload; const taskId = p?.orca?.taskId ?? p?.managed?.taskId ?? p?.hierarchy?.runtime?.taskId ?? null;
        return taskId ? { taskId, runId: p?.orca?.runId ?? p?.managed?.runId ?? p?.hierarchy?.runtime?.runId ?? null, closed: p?.taskClosed?.ok === true } : null; })() }));
    return { repo: path.resolve(repo), workflows, jobs, leases: leaseRowsOf(db) };
  } finally { h.close(); }
}

/** Every lease row of a ledger with its job's and workflow's state (the leases collector's input). */
export function leaseRowsOf(db) {
  try {
    return db.prepare(`SELECT l.resource_key resourceKey, l.job_id jobId, l.workflow_id workflowId, l.acquired_at acquiredAt, l.expires_at expiresAt,
        j.status jobStatus, j.updated_at jobUpdatedAt, w.phase phase, w.archived_at archivedAt, w.updated_at workflowUpdatedAt
      FROM leases l LEFT JOIN jobs j ON j.job_id=l.job_id LEFT JOIN workflows w ON w.workflow_id=l.workflow_id`).all();
  } catch { return []; }
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
    const why = r.jobStatus == null ? 'its job is gone from the ledger' : settled ? `its job ${r.jobId} is ${r.jobStatus}` : `its workflow ${r.workflowId} ended`;
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

/** Decide and (apply) archive the lane logs. `fsx` {list(dir), move(from, to), remove(file)} is the spec seam. {items, freedBytes, errors}. */
export function collectLaneLogs({ apply = false, env = process.env, now = Date.now(), settings, fsx = null }) {
  const base = lanesRoot({ env });
  const archiveDir = path.join(settings.archiveRoot, 'lane-logs');
  const list = fsx?.list ?? dirEntries;
  const top = list(base), archived = list(archiveDir);
  const plan = planLaneLogs({ top, archived, now, minAgeMs: settings.laneLogMinAgeMs, retentionMs: settings.laneLogRetentionMs });
  const items = [], errors = [];
  let freedBytes = 0;
  const bytesOf = (entries, name) => entries.find((e) => e.name === name)?.bytes ?? 0;
  for (const name of plan.move) {
    const from = path.join(base, name), to = path.join(archiveDir, name);
    let ok = null;
    if (apply) { try { (fsx?.move ?? moveFile)(from, to); ok = true; } catch (error) { ok = false; errors.push(`lane log ${from}: ${String(error?.message ?? error).slice(0, 160)}`); } }
    items.push({ class: 'lane-log', action: 'archive-file', target: from, verdict: ok === false ? 'refuse' : 'collect', reason: `${apply ? 'moved' : 'would move'} to ${archiveDir} (older than ${Math.round(settings.laneLogMinAgeMs / 3_600_000)}h)`, ok, leftover: true, bytes: bytesOf(top, name) });
  }
  for (const name of plan.purge) {
    const p = path.join(archiveDir, name);
    let ok = null;
    if (apply) { try { (fsx?.remove ?? ((f) => fs.unlinkSync(f)))(p); ok = true; freedBytes += bytesOf(archived, name); } catch (error) { ok = false; errors.push(`archived lane log ${p}: ${String(error?.message ?? error).slice(0, 160)}`); } }
    else freedBytes += bytesOf(archived, name);
    items.push({ class: 'lane-log', action: 'remove-file', target: p, verdict: ok === false ? 'refuse' : 'collect', reason: `${apply ? 'deleted' : 'would delete'}: archived lane log older than ${Math.round(settings.laneLogRetentionMs / 86_400_000)} days`, ok, bytes: bytesOf(archived, name) });
  }
  return { items, freedBytes, errors };
}

/**
 * Decide every listed terminal. Pure over its inputs: terminals (terminal-list rows), titles (handle -> tab title),
 * sup (supervisorView), ledgers (ledgerView[]), screenOf(handle) -> screen text | null, procs (host-health rows | null),
 * seen ({handle: firstSeenMs}), now, minAgeMs. Returns [{handle, role, klass, verdict: 'collect'|'keep'|'refuse',
 * reason, owner?, title}].
 */
export function classifyTerminals({ terminals, titles, sup, ledgers, screenOf, procs = null, seen = {}, now = Date.now(), minAgeMs = DEFAULTS.gcMinAgeMs, runtimeRoot = SKILL_ROOT, keepTitles = [] }) {
  const listed = new Set(terminals.filter((t) => t.connected !== false).map((t) => t.handle));
  const out = [];
  const aged = (h) => seen[h] != null && now - seen[h] >= minAgeMs;
  // Every child-less `powershell -NoExit` under the Orca daemon older than minAgeMs: no shell can be younger.
  const shellsAllOld = (() => {
    if (!Array.isArray(procs)) return false;
    const byPid = new Map(procs.map((p) => [p.pid, p]));
    const hasKids = new Set(procs.map((p) => p.ppid));
    const shells = procs.filter((p) => /^(powershell|pwsh)\.exe$/i.test(p.name ?? '') && /-NoExit/i.test(p.cmd ?? '') && ORCA_DAEMON.test(byPid.get(p.ppid)?.exe ?? '') && !hasKids.has(p.pid));
    return shells.length > 0 && shells.every((p) => p.created && now - p.created >= minAgeMs);
  })();
  const liveJobHandles = new Set();
  const ownerOf = new Map();
  for (const l of ledgers) {
    for (const j of l.jobs) for (const h of j.handles) {
      if (!ownerOf.has(h) || LIVE_JOB.has(j.status)) ownerOf.set(h, { type: 'job', repo: l.repo, job: j });
      if (LIVE_JOB.has(j.status)) liveJobHandles.add(h);
    }
    for (const w of l.workflows) if (w.kernelHandle) ownerOf.set(w.kernelHandle, { type: 'kernel', repo: l.repo, workflow: w });
  }
  for (const j of sup.jobs) if (j.handle && j.handle !== 'supervisor') {
    if (!ownerOf.has(j.handle) || SUP_LIVE.has(j.status)) ownerOf.set(j.handle, { type: 'sup-job', job: j });
    if (SUP_LIVE.has(j.status)) liveJobHandles.add(j.handle);
  }
  // A live workflow is "unsafe" when a job holding a worker has none of its registered terminals in the listing.
  const unsafeWorkflows = new Set();
  for (const l of ledgers) for (const j of l.jobs) if (HOLDING_JOB.has(j.status) && !j.handles.some((h) => listed.has(h))) unsafeWorkflows.add(j.workflowId);
  const ledgerOfPath = (p) => ledgers.find((l) => pathUnder(p, l.repo)) ?? null;

  for (const t of terminals) {
    const h = t.handle;
    const title = titles.get(h) ?? t.title ?? '';
    const worktreeName = path.basename(String(t.worktreePath ?? ''));
    let role = roleOfTitle(title, { worktreeName }) ?? roleOfTitle(t.title, { worktreeName });
    const row = (verdict, klass, reason, extra = {}) => out.push({ handle: h, role, klass, verdict, reason, title: String(title).slice(0, 120), worktree: t.worktreePath ?? null, ...extra });
    if (sup.seat?.handle === h) { row('keep', 'supervisor-seat', 'the live Supervisor seat'); continue; }
    if (keepTitles.some((re) => re.test(String(title)) || re.test(String(t.title ?? '')))) { row('keep', 'unknown', 'allowlisted (allocation.gc.keepTitles)'); continue; }
    if (t.connected === false) { row('keep', role ?? 'unknown', 'already disconnected'); continue; }
    const owner = ownerOf.get(h);
    if (owner) {
      if (owner.type === 'kernel') {
        if (owner.workflow.ended) row('collect', 'kernel', `Kernel of ${owner.workflow.workflowId}, which is ${owner.workflow.ended ? 'finished/archived' : 'live'}`, { owner: owner.workflow.workflowId });
        else row('keep', 'kernel', `live Kernel seat of ${owner.workflow.workflowId}`);
      } else if (owner.type === 'job') {
        if (liveJobHandles.has(h)) row('keep', owner.job.kind === 'kernel' ? 'kernel' : 'op-worker', `terminal of ${owner.job.status} job ${owner.job.jobId}`);
        else if (owner.job.kind === 'kernel') {
          const wf = ledgers.find((l) => l.repo === owner.repo)?.workflows.find((w) => w.workflowId === owner.job.workflowId);
          if (wf && !wf.ended && wf.kernelHandle && !listed.has(wf.kernelHandle)) row('refuse', 'kernel', `settled Kernel job of live ${wf.workflowId} whose seat terminal Orca does not list: it may be this one`);
          else row('collect', 'kernel', `terminal of settled Kernel job ${owner.job.jobId} (${owner.job.status})`, { owner: owner.job.workflowId });
        } else row('collect', 'op-worker', `terminal of settled op job ${owner.job.jobId} (${owner.job.status})`, { owner: owner.job.jobId });
      } else if (owner.type === 'sup-job') {
        if (SUP_LIVE.has(owner.job.status)) row('keep', 'sup-worker', `[Worker] of ${owner.job.status} job ${owner.job.jobId}`);
        else row('collect', 'sup-worker', `[Worker] of ${owner.job.status} job ${owner.job.jobId}`, { owner: owner.job.jobId });
      }
      continue;
    }
    // Not bound by any ledger: only what the runtime visibly created is ever collected.
    const screen = () => { const s = screenOf(h); return s == null ? null : String(s); };
    if (!role && pathUnder(t.worktreePath ?? '', runtimeRoot)) {
      const m = STAGING_ON_SCREEN.exec(screen() ?? '');
      if (m) role = 'worker';
    }
    if (role === 'supervisor') {
      if (sup.seat?.live && sup.seat.handle && listed.has(sup.seat.handle)) row('collect', 'supervisor-seat', 'a [Supervisor] terminal that is not the live seat (replaced)');
      else row('refuse', 'supervisor-seat', 'no live seat terminal is listed: this may be the seat under a new handle');
    } else if (role === 'worker') {
      const s = screen() ?? '';
      const byStaging = STAGING_ON_SCREEN.exec(s)?.[1] ?? null;
      const cluster = /^\[Worker\]\s+(.+)$/.exec(String(title).trim())?.[1]?.trim() ?? null;
      const jobs = sup.jobs.filter((j) => (byStaging && j.jobId.toLowerCase() === byStaging.toLowerCase()) || (!byStaging && cluster && j.cluster === cluster));
      if (!jobs.length) { row('refuse', 'sup-worker', `no supervisor job matches ${byStaging ?? cluster ?? 'this worker'}`); continue; }
      const live = jobs.filter((j) => SUP_LIVE.has(j.status));
      if (!live.length) row('collect', 'sup-worker', `[Worker] of ${jobs.map((j) => `${j.jobId} ${j.status}`).join(', ')}`, { owner: jobs.map((j) => j.jobId).join(',') });
      else if (live.every((j) => j.handle && listed.has(j.handle)) && aged(h)) row('collect', 'sup-worker', `duplicate of live job ${live.map((j) => j.jobId).join(', ')}'s worker ${live.map((j) => j.handle).join(', ')}`, { owner: live[0].jobId });
      else row('refuse', 'sup-worker', `job ${live.map((j) => j.jobId).join(', ')} is ${live.map((j) => j.status).join('/')} and this may be its worker`);
    } else if (role === 'kernel' || role === 'op') {
      const l = ledgerOfPath(t.worktreePath ?? '');
      if (!l) { row('refuse', role === 'op' ? 'op-worker' : 'kernel', 'no ledger owns its worktree'); continue; }
      const named = workflowsNamed(title, l.workflows);
      const candidates = named.length ? named : l.workflows;
      const liveOnes = candidates.filter((w) => !w.ended);
      const klass = role === 'op' ? 'op-worker' : 'kernel';
      if (!liveOnes.length) { row('collect', klass, `every workflow it can belong to has ended (${candidates.map((w) => w.workflowId).slice(0, 3).join(', ')}${candidates.length > 3 ? ', ...' : ''})`, { owner: candidates[0]?.workflowId ?? null }); continue; }
      const unsafe = liveOnes.filter((w) => unsafeWorkflows.has(w.workflowId) || (role === 'kernel' && (!w.kernelHandle || !listed.has(w.kernelHandle))));
      if (unsafe.length) { row('refuse', klass, `live ${unsafe.map((w) => w.workflowId).join(', ')} has a running worker or seat Orca does not list: this may be it`); continue; }
      if (!aged(h)) { row('refuse', klass, `unbound terminal of live ${liveOnes.map((w) => w.workflowId).join(', ')} seen for less than ${Math.round(minAgeMs / 60000)}m`, { pendingAge: true }); continue; }
      row('collect', klass, `unbound ${role === 'op' ? '[Op]' : '[Kernel]'} of live ${liveOnes.map((w) => w.workflowId).join(', ')} (a replaced or settled one; every live job and the seat hold other terminals)`, { owner: liveOnes[0].workflowId });
    } else if (role === 'shell') {
      if (t.agentIdentity) { row('keep', 'unknown', `shell-titled terminal running ${t.agentIdentity}`); continue; }
      if (liveJobHandles.has(h)) { row('keep', 'idle-shell', 'bound to a live job'); continue; }
      // A shell no registry knows with output in the last minAgeMs may be the owner's own: reported, never closed.
      if (Number(t.lastOutputAt) > 0 && now - Number(t.lastOutputAt) < minAgeMs) { row('refuse', 'idle-shell', `recent activity ${Math.round((now - Number(t.lastOutputAt)) / 60000)}m ago: may be the owner's, reported not closed`); continue; }
      const s = screen();
      if (!onlyPrompts(s)) { row('keep', 'unknown', s == null ? 'screen unreadable' : 'shell with something on its screen besides prompts'); continue; }
      if (!(shellsAllOld || aged(h))) { row('refuse', 'idle-shell', `idle bare shell seen for less than ${Math.round(minAgeMs / 60000)}m`, { pendingAge: true }); continue; }
      row('collect', 'idle-shell', 'idle bare shell: no agent, bound to nothing, only prompts on screen');
    } else row('keep', 'unknown', 'not created by the runtime (no ledger binding, no runtime title)');
  }
  return out;
}

/* ------------------------------------------------------------ processes */

/** taskkill /T /F of one process tree (scripts/lib/kill-tree.mjs); true when it answered 0. */
export const killTree = (pid) => killProcessTree(pid).ok;

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

/* ------------------------------------------------------------ lanes */

function landedCommitsForLane(branch, env) {
  return withSupervisorRead((db) => {
    const landed = new Set();
    const rows = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='land-passed' AND json_extract(payload_json,'$.lane')=?").all(SUPERVISOR_WF, branch);
    for (const row of rows) {
      const payload = parseJson(row.payload_json);
      if (payload === null) continue;
      if (Array.isArray(payload.commits)) for (const sha of payload.commits) if (typeof sha === 'string') landed.add(sha);
    }
    return landed;
  }, new Set(), { env });
}

/** Conservative file proof for a lane whose land changed patch IDs (conflict resolution or contract entry). */
function laneContentLanded(commits, branch, root, run) {
  const touched = new Set();
  for (const sha of commits) {
    const paths = run(['diff-tree', '--root', '-r', '--no-commit-id', '--name-only', '-z', sha], { cwd: root });
    if (!paths.ok) return false;
    for (const file of paths.stdout.split('\0').filter(Boolean)) touched.add(file);
  }
  if (!touched.size) return false;
  for (const file of touched) {
    const diff = run(['diff', '--name-only', '-z', 'main', branch, '--', file], { cwd: root });
    if (!diff.ok) return false;
    if (!diff.stdout) continue;
    const mainTime = run(['log', '-1', '--format=%ct', 'main', '--', file], { cwd: root });
    const laneTime = run(['log', '-1', '--format=%ct', branch, '--', file], { cwd: root });
    if (!mainTime.ok || !laneTime.ok || !mainTime.stdout.trim() || !laneTime.stdout.trim() ||
        Number(mainTime.stdout.trim()) <= Number(laneTime.stdout.trim())) return false;
  }
  return true;
}

/**
 * Decide and (apply) remove the lane worktrees. `git` runner (args, {cwd}) -> {ok, stdout, error}; `sup` supervisorView.
 * Returns {items, freedBytes, errors}.
 */
export function collectLanes({ apply = false, env = process.env, now = Date.now(), settings, sup, root = SKILL_ROOT, git = null, landBusy = false, terminals = [], titles = new Map() }) {
  const run = git ?? ((args, { cwd }) => gitResult(args, { cwd }));
  const base = lanesRoot({ env });
  const items = [], errors = [];
  let freedBytes = 0;
  const listedRes = run(['worktree', 'list', '--porcelain'], { cwd: root });
  if (!listedRes.ok) return { items, freedBytes, errors: [`git worktree list: ${listedRes.error ?? 'failed'}`] };
  const worktrees = parseWorktreeList(listedRes.stdout);
  const mainKey = worktrees[0] ? pathKey(worktrees[0].path) : null;
  const selfKey = pathKey(path.resolve(root));
  const baseKey = `${pathKey(base)}/`;
  const landKey = `${pathKey(landRoot(env))}/`;
  const registered = new Set(worktrees.map((w) => pathKey(w.path)));
  const item = (verdict, target, reason, extra = {}) => items.push({ class: 'lane', verdict, target, reason, ...extra });
  const branchOf = (ref) => String(ref ?? '').replace(/^refs\/heads\//, '');
  const dirty = (p) => { const s = run(['status', '--porcelain', '--untracked-files=normal'], { cwd: p }); return s.ok ? s.stdout.trim().split(/\r?\n/).filter(Boolean).length : null; };
  const removeTree = (w, branch, { why = 'landed in main, clean, idle' }) => {
    const bytes = treeBytes(w.path);
    if (!apply) { item('collect', w.path, `would remove (${why})`, { bytes, branch, worktree: true }); freedBytes += bytes; return; }
    if (!unlinkNodeModulesLink(w.path)) { errors.push(`${w.path}: node_modules link could not be unlinked; left in place`); item('refuse', w.path, 'node_modules junction could not be unlinked'); return; }
    const r = safeRemoveWorktree(w.path, { repo: root, git: run });
    if (!r.ok) { errors.push(`${w.path}: ${(r.errors ?? []).slice(0, 2).map((e) => e.message).join('; ')}`); item('refuse', w.path, 'removal failed', { ok: false }); return; }
    item('collect', w.path, `removed (${why})`, { bytes, branch, branchDeleted: false, ok: true, worktree: true });
    freedBytes += bytes;
  };
  for (const w of worktrees) {
    const key = pathKey(w.path);
    if (key === mainKey || key === selfKey || !key.startsWith(baseKey)) continue;
    if (w.locked) { item('keep', w.path, 'locked'); continue; }
    if (!fs.existsSync(w.path)) { if (apply) run(['worktree', 'prune'], { cwd: root }); item('collect', w.path, 'registration of a missing directory (pruned)'); continue; }
    const branch = branchOf(w.branch);
    if (w.detached || !branch) {
      if (!key.startsWith(landKey)) { item('keep', w.path, 'detached checkout outside the land root'); continue; }
      if (landBusy) { item('keep', w.path, 'a land is running'); continue; }
      let mtime = 0; try { mtime = fs.statSync(w.path).mtimeMs; } catch { /* unknown */ }
      if (now - mtime < settings.laneGraceMs) { item('keep', w.path, 'recent land scratch'); continue; }
      removeTree(w, null, { why: 'land scratch, no land running' });
      continue;
    }
    const d = dirty(w.path);
    if (d === null) { item('keep', w.path, 'status unreadable', { branch }); continue; }
    if (branch.startsWith('sup/')) {
      const jobId = branch.slice(4);
      const job = sup.jobs.find((j) => j.jobId === jobId);
      if (job && SUP_LIVE.has(job.status)) { item('keep', w.path, `staging of ${job.status} job ${jobId}`, { branch }); continue; }
      if (d > 0) { item('keep', w.path, `${d} uncommitted change(s)`, { branch, unmerged: true }); continue; }
      if (job && SUP_FINAL.has(job.status)) {
        const bytes = treeBytes(w.path);
        if (!apply) { item('collect', w.path, `would remove staging of ${job.status} job ${jobId}`, { bytes, branch, worktree: true }); freedBytes += bytes; continue; }
        const r = removeStaging({ jobId, root, env, landed: job.status === 'succeeded', base: job.base });
        if (r.removed) { item('collect', w.path, `removed staging of ${job.status} job ${jobId}${r.branchKept ? ` (branch ${r.branchKept} kept: it holds commits)` : ''}`, { bytes, branch, ok: true, branchDeleted: r.branchDeleted === true, worktree: true }); freedBytes += bytes; }
        else { errors.push(`${w.path}: ${r.error ?? 'staging removal failed'}`); item('refuse', w.path, r.error ?? 'staging removal failed', { ok: false }); }
        continue;
      }
    }
    if (d > 0) { item('keep', w.path, `${d} uncommitted change(s)`, { branch, unmerged: true }); continue; }
    const cherry = run(['cherry', 'main', branch], { cwd: root });
    if (!cherry.ok) { item('keep', w.path, 'merge check failed', { branch }); continue; }
    const ahead = cherry.stdout.split(/\r?\n/).filter((l) => l.startsWith('+')).length;
    if (ahead) {
      const list = run(['rev-list', 'main..' + branch], { cwd: root });
      if (!list.ok) { item('keep', w.path, 'commit list unreadable', { branch }); continue; }
      const commits = list.stdout.split(/\r?\n/).filter(Boolean);
      const ledger = landedCommitsForLane(branch, env);
      const ledgerLanded = commits.length > 0 && commits.every((sha) => ledger.has(sha));
      if (!ledgerLanded && !laneContentLanded(commits, branch, root, run)) {
        item('keep', w.path, `${ahead} commit(s) not landed in main`, { branch, unmerged: true }); continue;
      }
    }
    const act = laneActivity({ worktree: w.path, branch: w.branch, root, run });
    const idle = act.lastActiveMs == null ? null : now - act.lastActiveMs;
    const idleMs = settings.laneIdleMs ?? settings.laneGraceMs;
    if (idle == null || idle < idleMs) { item('keep', w.path, `landed but git activity ${idle == null ? '?' : Math.round(idle / 60000)}m ago (< ${Math.round(idleMs / 60000)}m)`, { branch }); continue; }
    const owner = laneOwnerOf({ lanePath: w.path, branch, terminals, titles, sup });
    if (owner) { item('keep', w.path, `landed but its owner is alive: ${owner}`, { branch, liveOwner: true }); continue; }
    removeTree(w, branch, { why: 'landed in main, clean, idle; branch kept' });
  }
  if (apply) run(['worktree', 'prune'], { cwd: root });
  // Leftover empty directories of removed checkouts (staging/<job>, land/<scratch>) whose registration is gone.
  for (const parent of [stagingRoot(env), landRoot(env)]) {
    let names = [];
    try { names = fs.readdirSync(parent); } catch { continue; }
    for (const name of names) {
      const p = path.join(parent, name);
      if (registered.has(pathKey(p))) continue;
      let empty = false;
      try { empty = fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0; } catch { empty = false; }
      if (!empty) { item('keep', p, 'unregistered non-empty directory (not a worktree; left for a human)'); continue; }
      if (apply) { try { fs.rmdirSync(p); item('collect', p, 'removed empty leftover directory', { ok: true }); } catch (e) { errors.push(`${p}: ${e.message}`); } }
      else item('collect', p, 'would remove empty leftover directory');
    }
  }
  return { items, freedBytes, errors };
}

/* ------------------------------------------------------------ the run */

/** The one owner-digest line (Vietnamese per config.yaml language vi; English otherwise). */
export function gcLine(counts, { language = 'vi', apply = true } = {}) {
  const bytes = (counts.freedBytes ?? 0) + (counts.ramFreedBytes ?? 0);
  if (language === 'vi') return `Dọn rác${apply ? '' : ' (thử)'}: ${counts.agents} agent, ${counts.terminals} terminal, ${counts.worktrees} worktree, ${fmtGb(bytes)}`;
  return `Garbage collected${apply ? '' : ' (dry run)'}: ${counts.agents} agent(s), ${counts.terminals} terminal(s), ${counts.worktrees} worktree(s), ${fmtGb(bytes)}`;
}

/**
 * One GC run. `only` restricts the collectors; `deps` replaces the host seams (list, read, close, procs, ledgers, sup,
 * git, purge, sweepTmp, taskUpdate, log, lesson, freemem). Returns the report (see the header).
 */
export async function runGc({ apply = false, only = null, env = process.env, now = Date.now(), deps = {}, allocation = null, language = null } = {}) {
  const started = Date.now();
  const settings = gcSettings(allocation ?? allocationSettings());
  const want = new Set(only ?? COLLECTORS);
  const report = { schema: SCHEMA, apply: apply === true, at: new Date(now).toISOString(), ok: true, items: [], errors: [],
    counts: { agents: 0, terminals: 0, worktrees: 0, processes: 0, evidence: 0, tmp: 0, tasks: 0, leases: 0, laneLogs: 0, refused: 0, leftovers: 0, freedBytes: 0, ramFreedBytes: 0 } };
  // The host lock `gc` (live apply runs only: a spec's injected deps never take the host lock unless it passes deps.lock).
  const lockFn = deps.lock ?? (Object.keys(deps).some((k) => k !== 'holder') ? null : acquireGcLock);
  let lock = null;
  if (apply && lockFn) {
    lock = lockFn({ env, holder: deps.holder ?? 'gc.mjs' });
    if (!lock?.ok) {
      report.ok = false; report.busy = true;
      report.errors.push(`gc-busy: another GC apply holds the host lock (${JSON.stringify(lock?.holder ?? null).slice(0, 160)}); nothing was touched`);
      report.line = gcLine(report.counts, { language: language ?? 'vi', apply }); report.durationMs = Date.now() - started;
      return report;
    }
  }
  try {
  const state = (deps.readState ?? readState)(env);
  const seenNow = {};
  const sup = (deps.sup ?? supervisorView)({ env, now });
  const repos = deps.repos ?? productRepos();
  const ledgers = (deps.ledgers ?? (() => repos.map((r) => { try { return ledgerView(r); } catch { return null; } }).filter(Boolean)))();
  const freeBefore = (deps.freemem ?? os.freemem)();

  let agentsBeforeOuter = null, lastListedCount = 0, lanesListing = null;
  if (want.has('agents') || want.has('shells')) {
    const listed = (deps.list ?? (() => terminalList({ includeVisualLayouts: true })))();
    if (listed?.ok) lanesListing = listed;
    if (!listed?.ok) { report.ok = false; report.errors.push(`terminal list: ${listed?.error ?? 'Orca did not answer'} - no terminal was touched`); }
    else {
      let procs = null;
      if (want.has('shells')) { try { procs = (deps.procs ?? (async () => (await import('./host-health.mjs')).listProcesses()))(); procs = await procs; } catch { procs = null; } }
      const screens = new Map();
      const screenOf = (h) => { if (!screens.has(h)) { let s = null; try { const r = (deps.read ?? terminalRead)({ terminal: h, screen: true }); s = r?.ok ? r.screen ?? '' : null; } catch { s = null; } screens.set(h, s); } return screens.get(h); };
      const decided = classifyTerminals({ terminals: listed.terminals ?? [], titles: tabTitles(listed.visualLayouts), sup, ledgers, screenOf, procs, seen: state.seen, now, minAgeMs: settings.minAgeMs, keepTitles: settings.keepTitles });
      // The agents inside Orca terminals before any close: whichever lingers outside Orca afterwards is reaped below.
      lastListedCount = (listed.terminals ?? []).filter((t) => t.connected !== false).length;
      if (apply) { try { const t = (deps.table ?? processTable)(); agentsBeforeOuter = t ? orcaAgents(t) : null; } catch { agentsBeforeOuter = null; } }
      for (const d of decided) {
        const isShell = d.klass === 'idle-shell';
        if (isShell ? !want.has('shells') : !want.has('agents')) continue;
        if (d.verdict !== 'keep') seenNow[d.handle] = state.seen[d.handle] ?? now;
        if (d.verdict === 'keep') {
          // Not the runtime's: named in the report (never touched) so the owner sees what was left alone and why.
          if (d.klass === 'unknown') report.items.push({ class: 'unknown', action: 'none', target: d.handle, title: d.title, reason: d.reason, verdict: 'keep' });
          continue;
        }
        const it = { class: d.klass, action: 'close-terminal', target: d.handle, title: d.title, reason: d.reason, owner: d.owner ?? null, verdict: d.verdict, leftover: !isShell };
        if (d.verdict === 'refuse') { report.items.push(it); if (!d.pendingAge) report.counts.refused += 1; continue; }
        if (!apply) { report.items.push({ ...it, ok: null }); }
        else {
          const r = (deps.close ?? closeAndVerify)(d.handle);
          report.items.push({ ...it, ok: r?.ok === true, proof: r?.proof ?? null, ...(r?.ok ? {} : { error: r?.reason ?? r?.error ?? 'close failed' }) });
          if (!r?.ok) { report.errors.push(`close ${d.handle} (${d.klass}): ${r?.reason ?? r?.error ?? 'failed'}`); continue; }
          delete seenNow[d.handle];
        }
        if (isShell) report.counts.terminals += 1; else report.counts.agents += 1;
        if (!isShell) report.counts.leftovers += 1;
      }
      // Seen-state of shells and runtime terminals is kept only for handles still listed and still candidates.
    }
  }

  // Processes (owner 2026-09-28: closing a tab while the agent process lingers doesn't count; free orphan PowerShell
  // under the Orca daemon): after the closes, (1) every agent that ran in an Orca terminal and now lingers outside it is
  // killed (reapOrphaned); (2) agent CLIs whose parent is gone, older than minAgeMs, are killed; (3) child-less
  // `powershell -NoExit` shells under the Orca daemon beyond the number of terminals Orca lists (no tab owns them),
  // older than minAgeMs, oldest first, are killed.
  if (want.has('shells') || want.has('agents')) {
    try {
      const tableFn = deps.table ?? processTable;
      if (apply && agentsBeforeOuter) {
        const r = (deps.reap ?? reapOrphaned)(agentsBeforeOuter, { table: tableFn });
        if (r.checked && r.lingering) report.items.push({ class: 'process', action: 'kill-tree', target: `${r.lingering} lingering agent process(es)`, verdict: 'collect', reason: 'agent of a closed terminal still alive outside Orca', ok: r.remaining === 0, leftover: true });
        if (r.checked && r.remaining) report.errors.push(`${r.remaining} agent process(es) of closed terminals still alive after taskkill`);
        report.counts.processes += r.killed ?? 0;
      }
      const table = tableFn();
      const listedNow = apply ? (deps.list ?? (() => terminalList({})))() : null;
      if (table) {
        const plan = orphanProcesses({ table, now, minAgeMs: settings.minAgeMs, listedCount: (listedNow?.ok ? listedNow.terminals.filter((t) => t.connected !== false).length : lastListedCount) });
        for (const p of plan) {
          let ok = null;
          if (apply) { ok = (deps.kill ?? killTree)(p.pid); if (ok) report.counts.processes += 1; else report.errors.push(`kill ${p.pid} (${p.kind}) failed`); }
          report.items.push({ class: 'process', action: 'kill-tree', target: `pid ${p.pid} ${p.name}`, verdict: 'collect', reason: p.reason, ok, ramBytes: p.ws ?? null });
        }
      }
    } catch (error) { report.errors.push(`processes: ${String(error?.message ?? error).slice(0, 200)}`); }
  }

  if (want.has('lanes')) {
    let landBusy = false;
    try { landBusy = (deps.landBusy ?? (async () => (await import('./land.mjs')).landStatus({ env }).busy))(); landBusy = await landBusy; } catch { landBusy = true; }
    // The live owners of a lane: the terminal listing (the agents block's, else one read now; null when Orca is down).
    let laneTerms = null, laneTitles = new Map();
    try {
      const lt = lanesListing ?? (deps.list ?? (() => terminalList({ includeVisualLayouts: true })))();
      if (lt?.ok) { laneTerms = lt.terminals ?? []; laneTitles = tabTitles(lt.visualLayouts); }
    } catch { laneTerms = null; }
    const l = collectLanes({ apply, env, now, settings, sup, git: deps.git ?? null, landBusy, terminals: laneTerms, titles: laneTitles });
    for (const i of l.items) {
      if (i.verdict === 'keep' && !i.unmerged && !i.liveOwner) continue;
      report.items.push({ class: 'lane', action: 'remove-worktree', target: i.target, reason: i.reason, verdict: i.verdict === 'keep' ? 'refuse' : i.verdict,
        ...(i.branch ? { branch: i.branch } : {}), ...(i.bytes != null ? { bytes: i.bytes } : {}), ...(i.ok != null ? { ok: i.ok } : { ok: null }), ...(i.unmerged ? { unmerged: true } : {}), ...(i.worktree ? { worktree: true } : {}) });
      if (i.verdict === 'collect' && i.worktree) report.counts.worktrees += 1;
      if (i.verdict === 'keep') report.counts.refused += 1;
    }
    report.counts.freedBytes += l.freedBytes;
    report.errors.push(...l.errors);
  }

  if (want.has('evidence')) {
    const purge = deps.purge ?? (async (args) => (await import('../work/purge-workflow.mjs')).purgeWorkflow(args));
    for (const l of ledgers) {
      const liveOf = new Set(l.jobs.filter((j) => LIVE_JOB.has(j.status)).map((j) => j.workflowId));
      for (const w of l.workflows) {
        if (!w.ended || w.purged) continue;
        if (w.endedAt == null || now - w.endedAt < settings.evidenceRetentionMs) continue;
        const target = `${path.basename(l.repo)}:${w.workflowId}`;
        if (liveOf.has(w.workflowId)) { report.items.push({ class: 'evidence', action: 'archive-purge', target, verdict: 'refuse', reason: 'ended workflow still holds a live job' }); report.counts.refused += 1; continue; }
        try {
          const r = await purge({ repo: l.repo, workflowId: w.workflowId, apply, approvedBy: APPROVAL.by, approvalRef: APPROVAL.ref, archiveRoot: settings.archiveRoot });
          const bytes = Number(r?.fileBytes ?? r?.purge?.archive_bytes ?? 0) || 0;
          report.items.push({ class: 'evidence', action: 'archive-purge', target, verdict: 'collect', reason: apply ? `archived to ${r?.archive ?? r?.purge?.archive_path ?? '?'} (verified) and purged` : `would archive ${r?.files ?? '?'} file(s) to ${r?.archive ?? '?'} and purge`, bytes, ok: apply ? r?.ok !== false : null });
          report.counts.evidence += 1;
          report.counts.freedBytes += bytes;
        } catch (error) {
          report.items.push({ class: 'evidence', action: 'archive-purge', target, verdict: 'refuse', reason: String(error?.message ?? error).slice(0, 300), ok: false });
          report.errors.push(`purge ${target}: ${String(error?.message ?? error).slice(0, 200)}`);
        }
      }
    }
  }

  if (want.has('tmp')) {
    try {
      const sweep = deps.sweepTmp ?? (await import('../lib/hk-tmp.mjs')).sweepTmp;
      const r = await sweep({ apply, now, env, allocation: settings.housekeeping });
      const n = apply ? (r.deleted?.length ?? 0) : (r.skipped ?? []).filter((s) => /dry run/.test(s.reason ?? '')).length;
      report.counts.tmp += n;
      report.counts.freedBytes += Number(r.freedBytes) || 0;
      if (n) report.items.push({ class: 'tmp', action: 'remove-temp', target: `%TEMP% (${n} entr${n === 1 ? 'y' : 'ies'})`, verdict: 'collect', reason: apply ? 'runtime-prefixed temp entries past tmpMaxAgeMs removed' : 'would remove runtime-prefixed temp entries past tmpMaxAgeMs', bytes: Number(r.freedBytes) || 0, ok: apply ? r.ok !== false : null });
      for (const e of r.errors ?? []) report.errors.push(`tmp: ${typeof e === 'string' ? e : `${e.path ?? ''} ${e.error ?? e.message ?? ''}`}`.slice(0, 200));
    } catch (error) { report.errors.push(`tmp: ${String(error?.message ?? error).slice(0, 200)}`); }
  }

  if (want.has('tasks')) {
    const update = deps.taskUpdate ?? taskUpdate;
    for (const l of ledgers) for (const j of l.jobs) {
      if (LIVE_JOB.has(j.status) || !j.task || j.task.closed) continue;
      const target = j.task.taskId;
      if (!apply) { report.items.push({ class: 'task', action: 'close-task', target, reason: `open Task of ${j.status} job ${j.jobId}`, verdict: 'collect', ok: null }); report.counts.tasks += 1; continue; }
      let r; try { r = update({ id: target, status: 'completed', run: j.task.runId ?? undefined }); } catch (error) { r = { ok: false, error: String(error?.message ?? error) }; }
      report.items.push({ class: 'task', action: 'close-task', target, reason: `open Task of ${j.status} job ${j.jobId}`, verdict: r?.ok ? 'collect' : 'refuse', ok: r?.ok === true, ...(r?.ok ? {} : { error: String(r?.error ?? '').slice(0, 200) }) });
      if (r?.ok) report.counts.tasks += 1; else report.counts.refused += 1;
    }
  }

  if (want.has('leases')) {
    const rows = [...(sup.leases ?? []).map((r) => ({ ...r, ledger: 'supervisor' })), ...ledgers.flatMap((l) => (l.leases ?? []).map((r) => ({ ...r, ledger: path.basename(l.repo) })))];
    for (const lk of classifyLeases({ rows, now, minAgeMs: settings.leaseMinAgeMs })) {
      report.items.push({ class: 'lease', action: 'report-lease', target: `${lk.ledger}:${lk.resourceKey}`, owner: lk.jobId, verdict: 'refuse', reportOnly: true, leftover: true, ok: null,
        ledger: lk.ledger, jobId: lk.jobId, workflowId: lk.workflowId,
        reason: `LEASE_LEAK: lease ${lk.resourceKey} still held although ${lk.why}; no api path deletes a settled job's lease - reported, not deleted` });
      report.counts.leases += 1;
    }
  }

  if (want.has('lanelogs')) {
    try {
      const r = collectLaneLogs({ apply, env, now, settings, fsx: deps.fsx ?? null });
      report.items.push(...r.items);
      report.counts.laneLogs += r.items.filter((i) => i.verdict === 'collect').length;
      report.counts.refused += r.items.filter((i) => i.verdict === 'refuse').length;
      report.counts.freedBytes += r.freedBytes;
      report.errors.push(...r.errors);
    } catch (error) { report.errors.push(`lanelogs: ${String(error?.message ?? error).slice(0, 200)}`); }
  }

  (deps.writeState ?? writeState)({ seen: seenNow }, env);
  if (apply && (report.counts.agents || report.counts.terminals)) {
    // Orca stops the PTY trees on close; give the OS a moment before reading free RAM back.
    await new Promise((r) => setTimeout(r, deps.settleMs ?? 3000));
    report.counts.ramFreedBytes = Math.max(0, (deps.freemem ?? os.freemem)() - freeBefore);
  }
  report.ok = report.ok && report.errors.length === 0;
  const lang = language ?? (() => { try { return deps.language ?? null; } catch { return null; } })() ?? 'vi';
  report.line = gcLine(report.counts, { language: lang, apply });
  report.durationMs = Date.now() - started;

  // The machine log: one gc.collect per item, one gc.summary.
  const rows = report.items.map((i) => ({ kind: 'gc.collect', at: now, level: i.ok === false ? 'warn' : 'info',
    msg: `${apply ? '' : '[dry-run] '}${i.verdict} ${i.class} ${i.action} ${i.target}${i.title ? ` "${String(i.title).slice(0, 60)}"` : ''}: ${String(i.reason ?? '').slice(0, 160)}`,
    data: { class: i.class, action: i.action, target: String(i.target), ...(i.owner ? { owner: String(i.owner) } : {}), ...(typeof i.ok === 'boolean' ? { ok: i.ok } : {}),
      ...(i.proof ? { proof: i.proof } : {}), reason: `${i.verdict}: ${String(i.reason ?? '').slice(0, 400)}`, ...(i.bytes != null ? { bytes: i.bytes } : {}), apply, ...(i.leftover ? { leftover: true } : {}) },
    refs: i.owner ? String(i.owner).split(',').map((o) => (o.startsWith('wf-') ? `workflow:${o}` : `job:${o}`)) : [] }));
  rows.push({ kind: 'gc.summary', at: now, level: report.errors.length ? 'warn' : 'info', msg: report.line,
    data: { agents: report.counts.agents, terminals: report.counts.terminals, worktrees: report.counts.worktrees, freedBytes: report.counts.freedBytes,
      apply, ramFreedBytes: report.counts.ramFreedBytes, refused: report.counts.refused, errors: report.errors.length, leftovers: report.counts.leftovers,
      evidence: report.counts.evidence, tmp: report.counts.tmp, tasks: report.counts.tasks, leases: report.counts.leases, laneLogs: report.counts.laneLogs, line: report.line } });
  try { (deps.log ?? (await import('./sup-log.mjs')).supLogRows)(rows, { env }); } catch { /* best effort */ }

  // A leftover is a bug in its owner step: one lesson per class (lessons.mjs recordLeftover, deduped per day).
  if (apply) {
    const byClass = {};
    for (const i of report.items) if (i.leftover && (i.ok || i.reportOnly)) (byClass[i.class] ??= []).push(`${i.target} ${String(i.title ?? '').slice(0, 50)}`.trim());
    if (report.counts.terminals) byClass['idle-shell'] = report.items.filter((i) => i.class === 'idle-shell' && i.ok).map((i) => i.target);
    try {
      const record = deps.lesson ?? (await import('./lessons.mjs')).recordLeftover;
      for (const [klass, examples] of Object.entries(byClass)) if (examples.length)
        record({ klass, count: examples.length, examples: LEFTOVER_OWNERS[klass] ? [`owner step: ${LEFTOVER_OWNERS[klass]}`, ...examples] : examples, env, now });
    } catch { /* the lesson is best effort */ }
  }
  return report;
  } finally { try { lock?.release?.(); } catch { /* released or taken over */ } }
}

/** The report as lines for a human. */
export function describe(report) {
  const lines = [`===== GC ${report.apply ? 'APPLY' : 'DRY-RUN'} ${report.at} ${report.ok ? 'ok' : 'WITH ERRORS'} =====`, report.line,
    `counts: agents ${report.counts.agents}, idle shells ${report.counts.terminals}, worktrees ${report.counts.worktrees}, processes ${report.counts.processes}, evidence ${report.counts.evidence}, tmp ${report.counts.tmp}, tasks ${report.counts.tasks}, leases ${report.counts.leases ?? 0} (report-only), lane logs ${report.counts.laneLogs ?? 0}, refused ${report.counts.refused}; disk ${fmtGb(report.counts.freedBytes)}, RAM ${fmtGb(report.counts.ramFreedBytes)}`];
  const order = ['collect', 'refuse', 'keep'];
  for (const v of order) {
    const rows = report.items.filter((i) => i.verdict === v);
    if (!rows.length) continue;
    lines.push(`--- ${v === 'collect' ? (report.apply ? 'collected' : 'would collect') : v === 'refuse' ? 'refused (runtime-owned, kept for a reason)' : 'left alone (not created by the runtime)'} (${rows.length}) ---`);
    for (const i of rows) lines.push(`  [${i.class}] ${i.target}${i.title ? ` "${String(i.title).slice(0, 70)}"` : ''}${i.branch ? ` (${i.branch})` : ''}${i.bytes ? ` ${(i.bytes / 1024 ** 2).toFixed(0)} MB` : ''}: ${i.reason}${i.ok === false ? ` FAILED ${i.error ?? ''}` : ''}`);
  }
  for (const e of report.errors) lines.push(`ERROR ${e}`);
  return lines.join('\n');
}

export function parseArgs(argv = []) {
  const known = ['dry-run', 'apply', 'json', 'only'];
  const bad = argv.filter((a) => a.startsWith('--') && !known.includes(a.slice(2)));
  if (bad.length) return { ok: false, error: `unknown flag(s): ${bad.join(' ')}` };
  const i = argv.indexOf('--only');
  const only = i >= 0 ? String(argv[i + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const unknown = (only ?? []).filter((c) => !COLLECTORS.includes(c));
  if (unknown.length) return { ok: false, error: `unknown collector(s): ${unknown.join(', ')} (known: ${COLLECTORS.join(', ')})` };
  if (argv.includes('--apply') && argv.includes('--dry-run')) return { ok: false, error: '--apply and --dry-run together' };
  return { ok: true, apply: argv.includes('--apply'), only, json: argv.includes('--json') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) { console.error(`use: gc.mjs [--dry-run|--apply] [--only ${COLLECTORS.join(',')}] [--json] (${args.error})`); process.exit(2); }
  let language = 'vi';
  try { language = (await import('./home.mjs')).supervisorSettings().language ?? 'vi'; } catch { /* vi */ }
  const report = await runGc({ apply: args.apply, only: args.only, language });
  console.log(args.json ? JSON.stringify(report, null, 2) : describe(report));
  process.exit(report.ok ? 0 : 1);
}
