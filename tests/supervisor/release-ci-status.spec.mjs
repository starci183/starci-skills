// release-ci-status.spec.mjs - `starci release ci-status` (scripts/supervisor/release-ci-status.mjs): the verdict of the GitHub ci workflow of a release, read through a fake GitHub (the gh wrappers
// of scripts/api/gh are the seam), left beside the release record, recorded once as a runtime defect when it is red after a `suite: ci` release, and shown by the digest and the reconciler preflight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeL4Record } from '../../scripts/guards/release-record.mjs';
import { ciLine, ciReader, ciStatus, latestCiRecord, readCiRecord, verdictOf, writeCiRecord } from '../../scripts/supervisor/release-ci-status.mjs';
import { main, parseArgs } from '../../scripts/supervisor/release-ci-status-cli.mjs';
import { releaseCiItems } from '../../scripts/reconciler/release-ci-item.mjs';
import { renderText } from '../../scripts/reconciler/debug-digest-render.mjs';
import { digest, snapshot } from '../helpers/debug-digest-fixture.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const TAG = 'v1.0.0-alpha.4';
const PATTERNS = ['codecov', 'sonar'];
const run = (status, conclusion, extra = {}) => ({ id: 7, status, conclusion, event: 'push', url: 'https://github.com/o/r/actions/runs/7', ...extra });

/** A repository whose HEAD carries the release tag and a release record of the given suite mode. */
function release(t, suite = 'ci') {
  const repo = mkdtemp(t, 'starci-ci-status-');
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec']]) git(repo, 'config', k, v);
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'release');
  git(repo, 'tag', '-a', TAG, '-m', 'notes');
  const head = git(repo, 'rev-parse', 'HEAD');
  const logs = [{ name: 'npm run check', ok: true, log: 'x', ms: 1 }];
  const delegated = suite === 'ci' ? [{ name: 'npm test', why: 'delegated to CI' }] : [];
  assert.equal(writeL4Record({ repo, head, tag: TAG, logs, suite, delegated }).ok, true);
  return { repo, head };
}
const reading = (...answers) => {
  const left = [...answers];
  return () => {
    const next = left.length > 1 ? left.shift() : left[0];
    return { ok: true, runs: next.runs, checks: next.checks ?? [] };
  };
};
const spawned = (value) => ({ status: 0, stdout: JSON.stringify(value) });

test('the verdict: no run is pending, an unfinished run is running, a failed run or a failed Codecov or Sonar check is red, a cancelled run is no verdict', () => {
  const v = (runs, checks = []) => verdictOf({ runs, checks, patterns: PATTERNS });
  assert.equal(v([]), 'pending');
  assert.equal(v([run('in_progress', null)]), 'running');
  assert.equal(v([run('completed', 'success')]), 'green');
  assert.equal(v([run('completed', 'failure')]), 'red');
  assert.equal(v([run('completed', 'cancelled'), run('completed', 'success')]), 'green');
  assert.equal(v([run('completed', 'cancelled')]), 'pending');
  assert.equal(v([run('completed', 'success')], [{ name: 'codecov/patch', state: 'failure' }]), 'red');
  assert.equal(v([run('completed', 'success')], [{ name: 'SonarCloud Code Analysis', state: 'pending' }]), 'running');
  assert.equal(v([run('completed', 'success')], [{ name: 'lint', state: 'failure' }]), 'green', 'only the Codecov and Sonar checks are read');
});

test('the reader asks GitHub through the gh wrappers and maps runs, check runs and statuses; a failed gh call is an error, not a verdict', () => {
  const calls = [];
  const deps = {
    workflowRuns: (args) => { calls.push(['run list', args]); return spawned([{ databaseId: 9, status: 'completed', conclusion: 'success', event: 'push', url: 'u' }]); },
    commitChecks: ({ part }) => (part === 'check-runs'
      ? spawned({ check_runs: [{ name: 'SonarCloud', status: 'completed', conclusion: 'success' }, { name: 'x', status: 'queued', conclusion: null }] })
      : spawned({ statuses: [{ context: 'codecov/project', state: 'failure' }] })),
  };
  const seen = ciReader({ cwd: '.', workflow: 'ci', sha: 'abc', deps });
  assert.deepEqual(calls, [['run list', { workflow: 'ci', sha: 'abc' }]]);
  assert.deepEqual(seen.runs, [{ id: 9, status: 'completed', conclusion: 'success', event: 'push', url: 'u' }]);
  assert.deepEqual(seen.checks, [{ name: 'SonarCloud', state: 'success' }, { name: 'x', state: 'pending' }, { name: 'codecov/project', state: 'failure' }]);
  const failed = ciReader({ cwd: '.', workflow: 'ci', sha: 'abc', deps: { ...deps, workflowRuns: () => ({ status: 1, stdout: '', stderr: 'gh: not logged in' }) } });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /gh run list: gh: not logged in/);
});

