// The one copy of each helper the runtime shares across areas (CONTRIBUTING.md "Upgrading the runtime", rule 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {clip, clipLine} from '../../scripts/lib/clip.mjs';
import {braceVariants, globExpression} from '../../scripts/lib/glob.mjs';
import {parseJson} from '../../scripts/lib/json.mjs';
import {foldCase, insidePath, pathKey, posixPath, samePath, slash} from '../../scripts/lib/path-key.mjs';
import {renameOver} from '../../scripts/api/fs/rename-over.mjs';
import {publishSecret} from '../../scripts/api/fs/publish-secret.mjs';
import {mkdtemp} from '../helpers/tmpdir.mjs';
import {TEXT_MAX} from '../../scripts/connectors/telegram.mjs';
import {isDir,isFile} from '../../scripts/lib/fs-kind.mjs';
import {lines} from '../../scripts/lib/verb-call.mjs';

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

test('path spellings fold the way this host\'s filesystem does', (t) => {
  assert.equal(slash('a\\b\\c'), 'a/b/c');
  assert.equal(slash(null), '');
  assert.equal(posixPath('./a\\b'), 'a/b');
  assert.equal(foldCase('AbC'), process.platform === 'win32' ? 'abc' : 'AbC');
  assert.equal(samePath('a/b', 'A/B'), process.platform === 'win32');
  const dir = mkdtemp(t, 'path-key-');
  fs.mkdirSync(path.join(dir, 'sub'));
  assert.equal(pathKey(path.join(dir, 'sub', '..')), pathKey(dir), 'a key is resolved, slashed and folded');
  assert.equal(pathKey(dir).endsWith('/'), false);
  assert.equal(pathKey(dir.toUpperCase()) === pathKey(dir), process.platform === 'win32');
});

test('filesystem kind probes preserve following defaults and enforce caller-selected entry and size bounds', t => {
  const root = mkdtemp(t, 'fs-kind-contract-'), file = path.join(root, 'record.yaml');
  fs.writeFileSync(file, 'abc');
  assert.equal(isFile(file), true);
  assert.equal(isFile(file, { followLinks: false, maxBytes: 3 }), true, 'the exact byte bound is admitted');
  assert.equal(isFile(file, { followLinks: false, maxBytes: 2 }), false);
  assert.equal(isFile(root, { followLinks: false }), false);
  assert.equal(isDir(root, { followLinks: false }), true);
  assert.equal(isDir(file, { followLinks: false }), false);
  for (const probe of [isFile, isDir]) {
    assert.equal(probe(path.join(root, 'missing')), false);
    assert.equal(probe(path.join(root, 'missing'), { followLinks: false }), false);
  }
  const target = path.join(root, 'target'), link = path.join(root, 'link');
  fs.mkdirSync(target);
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(isDir(link), true, 'existing callers keep following directory links');
  assert.equal(isDir(link, { followLinks: false }), false, 'bounded callers refuse the linked entry');
});

test('containment keeps strict defaults and an explicit self-inclusive policy without prefix escapes', () => {
  const root = path.resolve('root');
  assert.equal(insidePath(root, root), false);
  assert.equal(insidePath(root, root, { includeSelf: true }), true);
  assert.equal(insidePath(root, path.join(root, 'child')), true);
  for (const file of [path.dirname(root), path.resolve('root-sibling'), path.join(root, '..prefix')]) {
    assert.equal(insidePath(root, file), false);
    assert.equal(insidePath(root, file, { includeSelf: true }), false);
  }
  assert.equal(insidePath('ROOT', 'root/child', { key: p => path.resolve(p.toLowerCase()) }), true);
});

test('line normalization keeps CRLF and plus text by default and honors only the selected separator', () => {
  assert.deepEqual(lines(null), []);
  assert.deepEqual(lines('  a+b \r\n \n c \n'), ['a+b', 'c']);
  assert.deepEqual(lines('a+b\rc'), ['a+b\rc'], 'a lone CR remains part of a default line');
  assert.deepEqual(lines(' a + b\n c ', { separator: /[+\n]/ }), ['a', 'b', 'c']);
});

