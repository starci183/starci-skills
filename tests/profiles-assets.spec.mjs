import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveExecutionChain,selectExecutionTarget,selectProfile} from '../profiles/select.mjs';
import {readPublicJson} from './helpers/read-public.mjs';
import {validateAssets} from '../contracts/assets.mjs';

const qwenLaunch={kind:'command-terminal',command:'qwen --model qwen3.8-flash --approval-mode auto --exclude-tools agent --max-session-turns 240 --max-wall-time 90m --max-tool-calls 600 --chat-recording false',dispatch:'return-preamble-and-send'};

test('active roles select Codex, Claude or Qwen without reviving retired profiles or granting tools',()=>{
  const codex=selectProfile({runtime:'codex',op:'interface.implement',imageGenerationAvailable:true});
  assert.equal(codex.profile,'gpt-5.6-sol');assert.equal(codex.model,'gpt-5.6-sol');assert.equal(codex.imageGeneration,true);
  assert.equal(selectProfile({runtime:'openai',op:'business.decide'}).profile,'gpt-6-astra');
  assert.equal(selectProfile({runtime:'codex',op:'interface.implement'}).imageGeneration,false);
  const claude=selectProfile({runtime:'claude',op:'interface.implement',imageGenerationAvailable:true});
  assert.equal(claude.profile,'opus');assert.equal(claude.imageGeneration,false);assert.equal(claude.allowDeferredArtwork,true);
  assert.equal(selectProfile({runtime:'claude',op:'architecture.decide'}).profile,'fable-5.1');
  const qwen=selectProfile({runtime:'qwencloud',op:'interface.implement'});
  assert.equal(qwen.profile,'qwen3.8-flash-worker');assert.equal(qwen.model,'qwen3.8-flash');assert.equal(qwen.provider,'qwencloud-token-plan');
  const qwenReviewer=selectProfile({runtime:'qwen',op:'architecture.decide'});
  assert.equal(qwenReviewer.profile,'qwen3.8-flash-reviewer');assert.equal(qwenReviewer.model,'qwen3.8-flash');
  const deepSeekReviewer=selectProfile({runtime:'qwen',op:'review.verify',profile:'deepseek-v4-pro-reviewer'});
  assert.equal(deepSeekReviewer.profile,'deepseek-v4-pro-reviewer');assert.equal(deepSeekReviewer.model,'deepseek-v4-pro');
  const deepSeekWorker=selectProfile({runtime:'qwen',op:'backend.implement',profile:'deepseek-v4-pro-worker'});
  assert.equal(deepSeekWorker.profile,'deepseek-v4-pro-worker');assert.equal(deepSeekWorker.model,'deepseek-v4-pro');
  for(const options of [{runtime:'codex',profile:'astra'},{runtime:'claude',profile:'fable-legacy'},{runtime:'claude',profile:'sol-fresh'},{runtime:'codex',profile:'sol-fresh'},{runtime:'codex',profile:'sol-reviewer'}])assert.throws(()=>selectProfile({...options,op:'interface.implement'}));
  assert.throws(()=>selectProfile({runtime:'unknown',op:'interface.implement'}));
});
test('every operator has an ordered external-agent chain and skill-level defaults remain usable',()=>{
  const registry=readPublicJson('profiles/registry.json'),ops=readPublicJson('ops/catalog.json').ops.map(x=>x.id);
  assert.equal(registry.schema,'starci/profile-registry@3');
  assert.deepEqual(registry.agentArchitecture.levels,['plan','coordinator','workflow-wrapper','operation-wrapper-agent','concrete-operation-agent']);
  assert.equal(registry.agentArchitecture.isolationBoundary,'operation');
  assert.equal(registry.agentArchitecture.operationMapping,'one-operation-instance-one-agent');
  assert.equal(registry.executionModes.solo.controlPlane,'current-chat-session');
  assert.equal(registry.executionModes.solo.operationAgent,'isolated-background-agent');
  assert.equal(registry.executionModes.solo.maxConcurrentOperationAgents,3);
  assert.equal(registry.executionModes.solo.fanOutWithinOperation,'forbidden');
  assert.equal(registry.executionModes.orchestrated.workflowWrapperAgent,'persistent-native-manager-agent-in-child-worktree');
  assert.equal(registry.executionModes.orchestrated.operationAgent,'supervised-native-agent-in-workflow-worktree');
  assert.equal(registry.executionModes.orchestrated.worktree,'isolated-child-per-workflow-attempt');
  assert.equal(registry.executionModes.orchestrated.maxConcurrentOperationAgents,3);
  assert.deepEqual(Object.keys(registry.operators).sort(),[...ops].sort());
  const reasoningOps=new Set(['business.decide','architecture.decide']);
  for(const op of ops){
    const route=resolveExecutionChain({skill:'starci',op});
    const expectedCount=reasoningOps.has(op)?2:3;
    assert.equal(route.candidates.length,expectedCount,op);
    assert.equal(new Set(route.candidates.map(x=>x.target)).size,expectedCount);
    assert.ok(route.candidates.every(candidate=>candidate.orcaLaunch.kind==='managed-agent'||(candidate.orcaLaunch.kind==='command-terminal'&&candidate.orcaLaunch.dispatch==='return-preamble-and-send')),op);
  }
  assert.deepEqual(resolveExecutionChain({op:'interface.draw'}).candidates.map(x=>x.target),['codex-gpt-5.6-sol','claude-opus','qwen-qwen3.8-flash-worker']);
  assert.equal(resolveExecutionChain({op:'interface.draw'}).candidates[0].model,'gpt-5.6-sol');
  assert.deepEqual(resolveExecutionChain({op:'interface.implement'}).candidates.map(x=>x.target),['qwen-qwen3.8-flash-worker','claude-opus','codex-gpt-5.6-sol']);
  assert.deepEqual(resolveExecutionChain({op:'interface.implement'}).candidates[0].orcaLaunch,qwenLaunch);
  assert.equal(registry.orchestration.defaultOperationTarget,'qwen-qwen3.8-flash-worker');
  assert.deepEqual(resolveExecutionChain({op:'backend.implement'}).candidates.map(x=>x.target),['qwen-qwen3.8-flash-worker','claude-opus','codex-gpt-5.6-sol']);
  assert.deepEqual(resolveExecutionChain({op:'backend.implement'}).candidates[0].orcaLaunch,qwenLaunch);
  assert.deepEqual(resolveExecutionChain({op:'review.verify'}).candidates[0].orcaLaunch,qwenLaunch);
  assert.deepEqual(resolveExecutionChain({op:'review.verify'}).candidates.map(x=>x.target),['qwen-qwen3.8-flash-reviewer','claude-fable-5.1','codex-gpt-5.6-sol-reviewer']);
  assert.deepEqual(resolveExecutionChain({op:'knowledge.repair'}).candidates.map(x=>x.target),['claude-opus','codex-gpt-5.6-sol','qwen-qwen3.8-flash-worker']);
  assert.deepEqual(registry.skills.starci.chains.working,['qwen-qwen3.8-flash-worker','claude-opus','codex-gpt-5.6-sol']);
  assert.deepEqual(registry.skills.starci.chains.reasoning,['claude-fable-5.1','codex-gpt-6-astra']);
  assert.equal(registry.supervisors.schema,'starci/supervisor-chains@1');
  for(const role of ['planCoordinator','workflowMonitor']){
    assert.deepEqual(registry.supervisors[role].chain,['claude-opus','codex-gpt-5.6-sol']);
    for(const target of registry.supervisors[role].chain)assert.equal(registry.targets[target].orcaLaunch.kind,'managed-agent');
  }
});
test('Orca selects the first ready candidate and only falls through after verified no-effect failures',()=>{
  const backend=selectExecutionTarget({op:'backend.implement',inventory:['codex','claude','qwen']});
  assert.equal(backend.selected.target,'qwen-qwen3.8-flash-worker');
  assert.deepEqual(backend.selected.orcaLaunch,qwenLaunch);
  let selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen']});
  assert.equal(selected.selected.target,'qwen-qwen3.8-flash-worker');
  assert.deepEqual(selected.selected.orcaLaunch,qwenLaunch);
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude']});
  assert.equal(selected.selected.target,'claude-opus');
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex']});
  assert.equal(selected.selected.target,'codex-gpt-5.6-sol');
  assert.deepEqual(selected.skipped.map(x=>x.target),['qwen-qwen3.8-flash-worker','claude-opus']);
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen-qwen3.8-flash-worker',reason:'rate-limited',effectState:'none'}]});
  assert.equal(selected.selected.target,'claude-opus');
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[
    {target:'qwen-qwen3.8-flash-worker',reason:'rate-limited',effectState:'none'},
    {target:'claude-opus',reason:'startup-failure',effectState:'none'}
  ]});
  assert.equal(selected.selected.target,'codex-gpt-5.6-sol');
  assert.throws(()=>selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen-qwen3.8-flash-worker',reason:'rate-limited',effectState:'unknown'}]}),/Unsafe fallback/);
  assert.throws(()=>selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen-qwen3.8-flash-worker',reason:'permission-denied',effectState:'none'}]}),/reconciliation/);
});
test('Qwen Flash executes then Opus then Sol, Sol draws, Fable then Astra reason, Max and DeepSeek stay out',()=>{
  const backend=resolveExecutionChain({op:'backend.implement'}).candidates;
  const frontend=resolveExecutionChain({op:'interface.implement'}).candidates;
  const uat=resolveExecutionChain({op:'uat.verify'}).candidates;
  const review=resolveExecutionChain({op:'review.verify'}).candidates;
  for(const chain of [backend,frontend,uat]){
    assert.deepEqual(chain.map(candidate=>candidate.target),['qwen-qwen3.8-flash-worker','claude-opus','codex-gpt-5.6-sol']);
    assert.deepEqual(chain[0].orcaLaunch,qwenLaunch);
  }
  assert.equal(review[0].target,'qwen-qwen3.8-flash-reviewer');
  assert.deepEqual(resolveExecutionChain({op:'business.decide'}).candidates.map(candidate=>candidate.target),['claude-fable-5.1','codex-gpt-6-astra']);
  assert.deepEqual(resolveExecutionChain({op:'architecture.decide'}).candidates.map(candidate=>candidate.target),['claude-fable-5.1','codex-gpt-6-astra']);
  const ops=Object.keys(readPublicJson('profiles/registry.json').operators);
  for(const op of ops){
    const chain=resolveExecutionChain({op}).candidates;
    assert.ok(!chain.some(candidate=>['qwen3.8-max','deepseek-v4-pro'].includes(candidate.model)),op);
    assert.ok(chain.every(candidate=>candidate.orcaLaunch.kind==='managed-agent'||candidate.orcaLaunch.dispatch==='return-preamble-and-send'),op);
    assert.ok(chain.filter(candidate=>candidate.orcaLaunch.kind==='command-terminal').every(candidate=>/--exclude-tools agent\b/.test(candidate.orcaLaunch.command)),op);
  }
});
const pending=()=>({reviewedDrawIds:['draw-1'],items:[{id:'hero',drawIds:['draw-1'],usage:'Decorative hero artwork',requiredForFlow:false,status:'deferred',sourcePath:null,artifact:null,provenance:'Claude profile has no image generator; inspected existing repository assets first.',brief:{prompt:'Create the approved abstract hero illustration',width:1200,height:800,format:'webp',placement:'Hero right column',placeholder:'blank-reserved-slot'}}]});
test('deferred artwork needs exact draw coverage, a real brief and no fabricated file or functional acceptance',()=>{
  assert.equal(validateAssets(pending(),{drawIds:['draw-1'],allowDeferred:true,imageGeneration:false}),true);
  assert.throws(()=>validateAssets(pending()));
  const reject=change=>{const m=pending();change(m);assert.throws(()=>validateAssets(m,{drawIds:['draw-1'],allowDeferred:true,imageGeneration:false}));};
  reject(m=>m.items[0].requiredForFlow=true);
  reject(m=>m.items[0].sourcePath='public/missing.webp');
  reject(m=>m.items[0].artifact='fabricated');
  reject(m=>m.items[0].brief=null);
  reject(m=>m.items[0].brief.width=0);
  reject(m=>m.reviewedDrawIds=[]);
  reject(m=>m.items[0].status='done');
});
test('reused/generated assets need source paths and artifact refs; unavailable AI cannot claim generation',()=>{
  const m=pending();Object.assign(m.items[0],{status:'reused',sourcePath:'public/hero.webp',artifact:'hero-image',brief:null});
  assert.equal(validateAssets(m,{imageGeneration:false}),true);
  m.items[0].status='generated';assert.throws(()=>validateAssets(m,{imageGeneration:false}));
  m.items[0].provenance='code-native: authored SVG and rendered screenshot';assert.equal(validateAssets(m,{imageGeneration:false}),true);
  m.items[0].sourcePath='../foreign.svg';assert.throws(()=>validateAssets(m));
});
