import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffFacts, firstJson } from '../scripts/supervisor/core-watch.mjs';

test('firstJson reads the first balanced object after a banner and ignores braces in strings', () => {
  assert.deepEqual(firstJson('banner\n{"a":"}{","b":{"c":1}} trailing {"x":2}'), { a: '}{', b: { c: 1 } });
  assert.equal(firstJson('no json here'), null);
});

test('diffFacts prints only on change: onset, changed text, recovery, gone', () => {
  const prev = new Map();
  assert.deepEqual(diffFacts(prev, new Map([['engine', 'SAFE MODE'], ['svc', null]]), { first: true }), ['[core-watch] ALERT engine: SAFE MODE']);
  assert.deepEqual(diffFacts(prev, new Map([['engine', 'SAFE MODE'], ['svc', null]])), []);
  assert.deepEqual(diffFacts(prev, new Map([['engine', 'leader STALE'], ['svc', 'down']])), ['[core-watch] ALERT engine: leader STALE', '[core-watch] ALERT svc: down']);
  assert.deepEqual(diffFacts(prev, new Map([['engine', null]])), ['[core-watch] OK engine (was: leader STALE)', '[core-watch] GONE svc (was: down)']);
});
