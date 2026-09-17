import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllocator,loadRuntimes} from '../kernel/schedule.mjs';
import {resolveExecutionChain,selectExecutionTarget} from '../kernel/chains.mjs';
import {HEADLESS_PROVIDERS} from '../models/functions.mjs';
import {providerFor} from '../hosts/headless/host.mjs';

// Quota documents and journals still name the retired pool id; every key resolves through the alias onto the
// codex-agent provider window, so this grant opens ten codex slots and closes every other pool.
const exclusiveQuota=profile=>({order:['gpt-5.6-luna'],slots:Object.fromEntries([
  ...Object.keys(profile.runtimes).filter(id=>id!=='codex-agent').map(id=>[id,0]),['gpt-5.6-luna',10]])});

test('Luna references land on the codex-agent window and an explicit Luna model still launches Luna',()=>{
  const profile=loadRuntimes(),defaultAllocator=createAllocator({runtimes:profile});
  assert.equal(defaultAllocator.allocate('task.execute',{restrictTo:['gpt-5.6-luna'],difficulty:'medium'}).runtime,'codex-agent');
  assert.equal(profile.runtimes['codex-agent'].maxParallel,10);
  const allocator=createAllocator({runtimes:profile,quota:exclusiveQuota(profile)});
  const selection=allocator.candidateFor('task.execute','gpt-5.6-luna');
  assert.equal(selection.target,'codex-agent');
  assert.equal(selection.model,'gpt-5.6-luna');
  assert.equal(selection.runtime,'codex');
  assert.equal(selection.orcaLaunch.agent,'codex');
  assert.equal(profile.runtimes['codex-agent'].provider,'codex');
  const decided=allocator.allocate('decision.prepare',{difficulty:'medium'});
  assert.equal(decided.ok,true,decided.reason);
  assert.equal(decided.runtime,'codex-agent');
  // The retired id is never a chain member: every chain names the provider window, not the model profile.
  for(const kind of ['interface.draw','business.decide','work.author','backend.implement','interface.implement','review.verify','runtime.operate','content.generate'])
    assert.equal(resolveExecutionChain({op:kind}).candidates.some(item=>item.target==='gpt-5.6-luna'),false);
  assert.equal(selectExecutionTarget({op:'task.execute',inventory:[{runtime:'codex',status:'ready',profiles:['gpt-5.6-luna']}]}).selected.model,'gpt-5.6-luna');
  // The decide above already holds one of the ten granted codex-agent slots: one window, one count.
  for(let index=0;index<9;index++){
    const picked=allocator.allocate('task.execute',{difficulty:'hard',restrictTo:allocator.launchableTargets('task.execute')});
    assert.equal(picked.ok,true,picked.reason);
    assert.equal(picked.runtime,'codex-agent');
  }
  assert.equal(allocator.allocate('task.execute').ok,false,'every other pool is closed and codex is full');
  // Explicit model selection is unchanged: the launch-only target still reaches Luna on both hosts.
  const provider=providerFor({agent:'codex',model:'gpt-5.6-luna'});
  assert.equal(provider.id,'gpt-5.6-luna');
  assert.equal(provider.model,'gpt-5.6-luna');
});

test('Opus 5 is exact in operation and non-operation model calls',()=>{
  for(const op of ['task.execute','review.verify']){
    const candidate=resolveExecutionChain({op}).candidates.find(item=>item.target==='claude-agent');
    assert.equal(candidate.model,'claude-opus-5');
  }
  const command=HEADLESS_PROVIDERS['claude-agent'].command;
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
