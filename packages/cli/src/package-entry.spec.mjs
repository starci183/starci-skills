import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { main } from './main.mjs';

const bin = fileURLToPath(new URL('../bin/starci.mjs', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });

test('the exact installed HFS dependency loads its real published module graph', async () => {
  const file = fileURLToPath(import.meta.resolve('@starci/hfs/package.json'));
  const installed = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(installed.name, '@starci/hfs');
  const declared = manifest.dependencies[installed.name];
  if (declared.startsWith('file:')) {
    const archive = path.resolve(fileURLToPath(new URL('../', import.meta.url)), declared.slice('file:'.length));
    assert.equal(path.extname(archive), '.tgz');
    assert.equal(lstatSync(archive).isFile(), true);
    // The clean-package owner verifies the original exact version and archive identity in preparePackedDependencies,
    // then every installed archive byte in verifyPackedDependencies, before running this spec with its scratch alias.
  } else assert.equal(installed.version, declared);
  const root = path.dirname(file);
  assert.equal(lstatSync(root).isDirectory(), true);
  assert.equal(realpathSync.native(root), path.join(realpathSync.native(fileURLToPath(new URL('../', import.meta.url))), 'node_modules', '@starci', 'hfs'));
  const hfs = await import('@starci/hfs');
  assert.equal(typeof hfs.main, 'function');
});

test('the real binary dispatches finite app explanations through installed HFS', (t) => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'starci-app-main-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const declaration = JSON.stringify({ hfs: 2, kind: 'app', project: 'package-entry', sides: {
    be: { apps: [{ name: 'api', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
  } });
  writeFileSync(path.join(cwd, 'hfs.json'), declaration);
  const owned = run('app', 'explain', 'hfs.json', '--cwd', cwd, '--json');
  assert.equal(owned.status, 0, owned.stderr || String(owned.error ?? ''));
  const explained = JSON.parse(owned.stdout);
  assert.deepEqual([explained.path, explained.status, explained.slot], ['hfs.json', 'owned', 'app.declaration']);
  const unowned = run('app', 'explain', 'unowned.fixture', '--cwd', cwd, '--json');
  assert.equal(unowned.status, 1, unowned.stderr || String(unowned.error ?? ''));
  const refused = JSON.parse(unowned.stdout);
  assert.deepEqual([refused.path, refused.status, refused.code], ['unowned.fixture', 'no-slot', 'HFS_SLOT_UNDECLARED']);
  assert.equal(readFileSync(path.join(cwd, 'hfs.json'), 'utf8'), declaration);
  assert.deepEqual(readdirSync(cwd), ['hfs.json']);
});

test('the published binary serves its own version and catalog help', () => {
  const version = run('--version');
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), manifest.version);
  const help = run('--help');
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: starci <group> <verb>/);
  assert.match(help.stdout, /Groups:/);
  const appHelp = run('app', 'check', '--help');
  assert.equal(appHelp.status, 0, appHelp.stderr);
  assert.match(appHelp.stdout, /starci app check/);
});

test('the published binary refuses unknown commands and invalid flags', () => {
  const unknown = run('package-entry-unknown');
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown group/);
  const invalid = run('app', 'check', '--package-entry-unknown');
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /unknown (?:flag|option)/);
});

test('the package dispatcher preserves app arguments, cwd and owner exit status', async () => {
  let called;
  const code = await main(['--cwd', 'selected-app', 'app', 'check', '--json'], {
    cwd: path.resolve('package-entry-base'), stdout: () => {}, stderr: () => {},
    importHfs: async () => ({ main: async (argv, io) => { called = { argv, cwd: io.cwd }; return 1; } }),
  });
  assert.equal(code, 1);
  assert.deepEqual(called, { argv: ['check', '--json'], cwd: path.resolve('package-entry-base', 'selected-app') });
});
