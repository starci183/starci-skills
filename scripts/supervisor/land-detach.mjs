// land-detach.mjs — the detached run of `starci supervisor land`. A land waits for its turn at the gate and then runs its checks
// for tens of minutes, longer than the command window of any agent or shell that types it; a caller that gave up killed the land it
// started, its ticket was cancelled and the wait and the checks were lost (registry entry supervisor-killed-its-own-land). A land
// typed without --foreground therefore runs in a child of its own session: the caller's timeout, interrupt or exit ends the wait
// for the answer and never the land. The child writes its JSON answer and its log next to each other under <lanesRoot>/land-runs.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnNode } from '../api/node/spawn-node.mjs';
import { lanesRoot } from '../machine/home.mjs';

const FOREGROUND = '--foreground';

/** The land arguments the child runs: the caller's own, the answer as JSON, and the flag that keeps the child from detaching again. */
export function foregroundArgv(argv) {
  const own = argv.filter((word) => word !== FOREGROUND && word !== '--json');
  return [FOREGROUND, '--json', ...own];
}

/** Starts the land in a detached child of its own session and returns {pid, runId, resultFile, logFile}; the caller is free to leave at once. */
export function startDetachedLand({ script, argv, env = process.env, spawn = spawnNode }) {
  const dir = path.join(lanesRoot({ env }), 'land-runs');
  fs.mkdirSync(dir, { recursive: true });
  const runId = `land-run-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const resultFile = path.join(dir, `${runId}.json`);
  const logFile = path.join(dir, `${runId}.log`);
  const out = fs.openSync(resultFile, 'a');
  const log = fs.openSync(logFile, 'a');
  const child = spawn([script, ...foregroundArgv(argv)], { detached: true, stdio: ['ignore', out, log], env });
  child.unref();
  fs.closeSync(out);
  fs.closeSync(log);
  return { pid: child.pid, runId, resultFile, logFile };
}

/** What the caller reads when the land started in the background. */
export const detachedLandLine = ({ pid, resultFile, logFile }) => `land started in the background (pid ${pid}); it outlives this command. The answer is ${resultFile} (log ${logFile}); starci supervisor land --status shows the queue, the land record is its final word. Use --foreground to wait here.`;
