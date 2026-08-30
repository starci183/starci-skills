import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertNeutralAdversarialDecision, conditionMatches, nextState, validatedOperatorReturn, validatedWaitResume } from './route-machine.mjs';
import { validateOutput as validateSemanticOutput } from '../operators/fe/semantic-audit/validate-output.mjs';
import { validatorFor } from '../operators/validation.mjs';
import { createReceipt, fingerprint } from '../runtime/trace.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = (id) => JSON.parse(readFileSync(path.join(root, id, 'machine.json'), 'utf8'));
const semanticPassed = () => ({ schemaVersion: 7, operatorId: 'fe/semantic-audit', output: {
  outcome: 'passed',
  result: { summary: 'Semantic evidence passed.', artifactRefs: ['artifact://semantic'], checks: [{ checkRef: 'check://one', subjectRef: 'surface://one', verdict: 'passed', observation: 'The visible meaning matches authority.', authorityRef: 'authority://one', evidenceRef: 'render://one.png' }] },
  gaps: [], evidenceRefs: ['render://one.png'], handoff: null,
} });
const semanticInput = () => ({ schemaVersion:7, operatorId:'fe/semantic-audit', context:{ authorityRefs:['authority://one'], evidenceRefs:['render://one.png'], uiKnowledgeId:'fe.ui' }, input:{ targetRef:'surface://one', constraints:[] } });
let receiptSequence = 0;
const neutralInput=(value)=>({...value,neutralAdversarialDecision:{
  add:{disposition:'reject',rationale:'No evidenced missing capability serves this bounded mission.',evidenceRefs:['evidence://analysis']},
  change:{disposition:'adopt',rationale:'The requested outcome requires the bounded change.',evidenceRefs:['evidence://analysis']},
  remove:{disposition:'reject',rationale:'No incumbent capability is proven harmful or redundant.',evidenceRefs:['evidence://analysis']},
}});
const waitResume=(candidate,stateId,resolution)=>{
  receiptSequence+=1;
  const missionId=`mission://wait-${receiptSequence}`;
  const receipt=createReceipt('RESUME',{receiptId:`receipt:wait-resume-${receiptSequence}`,missionId,skillId:candidate.id,parentId:`receipt:wait-call-${receiptSequence}`,context:{waitState:stateId,invocationRef:`invocation://wait-${receiptSequence}`,resolvedInputFingerprint:fingerprint(resolution)},resumeState:stateId,actualOutput:resolution},{debug:true});
  return {missionId,envelope:validatedWaitResume({machineId:candidate.id,stateId,missionId,resumeReceipt:receipt,resolution})};
};
const returnReceipt = (stateId, input, outputDocument, overrides={}) => {
  receiptSequence += 1;
  const executionRef = `execution://${receiptSequence.toString(16).padStart(64, '0')}`;
  const missionId = `mission://route-test-${receiptSequence}`;
  const common = {
  missionId,
  skillId: 'starci-fe-process',
  operatorId: 'fe/semantic-audit',
  parentId: `invocation://${stateId}-${receiptSequence}`,
  childId: null,
  context: { executionRef, invocationRef: `invocation://${stateId}-${receiptSequence}` },
  input,
  expectedOutput: { outcome: outputDocument.output.outcome },
  actualOutput: outputDocument,
  aiActivity: { kind: 'review', model: 'gpt-5.6-sol', count: 1, executionRef, principalFingerprint: `sha256:${'a'.repeat(64)}`, contextFingerprint: `sha256:${'b'.repeat(64)}`, isolation: 'fresh', forkTurns: 'none' },
  ...overrides,
  };
  createReceipt('CALL', { ...common, receiptId: `receipt:${stateId}-${receiptSequence}-call` }, { debug: true, writeDebug: () => {}, now: () => '2026-08-30T00:00:00.000Z' });
  return createReceipt('RETURN', { ...common, receiptId: `receipt:${stateId}-${receiptSequence}-return` }, { debug: true, writeDebug: () => {}, now: () => '2026-08-30T00:00:00.000Z' });
};
const route = async (candidate, stateId, input = semanticInput()) => {
 const outputDocument=semanticPassed();
 return await validatedOperatorReturn({
  machineId: candidate.id,
  stateId,
  operatorId: candidate.states[stateId].ref,
  input,
  outputDocument,
  validateOutput: validateSemanticOutput,
  returnReceipt:returnReceipt(stateId,input,outputDocument),
 });
};

