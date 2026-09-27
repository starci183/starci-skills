// tick-duties.mjs — the deterministic duties of one supervisor tick (scripts/supervisor/tick.mjs; the contract is
// modules/supervisor/supervise.yaml scheduledTick), each a decision over what it reads plus the one action that
// decision allows. Every number is modules/models/runtimes.yaml allocation.supervisorTick (tickSettings). Nothing here
// fixes code: what needs judgment becomes an alert.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { orcaAppExe, sleepSync } from '../api/orca/lib.mjs';
import { DEFAULT_WAIT_ORCA_MS, runningWorkflows, waitForOrca } from '../kernel/resume-all.mjs';
import { watchdogLogFile } from '../kernel/watchdog-log.mjs';
import { appendInbox } from '../connectors/telegram-bridge.mjs';
import { clip, clipLine } from '../lib/clip.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { apiFrontier } from './stall.mjs';
import { ownerPush } from './stall-alert.mjs';
import { SKILL_ROOT, SUPERVISOR_ID, supervisorEvent } from './home.mjs';

export const TICK_TASK = 'StarCi-Supervisor-Every30m';
export const TICK_LOCK = 'supervisor-tick';
export const TICK_STATE_SCOPE = 'supervisor-tick';
export const SAMPLE_KIND = 'supervisor-host-sample';

/** allocation.supervisorTick, every number checked: a missing or non-positive one refuses. */
export function tickSettings(allocation = allocationSettings()) {
  const t = allocation?.supervisorTick;
  const need = (dotted) => {
    const value = Number(dotted.split('.').reduce((node, key) => node?.[key], t));
    if (!Number.isFinite(value) || value <= 0) throw Error(`modules/models/runtimes.yaml allocation.supervisorTick.${dotted} must be a positive number`);
    return value;
  };
  const task = t?.statusApp?.task;
  if (typeof task !== 'string' || !task.trim()) throw Error('modules/models/runtimes.yaml allocation.supervisorTick.statusApp.task must name the status UI task');
  return {
    everyMs: need('everyMs'),
    host: { maxNode: need('host.maxNode'), maxGit: need('host.maxGit'), chainMin: need('host.chainMin'), orphanMinAgeMs: need('host.orphanMinAgeMs') },
    orca: { probeTimeoutMs: need('orca.probeTimeoutMs'), probes: need('orca.probes'), gapMs: need('orca.gapMs'), closeWaitMs: need('orca.closeWaitMs') },
    deadKernelMs: need('deadKernelMs'),
    orphanedFrontierMs: need('orphanedFrontierMs'),
    noProgressMs: need('noProgressMs'),
    statusApp: { port: need('statusApp.port'), task: task.trim(), probeTimeoutMs: need('statusApp.probeTimeoutMs') },
    alertRepeatMs: need('alertRepeatMs'),
  };
}

/** supervisorTick.everyMs in whole minutes, the task's repetition interval. */
export function tickEveryMinutes(settings = tickSettings()) {
  const minutes = settings.everyMs / 60_000;
  if (!Number.isInteger(minutes)) throw Error('modules/models/runtimes.yaml allocation.supervisorTick.everyMs must be whole minutes');
  return minutes;
}

/* ------------------------------------------------------------ orca */

const TERMINAL_LIST = path.join(SKILL_ROOT, 'scripts', 'api', 'orca', 'terminal-list.mjs');
const RESTART_ALL = path.join(SKILL_ROOT, 'scripts', 'kernel', 'restart-all.mjs');
export const ORCA_DOWN = new Set(['timeout', 'unavailable']);

