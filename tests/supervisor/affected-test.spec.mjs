// affected-test.spec.mjs - `starci test affected`: the selection is the land gate's plus the readers of changed shared data, the runner runs one
// file per process with the four preloads at a bounded concurrency, and a large selection is announced and run in shards inside a stated time budget, never refused.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { affectedSelection, dataFilesOf, readsData } from '../../scripts/supervisor/affected-select.mjs';
import { baseOf, runBounded, runSpecFile, testAffected } from '../../scripts/supervisor/affected-test.mjs';
import { readSpecs } from '../../scripts/lib/spec-pool.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const POLICY = { maxFiles: 10, dataRoots: ['modules', 'knowledge'], symbolDepth: 4, budgetMs: 600_000, generated: [], specCache: { keepDays: 30 } };

function tree(t) {
  const root = mkdtemp(t, 'starci-affected-');
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put('scripts/lib/core.mjs', 'export const core = 1;\n');
  put('scripts/lib/reader.mjs', "export const registry = () => ['modules', 'reg', 'rows.yaml'].join('/');\n");
  put('scripts/lib/other.mjs', 'export const other = 2;\n');
  put('modules/reg/rows.yaml', 'rows: []\n');
  put('tests/core.spec.mjs', "import { core } from '../scripts/lib/core.mjs';\n");
  put('tests/via-reader.spec.mjs', "import { registry } from '../scripts/lib/reader.mjs';\n");
  put('tests/unrelated.spec.mjs', "import { other } from '../scripts/lib/other.mjs';\n");
  return root;
}

const select = (root, changed, overrides = {}) => affectedSelection({
  root, changed, specs: readSpecs(root), sources: [
    { file: 'scripts/lib/reader.mjs', text: fs.readFileSync(path.join(root, 'scripts/lib/reader.mjs'), 'utf8') },
    { file: 'scripts/lib/other.mjs', text: fs.readFileSync(path.join(root, 'scripts/lib/other.mjs'), 'utf8') },
  ],
  symbolsOf: () => null, exists: () => true, maxFiles: POLICY.maxFiles, dataRoots: POLICY.dataRoots, ...overrides,
});

test('a changed module selects the spec named after it and the specs importing it, not the others', (t) => {
  const picked = select(tree(t), ['scripts/lib/core.mjs']);
  assert.deepEqual(picked.files, ['tests/core.spec.mjs']);
  assert.equal(picked.over, false);
});

test('a changed registry yaml selects the specs behind the module that reads it, though no spec names the yaml', (t) => {
  const picked = select(tree(t), ['modules/reg/rows.yaml']);
  assert.deepEqual(picked.readers.map((r) => r.file), ['scripts/lib/reader.mjs']);
  assert.ok(picked.files.includes('tests/via-reader.spec.mjs'));
  assert.ok(!picked.files.includes('tests/unrelated.spec.mjs'));
});

test('shared data is only the declared data roots, and a reader names the file by path or by name with its directory', () => {
  assert.deepEqual(dataFilesOf(['package.json', 'modules/a/b.yaml', 'knowledge/x.md', 'scripts/a.mjs', 'modules/a/c.mjs'], ['modules', 'knowledge']), ['modules/a/b.yaml', 'knowledge/x.md']);
  assert.equal(readsData("read('modules/a/b.yaml')", 'modules/a/b.yaml'), true);
  assert.equal(readsData("join('modules', 'a', 'b.yaml')", 'modules/a/b.yaml'), true);
  assert.equal(readsData("'b.yaml'", 'modules/a/b.yaml'), false, 'the file name alone is any file of that name');
});

test('a deleted spec is not selected', (t) => {
  const picked = select(tree(t), ['scripts/lib/core.mjs'], { exists: (file) => file !== 'tests/core.spec.mjs' });
  assert.deepEqual(picked.files, []);
});

const passing = () => Promise.resolve({ error: null, stdout: 'ok', stderr: '' });
const context = (args) => ({ args, cwd: process.cwd() });
const deps = (t, extra = {}) => ({
  policy: POLICY, mergeBase: () => 'abcdef123456', exists: () => true, sources: [], hostSample: () => ({ logicalThreads: 16, cpuBusy: 0, totalRamBytes: 64 * 1024 ** 3, freeRamBytes: 48 * 1024 ** 3 }),
  root: tree(t), revParse: () => 'tip0123456789', diff: () => ({ status: 0, stdout: '' }), lsFiles: () => ({ status: 0, stdout: '' }), ...extra,
});

function ctxOf(d, args) { return { args: { root: d.root, ...args }, cwd: d.root }; }

test('without --run the verb prints the selection and starts nothing', async (t) => {
  const calls = [];
  const d = deps(t, { changedFiles: () => ['scripts/lib/core.mjs'], execNode: (a) => { calls.push(a); return passing(); } });
  const out = await testAffected(ctxOf(d, {}), d);
  assert.equal(out.code, 0);
  assert.match(out.text, /^affected: 1 spec file\(s\) for 1 changed file\(s\) since abcdef123/);
  assert.match(out.text, /tests\/core\.spec\.mjs/);
  assert.deepEqual(calls, []);
});

