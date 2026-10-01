// port-listener.mjs — the process listening on a local TCP port, read from the host (Windows: `netstat -ano`, then the
// process's command line through PowerShell; elsewhere `lsof` then `ps`). uat/env-health tells its own dev servers from a
// stranger holding the port this way. Never throws.
import { spawnSync } from 'node:child_process';

/** {pid, commandLine} of the listener on `port`, or null (nothing listens, or the host could not say). */
export function portListener(port, { platform = process.platform } = {}) {
  try {
    if (platform === 'win32') {
      const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true, timeout: 15000 }).stdout ?? '';
      const line = out.split(/\r?\n/).find((l) => new RegExp(`^\\s*TCP\\s+\\S*:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i').test(l));
      const pid = line ? Number(/LISTENING\s+(\d+)/i.exec(line)[1]) : null;
      if (!pid) return null;
      const cmd = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
      return { pid, commandLine: String(cmd.stdout ?? '').trim() || null };
    }
    const out = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 15000 }).stdout ?? '';
    const pid = Number(out.split(/\s+/).find(Boolean));
    if (!pid) return null;
    const cmd = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000 });
    return { pid, commandLine: String(cmd.stdout ?? '').trim() || null };
  } catch { return null; }
}
