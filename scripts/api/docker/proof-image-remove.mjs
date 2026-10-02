// proof-image-remove.mjs - remove exactly one already-recorded proof image by tag.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker image rm <tag>`. */
export const proofImageRemove = (tag, { docker = 'docker', timeout = 60_000 } = {}) =>
  dockerSpawn(['image', 'rm', tag], { docker, timeout });
