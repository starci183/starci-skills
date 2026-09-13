import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {ALLOCATION,DEFAULT_COOLDOWN_MS,LEAST_LOADED,PREFER_THEN_OVERFLOW,applyQuota,classifyFailure,createAllocator} from '../execution/runtime-allocator.mjs';
import {RUNTIME_LOADS,loadsFile,loadsFileFor,readLoads} from '../execution/runtime-loads.mjs';

const profile=parseYaml(fs.readFileSync(new URL('../profiles/runtimes.yaml',import.meta.url),'utf8'));
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
  const counts=tally([...picked,'gpt-5.6-sol']);
  const snapshot=allocator.snapshot();
  assert.equal(snapshot.policy,PREFER_THEN_OVERFLOW);
  assert.deepEqual(snapshot.preference.verify,['gpt-5.6-sol','claude-fable-5.1','gpt-6-astra','claude-opus','qwen3.8-flash']);
  assert.equal(snapshot.inFlight,6);
  assert.equal(snapshot.runtimes['claude-opus'].remaining.ops,profile.runtimes['claude-opus'].budget.opsPerDay-counts['claude-opus']);
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
    alpha:{target:'alpha',roles:['implement'],maxParallel:2},
    beta:{target:'beta',roles:['implement'],maxParallel:2}
  });
  const allocator=createAllocator({runtimes,now:()=>0});
  assert.equal(allocator.allocate('x.implement').runtime,'alpha');
  allocator.release('alpha');
  assert.equal(allocator.allocate('x.implement').runtime,'beta');
  allocator.release('beta');
  assert.equal(allocator.allocate('x.implement').runtime,'alpha');
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
  // Left to itself this kernel would take fable first: the role's preference is [fable, astra, opus], and of
  // those only fable and astra carry the decide role at all.
  assert.deepEqual(allocator.review('architecture.decide').localRanked,['claude-fable-5.1','gpt-6-astra']);
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
