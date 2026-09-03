// @tools/host — serve one folder of static files on the loopback interface so a person can open it.
//
//   node scripts/host-artifacts.mjs <folder> [--receipt <path>] [--stop <pid>]
//
// The port is tried from 60000 upward to 60100; the first free one wins. The receipt (default
// <folder>/host.json) records url, port, folder, pid, the pages found and when the server stops.
// It never binds anything but 127.0.0.1, so nothing it serves leaves the machine. `--stop <pid>`
// ends a server this script started and marks its receipt stopped. The process stays in the
// foreground; a branch that ends or resumes stops it (SIGINT/SIGTERM) and the receipt says so.
import { createReadStream, existsSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
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
      server.once('error', (err) => { if (err.code === 'EADDRINUSE') resolve(false); else reject(err); });
      server.listen({ port: candidate, host: HOST, exclusive: true }, () => resolve(true));
    });
    if (bound) return candidate;
  }
  throw new Error(`no free port in ${PORT_RANGE.first}-${PORT_RANGE.last}`);
}

export async function start(folder, receiptPath = path.join(folder, 'host.json')) {
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
  const stop = () => {
    server.close();
    try { writeFileSync(receiptPath, `${JSON.stringify({ ...receipt, stoppedAt: new Date().toISOString() }, null, 2)}\n`); } catch { /* the folder may be gone */ }
  };
  return { server, receipt, stop };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').split('/').join(path.sep)) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.stop) {
    try { process.kill(opts.stop, 'SIGTERM'); console.log(`stopped ${opts.stop}`); } catch (e) { console.error(`host: ${e.message}`); process.exitCode = 1; }
  } else if (!opts.folder) {
    console.error('usage: node scripts/host-artifacts.mjs <folder> [--receipt <path>] | --stop <pid>'); process.exitCode = 2;
  } else {
    const { receipt, stop } = await start(opts.folder, opts.receipt ?? path.join(opts.folder, 'host.json'));
    console.log(`${receipt.url} (pid ${receipt.pid}, ${receipt.pages.length} page(s)); Ctrl+C or --stop ${receipt.pid} to end`);
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(0); });
  }
}