test('private publication preserves the exact original credentials and refuses a stale preimage', t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-publication-'));
  const file = path.join(root, 'credentials.env');
  const before = Buffer.from('OTHER_TOKEN=fixture-only\r\n');
  const addition = Buffer.from('SELECTED_KEY=non-secret-fixture\n');
  fs.writeFileSync(file, before);
  const request = { root, name: path.basename(file), before, addition, maxBytes: before.length + addition.length, assertLease: () => true };
  assert.deepEqual(publishSecret(request), { ok: true, effectState: 'complete', created: false, durability: 'file-fsync' });
  const expected = Buffer.concat([before, addition]);
  assert.deepEqual(fs.readFileSync(file), expected);
  assert.deepEqual(publishSecret(request), { ok: false, effectState: 'none', reason: 'preimage-changed' });
  assert.deepEqual(fs.readFileSync(file), expected, 'the stale request does not append a duplicate');
  assert.deepEqual(before, Buffer.from('OTHER_TOKEN=fixture-only\r\n'), 'the caller preimage is not wiped');
  assert.deepEqual(addition, Buffer.from('SELECTED_KEY=non-secret-fixture\n'), 'the caller payload is not wiped');
});

test('private publication creates exclusively and never replaces an externally supplied file', t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-create-'));
  const file = path.join(root, 'credentials.env');
  const addition = Buffer.from('SELECTED_KEY=non-secret-fixture\n');
  const request = { root, name: path.basename(file), before: null, addition, maxBytes: addition.length, assertLease: () => true };
  const made = publishSecret(request);
  assert.equal(made.ok, true);
  assert.equal(made.created, true);
  assert.equal(made.durability, process.platform === 'win32' ? 'file-fsync-namespace-unqualified' : 'file-and-parent-fsync');
  assert.deepEqual(fs.readFileSync(file), addition);
  assert.deepEqual(publishSecret(request), { ok: false, effectState: 'none', reason: 'file-custody' });
  assert.deepEqual(fs.readFileSync(file), addition);
});

test('private publication refuses lease loss and an unrelated edit before its write', t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-lease-'));
  const file = path.join(root, 'credentials.env');
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  fs.writeFileSync(file, before);
  const request = { root, name: path.basename(file), before, addition, maxBytes: before.length + addition.length, assertLease: () => false };
  assert.deepEqual(publishSecret(request), { ok: false, effectState: 'none', reason: 'lease-lost' });
  assert.deepEqual(fs.readFileSync(file), before);
  let checks = 0;
  const edit = Buffer.from('UNRELATED=kept\n');
  const changed = publishSecret({ ...request, assertLease: () => {
    if (++checks === 2) fs.appendFileSync(file, edit);
    return true;
  } });
  assert.deepEqual(changed, { ok: false, effectState: 'none', reason: 'preimage-changed' });
  assert.deepEqual(fs.readFileSync(file), Buffer.concat([before, edit]));
});

test('private publication holds a partial append and never deletes or retries its remaining private bytes', t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-partial-'));
  const file = path.join(root, 'credentials.env');
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  fs.writeFileSync(file, before);
  let calls = 0;
  const io = { ...fs, writeSync: (fd, bytes, offset, length, position) => {
    if (++calls === 1) return fs.writeSync(fd, bytes, offset, 3, position);
    throw new Error('private diagnostic fixture must never be returned');
  } };
  const request = { root, name: path.basename(file), before, addition, maxBytes: before.length + addition.length, assertLease: () => true };
  const result = publishSecret(request, { fs: io });
  assert.deepEqual(result, { ok: false, effectState: 'unknown', reason: 'io-failed' });
  const partial = Buffer.concat([before, addition.subarray(0, 3)]);
  assert.deepEqual(fs.readFileSync(file), partial);
  assert.deepEqual(publishSecret(request), { ok: false, effectState: 'none', reason: 'preimage-changed' });
  assert.deepEqual(fs.readFileSync(file), partial);
  assert.equal(JSON.stringify(result).includes('private diagnostic fixture'), false);
});

