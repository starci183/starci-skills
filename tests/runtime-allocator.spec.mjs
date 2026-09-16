import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {parseQuota} from '../kernel/common.mjs';
import {ADAPTIVE_CAPACITY,ALLOCATION,withProviderPreference,DEFAULT_COOLDOWN_MS,LEAST_LOADED,PREFER_THEN_OVERFLOW,applyQuota,budgetBand,classifyFailure,createAllocator,sequentialRuntimes} from '../kernel/schedule.mjs';
import {RUNTIME_LOADS,loadsFile,loadsFileFor,readLoads} from '../kernel/loads.mjs';

const profile=parseYaml(fs.readFileSync(new URL('../model/runtimes.yaml',import.meta.url),'utf8'));
const clock=start=>{const box={at:start};return {now:()=>box.at,advance:ms=>{box.at+=ms;}};};

test('owner allocation preserves adaptive policy and may constrain exact operation roles',()=>{
  const adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:'claude'});
  const quota=parseQuota('codex-agent=10@implement,claude-fable=3@verify+plan+decide');
  assert.deepEqual(quota.roles,{'codex-agent':['implement'],'claude-fable':['verify','plan','decide']});
  const applied=applyQuota(adaptive,quota);
  assert.equal(applied.allocation.policy,ADAPTIVE_CAPACITY);
  assert.equal(applied.runtimes['codex-agent'].maxParallel,10);
  assert.deepEqual(Object.entries(applied.runtimes).filter(([,pool])=>pool.roles.includes('implement')).map(([id])=>id),['codex-agent']);
  assert.deepEqual(Object.entries(applied.runtimes).filter(([,pool])=>pool.roles.includes('plan')).map(([id])=>id),['claude-fable']);
  assert.throws(()=>parseQuota('codex-agent=10@implement+owner'),/allocation roles/);
});

test('Devin stays closed without an owner slot and an explicit slot admits it without inventing quota headroom',()=>{
  const at=Date.UTC(2026,8,16,9),adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:'devin'});
  const closed=createAllocator({runtimes:adaptive,now:()=>at});
  assert.equal(closed.review('backend.implement').blocked.find(item=>item.runtime==='devin-agent')?.reason,'requires an explicit workflow quota slot');
  const quota=parseQuota('devin-agent=1@implement');
  const opened=createAllocator({runtimes:adaptive,quota,now:()=>at});
  const first=opened.allocate('backend.implement',{job:{opId:'op-devin-1'}});
  assert.equal(first.ok,true);
  assert.equal(first.runtime,'devin-agent');
  assert.equal(first.adaptive.families[0].provider,'devin');
  assert.equal(first.adaptive.families[0].headroom,null);
  assert.equal(first.adaptive.families[0].quotaTelemetry,'launch-status');
  const second=opened.allocate('backend.implement',{job:{opId:'op-devin-2'}});
  assert.equal(second.ok,false);
  assert.equal(second.blocked.find(item=>item.runtime==='devin-agent')?.reason,'no free slot');
});

test('the headless host never exposes the Orca-only Devin target even when the owner assigns a slot',()=>{
  const allocator=createAllocator({runtimes:profile,quota:parseQuota('devin-agent=1@implement'),executionHost:'headless',now:()=>0});
  assert.equal(allocator.launchableTargets('backend.implement').includes('devin-agent'),false);
  assert.throws(()=>allocator.candidateFor('backend.implement','devin-agent'),/not launchable.*headless/);
});
/**
 * A throwaway workflows root: the shared runtime ledger beside the workflow directories, each of which may hold
 * a `kernel.lock` - the one thing that says whether the workflow that wrote an entry is still alive.
 */
function sharedRoot(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-runtime-loads-'));
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});});
  return {
    root,file:loadsFile(root),
    /** A workflow whose kernel is this very process is alive; one with a dead pid or no lock at all is not. */
    kernel:(workflow,pid=process.pid)=>{
      fs.mkdirSync(path.join(root,workflow),{recursive:true});
      if(pid!==null)fs.writeFileSync(path.join(root,workflow,'kernel.lock'),JSON.stringify({pid,startedAt:1}));
    },
    write:runtimes=>fs.writeFileSync(loadsFile(root),JSON.stringify({schema:RUNTIME_LOADS,runtimes})),
    read:()=>JSON.parse(fs.readFileSync(loadsFile(root),'utf8'))
  };
}
const liveOn=(workflow,op,since=1)=>({live:[{workflow,op,since}],cooling:null,usedToday:1,day:'2026-09-12'});
const fixture=runtimes=>({
  maxParallelOps:10,
  allocation:{policy:LEAST_LOADED,verifyAvoidsImplementRuntime:true,cooldownMs:DEFAULT_COOLDOWN_MS,backoffFactor:2,maxCooldownMs:3600000},
  roleOfKind:{'x.implement':'implement','x.verify':'verify'},
  runtimes
});
const tally=ids=>ids.reduce((counts,id)=>({...counts,[id]:(counts[id]??0)+1}),{});

test('prefer-then-overflow fills the preferred runtime before it offers the next one',()=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const allocator=createAllocator({runtimes:profile,now:time.now});
  assert.equal(allocator.schema,ALLOCATION);
  assert.equal(allocator.maxParallelOps,20);
  assert.equal(allocator.policy,PREFER_THEN_OVERFLOW);
  assert.equal(profile.allocation.policy,PREFER_THEN_OVERFLOW);
  assert.deepEqual(profile.allocation.preference.implement,['codex-agent','claude-agent','qwen-agent','devin-agent']);
  assert.equal(profile.runtimes['codex-agent'].maxParallel,8);
  const picked=[];
  for(let index=0;index<9;index+=1){
    const result=allocator.allocate('backend.implement');
    assert.equal(result.ok,true,result.reason);
    assert.equal(result.role,'implement');
    assert.equal(result.target,profile.runtimes[result.runtime].target);
    assert.equal(result.policy,PREFER_THEN_OVERFLOW);
    picked.push(result.runtime);
  }
  // Eight slots of the preferred pool first, and only the ninth operation overflows to the next one.
  assert.deepEqual(picked,['codex-agent','codex-agent','codex-agent','codex-agent','codex-agent','codex-agent','codex-agent','codex-agent','claude-agent']);
  assert.deepEqual(tally(picked),{'codex-agent':8,'claude-agent':1});
  // A freed preferred slot takes the next operation straight back from the overflow runtime.
  allocator.release('codex-agent');
  assert.equal(allocator.allocate('backend.implement').runtime,'codex-agent');
  const snapshot=allocator.snapshot();
  assert.equal(snapshot.policy,PREFER_THEN_OVERFLOW);
  assert.deepEqual(snapshot.preference.verify,['codex-agent','claude-fable','claude-agent','qwen-agent','devin-agent']);
  assert.equal(snapshot.inFlight,9);
  // No pool declares a daily budget any more - the probed provider window is the only one - so nothing is left to count.
  assert.equal(profile.runtimes['claude-agent'].budget,undefined);
  assert.equal(snapshot.runtimes['claude-agent'].remaining.ops,null);
  assert.equal(snapshot.runtimes['qwen-agent'].remaining.tokens,null);
  assert.deepEqual(snapshot.cooling,[]);
  for(let index=0;index<9;index+=1)assert.equal(allocator.allocate('backend.implement').ok,true);
  // The implement pools are full; the decide pools carry the last two operations to the repository-wide cap.
  assert.equal(allocator.allocate('decision.prepare').ok,true);
  assert.equal(allocator.allocate('decision.prepare').ok,true);
  assert.equal(allocator.snapshot().inFlight,20);
  const twentyFirst=allocator.allocate('decision.prepare');
  assert.equal(twentyFirst.ok,false);
  assert.match(twentyFirst.reason,/maxParallelOps 20 is already in flight/);
});

