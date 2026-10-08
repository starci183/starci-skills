import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkRuntimeMain,
  runRuntimeOnly,
  runtimeOnlyChecks,
  verdictLine,
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

// A lane and the lead both read "self-checks: 44 of 44 passed" as green while the runtime HFS stage failed and the check exited 1: the last line carries the whole verdict.
test('the last line of the check states the whole verdict: a failed HFS or syntax stage is never hidden behind the self-check count', () => {
  assert.equal(verdictLine({ syntaxFailed: 0, hfsFindings: 0, selfFailed: [], selfRun: 45 }), 'check: ok — runtime HFS clean; self-checks 45 of 45');
  assert.equal(verdictLine({ syntaxFailed: 0, hfsFindings: 2, selfFailed: ['env'], selfRun: 45 }), 'check: FAILED — runtime HFS 2 finding(s); self-checks 44 of 45 (failed: env)');
  assert.equal(verdictLine({ syntaxFailed: 0, hfsFindings: 1, selfFailed: [], selfRun: 44 }), 'check: FAILED — runtime HFS 1 finding(s); self-checks 44 of 44');
  assert.equal(verdictLine({ syntaxFailed: 3, hfsFindings: 0, selfFailed: [], selfRun: 44 }), 'check: FAILED — syntax 3 file(s); self-checks 44 of 44');
});
