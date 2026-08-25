import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { joinParts, splitArchive } from './device-state.mjs';

test('chunks and rejoins encrypted checkpoint bytes without drift', async () => {
  const root = mkdtempSync(join(tmpdir(), 'starci-device-state-'));
  const source = join(root, 'archive.age');
  const output = join(root, 'joined.age');
  const bytes = Buffer.from('device-state-checkpoint\n'.repeat(4096));
  writeFileSync(source, bytes);
  const parts = splitArchive(source, 4096);
  assert.ok(parts.length > 1);
  await joinParts(parts, output);
  assert.deepEqual(readFileSync(output), bytes);
});
