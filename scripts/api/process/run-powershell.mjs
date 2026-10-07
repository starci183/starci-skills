// run-powershell.mjs — one PowerShell script (`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command
// <script>`), waited for: a host change the runtime makes through PowerShell (a scheduled task registered, an app
// restarted, a stuck listener stopped). The script is the caller's own text. PowerShell runs from its fixed System32
// location. Returns the spawnSync result {status, stdout, stderr, error} (utf8 text).
import { spawnSync } from 'node:child_process';
import { toolUnavailableResult } from './lib.mjs';
import { systemTool } from './system-tool.mjs';
import { withTempEnv } from '../fs/with-temp-env.mjs';

/** Runs `script`; `timeout` (default 2 minutes) bounds it, `env` is the child's environment. */
export const runPowershell = (script, { timeout = 120_000, env = process.env, spawn = spawnSync, tool = systemTool } = {}) => {
  const shell = tool('powershell');
  return shell.ok ? spawn(shell.path, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], withTempEnv({ encoding: 'utf8', windowsHide: true, timeout, env })) : toolUnavailableResult(shell);
};
