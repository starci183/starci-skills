import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml} from '../../engine/yaml.mjs';
import {hostToolsRequired,hostToolsOf,kindRoute,raiseToFloor,loadRuntimes,resolveWorkerLaunchModel} from '../../scripts/agent/models.mjs';
import {fakePoolSelection as selectPool} from '../helpers/fake-admission.mjs';
import {loadPrices,priceOf,costOfRow} from '../../scripts/lib/llm-usage.mjs';

// runtimes.yaml roleOfKind is the allocator's reading of every kind: role, think/hands-on work and the
// least difficulty it routes at. These specs hold the owner's rules on that table: canonical-record and
// verdict ops are think work at a hard floor, source setup is any pool, and a floor only raises.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const read=file=>parseYaml(fs.readFileSync(path.join(ROOT,file),'utf8'));
const runtimes=loadRuntimes(path.join(ROOT,'modules','models'));
const kinds=read('modules/models/kinds.yaml');
const DIFFICULTY=['easy','medium','hard','insane'];
const rank=d=>DIFFICULTY.indexOf(d);

test('the active Sol catalog and token meter use GPT-6.1 Sol and its dated official cached-input rate',()=>{
  const registry=read('modules/models/registry.yaml');
  const prices=loadPrices(path.join(ROOT,'modules/models/registry.yaml'));
  assert.equal(registry.targets['gpt-6.1-sol'].defaultModel,'gpt-6.1-sol');
  assert.equal(registry.models['gpt-6.1-sol'].provider,'codex');
  assert.equal(prices.asOf,'2026-10-03');
  assert.match(prices.source,/https:\/\/developers\.openai\.com\/api\/docs\/models\/gpt-6\.1-sol/);
  assert.equal(priceOf('gpt-6.1-sol',prices).cacheRead,0.1);
  assert.equal(costOfRow({model:'gpt-6.1-sol',inputTokens:1_000_000,outputTokens:1_000_000,cacheReadTokens:1_000_000},prices),12.1);
});

test('every op manifest and every kinds.yaml kind carries a complete roleOfKind entry that agrees on role',()=>{
  const ops=fs.readdirSync(path.join(ROOT,'modules','ops','ops')).filter(f=>f.endsWith('.yaml')).map(f=>f.slice(0,-5));
  assert.equal(ops.length,38);
  for(const kind of [...ops,...Object.keys(kinds.kinds)]){
    const entry=runtimes.roleOfKind[kind];
    assert.ok(entry&&typeof entry==='object',`${kind} has no {role, work, floor} entry`);
    assert.ok(kinds.vocabularies.roles.includes(entry.role),`${kind} role ${entry.role}`);
    assert.ok(['think','hands-on'].includes(entry.work),`${kind} work ${entry.work}`);
    assert.ok(DIFFICULTY.includes(entry.floor),`${kind} floor ${entry.floor}`);
    if(kinds.kinds[kind])assert.equal(entry.role,kinds.kinds[kind].role,`${kind}: roleOfKind must agree with kinds.yaml`);
  }
});

test('canonical-record and quality-verdict ops are think work with a hard floor; source setup is any pool',()=>{
  for(const kind of ['workspace.manage','business.decide','architecture.decide','scope.define','goal.revise','decision.prepare',
    'brand.decide','interface.draw','interface.audit','review.verify','security.verify','work.author'])
    assert.deepEqual([kindRoute(kind,runtimes).work,kindRoute(kind,runtimes).floor],['think','hard'],kind);
  for(const kind of ['backend.scaffold','interface.scaffold','package.scaffold'])
    assert.deepEqual([kindRoute(kind,runtimes).work,kindRoute(kind,runtimes).floor],['hands-on','easy'],kind);
  for(const kind of ['backend.implement','interface.implement','code.refactor','test.author'])
    assert.equal(kindRoute(kind,runtimes).work,'hands-on',kind);
  for(const [kind,entry] of Object.entries(runtimes.roleOfKind)){
    if(entry.work==='think')assert.ok(rank(entry.floor)>=rank('hard'),`${kind} is think work below the hard floor`);
    if(['decide','plan'].includes(entry.role))assert.equal(entry.work,'think',`${kind}: decide/plan are think roles`);
  }
});

