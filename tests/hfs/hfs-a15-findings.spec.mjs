import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FINDERS, a15Findings } from '../../scripts/hfs/rules/a15-findings.mjs';
import { ALL_CHECK_CODES, readWhy } from '../../scripts/hfs/check.mjs';

// The alpha.15 spine: every content rule of the batches is one finder in FINDERS, and a15Findings flattens their results.
test('a15Findings flattens every finder and passes the context through', () => {
  const context = { repoRoot: '/repo', files: [], isRoot: true };
  const seen = [];
  const original = FINDERS.splice(0, FINDERS.length);
  FINDERS.push((c) => { seen.push(c); return [{ code: 'A' }]; }, () => [], (c) => { seen.push(c); return [{ code: 'B' }, { code: 'C' }]; });
  try {
    assert.deepEqual(a15Findings(context).map((f) => f.code), ['A', 'B', 'C']);
    assert.equal(seen.every((c) => c === context), true);
  } finally {
    FINDERS.splice(0, FINDERS.length, ...original);
  }
});

test('every registered finder is a function', () => {
  assert.equal(FINDERS.every((finder) => typeof finder === 'function'), true);
});

test('the bundled app checker carries health and database findings in both editions', () => {
  const codes = ['HFS_DOCKER_HEALTHCHECK_FAKE', 'DB_BE_ONLY_ACCESS', 'DB_REALTIME_UNLISTED',
    'DB_APP_ROLE', 'DB_FORCE_RLS_DEFAULT', 'DB_POLICY_TAUTOLOGY', 'DB_VIEW_UNSAFE',
    'DB_STORAGE_PREFIX', 'DB_DEFINER_REVOKE'];
  const runtime = path.resolve(import.meta.dirname, '../../packages/hfs/runtime');
  const labels = readWhy(runtime, codes);
  for (const code of codes) {
    assert.ok(ALL_CHECK_CODES.includes(code), code);
    assert.equal(typeof labels[code].whyVi, 'string', code);
  }
});
