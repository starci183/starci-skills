// ladder-check.spec.mjs - changed self-check selection and the full/app example doors.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRun } from '../../scripts/machine/ladder-check.mjs';

test('runtime L1 runs only the self-check whose manifest run path changed', async () => {
  const calls = [];
  const result = await checkRun({ args: { level: 'L1', changed: ['scripts/checks/check-doc-language.mjs'] }, cwd: '.', env: {} }, {
    repositoryKind: () => 'runtime',
    runtimeSelfChecks: () => [
      { id: 'doc-language', run: 'scripts/checks/check-doc-language.mjs' },
      { id: 'helper-once', run: 'scripts/checks/check-helper-once.mjs' },
    ],
    runStarci: (argv) => { calls.push(argv); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data.scope, ['doc-language']);
  assert.deepEqual(calls, [['runtime', 'check', '--only', 'doc-language']]);
});

test('runtime L2 calls the existing full runtime check entry', async () => {
  const calls = [];
  const result = await checkRun({ args: { level: 'L2', changed: [] }, cwd: '.', env: {} }, {
    repositoryKind: () => 'runtime', changedFiles: () => [],
    runStarci: (argv) => { calls.push(argv); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [['runtime', 'check']]);
  assert.deepEqual(result.data.scope, ['runtime:full']);
});

test('runtime L4 adds app check for every example', async () => {
  const calls = [];
  const result = await checkRun({ args: { level: 'L4' }, cwd: '.', env: {} }, {
    repositoryKind: () => 'runtime', changedFiles: () => [], examples: () => ['examples/a', 'examples/b'],
    runStarci: (argv, options) => { calls.push([argv, options.cwd.replaceAll('\\', '/')]); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(calls.map(([argv]) => argv), [['runtime', 'check'], ['app', 'check'], ['app', 'check']]);
  assert.deepEqual(result.data.scope, ['runtime:full', 'examples/a:app-check', 'examples/b:app-check']);
});
