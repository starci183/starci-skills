// ps.mjs - list containers as Docker's JSON-lines records, optionally narrowed by exact labels.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker ps`; filters are Docker label filters, not name patterns. */
export const ps = ({ all = false, filters = [] } = {}, { cwd, docker = 'docker', timeout = 30_000 } = {}) =>
  dockerSpawn(['ps', ...(all ? ['-a'] : []), ...filters.flatMap((filter) => ['--filter', filter]), '--format', '{{json .}}'], { cwd, docker, timeout });
