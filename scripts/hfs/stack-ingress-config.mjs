// stack-ingress-config.mjs - the reader of `environments.<env>.deploy.ingress`: the SHARED host ingress (80/443) of the VPS. The ingress is
// its own swarm stack (`name`) owning the attachable overlay and the host-mode ports; the app stack consumes it. External (non-swarm, plain
// docker compose) tenants are reached over the overlay by a UNIQUE alias, or by a host address (`hostAddress`).
// Pure given the block and a probe of the app tree. `normalizeDeploy` (stack-deploy-config.mjs) hooks it in as `config.ingress`;
// `starci app stack ingress plan|attach|takeover` (packages/hfs/stack/ingress.mjs) consumes the normalised result.
import { closedFields, collector, patternField, treeFile } from './stack-config-kit.mjs';
import { isPlainObject as plain } from '../../engine/plain-object.mjs';
import { NAME } from './stack-deploy-config.mjs';

const DOCKER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/u;
const REMOTE_PATH = /^\/[A-Za-z0-9._/-]+$/u;
const DNS_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DNS_HOST = new RegExp(String.raw`^${DNS_LABEL}(?:\.${DNS_LABEL})+$`, 'u');
const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const IPV4 = new RegExp(String.raw`^${OCTET}(?:\.${OCTET}){3}$`, 'u');
const URL_PATH = /^\/[A-Za-z0-9._~%/-]*$/u;
const REDIRECT_STATUS = [301, 302, 303, 307, 308];

const FIELDS = {
  ingress: ['name', 'network', 'acmeVolume', 'service', 'legacy', 'upstreams', 'routes', 'middlewares', 'verify', 'drop', 'redirects', 'backup', 'takeover'],
  legacy: ['dir', 'dynamicDir', 'container'],
  upstream: ['name', 'hosts', 'container', 'hostAddress', 'port', 'aliases', 'middlewares'],
  verify: ['host', 'path', 'status'],
  redirect: ['host', 'to', 'status'],
  backup: ['dir'],
  takeover: ['gateSeconds', 'rehearsalPorts'],
  ports: ['http', 'https'],
};

const closed = (c, at, value, allowed) => closedFields(c, at, value, allowed, 'ingress');
const matching = patternField;

function remotePath(c, at, value) {
  if (typeof value !== 'string' || !REMOTE_PATH.test(value) || value.split('/').includes('..')) c.problem(at, 'must be an absolute path without ..');
}

function port(c, at, value) {
  if (!(Number.isInteger(value) && value >= 1 && value <= 65535)) c.problem(at, 'must be a port from 1 to 65535');
}

function httpStatus(c, at, value) {
  if (!(Number.isInteger(value) && value >= 100 && value <= 599)) c.problem(at, 'must be an HTTP status code');
}

function list(c, at, value, check) {
  if (!Array.isArray(value) || value.length === 0) { c.problem(at, 'must be a non-empty list'); return []; }
  value.forEach((item, index) => check(`${at}[${index}]`, item));
  return value;
}

const names = (c, pattern) => (where, item) => { matching(c, where, item, pattern); };

function legacy(c, block) {
  if (!closed(c, 'deploy.ingress.legacy', block, FIELDS.legacy)) return null;
  remotePath(c, 'deploy.ingress.legacy.dir', block.dir);
  remotePath(c, 'deploy.ingress.legacy.dynamicDir', block.dynamicDir);
  matching(c, 'deploy.ingress.legacy.container', block.container, DOCKER_NAME);
  return { dir: block.dir, dynamicDir: block.dynamicDir, container: block.container };
}