test('a rate-limited preference overflows to the next runtime and is taken up again after the cooldown',()=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const allocator=createAllocator({runtimes:profile,now:time.now});
  const first=allocator.allocate('backend.implement');
  assert.equal(first.runtime,'codex-agent');
  assert.equal(first.overflowed,false);
  allocator.failed('codex-agent',{reason:'HTTP 429 Too Many Requests'});
  const overflow=[];
  for(let index=0;index<6;index+=1)overflow.push(allocator.allocate('backend.implement').runtime);
  // The Claude pool has six slots, so the seventh operation overflows once more, to Qwen.
  assert.deepEqual(overflow,['claude-agent','claude-agent','claude-agent','claude-agent','claude-agent','claude-agent']);
  const cooling=allocator.allocate('backend.implement');
  assert.equal(cooling.runtime,'qwen-agent');
  assert.equal(cooling.overflowed,true);
  assert.match(cooling.blocked.find(item=>item.runtime==='codex-agent').reason,/cooling after rate-limited/);
  time.advance(600001);
  assert.equal(allocator.allocate('backend.implement').runtime,'codex-agent');
  // The preference order is the allocation order; a role with no list falls back to least loaded.
  const fresh=createAllocator({runtimes:profile,now:time.now});
  assert.deepEqual(fresh.review('backend.implement').ready.map(item=>item.runtime),['codex-agent','claude-agent','qwen-agent']);
  const unranked=createAllocator({runtimes:{...profile,allocation:{...profile.allocation,preference:{verify:profile.allocation.preference.verify}}},now:time.now});
  assert.equal(unranked.review('backend.implement').preference,null);
  assert.deepEqual(unranked.review('backend.implement').ready.map(item=>item.runtime),['codex-agent','claude-agent','qwen-agent']);
  assert.equal(unranked.allocate('backend.implement').overflowed,false);
  assert.equal(unranked.allocate('review.verify').runtime,'codex-agent');
});

test('an exact tie rotates to the runtime after the last allocated one',()=>{
  const runtimes=fixture({
    quick:{target:'quick',roles:['implement'],maxParallel:2},
    beta:{target:'beta',roles:['implement'],maxParallel:2}
  });
  const allocator=createAllocator({runtimes,now:()=>0});
  assert.equal(allocator.allocate('x.implement').runtime,'quick');
  allocator.release('quick');
  assert.equal(allocator.allocate('x.implement').runtime,'beta');
  allocator.release('beta');
  assert.equal(allocator.allocate('x.implement').runtime,'quick');
});

test('an allocation the admission deferred gives the slot and the day\'s count back, without cooling',()=>{
  const time=clock(Date.UTC(2026,8,12,23,30));
  const allocator=createAllocator({runtimes:fixture({small:{target:'small',roles:['implement'],maxParallel:3,budget:{opsPerDay:2,tokensPerDay:1000}}}),now:time.now});
  // Three ticks of "the canonical writer is busy": before this rule each one counted as an op the runtime carried.
  for(let tick=0;tick<3;tick+=1){
    const allocated=allocator.allocate('x.implement',{job:{id:'op-a'}});
    assert.equal(allocated.ok,true,allocated.reason);
    const back=allocator.deferred('small',{op:'op-a'});
    assert.deepEqual([back.ok,back.load],[true,0]);
  }
  assert.deepEqual(allocator.snapshot().runtimes.small.remaining,{ops:2,tokens:1000},'a deferral spends nothing');
  assert.equal(allocator.snapshot().runtimes.small.usedToday,0);
  assert.equal(allocator.snapshot().cooling.small,undefined,'a deferral is not a failure and cools nothing');
  const real=allocator.allocate('x.implement');
  assert.equal(real.ok,true);
  assert.deepEqual(real.remaining,{ops:1,tokens:1000});
});

test('a pool is refused when its daily budget is spent and recovers on the next UTC day',()=>{
  const time=clock(Date.UTC(2026,8,12,23,30));
  const allocator=createAllocator({runtimes:fixture({small:{target:'small',roles:['implement'],maxParallel:3,budget:{opsPerDay:2,tokensPerDay:1000}}}),now:time.now});
  const first=allocator.allocate('x.implement');
  assert.equal(first.ok,true);
  assert.deepEqual(first.remaining,{ops:1,tokens:1000});
  allocator.release('small',{tokens:400});
  const second=allocator.allocate('x.implement');
  assert.deepEqual(second.remaining,{ops:0,tokens:600});
  allocator.release('small',{tokens:400});
  const third=allocator.allocate('x.implement');
  assert.equal(third.ok,false);
  assert.match(third.reason,/daily op budget exhausted/);
  assert.deepEqual(third.blocked,[{runtime:'small',reason:'daily op budget exhausted'}]);
  assert.deepEqual(allocator.snapshot().runtimes.small.remaining,{ops:0,tokens:200});
  time.advance(60*60*1000);
  const fresh=allocator.allocate('x.implement');
  assert.equal(fresh.ok,true);
  assert.deepEqual(fresh.remaining,{ops:1,tokens:1000});
  assert.equal(allocator.snapshot().day,'2026-09-13');
  allocator.release('small',{tokens:1000});
  const spent=allocator.allocate('x.implement');
  assert.equal(spent.ok,false);
  assert.match(spent.reason,/daily token budget exhausted/);
});

test('a failed runtime cools down by failure kind, backs off per repeat and wakes at the stated time',()=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const runtimes=fixture({
    flash:{target:'flash',roles:['implement'],maxParallel:2,budget:{opsPerDay:10}},
    sol:{target:'sol',roles:['implement'],maxParallel:1,budget:{opsPerDay:10}}
  });
  const allocator=createAllocator({runtimes,now:time.now});
  assert.equal(allocator.allocate('x.implement').runtime,'flash');
  const cooled=allocator.failed('flash',{reason:'HTTP 429 Too Many Requests'});
  assert.equal(cooled.kind,'rate-limited');
  assert.equal(cooled.cooldownMs,600000);
  assert.equal(cooled.until,time.now()+600000);
  assert.equal(cooled.wakeAt,new Date(cooled.until).toISOString());
  const parked=allocator.snapshot();
  assert.deepEqual(parked.cooling.map(item=>[item.runtime,item.kind,item.wakeAt,item.failures,item.cooldownMs]),[['flash','rate-limited',cooled.wakeAt,1,600000]]);
  // The slot is freed and the op refunded: a launch that never ran costs no budget.
  assert.equal(parked.runtimes.flash.load,0);
  assert.equal(parked.runtimes.flash.usedToday,0);
  assert.equal(parked.inFlight,0);
  const next=allocator.allocate('x.implement');
  assert.equal(next.runtime,'sol');
  assert.match(next.blocked.find(item=>item.runtime==='flash').reason,/cooling after rate-limited until 2026-09-12T09:10:00.000Z/);
  time.advance(600001);
  assert.deepEqual(allocator.snapshot().cooling,[]);
  assert.equal(allocator.allocate('x.implement').runtime,'flash');
  assert.equal(allocator.failed('flash',{reason:'rate limit reached'}).cooldownMs,1200000);
  assert.deepEqual([allocator.failed('flash',{reason:'overloaded'}),allocator.failed('flash',{reason:'429'})].map(item=>[item.failures,item.cooldownMs]),[[3,2400000],[4,3600000]]);
  // A finished operation clears the streak, so the next failure starts at the base cooldown again.
  time.advance(3600001);
  allocator.allocate('x.implement');
  allocator.release('flash');
  assert.equal(allocator.failed('flash',{reason:'connection reset'}).cooldownMs,300000);
  assert.equal(allocator.failed('sol',{reason:'insufficient_quota for this month'}).kind,'quota');
  // The cap limits the backoff, never a configured base above it: an auth lockout stays a day long.
  const locked=createAllocator({runtimes,now:time.now}).failed('sol',{reason:'401 Unauthorized'});
  assert.deepEqual([locked.kind,locked.cooldownMs],['auth',86400000]);
});

