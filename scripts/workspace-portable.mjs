#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const starciRoot = resolve(scriptRoot, '..');
const defaultSource = resolve(starciRoot, '..');
const portableSchemaPath = join(starciRoot, 'readiness', 'initialization', 'workspaces', 'portable-route.schema.json');
const localSchemaPath = join(starciRoot, 'readiness', 'initialization', 'workspaces', 'local-route.schema.json');
const configSchemaPath = join(starciRoot, 'readiness', 'initialization', 'workspaces', 'config.schema.json');
const validatePortableSchema = validatorFor(new URL('../readiness/initialization/workspaces/portable-route.schema.json', import.meta.url));
const validateLocalSchema = validatorFor(new URL('../readiness/initialization/workspaces/local-route.schema.json', import.meta.url));
const validateConfigSchema = validatorFor(new URL('../readiness/initialization/workspaces/config.schema.json', import.meta.url));
const githubRemote = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;

const slash = (value) => value.split(sep).join('/');
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function fail(message) {
  throw new Error(message);
}

function value(args, flag) {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

function samePath(left, right) {
  const normalize = (path) => resolve(path).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  return normalize(left) === normalize(right);
}

function inside(root, target) {
  const result = relative(resolve(root), resolve(target));
  return result !== '' && result !== '..' && !result.startsWith(`..${sep}`) && !isAbsolute(result);
}

function normalizeRemote(remote) {
  return remote.trim().replace(/\.git$/i, '').replace(/\/$/, '').toLowerCase();
}

function git(repository, ...args) {
  try {
    return execFileSync('git', ['-C', repository, ...args], {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
  } catch {
    fail(`Git verification failed at ${repository}: git ${args.join(' ')}`);
  }
}

function assertSchemaLink(documentPath, schemaRef) {
  if (typeof schemaRef !== 'string' || schemaRef.length === 0) fail(`${documentPath} has no $schema`);
  const target = resolve(dirname(documentPath), schemaRef);
  if (!existsSync(target)) fail(`${documentPath} references missing schema ${target}`);
  return target;
}

function assertPublicationSafe(document, label) {
  const forbiddenKeys = new Set(['diskPath', 'gitRoot', 'head', 'updatedAt']);
  const visit = (current, at) => {
    if (typeof current === 'string') {
      if (/credential|token|secret|password/i.test(current)) fail(`${at} contains secret-bearing text`);
      if (/^[A-Za-z]:[\\/]/.test(current) || current.startsWith('/')) fail(`${at} contains an absolute path`);
      if (/^https?:\/\/[^/\s]+@/i.test(current)) fail(`${at} contains URL user information`);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${at}[${index}]`));
      return;
    }
    if (!current || typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current)) {
      if (forbiddenKeys.has(key)) fail(`${at}.${key} contains observed machine state`);
      if (/credential|token|secret|password/i.test(key)) fail(`${at}.${key} is secret-bearing`);
      visit(child, `${at}.${key}`);
    }
  };
  visit(document, label);
}

export function validatePortableRoute(route, label = 'portable route') {
  const result = validatePortableSchema(route);
  if (!result.valid) fail(`${label} is invalid:\n${result.errors.join('\n')}`);
  if (!githubRemote.test(route.repository.gitRepository)) fail(`${label} has an invalid GitHub origin`);
  if (route.schemaVersion === 6 && route.role !== 'fe' && route.context.grammarId !== null) {
    fail(`${label} non-FE grammarId must be null`);
  }
  assertPublicationSafe(route, label);
  return route;
}

export function validateLocalRoute(route, label = 'local route') {
  const result = validateLocalSchema(route);
  if (!result.valid) fail(`${label} is invalid:\n${result.errors.join('\n')}`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(route.updatedAt)) {
    fail(`${label}.updatedAt must be an ISO UTC timestamp`);
  }
  if (route.schemaVersion === 6 && route.role !== 'fe' && route.context.grammarId !== null) {
    fail(`${label} non-FE grammarId must be null`);
  }
  return route;
}

function directories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function jsonFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
}

function loadDeclarations(source) {
  const workspaceRoot = join(source, '.workspaces');
  const configPath = join(workspaceRoot, 'config.json');
  if (!existsSync(configPath)) fail(`workspace config is absent: ${configPath}`);
  assertSchemaLink(configPath, readJson(configPath).$schema);
  const configResult = validateConfigSchema(readJson(configPath));
  if (!configResult.valid) fail(`workspace config is invalid:\n${configResult.errors.join('\n')}`);

  const projectsRoot = join(workspaceRoot, 'projects');
  const declarations = [];
  for (const project of directories(projectsRoot)) {
    for (const file of jsonFiles(join(projectsRoot, project))) {
      const path = join(projectsRoot, project, file);
      const route = readJson(path);
      assertSchemaLink(path, route.$schema);
      validatePortableRoute(route, slash(relative(source, path)));
      if (route.project !== project || `${route.role}.json` !== file) fail(`${path} identity does not match its location`);
      declarations.push({ path, route });
    }
  }
  if (declarations.length === 0) fail(`portable workspace declarations are absent under ${projectsRoot}`);
  return { workspaceRoot, declarations };
}

function resolveContextFile(repository, portablePath, label) {
  const candidate = resolve(repository, portablePath);
  if (!existsSync(candidate)) fail(`${label} is absent: ${candidate}`);
  const actual = realpathSync(candidate);
  if (!inside(repository, actual)) fail(`${label} escapes repository: ${portablePath}`);
  return actual;
}

function buildLocalRoute({ source, repositoriesRoot, workspaceRoot, declaration }) {
  const { route } = declaration;
  const repositoryCandidate = route.repository.kind === 'source'
    ? source
    : resolve(repositoriesRoot, route.repository.directory);
  if (!existsSync(repositoryCandidate) || !statSync(repositoryCandidate).isDirectory()) {
    fail(`${route.project}/${route.role} checkout is absent: ${repositoryCandidate}`);
  }
  const repository = realpathSync(repositoryCandidate);
  if (route.repository.kind === 'source') {
    if (!samePath(repository, source)) fail(`${route.project}/${route.role} source route resolved outside Source`);
  } else if (!inside(repositoriesRoot, repository)) {
    fail(`${route.project}/${route.role} checkout escapes repositories root`);
  }
  const gitRoot = realpathSync(git(repository, 'rev-parse', '--show-toplevel'));
  if (!samePath(gitRoot, repository)) fail(`${route.project}/${route.role} checkout is not its Git root`);
  const observedRemote = git(repository, 'config', '--get', 'remote.origin.url');
  if (normalizeRemote(observedRemote) !== normalizeRemote(route.repository.gitRepository)) {
    fail(`${route.project}/${route.role} origin mismatch`);
  }
  const branch = git(repository, 'branch', '--show-current');
  if (branch !== route.repository.branch) fail(`${route.project}/${route.role} branch mismatch: expected ${route.repository.branch}, observed ${branch}`);

  const context = route.context;
  const absoluteList = (paths, label) => paths.map((path, index) => resolveContextFile(repository, path, `${route.project}/${route.role} ${label}[${index}]`));
  const commonContext = {
    instructions: absoluteList(context.instructions, 'instruction'),
    contract: context.contract === null ? null : resolveContextFile(repository, context.contract, `${route.project}/${route.role} contract`),
    contractSource: context.contractSource,
    manifests: absoluteList(context.manifests, 'manifest')
  };
  const v6 = route.schemaVersion === 6;
  const local = {
    $schema: '../../../../../.claude/readiness/initialization/workspaces/local-route.schema.json',
    ...(v6 ? { schemaVersion: 6 } : { version: 1 }),
    project: route.project,
    role: route.role,
    source: {
      path: source,
      trust: join(source, '.claude'),
      skills: join(source, '.claude', 'skills'),
      workspaceRoot
    },
    repository: {
      diskPath: repository,
      gitRoot: repository,
      gitRepository: route.repository.gitRepository,
      branch,
      head: git(repository, 'rev-parse', 'HEAD')
    },
    context: v6
      ? { ...commonContext, grammarId: context.grammarId }
      : { ...commonContext, grammar: context.grammar, grammarProfile: context.grammarProfile },
    updatedAt: new Date().toISOString()
  };
  validateLocalRoute(local, `${route.project}/${route.role} hydrated route`);
  return {
    target: join(workspaceRoot, 'local', 'routes', route.project, route.role, 'config.json'),
    value: local
  };
}

function comparable(route) {
  const value = structuredClone(route);
  delete value.updatedAt;
  return value;
}

function changed(target, expected) {
  if (!existsSync(target)) return true;
  try {
    const actual = readJson(target);
    return JSON.stringify(comparable(actual)) !== JSON.stringify(comparable(expected));
  } catch {
    return true;
  }
}

function atomicWrite(target, value) {
  mkdirSync(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  try {
    writeFileSync(temporary, stableJson(value), { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

function checkoutPlans(repositoriesRoot, declarations) {
  const byDirectory = new Map();
  for (const { route } of declarations) {
    if (route.repository.kind === 'source') continue;
    const key = route.repository.directory;
    const previous = byDirectory.get(key);
    if (previous && (
      normalizeRemote(previous.gitRepository) !== normalizeRemote(route.repository.gitRepository)
      || previous.branch !== route.repository.branch
    )) fail(`conflicting checkout declarations for ${key}`);
    byDirectory.set(key, route.repository);
  }
  return [...byDirectory.values()].sort((left, right) => left.directory.localeCompare(right.directory)).map((repository) => {
    const target = resolve(repositoriesRoot, repository.directory);
    if (!inside(repositoriesRoot, target)) fail(`checkout target escapes repositories root: ${repository.directory}`);
    return { ...repository, target };
  });
}

function initializeCheckouts(plans) {
  const initialized = [];
  for (const plan of plans) {
    if (existsSync(plan.target)) continue;
    try {
      execFileSync('git', [
        'clone',
        '--quiet',
        '--single-branch',
        '--branch',
        plan.branch,
        '--',
        plan.gitRepository,
        plan.target
      ], { encoding: 'utf8', windowsHide: true });
      execFileSync('git', ['-C', plan.target, 'remote', 'set-url', 'origin', plan.gitRepository], {
        encoding: 'utf8',
        windowsHide: true
      });
    } catch {
      fail(`checkout initialization failed: ${plan.gitRepository} -> ${plan.target}`);
    }
    initialized.push(plan.target);
  }
  return initialized;
}

export function run(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!['bootstrap', 'hydrate', 'check'].includes(command)) fail('Usage: workspace-portable.mjs <bootstrap|hydrate|check> --source <Source> [--repositories-root <path>] [--project <id>] [--plan|--apply]');
  const plan = argv.includes('--plan');
  const apply = argv.includes('--apply');
  if (['bootstrap', 'hydrate'].includes(command) && plan === apply) fail(`${command} requires exactly one of --plan or --apply`);
  if (command === 'check' && (plan || apply)) fail('check accepts neither --plan nor --apply');

  if (!existsSync(portableSchemaPath) || !existsSync(localSchemaPath) || !existsSync(configSchemaPath)) fail('V6 workspace schemas are incomplete');
  const source = realpathSync(resolve(value(argv, '--source') ?? defaultSource));
  const repositoriesRoot = realpathSync(resolve(value(argv, '--repositories-root') ?? dirname(source)));
  const project = value(argv, '--project');
  const { workspaceRoot, declarations } = loadDeclarations(source);
  const selected = project ? declarations.filter((item) => item.route.project === project) : declarations;
  if (selected.length === 0) fail(`no workspace declarations selected${project ? ` for ${project}` : ''}`);

  const checkoutPlan = command === 'bootstrap' ? checkoutPlans(repositoriesRoot, selected) : [];
  const missingCheckouts = checkoutPlan.filter((item) => !existsSync(item.target));
  if (command === 'bootstrap' && plan && missingCheckouts.length > 0) {
    console.log(JSON.stringify({
      status: 'initialize-required',
      routeCount: selected.length,
      missingCheckouts: missingCheckouts.map((item) => slash(relative(repositoriesRoot, item.target))),
      changedRoutes: []
    }));
    return 0;
  }
  const initializedCheckouts = command === 'bootstrap' && apply
    ? initializeCheckouts(checkoutPlan)
    : [];

  const expected = selected.map((declaration) => buildLocalRoute({ source, repositoriesRoot, workspaceRoot, declaration }));
  const changes = expected.filter((item) => changed(item.target, item.value));
  if ((command === 'hydrate' || command === 'bootstrap') && apply) changes.forEach((item) => atomicWrite(item.target, item.value));
  const summary = {
    status: command === 'check' && changes.length > 0 ? 'stale' : 'ready',
    routeCount: expected.length,
    ...(command === 'bootstrap' ? {
      initializedCheckouts: initializedCheckouts.map((item) => slash(relative(repositoriesRoot, item)))
    } : {}),
    changedRoutes: changes.map((item) => slash(relative(source, item.target)))
  };
  console.log(JSON.stringify(summary));
  return command === 'check' && changes.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
