// The one copy of each helper the runtime shares across areas (CONTRIBUTING.md "Upgrading the runtime", rule 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import {clip, clipLine} from '../scripts/lib/clip.mjs';
import {TEXT_MAX} from '../scripts/connectors/telegram.mjs';

test('clip cuts to n characters with an ellipsis; clipLine also folds whitespace onto one line', () => {
  assert.equal(clip('abcdef', 4), 'abc…');
  assert.equal(clip('abc', 3), 'abc');
  assert.equal(clip(null, 3), '');
  assert.equal(clip('a\n  b', 10), 'a\n  b', 'clip keeps the text as it is');
  assert.equal(clipLine('  a\n\n  b  c ', 10), 'a b c');
  assert.equal(clipLine('one two three', 8), 'one two…');
  assert.equal(clipLine(undefined, 5), '');
});

test('one Telegram text cap, under the 4096-character sendMessage limit', () => {
  assert.ok(Number.isInteger(TEXT_MAX) && TEXT_MAX < 4096);
});
