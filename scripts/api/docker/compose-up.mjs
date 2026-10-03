// compose-up.mjs - start one policy-checked Compose project and wait for its declared healthchecks.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker compose ... up -d --wait`; `files` includes the generated labels override. */
export const composeUp = ({ files, projectName, waitSeconds = 120, build = false }, { cwd, docker = 'docker', timeout } = {}) =>
  dockerSpawn([
    'compose', ...(cwd ? ['--project-directory', cwd] : []), ...files.flatMap((file) => ['-f', file]), '--project-name', projectName,
    'up', '-d', '--wait', '--wait-timeout', String(waitSeconds), ...(build ? ['--build'] : []),
  ], { docker, timeout: timeout ?? (Number(waitSeconds) + 30) * 1_000 });
