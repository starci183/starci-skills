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

/// Owner rule (modules/models/tiers.yaml): an op takes the tier of its difficulty - insane frontier (Opus 5.5 then Sol), hard
// high (Sonnet 5.5 then Sol), medium Devin then Sol, easy Devin then Luna - and a floor only raises the difficulty. Thinking
// work (a floor of hard) therefore never lands on Luna or Devin. tests/agent/tier-ops.spec.mjs holds the chains and the balance.
const TIERS=read('modules/models/tiers.yaml');
const thinkKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='think').map(([kind])=>kind);
const claudeDown={'claude-agent':{auth:'dead'}};
const codexDown={'codex-agent':{auth:'dead'}};

test('thinking kinds resolve to Claude then Sol at hard and insane, Sol when Claude is down, and refuse when both are down',()=>{
  assert.ok(thinkKinds.length>=8);
  const lead={easy:['high','claude-sonnet-5-5'],medium:['high','claude-sonnet-5-5'],hard:['high','claude-sonnet-5-5'],insane:['frontier','claude-opus-5-5']};
  for(const kind of thinkKinds)for(const difficulty of DIFFICULTY){
    const up=selectPool({kind,difficulty,runtimes,capacity:{}});
    if(kind in TIERS.kindTiers){assert.equal(up.tier,TIERS.kindTiers[kind],`${kind} takes its own tier`);continue;}
    const [tier,model]=lead[difficulty];
    const needsTool=hostToolsRequired(kind).some(tool=>!hostToolsOf('claude').includes(tool));
    assert.equal(up.tier,tier,`${kind}@${difficulty}`);
    assert.deepEqual([up.target,up.modelId],needsTool?['codex-agent','gpt-6.1-sol']:['claude-agent',model],`${kind}@${difficulty} leads with Claude unless a host tool forbids it`);
    const down=selectPool({kind,difficulty,runtimes,capacity:claudeDown});
    assert.deepEqual([down.target,down.modelId],['codex-agent','gpt-6.1-sol'],`${kind}@${difficulty} with Claude down`);
    const both=selectPool({kind,difficulty,runtimes,capacity:{...claudeDown,...codexDown}});
    assert.ok(both.error&&!both.target,`${kind}@${difficulty} with Claude and Sol down refuses - never Devin`);
  }
});

test('the kernel model calls take the tier of their seat: planner, validator and manager frontier',()=>{
  const kernelKinds=Object.keys(TIERS.kindSeats);
  assert.ok(kernelKinds.length>=7,'kindSeats carries the kernel model functions and judge');
  for(const [kind,seat] of Object.entries(TIERS.kindSeats)){
    assert.ok(TIERS.seats[seat],`${kind} names the declared seat ${seat}`);
    assert.ok(TIERS.tiers[TIERS.seats[seat]],`${kind}: seat ${seat} names a declared tier`);
  }
  assert.deepEqual([TIERS.seats.supervisor,TIERS.seats.kernel,TIERS.seats.planner,TIERS.seats.validator],['frontier','high','frontier','frontier']);
});

test('a kind with no roleOfKind entry resolves no role and refuses; it never lands on a tier by default',()=>{
  const unknown=selectPool({kind:'direct.call',difficulty:'medium',runtimes,capacity:{}});
  assert.match(unknown.error,/no role resolves for kind 'direct\.call'/);
  assert.equal(unknown.modelId,undefined);
});

test('tier chains: frontier Opus then Sol, high Sonnet then Sol, medium Devin then Sol, low Devin then Luna, imagegen Sol alone',()=>{
  const chain=tier=>TIERS.tiers[tier].map(member=>`${member.agent}/${member.model}`);
  assert.deepEqual(chain('frontier'),['claude/claude-opus-5-5','codex/gpt-6.1-sol']);
  assert.deepEqual(chain('high'),['claude/claude-sonnet-5-5','codex/gpt-6.1-sol']);
  assert.deepEqual(chain('medium'),['devin/swe-2-max','codex/gpt-6.1-sol']);
  assert.deepEqual(chain('low'),['devin/swe-2-max','codex/gpt-6-luna']);
  assert.deepEqual(chain('imagegen'),['codex/gpt-6.1-sol']);
  assert.deepEqual(TIERS.difficulty,{insane:'frontier',hard:'high',medium:'medium',easy:'low'});
  assert.deepEqual(TIERS.balance,{maxStreak:3,maxSharePercent:70});
  assert.deepEqual(TIERS.usage,{reservePercent:90,biasPercent:95,exhaustedPercent:100});
  for(const removed of ['tiers','preference','balanced','frontier','hands','overflowByOrder'])
    assert.equal(runtimes.allocation[removed],undefined,`runtimes.yaml allocation.${removed} is removed: tiers.yaml owns the order`);
});

