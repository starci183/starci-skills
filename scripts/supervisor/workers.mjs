#!/usr/bin/env node
// workers.mjs — [Worker] fix agents, spawned on demand by the one [Supervisor] (modules/supervisor/supervise.yaml
// workers, docs/supervisor.md). One job per root-cause cluster, never one per incident.
//
//   node scripts/supervisor/workers.mjs create --cluster <id> --title <t> --files <csv> [--incidents <csv>]
//        [--specs <csv>] [--brief <text> | --brief-file <f>] [--agent <claude|codex|devin>]
//   node scripts/supervisor/workers.mjs spawn [--job <id>] [--dry-run]     launch queued jobs up to the cap
//   node scripts/supervisor/workers.mjs stage --self --name <slug> --files <csv>   the Supervisor's own checkout
//   node scripts/supervisor/workers.mjs report --job <id> --outcome done|diagnosed|blocked|failed [--commit <sha>]
//        [--specs <csv>] [--summary <t>] [--needs <csv>]                  (the worker's last act)
//   node scripts/supervisor/workers.mjs list | cap | show --job <id> | cancel --job <id> [--reason <t>]
//   node scripts/supervisor/workers.mjs ack --job <id> --reason <t>   a decided diagnosed/blocked/failed report: consumed, never re-announced
//   node scripts/supervisor/workers.mjs cleanup [--job <id>]                remove finished staging checkouts
//   ... [--json]
//
// Lifecycle (machine.sqlite, engine/db/machine.mjs B1: sup_jobs / sup_leases / sup_attempts / sup_reports, audit in
// sup_events): queued -> spawning (staging checkout + file leases, one sup_attempts row per spawn) -> running
// ([Worker] terminal on the attempt) -> reported (sup_reports row) -> succeeded (landed by scripts/supervisor/land.mjs,
// checkout removed) | failed | cancelled. The job's working state (cluster, files, staging, routing, result) is
// its payload_json. The staging checkout is an EPHEMERAL Orca worktree of the runtime (an agent works in it, so Orca
// owns it: `orca worktree create --name sup-<job> --base-branch main` through scripts/machine/worktree-orca.mjs
// createOrcaWorktree, which stamps it `starci:supervisor-staging:sup-<job>;sup=<job>` (scripts/lib/orca-orphans.mjs
// runtimeStampOf); registry kind supervisor-staging keyed by Orca's worktree id). Orca picks
// its path and its branch; payload.staging records {path, branch, base, orcaId} as Orca reported them, and every reader
// (the land gate, the GCs, the reports) takes the RECORDED branch and path, never a name built from the job id. It lives
// only until its commit lands (or the job is cancelled), then goes through removeOrcaWorktree (links unlinked, `orca
// worktree rm`, the row closed, the branch deleted).
//
// Cap: adaptive, at most 10. base (config.yaml supervisor.workers.base, default 4) grows by one per two queued
// jobs up to max (default 10) and is halved while the machine is loaded (CPU busy >= 85% or free memory < 12%),
// down to 1 while it is saturated (CPU >= 95% or free memory < 6%).
//
// Routing: the balanced allocator over config.yaml allocation.shares (scripts/agent/models.mjs balanceDeficits),
// counting the machine's recent op dispatches (scripts/agent/balance.mjs) plus the Supervisor's own workers (sup_jobs), skipping a
// provider whose quota probe is dead or whose provider-health circuit is open on any product ledger, and a
// provider whose [Worker] spawn proved it cannot serve - its worker-start failed, or the failure text shows
// the outage its agent card declares (quotaExhausted/capacityExhausted, scripts/agent/provider-outage.mjs
// outageInText: e.g. an attestation rejected for "Quota exhausted") - for the rest of that spawn pass, for the
// requeued job it failed (payload.avoidAgents), and for every job once it failed READINESS_FAILS_PER_HOUR times
// in the last hour.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationMs, loadConfig, DEFAULT_ALLOCATION_WINDOW_HOURS } from '../../engine/config.mjs';
import {
  SKILL_ROOT, FIX_KIND, WORKER_TITLE_PREFIX, readSupervisor,
  supervisorEvent, supervisorSettings, productRepos, supervisorLog,
} from '../machine/home.mjs';
import { openMachine, starciLocalRoot } from '../../engine/db/machine.mjs';
import { createOrcaWorktree, removeOrcaWorktree, orcaWorktreeClient } from '../machine/worktree-orca.mjs';
import { ci } from '../api/npm/ci.mjs';
import { closeSelfSafe, releaseSelfSafe } from '../machine/close-verify.mjs';
import { machineLoad } from '../machine/host-resources.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { catFile } from '../api/git/cat-file.mjs'; import { cherry as gitCherry } from '../api/git/cherry.mjs'; import { cherryPick } from '../api/git/cherry-pick.mjs'; import { commitTree } from '../api/git/commit-tree.mjs'; import { config as gitConfig } from '../api/git/config.mjs'; import { diff as gitDiff } from '../api/git/diff.mjs'; import { hook as gitHook } from '../api/git/hook.mjs'; import { log as gitLog } from '../api/git/log.mjs'; import { lsFiles } from '../api/git/ls-files.mjs'; import { mergeBaseQuery } from '../api/git/merge-base-query.mjs'; import { mergeTree } from '../api/git/merge-tree.mjs'; import { push as gitPush } from '../api/git/push.mjs'; import { remote as gitRemote } from '../api/git/remote.mjs'; import { revList } from '../api/git/rev-list.mjs'; import { revParseQuery } from '../api/git/rev-parse-query.mjs'; import { show as gitShow } from '../api/git/show.mjs'; import { statusQuery } from '../api/git/status-query.mjs'; import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs'; const SUPERVISOR_GIT = { 'cat-file': catFile, cherry: gitCherry, 'cherry-pick': cherryPick, 'commit-tree': commitTree, config: gitConfig, diff: gitDiff, hook: gitHook, log: gitLog, 'ls-files': lsFiles, 'merge-base': mergeBaseQuery, 'merge-tree': mergeTree, push: gitPush, remote: gitRemote, 'rev-list': revList, 'rev-parse': revParseQuery, show: gitShow, status: statusQuery, 'symbolic-ref': symbolicRefQuery };
import { posixPath, sameOrUnder } from '../lib/path-key.mjs';
import { CONTRACT_CHANGES_DIR } from '../lib/contract-changes-path.mjs';
import { guardLaunch, bindGuardTerminal } from '../guards/hook-install.mjs';
import { outageInText } from '../agent/provider-outage.mjs';
import { loadRuntimes } from '../agent/models.mjs';
import { startWorkerAgent } from '../agent/start-worker.mjs'; import { isMain } from '../lib/is-main.mjs';
import { readEnv } from '../lib/env.mjs';
import { slugify } from '../lib/slug.mjs';

