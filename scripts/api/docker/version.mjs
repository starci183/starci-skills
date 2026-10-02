// version.mjs — `docker version --format {{.Server.Version}}`: whether a docker daemon answers (the release flow's Linux parity step needs one).
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}: stdout is the server version; error = docker itself unavailable, status != 0 = no daemon. */
export const version = ({ docker = 'docker', timeout = 20_000 } = {}) => dockerSpawn(['version', '--format', '{{.Server.Version}}'], { docker, timeout });
