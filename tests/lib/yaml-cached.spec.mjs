// A YAML text parses once per process; every caller gets its own copy, and a changed text parses again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYamlCached } from '../../scripts/lib/yaml-cached.mjs';

test('the same text gives equal documents that share nothing', () => {
  const a = parseYamlCached('rules:\n  - id: R1\n');
  const b = parseYamlCached('rules:\n  - id: R1\n');
  assert.deepEqual(a, b);
  a.rules[0].id = 'changed';
  assert.equal(b.rules[0].id, 'R1', 'a caller changing its copy does not reach the next caller');
  assert.equal(parseYamlCached('rules:\n  - id: R1\n').rules[0].id, 'R1');
});

test('another text is another document, and a text that does not parse throws every time', () => {
  assert.equal(parseYamlCached('a: 1\n').a, 1);
  assert.equal(parseYamlCached('a: 2\n').a, 2);
  assert.throws(() => parseYamlCached('a: [1\n'));
  assert.throws(() => parseYamlCached('a: [1\n'));
});
