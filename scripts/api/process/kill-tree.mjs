// kill-tree.mjs — the host API for a forced Windows process-tree stop.
import { spawnSync } from 'node:child_process';

const KILL_TREE_COMMAND = 'taskkill.exe';
const killTreeArgs = (pid) => ['/F', '/T', '/PID', String(pid)];

/**
 * Force-stop a caller-owned PID and its descendants with Windows taskkill.
 * The caller proves ownership and validates the PID; this API checks neither.
 * Non-Windows calls stop nothing and return `{ok:false,status:null,output}`.
 * Returns `{ok,status,output}` with bounded diagnostic text; spawn failures become
 * failure results. `ok` reflects taskkill's exit status without rechecking liveness.
 */
export function killTree(pid, { timeoutMs = 60_000, run = spawnSync, platform = process.platform } = {}) {
  if (platform !== 'win32') return { ok: false, status: null, output: 'not windows' };
  try {
    const r = run(KILL_TREE_COMMAND, killTreeArgs(pid), { encoding: 'utf8', windowsHide: true, timeout: timeoutMs });
    return { ok: r?.status === 0, status: r?.status ?? null, output: String(r?.stdout || r?.stderr || r?.error?.message || '').trim().slice(0, 300) };
  } catch (error) {
    return { ok: false, status: null, output: String(error?.message ?? error).slice(0, 300) };
  }
}
