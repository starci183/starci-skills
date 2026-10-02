// owner-roots.spec.mjs - the owner's relocation of the host roots (config.yaml `roots: {archive, lanes}`, gitignored, validated by
// engine/config.mjs validateConfig) and the one resolution of archiveRoot() and lanesRoot() (scripts/machine/home.mjs):
// env STARCI_ARCHIVE_ROOT / STARCI_LANES_ROOT, then the owner key, then <starciLocalRoot>/archive and <starciLocalRoot>/lanes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateConfig, inspectOwnerConfig, loadConfig } from '../../engine/config.mjs';
import { archiveRoot, lanesRoot } from '../../scripts/machine/home.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-owner-roots-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));

const state = path.join(TMP, 'state');
const owner = { archive: path.join(TMP, 'owner-archive'), lanes: path.join(TMP, 'owner-lanes') };
const envRoots = { STARCI_ARCHIVE_ROOT: path.join(TMP, 'env-archive'), STARCI_LANES_ROOT: path.join(TMP, 'env-lanes') };

test('roots: with no owner key and no env the defaults sit under the state root', () => {
  const env = { STARCI_LOCAL_ROOT: state };
  assert.equal(archiveRoot({ env, config: {} }), path.join(state, 'archive'));
  assert.equal(lanesRoot({ env, config: {} }), path.join(state, 'lanes'));
  assert.equal(archiveRoot({ env, config: { roots: { lanes: owner.lanes } } }), path.join(state, 'archive'), 'a key left out keeps its default');
});

test('roots: the owner key wins over the default', () => {
  const env = { STARCI_LOCAL_ROOT: state };
  assert.equal(archiveRoot({ env, config: { roots: owner } }), path.resolve(owner.archive));
  assert.equal(lanesRoot({ env, config: { roots: owner } }), path.resolve(owner.lanes));
});

test('roots: the environment wins over the owner key', () => {
  const env = { STARCI_LOCAL_ROOT: state, ...envRoots };
  assert.equal(archiveRoot({ env, config: { roots: owner } }), path.resolve(envRoots.STARCI_ARCHIVE_ROOT));
  assert.equal(lanesRoot({ env, config: { roots: owner } }), path.resolve(envRoots.STARCI_LANES_ROOT));
});

test('roots: an invalid owner value is a typed config error', () => {
  const base = loadConfig();
  const bad = (roots) => assert.throws(() => validateConfig({ ...base, roots }), /^Error: Invalid config\.yaml: roots/);
  bad('a string');
  bad(['x']);
  bad({ archive: 'relative/dir' });
  bad({ lanes: 42 });
  bad({ archive: '   ' });
  bad({ backups: owner.archive });
  assert.doesNotThrow(() => validateConfig({ ...base, roots: owner }));
  assert.doesNotThrow(() => validateConfig({ ...base, roots: { archive: null } }));
  assert.doesNotThrow(() => validateConfig({ ...base, roots: null }));
});

test('roots: the owner file under a runtime root is read through the one config reader', () => {
  const root = path.join(TMP, 'runtime');
  fs.mkdirSync(root, { recursive: true });
  fs.copyFileSync(path.join(path.resolve(import.meta.dirname, '..', '..'), 'config.example.yaml'), path.join(root, 'config.example.yaml'));
  fs.writeFileSync(path.join(root, 'config.yaml'), `${fs.readFileSync(path.join(root, 'config.example.yaml'), 'utf8')}\nroots: {archive: ${JSON.stringify(owner.archive)}}\n`);
  const config = loadConfig(root);
  assert.equal(archiveRoot({ env: { STARCI_LOCAL_ROOT: state }, config }), path.resolve(owner.archive));
  fs.appendFileSync(path.join(root, 'config.yaml'), '\n');
  fs.writeFileSync(path.join(root, 'config.yaml'), `${fs.readFileSync(path.join(root, 'config.example.yaml'), 'utf8')}\nroots: {archive: relative}\n`);
  assert.match(inspectOwnerConfig(root).invalid, /^Invalid config\.yaml: roots\.archive must be an absolute directory path/);
  assert.throws(() => loadConfig(root), /Invalid config\.yaml: roots\.archive/);
});
