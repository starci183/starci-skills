#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';
import { validatePortableRoute } from './workspace-portable.mjs';
import { inspectCommitPolicy } from './workspace-commit-policy.mjs';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const starciRoot = resolve(scriptRoot, '..');
const defaultSource = resolve(starciRoot, '..');
const bootstrapTemplatePath = join(starciRoot, 'readiness', 'initialization', 'bootstrap', 'agent-bootstrap.md');
const portableScriptPath = join(scriptRoot, 'workspace-portable.mjs');
const validateReport = validatorFor(new URL('../readiness/initialization/source-staleness.schema.json', import.meta.url));
const targetRuntimeVersion = 7;

const slash = (path) => path.split(sep).join('/');
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const normalizeText = (value) => `${value.replaceAll('\r\n', '\n').trimEnd()}\n`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function value(args, flag) {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

function normalizePath(path) {
  return resolve(path).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
}

function inside(root, target) {
  const result = relative(resolve(root), resolve(target));
  return result !== '' && result !== '..' && !result.startsWith(`..${sep}`) && !isAbsolute(result);
}

function pathRef(source, path) {
  const result = relative(source, path);
  return result === '' ? '.' : slash(result);
}

function moduleStatus(status, code, evidence = [], findings = []) {
  return { status, code, evidence: [...new Set(evidence)], findings: [...new Set(findings)] };
}

function inspectRuntime(source) {
  const packagePath = join(source, '.claude', 'package.json');
  if (!existsSync(packagePath)) {
    return {
      ...moduleStatus('blocked', 'runtime-missing', [], ['.claude/package.json is missing; install or pull the V7 runtime before Source initialization']),
      detectedVersion: null
    };
  }
  try {
    const detectedVersion = readJson(packagePath).version;
    const major = Number.parseInt(String(detectedVersion).split('.')[0], 10);
    if (!detectedVersion || !Number.isInteger(major)) throw new Error('version is absent or invalid');
    if (major !== targetRuntimeVersion) {
      return {
        ...moduleStatus('blocked', 'runtime-upgrade-required', [`runtime-version:${detectedVersion}`], [`V${major} runtime cannot declare V7 Source readiness; upgrade .claude first`]),
        detectedVersion
      };
    }
    return {
      ...moduleStatus('ready', 'runtime-v7-ready', [`runtime-version:${detectedVersion}`]),
      detectedVersion
    };
  } catch (error) {
    return {
      ...moduleStatus('blocked', 'runtime-invalid', [], [`.claude/package.json is invalid: ${error.message}`]),
      detectedVersion: null
    };
  }
}

function inspectBootstrap(source) {
  const template = normalizeText(readFileSync(bootstrapTemplatePath, 'utf8'));
  const expectedSha256 = sha256(template);
  const files = ['AGENTS.md', 'CLAUDE.md'].map((name) => {
    const path = join(source, name);
    if (!existsSync(path)) return { path: name, status: 'missing', expectedSha256, actualSha256: null };
    const actualSha256 = sha256(normalizeText(readFileSync(path, 'utf8')));
    return { path: name, status: actualSha256 === expectedSha256 ? 'ready' : 'stale', expectedSha256, actualSha256 };
  });
  const stale = files.filter((file) => file.status !== 'ready').map((file) => file.path);
  return {
    ...moduleStatus(
      stale.length === 0 ? 'ready' : 'initialize-required',
      stale.length === 0 ? 'bootstrap-ready' : 'bootstrap-refresh-required',
      files.map((file) => `${file.path}:${file.status}`),
      stale.map((path) => `${path} does not match the canonical V7 bootstrap`)
    ),
    files
  };
}

function jsonFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const project of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const projectRoot = join(root, project.name);
    for (const entry of readdirSync(projectRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) files.push(join(projectRoot, entry.name));
    }
  }
  return files.sort();
}

function migrateLegacyRoute(route, label) {
  if (route.version !== 1) return route;
  let grammarId = null;
  if (route.context.grammar !== null) {
    if (route.role === 'fe' && ['core', 'offset-pop'].includes(route.context.grammar)) grammarId = route.context.grammar;
    else throw new Error(`${label} requires an explicit V6 grammarId mapping`);
  }
  const migrated = {
    $schema: route.$schema,
    schemaVersion: 6,
    project: route.project,
    role: route.role,
    repository: route.repository,
    context: {
      instructions: route.context.instructions,
      manifests: route.context.manifests,
      grammarId
    }
  };
  validatePortableRoute(migrated, label);
  return migrated;
}

