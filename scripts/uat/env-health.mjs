#!/usr/bin/env node
// env-health.mjs — the environment pre-step of every walk on a served stack (uat.verify,
// uat.assisted.verify, e2e.verify): is the stack under test actually up, and if not, is that the
// environment's fault or the product's? (lane op-verify, 2026-09-28)
//
// Measured before it: nivo app-auth uat.verify ran five times; at dispatch the next-dev on 3067
// accepted TCP but never answered, nothing listened on 3068, and the declared api probe
// GET /health/live answered 404 on a healthy API - each attempt spent its first half restarting
// servers by hand and none of that reached the ledger as an environment fact.
//
//   check  --repo <ledger repo> (--env <id|resource.yaml>[,...] | --paths <owned paths json|csv>)
//          [--restart] [--probe-timeout-ms N] [--ready-timeout-ms N] [--json]
//      Resolves the work/resource@1 environment(s) - by id, or from the refs of the uat/e2e records
//      the paths name - and runs every declared probe. Per service it reports a state:
//        ready          the probe answered what it declares
//        probe-drift    the declared probe path answers wrong (404) but the origin serves a health
//                       endpoint it discovered (GET /health, /healthz, ..., POST /graphql {__typename});
//                       the service is up - the DECLARATION is stale (owned by workspace.manage)
//        down           nothing answers (connection refused)
//        hung           the port accepts TCP but no HTTP answer arrives in time
//        wrong-status   an answer that is neither the expectation nor a discoverable health endpoint
//        port-conflict  hung/wrong and the listener is not a server of this workspace
//      With --restart a down/hung service is (re)started when the runtime knows how: a server it
//      started itself through `serve` (the registry below) or the resource's configuration.start.
//      A hung listener is killed only when it is that registered server or its command line runs
//      inside one of the workspace's repository roots - never a foreign process.
//      Exit 0 every service ready (probe-drift included), 3 not ready, 2 bad arguments.
//   serve  --env <id> --service <name> --cwd <dir> [--repo <ledger repo>] [--url <probe url>] -- <command...>
//      Starts one server detached, records it in the registry (<runtime>/env-servers, or
//      STARCI_ENV_SERVERS_DIR) and waits for its probe. A later `check --restart` restarts it.
//   status  prints the registry.
//
// The JSON is starci/env-health@1: {ready, class: ready|environment, hardBlock, environments[{id,
// services[{service, url, expect, state, ready, status?, discovered?, listener?, action?, remedy?}]}],
// remedies[]}. It is never a product verdict: a red walk on a ready environment is.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { runtimeRootFor } from '../../engine/ledger-db.mjs';
import { launchFor } from './launch.mjs';
import { killProcessTree } from '../lib/kill-tree.mjs';

export const ENV_HEALTH_SCHEMA = 'starci/env-health@1';
export const EXIT_READY = 0, EXIT_NOT_READY = 3, EXIT_USAGE = 2;
// STARCI_ENV_PROBE_TIMEOUT_MS bounds one probe (specs); a first Next compile can take ~15s, so the default waits 20s.
export const DEFAULT_PROBE_TIMEOUT_MS = Number(process.env.STARCI_ENV_PROBE_TIMEOUT_MS) > 0 ? Number(process.env.STARCI_ENV_PROBE_TIMEOUT_MS) : 20_000;
export const DEFAULT_READY_TIMEOUT_MS = 120_000;
// Discovery order: the conventional liveness/readiness paths, then a GraphQL typename query (a Nest
// GraphQL API answers it without auth), then the origin root.
export const HEALTH_CANDIDATES = [
  { method: 'GET', path: '/health/live' }, { method: 'GET', path: '/health/ready' }, { method: 'GET', path: '/health' },
  { method: 'GET', path: '/healthz' }, { method: 'GET', path: '/livez' }, { method: 'GET', path: '/readyz' },
  { method: 'GET', path: '/api/health' }, { method: 'GET', path: '/status' },
  { method: 'POST', path: '/graphql', body: '{"query":"{__typename}"}' },
];
const ENV_ID = /^environment\.[a-z0-9-]+\.[a-z0-9-]+$/;

