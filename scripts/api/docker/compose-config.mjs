// compose-config.mjs - render one Compose file as the canonical JSON model used for policy checks.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker compose -f <file> config --format json`. */
export const composeConfig = (file, { cwd, docker = 'docker', timeout = 30_000 } = {}) =>
  dockerSpawn(['compose', ...(cwd ? ['--project-directory', cwd] : []), '-f', file, 'config', '--format', 'json'], { docker, timeout });
