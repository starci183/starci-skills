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
// difficulty the work may be measured at — never to Luna, Qwen or Devin.
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

test('a think role with no kind never lands on Luna below the hard tier',()=>{
  for(const role of ['decide','plan'])for(const difficulty of ['easy','medium']){
    assert.equal(selectPool({kind:'direct.call',role,difficulty,runtimes}).modelId,'claude-opus-5-5');
    const down=selectPool({kind:'direct.call',role,difficulty,runtimes,capacity:claudeDown});
    assert.ok(down.error&&!down.modelId,`${role}@${difficulty} with Claude down must refuse, not take Luna`);
  }
});

test('every declared operator chain of a think kind names only frontier pools, Claude first',()=>{
  const registry=read('modules/models/registry.yaml');
  const frontier=runtimes.allocation.preference.think;
  assert.deepEqual(frontier,['claude-agent','codex-agent']);
  for(const kind of thinkKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain)continue;
    assert.ok(chain.every(pool=>frontier.includes(pool)),`${kind} chain ${chain}`);
    if(chain.length>1)assert.equal(chain[0],'claude-agent',`${kind} chain leads with Claude`);
  }
});

// Owner rule: hands-on work goes to Qwen and Devin first, the frontier pools only as overflow; insane is
// frontier-only.
const handsOnKinds=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='hands-on').map(([kind])=>kind);

test('hands-on orders lead with Qwen and Devin, overflow to Codex then Claude, and insane stays frontier-only',()=>{
  const {tiers,preference}=runtimes.allocation;
  for(const role of ['implement','write','verify']){
    assert.deepEqual(preference[role],['qwen-agent','devin-agent','codex-agent','claude-agent'],role);
    assert.deepEqual(tiers.easy[role],['qwen-agent','devin-agent','codex-agent','claude-agent'],`easy ${role}`);
    assert.deepEqual(tiers.medium[role],['qwen-agent','devin-agent','codex-agent','claude-agent'],`medium ${role}`);
    assert.deepEqual(tiers.hard[role],['devin-agent','codex-agent','claude-agent'],`hard ${role}`);
    assert.deepEqual(tiers.insane[role],['claude-agent','codex-agent'],`insane ${role}`);
  }
  const registry=read('modules/models/registry.yaml');
  for(const kind of handsOnKinds){
    const chain=registry.operators[kind]?.chain;
    if(!chain||hostToolsRequired(kind).length)continue;
    assert.ok(['qwen-agent','devin-agent'].includes(chain[0]),`${kind} chain ${chain} must lead with Qwen or Devin`);
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

test('a prefer bias cannot hoist a non-frontier pool into think work',()=>{
  const r=selectPool({kind:'review.verify',difficulty:'medium',runtimes,bias:{prefer:['devin-agent','qwen-agent']}});
  assert.deepEqual(r.chain,['claude-agent','codex-agent']);
  assert.equal(r.target,'claude-agent');
});
