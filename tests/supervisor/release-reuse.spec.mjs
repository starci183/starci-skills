// release-reuse.spec.mjs - a release cut that resumes (release-reuse.mjs, release-cut-rows.mjs, cutRelease): the ledger of green rows per commit, a row reused only when its declared input set is byte-identical
// between two commits, the pre-push gate's required rows never reused, `--rows` re-running named rows alone on the same commit and completing the record, `--no-reuse`, and the plan's per-row lines.
// Real temporary git repositories stand in for the checkout and the remote; the suite is injected and returns a green row for every planned row it is asked to run (the real rows run once, at the release).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cutRelease } from '../../scripts/supervisor/release-cut.mjs';
import { readL4Record } from '../../scripts/guards/release-record.mjs';
import { releaseFindings, RECEIPT_STEPS } from '../../scripts/guards/release-definition.mjs';
import { chooseRows, ledgerPath, readLedgers, reusePolicy, rowClass, rowDigest, signatureOf, treeEntries, writeLedger } from '../../scripts/supervisor/release-reuse.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const TAG = 'v1.0.0-alpha.4';
const CHANGELOG = '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- shipped: the release notes\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older\n';
const NODE_TEST = 'node --import ./tests/setup/low-priority.mjs --test "tests/**/*.spec.mjs"';
const LITE = ['codegen', 'typecheck', 'lint', 'format:check', 'build:be', 'build:fe', 'docker:build'];
const put = (repo, file, text) => { fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true }); fs.writeFileSync(path.join(repo, file), text); };
const commitAll = (repo, message) => { git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', message); return git(repo, 'rev-parse', 'HEAD'); };

/** A runtime-like checkout (root scripts, two lite example apps) with a release commit, and a bare origin holding the previous release. */
function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-reuse-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const origin = path.join(base, 'origin.git'), repo = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(base, 'clone', '-q', origin, repo);
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  git(repo, 'checkout', '-q', '-b', 'main');
  put(repo, 'package.json', `${JSON.stringify({ name: 'rt', version: '1.0.0-alpha.3', scripts: { test: NODE_TEST, check: 'x' } })}\n`);
  commitAll(repo, 'previous release');
  git(repo, 'push', '-q', 'origin', 'main');
  put(repo, 'package.json', `${JSON.stringify({ name: 'rt', version: '1.0.0-alpha.4', scripts: { test: NODE_TEST, check: 'x' } })}\n`);
  put(repo, 'CHANGELOG.md', CHANGELOG);
  put(repo, 'src/code.txt', 'one\n');
  put(repo, 'docs/guide.md', 'guide\n');
  for (const app of ['shop', 'blog']) {
    put(repo, `examples/${app}/hfs.json`, JSON.stringify({ kind: 'app', edition: 'lite' }));
    put(repo, `examples/${app}/package.json`, JSON.stringify({ name: app, scripts: Object.fromEntries(LITE.map((s) => [s, 'x'])) }));
    put(repo, `examples/${app}/package-lock.json`, '{}');
    put(repo, `examples/${app}/code.txt`, `${app}\n`);
  }
  commitAll(repo, 'release commit');
  const calls = [];
  const state = { red: new Set() };
  // The injected suite runs exactly the rows the cut asks it to: every planned row not carried, green unless its name is in state.red.
  const suite = (_repo, { selection, carry }) => {
    const wanted = selection.names.filter((name) => !(name in carry));
    calls.push({ ran: wanted, carried: Object.keys(carry) });
    return wanted.map((name) => ({ name, ok: !state.red.has(name), log: `${name}.log`, ms: 1, skips: [] }));
  };
  const deps = { host: () => [], suite, scan: () => ({ ok: true, findings: [] }), lock: (work) => work(), sonarCloud: async () => [], publishPlan: () => ({ blockers: [], toPublish: [] }), jsonExceptions: () => ({ offenders: [], missingAllowlist: [] }), runtimeRoot: repo };
  const cut = (extra = {}, more = {}) => cutRelease({ repo, tag: TAG, ...extra, deps: { ...deps, ...more } });
  return { base, origin, repo, calls, state, cut, remoteMain: () => git(origin, 'rev-parse', 'refs/heads/main'), before: git(origin, 'rev-parse', 'refs/heads/main') };
}
const planRows = (out) => Object.fromEntries(out.rows.map((row) => [row.name, row]));