test('--run runs each file once with the four preloads and ends with the counted line', async (t) => {
  const calls = [];
  const d = deps(t, {
    changedFiles: () => ['scripts/lib/core.mjs', 'scripts/lib/other.mjs'],
    execNode: (a) => { calls.push(a); return a.at(-1) === 'tests/unrelated.spec.mjs' ? Promise.resolve({ error: new Error('exit 1'), stdout: 'not ok 1 - boom', stderr: '' }) : passing(); },
  });
  const seen = [];
  d.progress = (line) => seen.push(line);
  const out = await testAffected(ctxOf(d, { run: true, concurrency: 1 }), d);
  assert.equal(out.code, 1);
  assert.equal(seen.length, 3, 'the budget line, then each verdict line as its file ends');
  assert.match(seen[0], /budget/);
  assert.equal(calls.length, 2);
  for (const args of calls) {
    assert.deepEqual(args.filter((a, i) => args[i - 1] === '--import'), ['./tests/setup/low-priority.mjs', './tests/setup/isolated-temp.mjs', './tests/setup/isolated-registry.mjs', './tests/setup/runtime-copies.mjs']);
    assert.equal(args.at(-2), '--test');
  }
  assert.match(out.text, /^PASS tests\/core\.spec\.mjs/m);
  assert.match(out.text, /^FAIL tests\/unrelated\.spec\.mjs/m);
  assert.match(out.text, /not ok 1 - boom/);
  assert.match(out.text.split('\n').at(-1), /^affected: 2 files, 1 pass, 1 fail$/);
});

test('the last line counts FILES; the failing tests inside the failing files are a separate number, printed only when every failing file reported one', async (t) => {
  const summary = (n) => `not ok 1 - boom\nℹ tests 9\nℹ pass ${9 - n}\nℹ fail ${n}\nℹ cancelled 0`;
  const failing = (n) => Promise.resolve({ error: new Error('exit 1'), stdout: summary(n), stderr: '' });
  const files = { 'tests/core.spec.mjs': () => failing(3), 'tests/unrelated.spec.mjs': () => failing(5) };
  const d = deps(t, { changedFiles: () => ['scripts/lib/core.mjs', 'scripts/lib/other.mjs'], execNode: (a) => files[a.at(-1)]?.() ?? passing() });
  const out = await testAffected(ctxOf(d, { run: true }), d);
  assert.equal(out.text.split('\n').at(-1), 'affected: 2 files, 0 pass, 2 fail; failing tests: 8');
  assert.equal(out.data.failedTests, 8);
  const mixed = deps(t, { changedFiles: () => ['scripts/lib/core.mjs', 'scripts/lib/other.mjs'], execNode: (a) => (a.at(-1) === 'tests/core.spec.mjs' ? failing(3) : Promise.resolve({ error: new Error('crash'), stdout: 'no summary', stderr: '' })) });
  const unknown = await testAffected(ctxOf(mixed, { run: true }), mixed);
  assert.equal(unknown.text.split('\n').at(-1), 'affected: 2 files, 0 pass, 2 fail', 'a crashed file has no test count: no number is invented');
  assert.equal(unknown.data.failedTests, null);
});

test('all green exits 0 and an empty selection runs nothing', async (t) => {
  const green = deps(t, { changedFiles: () => ['scripts/lib/core.mjs'], execNode: passing });
  const ok = await testAffected(ctxOf(green, { run: true }), green);
  assert.equal(ok.code, 0);
  assert.match(ok.text.split('\n').at(-1), /^affected: 1 files, 1 pass, 0 fail$/);
  const empty = deps(t, { changedFiles: () => ['docs/readme.md'], execNode: () => assert.fail('nothing is selected') });
  const none = await testAffected(ctxOf(empty, { run: true }), empty);
  assert.equal(none.code, 0);
  assert.equal(none.text, 'affected: 0 files, 0 pass, 0 fail');
});

test('a large selection is announced and still run; --plan names the reason of each file', async (t) => {
  const calls = [];
  const d = deps(t, { policy: { ...POLICY, maxFiles: 1 }, changedFiles: () => ['scripts/lib/core.mjs', 'scripts/lib/other.mjs'], execNode: (a) => { calls.push(a); return passing(); } });
  const shown = await testAffected(ctxOf(d, {}), d);
  assert.equal(shown.code, 0);
  assert.match(shown.text, /above the 1 of an ordinary change: run in parallel shards/);
  const plan = await testAffected(ctxOf(d, { plan: true }), d);
  assert.equal(plan.code, 0);
  assert.deepEqual(calls, [], 'a plan runs nothing');
  assert.ok(plan.data.scope.length > 1 && plan.text.split('\n').filter((line) => line.includes('  <- ')).length > 0, plan.text);
  const ran = await testAffected(ctxOf(d, { run: true, progress: undefined }), { ...d, progress: () => {} });
  assert.equal(ran.code, 0);
  assert.equal(calls.length, ran.data.scope.length, 'every file of a large set runs');
});

