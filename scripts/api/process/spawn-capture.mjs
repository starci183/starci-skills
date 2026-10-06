// Capture one hidden child with a finite deadline and 4 MiB of raw bytes per stream.
// A deadline/transport failure is an unknown effect, never proof of process-tree closure. Never rejects.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

const CAP = 4 * 1024 * 1024;
const streamState = () => ({ chunks: [], seenBytes: 0, capturedBytes: 0, truncated: false });
const capture = (state, data) => {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  state.seenBytes = Math.min(Number.MAX_SAFE_INTEGER, state.seenBytes + bytes.length);
  const take = Math.min(bytes.length, CAP - state.capturedBytes);
  if (take) { state.chunks.push(Buffer.from(bytes.subarray(0, take))); state.capturedBytes += take; }
  if (take < bytes.length) state.truncated = true;
};
const textOf = state => {
  const decoder = new StringDecoder('utf8');
  const text = decoder.write(Buffer.concat(state.chunks, state.capturedBytes));
  return text + (state.truncated ? '' : decoder.end());
};
const countsOf = state => ({ seenBytes: state.seenBytes, capturedBytes: state.capturedBytes, truncated: state.truncated });

/** Resolves the existing code/stdout/stderr/timedOut shape plus capture completeness and recovery evidence. */
export const spawnCapture = (cmd, args, { cwd, env = process.env, timeoutMs = 120_000, spawnChild = spawn } = {}) => new Promise(resolve => {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    resolve({ code: null, stdout: '', stderr: '', timedOut: false, error: 'capture timeout must be finite positive milliseconds',
      processState: 'not-started', effectState: 'none', outputComplete: false }); return;
  }
  let child;
  try { child = spawnChild(cmd, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) {
    resolve({ code: null, stdout: '', stderr: '', timedOut: false, error: String(error?.message ?? error),
      processState: 'not-started', effectState: 'none', outputComplete: false }); return;
  }
  const stdout = streamState(), stderr = streamState();
  let timedOut = false, settled = false, spawned = Number.isInteger(child.pid) && child.pid > 0, closed = false;
  const timer = setTimeout(() => {
    if (settled) return;
    timedOut = true;
    try { child.kill('SIGKILL'); } catch { /* a kill request is not closure evidence */ }
    finish(null, 'capture deadline exceeded');
  }, timeoutMs);
  const finish = (code, error = null, signal = null) => {
    if (settled) return;
    settled = true; clearTimeout(timer);
    const truncated = stdout.truncated || stderr.truncated;
    const uncertain = spawned && (timedOut || truncated || error || !closed || signal);
    let processState = 'not-started';
    if (spawned) processState = 'unknown';
    if (closed) processState = 'closed';
    let effect = {};
    if (uncertain) effect = { effectState: 'unknown', recoveryRequired: true };
    else if (!spawned) effect = { effectState: 'none' };
    child.stdout?.destroy(); child.stderr?.destroy(); child.unref?.();
    resolve({ code, stdout: textOf(stdout), stderr: textOf(stderr), timedOut, pid: child.pid ?? null, signal,
      processState, outputComplete: closed && !timedOut && !truncated && !error && !signal,
      capture: { stdout: countsOf(stdout), stderr: countsOf(stderr) },
      ...effect,
      ...(error || truncated || signal ? { error: error ?? (truncated ? 'capture output exceeded its byte budget' : `child terminated by ${signal}`) } : {}) });
  };
  child.stdout?.on('data', data => { if (!settled) capture(stdout, data); });
  child.stderr?.on('data', data => { if (!settled) capture(stderr, data); });
  child.stdout?.on('error', error => finish(null, String(error?.message ?? error)));
  child.stderr?.on('error', error => finish(null, String(error?.message ?? error)));
  child.once('spawn', () => { spawned = true; });
  child.on('error', error => finish(null, String(error?.message ?? error)));
  child.once('close', (code, signal) => { closed = true; finish(code, null, signal); });
});
