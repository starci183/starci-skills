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

const psQuote = (s) => String(s).replaceAll("'", "''");

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
const PS_ROW_PARTS = [String.raw`^\s*`, String.raw`(\d+)`, String.raw`\s+`, String.raw`(\d+)`, String.raw`\s+`, String.raw`(\S+)`, String.raw`\s+`, '(.*)', '$'];
const PS_ROW = new RegExp(PS_ROW_PARTS.join(''));
export const processRowsOfPs = (text, cmdMax = 4000) => String(text ?? '').split(/\r?\n/).map((line) => PS_ROW.exec(line)).filter(Boolean)
  .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3].split('/').pop(), exe: null, cmd: m[4].slice(0, cmdMax), created: null, ws: null }));

// ---- the environment of other processes (process-env.mjs) -------------------------------------------------------

// Windows keeps a process's environment block in its PEB: PEB.ProcessParameters (+0x20) -> Environment (+0x80) and
// EnvironmentSize (+0x3F0), x64 only. A same-user process opens with PROCESS_QUERY_INFORMATION | PROCESS_VM_READ (0x0410).
export const PROCESS_ENV_NATIVE = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class StarciProcessEnv {
  [StructLayout(LayoutKind.Sequential)] struct PBI { public IntPtr Reserved1; public IntPtr PebBaseAddress; public IntPtr Reserved2a; public IntPtr Reserved2b; public IntPtr UniqueProcessId; public IntPtr Reserved3; }
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int cls, ref PBI pbi, int len, out int ret);
  [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr size, out IntPtr read);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern bool IsWow64Process(IntPtr h, out bool wow);
  static byte[] Read(IntPtr h, IntPtr addr, int size) {
    var buf = new byte[size]; IntPtr n;
    if (!ReadProcessMemory(h, addr, buf, (IntPtr)size, out n) || (int)n != size) return null;
    return buf;
  }
  public static Dictionary<string, string> Env(int pid) {
    var h = OpenProcess(0x0410, false, pid);
    if (h == IntPtr.Zero) return null;
    try { return EnvHandle(h); } finally { CloseHandle(h); }
  }
  public static Dictionary<string, string> EnvHandle(IntPtr h) {
      bool wow; if (IsWow64Process(h, out wow) && wow) return null;
      var pbi = new PBI(); int ret;
      if (NtQueryInformationProcess(h, 0, ref pbi, Marshal.SizeOf(pbi), out ret) != 0) return null;
      var peb = Read(h, pbi.PebBaseAddress + 0x20, 8); if (peb == null) return null;
      var parameters = (IntPtr)BitConverter.ToInt64(peb, 0);
      var envPtr = Read(h, parameters + 0x80, 8); if (envPtr == null) return null;
      var sizeBuf = Read(h, parameters + 0x3F0, 8); if (sizeBuf == null) return null;
      long size = BitConverter.ToInt64(sizeBuf, 0);
      if (size <= 0 || size > 4 * 1024 * 1024) return null;
      var block = Read(h, (IntPtr)BitConverter.ToInt64(envPtr, 0), (int)size); if (block == null) return null;
      var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
      foreach (var entry in Encoding.Unicode.GetString(block).Split('\0')) {
        if (entry.Length == 0) continue;
        int i = entry.IndexOf('=', 1); if (i < 0) continue;
        d[entry.Substring(0, i)] = entry.Substring(i + 1);
      }
      return d;
  }
}`;

/** The PowerShell script reading `names` from the environment of `pids` (every process when null): JSON [{pid, readable, values}]. */
export function processEnvScript({ names, pids = null }) {
  const wanted = JSON.stringify([...names].map(String));
  const ids = pids ? `@(${[...pids].map(Number).filter(Number.isInteger).join(',')})` : '(Get-Process).Id';
  return [
    `Add-Type -TypeDefinition @'${PROCESS_ENV_NATIVE}\n'@ -Language CSharp`,
    `$names = '${psQuote(wanted)}' | ConvertFrom-Json`,
    `$rows = foreach ($id in ${ids}) { $e = [StarciProcessEnv]::Env([int]$id); $v = [ordered]@{}; foreach ($n in $names) { $v[$n] = if ($null -ne $e -and $e.ContainsKey($n)) { $e[$n] } else { $null } }; [pscustomobject]@{ pid = [int]$id; readable = ($null -ne $e); values = $v } }`,
    '@($rows) | ConvertTo-Json -Compress -Depth 4',
  ].join('\n');
}

/** The rows of that script's JSON. */
export const processEnvRowsOfJson = (text) => {
  const t = String(text ?? '').trim();
  const v = t ? JSON.parse(t) : [];
  return (Array.isArray(v) ? v : [v]).map((r) => ({ pid: Number(r.pid), readable: r.readable === true, values: r.values ?? {} }));
};

/** The spawnSync-shaped result of a system tool the host does not carry (status null + error), for a caller that returns a spawn result. `refusal`: a systemTool refusal. */
export const toolUnavailableResult = (refusal) => ({ status: null, stdout: '', stderr: '', error: Object.assign(new Error(`${refusal.tool} is not in its fixed system location on ${refusal.platform}`), { code: refusal.code }) });

/** Promise<string | null>: stdout of one system tool run without blocking the calling thread (hidden window, 1 MiB), or null when the tool is absent, failed or timed out. `tool`: systemTool; `exec`: execFile. */
export const execSystemTool = (name, args, timeout, { exec, tool }) => new Promise((resolve) => {
  try {
    const found = tool(name);
    if (!found.ok) { resolve(null); return; }
    exec(found.path, args, { timeout, windowsHide: true, maxBuffer: 1 << 20 }, (error, stdout) => resolve(error ? null : String(stdout)));
  } catch { resolve(null); }
});
