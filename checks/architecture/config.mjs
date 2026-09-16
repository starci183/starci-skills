import fs from 'node:fs';
import path from 'node:path';

const CONFIG_SCHEMA = 'starci/architecture-config@1';
const KINDS = new Set(['backend', 'frontend']);
const TOP_LEVEL_KEYS = new Set(['schema', 'kinds', 'tsconfig', 'projects', 'backend', 'frontend']);
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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function workspaceDirectories(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  const patterns = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
  if (!Array.isArray(patterns)) return [];
  const directories = [];
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue;
    const normalized = safeRelative(pattern, 'package.json workspace pattern');
    if (!normalized.endsWith('/*') || normalized.slice(0, -2).includes('*')) continue;
    const parentRelative = normalized.slice(0, -2);
    const parent = path.join(root, ...parentRelative.split('/'));
    if (!existingDirectory(root, parentRelative)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true }).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = slash(path.relative(root, path.join(parent, entry.name)));
      if (fs.existsSync(path.join(root, relative, 'package.json'))) directories.push(relative);
    }
  }
  return [...new Set(directories)];
}

function discoveredProjects(root, workspaces) {
  const projects = [];
  if (fs.existsSync(path.join(root, 'tsconfig.json'))) projects.push('tsconfig.json');
  for (const workspace of workspaces) {
    for (const name of ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.build.json']) {
      const candidate = `${workspace}/${name}`;
      if (fs.existsSync(path.join(root, ...candidate.split('/')))) {
        projects.push(candidate);
        break;
      }
    }
  }
  return [...new Set(projects)];
}

function inferredLayout(root, workspaces) {
  const roots = ['', ...workspaces];
  const collect = suffix => roots.map(prefix => prefix ? `${prefix}/${suffix}` : suffix).filter(relative => existingDirectory(root, relative));
  const components = collect('src/components');
  for (const workspace of workspaces) {
    const source = `${workspace}/src`;
    if (['leaves', 'branches', 'blocks', 'overlays', 'composites', 'layouts', 'product-shells', 'pages']
      .some(tier => existingDirectory(root, `${source}/${tier}`))) components.push(source);
  }
  return {
    routes: collect('src/app'),
    components: [...new Set(components)],
    hooks: collect('src/hooks'),
    transport: collect('src/modules/api'),
  };
}

function inferredKinds(root, layout) {
  const kinds = [];
  if (existingDirectory(root, 'src/features') && existingDirectory(root, 'src/modules')) kinds.push('backend');
  if (layout.routes.length && layout.components.length) kinds.push('frontend');
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

function pathList(value, defaults, label) {
  const list = value === undefined ? defaults : (Array.isArray(value) ? value : [value]);
  if (!Array.isArray(list) || list.length === 0) throw Error(`${label} must contain at least one path.`);
  const normalized = list.map(item => safeRelative(item, label));
  if (new Set(normalized).size !== normalized.length) throw Error(`${label} paths must be unique.`);
  return normalized;
}

function requireAuthoredDirectories(root, value, label) {
  if (value === undefined) return;
  for (const relative of (Array.isArray(value) ? value : [value]).map(item => safeRelative(item, label))) {
    if (!existingDirectory(root, relative)) throw Error(`${label} path does not exist: ${relative}.`);
  }
}

/** Resolve a strict layout contract. It deliberately has no ignore, waiver, or baseline field. */
export function loadArchitectureConfig(repositoryRoot, configFile) {
  const root = fs.realpathSync(path.resolve(repositoryRoot));
  if (!fs.lstatSync(root).isDirectory()) throw Error('Repository root must be a directory.');
  const authored = readConfig(root, configFile);
  if (authored.tsconfig !== undefined && authored.projects !== undefined) throw Error('Architecture config must use tsconfig or projects, not both.');
  const workspaces = workspaceDirectories(root);
  const inferred = inferredLayout(root, workspaces);
  const kinds = authored.kinds ?? inferredKinds(root, inferred);
  if (!Array.isArray(kinds) || kinds.length === 0 || kinds.some(kind => !KINDS.has(kind))) {
    throw Error('Architecture kind could not be inferred; config kinds must contain backend and/or frontend.');
  }
  if (new Set(kinds).size !== kinds.length) throw Error('Architecture config kinds must be unique.');
  const backend = authored.backend ?? {};
  const frontend = authored.frontend ?? {};
  exactKeys(backend, BACKEND_KEYS, 'Architecture config backend');
  exactKeys(frontend, FRONTEND_KEYS, 'Architecture config frontend');
  for (const [key, value] of Object.entries(backend)) requireAuthoredDirectories(root, value, `Architecture backend.${key}`);
  for (const [key, value] of Object.entries(frontend)) requireAuthoredDirectories(root, value, `Architecture frontend.${key}`);
  const discovered = discoveredProjects(root, workspaces);
  const projects = pathList(authored.projects ?? authored.tsconfig, discovered, 'Architecture TypeScript project');
  return {
    root,
    kinds: [...kinds].sort(),
    projects,
    workspaces,
    backend: {
      modules: pathList(backend.modules, ['src/modules'], 'Architecture backend.modules'),
      features: pathList(backend.features, ['src/features'], 'Architecture backend.features'),
      apps: pathList(backend.apps, ['apps'], 'Architecture backend.apps'),
    },
    frontend: {
      routes: pathList(frontend.routes, inferred.routes.length ? inferred.routes : ['src/app'], 'Architecture frontend.routes'),
      components: pathList(frontend.components, inferred.components.length ? inferred.components : ['src/components'], 'Architecture frontend.components'),
      hooks: pathList(frontend.hooks, inferred.hooks.length ? inferred.hooks : ['src/hooks'], 'Architecture frontend.hooks'),
      transport: pathList(frontend.transport, inferred.transport.length ? inferred.transport : ['src/modules/api'], 'Architecture frontend.transport'),
    },
  };
}

export { CONFIG_SCHEMA, isInside, slash };
