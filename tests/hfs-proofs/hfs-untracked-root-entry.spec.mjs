// proves: HFS_UNTRACKED_ROOT_ENTRY@lite
// proves: HFS_UNTRACKED_ROOT_ENTRY@full
// proves: HFS_EMPTY_DIR@lite
// proves: HFS_EMPTY_DIR@full
// proves: HFS_GHOST_TREE@lite
// proves: HFS_GHOST_TREE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { loadSlotManifest, RUNTIME_MANIFEST_FILE } from '../../scripts/hfs/slots.mjs';
import { APP, gitAdd } from '../helpers/hfs-cli-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const RUNTIME = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });

function repository(context, edition, runtime = false) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-r03-'));
  context.after(() => {
    assert.equal(path.dirname(repoRoot), path.resolve(os.tmpdir()));
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });
  const declaration = runtime
    ? { hfs: 1, kind: 'runtime', project: 'proof' }
    : { ...structuredClone(APP), edition };
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
  fs.mkdirSync(path.join(repoRoot, 'business'));
  fs.writeFileSync(path.join(repoRoot, 'business/kept.txt'), 'fixture\n');
  gitAdd(repoRoot);
  return repoRoot;
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: app rejects an untracked entry and accepts tracking it`, context => {
    const repoRoot = repository(context, edition);
    fs.writeFileSync(path.join(repoRoot, 'orphan.txt'), 'fixture\n');
    assert.deepEqual(checkRepo({ repoRoot }).findings
      .filter(finding => finding.code === 'HFS_UNTRACKED_ROOT_ENTRY').map(finding => finding.path), ['orphan.txt']);
    gitAdd(repoRoot);
    assert.deepEqual(checkRepo({ repoRoot }).findings
      .filter(finding => finding.code === 'HFS_UNTRACKED_ROOT_ENTRY'), []);
  });

  test(`${edition}: app rejects an empty directory and accepts removing it`, context => {
    const repoRoot = repository(context, edition);
    fs.mkdirSync(path.join(repoRoot, 'unused'));
    assert.deepEqual(checkRepo({ repoRoot }).findings
      .filter(finding => finding.code === 'HFS_EMPTY_DIR').map(finding => finding.path), ['unused']);
    fs.rmdirSync(path.join(repoRoot, 'unused'));
    assert.deepEqual(checkRepo({ repoRoot }).findings
      .filter(finding => finding.code === 'HFS_EMPTY_DIR'), []);
  });

  test(`${edition}: app rejects a ghost sibling and accepts removing it`, context => {
    const repoRoot = repository(context, edition);
    fs.mkdirSync(path.join(repoRoot, 'bussiness'));
    assert.deepEqual(checkRepo({ repoRoot }).findings
      .filter(finding => finding.code === 'HFS_GHOST_TREE').map(finding => finding.path), ['bussiness']);
    fs.rmdirSync(path.join(repoRoot, 'bussiness'));
    assert.deepEqual(checkRepo({ repoRoot }).findings
      .filter(finding => finding.code === 'HFS_GHOST_TREE'), []);
  });

  test(`${edition}: shared runtime rejects an untracked entry and accepts tracking it`, context => {
    const repoRoot = repository(context, edition, true);
    fs.writeFileSync(path.join(repoRoot, 'orphan.txt'), 'fixture\n');
    assert.deepEqual(runtimeCheck({ repoRoot, manifest: RUNTIME, base: null, drift: [] }).findings
      .filter(finding => finding.code === 'HFS_UNTRACKED_ROOT_ENTRY').map(finding => finding.path), ['orphan.txt']);
    gitAdd(repoRoot);
    assert.deepEqual(runtimeCheck({ repoRoot, manifest: RUNTIME, base: null, drift: [] }).findings
      .filter(finding => finding.code === 'HFS_UNTRACKED_ROOT_ENTRY'), []);
  });

  test(`${edition}: shared runtime rejects an empty directory and accepts removing it`, context => {
    const repoRoot = repository(context, edition, true);
    fs.mkdirSync(path.join(repoRoot, 'unused'));
    assert.deepEqual(runtimeCheck({ repoRoot, manifest: RUNTIME, base: null, drift: [] }).findings
      .filter(finding => finding.code === 'HFS_EMPTY_DIR').map(finding => finding.path), ['unused']);
    fs.rmdirSync(path.join(repoRoot, 'unused'));
    assert.deepEqual(runtimeCheck({ repoRoot, manifest: RUNTIME, base: null, drift: [] }).findings
      .filter(finding => finding.code === 'HFS_EMPTY_DIR'), []);
  });

  test(`${edition}: shared runtime rejects a ghost sibling and accepts removing it`, context => {
    const repoRoot = repository(context, edition, true);
    fs.mkdirSync(path.join(repoRoot, 'bussiness'));
    assert.deepEqual(runtimeCheck({ repoRoot, manifest: RUNTIME, base: null, drift: [] }).findings
      .filter(finding => finding.code === 'HFS_GHOST_TREE').map(finding => finding.path), ['bussiness']);
    fs.rmdirSync(path.join(repoRoot, 'bussiness'));
    assert.deepEqual(runtimeCheck({ repoRoot, manifest: RUNTIME, base: null, drift: [] }).findings
      .filter(finding => finding.code === 'HFS_GHOST_TREE'), []);
  });
}
