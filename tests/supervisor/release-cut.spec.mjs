// release-cut.spec.mjs - the release flow (scripts/supervisor/release-cut.mjs): the only push of main, main and its annotated release tag together. A temp bare
// repository stands in for the remote; the full suite and the secret scan are stand-ins (the suite is the real thing at the release, once).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cutRelease, pushRefusal } from '../../scripts/supervisor/release-cut.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const CHANGELOG = '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- shipped\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n';
const green = () => [{ name: 'npm test', ok: true, log: 'test.log', ms: 1 }, { name: 'npm run check', ok: true, log: 'check.log', ms: 1 }];
const scanOk = () => ({ ok: true, findings: [] });

/** A work repo on main with one commit and CHANGELOG, pushed to a bare "origin" that has main already (the previous release). */
function fixture(t, { changelog = CHANGELOG, tagMessage = 'release notes', tag = 'v1.0.0-alpha.4', annotated = true } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-cut-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const origin = path.join(base, 'origin.git'), repo = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(base, 'clone', '-q', origin, repo);
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  git(repo, 'checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'previous release');
  git(repo, 'push', '-q', 'origin', 'main');
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), changelog);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'release commit');
  if (tag) git(repo, ...(annotated ? ['tag', '-a', tag, '-m', tagMessage] : ['tag', tag]));
  const remoteMain = () => git(origin, 'rev-parse', 'refs/heads/main');
  const remoteTags = () => git(origin, 'tag', '-l').split(/\r?\n/).filter(Boolean);
  return { base, origin, repo, remoteMain, remoteTags, before: remoteMain(), deps: { suite: green, scan: scanOk } };
}

test('pushRefusal: main plus exactly one release tag is the only push; any other ref, a second tag or a tagless push is refused', () => {
  assert.equal(pushRefusal({ refs: ['main', 'refs/tags/v1.0.0'] }), null);
  assert.match(pushRefusal({ refs: ['main', 'refs/tags/preserve/old'] }), /only main and a release tag/);
  assert.match(pushRefusal({ refs: ['main', 'refs/tags/pre-1.0.4-merge'] }), /only main and a release tag/);
  assert.match(pushRefusal({ refs: ['feature', 'refs/tags/v1.0.0'] }), /only main and a release tag/);
  assert.match(pushRefusal({ refs: ['main'] }), /with its tag|exactly one tag/);
  assert.match(pushRefusal({ refs: ['main', 'refs/tags/v1.0.0', 'refs/tags/v1.0.1'] }), /exactly one tag/);
  assert.match(pushRefusal({ refs: ['refs/tags/v1.0.0'] }), /with its tag/);
});

test('a green release pushes main and its annotated tag in one atomic push, and records the suite logs', (t) => {
  const fx = fixture(t);
  const out = cutRelease({ repo: fx.repo, deps: fx.deps });
  assert.deepEqual([out.ok, out.verdict, out.tag], [true, 'pushed', 'v1.0.0-alpha.4'], JSON.stringify(out));
  assert.deepEqual(out.suite.map((s) => [s.name, s.log]), [['npm test', 'test.log'], ['npm run check', 'check.log']]);
  assert.equal(fx.remoteMain(), git(fx.repo, 'rev-parse', 'HEAD'), 'main moved to the release commit');
  assert.deepEqual(fx.remoteTags(), ['v1.0.0-alpha.4']);
  assert.equal(git(fx.origin, 'cat-file', '-t', 'refs/tags/v1.0.0-alpha.4'), 'tag', 'the tag is annotated on the remote');
});

test('a push of main without a new release tag on HEAD, with a lightweight tag, a non-release tag or several tags is refused and nothing moves', (t) => {
  const none = fixture(t, { tag: null });
  assert.equal(cutRelease({ repo: none.repo, deps: none.deps }).verdict, 'no-release-tag');
  const light = fixture(t, { annotated: false });
  assert.equal(cutRelease({ repo: light.repo, deps: light.deps }).verdict, 'tag-not-annotated');
  const odd = fixture(t);
  git(odd.repo, 'tag', '-a', 'preserve/old-pre-rebase', '-m', 'housekeeping');
  const refused = cutRelease({ repo: odd.repo, deps: odd.deps });
  assert.equal(refused.verdict, 'bad-tag');
  assert.match(refused.why, /preserve\/old-pre-rebase/);
  const two = fixture(t);
  git(two.repo, 'tag', '-a', 'v1.0.0-alpha.5', '-m', 'second');
  assert.equal(cutRelease({ repo: two.repo, deps: two.deps }).verdict, 'several-tags');
  const named = fixture(t);
  assert.equal(cutRelease({ repo: named.repo, tag: 'preserve/old', deps: named.deps }).verdict, 'bad-tag', 'an explicit non-release tag name');
  for (const fx of [none, light, odd, two, named]) { assert.equal(fx.remoteMain(), fx.before, 'main did not move'); assert.deepEqual(fx.remoteTags(), [], 'no tag was pushed'); }
});

