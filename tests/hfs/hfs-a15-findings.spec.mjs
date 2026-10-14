import test from 'node:test';
import assert from 'node:assert/strict';
import { FINDERS, a15Findings } from '../../scripts/hfs/rules/a15-findings.mjs';

// The alpha.15 spine: every content rule of the batches is one finder in FINDERS, and a15Findings flattens their results.
test('a15Findings flattens every finder and passes the context through', () => {
  const context = { repoRoot: '/repo', files: [], isRoot: true };
  const seen = [];
  const finders = [(c) => { seen.push(c); return [{ code: 'A' }]; }, () => [], (c) => { seen.push(c); return [{ code: 'B' }, { code: 'C' }]; }];
  FINDERS.push(...finders);
  try {
    assert.deepEqual(a15Findings(context).map((f) => f.code).slice(-3), ['A', 'B', 'C']);
    assert.equal(seen.every((c) => c === context), true);
  } finally {
    FINDERS.length -= finders.length;
  }
});

test('every registered finder is a function', () => {
  assert.equal(FINDERS.every((finder) => typeof finder === 'function'), true);
});
