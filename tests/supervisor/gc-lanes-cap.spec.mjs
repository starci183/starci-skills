// gc-lanes-cap.spec.mjs - the standing lane GC keeps the registered lane worktrees under allocation.gc.laneCap with no manual
// cleanup (owner rule: worktrees never accumulate). Temp repos only; one lane holds a junction whose target must stay whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectLanes, gcSettings } from '../../scripts/supervisor/gc.mjs';

const HOUR = 3_600_000;
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'GC spec', GIT_AUTHOR_EMAIL: 'gc@example.test', GIT_COMMITTER_NAME: 'GC spec', GIT_COMMITTER_EMAIL: 'gc@example.test' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function fixture(t, names) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gc-cap-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'repo');
  fs.mkdirSync(root);
  git(root, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(root, 'work.txt'), 'base\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'base');
  const lanes = {};
  for (const name of names) {
    lanes[name] = path.join(dir, 'lanes', name);
    fs.mkdirSync(path.dirname(lanes[name]), { recursive: true });
    git(root, 'worktree', 'add', '-q', '-b', `lane/${name}`, lanes[name], 'main');
    fs.writeFileSync(path.join(lanes[name], `${name}.txt`), `${name}\n`);
    git(lanes[name], 'add', '.');
    git(lanes[name], 'commit', '-qm', `${name} work`);
  }
  const env = { STARCI_LANES_ROOT: path.join(dir, 'lanes'), STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const run = (cap, apply = true) => collectLanes({ apply, root, env, now: Date.now() + 3 * HOUR, settings: { laneGraceMs: 1, laneIdleMs: 1, laneCap: cap }, sup: { jobs: [] } });
  return { dir, root, lanes, run };
}

test('gcSettings reads allocation.gc.laneCap with a default', () => {
  assert.equal(gcSettings({ gc: { laneCap: 7 } }).laneCap, 7);
  assert.ok(gcSettings({}).laneCap > 0);
});

test('over the cap, the longest idle clean lanes go with their branches kept; a lane holding a junction is removed link-safely', (t) => {
  const { dir, root, lanes, run } = fixture(t, ['a', 'b', 'c', 'd']);
  const target = path.join(dir, 'shared-modules');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'keep.txt'), 'whole');
  fs.symlinkSync(target, path.join(lanes.a, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(lanes.d, 'dirty.txt'), 'uncommitted');
  const tips = Object.fromEntries(['a', 'b', 'c', 'd'].map((n) => [n, git(root, 'rev-parse', `lane/${n}`)]));

  const plan = run(2, false);
  assert.equal(plan.items.filter((i) => i.verdict === 'collect' && i.worktree).length, 2, JSON.stringify(plan.items));
  assert.ok(Object.values(lanes).every((p) => fs.existsSync(p)), 'a plan removes nothing');

  const out = run(2, true);
  assert.deepEqual(out.errors, []);
  const alive = Object.entries(lanes).filter(([, p]) => fs.existsSync(p)).map(([n]) => n);
  assert.equal(alive.length, 2, `two lanes stay: ${alive}`);
  assert.ok(alive.includes('d'), 'the dirty lane is never evicted');
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'whole', 'the junction target is untouched');
  for (const n of ['a', 'b', 'c', 'd']) assert.equal(git(root, 'rev-parse', `lane/${n}`), tips[n], `branch lane/${n} keeps its commits`);
  const listed = git(root, 'worktree', 'list', '--porcelain').split(/\r?\n/).filter((l) => l.startsWith('worktree ')).length - 1;
  assert.equal(listed, 2, 'git worktree list holds the cap');
});

test('at or under the cap nothing unlanded is removed', (t) => {
  const { lanes, run } = fixture(t, ['a', 'b']);
  const out = run(2, true);
  assert.equal(out.items.filter((i) => i.verdict === 'collect').length, 0);
  assert.ok(Object.values(lanes).every((p) => fs.existsSync(p)));
});
