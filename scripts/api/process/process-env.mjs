// process-env.mjs — the host API for selected process-environment reads.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { processEnvRowsOfJson, processEnvScript } from './lib.mjs';

/**
 * Read selected host processes and return only the requested environment values.
 * `names` is an array matched case-insensitively; null `pids` scans all processes.
 * Windows reads x64 process memory; Linux reads `procRoot` environment files.
 * Rows carry `{pid,readable,values}`; null values mean an absent variable or an
 * unreadable process. `readable:false` provides no process-ownership proof.
 * Unsupported platforms and census or parsing failures return null, not an empty list.
 */
export function processEnv({ names, pids = null, run = spawnSync, platform = process.platform, timeoutMs = 60_000, procRoot = '/proc' } = {}) {
  try {
    if (platform === 'win32') {
      const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', processEnvScript({ names, pids })],
        { encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
      if (!r || r.error || r.status !== 0) return null;
      return processEnvRowsOfJson(r.stdout);
    }
    if (platform === 'linux') {
      const ids = pids ? [...pids] : fs.readdirSync(procRoot).filter((n) => /^\d+$/.test(n)).map(Number);
      return ids.map((pid) => {
        try {
          const entries = new Map(fs.readFileSync(`${procRoot}/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map((e) => [e.slice(0, e.indexOf('=')).toLowerCase(), e.slice(e.indexOf('=') + 1)]));
          return { pid, readable: true, values: Object.fromEntries(names.map((n) => [n, entries.get(String(n).toLowerCase()) ?? null])) };
        } catch { return { pid, readable: false, values: Object.fromEntries(names.map((n) => [n, null])) }; }
      });
    }
    return null;
  } catch { return null; }
}
