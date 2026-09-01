import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertNeutralAdversarialDecision, canonicalMachine, conditionMatches, nextState, validatedOperatorReturn, validatedWaitResume } from './route-machine.mjs';
import { validateOutput as validateRequestCompileOutput } from '../operators/fe/request-compile/validate-output.mjs';
import { REQUIRED_PROBE_CATEGORIES, REQUIRED_PROBE_PHASES, REQUIRED_VIEWPORTS } from '../operators/fe/strict-ui-validation.mjs';
import { validatorFor } from '../operators/validation.mjs';
import { createReceipt, fingerprint } from '../runtime/trace.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = canonicalMachine;
const compiledFingerprint=(result)=>fingerprint({objective:result.objective,targetRef:result.targetRef,uxUiChangeLevel:result.uxUiChangeLevel,directionMode:result.directionMode,directionEvidence:result.directionEvidence,behaviorContractRef:result.behaviorContractRef,behaviorContractFingerprint:result.behaviorContractFingerprint,grammarBinding:result.grammarBinding,proofMatrix:result.proofMatrix,proofMatrixFingerprint:result.proofMatrixFingerprint,constraints:result.constraints,negativeBoundary:result.negativeBoundary,acceptanceCriteria:result.acceptanceCriteria,sourceBoundary:result.sourceBoundary,sourceBoundaryFingerprint:result.sourceBoundaryFingerprint});
const requestCompiled = () => {
  const sourceBoundary=[{path:'src/Profile.tsx',beforeSha256:`sha256:${'a'.repeat(64)}`,ownerRef:'surface://one'}];
  const states=[{stateRef:'state://happy-populated',lifecycle:'happy-case',populated:true,coreTaskVisible:true}];
  const proofMatrix={
    matrixRef:'matrix://profile-proof',
    states,
    viewports:[...REQUIRED_VIEWPORTS],
    probeRefs:REQUIRED_PROBE_CATEGORIES.flatMap((category)=>REQUIRED_PROBE_PHASES[category].map((phase)=>`probe-${category}-${phase}`)),
    populatedHeroStateRef:'state://happy-populated',
    coreTaskRef:'task://profile-core',
    cells:REQUIRED_VIEWPORTS.map((viewport,index)=>({cellRef:`proof-cell-${String(index+1).padStart(3,'0')}`,stateRef:'state://happy-populated',viewport})),
  };
  const result={
    summary:'The UI-only request is compiled.',
    compiledRequestRef:'compiled-request://profile-one',
    objective:'Refine the profile surface.',
    targetRef:'surface://one',
    uxUiChangeLevel:'refine',
    directionMode:'none',
    directionEvidence:{classification:'not-applicable',evidenceRefs:['request://one']},
    behaviorContractRef:'behavior://profile-one',
    behaviorContractFingerprint:`sha256:${'b'.repeat(64)}`,
    grammarBinding:{packageRef:'grammar-package://profile',manifestRef:'grammar://profile/manifest',exportRefs:['grammar://profile/card'],contentSha256:`sha256:${'c'.repeat(64)}`,authorityRevision:'grammar-revision-1'},
    proofMatrix,
    proofMatrixFingerprint:fingerprint(proofMatrix),
    constraints:['delivery-mode=ui-only-preserve-business'],
    negativeBoundary:['business behavior'],
    acceptanceCriteria:['Latest-source raster packet passes blind review.'],
    sourceBoundary,
    sourceBoundaryFingerprint:fingerprint(sourceBoundary),
    artifactRefs:['compiled-request://profile-one','behavior://profile-one'],
  };
  result.compiledRequestFingerprint=compiledFingerprint(result);
  return {schemaVersion:7,operatorId:'fe/request-compile',output:{outcome:'compiled',result,gaps:[],evidenceRefs:['authority://one','grammar-package://profile','grammar://profile/manifest'],handoff:null,repair:null}};
};
const requestInput = () => ({ schemaVersion:7, operatorId:'fe/request-compile', context:{ authorityRefs:['authority://one'], evidenceRefs:['request://one'], uiKnowledgeId:'fe.ui', scopeKnowledgeId:'fe.ux-ui-change-levels' }, input:{ targetRef:'surface://one', uxUiChangeLevel:'refine', directionMode:'none', directionEvidence:{classification:'not-applicable',evidenceRefs:['request://one']}, constraints:['delivery-mode=ui-only-preserve-business'] } });
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
  operatorId: 'fe/request-compile',
  parentId: `invocation://${stateId}-${receiptSequence}`,
  childId: null,
  context: { executionRef, invocationRef: `invocation://${stateId}-${receiptSequence}` },
  input,
  expectedOutput: { outcome: outputDocument.output.outcome },
  actualOutput: outputDocument,
  ...overrides,
  };
  createReceipt('CALL', { ...common, receiptId: `receipt:${stateId}-${receiptSequence}-call` }, { debug: true, writeDebug: () => {}, now: () => '2026-08-30T00:00:00.000Z' });
  return createReceipt('RETURN', { ...common, receiptId: `receipt:${stateId}-${receiptSequence}-return` }, { debug: true, writeDebug: () => {}, now: () => '2026-08-30T00:00:00.000Z' });
};
const route = async (candidate, stateId, input = requestInput()) => {
 const outputDocument=requestCompiled();
 outputDocument.output.result.targetRef=input.input.targetRef;
 outputDocument.output.result.uxUiChangeLevel=input.input.uxUiChangeLevel;
 outputDocument.output.result.directionMode=input.input.directionMode;
 outputDocument.output.result.directionEvidence=structuredClone(input.input.directionEvidence);
 outputDocument.output.result.constraints=[...input.input.constraints];
 outputDocument.output.result.compiledRequestFingerprint=compiledFingerprint(outputDocument.output.result);
 return await validatedOperatorReturn({
  machineId: candidate.id,
  stateId,
  operatorId: candidate.states[stateId].ref,
  input,
  outputDocument,
  validateOutput: validateRequestCompileOutput,
  returnReceipt:returnReceipt(stateId,input,outputDocument),
 });
};

