import test from 'node:test';
import assert from 'node:assert/strict';
import { uiDirOf } from '../../scripts/work/ui/render-hook.mjs';

// uiDirOf reads the ui node an operation wrote: a reference to the record names its folder, a reference to the
// folder (or a glob under it) names the folder itself.
const dirOf = (reference) => uiDirOf({ op: { references: [reference] } });

test('a reference ending in a file name resolves to the folder it sits in', () => {
  assert.equal(dirOf('features/a/ui/home/index.yaml'), 'features/a/ui/home');
  assert.equal(dirOf('features/a/ui/home/file.tar.gz'), 'features/a/ui/home');
  assert.equal(dirOf('features/a/ui/home/f.123'), 'features/a/ui/home');
  assert.equal(dirOf('.starciwork/features/a/ui/home/index.yaml'), '.starciwork/features/a/ui/home');
});

test('a reference to the folder, a glob under it or a trailing dot stays the folder', () => {
  assert.equal(dirOf('features/a/ui/home'), 'features/a/ui/home');
  assert.equal(dirOf('features/a/ui/home/'), 'features/a/ui/home');
  assert.equal(dirOf('features/a/ui/home/**'), 'features/a/ui/home');
  assert.equal(dirOf('features/a/ui/home/***'), 'features/a/ui/home');
  assert.equal(dirOf('features/a/ui/x.'), 'features/a/ui/x.');
  assert.equal(dirOf('features/a/ui/home/f.a-b'), 'features/a/ui/home/f.a-b');
  assert.equal(dirOf('features/a/ui/home/f.é'), 'features/a/ui/home/f.é');
});

test('only a canonical Work UI node is a design input', () => {
  assert.equal(dirOf('grammar/ui/x/index.yaml'), null);
  assert.equal(dirOf('a/features/a/ui/n/i.yaml'), null);
  assert.equal(uiDirOf({ op: { references: ['grammar/ui/x/index.yaml', 'features/z/ui/y/index.yaml'] } }), 'features/z/ui/y');
  assert.equal(uiDirOf({ op: {}, files: ['docs/a.md'] }), null);
  assert.equal(uiDirOf(), null);
});
