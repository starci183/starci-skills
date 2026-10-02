#!/usr/bin/env node
// services.mjs — the ONE host-service registry of the reconciler's Host controller (DESIGN 8.4, 9.7; LANES.md Lane D).
//
// Every host service the runtime depends on is one entry {name, probe(), start(), startTimeoutMs, slaMs, backoff,
// restart}. probe() is read-only and async (a child process or an HTTP GET, never a blocking spawnSync inside the
// engine). start() does NOT act: it returns the actuator command {cmd, args}, which the controller hands to
// ctx.run, so shadow mode records it and only active mode runs it. Every actuator is this file's own CLI
// (the services actuator), so one place starts each service.
//
// Ports and URLs are read once, from one source each (servicePorts): the harness port from runtimes.yaml
// allocation.supervisorTick.statusApp.port, the public harness hostname from ~/.cloudflared/harness.yml ingress
// (whose service port must equal that port: a mismatch is a probe failure, `port-drift`), the ask-gateway port from
// config.yaml connectors.gateway.port.
//
// The state machine of DESIGN 9.7 is stepService (pure); its rows live in machine.sqlite (engine/db/machine.mjs, DBTREE
// B3): one `services` row per name (state: the coarse DBTREE state; the record's own state and fields in
// last_probe_json), every transition and every restart appended to `service_events` (the restarts of a record are its
// `restart` events: no restarts_json), every probe to `service_probes`. The same table also holds the Host
// controller's seat rows (`seat:...`) and ledger rows (`ledger:<id>`), so `boot.mjs --status` shows everything the Host owns.
//
// Internal args (spawned by the host controller): --list [--json] for the rows of the services table
//       --probe|--start <name> [--json]    read-only probe or active-mode actuator
//       --reopen <name> [--json]   a quarantined service/seat back to `declared`
//       --dedupe [--dry-run] [--json]   terminal-dedupe over config.yaml supervisor.repos
//       --processes                the process table (host-health listProcesses) as JSON
//       --turn (--terminal <h> | --supervisor) [--json]   a seat's turn (read-only)
//       --turn-interrupt --terminal <h> --agent <a> (--repo <r> --workflow <wf> | --supervisor)
//       --turn-replace --terminal <h> --agent <a>   quit + close the overdue seat terminal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execCapture } from '../api/process/exec-capture.mjs'; import { runPowershell } from '../api/process/run-powershell.mjs'; import { schtasks } from '../api/process/schtasks.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { openMachine } from '../../engine/db/machine.mjs'; import { runNode } from '../api/node/run-node.mjs';
import { allocationSettings, loadConfig } from '../../engine/config.mjs'; import { isMain } from '../lib/is-main.mjs';
import { archiveRoot as archiveRootOf } from '../machine/home.mjs';
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SERVICES_FILE = 'scripts/reconciler/services.mjs';
const HOST_YAML = path.join(SKILL_ROOT, 'modules', 'reconciler', 'host.yaml');
const HARNESS_TUNNEL_YML = path.join(os.homedir(), '.cloudflared', 'harness.yml');
const RECONCILER_TASK = 'StarCi-Reconciler';
const starciLauncher = () => path.join(os.homedir(), '.starci', 'bin', process.platform === 'win32' ? 'starci.cmd' : 'starci');

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
    turnBudget: {
      ...section('turnBudget', ['idleWaitMs', 'sameTurnSlackMs', 'probeTimeoutMs']),
      interruptKeys: Object.fromEntries(Object.entries(h?.turnBudget?.interruptKeys ?? {}).map(([agent, keys]) => [agent, (Array.isArray(keys) ? keys : [keys]).map(String)])),
    },
    ledgerHealth: {
      ...section('ledgerHealth', ['quickCheckEveryMs', 'keep', 'backupTimeoutMs']),
      backupHour: Number(h?.ledgerHealth?.backupHour ?? 3),
      backupDir: String(h?.ledgerHealth?.backupDir ?? path.join(archiveRootOf(), 'ledger-backups')),
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
export const runChild = (cmd, args, { timeoutMs = 60_000, env = process.env, cwd = SKILL_ROOT } = {}) => execCapture(cmd, args, { timeoutMs, env, cwd });

/** The last JSON line of a child's stdout, or null. */
export const lastJson = (text) => {
  const lines = String(text ?? '').trim().split(/\r?\n/).reverse();
  for (const line of lines) { try { const v = JSON.parse(line); if (v && typeof v === 'object') return v; } catch { /* not json */ } }
  try { return JSON.parse(String(text ?? '').trim()); } catch { return null; }
};

const node = (script, args = []) => [process.execPath, [path.join(SKILL_ROOT, script), ...args]];

/** GET url: ok while it answers below 500 (Cloudflare answers 502/530 when the origin or the tunnel is gone). */
export async function httpUp(url, { timeoutMs, tries = 1, fetchImpl = fetch } = {}) {
  let last = null;
  const failures = [];
  for (let i = 1; i <= Math.max(1, tries); i += 1) {
    const started = Date.now();
    try {
      const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      last = { ok: res.status < 500, status: res.status, tries: i, ms: Date.now() - started };
    } catch (error) { last = { ok: false, error: String(error?.cause?.code ?? error?.name ?? error?.message ?? error).slice(0, 200), tries: i, ms: Date.now() - started }; }
    if (last.ok) return failures.length ? { ...last, failures } : last;
    failures.push(`${last.status ?? last.error} ${last.ms}ms`);
  }
  return { ...last, failures };
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

/** A connector's internal status probe answers running (and, for the tunnel, no health problems). */
async function connectorUp(script, { timeoutMs, tries = 1, run = runChild, extraArgs = [], judge = (v) => v?.running === true } = {}) {
  const [cmd, args] = node(`scripts/connectors/${script}`, ['status', ...extraArgs]);
  let last = null;
  for (let i = 1; i <= Math.max(1, tries); i += 1) {
    const r = await run(cmd, args, { timeoutMs });
    const value = lastJson(r.stdout);
    last = value ? { ok: judge(value) === true, value, tries: i } : { ok: false, error: r.timedOut ? 'timeout' : String(r.stderr || `exit ${r.status}`).slice(0, 200), tries: i };
    if (last.ok) return last;
  }
  return last;
}

/** schtasks /query of one task: {ok, exists, status} (status Ready|Running|Disabled|...). */
async function taskState(name, { timeoutMs = 30_000, run = runChild, platform = process.platform } = {}) {
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
    // A restart of Orca kills every agent: one that still answers a listing within aliveTimeoutMs is only slow.
    entry('orca', { probe: () => probeOrcaAsync({ timeoutMs: s.orca.probeTimeoutMs, run }),
      answers: async () => (await probeOrcaAsync({ timeoutMs: s.orca.aliveTimeoutMs ?? 90_000, run })).ok === true }),
    // `answers`: asked once more, with aliveTimeoutMs, before any restart; a service that still answers HTTP is never restarted.
    entry('harness-ui', { ownerPath: true, probe: async () => {
      if (!ports.harnessUrl) return { ok: false, error: 'no harness port' };
      return http(`${ports.harnessUrl}${s['harness-ui'].probePath ?? '/healthz'}`, { timeoutMs: s['harness-ui'].probeTimeoutMs, tries: s['harness-ui'].probeTries ?? 1 });
    }, answers: async () => (ports.harnessUrl ? (await http(`${ports.harnessUrl}${s['harness-ui'].probePath ?? '/healthz'}`, { timeoutMs: s['harness-ui'].aliveTimeoutMs ?? 30_000 })).status != null : false) }),
    entry('harness-tunnel', { ownerPath: true, probe: async () => {
      const drift = portProblem();
      if (drift) return { ok: false, error: drift };
      if (!ports.harnessPublicUrl) return { ok: false, error: 'no public hostname' };
      return http(`${ports.harnessPublicUrl}${s['harness-tunnel'].probePath ?? '/healthz'}`, { timeoutMs: s['harness-tunnel'].probeTimeoutMs, tries: s['harness-tunnel'].probeTries ?? 1 });
    }, answers: async () => {
      if (!ports.harnessPublicUrl || portProblem()) return false;
      return (await http(`${ports.harnessPublicUrl}${s['harness-tunnel'].probePath ?? '/healthz'}`, { timeoutMs: s['harness-tunnel'].aliveTimeoutMs ?? 45_000 })).ok === true;
    } }),
    entry('ask-gateway', { ownerPath: true, probe: () => connectorUp('ask-gateway.mjs', { timeoutMs: s['ask-gateway'].probeTimeoutMs, tries: s['ask-gateway'].probeTries ?? 1, run,
      judge: (v) => v.running === true && (ports.gatewayPort == null || v.port == null || Number(v.port) === ports.gatewayPort) }),
    // The gateway answers 404 for anything but a form: any HTTP answer on its port is a live gateway.
    answers: async () => (ports.gatewayPort ? (await http(`http://127.0.0.1:${ports.gatewayPort}/`, { timeoutMs: s['ask-gateway'].aliveTimeoutMs ?? 30_000 })).status != null : false) }),
    entry('ask-tunnel', { ownerPath: true, probe: () => connectorUp('tunnel.mjs', { timeoutMs: s['ask-tunnel'].probeTimeoutMs, tries: s['ask-tunnel'].probeTries ?? 1, run, extraArgs: ['--fast'],
      judge: (v) => v.running === true && !(v.health?.problems ?? []).length }) }),
    // The bridge long-polls: its offset advances only when an update arrives, so liveness is the recorded pid
    // alive (status.running); the offset is kept in the probe detail for the digest.
    entry('telegram-bridge', { ownerPath: true, probe: () => connectorUp('telegram-bridge.mjs', { timeoutMs: s['telegram-bridge'].probeTimeoutMs, tries: s['telegram-bridge'].probeTries ?? 1, run }) }),
    entry(`sched-task:${RECONCILER_TASK}`, { restart: settings.allowTaskRepair,
      probe: async () => {
        const t = await taskState(RECONCILER_TASK, { timeoutMs: s[`sched-task:${RECONCILER_TASK}`].probeTimeoutMs, run });
        return t.exists || settings.allowTaskRepair ? t : { ...t, unmanaged: true };
      },
      start: () => ({ cmd: starciLauncher(), args: ['reconciler', 'install-task', '--apply', '--json'] }) }),
  ];
  for (const c of settings.checkers) {
    out.push({ name: `checker:${c.name}`, kind: 'checker', restart: false, ownerPath: false, ...c, start: () => null,
      probe: async () => { const r = await run(c.cmd, c.args, { timeoutMs: c.probeTimeoutMs }); return { ok: r.status === 0, exit: r.status, timedOut: r.timedOut }; } });
  }
  return out;
}

/* ------------------------------------------------------------ the state machine (DESIGN 9.7) */

export const DOWN_STATES = new Set(['starting', 'degraded', 'failed', 'backoff', 'quarantined']);
// The states that run the SERVICE_DOWN clock: one bad pass (`degraded`) is not down.
export const OUTAGE_STATES = new Set(['starting', 'failed', 'backoff', 'quarantined']);

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

/** services.kind (DBTREE B3) of a store row name. Pure. */
const serviceKindOf = (name) => {
  const n = String(name ?? '');
  if (n.startsWith('ledger:')) return 'ledger';
  if (n.startsWith('sched-task:')) return 'scheduled-task';
  if (/-tunnel$/.test(n)) return 'tunnel';
  if (n === 'ask-gateway' || n === 'telegram-bridge') return 'connector';
  if (n.startsWith('checker:') || n === 'harness-ui') return 'http';
  return 'host-app';
};
/** services.state (DBTREE B3: healthy|ok|degraded|down|quarantined|restarting|booting|stale) of a record state. Pure. */
const serviceStateOf = (state) => {
  switch (String(state ?? '')) {
    case 'healthy': return 'healthy';
    case 'ok': case 'live': case 'idle': case 'busy': case 'working': return 'ok';
    case 'degraded': return 'degraded';
    case 'quarantined': return 'quarantined';
    case 'starting': case 'replacing': case 'reserving': return 'restarting';
    case 'declared': return 'booting';
    case 'unmanaged': case 'removed': return 'stale';
    default: return 'down';
  }
};
// last_probe_json keys of the store itself (never part of a record).
const STORE_KEYS = ['state', 'restartsFrom', 'removed'];

/**
 * The Host controller's records in machine.sqlite: {get, put, all, remove}. A record is {name, state, since, restarts,
 * ...fields}; `restarts` are the times of its service_events `restart` rows since the record's restartsFrom (a record
 * put with fewer restarts - the quarantine window moved, a --reopen - moves restartsFrom, never deletes an event).
 * put appends a service_events row on every change of the record's state and one `restart` row per new restart, and a
 * service_probes row per new lastProbe. remove keeps the history: the row turns stale/removed.
 */
export function machineStore(m) {
  const restartsOf = (name, from) => m.db.prepare("SELECT at FROM service_events WHERE name=? AND action='restart' AND at>=? ORDER BY at, seq").all(name, Number(from) || 0).map((r) => Number(r.at));
  const read = (row) => {
    if (!row) return null;
    let extra = {};
    try { extra = JSON.parse(row.last_probe_json ?? '{}') ?? {}; } catch { extra = {}; }
    if (extra.removed) return null;
    const { state, restartsFrom, removed, ...fields } = extra;
    return { ...fields, name: row.name, state: state ?? row.state, since: row.since, restarts: restartsOf(row.name, restartsFrom) };
  };
  const get = (name) => read(m.db.prepare('SELECT * FROM services WHERE name=?').get(name));
  const put = (rec) => m.transaction((db) => {
    const at = m.now();
    const row = db.prepare('SELECT * FROM services WHERE name=?').get(rec.name);
    let prev = {};
    try { prev = JSON.parse(row?.last_probe_json ?? '{}') ?? {}; } catch { prev = {}; }
    const had = row ? restartsOf(rec.name, prev.restartsFrom) : [];
    const restarts = (rec.restarts ?? []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const fresh = restarts.filter((t) => !had.includes(t));
    const restartsFrom = restarts.length ? restarts[0] : had.length ? had.at(-1) + 1 : 0;
    const { name, state, since, restarts: _r, ...fields } = rec;
    const fromState = row && !prev.removed ? prev.state ?? row.state : null;
    m.upsert('services', { name, kind: row?.kind ?? serviceKindOf(name), state: serviceStateOf(state), since: since ?? at,
      last_probe_json: { ...fields, state, restartsFrom } }, ['name']);
    for (const t of fresh) m.insert('service_events', { name, at: t, from_state: fromState, to_state: state, action: 'restart' });
    if (!fresh.length && fromState !== state) {
      const action = state === 'quarantined' ? 'quarantine' : fromState === 'quarantined' ? 'release' : null;
      m.insert('service_events', { name, at, from_state: fromState, to_state: state, action, probe_error: fields.lastProbe?.ok === false ? String(fields.lastProbe?.error ?? '').slice(0, 500) || null : null });
    }
    const probe = fields.lastProbe;
    if (probe && Number.isFinite(Number(probe.at)) && Number(probe.at) !== Number(prev.lastProbe?.at)) {
      m.recordProbe({ name, ok: probe.ok === true, latencyMs: Number.isFinite(Number(probe.ms ?? probe.latencyMs)) ? Number(probe.ms ?? probe.latencyMs) : null, detail: probe });
    }
    return rec;
  });
  const all = () => m.db.prepare('SELECT * FROM services ORDER BY name').all().map(read).filter(Boolean);
  const remove = (name) => m.transaction((db) => {
    const row = db.prepare('SELECT * FROM services WHERE name=?').get(name);
    if (!row) return;
    let prev = {};
    try { prev = JSON.parse(row.last_probe_json ?? '{}') ?? {}; } catch { prev = {}; }
    if (prev.removed) return;
    m.update('services', { state: 'stale', since: m.now(), last_probe_json: { ...prev, removed: true } }, { name });
    m.insert('service_events', { name, at: m.now(), from_state: prev.state ?? row.state, to_state: 'removed', action: null });
  });
  return { get, put, all, remove };
}

/** An in-memory store with the same shape (specs). */
export function memoryStore(initial = []) {
  const m = new Map(initial.map((r) => [r.name, structuredClone(r)]));
  return { get: (n) => (m.has(n) ? structuredClone(m.get(n)) : null), put: (r) => { m.set(r.name, structuredClone(r)); return r; }, all: () => [...m.values()].map((r) => structuredClone(r)), remove: (n) => { m.delete(n); } };
}

let shared = null;
/** The Host records in machine.sqlite (machineStore over one handle), opened once per process. */
export function openServiceStore({ env = process.env } = {}) {
  if (shared) return shared;
  shared = machineStore(openMachine({ env }));
  return shared;
}

/* ------------------------------------------------------------ actuators (the CLI; active mode only) */

const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Launch environment for a desktop host: no agent/Claude session variables (scripts/lib/host-launch-env.mjs hostLaunchEnv). */
export async function cleanEnv(env = process.env) {
  const { hostLaunchEnv } = await import('../lib/host-launch-env.mjs');
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

const connectorStart = (script, env) => {
  const r = runNode([path.join(SKILL_ROOT, 'scripts', 'connectors', script), 'start'], { timeout: 120_000, cwd: SKILL_ROOT, env });
  return { ok: r.status === 0, answer: lastJson(r.stdout), stderr: String(r.stderr ?? '').trim().slice(0, 300) };
};

/** Start one service now. Only ever reached through ctx.run in active mode (or by hand). Seams: powershell, tasks. */
export async function startService(name, { settings = hostSettings(), ports = servicePorts(), env = process.env, powershell = runPowershell, tasks = schtasks } = {}) {
  const clean = await cleanEnv(env);
  const s = settings.services[name] ?? {};
  switch (name) {
    case 'orca': {
      const { status } = await import('../api/orca/status.mjs');
      const app = status({ timeout: 5000 }).appExe;
      if (!app) return { ok: false, error: 'no Orca app beside the orca CLI' };
      const r = powershell(orcaRestartScript({ app, closeWaitMs: s.closeWaitMs ?? 30_000 }), { env: clean, timeout: (s.closeWaitMs ?? 30_000) + 120_000 });
      return { ok: r.status === 0, app, ...(lastJson(r.stdout) ?? {}), ...(r.status ? { error: String(r.stderr ?? '').trim().slice(0, 300) } : {}) };
    }
    case 'harness-ui': case 'harness-tunnel': {
      const task = s.task; // tunnel-task.mjs registers `starci harness start --tunnel` as the harness-tunnel action
      tasks(['/End', '/TN', task]);
      if (name === 'harness-ui' && ports.harnessPort) {
        // A listener that holds the port but does not answer blocks the new server: stop it first.
        powershell(
          `Get-NetTCPConnection -LocalPort ${Number(ports.harnessPort)} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`);
      }
      const r = tasks(['/Run', '/TN', task]);
      return { ok: r.status === 0, task, output: String(r.stdout || r.stderr || '').trim().slice(0, 300) };
    }
    case 'ask-gateway': return connectorStart('ask-gateway.mjs', clean);
    case 'ask-tunnel': return connectorStart('tunnel.mjs', clean);
    case 'telegram-bridge': return connectorStart('telegram-bridge.mjs', clean);
    default: return { ok: false, error: `no actuator for ${name}` };
  }
}

/* ------------------------------------------------------------ turn budget (a seat's one long busy turn) */

const TURN_ROW = /esc(?:\s+twice)?\s+to\s+(?:interrupt|cancel)|\b(?:Working|Thinking|Running tools)\b/i;
/**
 * The minutes of the running turn on a TUI frame, read from its spinner timer, or null when no timer shows. Claude
 * "(12m 30s · ↓ 3k tokens · esc to interrupt)", Codex "Working (1h 02m 13s • esc to interrupt)", Devin
 * "Thinking · 5m 58s (esc twice to interrupt)". The lowest spinner row of the last 40 rows wins. Pure.
 */
export function turnMinutesOf(screen) {
  const rows = String(screen ?? '').split(/\r?\n/).slice(-40).reverse();
  for (const row of rows) {
    if (!TURN_ROW.test(row)) continue;
    const m = /(?:\b(\d+)h\s*)?\b(\d+)m(?:\s*\d+s)?\b/.exec(row);
    if (m) return Number(m[1] ?? 0) * 60 + Number(m[2]);
    const h = /\b(\d+)h\b/.exec(row);
    if (h) return Number(h[1]) * 60;
    if (/\b\d+s\b/.test(row)) return 0;
  }
  return null;
}

const KEY_BYTES = Object.freeze({ esc: '\u001b', 'ctrl+c': '\u0003' });

const SEAT_AGENTS = ['claude', 'codex', 'devin'];
/**
 * The agent a seat terminal runs, from a terminal-list entry {agentIdentity, title} and its frame: Orca's
 * agentIdentity first, then the title ("⠼ Devin", "✳ Claude Code"), then the frame's own interrupt hint (Devin asks
 * "esc twice"), else quit-agent's heuristic. The interrupt key depends on it: one Esc does not stop Devin. Pure.
 */
export function seatAgentOf(entry, screen = '', fallback = null) {
  const named = String(entry?.agentIdentity ?? entry?.agent ?? '').toLowerCase();
  if (SEAT_AGENTS.includes(named)) return named;
  const title = String(entry?.title ?? entry?.tabTitle ?? '');
  for (const a of ['devin', 'codex', 'claude']) if (new RegExp(`\\b${a}\\b`, 'i').test(title)) return a;
  if (/esc\s+twice\s+to\s+interrupt|Ask Devin\b/i.test(String(screen ?? ''))) return 'devin';
  return fallback ? fallback(entry, 'claude') : 'claude';
}

/** The seat's terminal, agent and turn: {ok, terminal, agent, state, busy, minutes}. Read-only. */
async function turnProbe({ terminal = null, supervisor = false } = {}) {
  let handle = terminal;
  if (!handle && supervisor) {
    const home = await import('../machine/home.mjs');
    handle = home.readSupervisor((m) => home.seatOf(m, Date.now())?.value?.terminal ?? null, null);
  }
  if (!handle) return { ok: false, error: 'no seat terminal' };
  const [{ terminalRead }, { terminalList }, { agentOfTerminal }, { classifyAgentScreen }] = await Promise.all([
    import('../api/orca/terminal-read.mjs'), import('../api/orca/terminal-list.mjs'), import('../kernel/quit-agent.mjs'), import('../lib/terminal-liveness.mjs')]);
  const listed = terminalList();
  const entry = (listed.terminals ?? []).find((t) => t.handle === handle) ?? null;
  if (!listed.ok || !entry) return { ok: false, terminal: handle, error: listed.ok ? 'terminal not listed' : 'orca unavailable' };
  const read = terminalRead({ terminal: handle, screen: true });
  if (!read?.ok) return { ok: false, terminal: handle, error: 'terminal unreadable' };
  const agent = seatAgentOf(entry, read.screen, agentOfTerminal);
  const state = classifyAgentScreen(String(read.screen ?? ''), { provider: agent }).state;
  const busy = state === 'active' || state === 'wedged';
  return { ok: true, terminal: handle, agent, state, busy, minutes: busy ? turnMinutesOf(read.screen) : null };
}

/**
 * The soft interrupt: the agent's own interrupt key(s), a wait of up to idleWaitMs for the turn to end, then the
 * decision doorbell (top DI + its ranked actions) rung at once. Active mode only (reached through ctx.run).
 */
async function turnInterrupt({ terminal, agent, repo = null, workflowId = null, supervisor = false, settings = hostSettings() }) {
  const [{ terminalSend }, { sleepSync }] = await Promise.all([import('../api/orca/terminal-send.mjs'), import('../lib/sleep-sync.mjs')]);
  const keys = settings.turnBudget.interruptKeys[agent] ?? ['esc'];
  const sent = [];
  for (const key of keys) {
    const bytes = KEY_BYTES[key] ?? key;
    let r = null;
    try { r = terminalSend({ terminal, text: bytes, enter: false }); } catch (error) { r = { ok: false, error: String(error?.message ?? error) }; }
    sent.push({ key, ok: r?.ok === true });
    sleepSync(400);
  }
  let after = null;
  for (let waited = 0; waited <= settings.turnBudget.idleWaitMs; waited += 2000) {
    after = await turnProbe({ terminal });
    if (after.ok && !after.busy) break;
    sleepSync(2000);
  }
  const [d, { wakeKernel }] = await Promise.all([import('../machine/decisions.mjs'), import('../kernel/wake-delivery.mjs')]);
  let ring;
  try { ring = supervisor ? await d.ringSupervisor({ wake: wakeKernel, minGapMs: 0 }) : await d.ringDoorbell({ repo, workflowId, wake: wakeKernel, minGapMs: 0 }); } catch (error) { ring = { action: 'ring-failed', error: String(error?.message ?? error) }; }
  return { ok: sent.every((x) => x.ok), terminal, agent, sent, stateAfter: after?.state ?? null, ring: { action: ring?.action ?? null, delivered: ring?.delivered === true, open: ring?.open ?? null } };
}

/** Close an overdue seat's terminal (the agent's quit first) so the seat watchdog proves it gone and replaces it. */
async function turnReplace({ terminal, agent }) {
  const [{ quitAgent }, { terminalClose }] = await Promise.all([import('../kernel/quit-agent.mjs'), import('../api/orca/terminal-close.mjs')]);
  let quit = null;
  try { quit = quitAgent({ handle: terminal, agent }); } catch (error) { quit = { error: String(error?.message ?? error) }; }
  let closed;
  try { closed = terminalClose({ terminal }); } catch (error) { closed = { ok: false, error: String(error?.message ?? error) }; }
  return { ok: closed?.ok === true || quit?.exited === true, terminal, agent, quit, closed: { ok: closed?.ok === true, error: closed?.error ?? null } };
}

/* ------------------------------------------------------------ CLI */

const argsOf = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) { a._.push(t); continue; }
    const k = t.slice(2), next = argv[i + 1];
    if (next != null && !next.startsWith('--') && ['probe', 'start', 'reopen', 'terminal', 'agent', 'repo', 'workflow'].includes(k)) { a[k] = next; i += 1; } else a[k] = true;
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
    const { resumeRepos } = await import('../kernel/managed-repos.mjs');
    const { dedupeTerminals } = await import('../kernel/terminal-dedupe.mjs');
    const { repos } = resumeRepos();
    const r = dedupeTerminals({ repos, dryRun: a['dry-run'] === true });
    return out({ ...r, repos });
  }
  if (a.turn) return out(await turnProbe({ terminal: a.terminal ?? null, supervisor: a.supervisor === true }));
  if (a['turn-interrupt']) {
    const r = await turnInterrupt({ terminal: a.terminal, agent: a.agent, repo: a.repo ?? null, workflowId: a.workflow ?? null, supervisor: a.supervisor === true });
    out(r); if (!r.ok) process.exitCode = 1; return;
  }
  if (a['turn-replace']) { const r = await turnReplace({ terminal: a.terminal, agent: a.agent }); out(r); if (!r.ok) process.exitCode = 1; return; }
  if (a.processes) {
    const { listProcesses } = await import('../supervisor/host-health.mjs');
    const procs = listProcesses();
    return console.log(JSON.stringify({ ok: procs != null, procs: procs ?? [] }));
  }
  console.error('usage: services.mjs --list | --probe <name> | --start <name> | --reopen <name> | --dedupe [--dry-run] | --processes | --turn | --turn-interrupt | --turn-replace  [--json]');
  process.exitCode = 2;
}

if (isMain(import.meta.url)) await main();