test('verify avoids the implement runtime and refuses instead of reusing it',()=>{
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9)});
  const verifyPools=Object.entries(profile.runtimes).filter(([,pool])=>pool.roles.includes('verify')).map(([id])=>id);
  assert.ok(verifyPools.length>=2);
  const implement=allocator.allocate('backend.implement');
  assert.equal(implement.ok,true);
  const verify=allocator.allocateVerify('review.verify',{implementRuntime:implement.runtime});
  assert.equal(verify.ok,true);
  assert.equal(verify.role,'verify');
  assert.notEqual(verify.runtime,implement.runtime);
  assert.ok(!verify.alternatives.includes(implement.runtime));
  const only=allocator.allocate('review.verify',{avoid:verifyPools.slice(1)});
  assert.equal(only.runtime,verifyPools[0]);
  const none=allocator.allocate('review.verify',{avoid:verifyPools});
  assert.equal(none.ok,false);
  assert.equal(none.role,'verify');
  assert.match(none.reason,/avoided/);
  assert.deepEqual(none.blocked.filter(item=>verifyPools.includes(item.runtime)).map(item=>item.reason),verifyPools.map(()=>'avoided'));
  const solo=id=>createAllocator({runtimes:{...fixture({only:{target:'only',roles:['implement','verify'],maxParallel:2}}),allocation:{...fixture({}).allocation,verifyAvoidsImplementRuntime:id}},now:()=>0});
  const strict=solo(true),relaxed=solo(false);
  assert.equal(strict.allocate('x.implement').runtime,'only');
  const refused=strict.allocateVerify('x.verify',{implementRuntime:'only'});
  assert.equal(refused.ok,false);
  assert.deepEqual(refused.blocked,[{runtime:'only',reason:'avoided'}]);
  assert.equal(relaxed.allocateVerify('x.verify',{implementRuntime:'only'}).runtime,'only');
});

test('allocator state survives a JSON round trip so the kernel can keep it in state.json',()=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const source=createAllocator({runtimes:profile,now:time.now});
  const implement=source.allocate('backend.implement');
  source.allocate('content.generate');
  source.release(implement.runtime,{tokens:125000});
  const failure=source.failed('codex-agent',{reason:'429 slow down'});
  const saved=JSON.parse(JSON.stringify(source.serialize()));
  assert.equal(saved.schema,ALLOCATION);
  assert.equal(saved.day,'2026-09-12');
  assert.equal(saved.cooling['codex-agent'].until,failure.until);
  const restored=createAllocator({runtimes:profile,now:time.now,state:saved});
  assert.deepEqual(restored.snapshot(),source.snapshot());
  assert.deepEqual(restored.serialize(),source.serialize());
  const blocked=restored.allocate('backend.implement',{avoid:[]}).blocked.find(item=>item.runtime==='codex-agent');
  assert.match(blocked.reason,/cooling after rate-limited/);
  // Hostile or stale saved state is ignored, not trusted: pools always come from the profile.
  const hardened=createAllocator({runtimes:profile,now:time.now,state:{loads:{ghost:3,'claude-agent':'many'},cooling:{'claude-agent':{kind:'made-up'}},day:7}});
  assert.equal(hardened.snapshot().runtimes['claude-agent'].load,0);
  assert.deepEqual(hardened.snapshot().cooling,[]);
  assert.equal(hardened.snapshot().day,'2026-09-12');
});

test('a failure reason is classified into exactly one cooldown class',()=>{
  const cases={
    'HTTP 429 Too Many Requests':'rate-limited','rate limit exceeded':'rate-limited','rate_limit_error':'rate-limited',
    'Overloaded, try again':'rate-limited','at capacity right now':'rate-limited',
    'insufficient_quota':'quota','monthly quota used up':'quota','billing not configured':'quota','budget exceeded for this key':'quota',
    '401 Unauthorized':'auth','403 forbidden':'auth','please login again':'auth',
    'terminal never rendered a prompt':'other','':'other'
  };
  for(const [reason,kind] of Object.entries(cases))assert.equal(classifyFailure(reason),kind,reason);
  assert.equal(classifyFailure(Error('Request failed with 429')),'rate-limited');
  assert.equal(classifyFailure({reason:'quota'}),'quota');
  assert.equal(classifyFailure(null),'other');
  assert.equal(classifyFailure(undefined),'other');
  assert.deepEqual(Object.keys(DEFAULT_COOLDOWN_MS),['rate-limited','quota','auth','other']);
  assert.deepEqual(profile.allocation.cooldownMs,DEFAULT_COOLDOWN_MS);
});

test('the launch shape still comes from the operation chain and an unlisted target is named as such',()=>{
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9)});
  const targets=allocator.launchableTargets('review.verify');
  assert.ok(targets.includes('qwen-agent'));
  const candidate=allocator.candidateFor('review.verify','qwen-agent');
  assert.equal(candidate.target,'qwen-agent');
  assert.equal(candidate.role,'reasoning');
  assert.ok(candidate.orcaLaunch.kind);
  const unlisted=profile.runtimes['claude-agent'].roles.includes('verify')&&!targets.includes('claude-agent');
  if(unlisted)assert.throws(()=>allocator.candidateFor('review.verify','claude-agent'),/not launchable for review\.verify/);
  assert.throws(()=>allocator.candidateFor('review.verify','no-such-runtime'),/environments offer/);
  // restrictTo keeps allocation inside the launchable set of that operation.
  const picked=allocator.allocate('review.verify',{restrictTo:targets});
  assert.ok(targets.includes(picked.runtime));
  assert.deepEqual(allocator.allocate('review.verify',{restrictTo:[]}).ok,false);
});

test('difficulty routes inside the quota: hard work to the strongest tier, easy work to the cheapest; a quota rewrites slots and order',()=>{
  
  const allocator=createAllocator({runtimes:profile,now:()=>0});
  assert.equal(allocator.allocate('backend.implement',{difficulty:'easy'}).runtime,'qwen-agent');
  assert.equal(allocator.allocate('backend.implement',{difficulty:'hard'}).runtime,'codex-agent');
  const quota=applyQuota(profile,{order:['claude-agent','qwen-agent','codex-agent'],slots:{'claude-agent':2,'qwen-agent':1,'codex-agent':1}});
  assert.equal(quota.runtimes['claude-agent'].maxParallel,2);
  assert.deepEqual(quota.allocation.preference.implement,['claude-agent','qwen-agent','codex-agent','devin-agent']);
  const quoted=createAllocator({runtimes:profile,quota:{order:['claude-agent','qwen-agent','codex-agent'],slots:{'claude-agent':2,'qwen-agent':1,'codex-agent':1}},now:()=>0});
  assert.deepEqual([1,2,3,4].map(()=>quoted.allocate('backend.implement').runtime),['claude-agent','claude-agent','qwen-agent','codex-agent']);
});