/**
 * The guard layer of a [Worker] launch, the same one op workers get (scripts/guards/hook-install.mjs guardLaunch), bound to
 * the worker's terminal once it starts: its staging checkout has its own node_modules (createStaging runs npm ci), and
 * an install through a node_modules link would empty the link's target (node-modules-link-wipe, 2026-09-28) - the
 * command guard (scripts/guards/command-guard.mjs, a PreToolUse hook) refuses that (DEPS_THROUGH_LINK). No history
 * hook (repos []): a [Worker] commits only in its runtime staging branch, and that checkout is a linked worktree of
 * the live runtime repo, so `git rev-parse --git-path hooks` there is the live repo's SHARED hooks dir - a hook
 * installed "for the staging checkout" lands in the live repo and refuses every branch deletion and ref rewrite
 * there (the land gate's staging-branch cleanup, lanes; land run 26 refused 3a9558930). Its owned paths are the job's leased
 * files resolved against its staging checkout, absolute like op leases (scripts/kernel/cli.mjs opGuardLaunch): a
 * directory lease (a trailing `/**` dropped) covers its subtree. With none, or with paths left relative (resolved
 * against the Supervisor's cwd), the command guard refuses every `git add`/commit (PATH_NOT_OWNED) and no worker can
 * commit (worker-guard-owned-empty). {receipt}.
 */
export function workerGuard(jobId, { root = SKILL_ROOT, staging = null, files = [], launch = guardLaunch } = {}) {
  try {
    const owned = staging ? (files ?? []).filter(Boolean).map((f) => path.resolve(staging, String(f).replace(/[\\/]\*\*[\\/]?$/, '') || '.')) : [];
    return launch({ skillRoot: root, jobId, workflowId: 'supervisor', ledgerRepo: null, owned, repos: [] });
  } catch (error) { return { receipt: { error: String(error?.message ?? error) } }; }
}

export const OPEN_STATUSES = Object.freeze(['queued', 'spawning', 'running', 'reported']);
const LIVE_STATUSES = Object.freeze(['spawning', 'running', 'reported']);
const ACTIVE_STATUSES = Object.freeze(['spawning', 'running']);
const FINAL_STATUSES = Object.freeze(['succeeded', 'failed', 'cancelled']);
/** sup_attempts.agent is one of these (0001-init CHECK); any other provider is recorded as null. */
const ATTEMPT_AGENTS = new Set(['devin', 'codex', 'claude']);
const MAX_SPAWN_ATTEMPTS = 3;
export const READINESS_FAILS_PER_HOUR = 2;
export const AGENTS = Object.freeze({ 'claude-agent': 'claude', 'codex-agent': 'codex', 'devin-agent': 'devin' });
const PROMPT_FILE = path.join(SKILL_ROOT, 'modules', 'supervisor', 'worker-prompt.md');
const parse = parseJsonOr;
const csv = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : []);
export const normPath = (p) => posixPath(p).replace(/\/+$/, '');

/** The supervisor's git runner (land, push-mains, push-git, direct-commits; their `run`/`git` seams take the same argv): `args[0]` names the scripts/api/git call file it runs, in `cwd`: {ok, status, stdout, stderr}. */
export function git([verb, ...args], { cwd = SKILL_ROOT, input = undefined, env = undefined, timeoutMs = 300_000 } = {}) {
  const r = (SUPERVISOR_GIT[verb] ?? (() => { throw new Error(`git ${verb}: no scripts/api/git call file in the supervisor's git calls`); }))(args, { cwd, timeout: timeoutMs, input, env: env ?? process.env, maxBuffer: 64 * 1024 * 1024 });
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status == null && r.signal === 'SIGTERM');
  return { ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim(), error: r.error?.message ?? null, ...(timedOut ? { timedOut: true, timeoutMs } : {}) };
}

/* ------------------------------------------------------------ cap */

/** The adaptive worker cap: {cap, base, max, queued, running, load, reason}. Pure given `load`. */
export function adaptiveCap({ base = 4, max = 10, queued = 0, running = 0, load = null } = {}) {
  const hardMax = Math.min(10, Math.max(1, max));
  let cap = Math.min(hardMax, Math.max(1, base) + Math.ceil(Math.max(0, queued) / 2));
  let reason = queued > 0 ? `base ${base} + ${Math.ceil(queued / 2)} for ${queued} queued` : `base ${base}`;
  if (load && (load.cpuBusy >= 0.95 || load.freeMem < 0.06)) { cap = 1; reason += '; machine saturated -> 1'; }
  else if (load && (load.cpuBusy >= 0.85 || load.freeMem < 0.12)) { cap = Math.max(1, Math.floor(cap / 2)); reason += '; machine loaded -> halved'; }
  return { cap, base, max: hardMax, queued, running, load, reason, free: Math.max(0, cap - running) };
}

/* ------------------------------------------------------------ jobs */

// A sup_jobs row with its latest attempt: {job_id, status, kind, role, cluster, title, lane, created_at, updated_at,
// payload, result (payload.result), worker_id (the attempt's terminal; 'supervisor' for a self job), attempt_id,
// attempt_closed_at}. `m` is the machine handle (engine/db/machine.mjs) everywhere below.
const JOB_SELECT = `SELECT j.*, a.attempt_id, a.terminal_handle, a.closed_at AS attempt_closed_at FROM sup_jobs j
  LEFT JOIN sup_attempts a ON a.attempt_id=(SELECT attempt_id FROM sup_attempts WHERE job_id=j.job_id ORDER BY dispatch_seq DESC LIMIT 1)`;
function rowJob(row) {
  if (!row) return null;
  const payload = parse(row.payload_json);
  const { terminal_handle: handle, payload_json: _p, files_json: _f, ...rest } = row;
  return { ...rest, payload, result: payload.result ?? null, worker_id: payload.self ? (row.attempt_id != null ? 'supervisor' : null) : handle ?? null };
}
export const jobsOf = (m, statuses = null) => m.db.prepare(`${JOB_SELECT} WHERE j.kind=? ${statuses ? `AND j.status IN (${statuses.map(() => '?').join(',')})` : ''} ORDER BY j.created_at, j.job_id`)
  .all(FIX_KIND, ...(statuses ?? [])).map(rowJob);
export const jobOf = (m, jobId) => rowJob(m.db.prepare(`${JOB_SELECT} WHERE j.job_id=?`).get(jobId));
/**
 * The terminals the open [Worker] jobs own: every live-status job's worker_id whose terminal is not closed yet.
 * Orca lists them under the runtime project next to the [Supervisor]; the seat dedupe and the Orca-tree check
 * treat them as owned, never as duplicates, strays or orphans.
 */
export const openWorkerHandles = (m) => new Set(jobsOf(m, LIVE_STATUSES)
  .filter((j) => !j.payload.self && j.worker_id && j.attempt_closed_at == null && !j.payload.terminalClosed).map((j) => j.worker_id));
/** The job's newest report: the sup_reports row with `report` parsed, or null. */
export const reportOf = (m, jobId) => { const r = m.db.prepare('SELECT * FROM sup_reports WHERE job_id=? ORDER BY report_id DESC LIMIT 1').get(jobId); return r ? { ...r, report: parse(r.report_json) } : null; };