test('rowClass and rowDigest: installs and the test-world build always run, an app row belongs to its app, the root rows to the root class, the Linux row to the whole tree; the digest follows only the declared input set', () => {
  const policy = reusePolicy();
  const apps = ['shop', 'blog'];
  assert.deepEqual(rowClass('shop: npm ci', { apps, policy }), { kind: 'always' });
  assert.deepEqual(rowClass('test-world: npm run build', { apps, policy }), { kind: 'always' });
  assert.deepEqual(rowClass('shop: npm run lint', { apps, policy }), { kind: 'app', app: 'shop' });
  assert.deepEqual(rowClass('blog: sonar', { apps, policy }), { kind: 'app', app: 'blog' });
  assert.deepEqual(rowClass('npm test', { apps, policy }), { kind: 'root' });
  assert.deepEqual(rowClass('linux-parity', { apps, policy }), { kind: 'whole' });
  assert.deepEqual(rowClass('a row nothing declares', { apps, policy }), { kind: 'always' });
  const entry = (file, sha) => ({ mode: '100644', sha, file });
  const tree = [entry('examples/shop/a.ts', '1'), entry('examples/blog/b.ts', '2'), entry('src/x.mjs', '3'), entry('docs/d.md', '4'), entry('package.json', '5')];
  const digest = (entries, cls, signature = ['npm', ['run', 'lint']]) => rowDigest({ entries, cls, signature, policy });
  const changed = (file, sha) => tree.map((e) => (e.file === file ? { ...e, sha } : e));
  const shop = { kind: 'app', app: 'shop' };
  assert.equal(digest(tree, shop), digest(changed('examples/blog/b.ts', '9'), shop), 'another example does not move the app row');
  assert.equal(digest(tree, shop), digest(changed('src/x.mjs', '9'), shop), 'nor does the runtime source');
  assert.notEqual(digest(tree, shop), digest(changed('examples/shop/a.ts', '9'), shop), 'the app tree does');
  assert.notEqual(digest(tree, shop), digest(changed('package.json', '9'), shop), 'and a lockfile or root manifest an app row stands on');
  assert.notEqual(digest(tree, shop), digest(tree, shop, ['npm', ['run', 'typecheck']]), 'and the command');
  assert.equal(digest(tree, { kind: 'root' }), digest(changed('examples/shop/a.ts', '9'), { kind: 'root' }), 'the root rows ignore examples/');
  assert.equal(digest(tree, { kind: 'root' }), digest(changed('docs/d.md', '9'), { kind: 'root' }), 'and docs/');
  assert.notEqual(digest(tree, { kind: 'root' }), digest(changed('src/x.mjs', '9'), { kind: 'root' }));
  assert.notEqual(digest(tree, { kind: 'whole' }), digest(changed('docs/d.md', '9'), { kind: 'whole' }), 'the Linux row takes the whole tree');
  assert.equal(digest(tree, { kind: 'always' }), null);
  assert.equal(digest(null, shop), null, 'a tree git could not list gives no digest');
});

test('a ledger keeps the green rows with their digests per commit, newest first; a red or absent row, an unreadable file and a head that is no sha are left out', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-ledger-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const rows = [{ name: 'a', ok: true }, { name: 'b', ok: false }, { name: 'c', ok: true, absent: true }];
  const old = writeLedger({ head: '1'.repeat(40), tag: TAG, rows, digests: { a: 'da' }, commonDir: dir, now: () => new Date('2026-10-01T00:00:00Z') });
  writeLedger({ head: '2'.repeat(40), tag: TAG, rows: [{ name: 'a', ok: true }], digests: { a: 'db' }, commonDir: dir, now: () => new Date('2026-10-02T00:00:00Z') });
  assert.equal(old.ok, true);
  assert.equal(old.file, ledgerPath({ commonDir: dir, head: '1'.repeat(40) }));
  fs.writeFileSync(path.join(dir, 'starci-release', 'broken.l4-rows.json'), '{nope');
  const ledgers = readLedgers({ repo: dir, commonDir: dir });
  assert.deepEqual(ledgers.map((l) => l.head[0]), ['2', '1'], 'newest first, the broken file skipped');
  assert.deepEqual(ledgers[1].rows.map((r) => [r.name, r.digest]), [['a', 'da']], 'only the green row, with its digest');
  assert.equal(writeLedger({ head: 'abc', tag: TAG, rows, digests: {}, commonDir: dir }).ok, false);
});

