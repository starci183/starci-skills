// run.mjs — `docker run --rm <args>`: one throwaway container waited for (the release flow's Linux parity step). The caller names it, mounts, and gives the image and command;
// options pass to spawnSync (stdio to a log file, timeout). No port is published and no host network is joined by this call file.
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}. `args` follow `docker run --rm` (name, mounts, env, image, command). */
export const run = (args, { docker = 'docker', timeout = 3_600_000, ...options } = {}) => dockerSpawn(['run', '--rm', ...args], { docker, timeout, ...options });
