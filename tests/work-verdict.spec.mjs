import test from 'node:test';
import assert from 'node:assert/strict';
import {treeVerdictFor} from '../kernel/verify.mjs';

const operation={nodeId:'owned',allowlist:['.starciwork/features/owned/architecture/index.yaml']};
const context=result=>({work:{repoRoot:process.cwd(),ledger:{workRoot:`${process.cwd()}/.starciwork`},validate:()=>result,
  node:()=>({path:'features/owned/architecture/index.yaml'})}});

test('a required Work gate refuses absent, inconclusive, and contradictory validator evidence',()=>{
  for(const result of [null,undefined,{},[],{ok:false,errors:[]},{ok:true},{ok:'true',errors:[]},
    {ok:true,errors:[{code:'INVALID',path:'features/elsewhere/index.yaml'}]},{ok:false,errors:[null]}]){
    const verdict=treeVerdictFor(context(result),operation);
    assert.equal(verdict.ok,false,JSON.stringify(result));
    assert.equal(verdict.own[0].code,'VALIDATOR');
  }
  assert.equal(treeVerdictFor(context({ok:true,errors:[]}),operation).ok,true);
});

test('a pathless Work failure stays blocking while attributable foreign errors remain explicit',()=>{
  const foreign={code:'STALE',path:'features/elsewhere/implementation/index.yaml'};
  const infrastructure={code:'VALIDATOR',message:'validation could not inspect the tree'};
  const result=treeVerdictFor(context({ok:false,errors:[foreign,infrastructure]}),operation);
  assert.equal(result.ok,false);
  assert.deepEqual(result.own,[infrastructure]);
  assert.deepEqual(result.foreign,[foreign]);
  const scoped=treeVerdictFor(context({ok:false,errors:[foreign]}),operation);
  assert.equal(scoped.ok,true);
  assert.deepEqual(scoped.foreign,[foreign]);
});
