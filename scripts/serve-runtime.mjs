// The one recorded way to start a product's dev server for a runtime entry.
//
//   node scripts/serve-runtime.mjs <worktree> <port> --log <file> [--command "<cmd>"] [--route <config.json>] [--clean] [--wait <ms>]
//   node scripts/serve-runtime.mjs --stop <pidfile>
//   node scripts/serve-runtime.mjs --status <pidfile>
//
// The server is detached: it outlives the branch that started it, because the audit or the journey
// that needs it runs in another branch and sometimes in another session. That is only safe if the
// process is recorded, so this script writes a pid file beside the log — the pid, the port, the
// worktree, the exact command, the head, the manifest digest and the time — and `--stop` stops that
// pid's process tree and no other. Everything it prints on stdout is one JSON object, which is what
// the operator copies into the registry entry.
//
// The command is not invented here. It is the `dev` field of the route declaration when the
// declaration publishes one, then the `--command` the caller passes, and only then the conventional
// `npm run dev -- --port <port>`; a route that wants something else says so in the place a route is
// declared, not in an argument somebody remembered to pass.
//
// The build cache is not trusted across an install. A framework's dev server compiles into a cache
// under the worktree and serves from it, and a restart on a head whose dependency manifests moved
// keeps serving what the old dependencies compiled while node_modules holds the new ones. So a start
// digests the manifests the route declares plus the conventional lockfiles, compares the digest with
// the one the previously served record carries, and clears the conventional build caches before
// starting when they differ, when no previous record is known, or when `--clean` asks. The decision
// and its reason go into the record, because a cache nobody can prove was cleared is the same defect
// with a politer log line.
//
// The recorded pid is usually a wrapper (a package-manager or launcher process) and the listener on
// the port is its child. A stop therefore stops the whole tree of the recorded pid, then proves by
// connecting that the port no longer answers, and clears the pid file only then; when something still
// answers, the record stays and the result names the listener pid found by port, because a cleared
// record over a held port is exactly the conflict the next start would refuse on. The listener pid is
// recorded beside the wrapper pid when the two differ, so the registry can name the process that
// actually answers.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const HOST = '127.0.0.1';

