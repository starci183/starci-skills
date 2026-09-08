import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { restatementDecisionId, restatementChoiceSource } from './restatement-choice.mjs';
import { interactionErrors, selectionErrors } from './validate-interaction.mjs';
import { restatementErrors } from '../operators/business-decide/validate.mjs';

const text = '# restatement — feature\n\n## Restatement\n\n| Line | Statement |\n| --- | --- |\n| 1 | A workspace can hold many installations. |\n\n## Source\n\n| Field | Value |\n| --- | --- |\n| Field | `promise` |\n| Quoted | Allow many installations. |\n';
const request = { operatorId: 'business.decide', expected: { goalVersion: 4 }, requirements: { featureId: 'feature', promise: 'Allow many installations.' } };
const policy = { questionKinds: ['restatement-confirm'], minOptions: 2, maxOptions: 3, selectionSource: 'user' };
const question = id => ({ kind: 'restatement-confirm', decisionId: id, options: [{ id: 'as-stated', label: 'As stated', tradeoff: 'Proceed with this reading' }, { id: 'corrected', label: 'Correct it', tradeoff: 'Use the supplied correction' }] });

test('changed mission or rendered reading has its own choice; old approval cannot select it', () => {
  const id = restatementDecisionId(request, 'feature', text);
  const previous = restatementDecisionId({ ...request, expected: { goalVersion: 3 } }, 'feature', text);
  const changed = restatementDecisionId(request, 'feature', text.replace('many installations', 'one installation'));
  assert.notEqual(id, previous); assert.notEqual(id, changed);
  assert.equal(id, restatementDecisionId(request, 'feature', text.replaceAll('\n', '\r\n')));
  const choices = { [previous]: { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:previous-scope' }, 'restatement:feature': { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:old-address' } };
  assert.deepEqual(interactionErrors(policy, question(id), choices), []);
  assert.match(selectionErrors(policy, { decisionId: id, selectedOption: 'as-stated' }, choices).join(), /actual user choice/);
  choices[id] = { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:current-reading' };
  assert.deepEqual(selectionErrors(policy, { decisionId: id, selectedOption: 'as-stated' }, choices), []);
  assert.match(interactionErrors(policy, question(id), choices).join(), /reuse it/);
});

test('the real business restatement gate accepts the versioned content id and refuses the old reusable address', async t => {
  const session = await mkdtemp(path.join(os.tmpdir(), 'starci-reading-'));
  t.after(() => rm(session, { recursive: true, force: true }));
  const branch = path.join(session, 'step-8/parallel-1');
  await mkdir(path.join(branch, 'response'), { recursive: true });
  await writeFile(path.join(branch, 'response/restatement.md'), text);
  const response = { status: 'blocked', stop: 'RESTATEMENT_UNCONFIRMED', interaction: question(restatementDecisionId(request, 'feature', text)) };
  const run = () => restatementErrors({ branchDir: branch, request, response, requirements: request.requirements, present: new Set(['restatement']), field: 'promise', id: 'feature', owed: true });
  assert.deepEqual(await run(), []);
  response.interaction.decisionId = 'restatement:feature';
  assert.match((await run()).join(), /choice is keyed/);
});

test('resume derives its choice from the exact blocked reading and refuses cross-mission reuse', async t => {
  const session = await mkdtemp(path.join(os.tmpdir(), 'starci-reading-resume-'));
  t.after(() => rm(session, { recursive: true, force: true }));
  const previous = path.join(session, 'step-8/parallel-1');
  await mkdir(path.join(previous, 'request'), { recursive: true }); await mkdir(path.join(previous, 'response'), { recursive: true });
  await writeFile(path.join(previous, 'request/request.json'), JSON.stringify(request)); await writeFile(path.join(previous, 'response/restatement.md'), text);
  const branch = path.join(session, 'step-9/parallel-1');
  const next = { ...request, resume: { step: 8, parallel: 1 } };
  assert.equal(restatementChoiceSource(branch, next).text, text);
  assert.throws(() => restatementChoiceSource(branch, { ...next, expected: { goalVersion: 5 } }), /RESTATEMENT_SCOPE_MISMATCH/);
});
