// ladder-lint.spec.mjs - runtime lint-family selection and changed-file app lint arguments.
import assert from 'node:assert/strict';
import test from 'node:test';
import { lintChecksForChanges, lintRun, RUNTIME_LINT_CHECKS } from '../../scripts/machine/ladder-lint.mjs';

test('runtime L1 selects lint checks by changed file kind', async () => {
  assert.deepEqual(lintChecksForChanges(['docs/a.md']), ['doc-language']);
  assert.deepEqual(lintChecksForChanges(['tests/a.spec.mjs']), ['helper-once', 'clones', 'export-used', 'env', 'specs']);
  const calls = [];
  const result = await lintRun({ args: { level: 'L1', changed: ['docs/a.md'] }, cwd: '.', env: {} }, {
    repositoryKind: () => 'runtime',
    runStarci: (argv) => { calls.push(argv); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [['runtime', 'check', '--only', 'doc-language']]);
});

test('runtime L2 runs the complete structural lint family', async () => {
  const calls = [];
  const result = await lintRun({ args: { level: 'L2', changed: ['scripts/a.mjs'] }, cwd: '.', env: {} }, {
    repositoryKind: () => 'runtime',
    runStarci: (argv) => { calls.push(argv); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data.scope, RUNTIME_LINT_CHECKS);
  assert.equal(calls.length, RUNTIME_LINT_CHECKS.length);
});

test('app L1 forwards changed files and fix through starci app lint', async () => {
  const calls = [];
  const result = await lintRun({ args: { level: 'L1', changed: ['be/a.ts', 'be/b.ts'], fix: true }, cwd: '.', env: {} }, {
    repositoryKind: () => 'app',
    runStarci: (argv) => { calls.push(argv); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [['app', 'lint', '--changed', 'be/a.ts', '--changed', 'be/b.ts', '--fix']]);
  const refused = await lintRun({ args: { level: 'L1', all: true }, cwd: '.', env: {} }, { repositoryKind: () => 'app' });
  assert.equal(refused.code, 2);
});
