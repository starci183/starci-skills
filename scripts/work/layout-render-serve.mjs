// layout-render-serve.mjs — the dev server the runtime starts for one layout capture, and the only way a layout is served.
//
// The product app's shared i18n proxy (next-intl) rewrites a request to `http://localhost:<port>/<locale>`. A dev server pinned to
// another host name (`--hostname 127.0.0.1`) treats that rewrite as an external one and answers 307 to `/` for ever, so the
// server is started with no host pin and every URL the render visits names `localhost` (RENDER_HOST). A server the op started
// by hand makes the same mistake; the command guard refuses it and names `starci work layout-render`.
import fs from 'node:fs';
import path from 'node:path';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { probe } from '../api/http/probe.mjs';
import { serve } from '../api/http/serve.mjs';
import { killTree } from '../api/process/kill-tree.mjs';
import { startProgram } from '../api/process/start-program.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';
import { sleep } from '../lib/sleep.mjs';
import { findPackage } from '../lib/package-at.mjs';

export const RENDER_HOST = 'localhost';
const PROBE_MS = 400;
const LOG_TAIL_CHARS = 1200;

/** The scaffold's public-origin keys (modules/models/runtimes.yaml allocation.layoutRender.publicOriginKeys): the render's origin is each one's value. */
const publicOriginKeys = () => allocationSettings().layoutRender?.publicOriginKeys ?? [];

/** The `next` bin the app installs, resolved from the app's own directory: {bin, version} or null. */
export function nextBinOf(appRoot, find = findPackage) {
  const found = find([appRoot], ['next']);
  if (!found) return null;
  const bin = path.join(found.root, 'dist', 'bin', 'next');
  return fs.existsSync(bin) ? { bin, version: found.version } : null;
}

/** A free TCP port on this host, asked of the OS. */
export const freePort = () => new Promise((resolve, reject) => {
  const server = serve(() => undefined);
  server.once('error', reject);
  server.listen(0, () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

/** Start `next dev` for the app on `port`, its output in `logFile`, with no `--hostname`. Returns {child, logFile}. */
export function startDevServer({ appRoot, bin, port, logFile }) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.openSync(logFile, 'w');
  const child = startProgram(process.execPath, [bin, 'dev', '--port', String(port)], {
    cwd: appRoot,
    stdio: ['ignore', log, log],
    detached: process.platform !== 'win32',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ...Object.fromEntries(publicOriginKeys().map((key) => [key, `http://${RENDER_HOST}:${port}`])) },
  });
  child.on('close', () => fs.closeSync(log));
  return { child, logFile };
}

/** The last characters of the server's log, for a refusal's evidence. */
export function logTail(logFile) {
  try { return fs.readFileSync(logFile, 'utf8').slice(-LOG_TAIL_CHARS); } catch { return ''; }
}

/** The error lines the dev server logged (Next prefixes each with ⨯): a page it rendered over one is not a render of the layout. */
export const serverErrors = (logFile) => {
  try { return fs.readFileSync(logFile, 'utf8').split('\n').filter((line) => line.startsWith('⨯')).slice(0, 5); } catch { return []; }
};

/** Whether the server answered a request at `url` with any HTTP status (a connection refused or a hang is not an answer). */
const answered = async (url) => (await probe(url, { follow: 0, timeoutMs: allocationMs('layoutRender.readyMs') })).state === 'answered';

/** Resolve true when `url` answers any HTTP status before the server exits or readyMs passes; false otherwise. */
export function waitReady(url, child) {
  const deadline = Date.now() + allocationMs('layoutRender.readyMs');
  return repeatInOrder(async () => {
    if (child.exitCode !== null || Date.now() >= deadline) return false;
    if (await answered(url)) return true;
    await sleep(PROBE_MS);
    return undefined;
  });
}

/** SIGTERM to the process group of a server started detached (non-Windows); true when it was delivered. */
function signalGroup(pid) {
  try { process.kill(-pid, 'SIGTERM'); return true; } catch { return false; }
}

/** Stop the server this module started (its PID and the processes under it). */
export async function stopDevServer(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  const closed = new Promise((resolve) => child.once('close', resolve));
  const stopped = process.platform === 'win32' ? killTree(child.pid).ok : signalGroup(child.pid);
  if (!stopped) child.kill();
  await Promise.race([closed, sleep(allocationMs('layoutRender.stopMs'))]);
}
