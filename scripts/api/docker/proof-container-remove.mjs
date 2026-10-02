// proof-container-remove.mjs - tear down exactly one proof container by id.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker rm --force <container id>`. */
export const proofContainerRemove = (container, { docker = 'docker', timeout = 30_000 } = {}) =>
  dockerSpawn(['rm', '--force', container], { docker, timeout });
