import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {ALLOCATION,withProviderPreference,DEFAULT_COOLDOWN_MS,LEAST_LOADED,PREFER_THEN_OVERFLOW,applyQuota,budgetBand,classifyFailure,createAllocator,sequentialRuntimes} from '../kernel/schedule.mjs';
import {RUNTIME_LOADS,loadsFile,loadsFileFor,readLoads} from '../kernel/loads.mjs';

const profile=parseYaml(fs.readFileSync(new URL('../model/runtimes.yaml',import.meta.url),'utf8'));
const clock=start=>{const box={at:start};return {now:()=>box.at,advance:ms=>{box.at+=ms;}};};
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
  assert.equal(allocator.maxParallelOps,10);
  assert.equal(allocator.policy,PREFER_THEN_OVERFLOW);
  assert.equal(profile.allocation.policy,PREFER_THEN_OVERFLOW);
  assert.deepEqual(profile.allocation.preference.implement,['gpt-5.6-sol','claude-opus','qwen3.8-flash']);
  assert.equal(profile.runtimes['gpt-5.6-sol'].maxParallel,5);
  const picked=[];
  for(let index=0;index<6;index+=1){
    const result=allocator.allocate('backend.implement');
    assert.equal(result.ok,true,result.reason);
    assert.equal(result.role,'implement');
    assert.equal(result.target,profile.runtimes[result.runtime].target);
    assert.equal(result.policy,PREFER_THEN_OVERFLOW);
    picked.push(result.runtime);
  }
  // Five slots of the preferred runtime first, and only the sixth operation overflows to the next one.
  assert.deepEqual(picked,['gpt-5.6-sol','gpt-5.6-sol','gpt-5.6-sol','gpt-5.6-sol','gpt-5.6-sol','claude-opus']);
  assert.deepEqual(tally(picked),{'gpt-5.6-sol':5,'claude-opus':1});
  // A freed preferred slot takes the next operation straight back from the overflow runtime.
  allocator.release('gpt-5.6-sol');
  assert.equal(allocator.allocate('backend.implement').runtime,'gpt-5.6-sol');
  const snapshot=allocator.snapshot();
  assert.equal(snapshot.policy,PREFER_THEN_OVERFLOW);
  assert.deepEqual(snapshot.preference.verify,['gpt-5.6-sol','claude-fable-5.1','gpt-6-astra','claude-opus','qwen3.8-flash']);
  assert.equal(snapshot.inFlight,6);
  // No pool declares a daily budget any more - the probed provider window is the only one - so nothing is left to count.
  assert.equal(profile.runtimes['claude-opus'].budget,undefined);
  assert.equal(snapshot.runtimes['claude-opus'].remaining.ops,null);
  assert.equal(snapshot.runtimes['qwen3.8-flash'].remaining.tokens,null);
  assert.deepEqual(snapshot.cooling,[]);
  for(let index=0;index<4;index+=1)assert.equal(allocator.allocate('backend.implement').ok,true);
  assert.equal(allocator.snapshot().inFlight,10);
  const eleventh=allocator.allocate('backend.implement');
  assert.equal(eleventh.ok,false);
  assert.match(eleventh.reason,/maxParallelOps 10 is already in flight/);
});

