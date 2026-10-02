// resource-list.mjs - query Docker networks or volumes by exact labels before a scoped removal.
import { dockerSpawn } from './lib.mjs';

const KINDS = new Set(['network', 'volume']);

/** The spawn result of `docker <kind> ls -q --filter ...`; only network and volume are admitted. */
export const resourceList = (kind, filters, { cwd, docker = 'docker', timeout = 30_000 } = {}) => {
  if (!KINDS.has(kind)) throw new TypeError(`docker resource list kind must be network or volume, got ${kind}`);
  return dockerSpawn([kind, 'ls', '-q', ...filters.flatMap((filter) => ['--filter', filter])], { cwd, docker, timeout });
};
