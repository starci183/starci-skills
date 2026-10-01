import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

/**
 * The services of a repository's own stack definition, read from `.starcistacks/application-stacks.yaml` and the compose
 * files of one environment (`environments.<env>.composeFiles`, `include:` followed). The R47 `test-world-files` machine check
 * reads the stack through it: it refuses a fake of a service the stack declares, and a `fakedBy` of a stateful one. Nothing
 * here names a product: the stack declares its services, this reads them.
 *
 * Which services the test world runs for real: every declared service except the app's own services (component role
 * `service`, or a compose service under the `app` profile) and observability sidecars (role `observability`). The
 * toxiproxy service (the failure-injection proxy the world routes every real service through) is declared like any other
 * service and is returned as `proxy`.
 */
export const STACKS_DIRECTORY = '.starcistacks';
export const STACKS_FILE = 'application-stacks.yaml';
export const DEFAULT_ENVIRONMENT = 'dev';

/** Test-only value the `*_FILE` secret variables of a compose service become (the file variable is replaced by the plain variable of the same name). Never a real secret: the test stack listens on loopback only. */
export const TEST_SECRET_VALUE = 'starci-test-secret';

const NOT_RUN_ROLES = new Set(['service', 'observability']);
const NOT_RUN_PROFILES = new Set(['app']);

/**
 * What the reader knows about the well-known images of a stack, by the repository name of the image: how the test stack
 * tells the service answers (`probe`), which name its fakes could hide behind (`aliases`), and its kind. An image it does not
 * know is probed by TCP and is only matched by its own name.
 */
const KNOWN_IMAGES = Object.freeze({
  postgres: { kind: 'database', aliases: ['postgres', 'postgresql', 'pg', 'database', 'db'], probe: { exec: ['pg_isready', '-h', '127.0.0.1'] } },
  redis: { kind: 'cache', aliases: ['redis', 'cache', 'valkey'], probe: { exec: ['redis-cli', 'ping'] } },
  valkey: { kind: 'cache', aliases: ['redis', 'cache', 'valkey'], probe: { exec: ['valkey-cli', 'ping'] } },
  keycloak: { kind: 'identity', aliases: ['keycloak', 'idp', 'oidc'], probe: { http: { path: '/realms/master' } } },
  minio: { kind: 'storage', aliases: ['minio', 's3', 'storage'], probe: { http: { path: '/minio/health/live', containerPort: 9000 } } },
  mailpit: { kind: 'mail', aliases: ['mailpit', 'mail', 'smtp', 'mailhog', 'maildev'], probe: { http: { path: '/livez', containerPort: 8025 } } },
  mailhog: { kind: 'mail', aliases: ['mailpit', 'mail', 'smtp', 'mailhog', 'maildev'], probe: { http: { path: '/', containerPort: 8025 } } },
  maildev: { kind: 'mail', aliases: ['mailpit', 'mail', 'smtp', 'mailhog', 'maildev'], probe: { http: { path: '/healthz', containerPort: 1080 } } },
  toxiproxy: { kind: 'proxy', aliases: ['toxiproxy'], probe: { http: { path: '/version', containerPort: 8474 } } },
  mysql: { kind: 'database', aliases: ['mysql', 'database', 'db'], probe: { tcp: true } },
  mariadb: { kind: 'database', aliases: ['mariadb', 'mysql', 'database', 'db'], probe: { tcp: true } },
  mongo: { kind: 'database', aliases: ['mongo', 'mongodb', 'database', 'db'], probe: { tcp: true } },
  clickhouse: { kind: 'database', aliases: ['clickhouse', 'database', 'db'], probe: { tcp: true } },
  kafka: { kind: 'queue', aliases: ['kafka', 'queue', 'broker'], probe: { tcp: true } },
  redpanda: { kind: 'queue', aliases: ['redpanda', 'kafka', 'queue', 'broker'], probe: { tcp: true } },
  rabbitmq: { kind: 'queue', aliases: ['rabbitmq', 'amqp', 'queue', 'broker'], probe: { tcp: true } },
  nats: { kind: 'queue', aliases: ['nats', 'queue', 'broker'], probe: { tcp: true } },
  elasticsearch: { kind: 'search', aliases: ['elasticsearch', 'elastic', 'search'], probe: { tcp: true } },
  opensearch: { kind: 'search', aliases: ['opensearch', 'search'], probe: { tcp: true } },
});