/** Write a job's status and/or payload (sup_jobs; a status change also appends the sup-job-<status> event). */
function setJob(m, jobId, { status = null, payload = undefined }) {
  if (status) return m.setSupJobStatus(jobId, status, { payload });
  return m.update('sup_jobs', { payload_json: payload, updated_at: m.now() }, { job_id: jobId }).changes > 0;
}
/** The job's latest attempt id; a job that never spawned (a status set by hand) gets an empty one. */
function attemptIdOf(m, jobId) {
  return m.latestSupAttempt(jobId)?.attempt_id ?? m.startSupAttempt({ jobId }).attemptId;
}

// Append-only registries every contract job adds an entry to (supervise.yaml landGate step 2). Leasing one
// serialized every contract job behind whichever held it (2026-09-24: three jobs queued 70 min on
// the grammar CHANGELOG). They are never leased: .gitattributes merges them `union` at the gate's
// cherry-pick, and the gate still parses the result.
// Entry files under modules/kernel/contract-changes/ are one per change and never shared, so never leased either.
// Neither is the directory itself: every brief names the bare path, and a lease on it serialized every contract
// job behind its holder (worker-lease-contract-changes-dir, 2026-09-30). A row a finished job left there no
// longer matches leaseConflicts either, since the asking job's files are filtered the same way.
const SHARED_APPEND_FILES = new Set(['packages/grammar/CHANGELOG.md']);
const leasable = (files) => files.map(normPath).filter((f) => !SHARED_APPEND_FILES.has(f) && !sameOrUnder(f, CONTRACT_CHANGES_DIR));

/** Leases other open jobs hold on any of `files`: [{file, jobId}]. */
export function leaseConflicts(m, files, jobId = null) {
  const keys = leasable(files);
  if (!keys.length) return [];
  return m.db.prepare(`SELECT path, job_id FROM sup_leases WHERE expires_at>=? AND path IN (${keys.map(() => '?').join(',')})`)
    .all(m.now(), ...keys).filter((r) => r.job_id !== jobId).map((r) => ({ file: r.path, jobId: r.job_id }));
}

/** Create the job of one cluster; an open job of the same cluster is returned instead (one worker per cluster). */
export function createJob(m, { cluster, title, files = [], incidents = [], specs = [], brief = '', agent = null, self = false, now = Date.now() }) {
  if (!cluster) throw Error('a job needs --cluster <id>');
  if (!files.length) throw Error('a job needs --files <csv>: the explicit file leases');
  const open = jobsOf(m, OPEN_STATUSES).find((j) => j.payload.cluster === cluster);
  if (open) return { created: false, job: open };
  const jobId = `fix-${slugify(cluster, { max: 40, fallback: 'fix' })}-${crypto.randomBytes(3).toString('hex')}`;
  const payload = { cluster, title: title ?? cluster, files: files.map(normPath), incidents, specs, brief, agent, self, spawnAttempts: 0 };
  m.transaction(() => {
    m.upsertSupJob({ jobId, kind: FIX_KIND, role: self ? 'supervisor' : 'worker', cluster, title: payload.title, status: 'queued', files: payload.files, brief: brief || null, payload });
    supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: 'worker-job-created', payload: { cluster, files: payload.files, incidents, self }, now });
  });
  return { created: true, job: jobOf(m, jobId) };
}

// How long a worker job's file leases live (modules/models/runtimes.yaml
// allocation.workerJobs.leaseTtlMs): long enough to outlive any job, so a dead
// worker's leases still free themselves.
export const WORKER_LEASE_TTL_MS = allocationMs('workerJobs.leaseTtlMs');
/** The job's file leases (sup_leases; SHARED_APPEND_FILES stay unleased). {ok} or {ok:false, conflicts}. */
const takeLeases = (m, job) => m.acquireSupLeases(job.job_id, leasable(job.payload.files), { ttlMs: WORKER_LEASE_TTL_MS });
export const releaseLeases = (m, jobId) => m.releaseSupLeases(jobId);

/* ------------------------------------------------------------ staging */

/** The registry kind of a [Worker] staging checkout (scripts/machine/worktree-registry.mjs ORCA_KINDS). */
export const STAGING_KIND = 'supervisor-staging';
/** The Orca worktree name of a job's staging checkout; Orca derives the branch from it (the receipt is what counts). */
export const stagingNameOf = (jobId) => `sup-${jobId}`;

/**
 * Create the job's staging checkout through Orca: createOrcaWorktree (the slot registered with its [Worker] job for the
 * GC, `orca worktree create --repo path:<runtime> --name sup-<job> --base-branch main --setup skip`, stamped
 * `starci:supervisor-staging:sup-<job>;sup=<job>`, the row bound to Orca's id), its own npm ci (never a node_modules junction, RT_NODE_MODULES_LINK) and a copy of the
 * owner config so specs run there as they do live. {ok, path, branch, base, orcaId} as Orca reported them | {ok:false, reason, code, error}
 */
export function createStaging({ jobId, root = SKILL_ROOT, env = process.env, orca = orcaWorktreeClient, install = ci }) {
  const made = createOrcaWorktree({ repoRoot: root, kind: STAGING_KIND, name: stagingNameOf(jobId), base: 'main', owner: { lane: jobId }, env, orca });
  if (!made.ok) return { ok: false, reason: made.reason, code: 'WORKER_STAGING_CREATE_FAILED', error: `${made.reason}: ${made.detail ?? ''}`.trim() };
  if (!made.branch || !made.head) {
    // The land gate cherry-picks from the recorded branch above the recorded base: a receipt without them is useless.
    removeOrcaWorktree({ repoRoot: root, orcaId: made.id, dir: made.path, env, orca });
    return { ok: false, reason: 'orca-worktree-create-failed', code: 'WORKER_STAGING_CREATE_FAILED', error: `orca worktree create reported no ${made.branch ? 'head' : 'branch'} for ${made.path}` };
  }
  const deps = fs.existsSync(path.join(made.path, 'package-lock.json')) ? install(made.path) : { ok: true };
  if (!deps.ok) {
    removeOrcaWorktree({ repoRoot: root, orcaId: made.id, dir: made.path, env, orca });
    return { ok: false, reason: 'staging-install-failed', code: 'WORKER_STAGING_CREATE_FAILED', error: `npm ci in the staging checkout failed (exit ${deps.status ?? 'unknown'}): ${deps.stderr.slice(-400)}` };
  }
  try { const cfg = path.join(root, 'config.yaml'); if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(made.path, 'config.yaml')); } catch { /* optional */ }
  return { ok: true, path: made.path, branch: made.branch, base: made.head, orcaId: made.id };
}

/** The payload.staging record of a created checkout. */
const stagingRecord = (staging) => ({ path: staging.path, branch: staging.branch, base: staging.base, orcaId: staging.orcaId });

