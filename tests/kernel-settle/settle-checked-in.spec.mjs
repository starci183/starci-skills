import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { checkedInOf } from '../../scripts/kernel/verbs/shared/settle-checked-in.mjs';
import { runGit } from '../../scripts/api/git/lib.mjs';

const ledgerWith = (rows) => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE check_runs(attempt_id INTEGER, runner TEXT, cwd TEXT)');
  const insert = db.prepare('INSERT INTO check_runs(attempt_id, runner, cwd) VALUES(?,?,?)');
  for (const row of rows) insert.run(...row);
  return db;
};

test('every directory a kernel or settler check ran in is named with the commit and tree it held', () => {
  const db = ledgerWith([[7, 'kernel', '/tree/a'], [7, 'kernel', '/tree/a'], [7, 'settler', '/tree/b'], [7, 'op', '/tree/op'], [7, 'kernel', null], [8, 'kernel', '/tree/other']]);
  const asked = [];
  const query = (args, options) => { asked.push([args, options.dir]); return { status: 0, stdout: `${'c'.repeat(40)}\n${'d'.repeat(40)}\n`, stderr: '' }; };
  const ran = checkedInOf(db, 7, { query });
  assert.deepEqual(ran, [{ cwd: '/tree/a', commit: 'c'.repeat(40), tree: 'd'.repeat(40) }, { cwd: '/tree/b', commit: 'c'.repeat(40), tree: 'd'.repeat(40) }]);
  assert.deepEqual(asked.map((entry) => entry[1]), ['/tree/a', '/tree/b']);
  assert.deepEqual(asked[0][0], ['HEAD', 'HEAD^{tree}']);
});

test('no recorded directory is an empty list, no attempt is null, and a directory git cannot read keeps its reason', () => {
  const db = ledgerWith([[1, 'kernel', '/gone']]);
  assert.deepEqual(checkedInOf(db, 2), []);
  assert.equal(checkedInOf(db, null), null);
  const [only] = checkedInOf(db, 1, { query: () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' }) });
  assert.deepEqual([only.cwd, only.commit, only.tree], ['/gone', null, null]);
  assert.match(only.error, /not a git repository/);
});

test('a real repository names its own HEAD commit and tree', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-checked-in-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const git = (...args) => { const r = runGit(args, { dir, config: { 'user.name': 'spec', 'user.email': 'spec@example.test', 'commit.gpgsign': 'false' } }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
  git('add', 'a.txt');
  git('commit', '-q', '-m', 'one');
  const [ran] = checkedInOf(ledgerWith([[3, 'settler', dir]]), 3);
  assert.deepEqual([ran.commit, ran.tree], [git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}')]);
});
