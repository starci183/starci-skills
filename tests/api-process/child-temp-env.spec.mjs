import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tempChildEnv, TEMP_ROOT_ENV } from '../../engine/temp-root.mjs';
import { withTempEnv } from '../../engine/temp-root.mjs';
import { spawnCapture } from '../../scripts/api/process/spawn-capture.mjs';
import { runProgram } from '../../scripts/api/process/run-program.mjs';
import { nodeSpawn } from '../../scripts/api/node/lib.mjs';
import { gitSpawn } from '../../scripts/api/git/lib.mjs';
import { npmSpawn } from '../../scripts/api/npm/lib.mjs';

// The children the runtime starts through scripts/api/ get TEMP, TMP and TMPDIR set to the temp root.
const fresh = (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-temp-env-spec-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root: path.join(base, 'configured') };
};

test('tempChildEnv points TEMP, TMP and TMPDIR at the temp root and keeps the rest', (t) => {
  const { root } = fresh(t);
  const out = tempChildEnv({ PATH: 'p', KEEP: '1', TEMP: path.join(os.tmpdir(), 'other'), [TEMP_ROOT_ENV]: root });
  assert.deepEqual([out.TEMP, out.TMP, out.TMPDIR], [path.resolve(root), path.resolve(root), path.resolve(root)]);
  assert.equal(out.KEEP, '1');
  assert.equal(out.PATH, 'p');
  assert.equal(fs.existsSync(root), false, 'resolving the env makes no directory: the base tier writes nothing');
});

test('withTempEnv replaces only env; an absent env is the process environment', (t) => {
  const { root } = fresh(t);
  const opts = withTempEnv({ cwd: 'x', timeout: 5, env: { [TEMP_ROOT_ENV]: root } });
  assert.equal(opts.cwd, 'x');
  assert.equal(opts.timeout, 5);
  assert.equal(opts.env.TMPDIR, path.resolve(root));
  assert.equal(withTempEnv().env.TEMP, path.resolve(process.env[TEMP_ROOT_ENV] || os.tmpdir()));
});

test('spawnCapture hands its child the temp root', async (t) => {
  const { root } = fresh(t);
  let seen = null;
  const spawnChild = (cmd, args, options) => { seen = options; throw new Error('stop'); };
  await spawnCapture('x', [], { env: { [TEMP_ROOT_ENV]: root }, spawnChild });
  assert.equal(seen.env.TEMP, path.resolve(root));
  assert.equal(seen.env.TMP, path.resolve(root));
  assert.equal(seen.env.TMPDIR, path.resolve(root));
});

test('real children see the temp root: node, a program run, git and npm', (t) => {
  const { root } = fresh(t);
  const env = { ...process.env, [TEMP_ROOT_ENV]: root };
  const probe = ['-e', 'console.log(require("os").tmpdir())'];
  assert.equal(path.resolve(nodeSpawn(probe, { env }).stdout.trim()), path.resolve(root), 'node');
  assert.equal(path.resolve(runProgram(process.execPath, probe, { env }).stdout.trim()), path.resolve(root), 'program');
  assert.equal(gitSpawn('git', ['--version'], { env }).status, 0);
  assert.equal(npmSpawn(['--version'], { env }).status, 0);
});