function runPortable(source, repositoriesRoot, command, mode) {
  const args = [portableScriptPath, command];
  if (mode) args.push(mode);
  args.push('--source', source, '--repositories-root', repositoriesRoot);
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true });
  let output = null;
  try {
    if (result.stdout.trim()) output = JSON.parse(result.stdout.trim());
  } catch {
    // The stderr below owns the actionable failure.
  }
  return { status: result.status, output, error: result.stderr.trim() || (output ? null : result.stdout.trim()) };
}

function inspectWorkspaces(source, repositoriesRoot) {
  const workspaceRoot = join(source, '.workspaces');
  const configPath = join(workspaceRoot, 'config.json');
  const projectsRoot = join(workspaceRoot, 'projects');
  const evidence = [];
  const findings = [];
  const legacyRoutes = [];
  const grammarMappingRequired = [];
  const changedRoutes = [];
  let configVersion = null;
  let configLegacy = false;
  let blocked = false;
  let commitBoundary = {
    policyId: 'unavailable', portableUntracked: [], localStateTracked: [], missingIgnoreRules: [], findings: ['commit policy was not evaluated']
  };

  if (!existsSync(configPath)) {
    blocked = true;
    findings.push('.workspaces/config.json is missing; project and language authority cannot be invented');
  } else {
    try {
      const config = readJson(configPath);
      configVersion = config.schemaVersion ?? config.version ?? null;
      if (config.schemaVersion === 6) evidence.push('workspace-config:v6');
      else if (config.version === 1) {
        configLegacy = true;
        evidence.push('workspace-config:legacy-v1');
      } else {
        blocked = true;
        findings.push(`unsupported workspace config version: ${String(configVersion)}`);
      }
    } catch (error) {
      blocked = true;
      findings.push(`.workspaces/config.json is invalid: ${error.message}`);
    }
  }

  const files = jsonFiles(projectsRoot);
  if (files.length === 0) {
    blocked = true;
    findings.push('.workspaces/projects has no portable route declarations');
  }
  for (const path of files) {
    const label = pathRef(source, path);
    try {
      const route = readJson(path);
      validatePortableRoute(route, label);
      if (route.version === 1) {
        legacyRoutes.push(label);
        try {
          migrateLegacyRoute(route, label);
        } catch (error) {
          grammarMappingRequired.push(label);
          findings.push(error.message);
        }
      }
    } catch (error) {
      blocked = true;
      findings.push(error.message);
    }
  }
  if (grammarMappingRequired.length > 0) blocked = true;

  try {
    commitBoundary = inspectCommitPolicy({ sourceRoot: source });
    evidence.push(`commit-policy:${commitBoundary.policyId}`);
    if (commitBoundary.status !== 'ready') {
      blocked = true;
      findings.push(...commitBoundary.findings);
    }
  } catch (error) {
    blocked = true;
    findings.push(`workspace commit policy failed: ${error.message}`);
  }

  if (!blocked) {
    const routeCheck = runPortable(source, repositoriesRoot, 'check');
    if (routeCheck.output?.status === 'stale') changedRoutes.push(...routeCheck.output.changedRoutes);
    else if (routeCheck.status !== 0) {
      blocked = true;
      findings.push(`workspace route verification failed: ${routeCheck.error ?? 'unknown error'}`);
    }
  }

  const stale = configLegacy || legacyRoutes.length > 0 || changedRoutes.length > 0;
  const status = blocked ? 'blocked' : stale ? 'initialize-required' : 'ready';
  const code = blocked ? 'workspaces-blocked' : stale ? 'workspaces-upgrade-required' : 'workspaces-ready';
  evidence.push(`portable-routes:${files.length}`, `legacy-routes:${legacyRoutes.length}`, `stale-local-routes:${changedRoutes.length}`);
  return {
    ...moduleStatus(status, code, evidence, findings),
    configVersion,
    routeCount: files.length,
    legacyRoutes,
    grammarMappingRequired,
    changedRoutes,
    commitPolicyId: commitBoundary.policyId,
    portableUntracked: commitBoundary.portableUntracked,
    localStateTracked: commitBoundary.localStateTracked,
    missingIgnoreRules: commitBoundary.missingIgnoreRules
  };
}

