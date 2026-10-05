// The release owner's npm publication edge: a directory retains its build lifecycle;
// an admitted archive is uploaded with lifecycle scripts disabled and an explicit channel.
import path from 'node:path';
import { npmSpawn } from './lib.mjs';

/**
 * Publish one admitted directory or exact archive; return the actual process outcome.
 * Archive identity/bytes and account authority are checked by the release gate before this effect.
 * @param {string} dir Owning package directory, also the process working directory.
 * @param {object} options Optional proved archive, explicit tag and owned process seam.
 * @returns {object} Numeric status and diagnostics; incomplete or signalled publication is never green.
 */
export function publish(dir, { archive = null, tag = 'latest', run = npmSpawn } = {}) {
  const args = ['publish', ...(archive ? [path.resolve(archive), '--ignore-scripts'] : []), '--access', 'public', '--tag', tag];
  const r = run(args, { cwd: dir, timeout: 1_800_000, stdio: ['ignore', 'inherit', 'pipe'] });
  return { ok: !r.error && !r.signal && r.status === 0, status: r.status ?? null, stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
}
