import fs from 'node:fs';
import path from 'node:path';
import { slash } from '../../lib/path-key.mjs';
import { readJsonFile as readJson } from '../../lib/json.mjs';
import { isInside } from '../../lib/walk.mjs';
import { openHfs } from '../slots.mjs';
import { byCodeUnit } from '../../lib/list.mjs';


/** A file's identity: its resolved real path, or the resolved path when it does not exist. */
function canonical(file) {
  const absolute = path.resolve(file);
  try { return path.resolve(fs.realpathSync(absolute)); } catch { return absolute; }
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) {
    unknown.sort(byCodeUnit);
    throw new Error(`${label} has unsupported fields: ${unknown.join(', ')}.`);
  }
}

/**
 * The git repository `root` sits in, found by walking up for a `.git` entry (a directory in a clone, a
 * file in a worktree), or null when there is none. It is the outer boundary a `file:` dependency may
 * resolve into: a checked project is routinely one package of a repository that also ships the packages
 * it consumes, and `--root` is the project, not the repository.
 */
function enclosingRepository(root) {
  let cursor = path.resolve(root);
  for (;;) {
    if (fs.existsSync(path.join(cursor, '.git'))) return cursor;
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

function existingPackageDirectory(absolute) {
  try {
    if (!fs.lstatSync(absolute).isDirectory()) return false;
    const manifest = fs.lstatSync(path.join(absolute, 'package.json'));
    return manifest.isFile() && !manifest.isSymbolicLink();
  } catch {
    return false;
  }
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

function admitWorkspace(root, directories, queue, candidate, label = 'local package', strict = false) {
  const absolute = path.resolve(candidate);
  if (!isInside(root, absolute) || absolute === root || !existingDirectory(root, slash(path.relative(root, absolute)))) {
    if (strict) throw new Error(`${label} must resolve to a package directory inside the repository.`);
    return;
  }
  const manifest = path.join(absolute, 'package.json');
  try {
    if (!fs.lstatSync(manifest).isFile() || fs.lstatSync(manifest).isSymbolicLink()) {
      if (strict) throw new Error(`${label} must resolve to a regular package.json inside the repository.`);
      return;
    }
  } catch (error) {
    if (strict) throw new Error(error.message.startsWith(label) ? error.message : `${label} must resolve to a regular package.json inside the repository.`);
    return;
  }
  const relative = slash(path.relative(root, absolute));
  if (!directories.has(relative)) { directories.add(relative); queue.push(absolute); }
}

function workspaceCandidates(packageRoot, normalized) {
  const segments = normalized.split('/');
  if (path.isAbsolute(normalized) || segments.some(segment => segment === '..' || (segment.includes('*') && segment !== '*'))) {
    throw new Error(`Unsupported local workspace pattern: ${normalized}.`);
  }
  let candidates = [packageRoot];
  for (const segment of segments) {
    const next = [];
    for (const base of candidates) {
      if (segment === '*') {
        if (!fs.existsSync(base) || !fs.lstatSync(base).isDirectory()) continue;
        next.push(...fs.readdirSync(base, { withFileTypes: true })
          .filter(item => item.isDirectory())
          .sort((a, b) => byCodeUnit(a.name, b.name))
          .map(item => path.join(base, item.name)));
      } else next.push(path.join(base, segment));
    }
    candidates = next;
  }
  return { candidates, wildcard: segments.includes('*') };
}

const admitFileDependency = (root, appPackageRoot, packageRoot, sideRoot, repository, state, section, name, value) => {
  if (typeof value !== 'string' || !value.startsWith('file:')) return;
  const absolute = path.resolve(sideRoot ? appPackageRoot : packageRoot, value.slice('file:'.length));
  if (sideRoot && !isInside(root, absolute) && isInside(appPackageRoot, absolute)) return;
  const label = `${section}.${name} file dependency`;
  if (isInside(root, absolute)) { admitWorkspace(root, state.directories, state.queue, absolute, label, true); return; }
  if (!repository || !isInside(repository, absolute) || !existingPackageDirectory(absolute)) {
    throw new Error(`${label} must resolve to a package directory inside the repository.`);
  }
};

function admitFileDependencies(root, appPackageRoot, packageRoot, sideRoot, repository, pkg, state) {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, value] of Object.entries(pkg?.[section] ?? {}))
      admitFileDependency(root, appPackageRoot, packageRoot, sideRoot, repository, state, section, name, value);
  }
}

