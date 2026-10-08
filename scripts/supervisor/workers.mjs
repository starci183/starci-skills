#!/usr/bin/env node
// Supervisor fix workers: one job per root-cause cluster (modules/supervisor/supervise.yaml, docs/supervisor.md).
// CLI: create, spawn, stage --self, report, list, cap, show, cancel, ack, cleanup; workers-cli.mjs owns arguments.
// machine.sqlite owns sup_jobs, sup_leases, sup_attempts, sup_reports and sup_events; working data is payload_json.
// queued -> spawning (staging + leases + attempt) -> running (terminal) -> reported -> succeeded | failed | cancelled.
// Unknown launch effects retain their original Dispatch, staging and leases until the next spawn reconciles them.
// Staging is an ephemeral Orca worktree from main, stamped starci:supervisor-staging:sup-<job>;sup=<job>.
// Always use its RECORDED path, branch, base and Orca id for landing/GC; removeOrcaWorktree owns cleanup.
// Adaptive cap: base + one per two queued jobs, at most 10; halve under load, reduce to 1 when saturated.
// Route through the worker tier, excluding quota/circuit failures and providers that failed readiness this pass,
// for the failed job (avoidAgents), or READINESS_FAILS_PER_HOUR times in the last hour.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { allocationMs, loadConfig } from '../../engine/config.mjs';
import {
  SKILL_ROOT, FIX_KIND, WORKER_TITLE_PREFIX, readSupervisor,
  supervisorEvent, supervisorSettings, productRepos, supervisorLog,
} from '../machine/home.mjs';
import { openMachine, starciLocalRoot } from '../../engine/db/machine.mjs';
import { createOrcaWorktree, removeOrcaWorktree, orcaWorktreeClient } from '../machine/worktree-orca.mjs';
import { ci } from '../api/npm/ci.mjs'; import { underHostLockWaiting } from './land-lock.mjs';
import { machineLoad } from '../machine/host-resources.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { catFile } from '../api/git/cat-file.mjs'; import { cherry as gitCherry } from '../api/git/cherry.mjs'; import { cherryPick } from '../api/git/cherry-pick.mjs'; import { commitTree } from '../api/git/commit-tree.mjs'; import { config as gitConfig } from '../api/git/config.mjs'; import { diff as gitDiff } from '../api/git/diff.mjs'; import { hook as gitHook } from '../api/git/hook.mjs'; import { log as gitLog } from '../api/git/log.mjs'; import { lsFiles } from '../api/git/ls-files.mjs'; import { mergeBaseQuery } from '../api/git/merge-base-query.mjs'; import { mergeTree } from '../api/git/merge-tree.mjs'; import { push as gitPush } from '../api/git/push.mjs'; import { remote as gitRemote } from '../api/git/remote.mjs'; import { revList } from '../api/git/rev-list.mjs'; import { revParseQuery } from '../api/git/rev-parse-query.mjs'; import { show as gitShow } from '../api/git/show.mjs'; import { statusQuery } from '../api/git/status-query.mjs'; import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs'; const SUPERVISOR_GIT = { 'cat-file': catFile, cherry: gitCherry, 'cherry-pick': cherryPick, 'commit-tree': commitTree, config: gitConfig, diff: gitDiff, hook: gitHook, log: gitLog, 'ls-files': lsFiles, 'merge-base': mergeBaseQuery, 'merge-tree': mergeTree, push: gitPush, remote: gitRemote, 'rev-list': revList, 'rev-parse': revParseQuery, show: gitShow, status: statusQuery, 'symbolic-ref': symbolicRefQuery };
import { posixPath } from '../lib/path-key.mjs';
import { guardLaunch, bindGuardTerminal } from '../guards/hook-install.mjs';
import { outageInText } from '../agent/provider-outage.mjs';
import { recordWorkerLaunch, workerAttemptAgent, setJob, workerTerminalClosed, closeWorkerTerminalState } from './worker-state.mjs';
import { recordWorkerReport, resolveReportCommit } from './workers-report.mjs';
import { startWorkerAgent } from '../agent/start-worker.mjs'; import { isMain } from '../lib/is-main.mjs';
import { slugify } from '../lib/slug.mjs'; import { withoutSeatEnv } from '../lib/seat-env.mjs';
import { runWorkersCli } from './workers-cli.mjs';
import { pickWorkerPool } from './worker-pool.mjs';
import { tierMembers, tierOfSeat, tierSettings } from '../agent/tiers.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { draftText } from '../lib/orca-terminal.mjs';
import { classifyAgentScreen, exitedAgentPromptRow, frameWithDraft, wakeDeliveryOf } from '../lib/terminal-liveness.mjs';
import { sendEnterWithProof } from '../kernel/wake-delivery.mjs';
export { pickWorkerPool };