test('a floor raises a measured difficulty and never lowers it',()=>{
  assert.equal(raiseToFloor('easy','medium'),'medium');
  assert.equal(raiseToFloor('insane','medium'),'insane');
  assert.equal(raiseToFloor('easy','hard'),'hard');
  assert.equal(raiseToFloor('M','hard'),null,'an alias spelling is an unknown difficulty');
  assert.equal(raiseToFloor('hard',null),'hard');
  const decide=selectPool({kind:'business.decide',difficulty:'medium',runtimes});
  assert.deepEqual([decide.measuredDifficulty,decide.floor,decide.difficulty],['medium','hard','hard']);
  const implement=selectPool({kind:'backend.implement',difficulty:'easy',runtimes});
  assert.deepEqual([implement.measuredDifficulty,implement.difficulty],['easy','medium']);
  assert.equal(selectPool({kind:'backend.implement',difficulty:'insane',runtimes}).difficulty,'insane');
  assert.equal(kindRoute('x.kind',{roleOfKind:{'x.kind':{role:'implement',work:'hands-on',floor:'easy'}}}).role,'implement','a roleOfKind entry resolves its role');
  assert.equal(kindRoute('x.kind',{roleOfKind:{'x.kind':'implement'}}).role,null,'an entry that is not an object names no role');
});

// Owner rule: thinking work goes to Claude Opus 5.5, or GPT-6.1 Sol when Claude is unavailable, at every
// difficulty the work may be measured at — never to Luna or Devin.
// Owner decision 2026-09-25 review-hands: Opus and Sol keep strategy only; the think verdicts (review, handover,
// goal audit) and work.author walk the review order - Devin, Opus and Sol as overflow - which
// tests/agent/allocation-balance.spec.mjs holds. Owner routing 2026-09-26: the kernel's own model calls walk sol-think
// (Sol first, Opus overflow); interface.audit, security.verify and uat.assisted.verify walk ui (Sol first);
// the mechanical ops provision.ask, workspace.manage, task.execute and knowledge.repair walk implement.
const FRONTIER=new Set(['claude-opus-5-5','gpt-6.1-sol']);
const thinkKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='think'&&!e.order).map(([kind])=>kind);
const kernelKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.order==='sol-think').map(([kind])=>kind);
const claudeDown={'claude-agent':{auth:'dead'}};
const codexDown={'codex-agent':{auth:'dead'}};

test('strategy think kinds resolve to a frontier model at every difficulty, Claude first and Sol when Claude is down',()=>{
  assert.ok(thinkKinds.length>=8);
  for(const kind of thinkKinds)for(const difficulty of DIFFICULTY){
    const up=selectPool({kind,difficulty,runtimes});
    assert.ok(FRONTIER.has(up.modelId),`${kind}@${difficulty} -> ${up.target}/${up.modelId}`);
    const needsTool=hostToolsRequired(kind).length>0;
    assert.equal(up.target,needsTool?'codex-agent':'claude-agent',`${kind}@${difficulty} leads with Claude unless a host tool forbids it`);
    const down=selectPool({kind,difficulty,runtimes,capacity:claudeDown});
    assert.deepEqual([down.target,down.modelId],['codex-agent','gpt-6.1-sol'],`${kind}@${difficulty} with Claude down`);
    const both=selectPool({kind,difficulty,runtimes,capacity:{...claudeDown,'codex-agent':{auth:'dead'}}});
    assert.ok(both.error&&!both.target,`${kind}@${difficulty} with Opus and Sol down refuses - never Devin`);
  }
});

test('the kernel model calls walk sol-think: Sol first at every difficulty, Opus when Sol is down',()=>{
  assert.ok(kernelKinds.length>=7,'the sol-think order carries the kernel model functions and judge');
  for(const kind of kernelKinds)for(const difficulty of DIFFICULTY){
    const up=selectPool({kind,difficulty,runtimes});
    assert.deepEqual([up.order,up.target,up.modelId],['sol-think','codex-agent','gpt-6.1-sol'],`${kind}@${difficulty} leads with Sol`);
    const down=selectPool({kind,difficulty,runtimes,capacity:codexDown});
    assert.deepEqual([down.target,down.modelId],['claude-agent','claude-opus-5-5'],`${kind}@${difficulty} with Sol down`);
    const both=selectPool({kind,difficulty,runtimes,capacity:{...claudeDown,...codexDown}});
    assert.ok(both.error&&!both.target,`${kind}@${difficulty} with Sol and Opus down refuses - never Devin`);
  }
});