test('a tagged quota fills a difficulty tier by ratio (4:1) and sends easy work to the cheap runtime',()=>{
  const quota={order:['codex-agent','claude-agent','qwen-agent'],slots:{'codex-agent':4,'claude-agent':1,'qwen-agent':2},tags:{'codex-agent':['hard','medium'],'claude-agent':['hard','medium'],'qwen-agent':['easy','medium']}};
  const allocator=createAllocator({runtimes:profile,quota,now:()=>0});
  const hard=[1,2,3,4,5].map(()=>allocator.allocate('backend.implement',{difficulty:'hard'}).runtime);
  assert.deepEqual(tally(hard),{'codex-agent':4,'claude-agent':1});
  assert.equal(allocator.allocate('backend.implement',{difficulty:'easy'}).runtime,'qwen-agent');
  assert.equal(allocator.allocate('backend.implement',{difficulty:'hard'}).ok,false);
});

test('a runtime another kernel is already on is not the first choice: the next capable runtime of the chain takes the operation',t=>{
  const shared=sharedRoot(t),other='20260912-100000-other',mine='20260912-104251-mine';
  shared.kernel(other);
  shared.write({'claude-fable':liveOn(other,'op-decide')});
  assert.equal(loadsFileFor(path.join(shared.root,other)),shared.file);
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  // Left to itself this kernel would take fable first: the role's preference is [fable, codex, claude], and
  // every one of them carries the decide role now - the Codex and Claude pools are Fable's downgrade.
  assert.deepEqual(allocator.review('architecture.decide').localRanked,['claude-fable','codex-agent','claude-agent']);
  // Fable carries the other workflow's op, so the Codex pool - equally capable and free - takes this one.
  const decided=allocator.allocate('architecture.decide');
  assert.equal(decided.runtime,'codex-agent');
  assert.deepEqual(decided.preferredOver,['claude-fable']);
  assert.deepEqual(decided.sharedLoad,{'claude-fable':1});
  assert.deepEqual(allocator.sharedView().loads,{'claude-fable':1});
  // Nothing shared changes a role no other kernel touches, and an allocation the shared view did not move names
  // nothing it passed over.
  const implemented=allocator.allocate('backend.implement');
  assert.equal(implemented.runtime,'codex-agent');
  assert.deepEqual(implemented.preferredOver,[]);
  // maxParallel is the runtime's cap across the repository: the Codex pool has eight slots and another kernel
  // holds all of them.
  shared.write({'codex-agent':{live:Array.from({length:8},(_,index)=>({workflow:other,op:`op-other-${index}`,since:1})),cooling:null,usedToday:8,day:'2026-09-12'}});
  const full=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  const back=full.allocate('architecture.decide');
  assert.equal(back.runtime,'claude-fable');
  assert.deepEqual(back.blocked.find(item=>item.runtime==='codex-agent'),{runtime:'codex-agent',reason:'no free slot',sharedLoad:8});
});

test('a cooldown one kernel ran into parks the runtime for every kernel of the repository, and is learned once',t=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const shared=sharedRoot(t),other='20260912-100000-other',mine='20260912-104251-mine';
  shared.kernel(other);
  shared.write({'claude-fable':{live:[],cooling:{until:time.now()+600000,reason:'HTTP 429 Too Many Requests',kind:'rate-limited',workflow:other},usedToday:3,day:'2026-09-12'}});
  const allocator=createAllocator({runtimes:profile,now:time.now,shared:{path:shared.file,workflow:mine}});
  const decided=allocator.allocate('architecture.decide',{job:{opId:'op-decide'}});
  assert.equal(decided.runtime,'codex-agent');
  const parked=decided.blocked.find(item=>item.runtime==='claude-fable');
  assert.match(parked.reason,/cooling after a shared rate-limited until 2026-09-12T09:10:00\.000Z, seen by 20260912-100000-other/);
  assert.deepEqual([parked.shared,parked.from],[true,other]);
  // The kernel records a learned cooldown once: the notices are drained, not repeated every tick.
  assert.deepEqual(allocator.takeSharedNotices().map(item=>[item.runtime,item.until,item.from]),[['claude-fable',time.now()+600000,other]]);
  allocator.allocate('architecture.decide');
  assert.deepEqual(allocator.takeSharedNotices(),[]);
  // A provider limit this kernel runs into is published for the others; a local failure class is not.
  assert.equal(allocator.failed('codex-agent',{reason:'429 slow down',op:'op-decide'}).shared,true);
  assert.equal(shared.read().runtimes['codex-agent'].cooling.workflow,mine);
  allocator.allocate('review.verify');
  assert.equal(allocator.failed('claude-agent',{reason:'terminal never rendered a prompt'}).shared,false);
  assert.equal(shared.read().runtimes['claude-agent']?.cooling??null,null);
  // The ledger is read through, so the wait ends for this kernel exactly when it ends in the file.
  time.advance(600001);
  assert.equal(createAllocator({runtimes:profile,now:time.now,shared:{path:shared.file,workflow:mine}}).allocate('architecture.decide').runtime,'claude-fable');
});

test('entries of a dead kernel are ignored and dropped, and an unreadable ledger degrades to local allocation',t=>{
  const shared=sharedRoot(t),dead='20260912-090000-dead',gone='20260912-091000-gone',mine='20260912-104251-mine';
  // 2147483647 is no pid Windows or POSIX hands out: the kernel that wrote this entry is gone.
  shared.kernel(dead,2147483647);
  shared.kernel(gone,null);
  shared.write({'claude-fable':{live:[{workflow:dead,op:'op-dead',since:1},{workflow:gone,op:'op-gone',since:2}],cooling:null,usedToday:4,day:'2026-09-12'}});
  assert.deepEqual(readLoads({path:shared.file,workflow:mine,now:()=>Date.UTC(2026,8,12,9)}).loads,{});
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  assert.equal(allocator.allocate('architecture.decide',{job:{opId:'op-mine'}}).runtime,'claude-fable');
  // The next write drops them, so the file keeps no dead kernel's claim on an expensive runtime.
  allocator.launched('claude-fable',{op:'op-mine'});
  assert.deepEqual(shared.read().runtimes['claude-fable'].live.map(item=>[item.workflow,item.op]),[[mine,'op-mine']]);
  // An unreadable ledger is not a blocked launch: allocation is exactly the local one.
  fs.writeFileSync(shared.file,'{ this is not a ledger');
  const local=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  assert.equal(local.sharedView().ok,false);
  assert.equal(local.allocate('architecture.decide').runtime,'claude-fable');
  assert.deepEqual(local.allocate('backend.implement').preferredOver,[]);
});