function parseWorktrees(output) {
  return output.trim().split(/\r?\n\r?\n/).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/);
    return {
      path: lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length),
      prunable: lines.some((line) => line.startsWith('prunable'))
    };
  }).filter((item) => item.path);
}

function discoverManagedCheckouts(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'references')
    .map((entry) => join(root, entry.name))
    .filter((candidate) => existsSync(join(candidate, '.git')));
}

function discoverEphemeralCheckouts(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, '.git')))
    .map((entry) => join(root, entry.name));
}

function inspectWorktrees(source) {
  const managedRoot = join(source, '.worktrees');
  const ephemeralRoot = join(source, '.claude', 'worktrees');
  try {
    const registered = parseWorktrees(execFileSync('git', ['-C', source, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      windowsHide: true
    }));
    const registeredMap = new Map(registered.map((item) => [normalizePath(item.path), item]));
    const actual = [...discoverManagedCheckouts(managedRoot), ...discoverEphemeralCheckouts(ephemeralRoot)];
    const unregistered = actual.filter((path) => !registeredMap.has(normalizePath(path)));
    const stale = registered.filter((item) => (inside(managedRoot, item.path) || inside(ephemeralRoot, item.path)) && (!existsSync(item.path) || item.prunable));
    const registeredManaged = registered.filter((item) => inside(managedRoot, item.path)).map((item) => pathRef(source, item.path));
    const registeredEphemeral = registered.filter((item) => inside(ephemeralRoot, item.path)).map((item) => pathRef(source, item.path));
    const stalePaths = stale.map((item) => pathRef(source, item.path));
    const unregisteredPaths = unregistered.map((path) => pathRef(source, path));
    const blocked = stalePaths.length > 0 || unregisteredPaths.length > 0;
    return {
      ...moduleStatus(
        blocked ? 'blocked' : 'ready',
        blocked ? 'worktree-repair-required' : 'worktrees-ready',
        [`managed-root:${existsSync(managedRoot) ? 'present' : 'absent'}`, `registered-managed:${registeredManaged.length}`, `registered-ephemeral:${registeredEphemeral.length}`],
        [
          ...stalePaths.map((path) => `${path} is registered but missing or prunable`),
          ...unregisteredPaths.map((path) => `${path} is a checkout outside the Source worktree registry`)
        ]
      ),
      managedRootPresent: existsSync(managedRoot),
      registeredManaged,
      registeredEphemeral,
      stalePaths,
      unregisteredPaths
    };
  } catch (error) {
    return {
      ...moduleStatus('blocked', 'worktree-inventory-failed', [], [`git worktree inventory failed: ${error.message}`]),
      managedRootPresent: existsSync(managedRoot),
      registeredManaged: [],
      registeredEphemeral: [],
      stalePaths: [],
      unregisteredPaths: []
    };
  }
}

function overallStatus(modules) {
  const statuses = Object.values(modules).map((module) => module.status);
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('initialize-required')) return 'stale';
  return 'ready';
}

function plannedChanges(modules) {
  const changes = [];
  for (const file of modules.bootstrap.files.filter((item) => item.status !== 'ready')) changes.push(file.path);
  if (modules.workspaces.configVersion === 1) changes.push('.workspaces/config.json');
  const safeLegacyRoutes = modules.workspaces.legacyRoutes.filter((path) => !modules.workspaces.grammarMappingRequired.includes(path));
  changes.push(...safeLegacyRoutes);
  if (modules.workspaces.changedRoutes.length > 0 || safeLegacyRoutes.length > 0) changes.push('hydrate:.workspaces/local/routes');
  return [...new Set(changes)];
}

function createReport(source, repositoriesRoot, operation = 'check', appliedChanges = []) {
  const modules = {
    runtime: inspectRuntime(source),
    bootstrap: inspectBootstrap(source),
    workspaces: inspectWorkspaces(source, repositoriesRoot),
    worktrees: inspectWorktrees(source)
  };
  const report = {
    schemaVersion: 6,
    operation,
    status: overallStatus(modules),
    sourceRoot: source,
    targetRuntimeVersion,
    modules,
    plannedChanges: plannedChanges(modules),
    appliedChanges
  };
  const validation = validateReport(report);
  if (!validation.valid) throw new Error(`source staleness report is invalid:\n${validation.errors.join('\n')}`);
  return report;
}

