// schtasks.mjs — one Windows Task Scheduler command (`schtasks.exe <args>`: /Run, /End of a named task), waited for. The
// reconciler restarts the harness UI and tunnel tasks this way. Returns the spawnSync result {status, stdout, stderr, error}.
import { spawnSync } from 'node:child_process';

/** Runs `schtasks.exe <args>`; `timeout` (default 2 minutes) bounds it. */
export const schtasks = (args, { timeout = 120_000 } = {}) => spawnSync('schtasks.exe', args, { encoding: 'utf8', windowsHide: true, timeout });
