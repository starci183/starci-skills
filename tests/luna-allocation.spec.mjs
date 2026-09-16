import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllocator,loadRuntimes} from '../kernel/schedule.mjs';
import {resolveExecutionChain,selectExecutionTarget} from '../kernel/chains.mjs';
import {HEADLESS_PROVIDERS} from '../models/functions.mjs';

const exclusiveQuota=profile=>({order:['gpt-5.6-luna'],slots:Object.fromEntries(
  Object.keys(profile.runtimes).map(id=>[id,id==='gpt-5.6-luna'?10:0]))});

test('Luna participates in general operation allocation with bounded default and explicit capacity',()=>{
  const profile=loadRuntimes(),defaultAllocator=createAllocator({runtimes:profile});
  assert.equal(defaultAllocator.allocate('task.execute',{restrictTo:['gpt-5.6-luna'],difficulty:'medium'}).ok,true);
  assert.equal(profile.runtimes['gpt-5.6-luna'].maxParallel,2);
  const allocator=createAllocator({runtimes:profile,quota:exclusiveQuota(profile)});
  const selection=allocator.candidateFor('task.execute','gpt-5.6-luna');
  assert.equal(selection.model,'gpt-5.6-luna');
  assert.equal(selection.runtime,'codex');
  assert.equal(selection.orcaLaunch.agent,'codex');
  assert.equal(profile.runtimes['gpt-5.6-luna'].provider,profile.runtimes['gpt-5.6-sol'].provider);
  assert.equal(allocator.allocate('decision.prepare').ok,false);
  for(const kind of ['interface.draw','business.decide','work.author'])
    assert.equal(resolveExecutionChain({op:kind}).candidates.some(item=>item.target==='gpt-5.6-luna'),false);
  for(const kind of ['backend.implement','interface.implement','review.verify','runtime.operate','content.generate'])
    assert.equal(resolveExecutionChain({op:kind}).candidates.some(item=>item.target==='gpt-5.6-luna'),true);
  assert.equal(selectExecutionTarget({op:'task.execute',inventory:[{runtime:'codex',status:'ready',profiles:['gpt-5.6-luna']}]}).selected.model,'gpt-5.6-luna');
  for(let index=0;index<10;index++){
    const picked=allocator.allocate('task.execute',{difficulty:'hard',restrictTo:allocator.launchableTargets('task.execute')});
    assert.equal(picked.ok,true,picked.reason);
    assert.equal(picked.runtime,'gpt-5.6-luna');
  }
  assert.equal(allocator.allocate('task.execute').ok,false,'global ceiling still holds');
});

test('Opus 5 is exact in operation and non-operation model calls',()=>{
  for(const op of ['task.execute','review.verify']){
    const candidate=resolveExecutionChain({op}).candidates.find(item=>item.target==='claude-opus');
    assert.equal(candidate.model,'claude-opus-5');
  }
  const command=HEADLESS_PROVIDERS['claude-opus'].command;
  assert.equal(command[command.indexOf('--model')+1],'claude-opus-5');
});

test('an explicit Luna maintenance selection retains observed Codex quota and admission limits',()=>{
  const profile=loadRuntimes(),quota=exclusiveQuota(profile);
  const allocator=createAllocator({runtimes:profile,quota,providerAdmission:()=>({
    source:'test-authoritative-admission',providers:{codex:{capacity:2,used:2}}
  })});
  const result=allocator.allocate('task.execute',{restrictTo:['gpt-5.6-luna']});
  assert.equal(result.ok,false);
  assert.match(JSON.stringify(result),/provider family capacity/);
});
