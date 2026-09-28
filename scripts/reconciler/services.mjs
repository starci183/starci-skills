#!/usr/bin/env node
// services.mjs — the ONE host-service registry of the reconciler's Host controller (DESIGN 8.4, 9.7; LANES.md Lane D).
//
// Every host service the runtime depends on is one entry {name, probe(), start(), startTimeoutMs, slaMs, backoff,
// restart}. probe() is read-only and async (a child process or an HTTP GET, never a blocking spawnSync inside the
// engine). start() does NOT act: it returns the actuator command {cmd, args}, which the controller hands to
// ctx.run, so shadow mode records it and only active mode runs it. Every actuator is this file's own CLI
// (`node scripts/reconciler/services.mjs --start <name>`), so one place starts each service.
//
// Ports and URLs are read once, from one source each (servicePorts): the harness port from runtimes.yaml
// allocation.supervisorTick.statusApp.port, the public harness hostname from ~/.cloudflared/harness.yml ingress
// (whose service port must equal that port: a mismatch is a probe failure, `port-drift`), the ask-gateway port from
// config.yaml connectors.gateway.port.
//
// The state machine of DESIGN 9.7 is stepService (pure); its rows live in the `services` table of
// ~/.starci/supervisor/reconciler.sqlite (the DESIGN 7.3 schema). The same table also holds the Host controller's
// seat rows (`seat:...`) and ledger rows (`ledger:<id>`), so `boot.mjs --status` shows everything the Host owns.
//
//   node scripts/reconciler/services.mjs --list [--json]            the rows of the services table
//   node scripts/reconciler/services.mjs --probe <name> [--json]    one read-only probe
//   node scripts/reconciler/services.mjs --start <name> [--json]    the actuator (run by ctx.run in active mode only)
//   node scripts/reconciler/services.mjs --reopen <name> [--json]   a quarantined service/seat back to `declared`
//   node scripts/reconciler/services.mjs --dedupe [--dry-run] [--json]   terminal-dedupe over config.yaml supervisor.repos
//   node scripts/reconciler/services.mjs --processes                the process table (host-health listProcesses) as JSON
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationSettings, loadConfig } from '../../engine/config.mjs';

const require = createRequire(import.meta.url);
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SERVICES_FILE = 'scripts/reconciler/services.mjs';
export const HOST_YAML = path.join(SKILL_ROOT, 'modules', 'reconciler', 'host.yaml');
export const HARNESS_TUNNEL_YML = path.join(os.homedir(), '.cloudflared', 'harness.yml');
export const RECONCILER_TASK = 'StarCi-Reconciler';

/* ------------------------------------------------------------ settings */

const positive = (value, where) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw Error(`modules/reconciler/host.yaml ${where} must be a positive number`);
  return n;
};

