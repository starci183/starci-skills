#!/usr/bin/env node
// workers.mjs — [Worker] fix agents, spawned on demand by the one [Supervisor] (modules/supervisor/supervise.yaml
// workers, docs/supervisor.md). One job per root-cause cluster, never one per incident.
//
//   node scripts/supervisor/workers.mjs create --cluster <id> --title <t> --files <csv> [--incidents <csv>]
//        [--specs <csv>] [--brief <text> | --brief-file <f>] [--agent <claude|codex|devin|qwen>]
//   node scripts/supervisor/workers.mjs spawn [--job <id>] [--dry-run]     launch queued jobs up to the cap
//   node scripts/supervisor/workers.mjs stage --self --name <slug> --files <csv>   the Supervisor's own checkout
//   node scripts/supervisor/workers.mjs report --job <id> --outcome done|diagnosed|blocked|failed [--commit <sha>]
//        [--specs <csv>] [--summary <t>] [--needs <csv>]                  (the worker's last act)
//   node scripts/supervisor/workers.mjs list | cap | show --job <id> | cancel --job <id> [--reason <t>]
//   node scripts/supervisor/workers.mjs cleanup [--job <id>]                remove finished staging checkouts
//   ... [--json]
//
// Lifecycle (the supervisor ledger, scripts/supervisor/home.mjs): queued -> running (staging checkout + file
// leases + [Worker] terminal) -> reported (report filed) -> succeeded (landed by scripts/supervisor/land.mjs,
// checkout removed) | failed | cancelled. The staging checkout is an EPHEMERAL git worktree of the runtime on a
// temp branch sup/<job> under <supervisor home>/staging, outside the live tree (the owner-approved narrow
// exception to "main only, no worktrees"). It lives only until its commit lands (or the job is cancelled).
//
// Cap: adaptive, at most 10. base (config.yaml supervisor.workers.base, default 4) grows by one per two queued
// jobs up to max (default 10) and is halved while the machine is loaded (CPU busy >= 85% or free memory < 12%),
// down to 1 while it is saturated (CPU >= 95% or free memory < 6%).
//
// Routing: the balanced allocator over config.yaml allocation.shares (scripts/agent/models.mjs balanceDeficits),
// counting the machine's recent op dispatches (scripts/agent/balance.mjs) plus this ledger's workers, skipping a
// provider whose quota probe is dead or whose provider-health circuit is open on any product ledger, and a
// provider whose [Worker] terminal failed readiness: for the rest of that spawn pass, for the requeued job it
// failed (payload.avoidAgents), and for every job once it failed READINESS_FAILS_PER_HOUR times in the last hour.
// A card that cannot pin a model itself (no terminalFallback: qwen) launches its profile's launch.orca.command,
// as op dispatch does (scripts/route/dispatch-op.mjs): a bare `qwen` started on the host's default model, never
// showed the card's identityPattern, and every qwen worker timed out at readiness.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationMs, loadConfig, DEFAULT_ALLOCATION_WINDOW_HOURS } from '../../engine/config.mjs';
import {
  SKILL_ROOT, SUPERVISOR_WF, FIX_KIND, WORKER_TITLE_PREFIX, stagingRoot, openSupervisorLedger, withSupervisorRead,
  supervisorEvent, supervisorSettings, productRepos, supervisorLog,
} from './home.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const OPEN_STATUSES = Object.freeze(['queued', 'leased', 'running', 'reported']);
export const LIVE_STATUSES = Object.freeze(['leased', 'running', 'reported']);
export const ACTIVE_STATUSES = Object.freeze(['leased', 'running']);
export const MAX_SPAWN_ATTEMPTS = 3;
export const READINESS_FAILS_PER_HOUR = 2;
export const AGENTS = Object.freeze({ 'claude-agent': 'claude', 'codex-agent': 'codex', 'devin-agent': 'devin', 'qwen-agent': 'qwen' });
const PROMPT_FILE = path.join(SKILL_ROOT, 'modules', 'supervisor', 'worker-prompt.md');

const parse = (text, fallback = {}) => { try { return JSON.parse(text ?? '') ?? fallback; } catch { return fallback; } };
const csv = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : []);
const slug = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'fix';
export const normPath = (p) => String(p ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

/** git in `cwd`: {ok, status, stdout, stderr}. */
export function git(args, { cwd = SKILL_ROOT, input = undefined, env = undefined } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 300_000, input, env: env ?? process.env, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim(), error: r.error?.message ?? null };
}

