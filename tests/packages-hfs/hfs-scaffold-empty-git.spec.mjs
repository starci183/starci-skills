import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { main } from '../../packages/hfs/src/main.mjs';
import { safeRemove } from '../../scripts/api/fs/safe-remove.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { posixPath } from '../../scripts/lib/path-key.mjs';

const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };
const ORIGIN = 'https://example.invalid/empty-app.git';
const gitEnv = root => ({
  ...withoutGitLocalEnv(process.env), GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: posixPath(path.join(path.dirname(root), 'global.gitconfig')),
});
const git = (root, ...args) => execFileSync('git', args, { cwd: root, env: gitEnv(root), encoding: 'utf8', windowsHide: true }).trim();

function fixture(t, name = 'demo') {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-scaffold-empty-git-'));
  t.after(() => {
    const removed = safeRemove(into, { hold: () => null });
    assert.equal(removed.ok, true, JSON.stringify(removed));
  });
  const root = path.join(into, name);
  fs.writeFileSync(path.join(into, 'global.gitconfig'), '');
  fs.mkdirSync(root);
  git(root, 'init', '--initial-branch=main', '--template=');
  git(root, 'remote', 'add', 'origin', ORIGIN);
  git(root, 'config', 'scaffold.keep', 'original-owner-config');
  return { into, root, name, before: gitSnapshot(root) };
}