test('a rate-limited preference overflows to the next runtime and is taken up again after the cooldown',()=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const allocator=createAllocator({runtimes:profile,now:time.now});
  const first=allocator.allocate('backend.implement');
  assert.equal(first.runtime,'gpt-5.6-sol');
  assert.equal(first.overflowed,false);
  allocator.failed('gpt-5.6-sol',{reason:'HTTP 429 Too Many Requests'});
  const overflow=[];
  for(let index=0;index<4;index+=1)overflow.push(allocator.allocate('backend.implement').runtime);
  // Opus has three slots, so the fourth operation overflows once more, to Qwen.
  assert.deepEqual(overflow,['claude-opus','claude-opus','claude-opus','qwen3.8-flash']);
  const cooling=allocator.allocate('backend.implement');
  assert.equal(cooling.runtime,'qwen3.8-flash');
  assert.equal(cooling.overflowed,true);
  assert.match(cooling.blocked.find(item=>item.runtime==='gpt-5.6-sol').reason,/cooling after rate-limited/);
  time.advance(600001);
  assert.equal(allocator.allocate('backend.implement').runtime,'gpt-5.6-sol');
  // The preference order is the allocation order; a role with no list falls back to least loaded.
  const fresh=createAllocator({runtimes:profile,now:time.now});
  assert.deepEqual(fresh.review('backend.implement').ready.map(item=>item.runtime),['gpt-5.6-sol','claude-opus','qwen3.8-flash']);
  const unranked=createAllocator({runtimes:{...profile,allocation:{...profile.allocation,preference:{verify:profile.allocation.preference.verify}}},now:time.now});
  assert.equal(unranked.review('backend.implement').preference,null);
  assert.deepEqual(unranked.review('backend.implement').ready.map(item=>item.runtime),['gpt-5.6-sol','claude-opus','qwen3.8-flash']);
  assert.equal(unranked.allocate('backend.implement').overflowed,false);
  assert.equal(unranked.allocate('review.verify').runtime,'gpt-5.6-sol');
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
  const failure=source.failed('gpt-5.6-sol',{reason:'429 slow down'});
  const saved=JSON.parse(JSON.stringify(source.serialize()));
  assert.equal(saved.schema,ALLOCATION);
  assert.equal(saved.day,'2026-09-12');
  assert.equal(saved.cooling['gpt-5.6-sol'].until,failure.until);
  const restored=createAllocator({runtimes:profile,now:time.now,state:saved});
  assert.deepEqual(restored.snapshot(),source.snapshot());
  assert.deepEqual(restored.serialize(),source.serialize());
  const blocked=restored.allocate('backend.implement',{avoid:[]}).blocked.find(item=>item.runtime==='gpt-5.6-sol');
  assert.match(blocked.reason,/cooling after rate-limited/);
  // Hostile or stale saved state is ignored, not trusted: pools always come from the profile.
  const hardened=createAllocator({runtimes:profile,now:time.now,state:{loads:{ghost:3,'claude-opus':'many'},cooling:{'claude-opus':{kind:'made-up'}},day:7}});
  assert.equal(hardened.snapshot().runtimes['claude-opus'].load,0);
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
  assert.ok(targets.includes('qwen3.8-flash'));
  const candidate=allocator.candidateFor('review.verify','qwen3.8-flash');
  assert.equal(candidate.target,'qwen3.8-flash');
  assert.equal(candidate.role,'reasoning');
  assert.ok(candidate.orcaLaunch.kind);
  const unlisted=profile.runtimes['claude-opus'].roles.includes('verify')&&!targets.includes('claude-opus');
  if(unlisted)assert.throws(()=>allocator.candidateFor('review.verify','claude-opus'),/not launchable for review\.verify/);
  assert.throws(()=>allocator.candidateFor('review.verify','no-such-runtime'),/environments offer/);
  // restrictTo keeps allocation inside the launchable set of that operation.
  const picked=allocator.allocate('review.verify',{restrictTo:targets});
  assert.ok(targets.includes(picked.runtime));
  assert.deepEqual(allocator.allocate('review.verify',{restrictTo:[]}).ok,false);
});

test('difficulty routes inside the quota: hard work to the strongest tier, easy work to the cheapest; a quota rewrites slots and order',()=>{
  
  const allocator=createAllocator({runtimes:profile,now:()=>0});
  assert.equal(allocator.allocate('backend.implement',{difficulty:'easy'}).runtime,'qwen3.8-flash');
  assert.equal(allocator.allocate('backend.implement',{difficulty:'hard'}).runtime,'gpt-5.6-sol');
  const quota=applyQuota(profile,{order:['claude-opus','qwen3.8-flash','gpt-5.6-sol'],slots:{'claude-opus':2,'qwen3.8-flash':1,'gpt-5.6-sol':1}});
  assert.equal(quota.runtimes['claude-opus'].maxParallel,2);
  assert.deepEqual(quota.allocation.preference.implement,['claude-opus','qwen3.8-flash','gpt-5.6-sol']);
  const quoted=createAllocator({runtimes:profile,quota:{order:['claude-opus','qwen3.8-flash','gpt-5.6-sol'],slots:{'claude-opus':2,'qwen3.8-flash':1,'gpt-5.6-sol':1}},now:()=>0});
  assert.deepEqual([1,2,3,4].map(()=>quoted.allocate('backend.implement').runtime),['claude-opus','claude-opus','qwen3.8-flash','gpt-5.6-sol']);
});

