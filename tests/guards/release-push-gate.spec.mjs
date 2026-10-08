// release-push-gate.spec.mjs - the remote main and the v* tags of the runtime repository move only with a release. The generated pre-push hook
// (scripts/guards/git-hooks.mjs -> scripts/guards/release-push-gate.mjs) runs in a real temporary repository with a bare remote, exactly as `git push` runs it:
// a head that is not a release commit is refused and the refusal names what is missing; a head that satisfies the release definition
// (scripts/guards/release-definition.mjs) goes through; another branch is not the hook's business; a v* tag needs the release behind it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installGitHooks } from '../../scripts/guards/git-hooks.mjs';
import { RECEIPT_STEPS, releaseFindings, versionAt } from '../../scripts/guards/release-definition.mjs';
import { writeL4Record } from '../../scripts/guards/release-record.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_PREFIX']) delete process.env[key];

const OLD = '1.0.0-alpha.3';
const NEXT = '1.0.0-alpha.4';
const TAG = `v${NEXT}`;
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const gitOk = (cwd, args) => { const r = git(cwd, args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const changelog = (heading) => `# Changelog\n\n## [${NEXT}] ${heading}\n\n- the release\n\n## [${OLD}] — 2026-09-30\n\n- older\n`;
const greenRows = (names = RECEIPT_STEPS) => names.map((name) => ({ name, ok: true, log: `${name}.log`, ms: 1 }));

/** commit everything with a version and a changelog. */
function commit(repo, { version, heading = '— 2026-10-08', message }) {
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'rt', version })}\n`);
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), version === OLD ? `# Changelog\n\n## [${OLD}] — 2026-09-30\n\n- older\n` : changelog(heading));
  gitOk(repo, ['add', '-A']);
  gitOk(repo, ['commit', '-q', '-m', message]);
  return gitOk(repo, ['rev-parse', 'HEAD']);
}

/** A work repository whose bare origin already holds the previous release's main; the generated hooks are installed afterwards. */
function fixture(t) {
  const base = mkdtemp(t, 'starci-release-push-gate-');
  const origin = path.join(base, 'origin.git');
  const repo = path.join(base, 'work');
  gitOk(base, ['init', '-q', '--bare', '-b', 'main', origin]);
  gitOk(base, ['clone', '-q', origin, repo]);
  for (const args of [['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false'], ['config', 'tag.gpgsign', 'false'], ['config', 'core.autocrlf', 'false'], ['checkout', '-q', '-b', 'main']]) gitOk(repo, args);
  commit(repo, { version: OLD, message: 'previous release' });
  gitOk(repo, ['push', '-q', 'origin', 'main']);
  assert.equal(installGitHooks({ root: repo }).ok, true);
  const remoteMain = () => gitOk(origin, ['rev-parse', 'refs/heads/main']);
  const before = remoteMain();
  const push = (...refs) => { const r = git(repo, ['push', 'origin', ...refs]); return { status: r.status, text: `${r.stderr}${r.stdout}` }; };
  return { base, origin, repo, remoteMain, before, push };
}

test('a head that is not a release commit is refused, naming the annotated tag and the release record that are missing and the command that makes them', (t) => {
  const fx = fixture(t);
  commit(fx.repo, { version: NEXT, message: 'bump' });
  const out = fx.push('main');
  assert.notEqual(out.status, 0);
  assert.match(out.text, /RIGHTS_PUSH_NOT_RELEASE: refs\/heads\/main is closed/);
  assert.match(out.text, new RegExp(`no annotated tag ${TAG.replaceAll('.', String.raw`\.`)}`));
  assert.match(out.text, /no release record for exactly/);
  assert.match(out.text, new RegExp(`starci release cut --tag ${TAG.replaceAll('.', String.raw`\.`)}`));
  assert.equal(fx.remoteMain(), fx.before, 'main did not move');
});

test('the version must move past the remote main, and the CHANGELOG heading must be dated', (t) => {
  const fx = fixture(t);
  gitOk(fx.repo, ['commit', '-q', '--allow-empty', '-m', 'work']);
  const same = fx.push('main');
  assert.notEqual(same.status, 0);
  assert.match(same.text, new RegExp(`version ${OLD.replaceAll('.', String.raw`\.`)} is the version the remote main already carries`));
  commit(fx.repo, { version: NEXT, heading: 'in preparation', message: 'bump, undated' });
  const undated = fx.push('main');
  assert.notEqual(undated.status, 0);
  assert.match(undated.text, /CHANGELOG\.md/);
  assert.match(undated.text, /in preparation/);
  assert.equal(fx.remoteMain(), fx.before);
});

test('a release commit goes through with its tag: annotated tag, dated heading, version moved, and the record of exactly this commit with the root suite, the packages suites and the checks green', (t) => {
  const fx = fixture(t);
  const head = commit(fx.repo, { version: NEXT, message: 'release' });
  gitOk(fx.repo, ['tag', '-a', TAG, '-m', 'notes']);
  assert.equal(writeL4Record({ repo: fx.repo, head, tag: TAG, logs: greenRows() }).ok, true);
  assert.deepEqual(releaseFindings({ cwd: fx.repo, commit: head, remoteCommit: fx.before }), []);
  const out = fx.push('--atomic', 'main', `refs/tags/${TAG}`);
  assert.equal(out.status, 0, out.text);
  assert.equal(fx.remoteMain(), head);
  assert.equal(gitOk(fx.origin, ['cat-file', '-t', `refs/tags/${TAG}`]), 'tag');
});