/**
 * Remove a job's staging checkout (`staging`: its payload.staging record) through Orca: removeOrcaWorktree unlinks every
 * link (the node_modules junction included) and asserts none is left, runs `orca worktree rm`, asserts the main checkout
 * untouched and closes the registry row. Its recorded branch goes too when its work landed (`landed`: `git branch -D`)
 * or it holds no commit beyond main (`git branch -d`); otherwise it is kept so nothing a worker committed is lost.
 * Idempotent. {jobId, path, removed, branchDeleted, branchKept?} | {..., removed:false, code, reason?, error, fatal?}
 */
export function removeStaging({ jobId, staging, root = SKILL_ROOT, env = process.env, landed = false, orca = orcaWorktreeClient }) {
  const out = { jobId, path: staging?.path ?? null, removed: false, branchDeleted: false };
  if (!staging?.path || !staging?.orcaId) return { ...out, code: 'WORKER_STAGING_REMOVE_FAILED', error: `job ${jobId} records no Orca staging checkout (path and orcaId)` };
  const r = removeOrcaWorktree({ repoRoot: root, orcaId: staging.orcaId, dir: staging.path, branch: staging.branch ?? null,
    deleteBranch: staging.branch ? (landed ? 'force' : 'merged') : null, env, orca });
  if (r.ok || r.reason === 'branch-delete-failed') {
    // branch-delete-failed: the tree is gone and the branch holds commits main lacks - it is kept, never forced.
    out.removed = true;
    out.branchDeleted = r.branch?.deleted === true;
    if (staging.branch && !out.branchDeleted) out.branchKept = staging.branch;
    return out;
  }
  const detail = typeof r.detail === 'string' ? r.detail : r.detail ? JSON.stringify(r.detail).slice(0, 200) : '';
  const errors = (r.errors ?? []).map((e) => `${e.code ?? ''} ${e.path ?? ''}`.trim()).join('; ');
  return { ...out, reason: r.reason, code: 'WORKER_STAGING_REMOVE_FAILED', error: [r.reason, detail, errors].filter(Boolean).join(': '),
    ...(r.fatal ? { fatal: true, damage: r.damage } : {}) };
}

/* ------------------------------------------------------------ routing */

/** Equal weight for every pool the model registry declares — the absent-shares meaning. */
export const equalPoolShares = (runtimes) => Object.fromEntries(Object.keys(runtimes?.runtimes ?? {}).map((pool) => [pool, 1]));

/**
 * Pick the worker's pool: among config allocation.shares pools with a hard-tier model and an available
 * provider, the one furthest below its share. `recent` = {pool: count}; `availabilityOf(provider)` ->
 * {state, reason}. Pure given its inputs. Returns {pool, agent, model, effort, deficits, skipped} or {error}.
 */
export async function pickWorkerPool({ shares, runtimes, recent = {}, availabilityOf = () => ({ state: 'available' }), prefer = null, avoid = [] }) {
  const { balanceDeficits, resolveLaunchModel } = await import('../agent/models.mjs');
  const skipped = [];
  const candidates = [];
  for (const pool of Object.keys(shares ?? {})) {
    const provider = runtimes?.runtimes?.[pool]?.provider ?? AGENTS[pool] ?? null;
    if (!provider) { skipped.push({ pool, reason: 'no registry.yaml pool' }); continue; }
    if (prefer && provider !== prefer) continue;
    if (avoid.includes(provider)) { skipped.push({ pool, reason: `${provider} failed worker readiness` }); continue; }
    const launch = resolveLaunchModel(pool, 'hard', { runtimes });
    if (launch.error) { skipped.push({ pool, reason: launch.error }); continue; }
    const availability = availabilityOf(provider);
    if (availability?.state === 'unavailable') { skipped.push({ pool, reason: availability.reason }); continue; }
    candidates.push({ pool, agent: provider, model: launch.modelId, effort: launch.effort ?? null, limited: availability?.state === 'limited' });
  }
  if (!candidates.length) return { error: prefer ? `agent '${prefer}' is not available for a worker` : 'no worker pool is available', skipped };
  const deficits = balanceDeficits(candidates.map((c) => c.pool), { shares, recent });
  const best = candidates.reduce((a, c) => {
    if (!a) return c;
    if (a.limited !== c.limited) return a.limited ? c : a;
    return deficits[c.pool].deficit > deficits[a.pool].deficit + 1e-9 ? c : a;
  }, null);
  return { ...best, deficits, skipped };
}

/** The live inputs of pickWorkerPool: config shares, recent dispatches (machine + workers), provider health. */
export async function routeWorker({ m, prefer = null, avoid = [], config = undefined, env = process.env } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  // Absent owner shares = equal over every pool registry.yaml declares (the
  // configuredAllocationPolicy contract), never a literal pool list.
  const shares = cfg?.allocation?.shares ?? equalPoolShares(loadRuntimes());
  const windowHours = cfg?.allocation?.windowHours ?? DEFAULT_ALLOCATION_WINDOW_HOURS;
  const recent = {};
  try {
    const { recentDispatchCounts } = await import('../agent/balance.mjs');
    Object.assign(recent, recentDispatchCounts({ windowHours, machine: true, env }).counts);
  } catch { /* balance is best effort */ }
  const since = Date.now() - windowHours * 3600_000;
  for (const j of jobsOf(m).filter((x) => x.created_at >= since && x.payload.pool)) recent[j.payload.pool] = (recent[j.payload.pool] ?? 0) + 1;
  const { providerAvailability, providerCircuitOf } = await import('../agent/models.mjs');
  let probe = null;
  try { probe = (await import('../agent/quota/index.mjs')).probeQuota; } catch { probe = null; }
  const { withLedgerRead } = await import('../connectors/lib.mjs');
  const repos = productRepos(supervisorSettings({ config: cfg }));
  const availabilityOf = (provider) => {
    let q = null;
    try { q = probe ? probe(provider) : null; } catch { q = null; }
    const circuit = repos.map((repo) => withLedgerRead(repo, (ldb) => providerCircuitOf(ldb, provider), null)).find(Boolean) ?? null;
    return providerAvailability({ probe: q, circuit });
  };
  return pickWorkerPool({ shares, runtimes: loadRuntimes(), recent, availabilityOf, prefer, avoid });
}

/** Providers whose [Worker] spawn failed readiness or on a provider outage at least `min` times since `since` (sup_events worker-spawn-failed). */
function readinessFailedProviders(m, { since, min = READINESS_FAILS_PER_HOUR } = {}) {
  const counts = {};
  for (const row of m.db.prepare("SELECT payload_json FROM sup_events WHERE kind='worker-spawn-failed' AND created_at>=?").all(since)) {
    const p = parse(row.payload_json);
    if ((p.step === 'worker-start' || p.outage) && p.agent) counts[p.agent] = (counts[p.agent] ?? 0) + 1;
  }
  return Object.keys(counts).filter((a) => counts[a] >= min);
}

/* ------------------------------------------------------------ spawn */

