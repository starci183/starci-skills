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
// difficulty the work may be measured at — never to Luna or Devin. Owner ruling 2026-09-24: the Qwen base
// pool is eligible for every kind too; it trails the think order, so it takes think work only after the
// frontier pools (or by share under balanced).
const FRONTIER=new Set(['claude-opus-5-5','gpt-6-sol']);
const thinkKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='think').map(([kind])=>kind);
const claudeDown={'claude-agent':{auth:'dead'}};

test('think kinds resolve to a frontier model at every difficulty, Claude first and Sol when Claude is down',()=>{
  assert.ok(thinkKinds.length>=20);
  for(const kind of thinkKinds)for(const difficulty of DIFFICULTY){
    const up=selectPool({kind,difficulty,runtimes});
    assert.ok(FRONTIER.has(up.modelId),`${kind}@${difficulty} -> ${up.target}/${up.modelId}`);
    const needsTool=hostToolsRequired(kind).length>0;
    assert.equal(up.target,needsTool?'codex-agent':'claude-agent',`${kind}@${difficulty} leads with Claude unless a host tool forbids it`);
    const down=selectPool({kind,difficulty,runtimes,capacity:claudeDown});
    assert.deepEqual([down.target,down.modelId],['codex-agent','gpt-6-sol'],`${kind}@${difficulty} with Claude down`);
  }
});

test('a think role with no kind never lands on Luna below the hard tier; the Qwen base pool takes it when Claude is down',()=>{
  for(const role of ['decide','plan'])for(const difficulty of ['easy','medium']){
    assert.equal(selectPool({kind:'direct.call',role,difficulty,runtimes}).modelId,'claude-opus-5-5');
    const down=selectPool({kind:'direct.call',role,difficulty,runtimes,capacity:claudeDown});
    assert.deepEqual([down.target,down.modelId],['qwen-agent','deepseek-v4.1-flash'],`${role}@${difficulty} with Claude down takes the base pool, never Luna`);
    const none=selectPool({kind:'direct.call',role,difficulty,runtimes,capacity:{...claudeDown,'qwen-agent':{auth:'dead'}}});
    assert.ok(none.error&&!none.modelId,`${role}@${difficulty} with Claude and Qwen down must refuse, not take Luna`);
  }
});

test('every declared operator chain of a think kind names only think-order pools, Claude first, the Qwen base pool last',()=>{
  const registry=read('modules/models/registry.yaml');
  const think=runtimes.allocation.preference.think;
  assert.deepEqual(think,['claude-agent','codex-agent','qwen-agent']);
  assert.deepEqual(runtimes.allocation.frontier,['claude-agent','codex-agent'],'the frontier group stays Opus + Sol');
  for(const kind of thinkKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain)continue;
    assert.ok(chain.every(pool=>think.includes(pool)),`${kind} chain ${chain}`);
    if(chain.length>1)assert.equal(chain[0],'claude-agent',`${kind} chain leads with Claude`);
    if(!hostToolsRequired(kind).length||chain.includes('qwen-agent'))
      assert.equal(chain.at(-1),'qwen-agent',`${kind} chain ends with the Qwen base pool`);
  }
});

// Owner rule (2026-09-24): hands-on work goes to Qwen (DeepSeek V4.1 Flash, the base pool) first, then Devin
// (medium and hard) and Codex, Opus only as overflow; insane leads with the frontier pools and ends with Qwen.
const handsOnKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='hands-on').map(([kind])=>kind);

test('hands-on orders: the Qwen base pool first, then Devin, Codex and Claude; insane frontier first, Qwen last',()=>{
  const {tiers,preference}=runtimes.allocation;
  for(const role of ['implement','write','verify']){
    assert.deepEqual(preference[role],['qwen-agent','devin-agent','codex-agent','claude-agent'],role);
    assert.deepEqual(tiers.easy[role],['qwen-agent','codex-agent','claude-agent'],`easy ${role}`);
    assert.deepEqual(tiers.medium[role],['qwen-agent','devin-agent','codex-agent','claude-agent'],`medium ${role}`);
    assert.deepEqual(tiers.hard[role],['qwen-agent','devin-agent','codex-agent','claude-agent'],`hard ${role}`);
    assert.deepEqual(tiers.insane[role],['claude-agent','codex-agent','qwen-agent'],`insane ${role}`);
  }
  for(const tier of ['easy','medium','hard'])
    assert.deepEqual(runtimes.allocation.balanced.overflowOnly['hands-on'][tier],['claude-agent'],`Opus is ${tier} hands-on overflow under balanced`);
  assert.equal(runtimes.allocation.balanced.overflowOnly['hands-on'].insane,undefined,'insane balances Opus and Sol');
  const registry=read('modules/models/registry.yaml');
  for(const kind of handsOnKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain||hostToolsRequired(kind).length)continue;
    assert.equal(chain[0],'qwen-agent',`${kind} chain ${chain} must lead with the Qwen base pool`);
    assert.deepEqual(chain.slice(-2),['codex-agent','claude-agent'],`${kind} overflows to Codex then Claude`);
  }
});

test('hands-on kinds land on Qwen or Devin below insane when those pools have room',()=>{
  for(const kind of handsOnKinds){
    if(hostToolsRequired(kind).length)continue;
    for(const difficulty of ['easy','medium','hard']){
      const r=selectPool({kind,difficulty,runtimes});
      assert.ok(['qwen-agent','devin-agent'].includes(r.target),`${kind}@${difficulty} -> ${r.target}`);
    }
    const busy=selectPool({kind,difficulty:'medium',runtimes,capacity:{'qwen-agent':{running:10},'devin-agent':{running:10}}});
    assert.equal(busy.target,'codex-agent',`${kind} overflows to Codex when Qwen and Devin are full`);
  }
});

test('a prefer bias cannot hoist a pool outside the think order into think work',()=>{
  const devin=selectPool({kind:'review.verify',difficulty:'medium',runtimes,bias:{prefer:['devin-agent']}});
  assert.deepEqual(devin.chain,['claude-agent','codex-agent','qwen-agent']);
  assert.equal(devin.target,'claude-agent');
  // The Qwen base pool is in the think order, so a prefer bias may hoist it there.
  const qwen=selectPool({kind:'review.verify',difficulty:'medium',runtimes,bias:{prefer:['devin-agent','qwen-agent']}});
  assert.deepEqual([qwen.chain,qwen.target],[['qwen-agent','claude-agent','codex-agent'],'qwen-agent']);
});
