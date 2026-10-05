import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';

test('every op prompt explains how to run and collect a validator beyond the command window', () => {
  const skillRoot = path.resolve(import.meta.dirname, '..', '..');
  const packet = { op: 'backend.implement', brief: 'modules/ops/ops/backend.implement.yaml', context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } };
  const prompt = buildOpPrompt({ skillRoot, packet });
  assert.match(prompt, /validator.*25 s/i);
  assert.match(prompt, /background/i);
  assert.match(prompt, /stdout/i);
  assert.match(prompt, /exit status/i);
  assert.match(prompt, /poll/i);
});

test('selected mode authority is the filed contract rather than a union of sibling briefs', () => {
  const skillRoot = path.resolve(import.meta.dirname, '..', '..');
  const packet = { op: 'review.verify', brief: 'modules/ops/ops/review.verify.yaml', context: { records: [], owned_paths: [], selected_op: { mode: 'lint', contract: { completionProfile: 'operations' } } }, constraints: { model: 'm' } };
  const prompt = buildOpPrompt({ skillRoot, packet });
  assert.match(prompt, /selected_op: mode=lint/);
  assert.match(prompt, /immutable effective contract is packet context\.selected_op\.contract/);
  assert.match(prompt, /Sibling execution modes grant no authority/);
  delete packet.context.selected_op;
  assert.doesNotMatch(buildOpPrompt({ skillRoot, packet }), /selected_op: mode=/);
});