/* ------------------------------------------------------------------------ probing */

/**
 * One HTTP probe that tells refused from hung: {state:'answered', status, ms} | {state:'down', code} |
 * {state:'hung', ms} (TCP connected, no answer before timeoutMs) | {state:'error', code}.
 */
export function probeHttp(url, { method = 'GET', body = null, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let target;
    try { target = new URL(url); } catch { resolve({ state: 'error', code: 'URL_INVALID' }); return; }
    const lib = target.protocol === 'https:' ? https : http;
    const started = Date.now();
    let connected = false, done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    const req = lib.request(target, { method, headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}, agent: false });
    req.on('socket', (socket) => {
      if (socket.connecting === false && !socket.pending) connected = true;
      socket.on('connect', () => { connected = true; });
    });
    req.setTimeout(timeoutMs, () => {
      finish(connected ? { state: 'hung', ms: Date.now() - started } : { state: 'down', code: 'CONNECT_TIMEOUT', ms: Date.now() - started });
      req.destroy();
    });
    req.on('response', (res) => { res.resume(); finish({ state: 'answered', status: res.statusCode, ms: Date.now() - started }); });
    req.on('error', (error) => finish(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'EADDRNOTAVAIL'].includes(error.code)
      ? { state: 'down', code: error.code } : { state: 'error', code: error.code ?? String(error.message ?? error) }));
    if (body) req.write(body);
    req.end();
  });
}

/** The first health endpoint an origin answers 2xx on, or null. */
export async function discoverHealth(origin, { timeoutMs = 5000, candidates = HEALTH_CANDIDATES, skip = [] } = {}) {
  for (const candidate of candidates) {
    const url = new URL(candidate.path, origin).toString();
    if (skip.includes(url) && candidate.method === 'GET') continue;
    const r = await probeHttp(url, { method: candidate.method, body: candidate.body ?? null, timeoutMs });
    if (r.state === 'answered' && r.status >= 200 && r.status < 300) return { method: candidate.method, url, status: r.status };
    if (r.state !== 'answered') return null; // the origin itself stopped answering: nothing to discover
  }
  return null;
}

/* ---------------------------------------------------------------- listeners, processes */

/** The process listening on a TCP port: {pid, commandLine} or null. */
export function listenerOf(port, { platform = process.platform } = {}) {
  try {
    if (platform === 'win32') {
      const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 15000 }).stdout ?? '';
      const line = out.split(/\r?\n/).find((l) => new RegExp(`^\\s*TCP\\s+\\S*:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i').test(l));
      const pid = line ? Number(/LISTENING\s+(\d+)/i.exec(line)[1]) : null;
      if (!pid) return null;
      const cmd = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`], { encoding: 'utf8', timeout: 20000 });
      return { pid, commandLine: String(cmd.stdout ?? '').trim() || null };
    }
    const out = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 15000 }).stdout ?? '';
    const pid = Number(out.split(/\s+/).find(Boolean));
    if (!pid) return null;
    const cmd = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000 });
    return { pid, commandLine: String(cmd.stdout ?? '').trim() || null };
  } catch { return null; }
}

export function killTree(pid, { platform = process.platform } = {}) {
  try {
    if (platform === 'win32') return killProcessTree(pid, { platform, timeoutMs: 20000 }).ok;
    try { process.kill(-pid, 'SIGTERM'); } catch { process.kill(pid, 'SIGTERM'); }
    return true;
  } catch { return false; }
}

const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
/** Whether a listener is one of this workspace's servers: its command line runs inside a repository root. */
export const ownedByWorkspace = (commandLine, roots) => Boolean(commandLine) && roots.some((root) => root && norm(commandLine).includes(norm(root)));

/* ------------------------------------------------------------------------ registry */

