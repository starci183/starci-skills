// release-cut.spec.mjs - the release flow (scripts/supervisor/release-cut.mjs) and its L4 row (release-l4.mjs): the only push of main, main and its annotated release tag
// together. A temp bare repository stands in for the remote; the L4 steps and the secret scan are stand-ins (the real L4 runs once, at the release).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cutRelease, pushRefusal } from '../../scripts/supervisor/release-cut.mjs';
import { push } from '../../scripts/api/git/push.mjs';
import { renderRuntimeHooks } from '../../scripts/guards/git-hooks.mjs';
import { gitCommonDir, l4RecordPath, readL4Record, writeL4Record } from '../../scripts/guards/release-record.mjs';
import { classifySkip, planL4, runL4, skipReport, skipsOf } from '../../scripts/supervisor/release-l4.mjs';
import { releaseHostMissing } from '../../scripts/supervisor/release-host.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const TAG = 'v1.0.0-alpha.4';
const CHANGELOG = '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- shipped: the release notes\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n';
const step = (name, extra = {}) => ({ name, ok: true, log: `${name}.log`, ms: 1, skips: [], ...extra });
const green = () => [step('npm test'), step('npm run test:packages'), step('npm run check')];
const scanOk = () => ({ ok: true, findings: [] });

/** A work repo on main with a release commit (CHANGELOG), pushed to a bare "origin" that has the previous release's main. */
function fixture(t, { changelog = CHANGELOG, version = '1.0.0-alpha.4' } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-cut-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const origin = path.join(base, 'origin.git'), repo = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(base, 'clone', '-q', origin, repo);
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  git(repo, 'checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'rt', version: '1.0.0-alpha.3' })}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'previous release');
  git(repo, 'push', '-q', 'origin', 'main');
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), changelog);
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'rt', version })}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'release commit');
  const remoteMain = () => git(origin, 'rev-parse', 'refs/heads/main');
  const remoteTags = () => git(origin, 'tag', '-l').split(/\r?\n/).filter(Boolean);
  return { base, origin, repo, remoteMain, remoteTags, before: remoteMain(), deps: { host: () => [], suite: green, scan: scanOk, lock: (work) => work(), sonarCloud: async () => [], publishPlan: () => ({ blockers: [], toPublish: [] }) } };
}
const cut = (fx, extra = {}, deps = {}) => cutRelease({ repo: fx.repo, tag: TAG, ...extra, deps: { ...fx.deps, ...deps } });
const untouched = (fx) => { assert.equal(fx.remoteMain(), fx.before, 'main did not move'); assert.deepEqual(fx.remoteTags(), [], 'no tag was pushed'); };

test('pushRefusal: main plus exactly one release tag is the only push; any other ref, a second tag or a tagless push is refused', () => {
  assert.equal(pushRefusal({ refs: ['main', 'refs/tags/v1.0.0'] }), null);
  assert.match(pushRefusal({ refs: ['main', 'refs/tags/preserve/old'] }), /only main and a release tag/);
  assert.match(pushRefusal({ refs: ['main', 'refs/tags/pre-1.0.4-merge'] }), /only main and a release tag/);
  assert.match(pushRefusal({ refs: ['feature', 'refs/tags/v1.0.0'] }), /only main and a release tag/);
  assert.match(pushRefusal({ refs: ['main'] }), /with its tag|exactly one tag/);
  assert.match(pushRefusal({ refs: ['main', 'refs/tags/v1.0.0', 'refs/tags/v1.0.1'] }), /exactly one tag/);
  assert.match(pushRefusal({ refs: ['refs/tags/v1.0.0'] }), /with its tag/);
});

