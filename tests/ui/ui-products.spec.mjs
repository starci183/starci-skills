import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { attemptProducts } from '../../ui/api/products.mjs';

const repoWithTwoCommits = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ui-products-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => { const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['commit.gpgsign', 'false']]) git('config', k, v);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  fs.writeFileSync(path.join(repo, 'b.md'), '# b\n');
  git('add', '-A'); git('commit', '-q', '-m', 'first');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\ntwo\n');
  fs.writeFileSync(path.join(repo, 'c.json'), '{"c":1}\n');
  git('add', '-A'); git('commit', '-q', '-m', 'second');
  return { repo, head: git('rev-parse', 'HEAD'), parent: git('rev-parse', 'HEAD^') };
};

test('attemptProducts reads an attempt\'s files at its head through the read-only git call (rev-parse, diff, cat-file, show)', async (t) => {
  const { repo, head, parent } = repoWithTwoCommits(t);
  const products = await attemptProducts(repo, { head, files: ['a.txt', 'b.md', 'missing.txt', '../escape.txt'] });
  assert.equal(products.error, null);
  assert.equal(products.head, head);
  assert.equal(products.parent, parent);
  const byPath = Object.fromEntries(products.files.map((f) => [f.path, f]));
  assert.equal(byPath['a.txt'].status, 'modified');
  assert.equal(byPath['a.txt'].content, 'one\ntwo\n');
  assert.match(byPath['a.txt'].diff, /\+two/);
  assert.equal(byPath['b.md'].status, 'unchanged');
  assert.equal(byPath['b.md'].kind, 'markdown');
  assert.equal(byPath['missing.txt'].status, 'missing');
  assert.equal(byPath['../escape.txt'].error, 'path escapes the repository');
  assert.deepEqual(products.otherChanged, [{ path: 'c.json', status: 'added' }]);
});

test('attemptProducts names a head the repository does not hold', async (t) => {
  const { repo } = repoWithTwoCommits(t);
  const products = await attemptProducts(repo, { head: 'f'.repeat(40), files: ['a.txt'] });
  assert.equal(products.error, 'commit not found in repository');
});
