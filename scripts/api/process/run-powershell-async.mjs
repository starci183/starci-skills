// run-powershell-async.mjs — one PowerShell script (`powershell -NoProfile -NonInteractive -Command <script>`) run WITHOUT
// blocking the calling thread: a host telemetry read (CPU cores, temperatures, disks) of the harness UI. The script is a
// fixed text of the caller, never built from request input.
import { execFile } from 'node:child_process';

/** Promise<string | null>: the script's stdout, or null when it failed, timed out or could not start. */
export const runPowershellAsync = (script, timeout = 8000) => new Promise((resolve) => {
  try {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout, windowsHide: true, maxBuffer: 1 << 20 },
      (error, stdout) => resolve(error ? null : String(stdout)));
  } catch { resolve(null); }
});
