// local-main.spec.mjs - a release fast-forwards the LOCAL main ref when that is safe (scripts/supervisor/local-main.mjs): the released commit is on origin/main,
// the local main is an ancestor of it, and no worktree has main checked out. Real temp repositories; nothing outside them is touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { advanceLocalMain } from '../../scripts/supervisor/local-main.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** main = c0; feature (checked out) = c0..c2; origin/main = c2 (the released commit). */
function stale(t) {
  const root = mkdtemp(t, 'starci-local-main-');
  git(root, 'init', '-q', '-b', 'main');
  const commit = (name) => { fs.writeFileSync(path.join(root, name), `${name}\n`); git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', name); return git(root, 'rev-parse', 'HEAD'); };
  const c0 = commit('c0');
  git(root, 'checkout', '-q', '-b', 'feature');
  const c1 = commit('c1');
  const c2 = commit('c2');
  git(root, 'update-ref', 'refs/remotes/origin/main', c2);
  return { root, c0, c1, c2, main: () => git(root, 'rev-parse', 'refs/heads/main') };
}

test('a stale local main is fast-forwarded to the released commit when no worktree has it checked out', (t) => {
  const { root, c0, c2, main } = stale(t);
  const out = advanceLocalMain({ root, to: c2 });
  assert.equal(out.moved, true);
  assert.equal(out.from, c0);
  assert.equal(out.to, c2);
  assert.match(out.why, /fast-forwarded/);
  assert.equal(main(), c2);
  assert.match(git(root, 'reflog', 'show', 'refs/heads/main', '-1'), /release: fast-forward main/);
});

test('a local main already at the released commit stays', (t) => {
  const { root, c2, main } = stale(t);
  git(root, 'update-ref', 'refs/heads/main', c2);
  const out = advanceLocalMain({ root, to: c2 });
  assert.deepEqual([out.moved, main()], [false, c2]);
  assert.match(out.why, /already at/);
});

test('a main checked out in a worktree is never moved from under it', (t) => {
  const { root, c0, c2, main } = stale(t);
  git(root, 'checkout', '-q', 'main');
  const out = advanceLocalMain({ root, to: c2 });
  assert.deepEqual([out.moved, main()], [false, c0]);
  assert.match(out.why, /main is checked out in /);
});

test('a commit not yet on origin/main, a local main that is not an ancestor, an unknown ref and a missing main are all left alone', (t) => {
  const { root, c0, c1, c2, main } = stale(t);
  git(root, 'update-ref', 'refs/remotes/origin/main', c1);
  const early = advanceLocalMain({ root, to: c2 });
  assert.equal(early.moved, false);
  assert.match(early.why, /is not on origin\/main yet/);
  git(root, 'update-ref', 'refs/remotes/origin/main', c2);
  git(root, 'checkout', '-q', '--detach', c0);
  fs.writeFileSync(path.join(root, 'side'), 'side\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'side');
  const side = git(root, 'rev-parse', 'HEAD');
  git(root, 'update-ref', 'refs/heads/main', side);
  const diverged = advanceLocalMain({ root, to: c2 });
  assert.equal(diverged.moved, false);
  assert.match(diverged.why, /not a fast-forward/);
  assert.equal(main(), side);
  assert.match(advanceLocalMain({ root, to: 'no-such-ref' }).why, /does not resolve/);
  git(root, 'update-ref', '-d', 'refs/heads/main');
  assert.match(advanceLocalMain({ root, to: c2 }).why, /there is no local main/);
});

test('a refused update-ref is reported, not thrown', (t) => {
  const { root, c2 } = stale(t);
  const out = advanceLocalMain({ root, to: c2, deps: { updateRef: () => ({ ok: false, stderr: 'locked' }) } });
  assert.equal(out.moved, false);
  assert.match(out.why, /update-ref refused: locked/);
});
