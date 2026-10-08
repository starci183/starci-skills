// release-suite-gate.spec.mjs - the suite mode of a release (config.yaml release.suite, scripts/guards/release-suite-mode.mjs) and what the pre-push gate
// (scripts/guards/release-definition.mjs) requires in each mode. The owner's choice of 2026-10-09 (owner-rulings release-suite-ci): under `ci` the gate accepts a release record
// without a local `npm test` row, but only when the record says `suite: ci` AND the checked-out config says `ci`; a record never claims the mode by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installGitHooks } from '../../scripts/guards/git-hooks.mjs';
import { RECEIPT_STEPS, RECEIPT_STEPS_CI, releaseFindings } from '../../scripts/guards/release-definition.mjs';
import { l4RecordPath, writeL4Record } from '../../scripts/guards/release-record.mjs';
import { suiteModeOf } from '../../scripts/guards/release-suite-mode.mjs';
import { validateConfig } from '../../engine/config.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_PREFIX']) delete process.env[key];

const OLD = '1.0.0-alpha.3';
const NEXT = '1.0.0-alpha.4';
const TAG = `v${NEXT}`;
const OWNER = (suite) => `language: en\nmodel: null\neffort: medium\nrelease: {suite: ${suite}}\n`;
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const gitOk = (cwd, args) => { const r = git(cwd, args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const rows = (names, extra = {}) => names.map((name) => ({ name, ok: true, log: `${name}.log`, ms: 1, ...extra }));
const DELEGATED = [{ name: 'npm test', why: 'delegated to CI' }, { name: 'linux-parity', why: 'delegated to CI' }];

/** A work repository with the previous release on a bare origin and a release commit with its annotated tag on top. */
function fixture(t, { config = null } = {}) {
  const base = mkdtemp(t, 'starci-release-suite-gate-');
  const origin = path.join(base, 'origin.git');
  const repo = path.join(base, 'work');
  gitOk(base, ['init', '-q', '--bare', '-b', 'main', origin]);
  gitOk(base, ['clone', '-q', origin, repo]);
  for (const args of [['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false'], ['config', 'tag.gpgsign', 'false'], ['config', 'core.autocrlf', 'false'], ['checkout', '-q', '-b', 'main']]) gitOk(repo, args);
  const commit = (version, changelog, message) => {
    fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'rt', version })}\n`);
    fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), changelog);
    gitOk(repo, ['add', '-A']);
    gitOk(repo, ['commit', '-q', '-m', message]);
  };
  commit(OLD, `# Changelog\n\n## [${OLD}] — 2026-09-30\n\n- older\n`, 'previous release');
  gitOk(repo, ['push', '-q', 'origin', 'main']);
  commit(NEXT, `# Changelog\n\n## [${NEXT}] — 2026-10-09\n\n- the release\n\n## [${OLD}] — 2026-09-30\n\n- older\n`, 'release');
  gitOk(repo, ['tag', '-a', TAG, '-m', 'notes']);
  if (config) fs.writeFileSync(path.join(repo, 'config.yaml'), config);
  const head = gitOk(repo, ['rev-parse', 'HEAD']);
  const remote = gitOk(origin, ['rev-parse', 'refs/heads/main']);
  const findings = () => releaseFindings({ cwd: repo, commit: head, remoteCommit: remote });
  return { base, origin, repo, head, remote, findings, codes: () => findings().map((f) => f.code) };
}

test('release.suite is local by default, ci or local when the owner sets it, and "none" or any other value is refused naming the fix', (t) => {
  const dir = mkdtemp(t, 'starci-release-suite-mode-');
  assert.equal(suiteModeOf(dir), 'local', 'no owner file');
  fs.writeFileSync(path.join(dir, 'config.yaml'), OWNER('ci'));
  assert.equal(suiteModeOf(dir), 'ci');
  fs.writeFileSync(path.join(dir, 'config.yaml'), OWNER('local'));
  assert.equal(suiteModeOf(dir), 'local');
  fs.writeFileSync(path.join(dir, 'config.yaml'), 'language: en\nmodel: null\neffort: medium\nrelease: {}\n');
  assert.equal(suiteModeOf(dir), 'local', 'an absent key is the default');
  fs.writeFileSync(path.join(dir, 'config.yaml'), OWNER('none'));
  assert.equal(suiteModeOf(dir), 'local', 'an invalid owner file reads as the stricter mode');
  const base = { language: 'en', model: null, effort: 'medium' };
  assert.throws(() => validateConfig({ ...base, release: { suite: 'none' } }), /release\.suite: "none" is not a mode: write "ci"/);
  assert.throws(() => validateConfig({ ...base, release: { suite: 'sometimes' } }), /release\.suite must be local or ci/);
  assert.throws(() => validateConfig({ ...base, release: { full: 'ci' } }), /release has unknown key full/);
  assert.throws(() => validateConfig({ ...base, release: 'ci' }), /release must be/);
  assert.doesNotThrow(() => validateConfig({ ...base, release: null }));
  assert.doesNotThrow(() => validateConfig({ ...base, release: { suite: null } }));
});