/** An upstream is a container on the overlay (alias = the route target) or a host address (`hostAddress`), never both. */
function target(c, at, entry) {
  if ((entry.container === undefined) === (entry.hostAddress === undefined)) c.problem(at, 'declare exactly one of container and hostAddress');
  if (entry.container !== undefined) matching(c, `${at}.container`, entry.container, DOCKER_NAME);
  if (entry.hostAddress !== undefined) matching(c, `${at}.hostAddress`, entry.hostAddress, IPV4);
  if (entry.hostAddress !== undefined && entry.aliases !== undefined) c.problem(`${at}.aliases`, 'a hostAddress upstream has no alias');
  if (entry.container === undefined) return [];
  return entry.aliases === undefined ? [entry.name] : list(c, `${at}.aliases`, entry.aliases, names(c, DOCKER_NAME));
}

function upstream(c, at, entry) {
  if (!closed(c, at, entry, FIELDS.upstream)) return null;
  matching(c, `${at}.name`, entry.name, NAME);
  port(c, `${at}.port`, entry.port);
  const aliases = target(c, at, entry);
  const hosts = list(c, `${at}.hosts`, entry.hosts, names(c, DNS_HOST));
  const middlewareNames = entry.middlewares === undefined ? [] : list(c, `${at}.middlewares`, entry.middlewares, names(c, NAME));
  return {
    name: entry.name, hosts, container: entry.container ?? null, hostAddress: entry.hostAddress ?? null, port: entry.port, aliases, middlewares: middlewareNames,
  };
}

function duplicates(c, label, values, at) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) c.problem(at, `${label} ${value} is declared more than once`);
    seen.add(value);
  }
}

function upstreams(c, block) {
  if (block === undefined) return [];
  const out = list(c, 'deploy.ingress.upstreams', block, () => {}).map((entry, index) => upstream(c, `deploy.ingress.upstreams[${index}]`, entry)).filter(Boolean);
  duplicates(c, 'upstream name', out.map((entry) => entry.name), 'deploy.ingress.upstreams');
  duplicates(c, 'host', out.flatMap((entry) => entry.hosts), 'deploy.ingress.upstreams');
  duplicates(c, 'alias (aliases must be unique on the shared overlay)', out.flatMap((entry) => entry.aliases), 'deploy.ingress.upstreams');
  return out;
}

function middlewareMap(c, block) {
  if (block === undefined) return {};
  if (!plain(block)) { c.problem('deploy.ingress.middlewares', 'must be a mapping of name to middleware'); return {}; }
  const out = {};
  for (const [name, value] of Object.entries(block)) {
    const at = `deploy.ingress.middlewares.${name}`;
    if (!matching(c, at, name, NAME)) continue;
    if (plain(value)) out[name] = value;
    else c.problem(at, 'must be a mapping');
  }
  return out;
}

function referencedMiddlewares(c, ups, declared, routes) {
  if (routes !== null) return;
  ups.forEach((entry, index) => {
    for (const name of entry.middlewares) {
      if (!Object.hasOwn(declared, name)) c.problem(`deploy.ingress.upstreams[${index}].middlewares`, `middleware ${name} is not declared in deploy.ingress.middlewares`);
    }
  });
}

function verifyList(c, block) {
  if (block === undefined) return [];
  return list(c, 'deploy.ingress.verify', block, () => {}).flatMap((entry, index) => {
    const at = `deploy.ingress.verify[${index}]`;
    if (!closed(c, at, entry, FIELDS.verify)) return [];
    matching(c, `${at}.host`, entry.host, DNS_HOST);
    if (entry.path !== undefined) matching(c, `${at}.path`, entry.path, URL_PATH);
    if (entry.status !== undefined) httpStatus(c, `${at}.status`, entry.status);
    return [{ host: entry.host, path: entry.path ?? '/', status: entry.status ?? null }];
  });
}

function dropList(c, block) {
  return block === undefined ? [] : list(c, 'deploy.ingress.drop', block, names(c, DNS_HOST));
}

