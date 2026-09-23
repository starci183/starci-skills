import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moduleYamlFiles, unparseableYaml } from '../scripts/checks/check-module-yaml.mjs';

// modules/ops/_common.yaml went unparseable (an unquoted ": " in a plain scalar)
// and modules/kernel/dispatch.yaml carried `{a, b} | null` while `npm run check`
// stayed green; every modules/ YAML now parses with the runtime's own reader.
test('every modules/ YAML parses, and a broken flow value is caught', (t) => {
  assert.deepEqual(unparseableYaml(), []);
  assert.ok(moduleYamlFiles().some((f) => f.endsWith(path.join('ops', '_common.yaml'))));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-yaml-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bad = path.join(dir, 'bad.yaml');
  fs.writeFileSync(bad, 'packet:\n  owner_delegation: {asks, until} | null\n');
  assert.equal(unparseableYaml([bad]).length, 1);
});