test('a dirty tree, a branch other than main and a tag that already exists on the remote are refused', (t) => {
  const dirty = fixture(t);
  fs.writeFileSync(path.join(dirty.repo, 'a.txt'), 'changed\n');
  assert.equal(cutRelease({ repo: dirty.repo, deps: dirty.deps }).verdict, 'dirty');
  assert.equal(fs.readFileSync(path.join(dirty.repo, 'a.txt'), 'utf8'), 'changed\n', 'nothing was stashed or reset');
  const off = fixture(t);
  git(off.repo, 'checkout', '-q', '-b', 'lane/x');
  assert.equal(cutRelease({ repo: off.repo, deps: off.deps }).verdict, 'not-on-main');
  const dup = fixture(t);
  git(dup.repo, 'push', '-q', 'origin', 'refs/tags/v1.0.0-alpha.4');
  const again = cutRelease({ repo: dup.repo, deps: dup.deps });
  assert.equal(again.verdict, 'tag-exists-on-remote');
  assert.equal(dup.remoteMain(), dup.before, 'only the tag was already there; main is untouched');
});

test('unfinished release notes (a missing section, TBD, PENDING, in preparation) stop the release before the suite runs', (t) => {
  let suites = 0;
  for (const changelog of ['# Changelog\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n', '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- TBD(sha)\n', '# Changelog\n\n## [1.0.0-alpha.4] — in preparation\n\n- x\n']) {
    const fx = fixture(t, { changelog });
    const out = cutRelease({ repo: fx.repo, deps: { ...fx.deps, suite: () => { suites += 1; return green(); } } });
    assert.equal(out.verdict, 'release-notes', JSON.stringify(out));
    assert.equal(fx.remoteMain(), fx.before);
  }
  assert.equal(suites, 0, 'the suite never runs over unfinished notes');
});

test('a red suite pushes nothing, names the red steps and their logs; the suite runs exactly once', (t) => {
  const fx = fixture(t);
  let runs = 0;
  const out = cutRelease({ repo: fx.repo, deps: { ...fx.deps, suite: () => { runs += 1; return [{ name: 'npm test', ok: false, log: 'red.log', ms: 1 }, { name: 'npm run check', ok: true, log: 'check.log', ms: 1 }]; } } });
  assert.equal(out.verdict, 'suite-red');
  assert.match(out.why, /npm test red/);
  assert.match(out.why, /red\.log/);
  assert.equal(runs, 1);
  assert.equal(fx.remoteMain(), fx.before);
  assert.deepEqual(fx.remoteTags(), []);
});

test('main moving while the suite runs, and a secret in the pushed range, stop the push', (t) => {
  const moved = fixture(t);
  const out = cutRelease({ repo: moved.repo, deps: { ...moved.deps, suite: () => { fs.writeFileSync(path.join(moved.repo, 'b.txt'), 'x\n'); git(moved.repo, 'add', '-A'); git(moved.repo, 'commit', '-q', '-m', 'late commit'); return green(); } } });
  assert.equal(out.verdict, 'main-moved');
  assert.equal(moved.remoteMain(), moved.before);
  const secret = fixture(t);
  const refused = cutRelease({ repo: secret.repo, deps: { ...secret.deps, scan: () => ({ ok: false, findings: [{ pattern: 'assigned-secret' }] }) } });
  assert.equal(refused.verdict, 'secret-scan');
  assert.equal(secret.remoteMain(), secret.before);
});

test('the push is atomic: a remote that refuses the tag leaves main where it was', (t) => {
  const fx = fixture(t);
  // An `update` hook judges ONE ref: it refuses the tag alone, so only --atomic keeps main from moving without it.
  const hook = path.join(fx.origin, 'hooks', 'update');
  fs.writeFileSync(hook, ['#!/bin/sh', 'case "$1" in refs/tags/*) echo "tags refused" >&2; exit 1;; esac', 'exit 0', ''].join('\n'), { mode: 0o755 });
  const out = cutRelease({ repo: fx.repo, deps: fx.deps });
  assert.equal(out.verdict, 'push-refused', JSON.stringify(out));
  assert.equal(fx.remoteMain(), fx.before, 'main did not move without its tag');
  assert.deepEqual(fx.remoteTags(), []);
});

test('the suite and the push run inside the one host-lock function', (t) => {
  const fx = fixture(t);
  const events = [];
  const out = cutRelease({ repo: fx.repo, deps: { ...fx.deps, suite: () => { events.push('suite'); return green(); }, lock: (work) => { events.push('lock-in'); const r = work(); events.push('lock-out'); return r; } } });
  assert.equal(out.ok, true);
  assert.deepEqual(events, ['lock-in', 'suite', 'lock-out', 'lock-in', 'lock-out'], 'the suite and the push each hold the lock');
});