function redirects(c, block) {
  if (block === undefined) return [];
  return list(c, 'deploy.ingress.redirects', block, () => {}).flatMap((entry, index) => {
    const at = `deploy.ingress.redirects[${index}]`;
    if (!closed(c, at, entry, FIELDS.redirect)) return [];
    matching(c, `${at}.host`, entry.host, DNS_HOST);
    matching(c, `${at}.to`, entry.to, DNS_HOST);
    if (entry.status !== undefined && !REDIRECT_STATUS.includes(entry.status)) c.problem(`${at}.status`, `must be one of ${REDIRECT_STATUS.join(', ')}`);
    return [{ host: entry.host, to: entry.to, status: entry.status ?? 301 }];
  });
}

function backup(c, block) {
  if (block === undefined) return null;
  if (!closed(c, 'deploy.ingress.backup', block, FIELDS.backup)) return null;
  remotePath(c, 'deploy.ingress.backup.dir', block.dir);
  return { dir: block.dir };
}

const DEFAULT_REHEARSAL_PORTS = { http: 18080, https: 18443 };

/** Alternate host ports of the rehearsal: valid ports, never the production 80 and 443, and different from each other. */
function rehearsalPorts(c, block) {
  const at = 'deploy.ingress.takeover.rehearsalPorts';
  if (block === undefined) return { ...DEFAULT_REHEARSAL_PORTS };
  if (!closed(c, at, block, FIELDS.ports)) return { ...DEFAULT_REHEARSAL_PORTS };
  for (const key of FIELDS.ports) {
    port(c, `${at}.${key}`, block[key]);
    if ([80, 443].includes(block[key])) c.problem(`${at}.${key}`, 'must not be the production port 80 or 443');
  }
  if (block.http === block.https) c.problem(at, 'http and https must differ');
  return { http: block.http, https: block.https };
}

function takeover(c, block) {
  if (block === undefined) return { gateSeconds: 30, rehearsalPorts: { ...DEFAULT_REHEARSAL_PORTS } };
  if (!closed(c, 'deploy.ingress.takeover', block, FIELDS.takeover)) return null;
  const gate = block.gateSeconds ?? 30;
  if (!(Number.isInteger(gate) && gate >= 1 && gate <= 300)) c.problem('deploy.ingress.takeover.gateSeconds', 'must be a whole number of seconds from 1 to 300');
  return { gateSeconds: gate, rehearsalPorts: rehearsalPorts(c, block.rehearsalPorts) };
}

/**
 * Validates and normalises one `deploy.ingress` block (undefined -> { ingress: null, problems: [] }).
 *   probe.exists(rel)  does a file exist below .starcistacks/<env>/ ?
 * Returns { ingress, problems }; ingress is null when a problem was found.
 */
export function normalizeIngress(block, { probe }) {
  const c = collector();
  if (block === undefined) return { ingress: null, problems: [] };
  if (!closed(c, 'deploy.ingress', block, FIELDS.ingress)) return { ingress: null, problems: c.problems };
  for (const key of ['name', 'service']) if (block[key] !== undefined) matching(c, `deploy.ingress.${key}`, block[key], NAME);
  matching(c, 'deploy.ingress.network', block.network, DOCKER_NAME);
  matching(c, 'deploy.ingress.acmeVolume', block.acmeVolume, DOCKER_NAME);
  if (block.routes !== undefined) treeFile(c, 'deploy.ingress.routes', block.routes, probe);
  const ups = upstreams(c, block.upstreams);
  const declared = middlewareMap(c, block.middlewares);
  const routes = block.routes ?? null;
  referencedMiddlewares(c, ups, declared, routes);
  const ingress = {
    name: block.name ?? 'ingress',
    service: block.service ?? 'ingress',
    network: block.network,
    acmeVolume: block.acmeVolume,
    legacy: legacy(c, block.legacy),
    upstreams: ups,
    routes,
    middlewares: declared,
    verify: verifyList(c, block.verify),
    drop: dropList(c, block.drop),
    redirects: redirects(c, block.redirects),
    backup: backup(c, block.backup),
    takeover: takeover(c, block.takeover),
  };
  return { ingress: c.problems.length === 0 ? ingress : null, problems: c.problems };
}