test('green: exit 0, the state is left beside the release record; the digest line and the preflight row show it', async (t) => {
  const fx = release(t);
  const out = await ciStatus({ repo: fx.repo, deps: { read: reading({ runs: [run('completed', 'success')] }) } });
  assert.deepEqual([out.ok, out.code, out.verdict, out.tag], [true, 0, 'green', TAG]);
  const record = readCiRecord({ repo: fx.repo, head: fx.head });
  assert.deepEqual([record.state, record.suite], ['green', 'ci']);
  assert.equal(ciLine(latestCiRecord({ repo: fx.repo })), `${TAG} green (suite: ci)`);
  assert.deepEqual(releaseCiItems({ repo: fx.repo }).map((i) => [i.status, i.required]), [['green', false]]);
});

test('red after a suite ci release is recorded once as runtime-defect:release-ci-red-<tag> for Debug; after a suite local release it is reported and not recorded', async (t) => {
  const fx = release(t, 'ci');
  const recorded = [];
  const deps = { read: reading({ runs: [run('completed', 'failure')] }), recordDefect: (entry) => { recorded.push(entry); return { ok: true }; } };
  const first = await ciStatus({ repo: fx.repo, deps });
  assert.deepEqual([first.code, first.verdict, first.defect], [1, 'red', `runtime-defect:release-ci-red-${TAG}`]);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].item, `runtime-defect:release-ci-red-${TAG}`);
  assert.match(recorded[0].reason, /fix forward with the next pre-release/);
  assert.match(recorded[0].refs, /actions\/runs\/7/);
  await ciStatus({ repo: fx.repo, deps });
  assert.equal(recorded.length, 1, 'the defect is recorded once');
  const item = releaseCiItems({ repo: fx.repo })[0];
  assert.deepEqual([item.status, item.required], ['warn', false]);
  assert.match(item.fix, /release ci-status/);
  const local = release(t, 'local');
  const none = [];
  const second = await ciStatus({ repo: local.repo, deps: { read: reading({ runs: [run('completed', 'failure')] }), recordDefect: (entry) => { none.push(entry); return { ok: true }; } } });
  assert.deepEqual([second.code, second.verdict, second.defect], [1, 'red', undefined]);
  assert.equal(none.length, 0);
});

test('--wait polls until the run ends; a run still going at the deadline and a GitHub that cannot be read are exit 3, never a verdict', async (t) => {
  const fx = release(t);
  let clock = 0;
  const slept = [];
  const deps = { read: reading({ runs: [] }, { runs: [run('in_progress', null)] }, { runs: [run('completed', 'success')] }), sleep: async (ms) => { slept.push(ms); clock += ms; }, now: () => clock };
  const out = await ciStatus({ repo: fx.repo, wait: true, deps });
  assert.deepEqual([out.code, out.verdict, slept.length], [0, 'green', 2]);
  const waiting = await ciStatus({ repo: fx.repo, deps: { read: reading({ runs: [run('in_progress', null)] }) } });
  assert.deepEqual([waiting.code, waiting.verdict], [3, 'running']);
  clock = 0;
  const late = await ciStatus({ repo: fx.repo, wait: true, deps: { read: reading({ runs: [run('in_progress', null)] }), sleep: async (ms) => { clock += ms * 1000; }, now: () => clock } });
  assert.deepEqual([late.code, late.verdict], [3, 'running']);
  const unreadable = await ciStatus({ repo: fx.repo, deps: { read: () => ({ ok: false, error: 'gh run list: not logged in', runs: [], checks: [] }) } });
  assert.deepEqual([unreadable.code, unreadable.verdict], [3, 'unknown']);
  assert.match(unreadable.why, /not a verdict/);
  assert.equal((await ciStatus({ repo: mkdtemp(t, 'starci-ci-status-empty-') })).code, 3, 'no release tag, no read');
});

test('the digest shows the last release CI and the preflight stays quiet when no release was cut', (t) => {
  const analysed = digest(snapshot({ releaseCi: `${TAG} red (suite: ci)` }));
  assert.match(renderText(analysed, { language: 'en' }), /Last release CI: v1\.0\.0-alpha\.4 red \(suite: ci\)/);
  assert.deepEqual(releaseCiItems({ repo: mkdtemp(t, 'starci-ci-item-') }), []);
  const dir = mkdtemp(t, 'starci-ci-record-');
  assert.equal(writeCiRecord({ repo: dir, head: 'a'.repeat(40), tag: TAG, suite: 'ci', state: 'pending', commonDir: dir }).ok, true);
  assert.equal(latestCiRecord({ repo: dir, commonDir: dir }).state, 'pending');
});

test('the verb parses its flags and exits 0 green, 1 red, 3 unfinished, 2 on bad usage', async () => {
  assert.deepEqual(parseArgs(['--tag', TAG, '--wait', '--json']), { json: true, wait: true, tag: TAG });
  assert.throws(() => parseArgs(['--bogus']), /unknown argument --bogus/);
  const out = [];
  const exit = async (code, verdict) => main(['--json'], { stdout: (text) => out.push(text), ciStatus: async () => ({ code, verdict, why: 'x' }) });
  assert.deepEqual([await exit(0, 'green'), await exit(1, 'red'), await exit(3, 'running')], [0, 1, 3]);
  assert.equal(await main(['--tag'], { stderr: () => {} }), 2);
});
