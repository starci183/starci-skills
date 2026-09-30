import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BE, cleanup, gitAdd, installTypeScript, writeCleanRepo } from './_hfs-cli-fixture.mjs';
import { checkExamples, exampleDirs, formatResults, main } from '../scripts/checks/check-example-architecture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const made = [];
test.after(() => cleanup(made));

/** An examples directory holding a clean and a dirty tiny back end, each its own Git repository, plus a directory with no hfs.json. */
function examples() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-examples-'));
  made.push(dir);
  for (const name of ['clean', 'dirty']) {
    const repo = writeCleanRepo(BE, { into: dir, name });
    if (name === 'dirty') {
      fs.mkdirSync(path.join(repo, 'src', 'modules', 'business'), { recursive: true });
      fs.mkdirSync(path.join(repo, 'src', 'modules', 'domain', 'order'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'src', 'modules', 'domain', 'order', 'index.ts'), 'export {};\n');
    }
    installTypeScript(gitAdd(repo));
  }
  fs.mkdirSync(path.join(dir, 'not-an-example'));
  fs.writeFileSync(path.join(dir, 'not-an-example', 'README.md'), '# nothing\n');
  return dir;
}

test('only directories with an hfs.json are examples', () => {
  const dir = examples();
  assert.deepEqual(exampleDirs(dir), ['clean', 'dirty']);
  assert.deepEqual(exampleDirs(dir, 'dirty'), ['dirty']);
});

test('a clean example passes and a dirty one fails with its findings counted by code', () => {
  const dir = examples();
  const results = checkExamples({ examplesDir: dir });
  const [clean, dirty] = results;
  assert.deepEqual([clean.name, clean.status, clean.errors], ['clean', 'clean', 0]);
  assert.equal(dirty.name, 'dirty');
  assert.equal(dirty.status, 'findings');
  assert.equal(dirty.byCode.HFS_EMPTY_DIR, 1, 'the empty directory of the slot check');
  assert.equal(dirty.byCode.BE_FEATURE_NOT_COMPOSED, 1, 'the uncomposed module of the machine');
  assert.equal(dirty.byCode.HFS_UNUSED_FILE, 1, 'and the file nothing imports');
  const text = formatResults(results);
  assert.match(text, /clean: clean/);
  assert.match(text, /dirty: 3 findings/);
  assert.match(text, /BE_FEATURE_NOT_COMPOSED x1/);
  assert.match(text, /1 of 2 examples not clean/);
});

test('the script exits 1 while any example has a finding, 0 when every one is clean, 2 on a bad argument', () => {
  const dir = examples();
  const script = path.join(root, 'scripts', 'checks', 'check-example-architecture.mjs');
  const dirty = spawnSync(process.execPath, [script, '--examples', dir], { encoding: 'utf8' });
  assert.equal(dirty.status, 1);
  assert.match(dirty.stdout, /dirty: 3 findings/);
  const clean = spawnSync(process.execPath, [script, '--examples', dir, '--only', 'clean'], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.equal(main(['--nope'], { err: () => {} }), 2);
});

test('an example whose check cannot run (not a Git work tree) is reported as unrunnable and fails, never skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-examples-'));
  made.push(dir);
  fs.mkdirSync(path.join(dir, 'broken'));
  fs.writeFileSync(path.join(dir, 'broken', 'hfs.json'), `${JSON.stringify(BE)}\n`);
  const [result] = checkExamples({ examplesDir: dir });
  assert.equal(result.status, 'unrunnable');
  assert.match(formatResults([result]), /broken: the check could not run/);
  assert.equal(main(['--examples', dir], { out: () => {}, err: () => {} }), 1);
});