// The lockfiles a package manager may keep beside a manifest; whichever exist are digested.
export const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
// The conventional build caches, relative to any package directory of the worktree. The route does
// not declare a build directory, so the list is the convention across frameworks, not one framework.
export const BUILD_CACHE_DIRS = ['.next', '.nuxt', '.output', '.svelte-kit', '.angular', '.parcel-cache', '.turbo', '.vite', 'node_modules/.vite', 'node_modules/.cache'];
export const CACHE_REASONS = ['asked', 'previous-unknown', 'manifests-changed', 'unchanged'];
const WALK_DEPTH = 3;
const SKIP_DIRS = new Set(['node_modules', '.git']);
const DEFAULT_WAIT = 15000;
const STOP_SETTLE = 1500;
const POLL = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// The pid listening on a port, read from the operating system's own socket table; null when nothing
// listens or the table cannot be read. This is how a surviving listener is named, never guessed.
export function listenerPidByPort(port) {
  try {
    if (process.platform === 'win32') {
      const table = execFileSync('netstat', ['-ano', '-p', 'tcp'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      for (const line of table.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/);
        if (cols.length >= 5 && cols[0] === 'TCP' && cols[3] === 'LISTENING' && cols[1].endsWith(`:${port}`)) return Number(cols[4]) || null;
      }
      return null;
    }
    try {
      const out = execFileSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (out) return Number(out.split(/\s+/)[0]) || null;
    } catch { /* fall through to ss */ }
    const out = execFileSync('ss', ['-ltnp'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    for (const line of out.split('\n')) if (line.includes(`:${port} `)) { const m = /pid=(\d+)/.exec(line); if (m) return Number(m[1]); }
    return null;
  } catch { return null; }
}

// The whole tree of a recorded pid: on Windows taskkill walks it, elsewhere the process group the
// detached start created is signalled as one, with the bare pid as the fallback.
export function killTree(pid) {
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); return true; } catch { return false; }
  }
  try { process.kill(-pid, 'SIGTERM'); return true; } catch { /* not a group leader, or already gone */ }
  try { process.kill(pid, 'SIGTERM'); return true; } catch { return false; }
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
  const out = { worktree: null, port: null, log: null, command: null, route: null, stop: null, status: null, clean: false, wait: DEFAULT_WAIT };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--log') out.log = path.resolve(argv[++i]);
    else if (a === '--command') out.command = argv[++i];
    else if (a === '--route') out.route = path.resolve(argv[++i]);
    else if (a === '--stop') out.stop = path.resolve(argv[++i]);
    else if (a === '--status') out.status = path.resolve(argv[++i]);
    else if (a === '--clean') out.clean = true;
    else if (a === '--wait') out.wait = Number(argv[++i]);
    else if (out.worktree === null) out.worktree = path.resolve(a);
    else if (out.port === null) out.port = Number(a);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

export const pidFileOf = (log) => `${log.replace(/\.log$/, '')}.pid`;
// The record of the server that ran before, kept when its pid file is cleared: the next start reads
// the head and the manifest digest from it to decide whether the build cache can be trusted.
export const previousFileOf = (log) => `${log.replace(/\.log$/, '')}.previous.json`;

export function readRecord(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

// Clearing a pid file never loses the record: it moves beside the log as the previous record.
function retire(pidFile, record, extra = {}) {
  if (record) writeJson(previousFileOf(pidFile.replace(/\.pid$/, '.log')), { ...record, ...extra });
  if (existsSync(pidFile)) unlinkSync(pidFile);
}

// A record is running when its wrapper or its listener still is.
const recordAlive = (record, isAlive) => Boolean(record && ((record.pid && isAlive(record.pid)) || (record.listenerPid && isAlive(record.listenerPid))));

// Stop the tree, then prove the port is free before the record goes. The dependencies are
// parameters so the spec can drive the port-still-held path without a server.
export async function stop(pidFile, { probe = portTaken, kill = killTree, listener = listenerPidByPort, isAlive = alive, settle = STOP_SETTLE } = {}) {
  const record = readRecord(pidFile);
  if (!record) return { stopped: false, reason: `no pid file at ${pidFile}` };
  const wasAlive = recordAlive(record, isAlive);
  let killed = false;
  if (wasAlive) {
    killed = kill(record.pid);
    if (record.listenerPid && record.listenerPid !== record.pid && isAlive(record.listenerPid)) kill(record.listenerPid);
    if (!killed && isAlive(record.pid)) return { stopped: false, pid: record.pid, port: record.port, reason: `the process tree of pid ${record.pid} could not be stopped; the pid file is kept` };
  }
  // Give the tree a moment to release the socket, then ask the port itself.
  const deadline = Date.now() + settle;
  let taken = await probe(record.port);
  while (taken && Date.now() < deadline) { await sleep(POLL); taken = await probe(record.port); }
  if (taken) {
    const survivor = listener(record.port);
    return {
      stopped: false, pid: record.pid, port: record.port, listenerPid: survivor,
      reason: `port ${record.port} still answers after the process tree of pid ${record.pid} was stopped; ${survivor ? `pid ${survivor} holds the listener` : 'the listener pid could not be read from the socket table'}. The pid file is kept until the port is free, so the next start cannot mistake this for a free port`,
    };
  }
  retire(pidFile, record, { stoppedAt: wasAlive ? new Date().toISOString() : null });
  if (!wasAlive) return { stopped: false, pid: record.pid, port: record.port, reason: 'the recorded process was already gone and the port is free; the record was cleared' };
  return { stopped: true, pid: record.pid, listenerPid: record.listenerPid ?? null, port: record.port };
}

export function headOf(worktree) {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worktree, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch { return null; }
}

// The manifests the route declares, plus every lockfile beside each of them and at the worktree
// root. A lockfile is where an install actually moves, and a route rarely lists it.
export function manifestPaths(routeConfig) {
  const declared = Array.isArray(routeConfig?.context?.manifests) ? routeConfig.context.manifests : [];
  const dirs = new Set(['.', ...declared.map((m) => path.posix.dirname(m))]);
  const files = new Set(declared);
  for (const dir of dirs) for (const lock of LOCKFILES) files.add(dir === '.' ? lock : path.posix.join(dir, lock));
  return [...files].sort();
}

export function manifestDigest(worktree, routeConfig) {
  const hash = createHash('sha256');
  const files = [];
  for (const rel of manifestPaths(routeConfig)) {
    const full = path.join(worktree, rel);
    if (!existsSync(full)) continue;
    files.push(rel);
    hash.update(`${rel}\n`);
    hash.update(readFileSync(full));
    hash.update('\n');
  }
  return { digest: `sha256:${hash.digest('hex')}`, files };
}

// The build caches present under the worktree: the conventional names at every package directory
// within reach, never inside node_modules except the two caches that live there by convention.
export function buildCacheDirs(worktree, depth = WALK_DEPTH) {
  const found = [];
  const visit = (dir, level) => {
    for (const name of BUILD_CACHE_DIRS) {
      const full = path.join(dir, name);
      if (existsSync(full) && statSync(full).isDirectory()) found.push(path.relative(worktree, full).split(path.sep).join('/'));
    }
    if (level >= depth) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name) || BUILD_CACHE_DIRS.includes(e.name)) continue;
      visit(path.join(dir, e.name), level + 1);
    }
  };
  visit(worktree, 0);
  return found.sort();
}

