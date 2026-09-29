import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { linkPackages, LINK_DIR, packedFiles } from '../scripts/install/link-packages.mjs';
import { checkRepoPins } from '../scripts/checks/check-canon-pins.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function repo(t, pkg, gitignore) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-link-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(pkg, null, 4)}\n`);
  if (gitignore !== undefined) fs.writeFileSync(path.join(dir, '.gitignore'), gitignore);
  return dir;
}

test('link copies the published files of each back-end @starci package as plain directories', (t) => {
  const dir = repo(t, { name: 'r', devDependencies: { jest: '29.7.0' } });
  const result = linkPackages({ repo: dir, home: ROOT, side: 'be' });
  assert.deepEqual(result.linked.map((entry) => entry.name).sort(),
    ['@starci/eslint-canon-be', '@starci/jest-preset', '@starci/prettier-config', '@starci/tsconfig']);
  for (const slug of ['tsconfig', 'prettier-config', 'jest-preset', 'eslint-canon-be']) {
    const target = path.join(dir, ...LINK_DIR.split('/'), slug);
    assert.equal(fs.lstatSync(target).isSymbolicLink(), false, `${slug} is a plain directory`);
    assert.ok(fs.existsSync(path.join(target, 'package.json')));
  }
  assert.ok(fs.existsSync(path.join(dir, '.starci', 'packages', 'jest-preset', 'mock.cjs')));
  assert.equal(fs.existsSync(path.join(dir, '.starci', 'packages', 'jest-preset', 'preset.test.mjs')), false, 'specs are not shipped');
  assert.equal(fs.existsSync(path.join(dir, '.starci', 'packages', 'eslint-canon-be', 'index.test.mjs')), false);
  assert.equal(fs.existsSync(path.join(dir, '.starci', 'packages', 'vitest-preset')), false, 'a front-end package is not linked into a back-end repo');
});

test('link points package.json at the repo-relative copy, keeps its indent, sorts, and prefers dependencies when listed there', (t) => {
  const dir = repo(t, { name: 'r', dependencies: { '@starci/tsconfig': '1.0.0' }, devDependencies: { zed: '1.0.0', jest: '29.7.0' } });
  linkPackages({ repo: dir, home: ROOT, side: 'be', only: ['tsconfig', 'jest-preset'] });
  const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
  assert.match(raw, /^\{\n {4}"name"/, 'four-space indent survives');
  assert.ok(raw.endsWith('\n'));
  const pkg = JSON.parse(raw);
  assert.equal(pkg.dependencies['@starci/tsconfig'], 'file:.starci/packages/tsconfig');
  assert.equal(pkg.devDependencies['@starci/jest-preset'], 'file:.starci/packages/jest-preset');
  assert.deepEqual(Object.keys(pkg.devDependencies), ['@starci/jest-preset', 'jest', 'zed']);
  assert.equal(pkg.devDependencies['@starci/prettier-config'], undefined, '--only limits the set');
});

test('link is idempotent, replaces a stale copy, and ignores /.starci/ exactly once', (t) => {
  const dir = repo(t, { name: 'r' }, 'node_modules\n');
  linkPackages({ repo: dir, home: ROOT, side: 'be', only: ['tsconfig'] });
  const stale = path.join(dir, '.starci', 'packages', 'tsconfig', 'stale.json');
  fs.writeFileSync(stale, '{}');
  const first = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
  const second = linkPackages({ repo: dir, home: ROOT, side: 'be', only: ['tsconfig'] });
  assert.equal(fs.existsSync(stale), false);
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), first);
  assert.equal(second.gitignoreUpdated, false);
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').match(/^\/\.starci\/$/gm).length, 1);
  const record = JSON.parse(fs.readFileSync(path.join(dir, '.starci', 'link.json'), 'utf8'));
  assert.deepEqual(record.packages, { '@starci/tsconfig': '1.0.0' });
});

test('a repository linked from the runtime passes the pin-drift check for its @starci pins', (t) => {
  const dir = repo(t, { name: 'r', devDependencies: {} });
  linkPackages({ repo: dir, home: ROOT, side: 'fe', only: ['tsconfig', 'vitest-preset', 'playwright-preset'] });
  assert.deepEqual(checkRepoPins({ repo: dir, side: 'fe', root: ROOT }).errors, []);
});

test('link refuses a runtime without pins, a repo without package.json, an unknown package, and a link where it writes', (t) => {
  const dir = repo(t, { name: 'r' });
  assert.throws(() => linkPackages({ repo: dir, home: os.tmpdir() }), /is not a StarCi runtime checkout/);
  assert.throws(() => linkPackages({ repo: os.tmpdir(), home: ROOT, side: 'be' }), /has no package\.json/);
  assert.throws(() => linkPackages({ repo: dir, home: ROOT, only: ['jest'] }), /not a starci pin: jest/);
  fs.mkdirSync(path.join(dir, '.starci', 'packages'), { recursive: true });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-link-out-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  try { fs.symlinkSync(outside, path.join(dir, '.starci', 'packages', 'tsconfig'), 'junction'); } catch { t.skip('cannot create a junction here'); return; }
  assert.throws(() => linkPackages({ repo: dir, home: ROOT, only: ['tsconfig'] }), /is a link/);
  assert.equal(fs.existsSync(outside), true, 'the link target is untouched');
});

test('packedFiles is what npm would publish: no node_modules, no specs of the jest preset', () => {
  const files = packedFiles(path.join(ROOT, 'packages', 'jest-preset'));
  assert.ok(files.includes('index.cjs') && files.includes('mock.cjs') && files.includes('mock.d.ts') && files.includes('package.json'));
  assert.ok(!files.some((file) => file.endsWith('.test.mjs')));
});

test('starci link is a route of bin/starci.mjs and prints its usage errors', (t) => {
  const dir = repo(t, { name: 'r' });
  const run = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'starci.mjs'), 'link', '--repo', dir, '--home', ROOT, '--only', 'nope'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /starci link: not a starci pin: nope/);
  const ok = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'starci.mjs'), 'link', '--repo', dir, '--home', ROOT, '--only', 'tsconfig'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /linked @starci\/tsconfig@1\.0\.0/);
});
