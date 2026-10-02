// exec-as-spawn-sync.mjs — run one recorded spawnSync call ({command, argv, options}) asynchronously and answer it the way
// spawnSync would ({pid, output, stdout, stderr, status, signal}): the Kernel's `api status` prefetches its Orca reads in
// parallel this way (scripts/kernel/cli.mjs prefetchStatusOrcaReads). Never rejects.
import { execFile } from 'node:child_process';

/** Promise of the spawnSync-shaped result, or null when the child did not exit on its own (a start error, a kill). */
export const execAsSpawnSync = ({ command, argv, options }) => new Promise((resolve) => {
  try {
    execFile(command, argv, { encoding: options.encoding ?? 'buffer', timeout: options.timeout ?? 0, maxBuffer: options.maxBuffer ?? 1024 * 1024,
      windowsHide: options.windowsHide ?? true, ...(options.cwd ? { cwd: options.cwd } : {}), ...(options.env ? { env: options.env } : {}) }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') return resolve(null);
      resolve({ pid: 0, output: [null, stdout, stderr], stdout, stderr, status: error ? error.code : 0, signal: null });
    });
  } catch { resolve(null); }
});
