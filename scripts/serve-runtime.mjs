// The one recorded way to start a product's dev server for a runtime entry.
//
//   node scripts/serve-runtime.mjs <worktree> <port> --log <file> [--command "<cmd>"] [--route <config.json>]
//   node scripts/serve-runtime.mjs --stop <pidfile>
//   node scripts/serve-runtime.mjs --status <pidfile>
//
// The server is detached: it outlives the branch that started it, because the audit or the journey
// that needs it runs in another branch and sometimes in another session. That is only safe if the
// process is recorded, so this script writes a pid file beside the log — the pid, the port, the
// worktree, the exact command and the time — and `--stop` kills that pid and no other. Everything it
// prints on stdout is one JSON object, which is what the operator copies into the registry entry.
//
// The command is not invented here. It is the `dev` field of the route declaration when the
// declaration publishes one, then the `--command` the caller passes, and only then the conventional
// `npm run dev -- --port <port>`; a route that wants something else says so in the place a route is
// declared, not in an argument somebody remembered to pass.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const HOST = '127.0.0.1';

// Probing by connecting is the only honest answer to "is this port free": a port nothing answers on
// is free, and a port something answers on belongs to somebody whose owner is not this script.
export function portTaken(port, host = HOST, timeout = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (taken) => { socket.destroy(); resolve(taken); };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export function commandFor({ routeConfig, command, port }) {
  if (routeConfig && typeof routeConfig.dev === 'string' && routeConfig.dev.trim()) return routeConfig.dev.trim();
  if (command && command.trim()) return command.trim();
  return `npm run dev -- --port ${port}`;
}

export function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function parseArgs(argv) {
  const out = { worktree: null, port: null, log: null, command: null, route: null, stop: null, status: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--log') out.log = path.resolve(argv[++i]);
    else if (a === '--command') out.command = argv[++i];
    else if (a === '--route') out.route = path.resolve(argv[++i]);
    else if (a === '--stop') out.stop = path.resolve(argv[++i]);
    else if (a === '--status') out.status = path.resolve(argv[++i]);
    else if (out.worktree === null) out.worktree = path.resolve(a);
    else if (out.port === null) out.port = Number(a);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

export const pidFileOf = (log) => `${log.replace(/\.log$/, '')}.pid`;

export function readRecord(pidFile) {
  if (!existsSync(pidFile)) return null;
  try { return JSON.parse(readFileSync(pidFile, 'utf8')); } catch { return null; }
}

export function stop(pidFile) {
  const record = readRecord(pidFile);
  if (!record) return { stopped: false, reason: `no pid file at ${pidFile}` };
  if (!alive(record.pid)) { unlinkSync(pidFile); return { stopped: false, pid: record.pid, reason: 'the recorded process was already gone' }; }
  try { process.kill(record.pid); } catch (e) { return { stopped: false, pid: record.pid, reason: e.message }; }
  unlinkSync(pidFile);
  return { stopped: true, pid: record.pid, port: record.port };
}

export async function start({ worktree, port, log, command, route }) {
  if (!existsSync(worktree)) throw new Error(`no worktree at ${worktree}`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${port} is not a port`);
  if (!log) throw new Error('--log names the file the detached server writes to');
  mkdirSync(path.dirname(log), { recursive: true });
  const pidFile = pidFileOf(log);
  const existing = readRecord(pidFile);
  if (existing && alive(existing.pid)) return { ...existing, reused: true };
  if (await portTaken(port)) throw new Error(`port ${port} is held by another process; the port is fixed, so this is a conflict to coordinate and never a reason to move`);
  const routeConfig = route && existsSync(route) ? JSON.parse(readFileSync(route, 'utf8')) : null;
  const cmd = commandFor({ routeConfig, command, port });
  const out = openSync(log, 'a');
  const child = spawn(cmd, { cwd: worktree, shell: true, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  const record = { pid: child.pid, port, worktree, command: cmd, logRef: log, pidFileRef: pidFile, startedAt: new Date().toISOString() };
  writeFileSync(pidFile, `${JSON.stringify(record, null, 2)}\n`);
  return { ...record, reused: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const emit = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  try {
    if (args.stop) emit(stop(args.stop));
    else if (args.status) { const r = readRecord(args.status); emit(r ? { ...r, alive: alive(r.pid) } : { alive: false }); }
    else emit(await start(args));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  }
}