test('v7 routes only from normalized input or validated operator output', () => {
  assert.equal(conditionMatches({ inputEquals: { 'intent.mode': 'audit' } }, {}, { intent: { mode: 'audit' } }), true);
  assert.equal(conditionMatches({ outputEquals: { outcome: 'passed' } }, { output: { outcome: 'passed' } }, {}), true);
  assert.equal(conditionMatches(
    { outputEquals: { outcome: 'passed' } },
    { trace: { actualOutput: { outcome: 'passed' } } },
    {}
  ), false);
});

test('operator states reject narrated PASS and accept only validator-issued invocation-bound RETURN', async () => {
  const fe = machine('starci-fe-process');
  assert.throws(() => nextState(fe, 'semantic-audit', { output: { outcome: 'passed' } }, {}), /validator-issued RETURN/);
  const validInput=semanticInput();
  const valid = await route(fe, 'semantic-audit', validInput);
  assert.throws(() => nextState(fe, 'semantic-audit', valid, {}, 'invocation://different'), /active invocation/);
  assert.throws(() => nextState(fe, 'semantic-audit', valid, {}, valid.invocationRef, 'mission://wrong'), /mission identity/);
  assert.equal(nextState(fe, 'semantic-audit', valid, validInput, valid.invocationRef, valid.missionId), 'ux-audit');
  assert.throws(() => nextState(fe, 'semantic-audit', valid, validInput, valid.invocationRef, valid.missionId), /already consumed/);
  const wrongState = await route(fe, 'semantic-audit');
  assert.throws(() => nextState(fe, 'ux-audit', wrongState, {}, 'invocation://ux-audit'), /another invocation/);
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'semantic-audit', operatorId: 'fe/semantic-audit', input: {}, outputDocument: semanticPassed(), validateOutput: () => ({ valid: true, errors: [] }) }), /exact canonical operator output validator/);
  const schemaOnly = validatorFor(new URL('../operators/fe/semantic-audit/output.schema.json', import.meta.url));
  const forgedOutput = semanticPassed();
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'semantic-audit', operatorId: 'fe/semantic-audit', input: {}, outputDocument: forgedOutput, validateOutput: schemaOnly, returnReceipt: returnReceipt('semantic-audit', {}, forgedOutput) }), /exact canonical operator output validator/);
  const staleInput=semanticInput(); staleInput.input.targetRef='surface://old';
  const currentInput=semanticInput(); currentInput.input.targetRef='surface://current';
  const stale = await route(fe,'semantic-audit',staleInput);
  assert.throws(() => nextState(fe, 'semantic-audit', stale, currentInput, stale.invocationRef, stale.missionId), /input fingerprint differs/);
});

test('operator RETURN receipts are runtime-issued and may be wrapped only once', async () => {
  const fe = machine('starci-fe-process');
  const input = semanticInput();
  const outputDocument = semanticPassed();
  const receipt = returnReceipt('semantic-receipt-brand', input, outputDocument);
  assert.throws(() => { receipt.trace.input.revision = 'retargeted'; }, /read only|extensible|object is not extensible/i);
  const forged = { ...receipt, receiptId: 'receipt:forged' };
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'semantic-audit', operatorId: 'fe/semantic-audit', input, outputDocument, validateOutput: validateSemanticOutput, returnReceipt: forged }), /canonical operator RETURN receipt/);
  await validatedOperatorReturn({ machineId: fe.id, stateId: 'semantic-audit', operatorId: 'fe/semantic-audit', input, outputDocument, validateOutput: validateSemanticOutput, returnReceipt: receipt });
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'semantic-audit', operatorId: 'fe/semantic-audit', input, outputDocument, validateOutput: validateSemanticOutput, returnReceipt: receipt }), /already wrapped/);
});

test('operator RETURN routing rejects invalid canonical input, null expected output, and wrong owning Skill',async()=>{
  const fe=machine('starci-fe-process');
  const outputDocument=semanticPassed();
  const invalidInput={};
  await assert.rejects(()=>validatedOperatorReturn({machineId:fe.id,stateId:'semantic-audit',operatorId:'fe/semantic-audit',input:invalidInput,outputDocument,validateOutput:validateSemanticOutput,returnReceipt:returnReceipt('invalid-input',invalidInput,outputDocument)}),/operator input failed validation/);
  const validInput=semanticInput();
  await assert.rejects(()=>validatedOperatorReturn({machineId:fe.id,stateId:'semantic-audit',operatorId:'fe/semantic-audit',input:validInput,outputDocument,validateOutput:validateSemanticOutput,returnReceipt:returnReceipt('null-expected',validInput,outputDocument,{expectedOutput:null})}),/non-null expected output contract/);
  await assert.rejects(()=>validatedOperatorReturn({machineId:fe.id,stateId:'semantic-audit',operatorId:'fe/semantic-audit',input:validInput,outputDocument,validateOutput:validateSemanticOutput,returnReceipt:returnReceipt('wrong-skill',validInput,outputDocument,{skillId:'starci-backend-process'})}),/belongs to another Skill/);
});

