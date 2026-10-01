import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanOpeners, sourceOf } from '../scripts/checks/check-db-openers.mjs';

const OPEN = "import { DatabaseSync } from 'node:sqlite';\nexport const open = (file) => new DatabaseSync(file);\n";

test('a generated runtime mirror of a DB module is that DB module; a mirrored or source non-DB opener is still refused', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-db-openers-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    'engine/machine-db.mjs': OPEN,
    'engine/ledger-db.mjs': OPEN,
    'packages/hfs/runtime/engine/machine-db.mjs': OPEN,
    'packages/eslint/be/runtime/engine/ledger-db.mjs': OPEN,
    'packages/hfs/runtime/scripts/rogue.mjs': OPEN,
    'scripts/rogue.mjs': OPEN,
    'packages/other/engine/machine-db.mjs': OPEN,
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  const result = scanOpeners(root);
  assert.equal(result.ok, false);
  assert.deepEqual([...new Set(result.forbidden.map((f) => f.file))].sort(),
    ['packages/hfs/runtime/scripts/rogue.mjs', 'packages/other/engine/machine-db.mjs', 'scripts/rogue.mjs']);
  assert.equal(sourceOf('packages/hfs/runtime/engine/machine-db.mjs'), 'engine/machine-db.mjs');
  assert.equal(sourceOf('packages/other/engine/machine-db.mjs'), 'packages/other/engine/machine-db.mjs', 'only the sync-runtime bundles are mirrors');
});
