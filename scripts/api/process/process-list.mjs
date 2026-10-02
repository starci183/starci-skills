// process-list.mjs — the ONE read of the host's process table (Windows: Get-CimInstance Win32_Process; elsewhere `ps`).
//
// Every runtime census reads it: close-verify processTable, host-health listProcesses (with per-process CPU),
// git-index-lock listGitProcesses, resume-all listWatchdogs,
// and connectors/tunnel tunnelProcesses. Each keeps its own filter and row shape;
// the query and the row parsing live in lib.mjs (processListScript, processRowsOfJson, processRowsOfPs), the failure
// rule (null = the table could not be read) here. Its sibling kill-tree.mjs is the one forced stop.
//
//   processList({where, match, cmdMax, cpu, run, platform, timeoutMs})
//     -> [{pid, ppid, name, exe, cmd, created, ws, cpu?}] | null
//   where    a WQL filter for Win32_Process (e.g. "Name='node.exe'"); narrows the CIM read itself
//   match    a RegExp applied to the command line after the read (both platforms)
//   cmdMax   command-line characters kept per row (default 4000)
//   cpu      also read Win32_PerfFormattedData_PerfProc_Process: cpu = % of one core
// The same read WITHOUT blocking the calling thread is process-list-async.mjs processListAsync.
// Never throws. Off Windows the rows come from `ps -eo pid=,ppid=,comm=,args=` (exe/created/ws are null there).
import { spawnSync } from 'node:child_process';
import { processListScript, processRowsOfJson, processRowsOfPs } from './lib.mjs';

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
