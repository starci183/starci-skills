// @tools/host — serve one folder of static files on the loopback interface so a person can open it.
//
//   node scripts/host-artifacts.mjs <folder> [--receipt <path>] [--stop <pid>]
//
// The port is tried from 60000 upward to 60100; the first free one wins. The receipt (default
// <folder>/host.json) records url, port, folder, pid, the pages found and when the server stops.
// It never binds anything but 127.0.0.1, so nothing it serves leaves the machine. `--stop <pid>`
// ends a server this script started and marks its receipt stopped. The process stays in the
// foreground; a branch that ends or resumes stops it (SIGINT/SIGTERM) and the receipt says so.
//
// A server is asked to stop by a marker it polls itself, never by a signal alone: only the process
// that holds the receipt can complete it, and a signal does not always leave it the chance —
// Node implements SIGTERM on Windows as a hard terminate, so a receipt closed that way never gains
// its stoppedAt and reads as a server still running. The marker is a file named after the pid in the
// system temp folder, which is the one address a stopper holding nothing but a pid can compute; the
// server removes a stale one at start, honours a fresh one within a poll, and the stopper terminates
// only a server that has not answered within the grace period.
import { createReadStream, existsSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

export const PORT_RANGE = { first: 60000, last: 60100 };
export const HOST = '127.0.0.1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function parseArgs(argv) {
  const out = { folder: null, receipt: null, stop: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--receipt') out.receipt = path.resolve(argv[++i]);
    else if (a === '--stop') out.stop = Number(argv[++i]);
    else if (!out.folder) out.folder = path.resolve(a);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

export function pagesOf(folder) {
  return readdirSync(folder).filter((f) => f.endsWith('.html')).sort().map((f) => ({ file: f, path: `/${f}` }));
}

function serve(folder) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${HOST}`);
    let file = path.join(folder, decodeURIComponent(url.pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const inside = path.resolve(file).startsWith(path.resolve(folder));
    if (!inside || !existsSync(file) || statSync(file).isDirectory()) {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        // No index: list the pages so a person can pick one.
        const list = pagesOf(folder).map((p) => `<li><a href="${p.path}">${p.file}</a></li>`).join('');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>artifacts</title><ul>${list}</ul>`);
        return;
      }
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
}

// On Windows libuv binds TCP servers with address reuse, so two servers can bind one loopback port
// without EADDRINUSE. A port is therefore judged taken by connecting to it: an accepted connection
// means someone answers there, a refused one means it is free.
export function portTaken(port) {
  return new Promise((resolve) => {
    const probe = net.connect({ port, host: HOST });
    probe.once('connect', () => { probe.destroy(); resolve(true); });
    probe.once('error', () => resolve(false));
  });
}

export async function listen(server, port = PORT_RANGE.first) {
  for (let candidate = port; candidate <= PORT_RANGE.last; candidate += 1) {
    if (await portTaken(candidate)) continue;
    const bound = await new Promise((resolve, reject) => {
      const cleanup = () => { server.off('error', onError); server.off('listening', onListening); };
      const onError = (err) => {
        cleanup();
        // Windows excluded port ranges cannot be bound even when no listener answers.
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') resolve(false);
        else reject(err);
      };
      const onListening = () => { cleanup(); resolve(true); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen({ port: candidate, host: HOST, exclusive: true });
    });
    if (bound) return candidate;
  }
  throw new Error(`no free port in ${PORT_RANGE.first}-${PORT_RANGE.last}`);
}

// The address of a stop request: a file named after the pid in the system temp folder. A stopper holds
// a pid and nothing else, and the server holds its receipt, so this name is what the two share.
export const stopMarker = (pid, dir = tmpdir()) => path.join(dir, `starci-host-${pid}.stop`);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const remove = (file) => { try { if (existsSync(file)) rmSync(file); } catch { /* another process got there first */ } };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms).unref?.(); });

// Ask the server at `pid` to stop and give it the grace period to complete its own receipt; terminate
// only one that never answered. Returns how it ended: `stopped` (the marker was honoured), `terminated`
// (the grace period passed and the process was killed) or `gone` (nothing was running there).
export async function requestStop(pid, { dir = tmpdir(), graceMs = 5000, pollMs = 100, terminate = true } = {}) {
  if (!alive(pid)) return 'gone';
  const marker = stopMarker(pid, dir);
  writeFileSync(marker, `${new Date().toISOString()}\n`);
  for (let waited = 0; waited < graceMs; waited += pollMs) {
    await sleep(pollMs);
    if (!alive(pid)) return 'stopped';
  }
  remove(marker);
  if (!terminate) return 'stopped';
  try { process.kill(pid, 'SIGTERM'); } catch { /* it ended between the last poll and here */ }
  return 'terminated';
}

export async function start(folder, receiptPath = path.join(folder, 'host.json'), { markerDir = tmpdir(), pollMs = 100, onStopped = null } = {}) {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error(`${folder} is not a folder`);
  const server = serve(folder);
  const port = await listen(server);
  const receipt = {
    url: `http://${HOST}:${port}/`, port, folder: folder.split(path.sep).join('/'), pid: process.pid, interface: 'loopback',
    portRange: `${PORT_RANGE.first}-${PORT_RANGE.last}`, startedAt: new Date().toISOString(),
    pages: pagesOf(folder).map((p) => ({ file: p.file, url: `http://${HOST}:${port}${p.path}` })),
    stopsWhen: 'the branch ends or is resumed',
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const marker = stopMarker(receipt.pid, markerDir);
  remove(marker); // a marker left by an earlier server with this pid stops nobody
  let watcher = null;
  const stop = () => {
    if (watcher) { clearInterval(watcher); watcher = null; }
    remove(marker);
    server.close();
    try { writeFileSync(receiptPath, `${JSON.stringify({ ...receipt, stoppedAt: new Date().toISOString() }, null, 2)}\n`); } catch { /* the folder may be gone */ }
  };
  watcher = setInterval(() => { if (existsSync(marker)) { stop(); onStopped?.(); } }, pollMs);
  watcher.unref?.(); // the server is what keeps the process alive, never the poll
  return { server, receipt, stop, marker };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').split('/').join(path.sep)) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.stop) {
    const ended = await requestStop(opts.stop);
    if (ended === 'gone') { console.error(`host: no server is running at pid ${opts.stop}`); process.exitCode = 1; }
    else console.log(`${ended} ${opts.stop}${ended === 'terminated' ? '; it never answered the stop marker, so its receipt has no stoppedAt' : ''}`);
  } else if (!opts.folder) {
    console.error('usage: node scripts/host-artifacts.mjs <folder> [--receipt <path>] | --stop <pid>'); process.exitCode = 2;
  } else {
    const { receipt, stop } = await start(opts.folder, opts.receipt ?? path.join(opts.folder, 'host.json'), { onStopped: () => process.exit(0) });
    console.log(`${receipt.url} (pid ${receipt.pid}, ${receipt.pages.length} page(s)); Ctrl+C or --stop ${receipt.pid} to end`);
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(0); });
  }
}