test('the release record must be for the pushed commit and hold every required row green: a record for another sha, or without the packages suites, refuses', (t) => {
  const fx = fixture(t);
  const other = gitOk(fx.repo, ['rev-parse', 'HEAD']);
  const head = commit(fx.repo, { version: NEXT, message: 'release' });
  gitOk(fx.repo, ['tag', '-a', TAG, '-m', 'notes']);
  assert.equal(writeL4Record({ repo: fx.repo, head: other, tag: TAG, logs: greenRows() }).ok, true);
  assert.deepEqual(releaseFindings({ cwd: fx.repo, commit: head, remoteCommit: fx.before }).map((f) => f.code), ['RELEASE_RECEIPT_MISSING'], 'the receipt is for another sha');
  assert.notEqual(fx.push('--atomic', 'main', `refs/tags/${TAG}`).status, 0);
  assert.equal(writeL4Record({ repo: fx.repo, head, tag: TAG, logs: greenRows(['npm test', 'npm run check']) }).ok, true);
  const findings = releaseFindings({ cwd: fx.repo, commit: head, remoteCommit: fx.before });
  assert.deepEqual(findings.map((f) => f.code), ['RELEASE_RECEIPT_INCOMPLETE']);
  assert.match(findings[0].missing, /npm run test:packages/);
  const out = fx.push('--atomic', 'main', `refs/tags/${TAG}`);
  assert.notEqual(out.status, 0);
  assert.match(out.text, /npm run test:packages/);
  assert.equal(fx.remoteMain(), fx.before);
});

test('another branch and the backup namespace are not the hook\'s business', (t) => {
  const fx = fixture(t);
  commit(fx.repo, { version: NEXT, message: 'work on a lane' });
  const lane = fx.push('HEAD:refs/heads/lane/x');
  assert.equal(lane.status, 0, lane.text);
  assert.equal(fx.push('HEAD:refs/backup/lane-x').status, 0);
  assert.equal(fx.remoteMain(), fx.before, 'main did not move');
});

test('a v* tag without the release behind it is refused: lightweight, on a commit that is no release, or a tag that is not the version', (t) => {
  const fx = fixture(t);
  gitOk(fx.repo, ['commit', '-q', '--allow-empty', '-m', 'work']);
  gitOk(fx.repo, ['tag', '-a', 'v9.9.9', '-m', 'not a release']);
  const wrong = fx.push('refs/tags/v9.9.9');
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.text, /RIGHTS_PUSH_NOT_RELEASE: refs\/tags\/v9\.9\.9 is closed/);
  assert.match(wrong.text, new RegExp(`not ${'v9.9.9'.replaceAll('.', String.raw`\.`)}|is not v${OLD.replaceAll('.', String.raw`\.`)}`));
  gitOk(fx.repo, ['tag', 'v8.8.8']);
  const light = fx.push('refs/tags/v8.8.8');
  assert.notEqual(light.status, 0);
  assert.match(light.text, /annotated/);
  assert.equal(gitOk(fx.origin, ['tag', '-l']), '', 'no tag reached the remote');
});

test('a push that is not a fast-forward of main and the deletion of main are refused; a tag that is not a release tag passes', (t) => {
  const fx = fixture(t);
  commit(fx.repo, { version: NEXT, message: 'release' });
  gitOk(fx.repo, ['tag', '-a', TAG, '-m', 'notes']);
  assert.equal(writeL4Record({ repo: fx.repo, head: gitOk(fx.repo, ['rev-parse', 'HEAD']), tag: TAG, logs: greenRows() }).ok, true);
  assert.equal(fx.push('--atomic', 'main', `refs/tags/${TAG}`).status, 0);
  gitOk(fx.repo, ['checkout', '-q', '-B', 'rewound', 'HEAD~1']);
  gitOk(fx.repo, ['commit', '-q', '--allow-empty', '-m', 'divergent']);
  const rewrite = fx.push('--force', 'rewound:main');
  assert.notEqual(rewrite.status, 0);
  assert.match(rewrite.text, /not a fast-forward/);
  const removal = fx.push(':main');
  assert.notEqual(removal.status, 0);
  assert.match(removal.text, /never deletes the runtime main/);
  gitOk(fx.repo, ['tag', '-a', 'preserve/x', '-m', 'housekeeping']);
  assert.equal(fx.push('refs/tags/preserve/x').status, 0);
});

test('versionAt reads the manifest of a commit and nothing else', (t) => {
  const fx = fixture(t);
  assert.equal(versionAt(fx.repo, 'HEAD'), OLD);
  assert.equal(versionAt(fx.repo, 'HEAD~5'), null);
});
