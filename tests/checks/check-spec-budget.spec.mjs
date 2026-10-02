import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSpecBudget, CODE, DATA_FILE, STALE_CODE } from '../../scripts/checks/check-spec-budget.mjs';

function budgetRoot(t, yaml, specs = [], heavy = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'modules', 'kernel'), { recursive: true });
  fs.writeFileSync(path.join(root, ...DATA_FILE.split('/')), yaml);
  const entries = heavy.map(([spec, reason]) => `  - {path: ${spec}, reason: "${reason}"}`);
  const body = entries.length ? ['heavy-specs:', ...entries].join('\n') : 'heavy-specs: []';
  fs.writeFileSync(path.join(root, 'modules', 'kernel', 'allowlist.yaml'), `schema: starci/allowlist@1\n${body}\n`);
  for (const rel of specs) {
    const file = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
  return root;
}

test('RT_SPEC_OVER_BUDGET: a live duration over budget and a deleted spec are refused', (t) => {
  const root = budgetRoot(t, [
    'limitSeconds: 12',
    'rows:',
    '  - {spec: tests/live.spec.mjs, seconds: 13}',
    '  - {spec: tests/gone.spec.mjs, seconds: 14}',
    '',
  ].join('\n'), ['tests/live.spec.mjs']);
  assert.deepEqual(checkSpecBudget(root).map((finding) => [finding.code, finding.path]), [
    [CODE, 'tests/live.spec.mjs'],
    [STALE_CODE, 'tests/gone.spec.mjs'],
  ]);
  assert.match(checkSpecBudget(root)[0].message, /speed\.md.*shared per-process fixture.*per-test install or boot.*inject the clock.*never use a longer timeout/);
});

test('RT_SPEC_OVER_BUDGET: a live duration at or under the data-owned limit passes', (t) => {
  const root = budgetRoot(t, 'limitSeconds: 12\nrows:\n  - {spec: tests/live.spec.mjs, seconds: 12}\n', ['tests/live.spec.mjs']);
  assert.deepEqual(checkSpecBudget(root), []);
});

test('RT_SPEC_OVER_BUDGET: a spec declared heavy with its reason passes; the declaration is shrink-only (stale once the spec fits or has no row)', (t) => {
  const heavyRoot = budgetRoot(t, 'limitSeconds: 12\nrows:\n  - {spec: tests/live.spec.mjs, seconds: 40}\n', ['tests/live.spec.mjs'], [['tests/live.spec.mjs', 'a real install that cannot be shared']]);
  assert.deepEqual(checkSpecBudget(heavyRoot), []);
  const fitRoot = budgetRoot(t, 'limitSeconds: 12\nrows:\n  - {spec: tests/live.spec.mjs, seconds: 9}\n', ['tests/live.spec.mjs'], [['tests/live.spec.mjs', 'a real install that cannot be shared']]);
  assert.deepEqual(checkSpecBudget(fitRoot).map((finding) => [finding.code, finding.path]), [[STALE_CODE, 'tests/live.spec.mjs']]);
  const noRowRoot = budgetRoot(t, 'limitSeconds: 12\nrows: []\n', ['tests/live.spec.mjs'], [['tests/live.spec.mjs', 'a real install that cannot be shared']]);
  assert.deepEqual(checkSpecBudget(noRowRoot).map((finding) => [finding.code, finding.path]), [[STALE_CODE, 'tests/live.spec.mjs']]);
});