test('a think role with no kind never lands on Luna or Devin below the hard tier',()=>{
  for(const role of ['decide','plan'])for(const difficulty of ['easy','medium']){
    assert.equal(selectPool({kind:'direct.call',role,difficulty,runtimes}).modelId,'claude-opus-5-5');
    const down=selectPool({kind:'direct.call',role,difficulty,runtimes,capacity:claudeDown});
    assert.ok(down.error&&!down.modelId,`${role}@${difficulty} with Claude down must refuse, not take Luna or a hands-on pool`);
  }
  for(const role of ['decide','plan']){
    const hard=selectPool({kind:'direct.call',role,difficulty:'hard',runtimes,capacity:claudeDown});
    assert.deepEqual([hard.target,hard.modelId],['codex-agent','gpt-6.1-sol']);
  }
});

test('declared operator chains: Opus then Sol for strategy, Sol then Opus for the kernel calls, the kind orders otherwise',()=>{
  const registry=read('modules/models/registry.yaml');
  const think=runtimes.allocation.preference.think;
  assert.deepEqual(think,['claude-agent','codex-agent']);
  assert.deepEqual(runtimes.allocation.preference['sol-think'],['codex-agent','claude-agent'],'the kernel calls walk sol-think, Sol first');
  assert.deepEqual(runtimes.allocation.frontier,['claude-agent','codex-agent'],'the frontier group stays Opus + Sol');
  for(const [key,order] of Object.entries(runtimes.allocation.preference))
    if(['think','decide','plan'].includes(key))assert.deepEqual(order,['claude-agent','codex-agent'],`preference.${key}`);
  for(const [tier,orders] of Object.entries(runtimes.allocation.tiers)){
    for(const key of ['think','decide','plan'])
      assert.ok(orders[key].every(pool=>['claude-agent','codex-agent'].includes(pool))&&orders[key][0]==='claude-agent',`tiers.${tier}.${key} ${orders[key]}`);
    assert.deepEqual(orders['sol-think'],['codex-agent','claude-agent'],`tiers.${tier}.sol-think`);
  }
  for(const kind of thinkKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain)continue;
    assert.deepEqual(chain,['claude-agent','codex-agent'],`${kind} chain ${chain}`);
  }
  // The kernel calls carry no operator entries; draw is Devin then Codex, asset Codex alone; the new orders carry theirs.
  for(const kind of kernelKinds)assert.equal(registry.operators[kind],undefined,`${kind} is a kernel call, not an operation`);
  assert.deepEqual(registry.operators['interface.draw']?.chain,['devin-agent','codex-agent'],'interface.draw');
  assert.deepEqual(registry.operators['interface.asset']?.chain,['codex-agent'],'interface.asset');
  for(const kind of ['interface.audit','e2e.verify','security.verify','uat.assisted.verify'])
    assert.deepEqual(registry.operators[kind]?.chain,['codex-agent','devin-agent'],`${kind} walks ui`);
  for(const kind of ['provision.ask','workspace.manage','task.execute','knowledge.repair'])
    assert.deepEqual(registry.operators[kind]?.chain,['devin-agent','codex-agent','claude-agent'],`${kind} walks implement`);
});

// Owner decision 2026-09-25 (72h scorecard): hands-on implementation and scaffold, docs, content and grammar work go to
// Devin (SWE-2-max) first at medium and hard, then Codex, then Opus overflow; Devin pins no easy model, so easy
// starts at Codex; insane leads with the frontier.
// The hands-on verify kinds walk the review order (owner decision 2026-09-25 review-hands) and e2e.verify the
// ui order (owner routing 2026-09-26) — both held by tests/agent/allocation-balance.spec.mjs.
const handsOnKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='hands-on'&&!['review','ui'].includes(e.order)).map(([kind])=>kind);
const SCAFFOLD_KINDS=['backend.scaffold','interface.scaffold','package.scaffold','docs.author','content.generate','grammar.update'];