function renderWorkerPrompt(job, staging, { template = null, skillRoot = SKILL_ROOT } = {}) {
  const p = job.payload;
  return (template ?? fs.readFileSync(PROMPT_FILE, 'utf8'))
    .replaceAll('{jobId}', job.job_id).replaceAll('{cluster}', p.cluster).replaceAll('{title}', p.title ?? p.cluster)
    .replaceAll('{incidents}', (p.incidents ?? []).join(', ') || '(none named)')
    .replaceAll('{branch}', staging.branch).replaceAll('{base}', String(staging.base).slice(0, 12)).replaceAll('{staging}', staging.path)
    .replaceAll('{files}', (p.files ?? []).join(', ')).replaceAll('{specs}', (p.specs ?? []).join(', ') || '(name the spec you add)')
    .replaceAll('{brief}', String(p.brief ?? '').trim() || '(see the incidents)').replaceAll('{skillRoot}', skillRoot);
}

/**
 * Launch queued jobs while the adaptive cap has room. Each launch: lease check, route, staging checkout,
 * leases, [Worker] worker. The worker starts through worker-start ON its staging checkout (scripts/agent/lib.mjs
 * startAgent): a staging checkout is a git worktree of the runtime repository, which Orca resolves under the runtime's
 * project. Its guard is bound to the worker's terminal (bindGuardTerminal). A failed launch releases its leases,
 * removes its checkout and requeues the job (failed after MAX_SPAWN_ATTEMPTS).
 * `deps`: {start, bindGuard, route, load, staging, unstage, orca} for specs (orca: the Orca worktree client).
 */
export async function spawnWorkers(m, { jobId = null, dryRun = false, settings = supervisorSettings(), deps = {}, env = process.env, root = SKILL_ROOT, now = Date.now } = {}) {
  const orca = deps.orca ?? orcaWorktreeClient;
  const queuedJobs = jobsOf(m, ['queued']).filter((j) => !j.payload.self && (!jobId || j.job_id === jobId));
  const running = jobsOf(m, ACTIVE_STATUSES).filter((j) => !j.payload.self).length;
  const load = (deps.load ?? machineLoad)();
  const cap = adaptiveCap({ base: settings.workers.base, max: settings.workers.max, queued: queuedJobs.length, running, load });
  const result = { cap, launched: [], skipped: [], failed: [] };
  // Providers whose worker terminal failed readiness this pass, or READINESS_FAILS_PER_HOUR times in the hour.
  const notReady = new Set(readinessFailedProviders(m, { since: now() - 3600_000 }));
  let live = running;
  for (const job of queuedJobs) {
    if (live >= cap.cap) { result.skipped.push({ jobId: job.job_id, reason: `cap ${cap.cap} reached (${cap.reason})` }); continue; }
    const conflicts = leaseConflicts(m, job.payload.files, job.job_id);
    if (conflicts.length) { result.skipped.push({ jobId: job.job_id, reason: `files leased by ${[...new Set(conflicts.map((c) => c.jobId))].join(', ')}`, conflicts }); continue; }
    const avoid = [...new Set([...notReady, ...(job.payload.avoidAgents ?? [])])];
    const prefer = job.payload.agent && !avoid.includes(job.payload.agent) ? job.payload.agent : null;
    const route = await (deps.route ?? ((opts) => routeWorker(opts)))({ m, prefer, avoid, env });
    if (route.error) { result.skipped.push({ jobId: job.job_id, reason: route.error, routeSkipped: route.skipped }); continue; }
    if (dryRun) { result.launched.push({ jobId: job.job_id, wouldLaunch: true, agent: route.agent, model: route.model, pool: route.pool }); live += 1; continue; }
    const staging = (deps.staging ?? createStaging)({ jobId: job.job_id, root, env, orca });
    if (!staging.ok) { result.failed.push({ jobId: job.job_id, step: 'staging', code: staging.code ?? 'WORKER_STAGING_CREATE_FAILED', error: staging.error }); continue; }
    // One sup_attempts row per spawn: who (agent/model), where (staging checkout, branch, base).
    const leased = m.transaction(() => {
      const held = takeLeases(m, job);
      if (!held.ok) return held;
      setJob(m, job.job_id, { status: 'spawning' });
      const { attemptId } = m.startSupAttempt({ jobId: job.job_id, agent: ATTEMPT_AGENTS.has(route.agent) ? route.agent : null, provider: route.agent ?? null,
        model: route.model ?? null, effort: route.effort ?? null, worktreePath: staging.path, branch: staging.branch, baseSha: staging.base });
      return { ok: true, attemptId };
    });
    if (!leased.ok) {
      (deps.unstage ?? removeStaging)({ jobId: job.job_id, staging: stagingRecord(staging), root, env, orca });
      result.skipped.push({ jobId: job.job_id, reason: `files leased by ${[...new Set(leased.conflicts.map((c) => c.holder))].join(', ')}` });
      continue;
    }
    const prompt = renderWorkerPrompt(job, staging);
    const title = `${WORKER_TITLE_PREFIX} ${job.payload.cluster}`.slice(0, 80);
    const guard = (deps.guard ?? workerGuard)(job.job_id, { root, staging: staging.path, files: job.payload.files ?? [] });
    if (typeof guard.receipt?.jobFile !== 'string') supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-guard-missing', payload: { receipt: guard.receipt }, now: now() });
    const spawned = await startWorkerAgent({ route, worktree: staging.path, title, prompt,
      specFile: path.join(starciLocalRoot(env), 'supervisor', 'workers', `${job.job_id}.prompt.md`), objective: `${title} — ${job.job_id}`, entry: env.ORCA_TERMINAL_HANDLE || null,
      request: { workerJob: job.job_id, spawnAttempt: (job.payload.spawnAttempts ?? 0) + 1 }, onCreated: (handle) => { if (typeof guard.receipt?.jobFile === 'string') guard.receipt.terminal = (deps.bindGuard ?? bindGuardTerminal)({ skillRoot: root, handle, jobFile: guard.receipt.jobFile }); },
      start: deps.start ?? null });
    const payload = { ...job.payload, pool: route.pool, agent: route.agent, model: route.model, staging: stagingRecord(staging),
      spawnAttempts: (job.payload.spawnAttempts ?? 0) + 1, guard: guard.receipt,
      ...(spawned?.ok ? { dispatch: spawned.dispatchId, runId: spawned.runId, taskId: spawned.taskId } : {}) };
    if (!spawned?.ok) {
      const exhausted = payload.spawnAttempts >= MAX_SPAWN_ATTEMPTS;
      // A requeued job keeps the agent it asked for (never the one routed to it) and never returns to a provider
      // whose worker-start failed for it or whose failure shows its card's outage (quota/capacity
      // exhausted); the rest of this pass skips that provider too.
      const outage = route.agent ? outageInText(route.agent, [spawned?.error, JSON.stringify(spawned?.details ?? null)]) : null;
      const notReadyHere = spawned?.step === 'worker-start' || Boolean(outage);
      if (notReadyHere) notReady.add(route.agent);
      const avoidAgents = notReadyHere ? [...new Set([...(job.payload.avoidAgents ?? []), route.agent])] : job.payload.avoidAgents;
      m.transaction(() => {
        releaseLeases(m, job.job_id);
        m.updateSupAttempt(leased.attemptId, { cancelledAt: now(), failureClass: `spawn:${spawned?.step ?? 'spawn'}`, terminalHandle: spawned?.terminal ?? null });
        setJob(m, job.job_id, { status: exhausted ? 'failed' : 'queued', payload: { ...payload, agent: job.payload.agent ?? null, lastAgent: route.agent,
          ...(avoidAgents ? { avoidAgents } : {}), staging: null, lastSpawnError: spawned?.error ?? 'spawn failed',
          result: exhausted ? { reason: 'spawn-failed', step: spawned?.step ?? null, error: spawned?.error ?? null } : null } });
        supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawn-failed', payload: { agent: route.agent, step: spawned?.step ?? null, error: spawned?.error ?? null, exhausted, ...(outage ? { outage: outage.failureKind } : {}) }, now: now() });
      });
      (deps.unstage ?? removeStaging)({ jobId: job.job_id, staging: stagingRecord(staging), root, env, orca });
      result.failed.push({ jobId: job.job_id, step: spawned?.step ?? 'spawn', error: spawned?.error ?? null, agent: route.agent, requeued: !exhausted });
      continue;
    }
    m.transaction(() => {
      m.updateSupAttempt(leased.attemptId, { terminalHandle: spawned.terminal });
      setJob(m, job.job_id, { status: 'running', payload: { ...payload, startedAt: new Date(now()).toISOString() } });
      supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawned', payload: { terminal: spawned.terminal, dispatch: spawned.dispatchId, agent: route.agent, model: route.model, pool: route.pool, staging: staging.path }, now: now() });
    });
    live += 1;
    result.launched.push({ jobId: job.job_id, terminal: spawned.terminal, agent: route.agent, model: route.model, staging: staging.path });
  }
  return result;
}

