import test from 'node:test';
import assert from 'node:assert/strict';
import {intakeOp,retemplateIntakeOps} from '../kernel/intake.mjs';

const loaded={list:[
  {id:'demo.sales',path:'features/sales/index.yaml',kind:'module'},
  {id:'demo.sales.business',path:'features/sales/business/overview/index.yaml',kind:'business',state:'done',effectiveState:'done'},
  {id:'demo.sales.architecture',path:'features/sales/architecture/overview/index.yaml',kind:'architecture',state:'done',effectiveState:'uninvestigate'},
  {id:'demo.sales.backend',path:'features/sales/implementation/backend/index.yaml',kind:'implementation',state:'done',effectiveState:'uninvestigate'}
]};
const state={job:'Continue the existing backend',ops:[]};

test('an existing feature is continued even when its historical intake mode was author',()=>{
  const before=structuredClone(loaded);
  const op=intakeOp(state,{workRoot:'.starciwork',loaded,index:0,entry:'sales',mode:'author'});
  assert.match(op.goal,/Continue the existing Work records/);
  assert.match(op.goal,/Preserve current accepted leaves/);
  assert.match(op.goal,/never refresh a completion digest without that review/);
  assert.doesNotMatch(op.goal,/every leaf record todo/);
  assert.deepEqual(op.allowlist,['.starciwork/features/sales/**']);
  assert.deepEqual(loaded,before,'describing a continuation cannot alter accepted or stale product records');
});

test('runtime retemplating preserves operation identity, history, evidence and its approved write scope',()=>{
  const op={...intakeOp(state,{workRoot:'.starciwork',loaded,index:0,entry:'sales',layers:['business','architecture']}),
    status:'ready',attempt:20,reports:[{outcome:'partial',files:['prior.yaml']}],ownedBaselinePaths:['prior.yaml'],
    candidate:{controlRoot:'preserved-control'},goal:'reset everything',acceptance:['every leaf record todo']};
  const running={...state,ops:[op]},before=structuredClone(op),events=[];
  retemplateIntakeOps({appendEvent:event=>events.push(event)},running,{work:{at:{workRoot:'.starciwork'}}},loaded);
  for(const key of ['id','attempt','reports','ownedBaselinePaths','candidate','allowlist'])assert.deepEqual(op[key],before[key]);
  assert.match(op.goal,/Continue the existing/);
  assert.match(op.goal,/every other layer of sales are outside the approved scope/);
  assert.equal(events.length,1);
  retemplateIntakeOps({appendEvent:event=>events.push(event)},running,{work:{at:{workRoot:'.starciwork'}}},loaded);
  assert.equal(events.length,1,'a stable continuation does not generate a new intake on each tick');
});
