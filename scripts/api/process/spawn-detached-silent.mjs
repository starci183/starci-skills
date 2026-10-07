// spawn-detached-silent.mjs — start `node <script> ...args` detached and hidden, its stdio discarded, and keep watching
// whether it is gone (scripts/machine/self-reload.mjs hands over to its successor this way). Its sibling
// spawn-detached.mjs starts any file detached and returns the ChildProcess.
import { spawn } from 'node:child_process';
import { withTempEnv } from '../../../engine/temp-root.mjs';

/** spawn node <script> ...args detached and hidden, its stdio discarded; {pid, exited()}. */
export function spawnDetachedSilent({ execPath = process.execPath, script, args = [], env, cwd }) {
  let gone = false;
  const child = spawn(execPath, [script, ...args], withTempEnv({ detached: true, stdio: 'ignore', windowsHide: true, cwd, env }));
  child.on('exit', () => { gone = true; });
  child.on('error', () => { gone = true; });
  child.unref();
  return { pid: child.pid ?? null, exited: () => gone };
}
