// scripts/api/process/lib.mjs — what the process call files beside it share: the spawn options every child of the
// runtime carries. The call files (process-list.mjs, kill-tree.mjs, run-shell.mjs, spawn-detached.mjs, set-priority.mjs,
// hide-child-windows.mjs, ...) each name one use of the host's process table or a child process.

/**
 * `list` with windowsHide: true added to its options argument. `hasArgv`:
 * the call's second argument may be an argv array (spawn, execFile) rather
 * than options (exec). An explicit windowsHide (true or false) is kept.
 */
export function withWindowsHide(list, hasArgv) {
  const out = [...list];
  let slot = 1;
  if (hasArgv && (Array.isArray(out[1]) || (out[1] == null && out.length > 2))) slot = 2;
  const options = out[slot];
  if (options == null) out.splice(slot, out.length > slot ? 1 : 0, { windowsHide: true });
  else if (typeof options === 'function') out.splice(slot, 0, { windowsHide: true });
  else if (typeof options === 'object' && !('windowsHide' in options)) out[slot] = { ...options, windowsHide: true };
  return out;
}

// ---- the host process table (process-list.mjs, process-list-async.mjs) ------------------------------------------

const psQuote = (s) => String(s).replace(/'/g, "''");

/** The PowerShell script of one process-table read: Win32_Process rows (optionally filtered), with CPU when asked. */
export function processListScript({ where = null, cmdMax = 4000, cpu = false } = {}) {
  const filter = where ? ` -Filter '${psQuote(where)}'` : '';
  return [
    ...(cpu ? ['$perf = @{}', 'Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ForEach-Object { if ($_.IDProcess -gt 0) { $perf[[int]$_.IDProcess] = [double]$_.PercentProcessorTime } }'] : []),
    `Get-CimInstance Win32_Process${filter} | ForEach-Object { $c = [string]$_.CommandLine; [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = [string]$_.Name; exe = [string]$_.ExecutablePath;`,
    `  cmd = $c.Substring(0, [Math]::Min(${Number(cmdMax) || 4000}, $c.Length)); ws = [int64]$_.WorkingSetSize;`,
    `  created = $(if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 })${cpu ? '; cpu = $perf[[int]$_.ProcessId]' : ''} } } | ConvertTo-Json -Compress`,
  ].join('\n');
}

/** The rows of the PowerShell read's JSON (one object or an array). */
export const processRowsOfJson = (text) => {
  const t = String(text ?? '').trim();
  const v = t ? JSON.parse(t) : [];
  return (Array.isArray(v) ? v : [v]).map((p) => ({ ...p, pid: Number(p.pid), ppid: Number(p.ppid), cmd: String(p.cmd ?? '') }));
};

/** The rows of `ps -eo pid=,ppid=,comm=,args=` (exe/created/ws are null there). */
export const processRowsOfPs = (text, cmdMax = 4000) => String(text ?? '').split(/\r?\n/).map((line) => /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line)).filter(Boolean)
  .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3].split('/').pop(), exe: null, cmd: m[4].slice(0, cmdMax), created: null, ws: null }));