test('a green release creates the annotated tag with the CHANGELOG section as its message and pushes main and the tag in one atomic push', async (t) => {
  const fx = fixture(t);
  const out = (await cut(fx));
  assert.deepEqual([out.ok, out.verdict, out.tag, out.tagCreated], [true, 'pushed', TAG, true], JSON.stringify(out));
  assert.deepEqual(out.suite.map((s) => [s.name, s.log]), [['npm test', 'npm test.log'], ['npm run test:packages', 'npm run test:packages.log'], ['npm run check', 'npm run check.log']]);
  assert.equal(fx.remoteMain(), git(fx.repo, 'rev-parse', 'HEAD'), 'main moved to the release commit');
  assert.deepEqual(fx.remoteTags(), [TAG]);
  assert.equal(git(fx.origin, 'cat-file', '-t', `refs/tags/${TAG}`), 'tag', 'the tag is annotated on the remote');
  const message = git(fx.origin, 'tag', '-l', '--format=%(contents)', TAG);
  assert.match(message, /^## \[1\.0\.0-alpha\.4\]/m, 'the tag message is the CHANGELOG section');
  assert.match(message, /shipped: the release notes/);
  assert.doesNotMatch(message, /older/, 'and only that section');
});

test('an annotated tag already on HEAD is reused; a lightweight one, one on another commit, a missing or non-release tag name are refused', async (t) => {
  const reuse = fixture(t);
  git(reuse.repo, 'tag', '-a', TAG, '-m', 'earlier notes');
  const ok = (await cut(reuse));
  assert.deepEqual([ok.ok, ok.tagCreated], [true, false], JSON.stringify(ok));
  const light = fixture(t);
  git(light.repo, 'tag', TAG);
  assert.equal((await cut(light)).verdict, 'tag-not-annotated');
  const elsewhere = fixture(t);
  git(elsewhere.repo, 'tag', '-a', TAG, '-m', 'old', 'HEAD~1');
  assert.equal((await cut(elsewhere)).verdict, 'tag-elsewhere');
  const none = fixture(t);
  assert.equal((await cut(none, { tag: null })).verdict, 'no-release-tag');
  assert.equal((await cut(none, { tag: 'preserve/old' })).verdict, 'bad-tag');
  assert.equal((await cut(none, { tag: 'pre-1.0.4-merge' })).verdict, 'bad-tag');
  for (const fx of [light, elsewhere, none]) untouched(fx);
});

test('a dirty tree, a branch other than main and a tag that already exists on the remote are refused', async (t) => {
  const dirty = fixture(t);
  fs.writeFileSync(path.join(dirty.repo, 'a.txt'), 'changed\n');
  assert.equal((await cut(dirty)).verdict, 'dirty');
  assert.equal(fs.readFileSync(path.join(dirty.repo, 'a.txt'), 'utf8'), 'changed\n', 'nothing was stashed or reset');
  const off = fixture(t);
  git(off.repo, 'checkout', '-q', '-b', 'lane/x');
  assert.equal((await cut(off)).verdict, 'not-on-main');
  const dup = fixture(t);
  git(dup.repo, 'tag', '-a', TAG, '-m', 'x');
  git(dup.repo, 'push', '-q', 'origin', `refs/tags/${TAG}`);
  assert.equal((await cut(dup)).verdict, 'tag-exists-on-remote');
  assert.equal(dup.remoteMain(), dup.before, 'only the tag was already there; main is untouched');
  untouched(dirty); untouched(off);
});

test('unfinished release notes (a missing section, TBD, in preparation) stop the release before L4 runs', async (t) => {
  let suites = 0;
  for (const changelog of ['# Changelog\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n', '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- TBD(sha)\n', '# Changelog\n\n## [1.0.0-alpha.4] — in preparation\n\n- x\n']) {
    const fx = fixture(t, { changelog });
    const out = (await cut(fx, {}, { suite: () => { suites += 1; return green(); } }));
    assert.equal(out.verdict, 'release-notes', JSON.stringify(out));
    untouched(fx);
  }
  assert.equal(suites, 0, 'L4 never runs over unfinished notes');
});

test('a red or absent L4 step pushes nothing, names the step and its log; L4 runs exactly once and no tag is created', async (t) => {
  const fx = fixture(t);
  let runs = 0;
  const out = (await cut(fx, {}, { suite: () => { runs += 1; return [step('npm test', { ok: false, log: 'red.log' }), step('ecommerce-app: npm run test:e2e', { ok: false, absent: true, log: null }), step('npm run check')]; } }));
  assert.equal(out.verdict, 'suite-red');
  assert.match(out.why, /npm test/);
  assert.match(out.why, /test:e2e \(absent\)/);
  assert.match(out.why, /red\.log/);
  assert.equal(runs, 1);
  assert.equal(git(fx.repo, 'tag', '-l'), '', 'a red L4 creates no tag');
  untouched(fx);
});

test('skips: the log parsers read the spec and TAP reporters; a skip from missing infrastructure or any undeclared skip fails L4; only the declared browser skips remain, listed by name', () => {
  const spec = '✔ fine (1ms)\n﹣ a live probe (0.5ms) # needs Docker on the release host\n﹣ draw-render shows the layer (0.2ms) # no browser\n';
  assert.deepEqual(skipsOf(spec), [{ name: 'a live probe', reason: 'needs Docker on the release host' }, { name: 'draw-render shows the layer', reason: 'no browser' }]);
  assert.deepEqual(skipsOf('ok 4 - e2e with Postgres # SKIP postgres unreachable\nok 5 - fine\n'), [{ name: 'e2e with Postgres', reason: 'postgres unreachable' }]);
  assert.equal(classifySkip({ name: 'orders against Postgres', reason: 'no port 5432' }), 'infrastructure');
  assert.equal(classifySkip({ name: 'supabase auth', reason: '' }), 'infrastructure');
  assert.equal(classifySkip({ name: 'windows only', reason: 'not on this platform' }), 'undeclared');
  for (const name of ['draw-render', 'draw-rationale', 'draw-layer']) assert.equal(classifySkip({ name: `${name} paints`, reason: 'needs a browser' }), 'declared');
  const report = skipReport([step('npm test', { skips: [{ name: 'draw-layer', reason: 'no browser' }, { name: 'kafka bus', reason: 'docker is not running' }] })]);
  assert.deepEqual(report.declared, ['draw-layer']);
  assert.deepEqual(report.failures.map((k) => k.class), ['infrastructure']);
});

test('a skip from missing infrastructure on the release host, or any undeclared skip, stops the release; declared browser skips pass and are recorded by name', async (t) => {
  const infra = fixture(t);
  const refused = (await cut(infra, {}, { suite: () => [step('npm test', { skips: [{ name: 'integration against Postgres', reason: 'docker daemon is not running' }] }), step('npm run check')] }));
  assert.equal(refused.verdict, 'suite-skips');
  assert.match(refused.why, /integration against Postgres \[infrastructure: docker daemon is not running\]/);
  const odd = fixture(t);
  assert.equal((await cut(odd, {}, { suite: () => [step('npm test', { skips: [{ name: 'only on linux', reason: 'platform' }] })] })).verdict, 'suite-skips');
  untouched(infra); untouched(odd);
  const browser = fixture(t);
  const out = (await cut(browser, {}, { suite: () => [step('npm test', { skips: [{ name: 'draw-render needs a browser', reason: 'no browser installed' }, { name: 'draw-layer needs a browser', reason: 'no browser installed' }] }), step('npm run check')] }));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.declaredSkips, ['draw-layer needs a browser', 'draw-render needs a browser'], 'the kept skips are listed by name');
  assert.equal(out.skips.length, 2);
  assert.ok(out.skips.every((k) => k.reason && k.step === 'npm test'), 'every skip carries its reason and its step');
});

