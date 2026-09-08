import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {selectWorkflow,selectJobPlan,validateWorkflowCatalog} from '../workflows/select.mjs';
import {workflowDigest} from '../workflows/lifecycle.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL(`../workflows/${name}`,import.meta.url)));
const catalog=read('catalog.json'),jobs=read('jobs.json'),frontend=read('frontend.json'),frontendMatrix=read('matrix.json');
const ids=['analyze-request','prepare-work','define-business','design-architecture','design-interface','implement-backend','implement-frontend','verify-flows','review-code','publish-code','deploy-release','operate-runtime','correct-data','update-knowledge','produce-content','retire-scope'];
const classify=(action,effectful=true,requiresBackend=false)=>action==='implement-frontend'?{action,effectful,requiresBackend}:{action,effectful};
const acceptedBackendRun=()=>{const run={goal:{workflow:'implement-backend'},goalDigest:'b'.repeat(64),responses:{backend:{criteria:[{id:'unit-tests-pass',status:'pass',observation:'Unit suite passed.'},{id:'backend-e2e-pass',status:'pass',observation:'Backend E2E suite passed.'}],outputs:{apiContract:'GET /v1/items response contract'}}},status:'accepted',approvals:[]};run.resultDigest=workflowDigest({goalDigest:run.goalDigest,responses:run.responses});run.approvals.push({actor:'user',phase:'acceptance',approved:true,digest:run.resultDigest,messageId:'user-acceptance',quote:'Accept backend result'});return run;};

test('public catalog exposes exactly sixteen bounded jobs and no bypass aliases',()=>{
  assert.deepEqual(catalog.workflows.map(x=>x.id),ids);
  assert.equal(validateWorkflowCatalog(catalog,jobs,frontend).ok,true);
  for(const old of ['direct-task','fullstack-delivery','frontend','backend-delivery','source-to-work'])assert.equal(catalog.workflows.some(x=>x.id===old),false);
  for(const job of jobs.workflows){assert.ok(job.matrix.length>=1&&job.matrix.length<=3,job.id);assert.ok(job.matrix.every(row=>row.length>=1&&row.length<=3),job.id);}
  assert.deepEqual(frontendMatrix.rows.flat().map(x=>x.id),['draw','implement','uat']);
});

test('questions and vague analysis remain read-only while effectful ambiguity is rejected',()=>{
  assert.deepEqual(selectWorkflow(catalog,{readOnly:true}),{kind:'answer-or-inspect'});
  assert.equal(selectWorkflow(catalog,{readOnly:true,classification:classify('analyze-request',false)}).id,'analyze-request');
  assert.throws(()=>selectWorkflow(catalog,{classification:classify('analyze-request',true),readOnly:true}));
  assert.throws(()=>selectWorkflow(catalog,{classification:{action:'implement-backend',effectful:false}}));
  assert.throws(()=>selectWorkflow(catalog,{}));
});

test('unknown and incompatible explicit choices fail instead of falling back',()=>{
  assert.throws(()=>selectWorkflow(catalog,{workflowId:'unknown',classification:classify('unknown')}));
  assert.throws(()=>selectWorkflow(catalog,{workflowId:'unknown',readOnly:true}),/Unknown explicitly selected workflow/);
  assert.throws(()=>selectWorkflow(catalog,{workflowId:'implement-frontend',classification:classify('implement-backend')}));
  assert.equal(selectWorkflow(catalog,{workflowId:'implement-backend',classification:classify('implement-backend')}).id,'implement-backend');
});

test('representative effect classes resolve only from frozen semantic classifications',()=>{
  const cases=[
    ['existing business change','define-business'],['backend only','implement-backend'],['frontend only','implement-frontend'],
    ['missing Work','prepare-work'],['architecture design','design-architecture'],['interface design','design-interface'],
    ['deploy only','deploy-release'],['publish only','publish-code'],['bounded data correction','correct-data'],
    ['standalone UAT','verify-flows'],['runtime operation','operate-runtime'],['knowledge update','update-knowledge'],
    ['content production','produce-content'],['scope retirement','retire-scope'],
  ];
  for(const [label,action]of cases)assert.equal(selectWorkflow(catalog,{classification:classify(action),readOnly:false}).id,action,label);
  assert.equal(selectWorkflow(catalog,{classification:classify('review-code',false),readOnly:true}).id,'review-code');
});