export const registryDir = (env = process.env) => (env.STARCI_ENV_SERVERS_DIR ? path.resolve(env.STARCI_ENV_SERVERS_DIR) : path.join(runtimeRootFor(env), 'env-servers'));
const registryFile = (envId, service, env) => path.join(registryDir(env), `${envId}__${service}.json`.replace(/[^A-Za-z0-9._-]/g, '_'));
export function readRegistered(envId, service, env = process.env) {
  try { return JSON.parse(fs.readFileSync(registryFile(envId, service, env), 'utf8')); } catch { return null; }
}
function writeRegistered(record, env = process.env) {
  fs.mkdirSync(registryDir(env), { recursive: true });
  fs.writeFileSync(registryFile(record.env, record.service, env), `${JSON.stringify(record, null, 2)}\n`);
}
export function listRegistered(env = process.env) {
  try {
    return fs.readdirSync(registryDir(env)).filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(registryDir(env), f), 'utf8')); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Start one server detached with its output in the registry dir; returns its pid. */
export function startServer({ command, cwd, envId, service, env = process.env }) {
  fs.mkdirSync(registryDir(env), { recursive: true });
  const log = path.join(registryDir(env), `${envId}__${service}.log`.replace(/[^A-Za-z0-9._-]/g, '_'));
  const fd = fs.openSync(log, 'a');
  const { file, args } = launchFor(command);
  const child = spawn(file, args, { cwd, detached: true, stdio: ['ignore', fd, fd], windowsHide: true, env });
  child.unref();
  fs.closeSync(fd);
  return { pid: child.pid, log };
}

async function waitReady(url, expect, { readyTimeoutMs, probeTimeoutMs }) {
  const until = Date.now() + readyTimeoutMs;
  let last = null;
  while (Date.now() < until) {
    last = await probeHttp(url, { timeoutMs: Math.min(probeTimeoutMs, 15000) });
    if (last.state === 'answered' && (last.status === expect || (last.status >= 200 && last.status < 400))) return { ready: true, last };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ready: false, last };
}

/* ------------------------------------------------------------------------ resolution */

const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const collectEnvIds = (value, out) => {
  if (typeof value === 'string') { if (ENV_ID.test(value.trim())) out.add(value.trim()); return; }
  if (Array.isArray(value)) { for (const v of value) collectEnvIds(v, out); return; }
  if (value && typeof value === 'object') for (const v of Object.values(value)) collectEnvIds(v, out);
};

/** The resource file of an environment id under <repo>/.starciwork/_resources, or null. */
export function environmentFile(repo, id) {
  if (/\.ya?ml$/i.test(id) && fs.existsSync(path.resolve(repo, id))) return path.resolve(repo, id);
  const resources = path.join(repo, '.starciwork', '_resources');
  const name = String(id).split('.').pop();
  const direct = path.join(resources, 'environments', name, 'resource.yaml');
  if (fs.existsSync(direct) && readYaml(direct)?.id === id) return direct;
  const stack = [resources];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) stack.push(path.join(dir, e.name));
      else if (e.name === 'resource.yaml' && readYaml(path.join(dir, e.name))?.id === id) return path.join(dir, e.name);
    }
  }
  return null;
}

/** Environment ids a job's owned uat/e2e/integration record paths reference. */
export function environmentIdsOfPaths(repo, paths) {
  const ids = new Set();
  for (const raw of paths ?? []) {
    const p = String(typeof raw === 'string' ? raw : raw?.path ?? '').replace(/\\/g, '/').replace(/\/\*\*$/, '');
    if (!/^\.starciwork\/features\/[^/]+\/(uat|e2e|integration)(\/|$)/.test(p)) continue;
    for (let dir = path.join(repo, p); dir.startsWith(path.join(repo, '.starciwork', 'features')); dir = path.dirname(dir)) {
      const doc = readYaml(path.join(dir, 'index.yaml'));
      if (doc) collectEnvIds(doc, ids);
      if (/[\\/](uat|e2e|integration)$/.test(dir)) break;
    }
  }
  return [...ids];
}