test('the probed provider budget blocks an exhausted window until its reset and ranks clearly-more-headroom first, in bands, without touching the shared key',()=>{
  const at=Date.UTC(2026,8,13,9);
  const budgetAt=(claude,codex,{fable=claude}={})=>({schema:'starci/runtime-budget@1',at,providers:{
    claude:{status:'ok',windows:{session:{usedPercent:10,resetsAt:at+3_600_000,minutes:300},weekly:{usedPercent:claude,resetsAt:at+86_400_000,minutes:10080},fableWeekly:{usedPercent:fable,resetsAt:at+86_400_000,minutes:10080}}},
    codex:{status:'ok',windows:{weekly:{usedPercent:codex,resetsAt:at+86_400_000,minutes:10080}}}}});
  // Fable's own week is nearly gone while Codex has most of its week: the Codex pool takes the decide even
  // though the chain says fable first.
  const spare=createAllocator({runtimes:profile,now:()=>at,budget:budgetAt(40,20,{fable:70})});
  const review=spare.review('architecture.decide');
  // The downgrade pools are candidates too and rank by their own window: the Claude pool above Fable.
  assert.deepEqual(review.ready.map(item=>[item.runtime,item.remainingShare,item.band]),[['codex-agent',80,3],['claude-agent',60,2],['claude-fable',30,1]]);
  const decided=spare.allocate('architecture.decide');
  assert.equal(decided.runtime,'codex-agent');
  assert.deepEqual(decided.sparedOver,['claude-fable']);
  assert.deepEqual(decided.budget,{'codex-agent':80,'claude-agent':60,'claude-fable':30});
  // Inside one band the role's own order stands: a few points never reorder the chain.
  const close=createAllocator({runtimes:profile,now:()=>at,budget:budgetAt(40,45)});
  assert.equal(close.allocate('architecture.decide').runtime,'claude-fable');
  assert.deepEqual(close.allocate('architecture.decide').sparedOver,[]);
  // An exhausted window blocks the runtime until the reset; past it the window binds nothing.
  const gone=createAllocator({runtimes:profile,now:()=>at,budget:budgetAt(40,96)});
  const blocked=gone.allocate('architecture.decide');
  assert.equal(blocked.runtime,'claude-fable');
  assert.match(blocked.blocked.find(item=>item.runtime==='codex-agent').reason,/provider window exhausted until 2026-09-14T09:00:00/);
  assert.deepEqual(blocked.blocked.find(item=>item.runtime==='codex-agent').budget,{remaining:4,until:at+86_400_000});
  const later=createAllocator({runtimes:profile,now:()=>at+86_400_001,budget:budgetAt(40,96)});
  assert.equal(later.review('architecture.decide').blocked.some(item=>/exhausted/.test(item.reason)),false);
  // A runtime no window binds sits in the top band; an unreadable file is no budget at all.
  assert.equal(budgetBand(null),4);assert.equal(budgetBand(100),4);assert.equal(budgetBand(99),3);assert.equal(budgetBand(0),0);
  const blind=createAllocator({runtimes:profile,now:()=>at,budget:{path:path.join(os.tmpdir(),'no-such-starci-budget-dir')}});
  assert.equal(blind.review('architecture.decide').budget,null);
});

/**
 * Every tier has a downgrade under it. The top tier is still preferred whenever it has a free slot; only a full,
 * cooling or exhausted top tier moves the operation down - Fable to the Codex pool to the Claude pool - instead
 * of stalling it.
 */
test('a decide operation downgrades to the Codex and Claude pools when the reasoning window is out, and returns to Fable the moment a slot frees',()=>{
  const at=Date.UTC(2026,8,14,9);
  const allocator=createAllocator({runtimes:profile,now:()=>at});
  // A free Fable slot is chosen first, every time: the downgrade is an overflow, never a replacement.
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-fable');
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-fable');
  // Fable's two slots are full now, so the operation goes down one tier, to the Codex pool's reasoning model.
  for(let index=0;index<8;index+=1)assert.equal(allocator.allocate('decision.prepare').runtime,'codex-agent');
  const downgraded=allocator.allocate('decision.prepare');
  assert.equal(downgraded.runtime,'claude-agent');
  assert.equal(downgraded.overflowed,true);
  assert.deepEqual(downgraded.preference,['claude-fable','codex-agent','claude-agent']);
  // The Claude pool is full too: the last pool of the chain takes it rather than nobody, then the role is out.
  for(let index=0;index<5;index+=1)assert.equal(allocator.allocate('decision.prepare').runtime,'claude-agent');
  assert.equal(allocator.allocate('decision.prepare').ok,false);
  // A freed Fable slot takes the next one straight back from the downgrade.
  allocator.release('claude-fable');
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-fable');
});

test('a decide operation whose reasoning windows are exhausted downgrades on the probed budget alone, and a hard one is no longer outside the tier',()=>{
  const at=Date.UTC(2026,8,14,9);
  // Claude's week is spent, so Fable and the Claude pool are both out of window; the Codex window is still
  // readable here, which is exactly the case that used to leave a decide operation with nobody.
  const spent={schema:'starci/runtime-budget@1',at,providers:{
    claude:{status:'ok',windows:{weekly:{usedPercent:97,resetsAt:at+86_400_000,minutes:10080}}},
    codex:{status:'ok',windows:{weekly:{usedPercent:20,resetsAt:at+86_400_000,minutes:10080}}}}};
  const allocator=createAllocator({runtimes:profile,now:()=>at,budget:spent});
  const decided=allocator.allocate('decision.prepare');
  // The Codex pool first - its own window is fine - and both Claude pools are blocked by the window, not by a
  // cap of ours.
  assert.equal(decided.runtime,'codex-agent');
  assert.deepEqual(decided.blocked.filter(item=>item.budget).map(item=>item.runtime),['claude-agent','claude-fable']);
  const next=allocator.allocate('decision.prepare');
  assert.equal(next.runtime,'codex-agent','the Codex pool carries both its reasoning and its working model; Claude is out of window');
  // A hard decide operation reads the hard tier's own decide order, so it is never "outside the hard tier" again.
  const hard=createAllocator({runtimes:profile,now:()=>at});
  assert.deepEqual(hard.review('decision.prepare',{difficulty:'hard'}).preference,['claude-fable','codex-agent','claude-agent']);
  assert.equal(hard.review('decision.prepare',{difficulty:'hard'}).blocked.some(item=>/outside the hard tier/.test(item.reason)),false);
  assert.equal(hard.allocate('decision.prepare',{difficulty:'hard'}).runtime,'claude-fable');
  // The coding roles keep the order they always had inside that same tier.
  assert.deepEqual(hard.review('backend.implement',{difficulty:'hard'}).preference,['codex-agent','claude-agent','devin-agent']);
  assert.equal(hard.allocate('backend.implement',{difficulty:'easy'}).runtime,'qwen-agent');
});

test('two kernels write the one ledger under a lock and both their launches survive',t=>{
  const shared=sharedRoot(t),first='20260912-100000-first',second='20260912-104251-second';
  shared.kernel(first);shared.kernel(second);
  const open=workflow=>createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow}});
  const one=open(first),two=open(second);
  one.allocate('architecture.decide',{job:{opId:'op-first'}});one.launched('claude-fable',{op:'op-first'});
  two.allocate('architecture.decide',{job:{opId:'op-second'}});two.launched('claude-fable',{op:'op-second'});
  const entry=shared.read().runtimes['claude-fable'];
  assert.deepEqual(entry.live.map(item=>[item.workflow,item.op]),[[first,'op-first'],[second,'op-second']]);
  assert.equal(entry.usedToday,0,'admitted/live reservations are not reported as completed service');
  assert.equal(shared.read().schema,RUNTIME_LOADS);
  // Each writer released the lock, and each kernel counts only the other one's operation as shared load.
  assert.equal(fs.existsSync(`${shared.file}.lock`),false);
  assert.deepEqual(one.sharedView().loads,{'claude-fable':1});
  assert.deepEqual(two.sharedView().ops['claude-fable'].map(item=>item.op),['op-first']);
  // Both slots of fable are taken across the two kernels, so the next operation of either goes on to the Codex pool.
  assert.equal(open(second).allocate('architecture.decide').runtime,'codex-agent');
  one.release('claude-fable',{op:'op-first'});
  assert.deepEqual(shared.read().runtimes['claude-fable'].live.map(item=>item.op),['op-second']);
});

