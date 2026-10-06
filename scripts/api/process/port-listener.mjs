// port-listener.mjs — the process listening on a local TCP port, read from the host (Windows: `netstat -ano`, then the
// process's command line through PowerShell; elsewhere `lsof` then `ps`), every tool run from its fixed system location
// (system-tool.mjs); a Linux host without lsof reads /proc (the LISTEN socket's inode, then the process whose fd holds it).
// uat/env-health tells its own dev servers from a stranger holding the port this way. Never throws.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { systemTool } from './system-tool.mjs';

/** Linux without lsof: {pid, commandLine} of the process holding the LISTEN socket of `port` that /proc lets this user read, or null. */
function procListener(port, fsx) {
  const inodes = new Set();
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text;
    try { text = fsx.readFileSync(table, 'utf8'); } catch { continue; }
    for (const row of text.split('\n').slice(1)) {
      const f = row.trim().split(/\s+/);
      if (f[3] === '0A' && Number.parseInt(String(f[1]).split(':')[1], 16) === port) inodes.add(f[9]);
    }
  }
  if (!inodes.size) return null;
  for (const pid of fsx.readdirSync('/proc').filter((name) => /^\d+$/.test(name))) {
    let fds;
    try { fds = fsx.readdirSync(`/proc/${pid}/fd`); } catch { continue; }
    for (const fd of fds) {
      let target;
      try { target = fsx.readlinkSync(`/proc/${pid}/fd/${fd}`); } catch { continue; }
      const socket = /^socket:\[(\d+)\]$/.exec(target);
      if (!socket || !inodes.has(socket[1])) continue;
      let commandLine = null;
      try { commandLine = fsx.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim() || null; } catch { /* the process ended or hides its command line */ }
      return { pid: Number(pid), commandLine };
    }
  }
  return null;
}

/** {pid, commandLine} of the listener on `port`, or null (nothing listens, or the host could not say). */
export function portListener(port, { platform = process.platform, spawn = spawnSync, tool = (name) => systemTool(name, { platform }), fsx = fs } = {}) {
  try {
    if (platform === 'win32') {
      const netstat = tool('netstat');
      if (!netstat.ok) return null;
      const out = spawn(netstat.path, ['-ano'], { encoding: 'utf8', windowsHide: true, timeout: 15000 }).stdout ?? '';
      const line = out.split(/\r?\n/).find((l) => new RegExp(String.raw`^\s*TCP\s+\S*:${port}\s+\S+\s+LISTENING\s+(\d+)`, 'i').test(l));
      const pid = line ? Number(/LISTENING\s+(\d+)/i.exec(line)[1]) : null;
      if (!pid) return null;
      const shell = tool('powershell');
      if (!shell.ok) return { pid, commandLine: null };
      const cmd = spawn(shell.path, ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
      return { pid, commandLine: String(cmd.stdout ?? '').trim() || null };
    }
    const lsof = tool('lsof');
    if (!lsof.ok) return platform === 'linux' ? procListener(port, fsx) : null;
    const out = spawn(lsof.path, ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 15000 }).stdout ?? '';
    const pid = Number(out.split(/\s+/).find(Boolean));
    if (!pid) return null;
    const ps = tool('ps');
    const cmd = ps.ok ? spawn(ps.path, ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000 }) : null;
    return { pid, commandLine: String(cmd?.stdout ?? '').trim() || null };
  } catch { return null; }
}
