// scripts/reconciler/boot.mjs — the ONE way into the reconciler (DESIGN §7.7, §7.8).
//
//   starci reconciler start                             a fresh leader heartbeat (< allocation.reconciler.heartbeatStaleMs)
//                                                       -> exit 0; a draining engine or a running workers:push inside
//                                                       DRAIN_GRACE_MS -> left alone (MB-04); else stop a hung engine (alive, stale;
//                                                       its process_runs row ends killed by boot-ensure, its leader_history
//                                                       epoch released `killed`) and start one, detached, hidden,
//                                                       below-normal priority (it logs to machine.sqlite machine_logs; each
//                                                       spawn is a `reconciler.engine-spawned` row). Crash-loop guard: more
//                                                       than crashLoop.max spawns in crashLoop.windowMs -> ONE direct
//                                                       Telegram (stall-alert.mjs ownerPush) and the engine starts --safe.
//   starci reconciler stop                              stop the engine (if any)
//   starci reconciler restart                           stop the engine (if any), then ensure
//   starci reconciler status [--json]                   leader, epoch, heartbeat age, modes, queue depth, open violations
//   starci reconciler up [flags]                        bring everything up and print one checklist (start.mjs)
import '../api/process/hide-child-windows.mjs';
import path from 'node:path';
import { spawnNode } from '../api/node/spawn-node.mjs';
import { machineFileFor, pidAlive, readMachine, withMachine } from '../../engine/db/machine.mjs';
import { lockHolder, markStarting, startingHolder } from '../connectors/lib.mjs';
import { stopTree } from '../supervisor/host-health.mjs';
import { CONCERN_OWNER } from './owns.mjs';
import { translator } from '../lib/i18n.mjs';
import { driftSummary, engineDrift } from './drift.mjs';
import { CONTROLLER_NAMES, LEADER_NAME, SKILL_ROOT, START_REASON_ENV, configuredMode, reconcilerConfig, reconcilerNumbers } from './state.mjs';
import { machineUsage } from '../kernel/usage-report.mjs';
import { isMain } from '../lib/is-main.mjs';
import { reconcilerTaskScript } from '../machine/task-register.mjs';

export const ENGINE_FILE = path.join(SKILL_ROOT, 'scripts', 'reconciler', 'engine.mjs');
export { starciShimPath } from '../machine/task-register.mjs';
/**
 * MB-04: a draining engine (reload handover) or one whose workers:push child still runs is left alone this long past a
 * stale heartbeat. The engine renews its lease on its own timer while it drains, so a stale heartbeat beyond this grace
 * means a blocked event loop: then ensure stops it. 35 min > the workers:push child's 30 min timeout (controllers/workers.mjs PUSH_RUN_TIMEOUT_MS).
 */
export const DRAIN_GRACE_MS = 35 * 60_000;

/** Kinds of the machine_logs rows boot.mjs writes (actor reconciler). */
export const SPAWNED_KIND = 'reconciler.engine-spawned';
const CRASH_ALERT_KIND = 'reconciler.crash-loop-alert';
/**
 * Starts that are decisions, not crashes: an owner restart (`--restart`, `start`), a self-reload or land re-exec handover,
 * and a restart after the previous engine ended cleanly. They never count toward the crash-loop guard; only abnormal
 * exits (a hung or dead engine that ensure had to replace) do.
 */
const PLANNED_START_REASONS = Object.freeze(['owner-restart', 'start', 'self-reload', 'reload', 'handover', 'planned-restart']);
/** process_runs.exit_reason values of an engine that ended on purpose. */
const PLANNED_EXIT_REASONS = Object.freeze(['clean', 'stopped', 'reload-handover']);
export const isPlannedStart = (reason) => PLANNED_START_REASONS.includes(String(reason ?? ''));

/**
 * The leader as machine.sqlite tells it (engine_leader + its process_runs row): {holder, pid, epoch, heartbeatAt, ageMs,
 * draining, safe, pushRunning, runId, fresh}.
 */
