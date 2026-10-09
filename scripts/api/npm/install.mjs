// install.mjs — `npm install --prefer-offline --no-audit --no-fund` in a package directory: the NON-destructive install. It adds and updates what the manifest and lockfile
// ask for inside the directory's own node_modules and never deletes the tree first, so a failure (a file a running process holds) leaves the previous install in place.
// `npm ci` (ci.mjs) is for a tree nobody runs from; the harness UI, whose dev server may run from its node_modules, installs with this.
import { npmSpawn } from './lib.mjs';
import { withoutSeatEnv } from '../../lib/seat-env.mjs';

/** {ok, status, stderr} of the install in `cwd`. */
export const install = (cwd, { timeout = 900_000, env = process.env } = {}) => {
  const r = npmSpawn(['install', '--prefer-offline', '--no-audit', '--no-fund'], { cwd, timeout, env: withoutSeatEnv(env) });
  return { ok: !r.error && r.status === 0, status: r.status ?? null, stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
};
