// compose-down.mjs - the safe down call: remove only Compose container ids already selected by both ownership labels.
// It intentionally never runs `docker compose down`, whose project-wide selection can include unlabelled resources.
import { dockerSpawn } from './lib.mjs';

/** One `docker rm -f` call over exact, non-empty container ids selected by the machine policy layer. */
export const composeDown = (ids, { docker = 'docker', timeout = 60_000 } = {}) => {
  if (!Array.isArray(ids) || ids.length === 0) throw new TypeError('docker compose down needs at least one selected container id');
  return dockerSpawn(['rm', '-f', ...ids], { docker, timeout });
};