test('suite local: the gate wants npm test, test:packages and check RUN on the commit; a record cannot drop the root suite', (t) => {
  const fx = fixture(t);
  assert.deepEqual(RECEIPT_STEPS, ['npm test', 'npm run test:packages', 'npm run check']);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs: rows(RECEIPT_STEPS) }).ok, true);
  assert.deepEqual(fx.findings(), []);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs: rows(RECEIPT_STEPS_CI) }).ok, true);
  assert.deepEqual(fx.codes(), ['RELEASE_RECEIPT_INCOMPLETE'], 'a local record without npm test refuses');
});

test('suite ci: a record that says ci while the checked-out config says ci is accepted without npm test, and still wants test:packages and check run on the commit', (t) => {
  const fx = fixture(t, { config: OWNER('ci') });
  const write = (logs, delegated = DELEGATED) => writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs, suite: 'ci', delegated });
  assert.deepEqual(RECEIPT_STEPS_CI, ['npm run test:packages', 'npm run check']);
  assert.equal(write(rows([...RECEIPT_STEPS_CI, 'affected tests'])).ok, true);
  assert.deepEqual(fx.findings(), []);
  assert.equal(write(rows(['npm run check'])).ok, true);
  assert.deepEqual(fx.codes(), ['RELEASE_RECEIPT_INCOMPLETE'], 'test:packages missing');
  assert.equal(write([...rows(['npm run test:packages']), ...rows(['npm run check'], { reusedFrom: 'a'.repeat(40) })]).ok, true);
  assert.deepEqual(fx.codes(), ['RELEASE_RECEIPT_INCOMPLETE'], 'check reused from another commit does not count');
});

test('a record that claims ci while the checked-out config says local, or is absent or invalid, is refused: a record does not choose the mode', (t) => {
  for (const config of [null, OWNER('local'), OWNER('none')]) {
    const fx = fixture(t, { config });
    assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs: rows(RECEIPT_STEPS_CI), suite: 'ci', delegated: DELEGATED }).ok, true);
    assert.deepEqual(fx.codes(), ['RELEASE_SUITE_MODE'], String(config));
    assert.match(fx.findings()[0].missing, /says suite: ci, but this checkout's config\.yaml release\.suite is not ci/);
  }
});

test('a ci record must list the root suite as delegated; a local record delegates nothing; neither mode is written otherwise', (t) => {
  const fx = fixture(t, { config: OWNER('ci') });
  const logs = rows(RECEIPT_STEPS_CI);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs, suite: 'ci', delegated: [] }).ok, false);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs: rows(RECEIPT_STEPS), suite: 'local', delegated: DELEGATED }).ok, false);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs, suite: 'sometimes' }).ok, false);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs, suite: 'ci', delegated: [{ name: 'linux-parity', why: 'delegated to CI' }] }).ok, true);
  assert.deepEqual(fx.codes(), ['RELEASE_SUITE_MODE'], 'the record does not name npm test as delegated');
});

test('config ci with a local record: the stricter record is accepted when it holds npm test, refused when it does not; an old record with no suite field is local', (t) => {
  const fx = fixture(t, { config: OWNER('ci') });
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs: rows(RECEIPT_STEPS) }).ok, true);
  assert.deepEqual(fx.findings(), []);
  const file = l4RecordPath({ commonDir: path.join(fx.repo, '.git'), head: fx.head });
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete record.suite;
  delete record.delegated;
  record.logs = rows(RECEIPT_STEPS_CI);
  fs.writeFileSync(file, JSON.stringify(record));
  assert.deepEqual(fx.codes(), ['RELEASE_RECEIPT_INCOMPLETE']);
});

test('through the real pre-push hook: the ci release goes through only while the config says ci, and the refusal names the mode', (t) => {
  const fx = fixture(t, { config: OWNER('ci') });
  assert.equal(installGitHooks({ root: fx.repo }).ok, true);
  assert.equal(writeL4Record({ repo: fx.repo, head: fx.head, tag: TAG, logs: rows(RECEIPT_STEPS_CI), suite: 'ci', delegated: DELEGATED }).ok, true);
  fs.writeFileSync(path.join(fx.repo, 'config.yaml'), OWNER('local'));
  const refused = git(fx.repo, ['push', '--atomic', 'origin', 'main', `refs/tags/${TAG}`]);
  assert.notEqual(refused.status, 0);
  assert.match(`${refused.stderr}${refused.stdout}`, /RELEASE_SUITE_MODE|says suite: ci, but this checkout's config\.yaml release\.suite is not ci/);
  assert.equal(gitOk(fx.origin, ['rev-parse', 'refs/heads/main']), fx.remote, 'main did not move');
  fs.writeFileSync(path.join(fx.repo, 'config.yaml'), OWNER('ci'));
  const passed = git(fx.repo, ['push', '--atomic', 'origin', 'main', `refs/tags/${TAG}`]);
  assert.equal(passed.status, 0, `${passed.stderr}${passed.stdout}`);
  assert.equal(gitOk(fx.origin, ['rev-parse', 'refs/heads/main']), fx.head);
});
