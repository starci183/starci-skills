// whoami.mjs - `npm whoami`: the npm account logged in on this host (release-publish.mjs refuses a publish from another one).
import { npmSpawn } from './lib.mjs';

/** The npm account logged in on this host, or null. `run` is the spawn seam of a spec. */
export function whoami({ run = npmSpawn } = {}) {
  const r = run(['whoami'], { timeout: 60_000 });
  return !r.error && r.status === 0 ? String(r.stdout ?? '').trim() || null : null;
}
