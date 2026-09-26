import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { specConcurrency } from '../scripts/supervisor/land.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the land gate runs specs at the concurrency runtimes.yaml declares, not a literal', () => {
  assert.equal(specConcurrency(), 12);
  const land = fs.readFileSync(path.join(root, 'scripts/supervisor/land.mjs'), 'utf8');
  assert.doesNotMatch(land, /--test-concurrency=\d/, 'no literal concurrency in land.mjs');
});
