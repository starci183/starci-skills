// process-list-async.mjs — the host's process table read WITHOUT blocking the calling thread (process-list.mjs
// processList is the same read, synchronous). The reconciler engine (one process, one thread) must use this one: the
// sync read takes minutes on a loaded host (2026-09-29 14:06-14:15) and while it runs no timer fires, so the lease and
// the heartbeat lapse.
//
//   processListAsync({where, match, cmdMax, cpu, run, platform, timeoutMs}) -> Promise<[{...}] | null>
// Options are processList's; the seam is run(cmd, args, opts) -> Promise<{status, stdout}>. Never throws.
import { execFile } from 'node:child_process';
import { processListScript, processRowsOfJson, processRowsOfPs } from './lib.mjs';

const execAsync = (cmd, args, { timeout }) => new Promise((resolve) => {
  execFile(cmd, args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 256 * 1024 * 1024 }, (error, stdout) => {
    let status = 0;
    if (error) status = typeof error.code === 'number' ? error.code : null;
    resolve({ status, stdout: String(stdout ?? '') });
  });
});

/** The process table without blocking the thread: [{...}] | null. */
export async function processListAsync({ where = null, match = null, cmdMax = 4000, cpu = false, run = null, platform = process.platform, timeoutMs = 120_000 } = {}) {
  try {
    if (platform !== 'win32') {
      const r = await (run ?? execAsync)('ps', ['-eo', 'pid=,ppid=,comm=,args='], { timeout: Math.min(timeoutMs, 30_000) });
      if (r?.status !== 0) return null;
      const rows = processRowsOfPs(r.stdout, cmdMax);
      return match ? rows.filter((p) => match.test(p.cmd)) : rows;
    }
    const r = await (run ?? execAsync)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', processListScript({ where, cmdMax, cpu })], { timeout: timeoutMs });
    if (r?.status !== 0) return null;
    const rows = processRowsOfJson(r.stdout);
    return match ? rows.filter((p) => match.test(p.cmd)) : rows;
  } catch { return null; }
}