/** The Supervisor's own staging checkout: a self job (no terminal) holding leases, landed through land.mjs. */
export function stageSelf(m, { name, files, root = SKILL_ROOT, env = process.env, now = Date.now(), orca = orcaWorktreeClient }) {
  const created = createJob(m, { cluster: `self-${slugify(name, { max: 40, fallback: 'fix' })}`, title: name, files, self: true, now });
  const job = created.job;
  if (job.status === 'running' && job.payload.staging?.path && fs.existsSync(job.payload.staging.path)) return { ok: true, reused: true, jobId: job.job_id, ...job.payload.staging };
  const conflicts = leaseConflicts(m, job.payload.files, job.job_id);
  if (conflicts.length) return { ok: false, jobId: job.job_id, error: `files leased by ${[...new Set(conflicts.map((c) => c.jobId))].join(', ')}`, conflicts };
  const staging = createStaging({ jobId: job.job_id, root, env, orca });
  if (!staging.ok) return { ok: false, jobId: job.job_id, code: staging.code, error: staging.error };
  const held = m.transaction(() => {
    const leased = takeLeases(m, job);
    if (!leased.ok) return leased;
    m.startSupAttempt({ jobId: job.job_id, worktreePath: staging.path, branch: staging.branch, baseSha: staging.base });
    setJob(m, job.job_id, { status: 'running', payload: { ...job.payload, staging: stagingRecord(staging) } });
    supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'supervisor-staged', payload: { staging: staging.path, files: job.payload.files }, now });
    return { ok: true };
  });
  if (!held.ok) {
    removeStaging({ jobId: job.job_id, staging: stagingRecord(staging), root, env, orca });
    return { ok: false, jobId: job.job_id, error: `files leased by ${[...new Set(held.conflicts.map((c) => c.holder))].join(', ')}` };
  }
  return { ok: true, jobId: job.job_id, ...staging };
}

/* ------------------------------------------------------------ report, cancel, finish */

/**
 * The Supervisor releases its own [Worker] (owner, 2026-09-28: the Supervisor owns its workers' lifecycle): worker-stop + worker-release on its Dispatch, and
 * records the verified result on the job (payload.terminalClosed, the attempt's closed_at) and as a
 * worker-terminal-closed event. Nothing to do for a self job (worker_id 'supervisor'), a job that never got a
 * terminal, or one already closed with proof. A close that is not proven stays unrecorded on the payload so
 * openWorkerHandles still counts the terminal and the tick GC (gc.mjs) retries it as a leftover. `close` is
 * closeSelfSafe (seam). Returns the close result or null.
 */
export function closeWorkerTerminal(m, { jobId, env = process.env, now = Date.now(), close = closeSelfSafe, release = releaseSelfSafe } = {}) {
  const job = jobOf(m, jobId);
  const handle = job?.worker_id;
  if (!handle || handle === 'supervisor' || job.payload.self) return null;
  if (job.payload.terminalClosed?.ok === true) return null;
  // A worker-start worker is fenced and released by its Dispatch (release archives its output); a job
  // recorded without a Dispatch has only its terminal to close.
  const dispatch = job.payload.dispatch ?? null;
  let r;
  try { r = dispatch ? release(dispatch, handle, { owner: `supervisor:${jobId}`, env }) : close(handle, { owner: `supervisor:${jobId}`, env }); }
  catch (error) { r = { handle, ok: false, error: String(error?.message ?? error) }; }
  const record = { handle, ...(dispatch ? { dispatch } : {}), ok: r?.ok === true, proof: r?.proof ?? null, ...(r?.detached ? { detached: true } : {}), ...(r?.reason ? { reason: r.reason } : {}),
    ...(r?.error ? { error: String(r.error).slice(0, 200) } : {}), at: new Date(now).toISOString() };
  try {
    m.transaction(() => {
      const fresh = jobOf(m, jobId);
      if (record.ok) {
        setJob(m, jobId, { payload: { ...fresh.payload, terminalClosed: record } });
        if (fresh.attempt_id != null) m.updateSupAttempt(fresh.attempt_id, { closedAt: now });
      }
      supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: record.ok ? 'worker-terminal-closed' : 'worker-terminal-unclosed', payload: record, now });
    });
  } catch { /* the close stands; the tick GC re-reads Orca */ }
  return record;
}

