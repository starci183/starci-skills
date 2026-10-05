// process-list.mjs — the synchronous host process-table read.
import { spawnSync } from 'node:child_process';
import { processListScript, processRowsOfJson, processRowsOfPs } from './lib.mjs';

/**
 * Synchronously read the host process table for caller-owned filtering.
 * `where` is a Windows WQL filter; `cpu` requests Windows per-core CPU values.
 * Other platforms use ps, with `exe`, `created` and `ws` left null. `cmdMax`
 * truncates command lines before the optional `match` RegExp filters rows.
 * Returns process rows, including an empty list, or null on query or parsing
 * failure. A caller must treat null as an unreadable table rather than no processes.
 */
export function processList({ where = null, match = null, cmdMax = 4000, cpu = false, run = spawnSync, platform = process.platform, timeoutMs = 120_000 } = {}) {
  try {
    let rows;
    if (platform === 'win32') {
      const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', processListScript({ where, cmdMax, cpu })],
        { encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
      if (!r || r.error || r.status !== 0) return null;
      rows = processRowsOfJson(r.stdout);
    } else {
      const r = run('ps', ['-eo', 'pid=,ppid=,comm=,args='], { encoding: 'utf8', timeout: Math.min(timeoutMs, 30_000) });
      if (!r || r.error || r.status !== 0) return null;
      rows = processRowsOfPs(r.stdout, cmdMax);
    }
    return match ? rows.filter((p) => match.test(p.cmd)) : rows;
  } catch { return null; }
}