test('a tagged quota fills a difficulty tier by ratio (4:1) and sends easy work to the cheap runtime',()=>{
  const quota={order:['gpt-5.6-sol','claude-opus','qwen3.8-flash'],slots:{'gpt-5.6-sol':4,'claude-opus':1,'qwen3.8-flash':2},tags:{'gpt-5.6-sol':['hard','medium'],'claude-opus':['hard','medium'],'qwen3.8-flash':['easy','medium']}};
  const allocator=createAllocator({runtimes:profile,quota,now:()=>0});
  const hard=[1,2,3,4,5].map(()=>allocator.allocate('backend.implement',{difficulty:'hard'}).runtime);
  assert.deepEqual(tally(hard),{'gpt-5.6-sol':4,'claude-opus':1});
  assert.equal(allocator.allocate('backend.implement',{difficulty:'easy'}).runtime,'qwen3.8-flash');
  assert.equal(allocator.allocate('backend.implement',{difficulty:'hard'}).ok,false);
});

test('a runtime another kernel is already on is not the first choice: the next capable runtime of the chain takes the operation',t=>{
  const shared=sharedRoot(t),other='20260912-100000-other',mine='20260912-104251-mine';
  shared.kernel(other);
  shared.write({'claude-fable-5.1':liveOn(other,'op-decide')});
  assert.equal(loadsFileFor(path.join(shared.root,other)),shared.file);
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  // Left to itself this kernel would take fable first: the role's preference is [fable, astra, opus, sol], and
  // every one of them carries the decide role now - Opus is Fable's downgrade and Sol the last tier.
  assert.deepEqual(allocator.review('architecture.decide').localRanked,['claude-fable-5.1','gpt-6-astra','claude-opus','gpt-5.6-sol']);
  // Fable carries the other workflow's op, so astra - equally capable and free - takes this one.
  const decided=allocator.allocate('architecture.decide');
  assert.equal(decided.runtime,'gpt-6-astra');
  assert.deepEqual(decided.preferredOver,['claude-fable-5.1']);
  assert.deepEqual(decided.sharedLoad,{'claude-fable-5.1':1});
  assert.deepEqual(allocator.sharedView().loads,{'claude-fable-5.1':1});
  // Nothing shared changes a role no other kernel touches, and an allocation the shared view did not move names
  // nothing it passed over.
  const implemented=allocator.allocate('backend.implement');
  assert.equal(implemented.runtime,'gpt-5.6-sol');
  assert.deepEqual(implemented.preferredOver,[]);
  // maxParallel is the runtime's cap across the repository: astra has one slot and another kernel holds it.
  shared.write({'gpt-6-astra':liveOn(other,'op-other')});
  const full=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  const back=full.allocate('architecture.decide');
  assert.equal(back.runtime,'claude-fable-5.1');
  assert.deepEqual(back.blocked.find(item=>item.runtime==='gpt-6-astra'),{runtime:'gpt-6-astra',reason:'no free slot',sharedLoad:1});
});

