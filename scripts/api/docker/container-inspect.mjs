// container-inspect.mjs — `docker inspect --format <format> <container>`: one container's state as the format prints it
// (scripts/gates/sonar-local.mjs reads the local SonarQube container's status and health this way).
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}: error = docker itself unavailable, status != 0 = no such container. */
export const containerInspect = (container, format, { docker = 'docker', timeout = 15_000 } = {}) =>
  dockerSpawn(['inspect', '--format', format, container], { docker, timeout });
