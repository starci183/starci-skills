// scripts/reconciler/boot.mjs — the ONE way into the reconciler (DESIGN §7.7, §7.8).
//
//   node scripts/reconciler/boot.mjs [ensure]           a fresh leader heartbeat (< allocation.reconciler.heartbeatStaleMs)
//                                                       -> exit 0; a draining engine or a running fleet:push inside
//                                                       DRAIN_GRACE_MS -> left alone (MB-04); else stop a hung engine (alive, stale) and start one,
//                                                       detached, hidden, below-normal priority, logging to
//                                                       %LOCALAPPDATA%/StarCi/runtime/reconciler.log. Crash-loop guard: more
//                                                       than crashLoop.max starts in crashLoop.windowMs -> ONE direct
//                                                       Telegram (stall-alert.mjs ownerPush) and the engine starts --safe.
//   node scripts/reconciler/boot.mjs --restart          stop the engine (if any), then ensure
//   node scripts/reconciler/boot.mjs --status [--json]  leader, epoch, heartbeat age, modes, queue depth, open violations
//   node scripts/reconciler/boot.mjs --install-task [--apply]
//                                                       print (default) or create the task StarCi-Reconciler: at logon and
//                                                       every 5 minutes, conhost --headless, IgnoreNew, below-normal. Only
//                                                       the owner or the coordinator runs --apply.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lockHolder, markStarting, pidAlive, readJson, startingHolder, writeJson } from '../connectors/lib.mjs';
import { rotateLog } from '../lib/self-reload.mjs';
import { stopTree } from '../supervisor/host-health.mjs';
import { CONCERN_OWNER } from './owns.mjs';
import {
  CONTROLLER_NAMES, SKILL_ROOT, configuredMode, heartbeatFile, leaderOf, openStateReader, reconcilerConfig, reconcilerLogFile,
  reconcilerNumbers, reconcilerStateFile, startsFile,
} from './state.mjs';

export const ENGINE_FILE = path.join(SKILL_ROOT, 'scripts', 'reconciler', 'engine.mjs');
export const TASK_NAME = 'StarCi-Reconciler';
export const TASK_EVERY_MINUTES = 5;
/**
 * MB-04: a draining engine (reload handover) or one whose fleet:push child still runs is left alone this long past a
 * stale heartbeat. The engine renews its lease on its own timer while it drains, so a stale heartbeat beyond this grace
 * means a blocked event loop: then ensure stops it. 35 min > the fleet:push child's 30 min timeout (fleet.mjs PUSH_RUN_TIMEOUT_MS).
 */
export const DRAIN_GRACE_MS = 35 * 60_000;
const selfFile = fileURLToPath(import.meta.url);

/** The leader as the state DB and the heartbeat file tell it: {holder, pid, epoch, heartbeatAt, ageMs, fresh} or null. */
export function leaderState({ env = process.env, now = Date.now(), numbers = reconcilerNumbers() } = {}) {
  let row = null, error = null, pushRunning = false;
  try {
    const db = openStateReader({ env });
    if (db) { try {
      row = leaderOf(db);
      pushRunning = Boolean(db.prepare("SELECT 1 FROM actions WHERE controller='fleet' AND key='fleet:push' AND state='running' AND epoch=? LIMIT 1").get(row?.epoch ?? -1));
    } finally { db.close(); } }
  } catch (e) { error = String(e?.message ?? e).slice(0, 200); }
  const file = readJson(heartbeatFile(env)) ?? null;
  const heartbeatAt = Math.max(Number(row?.heartbeat_at) || 0, Number(file?.at) && file?.holder === row?.holder ? Number(file.at) : 0) || null;
  const ageMs = heartbeatAt ? now - heartbeatAt : null;
  return {
    holder: row?.holder ?? null, pid: row?.pid ?? null, epoch: row?.epoch ?? null, heartbeatAt, ageMs,
    expiresAt: row?.expires_at ?? null, rev: row?.rev ?? null, safe: file?.safe === true,
    draining: file?.holder === row?.holder && file?.draining === true, pushRunning,
    fresh: ageMs != null && ageMs < numbers.heartbeatStaleMs, ...(error ? { error } : {}),
  };
}

/** Prune and read the crash-loop record: {starts: [ms], alertedAt}. Pure over the file contents. */
export function crashLoopPlan(record, { now = Date.now(), max = 3, windowMs = 1_800_000 } = {}) {
  const starts = (Array.isArray(record?.starts) ? record.starts : []).filter((t) => Number.isFinite(t) && now - t < windowMs);
  const looping = starts.length >= max; // this start would be one more than max inside the window
  const alertDue = looping && !(Number.isFinite(record?.alertedAt) && now - record.alertedAt < windowMs);
  return { starts, looping, alertDue, alertedAt: record?.alertedAt ?? null };
}

