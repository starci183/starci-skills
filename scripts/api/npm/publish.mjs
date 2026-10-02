// publish.mjs - `npm publish --access public` in a package folder (its prepack, if any, runs): the one place the runtime
// publishes. Only scripts/gates/release-publish.mjs calls it, and only with --publish.
import { npmSpawn } from './lib.mjs';

/** {ok, status, stderr} of the publish in `dir`. `run` is the spawn seam of a spec. */
export function publish(dir, { run = npmSpawn } = {}) {
  const r = run(['publish', '--access', 'public'], { cwd: dir, timeout: 1_800_000, stdio: ['ignore', 'inherit', 'pipe'] });
  return { ok: !r.error && r.status === 0, status: r.status ?? null, stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
}
