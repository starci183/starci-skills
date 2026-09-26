import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';
import {hostToolsRequired,kindRoute,raiseToFloor,selectPool} from '../scripts/agent/models.mjs';

// runtimes.yaml roleOfKind is the allocator's reading of every kind: role, think/hands-on work and the
// least difficulty it routes at. These specs hold the owner's rules on that table: canonical-record and
// verdict ops are think work at a hard floor, source setup is any pool, and a floor only raises.
const ROOT=path.resolve(import.meta.dirname,'..');
const read=file=>parseYaml(fs.readFileSync(path.join(ROOT,file),'utf8'));
const runtimes=read('modules/models/runtimes.yaml');
const kinds=read('modules/models/kinds.yaml');
const DIFFICULTY=['easy','medium','hard','insane'];
const rank=d=>DIFFICULTY.indexOf(d);

test('every op manifest and every kinds.yaml kind carries a complete roleOfKind entry that agrees on role',()=>{
  const ops=fs.readdirSync(path.join(ROOT,'modules','ops','ops')).filter(f=>f.endsWith('.yaml')).map(f=>f.slice(0,-5));
  assert.equal(ops.length,37);
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
  assert.equal(raiseToFloor('M','hard'),'hard');
  assert.equal(raiseToFloor('hard',null),'hard');
  const decide=selectPool({kind:'business.decide',difficulty:'medium',runtimes});
  assert.deepEqual([decide.measuredDifficulty,decide.floor,decide.difficulty],['medium','hard','hard']);
  const implement=selectPool({kind:'backend.implement',difficulty:'easy',runtimes});
  assert.deepEqual([implement.measuredDifficulty,implement.difficulty],['easy','medium']);
  assert.equal(selectPool({kind:'backend.implement',difficulty:'insane',runtimes}).difficulty,'insane');
  assert.equal(kindRoute('legacy.kind',{roleOfKind:{'legacy.kind':'implement'}}).role,'implement','a bare role string still resolves');
});

// Owner rule: thinking work goes to Claude Opus 5.5, or GPT-6 Sol when Claude is unavailable, at every
// difficulty the work may be measured at — never to Luna, Devin or Qwen. Owner decision 2026-09-25 (72h
// scripts/agent/model-scorecard.mjs evidence) took Qwen back out of the think orders: it has no think evidence.
// Owner decision 2026-09-25 review-hands: Opus and Sol keep strategy only; the think verdicts (review, handover,
// goal audit) and work.author walk the review order - Devin and Qwen, Opus and Sol as overflow - which
// tests/allocation-balance.spec.mjs holds. Owner routing 2026-09-26: the kernel's own model calls walk sol-think
// (Sol first, Opus overflow); interface.audit, security.verify and uat.assisted.verify walk ui (Sol first);
// the mechanical ops provision.ask, workspace.manage, task.execute and knowledge.repair walk implement.
const FRONTIER=new Set(['claude-opus-5-5','gpt-6-sol']);
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
    assert.deepEqual([down.target,down.modelId],['codex-agent','gpt-6-sol'],`${kind}@${difficulty} with Claude down`);
    const both=selectPool({kind,difficulty,runtimes,capacity:{...claudeDown,'codex-agent':{auth:'dead'}}});
    assert.ok(both.error&&!both.target,`${kind}@${difficulty} with Opus and Sol down refuses - never Qwen or Devin`);
  }
});

test('the kernel model calls walk sol-think: Sol first at every difficulty, Opus when Sol is down',()=>{
  assert.ok(kernelKinds.length>=7,'the sol-think order carries the kernel model functions and judge');
  for(const kind of kernelKinds)for(const difficulty of DIFFICULTY){
    const up=selectPool({kind,difficulty,runtimes});
    assert.deepEqual([up.order,up.target,up.modelId],['sol-think','codex-agent','gpt-6-sol'],`${kind}@${difficulty} leads with Sol`);
    const down=selectPool({kind,difficulty,runtimes,capacity:codexDown});
    assert.deepEqual([down.target,down.modelId],['claude-agent','claude-opus-5-5'],`${kind}@${difficulty} with Sol down`);
    const both=selectPool({kind,difficulty,runtimes,capacity:{...claudeDown,...codexDown}});
    assert.ok(both.error&&!both.target,`${kind}@${difficulty} with Sol and Opus down refuses - never Qwen or Devin`);
  }
});