/** Spawn the engine detached and hidden, stdout/stderr appended to the log. Returns the pid. */
export function spawnEngine({ safe = false, env = process.env, logFile = reconcilerLogFile(env) } = {}) {
  rotateLog(logFile);
  const fd = fs.openSync(logFile, 'a');
  try {
    const child = spawn(process.execPath, [ENGINE_FILE, ...(safe ? ['--safe'] : [])], { cwd: SKILL_ROOT, env, detached: true, stdio: ['ignore', fd, fd], windowsHide: true });
    child.unref();
    return child.pid ?? null;
  } finally { fs.closeSync(fd); }
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
  spawnOne = (opts) => spawnEngine({ ...opts, env }), stop = (pid) => stopTree(pid), push = (text) => pushOwner(text, { env }),
  alive = pidAlive, lock = () => lockHolder('reconciler', env), starting = () => startingHolder('reconciler', env) } = {}) {
  const l = leader();
  if (l.fresh) return { ok: true, action: 'healthy', pid: l.pid, epoch: l.epoch, ageMs: l.ageMs };
  if (l.pid && alive(l.pid) && (l.draining || l.pushRunning) && (l.ageMs == null || l.ageMs < DRAIN_GRACE_MS))
    return { ok: true, action: l.draining ? 'draining' : 'push-running', pid: l.pid, epoch: l.epoch, ageMs: l.ageMs };
  const pending = starting();
  if (pending) return { ok: true, action: 'starting', pid: pending.pid };
  const out = { ok: true, action: 'started', stale: l.ageMs, previous: l.pid };
  // A live lock holder with a stale heartbeat is a hung engine: stop its tree first (the lock names the reconciler).
  const held = lock();
  if (held?.pid && alive(held.pid)) {
    out.stopped = { pid: held.pid, ...stop(held.pid) };
  }
  const file = startsFile(env);
  const plan = crashLoopPlan(readJson(file), { now, max: numbers.crashLoop.max, windowMs: numbers.crashLoop.windowMs });
  const safe = plan.looping;
  if (plan.alertDue) {
    const minutes = Math.round(numbers.crashLoop.windowMs / 60_000);
    out.alert = await push((language) => (language === 'vi'
      ? `KHẨN: StarCi reconciler khởi động lại ${plan.starts.length + 1} lần trong ${minutes} phút; chạy safe mode (chỉ đọc). Xem ${reconcilerLogFile(env)}.`
      : `URGENT: the StarCi reconciler restarted ${plan.starts.length + 1} times in ${minutes} minutes; running in safe mode (read-only). See ${reconcilerLogFile(env)}.`));
  }
  const pid = spawnOne({ safe });
  if (pid) markStarting('reconciler', pid, env);
  try { writeJson(file, { starts: [...plan.starts, now], alertedAt: plan.alertDue ? now : plan.alertedAt }); } catch { /* best effort */ }
  return { ...out, ok: Boolean(pid), pid, safe, ...(pid ? {} : { action: 'start-failed' }) };
}

/** --status: {leader, modes: {name: {configured, effective}}, queue, violations, actions, stateFile}. */
export function status({ env = process.env, now = Date.now(), numbers = reconcilerNumbers(), config = reconcilerConfig() } = {}) {
  const out = { ok: true, stateFile: reconcilerStateFile(env), leader: leaderState({ env, now, numbers }), enabled: config.enabled, modes: {}, queue: {}, queueDepth: 0,
    violations: { open: 0 }, actions: {}, concerns: {} };
  let effective = {};
  try {
    const db = openStateReader({ env });
    if (db) {
      try {
        for (const r of db.prepare('SELECT controller, mode FROM modes').all()) effective[r.controller] = r.mode;
        for (const r of db.prepare('SELECT controller, COUNT(*) AS n, SUM(CASE WHEN attempts>0 THEN 1 ELSE 0 END) AS failing FROM queue GROUP BY controller').all()) {
          out.queue[r.controller] = { queued: Number(r.n), failing: Number(r.failing) || 0 };
          out.queueDepth += Number(r.n);
        }
        out.violations.open = Number(db.prepare('SELECT COUNT(*) AS n FROM sla_clocks WHERE violated_at IS NOT NULL AND cleared_at IS NULL').get().n) || 0;
        out.violations.clocks = Number(db.prepare('SELECT COUNT(*) AS n FROM sla_clocks WHERE cleared_at IS NULL').get().n) || 0;
        for (const r of db.prepare('SELECT state, COUNT(*) AS n FROM actions WHERE started_at>=? GROUP BY state').all(now - 3_600_000)) out.actions[r.state] = Number(r.n);
      } finally { db.close(); }
    }
  } catch (error) { out.ok = false; out.error = String(error?.message ?? error).slice(0, 200); effective = {}; }
  for (const name of new Set([...CONTROLLER_NAMES, ...Object.keys(effective)])) out.modes[name] = { configured: configuredMode(name, config), effective: out.leader.fresh ? effective[name] ?? 'off' : 'off' };
  for (const [concern, owner] of Object.entries(CONCERN_OWNER)) out.concerns[concern] = out.leader.fresh && out.modes[owner]?.effective === 'active';
  return out;
}

