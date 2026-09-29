import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectLanes } from '../scripts/supervisor/gc.mjs';
import { withMachine } from '../engine/machine-db.mjs';

function git(cwd, ...args) {
  const extraEnv = typeof args[0] === 'object' ? args.shift() : {};
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'GC spec', GIT_AUTHOR_EMAIL: 'gc@example.test', GIT_COMMITTER_NAME: 'GC spec', GIT_COMMITTER_EMAIL: 'gc@example.test', ...extraEnv } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gc-landed-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'repo');
  const lane = path.join(dir, 'lanes', 'one');
  fs.mkdirSync(root);
  fs.mkdirSync(path.dirname(lane));
  git(root, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(root, 'work.txt'), 'base\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'base');
  git(root, 'worktree', 'add', '-q', '-b', 'lane/one', lane, 'main');
  const env = { STARCI_LANES_ROOT: path.join(dir, 'lanes'), STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const run = (apply = false, options = {}) => collectLanes({ apply, root, env, now: Date.now() + 60_000, settings: { laneGraceMs: 1 }, sup: { jobs: [] }, ...options });
  return { root, lane, env, run };
}

test('retires a clean content-landed lane with a different land patch and keeps its branch', (t) => {
  const { root, lane, run } = fixture(t);
  fs.writeFileSync(path.join(lane, 'work.txt'), 'landed\n');
  git(lane, 'add', '.');
  git(lane, 'commit', '-qm', 'lane change');
  const laneCommit = git(lane, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'work.txt'), 'landed\n');
  fs.writeFileSync(path.join(root, 'contract-entry.txt'), 'land adjustment\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'land with adjustment');
  assert.match(git(root, 'cherry', 'main', 'lane/one'), /^\+ /, 'patch IDs differ');
  const result = run().items.find((i) => i.branch === 'lane/one');
  assert.equal(result?.verdict, 'collect', JSON.stringify(result));
  assert.equal(run(true).items.find((i) => i.branch === 'lane/one')?.verdict, 'collect');
  assert.equal(fs.existsSync(lane), false);
  assert.equal(git(root, 'rev-parse', 'lane/one'), laneCommit);
});

test('retires a cherry-picked lane with a different commit hash', (t) => {
  const { root, lane, run } = fixture(t);
  fs.writeFileSync(path.join(lane, 'work.txt'), 'picked\n');
  git(lane, 'add', '.');
  git(lane, 'commit', '-qm', 'lane change');
  const laneCommit = git(lane, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'unrelated.txt'), 'main advanced\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'advance main');
  git(root, 'cherry-pick', laneCommit);
  assert.notEqual(git(root, 'rev-parse', 'main'), laneCommit);
  assert.match(git(root, 'cherry', 'main', 'lane/one'), /^- /);
  assert.equal(run().items.find((i) => i.branch === 'lane/one')?.verdict, 'collect');
  assert.equal(run(true).items.find((i) => i.branch === 'lane/one')?.verdict, 'collect');
  assert.equal(git(root, 'rev-parse', 'lane/one'), laneCommit);
});

test('refuses a lane with a genuinely unlanded change', (t) => {
  const { root, lane, run } = fixture(t);
  fs.writeFileSync(path.join(lane, 'work.txt'), 'unlanded\n');
  git(lane, 'add', '.');
  git(lane, 'commit', '-qm', 'unlanded change');
  assert.equal(run().items.find((i) => i.branch === 'lane/one')?.verdict, 'keep');
  assert.equal(fs.existsSync(lane), true);
  assert.equal(git(root, 'rev-parse', 'lane/one').length, 40);
});

test('refuses a dirty lane even when its commit content is landed', (t) => {
  const { root, lane, run } = fixture(t);
  fs.writeFileSync(path.join(lane, 'work.txt'), 'landed\n');
  git(lane, 'add', '.');
  git(lane, 'commit', '-qm', 'lane change');
  fs.writeFileSync(path.join(root, 'work.txt'), 'landed\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'land');
  fs.writeFileSync(path.join(lane, 'dirty.txt'), 'pending\n');
  assert.equal(run().items.find((i) => i.branch === 'lane/one')?.verdict, 'keep');
  assert.equal(fs.existsSync(lane), true);
});

test('accepts passed land_runs covering every lane commit', (t) => {
  const { root, lane, env, run } = fixture(t);
  fs.writeFileSync(path.join(lane, 'work.txt'), 'resolved differently\n');
  git(lane, 'add', '.');
  git(lane, 'commit', '-qm', 'lane change');
  const first = git(root, 'rev-parse', 'lane/one');
  fs.writeFileSync(path.join(lane, 'second.txt'), 'second change\n');
  git(lane, 'add', '.');
  git(lane, 'commit', '-qm', 'second lane change');
  const second = git(root, 'rev-parse', 'lane/one');
  assert.equal(run().items.find((i) => i.branch === 'lane/one')?.verdict, 'keep');
  // The land gate's record: a machine.sqlite land_runs row per passed land (land.mjs recordLand).
  const passed = (sha) => withMachine((m) => m.recordLandRun({ lane: 'lane/one', commitSha: sha, landedSha: sha, result: 'passed' }), { env });
  passed(first);
  assert.equal(run().items.find((i) => i.branch === 'lane/one')?.verdict, 'keep');
  passed(second);
  assert.equal(run().items.find((i) => i.branch === 'lane/one')?.verdict, 'collect');
});

test('accepts a file that main changed after the lane commit', (t) => {
  const { root, lane, run } = fixture(t);
  const early = { GIT_AUTHOR_DATE: '2030-01-02T00:00:00Z', GIT_COMMITTER_DATE: '2030-01-02T00:00:00Z' };
  const late = { GIT_AUTHOR_DATE: '2030-01-03T00:00:00Z', GIT_COMMITTER_DATE: '2030-01-03T00:00:00Z' };
  fs.writeFileSync(path.join(lane, 'work.txt'), 'lane value\n');
  git(lane, 'add', '.');
  git(lane, early, 'commit', '-qm', 'lane change');
  fs.writeFileSync(path.join(root, 'work.txt'), 'main moved later\n');
  git(root, 'add', '.');
  git(root, late, 'commit', '-qm', 'later main change');
  const result = run(false, { now: Date.parse('2031-01-01T00:00:00Z') }).items.find((i) => i.branch === 'lane/one');
  assert.equal(result?.verdict, 'collect', JSON.stringify(result));
});
