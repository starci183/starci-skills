import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatorFor } from '../operators/validation.mjs';
import { canonicalMachine, nextState } from '../skills/route-machine.mjs';
import { createReceipt } from './trace.mjs';
import { validateInput as validateGit } from '../skills/starci-git-publish/validate-input.mjs';
import { validateOutput as validateDeliveryProof } from '../operators/quality/delivery-proof/validate-output.mjs';
import { validateOutput as validateReadiness } from '../operators/quality/readiness-inventory/validate-output.mjs';
import { validateOutput as validateRuleBinding } from '../operators/quality/rule-binding-check/validate-output.mjs';
import { validateOutput as validateUatSnapshot } from '../operators/test/uat-snapshot-freeze/validate-output.mjs';
import { validateOutput as validateUatBehavior } from '../operators/test/uat-behavior-proof/validate-output.mjs';
import { createOperatorInvocationBindingRegistry } from '../operators/invocation-binding.mjs';
import { validateInput as validateUatSkill } from '../skills/starci-uat-verify/validate-input.mjs';
import { uatContentFingerprint } from '../operators/test/uat-artifact.mjs';

const ids=['starci-quality-assure','starci-release-manage','starci-platform-operate','starci-workspace-manage','starci-git-publish'];
const load=canonicalMachine;
const route=(machine,stateId,outcome,projection={})=>{const output={outcome,...projection};const matches=machine.states[stateId].on.filter((edge)=>Object.entries(edge.when?.outputEquals??{}).every(([key,value])=>output[key]===value));assert.equal(matches.length,1);return matches[0].target;};
test('all skills inherit neutral adversarial review instead of incumbent implementation bias',()=>{
  const index=fs.readFileSync(new URL('../INDEX.md',import.meta.url),'utf8');
  const authority=fs.readFileSync(new URL('../knowledge/adversarial-review.md',import.meta.url),'utf8');
  assert.match(index,/Every Skill inherits `knowledge\/adversarial-review\.md`/);
  assert.match(authority,/current infrastructure is a\s+candidate design/i);
  assert.match(authority,/try to falsify it/i);
  assert.match(authority,/implementation, reusable rule\/knowledge\/Grammar, frozen product or business authority/is);
  assert.match(authority,/repair the owner, then restart observation/i);
});
test('terminal quality PASS is executable only after evidenced add change and remove consideration',()=>{
  const value={schemaVersion:7,operatorId:'quality/delivery-proof',output:{outcome:'pass',resultRef:'receipt://claimed-pass',evidenceRefs:['receipt://claimed-pass','proof://delivery'],findings:[],reason:null,adversarialDecision:{
    add:{disposition:'reject',rationale:'No missing capability is evidenced.',evidenceRefs:['proof://delivery']},
    change:{disposition:'adopt',rationale:'The bounded correction is proven.',evidenceRefs:['proof://delivery']},
    remove:{disposition:'reject',rationale:'No harmful incumbent is evidenced.',evidenceRefs:['proof://delivery']},
  }}};
  assert.deepEqual(validateDeliveryProof(value),{valid:true,errors:[]});
  const proseOnly=structuredClone(value);
  proseOnly.output.resultRef=null; proseOnly.output.reason='Looks acceptable.'; proseOnly.output.evidenceRefs=[];
  assert.match(validateDeliveryProof(proseOnly).errors.join('\n'),/concrete resultRef|narrative|nonempty evidenceRefs/);
  const invented=structuredClone(value); invented.output.adversarialDecision.add.evidenceRefs=['direction://invented'];
  assert.match(validateDeliveryProof(invented).errors.join('\n'),/bound in top-level evidenceRefs/);
  delete value.output.adversarialDecision.remove;
  assert.match(validateDeliveryProof(value).errors.join('\n'),/required property|remove|schema branch/i);
});
test('nominal Quality and UAT success cannot pass with empty concrete proof',()=>{
  const readiness={schemaVersion:7,operatorId:'quality/readiness-inventory',output:{outcome:'green',debtPolicy:'forbidden',resultRef:'proof://readiness',evidenceRefs:[],findings:[],reason:null}};
  assert.match(validateReadiness(readiness).errors.join('\n'),/nonempty evidenceRefs/);
  const rules={schemaVersion:7,operatorId:'quality/rule-binding-check',output:{outcome:'pass',debtPolicy:'forbidden',resultRef:'proof://rules',evidenceRefs:[],findings:[],reason:null}};
  assert.match(validateRuleBinding(rules).errors.join('\n'),/nonempty evidenceRefs/);
  const snapshot={schemaVersion:7,operatorId:'test/uat-snapshot-freeze',output:{outcome:'frozen',canonicalRef:'.worktrees/uat/dashboard/happy/snapshot.json',contentFingerprint:null,evidenceRefs:[],gaps:[]}};
  assert.match(validateUatSnapshot(snapshot).errors.join('\n'),/nonempty evidence/);
  const behavior={schemaVersion:7,operatorId:'test/uat-behavior-proof',output:{outcome:'passed',result:null,gaps:[],evidenceRefs:[]}};
  assert.match(validateUatBehavior(behavior).errors.join('\n'),/concrete nonempty artifact result|nonempty evidence/);
});
test('verification-only Quality rejects debt and source drift, and UAT cannot publish PASS after a failed lens',(t)=>{
  const registry=createOperatorInvocationBindingRegistry();
  const source=`sha256:${'1'.repeat(64)}`;
  const packet=`sha256:${'2'.repeat(64)}`;
  const audit='.artifacts/quality/audit.md';
  const visualReceipt={receiptId:'receipt:visual-pass',missionId:'mission:chain',timestamp:'2026-09-01T00:00:01.000Z',trace:{input:{input:{blindReviewPacket:{capturedSourceFingerprint:source}}},aiActivity:{executionRef:`execution://${'1'.repeat(64)}`},sourceHeads:['git:one']}};
  registry.record('fe/visual-fidelity',{output:{outcome:'passed',result:{packetFingerprint:packet,artifactRefs:[audit]}}},visualReceipt);
  const visualOrigin={fromSkillId:'starci-fe-process',visualPassReturnReceiptRef:visualReceipt.receiptId,sourceFingerprint:source,evidenceFingerprint:packet,auditRefs:[audit]};
  const qualityContext={contextRefs:[visualReceipt.receiptId,packet,audit],sourceRefs:[]};
  const allowedErrors=registry.validate('quality/readiness-inventory',{context:qualityContext,input:{sourceFingerprint:source,debtPolicy:'allowed',origin:visualOrigin}},{output:{outcome:'green',debtPolicy:'allowed'}},{missionId:'mission:chain'});
  assert.match(allowedErrors.join('\n'),/cannot carry a frontend visual PASS origin/);
  const driftErrors=registry.validate('quality/readiness-inventory',{context:qualityContext,input:{sourceFingerprint:`sha256:${'3'.repeat(64)}`,debtPolicy:'forbidden',origin:visualOrigin}},{output:{outcome:'green',debtPolicy:'forbidden'}},{missionId:'mission:chain'});
  assert.match(driftErrors.join('\n'),/source differs from registered visual PASS/);

  const feature=`contract-chain-${process.pid}`;
  const snapshotRef=`.worktrees/uat/${feature}/happy/snapshot.json`;
  const resultRef=`.worktrees/uat/${feature}/happy/result.json`;
  const artifactRoot=new URL(`../../.worktrees/uat/${feature}/happy/`,import.meta.url);
  const featureRoot=new URL(`../../.worktrees/uat/${feature}/`,import.meta.url);
  t.after(()=>fs.rmSync(featureRoot,{recursive:true,force:true}));
  fs.mkdirSync(artifactRoot,{recursive:true});
  const snapshotDocument={version:'7.6.0-beta.1',feature,flow:'happy',sourceHeads:['git:one'],cases:['happy']};
  const snapshotFingerprint=uatContentFingerprint(snapshotDocument);
  fs.writeFileSync(new URL('snapshot.json',artifactRoot),`${JSON.stringify(snapshotDocument)}\n`);
  const stage=(receiptId,operatorId,input,output,timestamp)=>registry.record(operatorId,{output},{receiptId,missionId:'mission:chain',timestamp,trace:{input,sourceHeads:['git:one']}});
  stage('receipt:snapshot','test/uat-snapshot-freeze',{context:{sourceFingerprint:source},input:{feature,flow:'happy'}},{outcome:'frozen',canonicalRef:snapshotRef,contentFingerprint:snapshotFingerprint,evidenceRefs:['evidence://snapshot']},'2026-09-01T00:00:02.000Z');
  stage('receipt:cases','test/uat-case-freeze',{context:{snapshotRef,snapshotReturnReceiptRef:'receipt:snapshot',sourceFingerprint:source,missionRef:'mission:chain'},input:{browserSessionRef:'browser://one',accountRef:'account://fresh/one'}},{outcome:'frozen',result:{artifactRefs:['evidence://cases']},evidenceRefs:['evidence://cases']},'2026-09-01T00:00:03.000Z');
  stage('receipt:behavior','test/uat-behavior-proof',{context:{snapshotRef,caseFreezeReturnReceiptRef:'receipt:cases',sourceFingerprint:source},input:{browserSessionRef:'browser://one',accountRef:'account://fresh/one'}},{outcome:'failed',result:null,evidenceRefs:['evidence://behavior']},'2026-09-01T00:00:04.000Z');
  stage('receipt:ux','test/uat-ux-proof',{context:{snapshotRef,behaviorProofReturnReceiptRef:'receipt:behavior',sourceFingerprint:source},input:{browserSessionRef:'browser://one',accountRef:'account://fresh/one'}},{outcome:'passed',result:{artifactRefs:['evidence://ux']},evidenceRefs:['evidence://ux']},'2026-09-01T00:00:05.000Z');
  stage('receipt:ui','test/uat-ui-proof',{context:{snapshotRef,uxProofReturnReceiptRef:'receipt:ux',sourceFingerprint:source},input:{browserSessionRef:'browser://one',accountRef:'account://fresh/one'}},{outcome:'passed',result:{artifactRefs:['evidence://ui']},evidenceRefs:['evidence://ui']},'2026-09-01T00:00:06.000Z');
  const refs=['receipt:snapshot','receipt:cases','receipt:behavior','receipt:ux','receipt:ui',snapshotRef,snapshotFingerprint,'evidence://snapshot','evidence://cases','evidence://behavior','evidence://ux','evidence://ui'];
  const resultDocument={version:'7.6.0-beta.1',feature,flow:'happy',snapshotFingerprint,outcome:'passed',evidenceRefs:refs};
  const resultFingerprint=uatContentFingerprint(resultDocument);
  fs.writeFileSync(new URL('result.json',artifactRoot),`${JSON.stringify(resultDocument)}\n`);
  const publishInput={context:{snapshotRef,sourceFingerprint:source,priorVisualPassRef:'receipt:visual-pass',priorVisualPassedAt:'2026-09-01T00:00:01.000Z',snapshotReturnReceiptRef:'receipt:snapshot',caseFreezeReturnReceiptRef:'receipt:cases',behaviorProofReturnReceiptRef:'receipt:behavior',uxProofReturnReceiptRef:'receipt:ux',uiProofReturnReceiptRef:'receipt:ui'},input:{browserSessionRef:'browser://one',accountRef:'account://fresh/one',evidenceRefs:refs}};
  const publishOutput={output:{outcome:'passed',canonicalRef:resultRef,contentFingerprint:resultFingerprint,result:{artifactRefs:[resultRef]},evidenceRefs:refs}};
  const publishErrors=registry.validate('test/uat-result-publish',publishInput,publishOutput,{missionId:'mission:chain',timestamp:'2026-09-01T00:00:07.000Z'});
  assert.match(publishErrors.join('\n'),/PASS requires behavior, UX, and UI all passed/);
});
test('UAT cannot be invoked directly without the exact canonical Quality PASS origin',()=>{
  const value={
    schemaVersion:7,runId:'uat-direct',project:'starci',feature:'dashboard',flow:'happy',
    selection:selection('starci-uat-verify'),authorityRefs:['authority://uat'],runtimeEvidenceRefs:[],
    origin:{fromSkillId:'starci-quality-assure',returnReceiptRef:'receipt:invented-quality',expectedCallReceiptRef:'receipt:invented-call',sourceFingerprint:`sha256:${'1'.repeat(64)}`,evidenceFingerprint:`sha256:${'2'.repeat(64)}`,auditRef:'.artifacts/uat/audit.md'},
    sourceHeads:['git:one'],returnReceipt:null,progressHistory:[],
    scope:{status:'frozen',unit:'flow',targetRefs:['flow://dashboard/happy'],inclusionRefs:[],exclusionRefs:[],writeRoots:[],externalMutation:false,approvalRef:null,completionProofRefs:['proof://uat'],dimensions:[],ambiguityRefs:[]},
  };
  assert.match(validateUatSkill(value).errors.join('\n'),/requires the exact canonical Quality delivery-proof PASS origin/);
});
test('all owned machines are v7 and start with analyze-input',()=>{const validate=validatorFor(new URL('../skills/machine.schema.json',import.meta.url));for(const id of ids){const m=load(id);assert.equal(m.start,'analyze-input');assert.deepEqual(validate(m),{valid:true,errors:[]});}});
test('platform intents discriminate operators and emitted outcomes',()=>{const m=load('starci-platform-operate');assert.equal(nextState(m,'select-intent',{}, {mission:{intent:'sonar'}}),'sonar');assert.equal(route(m,'sonar','proved'),'complete');assert.equal(route(m,'tunnel-plan','ready'),'complete');});
test('release recovery and rollback execute instead of terminal blocking',()=>{const m=load('starci-release-manage');assert.equal(route(m,'monitor','recover'),'recover');assert.equal(route(m,'recover','rollback'),'rollback');assert.equal(route(m,'rollback','rolled-back'),'proof');});
test('quality findings, rules, and debt are measured loops',()=>{const m=load('starci-quality-assure');assert.equal(route(m,'inventory','findings',{debtPolicy:'allowed'}),'repair');assert.equal(route(m,'repair','repaired'),'inventory');assert.equal(route(m,'debt','progress'),'debt');});
test('workspace routes provenance and checkpoint intents',()=>{const m=load('starci-workspace-manage');assert.equal(nextState(m,'select-intent',{}, {mission:{intent:'provenance-query'}}),'query');assert.equal(nextState(m,'select-intent',{}, {mission:{intent:'checkpoint'}}),'checkpoint');});
const selection=(skillId)=>({analyzerVersion:2,skillId,confidence:'exact',interactionPolicy:'ask-only-when-stuck',activeInputRefs:['request:1'],passiveContextRefs:[]});
const scope=()=>({status:'frozen',unit:'revision',targetRefs:['git:abc'],inclusionRefs:[],exclusionRefs:[],writeRoots:[],externalMutation:true,approvalRef:'approval:1',completionProofRefs:['proof:published-head'],dimensions:[],ambiguityRefs:[]});
test('git publication requires approved exact heads and canonical progressing receipts',()=>{
  const receipt=createReceipt('CALL',{
    receiptId:'receipt:g1',
    missionId:'m1',
    skillId:'starci-git-publish',
    operatorId:'workspace/workflow-handoff',
    parentId:null,
    childId:'c1',
    context:{invocationRef:'invocation://owned-skills-git-publish',executionRef:`execution://${'e'.repeat(64)}`},
    input:{sourceHeads:['git:abc']},
    expectedOutput:{outcome:'published'},
  },{debug:false});
  const value={schemaVersion:7,skillId:'starci-git-publish',selection:selection('starci-git-publish'),mission:{missionId:'m1',project:'starci',objectiveRef:'request:1',intent:'publish',approvalRef:'approval:1',sourceHeads:['git:abc']},scope:scope(),receipts:[receipt]};
  assert.deepEqual(validateGit(value),{valid:true,errors:[]});
  value.mission.approvalRef=null;
  assert.match(validateGit(value).errors.join('\n'),/approval/);
});
test('public skill validators reject a schema-valid cloned receipt that runtime did not issue',()=>{
  const receipt=createReceipt('WAIT',{receiptId:'receipt:forgery-source',missionId:'m1',skillId:'starci-git-publish',operatorId:null,parentId:null,childId:null},{debug:true});
  const value={schemaVersion:7,skillId:'starci-git-publish',selection:selection('starci-git-publish'),mission:{missionId:'m1',project:'starci',objectiveRef:'request:1',intent:'publish',approvalRef:'approval:1',sourceHeads:['git:abc']},scope:scope(),receipts:[structuredClone(receipt)]};
  assert.match(validateGit(value).errors.join('\n'),/not a runtime-issued immutable receipt/);
});
test('selection envelope is exact and unresolved WAIT is rejected',()=>{const wait=createReceipt('WAIT',{receiptId:'receipt:w1',missionId:'m1',skillId:'starci-git-publish',operatorId:null,parentId:null,childId:null},{debug:true});const value={schemaVersion:7,skillId:'starci-git-publish',selection:selection('starci-git-publish'),mission:{missionId:'m1',project:'starci',objectiveRef:'request:1',intent:'publish',approvalRef:'approval:1',sourceHeads:['git:abc']},scope:scope(),receipts:[wait]};assert.match(validateGit(value).errors.join('\n'),/typed user authority/);value.selection.interactionPolicy='automatic';assert.equal(validateGit(value).valid,false);});
