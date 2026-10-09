// The artefacts the runtime installs outside its tree (modules/kernel/installed-artefacts.yaml): a real temporary git repository holding an OLD history
// hook is migrated to the revision's version, verified, idempotently, for every live workflow tree; a foreign hook is never touched; the engine does the
// same lazily at start for what a deploy could not reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HANDLERS, loadArtefacts, migrateInstalledArtefacts, migrateTarget, workflowTargets } from '../../scripts/reconciler/installed-artefacts.mjs';
import { startRecovery } from '../../scripts/reconciler/engine-process.mjs';
import { runtimeArtefacts } from '../../scripts/reconciler/artefacts-verb.mjs';
import { HOOK_VERSION, WORK_HOOK_VERSION, historyHookBody, ensureWorkHook } from '../../scripts/guards/hook-install.mjs';
import { hookFileOf, hookStamp } from '../../scripts/guards/hook-stamp.mjs';
import { checkInstalledArtefacts } from '../../scripts/checks/check-installed-artefacts.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A real repository on main with one commit, and the history hook of an OLDER revision in its hooks directory. */
function repoWithOldHook(t, { version = HOOK_VERSION - 1 } = {}) {
  const dir = makeTempDir('starci-artefact-repo-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const file = hookFileOf(dir, 'reference-transaction');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const old = historyHookBody({ branches: ['main'], root: skillRoot }).replace(`starci-history-guard v${HOOK_VERSION}`, `starci-history-guard v${version}`);
  fs.writeFileSync(file, old, { mode: 0o700 });
  return { dir, file, old };
}

test('a real repository holding an old history hook is migrated to this revision, verified, and a second run changes nothing', (t) => {
  const repo = repoWithOldHook(t);
  assert.equal(hookStamp(repo.dir, 'reference-transaction', 'starci-history-guard').version, HOOK_VERSION - 1);
  const first = migrateTarget('history-hook', repo.dir, { root: skillRoot });
  assert.equal(first.state, 'migrated');
  assert.deepEqual([first.before, first.after], [HOOK_VERSION - 1, HOOK_VERSION]);
  assert.equal(hookStamp(repo.dir, 'reference-transaction', 'starci-history-guard').version, HOOK_VERSION);
  const bytes = fs.readFileSync(repo.file, 'utf8');
  const second = migrateTarget('history-hook', repo.dir, { root: skillRoot });
  assert.equal(second.state, 'current');
  assert.equal(fs.readFileSync(repo.file, 'utf8'), bytes, 'a current hook is not rewritten');
});

test('a work hook of an older version is rewritten; an absent hook is not installed; a foreign hook is never touched', (t) => {
  const repo = repoWithOldHook(t);
  const workFile = hookFileOf(repo.dir, 'pre-commit');
  ensureWorkHook(repo.dir, { skillRoot });
  fs.writeFileSync(workFile, fs.readFileSync(workFile, 'utf8').replace(`starci-work-guard v${WORK_HOOK_VERSION}`, `starci-work-guard v${WORK_HOOK_VERSION - 1}`));
  assert.equal(migrateTarget('work-hook', repo.dir, { root: skillRoot }).state, 'migrated');
  assert.equal(hookStamp(repo.dir, 'pre-commit', 'starci-work-guard').version, WORK_HOOK_VERSION);

  fs.rmSync(workFile);
  assert.equal(migrateTarget('work-hook', repo.dir, { root: skillRoot }).state, 'absent');
  assert.equal(fs.existsSync(workFile), false, 'a migration never installs a hook the tree did not have');

  fs.writeFileSync(workFile, '#!/bin/sh\necho the owner hook\n');
  const foreign = migrateTarget('work-hook', repo.dir, { root: skillRoot });
  assert.equal(foreign.state, 'skipped');
  assert.equal(fs.readFileSync(workFile, 'utf8'), '#!/bin/sh\necho the owner hook\n');
});

test('a rewrite that does not leave the revision stamp is refused with its code, never reported migrated', (t) => {
  const repo = repoWithOldHook(t);
  const handler = HANDLERS['history-hook'];
  const apply = handler.apply;
  handler.apply = () => ({ changed: true });
  t.after(() => { handler.apply = apply; });
  const out = migrateTarget('history-hook', repo.dir, { root: skillRoot });
  assert.equal(out.state, 'refused');
  assert.equal(out.code, 'installed-artefact-unverified');
  handler.apply = () => { throw new Error('disk full'); };
  assert.equal(migrateTarget('history-hook', repo.dir, { root: skillRoot }).code, 'installed-artefact-failed');
});

test('every live workflow tree of the registry is migrated, running or not yet woken, and a removed tree is left alone', (t) => {
  const state = tempState();
  t.after(() => state.close());
  const live = repoWithOldHook(t), removed = repoWithOldHook(t, { version: HOOK_VERSION - 2 });
  const insert = state.m.db.prepare("INSERT INTO worktrees(path, kind, repo_root, workflow_id, created_at, removed_at) VALUES(?, 'workflow', ?, ?, 1, ?)");
  insert.run(path.resolve(live.dir), path.resolve(live.dir), 'wf-live', null);
  insert.run(path.resolve(removed.dir), path.resolve(removed.dir), 'wf-gone', 2);
  assert.deepEqual(workflowTargets(state.m), [path.resolve(live.dir)]);

  const check = migrateInstalledArtefacts({ root: skillRoot, machine: state.m, apply: false, include: ['repo'] });
  assert.equal(check.ok, false, 'a stale artefact is a finding in check mode');
  assert.equal(check.counts.stale, 1);
  const done = migrateInstalledArtefacts({ root: skillRoot, machine: state.m, include: ['repo'] });
  assert.equal(done.ok, true);
  assert.equal(done.counts.migrated, 1);
  assert.equal(hookStamp(live.dir, 'reference-transaction', 'starci-history-guard').version, HOOK_VERSION, 'no live workflow holds an artefact of an older revision');
  assert.equal(hookStamp(removed.dir, 'reference-transaction', 'starci-history-guard').version, HOOK_VERSION - 2, 'a removed worktree is not the runtime to touch');
});

test('the runtime repository hooks are a host artefact: a stale generated hook is rewritten from the new tree', (t) => {
  const host = repoWithOldHook(t);
  const stale = hookFileOf(host.dir, 'pre-push');
  fs.writeFileSync(stale, '# Generated by the StarCi runtime (scripts/guards/git-hooks.mjs, starci-git-hooks): old\nexit 0\n');
  const done = migrateTarget('runtime-git-hooks', host.dir, { root: host.dir });
  assert.equal(done.state, 'migrated');
  assert.equal(migrateTarget('runtime-git-hooks', host.dir, { root: host.dir }).state, 'current');
});

test('the engine migrates, lazily at start, the artefacts of a workflow tree the deploy could not reach', (t) => {
  const state = tempState();
  t.after(() => state.close());
  const repo = repoWithOldHook(t);
  state.m.db.prepare("INSERT INTO worktrees(path, kind, repo_root, workflow_id, created_at) VALUES(?, 'workflow', ?, 'wf-late', 1)").run(path.resolve(repo.dir), path.resolve(repo.dir));
  const rows = [];
  const engine = { state: state.m, rev: 'new', log: (...row) => rows.push(row), queue: { rearmParked: () => [] }, now: () => 1 };
  startRecovery(engine, {}, { reap: () => ({ released: [] }), boot: () => ({ bootId: 'b' }), copies: () => null, artefacts: (o) => migrateInstalledArtefacts({ ...o, include: ['repo'] }) });
  assert.equal(hookStamp(repo.dir, 'reference-transaction', 'starci-history-guard').version, HOOK_VERSION);
  const logged = rows.find((row) => row[2]?.kind === 'reconciler.artefacts-migrated');
  assert.ok(logged, 'the migration is journalled by the engine');
  assert.equal(logged[2].counts.migrated, 1);
});

test('starci runtime artefacts reports and migrates through the verb, with a code per refusal', async (t) => {
  const state = tempState();
  t.after(() => state.close());
  const repo = repoWithOldHook(t);
  state.m.db.prepare("INSERT INTO worktrees(path, kind, repo_root, workflow_id, created_at) VALUES(?, 'workflow', ?, 'wf-verb', 1)").run(path.resolve(repo.dir), path.resolve(repo.dir));
  const ctx = (args) => ({ args, positionals: [], env: state.env });
  const handlers = ['runtime-git-hooks', 'runtime-copies'].map((id) => [HANDLERS[id], { ...HANDLERS[id] }]);
  for (const [live] of handlers) { live.read = () => ({ state: 'current' }); }
  t.after(() => { for (const [live, saved] of handlers) Object.assign(live, saved); });
  const check = await runtimeArtefacts(ctx({}), { root: skillRoot });
  assert.equal(check.code, 1);
  assert.equal(check.data.counts.stale, 1);
  const migrate = await runtimeArtefacts(ctx({ migrate: true }), { root: skillRoot });
  assert.equal(migrate.code, 0, migrate.text);
  assert.equal(migrate.data.counts.migrated, 1);
});

test('the self-check proves each row has its writer and handler, and refuses a new hook installer that is not declared', (t) => {
  assert.deepEqual(checkInstalledArtefacts(skillRoot), [], 'the shipped tree is whole');
  const dir = makeTempDir('starci-artefact-tree-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  git(dir, 'init', '-q', '-b', 'main');
  for (const rel of ['modules/kernel/installed-artefacts.yaml', 'scripts/guards/hook-install.mjs', 'scripts/guards/git-hooks.mjs', 'scripts/hfs/sync-runtime.mjs', 'scripts/machine/worktree-registry.mjs']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(skillRoot, rel), path.join(dir, rel));
  }
  fs.mkdirSync(path.join(dir, 'scripts/kernel'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts/kernel/new-installer.mjs'), "export const dir = (git) => git(['rev-parse', '--git-path', 'hooks']);\n");
  git(dir, 'add', '-A');
  const found = checkInstalledArtefacts(dir);
  assert.deepEqual(found.map((f) => f.path), ['scripts/kernel/new-installer.mjs']);
  assert.match(found[0].message, /not a declared writer/);
  assert.equal(loadArtefacts(skillRoot).artefacts.every((row) => row.migrate === 'rewrite' || row.reason), true);
});
