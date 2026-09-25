// The one copy of each helper the runtime shares across areas (CONTRIBUTING.md "Upgrading the runtime", rule 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {clip, clipLine} from '../scripts/lib/clip.mjs';
import {braceVariants, globExpression} from '../scripts/lib/glob.mjs';
import {parseJson} from '../scripts/lib/json.mjs';
import {foldCase, pathKey, posixPath, samePath, slash} from '../scripts/lib/path-key.mjs';
import {renameOver} from '../scripts/lib/rename-over.mjs';
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

test('renameOver retries a busy rename, and removes the temp file when the rename fails for good', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-over-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'f.json'), tmp = `${file}.tmp`;
  const real = fs.renameSync;
  t.after(() => { fs.renameSync = real; });
  const waits = [];
  let refusals = 2;
  fs.renameSync = (from, to) => { if (refusals-- > 0) throw Object.assign(Error('busy'), {code: 'EBUSY'}); return real(from, to); };
  fs.writeFileSync(tmp, 'one');
  renameOver(tmp, file, {sleep: ms => waits.push(ms), delayMs: i => 25 * (i + 1)});
  assert.equal(fs.readFileSync(file, 'utf8'), 'one');
  assert.deepEqual(waits, [25, 50]);

  fs.renameSync = () => { throw Object.assign(Error('busy'), {code: 'EPERM'}); };
  fs.writeFileSync(tmp, 'two');
  assert.throws(() => renameOver(tmp, file, {retries: 3, sleep: () => {}}), {code: 'EPERM'});
  assert.equal(fs.existsSync(tmp), false, 'the temp file is removed');

  fs.renameSync = () => { throw Object.assign(Error('gone'), {code: 'ENOENT'}); };
  fs.writeFileSync(tmp, 'three');
  let slept = 0;
  assert.throws(() => renameOver(tmp, file, {sleep: () => { slept += 1; }}), {code: 'ENOENT'});
  assert.equal(slept, 0, 'only a busy refusal is retried');
  assert.equal(fs.existsSync(tmp), false);
  assert.equal(fs.readFileSync(file, 'utf8'), 'one');
});

test('braceVariants spells every alternative of {a,b}, left to right and nested', () => {
  assert.deepEqual(braceVariants('src/{a,b}/x'), ['src/a/x', 'src/b/x']);
  assert.deepEqual(braceVariants('{a,{b,c}}'), ['a', 'b', 'a', 'c'], 'an inner brace expands first; callers de-duplicate through some()');
  assert.deepEqual(braceVariants('plain'), ['plain']);
});

test('globExpression anchors the shared glob subset: ** spans directories, * and ? stay in a segment', () => {
  assert.ok(globExpression('src/**/*.ts').test('src/a/b/c.ts'));
  assert.ok(globExpression('src/**/*.ts').test('src/c.ts'), '**/ also matches zero directories');
  assert.ok(globExpression('src/*.ts').test('src/a.ts'));
  assert.equal(globExpression('src/*.ts').test('src/a/b.ts'), false, '* never crosses a segment');
  assert.ok(globExpression('f?.ts').test('f1.ts'));
  assert.equal(globExpression('f?.ts').test('f12.ts'), false);
  assert.ok(globExpression('a+b.ts').test('a+b.ts'), 'regex characters in the pattern stay literal');
  assert.equal(globExpression('a+b.ts').test('aaab.ts'), false);
  assert.ok(globExpression('.\\src\\*.ts').test('src/x.ts'), 'backslashes and a leading ./ fold first');
});

test('parseJson is the ledger\'s forgiving read: malformed text is the fallback, never a throw', () => {
  assert.deepEqual(parseJson('{"a":1}'), {a: 1});
  assert.equal(parseJson('not json'), null);
  assert.deepEqual(parseJson('not json', {}), {}, 'the caller\'s fallback comes back');
  assert.deepEqual(parseJson('bad', {fallback: true}), {fallback: true});
  assert.equal(parseJson('null', {}), null, 'the literal null parses to null - callers that want {} write ?? {}');
  assert.equal(parseJson(undefined), null);
});

test('path spellings fold the way this host\'s filesystem does', () => {
  assert.equal(slash('a\\b\\c'), 'a/b/c');
  assert.equal(slash(null), '');
  assert.equal(posixPath('./a\\b'), 'a/b');
  assert.equal(foldCase('AbC'), process.platform === 'win32' ? 'abc' : 'AbC');
  assert.equal(samePath('a/b', 'A/B'), process.platform === 'win32');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-key-'));
  fs.mkdirSync(path.join(dir, 'sub'));
  assert.equal(pathKey(path.join(dir, 'sub', '..')), pathKey(dir), 'a key is resolved, slashed and folded');
  assert.equal(pathKey(dir).endsWith('/'), false);
  assert.equal(pathKey(dir.toUpperCase()) === pathKey(dir), process.platform === 'win32');
});
