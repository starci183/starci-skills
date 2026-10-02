// register.mjs - make exactly one PowerShell call to register a reviewed Windows scheduled-task script.
import { spawnSync } from 'node:child_process';

/** Run one generated Register-ScheduledTask script without a shell. */
export const registerScheduledTask = (script, { env = process.env, powershell = 'powershell.exe', timeout = 120_000 } = {}) =>
  spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8', env, windowsHide: true, timeout,
  });
