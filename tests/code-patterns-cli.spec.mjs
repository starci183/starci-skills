import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { main } from '../cli/main.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('the public code-pattern command retains typed invalid coverage and exit code', async () => {
  let output = '';
  const code = await main(['code-patterns', 'check'], { out: value => { output += value; }, err: () => {} });
  const result = JSON.parse(output);
  assert.equal(code, 2);
  assert.equal(result.schema, 'starci/code-pattern-check@1');
  assert.equal(result.status, 'invalid');
  assert.equal(result.ok, false);
});

test('public code-pattern entry matches its direct adapter', () => {
  const run = args => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  const direct = run(['scripts/checks/check-scoped-lint.mjs', '--profile', 'nest']);
  const publicCommand = run(['bin/starci.mjs', 'code-patterns', 'check', '--profile', 'nest']);
  assert.equal(direct.status, 2, direct.stderr);
  assert.equal(publicCommand.status, 2, publicCommand.stderr);
  assert.deepEqual(JSON.parse(publicCommand.stdout), JSON.parse(direct.stdout));
});