test('a run states its budget first, lists the files not started when it ends, and carries a receipt a gate can require', async (t) => {
  const seen = [];
  const slow = () => new Promise((resolve) => setTimeout(() => resolve({ error: null, stdout: 'ok', stderr: '' }), 30));
  const d = deps(t, { policy: { ...POLICY, budgetMs: 10 }, changedFiles: () => ['scripts/lib/core.mjs', 'scripts/lib/other.mjs'], execNode: slow, progress: (line) => seen.push(line), concurrency: 1 });
  const ran = await testAffected({ args: { root: d.root, run: true, concurrency: 1 }, cwd: d.root }, d);
  assert.match(seen[0], /^affected: \d+ file\(s\), concurrency 1, budget \d+ min$/);
  assert.equal(ran.code, 2);
  assert.match(ran.text, /SKIP .* \(budget\)/);
  assert.match(ran.text, /not started inside the/);
  const { receipt } = ran.data;
  assert.deepEqual([receipt.schema, receipt.base, receipt.tip, receipt.clean, receipt.ok], ['starci/affected-receipt@1', 'abcdef123456', 'tip0123456789', true, false]);
  assert.ok(receipt.passed < receipt.total && receipt.total === receipt.files);
  const green = deps(t, { changedFiles: () => ['scripts/lib/core.mjs'], execNode: passing, progress: () => {} });
  const ok = (await testAffected(ctxOf(green, { run: true }), green)).data.receipt;
  assert.deepEqual([ok.ok, ok.passed, ok.total], [true, ok.files, ok.files]);
});

test('--changed names the files itself, and no base without --changed is a usage refusal', async (t) => {
  const d = deps(t, { mergeBase: () => null, execNode: passing });
  const none = await testAffected(ctxOf(d, {}), d);
  assert.equal(none.code, 2);
  assert.match(none.text, /pass --base <ref> or --changed/);
  const named = await testAffected(ctxOf(d, { changed: ['scripts/lib/core.mjs'] }), d);
  assert.equal(named.code, 0);
  assert.match(named.text, /tests\/core\.spec\.mjs/);
});

test('the base is main, else origin/main, unless a ref is named', () => {
  const asked = [];
  const base = baseOf('.', undefined, { mergeBase: (_root, _head, ref) => { asked.push(ref); return ref === 'origin/main' ? 'sha' : null; } });
  assert.equal(base, 'sha');
  assert.deepEqual(asked, ['main', 'origin/main']);
  assert.equal(baseOf('.', 'topic', { mergeBase: (_r, _h, ref) => ref }), 'topic');
});

test('the runner never has more files in flight than the limit and keeps the order of the files', async () => {
  let live = 0, peak = 0;
  const files = ['a', 'b', 'c', 'd', 'e'];
  const results = await runBounded(files, 2, (file) => {
    live += 1; peak = Math.max(peak, live);
    return new Promise((resolve) => setTimeout(() => { live -= 1; resolve(file); }, 5));
  });
  assert.deepEqual(results, files);
  assert.equal(peak, 2);
});

test('a spec file that fails reports the tail of its output, one that passes reports none', async () => {
  const fail = await runSpecFile('.', 'tests/x.spec.mjs', { execNode: () => Promise.resolve({ error: new Error('1'), stdout: Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n'), stderr: '' }) });
  assert.equal(fail.pass, false);
  assert.equal(fail.tail.length, 25);
  assert.equal(fail.tail.at(-1), 'line 39');
  assert.deepEqual((await runSpecFile('.', 'tests/x.spec.mjs', { execNode: passing })).tail, []);
});

test('by symbol (the default) selects the specs of the changed function only; --by file keeps every importer; another value is a usage refusal', async (t) => {
  const d = deps(t, {
    changedFiles: () => ['scripts/lib/pair.mjs'],
    show: () => ({ status: 0, stdout: 'export const a = 1;\nexport const b = 2;\n' }),
  });
  for (const [rel, text] of [['scripts/lib/pair.mjs', 'export const a = 1;\nexport const b = 3;\n'], ['tests/uses-a.spec.mjs', "import { a } from '../scripts/lib/pair.mjs';\n"], ['tests/uses-b.spec.mjs', "import { b } from '../scripts/lib/pair.mjs';\n"]]) {
    fs.writeFileSync(path.join(d.root, rel), text);
  }
  const bySymbol = await testAffected(ctxOf(d, {}), d);
  assert.deepEqual(bySymbol.data.scope, ['tests/uses-b.spec.mjs']);
  assert.match(bySymbol.text, /symbol scripts\/lib\/pair\.mjs#b: 1 spec\(s\)/);
  assert.equal(bySymbol.data.mode, 'symbol');
  const byFile = await testAffected(ctxOf(d, { by: 'file' }), d);
  assert.deepEqual(byFile.data.scope, ['tests/uses-a.spec.mjs', 'tests/uses-b.spec.mjs']);
  assert.equal(byFile.data.mode, 'file');
  const refused = await testAffected(ctxOf(d, { by: 'function' }), d);
  assert.equal(refused.code, 2);
});