/** The worker files its report: the commit on its temp branch, the incidents it fixes, the specs that prove it. */
export function fileReport(m, { jobId, outcome, commit = null, specs = [], summary = '', needs = [], incidents = null, root = SKILL_ROOT, terminal = null, now = Date.now(), closeDeps = {} }) {
  const job = jobOf(m, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  if (!ACTIVE_STATUSES.includes(job.status)) return { ok: false, error: `job ${jobId} is ${job.status}, not running` };
  // diagnosed: a diagnosis job (the Supervisor never diagnoses with its own subagents) - the summary is the result.
  if (!['done', 'diagnosed', 'blocked', 'failed'].includes(outcome)) return { ok: false, error: 'outcome must be done, diagnosed, blocked or failed' };
  if (outcome === 'diagnosed' && !String(summary ?? '').trim()) return { ok: false, error: 'a diagnosed report carries its diagnosis in --summary (or --summary-file)' };
  let sha = null;
  if (outcome === 'done') {
    if (!commit) return { ok: false, error: 'a done report names --commit <sha>' };
    const resolved = git(['rev-parse', '--verify', '--quiet', `${commit}^{commit}`], { cwd: root });
    if (!resolved.ok) return { ok: false, error: `commit ${commit} does not exist` };
    sha = resolved.stdout;
    const branch = job.payload.staging?.branch;
    if (branch && !git(['merge-base', '--is-ancestor', sha, branch], { cwd: root }).ok) return { ok: false, error: `commit ${sha.slice(0, 9)} is not on ${branch}` };
    if (job.payload.staging?.base && sha === job.payload.staging.base) return { ok: false, error: 'the commit is the base: nothing was committed' };
  }
  const report = { outcome, commit: sha, base: job.payload.staging?.base ?? null, branch: job.payload.staging?.branch ?? null,
    specs: specs.length ? specs : job.payload.specs ?? [], incidents: incidents ?? job.payload.incidents ?? [], summary, needs, terminal };
  m.transaction(() => {
    const attemptId = attemptIdOf(m, jobId);
    m.recordSupReport({ attemptId, jobId, outcome, report });
    m.updateSupAttempt(attemptId, { reportedAt: now, reportOutcome: outcome, ...(sha ? { headSha: sha } : {}) });
    const status = outcome === 'done' ? 'reported' : outcome === 'diagnosed' ? 'succeeded' : 'failed';
    if (outcome !== 'done') releaseLeases(m, jobId);
    setJob(m, jobId, { status, payload: outcome === 'done' ? undefined : { ...job.payload, result: { reason: `worker-${outcome}`, summary, needs } } });
    supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: 'worker-reported', payload: { outcome, commit: sha, specs: report.specs, needs }, now });
  });
  // A diagnosed/blocked/failed report is the worker's last act: the Supervisor closes its terminal now (a done report
  // keeps it until the land, so a red gate can still be handed back to it). Filed from inside that terminal, the close
  // goes to a detached verifier (close-verify.mjs closeSelfSafe) so this process finishes writing first.
  const terminalClosed = outcome === 'done' ? null : closeWorkerTerminal(m, { jobId, now, ...closeDeps });
  return { ok: true, jobId, outcome, commit: sha, report, ...(terminalClosed ? { terminalClosed } : {}) };
}

/** Cancel a job: leases released, checkout removed (its branch kept when it holds commits). */
export function cancelJob(m, { jobId, reason = 'cancelled by the Supervisor', root = SKILL_ROOT, env = process.env, now = Date.now(), closeDeps = {}, orca = orcaWorktreeClient }) {
  const job = jobOf(m, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  if (!OPEN_STATUSES.includes(job.status)) return { ok: false, error: `job ${jobId} is already ${job.status}` };
  m.transaction(() => {
    releaseLeases(m, jobId);
    if (job.attempt_id != null) m.updateSupAttempt(job.attempt_id, { cancelledAt: now });
    setJob(m, jobId, { status: 'cancelled', payload: { ...job.payload, result: { reason } } });
    supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: 'worker-cancelled', payload: { reason }, now });
  });
  const staged = job.payload.staging ? removeStaging({ jobId, staging: job.payload.staging, root, env, orca }) : null;
  const terminalClosed = closeWorkerTerminal(m, { jobId, env, now, ...closeDeps });
  return { ok: true, jobId, terminal: job.worker_id ?? null, staged, ...(terminalClosed ? { terminalClosed } : {}) };
}

/**
 * The Supervisor's decision on a filed report that lands nothing (diagnosed, blocked, failed): the report is marked
 * consumed with the decision recorded, so the watchdog's [report] wake (filedReports: unconsumed, not done) stops
 * announcing it. 2026-09-28: four 2026-09-24 reports whose fixes had long landed resurfaced in [report] wakes all night.
 */
export function ackReport(m, { jobId, reason, now = Date.now() }) {
  if (!jobId || !String(reason ?? '').trim()) return { ok: false, error: 'ack needs --job and --reason' };
  const report = reportOf(m, jobId);
  if (!report) return { ok: false, error: `no report for ${jobId}` };
  if (report.consumed_at != null) return { ok: true, jobId, already: true };
  m.transaction(() => {
    m.consumeSupReport(report.report_id);
    m.updateSupAttempt(report.attempt_id, { ackedAt: now });
    supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: 'worker-report-acked', payload: { outcome: report.outcome, reason: String(reason).slice(0, 600) }, now });
  });
  return { ok: true, jobId, outcome: report.outcome };
}

/** Mark a landed job succeeded, release its leases and remove its checkout and temp branch. */
export function finishLanded(m, { jobId, landedSha, root = SKILL_ROOT, env = process.env, now = Date.now(), closeDeps = {}, orca = orcaWorktreeClient }) {
  const job = jobOf(m, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  m.transaction(() => {
    releaseLeases(m, jobId);
    if (job.attempt_id != null) m.updateSupAttempt(job.attempt_id, { landedAt: now, landedSha: landedSha ?? null });
    setJob(m, jobId, { status: 'succeeded', payload: { ...job.payload, result: { landed: landedSha ?? null } } });
    for (const r of m.supReports({ jobId, unconsumed: true })) m.consumeSupReport(r.report_id);
  });
  const staged = job.payload.staging ? removeStaging({ jobId, staging: job.payload.staging, root, env, landed: true, orca }) : null;
  const terminalClosed = closeWorkerTerminal(m, { jobId, env, now, ...closeDeps });
  return { ok: true, jobId, staged, terminal: job.worker_id ?? null, ...(terminalClosed ? { terminalClosed } : {}) };
}

/** A red gate on a job: the failure is kept on the job (payload.result); the job stays open for its worker. */
export function recordLandFailed(m, { jobId, reason, startedAt = Date.now() }) {
  const job = jobOf(m, jobId);
  if (!job) return false;
  return setJob(m, jobId, { payload: { ...job.payload, result: { landFailed: reason ?? null, at: new Date(startedAt).toISOString() } } });
}

/**
 * The running self jobs (workers.mjs stage --self) a `--commit` land just completed: a landed commit is on the
 * job's recorded staging branch beyond its base, and `git cherry main <branch> <base>` finds no commit of that branch
 * still missing from main. A branch only partly landed stays open ({jobId, pending}). Returns {done: [jobId], partial}.
 */
export function selfJobsLandedBy(m, commits, { root = SKILL_ROOT } = {}) {
  const shas = commits.map((c) => git(['rev-parse', '--verify', '--quiet', `${c}^{commit}`], { cwd: root }).stdout).filter(Boolean);
  const done = [], partial = [];
  for (const job of jobsOf(m, ACTIVE_STATUSES).filter((j) => j.payload.self && j.payload.staging?.branch && j.payload.staging?.base)) {
    const { branch, base } = job.payload.staging;
    if (!git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root }).ok) continue;
    const onBranch = (sha) => git(['merge-base', '--is-ancestor', sha, branch], { cwd: root }).ok && !git(['merge-base', '--is-ancestor', sha, base], { cwd: root }).ok;
    if (!shas.some(onBranch)) continue;
    const pending = git(['cherry', 'refs/heads/main', branch, base], { cwd: root }).stdout.split(/\r?\n/).filter((l) => l.startsWith('+')).map((l) => l.slice(2).trim());
    (pending.length ? partial : done).push({ jobId: job.job_id, pending });
  }
  return { done: done.map((d) => d.jobId), partial };
}

