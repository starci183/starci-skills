// run-powershell.mjs — one PowerShell script (`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command
// <script>`), waited for: a host change the runtime makes through PowerShell (a scheduled task registered, an app
// restarted, a stuck listener stopped). The script is the caller's own text. Returns the spawnSync result
// {status, stdout, stderr, error} (utf8 text).
import { spawnSync } from 'node:child_process';

/** Runs `script`; `timeout` (default 2 minutes) bounds it, `env` is the child's environment. */
export const runPowershell = (script, { timeout = 120_000, env = process.env } = {}) =>
  spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout, env });
