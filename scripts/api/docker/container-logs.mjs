// container-logs.mjs — `docker logs --tail <n> <container>`: the last lines one container printed (read-only; the release flow's Sonar stack check names why the server stopped from them).
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}: docker writes a container's stderr stream to its stderr, so a caller reads both. */
export const containerLogs = (container, { lines = 60, docker = 'docker', timeout = 20_000 } = {}) =>
  dockerSpawn(['logs', '--tail', String(lines), container], { docker, timeout });