// Hands-on implementation and scaffold work take the tier of its difficulty: easy and medium open on Devin (Luna or Sol
// after it), hard on Sonnet, insane on Opus. Kinds that need a host tool the first member lacks are checked elsewhere.
const handsOnKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='hands-on').map(([kind])=>kind);

test('hands-on kinds follow the tier of their difficulty: Devin below hard, Sonnet at hard, Opus at insane',()=>{
  assert.ok(handsOnKinds.length>=8);
  const lead={easy:['low','devin-agent','swe-2-max'],medium:['medium','devin-agent','swe-2-max'],hard:['high','claude-agent','claude-sonnet-5-5'],insane:['frontier','claude-agent','claude-opus-5-5']};
  for(const kind of handsOnKinds){
    if(hostToolsRequired(kind).length||kind in TIERS.kindTiers)continue;
    for(const difficulty of DIFFICULTY){
      const r=selectPool({kind,difficulty,runtimes,capacity:{}});
      assert.deepEqual([r.tier,r.target,r.modelId],lead[r.difficulty],`${kind}@${difficulty} (${r.difficulty})`);
    }
    const busy=selectPool({kind,difficulty:'medium',runtimes,capacity:{'devin-agent':{running:10}}});
    assert.equal(busy.target,busy.difficulty==='medium'?'codex-agent':'claude-agent',`${kind} falls to Sol when Devin is full, unless its floor already left the Devin tiers`);
  }
});

test('a prefer bias cannot hoist a provider outside the tier chain into strategy work',()=>{
  for(const kind of ['business.decide','implementation.plan','scope.define']){
    const r=selectPool({kind,difficulty:'medium',runtimes,capacity:{},bias:{prefer:[{provider:'devin'}]}});
    assert.deepEqual([r.chain,r.target],[['claude/claude-sonnet-5-5','codex/gpt-6.1-sol'],'claude-agent'],kind);
    const codex=selectPool({kind,difficulty:'medium',runtimes,capacity:{},bias:{prefer:[{provider:'codex'}]}});
    assert.equal(codex.target,'codex-agent','a prefer reorders only members the tier already holds');
  }
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

test('worker launch resolution takes the routed member, else the pool or target default model, and refuses unknown targets',()=>{
  const modelsDir=path.join(ROOT,'modules','models');
  const resolve=(target,payload={})=>resolveWorkerLaunchModel({target,payload,runtimes,modelsDir});
  for(const [target,model] of [['gpt-6.1-sol','gpt-6.1-sol'],['gpt-6-luna','gpt-6-luna'],['cursor-agent','auto']]){
    assert.deepEqual(resolve(target,{difficulty:'hard'}),{modelId:model,effort:null,source:'registry'},target);
  }
  for(const target of ['claude-agent','devin-agent','codex-agent']){
    const result=resolve(target,{difficulty:'hard'});
    assert.deepEqual([result.modelId,result.source],[runtimes.runtimes[target].defaultModel,'registry'],target);
    assert.equal(resolve(target,{difficulty:'easy'}).modelId,result.modelId,'the difficulty picks a tier, never a second model of the pool');
  }
  assert.deepEqual(resolve('codex-agent',{modelId:'gpt-6.1-sol',effort:'high'}),{modelId:'gpt-6.1-sol',effort:'high',source:'route'},'a routed member keeps its model and effort');
  for(const target of ['codex-gpt-6.1-sol','devin-devin-worker','unknown-target']){
    const result=resolve(target,{difficulty:'hard'});
    assert.ok(result.error,`${target} must refuse instead of changing its identity`);
    assert.equal(result.modelId,undefined);
  }
});
