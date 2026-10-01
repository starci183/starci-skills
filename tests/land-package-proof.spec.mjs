import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_PROOF, packageProofCheck } from '../scripts/supervisor/land.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

// land.mjs packageProofCheck: a land runs scripts/checks/package-clean-test.mjs --base <base> in its scratch, so every
// published package the land changes is proven from a clean install; a red (1) or unrun (2) proof refuses the land.

const scratch = (t, body) => {
  const dir = mkdtemp(t, 'starci-land-proof-');
  if (body !== null) { fs.mkdirSync(path.dirname(path.join(dir, PACKAGE_PROOF)), { recursive: true }); fs.writeFileSync(path.join(dir, PACKAGE_PROOF), body); }
  return dir;
};

test('a candidate without the proof script has no package proof check', (t) => {
  assert.equal(packageProofCheck({ dir: scratch(t, null), base: 'b' }), null);
});

test('the proof runs in the scratch against the land base, and its exit decides the check', (t) => {
  const dir = scratch(t, '');
  const calls = [];
  const runner = (status) => (cmd, args, opts) => { calls.push({ cmd, args, cwd: opts.cwd }); return { ok: status === 0, status, stdout: `package-clean-test: exit ${status}\n`, stderr: '', error: null }; };
  const green = packageProofCheck({ dir, base: 'abc123', runner: runner(0) });
  assert.deepEqual(calls[0], { cmd: process.execPath, args: [PACKAGE_PROOF, '--base', 'abc123'], cwd: dir });
  assert.equal(green.name, 'package-clean-test');
  assert.equal(green.ok, true);
  assert.equal(packageProofCheck({ dir, base: 'abc123', runner: runner(1) }).ok, false);
  assert.equal(packageProofCheck({ dir, base: 'abc123', runner: runner(2) }).ok, false, 'a proof that could not run never passes');
});

test('the real runner reports a red package with its output', (t) => {
  const dir = scratch(t, "process.stdout.write('package-clean-test: @starci/x RED PACKAGE_TEST_RED (npm ci, 1s)\\n'); process.exitCode = 1;\n");
  const check = packageProofCheck({ dir, base: 'abc123' });
  assert.equal(check.ok, false);
  assert.match(check.output, /@starci\/x RED PACKAGE_TEST_RED/);
});
