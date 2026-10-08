// release-suite-ci.spec.mjs - the release cut under config.yaml release.suite (owner ruling release-suite-ci, 2026-10-09): `local` is today's cut; `ci` plans no root suite and no Linux parity row,
// runs the checks, the packages suites, the affected specs of the release range and the live Orca smokes, lists the rest as delegated in the plan and the record, and leaves a pending CI record.
// The affected row is checked on a real temporary repository with a fake spec runner; GitHub is a fake reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cutRelease } from '../../scripts/supervisor/release-cut.mjs';
import { planL4 } from '../../scripts/supervisor/release-l4.mjs';
import { selectionFor, decisionLines } from '../../scripts/supervisor/release-cut-rows.mjs';
import { affectedRowExtras, ciPlan, ciPolicy, ciSettings } from '../../scripts/supervisor/release-ci-rows.mjs';
import { affectedRelease, rangeBase } from '../../scripts/supervisor/release-affected.mjs';
import { readAffectedLedger } from '../../scripts/supervisor/release-affected-ledger.mjs';
import { readL4Record } from '../../scripts/guards/release-record.mjs';
import { readCiRecord } from '../../scripts/supervisor/release-ci-status.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const TAG = 'v1.0.0-alpha.4';
const CHANGELOG = '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- shipped: the release notes\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n';
const row = (name, extra = {}) => ({ name, ok: true, log: `${name}.log`, ms: 1, skips: [], ...extra });

function runtimeCheckout(t) {
  const base = mkdtemp(t, 'starci-suite-ci-plan-');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: 'node --test tests/a.spec.mjs', check: 'x' } }));
  return base;
}

/** The cut fixture of release-cut.spec.mjs: a work repo with the release commit and a bare origin that holds the previous release. */
function cutFixture(t) {
  const base = mkdtemp(t, 'starci-suite-ci-cut-');
  const origin = path.join(base, 'origin.git'), repo = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(base, 'clone', '-q', origin, repo);
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  git(repo, 'checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'rt', version: '1.0.0-alpha.3' })}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'previous release');
  git(repo, 'push', '-q', 'origin', 'main');
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), CHANGELOG);
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'rt', version: '1.0.0-alpha.4' })}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'release commit');
  const deps = { host: () => [], scan: () => ({ ok: true, findings: [] }), lock: (work) => work(), sonarCloud: async () => [], publishPlan: () => ({ blockers: [], toPublish: [] }), jsonExceptions: () => ({ offenders: [], missingAllowlist: [] }) };
  return { repo, origin, deps };
}

test('suite local is today\'s plan: the root suite and the Linux container are rows, nothing is delegated', (t) => {
  const base = runtimeCheckout(t);
  const plan = planL4(base, { runtimeRoot: base });
  assert.equal(plan.mode, 'local');
  assert.deepEqual(plan.delegated, []);
  assert.deepEqual(plan.steps.filter((s) => s.name.startsWith('npm ')).map((s) => s.name), ['npm test', 'npm run test:packages', 'npm run check']);
  assert.equal(plan.linux, true);
  const selection = selectionFor({ repo: base, head: 'a'.repeat(40), rows: null, reuse: true, deps: { runtimeRoot: base, treeEntries: () => null, ledgers: () => [] } });
  assert.ok(selection.names.includes('linux-parity'));
  assert.equal(decisionLines(selection).some((line) => line.action === 'delegated'), false);
});

test('suite ci plans no root suite and no Linux row; it plans checks, packages, the affected specs and the live Orca smokes, and names the delegated rows with the reason', (t) => {
  const base = runtimeCheckout(t);
  const plan = planL4(base, { runtimeRoot: base, mode: 'ci' });
  const policy = ciPolicy();
  assert.equal(plan.mode, 'ci');
  assert.equal(plan.linux, false);
  assert.deepEqual(plan.steps.map((s) => s.name), ['npm run test:packages', 'npm run check', policy.affected.row, policy.orca.row]);
  assert.deepEqual(plan.delegated, [{ name: 'npm test', why: 'delegated to CI' }, { name: 'linux-parity', why: 'delegated to CI' }]);
  const orca = plan.steps.find((s) => s.name === policy.orca.row);
  assert.deepEqual(orca.args.filter((arg) => arg.endsWith('.spec.mjs') && !arg.startsWith('./')), ['tests/api-orca/orca-settle-live.spec.mjs', 'tests/api-orca/orca-worktree-rm-live.spec.mjs']);
  assert.equal(orca.env.STARCI_REQUIRE_ORCA_LIVE, '1', 'the live smokes run with the L4 env');
  assert.ok(plan.steps.find((s) => s.name === policy.affected.row).affected);
  assert.equal(ciSettings(plan, { appsAfter: 'npm test' }).appsAfter, 'npm run check', 'the apps do not wait for a suite that is not planned');
  assert.equal(ciSettings({ mode: 'local' }, { appsAfter: 'npm test' }).appsAfter, 'npm test');
  const selection = selectionFor({ repo: base, head: 'a'.repeat(40), rows: null, reuse: true, mode: 'ci', deps: { runtimeRoot: base, treeEntries: () => null, ledgers: () => [] } });
  assert.equal(selection.names.includes('linux-parity'), false);
  assert.equal(selection.names.includes('npm test'), false);
  assert.deepEqual(decisionLines(selection).filter((line) => line.action === 'delegated').map((line) => [line.name, line.why]), [['npm test', 'delegated to CI'], ['linux-parity', 'delegated to CI']]);
  assert.deepEqual(ciPlan({ plan: { steps: [], proofs: [], linux: true }, repo: base, env: {} }).steps.map((s) => s.name), [policy.affected.row, policy.orca.row]);
});

