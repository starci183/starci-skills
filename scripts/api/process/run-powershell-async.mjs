// run-powershell-async.mjs — one PowerShell script (`powershell -NoProfile -NonInteractive -Command <script>`) run WITHOUT
// blocking the calling thread: a host telemetry read (CPU cores, temperatures, disks) of the harness UI. The script is a
// fixed text of the caller, never built from request input. PowerShell runs from its fixed System32 location.
import { execFile } from 'node:child_process';
import { execSystemTool } from './lib.mjs';
import { systemTool } from './system-tool.mjs';

/** Promise<string | null>: the script's stdout, or null when it failed, timed out, could not start or the host has no PowerShell. */
export const runPowershellAsync = (script, timeout = 8000, { exec = execFile, tool = systemTool } = {}) =>
  execSystemTool('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], timeout, { exec, tool });