const describeStatus = (s) => {
  const l = s.leader;
  const lines = [`[reconciler] ${l.fresh ? 'RUNNING' : l.holder ? 'STALE' : 'NOT RUNNING'}${l.safe ? ' (safe mode)' : ''}: leader ${l.holder ?? '-'} pid ${l.pid ?? '-'} epoch ${l.epoch ?? '-'} heartbeat ${l.ageMs == null ? 'never' : `${Math.round(l.ageMs / 1000)}s ago`}`,
    `  enabled ${s.enabled}; modes ${Object.entries(s.modes).map(([n, m]) => `${n}=${m.effective}${m.configured !== m.effective ? `(cfg ${m.configured})` : ''}`).join(' ')}`,
    `  queue ${s.queueDepth} (${Object.entries(s.queue).map(([c, q]) => `${c} ${q.queued}${q.failing ? `/${q.failing} failing` : ''}`).join(', ') || 'empty'}); open violations ${s.violations.open}; actions 1h ${Object.entries(s.actions).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`,
    `  owned concerns: ${Object.entries(s.concerns).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none (every old loop keeps its duties)'}`,
    `  state ${s.stateFile}`];
  return lines.join('\n');
};

/** The PowerShell that registers StarCi-Reconciler (install-tick-task.ps1 pattern). Pure. */
export function taskScript({ node = process.execPath, script = selfFile, workdir = SKILL_ROOT, every = TASK_EVERY_MINUTES } = {}) {
  const q = (s) => String(s).replace(/'/g, "''");
  return [
    "$ErrorActionPreference = 'Stop'",
    "$conhost = Join-Path $env:SystemRoot 'System32\\conhost.exe'",
    `$argLine = '--headless "${q(node)}" "${q(script)}" ensure'`,
    `$action = New-ScheduledTaskAction -Execute $conhost -Argument $argLine -WorkingDirectory '${q(workdir)}'`,
    '$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name',
    `$every = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes ${every})`,
    '$logon = New-ScheduledTaskTrigger -AtLogOn -User $user',
    '$logon.Repetition = $every.Repetition',
    "$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -Priority 7 -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden",
    '$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited',
    `$task = Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger @($logon, $every) -Settings $settings -Principal $principal -Description 'StarCi reconciler: boot.mjs ensure (DESIGN 7.7)' -Force`,
    `Write-Output ("registered {0}: at logon and every ${every} minutes -> {1} {2}" -f $task.TaskName, $conhost, $argLine)`,
  ].join('\n');
}

function installTask({ apply, json }) {
  const script = taskScript();
  if (!apply) {
    const out = { ok: true, applied: false, task: TASK_NAME, powershell: script };
    console.log(json ? JSON.stringify(out) : `Would register ${TASK_NAME} (re-run with --apply to create it; the owner or the coordinator does):\n${script}`);
    return;
  }
  if (process.platform !== 'win32') { console.log(JSON.stringify({ ok: false, reason: 'not-windows' })); process.exitCode = 1; return; }
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  const out = { ok: r.status === 0, applied: true, task: TASK_NAME, output: String(r.stdout || r.stderr || '').trim().slice(0, 600) };
  console.log(json ? JSON.stringify(out) : `${out.ok ? 'created' : 'FAILED'} ${TASK_NAME}: ${out.output}`);
  if (!out.ok) process.exitCode = 1;
}

async function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  if (argv.includes('--status')) {
    const s = status();
    console.log(json ? JSON.stringify(s) : describeStatus(s));
    return;
  }
  if (argv.includes('--install-task')) { installTask({ apply: argv.includes('--apply'), json }); return; }
  if (argv.includes('--restart')) {
    const held = lockHolder('reconciler');
    if (held?.pid) stopTree(held.pid);
    const l = leaderState();
    if (l.pid && l.pid !== held?.pid && pidAlive(l.pid)) stopTree(l.pid);
    const r = await ensure({ leader: () => ({ ...leaderState(), fresh: false }), lock: () => null, starting: () => null });
    console.log(json ? JSON.stringify(r) : `[reconciler boot] restart: ${r.action} pid ${r.pid ?? '-'}${r.safe ? ' SAFE' : ''}`);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }
  const r = await ensure();
  console.log(json ? JSON.stringify(r) : `[reconciler boot] ${r.action}${r.pid ? ` pid ${r.pid}` : ''}${r.safe ? ' SAFE MODE' : ''}${r.ageMs != null ? ` heartbeat ${Math.round(r.ageMs / 1000)}s` : ''}`);
  process.exitCode = r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) await main();
