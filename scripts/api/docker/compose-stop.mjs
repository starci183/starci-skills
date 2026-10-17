// compose-stop.mjs - stop the containers of the services named in the given Compose files, keeping them and their volumes.
import { dockerSpawn } from './lib.mjs';

/** The default Docker runner shares the injected argv spawn signature. */
const spawnDocker = (docker, args, options) => dockerSpawn(args, { docker, ...options });

/** The spawn result of `docker compose ... stop`; profiles match start, and env supplies interpolation only. */
export const composeStop = ({ files, projectName, profiles = [] }, { cwd, docker = 'docker', timeout = 120_000, env, spawn = spawnDocker } = {}) =>
  spawn(docker, [
    'compose', ...(cwd ? ['--project-directory', cwd] : []), ...files.flatMap((file) => ['-f', file]), '--project-name', projectName,
    ...profiles.flatMap((profile) => ['--profile', profile]), 'stop',
  ], { timeout, ...(cwd ? { cwd } : {}), ...(env ? { env } : {}) });
