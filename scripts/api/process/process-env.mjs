// process-env.mjs - the ONE read of other processes' environment variables on the host.
//
// A process started inside an Orca terminal inherits ORCA_TERMINAL_HANDLE (and every child of it does), so the handle in a
// process's environment PROVES which terminal it belongs to, where a process name or a start time only guesses. The terminal
// worker close (scripts/machine/worker-close.mjs) reads it to find what a closed terminal left behind.
//
//   processEnv({names, pids, run, platform, timeoutMs}) -> [{pid, readable, values: {NAME: value|null}}] | null
//   names  the variable names to read (case-insensitive); pids  the processes to read (null: every process)
// readable is false for a process that cannot be opened (another user's, elevated, a 32-bit one): its values are null and prove
// nothing. Windows reads the PEB (processEnvScript); Linux reads /proc/<pid>/environ; elsewhere null (the table could not be read).
// Never throws.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { processEnvRowsOfJson, processEnvScript } from './lib.mjs';

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
