import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectBinding, enqueueRepository, ownedPathPlacements } from '../scripts/kernel/target-repo.mjs';
import { ensureWorkflowWorktree, workflowAppRepo, sideOf } from '../scripts/kernel/workflow-worktree.mjs';
import { fakeOrcaWorktrees } from './helpers/fake-orca-worktrees.mjs';
import { boundRepos, defaultPushRepos } from '../scripts/supervisor/push-mains.mjs';
import { workspaceBoundRepoRoots } from '../scripts/lib/hk-orphan-ledgers.mjs';

const git = (root, ...args) => {
  const run = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stderr);
};

test('one app binding resolves both roles, app-root Work and the one workflow worktree', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-binding-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const source = path.join(base, 'source');
  const app = path.join(base, 'app');
  fs.mkdirSync(path.join(source, '.workspaces', 'projects', 'sample'), { recursive: true });
  fs.mkdirSync(path.join(app, 'be', 'src'), { recursive: true });
  fs.mkdirSync(path.join(app, 'fe', 'src'), { recursive: true });
  fs.writeFileSync(path.join(app, 'be', 'src', 'main.ts'), 'export const backend = true;\n');
  fs.writeFileSync(path.join(app, 'fe', 'src', 'page.tsx'), 'export const frontend = true;\n');
  fs.writeFileSync(path.join(app, 'package.json'), '{"name":"sample","private":true}\n');
  fs.writeFileSync(path.join(source, '.workspaces', 'projects', 'sample', 'work.json'), JSON.stringify({
    schema: 'starci/workspace-binding@2', project: 'sample',
    repository: { pathFromSource: '../app', gitRepository: 'https://example.test/app.git' },
    sides: { be: 'be', fe: 'fe' }, work: { pathFromRepository: '.starciwork' },
  }));
  git(app, 'init', '-q', '-b', 'main');
  git(app, 'config', 'user.email', 'spec@starci.test');
  git(app, 'config', 'user.name', 'Spec');
  git(app, 'add', '.');
  git(app, 'commit', '-q', '-m', 'init');
  const before = process.env.STARCI_SOURCE_ROOT;
  process.env.STARCI_SOURCE_ROOT = source;
  t.after(() => { if (before === undefined) delete process.env.STARCI_SOURCE_ROOT; else process.env.STARCI_SOURCE_ROOT = before; });

  const binding = projectBinding(app, { sourceRoot: source });
  assert.equal(binding.appRoot, app);
  assert.equal(binding.workDir, '.starciwork');
  assert.deepEqual(binding.repos.map((r) => [r.role, r.root]), [['be', path.join(app, 'be')], ['fe', path.join(app, 'fe')]]);
  assert.deepEqual(boundRepos(app, { sourceRoot: source }), [app]);
  assert.equal(defaultPushRepos({ repos: ['../app'] }, { sourceRoot: source }).filter((r) => r === app).length, 1);
  assert.deepEqual(workspaceBoundRepoRoots({ env: { STARCI_SOURCE_ROOT: source } }), [app.replace(/\\/g, '/')]);
  // Every owned path is app-relative: its first segment names its side.
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['be/src/main.ts'], repo: app }), { ok: true, repository: 'be' });
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['fe/src/page.tsx'], repo: app }), { ok: true, repository: 'fe' });
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['be/src/main.ts', 'fe/src/page.tsx'], repo: app }), { ok: true, repository: 'app' });
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['package.json'], repo: app }), { ok: true, repository: 'app' });
  const grants = ownedPathPlacements({ op: 'code.refactor', payload: {}, ownedPaths: ['be/src/main.ts', 'fe/src/page.tsx', '.starciwork/features/a', 'package.json'], repo: app });
  assert.deepEqual(grants.map((p) => [p.role, p.base, p.path, p.via]), [
    ['be', app, 'be/src/main.ts', 'app-relative'],
    ['fe', app, 'fe/src/page.tsx', 'app-relative'],
    [null, app, '.starciwork/features/a', 'work-owner'],
    ['app', app, 'package.json', 'app-relative'],
  ]);
  // The workflow worktree is in the bound app repository; an op's side comes from its app-relative owned paths.
  assert.equal(workflowAppRepo(app, { binding }), app);
  assert.deepEqual(['be/src/main.ts', 'fe/src/page.tsx', 'package.json', '.starciwork/features/a'].map((p) => sideOf([p])), ['be', 'fe', 'both', null]);
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  const made = ensureWorkflowWorktree({ env, orca: fakeOrcaWorktrees({ root: path.join(base, 'orca') }) }, { workflowId: 'wf-app-12345678', appRepo: app });
  assert.equal(made.ok, true, JSON.stringify(made));
  const wt = made.record.path;
  assert.ok(fs.existsSync(path.join(wt, 'be', 'src', 'main.ts')));
  assert.ok(fs.existsSync(path.join(wt, 'fe', 'src', 'page.tsx')));
  const mapped = ownedPathPlacements({ op: 'code.refactor', payload: {}, ownedPaths: ['be/src/main.ts', 'fe/src/page.tsx', '.starciwork/features/a'], repo: app, worktree: wt });
  assert.deepEqual(mapped.map((p) => [p.role, path.resolve(p.base), p.path]), [['be', path.resolve(wt), 'be/src/main.ts'], ['fe', path.resolve(wt), 'fe/src/page.tsx'], [null, path.resolve(wt), '.starciwork/features/a']]);

  fs.writeFileSync(path.join(source, '.workspaces', 'projects', 'sample', 'work.json'), JSON.stringify({
    schema: 'starci/workspace-binding@1', project: 'sample',
    repositories: { be: { pathFromSource: '../app' } }, work: { ownerRole: 'be', pathFromRepository: '.starciwork' },
  }));
  assert.equal(projectBinding(app, { sourceRoot: source }), null, 'the previous binding shape is refused');
});
