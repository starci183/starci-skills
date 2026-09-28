import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildOpPrompt } from '../scripts/kernel/op-prompt.mjs';

test('every op prompt explains how to run and collect a validator beyond the command window', () => {
  const skillRoot = path.resolve(import.meta.dirname, '..');
  const packet = { op: 'backend.implement', brief: 'modules/ops/ops/backend.implement.yaml', context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } };
  const prompt = buildOpPrompt({ skillRoot, packet });
  assert.match(prompt, /validator.*25 s/i);
  assert.match(prompt, /background/i);
  assert.match(prompt, /stdout/i);
  assert.match(prompt, /exit status/i);
  assert.match(prompt, /poll/i);
});
