import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CUT_ASSERTIONS,CUT_FILES,cutOversizedOps,effectiveDifficulty,fanOutDeferral,opCutGroup,opCutReason,settleOpCuts} from '../kernel/sync.mjs';
import {planDispatch} from '../kernel/dispatcher.mjs';
import {PREFER_THEN_OVERFLOW,applyQuota,createAllocator} from '../kernel/schedule.mjs';
import {allowlistsOverlap,parseQuota} from '../kernel/common.mjs';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The op-level cut contract: an implement op whose measured scope is past the bounds is cut into disjoint
 * children BEFORE its first launch, whatever ledger mode minted it - the same treatment a too-big Work node
 * gets, applied to ops that never pass through a node. The children are named `<op>.1`, `<op>.2`, ..., one is
 * the named seam that runs first and alone, the parent waits as the derived group parent, and every child
 * allocates on its own so the group spreads over the provider pools by real capacity.
 */
const op=(id,extra={})=>({id,kind:'backend.implement',role:'implement',status:'pending',goal:`build ${id}`,
  nodeId:null,ledgerIds:[],allowlist:[],references:[],checks:[],acceptance:[],dependsOn:[],
  avoidRuntimes:[],resources:[],attempt:1,reports:[],origin:'plan',files:[],...extra});
const state=(ops=[],extra={})=>({id:'wf-fanout',worktree:'/repo',ops,cuts:{},opCuts:{},ledger:[],lanes:{},
  needUser:[],iterations:0,ledgerMode:'plan',scope:[],dynamicOps:0,dynamicOpsBudget:64,...extra});
const store=events=>({appendEvent:event=>events.push(event)});
const byId=(s,id)=>s.ops.find(item=>item.id===id);
const wide=(id='op.C',n=CUT_FILES+2)=>op(id,{allowlist:Array.from({length:n},(_,i)=>`src/feature/f${i}.ts`)});

/* ------------------------------------------------------------------ the gate */

test('a 14-file op is cut into disjoint children with a named seam before its first launch',()=>{
  const events=[],s=state([wide()]);
  assert.deepEqual(cutOversizedOps(store(events),s,{}),['op.C']);
  const parent=byId(s,'op.C');
  assert.equal(parent.status,'paused','the parent waits as the derived group parent and never launches whole');
  assert.deepEqual(parent.cutChildren,s.opCuts['op.C'].children);
  const group=opCutGroup(s,'op.C');
  assert.ok(group,'the op-level group is recorded under the parent op id');
  assert.ok(group.children.length>=2,'at least two children');
  assert.ok(group.seam&&group.children.includes(group.seam),'the seam is named and is one of the children');
  const children=group.children.map(id=>byId(s,id));
  assert.ok(children.every(Boolean),'every child is an op of the workflow');
  assert.ok(children.every(child=>child.cutChildOf==='op.C'),'every child names its parent');
  assert.ok(children.every(child=>child.allowlist.length<=CUT_FILES),'every child is inside the bound');
  assert.equal(children.flatMap(child=>child.allowlist).length,14,'the children carry the whole scope once');
  for(const [i,a] of children.entries())for(const b of children.slice(i+1))
    assert.ok(!allowlistsOverlap(a.allowlist,b.allowlist),`${a.id} and ${b.id} are disjoint`);
  const seam=byId(s,group.seam);
  for(const child of children.filter(item=>item!==seam))
    assert.ok(child.dependsOn.includes(seam.id),`${child.id} waits for the seam`);
  assert.ok(!seam.dependsOn.includes(seam.id),'the seam waits on nothing of its own group');
  assert.ok(events.some(event=>event.event==='op-cut'&&event.op==='op.C'&&event.seam===group.seam));
});

test('the gate measures all three bounds and skips non-implement roles and already-run ops',()=>{
  assert.match(opCutReason(wide()),/14 files.*12/);
  assert.match(opCutReason(op('deep',{assertions:Array.from({length:CUT_ASSERTIONS+1},(_,i)=>`a${i}`)})),/9 assertions/);
  assert.match(opCutReason(op('sds',{components:['a','b','c']})),/3 components/);
  assert.equal(opCutReason(op('verify',{kind:'review.verify',role:'verify',allowlist:Array.from({length:20},(_,i)=>`e/f${i}.md`)})),null,
    'a proof is one answer whatever its allowlist names');
  const s=state([wide('op.D')]);
  byId(s,'op.D').status='running';
  assert.deepEqual(cutOversizedOps(store([]),s,{}),[],'an op that already launched is never recut');
  const ran=state([wide('op.E')]);
  byId(ran,'op.E').attempt=2;
  assert.deepEqual(cutOversizedOps(store([]),ran,{}),[],'a retried op is answered by retries, not recut');
});