export function leaderState({ env = process.env, now = Date.now(), numbers = reconcilerNumbers() } = {}) {
  const read = readMachine((m) => {
    const row = m.leaderOf(LEADER_NAME);
    const run = row?.process_run_id != null ? m.db.prepare('SELECT * FROM process_runs WHERE run_id=?').get(row.process_run_id) ?? null : null;
    const pushRunning = Boolean(m.db.prepare("SELECT 1 FROM engine_actions WHERE controller='workers' AND key='workers:push' AND state='running' AND epoch=? LIMIT 1").get(row?.epoch ?? -1));
    // Safe mode is read from the LIVE state, not from how the run started: the engine records every controller it forces
    // shadow as controller_modes reason 'safe mode: ...' (engine.mjs writeModes), and a self-reload keeps the process --safe.
    const safeModes = m.db.prepare(`SELECT c.controller FROM controller_modes c JOIN mode_changes h ON h.change_id=(SELECT MAX(change_id) FROM mode_changes WHERE controller=c.controller AND to_mode=c.mode)
      WHERE h.reason LIKE 'safe mode%'`).all().map((r) => r.controller);
    return { row, run, pushRunning, safeModes };
  }, null, { env });
  const { row = null, run = null, pushRunning = false, safeModes = [] } = read ?? {};
  const heartbeatAt = Math.max(Number(row?.heartbeat_at) || 0, run?.ended_at == null ? Number(run?.last_heartbeat_at) || 0 : 0) || null;
  const ageMs = heartbeatAt ? now - heartbeatAt : null;
  return {
    holder: row?.holder ?? null, pid: row?.pid ?? null, epoch: row?.epoch ?? null, heartbeatAt, ageMs,
    expiresAt: row?.expires_at ?? null, rev: row?.rev ?? null, safe: safeModes.length > 0, safeModes, runId: run?.run_id ?? null,
    exitReason: run?.exit_reason ?? null, killedBy: run?.killed_by ?? null, startReason: run?.start_reason ?? null,
    draining: Number(row?.draining) === 1 || (run?.draining_since != null && run.ended_at == null), pushRunning,
    fresh: ageMs != null && ageMs < numbers.heartbeatStaleMs,
  };
}

/** The crash-loop record from machine_logs: {starts: [spawn ms], alertedAt}. */
export function crashLoopRecord({ env = process.env, now = Date.now(), windowMs = 1_800_000 } = {}) {
  return readMachine((m) => ({
    starts: m.logs({ actor: 'reconciler', kind: SPAWNED_KIND, limit: 200 })
      // A planned start (owner restart, reload handover, restart after a clean exit) is not a crash.
      .filter((r) => !isPlannedStart(r.data?.startReason))
      .map((r) => Number(r.at)).filter((t) => now - t < windowMs).sort((a, b) => a - b),
    alertedAt: m.logs({ actor: 'reconciler', kind: CRASH_ALERT_KIND, limit: 1 })[0]?.at ?? null,
  }), { starts: [], alertedAt: null }, { env });
}

/** Prune and read the crash-loop record: {starts: [ms], alertedAt}. Pure over the record. */
export function crashLoopPlan(record, { now = Date.now(), max = 3, windowMs = 1_800_000 } = {}) {
  const starts = (Array.isArray(record?.starts) ? record.starts : []).filter((t) => Number.isFinite(t) && now - t < windowMs);
  const looping = starts.length >= max; // this start would be one more than max inside the window
  const alertDue = looping && !(Number.isFinite(record?.alertedAt) && now - record.alertedAt < windowMs);
  return { starts, looping, alertDue, alertedAt: record?.alertedAt ?? null };
}

/**
 * Spawn the engine detached and hidden (it logs to machine.sqlite; its start reason rides START_REASON_ENV). Returns the
 * pid.
 */
function spawnEngine({ safe = false, env = process.env, startReason = 'boot' } = {}) {
  const child = spawnNode([ENGINE_FILE, ...(safe ? ['--safe'] : [])], { cwd: SKILL_ROOT, env: { ...env, [START_REASON_ENV]: startReason },
    detached: true, stdio: 'ignore' });
  child.unref();
  return child.pid ?? null;
}