test('frontend starts, consumes RETURN, or consumes authority RESUME without restarting blindly', () => {
  const fe = machine('starci-fe-process');
  assert.equal(nextState(fe, 'analyze-input', {}, neutralInput({ receiptType: 'NONE' })), 'compile');
  assert.equal(nextState(fe, 'analyze-input', {}, neutralInput({ receiptType: 'RETURN' })), 'consume-return');
  assert.equal(nextState(fe, 'analyze-input', {}, neutralInput({ receiptType: 'RESUME' })), 'consume-choice-resume');
});

test('every Skill analysis requires evidenced add change and remove consideration',()=>{
  assert.throws(()=>assertNeutralAdversarialDecision({}),/neutral add decision/);
  assert.equal(assertNeutralAdversarialDecision(neutralInput({})),true);
});

test('wait states require a typed RESUME and use only the declared resume target', () => {
  const fe = machine('starci-fe-process');
  assert.throws(() => nextState(fe, 'direction-choice', {}, {}), /validator-issued canonical RESUME/);
  assert.throws(() => nextState(fe, 'direction-choice', { type: 'RESUME',facts:['frontend-direction-visual-preview-ready'] }, {}), /validator-issued canonical RESUME/);
  const direction=waitResume(fe,'direction-choice',{facts:['frontend-direction-visual-preview-ready']});
  assert.equal(nextState(fe,'direction-choice',direction.envelope,{},null,direction.missionId),'analyze-input');
  assert.throws(()=>nextState(fe,'direction-choice',direction.envelope,{},null,direction.missionId),/already consumed/);
  assert.throws(() => nextState(fe, 'mutation-choice', { type: 'RETURN' }, {}), /validator-issued canonical RESUME/);
  const mutation=waitResume(fe,'mutation-choice',{});
  assert.equal(nextState(fe,'mutation-choice',mutation.envelope,{},null,mutation.missionId),'analyze-input');
});

test('one active WAIT identity can issue only one canonical RESUME resolution',()=>{
  const fe=machine('starci-fe-process');
  const missionId='mission://single-wait';
  const resolution={facts:['frontend-direction-visual-preview-ready']};
  const fields={missionId,skillId:fe.id,parentId:'receipt:single-wait',context:{waitState:'direction-choice',invocationRef:'invocation://single-wait',resolvedInputFingerprint:fingerprint(resolution)},resumeState:'direction-choice',actualOutput:resolution};
  const first=createReceipt('RESUME',{...fields,receiptId:'receipt:single-wait-resume-a'},{debug:true});
  const second=createReceipt('RESUME',{...fields,receiptId:'receipt:single-wait-resume-b'},{debug:true});
  validatedWaitResume({machineId:fe.id,stateId:'direction-choice',missionId,resumeReceipt:first,resolution});
  assert.throws(()=>validatedWaitResume({machineId:fe.id,stateId:'direction-choice',missionId,resumeReceipt:second,resolution}),/already has a canonical RESUME/);
});

test('ambiguous or absent routes fail closed', () => {
  const ambiguous = {
    id: 'ambiguous',
    states: {
      start: {
        kind: 'choice',
        on: [
          { when: {}, target: 'a' },
          { when: {}, target: 'b' }
        ]
      },
      a: { kind: 'terminal', result: 'complete' },
      b: { kind: 'terminal', result: 'blocked' }
    }
  };
  assert.throws(() => nextState(ambiguous, 'start', {}, {}), /matched 2/);
  assert.throws(() => nextState(machine('starci-fe-process'), 'analyze-input', {}, neutralInput({ receiptType: 'UNKNOWN' })), /matched 0/);
});

test('all thirteen public machines are v7 mission machines', () => {
  const catalog = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'));
  assert.equal(catalog.skills.length, 13);
  for (const { id } of catalog.skills) {
    const candidate = machine(id);
    assert.equal(candidate.schemaVersion, 7, id);
    assert.equal(candidate.start, 'analyze-input', id);
    assert.equal(candidate.states['analyze-input'].kind, 'analysis', id);
  }
});
