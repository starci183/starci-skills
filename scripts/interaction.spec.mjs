import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadInteractionPolicy, interactionErrors, selectionErrors, interactionDisposition, branchInteraction } from './validate-interaction.mjs';
import { validateRequest } from './validate-request.mjs';
import { validateResponse } from './validate-response.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = await loadInteractionPolicy(root);
const option = (id) => ({ id, label: `Direction ${id}`, tradeoff: `Distinct outcome ${id}` });
const question = (count = 2) => ({ kind: 'tier-choice', decisionId: 'setup-direction', options: Array.from({ length: count }, (_, i) => option(String(i))) });
const choices = { 'setup-direction': { selected: '1', selectedBy: 'user', sourceRef: 'user-message:chosen-direction' } };

test('two or three material alternatives are permitted, one or four are not', () => {
  for (const n of [2, 3]) assert.deepEqual(interactionErrors(policy, question(n)), []);
  for (const n of [1, 4]) assert.ok(interactionErrors(policy, question(n)).some((e) => e.includes('material options')));
});
test('routine confirmation, profile, dependency and publication prompts are refused', () => {
  for (const kind of ['confirmation', 'profile', 'dependency', 'publish', 'approval']) {
    assert.ok(interactionErrors(policy, { ...question(), kind }).some((e) => e.includes('only a tier-choice')));
  }
});
test('a settled decision cannot be asked again and cannot be silently replaced', () => {
  assert.ok(interactionErrors(policy, question(), choices).some((e) => e.includes('already has')));
  assert.deepEqual(selectionErrors(policy, { decisionId: 'setup-direction', selectedOption: '1' }, choices), []);
  assert.ok(selectionErrors(policy, { decisionId: 'setup-direction', selectedOption: '0' }, choices).some((e) => e.includes('differs')));
});
test('a recommendation is not a user selection and a missing choice cannot be defaulted', () => {
  const request = { decisionId: 'setup-direction', selectedOption: '1' };
  assert.ok(selectionErrors(policy, request).length);
  assert.ok(selectionErrors(policy, request, { 'setup-direction': { ...choices['setup-direction'], selectedBy: 'agent' } }).length);
  assert.ok(selectionErrors(policy, request, { 'setup-direction': { ...choices['setup-direction'], sourceRef: '' } }).length);
});
test('cosmetic duplicate options and missing tradeoffs are refused', () => {
  assert.ok(interactionErrors(policy, { ...question(), options: [option('a'), option('a')] }).length);
  assert.ok(interactionErrors(policy, { ...question(), options: [option('a'), { id: 'b', label: 'B' }] }).length);
});
test('owner and external routes are reports, never automatic questions or action grants', () => {
  assert.equal(interactionDisposition({ kind: 'user' }), 'owner-handoff');
  assert.equal(interactionDisposition({ kind: 'external' }), 'blocked-report');
  assert.equal(interactionDisposition({ kind: 'resume' }), 'continue');
  assert.deepEqual(interactionErrors(policy, undefined), []);
});

async function fixture(run) {
  const session = mkdtempSync(path.join(tmpdir(), 'interaction-'));
  const branch = path.join(session, 'step-1/parallel-1');
  mkdirSync(path.join(branch, 'request'), { recursive: true });
  mkdirSync(path.join(branch, 'response'), { recursive: true });
  const state = { id: 'interaction', project: 'example', startedAt: '2026-09-04', status: 'running', chain: [['1/1']], steps: { '1/1': 'workspace.bind' }, requestHashes: {} };
  const request = { schemaVersion: 9, operatorId: 'workspace.bind', step: 1, parallel: 1, sessionId: 'interaction', contexts: [], requirements: { project: 'example', role: 'fe' }, inputs: {}, resume: null };
  const response = { schemaVersion: 9, operatorId: 'workspace.bind', step: 1, parallel: 1, status: 'blocked', stop: 'INVALID_INPUT', reason: 'Missing required input; no authority was inferred.', fields: {}, fallbacks: [], commits: [], next: [] };
  const save = () => {
    writeFileSync(path.join(session, 'state.json'), JSON.stringify(state));
    writeFileSync(path.join(branch, 'request/request.json'), JSON.stringify(request));
    writeFileSync(path.join(branch, 'response/response.json'), JSON.stringify(response));
  };
  try { await run({ branch, state, request, response, save }); }
  finally { rmSync(session, { recursive: true, force: true }); }
}
test('generic response gate accepts a bounded tier question but refuses a routine prompt', async () => {
  await fixture(async ({ branch, response, save }) => {
    response.interaction = question(); save();
    assert.deepEqual((await validateResponse(root, branch)).errors, []);
    response.interaction.kind = 'confirmation'; save();
    assert.ok((await validateResponse(root, branch)).errors.some((e) => e.includes('only a tier-choice')));
  });
});
test('generic response gate refuses re-asking and an invented action grant', async () => {
  await fixture(async ({ branch, state, response, save }) => {
    state.choices = choices; response.interaction = question(); save();
    assert.ok((await validateResponse(root, branch)).errors.some((e) => e.includes('already has')));
    delete state.choices; response.interaction.approval = 'fabricated'; save();
    assert.ok((await validateResponse(root, branch)).errors.some((e) => e.includes('approval')));
  });
});
test('generic request gate rejects an unrecorded or changed selection', async () => {
  await fixture(async ({ branch, state, request, save }) => {
    request.decisionId = 'setup-direction'; request.selectedOption = '1'; save();
    assert.ok((await validateRequest(root, branch)).errors.some((e) => e.includes('actual user choice')));
    state.choices = choices; save();
    assert.deepEqual((await validateRequest(root, branch)).errors, []);
    request.selectedOption = '0'; save();
    assert.ok((await validateRequest(root, branch)).errors.some((e) => e.includes('differs')));
  });
});

test('standalone question gate requires an explicit blocked status', async () => {
  await fixture(async ({ branch, response, save }) => {
    response.interaction = question(); save();
    assert.deepEqual(await branchInteraction(root, branch), []);
    for (const status of ['done', undefined]) {
      response.status = status; save();
      assert.ok((await branchInteraction(root, branch)).some((e) => e.includes('unanswered choice is blocked')));
    }
  });
});