test('a think role with no kind never lands on Luna, Qwen or Devin below the hard tier',()=>{
  for(const role of ['decide','plan'])for(const difficulty of ['easy','medium']){
    assert.equal(selectPool({kind:'direct.call',role,difficulty,runtimes}).modelId,'claude-opus-5-5');
    const down=selectPool({kind:'direct.call',role,difficulty,runtimes,capacity:claudeDown});
    assert.ok(down.error&&!down.modelId,`${role}@${difficulty} with Claude down must refuse, not take Luna or a hands-on pool`);
  }
  for(const role of ['decide','plan']){
    const hard=selectPool({kind:'direct.call',role,difficulty:'hard',runtimes,capacity:claudeDown});
    assert.deepEqual([hard.target,hard.modelId],['codex-agent','gpt-6-sol']);
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
  // The kernel calls carry no operator entries; draw stays Codex alone; the new orders carry theirs.
  for(const kind of kernelKinds)assert.equal(registry.operators[kind],undefined,`${kind} is a kernel call, not an operation`);
  for(const kind of ['interface.draw','interface.asset'])assert.deepEqual(registry.operators[kind]?.chain,['codex-agent'],kind);
  for(const kind of ['interface.audit','e2e.verify','security.verify','uat.assisted.verify'])
    assert.deepEqual(registry.operators[kind]?.chain,['codex-agent','devin-agent','qwen-agent'],`${kind} walks ui`);
  for(const kind of ['provision.ask','workspace.manage','task.execute','knowledge.repair'])
    assert.deepEqual(registry.operators[kind]?.chain,['devin-agent','qwen-agent','codex-agent','claude-agent'],`${kind} walks implement`);
});

// Owner decision 2026-09-25 (72h scorecard): hands-on implementation goes to Devin (SWE-2-max) first and Qwen
// (DeepSeek V4.1 Flash) second at medium and hard, Qwen first at easy where Devin pins no model; scaffold,
// docs, content and grammar work goes to Qwen first; Codex then Opus overflow; insane leads with the frontier.
// The hands-on verify kinds walk the review order (owner decision 2026-09-25 review-hands) and e2e.verify the
// ui order (owner routing 2026-09-26) — both held by tests/allocation-balance.spec.mjs.
const handsOnKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='hands-on'&&!['review','ui'].includes(e.order)).map(([kind])=>kind);
const SCAFFOLD_KINDS=['backend.scaffold','interface.scaffold','package.scaffold','docs.author','content.generate','grammar.update'];

test('hands-on orders: Devin then Qwen for implementation, Qwen first for scaffold work, Codex and Claude after',()=>{
  const {tiers,preference}=runtimes.allocation;
  for(const role of ['implement','write','verify']){
    assert.deepEqual(preference[role],['devin-agent','qwen-agent','codex-agent','claude-agent'],role);
    assert.deepEqual(tiers.easy[role],['qwen-agent','codex-agent','claude-agent'],`easy ${role}`);
    assert.deepEqual(tiers.medium[role],['devin-agent','qwen-agent','codex-agent','claude-agent'],`medium ${role}`);
    assert.deepEqual(tiers.hard[role],['devin-agent','qwen-agent','codex-agent','claude-agent'],`hard ${role}`);
    assert.deepEqual(tiers.insane[role],['claude-agent','codex-agent','qwen-agent'],`insane ${role}`);
  }
  assert.deepEqual(preference.scaffold,['qwen-agent','devin-agent','codex-agent','claude-agent']);
  for(const tier of ['easy','medium','hard','insane'])assert.equal(tiers[tier].scaffold[0],'qwen-agent',`${tier} scaffold`);
  assert.deepEqual(preference.draw,['codex-agent']);
  for(const tier of ['easy','medium','hard'])
    assert.deepEqual(runtimes.allocation.balanced.overflowOnly['hands-on'][tier],['claude-agent'],`Opus is ${tier} hands-on overflow under balanced`);
  assert.equal(runtimes.allocation.balanced.overflowOnly['hands-on'].insane,undefined,'insane balances Opus and Sol');
  for(const kind of SCAFFOLD_KINDS)assert.equal(kindRoute(kind,runtimes).order,'scaffold',kind);
  const registry=read('modules/models/registry.yaml');
  for(const kind of handsOnKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain||hostToolsRequired(kind).length)continue;
    const lead=kindRoute(kind,runtimes).order==='scaffold'?['qwen-agent','devin-agent']:['devin-agent','qwen-agent'];
    assert.deepEqual(chain.slice(0,2),lead,`${kind} chain ${chain}`);
    assert.deepEqual(chain.slice(-2),['codex-agent','claude-agent'],`${kind} overflows to Codex then Claude`);
  }
});

test('hands-on kinds land on Qwen or Devin below insane when those pools have room',()=>{
  for(const kind of handsOnKinds){
    if(hostToolsRequired(kind).length)continue;
    for(const difficulty of ['easy','medium','hard']){
      const r=selectPool({kind,difficulty,runtimes});
      assert.ok(['qwen-agent','devin-agent'].includes(r.target),`${kind}@${difficulty} -> ${r.target}`);
      if(r.difficulty!=='easy')
        assert.equal(r.target,kindRoute(kind,runtimes).order==='scaffold'?'qwen-agent':'devin-agent',`${kind}@${difficulty}`);
    }
    const busy=selectPool({kind,difficulty:'medium',runtimes,capacity:{'qwen-agent':{running:10},'devin-agent':{running:10}}});
    assert.equal(busy.target,'codex-agent',`${kind} overflows to Codex when Qwen and Devin are full`);
  }
});

test('a prefer bias cannot hoist a pool outside the think order into strategy work',()=>{
  for(const kind of ['business.decide','implementation.plan','scope.define'])
    for(const prefer of [['devin-agent'],['qwen-agent'],['devin-agent','qwen-agent']]){
      const r=selectPool({kind,difficulty:'medium',runtimes,bias:{prefer}});
      assert.deepEqual([r.chain,r.target],[['claude-agent','codex-agent'],'claude-agent'],`${kind} ${prefer}`);
    }
  // A verdict walks the review order instead: the hands lead it and a prefer cannot hoist the overflow.
  const review=selectPool({kind:'review.verify',difficulty:'medium',runtimes,bias:{prefer:['claude-agent']}});
  assert.deepEqual([review.order,review.target],['review','devin-agent']);
  assert.deepEqual(runtimes.runtimes['qwen-agent'].roles,['implement','verify','write'],'Qwen carries no decide or plan role');
});
