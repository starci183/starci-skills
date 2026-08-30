import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inspectSource, upgradeSource } from './source-readiness.mjs';

const schemaRoot = fileURLToPath(new URL('../readiness/initialization/workspaces/', import.meta.url));
const bootstrapTemplate = fileURLToPath(new URL('../readiness/initialization/bootstrap/agent-bootstrap.md', import.meta.url));
const portableScript = fileURLToPath(new URL('./workspace-portable.mjs', import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function git(repository, ...args) {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

function fixture(t, {
  runtimeVersion = '7.2.0',
  configVersion = 6,
  routeVersion = 6,
  role = 'be',
  grammar = null
} = {}) {
  const repositories = mkdtempSync(join(tmpdir(), 'starci-source-readiness-'));
  const source = join(repositories, 'source');
  t.after(() => rmSync(repositories, { recursive: true, force: true }));
  mkdirSync(source, { recursive: true });
  execFileSync('git', ['init', '-b', 'main', source], { stdio: 'ignore', windowsHide: true });
  git(source, 'config', 'user.name', 'Test');
  git(source, 'config', 'user.email', 'test@example.com');
  git(source, 'remote', 'add', 'origin', 'https://github.com/starci-lab/source.git');

  mkdirSync(join(source, '.claude', 'readiness', 'initialization', 'workspaces'), { recursive: true });
  for (const name of ['config.schema.json', 'portable-route.schema.json', 'local-route.schema.json']) {
    copyFileSync(join(schemaRoot, name), join(source, '.claude', 'readiness', 'initialization', 'workspaces', name));
  }
  writeJson(join(source, '.claude', 'package.json'), { name: 'starci-skills', version: runtimeVersion });
  const bootstrap = readFileSync(bootstrapTemplate, 'utf8');
  writeFileSync(join(source, 'AGENTS.md'), bootstrap);
  writeFileSync(join(source, 'CLAUDE.md'), bootstrap);
  writeFileSync(join(source, '.gitignore'), '.workspace/\n/.workspaces/local/\n/.worktrees/\n/.gitmounts/\n/.sessions/\n');
  writeJson(join(source, 'package.json'), { name: 'source', private: true });
  writeJson(join(source, '.workspaces', 'config.json'), configVersion === 6
    ? { $schema: '../.claude/readiness/initialization/workspaces/config.schema.json', schemaVersion: 6, defaultLang: 'vi' }
    : { $schema: '../.claude/readiness/initialization/workspaces/config.schema.json', version: 1, defaultLang: 'vi' });

  const common = {
    $schema: '../../../.claude/readiness/initialization/workspaces/portable-route.schema.json',
    project: 'source',
    role,
    repository: {
      kind: 'source',
      directory: null,
      gitRepository: 'https://github.com/starci-lab/source.git',
      branch: 'main'
    }
  };
  const route = routeVersion === 6
    ? {
        ...common,
        schemaVersion: 6,
        context: { instructions: [], manifests: ['package.json'], grammarId: grammar }
      }
    : {
        ...common,
        version: 1,
        context: {
          instructions: [],
          manifests: ['package.json'],
          grammar,
          grammarProfile: grammar
        }
      };
  writeJson(join(source, '.workspaces', 'projects', 'source', `${role}.json`), route);
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'fixture');
  execFileSync(process.execPath, [portableScript, 'hydrate', '--apply', '--source', source, '--repositories-root', repositories], {
    stdio: 'ignore',
    windowsHide: true
  });
  return { repositories, source };
}

test('reports a fully current Source by module', (t) => {
  const f = fixture(t);
  const report = inspectSource({ sourceRoot: f.source, repositoriesRoot: f.repositories });
  assert.equal(report.status, 'ready');
  assert.deepEqual(Object.fromEntries(Object.entries(report.modules).map(([id, module]) => [id, module.status])), {
    runtime: 'ready',
    bootstrap: 'ready',
    workspaces: 'ready',
    worktrees: 'ready'
  });
  assert.equal(report.modules.workspaces.commitPolicyId, 'workspace-multidevice-commit-boundary-v1');
  assert.deepEqual(report.modules.workspaces.portableUntracked, []);
  assert.deepEqual(report.modules.workspaces.localStateTracked, []);
});

test('detects and safely repairs stale CLAUDE.md', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.source, 'CLAUDE.md'), '# stale V5 instructions\n');
  const before = inspectSource({ sourceRoot: f.source, repositoriesRoot: f.repositories });
  assert.equal(before.status, 'stale');
  assert.equal(before.modules.bootstrap.status, 'initialize-required');
  const after = upgradeSource({ sourceRoot: f.source, repositoriesRoot: f.repositories, apply: true });
  assert.equal(after.status, 'ready');
  assert.equal(readFileSync(join(f.source, 'CLAUDE.md'), 'utf8'), readFileSync(bootstrapTemplate, 'utf8'));
});

test('detects a V5 runtime before any Source mutation', (t) => {
  const f = fixture(t, { runtimeVersion: '5.9.0' });
  const report = inspectSource({ sourceRoot: f.source, repositoriesRoot: f.repositories });
  assert.equal(report.status, 'blocked');
  assert.equal(report.modules.runtime.code, 'runtime-upgrade-required');
  assert.match(report.modules.runtime.findings[0], /upgrade \.claude first/);
});