test('a sequential allocator hands out one operation at a time whatever the profile or the quota says',()=>{
  const allocator=createAllocator({runtimes:profile,now:()=>0,sequential:true,quota:{order:['codex-agent','claude-agent'],slots:{'codex-agent':5,'claude-agent':3}}});
  assert.equal(allocator.maxParallelOps,1);
  assert.equal(allocator.sequential,true);
  assert.ok(Object.values(allocator.snapshot().runtimes).every(pool=>pool.slots<=1),'no pool keeps more than one slot');
  const first=allocator.allocate('backend.implement');
  assert.equal(first.ok,true);
  const second=allocator.allocate('backend.implement');
  assert.equal(second.ok,false);
  assert.match(second.reason,/maxParallelOps 1 is already in flight/);
  allocator.release(first.runtime);
  assert.equal(allocator.allocate('review.verify',{avoid:[first.runtime]}).ok,true,'a freed slot takes the next operation');
  // The cap never opens a pool the quota closed, and the default allocator is not sequential.
  assert.deepEqual(sequentialRuntimes({maxParallelOps:10,runtimes:{a:{maxParallel:4},b:{maxParallel:0}}}),{maxParallelOps:1,runtimes:{a:{maxParallel:1},b:{maxParallel:0}}});
  assert.equal(createAllocator({runtimes:profile,now:()=>0}).sequential,false);
});

test('fan-out is bounded per cut group: the seam runs alone and one parent never takes every slot',()=>{
  // The shipped numbers: twenty slots in flight, nine of them at most for the children of one cut parent, so a
  // heavy node fans out wide and still leaves the rest of the tree a slot to run in.
  assert.deepEqual(profile.allocation.fanOut,{seamFirst:true,maxPerGroup:9});
  assert.equal(profile.maxParallelOps,20);
  assert.deepEqual(profile.allocation.preference.implement,['codex-agent','claude-agent','qwen-agent','devin-agent']);
  const allocator=createAllocator({runtimes:profile,now:()=>0});
  assert.deepEqual(allocator.fanOut,{seamFirst:true,maxPerGroup:9});
  assert.equal(allocator.maxParallelOps,20);
  // A profile that declares no policy still bounds a group: one slot is kept for everything that is not it.
  const bare={...profile,allocation:{...profile.allocation,fanOut:undefined}};
  assert.deepEqual(createAllocator({runtimes:bare,now:()=>0}).fanOut,{seamFirst:true,maxPerGroup:19});
  // A profile that turns the seam rule off says so, and it is read rather than assumed.
  const loose={...profile,allocation:{...profile.allocation,fanOut:{seamFirst:false,maxPerGroup:3}}};
  assert.deepEqual(createAllocator({runtimes:loose,now:()=>0}).fanOut,{seamFirst:false,maxPerGroup:3});
  // The cut's planning kind allocates on the plan role, like every other record-authoring operation.
  assert.equal(allocator.roleFor('implementation.plan'),'plan');
  assert.equal(profile.roleOfKind['implementation.plan'],'plan');
});

test('model eligibility is filtered before provider budget ranking and returns its receipt',()=>{
  const decisions=[];const allocator=createAllocator({runtimes:profile,now:()=>0,eligibility:(job,runtime)=>{decisions.push([job.kind,runtime.id]);return runtime.id==='codex-agent'?{eligible:false,reasons:['quality floor high is not met']}:{eligible:true,mode:'qualified',reasons:[]};}});
  const review=allocator.review('backend.implement',{job:{kind:'backend.implement',role:'implement',qualityFloor:'high'}});
  assert.equal(review.ready.some(item=>item.runtime==='codex-agent'),false);assert.match(review.blocked.find(item=>item.runtime==='codex-agent').reason,/model ineligible/);
  const picked=allocator.allocate('backend.implement',{job:{kind:'backend.implement',role:'implement',qualityFloor:'high'}});
  assert.equal(picked.ok,true);assert.notEqual(picked.runtime,'codex-agent');assert.equal(picked.eligibility.mode,'qualified');assert.ok(decisions.length>=Object.keys(profile.runtimes).length);
});

test('adaptive policy keeps tiers as suitability sets and records one bounded owner preference instead of a chain',()=>{
  const adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:'codex',source:'allocation'});
  assert.equal(adaptive.allocation.policy,ADAPTIVE_CAPACITY);
  assert.deepEqual(adaptive.allocation.ownerPolicy,{mode:'adaptive',preferredProvider:'codex',preferenceMultiplier:1.25,source:'allocation'});
  assert.deepEqual(adaptive.allocation.preference,profile.allocation.preference,'runtime/model order remains the within-family suitability order');
  assert.deepEqual(adaptive.allocation.tiers,profile.allocation.tiers,'difficulty eligibility is unchanged');
  assert.equal(profile.allocation.policy,PREFER_THEN_OVERFLOW,'the authored compatibility profile is not mutated');
});

test('adaptive allocation follows asymmetric fresh headroom, reverses with quota, and preference is a bounded bias',()=>{
  const at=Date.UTC(2026,8,15,9),time=clock(at),adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:'codex'});
  const reset=at+7*86_400_000,budget=(codex,claude)=>()=>({schema:'starci/runtime-budget@1',at:time.now(),providers:{
    codex:{status:'ok',windows:{weekly:{usedPercent:codex,resetsAt:reset,minutes:10080}}},
    claude:{status:'ok',windows:{weekly:{usedPercent:claude,resetsAt:reset,minutes:10080}}}}});
  const simulate=(codex,claude)=>{const allocator=createAllocator({runtimes:adaptive,now:time.now,budget:budget(codex,claude)}),chosen=[];
    for(let index=0;index<30;index+=1){const pick=allocator.allocate('backend.implement',{restrictTo:['codex-agent','claude-agent'],job:{opId:`op-${index}`}});assert.equal(pick.ok,true,pick.reason);chosen.push(profile.runtimes[pick.runtime].provider);allocator.launched(pick.runtime,{op:`op-${index}`});time.advance(10*60_000);allocator.release(pick.runtime,{op:`op-${index}`});}
    return tally(chosen);};
  const codexRich=simulate(20,80);assert.ok(codexRich.codex>codexRich.claude,JSON.stringify(codexRich));
  const claudeRich=simulate(85,20);assert.ok(claudeRich.claude>claudeRich.codex,JSON.stringify(claudeRich));
  const equal=simulate(40,40);assert.ok(equal.codex>equal.claude&&equal.claude>0,'preference wins close choices without starving healthy Claude');
});