test('a cooldown one kernel ran into parks the runtime for every kernel of the repository, and is learned once',t=>{
  const time=clock(Date.UTC(2026,8,12,9));
  const shared=sharedRoot(t),other='20260912-100000-other',mine='20260912-104251-mine';
  shared.kernel(other);
  shared.write({'claude-fable-5.1':{live:[],cooling:{until:time.now()+600000,reason:'HTTP 429 Too Many Requests',kind:'rate-limited',workflow:other},usedToday:3,day:'2026-09-12'}});
  const allocator=createAllocator({runtimes:profile,now:time.now,shared:{path:shared.file,workflow:mine}});
  const decided=allocator.allocate('architecture.decide');
  assert.equal(decided.runtime,'gpt-6-astra');
  const parked=decided.blocked.find(item=>item.runtime==='claude-fable-5.1');
  assert.match(parked.reason,/cooling after a shared rate-limited until 2026-09-12T09:10:00\.000Z, seen by 20260912-100000-other/);
  assert.deepEqual([parked.shared,parked.from],[true,other]);
  // The kernel records a learned cooldown once: the notices are drained, not repeated every tick.
  assert.deepEqual(allocator.takeSharedNotices().map(item=>[item.runtime,item.until,item.from]),[['claude-fable-5.1',time.now()+600000,other]]);
  allocator.allocate('architecture.decide');
  assert.deepEqual(allocator.takeSharedNotices(),[]);
  // A provider limit this kernel runs into is published for the others; a local failure class is not.
  assert.equal(allocator.failed('gpt-6-astra',{reason:'429 slow down',op:'op-decide'}).shared,true);
  assert.equal(shared.read().runtimes['gpt-6-astra'].cooling.workflow,mine);
  allocator.allocate('review.verify');
  assert.equal(allocator.failed('gpt-5.6-sol',{reason:'terminal never rendered a prompt'}).shared,false);
  assert.equal(shared.read().runtimes['gpt-5.6-sol']?.cooling??null,null);
  // The ledger is read through, so the wait ends for this kernel exactly when it ends in the file.
  time.advance(600001);
  assert.equal(createAllocator({runtimes:profile,now:time.now,shared:{path:shared.file,workflow:mine}}).allocate('architecture.decide').runtime,'claude-fable-5.1');
});

test('entries of a dead kernel are ignored and dropped, and an unreadable ledger degrades to local allocation',t=>{
  const shared=sharedRoot(t),dead='20260912-090000-dead',gone='20260912-091000-gone',mine='20260912-104251-mine';
  // 2147483647 is no pid Windows or POSIX hands out: the kernel that wrote this entry is gone.
  shared.kernel(dead,2147483647);
  shared.kernel(gone,null);
  shared.write({'claude-fable-5.1':{live:[{workflow:dead,op:'op-dead',since:1},{workflow:gone,op:'op-gone',since:2}],cooling:null,usedToday:4,day:'2026-09-12'}});
  assert.deepEqual(readLoads({path:shared.file,workflow:mine,now:()=>Date.UTC(2026,8,12,9)}).loads,{});
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  assert.equal(allocator.allocate('architecture.decide').runtime,'claude-fable-5.1');
  // The next write drops them, so the file keeps no dead kernel's claim on an expensive runtime.
  allocator.launched('claude-fable-5.1',{op:'op-mine'});
  assert.deepEqual(shared.read().runtimes['claude-fable-5.1'].live.map(item=>[item.workflow,item.op]),[[mine,'op-mine']]);
  // An unreadable ledger is not a blocked launch: allocation is exactly the local one.
  fs.writeFileSync(shared.file,'{ this is not a ledger');
  const local=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow:mine}});
  assert.equal(local.sharedView().ok,false);
  assert.equal(local.allocate('architecture.decide').runtime,'claude-fable-5.1');
  assert.deepEqual(local.allocate('backend.implement').preferredOver,[]);
});

