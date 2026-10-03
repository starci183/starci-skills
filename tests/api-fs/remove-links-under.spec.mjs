import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removeLinksUnder } from '../../scripts/api/fs/remove-links-under.mjs';
import { safeRemove } from '../../scripts/api/fs/safe-remove.mjs';

const DIR_LINK = process.platform === 'win32' ? 'junction' : 'dir';
const key = value => path.resolve(value);
const linkPresent = value => {
  try { return fs.lstatSync(value).isSymbolicLink(); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-remove-links-')));
  t.after(() => {
    const removed = safeRemove(root, { hold: () => null });
    assert.equal(removed.ok, true, JSON.stringify(removed.errors));
  });
  const tree = path.join(root, 'tree');
  const sentinel = path.join(root, 'sentinel');
  fs.mkdirSync(tree);
  fs.mkdirSync(path.join(sentinel, 'deep'), { recursive: true });
  const contents = new Map([
    ['package.json', '{"name":"sentinel"}\n'],
    ['deep/leaf.txt', 'must survive link removal\n'],
  ]);
  for (const [name, bytes] of contents) fs.writeFileSync(path.join(sentinel, name), bytes);
  const intact = () => {
    for (const [name, bytes] of contents) assert.equal(fs.readFileSync(path.join(sentinel, name), 'utf8'), bytes);
  };
  const link = (name, target = sentinel) => {
    const file = path.join(tree, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.symlinkSync(target, file, DIR_LINK);
    return file;
  };
  return { root, tree, sentinel, intact, link };
}

test('removeLinksUnder removes real directory links without entering their targets', t => {
  const { tree, sentinel, intact, link } = fixture(t);
  const first = link('source');
  const second = link('node_modules/@scope/package', path.join(sentinel, 'deep'));
  const untouchedInnerLink = path.join(sentinel, 'inner-link');
  fs.symlinkSync(path.join(sentinel, 'deep'), untouchedInnerLink, DIR_LINK);
  const plain = path.join(tree, 'plain.txt');
  fs.writeFileSync(plain, 'tree stays until its owning remover runs\n');

  assert.deepEqual(removeLinksUnder(tree), { ok: true, links: 2, errors: [] });
  assert.equal(linkPresent(first), false);
  assert.equal(linkPresent(second), false);
  assert.equal(linkPresent(untouchedInnerLink), true, 'the walk does not enter a link target');
  assert.equal(fs.readFileSync(plain, 'utf8'), 'tree stays until its owning remover runs\n');
  assert.equal(fs.statSync(tree).isDirectory(), true);
  intact();
});

test('removeLinksUnder handles mixed live and dangling links while leaving ordinary and hard-linked files', t => {
  const { root, tree, sentinel, intact, link } = fixture(t);
  const live = link('live');
  const broken = link('nested/broken', path.join(root, 'missing-target'));
  const plain = path.join(tree, 'nested', 'plain.txt');
  const hard = path.join(tree, 'hard-leaf.txt');
  fs.writeFileSync(plain, 'ordinary file\n');
  fs.linkSync(path.join(sentinel, 'deep', 'leaf.txt'), hard);
  assert.equal(fs.existsSync(broken), false);
  assert.equal(linkPresent(broken), true, 'a dangling link still has its own filesystem entry');

  assert.deepEqual(removeLinksUnder(tree), { ok: true, links: 2, errors: [] });
  assert.equal(linkPresent(live), false);
  assert.equal(linkPresent(broken), false);
  assert.equal(fs.readFileSync(plain, 'utf8'), 'ordinary file\n');
  assert.equal(fs.readFileSync(hard, 'utf8'), 'must survive link removal\n');
  intact();
});

test('removeLinksUnder unlinks a root that is itself a real directory link', t => {
  const { root, sentinel, intact } = fixture(t);
  const alias = path.join(root, 'root-link');
  fs.symlinkSync(sentinel, alias, DIR_LINK);

  assert.deepEqual(removeLinksUnder(alias), { ok: true, links: 1, errors: [] });
  assert.equal(linkPresent(alias), false);
  intact();
});

test('removeLinksUnder leaves a plain tree intact and accepts a missing tree', t => {
  const { root, tree, intact } = fixture(t);
  const plain = path.join(tree, 'plain.txt');
  fs.writeFileSync(plain, 'plain\n');

  assert.deepEqual(removeLinksUnder(tree), { ok: true, links: 0, errors: [] });
  assert.equal(fs.readFileSync(plain, 'utf8'), 'plain\n');
  assert.deepEqual(removeLinksUnder(path.join(root, 'absent')), { ok: true, links: 0, errors: [] });
  intact();
});

test('removeLinksUnder reports a blocked link once, retains the tree, and records partial link removal', t => {
  const { tree, intact, link } = fixture(t);
  const blocked = link('blocked');
  const removable = link('removable');
  const plain = path.join(tree, 'plain.txt');
  fs.writeFileSync(plain, 'retain parent\n');
  const unlink = fs.unlinkSync;
  const rmdir = fs.rmdirSync;
  const refuse = file => {
    if (key(file) === key(blocked)) throw Object.assign(new Error('fixture refuses this exact link'), { code: 'EPERM' });
  };
  const unlinkMock = t.mock.method(fs, 'unlinkSync', (file, ...args) => { refuse(file); return unlink.call(fs, file, ...args); });
  const rmdirMock = t.mock.method(fs, 'rmdirSync', (file, ...args) => { refuse(file); return rmdir.call(fs, file, ...args); });
  try {
    const out = removeLinksUnder(tree);
    assert.equal(out.ok, false);
    assert.equal(out.links, 1, 'the successful link removal is retained in the partial result');
    assert.deepEqual(out.errors, [{ path: blocked, code: 'LINK_STUCK', message: 'a link could not be removed' }]);
    assert.equal(linkPresent(blocked), true);
    assert.equal(linkPresent(removable), false);
    assert.equal(fs.readFileSync(plain, 'utf8'), 'retain parent\n');
    intact();
  } finally {
    unlinkMock.mock.restore();
    rmdirMock.mock.restore();
  }
});

test('removeLinksUnder refuses success when a new real link appears before the final zero-link rescan', t => {
  const { tree, sentinel, intact, link } = fixture(t);
  const original = link('original');
  const residual = path.join(tree, 'residual');
  const unlink = fs.unlinkSync;
  const rmdir = fs.rmdirSync;
  let appeared = false;
  const afterRemoval = file => {
    if (key(file) === key(original) && !appeared) {
      appeared = true;
      fs.symlinkSync(sentinel, residual, DIR_LINK);
    }
  };
  const unlinkMock = t.mock.method(fs, 'unlinkSync', (file, ...args) => { const result = unlink.call(fs, file, ...args); afterRemoval(file); return result; });
  const rmdirMock = t.mock.method(fs, 'rmdirSync', (file, ...args) => { const result = rmdir.call(fs, file, ...args); afterRemoval(file); return result; });
  try {
    const out = removeLinksUnder(tree);
    assert.equal(out.ok, false);
    assert.equal(out.links, 1);
    assert.deepEqual(out.errors, [{ path: residual, code: 'LINK_STUCK', message: 'a link is still there after removal' }]);
    assert.equal(linkPresent(original), false);
    assert.equal(linkPresent(residual), true);
    assert.equal(fs.statSync(tree).isDirectory(), true);
    intact();
  } finally {
    unlinkMock.mock.restore();
    rmdirMock.mock.restore();
  }
});