test('chooseRows: identical inputs on another commit reuse an app row, a changed input runs it, installs and required rows always run, this commit\'s green rows are carried, --no-reuse runs all, --rows names the rows to run', () => {
  const policy = reusePolicy();
  const e = (file, sha) => ({ mode: '100644', sha, file });
  const treeA = [e('examples/shop/a.ts', '1'), e('examples/blog/b.ts', '2'), e('src/x.mjs', '3')];
  const treeB = [e('examples/shop/a.ts', '1'), e('examples/blog/b.ts', '8'), e('src/x.mjs', '4')];
  const names = ['shop: npm ci', 'shop: npm run lint', 'blog: npm run lint', 'npm test', 'linux-parity'];
  const signatures = { 'shop: npm run lint': ['npm', ['run', 'lint']], 'blog: npm run lint': ['npm', ['run', 'lint']], 'npm test': ['npm', ['test']] };
  const common = { names, signatures, apps: ['shop', 'blog'], policy };
  const first = chooseRows({ ...common, entries: treeA, ledgers: [], head: 'A'.repeat(40) });
  assert.ok(first.decisions.every((d) => d.action === 'run'), 'no ledger, everything runs');
  const ledger = (head, entries, at) => ({ head, at, rows: names.map((name) => ({ name, digest: chooseRows({ ...common, entries, ledgers: [], head }).digests[name], row: { name, ok: true, log: `${name}.log` } })) });
  const ledgers = [ledger('A'.repeat(40), treeA, '2026-10-01T00:00:00Z')];
  const second = chooseRows({ ...common, entries: treeB, ledgers, head: 'B'.repeat(40) });
  const by = Object.fromEntries(second.decisions.map((d) => [d.name, d]));
  assert.equal(by['shop: npm run lint'].action, 'reuse');
  assert.equal(by['shop: npm run lint'].from, 'A'.repeat(40));
  assert.equal(by['shop: npm run lint'].row.reusedFrom, 'A'.repeat(40), 'the reused row carries the commit that proved it');
  assert.match(by['shop: npm run lint'].why, /inputs identical to AAAAAAAAA/);
  assert.equal(by['blog: npm run lint'].action, 'run', 'its inputs changed');
  assert.equal(by['shop: npm ci'].action, 'run');
  assert.match(by['npm test'].why, /required row/, 'a required row of the pre-push gate runs on every commit even when its inputs are identical');
  assert.equal(by['linux-parity'].action, 'run', 'the whole tree moved');
  const same = chooseRows({ ...common, entries: treeA, ledgers, head: 'A'.repeat(40) });
  assert.deepEqual(same.decisions.map((d) => [d.name, d.action]), [['shop: npm ci', 'run'], ['shop: npm run lint', 'carry'], ['blog: npm run lint', 'carry'], ['npm test', 'carry'], ['linux-parity', 'carry']], 'on the same commit the green rows ran here already');
  assert.equal(same.decisions[3].row.reusedFrom, undefined, 'a carried row of this commit is not marked reused');
  const hereOnly = chooseRows({ ...common, entries: treeB, ledgers, head: 'B'.repeat(40), noReuse: true });
  assert.ok(hereOnly.decisions.every((d) => d.action === 'run' && d.why === '--no-reuse'));
  const rows = chooseRows({ ...common, entries: treeA, ledgers, head: 'A'.repeat(40), only: ['npm test', 'ghost'] });
  assert.deepEqual(rows.unknown, ['ghost']);
  assert.deepEqual(rows.decisions.map((d) => [d.name, d.action]), [['shop: npm ci', 'carry'], ['shop: npm run lint', 'carry'], ['blog: npm run lint', 'carry'], ['npm test', 'run'], ['linux-parity', 'carry']]);
  const elsewhere = chooseRows({ ...common, entries: treeB, ledgers, head: 'B'.repeat(40), only: ['npm test'] });
  assert.ok(elsewhere.decisions.filter((d) => d.name !== 'npm test').every((d) => d.action === 'missing'), 'another commit\'s rows do not complete this commit\'s record');
  const unreadable = chooseRows({ ...common, entries: null, ledgers, head: 'B'.repeat(40) });
  assert.ok(unreadable.decisions.every((d) => d.action === 'run'), 'a tree git cannot list reuses nothing');
});

