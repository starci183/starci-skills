// pack-dry-run.mjs — `npm pack --dry-run --json --ignore-scripts` in a package directory: the file list npm would
// publish (scripts/lib/canon-digest.mjs packedFiles shapes it).
import { spawnSync } from 'node:child_process';

/** {status, stdout, stderr, error} of the dry run. */
export function npmPackDryRun(directory) {
  // One fixed command string (no arguments to escape): npm is a .cmd shim on Windows, so it runs through the shell.
  const r = spawnSync('npm pack --dry-run --json --ignore-scripts', { cwd: directory, encoding: 'utf8', shell: true, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