/** modules/reconciler/host.yaml, every number checked (a missing or non-positive one refuses). */
export function hostSettings(raw = parseYaml(fs.readFileSync(HOST_YAML, 'utf8'))) {
  const h = raw ?? {};
  const services = {};
  for (const [name, s] of Object.entries(h.services ?? {})) {
    services[name] = { ...s };
    for (const key of ['everyMs', 'probeTimeoutMs', 'failAfter', 'startTimeoutMs', 'slaMs']) services[name][key] = positive(s?.[key], `services.${name}.${key}`);
  }
  const checkers = (h.checkers ?? []).map((c, i) => {
    if (!c?.name || !c?.cmd) throw Error(`modules/reconciler/host.yaml checkers[${i}] needs name and cmd`);
    return { name: String(c.name), cmd: String(c.cmd), args: (c.args ?? []).map(String), everyMs: positive(c.everyMs ?? 300000, `checkers[${i}].everyMs`),
      probeTimeoutMs: positive(c.probeTimeoutMs ?? 60000, `checkers[${i}].probeTimeoutMs`), slaMs: positive(c.slaMs ?? 600000, `checkers[${i}].slaMs`),
      failAfter: positive(c.failAfter ?? 1, `checkers[${i}].failAfter`), startTimeoutMs: 1 };
  });
  const section = (name, keys) => Object.fromEntries(keys.map((k) => [k, positive(h?.[name]?.[k], `${name}.${k}`)]));
  const seat = (name, keys) => Object.fromEntries(keys.map((k) => [k, positive(h?.seats?.[name]?.[k], `seats.${name}.${k}`)]));
  return {
    resyncMs: positive(h.resyncMs, 'resyncMs'),
    concurrency: positive(h.concurrency, 'concurrency'),
    backoff: section('backoff', ['minMs', 'maxMs', 'factor']),
    quarantine: section('quarantine', ['maxRestarts', 'windowMs', 'retryMs']),
    services,
    checkers,
    allowTaskRepair: h.allowTaskRepair === true,
    seats: {
      kernel: seat('kernel', ['maxReplacementsPerHour', 'holdMs', 'timeoutMs', 'vacantSlaMs', 'inputSlaMs', 'gatedSlaMs', 'hostOutageSlaMs', 'quarantinedSlaMs']),
      supervisor: seat('supervisor', ['timeoutMs']),
    },
    processes: section('processes', ['everyMs', 'orphanMinAgeMs', 'orphanSlaMs', 'footprintEveryMs', 'terminalSlack', 'terminalDriftSlaMs']),
    ledgerHealth: {
      ...section('ledgerHealth', ['quickCheckEveryMs', 'keep', 'backupTimeoutMs']),
      backupHour: Number(h?.ledgerHealth?.backupHour ?? 3),
      backupDir: String(h?.ledgerHealth?.backupDir ?? 'D:/starci-archive/ledger-backups'),
    },
  };
}

/* ------------------------------------------------------------ one port source */

/** The public hostname and origin port of ~/.cloudflared/harness.yml: {hostname, originPort} (nulls when unreadable). */
export function harnessIngress(text) {
  let doc = null;
  try { doc = parseYaml(String(text ?? '')); } catch { doc = null; }
  const rule = (doc?.ingress ?? []).find((r) => r?.hostname);
  if (!rule) return { hostname: null, originPort: null };
  let originPort = null;
  try { const u = new URL(String(rule.service)); originPort = Number(u.port || (u.protocol === 'https:' ? 443 : 80)); } catch { originPort = null; }
  return { hostname: String(rule.hostname), originPort };
}

/**
 * Every port and URL a service probe or actuator uses, each read once from its one source:
 * {harnessPort, harnessUrl, harnessHostname, harnessPublicUrl, tunnelOriginPort, gatewayPort, problems}.
 * `problems` names a disagreement (the tunnel's ingress pointing at another port than the harness serves on).
 */
export function servicePorts({ allocation = null, config = null, harnessYml = null } = {}) {
  const alloc = allocation ?? allocationSettings();
  const harnessPort = Number(alloc?.supervisorTick?.statusApp?.port);
  let cfg = config;
  if (cfg == null) { try { cfg = loadConfig(); } catch { cfg = {}; } }
  const gatewayPort = Number(cfg?.connectors?.gateway?.port);
  let ymlText = harnessYml;
  if (ymlText == null) { try { ymlText = fs.readFileSync(HARNESS_TUNNEL_YML, 'utf8'); } catch { ymlText = ''; } }
  const ingress = harnessIngress(ymlText);
  const problems = [];
  if (!Number.isInteger(harnessPort) || harnessPort <= 0) problems.push('runtimes.yaml allocation.supervisorTick.statusApp.port is not a port');
  if (!Number.isInteger(gatewayPort) || gatewayPort <= 0) problems.push('config.yaml connectors.gateway.port is not a port');
  if (!ingress.hostname) problems.push(`${HARNESS_TUNNEL_YML} has no ingress hostname`);
  else if (ingress.originPort !== harnessPort) problems.push(`port-drift: ${HARNESS_TUNNEL_YML} ingress points at port ${ingress.originPort}, the harness serves on ${harnessPort}`);
  return {
    harnessPort: harnessPort || null,
    harnessUrl: harnessPort ? `http://127.0.0.1:${harnessPort}` : null,
    harnessHostname: ingress.hostname,
    harnessPublicUrl: ingress.hostname ? `https://${ingress.hostname}` : null,
    tunnelOriginPort: ingress.originPort,
    gatewayPort: gatewayPort || null,
    problems,
  };
}

