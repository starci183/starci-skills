import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePlan,planProgress} from '../workflows/plan.mjs';
import {createBundle,renderPlan} from '../scripts/plan.mjs';
import {parseYaml} from '../core/yaml.mjs';

import {readWorkflow, readExample, readPublicJson} from './helpers/read-public.mjs';
const catalog=readWorkflow('catalog.json');
// Synthetic complete product route, not acceptance evidence for any real project.
function fullPlan() {
 const plan=readWorkflow('plan.template.json');
 Object.assign(plan,{id:'synthetic-product',requestId:'synthetic-request',originalRequest:'Deliver a working request-to-result product with backend, frontend and UAT.',finalOutcome:'An owner submits a request and receives a persisted result verified through the UI.'});
 const make=(id,workflow,dependsOn)=>({id,workflow,purpose:`Complete ${id}`,input:'Accepted output of the preceding job, or original intent',output:`Reviewed ${id} deliverable`,criteria:[`${id}-accepted`],workTargets:[`synthetic.${id}`],paths:[],resources:[],dependsOn,openQuestions:[],estimate:{minMinutes:10,maxMinutes:30,assumptions:'Synthetic local fixture only'},selection:{requestQuote:plan.originalRequest,codeChange:workflow.startsWith('implement-'),verification:workflow==='implement-frontend'?'browser-uat':'none',separateDeliverable:false}});
 plan.workflows=[make('business','define-business',[]),make('architecture','design-architecture',['business']),make('backend','implement-backend',['architecture']),make('frontend','implement-frontend',['backend'])];
 for(const area of ['business','architecture','implementation','backend','frontend','uat'])plan[area]={action:'change',outcome:`Deliver ${area} outcome`,targets:[`synthetic.${area}`],workflowIds:area==='implementation'?['backend','frontend']:[area==='uat'?'frontend':area],evidence:[],reason:''};
 plan.completionCriteria=[{id:'end-to-end',outcome:'The real UI result survives reload and matches the backend record.',workflowIds:['backend','frontend']}];
 return plan;
}

test('complete Plan retains future architecture, BE, FE and UAT with unresolved future questions',()=>{
 const p=fullPlan();p.workflows[1].openQuestions=['Which persistence strategy meets the accepted recovery requirement?'];
 assert.equal(validatePlan(p,catalog).ok,true);
 const rendered=renderPlan(p);
 for(const value of ['## Coverage','## Plan completion','## Workflow checkpoints','backend','frontend','persistence strategy'])assert.ok(rendered.includes(value));
 assert.deepEqual(p.workflows.map(j=>j.id),['business','architecture','backend','frontend']);
});
test('business-only truncation cannot retain dangling downstream coverage',()=>{
 const p=fullPlan();p.workflows=p.workflows.slice(0,1);
 assert.throws(()=>validatePlan(p,catalog),/coverage|producing workflows/);
});
test('both backend and frontend coverage are mandatory even when implementation summary exists',()=>{
 for(const area of ['backend','frontend']){const p=fullPlan();delete p[area];assert.throws(()=>validatePlan(p,catalog),/Scope must explain/);}
});
test('changed areas need a producing job and reuse needs existing evidence, not deferred work',()=>{
 const p=fullPlan();p.architecture.workflowIds=[];assert.throws(()=>validatePlan(p,catalog),/producing workflows/);
 p.architecture.action='reuse';p.architecture.outcome='Decide architecture later';assert.throws(()=>validatePlan(p,catalog),/deferred work is not reuse/);
 p.architecture.evidence=['synthetic-accepted-architecture'];assert.equal(validatePlan(p,catalog).ok,true);
 // Structural validation cannot authenticate the truth of a supplied reference.
});
test('non-applicability needs a reason and cannot also declare pending work',()=>{
 const p=fullPlan();p.backend={action:'not-applicable',outcome:'No backend in this bounded scope',targets:[],workflowIds:[],evidence:[],reason:''};
 assert.throws(()=>validatePlan(p,catalog),/Non-applicable/);
 p.backend.reason='Synthetic frontend-only contract';assert.equal(validatePlan(p,catalog).ok,true);
 p.backend.workflowIds=['backend'];assert.throws(()=>validatePlan(p,catalog),/Non-applicable/);
});
test('terminal outcome must have concrete criteria and known producer identities',()=>{
 const p=fullPlan();p.completionCriteria=[];assert.throws(()=>validatePlan(p,catalog),/terminal completion/);
 p.completionCriteria=[{id:'finish',outcome:'Verified user result',workflowIds:['missing']}];assert.throws(()=>validatePlan(p,catalog),/terminal criterion/);
});
test('one finished workflow is never the complete Plan and missing jobs remain pending',()=>{
 const p=fullPlan();assert.equal(planProgress(p,{}),'planned');
 assert.equal(planProgress(p,{business:{status:'done'}}),'in-progress');
 assert.equal(planProgress(p,{business:{status:'done'},architecture:{status:'blocked'}}),'blocked');
 const all=Object.fromEntries(p.workflows.map(j=>[j.id,{status:'done'}]));assert.equal(planProgress(p,all),'done');
 all.frontend.status='accepted';assert.equal(planProgress(p,all),'in-progress');
});
test('legacy Plans remain readable but cannot be used to create new v1 bundles',()=>{
 const p=fullPlan();p.schema='starci/plan@1';assert.equal(validatePlan(p,catalog).ok,true);
 assert.match(renderPlan(p),/Legacy Plan v1/);
 assert.throws(()=>createBundle(p,'unused-legacy-destination'),/New Plan bundles/);
});
test('new four-file bundles keep all future jobs pending and round-trip through the CLI',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'starci-full-plan-'));
 t.after(()=>{assert.equal(path.dirname(base),fs.realpathSync(os.tmpdir()));fs.rmSync(base,{recursive:true,force:true});});
 const p=fullPlan(),dir=createBundle(p,path.join(base,p.id));
 const read=rel=>parseYaml(fs.readFileSync(path.join(dir,rel),'utf8'));
 const stored=read('run/index.yaml');assert.equal(stored.status,'awaiting-plan-approval');
 assert.deepEqual(Object.keys(stored.jobs),p.workflows.map(j=>j.id));
 for(const id of Object.keys(stored.jobs)){assert.equal(stored.jobs[id].status,'planned');assert.deepEqual(read('approval/index.yaml').jobs[id].receipts,[]);}
 const output=execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/plan.mjs',import.meta.url)),'render',path.join(dir,'goal/index.yaml')],{encoding:'utf8'});
 assert.equal(output,renderPlan(p));assert.deepEqual(read('goal/index.yaml').plan,p);
});
