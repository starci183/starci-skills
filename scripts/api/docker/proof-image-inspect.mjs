// proof-image-inspect.mjs - read the immutable id and byte size of one proof image.
import { dockerSpawn } from './lib.mjs';

/** The spawn result; stdout is `<image id>|<size in bytes>`. */
export const proofImageInspect = (tag, { docker = 'docker', timeout = 15_000 } = {}) =>
  dockerSpawn(['image', 'inspect', '--format', '{{.Id}}|{{.Size}}', tag], { docker, timeout });
