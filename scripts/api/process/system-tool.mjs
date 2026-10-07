// system-tool.mjs — the absolute path of one OS system tool, taken from FIXED directories no ordinary user can write:
// Windows <SystemRoot>\System32 (and the NVIDIA driver's own folders), POSIX /usr/bin, /bin, /usr/sbin, /sbin. A tool is
// never looked up through PATH, so a writable directory early on PATH cannot stand in for it. The process call files
// spawn the returned path; a tool the host does not carry is a typed refusal, which each caller turns into its own
// degraded answer (null, "unknown"), never a crash.
import fs from 'node:fs';
import path from 'node:path';
import { readEnv } from '../../lib/env.mjs';

const DEFAULT_SYSTEM_ROOT = ['C:', 'Windows'].join(path.win32.sep);
const POSIX_DIRS = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'];
// Windows: path segments under <SystemRoot>\System32 (nvidia-smi also under <drive>\Program Files\NVIDIA Corporation\NVSMI, its legacy home).
const WINDOWS_TOOLS = {
  cmd: [['cmd.exe']], powershell: [['WindowsPowerShell', 'v1.0', 'powershell.exe']], schtasks: [['schtasks.exe']], netstat: [['NETSTAT.EXE']], tasklist: [['tasklist.exe']],
  'nvidia-smi': [['nvidia-smi.exe'], ['..', '..', 'Program Files', 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe']],
};
const POSIX_TOOLS = { sh: 'sh', lsof: 'lsof', ps: 'ps', 'nvidia-smi': 'nvidia-smi' };

const refusal = (tool, platform) => ({ ok: false, code: 'SYSTEM_TOOL_UNAVAILABLE', tool, platform });

/** {ok: true, path} (absolute, existing) or the typed refusal {ok: false, code: 'SYSTEM_TOOL_UNAVAILABLE', tool, platform}. `exists` is the file probe. */
export function systemTool(tool, { platform = process.platform, env = process.env, exists = (file) => fs.existsSync(file) } = {}) {
  if (platform === 'win32') {
    const root = readEnv('SystemRoot', env) ?? readEnv('SYSTEMROOT', env) ?? readEnv('windir', env) ?? readEnv('WINDIR', env) ?? DEFAULT_SYSTEM_ROOT;
    const system32 = path.win32.join(root, 'System32');
    for (const rel of Object.hasOwn(WINDOWS_TOOLS, tool) ? WINDOWS_TOOLS[tool] : []) {
      const file = path.win32.join(system32, ...rel);
      if (exists(file)) return { ok: true, path: file };
    }
    return refusal(tool, platform);
  }
  for (const dir of Object.hasOwn(POSIX_TOOLS, tool) ? POSIX_DIRS : []) {
    const file = path.posix.join(dir, POSIX_TOOLS[tool]);
    if (exists(file)) return { ok: true, path: file };
  }
  return refusal(tool, platform);
}
