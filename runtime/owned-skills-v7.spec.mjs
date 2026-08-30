import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatorFor } from '../operators/validation.mjs';
import { nextState } from '../skills/route-machine.mjs';
import { createReceipt } from './trace.mjs';
import { validateInput as validateGit } from '../skills/starci-git-publish/validate-input.mjs';
import { validateOutput as validateDeliveryProof } from '../operators/quality/delivery-proof/validate-output.mjs';

const ids=['starci-quality-assure','starci-release-manage','starci-platform-operate','starci-workspace-manage','starci-git-publish'];
const load=(id)=>JSON.parse(fs.readFileSync(new URL(`../skills/${id}/machine.json`,import.meta.url)));
const route=(machine,stateId,outcome)=>{const matches=machine.states[stateId].on.filter((edge)=>edge.when?.outputEquals?.outcome===outcome);assert.equal(matches.length,1);return matches[0].target;};
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
test('all owned machines are v7 and start with analyze-input',()=>{const validate=validatorFor(new URL('../skills/machine.schema.json',import.meta.url));for(const id of ids){const m=load(id);assert.equal(m.start,'analyze-input');assert.deepEqual(validate(m),{valid:true,errors:[]});}});
test('platform intents discriminate operators and emitted outcomes',()=>{const m=load('starci-platform-operate');assert.equal(nextState(m,'select-intent',{}, {mission:{intent:'sonar'}}),'sonar');assert.equal(route(m,'sonar','proved'),'complete');assert.equal(route(m,'tunnel-plan','ready'),'complete');});
test('release recovery and rollback execute instead of terminal blocking',()=>{const m=load('starci-release-manage');assert.equal(route(m,'monitor','recover'),'recover');assert.equal(route(m,'recover','rollback'),'rollback');assert.equal(route(m,'rollback','rolled-back'),'proof');});
test('quality findings, rules, and debt are measured loops',()=>{const m=load('starci-quality-assure');assert.equal(route(m,'inventory','findings'),'repair');assert.equal(route(m,'repair','repaired'),'inventory');assert.equal(route(m,'debt','progress'),'debt');});
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
