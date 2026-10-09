// spec-cache.spec.mjs - the store of proven green runs and the cache in front of `starci test affected --run`: a green run at a key is reused, nothing else is, and the receipt counts what was reused.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { openSpecCache } from '../../scripts/supervisor/spec-cache.mjs';
import { withSpecCache } from '../../scripts/supervisor/spec-cache-run.mjs';
import { testAffected } from '../../scripts/supervisor/affected-test.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const POLICY = { maxFiles: 10, dataRoots: ['modules'], symbolDepth: 4, budgetMs: 600_000, generated: [], specCache: { keepDays: 30 } };
const keyer = (keys) => () => ({ keyOf: (file) => ({ key: keys[file], tier: 'narrow' }) });
const green = (file) => Promise.resolve({ file, pass: true, ms: 5, tail: [], failedTests: 0 });
const red = (file) => Promise.resolve({ file, pass: false, ms: 5, tail: ['boom'], failedTests: 1 });

test('the store answers only for the same key, node version and schema; a pass is a record, a damaged file is a miss', (t) => {
  const root = mkdtemp(t, 'starci-spec-cache-');
  const cache = openSpecCache({ root, keepDays: 30 });
  assert.equal(cache.lookup('k1'), null);
  cache.record('k1', { file: 'tests/a.spec.mjs', tier: 'narrow', ms: 12 });
  assert.equal(cache.lookup('k1').file, 'tests/a.spec.mjs');
  assert.equal(cache.lookup('k2'), null, 'another key');
  assert.equal(openSpecCache({ root, keepDays: 30, nodeVersion: 'v0.0.1' }).lookup('k1'), null, 'another node version is never trusted');
  const file = path.join(root, '.runtime', 'spec-cache', 'k1.json');
  fs.writeFileSync(file, JSON.stringify({ schema: 'starci/spec-cache@1', key: 'other', node: process.version }));
  assert.equal(cache.lookup('k1'), null, 'a record naming another key');
  fs.writeFileSync(file, 'not json');
  assert.equal(cache.lookup('k1'), null, 'a torn file');
});

test('a record unused for keepDays is pruned, a fresh one stays', (t) => {
  const root = mkdtemp(t, 'starci-spec-cache-');
  const cache = openSpecCache({ root, keepDays: 1 });
  cache.record('old', { file: 'a', tier: 'narrow', ms: 1 });
  cache.record('new', { file: 'b', tier: 'narrow', ms: 1 });
  const old = path.join(root, '.runtime', 'spec-cache', 'old.json');
  const past = new Date(Date.now() - 3 * 86_400_000);
  fs.utimesSync(old, past, past);
  assert.equal(cache.prune(), 1);
  assert.equal(cache.lookup('old'), null);
  assert.ok(cache.lookup('new'));
});

test('a green file is run once and reused while its key holds; a red file is never recorded; a new key runs again', async (t) => {
  const root = mkdtemp(t, 'starci-spec-cache-');
  const ran = [];
  const files = ['tests/a.spec.mjs', 'tests/b.spec.mjs'];
  const wrap = (keys, run) => withSpecCache({ root, files, policy: POLICY, preloads: [], deps: { createKeyer: keyer(keys) }, runOne: (file) => { ran.push(file); return run(file); } });
  const first = wrap({ 'tests/a.spec.mjs': 'a1', 'tests/b.spec.mjs': 'b1' }, (file) => (file.includes('b.') ? red(file) : green(file)));
  assert.equal(first.off, null);
  assert.equal((await first.runOne('tests/a.spec.mjs')).reused, undefined);
  assert.equal((await first.runOne('tests/b.spec.mjs')).pass, false);
  ran.length = 0;
  const second = wrap({ 'tests/a.spec.mjs': 'a1', 'tests/b.spec.mjs': 'b1' }, green);
  const reused = await second.runOne('tests/a.spec.mjs');
  assert.deepEqual([reused.pass, reused.reused, reused.ms], [true, true, 0]);
  assert.deepEqual(ran, [], 'the green file was not run again');
  assert.equal((await second.runOne('tests/b.spec.mjs')).reused, undefined, 'the red file runs again');
  const third = wrap({ 'tests/a.spec.mjs': 'a2', 'tests/b.spec.mjs': 'b1' }, green);
  assert.equal((await third.runOne('tests/a.spec.mjs')).reused, undefined, 'a changed key is a miss');
});