test('--plan of a ci cut shows the mode, the delegated rows and the narrower receipt; a local cut shows the full receipt', async (t) => {
  const fx = cutFixture(t);
  const ci = await cutRelease({ repo: fx.repo, tag: TAG, plan: true, deps: { ...fx.deps, suiteMode: () => 'ci' } });
  assert.deepEqual([ci.ok, ci.verdict, ci.suiteMode], [true, 'plan', 'ci'], JSON.stringify(ci));
  assert.deepEqual(ci.receiptSteps, ['npm run test:packages', 'npm run check']);
  assert.deepEqual(ci.rows.filter((r) => r.action === 'delegated').map((r) => r.name), ['npm test', 'linux-parity']);
  assert.match(ci.why, /suite: ci/);
  assert.match(ci.why, /npm test: delegated to CI/);
  const local = await cutRelease({ repo: fx.repo, tag: TAG, plan: true, deps: { ...fx.deps, suiteMode: () => 'local' } });
  assert.deepEqual(local.receiptSteps, ['npm test', 'npm run test:packages', 'npm run check']);
  assert.equal(local.suiteMode, 'local');
  assert.ok(local.steps.includes('linux-parity'));
});

test('a ci cut records suite ci with the delegated rows (never green), pushes, leaves a pending CI record and prints the command that reads the verdict', async (t) => {
  const fx = cutFixture(t);
  const suite = () => [row('npm run test:packages'), row('npm run check'), row('affected tests', { selection: { mode: 'range', fail: 0 } }), row('orca live smokes')];
  const out = await cutRelease({ repo: fx.repo, tag: TAG, deps: { ...fx.deps, suite, suiteMode: () => 'ci' } });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.suiteMode, 'ci');
  assert.equal(out.ciWatch, `starci release ci-status --tag ${TAG} --wait`);
  assert.match(out.why, /the full suite now runs only on GitHub/);
  const head = git(fx.repo, 'rev-parse', 'HEAD');
  const record = readL4Record({ repo: fx.repo, head, tag: TAG });
  assert.equal(record.suite, 'ci');
  assert.deepEqual(record.delegated.map((d) => d.name), ['npm test', 'linux-parity']);
  assert.equal(record.logs.some((r) => r.name === 'npm test'), false, 'a delegated row is not a green row');
  assert.deepEqual(readCiRecord({ repo: fx.repo, head }).state, 'pending');
});

test('a red affected row refuses the ci cut and pushes nothing', async (t) => {
  const fx = cutFixture(t);
  const suite = () => [row('npm run test:packages'), row('npm run check'), row('affected tests', { ok: false })];
  const out = await cutRelease({ repo: fx.repo, tag: TAG, deps: { ...fx.deps, suite, suiteMode: () => 'ci' } });
  assert.deepEqual([out.ok, out.verdict], [false, 'suite-red']);
  assert.match(out.why, /affected tests red/);
});

test('affectedRowExtras reads the summary line the affected script prints and holds no skips', () => {
  const summary = { mode: 'per-commit', run: 3, reused: 2, pass: 3, fail: 0 };
  assert.deepEqual(affectedRowExtras(`PASS x\naffected: ...\nRELEASE_AFFECTED ${JSON.stringify(summary)}\n`), { skips: [], selection: summary });
  assert.deepEqual(affectedRowExtras('nothing'), { skips: [], selection: null });
});