/* ------------------------------------------------------------ probes (read-only, async) */

/** One async child: {status, stdout, stderr, timedOut}. Never throws. */
export function runChild(cmd, args, { timeoutMs = 60_000, env = process.env, cwd = SKILL_ROOT } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, env, timeout: timeoutMs, windowsHide: true, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      const timedOut = Boolean(error?.killed && error?.signal) || error?.code === 'ETIMEDOUT';
      resolve({ status: error ? (typeof error.code === 'number' ? error.code : null) : 0, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') || (error && !timedOut ? String(error.message) : ''), timedOut });
    });
  });
}

/** The last JSON line of a child's stdout, or null. */
export const lastJson = (text) => {
  const lines = String(text ?? '').trim().split(/\r?\n/).reverse();
  for (const line of lines) { try { const v = JSON.parse(line); if (v && typeof v === 'object') return v; } catch { /* not json */ } }
  try { return JSON.parse(String(text ?? '').trim()); } catch { return null; }
};

const node = (script, args = []) => [process.execPath, [path.join(SKILL_ROOT, script), ...args]];

/** GET url: ok while it answers below 500 (Cloudflare answers 502/530 when the origin or the tunnel is gone). */
export async function httpUp(url, { timeoutMs, fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.status < 500, status: res.status };
  } catch (error) { return { ok: false, error: String(error?.cause?.code ?? error?.name ?? error?.message ?? error).slice(0, 200) }; }
}

/** Orca answers a terminal listing: {ok, verdict: ok|timeout|unavailable|error, terminals}. */
export async function probeOrcaAsync({ timeoutMs, run = runChild } = {}) {
  const [cmd, args] = node('scripts/api/orca/terminal-list.mjs');
  const r = await run(cmd, args, { timeoutMs });
  if (r.timedOut) return { ok: false, verdict: 'timeout' };
  const value = lastJson(r.stdout);
  if (value?.ok === true) return { ok: true, verdict: 'ok', terminals: (value.terminals ?? []).length };
  return { ok: false, verdict: value?.hostUnavailable ? 'unavailable' : 'error', error: String(value?.error ?? r.stderr ?? '').slice(0, 200) };
}

/** `node scripts/connectors/<script> status` answers running (and, for the tunnel, no health problems). */
export async function connectorUp(script, { timeoutMs, run = runChild, extraArgs = [], judge = (v) => v?.running === true } = {}) {
  const [cmd, args] = node(`scripts/connectors/${script}`, ['status', ...extraArgs]);
  const r = await run(cmd, args, { timeoutMs });
  const value = lastJson(r.stdout);
  if (!value) return { ok: false, error: r.timedOut ? 'timeout' : String(r.stderr || `exit ${r.status}`).slice(0, 200) };
  return { ok: judge(value) === true, value };
}

/** schtasks /query of one task: {ok, exists, status} (status Ready|Running|Disabled|...). */
export async function taskState(name, { timeoutMs = 30_000, run = runChild, platform = process.platform } = {}) {
  if (platform !== 'win32') return { ok: false, exists: false, error: 'not windows' };
  const r = await run('schtasks.exe', ['/Query', '/TN', name, '/FO', 'CSV', '/NH'], { timeoutMs });
  if (r.status !== 0) return { ok: false, exists: false };
  const cols = String(r.stdout).trim().split(/\r?\n/)[0]?.split('","').map((c) => c.replace(/^"|"$/g, '')) ?? [];
  const status = cols[2] ?? null;
  return { ok: status != null && !/disabled/i.test(status), exists: true, status };
}

/* ------------------------------------------------------------ the registry */