test('treeEntries lists the tracked files of a commit with their blob ids; a bad commit gives null', (t) => {
  const fx = fixture(t);
  const entries = treeEntries({ repo: fx.repo, commit: 'HEAD' });
  assert.ok(entries.some((entry) => entry.file === 'examples/shop/code.txt' && /^[0-9a-f]{40,}$/.test(entry.sha)));
  assert.equal(treeEntries({ repo: fx.repo, commit: 'refs/heads/nothing-here' }), null);
  assert.deepEqual(signatureOf({ cmd: 'npm', args: ['ci'] }), ['npm', ['ci']]);
});

test('--plan lists every row with run or the commit it stands in from and why; a first cut runs everything', async (t) => {
  const fx = fixture(t);
  const first = await fx.cut({ plan: true });
  assert.deepEqual([first.ok, first.verdict], [true, 'plan'], JSON.stringify(first));
  assert.ok(first.rows.length > 20 && first.rows.every((row) => row.action === 'run'));
  assert.match(first.why, /would run \d+ of \d+ row/);
  assert.ok(first.steps.includes('linux-parity') && first.steps.includes('shop: sonar'));
  assert.equal(fx.calls.length, 0, 'a plan runs nothing');
});

test('a cut that ends suite-red leaves its green rows; a cut on a new commit re-runs the rows whose inputs changed and reuses the identical ones, listing the commit that proved them', async (t) => {
  const fx = fixture(t);
  fx.state.red = new Set(['npm test', 'blog: npm run lint']);
  const head1 = git(fx.repo, 'rev-parse', 'HEAD');
  const red = await fx.cut();
  assert.equal(red.verdict, 'suite-red');
  assert.match(red.why, /npm test, blog: npm run lint red/);
  assert.equal(fx.calls[0].carried.length, 0);
  assert.equal(git(fx.repo, 'tag', '-l'), '', 'a red cut creates no tag');
  // the fix touches the runtime source and one example: the other example is byte-identical
  put(fx.repo, 'src/code.txt', 'two\n');
  put(fx.repo, 'examples/blog/code.txt', 'fixed\n');
  const head2 = commitAll(fx.repo, 'the fix');
  fx.state.red = new Set();
  const plan = await fx.cut({ plan: true });
  const rows = planRows(plan);
  assert.equal(rows['shop: npm run lint'].action, 'reuse');
  assert.equal(rows['shop: npm run lint'].from, head1);
  assert.match(rows['shop: npm run lint'].why, new RegExp(`identical to ${head1.slice(0, 9)}`));
  assert.equal(rows['shop: sonar'].action, 'reuse', 'the proof of an unchanged app is reused with it');
  assert.equal(rows['blog: npm run lint'].action, 'run', 'its tree changed');
  assert.equal(rows['blog: sonar'].action, 'run');
  assert.equal(rows['shop: npm ci'].action, 'run', 'installs always run');
  for (const required of RECEIPT_STEPS) assert.equal(rows[required].action, 'run', `${required} runs on the pushed commit`);
  assert.equal(rows['linux-parity'].action, 'run');
  const done = await fx.cut();
  assert.deepEqual([done.ok, done.verdict], [true, 'pushed'], JSON.stringify(done));
  const second = fx.calls.at(-1);
  assert.ok(second.carried.includes('shop: npm run lint') && second.carried.includes('shop: sonar') && !second.carried.includes('blog: npm run lint'));
  assert.ok(!second.ran.includes('shop: npm run lint') && second.ran.includes('blog: npm run lint') && second.ran.includes('npm test'));
  assert.deepEqual(done.reused.filter((r) => r.name.startsWith('shop: ')).map((r) => r.from), Array(done.reused.length).fill(head1), 'every reused row names the commit that proved it');
  assert.ok(done.reused.length >= 6 && done.reused.every((r) => r.name.startsWith('shop: ')));
  const record = readL4Record({ repo: fx.repo, head: head2, tag: TAG });
  const recorded = Object.fromEntries(record.logs.map((row) => [row.name, row]));
  assert.equal(recorded['shop: npm run lint'].reusedFrom, head1, 'the release record lists the reused row with the commit that proved it');
  for (const required of RECEIPT_STEPS) assert.equal(recorded[required].reusedFrom, undefined, `${required} ran on the final commit`);
  assert.deepEqual(releaseFindings({ cwd: fx.repo, commit: head2, remoteCommit: fx.before }), [], 'the pre-push gate accepts the record');
  assert.equal(fx.remoteMain(), head2);
});

