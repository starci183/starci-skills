// ladder-test.spec.mjs - level model, selection refusals, lock/log behavior and the one serial red re-run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { testRun } from '../../scripts/machine/ladder-test.mjs';
import { LEVELS, scopeFor } from '../../scripts/machine/test-ladder.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const rows = [
  ['L0', [], ['staged-files', 'format'], ['work-hygiene'], []],
  ['L1', ['changed-unit', 'importers'], ['changed-files'], ['checks-touching-change'], ['projects-holding-changed-files']],
  ['L2', ['dependent-specs'], ['changed-files'], ['full'], ['affected-projects']],
  ['L3', ['dependent-specs', 'affected-integration', 'affected-contract', 'affected-e2e'], ['changed-files'], ['full'], ['affected-projects']],
  ['L4', ['all-runtime', 'all-packages', 'all-example-unit', 'all-example-integration', 'all-example-e2e', 'all-example-contract'], ['whole-repo', 'stylelint'], ['full', 'every-example', 'sonar-zero', 'coverage-per-component'], ['every-project']],
  ['L5', ['all-runtime', 'all-packages', 'all-example-unit', 'all-example-integration', 'all-example-e2e', 'all-example-contract'], ['whole-repo', 'stylelint'], ['full', 'every-example', 'sonar-zero', 'coverage-per-component'], ['every-project']],
];

test('scopeFor is the table-driven L0-L5 source of truth', () => {
  assert.deepEqual(LEVELS, rows.map(([level]) => level));
  for (const [level, specs, lint, checks, typecheck] of rows) assert.deepEqual(scopeFor(level), { specs, lint, checks, typecheck });
  assert.throws(() => scopeFor('L6'), /unknown test ladder level/);
});

const context = (args, extra = {}) => ({ args, cwd: process.cwd(), role: 'lead', env: {}, ...extra });
const selection = (overrides = {}) => ({
  trackedFiles: (_root, glob) => glob === '*.spec.mjs' ? ['tests/a.spec.mjs', 'tests/b.spec.mjs'] : [],
  specsDependingOn: () => ['tests/a.spec.mjs'],
  changedFiles: () => ['scripts/a.mjs'],
  tip: () => '123456789',
  ...overrides,
});

test('test run refuses L4 outside release cut, L5 locally and all-spec L1 selection', async () => {
  const l4 = await testRun(context({ level: 'L4' }), selection());
  assert.equal(l4.code, 2);
  assert.match(l4.text, /starci release cut/);
  const l5 = await testRun(context({ level: 'L5' }), selection());
  assert.equal(l5.code, 2);
  assert.match(l5.text, /CI only/);
  const glob = await testRun(context({ level: 'L1', spec: ['tests/**/*.spec.mjs'] }), selection());
  assert.equal(glob.code, 2);
  assert.match(glob.text, /glob of all specs/);
  const all = await testRun(context({ level: 'L1', spec: ['tests/a.spec.mjs', 'tests/b.spec.mjs'] }), selection());
  assert.equal(all.code, 2);
  assert.match(all.text, /every spec/);
});

test('test run refuses a dirty L2 tree and zero specs for code', async () => {
  const dirty = await testRun(context({ level: 'L2', against: 'main' }), selection({ cleanTree: () => false }));
  assert.equal(dirty.code, 2);
  assert.match(dirty.text, /commit first/);
  const none = await testRun(context({ level: 'L1' }), selection({ trackedFiles: () => [], specsDependingOn: () => [] }));
  assert.equal(none.code, 2);
  assert.match(none.text, /0 specs selected/);
});

test('L1 refuses more than 40 selected files with a narrowing hint', async () => {
  const many = Array.from({ length: 41 }, (_, index) => `tests/${index}.spec.mjs`);
  const result = await testRun(context({ level: 'L1' }), selection({
    trackedFiles: () => [...many, 'tests/unselected.spec.mjs'],
    specsDependingOn: () => many,
  }));
  assert.equal(result.code, 2);
  assert.match(result.text, /limit 40.*narrow/);
});

test('L2 holds the test-l2 lock, checks first, logs preverify-tip7 and re-runs only red files once serially', async (t) => {
  const tempDir = mkdtemp(t, 'starci-ladder-test-');
  const calls = [];
  const result = await testRun(context({ level: 'L2', against: 'main', concurrency: 3 }), selection({
    tempDir,
    cleanTree: () => true,
    isAncestor: () => true,
    changedAgainst: () => ['scripts/a.mjs'],
    checkRun: async () => { calls.push('check'); return { code: 0, text: 'check green' }; },
    underHostLock: async (options, fn) => { calls.push(`lock:${options.purpose}`); return await fn(); },
    runTests: ({ files, concurrency }) => {
      calls.push(`spec:${concurrency}:${files.join(',')}`);
      return concurrency === 3
        ? { ok: false, status: 1, stdout: 'red', stderr: '', failedFiles: ['tests/a.spec.mjs'], counts: { tests: 1, pass: 0, fail: 1 } }
        : { ok: true, status: 0, stdout: 'green', stderr: '', failedFiles: [], counts: { tests: 1, pass: 1, fail: 0 } };
    },
  }));
  assert.equal(result.code, 0);
  assert.deepEqual(calls, ['lock:test-l2', 'check', 'spec:3:tests/a.spec.mjs', 'spec:1:tests/a.spec.mjs']);
  assert.equal(path.basename(result.data.log), 'preverify-1234567.txt');
  assert.deepEqual(result.data.flakes, ['tests/a.spec.mjs']);
  assert.match(fs.readFileSync(result.data.log, 'utf8'), /red re-run concurrency=1/);
});

test('L1 default selection follows a real temporary Git change through spec-deps', async (t) => {
  const root = mkdtemp(t, 'starci-ladder-git-');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'scripts', 'unit.mjs'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'tests', 'unit.spec.mjs'), "import { value } from '../scripts/unit.mjs';\nvoid value;\n");
  fs.writeFileSync(path.join(root, 'tests', 'other.spec.mjs'), 'void 0;\n');
  assert.equal(runGit(['init'], { cwd: root }).status, 0);
  assert.equal(runGit(['add', '.'], { cwd: root }).status, 0);
  assert.equal(runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'], { cwd: root }).status, 0);
  fs.writeFileSync(path.join(root, 'scripts', 'unit.mjs'), 'export const value = 2;\n');
  const runs = [];
  const result = await testRun({ args: { level: 'L1' }, cwd: root, role: 'worker', env: {} }, {
    tempDir: root,
    runTests: ({ files }) => { runs.push(files); return { ok: true, status: 0, stdout: '', stderr: '', counts: { tests: 1, pass: 1, fail: 0 } }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data.changed, ['scripts/unit.mjs']);
  assert.deepEqual(runs, [['tests/unit.spec.mjs']]);
});