/** machine_logs rows / process_runs and leader_history ends of boot.mjs (best effort, never throws). */
function recordBoot(fn, { env = process.env } = {}) {
  try { return withMachine(fn, { env }); } catch { return null; }
}

/** A direct Telegram to the owner (connectors/telegram.mjs ownerPush), never through the engine. */
async function pushOwner(text, { env = process.env } = {}) {
  try {
    const { ownerPush } = await import('../connectors/telegram.mjs');
    return await ownerPush(text, { env });
  } catch (error) { return { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
}

/**
 * ensure: healthy -> nothing; a hung engine (alive, stale) -> stop its tree; then start one (safe when crash-looping).
 * Seams: leader, spawnOne, stop, push, alive. Returns {ok, action, ...}.
 */
export async function ensure({ env = process.env, now = Date.now(), numbers = reconcilerNumbers(), leader = () => leaderState({ env, now, numbers }),
  spawnOne = (opts) => spawnEngine({ ...opts, env }), reason = null, stop = (pid) => stopTree(pid), push = (text) => pushOwner(text, { env }),
  alive = pidAlive, lock = () => lockHolder('reconciler', env), starting = () => startingHolder('reconciler', env),
  record = (fn) => recordBoot(fn, { env }), starts = () => crashLoopRecord({ env, now, windowMs: numbers.crashLoop.windowMs }) } = {}) {
  const l = leader();
  if (l.fresh) return { ok: true, action: 'healthy', pid: l.pid, epoch: l.epoch, ageMs: l.ageMs };
  if (l.pid && alive(l.pid) && (l.draining || l.pushRunning) && (l.ageMs == null || l.ageMs < DRAIN_GRACE_MS))
    return { ok: true, action: l.draining ? 'draining' : 'push-running', pid: l.pid, epoch: l.epoch, ageMs: l.ageMs };
  const pending = starting();
  if (pending) return { ok: true, action: 'starting', pid: pending.pid };
  const out = { ok: true, action: 'started', stale: l.ageMs, previous: l.pid };
  stopHungEngine({ l, lock, alive, stop, record, now, out });
  const plan = crashLoopPlan(starts(), { now, max: numbers.crashLoop.max, windowMs: numbers.crashLoop.windowMs });
  const safe = plan.looping;
  if (plan.alertDue) out.alert = await recordCrashAlert(plan, numbers, push, record, now);
  // A caller-named reason (owner-restart, start) or a previous engine that ended on purpose is a planned start: never a crash.
  const planned = reason ?? (PLANNED_EXIT_REASONS.includes(l.exitReason) || l.killedBy === 'owner' ? 'planned-restart' : null);
  const startReason = startReasonOf(safe, planned, l);
  const pid = spawnOne({ safe, startReason });
  if (pid) markStarting('reconciler', pid, env);
  const startLabel = pid ? `started the engine pid ${pid}` : 'could not start the engine';
  const safetyLabel = safe ? ', safe' : '';
  record((m) => m.log({ actor: 'reconciler', kind: SPAWNED_KIND, level: pid ? 'info' : 'error', msg: `boot ensure ${startLabel} (${startReason}${safetyLabel})`,
    data: { pid, safe, startReason, previous: l.pid ?? null, staleMs: l.ageMs ?? null }, at: now }));
  return { ...out, ok: Boolean(pid), pid, safe, startReason, ...(pid ? {} : { action: 'start-failed' }) };
}

function stopHungEngine({ l, lock, alive, stop, record, now, out }) {
  const held = lock();
  if (!held?.pid || !alive(held.pid)) return;
  out.stopped = { pid: held.pid, ...stop(held.pid) };
  const heartbeat = l.ageMs == null ? 'never' : `${Math.round(l.ageMs / 1000)}s old`;
  record((m) => m.transaction(() => {
    for (const run of m.openProcessRuns({ role: 'engine' }).filter((row) => row.pid === held.pid)) m.endProcessRun(run.run_id, { exitReason: 'killed', killedBy: 'boot-ensure' });
    const row = m.leaderOf(LEADER_NAME);
    if (row && row.pid === held.pid) m.releaseLeader({ name: LEADER_NAME, epoch: row.epoch, reason: 'killed' });
    m.log({ actor: 'reconciler', kind: 'reconciler.engine-killed', level: 'warn', msg: `boot ensure stopped the hung engine pid ${held.pid} (heartbeat ${heartbeat})`,
      data: { pid: held.pid, epoch: l.epoch, heartbeatAgeMs: l.ageMs, stopped: out.stopped } });
  }));
}

async function recordCrashAlert(plan, numbers, push, record, now) {
  const minutes = Math.round(numbers.crashLoop.windowMs / 60_000);
  const alert = await push((language) => translator(language)('URGENT: the StarCi reconciler restarted {count} times in {minutes} minutes; running in safe mode (read-only). See machine_logs actor reconciler (boot.mjs --status).', { count: plan.starts.length + 1, minutes }));
  record((m) => m.log({ actor: 'reconciler', kind: CRASH_ALERT_KIND, level: 'error', msg: `crash loop: ${plan.starts.length + 1} starts in ${minutes} min; safe mode`, data: { starts: plan.starts, alert: alert ?? null }, at: now }));
  return alert;
}

function startReasonOf(safe, planned, leader) {
  if (safe) return 'crash-restart';
  if (planned != null) return planned;
  return leader.holder ? 'ensure-stale-heartbeat' : 'boot';
}

/**
 * Owner restart: stop the engine (if any), then ensure. The stop ends the engine's run `killed` by the owner and releases
 * its epoch `killed`; the new start is `owner-restart` (a planned start: never counted toward the crash-loop guard).
 * Seams: ensure options (leader, spawnOne, ...), stop, record.
 */
export async function restartEngine({ env = process.env, reason = 'owner-restart', stop = (pid) => stopTree(pid), ...seams } = {}) {
  const held = lockHolder('reconciler', env);
  const l = leaderState({ env });
  const killed = [held?.pid, l.pid && l.pid !== held?.pid && pidAlive(l.pid) ? l.pid : null].filter(Boolean);
  for (const pid of killed) stop(pid);
  // G1/G2: an owner restart ends the engine's run `killed` by the owner and releases its epoch `killed`.
  recordBoot((m) => m.transaction(() => {
    for (const run of m.openProcessRuns({ role: 'engine' }).filter((r) => killed.includes(r.pid))) m.endProcessRun(run.run_id, { exitReason: 'killed', killedBy: 'owner' });
    const row = m.leaderOf(LEADER_NAME);
    if (row && killed.includes(row.pid)) m.releaseLeader({ name: LEADER_NAME, epoch: row.epoch, reason: 'killed' });
  }), { env });
  return ensure({ env, leader: () => ({ ...leaderState({ env }), fresh: false }), lock: () => null, starting: () => null, reason, ...seams });
}

/** Owner stop: stop only the live PID named by the reconciler lock or leader, then settle its machine rows. */
export function stopEngine({ env = process.env, stop = (pid) => stopTree(pid), alive = pidAlive,
  leader = () => leaderState({ env }), lock = () => lockHolder('reconciler', env), record = (fn) => recordBoot(fn, { env }) } = {}) {
  const l = leader();
  const held = lock();
  const candidates = [...new Set([held?.pid, l?.pid].filter((pid) => Number.isInteger(pid) && pid > 0))];
  const live = candidates.filter((pid) => alive(pid));
  if (!live.length) return { ok: true, action: 'not-running', stopped: [] };
  const stopped = live.map((pid) => ({ pid, ...stop(pid) }));
  const killed = stopped.filter((item) => item.ok).map((item) => item.pid);
  if (killed.length) record((m) => m.transaction(() => {
    for (const run of m.openProcessRuns({ role: 'engine' }).filter((row) => killed.includes(row.pid)))
      m.endProcessRun(run.run_id, { exitReason: 'stopped', killedBy: 'owner' });
    const row = m.leaderOf(LEADER_NAME);
    if (row && killed.includes(row.pid)) m.releaseLeader({ name: LEADER_NAME, epoch: row.epoch, reason: 'stopped' });
  }));
  return { ok: stopped.every((item) => item.ok), action: stopped.every((item) => item.ok) ? 'stopped' : 'stop-failed', stopped };
}

/** --status: {leader, modes: {name: {configured, effective, setBy, setAt}}, drift: {modes, rev} (drift.mjs), queue, violations, actions, starts24h, usage (token meter), stateFile}. */
export function status({ env = process.env, now = Date.now(), numbers = reconcilerNumbers(), config = reconcilerConfig() } = {}) {
  const out = { ok: true, stateFile: machineFileFor(env), leader: leaderState({ env, now, numbers }), enabled: config.enabled, modes: {}, queue: {}, queueDepth: 0,
    violations: { open: 0 }, actions: {}, concerns: {}, starts24h: 0 };
  let effective = {}, setBy = {}, setAt = {};
  try {
    readMachine((m) => {
      for (const r of m.db.prepare('SELECT controller, mode, set_by, set_at FROM controller_modes').all()) { effective[r.controller] = r.mode; setBy[r.controller] = r.set_by; setAt[r.controller] = Number(r.set_at) || 0; }
      for (const r of m.db.prepare('SELECT controller, COUNT(*) AS n, SUM(CASE WHEN tries>0 THEN 1 ELSE 0 END) AS failing FROM engine_queue GROUP BY controller').all()) {
        out.queue[r.controller] = { queued: Number(r.n), failing: Number(r.failing) || 0 };
        out.queueDepth += Number(r.n);
      }
      out.violations.open = Number(m.db.prepare('SELECT COUNT(*) AS n FROM v_sla_open WHERE violated_at IS NOT NULL').get().n) || 0;
      out.violations.clocks = Number(m.db.prepare('SELECT COUNT(*) AS n FROM v_sla_open').get().n) || 0;
      for (const r of m.db.prepare('SELECT state, COUNT(*) AS n FROM engine_actions WHERE COALESCE(started_at,finished_at)>=? GROUP BY state').all(now - 3_600_000)) out.actions[r.state] = Number(r.n);
      out.starts24h = Number(m.db.prepare("SELECT COUNT(*) AS n FROM v_engine_starts WHERE at>=?").get(now - 86_400_000).n) || 0;
    }, null, { env });
  } catch (error) { out.ok = false; out.error = String(error?.message ?? error).slice(0, 200); effective = {}; }
  out.usage = machineUsage({ env, now });
  for (const name of new Set([...CONTROLLER_NAMES, ...Object.keys(effective)])) out.modes[name] = { configured: configuredMode(name, config), effective: out.leader.fresh ? effective[name] ?? 'off' : 'off', setBy: setBy[name] ?? null, setAt: setAt[name] ?? null };
  for (const [concern, owner] of Object.entries(CONCERN_OWNER)) out.concerns[concern] = out.leader.fresh && out.modes[owner]?.effective === 'active';
  out.drift = engineDrift({ leader: out.leader, modes: out.modes, now });
  return out;
}

/** `boot.mjs --status` token lines: 24 h and all-time tokens per model across every ledger and the Supervisor seat. */
const usageLines = (u) => {
  if (!u?.total) return [];
  const cost = (t) => (t.costUsd == null ? '' : ` ${t.costUsd}`);
  const modelUsage = u.byModel.slice(0, 4).map((m) => `${m.model} ${m.tokens.toLocaleString('en-US')}`).join(', ') || 'no usage recorded yet';
  const lines = [`  tokens ${u.total.tokens.toLocaleString('en-US')} all-time, ${u.window.tokens.toLocaleString('en-US')} in 24h${cost(u.total)}; supervisor seat ${(u.supervisor?.tokens ?? 0).toLocaleString('en-US')}; ${modelUsage}`];
  for (const l of u.ledgers) if (!l.error && (l.total.tokens || l.unavailableAttempts || l.pendingAttempts)) {
    const unavailable = l.unavailableAttempts ? `; ${l.unavailableAttempts} attempt(s) unavailable` : '';
    const pending = l.pendingAttempts ? `; ${l.pendingAttempts} pending` : '';
    lines.push(`    ${l.name}: ${l.total.tokens.toLocaleString('en-US')} (attempts ${l.attempts.tokens.toLocaleString('en-US')}, kernels ${l.kernel.tokens.toLocaleString('en-US')})${unavailable}${pending}`);
  }
  return lines;
};

const describeStatus = (s) => {
  const l = s.leader;
  let state = 'NOT RUNNING';
  if (l.fresh) state = 'RUNNING';
  else if (l.holder) state = 'STALE';
  const heartbeat = l.ageMs == null ? 'never' : `${Math.round(l.ageMs / 1000)}s ago`;
  const modes = Object.entries(s.modes).map(([n, m]) => {
    const configured = m.configured !== m.effective ? `(cfg ${m.configured})` : '';
    return `${n}=${m.effective}${configured}`;
  }).join(' ');
  const queue = Object.entries(s.queue).map(([c, q]) => {
    const failing = q.failing ? `/${q.failing} failing` : '';
    return `${c} ${q.queued}${failing}`;
  }).join(', ') || 'empty';
  const drift = driftSummary(s.drift);
  const lines = [...(drift ? [`[reconciler] ${drift}`] : []), `[reconciler] ${state}${l.safe ? ' (safe mode)' : ''}: leader ${l.holder ?? '-'} pid ${l.pid ?? '-'} epoch ${l.epoch ?? '-'} heartbeat ${heartbeat}`,
    `  enabled ${s.enabled}; modes ${modes}`,
    `  queue ${s.queueDepth} (${queue}); open violations ${s.violations.open}; actions 1h ${Object.entries(s.actions).map(([k, n]) => k + ' ' + n).join(', ') || 'none'}; engine starts 24h ${s.starts24h}`,
    `  owned concerns: ${Object.entries(s.concerns).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none (every old loop keeps its duties)'}`,
    ...usageLines(s.usage),
    `  state ${s.stateFile}`];
  return lines.join('\n');
};

/** The PowerShell that registers StarCi-Reconciler through the per-user starci shim. Pure. */
export function taskScript({ starci, workdir = SKILL_ROOT, every = 5 } = {}) {
  return reconcilerTaskScript({ starci, workdir, everyMinutes: every });
}

function printBootStatus(json) {
  const value = status();
  console.log(json ? JSON.stringify(value) : describeStatus(value));
}

async function startReconcilerUp(argv) {
  const { main: start } = await import('./start.mjs');
  await start(argv.filter((argument) => argument !== '--up' && argument !== 'up'));
}

function stopReconciler(json) {
  const result = stopEngine();
  const stopped = result.stopped.length ? ` pid ${result.stopped.map((item) => item.pid).join(', ')}` : '';
  console.log(json ? JSON.stringify(result) : `[reconciler boot] ${result.action}${stopped}`);
  process.exitCode = result.ok ? 0 : 1;
}

async function restartReconciler(json) {
  const result = await restartEngine();
  const safe = result.safe ? ' SAFE' : '';
  console.log(json ? JSON.stringify(result) : `[reconciler boot] restart: ${result.action} pid ${result.pid ?? '-'}${safe}`);
  process.exitCode = result.ok ? 0 : 1;
}

async function ensureReconciler(json) {
  const result = await ensure();
  const pid = result.pid ? ` pid ${result.pid}` : '';
  const safe = result.safe ? ' SAFE MODE' : '';
  const heartbeat = result.ageMs != null ? ` heartbeat ${Math.round(result.ageMs / 1000)}s` : '';
  console.log(json ? JSON.stringify(result) : `[reconciler boot] ${result.action}${pid}${safe}${heartbeat}`);
  process.exitCode = result.ok ? 0 : 1;
}

export async function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  if (argv.includes('--status')) {
    printBootStatus(json);
    return;
  }
  if (argv.includes('--up') || argv[0] === 'up') { await startReconcilerUp(argv); return; }
  if (argv.includes('--stop')) {
    stopReconciler(json);
    return;
  }
  if (argv.includes('--restart')) {
    await restartReconciler(json);
    return;
  }
  await ensureReconciler(json);
}

if (isMain(import.meta.url)) await main();