test('the L4 row: the runtime suite and check, every example script (lint, tsc, tests, builds, images) and the Sonar proof; a missing script or proof is absent and fails', async (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-l4-plan-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: 'node --test tests/a.spec.mjs', check: 'x' } }));
  const app = path.join(base, 'examples', 'shop');
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, 'hfs.json'), JSON.stringify({ kind: 'app' }));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'shop', scripts: { lint: 'x', typecheck: 'x', test: 'x', 'test:e2e': 'x' } }));
  // a test layer has a row once the app holds a spec file in it: this app holds one e2e spec, no contract or integration spec
  fs.mkdirSync(path.join(app, 'be', 'src', 'tests', 'e2e'), { recursive: true });
  fs.writeFileSync(path.join(app, 'be', 'src', 'tests', 'e2e', 'shop.e2e-spec.ts'), 'export {};');
  const plan = planL4(base, { runtimeRoot: base });
  const names = plan.steps.map((s) => s.name);
  assert.deepEqual(names.filter((n) => n.startsWith('npm ')), ['npm test', 'npm run test:packages', 'npm run check'], 'the runtime rows: the root suite, the packages suites, the checks');
  for (const expected of ['shop: npm run lint', 'shop: npm run typecheck', 'shop: npm run test', 'shop: npm run test:e2e', 'shop: npm run docker:build', 'shop: npm run build:be']) assert.ok(names.includes(expected), expected);
  assert.deepEqual(plan.steps.filter((s) => s.absent).map((s) => s.name).sort(), ['shop: npm ci', 'shop: npm run build:be', 'shop: npm run build:fe', 'shop: npm run codegen', 'shop: npm run docker:build', 'shop: npm run format:check', 'shop: npm run typecheck:tests']);
  assert.deepEqual(plan.notPlanned.map((row) => row.name).sort(), ['shop: npm run test:contract', 'shop: npm run test:integration'], 'a layer with no spec file has no row and is named with its reason');
  assert.ok(plan.notPlanned.every((row) => row.why), 'each row left out carries its reason');
  assert.deepEqual(plan.proofs, ['shop: sonar']);
  const ran = [];
  const out = (await runL4(base, { plan, step: (s, o) => { ran.push([s.name, o.cwd]); return { ok: true, log: 'x.log', ms: 1, text: '﹣ draw-layer (1ms) # no browser\n' }; }, proofs: {}, parity: null }));
  assert.ok(ran.some(([n, cwd]) => n === 'shop: npm run lint' && cwd === app), 'an example step runs in its own folder');
  const sonar = out.find((s) => s.name === 'shop: sonar');
  assert.deepEqual([sonar.ok, sonar.absent], [false, true], 'a proof nothing supplies is absent and fails');
  assert.equal((await runL4(base, { plan, step: () => ({ ok: true, log: 'x', ms: 1, text: '' }), proofs: { 'shop: sonar': () => ({ ok: true, log: 'sonar.json' }) }, parity: null })).find((s) => s.name === 'shop: sonar').ok, true);
  assert.deepEqual(out.find((s) => s.name === 'shop: npm run lint').skips, [{ name: 'draw-layer', reason: 'no browser' }], 'the skips of every step are read from its log');
});

