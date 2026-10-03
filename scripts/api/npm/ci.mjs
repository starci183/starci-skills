// ci.mjs — `npm ci --prefer-offline --no-audit --no-fund` in a package directory: a REAL install of the lockfile into the
// directory's own node_modules, served from the npm cache when it can be. A checkout never borrows another checkout's
// node_modules through a junction or a symlink (RT_NODE_MODULES_LINK); a scratch or staging tree installs its own.
import { npmSpawn } from './lib.mjs';

/** {ok, status, stderr} of the install in `cwd` (a directory holding package.json and package-lock.json); `workspaces` limits it to those workspaces. */
export const ci = (cwd, { timeout = 900_000, workspaces = [] } = {}) => {
  const r = npmSpawn(['ci', '--prefer-offline', '--no-audit', '--no-fund', ...workspaces.flatMap((name) => ['--workspace', name])], { cwd, timeout });
  return { ok: !r.error && r.status === 0, status: r.status ?? null, stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
};