/**
 * The kinds of well-known image that hold data an app reads back. A stack service of one of these kinds (or one the stack gives
 * a persistent volume) is stateful: it always runs real in the test world and can never be faked, even with a declared
 * exception (BE-CONVENTION 1.16: only stateless compute that needs special hardware or an external model may be faked).
 */
export const STATEFUL_KINDS = Object.freeze(new Set(['database', 'cache', 'identity', 'storage', 'mail', 'queue', 'search']));

/** The repository name of an image reference: `quay.io/keycloak/keycloak:26.0` -> `keycloak`. */
export const repositoryOf = image => {
  const withoutDigest = image.split('@')[0];
  const lastSegment = withoutDigest.split('/').at(-1) ?? withoutDigest;
  return lastSegment.split(':')[0];
};

/** The repository path of an image reference without its tag: `quay.io/keycloak/keycloak:26.0` -> `quay.io/keycloak/keycloak`. */
export const imagePathOf = image => {
  const withoutDigest = image.split('@')[0];
  const lastSlash = withoutDigest.lastIndexOf('/');
  const colon = withoutDigest.indexOf(':', lastSlash + 1);
  return colon === -1 ? withoutDigest : withoutDigest.slice(0, colon);
};

/** True when the image reference carries a tag or digest (an external image, not a placeholder of the repository's own build). */
export const isTagged = image => image.includes('@') || image.slice(image.lastIndexOf('/') + 1).includes(':');

/** The shell-like words of a compose `command` string, double and single quotes grouping a word. */
const words = text => {
  const out = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/u.test(char)) {
      if (started || current) out.push(current);
      current = '';
      started = false;
    } else current += char;
  }
  if (started || current) out.push(current);
  return out;
};

const asList = value => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);

/** A compose `environment` (map or `KEY=VALUE` list) as a plain object; a `*_FILE` variable becomes the plain variable with the test value. */
const environmentOf = value => {
  const entries = Array.isArray(value)
    ? value.map(item => { const text = String(item); const at = text.indexOf('='); return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)]; })
    : Object.entries(value ?? {}).map(([key, item]) => [key, item === null ? '' : String(item)]);
  const out = {};
  for (const [key, item] of entries) {
    if (key.endsWith('_FILE')) out[key.slice(0, -'_FILE'.length)] = TEST_SECRET_VALUE;
    else out[key] = item;
  }
  return out;
};

/** The container ports a compose `ports` list publishes: `"5432:5432"`, `"127.0.0.1:8080:80/tcp"`, `5432`, `{target: 80}`. */
const containerPortsOf = value => asList(value).map(entry => {
  if (entry !== null && typeof entry === 'object') return Number(entry.target);
  const container = String(entry).split('/')[0].split(':').at(-1);
  return Number(container);
}).filter(Number.isInteger);

/** The bind mounts of a compose `volumes` list whose source is a path (`./realm.json:/x:ro`); named volumes are ephemeral in the test stack and are skipped. */
const mountsOf = (value, directory) => {
  const mounts = [];
  for (const entry of asList(value)) {
    if (entry !== null && typeof entry === 'object') {
      if (entry.type === 'bind' && typeof entry.source === 'string') mounts.push({ host: path.resolve(directory, entry.source), container: String(entry.target), readOnly: entry.read_only === true });
      continue;
    }
    const parts = String(entry).split(':');
    // A Windows drive letter is not a separator: a `<drive>:<path>:/y` mount keeps its drive.
    const source = /^[A-Za-z]$/u.test(parts[0]) && parts.length > 2 ? `${parts.shift()}:${parts.shift()}` : parts.shift();
    const target = parts.shift();
    if (!source || !target || !(source.startsWith('.') || path.isAbsolute(source))) continue;
    mounts.push({ host: path.resolve(directory, source), container: target, readOnly: parts.includes('ro') });
  }
  return mounts;
};