test('an op whose whole scope is one covering class is not split: the honest cut-none answer',()=>{
  const s=state([op('op.F',{allowlist:['src/**','src/a.ts','src/b.ts','src/c.ts','src/d.ts','src/e.ts','src/g.ts','src/h.ts','src/i.ts','src/j.ts','src/k.ts','src/l.ts','src/m.ts','src/n.ts','src/o.ts','src/p.ts']})]);
  // `src/**` covers every sibling entry - one class, so there is nothing disjoint to hand out.
  assert.deepEqual(cutOversizedOps(store([]),s,{}),[]);
  assert.equal(byId(s,'op.F').status,'pending');
});

/* ------------------------------------------------------------------ the seam and the bound */

test('the seam child runs first and alone; siblings launch only after it settles',()=>{
  const s=state([wide()]);
  cutOversizedOps(store([]),s,{});
  const group=opCutGroup(s,'op.C'),seam=byId(s,group.seam),sibling=byId(s,group.children.find(id=>id!==group.seam));
  seam.status='running';
  const held=fanOutDeferral(s,sibling,[seam],{});
  assert.match(held.reason,/seam.*runs alone/);
  seam.status='ready';sibling.status='running';
  const heldSeam=fanOutDeferral(s,seam,[sibling],{});
  assert.match(heldSeam.reason,/seam of op\.C runs alone/);
});

test('the planner holds a sibling back while its seam is in the same candidate set',()=>{
  const s=state([wide()]);
  cutOversizedOps(store([]),s,{});
  const group=opCutGroup(s,'op.C');
  const children=group.children.map(id=>byId(s,id));
  for(const child of children)child.status='ready';
  const plan=planDispatch(s,children,{maxParallelOps:10,fanOut:{seamFirst:true,maxPerGroup:9}});
  assert.deepEqual(plan.launch,[group.seam],'the seam wins alone whatever order the children arrive in');
  assert.ok(plan.wait.every(item=>item.reason.includes('seam')),'every sibling names the seam as its reason');
});

test('at most fanOut.maxPerGroup children of one op run at once',()=>{
  const s=state([wide('op.G',CUT_FILES*3+1)]);
  cutOversizedOps(store([]),s,{});
  const group=opCutGroup(s,'op.G');
  assert.ok(group.children.length>=3,'a 37-file scope cuts into at least three children');
  const children=group.children.map(id=>byId(s,id));
  byId(s,group.seam).status='done';
  for(const child of children)child.dependsOn=[];
  const rest=children.filter(child=>child.id!==group.seam);
  const running=rest.slice(0,2).map(child=>{child.status='running';return child;});
  const next=rest[2];next.status='ready';
  const held=fanOutDeferral(s,next,running,{allocator:{fanOut:{seamFirst:true,maxPerGroup:2}}});
  assert.match(held.reason,/2 children of op\.G already run/);
});

/* ------------------------------------------------------------------ allocation spreads by real capacity */

test('the children of one cut allocate independently and spread across pools by real capacity',()=>{
  const s=state([wide()]);
  cutOversizedOps(store([]),s,{});
  const group=opCutGroup(s,'op.C');
  // Three implement pools; the preferred one carries a single slot - real capacity, not a pinned runtime.
  const runtimes={maxParallelOps:10,roleOfKind:{'backend.implement':'implement'},
    allocation:{policy:PREFER_THEN_OVERFLOW,tiers:{hard:['pool-first','pool-second','pool-third']},fanOut:{seamFirst:true,maxPerGroup:9}},
    runtimes:{
      'pool-first':{target:'pool-first',provider:'one',roles:['implement'],maxParallel:1,models:{implement:'model-one'}},
      'pool-second':{target:'pool-second',provider:'two',roles:['implement'],maxParallel:1,models:{implement:'model-two'}},
      'pool-third':{target:'pool-third',provider:'three',roles:['implement'],maxParallel:4,models:{implement:'model-three'}}}};
  const allocator=createAllocator({runtimes,now:()=>Date.UTC(2026,8,16,9)});
  const landed=new Set();
  for(const id of group.children){
    const child=byId(s,id);
    const pick=allocator.allocate(child.kind,{difficulty:effectiveDifficulty(child),job:{opId:child.id}});
    assert.ok(pick.ok,`${id}: ${pick.reason}`);
    landed.add(pick.runtime);
  }
  assert.ok(landed.size>=2,`children landed on ${[...landed].join(', ')} - expected at least two pools`);
});

