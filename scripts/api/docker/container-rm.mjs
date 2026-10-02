// container-rm.mjs — `docker rm -f <container>`: remove ONE container by its exact name (the release flow's own parity container after a timeout).
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}. A single exact name: no list, no pattern, no volumes. */
export const containerRm = (container, { docker = 'docker', timeout = 60_000 } = {}) => dockerSpawn(['rm', '-f', container], { docker, timeout });
