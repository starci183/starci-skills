import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = rel => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const BASELINE = 'knowledge/repository-baseline.yaml';

test('the repository baseline is one registered knowledge source with nest and next profiles', () => {
  const index = read('knowledge/index.yaml');
  assert.ok(index.branches.some(b => b.id === 'repository-baseline' && b.path === 'repository-baseline.yaml'));
  const doc = read(BASELINE);
  assert.equal(doc.schema, 'starci/knowledge-source@1');
  assert.equal(doc.id, 'repository-baseline');
  const shapes = Object.fromEntries(doc.shapes.map(s => [s.id, s]));
  assert.deepEqual(Object.keys(shapes).sort(), ['common', 'nest', 'next']);
  assert.equal(shapes.nest.eslintKit, '@starci/eslint-canon-be');
  assert.equal(shapes.next.eslintKit, '@starci/eslint-canon-fe');
  assert.equal(shapes.nest.testRunner, 'jest');
  assert.equal(shapes.next.testRunner, 'vitest');
  assert.equal(shapes.common.typescript.strict, true);
  assert.deepEqual(shapes.common.ci.gates, ['lint', 'typecheck', 'test', 'build']);
  const ciRuns = shapes.common.ci.steps.filter(s => s.name).map(s => s.name);
  assert.deepEqual(ciRuns, shapes.common.ci.gates, 'every CI gate is a named step');
  for (const entry of ['.starciwork/runtime.sqlite*', 'config.yaml', '.env.*', '!.env.example']) {
    assert.ok(shapes.common.gitignore.includes(entry), `gitignore carries ${entry}`);
  }
  assert.ok(shapes.common.gitattributes.includes('* text=auto eol=lf'));
  assert.equal(shapes.common.editorconfig.end_of_line, 'lf');
  assert.ok(doc.provenance.observedReference.some(r => r.repository === 'nivo-backend'));
  assert.ok(doc.provenance.observedReference.some(r => r.repository === 'nivo-fe'));
});

test('baseline numbers live once: every <key.path> placeholder resolves inside the common shape', () => {
  const text = fs.readFileSync(path.join(ROOT, BASELINE), 'utf8');
  const common = read(BASELINE).shapes.find(s => s.id === 'common');
  const placeholders = [...text.matchAll(/<([a-zA-Z][\w.]*)>/g)].map(m => m[1]);
  assert.ok(placeholders.length > 0);
  for (const key of new Set(placeholders)) {
    const value = key.split('.').reduce((node, part) => node?.[part], common);
    assert.ok(value !== undefined && typeof value !== 'object', `<${key}> resolves to a scalar in shapes.common`);
  }
  assert.doesNotMatch(text, /--max-warnings=\d/, 'the warning budget is data, not a restated literal');
});

for (const [op, profile] of [['backend.scaffold', 'nest'], ['interface.scaffold', 'next']]) {
  test(`${op} takes its toolchain from the baseline and needs a settled SDS only beyond it`, () => {
    const manifest = read(`modules/ops/ops/${op}.yaml`);
    const baseline = manifest.reads.find(r => r.id === 'baseline');
    assert.ok(baseline, 'baseline read declared');
    assert.match(baseline.path, /knowledge\/repository-baseline\.yaml/);
    assert.match(baseline.path, new RegExp(`\\b${profile}\\b`));
    assert.match(baseline.path, /CONTEXT\.md/);
    const citing = manifest.steps.filter(s => /knowledge\/repository-baseline\.yaml/.test(s.action.en));
    assert.equal(citing.length, 1, 'exactly one step writes the toolchain from the baseline');
    assert.ok(citing[0].reads.includes('baseline'));
    const proof = manifest.proofs.find(p => p.id === 'baseline-runs');
    assert.ok(proof, 'baseline-runs proof declared');
    assert.match(proof.requirement.en, /lint-staged/);
    assert.match(proof.requirement.en, /ci\.yml/);
    for (const pre of manifest.route.prerequisites) {
      assert.doesNotMatch(pre, /^architecture\.decide\b/, 'a baseline-only scaffold does not chain architecture.decide');
    }
    assert.ok(manifest.blockers.some(b => b.code === 'SDS_MISSING'), 'SDS-owned wiring without a settled SDS still blocks');
  });
}