test('do-not-code constraints cannot be represented by implementation actions',()=>{
  for(const action of ['analyze-request','define-business','design-architecture','design-interface'])assert.doesNotThrow(()=>selectWorkflow(catalog,{classification:classify(action,action!=='analyze-request'),readOnly:action==='analyze-request'}));
  assert.throws(()=>selectWorkflow(catalog,{workflowId:'implement-backend',classification:classify('design-architecture')}));
});

test('a same-plan backend change precedes frontend with no inferred successor',()=>{
  const actions=[classify('implement-backend'),classify('implement-frontend',true,true)];
  const plan=selectJobPlan(catalog,{actions});
  assert.deepEqual(plan.jobs.map(x=>x.id),['implement-backend','implement-frontend']);
  assert.equal(plan.ordered,true);
  assert.equal(plan.inferredSuccessors,0);
  assert.throws(()=>selectJobPlan(catalog,{actions:[classify('implement-frontend',true,true),classify('implement-backend')]}));
});

test('deploy does not imply publish and standalone verification does not imply implementation',()=>{
  assert.deepEqual(selectJobPlan(catalog,{actions:[classify('deploy-release')]}).jobs.map(x=>x.id),['deploy-release']);
  assert.deepEqual(selectJobPlan(catalog,{actions:[classify('verify-flows')]}).jobs.map(x=>x.id),['verify-flows']);
  assert.deepEqual(selectJobPlan(catalog,{actions:[classify('publish-code'),classify('deploy-release')]}).jobs.map(x=>x.id),['publish-code','deploy-release']);
});

test('frontend-only reuses an actually accepted backend run and rejects forged or partial proof',()=>{
  const accepted=acceptedBackendRun();
  assert.deepEqual(selectJobPlan(catalog,{actions:[classify('implement-frontend',true,true)],acceptedBackendRun:accepted}).jobs.map(x=>x.id),['implement-frontend']);
  assert.throws(()=>selectJobPlan(catalog,{actions:[classify('implement-frontend',true,true)],acceptedBackendEvidence:{workflow:'implement-backend',resultDigest:'a'.repeat(64),unit:true,backendE2E:true,apiContract:'forged'}}));
  for(const mutate of [r=>r.status='running',r=>r.resultDigest='a'.repeat(64),r=>r.approvals=[],r=>r.responses.backend.criteria[0].status='fail',r=>r.responses.backend.outputs.apiContract='']){const bad=structuredClone(accepted);mutate(bad);assert.throws(()=>selectJobPlan(catalog,{actions:[classify('implement-frontend',true,true)],acceptedBackendRun:bad}));}
});

test('backend job requires distinct unit and backend E2E acceptance before frontend handoff',()=>{
  const backend=jobs.workflows.find(x=>x.id==='implement-backend');
  const cell=backend.matrix.flat()[0];
  assert.ok(cell.criteria.includes('unit-tests-pass'));
  assert.ok(cell.criteria.includes('backend-e2e-pass'));
  assert.ok(cell.outputs.includes('acceptedBackendEvidence'));
  assert.equal(frontend.id,'implement-frontend');
  assert.deepEqual(frontend.criteria.uat,['flows-pass','ux-pass','recording-complete','cleanup-complete']);
  assert.ok(frontend.handoffs.some(x=>x.from==='implement.outputs.codeRefs'&&x.to==='uat.inputs.codeRefs'));
});

test('catalog skill path resolves to the actual project skill',()=>{
  const actual=fs.realpathSync(fileURLToPath(new URL('../SKILL.md',import.meta.url)));
  assert.equal(fs.realpathSync(fileURLToPath(new URL(catalog.skill,new URL('../workflows/catalog.json',import.meta.url)))),actual);
});