test('the probed provider budget blocks an exhausted window until its reset and ranks clearly-more-headroom first, in bands, without touching the shared key',()=>{
  const at=Date.UTC(2026,8,13,9);
  const budgetAt=(claude,codex,{fable=claude}={})=>({schema:'starci/runtime-budget@1',at,providers:{
    claude:{status:'ok',windows:{session:{usedPercent:10,resetsAt:at+3_600_000,minutes:300},weekly:{usedPercent:claude,resetsAt:at+86_400_000,minutes:10080},fableWeekly:{usedPercent:fable,resetsAt:at+86_400_000,minutes:10080}}},
    codex:{status:'ok',windows:{weekly:{usedPercent:codex,resetsAt:at+86_400_000,minutes:10080}}}}});
  // Fable's own week is nearly gone while Codex has most of its week: astra takes the decide even though the chain says fable first.
  const spare=createAllocator({runtimes:profile,now:()=>at,budget:budgetAt(40,20,{fable:70})});
  const review=spare.review('architecture.decide');
  // The downgrade runtimes are candidates too and rank by their own window: Sol beside Astra, Opus above Fable.
  assert.deepEqual(review.ready.map(item=>[item.runtime,item.remainingShare,item.band]),[['gpt-6-astra',80,3],['gpt-5.6-sol',80,3],['claude-opus',60,2],['claude-fable-5.1',30,1]]);
  const decided=spare.allocate('architecture.decide');
  assert.equal(decided.runtime,'gpt-6-astra');
  assert.deepEqual(decided.sparedOver,['claude-fable-5.1']);
  assert.deepEqual(decided.budget,{'gpt-6-astra':80,'gpt-5.6-sol':80,'claude-opus':60,'claude-fable-5.1':30});
  // Inside one band the role's own order stands: a few points never reorder the chain.
  const close=createAllocator({runtimes:profile,now:()=>at,budget:budgetAt(40,45)});
  assert.equal(close.allocate('architecture.decide').runtime,'claude-fable-5.1');
  assert.deepEqual(close.allocate('architecture.decide').sparedOver,[]);
  // An exhausted window blocks the runtime until the reset; past it the window binds nothing.
  const gone=createAllocator({runtimes:profile,now:()=>at,budget:budgetAt(40,96)});
  const blocked=gone.allocate('architecture.decide');
  assert.equal(blocked.runtime,'claude-fable-5.1');
  assert.match(blocked.blocked.find(item=>item.runtime==='gpt-6-astra').reason,/provider window exhausted until 2026-09-14T09:00:00/);
  assert.deepEqual(blocked.blocked.find(item=>item.runtime==='gpt-6-astra').budget,{remaining:4,until:at+86_400_000});
  const later=createAllocator({runtimes:profile,now:()=>at+86_400_001,budget:budgetAt(40,96)});
  assert.equal(later.review('architecture.decide').blocked.some(item=>/exhausted/.test(item.reason)),false);
  // A runtime no window binds sits in the top band; an unreadable file is no budget at all.
  assert.equal(budgetBand(null),4);assert.equal(budgetBand(100),4);assert.equal(budgetBand(99),3);assert.equal(budgetBand(0),0);
  const blind=createAllocator({runtimes:profile,now:()=>at,budget:{path:path.join(os.tmpdir(),'no-such-starci-budget-dir')}});
  assert.equal(blind.review('architecture.decide').budget,null);
});

/**
 * Every tier has a downgrade under it. The top tier is still preferred whenever it has a free slot; only a full,
 * cooling or exhausted top tier moves the operation down - Fable to Opus, Astra to Sol - instead of stalling it.
 */
test('a decide operation downgrades to Opus and then to Sol when the reasoning runtimes are out, and returns to Fable the moment a slot frees',()=>{
  const at=Date.UTC(2026,8,14,9);
  const allocator=createAllocator({runtimes:profile,now:()=>at});
  // A free Fable slot is chosen first, every time: the downgrade is an overflow, never a replacement.
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-fable-5.1');
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-fable-5.1');
  // Fable's two slots and Astra's one are full now, so the operation goes down one tier, to Opus.
  assert.equal(allocator.allocate('decision.prepare').runtime,'gpt-6-astra');
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-opus');
  const downgraded=allocator.allocate('decision.prepare');
  assert.equal(downgraded.runtime,'claude-opus');
  assert.equal(downgraded.overflowed,true);
  assert.deepEqual(downgraded.preference,['claude-fable-5.1','gpt-6-astra','claude-opus','gpt-5.6-sol']);
  // Opus is full too: the last tier of the chain takes it rather than nobody.
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-opus');
  assert.equal(allocator.allocate('decision.prepare').runtime,'gpt-5.6-sol');
  // A freed Fable slot takes the next one straight back from the downgrade.
  allocator.release('claude-fable-5.1');
  assert.equal(allocator.allocate('decision.prepare').runtime,'claude-fable-5.1');
});

