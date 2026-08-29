import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { nextState } from '../skills/route-machine.mjs';
import { validateInput as validateFeInput } from '../skills/starci-fe-process/validate-input.mjs';
import { validateInput as validateUatInput } from '../skills/starci-uat-verify/validate-input.mjs';
import { validateInput as validateReviewInput } from './fe/independent-review/validate-input.mjs';
import { validateOutput as validateDirectionOutput } from './fe/direction-generate/validate-output.mjs';

const machine = JSON.parse(readFileSync(new URL('../skills/starci-fe-process/machine.json', import.meta.url)));
const selection=(skillId)=>({analyzerVersion:2,skillId,confidence:'exact',interactionPolicy:'ask-only-when-stuck',activeInputRefs:['request://current'],passiveContextRefs:[]});
const feInput = (intent, objective) => ({ schemaVersion:7, runId:'mission-1', project:'academy', selection:selection('starci-fe-process'), intent, objective, targetHints:['route://academy/fe','surface://Profile'], authorityRefs:['business://profile'], resume:null, receiptType:'NONE', returnReceipt:null, progressHistory:[], mutationAuthorizationRef:null, verifiedFrontendRoute:'.workspaces/projects/academy/fe.json', exactFiles:[{path:'src/Profile.tsx',beforeSha256:`sha256:${'a'.repeat(64)}`}], approvedContractFingerprint:null });
const routed = (outcome) => ({ output:{ outcome } });

test('audit Profile compiles as one frontend mission and traverses all three independent audit lenses', () => {
  assert.deepEqual(validateFeInput(feInput('audit','Audit Profile')), {valid:true,errors:[]});
  assert.equal(nextState(machine,'compile',routed('compiled'),feInput('audit','Audit Profile')),'resolve');
  assert.equal(nextState(machine,'semantic-audit',routed('passed'),{}),'ux-audit');
  assert.equal(nextState(machine,'ux-audit',routed('passed'),{}),'ui-audit');
  assert.equal(nextState(machine,'ui-audit',routed('findings'),{}),'classify');
});

test('create page X auto-selects a dominant action without generating choices', () => {
  assert.deepEqual(validateFeInput(feInput('create','Create page X')), {valid:true,errors:[]});
  assert.equal(nextState(machine,'classify',routed('dominant'),{}),'freeze');
});

test('a true authority choice generates and ranks 3-4 directions before WAIT', () => {
  assert.equal(nextState(machine,'classify',routed('choice-required'),{}),'generate');
  const value={schemaVersion:7,operatorId:'fe/direction-generate',output:{outcome:'generated',result:{summary:'Four distinct directions.',artifactRefs:['artifact://directions'],directionCount:4,materialDifferences:['navigation model','information hierarchy','interaction character','responsive composition']},gaps:[],evidenceRefs:['authority://frozen'],handoff:null}};
  assert.deepEqual(validateDirectionOutput(value),{valid:true,errors:[]});
  assert.equal(nextState(machine,'generate',value,{}),'rank');
  assert.equal(nextState(machine,'rank',routed('ranked'),{}),'direction-choice');
  assert.equal(machine.states['direction-choice'].kind,'wait');
  assert.equal(machine.states['direction-choice'].approval.resumeTarget,'analyze-input');
  assert.deepEqual(Object.keys(machine.states['direction-choice'].approval).sort(),['approve','prompt','reject','resumeTarget']);
});

test('selected user direction resumes only through a typed RESUME receipt', () => {
  const value=feInput('redesign','Redesign Profile');
  value.receiptType='RESUME';
  value.resume={missionRef:'mission://profile',fromSkillId:'user-choice',receiptRef:'receipt:direction-choice',resumeState:'direction-choice'};
  value.returnReceipt={version:'7.0.0',receiptId:'receipt:direction-choice',type:'RESUME',missionId:'mission-1',skillId:'starci-fe-process',operatorId:null,parentId:'wait-direction',childId:null,timestamp:'2026-01-01T00:00:00.000Z',progressFingerprint:`sha256:${'f'.repeat(64)}`,trace:{selectedDirectionRef:'direction://focused'}};
  assert.deepEqual(validateFeInput(value),{valid:true,errors:[]});
  assert.equal(nextState(machine,'analyze-input',null,value),'consume-choice-resume');
  assert.equal(nextState(machine,'consume-choice-resume',routed('consumed'),value),'choice-resume-route');
  assert.equal(nextState(machine,'choice-resume-route',null,value),'freeze');
});

test('independent review cannot receive implementer rationale', () => {
  const value={schemaVersion:7,operatorId:'fe/independent-review',context:{frozenAuthority:['business://profile','grammar://project'],frozenEvidence:['render://profile'],uiKnowledgeId:'fe.ui'},input:{reviewTarget:'surface://Profile',reviewLenses:['semantic','ux','ui']}};
  assert.deepEqual(validateReviewInput(value),{valid:true,errors:[]});
  value.context.implementerRationale='I chose cards because...';
  assert.equal(validateReviewInput(value).valid,false);
});

test('FE to backend handoff resumes the exact same FE mission', () => {
  const original=feInput('create','Create page X');
  original.resume={missionRef:'mission://feature-x',fromSkillId:'starci-backend-process',receiptRef:'receipt://api-ready',resumeState:'apply'};
  original.receiptType='RETURN'; original.returnReceipt={version:'7.0.0',receiptId:'receipt:api-ready',type:'RETURN',missionId:'mission-1',skillId:'starci-backend-process',operatorId:null,parentId:'call-fe-be',childId:null,timestamp:'2026-01-01T00:00:00.000Z',progressFingerprint:`sha256:${'b'.repeat(64)}`,trace:{authorityRefs:['business://profile'],sourceHeads:['git:backend']}};
  assert.deepEqual(validateFeInput(original),{valid:true,errors:[]});
  assert.equal(nextState(machine,'analyze-input',null,original),'consume-return');
  assert.equal(nextState(machine,'consume-return',routed('consumed'),original),'peer-guard');
  assert.equal(nextState(machine,'peer-guard',routed('progress'),original),'resume-route');
  assert.equal(nextState(machine,'resume-route',null,original),'apply');
  assert.equal(nextState(machine,'apply',routed('applied'),original),'capture');
});

test('UAT verification binds canonical backend-owned feature/flow authority', () => {
  const value={schemaVersion:7,runId:'uat-1',project:'academy',selection:selection('starci-uat-verify'),feature:'profile',flow:'edit-profile',authorityRefs:['business://profile','source://revision'],runtimeEvidenceRefs:['runtime://capture'],returnReceipt:null,progressHistory:[]};
  assert.deepEqual(validateUatInput(value),{valid:true,errors:[]});
});
