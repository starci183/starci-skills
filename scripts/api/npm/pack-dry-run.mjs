// pack-dry-run.mjs — `npm pack --dry-run --json --ignore-scripts` in a package directory: the file list npm would
// publish (scripts/gates/canon-digest.mjs packedFiles shapes it).
import { npmSpawn } from './lib.mjs';

/** {status, stdout, stderr, error} of the dry run. npm runs through the runner's absolute node + npm-cli.js target: no shell, no PATH lookup. */
export function packDryRun(directory, { spawn = npmSpawn } = {}) {
  const r = spawn(['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: directory });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