test('a decide operation whose reasoning windows are exhausted downgrades on the probed budget alone, and a hard one is no longer outside the tier',()=>{
  const at=Date.UTC(2026,8,14,9);
  // Claude's week and Codex's week are both spent, so Fable, Astra and Opus are all out of window; only Sol's
  // provider is still readable here, which is exactly the case that used to leave a decide operation with nobody.
  const spent={schema:'starci/runtime-budget@1',at,providers:{
    claude:{status:'ok',windows:{weekly:{usedPercent:97,resetsAt:at+86_400_000,minutes:10080}}},
    codex:{status:'ok',windows:{weekly:{usedPercent:20,resetsAt:at+86_400_000,minutes:10080}}}}};
  const allocator=createAllocator({runtimes:profile,now:()=>at,budget:spent});
  const decided=allocator.allocate('decision.prepare');
  // Astra first - its own window is fine - and Opus and Fable are blocked by the window, not by a cap of ours.
  assert.equal(decided.runtime,'gpt-6-astra');
  assert.deepEqual(decided.blocked.filter(item=>item.budget).map(item=>item.runtime),['claude-opus','claude-fable-5.1']);
  const next=allocator.allocate('decision.prepare');
  assert.equal(next.runtime,'gpt-5.6-sol',"Astra's one slot is taken and Claude is out of window: Sol carries it");
  // A hard decide operation reads the hard tier's own decide order, so it is never "outside the hard tier" again.
  const hard=createAllocator({runtimes:profile,now:()=>at});
  assert.deepEqual(hard.review('decision.prepare',{difficulty:'hard'}).preference,['claude-fable-5.1','gpt-6-astra','claude-opus','gpt-5.6-sol']);
  assert.equal(hard.review('decision.prepare',{difficulty:'hard'}).blocked.some(item=>/outside the hard tier/.test(item.reason)),false);
  assert.equal(hard.allocate('decision.prepare',{difficulty:'hard'}).runtime,'claude-fable-5.1');
  // The coding roles keep the order they always had inside that same tier.
  assert.deepEqual(hard.review('backend.implement',{difficulty:'hard'}).preference,['gpt-5.6-sol','claude-opus']);
  assert.equal(hard.allocate('backend.implement',{difficulty:'easy'}).runtime,'qwen3.8-flash');
});

test('two kernels write the one ledger under a lock and both their launches survive',t=>{
  const shared=sharedRoot(t),first='20260912-100000-first',second='20260912-104251-second';
  shared.kernel(first);shared.kernel(second);
  const open=workflow=>createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),shared:{path:shared.file,workflow}});
  const one=open(first),two=open(second);
  one.allocate('architecture.decide');one.launched('claude-fable-5.1',{op:'op-first'});
  two.allocate('architecture.decide');two.launched('claude-fable-5.1',{op:'op-second'});
  const entry=shared.read().runtimes['claude-fable-5.1'];
  assert.deepEqual(entry.live.map(item=>[item.workflow,item.op]),[[first,'op-first'],[second,'op-second']]);
  assert.equal(entry.usedToday,2);
  assert.equal(shared.read().schema,RUNTIME_LOADS);
  // Each writer released the lock, and each kernel counts only the other one's operation as shared load.
  assert.equal(fs.existsSync(`${shared.file}.lock`),false);
  assert.deepEqual(one.sharedView().loads,{'claude-fable-5.1':1});
  assert.deepEqual(two.sharedView().ops['claude-fable-5.1'].map(item=>item.op),['op-first']);
  // Both slots of fable are taken across the two kernels, so the next operation of either goes on to astra.
  assert.equal(open(second).allocate('architecture.decide').runtime,'gpt-6-astra');
  one.release('claude-fable-5.1',{op:'op-first'});
  assert.deepEqual(shared.read().runtimes['claude-fable-5.1'].live.map(item=>item.op),['op-second']);
});

