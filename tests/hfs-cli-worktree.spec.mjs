// hfs-cli-worktree.spec.mjs - `hfs check` run from a `git worktree add` checkout whose node_modules is a junction (the way every
// lane gates) prints its report and exits with a status. It once printed nothing there: argv[1] kept the junction path while
// import.meta.url was the resolved one, so the entry-point test skipped main and the gate saw a silent pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP, cleanup, gitAdd, installPresets, writeCleanRepo } from './_hfs-cli-fixture.mjs';
import { isMain } from '../scripts/checks/common.mjs';

const made = [];
test.after(() => cleanup(made));

const HFS_PACKAGE = path.resolve(import.meta.dirname, '..', 'packages', 'hfs');

test('isMain compares real paths: an entry reached through a junction or symlink is still the entry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-ismain-'));
  made.push(dir);
  const real = path.join(dir, 'real');
  fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'entry.mjs'), 'export {};\n');
  fs.symlinkSync(real, path.join(dir, 'link'), 'junction');
  const url = new URL(`file:///${path.join(real, 'entry.mjs').replace(/\\/g, '/')}`).href;
  assert.equal(isMain(url, ['node', path.join(dir, 'link', 'entry.mjs')]), true, 'reached through the junction');
  assert.equal(isMain(url, ['node', path.join(real, 'entry.mjs')]), true, 'reached directly');
  assert.equal(isMain(url, ['node', path.join(dir, 'other.mjs')]), false, 'another entry');
  assert.equal(isMain(url, ['node']), false, 'no entry');
});

test('hfs check inside a git worktree with a junctioned node_modules is never silent: a report or a loud refusal', () => {
  const repo = gitAdd(installPresets(writeCleanRepo(APP)));
  made.push(repo);
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], { stdio: 'ignore' });
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-wt-'));
  fs.rmSync(worktree, { recursive: true, force: true });
  execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', '--detach', worktree], { stdio: 'ignore' });
  made.push(worktree);
  // the lane layout: the worktree's node_modules is a junction to a shared install that holds @starci/hfs (itself linked)
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-shared-nm-'));
  made.push(shared);
  fs.cpSync(path.join(repo, 'node_modules'), shared, { recursive: true });
  fs.mkdirSync(path.join(shared, '@starci'), { recursive: true });
  fs.symlinkSync(HFS_PACKAGE, path.join(shared, '@starci', 'hfs'), 'junction');
  fs.symlinkSync(shared, path.join(worktree, 'node_modules'), 'junction');
  const bin = path.join(worktree, 'node_modules', '@starci', 'hfs', 'bin', 'hfs.mjs');
  let run;
  try {
    run = spawnSync(process.execPath, [bin, 'check'], { cwd: worktree, encoding: 'utf8', timeout: 600_000 });
  } finally {
    // unlink both junctions (lstat sees a link, unlink removes only the link) before any removal, so neither git nor the
    // cleanup ever walks into the shared install or the runtime's packages/hfs
    for (const link of [path.join(worktree, 'node_modules'), path.join(shared, '@starci', 'hfs')]) if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
    execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', worktree], { stdio: 'ignore' });
  }
  // never silent: either the report (exit 0 or 1) or a loud refusal on stderr with a non-zero status
  assert.equal(typeof run.status, 'number', `hfs ran to an exit status (signal ${run.signal}, error ${run.error?.message})`);
  assert.ok(`${run.stdout}${run.stderr}`.trim().length > 0, 'hfs check printed nothing from a worktree');
  if (run.status === 0 || run.status === 1) assert.match(run.stdout, /^hfs check /m, 'a finished check prints its report');
  else assert.ok(run.stderr.trim().length > 0, `a refusal (status ${run.status}) names its reason on stderr`);
});
