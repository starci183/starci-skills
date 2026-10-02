import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkRuntimeMain,
  runRuntimeOnly,
  runtimeOnlyChecks,
} from '../../scripts/checks/check-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the --only inventory is the live check directory plus retained self-check ids', () => {
  const checks = runtimeOnlyChecks(root);
  const names = checks.map((check) => check.name);
  const directoryNames = fs.readdirSync(path.join(root, 'scripts', 'checks'))
    .map((name) => /^check-([a-z0-9-]+)\.mjs$/.exec(name)?.[1])
    .filter((name) => name && name !== 'runtime');

  assert.deepEqual(names, [...names].sort());
  for (const name of directoryNames) assert.ok(names.includes(name), name);
  assert.equal(names.includes('runtime'), false, 'the complete-suite driver is not a single check');
  assert.ok(names.includes('ops-registry'));
  assert.ok(names.includes('cli-catalog-drift'));
  assert.ok(names.includes('work-deep'));
  assert.equal(names.includes('lint-check'), false, 'the one-off lint script is not invoked by tracked docs');
});

test('a retained self-check keeps configured args and appends pass-through args unchanged', () => {
  let call;
  const exitCode = runRuntimeOnly('cli-catalog-drift', ['--root', 'fixture'], {
    root,
    runner: (script, args, options) => {
      call = { script, args, options };
      return 7;
    },
  });

  assert.equal(exitCode, 7);
  assert.match(call.script, /scripts[\\/]cli[\\/]gen-catalog\.mjs$/);
  assert.deepEqual(call.args, ['--check', '--root', 'fixture']);
  assert.equal(call.options.cwd, root);
});

test('the CLI strips only the pass-through delimiter before running one check', () => {
  let call;
  const exitCode = checkRuntimeMain(['--only', 'example-yaml', '--', 'examples', '--strict'], {
    root,
    runner: (script, args) => {
      call = { script, args };
      return 0;
    },
  });

  assert.equal(exitCode, 0);
  assert.match(call.script, /scripts[\\/]checks[\\/]check-example-yaml\.mjs$/);
  assert.deepEqual(call.args, ['examples', '--strict']);
});

test('the CLI accepts the catalog validator\'s --only=<name> spelling', () => {
  let call;
  const exitCode = checkRuntimeMain(['--only=example-yaml', '--', 'examples'], {
    root,
    runner: (script, args) => {
      call = { script, args };
      return 0;
    },
  });

  assert.equal(exitCode, 0);
  assert.match(call.script, /scripts[\\/]checks[\\/]check-example-yaml\.mjs$/);
  assert.deepEqual(call.args, ['examples']);
});

test('an unknown or missing --only name exits 2 and lists dynamic valid names', () => {
  for (const argv of [['--only', 'not-a-check'], ['--only']]) {
    let stderr = '';
    const exitCode = checkRuntimeMain(argv, { root, stderr: (text) => { stderr += text; } });
    assert.equal(exitCode, 2);
    assert.match(stderr, /Valid --only names:/);
    assert.match(stderr, /cli-parity/);
    assert.match(stderr, /ops-registry/);
  }
});
