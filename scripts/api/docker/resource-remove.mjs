// resource-remove.mjs - remove already-selected Docker resource ids; selection stays in the machine policy layer.
import { dockerSpawn } from './lib.mjs';

const KINDS = new Set(['network', 'volume']);

/** One removal call for the supplied exact ids. An empty id list is rejected before Docker is invoked. */
export const resourceRemove = (kind, ids, { cwd, docker = 'docker', timeout = 60_000 } = {}) => {
  if (!KINDS.has(kind)) throw new TypeError(`docker resource remove kind must be network or volume, got ${kind}`);
  if (!Array.isArray(ids) || ids.length === 0) throw new TypeError('docker resource removal needs at least one selected id');
  return dockerSpawn([kind, 'rm', ...ids], { cwd, docker, timeout });
};