/**
 * The registry: [{name, kind, probe(), start() -> {cmd, args} | null, restart, startTimeoutMs, slaMs, everyMs,
 * failAfter, ownerPath}]. `restart: false` never schedules a start (checkers; the scheduled task while
 * host.yaml allowTaskRepair is false). `ownerPath`: the owner reaches the runtime through it, so a quarantine is
 * urgent for the owner too (DESIGN 9.7). Every seam is injectable for the specs.
 */
export function serviceRegistry({ settings = hostSettings(), ports = servicePorts(), run = runChild, http = httpUp } = {}) {
  const s = settings.services;
  const startCli = (name) => ({ cmd: 'node', args: [SERVICES_FILE, '--start', name, '--json'] });
  const entry = (name, fields) => ({ name, kind: 'service', restart: true, ownerPath: false, ...s[name], ...fields, start: fields.start ?? (() => startCli(name)) });
  const portProblem = () => ports.problems.find((p) => p.startsWith('port-drift')) ?? null;
  const out = [
    entry('orca', { probe: () => probeOrcaAsync({ timeoutMs: s.orca.probeTimeoutMs, run }) }),
    entry('harness-ui', { ownerPath: true, probe: async () => {
      if (!ports.harnessUrl) return { ok: false, error: 'no harness port' };
      return http(`${ports.harnessUrl}${s['harness-ui'].probePath ?? '/'}`, { timeoutMs: s['harness-ui'].probeTimeoutMs });
    } }),
    entry('harness-tunnel', { ownerPath: true, probe: async () => {
      const drift = portProblem();
      if (drift) return { ok: false, error: drift };
      if (!ports.harnessPublicUrl) return { ok: false, error: 'no public hostname' };
      return http(`${ports.harnessPublicUrl}${s['harness-tunnel'].probePath ?? '/'}`, { timeoutMs: s['harness-tunnel'].probeTimeoutMs });
    } }),
    entry('ask-gateway', { ownerPath: true, probe: () => connectorUp('ask-gateway.mjs', { timeoutMs: s['ask-gateway'].probeTimeoutMs, run,
      judge: (v) => v.running === true && (ports.gatewayPort == null || v.port == null || Number(v.port) === ports.gatewayPort) }) }),
    entry('ask-tunnel', { ownerPath: true, probe: () => connectorUp('tunnel.mjs', { timeoutMs: s['ask-tunnel'].probeTimeoutMs, run, extraArgs: ['--fast'],
      judge: (v) => v.running === true && !(v.health?.problems ?? []).length }) }),
    // The bridge long-polls: its offset advances only when an update arrives, so liveness is the recorded pid
    // alive (status.running); the offset is kept in the probe detail for the digest.
    entry('telegram-bridge', { ownerPath: true, probe: () => connectorUp('telegram-bridge.mjs', { timeoutMs: s['telegram-bridge'].probeTimeoutMs, run }) }),
    entry(`sched-task:${RECONCILER_TASK}`, { restart: settings.allowTaskRepair,
      probe: async () => {
        const t = await taskState(RECONCILER_TASK, { timeoutMs: s[`sched-task:${RECONCILER_TASK}`].probeTimeoutMs, run });
        return t.exists || settings.allowTaskRepair ? t : { ...t, unmanaged: true };
      },
      start: () => ({ cmd: 'node', args: ['scripts/reconciler/boot.mjs', '--install-task', '--apply', '--json'] }) }),
  ];
  for (const c of settings.checkers) {
    out.push({ name: `checker:${c.name}`, kind: 'checker', restart: false, ownerPath: false, ...c, start: () => null,
      probe: async () => { const r = await run(c.cmd, c.args, { timeoutMs: c.probeTimeoutMs }); return { ok: r.status === 0, exit: r.status, timedOut: r.timedOut }; } });
  }
  return out;
}

/* ------------------------------------------------------------ the state machine (DESIGN 9.7) */

export const SERVICE_STATES = Object.freeze(['declared', 'starting', 'healthy', 'degraded', 'failed', 'backoff', 'quarantined', 'unmanaged']);
export const DOWN_STATES = new Set(['starting', 'degraded', 'failed', 'backoff', 'quarantined']);

