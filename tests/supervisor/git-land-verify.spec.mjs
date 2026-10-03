// git-land-verify.spec.mjs — delta dependency selection, prior-red recovery, empty-selection refusal, and one rerun.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { checkCounts, runLandFullCheck, runLandSpecs, selectLandSpecs, verifyLandSpecs } from '../../scripts/supervisor/git-land-verify.mjs';
import { runLandGate } from '../../scripts/supervisor/git-land-gate.mjs';

const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

test('a delta selects dependencies after verified plus every prior-red spec file', (t) => {
  const root = mkdtemp(t, 'starci-land-delta-');
  write(root, 'scripts/a.mjs', 'export const a = 1;\n');
  write(root, 'scripts/b.mjs', 'export const b = 1;\n');
  write(root, 'tests/a.spec.mjs', "import { a } from '../scripts/a.mjs';\ntest('a works', () => a);\n");
  write(root, 'tests/b.spec.mjs', "import { b } from '../scripts/b.mjs';\ntest('b works', () => b);\n");
  write(root, 'tests/red.spec.mjs', "test('prior red title', () => {});\n");
  const log = path.join(root, 'verified.log');
  fs.writeFileSync(log, '✖ prior red title (2ms)\n');
  const selected = selectLandSpecs({ worktree: root, changed: ['scripts/b.mjs'], verifiedLog: log });
  assert.deepEqual(selected.files, ['tests/b.spec.mjs', 'tests/red.spec.mjs']);
  assert.deepEqual(selected.priorRed, ['tests/red.spec.mjs']);
});

test('code changed with zero selected specs is a selection refusal, never a pass', (t) => {
  const root = mkdtemp(t, 'starci-land-empty-');
  write(root, 'scripts/uncovered.mjs', 'export const uncovered = true;\n');
  const out = verifyLandSpecs({ worktree: root, tip: '1234567890', changed: ['scripts/uncovered.mjs'], concurrency: 4 }, { specFiles: () => [] });
  assert.equal(out.ok, false);
  assert.equal(out.cause, 'selection-empty');
  assert.match(out.detail, /0 specs/);
});

test('a red run maps its title to one file and reruns that file once, serially', (t) => {
  const root = mkdtemp(t, 'starci-land-rerun-'), calls = [], tip = 'abcdef0123456789';
  write(root, 'tests/red.spec.mjs', "test('flaky title', () => {});\n");
  write(root, 'tests/green.spec.mjs', "test('green title', () => {});\n");
  const runNode = (args) => {
    calls.push(args);
    return calls.length === 1 ? { status: 1, stdout: '✖ flaky title (4ms)\n', stderr: '' } : { status: 0, stdout: 'ℹ pass 1\n', stderr: '' };
  };
  const out = runLandSpecs({ worktree: root, tip, files: ['tests/green.spec.mjs', 'tests/red.spec.mjs'], concurrency: 4 }, { runNode });
  t.after(() => fs.rmSync(out.log, { force: true }));
  assert.equal(out.ok, true);
  assert.deepEqual([out.selected, out.pass, out.rerun], [2, 2, 1]);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('--test-concurrency=4'));
  assert.ok(calls[1].includes('--test-concurrency=1'));
  assert.deepEqual(calls[1].slice(-1), ['tests/red.spec.mjs']);
  assert.doesNotMatch(calls[1].join(' '), /green\.spec/);
  assert.match(fs.readFileSync(out.log, 'utf8'), /targeted rerun/);
});

test('a red targeted rerun is attempted only once and remains a refusal', (t) => {
  const root = mkdtemp(t, 'starci-land-still-red-'), calls = [], tip = 'fedcba0987654321';
  write(root, 'tests/red.spec.mjs', "test('stable failure', () => {});\n");
  const out = runLandSpecs({ worktree: root, tip, files: ['tests/red.spec.mjs'], concurrency: 3 }, { runNode: (args) => { calls.push(args); return { status: 1, stdout: '✖ stable failure (1ms)\n', stderr: '' }; } });
  t.after(() => fs.rmSync(out.log, { force: true }));
  assert.equal(out.ok, false);
  assert.equal(out.cause, 'red-after-rerun');
  assert.equal(calls.length, 2);
});

test('full-check counts drive the Check trailer and a missing entry is red', () => {
  const full = 'node --check: 12 files, 0 failed\nOK: runtime HFS manifest - 3 tracked files, 2 sources\nself-checks: 4 of 4 passed\n';
  assert.deepEqual(checkCounts(full, true), { pass: 17, total: 17 });
  const green = runLandFullCheck('unused', { fullCheck: () => ({ ok: true, full, output: full }) });
  assert.deepEqual([green.ok, green.pass, green.total], [true, 17, 17]);
  const missing = runLandFullCheck('unused', { fullCheck: () => ({ ok: true, skipped: true }) });
  assert.equal(missing.ok, false);
});

test('the ported land gate refuses a changed source import that does not resolve', (t) => {
  const root = mkdtemp(t, 'starci-land-gate-'), primary = path.join(root, 'primary'), lane = path.join(root, 'lane');
  fs.mkdirSync(primary);
  fs.mkdirSync(lane);
  write(lane, 'scripts/bad.mjs', "import { missing } from './missing.mjs';\nexport { missing };\n");
  const out = runLandGate({ worktree: lane, ref: 'lane' }, {
    mergeBase: () => 'base',
    diff: () => ({ status: 0, stdout: 'scripts/bad.mjs\n', stderr: '' }),
    primaryWorktreeOf: () => ({ ok: true, primary }),
    env: { SWC_NATIVE_BINDING_CACHE: path.join(root, 'swc-cache') },
  });
  assert.equal(out.ok, false);
  assert.match(out.problems.join('\n'), /does not resolve/);
});
