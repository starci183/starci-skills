// gc-lanes-detached.spec.mjs - the lanes collector's decision for a detached checkout: one outside the land root is kept, a land
// scratch under it goes only once no land runs and it is past the grace. Temp repos only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectLanes } from '../../scripts/supervisor/gc.mjs';

const HOUR = 3_600_000;
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'GC spec', GIT_AUTHOR_EMAIL: 'gc@example.test', GIT_COMMITTER_NAME: 'GC spec', GIT_COMMITTER_EMAIL: 'gc@example.test' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

const same = (a, b) => path.resolve(a) === path.resolve(b);

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gc-detached-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'repo');
  fs.mkdirSync(root);
  git(root, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(root, 'work.txt'), 'base\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'base');
  const lanesRoot = path.join(dir, 'lanes');
  const detach = (...parts) => {
    const target = path.join(lanesRoot, ...parts);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    git(root, 'worktree', 'add', '-q', '--detach', target, 'main');
    return target;
  };
  const env = { STARCI_LANES_ROOT: lanesRoot, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const run = (extra = {}) => collectLanes({ apply: false, root, env, now: Date.now() + 3 * HOUR, settings: { laneGraceMs: 1, laneIdleMs: 1 }, sup: { jobs: [] }, ...extra });
  return { detach, run };
}

test('a detached checkout outside the land root is kept', (t) => {
  const { detach, run } = fixture(t);
  const outside = detach('scratch-elsewhere');
  const found = run().items.find((i) => same(i.target, outside));
  assert.equal(found?.verdict, 'keep');
  assert.equal(found?.reason, 'detached checkout outside the land root');
});

test('a land scratch is kept while a land runs and collected once none does', (t) => {
  const { detach, run } = fixture(t);
  const scratch = detach('land', 'scratch-1');
  const busy = run({ landBusy: true }).items.find((i) => same(i.target, scratch));
  assert.equal(busy?.verdict, 'keep');
  assert.equal(busy?.reason, 'a land is running');
  const idle = run().items.find((i) => same(i.target, scratch));
  assert.equal(idle?.verdict, 'collect');
  assert.match(idle?.reason ?? '', /land scratch, no land running/);
});

test('a land scratch younger than the grace is kept', (t) => {
  const { detach, run } = fixture(t);
  const scratch = detach('land', 'scratch-2');
  const found = run({ settings: { laneGraceMs: 10 * HOUR, laneIdleMs: 1 } }).items.find((i) => same(i.target, scratch));
  assert.equal(found?.verdict, 'keep');
  assert.equal(found?.reason, 'recent land scratch');
});