test('main moving while L4 runs, and a secret in the pushed range, stop the push and create no tag', async (t) => {
  const moved = fixture(t);
  const out = (await cut(moved, {}, { suite: () => { fs.writeFileSync(path.join(moved.repo, 'b.txt'), 'x\n'); git(moved.repo, 'add', '-A'); git(moved.repo, 'commit', '-q', '-m', 'late commit'); return green(); } }));
  assert.equal(out.verdict, 'main-moved');
  const secret = fixture(t);
  const refused = (await cut(secret, {}, { scan: () => ({ ok: false, findings: [{ pattern: 'assigned-secret' }] }) }));
  assert.equal(refused.verdict, 'secret-scan');
  assert.equal(git(secret.repo, 'tag', '-l'), '');
  untouched(moved); untouched(secret);
});

test('the push is atomic: a remote that refuses the tag leaves main where it was', async (t) => {
  const fx = fixture(t);
  // An `update` hook judges ONE ref: it refuses the tag alone, so only --atomic keeps main from moving without it.
  const hook = path.join(fx.origin, 'hooks', 'update');
  fs.writeFileSync(hook, ['#!/bin/sh', 'case "$1" in refs/tags/*) echo "tags refused" >&2; exit 1;; esac', 'exit 0', ''].join('\n'), { mode: 0o755 });
  const out = (await cut(fx));
  assert.equal(out.verdict, 'push-refused', JSON.stringify(out));
  assert.equal(fx.remoteMain(), fx.before, 'main did not move without its tag');
  assert.deepEqual(fx.remoteTags(), []);
});

test('L4 and the push each run inside the one host-lock function', async (t) => {
  const fx = fixture(t);
  const events = [];
  const out = (await cut(fx, {}, { suite: () => { events.push('suite'); return green(); }, lock: (work) => { events.push('lock-in'); const r = work(); events.push('lock-out'); return r; } }));
  assert.equal(out.ok, true);
  assert.deepEqual(events, ['lock-in', 'suite', 'lock-out', 'lock-in', 'lock-out'], 'L4 and the push each hold the lock');
});

test('the L4 record of HEAD is written after the tag and before the push, naming the tag; a record that cannot be written stops the push', async (t) => {
  const fx = fixture(t);
  const events = [];
  const out = (await cut(fx, {}, { recordL4: (input) => { events.push(`record ${input.tag}`); return writeL4Record({ ...input, repo: fx.repo }); }, push: (args, o) => { events.push('push'); return push(args, o); } }));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(events, [`record ${TAG}`, 'push']);
  const head = git(fx.repo, 'rev-parse', 'HEAD');
  const record = readL4Record({ repo: fx.repo, head, tag: TAG });
  assert.equal(record.tag, TAG);
  assert.deepEqual(record.logs.map((s) => s.name), ['npm test', 'npm run test:packages', 'npm run check']);
  assert.equal(out.l4Record, l4RecordPath({ commonDir: gitCommonDir(fx.repo), head }));

  const blocked = fixture(t);
  const refused = (await cut(blocked, {}, { recordL4: () => ({ ok: false, reason: 'the repository has no git common dir' }) }));
  assert.equal(refused.verdict, 'l4-record');
  assert.match(refused.why, /pre-push gate would refuse/);
  assert.equal(blocked.remoteMain(), blocked.before, 'nothing was pushed');
});

