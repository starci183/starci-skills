import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstJson, watchOptions } from '../scripts/supervisor/core-watch.mjs';

test('firstJson reads the first balanced object after a banner and ignores braces in strings', () => {
  assert.deepEqual(firstJson('banner\n{"a":"}{","b":{"c":1}} trailing {"x":2}'), { a: '}{', b: { c: 1 } });
  assert.equal(firstJson('no json here'), null);
});

test('watchOptions: defaults, overrides, and no interval or once mode (a snapshot is the only mode)', () => {
  assert.deepEqual(watchOptions([]), { timeoutMs: 90_000, tokenWindowMs: 600_000, tokenSpike: 3_000_000 });
  assert.deepEqual(watchOptions(['--child-timeout', '5', '--token-spike', '0']), { timeoutMs: 5000, tokenWindowMs: 600_000, tokenSpike: 0 });
});
