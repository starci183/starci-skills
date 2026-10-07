// land-runtime-root.spec.mjs - every child the land gate spawns verifies the tree being landed: the CLI resolves its runtime root from
// STARCI_RUNTIME before the per-user record (the live checkout), so the gate sets STARCI_RUNTIME to the scratch tree for each child.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packageProofCheck, PACKAGE_PROOF } from '../../scripts/supervisor/land.mjs';
import { fullCheckStep, FULL_CHECK_ENTRY } from '../../scripts/supervisor/land-full-check.mjs';

const SHOW_RUNTIME = 'console.log(`RUNTIME=${process.env.STARCI_RUNTIME}`);\n';

function tree(t, file, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'land-runtime-root-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), body);
  return dir;
}

test('the package proof child gets STARCI_RUNTIME = the scratch tree, whatever the parent had', (t) => {
  const dir = tree(t, PACKAGE_PROOF, SHOW_RUNTIME);
  const before = process.env.STARCI_RUNTIME;
  process.env.STARCI_RUNTIME = 'D:/live/checkout';
  t.after(() => { if (before === undefined) delete process.env.STARCI_RUNTIME; else process.env.STARCI_RUNTIME = before; });
  const step = packageProofCheck({ dir, base: 'HEAD' });
  assert.equal(step.ok, true);
  assert.equal(step.output.trim(), `RUNTIME=${dir}`);
});

test('the full runtime check child gets STARCI_RUNTIME = the scratch tree', (t) => {
  const dir = tree(t, FULL_CHECK_ENTRY, `${SHOW_RUNTIME}process.exit(1);\n`);
  const step = fullCheckStep(dir);
  assert.equal(step.ok, false);
  assert.ok(step.output.includes(`RUNTIME=${dir}`), step.output);
});
