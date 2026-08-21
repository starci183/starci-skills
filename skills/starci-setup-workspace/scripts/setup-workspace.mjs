#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, lstat, mkdir, readFile, readdir, readlink, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const CONFIG_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = { check: false, targets: [], contracts: [], grammars: [], grammarProfiles: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') {
      args.check = true;
      continue;
    }
    if (!['--source', '--project', '--target', '--contract', '--grammar', '--grammar-profile'].includes(token)) {
      fail(`Unknown argument: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`Missing value for ${token}`);
    }
    if (token === '--target') args.targets.push(value);
    else if (token === '--contract') args.contracts.push(value);
    else if (token === '--grammar') args.grammars.push(value);
    else if (token === '--grammar-profile') args.grammarProfiles.push(value);
    else args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findSource(start) {
  let cursor = path.resolve(start);
  while (true) {
    const markers = ['AGENTS.md', '.claude', '.workflows'];
    if ((await Promise.all(markers.map((entry) => exists(path.join(cursor, entry))))).every(Boolean)) {
      return realpath(cursor);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      fail(`Cannot locate Source from ${start}; expected AGENTS.md, .claude, and .workflows.`);
    }
    cursor = parent;
  }
}

function git(target, args, required = false) {
  try {
    return execFileSync('git', ['-C', target, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    if (required) fail(`${target} is not a readable git worktree.`);
    return null;
  }
}

function gitSucceeds(target, args) {
  try {
    execFileSync('git', ['-C', target, ...args], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function parseTarget(value) {
  const separator = value.indexOf('=');
  if (separator < 1) fail(`Target must use <role>=<path>: ${value}`);
  const role = value.slice(0, separator);
  const targetPath = value.slice(separator + 1);
  if (!ID_PATTERN.test(role) || !targetPath) fail(`Invalid target: ${value}`);
  return [role, targetPath];
}

async function contextRoutes(repository, explicitContract, grammar, grammarProfile) {
  const instructions = [];
  const manifests = [];
  const instructionCandidates = [
    path.join(repository.gitRoot, 'AGENTS.md'),
    path.join(repository.diskPath, 'AGENTS.md'),
    path.join(repository.gitRoot, 'CLAUDE.md'),
    path.join(repository.diskPath, 'CLAUDE.md'),
  ];

  for (const candidate of [...new Set(instructionCandidates)]) {
    if (await exists(candidate)) instructions.push(candidate);
  }
  const manifest = path.join(repository.diskPath, 'package.json');
  if (await exists(manifest)) manifests.push(manifest);

  let contract = null;
  let contractSource = null;
  if (explicitContract) {
    const candidate = path.isAbsolute(explicitContract) ? explicitContract : path.join(repository.diskPath, explicitContract);
    const resolved = await realpath(candidate);
    if (!isInside(repository.diskPath, resolved)) fail(`Contract must live inside ${repository.diskPath}: ${explicitContract}`);
    contract = resolved;
    contractSource = 'explicit';
  } else {
    const candidates = [
      'src/components/contracts/index.ts',
      'src/components/contracts',
      'src/contracts/index.ts',
      'src/contracts',
      'contracts/index.ts',
      'contracts',
    ];
    for (const relative of candidates) {
      const candidate = path.join(repository.diskPath, relative);
      if (await exists(candidate)) {
        contract = await realpath(candidate);
        contractSource = `discovered:${relative.replaceAll('\\', '/')}`;
        break;
      }
    }
  }
  return { instructions, contract, contractSource, manifests, grammar: grammar ?? null, grammarProfile: grammarProfile ?? null };
}

async function inspectRepository(candidate) {
  const target = await realpath(path.resolve(candidate));
  if (!(await lstat(target)).isDirectory()) fail(`Repository target is not a directory: ${candidate}`);
  const gitRepository = git(target, ['remote', 'get-url', 'origin']);
  if (!gitRepository) fail(`${target} has no origin Git repository.`);
  return {
    diskPath: target,
    gitRoot: path.resolve(git(target, ['rev-parse', '--show-toplevel'], true)),
    branch: git(target, ['branch', '--show-current']) || null,
    head: git(target, ['rev-parse', '--short=12', 'HEAD']) || null,
    gitRepository,
  };
}

async function removeLegacyAlias(aliasPath, targetPath) {
  if (!(await exists(aliasPath))) return false;
  try {
    const stats = await lstat(aliasPath);
    if (!stats.isSymbolicLink()) fail(`Legacy repo entry is not a removable link: ${aliasPath}`);
    const linked = path.resolve(path.dirname(aliasPath), await readlink(aliasPath));
    const linkedReal = await realpath(linked);
    if (path.normalize(linkedReal) !== path.normalize(targetPath)) {
      fail(`Legacy repo link ${aliasPath} points to ${linkedReal}, expected ${targetPath}.`);
    }
    await unlink(aliasPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

async function assertPrivateWorkspace(sourcePath, workspaceRoot, candidate = path.join(workspaceRoot, '.privacy-probe')) {
  if (!git(sourcePath, ['rev-parse', '--show-toplevel'])) return;
  if (!gitSucceeds(sourcePath, ['check-ignore', '--quiet', candidate])) {
    fail(`${workspaceRoot} is not ignored by the Source git repository.`);
  }
  if (gitSucceeds(sourcePath, ['ls-files', '--error-unmatch', candidate])) {
    fail(`${candidate} is tracked by the Source git repository.`);
  }
}

async function configPaths(workspaceRoot) {
  if (!(await exists(workspaceRoot))) return [];
  const results = [];
  for (const project of await readdir(workspaceRoot, { withFileTypes: true })) {
    if (!project.isDirectory() || !ID_PATTERN.test(project.name)) continue;
    for (const role of await readdir(path.join(workspaceRoot, project.name), { withFileTypes: true })) {
      if (!role.isDirectory() || !ID_PATTERN.test(role.name)) continue;
      const configPath = path.join(workspaceRoot, project.name, role.name, 'config.json');
      if (await exists(configPath)) results.push(configPath);
    }
  }
  return results;
}

async function verifyConfig(sourcePath, workspaceRoot, configPath) {
  await assertPrivateWorkspace(sourcePath, workspaceRoot, configPath);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const roleDirectory = path.dirname(configPath);
  const role = path.basename(roleDirectory);
  const project = path.basename(path.dirname(roleDirectory));
  if (config.version !== CONFIG_VERSION || config.project !== project || config.role !== role) {
    fail(`Config identity does not match its folder: ${configPath}`);
  }
  if (!config.repository || typeof config.repository !== 'object') fail(`${configPath} has no repository routing.`);
  const repository = await inspectRepository(config.repository.diskPath);
  if ('workspace' in config.repository || 'alias' in config.repository) fail(`${configPath} still contains legacy repo routing fields.`);
  for (const field of ['diskPath', 'gitRoot', 'branch', 'head', 'gitRepository']) {
    if (config.repository[field] !== repository[field]) {
      fail(`${configPath} has stale repository.${field}; rerun workspace setup.`);
    }
  }
  if (await exists(path.join(roleDirectory, 'repo'))) fail(`Legacy repo link must be removed: ${path.join(roleDirectory, 'repo')}`);
  if (!config.context || !Array.isArray(config.context.instructions) || !Array.isArray(config.context.manifests)) {
    fail(`${configPath} has invalid context routes.`);
  }
  if (config.context.grammar !== null) {
    if (!ID_PATTERN.test(config.context.grammar)) fail(`${configPath} has invalid context.grammar.`);
    if (!ID_PATTERN.test(config.context.grammarProfile ?? '')) fail(`${configPath} requires a valid context.grammarProfile.`);
    const grammarRoot = path.join(sourcePath, '.claude', 'grammars', config.context.grammar);
    for (const name of ['grammar.json', 'facts.json', 'evidence.json']) {
      if (!(await exists(path.join(grammarRoot, name)))) fail(`Grammar route does not exist: ${path.join(grammarRoot, name)}`);
    }
    const profilePath = path.join(grammarRoot, 'profiles', `${config.context.grammarProfile}.json`);
    if (!(await exists(profilePath))) fail(`Grammar profile route does not exist: ${profilePath}`);
  } else if (config.context.grammarProfile !== null) {
    fail(`${configPath} cannot select context.grammarProfile without context.grammar.`);
  }
  const contextPaths = [...config.context.instructions, ...config.context.manifests, config.context.contract].filter(Boolean);
  for (const contextPath of contextPaths) {
    if (!(await exists(contextPath))) fail(`Context route does not exist: ${contextPath}`);
  }
  return config;
}

async function verifyAll(sourcePath, workspaceRoot) {
  await assertPrivateWorkspace(sourcePath, workspaceRoot);
  const legacyPaths = [
    path.join(sourcePath, '.workspaces'),
    path.join(sourcePath, '.claude', 'context', 'workspace.json'),
    path.join(workspaceRoot, 'workspace.json'),
  ];
  for (const legacyPath of legacyPaths) {
    if (await exists(legacyPath)) fail(`Legacy workspace state must be removed: ${legacyPath}`);
  }
  if (await exists(path.join(workspaceRoot, '.claude'))) {
    fail(`A second trust tree exists below .workspace: ${path.join(workspaceRoot, '.claude')}`);
  }
  const paths = await configPaths(workspaceRoot);
  if (paths.length === 0) fail(`No role configs found below ${workspaceRoot}.`);
  const configs = [];
  for (const configPath of paths) configs.push(await verifyConfig(sourcePath, workspaceRoot, configPath));
  return configs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = await findSource(args.source ?? process.cwd());
  const trustPath = path.join(sourcePath, '.claude');
  const workspaceRoot = path.join(sourcePath, '.workspace');

  if (args.check) {
    const configs = await verifyAll(sourcePath, workspaceRoot);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: 'check',
      workspaceRoot,
      configs: configs.map(({ project, role }) => `${project}/${role}`),
      missingContracts: configs.filter(({ context }) => !context.contract).map(({ project, role }) => `${project}/${role}`),
    }, null, 2)}\n`);
    return;
  }
  if (!args.project || !ID_PATTERN.test(args.project)) {
    fail('Provide --project using lowercase letters, digits, dots, underscores, or hyphens.');
  }
  if (args.targets.length === 0) fail('Provide at least one --target <role>=<path>.');
  await assertPrivateWorkspace(sourcePath, workspaceRoot);

  const targets = new Map(args.targets.map(parseTarget));
  const contracts = new Map(args.contracts.map(parseTarget));
  const grammars = new Map(args.grammars.map(parseTarget));
  const grammarProfiles = new Map(args.grammarProfiles.map(parseTarget));
  for (const role of contracts.keys()) {
    if (!targets.has(role)) fail(`Contract role has no target in this run: ${role}`);
  }
  for (const role of grammars.keys()) {
    if (!targets.has(role)) fail(`Grammar role has no target in this run: ${role}`);
    if (!ID_PATTERN.test(grammars.get(role))) fail(`Invalid grammar id for ${role}: ${grammars.get(role)}`);
  }
  for (const role of grammarProfiles.keys()) {
    if (!targets.has(role)) fail(`Grammar profile role has no target in this run: ${role}`);
    if (!ID_PATTERN.test(grammarProfiles.get(role))) fail(`Invalid grammar profile id for ${role}: ${grammarProfiles.get(role)}`);
    if (!grammars.has(role)) fail(`Grammar profile role has no grammar in this run: ${role}`);
  }
  for (const role of grammars.keys()) {
    if (!grammarProfiles.has(role)) fail(`Grammar role requires --grammar-profile ${role}=<profile>: ${role}`);
  }
  const written = [];
  const missingContracts = [];
  const removedLegacyAliases = [];
  for (const [role, targetPath] of targets) {
    const roleDirectory = path.join(workspaceRoot, args.project, role);
    const configPath = path.join(roleDirectory, 'config.json');
    await mkdir(roleDirectory, { recursive: true });
    const repository = await inspectRepository(targetPath);
    const aliasPath = path.join(roleDirectory, 'repo');
    if (await removeLegacyAlias(aliasPath, repository.diskPath)) removedLegacyAliases.push(`${args.project}/${role}/repo`);
    const context = await contextRoutes(repository, contracts.get(role), grammars.get(role), grammarProfiles.get(role));
    if (!context.contract) missingContracts.push(`${args.project}/${role}`);

    const config = {
      $schema: '../../../.claude/common/config/workspace.schema.json',
      version: CONFIG_VERSION,
      project: args.project,
      role,
      source: {
        path: sourcePath,
        trust: trustPath,
        skills: path.join(trustPath, 'skills'),
        workflowRoot: path.join(sourcePath, '.workflows'),
        workspaceRoot,
      },
      repository: {
        ...repository,
      },
      context,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonAtomic(configPath, config);
    await verifyConfig(sourcePath, workspaceRoot, configPath);
    written.push(`${args.project}/${role}`);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'write', workspaceRoot, written, missingContracts, removedLegacyAliases }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`setup-workspace: ${error.message}\n`);
  process.exitCode = 1;
});
