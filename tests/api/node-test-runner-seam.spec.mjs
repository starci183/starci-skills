// A child `node --test` that inherits NODE_TEST_CONTEXT reports to its parent and exits 0 whatever its tests did. This spec runs INSIDE a test process (the variable is set here),
// and proves that every launcher of scripts/api/node returns a RED child as red, while a child that is not a test runner keeps the mark (a spec's children stay isolated).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runNode } from '../../scripts/api/node/run-node.mjs';
import { execNode } from '../../scripts/api/node/exec-node.mjs';
import { spawnNode } from '../../scripts/api/node/spawn-node.mjs';
import { withoutTestRunner } from '../../scripts/lib/env.mjs';
import { checkTestSpawnSeam } from '../../scripts/checks/check-test-spawn-seam.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const temp = (t) => {
  const dir = makeTempDir('starci-test-seam-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  return dir;
};
const redSpec = (dir) => {
  const file = path.join(dir, 'red.spec.mjs');
  fs.writeFileSync(file, "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('red', () => assert.equal(1, 2));\n");
  return file;
};

test('the premise: this spec runs inside a test process, and a raw nested node --test passes its red test', (t) => {
  assert.ok(process.env.NODE_TEST_CONTEXT, 'the variable is set here');
  const raw = spawnSync(process.execPath, ['--test', redSpec(temp(t))], { encoding: 'utf8' });
  assert.equal(raw.status, 0, 'the hazard: a nested runner that inherits the mark exits 0 on a red test');
});

test('runNode, execNode and spawnNode return a red child as red from inside a test', async (t) => {
  const file = redSpec(temp(t));
  assert.notEqual(runNode(['--test', file]).status, 0, 'runNode');
  const executed = await execNode(['--test', file]);
  assert.ok(executed.error, 'execNode reports the failure');
  const status = await new Promise((resolve) => { spawnNode(['--test', file], { stdio: 'ignore' }).once('exit', (code) => resolve(code)); });
  assert.notEqual(status, 0, 'spawnNode');
});

test('a child that is not a test runner keeps the mark: the spec isolation of its children is untouched', () => {
  const seen = runNode(['-e', 'process.stdout.write(String(Boolean(process.env.NODE_TEST_CONTEXT)))']);
  assert.equal(seen.stdout, 'true');
  assert.equal('NODE_TEST_CONTEXT' in withoutTestRunner({ NODE_TEST_CONTEXT: 'child-v8', KEEP: '1' }), false);
  assert.equal(withoutTestRunner({ NODE_TEST_CONTEXT: 'child-v8', KEEP: '1' }).KEEP, '1');
});

test('the self-check: the shipped tree is whole, and a file that carries --test and spawns itself is refused', (t) => {
  assert.deepEqual(checkTestSpawnSeam(skillRoot), []);
  const dir = temp(t);
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(dir, 'scripts', 'api', 'node'), { recursive: true });
  fs.copyFileSync(path.join(skillRoot, 'scripts', 'api', 'node', 'lib.mjs'), path.join(dir, 'scripts', 'api', 'node', 'lib.mjs'));
  fs.writeFileSync(path.join(dir, 'scripts', 'rogue.mjs'), "import { spawnSync } from 'node:child_process';\nexport const run = () => spawnSync(process.execPath, ['--test', 'x.spec.mjs']);\n");
  fs.writeFileSync(path.join(dir, 'scripts', 'judge.mjs'), "export const isTest = (args) => args.includes('--test');\n");
  git('add', '-A');
  assert.deepEqual(checkTestSpawnSeam(dir).map((f) => f.path), ['scripts/rogue.mjs']);
  fs.writeFileSync(path.join(dir, 'scripts', 'api', 'node', 'lib.mjs'), fs.readFileSync(path.join(dir, 'scripts', 'api', 'node', 'lib.mjs'), 'utf8').replace('...forChild(args, options)', '...options'));
  git('add', '-A');
  assert.ok(checkTestSpawnSeam(dir).some((f) => f.path === 'scripts/api/node/lib.mjs'), 'a launcher that does not clear the mark is refused');
});