test('a hard-difficulty child never lands on a sol-tier model as first choice',()=>{
  const profile=parseYaml(fs.readFileSync(new URL('../modules/models/runtimes.yaml',import.meta.url),'utf8'));
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,16,9)});
  const pick=allocator.allocate('backend.implement',{difficulty:'hard',job:{opId:'op.C.1'}});
  assert.ok(pick.ok,pick.reason);
  assert.notEqual(pick.model,'gpt-5.6-sol','Sol is the last heavy fallback, never the first answer');
  assert.equal(pick.runtime,'claude-agent','the hard tier answers with Opus first');
  // Devin stays closed without an explicit workflow quota: the hard tier's second pool is never assumed open.
  assert.equal(profile.runtimes['devin-agent'].maxParallel,0);
  assert.equal(pick.runtime==='devin-agent',false);
});

/* ------------------------------------------------------------------ the parent settles as the group */

test('the parent is done when every child is, and carries the group head and files',()=>{
  const s=state([wide()]);
  cutOversizedOps(store([]),s,{});
  const group=opCutGroup(s,'op.C'),parent=byId(s,'op.C');
  const children=group.children.map(id=>byId(s,id));
  children.slice(0,-1).forEach(child=>{child.status='done';child.head='abc123';});
  settleOpCuts(store([]),s);
  assert.equal(parent.status,'paused','one child short, the parent still waits');
  const last=children.at(-1);last.status='done';last.head='def456';last.files=['src/feature/f13.ts'];
  settleOpCuts(store([]),s);
  assert.equal(parent.status,'done');
  assert.equal(parent.verdict,'cut');
  assert.equal(parent.head,'def456');
  assert.deepEqual(parent.files,['src/feature/f13.ts']);
});

test('a child that dies for good blocks the parent and cancels the siblings that never launched',()=>{
  const s=state([wide()]);
  cutOversizedOps(store([]),s,{});
  const group=opCutGroup(s,'op.C'),parent=byId(s,'op.C');
  const children=group.children.map(id=>byId(s,id));
  children[0].status='failed';
  settleOpCuts(store([]),s);
  assert.equal(parent.status,'blocked');
  assert.equal(parent.refusal,'cut-child-failed');
  assert.ok(children.slice(1).every(child=>child.status==='cancelled'),'the group dies with its child');
  assert.ok(s.needUser.some(item=>item.op==='op.C'&&item.kind==='authority'),'the owner sees why the group stopped');
});

/* ------------------------------------------------------------------ quota aliases merge by MAX */

test('quota slots naming the same pool through aliases merge by MAX, not last-write-wins',()=>{
  const profile=parseYaml(fs.readFileSync(new URL('../modules/models/runtimes.yaml',import.meta.url),'utf8'));
  // `gpt-5.6-luna` and `gpt-5.6-sol` are retired spellings of the codex-agent pool: the granted capacity is
  // the largest of the aliases, and a zero on an unused spelling cannot close the slots another was given.
  const grown=applyQuota(profile,{slots:{'gpt-5.6-luna':7,'codex-agent':5}});
  assert.equal(grown.runtimes['codex-agent'].maxParallel,7);
  const kept=applyQuota(profile,{slots:{'codex-agent':5,'gpt-5.6-sol':0}});
  assert.equal(kept.runtimes['codex-agent'].maxParallel,5,'a zero on a second spelling never closes the pool');
  const parsed=parseQuota('gpt-5.6-luna=2,codex-agent=3');
  assert.deepEqual(parsed.order,['codex-agent'],'aliases fold into the pool they name');
});