test('hands-on orders: Devin first for implementation and scaffold work, Codex and Claude after',()=>{
  const {tiers,preference}=runtimes.allocation;
  for(const role of ['implement','write','verify']){
    assert.deepEqual(preference[role],['devin-agent','codex-agent','claude-agent'],role);
    assert.deepEqual(tiers.easy[role],['codex-agent','claude-agent'],`easy ${role}`);
    assert.deepEqual(tiers.medium[role],['devin-agent','codex-agent','claude-agent'],`medium ${role}`);
    assert.deepEqual(tiers.hard[role],['devin-agent','codex-agent','claude-agent'],`hard ${role}`);
    assert.deepEqual(tiers.insane[role],['claude-agent','codex-agent'],`insane ${role}`);
  }
  assert.deepEqual(preference.scaffold,['devin-agent','codex-agent','claude-agent']);
  for(const [tier,lead] of [['easy','codex-agent'],['medium','devin-agent'],['hard','devin-agent'],['insane','claude-agent']])assert.equal(tiers[tier].scaffold[0],lead,`${tier} scaffold`);
  assert.deepEqual(preference.draw,['devin-agent','codex-agent']);
  assert.deepEqual(preference.asset,['codex-agent']);
  for(const tier of ['easy','medium','hard'])
    assert.deepEqual(runtimes.allocation.balanced.overflowOnly['hands-on'][tier],['claude-agent'],`Opus is ${tier} hands-on overflow under balanced`);
  assert.equal(runtimes.allocation.balanced.overflowOnly['hands-on'].insane,undefined,'insane balances Opus and Sol');
  for(const kind of SCAFFOLD_KINDS)assert.equal(kindRoute(kind,runtimes).order,'scaffold',kind);
  const registry=read('modules/models/registry.yaml');
  for(const kind of handsOnKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain||hostToolsRequired(kind).length)continue;
    assert.deepEqual(chain.slice(0,2),['devin-agent','codex-agent'],`${kind} chain ${chain}`);
    assert.deepEqual(chain.slice(-2),['codex-agent','claude-agent'],`${kind} overflows to Codex then Claude`);
  }
});

test('hands-on kinds land on Devin or Codex below insane when those pools have room',()=>{
  for(const kind of handsOnKinds){
    if(hostToolsRequired(kind).length)continue;
    for(const difficulty of ['easy','medium','hard']){
      const r=selectPool({kind,difficulty,runtimes});
      assert.ok(['codex-agent','devin-agent'].includes(r.target),`${kind}@${difficulty} -> ${r.target}`);
      if(r.difficulty!=='easy')assert.equal(r.target,'devin-agent',`${kind}@${difficulty}`);
    }
    const busy=selectPool({kind,difficulty:'medium',runtimes,capacity:{'devin-agent':{running:10}}});
    assert.equal(busy.target,'codex-agent',`${kind} overflows to Codex when Devin is full`);
  }
});

test('a prefer bias cannot hoist a pool outside the think order into strategy work',()=>{
  for(const kind of ['business.decide','implementation.plan','scope.define'])
    for(const prefer of [['devin-agent']]){
      const r=selectPool({kind,difficulty:'medium',runtimes,bias:{prefer}});
      assert.deepEqual([r.chain,r.target],[['claude-agent','codex-agent'],'claude-agent'],`${kind} ${prefer}`);
    }
  // A verdict walks the review order instead: the hands lead it and a prefer cannot hoist the overflow.
  const review=selectPool({kind:'review.verify',difficulty:'medium',runtimes,bias:{prefer:['claude-agent']}});
  assert.deepEqual([review.order,review.target],['review','devin-agent']);
  assert.deepEqual(runtimes.runtimes['devin-agent'].roles,['implement','verify','write'],'Devin carries no decide or plan role (registry.yaml pools)');
});

