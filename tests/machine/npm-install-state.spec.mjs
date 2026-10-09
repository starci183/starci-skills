// A node_modules is an install only when npm finished it: the marker is written after npm, goes with a wiped tree, and names
// the manifests it was made from (scripts/machine/npm-install-state.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { INSTALL_MARKER, clearInstallMarker, installStateOf, lockfileInstallPresent, manifestDigest, writeInstallMarker } from '../../scripts/machine/npm-install-state.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function tree(t, lock = '{"lockfileVersion":3,"packages":{}}\n') {
  const cwd = mkdtemp(t, 'starci-install-state-');
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), lock);
  return cwd;
}
const finishInstall = (cwd) => {
  fs.mkdirSync(path.join(cwd, 'node_modules', 'react'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'node_modules', '.package-lock.json'), '{}');
  return writeInstallMarker(cwd);
};

test('a checkout with no node_modules is absent', (t) => {
  assert.equal(installStateOf(tree(t)).state, 'absent');
});

test('a node_modules with some packages and no marker is incomplete, never installed', (t) => {
  const cwd = tree(t);
  for (const name of ['next', 'sharp']) fs.mkdirSync(path.join(cwd, 'node_modules', name), { recursive: true });
  assert.equal(installStateOf(cwd).state, 'incomplete');
});

test('a finished install is installed, and a changed lockfile makes it stale', (t) => {
  const cwd = tree(t);
  assert.equal(finishInstall(cwd), true);
  assert.equal(installStateOf(cwd).state, 'installed');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"node_modules/x":{}}}\n');
  const stale = installStateOf(cwd);
  assert.equal(stale.state, 'stale');
  assert.notEqual(stale.installedDigest, stale.digest);
});

test('a marker without the completion file npm writes is incomplete', (t) => {
  const cwd = tree(t);
  finishInstall(cwd);
  fs.rmSync(path.join(cwd, 'node_modules', '.package-lock.json'));
  assert.equal(installStateOf(cwd).state, 'incomplete');
});

test('clearing the marker before an install makes a stopped install read as incomplete', (t) => {
  const cwd = tree(t);
  finishInstall(cwd);
  assert.equal(clearInstallMarker(cwd), true);
  assert.equal(fs.existsSync(path.join(cwd, 'node_modules', INSTALL_MARKER)), false);
  assert.equal(installStateOf(cwd).state, 'incomplete');
});

test('no manifest means no digest, no marker and an unknown state', (t) => {
  const cwd = mkdtemp(t, 'starci-install-state-');
  assert.equal(manifestDigest(cwd), null);
  assert.equal(writeInstallMarker(cwd), false);
  fs.mkdirSync(path.join(cwd, 'node_modules'));
  assert.equal(installStateOf(cwd).state, 'unknown');
});

test('an install is present only when the lockfile reads and node_modules records its packages', (t) => {
  const cwd = tree(t, '{"lockfileVersion":3,"packages":{"":{},"node_modules/a":{"version":"1.0.0"}}}\n');
  assert.equal(lockfileInstallPresent(cwd), false, 'no install record');
  fs.mkdirSync(path.join(cwd, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'node_modules', '.package-lock.json'), '{"packages":{"node_modules/a":{"version":"1.0.0"}}}');
  assert.equal(lockfileInstallPresent(cwd), true);
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{not json');
  assert.equal(lockfileInstallPresent(cwd), false, 'an unreadable lockfile proves nothing');
});
