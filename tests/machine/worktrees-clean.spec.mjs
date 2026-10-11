import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { worktreesClean } from '../../scripts/machine/worktrees-clean.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function git(cwd, ...args) {
  const result = runGit(args, { cwd });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return String(result.stdout ?? '').trim();
}

function fixture(t) {
  const base = mkdtemp(t, 'starci-worktrees-clean-');
  const repo = path.join(base, 'repo'), lanes = path.join(base, 'starci-lanes'), lane = path.join(lanes, 'merged-lane');
  const origin = path.join(base, 'origin.git');
  fs.mkdirSync(repo); fs.mkdirSync(lanes); fs.mkdirSync(origin);
  git(repo, 'init', '-q', '-b', 'main');
  git(origin, 'init', '-q', '--bare');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', key, value);
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'base\n');
  git(repo, 'add', 'tracked.txt'); git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'remote', 'add', 'origin', origin); git(repo, 'push', '-q', '-u', 'origin', 'main');
  git(repo, 'branch', 'lane/merged'); git(repo, 'worktree', 'add', '-q', lane, 'lane/merged');
  fs.writeFileSync(path.join(lane, 'lane.txt'), 'landed\n');
  git(lane, 'add', 'lane.txt'); git(lane, 'commit', '-q', '-m', 'lane');
  git(repo, 'merge', '--ff-only', 'lane/merged');
  return { base, repo, lanes, lane };
}

const context = (fx, args = {}) => ({ cwd: fx.repo, positionals: [], args, env: { STARCI_LANES_ROOT: fx.lanes } });
const noOrca = { orcaPs: () => ({ ok: true, worktrees: [] }) };

test('dry-run changes nothing and the primary worktree is never selected', async (t) => {
  const fx = fixture(t);
  const result = await worktreesClean(context(fx, { 'dry-run': true }), noOrca);
  assert.equal(result.code, 0);
  assert.equal(fs.existsSync(fx.lane), true);
  assert.equal(result.data.rows.find((row) => row.path === path.resolve(fx.repo)).action, 'primary');
  assert.equal(result.data.rows.some((row) => row.path === path.resolve(fx.repo) && row.action === 'would-remove'), false);
  assert.match(result.text, /would remove/);
});

test('real cleanup removes an inner link as a link and preserves its sentinel target', async (t) => {
  const fx = fixture(t), sentinel = path.join(fx.base, 'sentinel'), link = path.join(fx.lane, 'linked-sentinel');
  fs.mkdirSync(sentinel); fs.writeFileSync(path.join(sentinel, 'keep.txt'), 'keep\n');
  try { fs.symlinkSync(sentinel, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error?.code === 'EPERM') { t.skip('host does not permit symlink or junction creation'); return; } throw error; }
  const result = await worktreesClean(context(fx), noOrca);
  assert.equal(result.code, 0, result.text);
  assert.equal(fs.existsSync(fx.lane), false);
  assert.equal(fs.readFileSync(path.join(sentinel, 'keep.txt'), 'utf8'), 'keep\n');
  assert.equal(result.data.rows.find((row) => row.action === 'removed').links, 1);
});

test('tracked changes and unmerged lane tips are refused without removal', async (t) => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.lane, 'lane.txt'), 'dirty\n');
  let result = await worktreesClean(context(fx), noOrca);
  assert.equal(result.code, 1);
  assert.equal(result.data.rows.find((row) => row.path === path.resolve(fx.lane)).action, 'refused-dirty-tracked');
  assert.equal(fs.existsSync(fx.lane), true);
  git(fx.lane, 'restore', 'lane.txt');
  fs.writeFileSync(path.join(fx.lane, 'new.txt'), 'unmerged\n');
  git(fx.lane, 'add', 'new.txt'); git(fx.lane, 'commit', '-q', '-m', 'unmerged');
  result = await worktreesClean(context(fx), noOrca);
  assert.equal(result.code, 1);
  assert.equal(result.data.rows.find((row) => row.path === path.resolve(fx.lane)).action, 'refused-unmerged');
  assert.equal(fs.existsSync(fx.lane), true);
});
