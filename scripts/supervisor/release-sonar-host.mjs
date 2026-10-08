// release-sonar-host.mjs - what the docker host must give the local SonarQube stack, checked BEFORE the release cut runs its suite (`starci release cut`, also with --plan), so that a
// stack that cannot come up refuses the cut in seconds instead of failing the Sonar proofs at the end of a 40-minute run. Read-only: docker version / info / inspect, one
// read of the kernel's vm.max_map_count on Linux, one read of the server's status when its container already runs. It returns findings [{what, fix}]; none means the host is ready.
import fs from 'node:fs';
import { version } from '../api/docker/version.mjs';
import { infoMemory } from '../api/docker/info-memory.mjs';
import { sonarState } from '../gates/sonar-status.mjs';
import { HOST_NEEDS, dockerOf, localStackConfig, stateOf } from './release-sonar-stack.mjs';

const MAX_MAP_COUNT_FILE = '/proc/sys/vm/max_map_count';
const GIB = 1024 ** 3;

/** The finding for the kernel setting of a Linux docker host, or null. */
function mapCountFinding(read) {
  let value;
  try { value = Number(String(read(MAX_MAP_COUNT_FILE)).trim()); } catch { return null; }
  if (!Number.isFinite(value) || value >= HOST_NEEDS.maxMapCount) return null;
  return { what: `vm.max_map_count is ${value}; SonarQube's Elasticsearch needs ${HOST_NEEDS.maxMapCount}`, fix: `owner: sudo sysctl -w vm.max_map_count=${HOST_NEEDS.maxMapCount} (persist it in /etc/sysctl.d)` };
}

/** The findings about the docker daemon itself: absent, not answering, or too little memory. */
function daemonFindings(cfg, deps) {
  const ver = (deps.version ?? version)({ docker: cfg.docker });
  if (ver.error) return [{ what: `the docker binary ${cfg.docker} cannot be run (${ver.error.code ?? ver.error.message})`, fix: 'install Docker or set STARCI_DOCKER' }];
  if (ver.status !== 0) return [{ what: 'no docker daemon answers', fix: 'start Docker Desktop (or the docker service)' }];
  const mem = Number(String((deps.infoMemory ?? infoMemory)({ docker: cfg.docker }).stdout ?? '').trim());
  if (Number.isFinite(mem) && mem > 0 && mem < HOST_NEEDS.memoryBytes) {
    return [{ what: `the docker daemon has ${(mem / GIB).toFixed(1)} GiB of memory; SonarQube needs ${HOST_NEEDS.memoryBytes / GIB} GiB`, fix: 'owner: raise the Docker Desktop memory limit' }];
  }
  return [];
}

/** The findings about the two containers of the stack: each must exist and be in a state the release can start or use. */
async function stackFindings(cfg, deps) {
  const d = deps.docker ?? dockerOf(cfg.docker);
  const names = [`${cfg.container}-postgres`, cfg.container];
  const states = names.map((name) => ({ name, state: stateOf(d.inspect, name) }));
  const found = states.flatMap(({ name, state }) => {
    if (state === 'missing') return [{ what: `the container ${name} does not exist`, fix: `create the stack once: ext/sonar/README.md ("One-time materialization", then docker compose up -d)` }];
    if (state === 'dead' || state === 'removing') return [{ what: `the container ${name} is ${state}`, fix: `owner: docker rm ${name} and re-create the stack from ext/sonar/README.md` }];
    return [];
  });
  if (found.length || states.at(-1).state !== 'running') return found;
  const status = await (deps.state ?? sonarState)(cfg);
  if (status.state === 'DB_MIGRATION_NEEDED') return [{ what: `SonarQube at ${cfg.host} reports DB_MIGRATION_NEEDED`, fix: `owner: open ${cfg.host}/setup once to migrate the database` }];
  return [];
}

/**
 * The findings that keep the local Sonar stack from coming up on this host, for the example apps `apps` ([{name, dir}]); [] when ready or when there is no example.
 * Seams (deps): config(appDir), version, infoMemory, docker ({inspect, start, stop}), state(cfg), platform, read(file).
 */
export async function sonarHostFindings(apps, deps = {}) {
  if (!apps.length) return [];
  let cfg;
  try { cfg = (deps.config ?? localStackConfig)(apps[0].dir); } catch (error) { return [{ what: `the Sonar configuration of ${apps[0].name} cannot be read: ${error.message}`, fix: 'fix the example\'s services.sonar declaration' }]; }
  if (cfg.disabled) return [{ what: `Sonar is disabled for ${apps[0].name} (${cfg.disabled})`, fix: 'a disabled Sonar is not a proof: enable it in the example\'s services.sonar declaration' }];
  const daemon = daemonFindings(cfg, deps);
  if (daemon.length) return daemon;
  const kernel = (deps.platform ?? process.platform) === 'linux' ? mapCountFinding(deps.read ?? ((file) => fs.readFileSync(file, 'utf8'))) : null;
  return [...(kernel ? [kernel] : []), ...await stackFindings(cfg, deps)];
}