/** Hash every Git metadata file and retain directory entries without following a link. */
function gitSnapshot(root) {
  const result = [];
  const walk = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${prefix}${entry.name}`;
      const target = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `${relative} must stay plain`);
      if (entry.isDirectory()) {
        result.push([`${relative}/`, 'directory']);
        walk(target, `${relative}/`);
      } else result.push([relative, createHash('sha256').update(fs.readFileSync(target)).digest('hex')]);
    }
  };
  walk(path.join(root, '.git'));
  return result;
}

function assertGitPreserved({ root, before }) {
  assert.deepEqual(gitSnapshot(root), before);
  assert.equal(git(root, 'remote', 'get-url', 'origin'), ORIGIN);
  assert.equal(git(root, 'config', '--get', 'scaffold.keep'), 'original-owner-config');
  assert.equal(git(root, 'symbolic-ref', 'HEAD'), 'refs/heads/main');
  assert.equal(spawnSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: root, env: gitEnv(root), windowsHide: true }).status, 1);
}

const fakeLock = root => {
  const name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name;
  fs.writeFileSync(path.join(root, 'package-lock.json'), `${JSON.stringify({ name, lockfileVersion: 3, packages: {} })}\n`);
  return { ok: true };
};
const scaffold = (f, options = {}) => scaffoldApp({ name: f.name, into: f.into, presets: PRESETS, lock: fakeLock, ...options });

test('the public app scaffold entry accepts actual empty unborn main and preserves every Git metadata byte', async t => {
  const f = fixture(t);
  let stderr = '';
  const code = await main(['scaffold', f.name, '--into', f.into], {
    cwd: f.into, presets: PRESETS, lock: fakeLock, stdout: () => {}, stderr: text => { stderr += text; },
  });
  assert.equal(code, 0, stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'hfs.json'), 'utf8')).kind, 'app');
  for (const relative of ['package.json', 'package-lock.json', 'be/nest-cli.json', 'fe/apps/app/package.json', '.starciwork/workspace.yaml']) {
    assert.ok(fs.statSync(path.join(f.root, relative)).isFile());
  }
  assertGitPreserved(f);
});

test('occupied Git roots refuse before any lock or application write', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'owner.txt'), 'keep these application bytes\n');
  let calls = 0;
  assert.throws(() => scaffold(f, { lock: () => { calls += 1; return { ok: true }; } }), { code: 'HFS_SCAFFOLD_EXISTS' });
  assert.equal(calls, 0);
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['.git', 'owner.txt']);
  assert.equal(fs.readFileSync(path.join(f.root, 'owner.txt'), 'utf8'), 'keep these application bytes\n');
  assertGitPreserved(f);
});

test('a .git-only root with staged content refuses without changing its index', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'staged.txt'), 'already staged\n');
  git(f.root, 'add', '--', 'staged.txt');
  fs.unlinkSync(path.join(f.root, 'staged.txt'));
  f.before = gitSnapshot(f.root);
  assert.throws(() => scaffold(f), { code: 'HFS_SCAFFOLD_EXISTS' });
  assert.deepEqual(fs.readdirSync(f.root), ['.git']);
  assertGitPreserved(f);
  assert.equal(git(f.root, 'ls-files', '--cached'), 'staged.txt');
});

test('an empty Git repository with a committed main refuses before scaffold effects', t => {
  const f = fixture(t);
  git(f.root, '-c', 'user.name=Scaffold fixture', '-c', 'user.email=scaffold@example.invalid', 'commit', '--allow-empty', '-m', 'existing main');
  const before = gitSnapshot(f.root);
  assert.throws(() => scaffold(f), { code: 'HFS_SCAFFOLD_EXISTS' });
  assert.deepEqual(gitSnapshot(f.root), before);
  assert.deepEqual(fs.readdirSync(f.root), ['.git']);
});

for (const failure of ['refused', 'thrown']) {
  test(`a ${failure} lock cleans generated files and preserves existing .git`, t => {
    const f = fixture(t);
    const lock = root => {
      fakeLock(root);
      if (failure === 'thrown') throw new Error('lock adapter failed');
      return { ok: false, detail: 'fixture registry unavailable' };
    };
    assert.throws(() => scaffold(f, { lock }), failure === 'thrown' ? /lock adapter failed/ : { code: 'HFS_SCAFFOLD_LOCK_FAILED' });
    assert.deepEqual(fs.readdirSync(f.root), ['.git']);
    assertGitPreserved(f);
  });
}

test('a lite type-generation failure preserves existing .git and cleans its partial scaffold', t => {
  const f = fixture(t);
  let calls = 0;
  assert.throws(() => scaffold(f, {
    edition: 'lite',
    emitTypes: () => { throw new Error('fixture Supabase unavailable'); },
    lock: () => { calls += 1; return { ok: true }; },
  }), { code: 'HFS_SCAFFOLD_TYPES_FAILED' });
  assert.equal(calls, 0);
  assert.deepEqual(fs.readdirSync(f.root), ['.git']);
  assertGitPreserved(f);
});

test('a managed rendering exception cleans written skeleton files and preserves .git', t => {
  const f = fixture(t);
  const presets = { get sonarExclusions() { throw new Error('fixture preset unavailable'); } };
  assert.throws(() => scaffold(f, { presets }), /fixture preset unavailable/);
  assert.deepEqual(fs.readdirSync(f.root), ['.git']);
  assertGitPreserved(f);
});

test('failed cleanup keeps unknown files and never enters a replacement parent directory link', t => {
  const f = fixture(t);
  const outside = path.join(f.into, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'owner.txt'), 'outside custody\n');
  const lock = root => {
    fs.writeFileSync(path.join(root, 'owner.txt'), 'new owner file\n');
    fs.renameSync(path.join(root, 'be'), path.join(f.into, 'generated-be'));
    fs.symlinkSync(outside, path.join(root, 'be'), 'junction');
    return { ok: false, detail: 'fixture failure after another writer' };
  };
  assert.throws(() => scaffold(f, { lock }), error => error.code === 'HFS_SCAFFOLD_LOCK_FAILED' && /cleanup retained/.test(error.message));
  assert.equal(fs.readFileSync(path.join(f.root, 'owner.txt'), 'utf8'), 'new owner file\n');
  assert.equal(fs.readFileSync(path.join(outside, 'owner.txt'), 'utf8'), 'outside custody\n');
  assert.ok(fs.lstatSync(path.join(f.root, 'be')).isSymbolicLink());
  assert.equal(fs.existsSync(path.join(f.root, 'hfs.json')), false);
  assertGitPreserved(f);
});

test('an unexpected lockfile directory is retained and reported instead of claimed as output', t => {
  const f = fixture(t);
  assert.throws(() => scaffold(f, { lock: root => {
    fs.mkdirSync(path.join(root, 'package-lock.json'));
    return { ok: false, detail: 'unexpected output kind' };
  } }), error => error.code === 'HFS_SCAFFOLD_LOCK_FAILED' && /cleanup retained/.test(error.message));
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['.git', 'package-lock.json']);
  assert.ok(fs.statSync(path.join(f.root, 'package-lock.json')).isDirectory());
  assertGitPreserved(f);
});

test('a .git directory link refuses without reading or changing its target', t => {
  const f = fixture(t);
  const metadata = path.join(f.into, 'original-git');
  fs.renameSync(path.join(f.root, '.git'), metadata);
  fs.symlinkSync(metadata, path.join(f.root, '.git'), 'junction');
  const config = fs.readFileSync(path.join(metadata, 'config'));
  assert.throws(() => scaffold(f), { code: 'HFS_SCAFFOLD_EXISTS' });
  assert.deepEqual(fs.readFileSync(path.join(metadata, 'config')), config);
  assert.deepEqual(fs.readdirSync(f.root), ['.git']);
});

test('a new root still disappears after an ordinary failed lock', t => {
  const f = fixture(t);
  f.name = 'new-app';
  assert.throws(() => scaffold(f, { lock: () => ({ ok: false, detail: 'fixture failure' }) }), { code: 'HFS_SCAFFOLD_LOCK_FAILED' });
  assert.equal(fs.existsSync(path.join(f.into, f.name)), false);
  assertGitPreserved(f);
});
