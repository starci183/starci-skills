// install.mjs - `npm install --save-exact` for already-resolved package versions.
// The caller resolves canon pins and refuses ranges before this call file reaches npm.
import { npmSpawn } from './lib.mjs';

/** {ok, status, stdout, stderr} for exact package specs installed in `cwd`. */
export const install = (cwd, packages, { dev = false, timeout = 900_000 } = {}) => {
  const args = ['install', '--save-exact', ...(dev ? ['--save-dev'] : []), ...packages];
  const result = npmSpawn(args, { cwd, timeout });
  return {
    ok: !result.error && result.status === 0,
    status: result.status ?? null,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? result.error?.message ?? '').trim()
  };
};