test('host tool declarations follow overwrite, deletion and recreation at the same canonical path',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'model-hotload-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const opsDir=path.join(root,'ops'),modelsDir=path.join(root,'models');fs.mkdirSync(opsDir);fs.mkdirSync(path.join(modelsDir,'agents'),{recursive:true});
  const op=path.join(opsDir,'docs.author.yaml'),agent=path.join(modelsDir,'agents','codex.yaml');
  const write=tool=>{fs.writeFileSync(op,'route: {riskHints: [host-tool-required:'+tool+']}\n');fs.writeFileSync(agent,'capabilities: {hostTools: ['+tool+']}\n');};
  write('first');assert.deepEqual(hostToolsRequired('docs.author',{opsDir}),['first']);assert.deepEqual(hostToolsOf('codex',{modelsDir}),['first']);
  write('second');assert.deepEqual(hostToolsRequired('docs.author',{opsDir}),['second']);assert.deepEqual(hostToolsOf('codex',{modelsDir}),['second']);
  fs.unlinkSync(op);fs.unlinkSync(agent);assert.deepEqual(hostToolsRequired('docs.author',{opsDir}),[]);assert.deepEqual(hostToolsOf('codex',{modelsDir}),[]);
  write('third');assert.deepEqual(hostToolsRequired('docs.author',{opsDir}),['third']);assert.deepEqual(hostToolsOf('codex',{modelsDir}),['third']);
});

test('default pricing rereads the current registry in the same process',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'price-hotload-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const relative of ['scripts/lib/llm-usage.mjs','scripts/lib/read-yaml.mjs','scripts/lib/read-text.mjs','scripts/lib/number.mjs','engine/yaml.mjs']){
    const destination=path.join(root,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(ROOT,relative),destination);
  }
  const file=path.join(root,'modules/models/registry.yaml');fs.mkdirSync(path.dirname(file),{recursive:true});
  const write=rate=>fs.writeFileSync(file,'models: {fixture: {price: {input: '+rate+', output: 2}}}\n');
  write(1);const owner=await import(pathToFileURL(path.join(root,'scripts/lib/llm-usage.mjs')).href);
  assert.equal(owner.loadPrices().models.fixture.input,1);
  write(3);assert.equal(owner.loadPrices().models.fixture.input,3);
  fs.unlinkSync(file);assert.deepEqual(owner.loadPrices().models,{});
  write(4);assert.equal(owner.loadPrices().models.fixture.input,4);
});


test('the current registry schema accepts native targets and rejects undeclared launch fields',()=>{
  const registry=read('modules/models/registry.yaml');
  const validate=new Ajv2020({strict:true,allErrors:true}).compile(read('modules/schemas/profile-registry.schema.yaml'));
  assert.equal(validate(registry),true,JSON.stringify(validate.errors));
  const unknown=structuredClone(registry);
  unknown.targets['gpt-6.1-sol'].profiles={working:'gpt-6.1-sol'};
  assert.equal(validate(unknown),false,'a launch target has no alternate profile-to-model routing contract');
  assert.ok(validate.errors.some(error=>error.keyword==='additionalProperties'&&error.params.additionalProperty==='profiles'));
  const invalid=structuredClone(registry);
  invalid.targets['gpt-6.1-sol'].defaultModel=null;
  assert.equal(validate(invalid),false,'a declared launch-only model must remain a nonempty string');
});

test('native worker model resolution uses difficulty pins or an explicit target and refuses unknown targets',()=>{
  const modelsDir=path.join(ROOT,'modules','models');
  const resolve=(target,difficulty)=>resolveWorkerLaunchModel({target,payload:{difficulty},runtimes,modelsDir});
  for(const [target,model] of [['gpt-6.1-sol','gpt-6.1-sol'],['gpt-6-luna','gpt-6-luna'],['cursor-agent','auto']]){
    assert.deepEqual(resolve(target,'hard'),{modelId:model,effort:null,source:'registry'},target);
  }
  for(const [difficulty,model] of [['easy','gpt-6-luna'],['hard','gpt-6.1-sol']]){
    const result=resolve('codex-agent',difficulty);
    assert.equal(result.modelId,model);assert.equal(result.source,'runtimes');
    assert.equal(result.effort,runtimes.runtimes['codex-agent'].effort[difficulty]);
  }
  for(const target of ['claude-agent','devin-agent']){
    const result=resolve(target,'hard');
    assert.equal(result.modelId,runtimes.runtimes[target].models.hard);assert.equal(result.source,'runtimes');
  }
  for(const target of ['codex-gpt-6.1-sol','devin-devin-worker','unknown-target']){
    const result=resolve(target,'hard');
    assert.ok(result.error,`${target} must refuse instead of changing its identity`);
    assert.equal(result.modelId,undefined);
  }
});
