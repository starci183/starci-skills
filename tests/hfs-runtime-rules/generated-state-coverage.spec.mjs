// proves: RT_GENERATED_DRIFT@lite
// proves: RT_GENERATED_DRIFT@full
// proves: GENERATED_UNTRACKED@lite
// proves: GENERATED_UNTRACKED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUNDLES, CATALOG, driftOfRuntime, syncRuntime } from '../../scripts/hfs/sync-runtime.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { generatedUntrackedFindings } from '../../scripts/hfs/runtime-rules/generated-untracked.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });
const GENERATED = [{ root: 'packages/hfs/runtime', generatedBy: 'scripts/hfs/sync-runtime.mjs' }];

function copyInput(root, file) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, file), target);
}

function generatedFixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-generated-${edition}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inputs = new Set([CATALOG, ...Object.values(BUNDLES).flatMap((bundle) => bundle.files)]);
  for (const file of inputs) copyInput(root, file);
  fs.cpSync(path.join(ROOT, 'modules', 'i18n', 'messages'), path.join(root, 'modules', 'i18n', 'messages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'hfs.json'), '{"hfs":1,"kind":"runtime","project":"generated-fixture"}\n');
  fs.writeFileSync(path.join(root, 'knowledge', 'hfs', 'facts.yaml'), 'schema: starci/facts@1\nfacts: []\n');
  syncRuntime(root);
  return root;
}

function generatedDriftCodes(root) {
  const result = runtimeCheck({ repoRoot: root, root: ROOT, files: [], tree: false, base: null, manifest: MANIFEST, drift: driftOfRuntime(root) });
  return result.findings.filter((finding) => finding.code === 'RT_GENERATED_DRIFT').map((finding) => finding.code);
}

for (const edition of ['lite', 'full']) {
  test(`${edition} rejects a generated runtime copy that differs from its generator`, (t) => {
    const root = generatedFixture(t, edition);
    fs.appendFileSync(path.join(root, 'packages', 'hfs', 'runtime', 'engine', 'runtime-root.mjs'), '// stale generated output\n');
    assert.deepEqual(generatedDriftCodes(root), ['RT_GENERATED_DRIFT']);
  });

  test(`${edition} accepts generated runtime copies equal to their generator`, (t) => {
    assert.deepEqual(generatedDriftCodes(generatedFixture(t, edition)), []);
  });

  test(`${edition} rejects a tracked file inside a generated runtime root`, () => {
    const ctx = { params: { generated: GENERATED }, files: ['packages/hfs/runtime/engine/yaml.mjs'] };
    assert.deepEqual(generatedUntrackedFindings(ctx).map((finding) => finding.code), ['GENERATED_UNTRACKED']);
  });

  test(`${edition} accepts tracked source files outside generated runtime roots`, () => {
    const ctx = { params: { generated: GENERATED }, files: ['scripts/hfs/sync-runtime.mjs', 'packages/hfs/runtime-other/source.mjs'] };
    assert.deepEqual(generatedUntrackedFindings(ctx), []);
  });
}