// Whether the cache can be trusted, and why not when it cannot. The previous record is what the
// last start wrote; no record, or one from before digests were recorded, is an unknown and an
// unknown is cleared.
export function cacheDecision({ clean = false, previous, digest }) {
  if (clean) return { clear: true, reason: 'asked' };
  if (!previous || !previous.head || !previous.manifestDigest) return { clear: true, reason: 'previous-unknown' };
  if (previous.manifestDigest !== digest) return { clear: true, reason: 'manifests-changed' };
  return { clear: false, reason: 'unchanged' };
}

export function clearBuildCache(worktree) {
  const dirs = buildCacheDirs(worktree);
  for (const rel of dirs) rmSync(path.join(worktree, rel), { recursive: true, force: true });
  return dirs;
}

// Wait for the port to answer and read the listener pid from the socket table; the record is
// updated in place so the registry can name the process that actually answers.
export async function recordListener(pidFile, { wait = DEFAULT_WAIT, probe = portTaken, listener = listenerPidByPort } = {}) {
  const record = readRecord(pidFile);
  if (!record) return null;
  const deadline = Date.now() + wait;
  let answered = await probe(record.port);
  while (!answered && Date.now() < deadline) { await sleep(POLL); answered = await probe(record.port); }
  const listenerPid = answered ? listener(record.port) : null;
  const updated = { ...record, listenerPid: listenerPid && listenerPid !== record.pid ? listenerPid : null, answered };
  writeJson(pidFile, updated);
  return updated;
}

// A live record is reusable when it serves exactly this head with exactly these manifests.
export const reusable = (record, head, digest) => Boolean(record && record.head && record.head === head && record.manifestDigest === digest);

export async function start({ worktree, port, log, command, route, clean = false, wait = DEFAULT_WAIT }) {
  if (!existsSync(worktree)) throw new Error(`no worktree at ${worktree}`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${port} is not a port`);
  if (!log) throw new Error('--log names the file the detached server writes to');
  mkdirSync(path.dirname(log), { recursive: true });
  const pidFile = pidFileOf(log);
  const routeConfig = route && existsSync(route) ? JSON.parse(readFileSync(route, 'utf8')) : null;
  const head = headOf(worktree);
  const { digest, files } = manifestDigest(worktree, routeConfig);
  const existing = readRecord(pidFile);
  // Idempotent by head, not by liveness: a live server is reused only while it serves this head with these
  // manifests; a server whose worktree moved under it is stopped and started again, or it would go on
  // answering for a head it no longer serves while the registry claimed otherwise.
  if (recordAlive(existing, alive)) {
    if (reusable(existing, head, digest)) return { ...existing, reused: true };
    const stopped = await stop(pidFile);
    if (!stopped.stopped) throw new Error(`the server on port ${port} serves ${existing.head ?? 'an unknown head'} and the worktree is at ${head}, but it could not be stopped: ${stopped.reason}`);
  } else if (existing) retire(pidFile, existing, { stoppedAt: null });
  if (await portTaken(port)) throw new Error(`port ${port} is held by another process${(() => { const p = listenerPidByPort(port); return p ? ` (pid ${p})` : ''; })()}; the port is fixed, so this is a conflict to coordinate and never a reason to move`);
  const cmd = commandFor({ routeConfig, command, port });
  const previous = readRecord(previousFileOf(log));
  const decision = cacheDecision({ clean, previous, digest });
  const cache = { cleared: decision.clear, reason: decision.reason, directories: decision.clear ? clearBuildCache(worktree) : [], previousHead: previous?.head ?? null };
  const out = openSync(log, 'a');
  const child = spawn(cmd, { cwd: worktree, shell: true, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  const record = { pid: child.pid, listenerPid: null, answered: false, port, worktree, command: cmd, logRef: log, pidFileRef: pidFile, startedAt: new Date().toISOString(), head, manifestDigest: digest, manifestFiles: files, cache };
  writeJson(pidFile, record);
  const attested = wait > 0 ? await recordListener(pidFile, { wait }) : record;
  return { ...attested, reused: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const emit = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  try {
    if (args.stop) emit(await stop(args.stop));
    else if (args.status) {
      let r = readRecord(args.status);
      if (r && !r.listenerPid && alive(r.pid)) r = await recordListener(args.status, { wait: 0 });
      emit(r ? { ...r, alive: recordAlive(r, alive) } : { alive: false });
    } else emit(await start(args));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  }
}
