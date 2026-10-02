// kill-tree.mjs — the ONE forced stop of a process tree on the host (taskkill /F /T /PID <pid>).
//
// Every runtime path that stops a tree it owns calls this: the GC sweep (scripts/supervisor/gc.mjs), the verified
// close (scripts/machine/close-verify.mjs reapOrphaned), the runaway-shim stop (scripts/supervisor/host-health.mjs
// stopTree) and the UAT listener restart
// (scripts/uat/env-health.mjs). Reconciler controllers do not import it: they go through ctx.run so shadow mode
// can record the stop instead of doing it.
//
//   killTree(pid, {timeoutMs, run, platform}) -> {ok, status, output}
//
// Never throws. Off Windows it stops nothing and says so (`ok: false`); a caller with a POSIX path keeps its own.
import { spawnSync } from 'node:child_process';

const KILL_TREE_COMMAND = 'taskkill.exe';
const killTreeArgs = (pid) => ['/F', '/T', '/PID', String(pid)];

export function killTree(pid, { timeoutMs = 60_000, run = spawnSync, platform = process.platform } = {}) {
  if (platform !== 'win32') return { ok: false, status: null, output: 'not windows' };
  try {
    const r = run(KILL_TREE_COMMAND, killTreeArgs(pid), { encoding: 'utf8', windowsHide: true, timeout: timeoutMs });
    return { ok: r?.status === 0, status: r?.status ?? null, output: String(r?.stdout || r?.stderr || r?.error?.message || '').trim().slice(0, 300) };
  } catch (error) {
    return { ok: false, status: null, output: String(error?.message ?? error).slice(0, 300) };
  }
}
