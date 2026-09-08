import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLabel } from './normalize-label.mjs';
test('label normalization product acceptance', () => {
  assert.equal(normalizeLabel('  A  B\tC\nD '), 'A B C D');
  assert.equal(normalizeLabel(' \t\n'), '');
  assert.equal(normalizeLabel('MiXeD'), 'MiXeD');
});