/** One probe: node scripts/api/orca/terminal-list.mjs in a child, `timeoutMs` at most. 'ok'|'timeout'|'unavailable'|'error'. */
export function probeOrca({ timeoutMs, run = spawnSync } = {}) {
  const r = run(process.execPath, [TERMINAL_LIST], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  if (r.error?.code === 'ETIMEDOUT' || (r.status == null && r.signal)) return 'timeout';
  const value = parseJsonOr(String(r.stdout ?? '').trim(), null);
  if (value?.ok === true) return 'ok';
  return value?.hostUnavailable ? 'unavailable' : 'error';
}

/**
 * What the probes so far decide: 'healthy' (the last answered), 'responding-error' (Orca answered with an error: it
 * is up), 'restart' (the last `probes` probes all timed out or found no Orca), else 'probe-again'. Pure.
 */
export function orcaVerdict(results, { probes }) {
  const last = results.at(-1);
  if (last === 'ok') return 'healthy';
  if (last === 'error') return 'responding-error';
  if (results.length >= probes && results.slice(-probes).every((r) => ORCA_DOWN.has(r))) return 'restart';
  return 'probe-again';
}

const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Close the Orca app gracefully (CloseMainWindow), force what is left after closeWaitMs, launch it again. Only
 * processes whose image is the app exe are touched: the terminal daemon (Orca's daemon-host) and every terminal stay.
 */
export function restartOrcaApp({ closeWaitMs, app = orcaAppExe(), platform = process.platform, run = spawnSync } = {}) {
  if (platform !== 'win32') return { ok: false, error: 'not windows' };
  if (!app) return { ok: false, error: 'no Orca app beside the orca CLI' };
  const script = [
    `$app = ${psQuote(app)}`,
    '$mine = { @(Get-Process -Name Orca -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $app }) }',
    '$before = & $mine',
    'foreach ($p in $before) { if ($p.MainWindowHandle -ne 0) { [void]$p.CloseMainWindow() } }',
    `$deadline = (Get-Date).AddMilliseconds(${Math.round(closeWaitMs)})`,
    'while ((Get-Date) -lt $deadline -and (& $mine).Count) { Start-Sleep -Milliseconds 500 }',
    '$left = & $mine',
    '$left | Stop-Process -Force -ErrorAction SilentlyContinue',
    'Start-Process -FilePath $app',
    '@{ closed = $before.Count; forced = $left.Count } | ConvertTo-Json -Compress',
  ].join('\n');
  const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: closeWaitMs + 120_000 });
  const value = parseJsonOr(String(r.stdout ?? '').trim().split(/\r?\n/).pop(), null);
  return r.status === 0 && value ? { ok: true, app, ...value } : { ok: false, app, error: clipLine(r.stderr || r.error?.message || `exit ${r.status}`, 300) };
}

/** node scripts/kernel/restart-all.mjs --json: {ok, exit, summary}. */
export function runRestartAll({ run = spawnSync } = {}) {
  const r = run(process.execPath, [RESTART_ALL, '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true,
    timeout: allocationMs('restart.waitMs') + 600_000, maxBuffer: 64 * 1024 * 1024 });
  const value = parseJsonOr(String(r.stdout ?? '').trim().split(/\r?\n/).pop(), null);
  return { ok: r.status === 0 && value?.ok !== false, exit: r.status, summary: clip(value?.summary ?? String(r.stderr ?? '').trim(), 800) };
}

/** Probe, decide, and restart Orca when every probe failed. {verdict, results, restarted?, ready?, restartAll?}. */
export function orcaHealth({ orca, probe = probeOrca, sleep = sleepSync, restart = restartOrcaApp, waitReady = () => waitForOrca({ waitMs: DEFAULT_WAIT_ORCA_MS }), restartAll = runRestartAll }) {
  const results = [];
  for (;;) {
    results.push(probe({ timeoutMs: orca.probeTimeoutMs }));
    const verdict = orcaVerdict(results, orca);
    if (verdict === 'probe-again') { sleep(orca.gapMs); continue; }
    if (verdict !== 'restart') return { verdict, results };
    const restarted = restart({ closeWaitMs: orca.closeWaitMs });
    const ready = restarted.ok ? waitReady() : { ready: false };
    return { verdict, results, restarted, ready, restartAll: ready.ready ? restartAll() : null };
  }
}

/* ------------------------------------------------------------ status UI */

