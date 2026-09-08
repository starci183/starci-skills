import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetSteps,sessionBudgetErrors} from './validate-request.mjs';

test('a sealed forecast replaces unopened budget coordinates while every dispatched historical invocation still counts',()=>{
 const state={budget:{maxSteps:24,maxSameOperator:4},planHistory:{active:{ref:'immutable-plan'}},chain:[['1/1'],['4/1'],['6/1'],['8/1']],steps:{'1/1':'quality.verify','2/1':'quality.verify','4/1':'quality.verify','6/1':'quality.verify','8/1':'quality.verify'},attempts:{'1/1':{status:'matched'}},requestHashes:{}};
 const request={step:8,operatorId:'quality.verify'};
 assert.deepEqual(Object.keys(budgetSteps(state)),['1/1','4/1','6/1','8/1']);
 assert.deepEqual(sessionBudgetErrors(state,request),[]);
 const revision={steps:{'1/1':'quality.verify','5/1':'quality.verify','7/1':'quality.verify','9/1':'quality.verify'}};
 assert.equal(Object.values(budgetSteps(state,revision)).length,4);
 for(const status of ['running','waiting','blocked','mismatch','matched']) {
  const actual=structuredClone(state);actual.attempts['2/1']={status};
  assert.match(sessionBudgetErrors(actual,request).join('\n'),/BUDGET_EXHAUSTED/);
  assert.equal(Object.values(budgetSteps(actual,revision)).length,5);
 }
 const frozen=structuredClone(state);frozen.requestHashes['2/1']='sha256:frozen';
 assert.match(sessionBudgetErrors(frozen,request).join('\n'),/BUDGET_EXHAUSTED/);
 const ordinary=structuredClone(state);delete ordinary.planHistory;
 assert.match(sessionBudgetErrors(ordinary,request).join('\n'),/BUDGET_EXHAUSTED/);
 assert.match(sessionBudgetErrors(state,{...request,step:25}).join('\n'),/maxSteps/);
});
