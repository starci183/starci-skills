import fs from 'node:fs';
import path from 'node:path';

const CONFIG_SCHEMA = 'starci/architecture-config@1';
const KINDS = new Set(['backend', 'frontend']);
const TOP_LEVEL_KEYS = new Set(['schema', 'kinds', 'tsconfig', 'projects', 'backend', 'frontend', 'owners']);
const BACKEND_KEYS = new Set(['modules', 'features', 'apps', 'legacyRoots', 'moduleRegistration']);
const FRONTEND_KEYS = new Set(['routes', 'features', 'components', 'hooks', 'modules', 'transport', 'grammar']);
const OWNER_KEYS = new Set(['id', 'root', 'entry']);
const GRAMMAR_KEYS = new Set(['package', 'entry', 'styleEntry', 'styleSources', 'consumerManifests', 'peers']);
const PRODUCTION_SOURCE = /\.(?:[cm]?[jt]sx?)$/i;
const DECLARATION_SOURCE = /\.d\.[cm]?[jt]s$/i;
const MODULE_REGISTRATION_KEYS = new Set(['providerIdentity', 'handlerDecorators']);
const HANDLER_DECORATORS = new Set(['CommandHandler', 'QueryHandler']);

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

function existingRegularFile(root, relative) {
  try {
    const stat = fs.lstatSync(path.join(root, ...relative.split('/')));
    return stat.isFile() && !stat.isSymbolicLink();
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
  const directories = new Set();
  const queue = [root];
  const visited = new Set();
  const admit = (candidate, label = 'local package', strict = false) => {
    const absolute = path.resolve(candidate);
    if (!isInside(root, absolute) || absolute === root || !existingDirectory(root, slash(path.relative(root, absolute)))) {
      if (strict) throw Error(`${label} must resolve to a package directory inside the repository.`);
      return;
    }
    const manifest = path.join(absolute, 'package.json');
    try {
      if (!fs.lstatSync(manifest).isFile() || fs.lstatSync(manifest).isSymbolicLink()) {
        if (strict) throw Error(`${label} must resolve to a regular package.json inside the repository.`);
        return;
      }
    } catch (error) {
      if (strict) throw Error(error.message.startsWith(label) ? error.message : `${label} must resolve to a regular package.json inside the repository.`);
      return;
    }
    const relative = slash(path.relative(root, absolute));
    if (!directories.has(relative)) { directories.add(relative); queue.push(absolute); }
  };
  while (queue.length) {
    const packageRoot = queue.shift();
    if (visited.has(packageRoot)) continue;
    visited.add(packageRoot);
    const pkg = readJson(path.join(packageRoot, 'package.json'));
    const patterns = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
    for (const pattern of Array.isArray(patterns) ? patterns : []) {
      if (typeof pattern !== 'string' || !pattern.trim()) throw Error('package.json workspace entries must be non-empty paths.');
      const normalized = slash(pattern.trim()).replace(/^\.\//, '');
      const segments = normalized.split('/');
      if (path.isAbsolute(normalized) || segments.some(segment => segment === '..' || (segment.includes('*') && segment !== '*'))) {
        throw Error(`Unsupported local workspace pattern: ${normalized}.`);
      }
      let candidates = [packageRoot];
      for (const segment of segments) {
        const next = [];
        for (const base of candidates) {
          if (segment === '*') {
            if (!fs.existsSync(base) || !fs.lstatSync(base).isDirectory()) continue;
            next.push(...fs.readdirSync(base, { withFileTypes: true })
              .filter(item => item.isDirectory())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(item => path.join(base, item.name)));
          } else next.push(path.join(base, segment));
        }
        candidates = next;
      }
      if (!candidates.length) throw Error(`Workspace pattern matched no package directories: ${normalized}.`);
      for (const candidate of candidates) admit(candidate, `workspace ${normalized}`, true);
    }
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, value] of Object.entries(pkg?.[section] ?? {})) {
        if (typeof value === 'string' && value.startsWith('file:')) admit(path.resolve(packageRoot, value.slice('file:'.length)), `${section}.${name} file dependency`, true);
      }
    }
  }
  return [...directories].sort();
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
    features: collect('src/features'),
    components: [...new Set(components)],
    hooks: collect('src/hooks'),
    modules: collect('src/modules'),
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

function frontendPathList(value, discovered, fallback, label) {
  const selected = pathList(value, discovered.length ? discovered : fallback, label);
  return [...new Set([...selected, ...discovered])];
}