test('a sequential allocator hands out one operation at a time whatever the profile or the quota says',()=>{
  const allocator=createAllocator({runtimes:profile,now:()=>0,sequential:true,quota:{order:['gpt-5.6-sol','claude-opus'],slots:{'gpt-5.6-sol':5,'claude-opus':3}}});
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
  // The shipped numbers: ten slots in flight, nine of them at most for the children of one cut parent, so a
  // heavy node fans out wide and still leaves the rest of the tree a slot to run in.
  assert.deepEqual(profile.allocation.fanOut,{seamFirst:true,maxPerGroup:9});
  assert.equal(profile.maxParallelOps,10);
  assert.deepEqual(profile.allocation.preference.implement,['gpt-5.6-sol','claude-opus','qwen3.8-flash']);
  const allocator=createAllocator({runtimes:profile,now:()=>0});
  assert.deepEqual(allocator.fanOut,{seamFirst:true,maxPerGroup:9});
  assert.equal(allocator.maxParallelOps,10);
  // A profile that declares no policy still bounds a group: one slot is kept for everything that is not it.
  const bare={...profile,allocation:{...profile.allocation,fanOut:undefined}};
  assert.deepEqual(createAllocator({runtimes:bare,now:()=>0}).fanOut,{seamFirst:true,maxPerGroup:9});
  // A profile that turns the seam rule off says so, and it is read rather than assumed.
  const loose={...profile,allocation:{...profile.allocation,fanOut:{seamFirst:false,maxPerGroup:3}}};
  assert.deepEqual(createAllocator({runtimes:loose,now:()=>0}).fanOut,{seamFirst:false,maxPerGroup:3});
  // The cut's planning kind allocates on the plan role, like every other record-authoring operation.
  assert.equal(allocator.roleFor('implementation.plan'),'plan');
  assert.equal(profile.roleOfKind['implementation.plan'],'plan');
});

test('model eligibility is filtered before provider budget ranking and returns its receipt',()=>{
  const decisions=[];const allocator=createAllocator({runtimes:profile,now:()=>0,eligibility:(job,runtime)=>{decisions.push([job.kind,runtime.id]);return runtime.id==='gpt-5.6-sol'?{eligible:false,reasons:['quality floor high is not met']}:{eligible:true,mode:'qualified',reasons:[]};}});
  const review=allocator.review('backend.implement',{job:{kind:'backend.implement',role:'implement',qualityFloor:'high'}});
  assert.equal(review.ready.some(item=>item.runtime==='gpt-5.6-sol'),false);assert.match(review.blocked.find(item=>item.runtime==='gpt-5.6-sol').reason,/model ineligible/);
  const picked=allocator.allocate('backend.implement',{job:{kind:'backend.implement',role:'implement',qualityFloor:'high'}});
  assert.equal(picked.ok,true);assert.notEqual(picked.runtime,'gpt-5.6-sol');assert.equal(picked.eligibility.mode,'qualified');assert.ok(decisions.length>=profile.maxParallelOps);
});

