#!/usr/bin/env node
// `starci harness start` runs the development API and Vite UI.
// `starci harness start --tunnel` runs the named Cloudflare tunnel (starci-harness, %USERPROFILE%/.cloudflared/harness.yml)
//                          to the served UI on 127.0.0.1:<statusApp.port of modules/models/runtimes.yaml>;
//                          the tunnel credential file authenticates it, never a token.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnNode } from '../scripts/api/node/spawn-node.mjs';
import { tunnelRun } from '../scripts/api/cloudflared/tunnel-run.mjs';
import { openBrowser } from '../scripts/api/process/open-browser.mjs';
import { processList } from '../scripts/api/process/process-list.mjs';
import { killTree } from '../scripts/api/process/kill-tree.mjs';
import { starciLocalRoot } from '../engine/db/machine.mjs';
import { isMain } from '../scripts/lib/is-main.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const selfFile = fileURLToPath(import.meta.url);
const STATE_SCHEMA = 'starci/harness-processes@1';
const modeOf = (tunnel) => tunnel ? 'tunnel' : 'app';
const normalize = (value) => String(value ?? '').replace(/\\/g, '/').toLowerCase();
const writeTo = (target, text) => typeof target === 'function' ? target(text) : target.write(text);

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

/** Start one harness mode and record only the parent that owns its child processes. */
export function startHarness({ tunnel = false, env = process.env, pid = process.pid, now = Date.now(), stateFile = harnessStateFile(env),
  spawnApp = spawnNode, spawnTunnel = tunnelRun, lifecycle = process, io = fs } = {}) {
  const children = tunnel
    ? [spawnTunnel(['tunnel', '--config', path.join(os.homedir(), '.cloudflared', 'harness.yml'), 'run', 'starci-harness'], { env: tunnelEnv(env), stdio: 'inherit' })]
    : [
      spawnApp(['server.mjs'], { cwd: root, stdio: 'inherit' }),
      spawnApp(['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit' }),
    ];
  const mode = modeOf(tunnel);
  updateState(stateFile, (processes) => {
    processes[mode] = { pid, mode, script: selfFile, startedAt: now, children: children.map((child) => child.pid).filter(Number.isInteger) };
  }, io);

  let stopped = false;
  const clearRecord = () => updateState(stateFile, (processes) => {
    if (processes[mode]?.pid === pid) delete processes[mode];
  }, io);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const child of children) if (!child.killed) child.kill();
  };
  lifecycle.on('SIGINT', stop);
  lifecycle.on('SIGTERM', stop);
  lifecycle.on('exit', clearRecord);
  for (const child of children) child.on('exit', (code) => {
    if (code && code !== 0) { lifecycle.exitCode = code; stop(); }
  });
  return { mode, pid, children, stop, stateFile };
}

/** A PID is ours only when both its command and creation time match the durable start record. */
function recordedHarnessProcess(record, row) {
  if (!record || !row || Number(row.pid) !== Number(record.pid)) return false;
  const command = normalize(row.cmd);
  if (!command.includes(normalize(record.script ?? selfFile))) return false;
  if (record.mode === 'tunnel' ? !command.includes('--tunnel') : command.includes('--tunnel')) return false;
  if (Number.isFinite(Number(row.created)) && Number(row.created) > 0 && Number.isFinite(Number(record.startedAt))
    && Math.abs(Number(row.created) - Number(record.startedAt)) > 15_000) return false;
  return true;
}

/** Stop only verified recorded parents. Missing PIDs are stale records; mismatches are refused and retained. */
export function stopHarness({ env = process.env, stateFile = harnessStateFile(env), processes = () => processList({ cmdMax: 8000 }),
  kill = (pid) => killTree(pid), io = fs } = {}) {
  const state = readState(stateFile, io);
  const records = Object.values(state.processes);
  if (!records.length) return { ok: true, action: 'not-running', stopped: [], stale: [], refused: [] };
  const table = processes();
  if (!Array.isArray(table)) return { ok: false, action: 'refused', stopped: [], stale: [], refused: records.map((record) => ({ mode: record.mode, pid: record.pid, reason: 'process table unreadable' })) };
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

const harnessUrl = async () => {
  const { servicePorts } = await import('../scripts/reconciler/services.mjs');
  return servicePorts().harnessUrl ?? 'http://127.0.0.1:4547';
};

/** Read-only health check through the reconciler's existing HTTP probe. */
export async function harnessStatus({ probe = null, url = null } = {}) {
  const target = url ?? await harnessUrl();
  const run = probe ?? (async (endpoint) => {
    const { httpUp } = await import('../scripts/reconciler/services.mjs');
    return httpUp(endpoint, { timeoutMs: 15_000, tries: 3 });
  });
  try {
    const result = await run(`${target}/healthz`);
    return { ok: result?.ok === true, running: result?.ok === true, url: target, status: result?.status ?? null, ...(result?.error ? { error: result.error } : {}) };
  } catch (error) { return { ok: false, running: false, url: target, error: String(error?.message ?? error) }; }
}

export async function openHarness({ url = null, open = openBrowser } = {}) {
  const target = url ?? await harnessUrl();
  return open(target);
}

/** CLI entry with injectable probes, process table, kill and browser opener for specs. */
export async function main(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const [verb, ...args] = argv;
  const json = args.includes('--json');
  if (verb === 'start') {
    startHarness({ tunnel: args.includes('--tunnel'), ...(io.startOptions ?? {}) });
    return 0;
  }
  if (verb === 'stop') {
    const result = stopHarness(io.stopOptions ?? {});
    writeTo(stdout, json ? `${JSON.stringify(result)}\n` : `harness ${result.action}${result.stopped.length ? `: ${result.stopped.map((item) => `${item.mode} pid ${item.pid}`).join(', ')}` : ''}${result.refused.length ? `; refused ${result.refused.map((item) => `${item.mode} pid ${item.pid}: ${item.reason}`).join(', ')}` : ''}\n`);
    return result.ok ? 0 : 1;
  }
  if (verb === 'status') {
    const result = await harnessStatus(io.statusOptions ?? {});
    writeTo(stdout, json ? `${JSON.stringify(result)}\n` : `harness ${result.running ? 'UP' : 'DOWN'}: ${result.url}${result.error ? ` (${result.error})` : ''}\n`);
    return result.ok ? 0 : 1;
  }
  if (verb === 'open') {
    const result = await openHarness(io.openOptions ?? {});
    if (result.ok) writeTo(stdout, `opened ${result.url}\n`);
    else writeTo(stderr, `starci: could not open ${result.url}: ${result.error}\n`);
    return result.ok ? 0 : 1;
  }
  writeTo(stderr, 'starci: harness expects start, stop, status or open\n');
  return 2;
}

if (isMain(import.meta.url)) process.exitCode = await main();
