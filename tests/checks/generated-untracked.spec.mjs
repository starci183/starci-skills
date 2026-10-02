// generated-untracked.spec.mjs - the GENERATED_UNTRACKED self-check (scripts/checks/check-generated-untracked.mjs) and
// the rule module behind it (scripts/hfs/runtime-rules/generated-untracked.mjs): no git-tracked file under a
// ruleParams.runtime.generated root, and the real runtime keeps none.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { checkGeneratedUntracked } from '../../scripts/checks/check-generated-untracked.mjs';
import { GENERATED_UNTRACKED, generatedUntrackedFindings } from '../../scripts/hfs/runtime-rules/generated-untracked.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const GENERATED = [
  { root: 'packages/hfs/runtime', generatedBy: 'scripts/hfs/sync-runtime.mjs' },
  { root: 'packages/eslint/be/runtime', generatedBy: 'scripts/hfs/sync-runtime.mjs' },
];
const ctx = (files, generated = GENERATED) => ({ params: { generated }, files });

test('GENERATED_UNTRACKED: every tracked file inside a generated root fails, named with its generator', () => {
  const found = generatedUntrackedFindings(ctx([
    'packages/hfs/runtime/engine/yaml.mjs',
    'packages/eslint/be/runtime/scripts/hfs/slots.mjs',
    'scripts/hfs/check.mjs',
  ]));
  assert.deepEqual(found.map((f) => [f.code, f.path]), [
    [GENERATED_UNTRACKED, 'packages/hfs/runtime/engine/yaml.mjs'],
    [GENERATED_UNTRACKED, 'packages/eslint/be/runtime/scripts/hfs/slots.mjs'],
  ]);
  assert.match(found[0].message, /scripts\/hfs\/sync-runtime\.mjs/);
  assert.equal(found.every((f) => f.level === 'error'), true);
});

test('GENERATED_UNTRACKED: sources beside the roots and a same-named path elsewhere give no finding', () => {
  assert.deepEqual(generatedUntrackedFindings(ctx([
    'packages/hfs/bin/hfs.mjs',
    'packages/hfs/runtime-other/file.mjs',
    'vendor/packages/hfs/runtime/kept.mjs',
    'packages/eslint/fe/index.mjs',
  ])), []);
});

test('GENERATED_UNTRACKED: a runtime without generated roots finds nothing', () => {
  assert.deepEqual(generatedUntrackedFindings(ctx(['packages/hfs/runtime/engine/yaml.mjs'], [])), []);
});

test('this runtime keeps no tracked file under a generated root', () => {
  assert.deepEqual(checkGeneratedUntracked(ROOT), []);
});
