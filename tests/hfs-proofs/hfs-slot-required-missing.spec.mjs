// proves: HFS_SLOT_REQUIRED_MISSING@lite HFS_SLOT_REQUIRED_MISSING@full
// proves: HFS_MIN_INSTANCES@lite HFS_MIN_INSTANCES@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const RUNTIME = loadSlotManifest({ file: path.join(skillRoot, 'knowledge/hfs/runtime-slots.yaml') });
const DECLARATION = { hfs: RUNTIME.major, kind: 'runtime', project: 'proof' };
const RESOLVER = createSlotResolver(RUNTIME, resolveRepoDeclaration(RUNTIME, DECLARATION));

function contents(file) {
  if (file === 'hfs.json') return JSON.stringify(DECLARATION);
  if (file.endsWith('.json') || file.endsWith('.yaml')) return '{}\n';
  if (file.endsWith('.mjs')) return 'export {};\n';
  return 'Fixture.\n';
}

function runtimeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-required-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const required = RESOLVER.requiredPaths().paths.map(({ path: file }) => file.endsWith('/') ? `${file}fixture.txt` : file);
  // runtime.api is the real runtime minimum: one scripts/api/<system>/ owner, with lib.mjs.
  const files = [...new Set([...required, 'scripts/api/git/lib.mjs'])];
  for (const file of files) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents(file));
  }
  return { root, files };
}

// The runtime declaration has no product edition. Both product installations use this same
// runtime standard; these cases deliberately omit an ignored runtime edition property.
for (const edition of ['lite', 'full']) {
  test(`${edition} installation rejects a shared runtime missing required file and accepts its restoration`, t => {
    const { root, files } = runtimeFixture(t);
    const missing = files.filter(file => file !== 'README.md');
    assert.equal(checkRepo({ repoRoot: root, manifest: RUNTIME, files: missing, tree: false }).findings.some(finding => finding.code === 'HFS_SLOT_REQUIRED_MISSING'), true);
    assert.equal(checkRepo({ repoRoot: root, manifest: RUNTIME, files, tree: false }).findings.some(finding => finding.code === 'HFS_SLOT_REQUIRED_MISSING'), false);
    assert.equal(runtimeCheck({ repoRoot: root, manifest: RUNTIME, files: missing, base: null, drift: [] }).findings.some(finding => finding.code === 'HFS_SLOT_REQUIRED_MISSING'), true);
    assert.equal(runtimeCheck({ repoRoot: root, manifest: RUNTIME, files, base: null, drift: [] }).findings.some(finding => finding.code === 'HFS_SLOT_REQUIRED_MISSING'), false);
  });

  test(`${edition} installation rejects a shared runtime missing its API minimum and accepts one API owner`, t => {
    const { root, files } = runtimeFixture(t);
    const missing = files.filter(file => !file.startsWith('scripts/api/'));
    assert.equal(checkRepo({ repoRoot: root, manifest: RUNTIME, files: missing, tree: false }).findings.some(finding => finding.code === 'HFS_MIN_INSTANCES'), true);
    assert.equal(checkRepo({ repoRoot: root, manifest: RUNTIME, files, tree: false }).findings.some(finding => finding.code === 'HFS_MIN_INSTANCES'), false);
    assert.equal(runtimeCheck({ repoRoot: root, manifest: RUNTIME, files: missing, base: null, drift: [] }).findings.some(finding => finding.code === 'HFS_MIN_INSTANCES'), true);
    assert.equal(runtimeCheck({ repoRoot: root, manifest: RUNTIME, files, base: null, drift: [] }).findings.some(finding => finding.code === 'HFS_MIN_INSTANCES'), false);
  });
}
