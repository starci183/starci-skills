import fs from 'node:fs';
import path from 'node:path';

const CONFIG_SCHEMA = 'starci/architecture-config@1';
const KINDS = new Set(['backend', 'frontend']);
const TOP_LEVEL_KEYS = new Set(['schema', 'kinds', 'tsconfig', 'backend', 'frontend']);
const BACKEND_KEYS = new Set(['modules', 'features', 'apps']);
const FRONTEND_KEYS = new Set(['routes', 'components', 'hooks', 'transport']);

function slash(value) {
  return value.replaceAll('\\', '/');
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function safeRelative(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label} must be a non-empty relative path.`);
  if (path.isAbsolute(value.trim())) throw Error(`${label} must stay inside the repository.`);
  const normalized = slash(value.trim()).replace(/^\.\//, '');
  if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized) || normalized.split('/').includes('..')) throw Error(`${label} must stay inside the repository.`);
  return normalized.replace(/\/$/, '');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label} must be an object.`);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw Error(`${label} has unsupported fields: ${unknown.sort().join(', ')}.`);
}

function existingDirectory(root, relative) {
  try {
    return fs.lstatSync(path.join(root, relative)).isDirectory();
  } catch {
    return false;
  }
}

function inferredKinds(root) {
  const kinds = [];
  if (existingDirectory(root, 'src/features') && existingDirectory(root, 'src/modules')) kinds.push('backend');
  if (existingDirectory(root, 'src/app') && existingDirectory(root, 'src/components')) kinds.push('frontend');
  return kinds;
}

function readConfig(root, configFile) {
  if (!configFile) return {};
  const absolute = path.resolve(root, configFile);
  if (!isInside(root, absolute)) throw Error('Architecture config must stay inside the repository.');
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Architecture config must be a regular file, not a link.');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch {
    throw Error('Architecture config must be valid JSON; file content was not echoed.');
  }
  exactKeys(parsed, TOP_LEVEL_KEYS, 'Architecture config');
  if (parsed.schema !== CONFIG_SCHEMA) throw Error(`Architecture config schema must be ${CONFIG_SCHEMA}.`);
  return parsed;
}

/** Resolve the small layout contract. It deliberately has no ignore, waiver, or baseline field. */
export function loadArchitectureConfig(repositoryRoot, configFile) {
  const root = fs.realpathSync(path.resolve(repositoryRoot));
  if (!fs.lstatSync(root).isDirectory()) throw Error('Repository root must be a directory.');
  const authored = readConfig(root, configFile);
  const kinds = authored.kinds ?? inferredKinds(root);
  if (!Array.isArray(kinds) || kinds.length === 0 || kinds.some(kind => !KINDS.has(kind))) {
    throw Error('Architecture kind could not be inferred; config kinds must contain backend and/or frontend.');
  }
  if (new Set(kinds).size !== kinds.length) throw Error('Architecture config kinds must be unique.');
  const backend = authored.backend ?? {};
  const frontend = authored.frontend ?? {};
  exactKeys(backend, BACKEND_KEYS, 'Architecture config backend');
  exactKeys(frontend, FRONTEND_KEYS, 'Architecture config frontend');
  const apps = backend.apps ?? ['apps'];
  if (!Array.isArray(apps) || apps.length === 0) throw Error('Architecture config backend.apps must be a non-empty array.');
  const relative = value => safeRelative(value, 'Architecture layout path');
  return {
    root,
    kinds: [...kinds].sort(),
    tsconfig: relative(authored.tsconfig ?? 'tsconfig.json'),
    backend: {
      modules: relative(backend.modules ?? 'src/modules'),
      features: relative(backend.features ?? 'src/features'),
      apps: apps.map(relative),
    },
    frontend: {
      routes: relative(frontend.routes ?? 'src/app'),
      components: relative(frontend.components ?? 'src/components'),
      hooks: relative(frontend.hooks ?? 'src/hooks'),
      transport: relative(frontend.transport ?? 'src/modules/api'),
    },
  };
}

export { CONFIG_SCHEMA, isInside, slash };