/** True when a compose `volumes` list gives the service somewhere to keep data: a named volume, or a bind mount that is not read-only. */
const persistsData = value => asList(value).some(entry => {
  if (entry !== null && typeof entry === 'object') return entry.type === 'volume' || (entry.type === 'bind' && entry.read_only !== true);
  const parts = String(entry).split(':');
  const source = /^[A-Za-z]$/u.test(parts[0]) && parts.length > 2 ? `${parts.shift()}:${parts.shift()}` : parts.shift();
  parts.shift();
  if (!source) return false;
  const isPath = source.startsWith('.') || path.isAbsolute(source);
  return !isPath || !parts.includes('ro');
});

const readYaml = file => parseYaml(fs.readFileSync(file, 'utf8')) ?? {};

/** The compose services of `file` and of every file it includes: [{name, definition, directory}]. */
const composeServices = (file, seen = new Set()) => {
  const resolved = path.resolve(file);
  if (seen.has(resolved) || !fs.existsSync(resolved)) return [];
  seen.add(resolved);
  const document = readYaml(resolved);
  const directory = path.dirname(resolved);
  const included = asList(document.include).flatMap(entry => {
    const target = typeof entry === 'string' ? entry : entry?.path;
    return typeof target === 'string' ? composeServices(path.resolve(directory, target), seen) : [];
  });
  const own = Object.entries(document.services ?? {}).map(([name, definition]) => ({ name, definition: definition ?? {}, directory }));
  return [...included, ...own];
};

/**
 * The stack of `environment`, or null when the repository declares none. `{ environment, directory, services, proxy }`:
 * `services` are the services the environment declares (`name`, `image`, `repository`, `tag`, `role`, `kind`, `aliases`,
 * `probe`, `command`, `environment`, `ports`, `mounts`, `persistent`, `runs`), `proxy` the toxiproxy service or null.
 */
export function readStack({ root, environment = DEFAULT_ENVIRONMENT }) {
  const stacksFile = path.join(root, STACKS_DIRECTORY, STACKS_FILE);
  if (!fs.existsSync(stacksFile)) return null;
  const declaration = readYaml(stacksFile);
  const env = declaration.environments?.[environment];
  if (!env) return null;
  const directory = path.join(root, STACKS_DIRECTORY, environment);
  const components = declaration.components ?? {};
  const declared = new Map();
  for (const composeFile of asList(env.composeFiles)) {
    for (const { name, definition, directory: composeDirectory } of composeServices(path.join(directory, composeFile))) declared.set(name, { definition, directory: composeDirectory });
  }
  const services = [];
  for (const [name, { definition, directory: composeDirectory }] of declared) {
    const image = typeof definition.image === 'string' ? definition.image : components[name]?.image;
    if (typeof image !== 'string') continue;
    const repository = repositoryOf(image);
    const known = KNOWN_IMAGES[repository];
    const role = components[name]?.role ?? 'stateful';
    const profiles = asList(definition.profiles);
    const command = typeof definition.command === 'string' ? words(definition.command) : asList(definition.command).map(String);
    services.push({
      name,
      image,
      repository,
      tag: isTagged(image) ? image.slice(imagePathOf(image).length + 1) : null,
      role,
      kind: known?.kind ?? 'other',
      aliases: known?.aliases ?? [repository],
      probe: known?.probe ?? { tcp: true },
      command,
      environment: environmentOf(definition.environment),
      ports: containerPortsOf(definition.ports),
      mounts: mountsOf(definition.volumes, composeDirectory),
      persistent: persistsData(definition.volumes),
      runs: !NOT_RUN_ROLES.has(role) && !profiles.some(profile => NOT_RUN_PROFILES.has(profile)),
    });
  }
  const proxy = services.find(service => service.kind === 'proxy') ?? null;
  return { environment, directory, services, proxy };
}

/** The names a fake of `service` could hide behind: its own name, its image repository and the aliases of a well-known image. */
export const namesOfService = service => [...new Set([service.name, service.repository, ...service.aliases])];
