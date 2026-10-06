// schtasks.mjs — one Windows Task Scheduler command (`schtasks.exe <args>`: /Run, /End of a named task), waited for. The
// reconciler restarts the harness UI and tunnel tasks this way. schtasks runs from its fixed System32 location. Returns
// the spawnSync result {status, stdout, stderr, error}.
import { spawnSync } from 'node:child_process';
import { toolUnavailableResult } from './lib.mjs';
import { systemTool } from './system-tool.mjs';

/** Runs `schtasks.exe <args>`; `timeout` (default 2 minutes) bounds it. */
export const schtasks = (args, { timeout = 120_000, spawn = spawnSync, tool = systemTool } = {}) => {
  const task = tool('schtasks');
  return task.ok ? spawn(task.path, args, { encoding: 'utf8', windowsHide: true, timeout }) : toolUnavailableResult(task);
};