/** Remove the checkouts of every finished job that still has one. */
function cleanupStaging(m, { jobId = null, root = SKILL_ROOT, env = process.env, orca = orcaWorktreeClient } = {}) {
  const done = jobsOf(m, FINAL_STATUSES).filter((j) => (!jobId || j.job_id === jobId) && j.payload.staging?.path && fs.existsSync(j.payload.staging.path));
  return done.map((j) => removeStaging({ jobId: j.job_id, staging: j.payload.staging, root, env, landed: j.status === 'succeeded', orca }));
}

/* ------------------------------------------------------------ listing */

const ageMin = (iso, now = Date.now()) => { const t = Date.parse(iso ?? ''); return Number.isFinite(t) ? Math.round((now - t) / 60000) : null; };

/** The worker board /status and tick.mjs print: {active:[...], queued:[...], reported:[...], recent:[...]}. */
export function workerBoard(m, { now = Date.now() } = {}) {
  const view = (j) => ({ jobId: j.job_id, status: j.status, cluster: j.payload.cluster, agent: j.payload.agent ?? null, model: j.payload.model ?? null,
    terminal: j.worker_id ?? null, self: j.payload.self === true, ageMin: ageMin(j.payload.startedAt, now) ?? Math.round((now - j.created_at) / 60000),
    files: j.payload.files, incidents: j.payload.incidents ?? [], staging: j.payload.staging?.path ?? null });
  return {
    active: jobsOf(m, ACTIVE_STATUSES).map(view),
    queued: jobsOf(m, ['queued']).map(view),
    reported: jobsOf(m, ['reported']).map((j) => ({ ...view(j), report: reportOf(m, j.job_id)?.report ?? null })),
    recent: m.db.prepare(`${JOB_SELECT} WHERE j.kind=? AND j.status IN ('succeeded','failed','cancelled') ORDER BY j.updated_at DESC LIMIT 8`).all(FIX_KIND).map(rowJob).map((j) => ({ ...view(j), result: j.result })),
  };
}

/* ------------------------------------------------------------ CLI */

async function main() {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = has('json');
  const out = (r, text = null) => { console.log(asJson || !text ? JSON.stringify(r, null, asJson ? 0 : 2) : text); if (r?.ok === false) process.exitCode = 1; };
  if (!verb || has('help')) { console.log('use: workers.mjs create|spawn|stage|report|list|cap|show|cancel|cleanup ... (see the header)'); return; }
  if (verb === 'list') {
    const board = readSupervisor((m) => workerBoard(m), { active: [], queued: [], reported: [], recent: [] });
    const line = (j) => `  ${j.jobId} [${j.status}] ${j.cluster} ${j.agent ?? '-'} age ${j.ageMin}m${j.terminal ? ` ${j.terminal}` : ''}${j.report ? ` commit ${String(j.report.commit ?? '').slice(0, 9)}` : ''}${j.result ? ` ${JSON.stringify(j.result).slice(0, 120)}` : ''}`;
    return out(board, [`active ${board.active.length}`, ...board.active.map(line), `queued ${board.queued.length}`, ...board.queued.map(line),
      `reported (land queue) ${board.reported.length}`, ...board.reported.map(line), 'recent', ...board.recent.map(line)].join('\n'));
  }
  if (verb === 'cap') {
    const settings = supervisorSettings();
    const counts = readSupervisor((m) => ({ queued: jobsOf(m, ['queued']).length, running: jobsOf(m, ACTIVE_STATUSES).filter((j) => !j.payload.self).length }), { queued: 0, running: 0 });
    const cap = adaptiveCap({ ...settings.workers, ...counts, load: machineLoad() });
    return out(cap, `cap ${cap.cap} (${cap.reason}); running ${cap.running}, queued ${cap.queued}, free ${cap.free}; cpu ${Math.round(cap.load.cpuBusy * 100)}% free mem ${Math.round(cap.load.freeMem * 100)}%`);
  }
  if (verb === 'show') return out(readSupervisor((m) => ({ job: jobOf(m, value('job')), report: reportOf(m, value('job')) }), null));
  // A long-lived writer handle: spawn waits minutes for a worker's readiness (no transaction is held meanwhile).
  const m = openMachine();
  try {
    if (verb === 'create') {
      let brief = value('brief') ?? '';
      if (value('brief-file')) brief = fs.readFileSync(value('brief-file'), 'utf8');
      const r = createJob(m, { cluster: value('cluster'), title: value('title'), files: csv(value('files')), incidents: csv(value('incidents')), specs: csv(value('specs')), brief, agent: value('agent') });
      return out({ ok: true, created: r.created, jobId: r.job.job_id, status: r.job.status }, `${r.created ? 'created' : 'exists'} ${r.job.job_id} [${r.job.status}]`);
    }
    if (verb === 'spawn') {
      const r = await spawnWorkers(m, { jobId: value('job'), dryRun: has('dry-run') });
      supervisorLog('workers', `spawn: launched ${r.launched.length}, skipped ${r.skipped.length}, failed ${r.failed.length}`, { data: r });
      return out(r);
    }
    if (verb === 'stage') {
      if (!has('self')) return out({ ok: false, error: 'stage is the Supervisor\'s own checkout: stage --self --name <slug> --files <csv>' });
      return out(stageSelf(m, { name: value('name') ?? 'change', files: csv(value('files')) }));
    }
    if (verb === 'report') {
      const summary = value('summary-file') ? fs.readFileSync(value('summary-file'), 'utf8') : value('summary') ?? '';
      const r = fileReport(m, { jobId: value('job'), outcome: value('outcome'), commit: value('commit'), specs: csv(value('specs')), summary,
        needs: csv(value('needs')), terminal: readEnv('ORCA_TERMINAL_HANDLE') ?? null });
      supervisorLog('workers', `report ${value('job')}: ${r.ok ? r.outcome : r.error}`, { level: r.ok ? 'info' : 'warn', data: r });
      return out(r);
    }
    if (verb === 'cancel') return out(cancelJob(m, { jobId: value('job'), reason: value('reason') ?? undefined }));
    if (verb === 'ack') return out(ackReport(m, { jobId: value('job'), reason: value('reason') }));
    if (verb === 'cleanup') return out(cleanupStaging(m, { jobId: value('job') }));
    return out({ ok: false, error: `unknown verb ${verb}` });
  } finally { m.close(); }
}

if (isMain(import.meta.url)) main();