test('--no-cache and a key that cannot be computed run every file for real and say so', async (t) => {
  const root = mkdtemp(t, 'starci-spec-cache-');
  const cache = openSpecCache({ root, keepDays: 30 });
  cache.record('k', { file: 'tests/a.spec.mjs', tier: 'narrow', ms: 1 });
  const off = withSpecCache({ root, files: ['tests/a.spec.mjs'], policy: POLICY, preloads: [], disabled: true, deps: { createKeyer: keyer({ 'tests/a.spec.mjs': 'k' }) }, runOne: green });
  assert.equal(off.off, '--no-cache');
  assert.equal((await off.runOne('tests/a.spec.mjs')).reused, undefined);
  const broken = withSpecCache({ root, files: ['tests/a.spec.mjs'], policy: POLICY, preloads: [], deps: { createKeyer: () => { throw new Error('no git here'); } }, runOne: green });
  assert.match(broken.off, /the cache key could not be computed \(no git here\)/);
  assert.equal((await broken.runOne('tests/a.spec.mjs')).reused, undefined);
});

function tree(t) {
  const root = mkdtemp(t, 'starci-affected-cache-');
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put('scripts/lib/core.mjs', 'export const core = 1;\n');
  put('tests/core.spec.mjs', "import { core } from '../scripts/lib/core.mjs';\n");
  put('tests/second.spec.mjs', "import { core } from '../scripts/lib/core.mjs';\n");
  return { root, put };
}

test('test affected --run reuses an unchanged green file, counts it in the receipt and the last line, and --no-cache runs everything', async (t) => {
  const { root, put } = tree(t);
  const calls = [];
  const d = {
    policy: POLICY, mergeBase: () => 'abcdef123456', exists: () => true, sources: [], root, revParse: () => 'tip0123456789', diff: () => ({ status: 0, stdout: '' }), lsFiles: () => ({ status: 0, stdout: '' }),
    hostSample: () => ({ logicalThreads: 16, cpuBusy: 0, totalRamBytes: 64 * 1024 ** 3, freeRamBytes: 48 * 1024 ** 3 }), changedFiles: () => ['scripts/lib/core.mjs'], progress: () => {},
    execNode: (a) => { calls.push(a.at(-1)); return Promise.resolve({ error: null, stdout: 'ok', stderr: '' }); },
  };
  const ctx = (args) => ({ args: { root, run: true, concurrency: 1, ...args }, cwd: root });
  const first = await testAffected(ctx({}), d);
  assert.equal(first.code, 0);
  assert.equal(first.data.receipt.reused, 0);
  assert.deepEqual(calls.sort(), ['tests/core.spec.mjs', 'tests/second.spec.mjs']);
  calls.length = 0;
  put('tests/second.spec.mjs', "import { core } from '../scripts/lib/core.mjs';\n// edited\n");
  const second = await testAffected(ctx({}), d);
  assert.deepEqual(calls, ['tests/second.spec.mjs'], 'only the edited spec runs');
  assert.equal(second.data.receipt.reused, 1);
  assert.equal(second.data.receipt.ok, true);
  assert.deepEqual(second.data.results.map((r) => [r.file, Boolean(r.reused)]), [['tests/core.spec.mjs', true], ['tests/second.spec.mjs', false]]);
  assert.match(second.text, /^REUSED tests\/core\.spec\.mjs \(green at an unchanged key since /m);
  assert.match(second.text.split('\n').at(-1), /^affected: 2 files, 2 pass \(1 reused from a proven green run at an unchanged key\), 0 fail$/);
  calls.length = 0;
  const forced = await testAffected(ctx({ 'no-cache': true }), d);
  assert.equal(calls.length, 2);
  assert.equal(forced.data.receipt.reused, 0);
});

test('a run that ends on its time budget leaves its green files: the next run reuses them and finishes the rest', async (t) => {
  const { root } = tree(t);
  const slow = (calls) => (a) => { calls.push(a.at(-1)); return new Promise((resolve) => { setTimeout(() => resolve({ error: null, stdout: 'ok', stderr: '' }), 60); }); };
  const base = { mergeBase: () => 'abcdef123456', exists: () => true, sources: [], root, revParse: () => 'tip0123456789', diff: () => ({ status: 0, stdout: '' }), lsFiles: () => ({ status: 0, stdout: '' }),
    hostSample: () => ({ logicalThreads: 16, cpuBusy: 0, totalRamBytes: 64 * 1024 ** 3, freeRamBytes: 48 * 1024 ** 3 }), changedFiles: () => ['scripts/lib/core.mjs'], progress: () => {} };
  const ctx = { args: { root, run: true, concurrency: 1 }, cwd: root };
  const firstCalls = [];
  const first = await testAffected(ctx, { ...base, execNode: slow(firstCalls), policy: { ...POLICY, budgetMs: 30 } });
  assert.equal(first.code, 2, 'the budget ended with a file not started');
  assert.equal(firstCalls.length, 1);
  const secondCalls = [];
  const second = await testAffected(ctx, { ...base, execNode: slow(secondCalls), policy: POLICY });
  assert.equal(second.code, 0, second.text);
  assert.equal(second.data.receipt.reused, 1, 'the file the first run finished is reused');
  assert.deepEqual(secondCalls, [firstCalls[0] === 'tests/core.spec.mjs' ? 'tests/second.spec.mjs' : 'tests/core.spec.mjs'], 'only the file the first run never started is run');
});