/* ------------------------------------------------------------ cap */

/** One machine-load sample: {cpuBusy, freeMem} as fractions; CPU over `sampleMs`. */
export function machineLoad({ sampleMs = 400 } = {}) {
  const snap = () => os.cpus().reduce((a, c) => { const t = c.times; const total = t.user + t.nice + t.sys + t.idle + t.irq; return { idle: a.idle + t.idle, total: a.total + total }; }, { idle: 0, total: 0 });
  const a = snap();
  sleepSync(sampleMs);
  const b = snap();
  const total = b.total - a.total;
  return { cpuBusy: total > 0 ? Math.max(0, Math.min(1, 1 - (b.idle - a.idle) / total)) : 0, freeMem: os.freemem() / os.totalmem() };
}

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

const rowJob = (row) => (row ? { ...row, payload: parse(row.payload_json), result: parse(row.result_json, null) } : null);
export const jobsOf = (db, statuses = null) => db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND kind=? ${statuses ? `AND status IN (${statuses.map(() => '?').join(',')})` : ''} ORDER BY created_at, job_id`)
  .all(SUPERVISOR_WF, FIX_KIND, ...(statuses ?? [])).map(rowJob);
export const jobOf = (db, jobId) => rowJob(db.prepare('SELECT * FROM jobs WHERE job_id=? AND workflow_id=?').get(jobId, SUPERVISOR_WF));
/**
 * The terminals the open [Worker] jobs own: every live-status job's worker_id whose terminal is not closed yet.
 * Orca lists them under the runtime project next to the [Supervisor]; the seat dedupe and the Orca-tree check
 * treat them as owned, never as duplicates, strays or orphans.
 */
export const openWorkerHandles = (db) => new Set(jobsOf(db, LIVE_STATUSES)
  .filter((j) => !j.payload.self && j.worker_id && !j.payload.terminalClosed).map((j) => j.worker_id));
export const reportOf = (db, jobId) => { const r = db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(SUPERVISOR_WF, jobId); return r ? { ...r, report: parse(r.report_json) } : null; };

// Append-only registries every contract job adds an entry to (supervise.yaml landGate step 2). Leasing one
// serialized every contract job behind whichever held it (2026-09-24: three jobs queued 70 min on
// contract-changes.yaml alone). They are never leased: .gitattributes merges them `union` at the gate's
// cherry-pick, and the gate still parses the result.
export const SHARED_APPEND_FILES = new Set(['modules/kernel/contract-changes.yaml']);
const leasable = (files) => files.map(normPath).filter((f) => !SHARED_APPEND_FILES.has(f));

/** Leases other open jobs hold on any of `files`: [{file, jobId}]. */
export function leaseConflicts(db, files, jobId = null) {
  const keys = leasable(files).map((f) => `file:${f}`);
  if (!keys.length) return [];
  return db.prepare(`SELECT resource_key, job_id FROM leases WHERE workflow_id=? AND resource_key IN (${keys.map(() => '?').join(',')})`)
    .all(SUPERVISOR_WF, ...keys).filter((r) => r.job_id !== jobId).map((r) => ({ file: r.resource_key.slice(5), jobId: r.job_id }));
}

/** Create the job of one cluster; an open job of the same cluster is returned instead (one worker per cluster). */
export function createJob(ledger, { cluster, title, files = [], incidents = [], specs = [], brief = '', agent = null, self = false, now = Date.now() }) {
  if (!cluster) throw Error('a job needs --cluster <id>');
  if (!files.length) throw Error('a job needs --files <csv>: the explicit file leases');
  const open = jobsOf(ledger.db, OPEN_STATUSES).find((j) => j.payload.cluster === cluster);
  if (open) return { created: false, job: open };
  const jobId = `fix-${slug(cluster)}-${crypto.randomBytes(3).toString('hex')}`;
  const payload = { cluster, title: title ?? cluster, files: files.map(normPath), incidents, specs, brief, agent, self, spawnAttempts: 0 };
  ledger.transaction(() => {
    ledger.enqueueJob({ jobId, workflowId: SUPERVISOR_WF, opId: FIX_KIND, kind: FIX_KIND, role: self ? 'supervisor' : 'worker', payload, createdAt: now });
    supervisorEvent(ledger, { entityType: 'job', entityId: jobId, kind: 'worker-job-created', payload: { cluster, files: payload.files, incidents, self }, now });
  });
  return { created: true, job: jobOf(ledger.db, jobId) };
}

// How long a worker job's file leases live (modules/models/runtimes.yaml
// allocation.workerJobs.leaseTtlMs): long enough to outlive any job, so a dead
// worker's leases still free themselves.
export const WORKER_LEASE_TTL_MS = allocationMs('workerJobs.leaseTtlMs');
function takeLeases(ledger, job, token, now) {
  const ttl = now + WORKER_LEASE_TTL_MS;
  ledger.db.prepare('UPDATE jobs SET lease_token=?, updated_at=? WHERE job_id=?').run(token, now, job.job_id);
  for (const file of leasable(job.payload.files)) {
    ledger.db.prepare('INSERT OR REPLACE INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,1,?,?)')
      .run(`file:${file}`, job.job_id, SUPERVISOR_WF, job.op_id, job.attempt, job.generation, token, now, ttl);
  }
}
export const releaseLeases = (ledger, jobId) => ledger.db.prepare('DELETE FROM leases WHERE workflow_id=? AND job_id=?').run(SUPERVISOR_WF, jobId).changes;

/* ------------------------------------------------------------ staging */

export const stagingPathOf = (jobId, env = process.env) => path.join(stagingRoot(env), jobId);
export const branchOf = (jobId) => `sup/${jobId}`;

/**
 * Create the job's staging checkout: `git worktree add -b sup/<job> <staging> <base>` of the runtime, plus a
 * node_modules junction and a copy of the owner config so specs run there as they do live.
 */
export function createStaging({ jobId, root = SKILL_ROOT, env = process.env, base = null }) {
  const dir = stagingPathOf(jobId, env);
  const baseSha = base ?? git(['rev-parse', 'main'], { cwd: root }).stdout;
  if (!baseSha) return { ok: false, error: 'cannot resolve main' };
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  if (fs.existsSync(dir)) return { ok: false, error: `staging path ${dir} already exists` };
  const added = git(['worktree', 'add', '-b', branchOf(jobId), dir, baseSha], { cwd: root });
  if (!added.ok) return { ok: false, error: added.stderr || added.error || 'git worktree add failed' };
  const nm = path.join(root, 'node_modules');
  try { if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(dir, 'node_modules'), 'junction'); } catch { /* specs without deps still run */ }
  try { const cfg = path.join(root, 'config.yaml'); if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(dir, 'config.yaml')); } catch { /* optional */ }
  return { ok: true, path: dir, branch: branchOf(jobId), base: baseSha };
}

/**
 * Unlink `<dir>/node_modules` when it is a link (the junction createStaging/land make to the live one).
 * true when no link is left there; a real directory is left alone (true: it is the checkout's own).
 */
export function unlinkNodeModulesLink(dir) {
  const nm = path.join(dir, 'node_modules');
  let st;
  try { st = fs.lstatSync(nm); } catch { return true; }
  if (!st.isSymbolicLink()) return true;
  try { fs.unlinkSync(nm); } catch { try { fs.rmdirSync(nm); } catch { /* checked below */ } }
  try { fs.lstatSync(nm); return false; } catch { return true; }
}

/**
 * Remove a job's staging checkout. The temp branch goes too when its work landed (`landed`) or it holds no
 * commit beyond its base; otherwise it is kept so nothing a worker committed is lost. Idempotent.
 */
export function removeStaging({ jobId, root = SKILL_ROOT, env = process.env, landed = false, base = null }) {
  const dir = stagingPathOf(jobId, env);
  const out = { jobId, path: dir, removed: false, branchDeleted: false };
  // The node_modules junction is unlinked first (unlink removes the link, never its target) so the forced
  // removal can never walk into the live node_modules; if it cannot be unlinked nothing is removed.
  if (!unlinkNodeModulesLink(dir)) return { ...out, error: `cannot unlink ${path.join(dir, 'node_modules')}; checkout left in place` };
  if (fs.existsSync(dir)) {
    // Never `git worktree remove --force`: Git for Windows follows a junction inside the worktree and empties
    // its target (nivo-fe inc-c8fbf76aa499). safeRemoveTree unlinks every link and never descends into one;
    // the prune below drops the registration. A checkout whose registration is already gone is unregistered.
    const registered = git(['rev-parse', '--git-dir'], { cwd: dir }).ok;
    const r = safeRemoveTree(dir);
    out.removed = r.ok;
    if (!r.ok) out.error = r.errors.slice(0, 3).map((e) => `${e.code} ${e.path}: ${e.message}`).join('; ');
    else if (!registered) out.unregistered = true;
  } else out.removed = true;
  git(['worktree', 'prune'], { cwd: root });
  const branch = branchOf(jobId);
  const exists = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root }).ok;
  if (exists) {
    const ahead = base ? Number(git(['rev-list', '--count', `${base}..${branch}`], { cwd: root }).stdout) || 0 : 1;
    if (landed || ahead === 0) out.branchDeleted = git(['branch', '-D', branch], { cwd: root }).ok;
    else out.branchKept = branch;
  }
  return out;
}

/* ------------------------------------------------------------ routing */

const loadRuntimes = () => parseYaml(fs.readFileSync(path.join(SKILL_ROOT, 'modules', 'models', 'runtimes.yaml'), 'utf8'));

/** Equal weight for every pool the runtimes registry declares — the absent-shares meaning. */
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
    if (!provider) { skipped.push({ pool, reason: 'no runtimes.yaml pool' }); continue; }
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
export async function routeWorker({ db, prefer = null, avoid = [], config = undefined, env = process.env } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  // Absent owner shares = equal over every pool runtimes.yaml declares (the
  // configuredAllocationPolicy contract), never a literal pool list.
  const shares = cfg?.allocation?.shares ?? equalPoolShares(loadRuntimes());
  const windowHours = cfg?.allocation?.windowHours ?? DEFAULT_ALLOCATION_WINDOW_HOURS;
  const recent = {};
  try {
    const { recentDispatchCounts } = await import('../agent/balance.mjs');
    Object.assign(recent, recentDispatchCounts({ windowHours, machine: true, env }).counts);
  } catch { /* balance is best effort */ }
  const since = Date.now() - windowHours * 3600_000;
  for (const j of jobsOf(db).filter((x) => x.created_at >= since && x.payload.pool)) recent[j.payload.pool] = (recent[j.payload.pool] ?? 0) + 1;
  const { providerAvailability, providerCircuitOf } = await import('../agent/models.mjs');
  let probe = null;
  try { probe = (await import('../api/quota/index.mjs')).probeQuota; } catch { probe = null; }
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

/** Providers whose [Worker] terminal failed readiness at least `min` times since `since` (supervisor ledger events). */
export function readinessFailedProviders(db, { since, min = READINESS_FAILS_PER_HOUR } = {}) {
  const counts = {};
  for (const row of db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='worker-spawn-failed' AND created_at>=?").all(SUPERVISOR_WF, since)) {
    const p = parse(row.payload_json);
    if (p.step === 'readiness' && p.agent) counts[p.agent] = (counts[p.agent] ?? 0) + 1;
  }
  return Object.keys(counts).filter((a) => counts[a] >= min);
}

/**
 * The launch command of a worker on `pool`: its profile's launch.orca.command when the agent card cannot pin a
 * model itself (no terminalFallback), else null and the card composes it. Its `--model` becomes the routed `model`.
 */
export function workerLaunchCommand({ pool, provider, model = null, modelsDir = path.join(SKILL_ROOT, 'modules', 'models') }) {
  let card, profile;
  try { card = parseYaml(fs.readFileSync(path.join(modelsDir, 'agents', `${provider}.yaml`), 'utf8')); } catch { return null; }
  if (!card || card.terminalFallback) return null;
  try { profile = parseYaml(fs.readFileSync(path.join(modelsDir, 'profiles', `${pool}.yaml`), 'utf8')); } catch { return null; }
  const orca = profile?.launch?.orca ?? {};
  if (orca.kind !== 'command-terminal' || typeof orca.command !== 'string' || !orca.command.trim()) return null;
  const command = orca.command.trim();
  return model && /--model\s+\S+/.test(command) ? command.replace(/--model\s+\S+/, `--model ${model}`) : command;
}

/* ------------------------------------------------------------ spawn */

export function renderWorkerPrompt(job, staging, { template = null, skillRoot = SKILL_ROOT } = {}) {
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
 * leases, [Worker] terminal. The terminal is created on the runtime's own Orca worktree (`root`, the registered
 * .claude project) with the agent started in the staging path (spawnAgent cwd): a staging checkout is no Orca
 * worktree, and a terminal created on it is orphaned, under no project in the sidebar. A failed launch releases
 * its leases, removes its checkout and requeues the job (failed after MAX_SPAWN_ATTEMPTS).
 * `deps`: {spawn, route, load, staging, unstage} for specs.
 */
export async function spawnWorkers(ledger, { jobId = null, dryRun = false, settings = supervisorSettings(), deps = {}, env = process.env, root = SKILL_ROOT, now = Date.now } = {}) {
  const queuedJobs = jobsOf(ledger.db, ['queued']).filter((j) => !j.payload.self && (!jobId || j.job_id === jobId));
  const running = jobsOf(ledger.db, ACTIVE_STATUSES).filter((j) => !j.payload.self).length;
  const load = (deps.load ?? machineLoad)();
  const cap = adaptiveCap({ base: settings.workers.base, max: settings.workers.max, queued: queuedJobs.length, running, load });
  const result = { cap, launched: [], skipped: [], failed: [] };
  // Providers whose worker terminal failed readiness this pass, or READINESS_FAILS_PER_HOUR times in the hour.
  const notReady = new Set(readinessFailedProviders(ledger.db, { since: now() - 3600_000 }));
  let live = running;
  for (const job of queuedJobs) {
    if (live >= cap.cap) { result.skipped.push({ jobId: job.job_id, reason: `cap ${cap.cap} reached (${cap.reason})` }); continue; }
    const conflicts = leaseConflicts(ledger.db, job.payload.files, job.job_id);
    if (conflicts.length) { result.skipped.push({ jobId: job.job_id, reason: `files leased by ${[...new Set(conflicts.map((c) => c.jobId))].join(', ')}`, conflicts }); continue; }
    const avoid = [...new Set([...notReady, ...(job.payload.avoidAgents ?? [])])];
    const prefer = job.payload.agent && !avoid.includes(job.payload.agent) ? job.payload.agent : null;
    const route = await (deps.route ?? ((opts) => routeWorker(opts)))({ db: ledger.db, prefer, avoid, env });
    if (route.error) { result.skipped.push({ jobId: job.job_id, reason: route.error, routeSkipped: route.skipped }); continue; }
    if (dryRun) { result.launched.push({ jobId: job.job_id, wouldLaunch: true, agent: route.agent, model: route.model, pool: route.pool }); live += 1; continue; }
    const staging = (deps.staging ?? createStaging)({ jobId: job.job_id, root, env });
    if (!staging.ok) { result.failed.push({ jobId: job.job_id, step: 'staging', error: staging.error }); continue; }
    const token = crypto.randomBytes(12).toString('hex');
    const at = now();
    ledger.transaction(() => {
      takeLeases(ledger, job, token, at);
      ledger.db.prepare("UPDATE jobs SET status='leased', updated_at=? WHERE job_id=?").run(at, job.job_id);
    });
    const prompt = renderWorkerPrompt(job, staging);
    const title = `${WORKER_TITLE_PREFIX} ${job.payload.cluster}`.slice(0, 80);
    const command = (deps.command ?? workerLaunchCommand)({ pool: route.pool, provider: route.agent, model: route.model });
    const spawned = (deps.spawn ?? (await import('../agent/lib.mjs')).spawnAgent)({ provider: route.agent, model: route.model, effort: route.effort, worktree: root, cwd: staging.path, title, prompt, kernel: true, dispatchId: job.job_id, command });
    const payload = { ...job.payload, pool: route.pool, agent: route.agent, model: route.model, staging: { path: staging.path, branch: staging.branch, base: staging.base },
      spawnAttempts: (job.payload.spawnAttempts ?? 0) + 1 };
    if (!spawned?.ok) {
      const exhausted = payload.spawnAttempts >= MAX_SPAWN_ATTEMPTS;
      // A requeued job keeps the agent it asked for (never the one routed to it) and never returns to a provider
      // whose terminal failed readiness for it; the rest of this pass skips that provider too.
      const notReadyHere = spawned?.step === 'readiness';
      if (notReadyHere) notReady.add(route.agent);
      const avoidAgents = notReadyHere ? [...new Set([...(job.payload.avoidAgents ?? []), route.agent])] : job.payload.avoidAgents;
      ledger.transaction(() => {
        releaseLeases(ledger, job.job_id);
        ledger.db.prepare('UPDATE jobs SET status=?, lease_token=NULL, payload_json=?, result_json=?, updated_at=? WHERE job_id=?')
          .run(exhausted ? 'failed' : 'queued', JSON.stringify({ ...payload, agent: job.payload.agent ?? null, lastAgent: route.agent,
            ...(avoidAgents ? { avoidAgents } : {}), staging: null, lastSpawnError: spawned?.error ?? 'spawn failed' }),
            exhausted ? JSON.stringify({ reason: 'spawn-failed', step: spawned?.step ?? null, error: spawned?.error ?? null }) : null, now(), job.job_id);
        supervisorEvent(ledger, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawn-failed', payload: { agent: route.agent, step: spawned?.step ?? null, error: spawned?.error ?? null, exhausted }, now: now() });
      });
      (deps.unstage ?? removeStaging)({ jobId: job.job_id, root, env, base: staging.base });
      result.failed.push({ jobId: job.job_id, step: spawned?.step ?? 'spawn', error: spawned?.error ?? null, agent: route.agent, requeued: !exhausted });
      continue;
    }
    ledger.transaction(() => {
      ledger.db.prepare("UPDATE jobs SET status='running', worker_id=?, payload_json=?, updated_at=? WHERE job_id=?")
        .run(spawned.terminal, JSON.stringify({ ...payload, startedAt: new Date(now()).toISOString() }), now(), job.job_id);
      supervisorEvent(ledger, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawned', payload: { terminal: spawned.terminal, agent: route.agent, model: route.model, pool: route.pool, staging: staging.path }, now: now() });
    });
    live += 1;
    result.launched.push({ jobId: job.job_id, terminal: spawned.terminal, agent: route.agent, model: route.model, staging: staging.path });
  }
  return result;
}


/** The Supervisor's own staging checkout: a self job (no terminal) holding leases, landed through land.mjs. */
export function stageSelf(ledger, { name, files, root = SKILL_ROOT, env = process.env, now = Date.now() }) {
  const created = createJob(ledger, { cluster: `self-${slug(name)}`, title: name, files, self: true, now });
  const job = created.job;
  if (job.status === 'running' && job.payload.staging?.path && fs.existsSync(job.payload.staging.path)) return { ok: true, reused: true, jobId: job.job_id, ...job.payload.staging };
  const conflicts = leaseConflicts(ledger.db, job.payload.files, job.job_id);
  if (conflicts.length) return { ok: false, jobId: job.job_id, error: `files leased by ${[...new Set(conflicts.map((c) => c.jobId))].join(', ')}`, conflicts };
  const staging = createStaging({ jobId: job.job_id, root, env });
  if (!staging.ok) return { ok: false, jobId: job.job_id, error: staging.error };
  const token = crypto.randomBytes(12).toString('hex');
  ledger.transaction(() => {
    takeLeases(ledger, job, token, now);
    ledger.db.prepare("UPDATE jobs SET status='running', worker_id='supervisor', payload_json=?, updated_at=? WHERE job_id=?")
      .run(JSON.stringify({ ...job.payload, staging: { path: staging.path, branch: staging.branch, base: staging.base } }), now, job.job_id);
    supervisorEvent(ledger, { entityType: 'job', entityId: job.job_id, kind: 'supervisor-staged', payload: { staging: staging.path, files: job.payload.files }, now });
  });
  return { ok: true, jobId: job.job_id, ...staging };
}

/* ------------------------------------------------------------ report, cancel, finish */

/** The worker files its report: the commit on its temp branch, the incidents it fixes, the specs that prove it. */
export function fileReport(ledger, { jobId, outcome, commit = null, specs = [], summary = '', needs = [], incidents = null, root = SKILL_ROOT, terminal = null, now = Date.now() }) {
  const job = jobOf(ledger.db, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  if (!['running', 'leased'].includes(job.status)) return { ok: false, error: `job ${jobId} is ${job.status}, not running` };
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
    specs: specs.length ? specs : job.payload.specs ?? [], incidents: incidents ?? job.payload.incidents ?? [], summary, needs };
  ledger.transaction(() => {
    ledger.db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(SUPERVISOR_WF, jobId, FIX_KIND, job.attempt, job.generation, outcome, JSON.stringify(report), terminal, now);
    ledger.db.prepare("UPDATE jobs SET status=?, updated_at=? WHERE job_id=?").run(outcome === 'done' ? 'reported' : outcome === 'diagnosed' ? 'succeeded' : 'failed', now, jobId);
    if (outcome !== 'done') {
      releaseLeases(ledger, jobId);
      ledger.db.prepare('UPDATE jobs SET result_json=? WHERE job_id=?').run(JSON.stringify({ reason: `worker-${outcome}`, summary, needs }), jobId);
    }
    supervisorEvent(ledger, { entityType: 'job', entityId: jobId, kind: 'worker-reported', payload: { outcome, commit: sha, specs: report.specs, needs }, now });
  });
  return { ok: true, jobId, outcome, commit: sha, report };
}

/** Cancel a job: leases released, checkout removed (its branch kept when it holds commits). */
export function cancelJob(ledger, { jobId, reason = 'cancelled by the Supervisor', root = SKILL_ROOT, env = process.env, now = Date.now() }) {
  const job = jobOf(ledger.db, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  if (!OPEN_STATUSES.includes(job.status) && job.status !== 'leased') return { ok: false, error: `job ${jobId} is already ${job.status}` };
  ledger.transaction(() => {
    releaseLeases(ledger, jobId);
    ledger.db.prepare("UPDATE jobs SET status='cancelled', result_json=?, updated_at=? WHERE job_id=?").run(JSON.stringify({ reason }), now, jobId);
    supervisorEvent(ledger, { entityType: 'job', entityId: jobId, kind: 'worker-cancelled', payload: { reason }, now });
  });
  const staged = job.payload.staging ? removeStaging({ jobId, root, env, base: job.payload.staging.base }) : null;
  return { ok: true, jobId, terminal: job.worker_id ?? null, staged };
}

/** Mark a landed job succeeded, release its leases and remove its checkout and temp branch. */
export function finishLanded(ledger, { jobId, landedSha, root = SKILL_ROOT, env = process.env, now = Date.now() }) {
  const job = jobOf(ledger.db, jobId);
  if (!job) return { ok: false, error: `no job ${jobId}` };
  ledger.transaction(() => {
    releaseLeases(ledger, jobId);
    ledger.db.prepare("UPDATE jobs SET status='succeeded', result_json=?, updated_at=? WHERE job_id=?").run(JSON.stringify({ landed: landedSha }), now, jobId);
    ledger.db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=?').run(now, SUPERVISOR_WF, jobId);
  });
  const staged = job.payload.staging ? removeStaging({ jobId, root, env, landed: true, base: job.payload.staging.base }) : null;
  return { ok: true, jobId, staged, terminal: job.worker_id ?? null };
}

/** Remove the checkouts of every finished job that still has one. */
export function cleanupStaging(ledger, { jobId = null, root = SKILL_ROOT, env = process.env } = {}) {
  const done = jobsOf(ledger.db, ['succeeded', 'failed', 'cancelled']).filter((j) => (!jobId || j.job_id === jobId) && j.payload.staging && fs.existsSync(stagingPathOf(j.job_id, env)));
  return done.map((j) => removeStaging({ jobId: j.job_id, root, env, landed: j.status === 'succeeded', base: j.payload.staging.base }));
}

/* ------------------------------------------------------------ listing */

const ageMin = (iso, now = Date.now()) => { const t = Date.parse(iso ?? ''); return Number.isFinite(t) ? Math.round((now - t) / 60000) : null; };

/** The worker board /status and tick.mjs print: {active:[...], queued:[...], reported:[...], recent:[...]}. */
export function workerBoard(db, { now = Date.now() } = {}) {
  const view = (j) => ({ jobId: j.job_id, status: j.status, cluster: j.payload.cluster, agent: j.payload.agent ?? null, model: j.payload.model ?? null,
    terminal: j.worker_id ?? null, self: j.payload.self === true, ageMin: ageMin(j.payload.startedAt, now) ?? Math.round((now - j.created_at) / 60000),
    files: j.payload.files, incidents: j.payload.incidents ?? [], staging: j.payload.staging?.path ?? null });
  return {
    active: jobsOf(db, ['leased', 'running']).map(view),
    queued: jobsOf(db, ['queued']).map(view),
    reported: jobsOf(db, ['reported']).map((j) => ({ ...view(j), report: reportOf(db, j.job_id)?.report ?? null })),
    recent: db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND kind=? AND status IN ('succeeded','failed','cancelled') ORDER BY updated_at DESC LIMIT 8`).all(SUPERVISOR_WF, FIX_KIND).map(rowJob).map((j) => ({ ...view(j), result: j.result })),
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
    const board = withSupervisorRead((db) => workerBoard(db), { active: [], queued: [], reported: [], recent: [] });
    const line = (j) => `  ${j.jobId} [${j.status}] ${j.cluster} ${j.agent ?? '-'} age ${j.ageMin}m${j.terminal ? ` ${j.terminal}` : ''}${j.report ? ` commit ${String(j.report.commit ?? '').slice(0, 9)}` : ''}${j.result ? ` ${JSON.stringify(j.result).slice(0, 120)}` : ''}`;
    return out(board, [`active ${board.active.length}`, ...board.active.map(line), `queued ${board.queued.length}`, ...board.queued.map(line),
      `reported (land queue) ${board.reported.length}`, ...board.reported.map(line), 'recent', ...board.recent.map(line)].join('\n'));
  }
  if (verb === 'cap') {
    const settings = supervisorSettings();
    const counts = withSupervisorRead((db) => ({ queued: jobsOf(db, ['queued']).length, running: jobsOf(db, ACTIVE_STATUSES).filter((j) => !j.payload.self).length }), { queued: 0, running: 0 });
    const cap = adaptiveCap({ ...settings.workers, ...counts, load: machineLoad() });
    return out(cap, `cap ${cap.cap} (${cap.reason}); running ${cap.running}, queued ${cap.queued}, free ${cap.free}; cpu ${Math.round(cap.load.cpuBusy * 100)}% free mem ${Math.round(cap.load.freeMem * 100)}%`);
  }
  if (verb === 'show') return out(withSupervisorRead((db) => ({ job: jobOf(db, value('job')), report: reportOf(db, value('job')) }), null));
  const ledger = openSupervisorLedger();
  try {
    if (verb === 'create') {
      let brief = value('brief') ?? '';
      if (value('brief-file')) brief = fs.readFileSync(value('brief-file'), 'utf8');
      const r = createJob(ledger, { cluster: value('cluster'), title: value('title'), files: csv(value('files')), incidents: csv(value('incidents')), specs: csv(value('specs')), brief, agent: value('agent') });
      return out({ ok: true, created: r.created, jobId: r.job.job_id, status: r.job.status }, `${r.created ? 'created' : 'exists'} ${r.job.job_id} [${r.job.status}]`);
    }
    if (verb === 'spawn') {
      const r = await spawnWorkers(ledger, { jobId: value('job'), dryRun: has('dry-run') });
      supervisorLog('workers', `spawn: ${JSON.stringify(r)}`);
      return out(r);
    }
    if (verb === 'stage') {
      if (!has('self')) return out({ ok: false, error: 'stage is the Supervisor\'s own checkout: stage --self --name <slug> --files <csv>' });
      return out(stageSelf(ledger, { name: value('name') ?? 'change', files: csv(value('files')) }));
    }
    if (verb === 'report') {
      const summary = value('summary-file') ? fs.readFileSync(value('summary-file'), 'utf8') : value('summary') ?? '';
      const r = fileReport(ledger, { jobId: value('job'), outcome: value('outcome'), commit: value('commit'), specs: csv(value('specs')), summary,
        needs: csv(value('needs')), terminal: process.env.ORCA_TERMINAL_HANDLE ?? null });
      supervisorLog('workers', `report: ${JSON.stringify(r)}`);
      return out(r);
    }
    if (verb === 'cancel') return out(cancelJob(ledger, { jobId: value('job'), reason: value('reason') ?? undefined }));
    if (verb === 'cleanup') return out(cleanupStaging(ledger, { jobId: value('job') }));
    return out({ ok: false, error: `unknown verb ${verb}` });
  } finally { ledger.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) main();