test('a required row is never reused even when nothing it stands on changed: a docs-only fix still runs the suite, the packages suites and the checks', async (t) => {
  const fx = fixture(t);
  fx.state.red = new Set(['shop: npm run lint']);
  assert.equal((await fx.cut()).verdict, 'suite-red');
  put(fx.repo, 'docs/guide.md', 'changed\n');
  commitAll(fx.repo, 'docs only');
  fx.state.red = new Set();
  const rows = planRows(await fx.cut({ plan: true }));
  for (const required of RECEIPT_STEPS) {
    assert.equal(rows[required].action, 'run', required);
    assert.match(rows[required].why, /required row/);
  }
  assert.equal(rows['blog: npm run lint'].action, 'reuse');
  assert.equal(rows['shop: npm run lint'].action, 'run', 'the row that was red runs again');
  assert.equal(rows['linux-parity'].action, 'run', 'the whole tree moved');
  const out = await fx.cut();
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.ok(fx.calls.at(-1).ran.includes('npm test') && fx.calls.at(-1).ran.includes('npm run test:packages') && fx.calls.at(-1).ran.includes('npm run check'));
});

test('--rows re-runs the named rows alone on the same commit and completes the record when every other row is green there', async (t) => {
  const fx = fixture(t);
  const head = git(fx.repo, 'rev-parse', 'HEAD');
  fx.state.red = new Set(['npm test', 'linux-parity']);
  const red = await fx.cut();
  assert.equal(red.verdict, 'suite-red');
  assert.equal(readL4Record({ repo: fx.repo, head, tag: TAG }), null, 'no record while a row is red');
  const plan = await fx.cut({ plan: true, rows: ['npm test', 'linux-parity'] });
  assert.deepEqual(Object.values(planRows(plan)).filter((r) => r.action === 'run').map((r) => r.name).sort(), ['linux-parity', 'npm test']);
  assert.equal(planRows(plan)['shop: npm run lint'].action, 'carry');
  fx.state.red = new Set();
  const done = await fx.cut({ rows: ['npm test', 'linux-parity'] });
  assert.deepEqual([done.ok, done.verdict], [true, 'pushed'], JSON.stringify(done));
  const last = fx.calls.at(-1);
  assert.deepEqual(last.ran.sort(), ['linux-parity', 'npm test'], 'only the named rows ran');
  assert.ok(last.carried.includes('npm run check') && last.carried.includes('shop: npm ci'));
  assert.deepEqual(done.reused, [], 'rows carried from this commit ran on it: nothing is marked reused');
  const record = readL4Record({ repo: fx.repo, head, tag: TAG });
  assert.deepEqual(RECEIPT_STEPS.filter((name) => record.logs.some((row) => row.name === name && row.ok === true && !row.reusedFrom)), [...RECEIPT_STEPS], 'the required rows ran on the pushed commit');
  assert.equal(fx.remoteMain(), head);
});

test('--rows refuses before running anything: a name the plan does not hold, an empty list, and a commit where another row is not green', async (t) => {
  const fx = fixture(t);
  const ghost = await fx.cut({ rows: ['npm test', 'no such row'] });
  assert.equal(ghost.verdict, 'rows-unknown');
  assert.match(ghost.why, /no such row/);
  assert.equal((await fx.cut({ rows: [] })).verdict, 'rows-unknown');
  fx.state.red = new Set(['npm test', 'blog: npm run lint']);
  assert.equal((await fx.cut()).verdict, 'suite-red');
  const callsBefore = fx.calls.length;
  const partial = await fx.cut({ rows: ['npm test'] });
  assert.equal(partial.verdict, 'rows-incomplete');
  assert.match(partial.why, /blog: npm run lint/);
  const fresh = fixture(t);
  assert.equal((await fresh.cut({ rows: ['npm test'] })).verdict, 'rows-incomplete', 'a commit nothing ran on has no green rows to complete');
  assert.equal(fx.calls.length, callsBefore, 'nothing ran for a refused --rows');
  assert.equal(fx.remoteMain(), fx.before);
});

test('--no-reuse runs every row, also on a commit whose green rows are on record', async (t) => {
  const fx = fixture(t);
  fx.state.red = new Set(['npm test']);
  assert.equal((await fx.cut()).verdict, 'suite-red');
  const plan = await fx.cut({ plan: true, reuse: false });
  assert.ok(plan.rows.every((row) => row.action === 'run' && row.why === '--no-reuse'));
  fx.state.red = new Set();
  const done = await fx.cut({ reuse: false });
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(fx.calls.at(-1).carried.length, 0);
  assert.deepEqual(done.reused, []);
});
