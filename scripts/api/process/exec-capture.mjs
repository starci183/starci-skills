// exec-capture.mjs — run `cmd args` as a hidden child WITHOUT blocking the calling thread and collect its whole output
// (up to 256 MiB): the reconciler's read-only probes (scripts/reconciler/services.mjs runChild) - a scheduled task's
// state, a connector's status, a runtime script's JSON answer. Never throws.
import { execFile } from 'node:child_process';

/** Promise<{status, stdout, stderr, timedOut}>; status is null when the child did not exit with a code. */
export const execCapture = (cmd, args, { timeoutMs = 60_000, env = process.env, cwd } = {}) => new Promise((resolve) => {
  execFile(cmd, args, { cwd, env, timeout: timeoutMs, windowsHide: true, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
    const timedOut = Boolean(error?.killed && error?.signal) || error?.code === 'ETIMEDOUT';
    let status = 0;
    if (error) status = typeof error.code === 'number' ? error.code : null;
    resolve({ status, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') || (error && !timedOut ? String(error.message) : ''), timedOut });
  });
});