test('a held host lock refuses the cut naming its owner: the suite never runs and no tag is created', async (t) => {
  const fx = fixture(t);
  let suites = 0;
  const out = (await cut(fx, {}, { suite: () => { suites += 1; return green(); }, lock: () => ({ ok: false, reason: 'held', owner: { role: 'coordinator', purpose: 'land', pid: 4242 } }) }));
  assert.equal(out.verdict, 'host-lock-held');
  assert.match(out.why, /held by coordinator \(land\) pid 4242/);
  assert.equal(suites, 0);
  assert.equal(git(fx.repo, 'tag', '-l'), '', 'no tag was created');
  untouched(fx);
});

test('a push lock parked as DISABLED... on the remote pushurl is lifted for the release push only: main and the tag move, the config stays as the owner set it, the remote-tracking ref follows', async (t) => {
  const fx = fixture(t);
  const lock = 'DISABLED-local-main-until-the-release-push';
  git(fx.repo, 'config', 'remote.origin.pushurl', lock);
  const out = (await cut(fx));
  assert.deepEqual([out.ok, out.verdict], [true, 'pushed'], JSON.stringify(out));
  assert.equal(fx.remoteMain(), git(fx.repo, 'rev-parse', 'HEAD'));
  assert.deepEqual(fx.remoteTags(), [TAG]);
  assert.equal(git(fx.repo, 'config', '--get', 'remote.origin.pushurl'), lock, "the owner's lock is not rewritten");
  assert.equal(git(fx.repo, 'rev-parse', 'refs/remotes/origin/main'), git(fx.repo, 'rev-parse', 'HEAD'), 'the remote-tracking ref moved with the push');
  const plain = fixture(t);
  git(plain.repo, 'config', 'remote.origin.pushurl', path.join(plain.base, 'does-not-exist.git'));
  const refused = (await cut(plain));
  assert.equal(refused.verdict, 'push-refused', 'a pushurl that is not a parked lock is left alone: a broken one fails the push');
  untouched(plain);
});

test("a pushurl that is a real url is the owner's choice: the release pushes there, never to the fetch url", async (t) => {
  const fx = fixture(t);
  const other = path.join(fx.base, 'other.git');
  git(fx.base, 'init', '-q', '--bare', '-b', 'main', other);
  git(fx.repo, 'config', 'remote.origin.pushurl', other);
  const out = (await cut(fx));
  assert.equal(out.ok, true, JSON.stringify(out));
  untouched(fx);
  assert.equal(git(other, 'rev-parse', 'refs/heads/main'), git(fx.repo, 'rev-parse', 'HEAD'));
  assert.equal(git(other, 'tag', '-l'), TAG);
});

test('the pre-push hook lets exactly the release the cut made through: a push of main without the L4 record is refused, with it the atomic push passes', async (t) => {
  const fx = fixture(t);
  const hooks = path.join(fx.repo, '.git', 'hooks');
  const rendered = renderRuntimeHooks({ root: path.resolve(import.meta.dirname, '..', '..') });
  fs.writeFileSync(path.join(hooks, 'pre-push'), rendered['pre-push'], { mode: 0o755 });
  const blocked = (await cut(fx, {}, { recordL4: () => ({ ok: true, file: null }), push: (args, o) => push(args, o) }));
  assert.equal(blocked.verdict, 'push-refused', JSON.stringify(blocked));
  assert.match(blocked.why, /RIGHTS_PUSH_NOT_RELEASE/);
  untouched(fx);
  const ok = (await cut(fx, {}, { push: (args, o) => push(args, o) }));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.deepEqual(fx.remoteTags(), [TAG]);
});

