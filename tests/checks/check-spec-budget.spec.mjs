import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSpecBudget, CODE, DATA_FILE, STALE_CODE } from '../../scripts/checks/check-spec-budget.mjs';

const SCRIPT = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'checks', 'check-spec-budget.mjs');

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

test('RT_SPEC_OVER_BUDGET: specs over the limit are INFO findings ranked by excess; a deleted spec is a stale error', (t) => {
  const root = budgetRoot(t, [
    'limitSeconds: 12',
    'rows:',
    '  - {spec: tests/small.spec.mjs, seconds: 13}',
    '  - {spec: tests/big.spec.mjs, seconds: 50}',
    '  - {spec: tests/fits.spec.mjs, seconds: 12}',
    '  - {spec: tests/gone.spec.mjs, seconds: 14}',
    '',
  ].join('\n'), ['tests/small.spec.mjs', 'tests/big.spec.mjs', 'tests/fits.spec.mjs']);
  const found = checkSpecBudget(root);
  assert.deepEqual(found.map((f) => [f.code, f.level, f.path]), [
    [CODE, 'info', 'tests/big.spec.mjs'],
    [CODE, 'info', 'tests/small.spec.mjs'],
    [STALE_CODE, 'error', 'tests/gone.spec.mjs'],
  ]);
  assert.match(found[0].message, /38s over the 12s budget.*speed\.md.*shared per-process fixture.*per-test install or boot.*inject the clock.*never use a longer timeout/);
});

test('RT_SPEC_OVER_BUDGET: a record whose specs fit the data-owned limit reports nothing', (t) => {
  const root = budgetRoot(t, 'limitSeconds: 12\nrows:\n  - {spec: tests/live.spec.mjs, seconds: 12}\n', ['tests/live.spec.mjs']);
  assert.deepEqual(checkSpecBudget(root), []);
});

test('RT_SPEC_OVER_BUDGET: the over-budget report is advisory: the self-check exits 0 on the real tree and prints INFO lines', () => {
  const run = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^INFO RT_SPEC_OVER_BUDGET /m);
});