/** The local checkouts of the workspace's repositories: the ledger repo and its named siblings. */
export function workspaceRoots(repo) {
  const roots = [path.resolve(repo)];
  const ws = readYaml(path.join(repo, '.starciwork', 'workspace.yaml'));
  for (const r of Array.isArray(ws?.repositories) ? ws.repositories : []) {
    const sibling = path.join(path.dirname(path.resolve(repo)), String(r?.name ?? ''));
    if (r?.name && fs.existsSync(sibling) && !roots.includes(sibling)) roots.push(sibling);
  }
  return roots;
}

const splitCommand = (value) => (Array.isArray(value) ? value.map(String)
  : (String(value ?? '').match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((t) => t.replace(/^["']|["']$/g, '')));

/* ------------------------------------------------------------------------ check */

const serviceOfUrl = (doc, url) => {
  let port = null;
  try { const u = new URL(url); port = Number(u.port || (u.protocol === 'https:' ? 443 : 80)); } catch { return { service: null, port: null }; }
  const ports = doc?.configuration?.ports ?? {};
  const byPort = Object.entries(ports).find(([, p]) => Number(p) === port)?.[0] ?? null;
  const byOrigin = Object.entries(doc?.target?.origins ?? {}).find(([, o]) => { try { return new URL(o).port == port; } catch { return false; } })?.[0] ?? null; // eslint-disable-line eqeqeq
  return { service: byPort ?? byOrigin, port };
};

/** Check one environment resource. */
export async function checkEnvironment(doc, { restart = false, roots = [], probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS, readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS, env = process.env, repo = null } = {}) {
  const services = [];
  for (const probe of Array.isArray(doc?.probes) ? doc.probes : []) {
    if (probe?.method && probe.method !== 'http-get') { services.push({ service: probe.id, url: probe.target, state: 'unsupported', ready: true, remedy: `probe method ${probe.method} is not run by env-health; the walk checks it` }); continue; }
    const url = String(probe?.target ?? ''), expect = Number(probe?.expect ?? 200);
    const { service, port } = serviceOfUrl(doc, url);
    const name = service ?? probe?.id ?? url;
    let r = await probeHttp(url, { timeoutMs: probeTimeoutMs });
    if (r.state === 'hung') r = await probeHttp(url, { timeoutMs: probeTimeoutMs }); // a first compile can be slow; a second wait decides
    const row = { service: name, probe: probe?.id ?? null, url, expect, port };
    if (r.state === 'answered' && r.status === expect) { services.push({ ...row, state: 'ready', ready: true, status: r.status, ms: r.ms }); continue; }
    if (r.state === 'answered') {
      const origin = new URL(url).origin;
      const discovered = r.status < 500 ? await discoverHealth(origin, { timeoutMs: Math.min(probeTimeoutMs, 8000), skip: [url] }) : null;
      if (discovered) {
        services.push({ ...row, state: 'probe-drift', ready: true, status: r.status, discovered,
          remedy: `the declared probe ${url} answers ${r.status} while ${discovered.method} ${discovered.url} answers ${discovered.status}: the service is up; the environment declaration (${doc.id}) is stale - workspace.manage re-declares the probe` });
        continue;
      }
      Object.assign(row, { status: r.status });
    }
    let state = r.state === 'answered' ? 'wrong-status' : r.state === 'hung' ? 'hung' : r.state === 'down' ? 'down' : 'error';
    const registered = readRegistered(doc.id, name, env);
    const listener = port && state !== 'down' ? listenerOf(port) : null;
    const actions = [];
    if (listener && ['hung', 'wrong-status'].includes(state)) {
      const own = (registered && registered.pid === listener.pid) || ownedByWorkspace(listener.commandLine, roots);
      if (!own) {
        services.push({ ...row, state: 'port-conflict', ready: false, listener,
          remedy: `port ${port} is held by PID ${listener.pid} (${listener.commandLine ?? 'unknown command'}), which is not a server of this workspace and does not answer ${url} with ${expect}; free the port or re-declare it - env-health never stops a foreign process` });
        continue;
      }
      if (restart) { const killed = killTree(listener.pid); actions.push(`killed ${state} own listener PID ${listener.pid}${killed ? '' : ' (kill failed)'}`); if (killed) state = 'down'; }
    }
    const start = registered?.command ? { command: registered.command, cwd: registered.cwd, from: 'registry' }
      : doc?.configuration?.start?.[name] ? { command: splitCommand(doc.configuration.start[name].command), cwd: path.resolve(repo ?? '.', doc.configuration.start[name].cwd ?? '.'), from: 'resource' } : null;
    if (restart && state === 'down' && start?.command?.length) {
      const started = startServer({ command: start.command, cwd: start.cwd, envId: doc.id, service: name, env });
      writeRegistered({ env: doc.id, service: name, port, url, command: start.command, cwd: start.cwd, pid: started.pid, log: started.log, startedAt: new Date().toISOString(), by: 'env-health check --restart' }, env);
      actions.push(`started ${name} (${start.from}) as PID ${started.pid}`);
      const waited = await waitReady(url, expect, { readyTimeoutMs, probeTimeoutMs });
      if (waited.ready) { services.push({ ...row, state: 'restarted', ready: true, status: waited.last.status, action: actions.join('; '), ...(listener ? { listener } : {}) }); continue; }
      services.push({ ...row, state: 'restart-failed', ready: false, action: actions.join('; '), last: waited.last, remedy: `${name} did not answer ${url} within ${readyTimeoutMs}ms after a restart; read ${started.log}` });
      continue;
    }
    const how = start ? `node ${fileURLToPath(import.meta.url)} check --restart ...` : `node ${fileURLToPath(import.meta.url)} serve --env ${doc.id} --service ${name} --cwd <checkout> --url ${url} -- <start command>`;
    services.push({ ...row, state, ready: false, ...(listener ? { listener } : {}), ...(actions.length ? { action: actions.join('; ') } : {}),
      remedy: `${name} is ${state} at ${url}: start it with ${how} (serve registers it, so the next pre-step restarts it itself)` });
  }
  return { id: doc?.id ?? null, services, ready: services.every((s) => s.ready) };
}

/** Check every environment a request names. */
export async function checkEnvironments({ repo, ids = [], paths = [], restart = false, probeTimeoutMs, readyTimeoutMs, env = process.env } = {}) {
  const wanted = [...new Set([...ids, ...environmentIdsOfPaths(repo, paths)])];
  const roots = workspaceRoots(repo);
  const environments = [], unresolved = [];
  for (const id of wanted) {
    const file = environmentFile(repo, id);
    const doc = file ? readYaml(file) : null;
    if (!doc) { unresolved.push(id); continue; }
    environments.push({ file: path.relative(repo, file).replace(/\\/g, '/'), ...(await checkEnvironment(doc, { restart, roots, probeTimeoutMs, readyTimeoutMs, env, repo })) });
  }
  const services = environments.flatMap((e) => e.services);
  const ready = environments.every((e) => e.ready);
  return {
    schema: ENV_HEALTH_SCHEMA, at: new Date().toISOString(), ready, class: ready ? 'ready' : 'environment',
    hardBlock: services.some((s) => s.state === 'port-conflict'),
    declared: wanted.length > 0, environments, ...(unresolved.length ? { unresolved } : {}),
    remedies: services.filter((s) => s.remedy).map((s) => s.remedy),
  };
}

/* ------------------------------------------------------------------------ CLI */

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--') { out.command = argv.slice(i + 1); break; }
    if (a.startsWith('--')) { const key = a.slice(2); const next = argv[i + 1]; if (next === undefined || next.startsWith('--')) out[key] = true; else { out[key] = next; i += 1; } }
    else out._.push(a);
  }
  return out;
}
const listOf = (value) => {
  if (!value || value === true) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch { /* csv */ }
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
};

export async function envHealthMain(argv, { write = (s) => process.stdout.write(s), env = process.env } = {}) {
  const args = parseArgs(argv);
  const verb = args._[0];
  const emit = (value, code) => { write(`${JSON.stringify(value, null, args.json ? 0 : 2)}\n`); return code; };
  if (verb === 'status') return emit({ schema: ENV_HEALTH_SCHEMA, servers: listRegistered(env) }, EXIT_READY);
  if (verb === 'check') {
    if (!args.repo) return emit({ ok: false, error: 'check needs --repo <ledger repo>' }, EXIT_USAGE);
    const result = await checkEnvironments({ repo: path.resolve(args.repo), ids: listOf(args.env), paths: listOf(args.paths), restart: Boolean(args.restart),
      probeTimeoutMs: Number(args['probe-timeout-ms']) || DEFAULT_PROBE_TIMEOUT_MS, readyTimeoutMs: Number(args['ready-timeout-ms']) || DEFAULT_READY_TIMEOUT_MS, env });
    return emit(result, result.ready ? EXIT_READY : EXIT_NOT_READY);
  }
  if (verb === 'serve') {
    if (!args.env || !args.service || !args.cwd || !args.command?.length) return emit({ ok: false, error: 'serve needs --env <id> --service <name> --cwd <dir> -- <command...>' }, EXIT_USAGE);
    const repo = path.resolve(args.repo ?? '.');
    const doc = args.repo ? readYaml(environmentFile(repo, args.env) ?? '') : null;
    const url = typeof args.url === 'string' ? args.url : (doc?.probes ?? []).map((p) => p.target).find((t) => serviceOfUrl(doc, t).service === args.service) ?? null;
    const port = url ? serviceOfUrl(doc ?? {}, url).port ?? Number(new URL(url).port) : null;
    const prior = readRegistered(args.env, args.service, env);
    const listener = port ? listenerOf(port) : null;
    const actions = [];
    if (listener && ((prior && prior.pid === listener.pid) || ownedByWorkspace(listener.commandLine, [path.resolve(args.cwd), ...(args.repo ? workspaceRoots(repo) : [])]))) {
      const answered = url ? await probeHttp(url, { timeoutMs: 8000 }) : null;
      if (answered?.state === 'answered' && answered.status < 500) {
        writeRegistered({ env: args.env, service: args.service, port, url, command: args.command, cwd: path.resolve(args.cwd), pid: listener.pid, startedAt: prior?.startedAt ?? null, adoptedAt: new Date().toISOString(), by: 'env-health serve (adopted a live listener)' }, env);
        return emit({ schema: ENV_HEALTH_SCHEMA, ok: true, ready: true, adopted: true, pid: listener.pid, url }, EXIT_READY);
      }
      if (killTree(listener.pid)) actions.push(`killed stale own listener PID ${listener.pid}`);
    } else if (listener) {
      return emit({ schema: ENV_HEALTH_SCHEMA, ok: false, ready: false, state: 'port-conflict', listener, remedy: `port ${port} is held by a process that is not this workspace's server` }, EXIT_NOT_READY);
    }
    const started = startServer({ command: args.command, cwd: path.resolve(args.cwd), envId: args.env, service: args.service, env });
    writeRegistered({ env: args.env, service: args.service, port, url, command: args.command, cwd: path.resolve(args.cwd), pid: started.pid, log: started.log, startedAt: new Date().toISOString(), by: 'env-health serve' }, env);
    actions.push(`started PID ${started.pid}`);
    if (!url) return emit({ schema: ENV_HEALTH_SCHEMA, ok: true, ready: null, pid: started.pid, log: started.log, actions, note: 'no probe url: readiness not awaited' }, EXIT_READY);
    const waited = await waitReady(url, 200, { readyTimeoutMs: Number(args['ready-timeout-ms']) || DEFAULT_READY_TIMEOUT_MS, probeTimeoutMs: DEFAULT_PROBE_TIMEOUT_MS });
    return emit({ schema: ENV_HEALTH_SCHEMA, ok: waited.ready, ready: waited.ready, pid: started.pid, log: started.log, url, actions, last: waited.last }, waited.ready ? EXIT_READY : EXIT_NOT_READY);
  }
  return emit({ ok: false, error: 'usage: env-health.mjs check|serve|status (see header)' }, EXIT_USAGE);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await envHealthMain(process.argv.slice(2));