/**
 * Bind the common command guard to the worker, with absolute leased paths in its staging checkout.
 * Directory leases cover their subtrees; empty/relative ownership refuses commits (PATH_NOT_OWNED).
 * The guard refuses dependency installs through junctions (DEPS_THROUGH_LINK). No history hook
 * (repos []): linked worktrees share the live runtime's hooks, which would block land cleanup.
 */
export function workerGuard(jobId, { root = SKILL_ROOT, staging = null, files = [], launch = guardLaunch } = {}) {
  try {
    const owned = staging ? (files ?? []).filter(Boolean).map((f) => path.resolve(staging, String(f).replace(/[\\/]\*\*[\\/]?$/, '') || '.')) : [];
    return launch({ skillRoot: root, jobId, workflowId: 'supervisor', ledgerRepo: null, owned, repos: [] });
  } catch (error) { return { receipt: { error: String(error?.message ?? error) } }; }
}

export const OPEN_STATUSES = Object.freeze(['queued', 'spawning', 'running', 'reported']);
const ACTIVE_STATUSES = Object.freeze(['spawning', 'running']);
const FINAL_STATUSES = Object.freeze(['succeeded', 'failed', 'cancelled']);
/** sup_attempts.agent is one of these (runtime schema CHECK); any other provider is recorded as null. */
const MAX_SPAWN_ATTEMPTS = 3;
export const READINESS_FAILS_PER_HOUR = 2;
const PROMPT_FILE = path.join(SKILL_ROOT, 'modules', 'supervisor', 'worker-prompt.md');
const parse = parseJsonOr;
const csv = (v) => { if (typeof v === 'string') { return v.split(',').map((s) => s.trim()).filter(Boolean); } if (Array.isArray(v)) { return v.map(String); } return []; };
export const normPath = (p) => posixPath(p).replace(new RegExp(['/', '+', '$'].join('')), '');

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
  if (!row) { return null; }
  const payload = parse(row.payload_json);
  const { terminal_handle: handle, ...rest } = row; delete rest.payload_json; delete rest.files_json;
  let workerId = handle ?? null;
  if (payload.self) { workerId = row.attempt_id != null ? 'supervisor' : null; }
  return { ...rest, payload, result: payload.result ?? null, worker_id: workerId };
}
export const jobsOf = (m, statuses = null) => { const statusFilter = statuses ? `AND j.status IN (${statuses.map(() => '?').join(',')})` : ''; return m.db.prepare(`${JOB_SELECT} WHERE j.kind=? ${statusFilter} ORDER BY j.created_at, j.job_id`).all(FIX_KIND, ...(statuses ?? [])).map(rowJob); };
export const jobOf = (m, jobId) => rowJob(m.db.prepare(`${JOB_SELECT} WHERE j.job_id=?`).get(jobId));
/** Physically held terminals, including finished jobs without closure proof; dedupe/GC treat these as owned. */
export const openWorkerHandles = (m) => new Set(jobsOf(m)
  .filter((j) => !j.payload.self && j.worker_id && !workerTerminalClosed(j)).map((j) => j.worker_id));
/** The job's newest report: the sup_reports row with `report` parsed, or null. */
export const reportOf = (m, jobId) => { const r = m.db.prepare('SELECT * FROM sup_reports WHERE job_id=? ORDER BY report_id DESC LIMIT 1').get(jobId); return r ? { ...r, report: parse(r.report_json) } : null; };

/** The job's latest attempt id; a job that never spawned (a status set by hand) gets an empty one. */
function attemptIdOf(m, jobId) {
  return m.latestSupAttempt(jobId)?.attempt_id ?? m.startSupAttempt({ jobId }).attemptId;
}