test('private publication holds sync, postwrite lease and descriptor-close failures without rolling back credentials', t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-unknown-'));
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  const expected = Buffer.concat([before, addition]);
  for (const fault of ['sync', 'lease', 'close']) {
    const file = path.join(root, `${fault}.env`);
    fs.writeFileSync(file, before);
    let checks = 0;
    const io = { ...fs,
      fsyncSync: fd => { if (fault === 'sync') throw new Error('private sync diagnostic'); return fs.fsyncSync(fd); },
      closeSync: fd => { fs.closeSync(fd); if (fault === 'close') throw new Error('private close diagnostic'); },
    };
    const result = publishSecret({ root, name: path.basename(file), before, addition, maxBytes: expected.length,
      assertLease: () => ++checks !== 3 || fault !== 'lease' }, { fs: io });
    assert.deepEqual(result, { ok: false, effectState: 'unknown', reason: fault === 'close' ? 'close-failed' : fault === 'lease' ? 'lease-lost' : 'io-failed' });
    assert.deepEqual(fs.readFileSync(file), expected, 'unknown never truncates the original or selected bytes');
  }
});

test('private publication refuses a replaced inode while retaining its original descriptor', {
  skip: process.platform === 'win32' ? 'Windows retained-handle rename behavior needs its separate native custody oracle.' : false,
}, t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-inode-'));
  const file = path.join(root, 'credentials.env'), aside = path.join(root, 'retained.env');
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  fs.writeFileSync(file, before);
  let checks = 0;
  const result = publishSecret({ root, name: path.basename(file), before, addition, maxBytes: before.length + addition.length,
    assertLease: () => {
      if (++checks === 2) { fs.renameSync(file, aside); fs.writeFileSync(file, before); }
      return true;
    } });
  assert.deepEqual(result, { ok: false, effectState: 'none', reason: 'file-custody' });
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(fs.readFileSync(aside), before);
});

test('private publication refuses invalid bounds and unsupported platforms before opening a credential entry', t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-bound-'));
  const file = path.join(root, 'credentials.env');
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  const request = { root, name: path.basename(file), before, addition, maxBytes: before.length + addition.length, assertLease: () => true };
  assert.deepEqual(publishSecret({ ...request, maxBytes: 1 }), { ok: false, effectState: 'none', reason: 'invalid-request' });
  assert.deepEqual(publishSecret(request, { platform: 'unsupported' }), { ok: false, effectState: 'none', reason: 'invalid-request' });
  assert.deepEqual(publishSecret({ ...request, name: '../escape.env' }), { ok: false, effectState: 'none', reason: 'invalid-request' });
  assert.equal(fs.existsSync(file), false);
});

test('private publication refuses a symbolic credential entry', {
  skip: process.platform === 'win32' ? 'Windows file symlink creation requires an explicitly qualified native permissions profile.' : false,
}, t => {
  const root = fs.realpathSync(mkdtemp(t, 'private-link-'));
  const file = path.join(root, 'credentials.env'), target = path.join(root, 'target.env');
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  const request = { root, name: path.basename(file), before, addition, maxBytes: before.length + addition.length, assertLease: () => true };
  fs.writeFileSync(target, before);
  fs.symlinkSync(target, file, 'file');
  assert.deepEqual(publishSecret(request), { ok: false, effectState: 'none', reason: 'file-custody' });
  assert.deepEqual(fs.readFileSync(target), before);
});

test('private publication accepts a root spelled through a linked prefix and still refuses a linked root or leaf', t => {
  const base = fs.realpathSync(mkdtemp(t, 'private-prefix-'));
  const real = path.join(base, 'real'), via = path.join(base, 'via');
  fs.mkdirSync(path.join(real, 'inner'), { recursive: true });
  fs.symlinkSync(real, via, 'junction'); // a junction needs no privilege on Windows and is a plain directory link on POSIX
  const before = Buffer.from('OTHER_TOKEN=fixture-only\n'), addition = Buffer.from('SELECTED_KEY=fixture-only\n');
  const request = root => ({ root, name: 'credentials.env', before: null, addition, maxBytes: before.length + addition.length, assertLease: () => true });
  const spelled = path.join(via, 'inner');
  assert.equal(publishSecret(request(spelled)).ok, true, 'a linked prefix above the trusted root is only a spelling');
  assert.deepEqual(fs.readFileSync(path.join(real, 'inner', 'credentials.env')), addition);
  assert.deepEqual(publishSecret(request(via)), { ok: false, effectState: 'none', reason: 'root-custody' }, 'the root itself being a link is refused');
  assert.equal(fs.existsSync(path.join(real, 'credentials.env')), false);
});