/** Backoff before restart number n+1 (n restarts already in the window): minMs * factor^n, at most maxMs. Pure. */
export const backoffDelay = (n, { minMs, maxMs, factor }) => Math.min(maxMs, minMs * factor ** Math.max(0, n));

export const newRecord = (name, now) => ({ name, state: 'declared', since: now, restarts: [], failStreak: 0, nextAttemptAt: null, downSince: null, lastProbe: null });

/**
 * One step of a service over one probe: {rec, act: 'start'|null, quarantined: bool, from, to}. Pure: `rec` is not
 * mutated. `entry.restart` false never starts (and never quarantines: nothing restarted it).
 */
export function stepService(rec, probe, { now, entry, backoff, quarantine }) {
  const r = { ...rec, restarts: [...(rec.restarts ?? [])], lastProbe: { ok: probe?.ok === true, at: now, ...(probe?.detail ?? {}) } };
  const from = r.state;
  const to = (state) => { if (r.state !== state) { r.state = state; r.since = now; } };
  let act = null, quarantined = false;
  if (probe?.ok === true) {
    to('healthy'); r.failStreak = 0; r.downSince = null; r.nextAttemptAt = null;
    return { rec: r, act, quarantined, from, to: r.state };
  }
  if (probe?.unmanaged) { to('unmanaged'); r.failStreak = 0; r.downSince = null; return { rec: r, act, quarantined, from, to: r.state }; }
  r.downSince ??= now;
  r.failStreak = (r.failStreak ?? 0) + 1;
  switch (r.state) {
    case 'declared': case 'unmanaged': to('failed'); break;
    case 'healthy': to(r.failStreak >= entry.failAfter ? 'failed' : 'degraded'); break;
    case 'degraded': if (r.failStreak >= entry.failAfter) to('failed'); break;
    case 'starting': if (now - r.since >= entry.startTimeoutMs) to('failed'); break;
    default: break;
  }
  r.restarts = r.restarts.filter((t) => now - t < quarantine.windowMs);
  if (r.state === 'failed' && entry.restart !== false) {
    if (r.restarts.length >= quarantine.maxRestarts) { to('quarantined'); quarantined = true; }
    else { to('backoff'); r.nextAttemptAt = now + backoffDelay(r.restarts.length, backoff); }
  }
  if (r.state === 'backoff' && now >= (r.nextAttemptAt ?? 0) && from === 'backoff') {
    to('starting'); r.restarts.push(now); r.nextAttemptAt = null; act = 'start';
  } else if (r.state === 'quarantined' && !quarantined && now - r.since >= quarantine.retryMs && entry.restart !== false) {
    to('starting'); r.restarts = [now]; act = 'start';
  }
  return { rec: r, act, quarantined, from, to: r.state };
}

/* ------------------------------------------------------------ the store */

export const SERVICES_DDL = 'CREATE TABLE IF NOT EXISTS services(name TEXT PRIMARY KEY, state TEXT, since INTEGER, restarts_json TEXT, last_probe_json TEXT)';
export const reconcilerDbFile = (env = process.env) => path.join(path.resolve(env.STARCI_SUPERVISOR_HOME || path.join(os.homedir(), '.starci', 'supervisor')), 'reconciler.sqlite');

const toRow = (rec) => {
  const { name, state, since, restarts, ...rest } = rec;
  return [name, state, since, JSON.stringify(restarts ?? []), JSON.stringify(rest)];
};
const fromRow = (row) => {
  if (!row) return null;
  let extra = {}, restarts = [];
  try { extra = JSON.parse(row.last_probe_json ?? '{}') ?? {}; } catch { extra = {}; }
  try { restarts = JSON.parse(row.restarts_json ?? '[]') ?? []; } catch { restarts = []; }
  return { ...extra, name: row.name, state: row.state, since: row.since, restarts };
};

