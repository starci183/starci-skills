import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { specDurationRows } from '../../scripts/lib/spec-durations.mjs';
import { checkSpecBudget, CODE, DATA_FILE, STALE_CODE } from '../../scripts/checks/check-spec-budget.mjs';

const fixture = (name) => fs.readFileSync(path.resolve(import.meta.dirname, '..', 'fixtures', name), 'utf8');

function budgetRoot(t, yaml, specs = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'modules', 'kernel'), { recursive: true });
  fs.writeFileSync(path.join(root, ...DATA_FILE.split('/')), yaml);
  for (const rel of specs) {
    const file = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
  return root;
}

test('a spec-reporter log becomes rounded per-spec duration rows', () => {
  const rows = specDurationRows(fixture('spec-reporter.log'), {
    'tests/alpha.spec.mjs': "test('first operation is fast', () => {});\ntest('second operation is slower', () => {});\n",
    'tests/beta.spec.mjs': "test('a failed operation still consumed time', () => {});\n",
  });
  assert.deepEqual(rows, [
    { spec: 'tests/alpha.spec.mjs', seconds: 2 },
    { spec: 'tests/beta.spec.mjs', seconds: 1 },
  ]);
});

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
