// container-lifecycle.mjs — `docker start|stop <container>...`: start or stop EXISTING containers by exact name (the release flow starts the local SonarQube stack it
// needs and stops what it started, leaving the stack as it found it).
import { dockerSpawn } from './lib.mjs';

/** The spawnSync result {status, stdout, stderr, error}. `verb` is 'start' or 'stop'; names only (no pattern, no create, no remove). */
export const containerLifecycle = (verb, containers, { docker = 'docker', timeout = 120_000 } = {}) => {
  if (verb !== 'start' && verb !== 'stop') throw new Error(`containerLifecycle: ${verb} is not start or stop`);
  return dockerSpawn([verb, ...containers], { docker, timeout });
};
