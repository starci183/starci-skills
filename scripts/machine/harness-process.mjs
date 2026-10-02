// harness-process.mjs - own the in-process harness server, its one UI child and the durable PID record.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { tunnelRun } from '../api/cloudflared/tunnel-run.mjs';
import { spawnNode } from '../api/node/spawn-node.mjs';
import { killTree } from '../api/process/kill-tree.mjs';
import { openBrowser } from '../api/process/open-browser.mjs';
import { processList } from '../api/process/process-list.mjs';
import { starciLocalRoot } from '../../engine/db/machine.mjs';
import { startHarnessServer } from '../../ui/server.mjs';

const UI_ROOT = fileURLToPath(new URL('../../ui/', import.meta.url));
const VERB_MODULE = fileURLToPath(new URL('./harness-verbs.mjs', import.meta.url));
const VITE_TOOL_ENTRY = path.join('node_modules', 'vite', 'bin', 'vite.js');
const STATE_SCHEMA = 'starci/harness-processes@1';
const modeOf = (tunnel) => tunnel ? 'tunnel' : 'app';
const normalize = (value) => String(value ?? '').replace(/\\/g, '/').toLowerCase();

const harnessStateFile = (env = process.env) => path.join(starciLocalRoot(env), 'services', 'harness-processes.json');

const readState = (file, io = fs) => {
  try {
    const value = JSON.parse(io.readFileSync(file, 'utf8'));
    return value?.schema === STATE_SCHEMA && value.processes && typeof value.processes === 'object'
      ? value
      : { schema: STATE_SCHEMA, processes: {} };
  } catch { return { schema: STATE_SCHEMA, processes: {} }; }
};

const writeState = (file, state, io = fs) => {
  io.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  io.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  io.renameSync(tmp, file);
};

const updateState = (file, update, io = fs) => {
  const state = readState(file, io);
  update(state.processes);
  writeState(file, state, io);
  return state;
};

const tunnelEnv = (env) => {
  const clean = { ...env };
  delete clean.CF_TUNNEL_TOKEN;
  delete clean.CF_API_TOKEN;
  return clean;
};

/** Start one harness mode and expose a completion promise for the catalog verb. */
export function startHarness({
  tunnel = false,
  env = process.env,
  pid = process.pid,
  now = Date.now(),
  stateFile = harnessStateFile(env),
  serverFactory = startHarnessServer,
  spawnApp = spawnNode,
  spawnTunnel = tunnelRun,
  lifecycle = process,
  io = fs,
  home = os.homedir(),
} = {}) {
  const mode = modeOf(tunnel);
  const serverRuntime = tunnel ? null : serverFactory({ env });
  let children;
  try {
    children = tunnel
      ? [spawnTunnel(['tunnel', '--config', path.join(home, '.cloudflared', 'harness.yml'), 'run', 'starci-harness'], {
        env: tunnelEnv(env), stdio: 'inherit',
      })]
      : [spawnApp([VITE_TOOL_ENTRY], { cwd: UI_ROOT, env, stdio: 'inherit' })];
  } catch (error) {
    void serverRuntime?.close?.();
    throw error;
  }

  try {
    updateState(stateFile, (processes) => {
      processes[mode] = {
        pid,
        mode,
        script: VERB_MODULE,
        startedAt: now,
        children: children.map((child) => child.pid).filter(Number.isInteger),
      };
    }, io);
  } catch (error) {
    for (const child of children) if (!child.killed) child.kill();
    void serverRuntime?.close?.();
    throw error;
  }

  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const pending = new Set(children);
  let stopped = false;
  let serverClosed = serverRuntime == null;
  let code = 0;

  const clearRecord = () => updateState(stateFile, (processes) => {
    if (processes[mode]?.pid === pid) delete processes[mode];
  }, io);
  const settle = () => {
    if (stopped && serverClosed && pending.size === 0 && resolveDone) {
      const resolve = resolveDone;
      resolveDone = null;
      resolve({ code });
    }
  };
  const closeServer = async () => {
    try { await serverRuntime?.close?.(); }
    catch { code = code || 1; }
    finally { serverClosed = true; settle(); }
  };
  const stop = (exitCode = 0) => {
    if (Number(exitCode) !== 0) code = Number(exitCode) || 1;
    if (stopped) { settle(); return; }
    stopped = true;
    lifecycle.off?.('SIGINT', onSignal);
    lifecycle.off?.('SIGTERM', onSignal);
    lifecycle.off?.('exit', clearRecord);
    serverRuntime?.server?.off?.('error', onServerError);
    clearRecord();
    void closeServer();
    for (const child of pending) if (!child.killed) child.kill();
    settle();
  };
  const onSignal = () => stop(0);
  const onServerError = () => stop(1);

  lifecycle.on('SIGINT', onSignal);
  lifecycle.on('SIGTERM', onSignal);
  lifecycle.on('exit', clearRecord);
  serverRuntime?.server?.once?.('error', onServerError);
  for (const child of children) child.once('exit', (exitCode) => {
    pending.delete(child);
    if (!stopped) stop(Number(exitCode) === 0 ? 0 : Number(exitCode) || 1);
    settle();
  });

  return { mode, pid, children, stop, stateFile, server: serverRuntime?.server ?? null, done };
}

