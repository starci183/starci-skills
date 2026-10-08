// info-memory.mjs — `docker info --format {{.MemTotal}}`: the memory, in bytes, the docker daemon (its VM on Docker Desktop) can give containers (read-only; the release flow's Sonar stack check reads it).
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}: stdout is the byte count; error = docker itself unavailable, status != 0 = no daemon. */
export const infoMemory = ({ docker = 'docker', timeout = 20_000 } = {}) => dockerSpawn(['info', '--format', '{{.MemTotal}}'], { docker, timeout });