test('v7 routes only from normalized input or validated operator output', () => {
  assert.equal(conditionMatches({ inputEquals: { 'intent.mode': 'audit' } }, {}, { intent: { mode: 'audit' } }), true);
  assert.equal(conditionMatches({ outputEquals: { outcome: 'passed' } }, { output: { outcome: 'passed' } }, {}), true);
  assert.equal(conditionMatches({ outputEquals: { outcome: 'compiled', 'result.directionMode': 'dominant' } }, { output: { outcome: 'compiled', result: { directionMode: 'dominant' } } }, {}), true);
  assert.equal(conditionMatches(
    { outputEquals: { outcome: 'passed' } },
    { trace: { actualOutput: { outcome: 'passed' } } },
    {}
  ), false);
});

test('operator states reject narrated PASS and accept only validator-issued invocation-bound RETURN', async () => {
  const fe = machine('starci-fe-process');
  assert.throws(() => nextState(fe, 'request-compile', { output: { outcome: 'compiled' } }, {}), /validator-issued RETURN/);
  const validInput=requestInput();
  const valid = await route(fe, 'request-compile', validInput);
  assert.throws(() => nextState(fe, 'request-compile', valid, {}, 'invocation://different'), /active invocation/);
  assert.throws(() => nextState(fe, 'request-compile', valid, {}, valid.invocationRef, 'mission://wrong'), /mission identity/);
  assert.equal(nextState(fe, 'request-compile', valid, validInput, valid.invocationRef, valid.missionId), 'apply');
  assert.throws(() => nextState(fe, 'request-compile', valid, validInput, valid.invocationRef, valid.missionId), /already consumed/);
  const wrongState = await route(fe, 'request-compile');
  assert.throws(() => nextState(fe, 'apply', wrongState, {}, 'invocation://apply'), /another invocation/);
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'request-compile', operatorId: 'fe/request-compile', input: {}, outputDocument: requestCompiled(), validateOutput: () => ({ valid: true, errors: [] }) }), /exact canonical operator output validator/);
  const schemaOnly = validatorFor(new URL('../operators/fe/request-compile/output.schema.json', import.meta.url));
  const forgedOutput = requestCompiled();
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'request-compile', operatorId: 'fe/request-compile', input: {}, outputDocument: forgedOutput, validateOutput: schemaOnly, returnReceipt: returnReceipt('request-compile', {}, forgedOutput) }), /exact canonical operator output validator/);
  const divergentOutput=requestCompiled(); divergentOutput.output.result.targetRef='surface://other'; divergentOutput.output.result.compiledRequestFingerprint=compiledFingerprint(divergentOutput.output.result);
  const boundInput=requestInput();
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'request-compile', operatorId: 'fe/request-compile', input: boundInput, outputDocument: divergentOutput, validateOutput: validateRequestCompileOutput, returnReceipt: returnReceipt('request-compile-binding', boundInput, divergentOutput) }), /targetRef differs from invocation input/);
  const staleInput=requestInput(); staleInput.input.targetRef='surface://old';
  const currentInput=requestInput(); currentInput.input.targetRef='surface://current';
  const stale = await route(fe,'request-compile',staleInput);
  assert.throws(() => nextState(fe, 'request-compile', stale, currentInput, stale.invocationRef, stale.missionId), /input fingerprint differs/);
});

