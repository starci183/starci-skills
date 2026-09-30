import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectBinding, enqueueRepository, ownedPathPlacements } from '../scripts/kernel/target-repo.mjs';
import { planIsolation, ensureOpWorktree } from '../scripts/kernel/product-worktree.mjs';
import { boundRepos, defaultPushRepos } from '../scripts/supervisor/push-mains.mjs';
import { workspaceBoundRepoRoots } from '../scripts/lib/hk-orphan-ledgers.mjs';

const git = (root, ...args) => {
  const run = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stderr);
};

test('one app binding resolves both roles, app-root Work and one op worktree', (t) => {
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
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['src/main.ts'], repo: app }), { ok: true, repository: 'be' });
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['src/page.tsx'], repo: app }), { ok: true, repository: 'fe' });
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['src/main.ts', 'src/page.tsx'], repo: app }), { ok: true, repository: 'app' });
  assert.deepEqual(enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths: ['package.json'], repo: app }), { ok: true, repository: 'app' });
  const both = ownedPathPlacements({ op: 'code.refactor', payload: { repository: 'app' }, ownedPaths: ['src/main.ts', 'src/page.tsx'], repo: app });
  assert.deepEqual(both.map((p) => p.role), ['be', 'fe']);
  const grants = ownedPathPlacements({ op: 'code.refactor', payload: {}, ownedPaths: ['be/src/main.ts', 'fe/src/page.tsx', '.starciwork/features/a'], repo: app });
  assert.deepEqual(grants.map((p) => [p.role, p.base, p.path]), [
    ['be', path.join(app, 'be'), 'src/main.ts'],
    ['fe', path.join(app, 'fe'), 'src/page.tsx'],
    [null, app, '.starciwork/features/a'],
  ]);
  const isolation = planIsolation({ brief: { policy: { isolation: 'worktree' } }, placements: grants, binding });
  assert.equal(isolation.isolate, true);
  assert.equal(isolation.repoRoot, app);
  const made = ensureOpWorktree({ repoRoot: isolation.repoRoot, workflowId: 'wf-app-12345678', jobId: 'op-app-12345678' });
  assert.equal(made.ok, true, JSON.stringify(made));
  const wt = made.record.op.path;
  assert.ok(fs.existsSync(path.join(wt, 'be', 'src', 'main.ts')));
  assert.ok(fs.existsSync(path.join(wt, 'fe', 'src', 'page.tsx')));
  const mapped = ownedPathPlacements({ op: 'code.refactor', payload: {}, ownedPaths: ['be/src/main.ts', 'fe/src/page.tsx', '.starciwork/features/a'], repo: app, worktree: wt });
  assert.deepEqual(mapped.map((p) => [p.role, p.base]), [['be', path.join(wt, 'be')], ['fe', path.join(wt, 'fe')], [null, wt]]);

  fs.writeFileSync(path.join(source, '.workspaces', 'projects', 'sample', 'work.json'), JSON.stringify({
    schema: 'starci/workspace-binding@1', project: 'sample',
    repositories: { be: { pathFromSource: '../app' } }, work: { ownerRole: 'be', pathFromRepository: '.starciwork' },
  }));
  assert.equal(projectBinding(app, { sourceRoot: source }), null, 'the previous binding shape is refused');
});
