// compose-ps.mjs - read the containers of one Compose project as JSON after `up --wait`.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker compose ... ps --format json`. */
export const composePs = ({ files, projectName }, { cwd, docker = 'docker', timeout = 30_000 } = {}) =>
  dockerSpawn(['compose', ...(cwd ? ['--project-directory', cwd] : []), ...files.flatMap((file) => ['-f', file]), '--project-name', projectName, 'ps', '--format', 'json'], { docker, timeout });
