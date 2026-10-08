// compose-stop.mjs - stop the containers of the services named in the given Compose files, keeping them and their volumes.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker compose ... stop`; `env` is the environment Compose interpolates the files from. */
export const composeStop = ({ files, projectName }, { cwd, docker = 'docker', timeout = 120_000, env } = {}) =>
  dockerSpawn([
    'compose', ...(cwd ? ['--project-directory', cwd] : []), ...files.flatMap((file) => ['-f', file]), '--project-name', projectName, 'stop',
  ], { docker, timeout, ...(env ? { env } : {}) });