/** The `services` table of a DatabaseSync handle: {get, put, all, remove}. */
export function sqliteStore(db) {
  db.exec(SERVICES_DDL);
  return {
    get: (name) => fromRow(db.prepare('SELECT * FROM services WHERE name=?').get(name)),
    put: (rec) => { db.prepare('INSERT INTO services(name,state,since,restarts_json,last_probe_json) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET state=excluded.state, since=excluded.since, restarts_json=excluded.restarts_json, last_probe_json=excluded.last_probe_json').run(...toRow(rec)); return rec; },
    all: () => db.prepare('SELECT * FROM services ORDER BY name').all().map(fromRow),
    remove: (name) => { db.prepare('DELETE FROM services WHERE name=?').run(name); },
  };
}

/** An in-memory store with the same shape (specs). */
export function memoryStore(initial = []) {
  const m = new Map(initial.map((r) => [r.name, structuredClone(r)]));
  return { get: (n) => (m.has(n) ? structuredClone(m.get(n)) : null), put: (r) => { m.set(r.name, structuredClone(r)); return r; }, all: () => [...m.values()].map((r) => structuredClone(r)), remove: (n) => { m.delete(n); } };
}

let shared = null;
/** The reconciler state DB's services table (DESIGN 7.3), opened once per process. */
export function openServiceStore({ env = process.env } = {}) {
  if (shared) return shared;
  const { DatabaseSync } = require('node:sqlite');
  const file = reconcilerDbFile(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 15_000 });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=15000;');
  shared = sqliteStore(db);
  return shared;
}

/** A checker's published availability for the job controller: 'available' | 'unavailable' | 'unknown'. */
export function checkerAvailability(name, { store = openServiceStore() } = {}) {
  const rec = store.get(`checker:${name}`);
  if (!rec || rec.state === 'declared') return 'unknown';
  return rec.state === 'healthy' ? 'available' : 'unavailable';
}

/* ------------------------------------------------------------ actuators (the CLI; active mode only) */

const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Launch environment for a desktop host: no agent/Claude session variables (scripts/api/orca/lib.mjs hostLaunchEnv). */
export async function cleanEnv(env = process.env) {
  const { hostLaunchEnv } = await import('../api/orca/lib.mjs');
  const scrubbed = hostLaunchEnv(env);
  for (const key of Object.keys(scrubbed)) if (/^STARCI_(?:ACTOR|RECONCILER_EPOCH)$/.test(key)) delete scrubbed[key];
  return scrubbed;
}

/**
 * The Orca restart script: close the app gracefully, force what is left after closeWaitMs, then launch it through
 * explorer.exe so it takes the desktop shell's environment and never inherits this process's (CLAUDE_CODE_* and
 * the rest). Only processes whose image is the app exe are touched: the terminal daemon keeps running. Pure.
 */
export function orcaRestartScript({ app, closeWaitMs }) {
  return [
    `$app = ${psQuote(app)}`,
    '$mine = { @(Get-Process -Name Orca -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $app }) }',
    '$before = & $mine',
    'foreach ($p in $before) { if ($p.MainWindowHandle -ne 0) { [void]$p.CloseMainWindow() } }',
    `$deadline = (Get-Date).AddMilliseconds(${Math.round(closeWaitMs)})`,
    'while ((Get-Date) -lt $deadline -and (& $mine).Count) { Start-Sleep -Milliseconds 500 }',
    '$left = & $mine',
    '$left | Stop-Process -Force -ErrorAction SilentlyContinue',
    'Start-Process -FilePath "$env:WINDIR\\explorer.exe" -ArgumentList (\'"\' + $app + \'"\')',
    '@{ closed = $before.Count; forced = $left.Count; via = "explorer.exe" } | ConvertTo-Json -Compress',
  ].join('\n');
}

const sync = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: 120_000, cwd: SKILL_ROOT, ...opts });
const connectorStart = (script, env) => {
  const r = sync(process.execPath, [path.join(SKILL_ROOT, 'scripts', 'connectors', script), 'start'], { env });
  return { ok: r.status === 0, answer: lastJson(r.stdout), stderr: String(r.stderr ?? '').trim().slice(0, 300) };
};

