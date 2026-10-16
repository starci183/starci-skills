// diff-base.spec.mjs - the diff base of `starci test affected` and `starci runtime verify`: the NEWEST of local main, origin/main and the latest release tag,
// because a local main in a shared repository can sit far behind a release and a stale base multiplies the affected set. The answer says why on one line.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { baseChoice, baseLine, latestReleaseTag } from '../../scripts/supervisor/diff-base.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A repo whose local main is stale: c0 = main, c1 = origin/main, c2 = tag v1.0.0-alpha.2 (after c1), HEAD = feature at c3. */
function staleMain(t, { tag = true } = {}) {
  const root = mkdtemp(t, 'starci-diff-base-');
  git(root, 'init', '-q', '-b', 'main');
  const commit = (name) => { fs.writeFileSync(path.join(root, name), `${name}\n`); git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', name); return git(root, 'rev-parse', 'HEAD'); };
  const c0 = commit('c0');
  git(root, 'checkout', '-q', '-b', 'feature');
  const c1 = commit('c1');
  git(root, 'update-ref', 'refs/remotes/origin/main', c1);
  const c2 = commit('c2');
  if (tag) git(root, 'tag', '-a', 'v1.0.0-alpha.2', '-m', 'release', c2);
  const c3 = commit('c3');
  return { root, c0, c1, c2, c3 };
}

test('a local main behind origin/main and the latest release tag loses to the tag, and the answer names what it passed over', (t) => {
  const { root, c0, c2 } = staleMain(t);
  assert.equal(latestReleaseTag(root), 'v1.0.0-alpha.2');
  const choice = baseChoice(root, undefined);
  assert.equal(choice.base, c2);
  assert.equal(choice.ref, 'v1.0.0-alpha.2');
  assert.match(choice.why, /main \(.{9}\)/);
  assert.match(choice.why, /origin\/main \(.{9}\) is behind it/);
  assert.ok(choice.why.includes(c0.slice(0, 9)));
  assert.match(baseLine(choice), /^base: [0-9a-f]{9} \(newest merge base of main, origin\/main, v1\.0\.0-alpha\.2 with HEAD is v1\.0\.0-alpha\.2;/);
});

test('without a release tag the base is origin/main when local main is behind it', (t) => {
  const { root, c1 } = staleMain(t, { tag: false });
  assert.equal(latestReleaseTag(root), null);
  const choice = baseChoice(root, undefined);
  assert.equal(choice.base, c1);
  assert.equal(choice.ref, 'origin/main');
});

test('a local main that is already the newest stays the base; a named ref is taken as named', (t) => {
  const { root, c0, c1 } = staleMain(t, { tag: false });
  git(root, 'update-ref', 'refs/remotes/origin/main', c0);
  const fresh = baseChoice(root, undefined);
  assert.equal(fresh.ref, 'main');
  assert.equal(fresh.base, c0);
  assert.doesNotMatch(fresh.why, /behind/);
  const named = baseChoice(root, c1);
  assert.deepEqual([named.base, named.ref], [c1, c1]);
  assert.match(named.why, /named by --base/);
});

test('nothing resolving gives no base and says so; an unresolved named ref says so', () => {
  const none = baseChoice('.', undefined, { mergeBase: () => null, latestTag: () => null });
  assert.equal(none.base, null);
  assert.match(none.why, /none of main, origin\/main has a merge base/);
  assert.equal(baseLine(none), `base: none (${none.why})`);
  const gone = baseChoice('.', 'topic', { mergeBase: () => null });
  assert.equal(gone.base, null);
  assert.match(gone.why, /topic has no merge base/);
});

test('candidates that agree on one merge base are not reported as passed over', () => {
  const choice = baseChoice('.', undefined, { mergeBase: () => 'a'.repeat(40), latestTag: () => 'v1.0.0', isAncestor: () => { throw new Error('same base needs no ancestry check'); } });
  assert.equal(choice.ref, 'main');
  assert.doesNotMatch(choice.why, /behind/);
});

test('a candidate that is not ahead of the current best does not replace it', () => {
  const bases = { main: 'a'.repeat(40), 'origin/main': 'b'.repeat(40) };
  const choice = baseChoice('.', undefined, { mergeBase: (_r, _h, ref) => bases[ref], latestTag: () => null, isAncestor: () => false });
  assert.equal(choice.ref, 'main');
});

test('latestReleaseTag is null outside a repository', (t) => {
  assert.equal(latestReleaseTag(mkdtemp(t, 'starci-no-repo-')), null);
});
