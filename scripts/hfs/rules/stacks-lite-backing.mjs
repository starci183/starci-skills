// R276: lite uses managed Supabase backing; sidecar SQLite persists on declared named volumes.
import { isPlainObject as plain } from '../../../engine/plain-object.mjs';
import { composeEntries } from '../../lib/compose-values.mjs';
import { repositoryOf } from '../../lib/stack-services.mjs';
import { stacksDeploymentFindings } from './stacks-runtime.mjs';

const BACKING_IMAGE = /^(?:postgres(?:ql)?|postgresql-repmgr|redis(?:-stack(?:-server)?)?|mongo(?:db)?|mongodb-community-server)$/i;
const DATABASE_ADAPTER_KEYS = new Set(['db_type', 'database_type', 'db_provider', 'database_provider', 'db_client', 'database_client', 'db_adapter', 'database_adapter']);
const SQLITE_ADAPTERS = new Set(['sqlite', 'sqlite3', 'better-sqlite3', 'sql.js']);
const DATABASE_URL_KEY = /DB|DATABASE|POSTGRES|REDIS|MONGO/i;
const NON_SQLITE_URL = /^(?:postgres(?:ql)?|rediss?|mongo(?:db)?(?:\+srv)?|mysql|mariadb|mssql|sqlserver|cockroachdb):/i;
const SQLITE_URL = /^sqlite(?:3)?:/i;
const NAMED_VOLUME = /^[a-z0-9][a-z0-9_.-]*$/i;
const mapping = value => plain(value) ? value : {};
const present = value => typeof value === 'string' && Boolean(value.trim());

function imageIssues(components, services) {
  const errors = [];
  for (const [prefix, inventory] of [['components', components], ['services', services]]) {
    for (const [id, entry] of Object.entries(inventory)) {
      if (present(entry?.image) && BACKING_IMAGE.test(repositoryOf(entry.image)))
        errors.push({ code: 'STACKS_LITE_SELFHOSTED_DB', at: `${prefix}.${id}.image`,
          message: 'lite must not run a self-hosted Postgres, Redis or Mongo database image; use managed Supabase backing' });
    }
  }
  return errors;
}

function unsupportedAdapter(service) {
  for (const [key, value] of composeEntries(service?.environment, { stringsOnly: true })) {
    const adapterKey = DATABASE_ADAPTER_KEYS.has(key.toLowerCase());
    if (adapterKey && !SQLITE_ADAPTERS.has(String(value).trim().toLowerCase())) return true;
    if (DATABASE_URL_KEY.test(key) && typeof value === 'string' && NON_SQLITE_URL.test(value.trim())) return true;
  }
  return false;
}

function sqliteAdapter(service) {
  return composeEntries(service?.environment, { stringsOnly: true }).some(([key, value]) => {
    const adapter = String(value).trim().toLowerCase();
    return DATABASE_ADAPTER_KEYS.has(key.toLowerCase()) && SQLITE_ADAPTERS.has(adapter)
      || DATABASE_URL_KEY.test(key) && SQLITE_URL.test(adapter);
  });
}

function renderedAdapterIssues(components, services) {
  const errors = [];
  for (const [id, service] of Object.entries(services)) {
    const component = mapping(components[id]);
    if (component.role !== 'sidecar' && component.database === undefined) continue;
    if (!unsupportedAdapter(service)) continue;
    errors.push({ code: 'STACKS_SIDECAR_DB_UNSUPPORTED', at: `services.${id}.environment`,
      message: 'rendered sidecar database adapter configuration must use SQLite; Postgres, Redis and Mongo dependencies are forbidden in lite' });
  }
  return errors;
}

function writableVolume(entry, source) {
  if (typeof entry === 'string') {
    const [name, target, options = ''] = entry.split(':');
    return name === source && present(target) && target.startsWith('/') && !options.split(',').includes('ro');
  }
  return plain(entry) && entry.type === 'volume' && entry.source === source && present(entry.target) && entry.target.startsWith('/') && entry.read_only !== true;
}

function sqliteVolumeIssue({ id, component, database, services, bindings, volumes }) {
  const declared = Array.isArray(component.volumes) && component.volumes.includes(database.volume);
  const active = Object.hasOwn(bindings, id) || Object.hasOwn(services, id);
  const mounts = Array.isArray(services[id]?.volumes) ? services[id].volumes : [];
  const mounted = Object.hasOwn(volumes, database.volume) && mounts.some(entry => writableVolume(entry, database.volume));
  if (present(database.volume) && NAMED_VOLUME.test(database.volume) && declared && (!active || mounted)) return [];
  return [{ code: 'STACKS_SIDECAR_VOLUME_UNDECLARED', at: `components.${id}.database.volume`,
    message: 'a SQLite sidecar needs a declared persistent component volume, a top-level rendered named volume and a writable mount' }];
}

function sidecarIssues({ components, services, bindings, volumes }) {
  const errors = [];
  for (const [id, entry] of Object.entries(components)) {
    const component = mapping(entry);
    if (component.database === undefined) {
      if (component.role === 'sidecar' && sqliteAdapter(services[id]))
        errors.push(...sqliteVolumeIssue({ id, component, database: {}, services, bindings, volumes }));
      continue;
    }
    const database = mapping(component.database);
    if (database.provider !== 'sqlite') {
      errors.push({ code: 'STACKS_SIDECAR_DB_UNSUPPORTED', at: `components.${id}.database.provider`,
        message: 'a lite sidecar that needs a database must use SQLite on a declared persistent volume' });
      continue;
    }
    errors.push(...sqliteVolumeIssue({ id, component, database, services, bindings, volumes }));
  }
  return errors;
}

/** The lite backing contract; full keeps its existing backing choices. */
export function liteBackingIssues({ doc, environment, spec = doc?.environments?.[environment], model, repo, edition = repo?.edition }) {
  if (edition !== 'lite' || spec?.runtime !== 'docker-swarm') return [];
  const components = mapping(doc?.components), services = mapping(model?.services);
  return [
    ...imageIssues(components, services),
    ...renderedAdapterIssues(components, services),
    ...sidecarIssues({ components, services, bindings: mapping(spec.components), volumes: mapping(model?.volumes) }),
  ];
}

/** HFS finder over tracked rendered models; unavailable evidence is reported by R267. */
export function stacksLiteBackingFindings(context) {
  if (context.repo?.edition !== 'lite') return [];
  return stacksDeploymentFindings(context, liteBackingIssues);
}
