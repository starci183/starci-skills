import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveExecutionChain,selectExecutionTarget} from '../kernel/chains.mjs';
import {resolveModel as selectProfile} from '../modules/models/index.mjs';
import {readPublicJson,readModel} from './helpers/read-public.mjs';
import {validateAssets} from '../contracts/assets.mjs';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';

const qwenLaunch={kind:'command-terminal',command:'qwen --model qwen3.8-flash --approval-mode yolo --exclude-tools agent --max-session-turns 240 --max-wall-time 90m --max-tool-calls 600 --chat-recording false',dispatch:'return-preamble-and-send',adapter:'qwen',nestedAgents:'forbidden'};

test('active roles select Codex, Claude, Qwen or explicitly admitted Devin without reviving retired profiles or granting tools',()=>{
  const codex=selectProfile({runtime:'codex',op:'interface.implement',imageGenerationAvailable:true});
  assert.equal(codex.profile,'gpt-5.6-sol');assert.equal(codex.model,'gpt-5.6-sol');assert.equal(codex.imageGeneration,true);
  assert.equal(selectProfile({runtime:'openai',op:'business.decide'}).profile,'gpt-6-astra');
  assert.equal(selectProfile({runtime:'codex',op:'interface.implement'}).imageGeneration,false);
  const claude=selectProfile({runtime:'claude',op:'interface.implement',imageGenerationAvailable:true});
  assert.equal(claude.profile,'opus');assert.equal(claude.model,'claude-opus-5');assert.equal(claude.imageGeneration,false);assert.equal(claude.allowDeferredArtwork,true);
  const luna=selectProfile({runtime:'codex',op:'interface.implement',profile:'gpt-5.6-luna'});
  assert.equal(luna.model,'gpt-5.6-luna');assert.equal(luna.imageGeneration,false);
  assert.equal(selectProfile({runtime:'claude',op:'architecture.decide'}).profile,'fable-5.1');
  const qwen=selectProfile({runtime:'qwencloud',op:'interface.implement'});
  assert.equal(qwen.profile,'qwen3.8-flash-worker');assert.equal(qwen.model,'qwen3.8-flash');assert.equal(qwen.provider,'qwencloud-token-plan');
  const devin=selectProfile({runtime:'cognition',op:'interface.implement'});
  assert.equal(devin.profile,'devin-worker');assert.equal(devin.model,'swe-2-max');assert.equal(devin.provider,'cognition-devin');
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
  const registry=readModel('registry'),ops=parseYaml(fs.readFileSync(new URL('../modules/ops/registry.yaml',import.meta.url),'utf8')).ops.map(x=>x.id);
  assert.equal(registry.schema,'starci/profile-registry@3');
  assert.deepEqual(registry.agentArchitecture.levels,['user-coordinator','workflow-kernel','operation-agent']);
  assert.equal(registry.agentArchitecture.isolationBoundary,'operation');
  assert.equal(registry.agentArchitecture.operationMapping,'one-operation-instance-one-agent');
  assert.equal(registry.executionModes.solo.controlPlane,'current-chat-session');
  assert.equal(registry.executionModes.solo.operationAgent,'isolated-background-agent');
  assert.equal(registry.executionModes.solo.maxConcurrentOperationAgents,3);
  assert.equal(registry.executionModes.solo.fanOutWithinOperation,'forbidden');
  assert.equal(registry.executionModes.orchestrated.bootstrapRole,'retain-user-designated-coordinator');
  assert.equal(registry.executionModes.orchestrated.coordinatorAgent,'current-user-designated-session');
  assert.equal(registry.executionModes.orchestrated.workflowWrapperAgent,'deterministic-workflow-kernel');
  assert.equal(registry.executionModes.orchestrated.operationAgent,'supervised-native-agent-in-workflow-worktree');
  assert.equal(registry.executionModes.orchestrated.worktree,'isolated-child-per-workflow-attempt');
  assert.equal(registry.executionModes.orchestrated.maxConcurrentOperationAgents,3);
  assert.deepEqual(Object.keys(registry.operators).sort(),[...ops].sort());
  // An operator declares every runtime that carries its role, so runtime allocation always resolves a
  // launch shape: the decide and plan ops carry their whole downgrade - the Claude pool under Fable and the
  // Codex pool's reasoning model - and review.verify spans all five pools.
  // interface.draw invokes built-in ImageGen, so it has one Codex route. The route is not a claim about the hidden tool model.
  // brand.decide also generates a placeholder mascot, so it runs on the working chain (Codex, then Claude); interface.asset
  // re-renders the artwork the candidates embed, so it needs the same image model and the same one link as interface.draw.
  // grammar.update writes code, stories, tests and a published version, so it drops the image model entirely and
  // carries the runtimes that read a whole repository's conventions before changing one.
  // integration.verify runs code against a real provider exactly as e2e.verify runs it against a real stack,
  // so it carries the same verify-role runtimes.
  const expectedCounts={'business.decide':3,'architecture.decide':3,'decision.prepare':3,'provision.ask':3,'brand.decide':2,'review.verify':5,'interface.draw':1,'interface.asset':1,'grammar.update':3,'work.author':3,'integration.verify':4,
    'backend.implement':4,'code.refactor':4,'content.generate':4,'docs.author':4,'e2e.verify':4,'interface.implement':4,'knowledge.repair':4,'perf.verify':4,'release.deliver':4,'runtime.operate':4,'scope.retire':4,'security.verify':4,'task.execute':4,'test.author':4,'uat.verify':4,'workspace.manage':4,
    'request.analyze':3,'scope.define':3,'goal.revise':3};
  for(const op of ops){
    const route=resolveExecutionChain({skill:'starci',op});
    const expectedCount=expectedCounts[op]??3;
    assert.equal(route.candidates.length,expectedCount,op);
    assert.equal(new Set(route.candidates.map(x=>x.target)).size,expectedCount);
    assert.ok(route.candidates.every(candidate=>candidate.orcaLaunch.kind==='managed-agent'||(candidate.orcaLaunch.kind==='command-terminal'&&candidate.orcaLaunch.dispatch==='return-preamble-and-send')),op);
  }
  assert.deepEqual(resolveExecutionChain({op:'interface.draw'}).candidates.map(x=>x.target),['codex-agent']);
  assert.equal(resolveExecutionChain({op:'interface.draw'}).candidates[0].model,'gpt-5.6-luna');
  // Generating the declared artwork is the same image-model requirement, so it cannot fall through to a runtime
  // that would defer the slot: a deferred slot is exactly what this operation exists to close.
  assert.deepEqual(resolveExecutionChain({op:'interface.asset'}).candidates.map(x=>x.target),['codex-agent']);
  assert.equal(resolveExecutionChain({op:'interface.asset'}).candidates[0].model,'gpt-5.6-luna');
  assert.equal(resolveExecutionChain({op:'interface.asset'}).role,'working');
  assert.equal(selectExecutionTarget({op:'interface.asset',inventory:['codex','claude','qwen']}).selected.target,'codex-agent');
  // Growing the grammar is a code-and-publish job: the strongest coding runtimes, and never the image model.
  assert.deepEqual(resolveExecutionChain({op:'grammar.update'}).candidates.map(x=>x.target),['claude-agent','codex-agent','devin-agent']);
  assert.equal(resolveExecutionChain({op:'grammar.update'}).role,'working');
  assert.deepEqual(resolveExecutionChain({op:'grammar.update'}).candidates.map(x=>x.profile),['opus','gpt-5.6-luna','devin-worker']);
  assert.deepEqual(resolveExecutionChain({op:'interface.implement'}).candidates.map(x=>x.target),['qwen-agent','devin-agent','claude-agent','codex-agent']);
  assert.deepEqual(resolveExecutionChain({op:'interface.implement'}).candidates[0].orcaLaunch,qwenLaunch);
  assert.equal(registry.orchestration.defaultOperationTarget,'qwen-agent');
  assert.deepEqual(resolveExecutionChain({op:'backend.implement'}).candidates.map(x=>x.target),['qwen-agent','devin-agent','claude-agent','codex-agent']);
  assert.deepEqual(resolveExecutionChain({op:'backend.implement'}).candidates[0].orcaLaunch,qwenLaunch);
  assert.deepEqual(resolveExecutionChain({op:'review.verify'}).candidates[0].orcaLaunch,{...qwenLaunch,command:qwenLaunch.command.replace('--approval-mode yolo','--approval-mode yolo')});
  assert.equal(resolveExecutionChain({op:'review.verify'}).candidates[0].profile,'qwen3.8-flash-reviewer');
  assert.equal(resolveExecutionChain({op:'backend.implement'}).candidates[0].profile,'qwen3.8-flash-worker');
  assert.equal(resolveExecutionChain({op:'review.verify'}).candidates[2].profile,'fable-5.1');
  assert.equal(registry.targetAliases['qwen-qwen3.8-flash-worker'],'qwen-agent');
  assert.equal(registry.targetAliases['codex-gpt-5.6-luna-reviewer'],'codex-agent');
  // Retired per-model pool ids resolve to the provider-window pool that carries them now.
  assert.equal(registry.targetAliases['gpt-5.6-luna'],'codex-agent');
  assert.equal(registry.targetAliases['gpt-5.6-sol'],'codex-agent');
  assert.equal(registry.targetAliases['gpt-6-astra'],'codex-agent');
  assert.equal(registry.targetAliases['claude-opus'],'claude-agent');
  assert.equal(registry.targetAliases['claude-fable-5.1'],'claude-fable');
  assert.equal(registry.targetAliases['qwen3.8-flash'],'qwen-agent');
  assert.deepEqual(resolveExecutionChain({op:'review.verify'}).candidates.map(x=>x.target),['qwen-agent','devin-agent','claude-fable','codex-agent','claude-agent']);
  assert.equal(resolveExecutionChain({op:'review.verify'}).candidates[3].profile,'gpt-6-astra');
  assert.equal(resolveExecutionChain({op:'review.verify'}).candidates[4].profile,'opus-reviewer');
  assert.deepEqual(resolveExecutionChain({op:'knowledge.repair'}).candidates.map(x=>x.target),['claude-agent','codex-agent','qwen-agent','devin-agent']);
  // API end-to-end proof runs code, so its chain is the verify-role runtimes that can: the Codex pool first, then Claude, Qwen and Devin.
  assert.deepEqual(resolveExecutionChain({op:'e2e.verify'}).candidates.map(x=>x.target),['codex-agent','claude-agent','qwen-agent','devin-agent']);
  // It runs code rather than reasoning about it, so the working profile applies, not the reviewer one.
  assert.equal(resolveExecutionChain({op:'e2e.verify'}).candidates[0].profile,'gpt-5.6-luna');
  // A live call to a declared provider is the same work against a different surface, so it is the same chain.
  assert.deepEqual(resolveExecutionChain({op:'integration.verify'}).candidates.map(x=>x.target),['codex-agent','claude-agent','qwen-agent','devin-agent']);
  assert.equal(resolveExecutionChain({op:'integration.verify'}).candidates[0].profile,'gpt-5.6-luna');
  // Completing a Work record is reading work, so it runs on the plan-role runtimes with the reasoning profiles.
  // Authoring records leads with the strongest reasoning runtimes and never the cheap pool, and carries the
  // downgrade under them so a spent week hands the authoring on instead of holding it.
  assert.deepEqual(resolveExecutionChain({op:'work.author'}).candidates.map(x=>x.target),['claude-fable','codex-agent','claude-agent']);
  assert.match(resolveExecutionChain({op:'work.author'}).candidates[1].profile,/astra/);
  assert.equal(resolveExecutionChain({op:'work.author'}).role,'reasoning');
  // Settling an identity is reasoning, so the chain carries the reasoning profiles; the Codex target leads it
  // because only that runtime carries an image generator for the placeholder mascot, and the decide-role
  // runtimes follow as the candidates the allocator actually prefers.
  assert.deepEqual(resolveExecutionChain({op:'brand.decide'}).candidates.map(x=>x.target),['codex-agent','claude-agent']);
  assert.equal(resolveExecutionChain({op:'brand.decide'}).role,'working','it generates the placeholder mascot, so it runs on the working profiles where image generation is');
  assert.deepEqual(resolveExecutionChain({op:'brand.decide'}).candidates.map(x=>x.profile),['gpt-5.6-luna','opus']);
  assert.deepEqual(registry.skills.starci.chains.working,['qwen-agent','devin-agent','claude-agent','codex-agent']);
  assert.deepEqual(registry.skills.starci.chains.reasoning,['claude-fable','codex-agent']);
  assert.equal(registry.supervisors.schema,'starci/supervisor-chains@1');
  for(const role of ['planCoordinator','workflowMonitor']){
    assert.deepEqual(registry.supervisors[role].chain,['claude-agent','codex-agent']);
    for(const target of registry.supervisors[role].chain)assert.equal(registry.targets[target].orcaLaunch.kind,'managed-agent');
  }
});
test('Orca selects the first ready candidate and only falls through after verified no-effect failures',()=>{
  const backend=selectExecutionTarget({op:'backend.implement',inventory:['codex','claude','qwen']});
  assert.equal(backend.selected.target,'qwen-agent');
  assert.deepEqual(backend.selected.orcaLaunch,qwenLaunch);
  let selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen']});
  assert.equal(selected.selected.target,'qwen-agent');
  assert.deepEqual(selected.selected.orcaLaunch,qwenLaunch);
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude']});
  assert.equal(selected.selected.target,'claude-agent');
  selected=selectExecutionTarget({op:'interface.implement',inventory:['devin','claude']});
  assert.equal(selected.selected.target,'claude-agent','direct chain selection cannot bypass Devin workflow capacity');
  assert.ok(selected.skipped.some(item=>item.target==='devin-agent'&&item.reason==='unavailable'));
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex']});
  assert.equal(selected.selected.target,'codex-agent');
  assert.deepEqual(selected.skipped.map(x=>x.target),['qwen-agent','devin-agent','claude-agent']);
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen3.8-flash',reason:'rate-limited',effectState:'none'}]});
  assert.equal(selected.selected.target,'claude-agent');
  assert.equal(selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen-qwen3.8-flash-worker',reason:'rate-limited',effectState:'none'}]}).selected.target,'claude-agent');
  selected=selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[
    {target:'qwen3.8-flash',reason:'rate-limited',effectState:'none'},
    {target:'claude-opus',reason:'startup-failure',effectState:'none'}
  ]});
  assert.equal(selected.selected.target,'codex-agent');
  assert.throws(()=>selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen3.8-flash',reason:'rate-limited',effectState:'unknown'}]}),/Unsafe fallback/);
  assert.throws(()=>selectExecutionTarget({op:'interface.implement',inventory:['codex','claude','qwen'],attempts:[{target:'qwen3.8-flash',reason:'permission-denied',effectState:'none'}]}),/reconciliation/);
});
test('general execution runs the Qwen/Devin/Claude/Codex pool order; the Codex pool draws, Fable and the Codex reasoning model decide, Max and DeepSeek stay out',()=>{
  const backend=resolveExecutionChain({op:'backend.implement'}).candidates;
  const frontend=resolveExecutionChain({op:'interface.implement'}).candidates;
  const uat=resolveExecutionChain({op:'uat.verify'}).candidates;
  const review=resolveExecutionChain({op:'review.verify'}).candidates;
  for(const chain of [backend,frontend,uat]){
    assert.deepEqual(chain.map(candidate=>candidate.target),['qwen-agent','devin-agent','claude-agent','codex-agent']);
    assert.deepEqual(chain[0].orcaLaunch,qwenLaunch);
  }
  assert.equal(review[0].target,'qwen-agent');
  // Fable first, then the Codex pool's reasoning model, then the downgrade each of them has: the Claude pool.
  assert.deepEqual(resolveExecutionChain({op:'business.decide'}).candidates.map(candidate=>candidate.target),['claude-fable','codex-agent','claude-agent']);
  assert.deepEqual(resolveExecutionChain({op:'architecture.decide'}).candidates.map(candidate=>candidate.target),['claude-fable','codex-agent','claude-agent']);
  const ops=Object.keys(readModel('registry').operators);
  for(const op of ops){
    const chain=resolveExecutionChain({op}).candidates;
    assert.ok(!chain.some(candidate=>['qwen3.8-max','deepseek-v4-pro'].includes(candidate.model)),op);
    assert.ok(chain.every(candidate=>candidate.orcaLaunch.kind==='managed-agent'||candidate.orcaLaunch.dispatch==='return-preamble-and-send'),op);
    assert.ok(chain.filter(candidate=>candidate.orcaLaunch.kind==='command-terminal').every(candidate=>candidate.orcaLaunch.nestedAgents==='forbidden'&&typeof candidate.orcaLaunch.adapter==='string'),op);
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
