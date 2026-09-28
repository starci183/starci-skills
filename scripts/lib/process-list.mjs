// process-list.mjs — the ONE read of the host's process table (Windows: Get-CimInstance Win32_Process; elsewhere `ps`).
//
// Every runtime census reads it: close-verify processTable, host-health listProcesses (with per-process CPU),
// reap-agent-process listAgentProcesses, git-index-lock listGitProcesses, resume-all listWatchdogs,
// and connectors/tunnel tunnelProcesses. Each keeps its own filter and row shape;
// the query, the JSON transport and the failure rule (null = the table could not be read) live here. Its sibling
// kill-tree.mjs is the one forced stop.
//
//   listHostProcesses({where, match, cmdMax, cpu, run, platform, timeoutMs})
//     -> [{pid, ppid, name, exe, cmd, created, ws, cpu?}] | null
//   where    a WQL filter for Win32_Process (e.g. "Name='node.exe'"); narrows the CIM read itself
//   match    a RegExp applied to the command line after the read (both platforms)
//   cmdMax   command-line characters kept per row (default 4000)
//   cpu      also read Win32_PerfFormattedData_PerfProc_Process: cpu = % of one core
// Never throws. Off Windows the rows come from `ps -eo pid=,ppid=,comm=,args=` (exe/created/ws are null there).
import { spawnSync } from 'node:child_process';

const psQuote = (s) => String(s).replace(/'/g, "''");

/** The PowerShell script of one read (exported for specs and diagnostics). */
export function processListScript({ where = null, cmdMax = 4000, cpu = false } = {}) {
  const filter = where ? ` -Filter '${psQuote(where)}'` : '';
  return [
    ...(cpu ? ['$perf = @{}', 'Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ForEach-Object { if ($_.IDProcess -gt 0) { $perf[[int]$_.IDProcess] = [double]$_.PercentProcessorTime } }'] : []),
    `Get-CimInstance Win32_Process${filter} | ForEach-Object { $c = [string]$_.CommandLine; [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = [string]$_.Name; exe = [string]$_.ExecutablePath;`,
    `  cmd = $c.Substring(0, [Math]::Min(${Number(cmdMax) || 4000}, $c.Length)); ws = [int64]$_.WorkingSetSize;`,
    `  created = $(if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 })${cpu ? '; cpu = $perf[[int]$_.ProcessId]' : ''} } } | ConvertTo-Json -Compress`,
  ].join('\n');
}

export function listHostProcesses({ where = null, match = null, cmdMax = 4000, cpu = false, run = spawnSync, platform = process.platform, timeoutMs = 120_000 } = {}) {
  try {
    let rows;
    if (platform === 'win32') {
      const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', processListScript({ where, cmdMax, cpu })],
        { encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
      if (!r || r.error || r.status !== 0) return null;
      const text = String(r.stdout ?? '').trim();
      const v = text ? JSON.parse(text) : [];
      rows = (Array.isArray(v) ? v : [v]).map((p) => ({ ...p, pid: Number(p.pid), ppid: Number(p.ppid), cmd: String(p.cmd ?? '') }));
    } else {
      const r = run('ps', ['-eo', 'pid=,ppid=,comm=,args='], { encoding: 'utf8', timeout: Math.min(timeoutMs, 30_000) });
      if (!r || r.error || r.status !== 0) return null;
      rows = String(r.stdout ?? '').split(/\r?\n/).map((line) => /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line)).filter(Boolean)
        .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3].split('/').pop(), exe: null, cmd: m[4].slice(0, cmdMax), created: null, ws: null }));
    }
    return match ? rows.filter((p) => match.test(p.cmd)) : rows;
  } catch { return null; }
}
