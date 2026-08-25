#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const defaultSource = resolve(scriptRoot, '..', '..');
const policyPath = resolve(scriptRoot, '..', 'readiness', 'initialization', 'workspaces', 'commit-policy.json');
const slash = (value) => value.split(sep).join('/');

function git(source, args) {
  return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', windowsHide: true });
}

function portableFiles(source) {
  const root = join(source, '.workspaces', 'projects');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((project) => {
    const projectRoot = join(root, project.name);
    return readdirSync(projectRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => slash(relative(source, join(projectRoot, entry.name))));
  }).sort();
}

function ignored(source, path) {
  const probe = `${path}/.starci-portable-probe`;
  return spawnSync('git', ['-C', source, 'check-ignore', '--no-index', '--quiet', '--', probe], { windowsHide: true }).status === 0;
}

export function inspectCommitPolicy({ sourceRoot = defaultSource } = {}) {
  const source = resolve(sourceRoot);
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  const tracked = new Set(git(source, ['ls-files', '-z']).split('\0').filter(Boolean).map((item) => item.replaceAll('\\', '/')));
  const portable = portableFiles(source);
  const optionalPortable = ['.workspaces/device-state.json'].filter((path) => existsSync(join(source, ...path.split('/'))));
  const required = [...policy.sourceRepository.requiredTracked, ...portable, ...optionalPortable];
  const portableUntracked = required.filter((path) => !tracked.has(path));
  const localStateTracked = [...tracked].filter((path) => policy.sourceRepository.forbiddenTrackedPrefixes.some((prefix) => path.startsWith(prefix)));
  const missingIgnoreRules = policy.sourceRepository.requiredIgnoredRoots.filter((path) => !ignored(source, path));
  const findings = [
    ...portableUntracked.map((path) => `${path} is portable authority but is not tracked`),
    ...localStateTracked.map((path) => `${path} is machine-local state but is tracked`),
    ...missingIgnoreRules.map((path) => `${path}/ is local-only but has no effective Git ignore rule`)
  ];
  return {
    schemaVersion: 1,
    policyId: policy.id,
    status: findings.length === 0 ? 'ready' : 'blocked',
    portableRouteCount: portable.length,
    portableUntracked,
    localStateTracked,
    missingIgnoreRules,
    findings
  };
}

function run(argv = process.argv.slice(2)) {
  if (argv[0] !== 'check') throw new Error('Usage: workspace-commit-policy.mjs check [--source-root <Source>]');
  const index = argv.indexOf('--source-root');
  const sourceRoot = index < 0 ? defaultSource : argv[index + 1];
  if (!sourceRoot) throw new Error('--source-root requires a value');
  const report = inspectCommitPolicy({ sourceRoot });
  console.log(JSON.stringify(report));
  return report.status === 'ready' ? 0 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = run(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
