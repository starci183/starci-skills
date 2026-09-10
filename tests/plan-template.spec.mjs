import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createBundle,renderPlan} from '../scripts/plan.mjs';import {parseYaml} from '../core/yaml.mjs';
import {readWorkflow} from './helpers/read-public.mjs';
test('Plan template requires concrete content and creates pending four-file bundle',()=>{
const plan=readWorkflow('plan.template.json');assert.throws(()=>renderPlan(plan));
 Object.assign(plan,{id:'test-plan',requestId:'test-request',originalRequest:'Verify retry behavior',finalOutcome:'Retry recovers from a failed request'});
 for(const s of ['business','architecture','implementation','backend','frontend','uat'])plan[s]={action:'reuse',outcome:'Verify existing behavior',targets:['retry'],workflowIds:[],evidence:['synthetic-existing-retry-proof'],reason:''};
 plan.uat={...plan.uat,action:'change',workflowIds:['verify'],evidence:[]};
 plan.completionCriteria=[{id:'retry-result',outcome:'Retry recovers in the browser',workflowIds:['verify']}];
 Object.assign(plan.workflows[0],{id:'verify',workflow:'verify-flows',purpose:'Verify retry',selection:{requestQuote:'Verify retry behavior',codeChange:false,verification:'browser-uat',separateDeliverable:false},input:'Existing implementation',output:'Observed browser result',criteria:['Retry works'],estimate:{minMinutes:5,maxMinutes:10,assumptions:'Local runtime available'}});
 const wrongUat=structuredClone(plan);wrongUat.workflows[0].selection.verification='unit-component';assert.throws(()=>renderPlan(wrongUat),/browser UAT/);
 const fakeBackend=structuredClone(plan);fakeBackend.workflows[0].workflow='implement-backend';assert.throws(()=>renderPlan(fakeBackend),/merely to inspect/);
 const unrelated=structuredClone(plan);unrelated.workflows[0].selection.requestQuote='Add new filters';assert.throws(()=>renderPlan(unrelated),/request-bound/);
 const duplicate=structuredClone(plan);duplicate.workflows.unshift({...structuredClone(plan.workflows[0]),id:'frontend',workflow:'implement-frontend',selection:{requestQuote:plan.originalRequest,codeChange:true,verification:'browser-uat',separateDeliverable:false}});duplicate.workflows[1].dependsOn=['frontend'];assert.throws(()=>renderPlan(duplicate),/separate retest/);
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'plan-template-'));try{const dir=createBundle(plan,path.join(base,'test-plan'));
 assert.equal(parseYaml(fs.readFileSync(path.join(dir,'approval/index.yaml'),'utf8')).jobs.verify.status,'pending');
 assert.deepEqual(parseYaml(fs.readFileSync(path.join(dir,'run/index.yaml'),'utf8')).jobs.verify.requests,{});
 assert.throws(()=>createBundle(plan,dir),/exists/);
 const rendered=renderPlan(plan);for(const label of ['## Goal','## Workflows','## Exclusions','## Approval','Input','Output','Criteria','Estimate'])assert.ok(rendered.includes(label));
 }finally{assert.equal(path.dirname(base),fs.realpathSync(os.tmpdir()));fs.rmSync(base,{recursive:true,force:true});}
});