// The grammar npm CHANGELOG uses the declared union merge. Every other owned path participates in leases.
const SHARED_APPEND_FILES = new Set(['packages/grammar/CHANGELOG.md']);
const leasable = (files) => files.map(normPath).filter((f) => !SHARED_APPEND_FILES.has(f));

/** Leases other open jobs hold on any of `files`: [{file, jobId}]. */
export function leaseConflicts(m, files, jobId = null) {
  const keys = leasable(files);
  if (!keys.length) return [];
  return m.db.prepare(`SELECT path, job_id FROM sup_leases WHERE expires_at>=? AND path IN (${keys.map(() => '?').join(',')})`)
    .all(m.now(), ...keys).filter((r) => r.job_id !== jobId).map((r) => ({ file: r.path, jobId: r.job_id }));
}

/** Create the job of one cluster; an open job of the same cluster is returned instead (one worker per cluster). */
export function createJob(m, { cluster, title, files = [], incidents = [], specs = [], brief = '', agent = null, self = false, now = Date.now() }) {
  if (!cluster) throw new Error('a job needs --cluster <id>');
  if (!files.length) throw new Error('a job needs --files <csv>: the explicit file leases');
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

// Long-lived leases still expire for dead workers (modules/models/runtimes.yaml allocation.workerJobs.leaseTtlMs).
export const WORKER_LEASE_TTL_MS = allocationMs('workerJobs.leaseTtlMs');
/** The job's file leases (sup_leases; SHARED_APPEND_FILES stay unleased). {ok} or {ok:false, conflicts}. */
const takeLeases = (m, job) => m.acquireSupLeases(job.job_id, leasable(job.payload.files), { ttlMs: WORKER_LEASE_TTL_MS });
export const releaseLeases = (m, jobId) => m.releaseSupLeases(jobId);

/* ------------------------------------------------------------ staging */

/** The registry kind of a [Worker] staging checkout (scripts/machine/worktree-registry.mjs ORCA_KINDS). */
export const STAGING_KIND = 'supervisor-staging';
/** The Orca worktree name of a job's staging checkout; Orca derives the branch from it (the receipt is what counts). */
export const stagingNameOf = (jobId) => `sup-${jobId}`;
const branchDeleteMode = (branch, landed) => {
  if (!branch) return null;
  return landed ? 'force' : 'merged';
};

/**
 * Create/register an Orca staging checkout from main, install its own dependencies (never a junction),
 * and copy the owner config. Returns {ok, path, branch, base, orcaId} or {ok:false, reason, code, error}.
 */
export function createStaging({ jobId, root = SKILL_ROOT, env = process.env, orca = orcaWorktreeClient, install = ci, lockDeps = {} }) {
  const made = createOrcaWorktree({ repoRoot: root, kind: STAGING_KIND, name: stagingNameOf(jobId), base: 'main', owner: { lane: jobId }, env, orca });
  if (!made.ok) return { ok: false, reason: made.reason, code: 'WORKER_STAGING_CREATE_FAILED', error: `${made.reason}: ${made.detail ?? ''}`.trim() };
  if (!made.branch || !made.head) {
    // The land gate cherry-picks from the recorded branch above the recorded base: a receipt without them is useless.
    removeOrcaWorktree({ repoRoot: root, orcaId: made.id, dir: made.path, env, orca });
    return { ok: false, reason: 'orca-worktree-create-failed', code: 'WORKER_STAGING_CREATE_FAILED', error: `orca worktree create reported no ${made.branch ? 'head' : 'branch'} for ${made.path}` };
  }
  const deps = fs.existsSync(path.join(made.path, 'package-lock.json')) ? underHostLockWaiting({ purpose: 'npm-ci', env, deps: lockDeps }, () => install(made.path, { env: withoutSeatEnv(env) })) : { ok: true }; // under the host lock like every dependency install (waited for, bounded): the caller then owns the lock its install policy asks for. The install is the runtime's own work, never the seat's: it runs without the seat identity the spawn process shares (scripts/lib/seat-env.mjs), so a postinstall the PATH shim inspects binds no role (the spawn loop's worker-start can leave the shim on PATH for the next job).
  if (!deps.ok) {
    removeOrcaWorktree({ repoRoot: root, orcaId: made.id, dir: made.path, env, orca });
    return { ok: false, reason: 'staging-install-failed', code: 'WORKER_STAGING_CREATE_FAILED', error: `npm ci in the staging checkout failed (exit ${deps.status ?? 'unknown'}): ${String(deps.stderr ?? deps.detail ?? '').slice(-400)}` };
  }
  try { const cfg = path.join(root, 'config.yaml'); if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(made.path, 'config.yaml')); } catch { /* optional */ }
  return { ok: true, path: made.path, branch: made.branch, base: made.head, orcaId: made.id };
}

