import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {selectOperation} from '../ops/select.mjs';
import {outputs} from '../ops/generate.mjs';
import {validateCatalog} from '../ops/validate.mjs';
import {approveGoal,presentGoal,propose,requestCell,validateGoal} from '../workflows/lifecycle.mjs';

const contract=parseYaml(fs.readFileSync(new URL('../ops/review.verify/operator.yaml',import.meta.url),'utf8'));

test('review-code goals select delivery, stale, or lint contracts without inventing another job',()=>{
  const goal={schema:'starci/goal@1',id:'source-audit',originalRequest:'Inspect source freshness',requestId:'source-request',
    finalOutcome:'A reproducible report for the selected scope',workflow:'review-code',
    scope:{business:['Source freshness'],paths:[],resources:['audit-report'],exclusions:['Source repair']},
    criteria:['measured'],businessChanges:['No product behavior change'],impacts:[],
    resourceEffects:[{target:'audit-report',operation:'write-report',postcondition:'Machine findings retained'}],
    workTargets:['audit-record'],inputs:{request:'Inspect source freshness'},
    cells:[{id:'review-code',op:'review.verify',operation:'delivery',purpose:'Measure inputs',finalOutput:'Audit report',
      criteria:['measured'],outputSchema:{type:'string'},inputs:{request:{from:'request',key:'request'}}}]};
  for(const operation of ['delivery','stales','lint']){
    goal.cells[0].operation=operation;assert.equal(validateGoal(goal).ok,true);
  }
  goal.cells[0].operation='repair';assert.throws(()=>validateGoal(goal),/supported workflow operation/);
});

test('script audit and lint selection expose only attempt reports, never producer or completion writes',()=>{
  for(const mode of ['stales','lint']){
    const selected=selectOperation(contract,mode);
    assert.deepEqual(selected.writes.map(write=>write.id),['evidence']);
    assert.ok(selected.writes.every(write=>write.path.split(' + ').every(file=>file.startsWith('E/'))));
    assert.equal(selected.executionModes,undefined);
    assert.equal(selected.graphPolicy.dispatch,'never');
  }
  assert.throws(()=>selectOperation(contract,['stales','lint']));
});

test('generated static-check modes cannot acquire source-write permission through mode selection',()=>{
  const catalog=JSON.parse(outputs().get('catalog.json'));
  const op=catalog.ops.find(op=>op.id==='review.verify');
  for(const mode of ['stales','lint']){
    const altered=structuredClone(catalog);
    // Locate explicitly: array position is not an authority identity.
    const target=altered.ops.find(item=>item.id==='review.verify').contract.executionModes[mode];
    target.writes.push({id:'source',path:'repository:<repo-id>/src/**',fields:['contents'],content:{en:'Unauthorized repair'}});
    target.placeholders={'repo-id':'actual repository'};
    target.steps[0].writes.push('source');
    const checked=validateCatalog(altered,{repositoryRoot:process.cwd()});
    assert.equal(checked.ok,false);
    assert.ok(checked.errors.some(error=>error.code==='MODE_IO_DRIFT'||error.code==='MODE_SOURCE_AUTHORITY'));
  }
  assert.deepEqual(op.contract.executionModes.stales.writes.map(write=>write.id),['evidence']);
});

const approvedAudit=(goal,workRoot)=>{
  let run=propose(goal,{workRoot});
  const section={action:'not-applicable',outcome:'Read-only source audit',targets:[],workflowIds:[],evidence:[],reason:'The audit changes no product input.'};
  const plan={schema:'starci/plan@2',id:'source-audit-plan',requestId:goal.requestId,originalRequest:goal.originalRequest,
    finalOutcome:goal.finalOutcome,business:section,architecture:section,implementation:{...section,action:'reuse',targets:['audit-record'],
      workflowIds:[],evidence:['canonical Work source bindings'],reason:'The workflow measures existing implementation inputs.'},
    backend:section,frontend:section,uat:section,exclusions:['Source repair'],completionCriteria:[{id:'measured',outcome:goal.finalOutcome,workflowIds:['audit-job']}],openQuestions:[],
    workflows:[{id:'audit-job',workflow:'review-code',selection:{requestQuote:goal.originalRequest,codeChange:false,verification:'none',separateDeliverable:false},
      purpose:goal.finalOutcome,input:'Approved source audit request',output:'Typed findings report',criteria:goal.criteria,workTargets:goal.workTargets,
      paths:goal.scope.paths,resources:goal.scope.resources,dependsOn:[],estimate:{minMinutes:1,maxMinutes:2,assumptions:'Synthetic runtime fixture'},openQuestions:[]}]};
  run=presentGoal(run,{messageId:'source-audit-presented',scope:plan,jobId:'audit-job'});
  return approveGoal(run,{actor:'user',phase:'goal',approved:true,digest:run.goalDigest,messageId:'source-audit-approved',
    replyTo:'source-audit-presented',quote:'Approve this exact read-only audit fixture.'});
};

test('an actual review-code request can measure stale Work but malformed or missing Work still fails closed',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-source-audit-')),root=path.join(dir,'.starciwork');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const put=(relative,value)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(value));};
  put('workspace.yaml',{schema:'work/workspace@1',id:'source-audit'});
  put('audit-record/index.yaml',{schema:'work/node@2',id:'audit-record',kind:'operations',required:true,state:'uninvestigate',
    blockers:['Existing source and evidence require measurement.'],assertions:['source-current'],description:'A deliberately unfinished subject for read-only audit dispatch.'});
  const goal={schema:'starci/goal@1',id:'source-audit',originalRequest:'Inspect source freshness without changing it.',requestId:'source-request',
    finalOutcome:'A reproducible source freshness report for the selected subject.',workflow:'review-code',
    scope:{business:['Source freshness'],paths:[],resources:['audit-report'],exclusions:['Source repair']},criteria:['measured'],
    businessChanges:['No product behavior change.'],impacts:[],resourceEffects:[{target:'audit-report',operation:'write-report',postcondition:'Machine findings retained'}],
    workTargets:['audit-record'],inputs:{request:'Inspect source freshness'},cells:[{id:'review-code',op:'review.verify',operation:'stales',
      purpose:'Measure current source bindings',finalOutput:'Typed audit report',criteria:['measured'],outputSchema:{type:'string'},
      inputs:{request:{from:'request',key:'request'}}}]};
  const approved=approvedAudit(goal,root),issued=requestCell(approved,'review-code');
  assert.equal(issued.request.operation,'stales');
  assert.deepEqual(issued.request.workBindings.map(binding=>binding.id),['audit-record']);
  const deliveryGoal=structuredClone(goal);deliveryGoal.cells[0].operation='delivery';
  assert.throws(()=>requestCell(approvedAudit(deliveryGoal,root),'review-code'),/investigated, unblocked and eligible/,
    'ordinary delivery review still requires ready Work');
  put('broken/index.yaml',{schema:'work/node@2',id:'audit-record',kind:'operations',required:true,state:'todo',assertions:['duplicate'],description:'Duplicate id is invalid.'});
  assert.throws(()=>requestCell(approved,'review-code'),/Work graph is invalid/);
  fs.rmSync(path.join(root,'broken'),{recursive:true,force:true});
  const missingGoal=structuredClone(goal);missingGoal.id='missing-audit';missingGoal.workTargets=['missing'];missingGoal.cells[0].workTargets=['missing'];
  assert.throws(()=>requestCell(approvedAudit(missingGoal,root),'review-code'),/Every Work target must resolve/);
});
