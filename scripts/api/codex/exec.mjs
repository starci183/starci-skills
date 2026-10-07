// exec.mjs — `codex exec`: one non-interactive Codex run (the headless call of tiers.yaml calls). The prompt goes in on stdin,
// each stdout line (the --json event stream) is handed to onLine as it arrives, stderr is kept as a bounded tail, and the run
// ends on the child's close or at timeoutMs, when `stop(pid)` (default: the child's own kill) is asked to end it. A child
// that has not closed `graceMs` after that stop resolves with exited false: its end is unproven. The runtime launches no
// agent terminal this way: an op reaches it only through `starci work imagegen`.
import { codexStart } from './lib.mjs';

const STDERR_TAIL = 4000;

/** The result of a child that did not start. */
const startFailure = (error) => ({ code: null, signal: null, pid: null, timedOut: false, exited: true, error: String(error?.message ?? error), stderr: '' });

/** The stdout `data` appended to the run's pending partial line; each complete line goes to `onLine`. */
function feedLines(run, data, onLine) {
  const lines = (run.pending + data).split('\n');
  run.pending = lines.pop();
  if (onLine) for (const line of lines) onLine(line);
}

/** The run ends at its deadline: the child is stopped, and a child still open `graceMs` later settles with exited false. */
function stopAtDeadline(run, child, { stop, graceMs }) {
  run.timedOut = true;
  if (stop && child.pid) stop(child.pid);
  else child.kill();
  run.deadline = setTimeout(() => run.finish(null, null, false), graceMs);
}

/** Settles the run once: the last partial line is handed over, then the result resolves. */
function finisher(run, child, { onLine, resolve }) {
  return (code, signal, exited = true) => {
    if (run.settled) return;
    run.settled = true;
    clearTimeout(run.deadline);
    if (run.pending && onLine) onLine(run.pending);
    resolve({ code, signal, pid: child.pid ?? null, timedOut: run.timedOut, exited, error: run.error, stderr: run.stderr });
  };
}

/**
 * Resolves {code, signal, pid, timedOut, exited, error, stderr} once the child has closed or failed to start; never rejects.
 * `onSpawn(pid)` runs when the child has a pid; `stop(pid)` ends the child's whole tree at the deadline.
 */
export function exec(args, { input = '', cwd, env, timeoutMs, graceMs = 15_000, onLine = null, onSpawn = null, stop = null, command = null, prefix = null } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = codexStart(args, { cwd, env, command, prefix }); } catch (error) {
      resolve(startFailure(error));
      return;
    }
    const run = { stderr: '', pending: '', timedOut: false, error: null, settled: false, deadline: null };
    run.finish = finisher(run, child, { onLine, resolve });
    const timer = setTimeout(() => stopAtDeadline(run, child, { stop, graceMs }), timeoutMs);
    const settle = (code, signal) => { clearTimeout(timer); run.finish(code, signal); };
    child.stdout.on('data', (data) => feedLines(run, data, onLine));
    child.stderr.on('data', (data) => { run.stderr = (run.stderr + data).slice(-STDERR_TAIL); });
    child.stdin.on('error', () => { /* a child that exits before reading its prompt is reported by its close */ });
    child.on('error', (failure) => { run.error = String(failure?.message ?? failure); settle(null, null); });
    child.on('close', settle);
    if (child.pid && onSpawn) onSpawn(child.pid);
    child.stdin.end(input);
  });
}