/** The payload.staging record of a created checkout. */
const stagingRecord = (staging) => ({ path: staging.path, branch: staging.branch, base: staging.base, orcaId: staging.orcaId });

/**
 * Idempotently remove the recorded Orca checkout, unlinking junctions and protecting main.
 * Delete its branch only when landed or empty; otherwise preserve the worker's commits.
 */
export function removeStaging({ jobId, staging, root = SKILL_ROOT, env = process.env, landed = false, orca = orcaWorktreeClient }) {
  const out = { jobId, path: staging?.path ?? null, removed: false, branchDeleted: false };
  if (!staging?.path || !staging?.orcaId) return { ...out, code: 'WORKER_STAGING_REMOVE_FAILED', error: `job ${jobId} records no Orca staging checkout (path and orcaId)` };
  const r = removeOrcaWorktree({ repoRoot: root, orcaId: staging.orcaId, dir: staging.path, branch: staging.branch ?? null,
    deleteBranch: branchDeleteMode(staging.branch, landed), env, orca });
  if (r.ok || r.reason === 'branch-delete-failed') {
    // branch-delete-failed: the tree is gone and the branch holds commits main lacks - it is kept, never forced.
    out.removed = true;
    out.branchDeleted = r.branch?.deleted === true;
    if (staging.branch && !out.branchDeleted) out.branchKept = staging.branch;
    return out;
  }
  let detail = ''; if (typeof r.detail === 'string') detail = r.detail; else if (r.detail) detail = JSON.stringify(r.detail).slice(0, 200);
  const errors = (r.errors ?? []).map((e) => `${e.code ?? ''} ${e.path ?? ''}`.trim()).join('; ');
  return { ...out, reason: r.reason, code: 'WORKER_STAGING_REMOVE_FAILED', error: [r.reason, detail, errors].filter(Boolean).join(': '),
    ...(r.fatal ? { fatal: true, damage: r.damage } : {}) };
}

/* ------------------------------------------------------------ routing */

