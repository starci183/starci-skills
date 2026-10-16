// repo-root-guard.spec.mjs - no spec may leave files under the repository root outside its declared tmp areas (tests/setup/repo-root-guard.mjs, loaded by isolated-temp.mjs).
// A child `node --test` run whose spec makes a directory under the repo root and leaves it must exit nonzero and name the leftover; one that removes what it made must exit 0.
// The unit cases prove the pieces: the declared areas, the first missing ancestor, the outermost leftovers and the writers the guard wraps.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { TEST_TEMP_ENV } from '../setup/isolated-temp.mjs';
import { DECLARED_AREAS, firstMissing, isDeclared, leaksOf, relativeIn, watchWrites } from '../setup/repo-root-guard.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const preload = pathToFileURL(path.resolve(import.meta.dirname, '..', 'setup', 'isolated-temp.mjs')).href;
const fixture = (name) => path.resolve(import.meta.dirname, '..', 'fixtures', name);
const runSuite = (file) => {
  const env = { ...process.env };
  delete env[TEST_TEMP_ENV];
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--import', preload, '--test', file], { cwd: REPO, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
};

test('a spec that leaves a directory under the repo root fails the run, and the leftover is named', (t) => {
  t.after(() => fs.rmSync(path.join(REPO, '.tmp-root-guard-fixture'), { recursive: true, force: true }));
  const r = runSuite(fixture('repo-root-leaves.mjs'));
  assert.notEqual(r.status, 0, r.stderr);
  const out = r.stdout + r.stderr;
  assert.match(out, /STARCI REPO ROOT LEAK/);
  assert.match(out, /\.tmp-root-guard-fixture\r?\n/);
  assert.doesNotMatch(out, /\.tmp-root-guard-fixture\/inner/, 'only the outermost leftover is listed');
});

test('a spec that removes what it made under the repo root passes clean', () => {
  const r = runSuite(fixture('repo-root-clean.mjs'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /STARCI REPO ROOT LEAK/);
  assert.equal(fs.existsSync(path.join(REPO, '.tmp-root-guard-clean-fixture')), false);
});

test('the declared areas are the generated and disposable roots of .gitignore, and nothing else', () => {
  for (const kept of ['.runtime/spec-cache/a.json', 'node_modules/x/y.js', 'packages/hfs/runtime/index.mjs', 'packages/eslint/be/runtime/a.mjs', 'coverage/lcov.info', '.starciwork/x', 'ui/src/i18n/generated/en.ts', 'examples/lite-app/node_modules/z']) assert.equal(isDeclared(kept), true, kept);
  for (const leaked of ['.tmp-docs', '.tmp-docs/a13-wiring-1/x.ts', 'scripts/new.mjs', 'tests/fixtures/stray.txt', 'packages/hfs/stack/runtime.mjs', 'fixtures']) assert.equal(isDeclared(leaked), false, leaked);
  const ignore = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split(/\r?\n/);
  for (const generated of ignore.filter((line) => /^packages\/.+\/runtime\/$/.test(line))) assert.equal(isDeclared(generated), true, `${generated} is generated and git-ignored`);
  assert.ok(Object.isFrozen(DECLARED_AREAS));
});

test('relativeIn names only paths inside the root, and firstMissing the first path a write creates', () => {
  assert.equal(relativeIn(REPO, path.join(REPO, 'a', 'b.txt')), 'a/b.txt');
  assert.equal(relativeIn(REPO, REPO), null);
  assert.equal(relativeIn(REPO, path.join(REPO, '..', 'elsewhere')), null);
  assert.equal(relativeIn(REPO, 'a/b.txt'), 'a/b.txt');
  const present = new Set([path.resolve('/r'), path.resolve('/r/d')]);
  assert.equal(firstMissing('/r/d/new/deeper/file.txt', (p) => present.has(p)), path.resolve('/r/d/new'));
  assert.equal(firstMissing('/r/d', (p) => present.has(p)), null);
  assert.equal(firstMissing('/r/d/x', () => false), path.parse(path.resolve('/')).root, 'a path that never exists ends at the filesystem root');
});

test('leaksOf lists the outermost recorded paths that still exist, not the declared areas or what was removed', () => {
  const root = path.resolve('/repo');
  const on = new Set(['.tmp-docs', '.tmp-docs/a/b.txt', 'scripts/new.mjs', '.runtime/x'].map((rel) => path.join(root, rel)));
  const recorded = ['.tmp-docs/a/b.txt', '.tmp-docs', 'scripts/new.mjs', '.runtime/x', 'gone.txt', '../outside'].map((rel) => path.join(root, rel));
  assert.deepEqual(leaksOf(root, recorded, (file) => on.has(file)), ['.tmp-docs', 'scripts/new.mjs']);
});

test('watchWrites records what a writer creates inside the root, whatever form it takes, and restores the originals', async () => {
  const root = path.resolve('/repo');
  const seen = [];
  const exists = (file) => file === root;
  const calls = [];
  const target = {
    writeFileSync(...args) { calls.push(['writeFileSync', args]); },
    cpSync(...args) { calls.push(['cpSync', args]); },
    mkdtempSync(prefix) { return `${prefix}abc`; },
    mkdir(...args) { calls.push(['mkdir', args]); },
    rename(...args) { calls.push(['rename', args]); },
    mkdtemp(prefix) { return Promise.resolve(`${prefix}xyz`); },
    appendFileSync: 'not a function',
  };
  const originals = { ...target };
  const restore = watchWrites(target, { root, exists, record: (file) => seen.push(file), forms: ['Sync', ''], promise: true });
  target.writeFileSync(path.join(root, 'a', 'b', 'c.txt'), 'x');
  target.writeFileSync(Buffer.from(path.join(root, 'buf.txt')), 'x');
  target.writeFileSync(pathToFileURL(path.join(root, 'url.txt')), 'x');
  target.writeFileSync(path.resolve('/elsewhere/file.txt'), 'x');
  target.writeFileSync(7, 'x');
  target.writeFileSync(new URL('http://example.test/x'), 'x');
  target.cpSync(path.join(root, 'from'), path.join(root, 'copy'));
  target.mkdir(path.join(root, 'dir'), { recursive: true }, () => {});
  target.rename(path.join(root, 'old'), path.join(root, 'new'), () => {});
  const sync = target.mkdtempSync(path.join(root, 'tmp-'));
  const outside = target.mkdtempSync(path.resolve('/elsewhere/tmp-'));
  const later = await target.mkdtemp(path.join(root, 'later-'));
  assert.deepEqual(seen, [
    path.join(root, 'a'), path.join(root, 'buf.txt'), path.join(root, 'url.txt'), path.join(root, 'copy'), path.join(root, 'dir'), path.join(root, 'new'), sync, later,
  ]);
  assert.match(outside, /tmp-abc$/);
  assert.equal(calls.length, 9, 'every wrapped call still reached the original');
  restore();
  for (const name of ['writeFileSync', 'cpSync', 'mkdtempSync', 'mkdir', 'rename', 'mkdtemp']) assert.equal(target[name], originals[name], name);
});