test('upgrades safe legacy workspace declarations and rehydrates local routes', (t) => {
  const f = fixture(t, { configVersion: 1, routeVersion: 1 });
  const before = inspectSource({ sourceRoot: f.source, repositoriesRoot: f.repositories });
  assert.equal(before.status, 'stale');
  assert.equal(before.modules.workspaces.status, 'initialize-required');
  const after = upgradeSource({ sourceRoot: f.source, repositoriesRoot: f.repositories, apply: true });
  assert.equal(after.status, 'ready');
  assert.equal(JSON.parse(readFileSync(join(f.source, '.workspaces', 'config.json'), 'utf8')).schemaVersion, 6);
  assert.equal(JSON.parse(readFileSync(join(f.source, '.workspaces', 'projects', 'source', 'be.json'), 'utf8')).schemaVersion, 6);
  assert.equal(JSON.parse(readFileSync(join(f.source, '.workspaces', 'local', 'routes', 'source', 'be', 'config.json'), 'utf8')).schemaVersion, 6);
});

test('blocks ambiguous legacy Grammar and unregistered worktrees without mutating them', (t) => {
  const grammarFixture = fixture(t, { configVersion: 1, routeVersion: 1, role: 'fe', grammar: 'starci' });
  const grammarReport = upgradeSource({ sourceRoot: grammarFixture.source, repositoriesRoot: grammarFixture.repositories, apply: true });
  assert.equal(grammarReport.status, 'blocked');
  assert.deepEqual(grammarReport.modules.workspaces.grammarMappingRequired, ['.workspaces/projects/source/fe.json']);
  assert.equal(JSON.parse(readFileSync(join(grammarFixture.source, '.workspaces', 'projects', 'source', 'fe.json'), 'utf8')).version, 1);

  const worktreeFixture = fixture(t);
  const foreign = join(worktreeFixture.source, '.worktrees', 'businesses');
  mkdirSync(foreign, { recursive: true });
  execFileSync('git', ['init', '-b', 'main', foreign], { stdio: 'ignore', windowsHide: true });
  const worktreeReport = inspectSource({ sourceRoot: worktreeFixture.source, repositoriesRoot: worktreeFixture.repositories });
  assert.equal(worktreeReport.modules.worktrees.status, 'blocked');
  assert.deepEqual(worktreeReport.modules.worktrees.unregisteredPaths, ['.worktrees/businesses']);
});

test('does not confuse clean reference clones with Source-owned Git worktrees', (t) => {
  const f = fixture(t);
  const reference = join(f.source, '.worktrees', 'references', 'source-be');
  mkdirSync(reference, { recursive: true });
  execFileSync('git', ['init', '-b', 'main', reference], { stdio: 'ignore', windowsHide: true });
  git(reference, 'config', 'user.name', 'Test');
  git(reference, 'config', 'user.email', 'test@example.com');
  writeJson(join(reference, 'package.json'), { name: 'reference' });
  git(reference, 'add', 'package.json');
  git(reference, 'commit', '-m', 'reference');
  const report = inspectSource({ sourceRoot: f.source, repositoriesRoot: f.repositories });
  assert.equal(report.modules.worktrees.status, 'ready');
  assert.deepEqual(report.modules.worktrees.unregisteredPaths, []);
});

test('blocks untracked portable authority and tracked machine-local state', (t) => {
  const portableFixture = fixture(t);
  const original = JSON.parse(readFileSync(join(portableFixture.source, '.workspaces', 'projects', 'source', 'be.json'), 'utf8'));
  const extra = { ...original, project: 'second' };
  writeJson(join(portableFixture.source, '.workspaces', 'projects', 'second', 'be.json'), extra);
  const portableReport = inspectSource({ sourceRoot: portableFixture.source, repositoriesRoot: portableFixture.repositories });
  assert.equal(portableReport.status, 'blocked');
  assert.deepEqual(portableReport.modules.workspaces.portableUntracked, ['.workspaces/projects/second/be.json']);

  const localFixture = fixture(t);
  writeJson(join(localFixture.source, '.workspaces', 'local', 'leak.json'), { leaked: true });
  git(localFixture.source, 'add', '-f', '.workspaces/local/leak.json');
  const localReport = inspectSource({ sourceRoot: localFixture.source, repositoriesRoot: localFixture.repositories });
  assert.equal(localReport.status, 'blocked');
  assert.deepEqual(localReport.modules.workspaces.localStateTracked, ['.workspaces/local/leak.json']);
});

test('two devices share portable intent and rebuild independent local routes', (t) => {
  const first = fixture(t);
  const secondRoot = mkdtempSync(join(tmpdir(), 'starci-device-two-'));
  t.after(() => rmSync(secondRoot, { recursive: true, force: true }));
  const second = join(secondRoot, 'source');
  execFileSync('git', ['clone', '--quiet', first.source, second], { windowsHide: true });
  git(second, 'remote', 'set-url', 'origin', 'https://github.com/starci-lab/source.git');
  execFileSync(process.execPath, [portableScript, 'hydrate', '--apply', '--source', second, '--repositories-root', secondRoot], {
    stdio: 'ignore', windowsHide: true
  });

  const firstPortable = JSON.parse(readFileSync(join(first.source, '.workspaces', 'projects', 'source', 'be.json'), 'utf8'));
  const secondPortable = JSON.parse(readFileSync(join(second, '.workspaces', 'projects', 'source', 'be.json'), 'utf8'));
  assert.deepEqual(secondPortable, firstPortable);
  const firstLocal = JSON.parse(readFileSync(join(first.source, '.workspaces', 'local', 'routes', 'source', 'be', 'config.json'), 'utf8'));
  const secondLocal = JSON.parse(readFileSync(join(second, '.workspaces', 'local', 'routes', 'source', 'be', 'config.json'), 'utf8'));
  assert.notEqual(firstLocal.repository.diskPath, secondLocal.repository.diskPath);
  assert.equal(git(second, 'ls-files', '.workspaces/local'), '');
  const report = inspectSource({ sourceRoot: second, repositoriesRoot: secondRoot });
  assert.equal(report.status, 'ready');
});