function atomicWrite(target, content) {
  mkdirSync(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  try {
    writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

function workspaceWrites(source, module) {
  const writes = [];
  const configPath = join(source, '.workspaces', 'config.json');
  if (module.configVersion === 1) {
    const config = readJson(configPath);
    writes.push({ path: configPath, content: stableJson({ $schema: config.$schema, schemaVersion: 6, defaultLang: config.defaultLang }) });
  }
  for (const label of module.legacyRoutes) {
    const path = resolve(source, label);
    writes.push({ path, content: stableJson(migrateLegacyRoute(readJson(path), label)) });
  }
  return writes;
}

function localRouteTargets(source, module) {
  const targets = module.changedRoutes.map((path) => resolve(source, path));
  for (const label of module.legacyRoutes) {
    const route = readJson(resolve(source, label));
    targets.push(join(source, '.workspaces', 'local', 'routes', route.project, route.role, 'config.json'));
  }
  return [...new Set(targets)];
}

export function inspectSource({ sourceRoot = defaultSource, repositoriesRoot = dirname(sourceRoot) } = {}) {
  const source = resolve(sourceRoot);
  return createReport(source, resolve(repositoriesRoot));
}

export function upgradeSource({ sourceRoot = defaultSource, repositoriesRoot = dirname(sourceRoot), apply = false } = {}) {
  const source = resolve(sourceRoot);
  const repositories = resolve(repositoriesRoot);
  const initial = createReport(source, repositories, apply ? 'upgrade-apply' : 'upgrade-plan');
  if (!apply || initial.status === 'blocked' || initial.status === 'ready') return initial;

  const routePlan = runPortable(source, repositories, 'hydrate', '--plan');
  if (routePlan.status !== 0) throw new Error(`workspace hydration preflight failed: ${routePlan.error ?? 'unknown error'}`);
  const writes = [];
  const template = normalizeText(readFileSync(bootstrapTemplatePath, 'utf8'));
  for (const file of initial.modules.bootstrap.files.filter((item) => item.status !== 'ready')) {
    writes.push({ path: join(source, file.path), content: template });
  }
  writes.push(...workspaceWrites(source, initial.modules.workspaces));
  const backupTargets = [...new Set([...writes.map((item) => item.path), ...localRouteTargets(source, initial.modules.workspaces)])];
  const backups = new Map(backupTargets.map((path) => [path, existsSync(path) ? readFileSync(path, 'utf8') : null]));
  try {
    for (const item of writes) atomicWrite(item.path, item.content);
    if (initial.plannedChanges.includes('hydrate:.workspaces/local/routes')) {
      const hydration = runPortable(source, repositories, 'hydrate', '--apply');
      if (hydration.status !== 0) throw new Error(`workspace hydration failed: ${hydration.error ?? 'unknown error'}`);
    }
  } catch (error) {
    for (const [path, content] of backups) {
      if (content === null) rmSync(path, { force: true });
      else atomicWrite(path, content);
    }
    throw error;
  }
  const final = createReport(source, repositories, 'upgrade-apply', initial.plannedChanges);
  if (final.status !== 'ready') throw new Error(`Source remains ${final.status} after safe upgrade`);
  return final;
}

export function run(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!['check', 'upgrade'].includes(command)) throw new Error('Usage: source-readiness.mjs <check|upgrade> --source-root <Source> [--repositories-root <path>] [--plan|--apply]');
  const sourceRoot = value(argv, '--source-root') ?? defaultSource;
  const repositoriesRoot = value(argv, '--repositories-root') ?? dirname(resolve(sourceRoot));
  let report;
  if (command === 'check') {
    if (argv.includes('--plan') || argv.includes('--apply')) throw new Error('check accepts neither --plan nor --apply');
    report = inspectSource({ sourceRoot, repositoriesRoot });
  } else {
    const plan = argv.includes('--plan');
    const apply = argv.includes('--apply');
    if (plan === apply) throw new Error('upgrade requires exactly one of --plan or --apply');
    report = upgradeSource({ sourceRoot, repositoriesRoot, apply });
  }
  console.log(JSON.stringify(report));
  return report.status === 'ready' ? 0 : report.status === 'stale' ? 1 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