test('adaptive families count shared quota once, reject stale or unknown quota, and preserve reservation settlement semantics',t=>{
  const at=Date.UTC(2026,8,15,9),time=clock(at),shared=sharedRoot(t),mine='mine',other='other';shared.kernel(mine);shared.kernel(other);
  const adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:'codex'});
  const budget=()=>({schema:'starci/runtime-budget@1',at:time.now(),providers:{
    codex:{status:'ok',windows:{weekly:{usedPercent:30,resetsAt:time.now()+86_400_000,minutes:10080}}},
    claude:{status:'ok',windows:{weekly:{usedPercent:30,resetsAt:time.now()+86_400_000,minutes:10080},fableWeekly:{usedPercent:30,resetsAt:time.now()+86_400_000,minutes:10080}}},
    qwen:{status:'ok',windows:{weekly:{usedPercent:30,resetsAt:time.now()+86_400_000,minutes:10080}}}}});
  const allocator=createAllocator({runtimes:adaptive,now:time.now,budget,shared:{path:shared.file,workflow:mine}});
  const review=allocator.review('review.verify');
  const claude=review.adaptive.families.find(item=>item.provider==='claude');
  assert.ok(claude.candidates.includes('claude-fable')&&claude.candidates.includes('claude-agent'));
  assert.equal(review.adaptive.families.filter(item=>item.provider==='claude').length,1,'two Claude models do not duplicate family headroom');
  const first=allocator.allocate('backend.implement',{job:{opId:'no-effect'}});allocator.deferred(first.runtime,{op:'no-effect'});
  assert.equal((allocator.serialize().history[first.runtime]??[]).length,0,'pre-admission deferral refunds the reservation without completed service');
  const worked=allocator.allocate('backend.implement',{job:{opId:'worked'}});allocator.launched(worked.runtime,{op:'worked'});time.advance(20*60_000);const failed=allocator.failed(worked.runtime,{op:'worked',reason:'rate limit after the model produced work'});
  assert.equal(failed.observedService,true);assert.equal((allocator.serialize().history[worked.runtime]??[]).length,1,'work that ran before failure still consumed virtual service');
  const unknown=allocator.allocate('backend.implement',{job:{opId:'unknown-effect'}});allocator.launched(unknown.runtime,{op:'unknown-effect'});
  assert.equal(allocator.serialize().reservations[unknown.runtime].some(item=>item.op==='unknown-effect'),true,'unknown effects retain their reservation until settlement');
  const stale={...budget(),at:at-10*60_000};const blocked=createAllocator({runtimes:adaptive,now:time.now,budget:stale}).allocate('backend.implement');
  assert.equal(blocked.ok,false);assert.ok(blocked.blocked.filter(item=>['codex-agent','claude-agent','qwen-agent'].includes(item.runtime)).every(item=>/unknown or stale/.test(item.reason)));
});

test('an exact operation settlement is idempotent and never consumes its same-runtime neighbour',()=>{
  const at=Date.UTC(2026,8,15,9),time=clock(at),adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:'codex'}),reset=at+86_400_000;
  const budget=()=>({schema:'starci/runtime-budget@1',at:time.now(),providers:{codex:{status:'ok',windows:{weekly:{usedPercent:20,resetsAt:reset,minutes:10080}}}}});
  const allocator=createAllocator({runtimes:adaptive,now:time.now,budget});
  const one=allocator.allocate('backend.implement',{restrictTo:['codex-agent'],job:{opId:'one'}}),
    two=allocator.allocate('backend.implement',{restrictTo:['codex-agent'],job:{opId:'two'}});
  assert.equal(one.runtime,'codex-agent');assert.equal(two.runtime,'codex-agent');
  allocator.launched(one.runtime,{op:'one'});allocator.launched(two.runtime,{op:'two'});time.advance(10*60_000);
  allocator.release(one.runtime,{op:'one',tokens:7});
  const settled=structuredClone(allocator.serialize());
  assert.equal(settled.loads['codex-agent'],1);assert.equal(settled.usedToday['codex-agent'],2);assert.equal(settled.tokensToday['codex-agent'],7);
  assert.deepEqual(settled.reservations['codex-agent'].map(item=>item.op),['two']);assert.equal(settled.history['codex-agent'].length,1);
  assert.equal(allocator.release(one.runtime,{op:'one',tokens:11}).duplicate,true);
  assert.equal(allocator.deferred(one.runtime,{op:'one'}).duplicate,true);
  assert.equal(allocator.failed(one.runtime,{op:'one',reason:'429 after prior settlement',tokens:13}).duplicate,true);
  assert.deepEqual(allocator.serialize(),settled,'replayed settlements change no load, quota counter, tokens, history, cooldown or neighbour reservation');
  allocator.release(two.runtime,{op:'two'});assert.equal(allocator.serialize().loads['codex-agent'],0);
});

test('adaptive selection receipts distinguish quota unknown, exhausted, cooling and authoritative capacity exclusions',()=>{
  const at=Date.UTC(2026,8,15,9),adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:null}),reset=at+86_400_000;
  const partial={schema:'starci/runtime-budget@1',at,providers:{
    claude:{status:'ok',windows:{weekly:{usedPercent:96,resetsAt:reset,minutes:10080}}},
    qwen:{status:'ok',windows:{weekly:{usedPercent:20,resetsAt:reset,minutes:10080}}}}};
  const allocator=createAllocator({runtimes:adaptive,now:()=>at,budget:partial,state:{cooling:{'qwen-agent':{kind:'rate-limited',until:at+600_000,reason:'429'}}}});
  const refused=allocator.allocate('backend.implement',{restrictTo:['codex-agent','claude-agent','qwen-agent'],job:{opId:'receipt-refused'}});
  assert.equal(refused.ok,false);
  assert.match(refused.blocked.find(item=>item.runtime==='codex-agent').reason,/unknown or stale/);
  assert.deepEqual(refused.blocked.find(item=>item.runtime==='claude-agent').budget,{remaining:4,until:reset});
  assert.match(refused.blocked.find(item=>item.runtime==='qwen-agent').reason,/cooling after rate-limited/);

  const known={schema:'starci/runtime-budget@1',at,providers:{codex:{status:'ok',windows:{weekly:{usedPercent:20,resetsAt:reset,minutes:10080}}}}};
  const capacity=createAllocator({runtimes:adaptive,now:()=>at,budget:known,providerAdmission:()=>({source:'sqlite-admission',providers:{codex:{used:5,capacity:5,jobs:[]}}})});
  const full=capacity.allocate('backend.implement',{restrictTo:['codex-agent'],job:{opId:'receipt-capacity'}});
  assert.equal(full.ok,false);const excluded=full.blocked.find(item=>item.runtime==='codex-agent');
  assert.match(excluded.reason,/authoritative admission/);assert.deepEqual(excluded.admission,{used:5,capacity:5});
});

test('cross-workflow adaptive selection compare-and-reserves projected service before native launch',t=>{
  const at=Date.UTC(2026,8,15,9),shared=sharedRoot(t),one='one',two='two';shared.kernel(one);shared.kernel(two);
  const adaptive=withProviderPreference(profile,{mode:'adaptive',preferredProvider:null}),budget={schema:'starci/runtime-budget@1',at,providers:{
    codex:{status:'ok',windows:{weekly:{usedPercent:40,resetsAt:at+86_400_000,minutes:10080}}},
    claude:{status:'ok',windows:{weekly:{usedPercent:40,resetsAt:at+86_400_000,minutes:10080}}}}};
  const first=createAllocator({runtimes:adaptive,now:()=>at,budget,shared:{path:shared.file,workflow:one}});
  const second=createAllocator({runtimes:adaptive,now:()=>at,budget,shared:{path:shared.file,workflow:two}});
  const a=first.allocate('backend.implement',{restrictTo:['codex-agent','claude-agent'],job:{opId:'a'}});
  const b=second.allocate('backend.implement',{restrictTo:['codex-agent','claude-agent'],job:{opId:'b'}});
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  assert.notEqual(profile.runtimes[a.runtime].provider,profile.runtimes[b.runtime].provider,'the second selector sees the first projected reservation, not identical stale headroom');
  const live=shared.read().runtimes;assert.equal(Object.values(live).flatMap(entry=>entry.live??[]).filter(item=>item.phase==='reserved').length,2);
});

