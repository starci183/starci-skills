import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createBundle,renderPlan} from '../scripts/plan.mjs';import {parseYaml} from '../core/yaml.mjs';
test('Plan template requires concrete content and creates pending four-file bundle',()=>{
 const plan=JSON.parse(fs.readFileSync(new URL('../workflows/plan.template.json',import.meta.url)));assert.throws(()=>renderPlan(plan));
 Object.assign(plan,{id:'test-plan',requestId:'test-request',originalRequest:'Verify retry behavior',finalOutcome:'Retry recovers from a failed request'});
 for(const s of ['business','architecture','implementation','uat'])plan[s]={action:'reuse',outcome:'Verify existing behavior',targets:['retry']};
 Object.assign(plan.workflows[0],{id:'verify',workflow:'verify-flows',purpose:'Verify retry',input:'Existing implementation',output:'Observed browser result',criteria:['Retry works'],estimate:{minMinutes:5,maxMinutes:10,assumptions:'Local runtime available'}});
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'plan-template-'));try{const dir=createBundle(plan,path.join(base,'test-plan'));
 assert.equal(parseYaml(fs.readFileSync(path.join(dir,'approval/index.yaml'),'utf8')).jobs.verify.status,'pending');
 assert.deepEqual(parseYaml(fs.readFileSync(path.join(dir,'run/index.yaml'),'utf8')).jobs.verify.requests,{});
 assert.throws(()=>createBundle(plan,dir),/exists/);
 const rendered=renderPlan(plan);for(const label of ['## Goal','## Workflows','## Exclusions','## Approval','Input','Output','Criteria','Estimate'])assert.ok(rendered.includes(label));
 }finally{assert.equal(path.dirname(base),fs.realpathSync(os.tmpdir()));fs.rmSync(base,{recursive:true,force:true});}
});