test('the owner provider order moves every preference and tier onto the named providers first and still overflows to the rest',()=>{
  const preferred=withProviderPreference(profile,['codex','qwen','claude']);
  const providersOf=list=>list.map(id=>profile.runtimes[id].provider);
  assert.deepEqual(providersOf(preferred.allocation.preference.plan),['codex','codex','claude','claude']);
  assert.deepEqual(preferred.allocation.preference.plan,['gpt-6-astra','gpt-5.6-sol','claude-fable-5.1','claude-opus'],'within one provider the authored order is kept');
  assert.deepEqual(providersOf(preferred.allocation.tiers.easy),['codex','qwen','claude']);
  assert.deepEqual(providersOf(preferred.allocation.tiers.hard.decide),['codex','codex','claude','claude']);
  assert.deepEqual([...preferred.allocation.preference.implement].sort(),[...profile.allocation.preference.implement].sort(),'no runtime is dropped, so overflow still reaches every one of them');
  assert.deepEqual(preferred.allocation.providerOrder,['codex','qwen','claude']);
  assert.deepEqual(profile.allocation.preference.plan,['claude-fable-5.1','gpt-6-astra','claude-opus','gpt-5.6-sol'],'the authored profile is not mutated');
  assert.equal(withProviderPreference(profile,[]),profile,'no order named, nothing reordered');
  const partial=withProviderPreference(profile,['qwen']);
  assert.deepEqual(partial.allocation.preference.verify,['qwen3.8-flash','gpt-5.6-sol','claude-fable-5.1','gpt-6-astra','claude-opus'],'providers the owner did not name keep their authored order behind the named one');
});

test('a named provider order outranks the probed window, and an exhausted window still overflows past the owner choice',()=>{
  const at=Date.UTC(2026,8,15,9);
  const budgetAt=(claude,codex)=>({schema:'starci/runtime-budget@1',at,providers:{
    claude:{status:'ok',windows:{session:{usedPercent:5,resetsAt:at+3_600_000,minutes:300},weekly:{usedPercent:claude,resetsAt:at+86_400_000,minutes:10080},fableWeekly:{usedPercent:claude,resetsAt:at+86_400_000,minutes:10080}}},
    codex:{status:'ok',windows:{weekly:{usedPercent:codex,resetsAt:at+86_400_000,minutes:10080}}}}});
  // The owner's provider has clearly less of its week left than the one they did not pick.
  const rich=budgetAt(20,60),preferred=withProviderPreference(profile,['codex','qwen','claude']);
  assert.equal(createAllocator({runtimes:profile,now:()=>at,budget:rich}).allocate('work.author').runtime,'claude-fable-5.1','without an order the fuller window leads');
  const owned=createAllocator({runtimes:preferred,now:()=>at,budget:rich}).allocate('work.author');
  assert.equal(owned.runtime,'gpt-6-astra','the owner order leads, even against a window with more left');
  assert.deepEqual(owned.sparedOver,[],'the budget moved nothing, so it spared nothing');
  assert.equal(createAllocator({runtimes:preferred,now:()=>at,budget:rich}).allocate('backend.implement').runtime,'gpt-5.6-sol');
  // Codex out of window: its runtimes are not eligible at all, so the choice overflows rather than stalling.
  const drained=createAllocator({runtimes:preferred,now:()=>at,budget:budgetAt(20,99)}).allocate('work.author');
  assert.equal(drained.runtime,'claude-fable-5.1','an exhausted preferred provider overflows to the next runtime of the role');
  assert.ok(drained.blocked.some(item=>item.runtime==='gpt-6-astra'&&/window|budget|exhaust/i.test(item.reason)),'the preferred runtime is blocked by its window, not by the order');
});

test('a named provider order also leads the shared key, so another kernel on the chosen provider does not move the work off it',t=>{
  const shared=sharedRoot(t),other='20260915-100000-other',mine='20260915-104251-mine';
  shared.kernel(other);
  shared.write({'gpt-6-astra':liveOn(other,'op-plan')});
  const preferred=withProviderPreference(profile,['codex','qwen','claude']);
  const authored=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,15,9),shared:{path:shared.file,workflow:mine}});
  assert.equal(authored.allocate('work.author').runtime,'claude-fable-5.1','left to itself the kernel takes the authored first choice');
  const owned=createAllocator({runtimes:preferred,now:()=>Date.UTC(2026,8,15,9),shared:{path:shared.file,workflow:mine}});
  const picked=owned.allocate('work.author');
  assert.equal(profile.runtimes[picked.runtime].provider,'codex','the owner provider keeps the work even though another kernel is on one of its runtimes');
  assert.equal(picked.runtime,'gpt-5.6-sol','inside the chosen provider the shared key still avoids the runtime the other kernel holds');
});