/** The live inputs of pickWorkerPool: the worker seat's tier chain and provider health. */
export async function routeWorker({ m, prefer = null, avoid = [], config = undefined } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
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
  const settings = tierSettings({ config: cfg });
  return pickWorkerPool({ members: tierMembers(tierOfSeat('worker', settings), { settings }), availabilityOf, prefer, avoid });
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

/** Why a queued job does not launch this pass (the cap, or files another job leases): a skipped entry, else null. */
const skipOf = ({ m, cap, live }, job) => {
  if (live >= cap.cap) return { jobId: job.job_id, reason: `cap ${cap.cap} reached (${cap.reason})` };
  const conflicts = leaseConflicts(m, job.payload.files, job.job_id);
  if (conflicts.length) return { jobId: job.job_id, reason: `files leased by ${[...new Set(conflicts.map((c) => c.jobId))].join(', ')}`, conflicts };
  return null;
};

const routeJob = ({ m, deps, env, notReady }, job) => {
  const avoid = [...new Set([...notReady, ...(job.payload.avoidAgents ?? [])])];
  const prefer = job.payload.agent && !avoid.includes(job.payload.agent) ? job.payload.agent : null;
  return (deps.route ?? ((opts) => routeWorker(opts)))({ m, prefer, avoid, env });
};

/** One sup_attempts row per spawn: who (agent/model), where (staging checkout, branch, base). Returns {ok, attemptId} or the lease conflicts. */
const leaseJob = ({ m }, job, route, staging) => m.transaction(() => {
  const held = takeLeases(m, job);
  if (!held.ok) return held;
  setJob(m, job.job_id, { status: 'spawning' });
  const { attemptId } = m.startSupAttempt({ jobId: job.job_id, agent: workerAttemptAgent(route.agent), provider: route.agent ?? null,
    model: route.model ?? null, effort: route.effort ?? null, worktreePath: staging.path, branch: staging.branch, baseSha: staging.base });
  return { ok: true, attemptId };
});

/** Start the worker on its staging checkout: {spawned, guard}. */
const startJobWorker = async ({ m, deps, env, root, now }, job, route, staging) => {
  const prompt = renderWorkerPrompt(job, staging);
  const title = `${WORKER_TITLE_PREFIX} ${job.payload.cluster}`.slice(0, 80);
  const guard = (deps.guard ?? workerGuard)(job.job_id, { root, staging: staging.path, files: job.payload.files ?? [] });
  if (typeof guard.receipt?.jobFile !== 'string') supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-guard-missing', payload: { receipt: guard.receipt }, now: now() });
  const spawned = await startWorkerAgent({ route, worktree: staging.path, title, prompt,
    specFile: path.join(starciLocalRoot(env), 'supervisor', 'workers', `${job.job_id}.prompt.md`), objective: `${title} — ${job.job_id}`, entry: env.ORCA_TERMINAL_HANDLE || null,
    request: { workerJob: job.job_id, spawnAttempt: (job.payload.spawnAttempts ?? 0) + 1 }, onCreated: (handle) => { if (typeof guard.receipt?.jobFile === 'string') guard.receipt.terminal = (deps.bindGuard ?? bindGuardTerminal)({ skillRoot: root, handle, jobFile: guard.receipt.jobFile }); },
    start: deps.start ?? null, env });
  return { spawned, guard };
};

/** A failed spawn: release its leases, close its attempt, requeue (or fail) the job and remove its checkout. */
const failSpawn = (pass, { job, route, staging, leased, spawned, payload, heldUnknown }) => {
  const { m, deps, orca, env, root, now, result, notReady } = pass;
  if (heldUnknown) {
    pass.live += 1;
    result.failed.push({ jobId: job.job_id, step: spawned?.step ?? 'spawn', error: spawned?.error ?? null, effectState: spawned?.effectState ?? 'unknown', requeued: false });
    return;
  }
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
};

const markRunning = (pass, { job, route, staging, leased, spawned, payload }) => {
  const { m, now, result } = pass;
  m.transaction(() => {
    m.updateSupAttempt(leased.attemptId, { terminalHandle: spawned.terminal });
    setJob(m, job.job_id, { status: 'running', payload: { ...payload, startedAt: new Date(now()).toISOString() } });
    supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawned', payload: { terminal: spawned.terminal, dispatch: spawned.dispatchId, agent: route.agent, model: route.model, pool: route.pool, staging: staging.path }, now: now() });
  });
  pass.live += 1;
  result.launched.push({ jobId: job.job_id, terminal: spawned.terminal, agent: route.agent, model: route.model, staging: staging.path });
};

/** A dead original Dispatch ends its job as failed (not requeued): the worker exited before its Task landed. */
function failDeadSpawn(pass, job, { terminal, reason }) {
  const { m, now, result } = pass;
  m.transaction(() => {
    releaseLeases(m, job.job_id);
    m.updateSupAttempt(job.attempt_id, { cancelledAt: now(), failureClass: 'spawn:worker-exited' });
    setJob(m, job.job_id, { status: 'failed', payload: { ...job.payload, launchEffect: 'dead', result: { reason } } });
    supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawn-failed', payload: { terminal, reason }, now: now() });
  });
  result.failed.push({ jobId: job.job_id, terminal, error: reason, requeued: false });
}

/** Whether the original worker's frame shows its prompt submitted; a staged Codex paste gets one proven Enter. */
function spawnSubmitted({ job, shown, frame, terminal, deps }) {
  const prompt = renderWorkerPrompt(job, job.payload.staging), draft = draftText(frame);
  const screen = draft ? frameWithDraft(frame.screen, draft) : frame.screen;
  const state = classifyAgentScreen(screen, { sentText: prompt, provider: job.payload.agent }).state;
  if (state === 'staged-input' || state === 'queued-input') {
    return job.payload.agent === 'codex' && shown.writable === true && sendEnterWithProof({ terminal, sentText: prompt, deps }).ok;
  }
  return state === 'active' || wakeDeliveryOf({ after: screen, text: prompt }).delivery === 'delivered';
}

/** Reconcile the original Dispatch only: uncertain effects never authorize another worker. */
function reconcileSpawning(pass, job) {
  const { m, deps, root, now, result } = pass;
  if (!job.payload.dispatch) return false;
  try {
    const worker = (deps.workerShow ?? workerShow)({ dispatch: job.payload.dispatch });
    if (!worker?.ok) return false;
    const terminal = worker.dispatch?.assigneeHandle ?? worker.result?.worker?.agentTerminalHandle ?? job.worker_id;
    if (!terminal || (job.worker_id && job.worker_id !== terminal)) return false;
    m.updateSupAttempt(job.attempt_id, { terminalHandle: terminal });
    const shown = (deps.show ?? terminalShow)({ terminal });
    if (shown?.hostUnavailable) return false;
    const frame = shown?.ok && shown.connected === true ? (deps.read ?? terminalRead)({ terminal, screen: true }) : null;
    const dead = (shown?.ok && shown.connected === false) || shown?.errorCode === 'terminal_handle_stale'
      || (frame?.ok && exitedAgentPromptRow(frame.screen));
    if (dead) {
      failDeadSpawn(pass, job, { terminal, reason: shown?.exitCause ?? shown?.errorCode ?? 'agent-exited' });
      return true;
    }
    const effective = worker.effective;
    if (!shown?.ok || !frame?.ok || (effective?.agent ?? effective?.provider) !== job.payload.agent
      || (effective?.model ?? effective?.modelId) !== job.payload.model) return false;
    if (!spawnSubmitted({ job, shown, frame, terminal, deps })) return false;
    if (typeof job.payload.guard?.jobFile === 'string') (deps.bindGuard ?? bindGuardTerminal)({ skillRoot: root, handle: terminal, jobFile: job.payload.guard.jobFile });
    m.updateSupAttempt(job.attempt_id, { failureClass: null });
    markRunning(pass, { job, route: { agent: job.payload.agent, model: job.payload.model, pool: job.payload.pool },
      staging: job.payload.staging, leased: { attemptId: job.attempt_id }, spawned: { terminal, dispatchId: job.payload.dispatch },
      payload: { ...job.payload, launchEffect: 'submitted', lastSpawnError: null } });
    return true;
  } catch { return false; } // Host/read failures retain custody for the next pass.
}

/** One queued job's launch: lease check, route, staging checkout, leases, worker. Records into pass.result. */
async function launchJob(pass, job) {
  const { m, deps, orca, env, root, now, result } = pass;
  const skip = skipOf(pass, job);
  if (skip) { result.skipped.push(skip); return; }
  const route = await routeJob(pass, job);
  if (route.error) { result.skipped.push({ jobId: job.job_id, reason: route.error, routeSkipped: route.skipped }); return; }
  if (pass.dryRun) { result.launched.push({ jobId: job.job_id, wouldLaunch: true, agent: route.agent, model: route.model, pool: route.pool }); pass.live += 1; return; }
  const staging = (deps.staging ?? createStaging)({ jobId: job.job_id, root, env, orca });
  if (!staging.ok) { result.failed.push({ jobId: job.job_id, step: 'staging', code: staging.code ?? 'WORKER_STAGING_CREATE_FAILED', error: staging.error }); return; }
  const leased = leaseJob(pass, job, route, staging);
  if (!leased.ok) {
    (deps.unstage ?? removeStaging)({ jobId: job.job_id, staging: stagingRecord(staging), root, env, orca });
    result.skipped.push({ jobId: job.job_id, reason: `files leased by ${[...new Set(leased.conflicts.map((c) => c.holder))].join(', ')}` });
    return;
  }
  const { spawned, guard } = await startJobWorker(pass, job, route, staging);
  const { payload, heldUnknown } = recordWorkerLaunch({ m, job, route, spawned, staging: stagingRecord(staging), attemptId: leased.attemptId, guard, now });
  const run = { job, route, staging, leased, spawned, payload, heldUnknown };
  if (spawned?.ok) markRunning(pass, run);
  else if (!heldUnknown || !reconcileSpawning(pass, jobOf(m, job.job_id))) failSpawn(pass, run);
}

/**
 * Reconcile uncertain Dispatches before counting the cap, then launch queued jobs on leased Orca staging trees.
 * Proven no-effect failures release staging/leases and requeue up to MAX_SPAWN_ATTEMPTS; unknown effects retain custody.
 * `deps`: {start, bindGuard, route, load, staging, unstage, orca, workerShow, show, read, send, sleep} for specs.
 */
export async function spawnWorkers(m, { jobId = null, dryRun = false, settings = supervisorSettings(), deps = {}, env = process.env, root = SKILL_ROOT, now = Date.now } = {}) {
  const orca = deps.orca ?? orcaWorktreeClient;
  const result = { cap: null, launched: [], skipped: [], failed: [] };
  if (!dryRun) for (const job of jobsOf(m, ['spawning']).filter(j => !j.payload.self && (!jobId || j.job_id === jobId))) {
    reconcileSpawning({ m, deps, root, now, result, live: 0 }, job);
  }
  const queuedJobs = jobsOf(m, ['queued']).filter((j) => !j.payload.self && (!jobId || j.job_id === jobId));
  const running = jobsOf(m, ACTIVE_STATUSES).filter((j) => !j.payload.self).length;
  const load = (deps.load ?? machineLoad)();
  const cap = adaptiveCap({ base: settings.workers.base, max: settings.workers.max, queued: queuedJobs.length, running, load });
  result.cap = cap;
  // Providers whose worker terminal failed readiness this pass, or READINESS_FAILS_PER_HOUR times in the hour.
  const notReady = new Set(readinessFailedProviders(m, { since: now() - 3_600_000 }));
  const pass = { m, dryRun, deps, env, root, now, orca, cap, result, notReady, live: running };
  await eachInOrder(queuedJobs, (job) => launchJob(pass, job));
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
 * Release the Supervisor's worker Dispatch and record physical closure only with workerClosureProven.
 * Unproven closure retains openWorkerHandles custody for tick GC to retry; detached verification is pending.
 * Self jobs, absent terminals and already proven closures return null. `close` is the closeSelfSafe seam.
 */
export function closeWorkerTerminal(m, options = {}) {
  return closeWorkerTerminalState(m, options, jobOf);
}

/** The worker files its report: the commit on its temp branch, the incidents it fixes, the specs that prove it. */
export function fileReport(m, { jobId, outcome, commit = null, specs = [], summary = '', needs = [], incidents = null, root = SKILL_ROOT, terminal = null, now = Date.now(), closeDeps = {} }) {
  const job = jobOf(m, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  if (!ACTIVE_STATUSES.includes(job.status)) return { ok: false, error: `job ${jobId} is ${job.status}, not running` };
  // diagnosed: a diagnosis job (the Supervisor never diagnoses with its own subagents) - the summary is the result.
  if (!['done', 'diagnosed', 'blocked', 'failed'].includes(outcome)) return { ok: false, error: 'outcome must be done, diagnosed, blocked or failed' };
  if (outcome === 'diagnosed' && !String(summary ?? '').trim()) return { ok: false, error: 'a diagnosed report carries its diagnosis in --summary (or --summary-file)' };
  const commitResult = resolveReportCommit(job, outcome, commit, root, git);
  if (commitResult.error) return { ok: false, error: commitResult.error };
  const sha = commitResult.sha;
  const report = { outcome, commit: sha, base: job.payload.staging?.base ?? null, branch: job.payload.staging?.branch ?? null,
    specs: specs.length ? specs : job.payload.specs ?? [], incidents: incidents ?? job.payload.incidents ?? [], summary, needs, terminal };
  recordWorkerReport(m, job, report, now, { attemptIdOf, releaseLeases, setJob, supervisorEvent });
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
 * Record the Supervisor's decision on a diagnosed/blocked/failed report and consume it, ending watchdog report wakes.
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
 * The running self jobs (`starci supervisor workers stage --self`) a `--commit` land just completed: a landed commit is on the
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

if (isMain(import.meta.url)) {
  try {
    await runWorkersCli({ openMachine, readSupervisor, workerBoard, supervisorSettings, jobsOf, ACTIVE_STATUSES, machineLoad, adaptiveCap,
      jobOf, reportOf, csv, createJob, spawnWorkers, supervisorLog, stageSelf, fileReport, cancelJob, ackReport, cleanupStaging });
  } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) })); process.exitCode = 1; }
}
