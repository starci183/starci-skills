// compose-up.mjs - start one policy-checked Compose project and, unless the caller says otherwise, wait for its declared healthchecks.
import { dockerSpawn } from './lib.mjs';

/**
 * The spawn result of `docker compose ... up -d [--wait]`; `files` includes the generated labels override. `env` is the child
 * environment Compose interpolates the files from (a caller passing secrets hands them here, never on argv); `wait: false`
 * returns once the containers are started, for a stack with a one-shot service.
 */
export const composeUp = ({ files, projectName, waitSeconds = 120, build = false, wait = true }, { cwd, docker = 'docker', timeout, env } = {}) =>
  dockerSpawn([
    'compose', ...(cwd ? ['--project-directory', cwd] : []), ...files.flatMap((file) => ['-f', file]), '--project-name', projectName,
    'up', '-d', ...(wait ? ['--wait', '--wait-timeout', String(waitSeconds)] : []), ...(build ? ['--build'] : []),
  ], { docker, timeout: timeout ?? (Number(waitSeconds) + 30) * 1_000, ...(env ? { env } : {}) });
