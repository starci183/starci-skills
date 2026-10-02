// scripts/api/docker/lib.mjs — the runner of the docker CLI: `docker <args>` waited for, utf8 text, a hidden window, never a
// shell. The call file beside it (container-inspect.mjs) names its one use; nothing outside scripts/api/docker imports
// this runner.
import { spawnSync } from 'node:child_process';

/** `<docker> <args>` (docker: the binary, default docker on PATH); the spawnSync result {status, stdout, stderr, error}. */
export const dockerSpawn = (args, { docker = 'docker', timeout = 15_000 } = {}) => spawnSync(docker, args, { encoding: 'utf8', windowsHide: true, timeout });
