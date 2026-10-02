// spawn-capture.mjs — run `cmd args` as a hidden child WITHOUT blocking the calling thread, its stdout and stderr captured
// (4 MiB each) and a timeout that kills it: the reconciler's actuator (scripts/reconciler/ctx.mjs spawnJson) runs every
// api child, runtime script and host command this way. Never rejects.
import { spawn } from 'node:child_process';

/** Promise<{code, stdout, stderr, timedOut, error?}>; `error` names a start failure or the child's 'error' event. */
export const spawnCapture = (cmd, args, { cwd, env = process.env, timeoutMs }) => new Promise((resolve) => {
  let child;
  try { child = spawn(cmd, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { resolve({ code: null, stdout: '', stderr: '', timedOut: false, error: String(error?.message ?? error) }); return; }
  let stdout = '', stderr = '', timedOut = false, settled = false;
  const cap = 4 * 1024 * 1024;
  child.stdout.on('data', (d) => { if (stdout.length < cap) stdout += d; });
  child.stderr.on('data', (d) => { if (stderr.length < cap) stderr += d; });
  const timer = setTimeout(() => { timedOut = true; try { child.kill(); } catch { /* gone */ } }, timeoutMs);
  const finish = (code, error = null) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolve({ code, stdout, stderr, timedOut, ...(error ? { error } : {}) });
  };
  child.on('error', (error) => finish(null, String(error?.message ?? error)));
  child.on('close', (code) => finish(code));
});