test('operator RETURN receipts are runtime-issued and may be wrapped only once', async () => {
  const fe = machine('starci-fe-process');
  const input = requestInput();
  const outputDocument = requestCompiled();
  const receipt = returnReceipt('semantic-receipt-brand', input, outputDocument);
  assert.throws(() => { receipt.trace.input.revision = 'retargeted'; }, /read only|extensible|object is not extensible/i);
  const forged = { ...receipt, receiptId: 'receipt:forged' };
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'request-compile', operatorId: 'fe/request-compile', input, outputDocument, validateOutput: validateRequestCompileOutput, returnReceipt: forged }), /canonical operator RETURN receipt/);
  await validatedOperatorReturn({ machineId: fe.id, stateId: 'request-compile', operatorId: 'fe/request-compile', input, outputDocument, validateOutput: validateRequestCompileOutput, returnReceipt: receipt });
  await assert.rejects(() => validatedOperatorReturn({ machineId: fe.id, stateId: 'request-compile', operatorId: 'fe/request-compile', input, outputDocument, validateOutput: validateRequestCompileOutput, returnReceipt: receipt }), /already wrapped/);
});

test('operator RETURN routing rejects invalid canonical input, null expected output, and wrong owning Skill',async()=>{
  const fe=machine('starci-fe-process');
  const outputDocument=requestCompiled();
  const invalidInput={};
  await assert.rejects(()=>validatedOperatorReturn({machineId:fe.id,stateId:'request-compile',operatorId:'fe/request-compile',input:invalidInput,outputDocument,validateOutput:validateRequestCompileOutput,returnReceipt:returnReceipt('invalid-input',invalidInput,outputDocument)}),/operator input failed validation/);
  const validInput=requestInput();
  await assert.rejects(()=>validatedOperatorReturn({machineId:fe.id,stateId:'request-compile',operatorId:'fe/request-compile',input:validInput,outputDocument,validateOutput:validateRequestCompileOutput,returnReceipt:returnReceipt('null-expected',validInput,outputDocument,{expectedOutput:null})}),/non-null expected output contract/);
  await assert.rejects(()=>validatedOperatorReturn({machineId:fe.id,stateId:'request-compile',operatorId:'fe/request-compile',input:validInput,outputDocument,validateOutput:validateRequestCompileOutput,returnReceipt:returnReceipt('wrong-skill',validInput,outputDocument,{skillId:'starci-backend-process'})}),/belongs to another Skill/);
});

test('frontend starts, consumes RETURN, or consumes authority RESUME without restarting blindly', () => {
  const fe = machine('starci-fe-process');
  assert.equal(nextState(fe, 'analyze-input', {}, neutralInput({ receiptType: 'NONE' })), 'request-compile');
  assert.equal(nextState(fe, 'analyze-input', {}, neutralInput({ receiptType: 'RETURN' })), 'consume-return');
  assert.equal(nextState(fe, 'analyze-input', {}, neutralInput({ receiptType: 'RESUME' })), 'consume-return');
});

test('every Skill analysis requires evidenced add change and remove consideration',()=>{
  assert.throws(()=>assertNeutralAdversarialDecision({}),/neutral add decision/);
  assert.equal(assertNeutralAdversarialDecision(neutralInput({})),true);
});

test('wait states require a typed RESUME and use only the declared resume target', () => {
  const architecture = machine('starci-architecture-design');
  assert.throws(() => nextState(architecture, 'architecture-choice', {}, {}), /validator-issued canonical RESUME/);
  assert.throws(() => nextState(architecture, 'architecture-choice', { type: 'RESUME',facts:['architecture-visual-preview-ready'] }, {}), /validator-issued canonical RESUME/);
  const direction=waitResume(architecture,'architecture-choice',{stage:'architecture.decision.handoff',status:'ready',facts:['architecture-visual-preview-ready']});
  assert.equal(nextState(architecture,'architecture-choice',direction.envelope,{},null,direction.missionId),'analyze-input');
  assert.throws(()=>nextState(architecture,'architecture-choice',direction.envelope,{},null,direction.missionId),/already consumed/);
});

test('one active WAIT identity can issue only one canonical RESUME resolution',()=>{
  const architecture=machine('starci-architecture-design');
  const missionId='mission://single-wait';
  const resolution={stage:'architecture.decision.handoff',status:'ready',facts:['architecture-visual-preview-ready']};
  const fields={missionId,skillId:architecture.id,parentId:'receipt:single-wait',context:{waitState:'architecture-choice',invocationRef:'invocation://single-wait',resolvedInputFingerprint:fingerprint(resolution)},resumeState:'architecture-choice',actualOutput:resolution};
  const first=createReceipt('RESUME',{...fields,receiptId:'receipt:single-wait-resume-a'},{debug:true});
  const second=createReceipt('RESUME',{...fields,receiptId:'receipt:single-wait-resume-b'},{debug:true});
  validatedWaitResume({machineId:architecture.id,stateId:'architecture-choice',missionId,resumeReceipt:first,resolution});
  assert.throws(()=>validatedWaitResume({machineId:architecture.id,stateId:'architecture-choice',missionId,resumeReceipt:second,resolution}),/already has a canonical RESUME/);
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
  assert.throws(() => nextState(ambiguous, 'start', {}, {}), /not runtime-owned canonical state/);
  const forged = structuredClone(machine('starci-fe-process'));
  assert.throws(() => nextState(forged, 'analyze-input', {}, neutralInput({ receiptType: 'NONE' })), /not runtime-owned canonical state/);
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