test('the granted slots are the target share: the deficit pick fills the starved weight before the owner order',()=>{
  // beta is first in the owner order, so preference alone would open with beta. alpha holds 4 shares against
  // beta's 1: the largest targetShare - inFlight deficit is alpha's until the weights are filled.
  const runtimes={maxParallelOps:10,allocation:{policy:PREFER_THEN_OVERFLOW},roleOfKind:{'x.implement':'implement'},
    runtimes:{alpha:{target:'alpha',roles:['implement'],maxParallel:8},beta:{target:'beta',roles:['implement'],maxParallel:8}}};
  const quota=parseQuota('beta=1,alpha=4');
  assert.deepEqual(quota.targets,{beta:1,alpha:4},'parseQuota carries the granted slots as target shares');
  const hand={order:['beta','alpha'],slots:{beta:1,alpha:4}};
  const applied=applyQuota(runtimes,hand);
  assert.deepEqual(hand.targets,{beta:1,alpha:4},'applyQuota records quota.targets[runtime] = slots');
  assert.deepEqual(applied.allocation.targets,{beta:1,alpha:4},'and mirrors the weights into the applied profile');
  const allocator=createAllocator({runtimes,quota,now:()=>0});
  const first=allocator.allocate('x.implement');
  assert.equal(first.runtime,'alpha');
  assert.equal(first.targetShare,4);assert.equal(first.effectiveShare,4);assert.equal(first.deficit,4);
  assert.deepEqual(allocator.review('x.implement').targets,{beta:1,alpha:4});
  const picked=[1,2,3].map(()=>allocator.allocate('x.implement').runtime);
  assert.deepEqual(picked,['alpha','alpha','beta'],'at a 1:1 tie of remaining deficit the owner order decides');
  assert.equal(allocator.allocate('x.implement').runtime,'alpha');
});

test('a downweighted runtime frees its share proportionally to the remaining targets, never wholly to the largest deficit',()=>{
  const at=Date.UTC(2026,8,16,9);
  const runtimes={maxParallelOps:10,allocation:{policy:LEAST_LOADED},roleOfKind:{'x.implement':'implement'},runtimes:{
    fat:{target:'fat',provider:'fatprov',roles:['implement'],maxParallel:8},
    mid:{target:'mid',provider:'midprov',roles:['implement'],maxParallel:8},
    thin:{target:'thin',provider:'thinprov',roles:['implement'],maxParallel:8}}};
  // fat's probed week is half spent: capacityFactor 0.5 frees 3 of its 6-share. mid and thin are unread windows,
  // trusted at full factor, and split the freed share 3:1 - the rebalance never dumps it all on mid.
  const budget={schema:'starci/runtime-budget@1',at,providers:{fatprov:{status:'ok',windows:{weekly:{usedPercent:50,resetsAt:at+86_400_000,minutes:10080}}}}};
  const allocator=createAllocator({runtimes,quota:parseQuota('fat=6,mid=3,thin=1'),now:()=>at,budget});
  const share=(list,id)=>list.find(item=>item.runtime===id);
  const reviewed=allocator.review('x.implement');
  assert.equal(share(reviewed.ready,'fat').capacityFactor,0.5);
  assert.equal(share(reviewed.ready,'fat').effectiveShare,3);
  assert.equal(share(reviewed.ready,'mid').effectiveShare,5.25);
  assert.equal(share(reviewed.ready,'thin').effectiveShare,1.75);
  const picked=[1,2,3].map(()=>allocator.allocate('x.implement').runtime);
  assert.deepEqual(picked,['mid','mid','mid']);
  // mid's granted slots (3) are full now, so the freed share re-deals over the remaining receivers: thin alone
  // absorbs fat's 3 and outranks it for one op, then fat drains alone at its halved share.
  const filled=allocator.review('x.implement');
  assert.equal(share(filled.ready,'thin').effectiveShare,4);
  assert.equal(allocator.allocate('x.implement').runtime,'thin');
  assert.deepEqual([1,2,3].map(()=>allocator.allocate('x.implement').runtime),['fat','fat','fat']);
});

test('a launch accepted then silent is a stalled soft-fail: it parks like other, dents launch success, then releases',()=>{
  const time=clock(Date.UTC(2026,8,16,9));
  const runtimes=fixture({
    devin:{target:'devin',provider:'devin',roles:['implement'],maxParallel:0,capacityAuthority:'explicit-workflow-quota',quotaTelemetry:'launch-status'},
    sol:{target:'sol',provider:'codex',roles:['implement'],maxParallel:2}});
  assert.equal(classifyFailure('accepted but no progress within the readiness timeout'),'stalled');
  assert.equal(classifyFailure('stalled'),'stalled');
  const allocator=createAllocator({runtimes,quota:parseQuota('devin=2,sol=1'),now:time.now});
  const first=allocator.allocate('x.implement',{job:{opId:'op-1'}});
  assert.equal(first.runtime,'devin');
  assert.equal(first.capacityFactor,1,'no launch observed yet: full factor');
  allocator.launched('devin',{op:'op-1'});
  const parked=allocator.failed('devin',{reason:'stalled: accepted but no progress within the readiness timeout',op:'op-1'});
  assert.equal(parked.kind,'stalled');
  assert.equal(parked.cooldownMs,DEFAULT_COOLDOWN_MS.other,'a stalled soft-fail cools down like other');
  assert.equal(parked.shared,false,'a stalled launch is this kernel\'s observation, never a provider limit');
  const next=allocator.allocate('x.implement');
  assert.equal(next.runtime,'sol');
  assert.match(next.blocked.find(item=>item.runtime==='devin').reason,/cooling after stalled until 2026-09-16T09:05:00\.000Z/);
  time.advance(300001);
  const reviewed=allocator.review('x.implement');
  assert.equal(reviewed.ready.find(item=>item.runtime==='devin').capacityFactor,0.5,'one failed launch of one observation');
  // devin's effective share is 2 x 0.5 = 1 against sol's 1 - 1 in flight: the starved share wins the next op.
  const back=allocator.allocate('x.implement');
  assert.equal(back.runtime,'devin');
  assert.equal(back.effectiveShare,1);
});

test('a pool may pin a model per role: allocate exposes it and the role gate stays exact',()=>{
  const runtimes={maxParallelOps:10,allocation:{policy:LEAST_LOADED},
    roleOfKind:{'x.implement':'implement','x.verify':'verify','x.write':'write'},runtimes:{
      multi:{target:'multi',roles:['implement','verify'],maxParallel:2,models:{implement:'swe-2-max',verify:'claude-fable-5-1'}},
      plain:{target:'plain',roles:['implement','verify','write'],maxParallel:2},
      writer:{target:'writer',roles:['write'],maxParallel:1,models:{default:'writer-9'}}}};
  const seen=[];const allocator=createAllocator({runtimes,now:()=>0,eligibility:(job,runtime)=>{seen.push([job.kind,runtime.model]);return {eligible:true,reasons:[]};}});
  const implement=allocator.allocate('x.implement');
  assert.equal(implement.runtime,'multi');
  assert.equal(implement.model,'swe-2-max','the implement role resolves its pinned model');
  assert.equal(allocator.review('x.verify').ready.find(item=>item.runtime==='multi').model,'claude-fable-5-1');
  const write=allocator.allocate('x.write');
  assert.equal(write.runtime,'plain');
  assert.equal(write.model,'plain','a pool without a models map falls back to its own name');
  assert.equal(allocator.review('x.write').ready.find(item=>item.runtime==='writer').model,'writer-9','models.default covers every role of the pool');
  assert.equal(write.blocked.find(item=>item.runtime==='multi').reason,'no write role','a models map never widens the role gate');
  assert.ok(seen.some(([kind,model])=>kind==='x.implement'&&model==='swe-2-max'),'eligibility sees the resolved model');
});
