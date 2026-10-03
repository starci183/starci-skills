import os from 'node:os';
import path from 'node:path';

/** Put the per-user starci shim first for Orca and every agent process it launches. */
export function addStarciShimToPath({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === 'path') ?? (platform === 'win32' ? 'Path' : 'PATH');
  const shim = path.join(home, '.starci', 'bin');
  const entries = String(env[key] ?? '').split(path.delimiter).filter(Boolean);
  const comparable = (entry) => platform === 'win32' ? path.resolve(entry).toLowerCase() : path.resolve(entry);
  const wanted = comparable(shim);
  env[key] = [shim, ...entries.filter((entry) => comparable(entry) !== wanted)].join(path.delimiter);
  return env[key];
}