const admitPackageWorkspaces = (root, appPackageRoot, packageRoot, sideRoot, side, pkg, state) => {
  const patterns = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
  for (const pattern of Array.isArray(patterns) ? patterns : []) {
    if (typeof pattern !== 'string' || !pattern.trim()) throw new Error('package.json workspace entries must be non-empty paths.');
    const written = slash(pattern.trim()).replace(/^\.\//, '');
    if (sideRoot && !written.startsWith(`${side}/`)) continue;
    const normalized = sideRoot ? written.slice(side.length + 1) : written;
    const { candidates, wildcard } = workspaceCandidates(packageRoot, normalized);
    // npm expands a `*` segment to the directories that hold a package.json and skips the rest (an empty or untracked folder is
    // HFS_EMPTY_DIR / HFS_SLOT_UNDECLARED, never a reason to analyse nothing); a literal workspace path must resolve. A `*`
    // pattern may match nothing: every app declares the same workspaces (fe/apps/*, fe/packages/*, HFS_MONO_WORKSPACES) whether
    // or not it has a package yet, and the root patterns are held to that fixed list by the rule, not here.
    for (const candidate of candidates) admitWorkspace(root, state.directories, state.queue, candidate, `workspace ${normalized}`, !wildcard);
  }
};

/**
 * The npm workspaces below `root`. The one package.json of an app is at `packageRoot` (the app root; `root` is its side folder):
 * its workspace patterns under `<side>/` are this side's, read relative to the side folder, and every other pattern is the other
 * side's.
 */
function workspaceDirectories(root, { packageRoot: appPackageRoot = root, side = null } = {}) {
  const directories = new Set();
  const queue = [root];
  const visited = new Set();
  const repository = enclosingRepository(root);
  while (queue.length) {
    const packageRoot = queue.shift();
    if (visited.has(packageRoot)) continue;
    visited.add(packageRoot);
    const sideRoot = side !== null && packageRoot === root;
    const pkg = readJson(path.join(sideRoot ? appPackageRoot : packageRoot, 'package.json'));
    admitPackageWorkspaces(root, appPackageRoot, packageRoot, sideRoot, side, pkg, { directories, queue });
    admitFileDependencies(root, appPackageRoot, packageRoot, sideRoot, repository, pkg, { directories, queue });
  }
  return [...directories].sort(byCodeUnit);
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
  // HFS: frontend source roots live only under workspace packages (apps/<app>/, packages/<pkg>/);
  // the repository root itself is never a frontend source root.
  // The route, feature, component, hook and module roles are app slots (fe.route, fe.feature, fe.components, fe.hooks, fe.modules:
  // apps/<app>/src/...); a workspace package is tier `package` and holds none of them - its own src/hooks is package source, and a
  // grammar package's tier folders make it a component root below.
  const appWorkspaces = workspaces.filter(prefix => prefix.startsWith('apps/'));
  const collect = suffix => appWorkspaces.map(prefix => `${prefix}/${suffix}`).filter(relative => existingDirectory(root, relative));
  // A design-system workspace whose src carries tier dirs (leaves/branches/…) IS a component root;
  // collecting its src/components too would nest two roots in one role and fail the disjoint check.
  const tierSources = new Set(workspaces.map(prefix => `${prefix}/src`)
    .filter(source => ['leaves', 'branches', 'blocks', 'overlays', 'composites', 'layouts', 'product-shells', 'pages']
      .some(tier => existingDirectory(root, `${source}/${tier}`))));
  const components = collect('src/components')
    .filter(relative => !tierSources.has(path.posix.dirname(relative)));
  components.push(...tierSources);
  return {
    routes: collect('src/app'),
    features: collect('src/features'),
    components: [...new Set(components)],
    hooks: collect('src/hooks'),
    modules: collect('src/modules'),
    transport: collect('src/modules/api'),
  };
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
      throw new Error(`Architecture frontend role roots must be disjoint; ${left.role} ${left.relative} overlaps ${right.role} ${right.relative}.`);
    }
  }
}

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.next', '.turbo', 'coverage', 'test-results', '.starciwork', '.starcistacks']);

function directoriesUnder(root, relative, depth) {
  const out = [];
  const visit = (dir, left) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, ...dir.split('/').filter(Boolean)), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const child = dir ? `${dir}/${entry.name}` : entry.name;
      out.push(child);
      if (left > 1) visit(child, left - 1);
    }
  };
  visit(relative, depth);
  return out;
}

/** The owner entry a slot instance exposes: index.ts/index.tsx, a package's src/index.ts, an app's app.module.ts. */
function ownerEntry(root, ownerRoot, tier) {
  let candidates;
  if (tier === 'package') candidates = ['src/index.ts', 'src/index.tsx', 'index.ts', 'index.tsx'];
  else if (tier === 'app') candidates = ['app.module.ts'];
  else candidates = ['index.ts', 'index.tsx'];
  for (const candidate of candidates) {
    const relative = `${ownerRoot}/${candidate}`;
    if (existingRegularFile(root, relative)) return relative;
  }
  return null;
}

/**
 * Owners are derived from the slot manifest: every directory that an `owner: true` slot matches, with its entry file.
 * An instance with no entry file is not listed: the required-files check reports the missing entry.
 */