/** Start one service now. Only ever reached through ctx.run in active mode (or by hand). */
export async function startService(name, { settings = hostSettings(), ports = servicePorts(), env = process.env, run = sync } = {}) {
  const clean = await cleanEnv(env);
  const s = settings.services[name] ?? {};
  switch (name) {
    case 'orca': {
      const { orcaAppExe } = await import('../api/orca/lib.mjs');
      const app = orcaAppExe();
      if (!app) return { ok: false, error: 'no Orca app beside the orca CLI' };
      const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', orcaRestartScript({ app, closeWaitMs: s.closeWaitMs ?? 30_000 })],
        { env: clean, timeout: (s.closeWaitMs ?? 30_000) + 120_000 });
      return { ok: r.status === 0, app, ...(lastJson(r.stdout) ?? {}), ...(r.status ? { error: String(r.stderr ?? '').trim().slice(0, 300) } : {}) };
    }
    case 'harness-ui': case 'harness-tunnel': {
      const task = s.task;
      run('schtasks.exe', ['/End', '/TN', task]);
      if (name === 'harness-ui' && ports.harnessPort) {
        // A listener that holds the port but does not answer blocks the new server: stop it first.
        run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          `Get-NetTCPConnection -LocalPort ${Number(ports.harnessPort)} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`]);
      }
      const r = run('schtasks.exe', ['/Run', '/TN', task]);
      return { ok: r.status === 0, task, output: String(r.stdout || r.stderr || '').trim().slice(0, 300) };
    }
    case 'ask-gateway': return connectorStart('ask-gateway.mjs', clean);
    case 'ask-tunnel': return connectorStart('tunnel.mjs', clean);
    case 'telegram-bridge': return connectorStart('telegram-bridge.mjs', clean);
    default: return { ok: false, error: `no actuator for ${name}` };
  }
}

/* ------------------------------------------------------------ CLI */

const argsOf = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) { a._.push(t); continue; }
    const k = t.slice(2), next = argv[i + 1];
    if (next != null && !next.startsWith('--') && ['probe', 'start', 'reopen'].includes(k)) { a[k] = next; i += 1; } else a[k] = true;
  }
  return a;
};

async function main() {
  const a = argsOf(process.argv.slice(2));
  const out = (v) => console.log(JSON.stringify(v, null, a.json ? 0 : 2));
  if (a.list) return out({ ok: true, rows: openServiceStore().all() });
  if (a.reopen) {
    const store = openServiceStore(), rec = store.get(a.reopen);
    if (!rec) { out({ ok: false, error: `no row ${a.reopen}` }); process.exitCode = 1; return; }
    store.put({ ...rec, state: 'declared', since: Date.now(), restarts: [], failStreak: 0, nextAttemptAt: null, reopenedAt: Date.now() });
    return out({ ok: true, reopened: a.reopen, was: rec.state });
  }
  if (a.probe) {
    const entry = serviceRegistry().find((e) => e.name === a.probe);
    if (!entry) { out({ ok: false, error: `no service ${a.probe}` }); process.exitCode = 1; return; }
    return out({ ok: true, name: a.probe, probe: await entry.probe() });
  }
  if (a.start) { const r = await startService(a.start); out({ name: a.start, ...r }); if (!r.ok) process.exitCode = 1; return; }
  if (a.dedupe) {
    const { resumeRepos } = await import('../kernel/resume-all.mjs');
    const { dedupeTerminals } = await import('../kernel/terminal-dedupe.mjs');
    const { repos } = resumeRepos();
    const r = dedupeTerminals({ repos, dryRun: a['dry-run'] === true });
    return out({ ...r, repos });
  }
  if (a.processes) {
    const { listProcesses } = await import('../supervisor/host-health.mjs');
    const procs = listProcesses();
    return console.log(JSON.stringify({ ok: procs != null, procs: procs ?? [] }));
  }
  console.error('usage: services.mjs --list | --probe <name> | --start <name> | --reopen <name> | --dedupe [--dry-run] | --processes  [--json]');
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
