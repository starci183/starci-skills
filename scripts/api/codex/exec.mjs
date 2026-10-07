// exec.mjs — `codex exec`: one non-interactive Codex run (the headless call of tiers.yaml calls). The prompt goes in on stdin,
// each stdout line (the --json event stream) is handed to onLine as it arrives, stderr is kept as a bounded tail, and the run
// ends on the child's close or at timeoutMs, when `stop(pid)` (default: the child's own kill) is asked to end it. A child
// that has not closed `graceMs` after that stop resolves with exited false: its end is unproven. The runtime launches no
// agent terminal this way: an op reaches it only through `starci work imagegen`.
import { codexStart } from './lib.mjs';

const STDERR_TAIL = 4000;

/**
 * Resolves {code, signal, pid, timedOut, exited, error, stderr} once the child has closed or failed to start; never rejects.
 * `onSpawn(pid)` runs when the child has a pid; `stop(pid)` ends the child's whole tree at the deadline.
 */
export function exec(args, { input = '', cwd, env, timeoutMs, graceMs = 15_000, onLine = null, onSpawn = null, stop = null, command = null, prefix = null } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = codexStart(args, { cwd, env, command, prefix }); } catch (error) {
      resolve({ code: null, signal: null, pid: null, timedOut: false, exited: true, error: String(error?.message ?? error), stderr: '' });
      return;
    }
    let stderr = '', pending = '', timedOut = false, error = null, settled = false, deadline = null;
    const finish = (code, signal, exited = true) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (pending && onLine) onLine(pending);
      resolve({ code, signal, pid: child.pid ?? null, timedOut, exited, error, stderr });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      if (stop && child.pid) stop(child.pid);
      else child.kill();
      deadline = setTimeout(() => finish(null, null, false), graceMs);
    }, timeoutMs);
    const settle = (code, signal) => { clearTimeout(timer); finish(code, signal); };
    child.stdout.on('data', (data) => {
      const lines = (pending + data).split('\n');
      pending = lines.pop();
      if (onLine) for (const line of lines) onLine(line);
    });
    child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-STDERR_TAIL); });
    child.stdin.on('error', () => { /* a child that exits before reading its prompt is reported by its close */ });
    child.on('error', (failure) => { error = String(failure?.message ?? failure); settle(null, null); });
    child.on('close', settle);
    if (child.pid && onSpawn) onSpawn(child.pid);
    child.stdin.end(input);
  });
}