/** A repository with a release tag and three commits after it, each touching one source whose spec imports it; the spec runner is a fake. */
function rangeFixture(t) {
  const repo = mkdtemp(t, 'starci-suite-ci-range-');
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  fs.mkdirSync(path.join(repo, 'src'));
  fs.mkdirSync(path.join(repo, 'tests'));
  for (const name of ['a', 'b', 'c']) {
    fs.writeFileSync(path.join(repo, 'src', `${name}.mjs`), `export const ${name} = 0;\n`);
    fs.writeFileSync(path.join(repo, 'tests', `${name}.spec.mjs`), `import { ${name} } from '../src/${name}.mjs';\nexport default ${name};\n`);
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'tag', '-a', 'v1.0.0-alpha.3', '-m', 'previous');
  const shas = ['a', 'b', 'c'].map((name) => {
    fs.writeFileSync(path.join(repo, 'src', `${name}.mjs`), `export const ${name} = 1;\n`);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', `change ${name}`);
    return git(repo, 'rev-parse', 'HEAD');
  });
  const ran = [], state = { red: [] };
  const deps = { sources: [], progress: () => {}, runSpecFile: async (root, file) => { ran.push(file); return { file, pass: !state.red.includes(file), ms: 1, tail: [] }; }, hostSample: () => ({ logicalThreads: 8, freeMemGiB: 32 }) };
  return { repo, shas, ran, deps, state };
}

test('the release range within the verb\'s bound runs its affected set once; the base is the newest release tag not on HEAD', async (t) => {
  const fx = rangeFixture(t);
  assert.equal(rangeBase(fx.repo), 'v1.0.0-alpha.3');
  const { code, summary } = await affectedRelease({ root: fx.repo, deps: { ...fx.deps, testAffected: async () => ({ code: 0, data: { over: false, scope: ['tests/a.spec.mjs', 'tests/b.spec.mjs'], maxFiles: 10 } }) } });
  assert.equal(code, 0);
  assert.deepEqual([summary.mode, summary.run, summary.pass, summary.fail, summary.bound], ['range', 2, 2, 0, 10]);
  assert.deepEqual(fx.ran.sort(), ['tests/a.spec.mjs', 'tests/b.spec.mjs']);
});

test('a range over the bound runs the affected set per commit, reuses a commit whose set passed in an earlier cut, and lists what it could not cover', async (t) => {
  const fx = rangeFixture(t);
  const whole = ['tests/a.spec.mjs', 'tests/b.spec.mjs', 'tests/c.spec.mjs', 'tests/extra.spec.mjs'];
  const deps = { ...fx.deps, testAffected: async () => ({ code: 0, data: { over: true, scope: whole, maxFiles: 1 } }), policy: { maxCommits: 80, maxRunFiles: 400 } };
  const first = await affectedRelease({ root: fx.repo, deps });
  assert.equal(first.code, 0);
  assert.deepEqual([first.summary.mode, first.summary.commits.ran, first.summary.commits.reused, first.summary.commits.notCovered], ['per-commit', 3, 0, 0], JSON.stringify(first.summary));
  assert.deepEqual(fx.ran.sort(), ['tests/a.spec.mjs', 'tests/b.spec.mjs', 'tests/c.spec.mjs']);
  assert.deepEqual(first.summary.notRun, ['tests/extra.spec.mjs'], 'a spec of the range no commit selected is reported as not run locally');
  assert.deepEqual(readAffectedLedger({ repo: fx.repo, commit: fx.shas[0] }), ['tests/a.spec.mjs']);
  assert.ok(first.summary.report && fs.existsSync(first.summary.report), 'the full report is written');
  fx.ran.length = 0;
  const second = await affectedRelease({ root: fx.repo, deps });
  assert.deepEqual([second.summary.commits.ran, second.summary.commits.reused, second.summary.run, second.summary.reused, fx.ran.length], [0, 3, 0, 3, 0], 'commits with a ledger are not run again');
  const narrow = await affectedRelease({ root: fx.repo, deps: { ...deps, policy: { maxCommits: 1, maxRunFiles: 400 } } });
  assert.equal(narrow.summary.commits.notCovered, 2);
  assert.match(narrow.summary.notCovered[0].reason, /past maxCommits 1/);
});

test('a red affected spec is a red row and its commit leaves no ledger; a range with no earlier release tag has no start and fails', async (t) => {
  const fx = rangeFixture(t);
  fx.state.red = ['tests/b.spec.mjs'];
  const deps = { ...fx.deps, testAffected: async () => ({ code: 0, data: { over: true, scope: ['tests/a.spec.mjs', 'tests/b.spec.mjs', 'tests/c.spec.mjs'], maxFiles: 1 } }), policy: { maxCommits: 80, maxRunFiles: 400 } };
  const { code, summary } = await affectedRelease({ root: fx.repo, deps });
  assert.equal(code, 1);
  assert.equal(summary.fail, 1);
  assert.equal(readAffectedLedger({ repo: fx.repo, commit: fx.shas[1] }), null);
  assert.deepEqual(readAffectedLedger({ repo: fx.repo, commit: fx.shas[0] }), ['tests/a.spec.mjs']);
  const bare = mkdtemp(t, 'starci-suite-ci-notag-');
  git(bare, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec']]) git(bare, 'config', k, v);
  git(bare, 'commit', '-q', '--allow-empty', '-m', 'only');
  const none = await affectedRelease({ root: bare, deps: fx.deps });
  assert.deepEqual([none.code, none.summary.mode], [1, 'no-base']);
});