test('a version that did not move past the remote main, or an undated heading, stops the release before L4 runs and names the fix', async (t) => {
  let suites = 0;
  const suite = () => { suites += 1; return green(); };
  const old = '# Changelog\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n';
  const same = fixture(t, { version: '1.0.0-alpha.3', changelog: old });
  const stale = (await cut(same, { tag: 'v1.0.0-alpha.3' }, { suite }));
  assert.equal(stale.verdict, 'release-definition', JSON.stringify(stale));
  assert.match(stale.why, /version 1\.0\.0-alpha\.3 is the version the remote main already carries/);
  assert.equal(stale.findings[0].code, 'RELEASE_VERSION_UNCHANGED');
  const wrongTag = fixture(t, { version: '1.0.0-alpha.3' });
  const mismatch = (await cut(wrongTag, {}, { suite }));
  assert.equal(mismatch.findings[0].code, 'RELEASE_TAG_VERSION', 'the tag must be v<version> of the commit');
  const undated = fixture(t, { changelog: '# Changelog\n\n## [1.0.0-alpha.4]\n\n- the release\n' });
  const heading = (await cut(undated, {}, { suite }));
  assert.equal(heading.verdict, 'release-definition');
  assert.match(heading.why, /dated heading/);
  assert.equal(suites, 0);
  untouched(same); untouched(wrongTag); untouched(undated);
});

test('--plan reports what the cut would run and require and runs, tags and pushes nothing; with a missing piece it refuses naming it', async (t) => {
  const fx = fixture(t);
  let suites = 0;
  const planned = (await cut(fx, { plan: true }, { suite: () => { suites += 1; return green(); } }));
  assert.deepEqual([planned.ok, planned.verdict, planned.tag], [true, 'plan', TAG], JSON.stringify(planned));
  assert.deepEqual(planned.receiptSteps, ['npm test', 'npm run test:packages', 'npm run check']);
  assert.ok(planned.steps.length > 0 && planned.steps.includes('linux parity'), planned.steps.join(', '));
  assert.match(planned.why, /nothing was run, tagged or pushed/);
  assert.equal(suites, 0);
  assert.equal(git(fx.repo, 'tag', '-l'), '', 'no tag was created');
  untouched(fx);
  const stale = fixture(t, { version: '1.0.0-alpha.3' });
  const refused = (await cut(stale, { plan: true }));
  assert.deepEqual([refused.ok, refused.verdict], [false, 'release-definition']);
  untouched(stale);
});

test('the cut refuses at once, plan or run, when the host lacks an Orca terminal, a reachable Orca or a Docker daemon; nothing runs', async (t) => {
  const fx = fixture(t);
  const missing = releaseHostMissing({ env: {}, orca: () => ({ ok: false, reachable: false, error: 'no answer' }), docker: () => ({ status: 1, error: null }) });
  assert.deepEqual(missing.map((m) => m.need), ['an Orca terminal', 'a reachable Orca', 'a Docker daemon']);
  assert.deepEqual(releaseHostMissing({ env: { ORCA_TERMINAL_HANDLE: 'term_1' }, orca: () => ({ ok: true, reachable: true }), docker: () => ({ status: 0 }) }), []);
  let ran = false;
  for (const plan of [true, false]) {
    const refused = await cut(fx, { plan }, { host: () => missing, suite: () => { ran = true; return green(); } });
    assert.equal(refused.ok, false);
    assert.equal(refused.verdict, 'release-host');
    assert.match(refused.why, /an Orca terminal \(ORCA_TERMINAL_HANDLE is empty[^)]*run starci release cut from a terminal Orca owns/);
  }
  assert.equal(ran, false, 'the suite never started');
  untouched(fx);
});

test('the cut refuses in seconds, before any suite, when the publish plan reports a package to publish or a blocker; a clean plan lets it go on', async (t) => {
  const fx = fixture(t);
  let suites = 0;
  const suite = () => { suites += 1; return green(); };
  const dirty = await cut(fx, {}, { suite, publishPlan: () => ({ blockers: ['@starci/canon@1.0.0 is on the registry but its bytes differ'], toPublish: ['@starci/eslint@2.0.0'] }) });
  assert.equal(dirty.verdict, 'publish-plan', JSON.stringify(dirty));
  assert.match(dirty.why, /@starci\/canon@1\.0\.0 is on the registry but its bytes differ; @starci\/eslint@2\.0\.0 is not on the registry: publish it/);
  assert.equal(dirty.findings.length, 2);
  const planned = await cut(fx, { plan: true }, { suite, publishPlan: () => ({ blockers: [], toPublish: ['@starci/eslint@2.0.0'] }) });
  assert.equal(planned.verdict, 'publish-plan', 'the plan mode refuses the same way');
  assert.equal(suites, 0, 'no suite ran');
  untouched(fx);
  const clean = await cut(fx, { plan: true }, { suite, publishPlan: () => ({ blockers: [], toPublish: [] }) });
  assert.equal(clean.verdict, 'plan');
});
