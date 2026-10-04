// CONCERN_OWNER (scripts/reconciler/owns.mjs) is the concerns map of the reconciler contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { CONCERN_OWNER, CONCERNS } from '../../scripts/reconciler/owns.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('CONCERN_OWNER is the concerns map of modules/reconciler/reconciler.yaml', () => {
  const contract = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'reconciler', 'reconciler.yaml'), 'utf8'));
  assert.deepEqual(contract.concerns, { ...CONCERN_OWNER });
  assert.equal(CONCERNS.length, 25);
  assert.equal(CONCERN_OWNER['host.core-debug-seat'], 'host');
});