/** A PID is ours only when its identity, creation time and dispatched harness command match the record. */
export function recordedHarnessProcess(record, row) {
  if (!record || !row || Number(row.pid) !== Number(record.pid)) return false;
  const command = normalize(row.cmd);
  if (!/(?:^|\s|["'])harness(?:$|\s|["'])/.test(command) || !/(?:^|\s|["'])start(?:$|\s|["'])/.test(command)) return false;
  if (record.mode === 'tunnel' ? !command.includes('--tunnel') : command.includes('--tunnel')) return false;
  if (Number.isFinite(Number(row.created)) && Number(row.created) > 0 && Number.isFinite(Number(record.startedAt))
    && Math.abs(Number(row.created) - Number(record.startedAt)) > 15_000) return false;
  return true;
}

/** Stop only verified recorded parents. Missing PIDs are stale records; mismatches stay visible. */
export function stopHarness({
  env = process.env,
  stateFile = harnessStateFile(env),
  processes = () => processList({ cmdMax: 8000 }),
  kill = (pid) => killTree(pid),
  io = fs,
} = {}) {
  const state = readState(stateFile, io);
  const records = Object.values(state.processes);
  if (!records.length) return { ok: true, action: 'not-running', stopped: [], stale: [], refused: [] };
  const table = processes();
  if (!Array.isArray(table)) {
    return { ok: false, action: 'refused', stopped: [], stale: [], refused: records.map((record) => ({
      mode: record.mode, pid: record.pid, reason: 'process table unreadable',
    })) };
  }
  const byPid = new Map(table.map((row) => [Number(row.pid), row]));
  const stopped = [], stale = [], refused = [];
  for (const record of records) {
    const row = byPid.get(Number(record.pid));
    if (!row) { stale.push({ mode: record.mode, pid: record.pid }); delete state.processes[record.mode]; continue; }
    if (!recordedHarnessProcess(record, row)) {
      refused.push({ mode: record.mode, pid: record.pid, reason: 'recorded PID belongs to another process' });
      continue;
    }
    const result = kill(record.pid);
    if (result?.ok === true) { stopped.push({ mode: record.mode, pid: record.pid }); delete state.processes[record.mode]; }
    else refused.push({ mode: record.mode, pid: record.pid, reason: result?.output ?? 'stop failed' });
  }
  writeState(stateFile, state, io);
  return { ok: refused.length === 0, action: refused.length ? 'refused' : stopped.length ? 'stopped' : 'not-running', stopped, stale, refused };
}

export async function harnessUrl({ tunnel = false } = {}) {
  const { servicePorts } = await import('../reconciler/services.mjs');
  const ports = servicePorts();
  if (tunnel) return ports.harnessPublicUrl ?? ports.harnessUrl ?? 'http://127.0.0.1:4547';
  return ports.harnessUrl ?? 'http://127.0.0.1:4547';
}

/** Read-only health check through the reconciler's existing HTTP probe. */
export async function harnessStatus({ probe = null, url = null } = {}) {
  const target = url ?? await harnessUrl();
  const run = probe ?? (async (endpoint) => {
    const { httpUp } = await import('../reconciler/services.mjs');
    return httpUp(endpoint, { timeoutMs: 15_000, tries: 3 });
  });
  try {
    const result = await run(`${target}/healthz`);
    return {
      ok: result?.ok === true,
      running: result?.ok === true,
      url: target,
      status: result?.status ?? null,
      ...(result?.error ? { error: result.error } : {}),
    };
  } catch (error) {
    return { ok: false, running: false, url: target, error: String(error?.message ?? error) };
  }
}

export async function openHarness({ url = null, open = openBrowser } = {}) {
  const target = url ?? await harnessUrl();
  return open(target);
}