function assertFrontendRolesDisjoint(root, frontend) {
  const roles = ['routes', 'features', 'components', 'hooks', 'modules'];
  const entries = roles.flatMap(role => frontend[role].map(relative => ({
    role,
    relative,
    absolute: path.join(root, ...relative.split('/')),
  })));
  for (let index = 0; index < entries.length; index += 1) for (let other = index + 1; other < entries.length; other += 1) {
    const left = entries[index];
    const right = entries[other];
    if (isInside(left.absolute, right.absolute) || isInside(right.absolute, left.absolute)) {
      throw Error(`Architecture frontend role roots must be disjoint; ${left.role} ${left.relative} overlaps ${right.role} ${right.relative}.`);
    }
  }
}

function optionalPathList(value, label) {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
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

function configuredOwners(root, value) {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw Error('Architecture owners must be an array.');
  const owners = value.map((owner, index) => {
    exactKeys(owner, OWNER_KEYS, `Architecture owners[${index}]`);
    if (typeof owner.id !== 'string' || !owner.id.trim()) throw Error(`Architecture owners[${index}].id must be non-empty.`);
    const ownerRoot = safeRelative(owner.root, `Architecture owners[${index}].root`);
    const entry = safeRelative(owner.entry, `Architecture owners[${index}].entry`);
    if (!existingDirectory(root, ownerRoot)) throw Error(`Architecture owner root does not exist: ${ownerRoot}.`);
    if (!existingRegularFile(root, entry)) throw Error(`Architecture owner entry must be a regular non-link file: ${entry}.`);
    if (!PRODUCTION_SOURCE.test(entry) || DECLARATION_SOURCE.test(entry)) {
      throw Error(`Architecture owner entry must be a production TypeScript or JavaScript source file: ${entry}.`);
    }
    if (!isInside(path.join(root, ownerRoot), path.join(root, entry))) throw Error(`Architecture owner entry must stay inside ${ownerRoot}.`);
    return { id: owner.id.trim(), root: ownerRoot, entry };
  });
  for (const field of ['id', 'root', 'entry']) if (new Set(owners.map(owner => owner[field])).size !== owners.length) {
    throw Error(`Architecture owner ${field} values must be unique.`);
  }
  return owners;
}

function grammarConfig(root, value) {
  if (value === undefined) return null;
  exactKeys(value, GRAMMAR_KEYS, 'Architecture frontend.grammar');
  for (const key of ['package', 'entry', 'styleEntry']) if (typeof value[key] !== 'string' || !value[key].trim()) {
    throw Error(`Architecture frontend.grammar.${key} must be non-empty.`);
  }
  const packageName = value.package.trim();
  const entry = value.entry.trim();
  const styleEntry = value.styleEntry.trim();
  if (!entry.startsWith(`${packageName}/`) || !styleEntry.startsWith(`${packageName}/`) || !styleEntry.endsWith('.css')) {
    throw Error('Architecture frontend.grammar entries must be subpaths of its package and styleEntry must end in .css.');
  }
  const styleSources = Array.isArray(value.styleSources)
    ? value.styleSources.map(source => safeRelative(source, 'Architecture frontend.grammar.styleSources')) : [];
  if (!styleSources.length || new Set(styleSources).size !== styleSources.length
    || styleSources.some(source => !existingRegularFile(root, source) || !source.endsWith('.css'))) {
    throw Error('Architecture frontend.grammar.styleSources must name existing regular non-link CSS files.');
  }
  const consumerManifests = Array.isArray(value.consumerManifests)
    ? value.consumerManifests.map(source => safeRelative(source, 'Architecture frontend.grammar.consumerManifests')) : [];
  if (!consumerManifests.length || new Set(consumerManifests).size !== consumerManifests.length
    || consumerManifests.some(source => path.posix.basename(source) !== 'package.json' || !existingRegularFile(root, source))) {
    throw Error('Architecture frontend.grammar.consumerManifests must name existing regular non-link package.json files.');
  }
  if (styleSources.some(source => !consumerManifests.some(manifest => isInside(path.join(root, path.posix.dirname(manifest)), path.join(root, source))))) {
    throw Error('Architecture frontend.grammar.styleSources must stay inside a declared consumer package.');
  }
  const peers = Array.isArray(value.peers) ? value.peers.map(item => typeof item === 'string' ? item.trim() : '') : [];
  if (!peers.length || peers.some(item => !item) || new Set(peers).size !== peers.length) throw Error('Architecture frontend.grammar.peers must contain unique package names.');
  return { package: packageName, entry, styleEntry, styleSources, consumerManifests, peers };
}

function moduleRegistrationConfig(value) {
  if (value === undefined) return null;
  exactKeys(value, MODULE_REGISTRATION_KEYS, 'Architecture backend.moduleRegistration');
  if (value.providerIdentity !== 'exported-class-token') {
    throw Error('Architecture backend.moduleRegistration.providerIdentity must be exported-class-token.');
  }
  if (!Array.isArray(value.handlerDecorators) || new Set(value.handlerDecorators).size !== value.handlerDecorators.length
    || value.handlerDecorators.some(item => !HANDLER_DECORATORS.has(item))) {
    throw Error('Architecture backend.moduleRegistration.handlerDecorators must contain unique CommandHandler and/or QueryHandler names.');
  }
  return { providerIdentity: value.providerIdentity, handlerDecorators: [...value.handlerDecorators].sort() };
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
  for (const key of ['modules', 'features', 'apps', 'legacyRoots']) requireAuthoredDirectories(root, backend[key], `Architecture backend.${key}`);
  for (const key of ['routes', 'features', 'components', 'hooks', 'modules', 'transport']) requireAuthoredDirectories(root, frontend[key], `Architecture frontend.${key}`);
  const discovered = discoveredProjects(root, workspaces);
  const projects = pathList(authored.projects ?? authored.tsconfig, discovered, 'Architecture TypeScript project');
  const singleAppComposition = backend.apps === undefined && !existingDirectory(root, 'apps')
    && existingDirectory(root, 'src/features') && existingDirectory(root, 'src/modules')
    && existingRegularFile(root, 'src/main.ts') && existingRegularFile(root, 'src/app.module.ts');
  const resolvedBackend = {
    modules: pathList(backend.modules, ['src/modules'], 'Architecture backend.modules'),
    features: pathList(backend.features, ['src/features'], 'Architecture backend.features'),
    apps: pathList(backend.apps, singleAppComposition ? ['src'] : ['apps'], 'Architecture backend.apps'),
    legacyRoots: optionalPathList(backend.legacyRoots, 'Architecture backend.legacyRoots'),
    moduleRegistration: moduleRegistrationConfig(backend.moduleRegistration),
  };
  const backendSourceRoots = [...resolvedBackend.modules, ...resolvedBackend.features].map(relative => path.join(root, ...relative.split('/')));
  const legacySourceRoots = resolvedBackend.legacyRoots.map(relative => path.join(root, ...relative.split('/')));
  if (legacySourceRoots.some(legacy => !backendSourceRoots.some(source => isInside(source, legacy)))) {
    throw Error('Architecture backend.legacyRoots must stay inside a configured module or feature source root.');
  }
  for (let index = 0; index < legacySourceRoots.length; index += 1) for (let other = index + 1; other < legacySourceRoots.length; other += 1) {
    if (isInside(legacySourceRoots[index], legacySourceRoots[other]) || isInside(legacySourceRoots[other], legacySourceRoots[index])) {
      throw Error('Architecture backend.legacyRoots cannot overlap.');
    }
  }
  const owners = configuredOwners(root, authored.owners);
  const resolvedFrontend = {
    routes: frontendPathList(frontend.routes, inferred.routes, ['src/app'], 'Architecture frontend.routes'),
    features: frontendPathList(frontend.features, inferred.features, ['src/features'], 'Architecture frontend.features'),
    components: frontendPathList(frontend.components, inferred.components, ['src/components'], 'Architecture frontend.components'),
    hooks: frontendPathList(frontend.hooks, inferred.hooks, ['src/hooks'], 'Architecture frontend.hooks'),
    modules: frontendPathList(frontend.modules, inferred.modules, ['src/modules'], 'Architecture frontend.modules'),
    transport: frontendPathList(frontend.transport, inferred.transport, ['src/modules/api'], 'Architecture frontend.transport'),
    grammar: grammarConfig(root, frontend.grammar),
  };
  assertFrontendRolesDisjoint(root, resolvedFrontend);
  return {
    root,
    kinds: [...kinds].sort(),
    projects,
    workspaces,
    owners,
    backend: resolvedBackend,
    frontend: resolvedFrontend,
  };
}

export { CONFIG_SCHEMA, isInside, slash };