function derivedOwners(root, resolver) {
  const seen = new Map();
  for (const directory of directoriesUnder(root, '', 6)) {
    const owner = resolver.ownerOf(directory);
    if (!owner || owner.root !== directory || seen.has(owner.root)) continue;
    const slot = resolver.slot(owner.slot);
    const entry = ownerEntry(root, owner.root, slot.tier);
    if (entry) seen.set(owner.root, { id: `${owner.slot}:${owner.root}`, root: owner.root, entry, slot: owner.slot, tier: slot.tier });
  }
  return [...seen.values()].sort((a, b) => a.root.localeCompare(b.root));
}

const DECLARED_HANDLER_DECORATORS = ['CommandHandler', 'QueryHandler'];

const GRAMMAR_PACKAGE = '@starci/grammar';

/**
 * The Grammar contract of a frontend repository, derived rather than declared: every app's globals.css is a style
 * source, every app and every workspace package that depends on the Grammar package is a consumer. null when no app has
 * a globals.css to judge (the contract is then reported unavailable, never passed).
 */
function derivedGrammar(root, packageRoot, workspaces, apps = []) {
  const styleSources = apps.map(app => `apps/${app.name}/src/app/globals.css`).filter(relative => existingRegularFile(root, relative));
  if (!styleSources.length) return null;
  // Every fe app and package is an npm workspace that declares what it imports (HFS_MONO_WORKSPACE_DEP): each workspace that
  // declares the Grammar package is a consumer, and so is the app root's manifest when it does.
  const declaresGrammar = (pkg) => Boolean(pkg && [pkg.dependencies, pkg.peerDependencies, pkg.devDependencies].some(section => section && Object.hasOwn(section, GRAMMAR_PACKAGE)));
  const appManifest = slash(path.relative(root, path.join(packageRoot, 'package.json')));
  const consumerManifests = declaresGrammar(readJson(path.join(packageRoot, 'package.json'))) ? [appManifest] : [];
  for (const workspace of workspaces) {
    if (!workspace.startsWith('packages/') && !workspace.startsWith('apps/')) continue;
    const manifest = `${workspace}/package.json`;
    const pkg = readJson(path.join(root, ...manifest.split('/')));
    if (declaresGrammar(pkg)) consumerManifests.push(manifest);
  }
  if (!consumerManifests.length) return null;
  return { package: GRAMMAR_PACKAGE, entry: `${GRAMMAR_PACKAGE}/common`, styleEntry: `${GRAMMAR_PACKAGE}/common.css`, styleSources, consumerManifests, peers: ['react', '@heroui/react'] };
}

/**
 * Resolve the layout contract from hfs.json and the slot manifest (knowledge/hfs/slots.yaml). A repository carries only hfs.json. Owners, roots and the tier of every path come from slots; the contract
 * has no ignore, waiver or baseline field.
 */
export function loadArchitectureConfig(repositoryRoot, { hfs } = {}) {
  const root = fs.realpathSync(path.resolve(repositoryRoot));
  if (!fs.lstatSync(root).isDirectory()) throw new Error('Repository root must be a directory.');
  const opened = hfs ?? openHfs({ repoRoot: root });
  const { profile, apps } = opened.repo;
  // A side of an app (the side folder is the root the machine judges) keeps its dependencies in the app root's one package.json.
  const side = opened.repo.side ?? null;
  const packageRoot = side === null ? root : path.dirname(root);
  const workspaces = workspaceDirectories(root, { packageRoot, side });
  const appDirs = apps.map(app => `apps/${app.name}`);
  const inferred = inferredLayout(root, [...new Set([...workspaces, ...appDirs])].sort(byCodeUnit));
  const kinds = [profile === 'be' ? 'backend' : 'frontend'];
  const projects = discoveredProjects(root, [...new Set([...workspaces, ...appDirs])].sort(byCodeUnit));
  if (!projects.length) throw new Error('The repository has no tsconfig.json to derive a TypeScript project from.');
  const backend = {
    modules: ['src/modules'],
    // The layered feature root is the api kind (src/features/api/<feature>/: application/ and transport/<protocol>/); the cli
    // feature root (src/features/cli/) has its own shape, held by its slot and the cli rules.
    features: ['src/features/api'],
    apps: ['apps'],
    moduleRegistration: { providerIdentity: 'exported-class-token', handlerDecorators: [...DECLARED_HANDLER_DECORATORS] },
  };
  const frontend = {
    routes: inferred.routes,
    features: inferred.features,
    components: inferred.components,
    hooks: inferred.hooks,
    modules: inferred.modules,
    transport: inferred.transport,
    grammar: profile === 'fe' ? derivedGrammar(root, packageRoot, workspaces, apps) : null,
  };
  if (profile === 'fe') assertFrontendRolesDisjoint(root, frontend);
  return {
    root,
    packageRoot,
    repository: enclosingRepository(root),
    kinds,
    projects,
    workspaces,
    apps: apps.map(app => ({ name: app.name, kind: app.kind })),
    hfs: opened,
    owners: derivedOwners(root, opened),
    backend,
    frontend,
  };
}

export { canonical, enclosingRepository, exactKeys, isInside, slash };