export async function statusAppUp({ port, probeTimeoutMs }, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`http://127.0.0.1:${port}/`, { redirect: 'manual', signal: AbortSignal.timeout(probeTimeoutMs) });
    return res.status < 500;
  } catch { return false; }
}

/** The status UI answers on its port, or its task is ended and run again. {up, restarted?, upAfter?, error?}. */
export async function statusAppHealth({ statusApp, up = statusAppUp, run = spawnSync, sleep = sleepSync, platform = process.platform }) {
  if (await up(statusApp)) return { up: true };
  if (platform !== 'win32') return { up: false, restarted: false, error: 'not windows' };
  run('schtasks.exe', ['/End', '/TN', statusApp.task], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  const started = run('schtasks.exe', ['/Run', '/TN', statusApp.task], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (started.status !== 0) return { up: false, restarted: false, error: clipLine(started.stderr || started.stdout || started.error?.message || `exit ${started.status}`, 200) };
  let upAfter = false;
  for (let i = 0; i < 6 && !upAfter; i += 1) { sleep(statusApp.probeTimeoutMs); upAfter = await up(statusApp); }
  return { up: false, restarted: true, upAfter };
}

/* ------------------------------------------------------------ kernels and workflows */

const ACTION = /action(?:=|":")([\w-]+)/;
export const FAILED_WATCHDOG_ACTIONS = new Set(['tick-failed', 'restart-failed']);
const NEUTRAL_ACTION = /^(?:reload|already-watched)/;

/** The trailing run of failing ticks in a watchdog log: {count, action}. Reload lines neither break nor extend it. Pure. */
export function watchdogFailStreak(text) {
  const actions = String(text ?? '').split(/\r?\n/).map((line) => ACTION.exec(line)?.[1]).filter(Boolean);
  let count = 0, action = null;
  for (let i = actions.length - 1; i >= 0; i -= 1) {
    if (NEUTRAL_ACTION.test(actions[i])) continue;
    if (!FAILED_WATCHDOG_ACTIONS.has(actions[i])) break;
    count += 1; action ??= actions[i];
  }
  return { count, action };
}

const readTail = (file, bytes = 32_768) => {
  let fd = null;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size, len = Math.min(bytes, size), buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } catch { return ''; } finally { if (fd != null) fs.closeSync(fd); }
};
const mtimeOf = (file) => { try { return fs.statSync(file).mtimeMs; } catch { return null; } };

/**
 * Running workflows whose watchdog has failed every tick for deadKernelMs: [{workflowId, repo, count, action,
 * failingMs}]. A log silent for three cadences is a dead watchdog, which poll's WATCHDOG-DEAD already reports.
 */
export function deadKernels({ workflows, deadKernelMs, now = Date.now(), cadenceMs = allocationMs('watchdogCadenceMs'), logOf = watchdogLogFile, tail = readTail, mtime = mtimeOf }) {
  const out = [];
  for (const w of workflows) {
    const file = logOf(w.workflowId);
    const at = mtime(file);
    if (at == null || now - at > 3 * cadenceMs) continue;
    const streak = watchdogFailStreak(tail(file));
    const failingMs = streak.count * cadenceMs;
    if (failingMs >= deadKernelMs) out.push({ ...w, count: streak.count, action: streak.action, failingMs });
  }
  return out;
}

/**
 * One api status read per running workflow: {workflows: [{workflowId, repo, state, causes} | {workflowId, repo, error}],
 * waits: {<queuedBecause>: n}, orphaned: [{workflowId, repo, reason}]}.
 */
export function workflowFrontiers({ repos, runningOf = runningWorkflows, frontierOf = apiFrontier }) {
  const workflows = [], waits = {}, orphaned = [];
  for (const repo of repos) {
    for (const { workflowId } of runningOf(repo)) {
      const s = frontierOf(repo, workflowId);
      if (!s?.ok) { workflows.push({ workflowId, repo, error: s?.error ?? 'status unreadable' }); continue; }
      const causes = s.frontier?.queuedCauses ?? {};
      for (const [cause, n] of Object.entries(causes)) waits[cause] = (waits[cause] ?? 0) + Number(n || 0);
      workflows.push({ workflowId, repo, state: s.frontier?.state ?? null, causes });
      if (s.frontier?.state === 'orphaned-frontier') orphaned.push({ workflowId, repo, reason: clipLine(s.frontier?.reason ?? '', 200) });
    }
  }
  return { workflows, waits, orphaned };
}

/** STALLED findings (poll digest) idle past noProgressMs whose wait nothing justifies. Pure. */
export const noProgress = (stalls, { noProgressMs }) => stalls
  .filter((f) => f.type === 'STALLED' && f.alert !== false && Number(f.idleMinutes) * 60_000 >= noProgressMs);

/* ------------------------------------------------------------ state and alerts */

export function readTickState(db) {
  const row = db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(TICK_STATE_SCOPE, SUPERVISOR_ID);
  const value = parseJsonOr(row?.value_json, {}) ?? {};
  return { alerts: value.alerts ?? {}, seen: value.seen ?? {} };
}

/**
 * Keys a tick sees now, split by whether every tick since one at least `minMs` ago saw them: {persisting, seen}. A
 * state a Kernel passes through between two moves (orphaned-frontier right after a settle) is never alerted on one
 * sighting; a key a tick does not see starts over. Pure.
 */
export function persisting(keys, seen = {}, { now = Date.now(), minMs }) {
  const next = Object.fromEntries(keys.map((key) => [key, seen[key] ?? now]));
  return { persisting: keys.filter((key) => now - next[key] >= minMs), seen: next };
}

export function writeTickState(ledger, state, { now = Date.now() } = {}) {
  ledger.db.prepare('INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(scope,key) DO UPDATE SET value_json=excluded.value_json,at=excluded.at,holder_pid=excluded.holder_pid')
    .run(TICK_STATE_SCOPE, SUPERVISOR_ID, process.pid, null, JSON.stringify(state), now);
}

/** The alerts whose key was not alerted within repeatMs, and the sent map to keep (keys older than 4 windows drop). Pure. */
export function dueAlerts(alerts, sent = {}, { now = Date.now(), repeatMs }) {
  const due = alerts.filter((a) => !(sent[a.key] != null && now - sent[a.key] < repeatMs));
  const keep = Object.fromEntries(Object.entries(sent).filter(([, at]) => now - at < 4 * repeatMs));
  for (const a of due) keep[a.key] = now;
  return { due, sent: keep };
}

const HEAD = {
  en: (n) => `🛠 StarCi supervisor tick: ${n} item(s) need judgment`,
  vi: (n) => `🛠 StarCi supervisor tick: ${n} việc cần thầy/supervisor xem`,
};

/** File one inbox item for the Supervisor and push one Telegram message. {inbox, telegram}. */
export async function sendAlerts(due, { env = process.env, now = Date.now(), inbox = appendInbox, push = ownerPush } = {}) {
  if (!due.length) return { inbox: null, telegram: null };
  const lines = due.map((a) => `- ${a.text}`);
  let filed;
  try {
    const item = inbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'supervisor-tick',
      text: `SUPERVISOR-TICK ${due.length} item(s) (judged ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')}Z; the tick fixes no code):\n${lines.join('\n')}` }, { env });
    filed = { ok: true, id: item.id };
  } catch (error) { filed = { ok: false, error: clipLine(error?.message ?? error, 200) }; }
  const telegram = await push((language) => clip([(HEAD[language] ?? HEAD.en)(due.length), ...lines].join('\n'), 3800), { env });
  return { inbox: filed, telegram };
}

/** One bottleneck sample on the supervisor ledger (events kind supervisor-host-sample). */
export const recordSample = (ledger, sample, { now = Date.now() } = {}) =>
  supervisorEvent(ledger, { entityType: 'host', entityId: 'sample', kind: SAMPLE_KIND, payload: sample, now });
