import {readDistJson} from '../core/runtime-root.mjs';
import {resolveExecutionChain} from './chains.mjs';
import {roleOf} from './graph.mjs';
import {SHARED_COOLING_KINDS,createLoadsLedger} from './loads.mjs';
import {budgetVerdict,readRuntimeBudget} from './budget.mjs';

/**
 * Runtime allocation: pools with slots and budgets instead of an ordered provider chain. The kernel asks
 * for the next runtime for an operation kind; the allocator answers with one eligible runtime - one that has
 * the role, a free slot, a daily budget and no cooldown - and records loads so a saturated provider never
 * blocks the pool. A launch that fails is classified and the pool cools down with exponential backoff, so a
 * rate limit parks one runtime instead of stalling the workflow. All time comes from the injected `now`.
 *
 * Expensive runtimes are split across the workflows of a repository, not owned by one. With `shared:{path,
 * workflow}` the allocator reads the repository's shared ledger (`kernel/loads.mjs`) before it
 * chooses: another kernel's live operations on a runtime count as load, so `maxParallel` holds across kernels,
 * a cooldown another kernel ran into is a cooldown here too, and among candidates that all qualify the one no
 * other kernel is using wins - which is how a second workflow's hard operation reaches Astra while Fable
 * carries the first one's. Nothing shared ever widens a workflow's quota: that cap stays the workflow's own.
 *
 * Two policies order the eligible set. `prefer-then-overflow` (the shipped one) reads `allocation.preference`
 * per role and hands every operation the first preferred runtime that is eligible, so work concentrates on
 * the best runtime until its slots are full and overflows only then; a freed preferred slot takes the next
 * operation back. `least-loaded-with-budget` is the fallback when a role declares no preference: it ranks by
 * load ratio, free slots and remaining budget, and breaks an exact tie by round robin.
 */
export const ALLOCATION='starci/runtime-allocation@1';
export const PREFER_THEN_OVERFLOW='prefer-then-overflow';
export const LEAST_LOADED='least-loaded-with-budget';
export const FAILURE_KINDS=['rate-limited','quota','auth','other'];
/** Reason -> failure kind. Order matters: a 429 that also mentions a quota is still a rate limit. */
export const FAILURE_PATTERNS={
  'rate-limited':/429|rate.?limit|too many requests|overloaded|capacity/i,
  quota:/quota|insufficient_quota|budget|billing/i,
  auth:/401|403|unauthorized|forbidden|login/i
};
export const DEFAULT_COOLDOWN_MS={'rate-limited':600000,quota:3600000,auth:86400000,other:300000};
export const DEFAULT_BACKOFF_FACTOR=2;
export const DEFAULT_MAX_COOLDOWN_MS=3600000;
export const DEFAULT_MAX_PARALLEL_OPS=10;

const need=(condition,message)=>{if(!condition)throw Error(message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** Total order that tolerates Infinity: subtraction would yield NaN for two unlimited budgets. */
const cmp=(a,b)=>a===b?0:a<b?-1:1;
const utcDay=ms=>new Date(ms).toISOString().slice(0,10);
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const orNull=value=>Number.isFinite(value)?value:null;
const counters=value=>plain(value)?Object.fromEntries(Object.entries(value).filter(([,count])=>Number.isFinite(count))):{};

export function loadRuntimes(){return readDistJson('model','runtimes.json');}

/**
 * The owner's provider order, applied to a loaded profile. Every role preference and every tier list is sorted
 * so runtimes of an earlier-named provider come first; runtimes of a provider the owner did not name keep their
 * authored order behind them. Nothing is removed, so `prefer-then-overflow` still overflows exactly as before
 * when the preferred provider is saturated, cooling or out of window. The order is recorded on the profile so
 * the non-operation model pools can honour the same choice.
 */
export function withProviderPreference(profile,order=[]){
  const wanted=(Array.isArray(order)?order:[]).filter(provider=>typeof provider==='string'&&provider.trim());
  if(!wanted.length||!profile||typeof profile.runtimes!=='object'||profile.runtimes===null)return profile;
  const rank=id=>{const at=wanted.indexOf(profile.runtimes?.[id]?.provider);return at<0?wanted.length:at;};
  const sort=list=>Array.isArray(list)?list.map((id,index)=>({id,index})).sort((a,b)=>rank(a.id)-rank(b.id)||a.index-b.index).map(item=>item.id):list;
  const copy=structuredClone(profile);
  copy.allocation=copy.allocation??{};
  copy.allocation.providerOrder=[...wanted];
  for(const [role,list] of Object.entries(copy.allocation.preference??{}))copy.allocation.preference[role]=sort(list);
  for(const [tier,value] of Object.entries(copy.allocation.tiers??{})){
    if(Array.isArray(value)){copy.allocation.tiers[tier]=sort(value);continue;}
    if(value&&typeof value==='object')for(const [role,list] of Object.entries(value))value[role]=sort(list);
  }
  return copy;
}
/** The graph's role for an operation kind, or null when it knows none; never throws for an unknown kind. */
const graphRole=kind=>{try{return roleOf(kind);}catch{return null;}};

/** Classify why a launch or an operation failed; the kind selects the cooldown. */
export function classifyFailure(reason){
  const text=typeof reason==='string'?reason:reason==null?'':plain(reason)?String(reason.message??reason.reason??''):String(reason);
  for(const kind of ['rate-limited','quota','auth'])if(FAILURE_PATTERNS[kind].test(text))return kind;
  return 'other';
}

/** Restore only counters and cooldowns; pools always come from the profile, never from saved state. */
function adoptState(state,day){
  const cooling={};
  for(const [id,entry] of Object.entries(plain(state?.cooling)?state.cooling:{})){
    if(!plain(entry)||!Number.isFinite(entry.until))continue;
    cooling[id]={kind:FAILURE_KINDS.includes(entry.kind)?entry.kind:'other',until:entry.until,cooldownMs:finite(entry.cooldownMs,0),reason:typeof entry.reason==='string'?entry.reason:null};
  }
  return {
    day:typeof state?.day==='string'&&state.day?state.day:day,
    loads:counters(state?.loads),usedToday:counters(state?.usedToday),tokensToday:counters(state?.tokensToday),
    streaks:counters(state?.streaks),cooling,
    lastAllocated:typeof state?.lastAllocated==='string'?state.lastAllocated:null
  };
}

/** Apply a workflow's quota (`{order:[ids], slots:{id:n}}`) on top of the profile: slots become maxParallel, order becomes every role's preference. */
export function applyQuota(runtimes,quota){
  if(!plain(quota)||(!Array.isArray(quota.order)&&!plain(quota.slots)))return runtimes;
  const copy=structuredClone(runtimes);
  const order=Array.isArray(quota.order)?quota.order.filter(id=>copy.runtimes?.[id]):[];
  for(const [id,n] of Object.entries(plain(quota.slots)?quota.slots:{}))if(copy.runtimes?.[id]&&Number.isFinite(Number(n)))copy.runtimes[id].maxParallel=Math.max(0,Number(n));
  if(order.length){
    copy.allocation=plain(copy.allocation)?copy.allocation:{};
    copy.allocation.policy='prefer-then-overflow';
    const roles=new Set(Object.values(copy.runtimes).flatMap(rt=>rt.roles??[]));
    copy.allocation.preference={...(plain(copy.allocation.preference)?copy.allocation.preference:{})};
    for(const role of roles)copy.allocation.preference[role]=[...order.filter(id=>(copy.runtimes[id].roles??[]).includes(role)),...((copy.allocation.preference[role]??[]).filter(id=>!order.includes(id)))];
    const tags=plain(quota.tags)?quota.tags:{};
    if(Object.keys(tags).length){
      // Tags name the difficulty levels a runtime accepts; an untagged runtime in the order accepts every level.
      copy.allocation.tiers=Object.fromEntries(['easy','medium','hard'].map(level=>[level,order.filter(id=>!tags[id]||tags[id].includes(level))]));
      copy.allocation.tierFill='ratio';
    }else{
      // The quota's order is laid over every tier, and over each role's own list inside a tier that has them.
      const relist=list=>list.filter(id=>order.includes(id)).concat(order.filter(id=>!list.includes(id)));
      const retier=entry=>Array.isArray(entry)?relist(entry):plain(entry)?Object.fromEntries(Object.entries(entry).map(([role,list])=>[role,Array.isArray(list)?relist(list):list])):entry;
      copy.allocation.tiers=plain(copy.allocation.tiers)?Object.fromEntries(Object.entries(copy.allocation.tiers).map(([level,entry])=>[level,retier(entry)])):copy.allocation.tiers;
    }
  }
  return copy;
}

/** The shared ledger handle: an already built one is used as it is, `{path, workflow}` opens one, null is local-only. */
function sharedLedgerOf(shared,now){
  if(!plain(shared))return null;
  if(typeof shared.read==='function')return shared;
  try{return createLoadsLedger({path:shared.path,workflow:shared.workflow,now});}catch{return null;}
}

/**
 * The provider budget the supervisor probed (`runtime-budget.json` beside the stores) is read per review and
 * folded into the pick in two ways: a runtime whose provider window is exhausted (95% and not reset) is
 * blocked until that reset, and among the ready ones the runtime with clearly more of its window left comes
 * first - in bands of 25 points, so a few percent never reorder the role's own chain, a half-spent week does.
 * A runtime no window binds (a local model, an unread provider) is never penalised: it sits in the top band.
 */
export const BUDGET_BAND=25;
export function budgetBand(remaining){return remaining===null||remaining===undefined?Math.ceil(100/BUDGET_BAND):Math.floor(Math.max(0,Math.min(100,remaining))/BUDGET_BAND);}
function budgetReaderOf(budget){
  if(!budget)return null;
  if(typeof budget==='function')return budget;
  if(typeof budget.read==='function')return ()=>budget.read();
  if(typeof budget.path==='string')return ()=>{try{return readRuntimeBudget(budget.path);}catch{return null;}};
  if(plain(budget.providers))return ()=>budget;
  return null;
}
/**
 * One operation at a time, whatever the profile or the quota says: `maxParallelOps` becomes 1 and every pool
 * keeps at most one slot. The headless host needs this because its operations are detached `claude -p` /
 * `codex exec` processes in one worktree with no terminal to supervise them from - two of them would race on
 * the same index and the same allowlist arbitration a chat cannot see - and because one chat drives one
 * workflow: the owner reads one operation's outcome at a time. A pool the quota closed (0 slots) stays closed.
 */
export function sequentialRuntimes(runtimes){
  const copy=structuredClone(runtimes);
  copy.maxParallelOps=1;
  for(const pool of Object.values(plain(copy.runtimes)?copy.runtimes:{}))if(plain(pool))pool.maxParallel=Math.min(1,Math.max(0,finite(pool.maxParallel,1)));
  return copy;
}
export function createAllocator({runtimes=loadRuntimes(),now=Date.now,state=null,quota=null,shared=null,budget=null,sequential=false,eligibility=null}={}){
  runtimes=applyQuota(runtimes,quota);
  // The cap is applied after the quota on purpose: a quota widens slots, and a sequential host never lets it.
  if(sequential)runtimes=sequentialRuntimes(runtimes);
  need(plain(runtimes)&&plain(runtimes.runtimes),'Runtime allocation needs a runtimes profile with a runtimes map');
  const pools=runtimes.runtimes,ids=Object.keys(pools),allocation=plain(runtimes.allocation)?runtimes.allocation:{};
  need(ids.length,'Runtime allocation needs at least one runtime pool');
  const cooldownMs={...DEFAULT_COOLDOWN_MS,...(plain(allocation.cooldownMs)?allocation.cooldownMs:{})};
  const backoffFactor=finite(allocation.backoffFactor,DEFAULT_BACKOFF_FACTOR);
  const maxCooldownMs=finite(allocation.maxCooldownMs,DEFAULT_MAX_COOLDOWN_MS);
  const maxParallelOps=finite(runtimes.maxParallelOps,DEFAULT_MAX_PARALLEL_OPS);
  const policy=typeof allocation.policy==='string'?allocation.policy:LEAST_LOADED;
  const fanOut=plain(allocation.fanOut)?allocation.fanOut:{};
  const preference=plain(allocation.preference)?allocation.preference:{};
  const live=adoptState(state,utcDay(now()));
  const ledger=sharedLedgerOf(shared,now);
  const workflow=ledger?.workflow??null;
  const readBudget=budgetReaderOf(budget);
  /** Cooldowns learned from another kernel, drained by the caller so it can record them once. */
  const notices=[],announced=new Map();
  const EMPTY_SHARED={ok:false,loads:{},ops:{},cooling:{}};
  /** The other kernels' view, re-read per review: a tick is minutes long and the file is a few hundred bytes. */
  const outside=()=>{
    if(!ledger)return EMPTY_SHARED;
    let view=EMPTY_SHARED;
    try{view=ledger.read();}catch{return EMPTY_SHARED;}
    for(const [id,cool] of Object.entries(view.cooling)){
      if(!cool.workflow||cool.workflow===workflow||announced.get(id)===cool.until)continue;
      announced.set(id,cool.until);
      notices.push({runtime:id,until:cool.until,wakeAt:new Date(cool.until).toISOString(),reason:cool.reason,kind:cool.kind,from:cool.workflow});
    }
    return view;
  };
  /** A write to the shared ledger is never fatal: a ledger this kernel cannot write is a local allocator. */
  const note=(method,payload)=>{if(!ledger)return null;try{return ledger[method](payload);}catch{return null;}};

  const rollDay=()=>{const today=utcDay(now());if(today===live.day)return;live.day=today;live.usedToday={};live.tokensToday={};};
  const slots=id=>Math.max(0,finite(pools[id]?.maxParallel,1));
  const load=id=>live.loads[id]??0;
  const opsLeft=id=>finite(pools[id]?.budget?.opsPerDay,Infinity)-(live.usedToday[id]??0);
  const tokensLeft=id=>finite(pools[id]?.budget?.tokensPerDay,Infinity)-(live.tokensToday[id]??0);
  const cooling=id=>{const entry=live.cooling[id];return entry&&entry.until>now()?entry:null;};
  const inFlight=()=>ids.reduce((total,id)=>total+load(id),0);
  /** Round-robin tie-break: the runtime right after the last allocated one wins an otherwise exact tie. */
  const rotation=id=>{const last=ids.indexOf(live.lastAllocated);return last<0?ids.indexOf(id):(ids.indexOf(id)-last-1+ids.length)%ids.length;};
  // The kind graph is the authority on what role a kind takes; the profile's own map stays the fallback for a
  // kind the graph does not carry (a host profile's private kinds, and every 4.x operator id).
  const roleFor=kind=>graphRole(kind)??runtimes.roleOfKind?.[kind]??'implement';
  /** The role's preference order, or null when the role declares none: then least-loaded ranks the pools. */
  const tiers=plain(allocation.tiers)?allocation.tiers:{};
  /**
   * The runtimes one difficulty admits for one role. A tier is a plain list, or a map that orders the tier per
   * role (`{default:[...], decide:[...]}`): the reasoning roles name their own runtimes and their downgrade
   * without disturbing the order the coding roles have inside the same tier.
   */
  const tierFor=(difficulty,role)=>{
    const entry=difficulty?tiers[difficulty]:null;
    if(Array.isArray(entry))return entry;
    if(!plain(entry))return null;
    const list=Array.isArray(entry[role])?entry[role]:Array.isArray(entry.default)?entry.default:null;
    return list;
  };
  /** The order for one allocation: the difficulty tier when declared, else the role's preference, else least-loaded. */
  const preferenceOf=(role,difficulty=null)=>{
    if(policy!==PREFER_THEN_OVERFLOW)return null;
    const named=tierFor(difficulty,role);
    const tier=named?named.filter(id=>(pools[id]?.roles??[]).includes(role)):null;
    const list=tier&&tier.length?tier:preference[role];
    return Array.isArray(list)&&list.length?list.filter(id=>typeof id==='string'):null;
  };
  /** Position in the preference order; an unlisted but eligible runtime sorts after every preferred one. */
  const rank=(list,id)=>{const at=list.indexOf(id);return at<0?list.length:at;};
  const spend=(id,tokens)=>{if(Number.isFinite(tokens)&&tokens>0)live.tokensToday[id]=(live.tokensToday[id]??0)+tokens;};
  const remainingOf=id=>({ops:orNull(opsLeft(id)),tokens:orNull(tokensLeft(id))});

  /** Rank every pool for one kind: ready candidates in allocation order plus why each other was skipped. */
  const review=(kind,{avoid=[],restrictTo=null,difficulty=null,job=null}={})=>{
    rollDay();
    const role=roleFor(kind),ready=[],blocked=[],order=preferenceOf(role,difficulty),tier=tierFor(difficulty,role);
    const view=outside();
    // Another kernel's live operations are load here too, so `maxParallel` is the runtime's cap across the
    // whole repository and not per workflow; a cooldown it recorded parks the runtime for this kernel as well.
    const elsewhere=id=>view.loads[id]??0;
    const sharedCooling=id=>{const entry=view.cooling[id];return entry&&entry.until>now()?entry:null;};
    const probed=readBudget?readBudget():null;
    const verdictOf=id=>probed?budgetVerdict(pools[id],probed,{now:now()}):{known:false,exhausted:false,until:null,remaining:null,windows:[]};
    for(const id of ids){
      const pool=pools[id],cool=cooling(id),parked=sharedCooling(id),held=elsewhere(id),free=slots(id)-load(id)-held,window=verdictOf(id);
      let qualification=null;
      if(typeof eligibility==='function')try{qualification=eligibility(job??{kind,role,difficulty},{id,...pool,model:pool.model??pool.target??id});}catch(error){qualification={eligible:false,reasons:[error?.message??'model eligibility unavailable']};}
      const reason=!Array.isArray(pool?.roles)||!pool.roles.includes(role)?`no ${role} role`
        :tier&&tier.length&&!tier.includes(id)?`outside the ${difficulty} tier`
        :avoid.includes(id)?'avoided'
        :Array.isArray(restrictTo)&&!restrictTo.includes(id)?'not launchable for this operation'
        :qualification&&!qualification.eligible?`model ineligible: ${(qualification.reasons??['model eligibility unavailable']).join('; ')}`
        :cool?`cooling after ${cool.kind} until ${new Date(cool.until).toISOString()}`
        :parked?`cooling after a shared ${parked.kind??'provider limit'} until ${new Date(parked.until).toISOString()}, seen by ${parked.workflow??'another workflow'}`
        :window.exhausted?`provider window exhausted until ${new Date(window.until??now()).toISOString()}`
        :free<=0?'no free slot'
        :opsLeft(id)<=0?'daily op budget exhausted'
        :tokensLeft(id)<=0?'daily token budget exhausted'
        :null;
      // The shared detail travels beside the reason, never inside it: the kernel reads these reasons by shape.
      if(reason){blocked.push({runtime:id,reason,...(held?{sharedLoad:held}:{}),...(parked&&!cool?{shared:true,from:parked.workflow??null}:{}),...(window.exhausted?{budget:{remaining:window.remaining,until:window.until}}:{})});continue;}
      ready.push({runtime:id,target:pool.target??id,load:load(id),free,slots:slots(id),ratio:load(id)/slots(id),opsLeft:opsLeft(id),tokensLeft:tokensLeft(id),rotation:rotation(id),preference:order?rank(order,id):null,sharedLoad:held,remainingShare:window.remaining,band:budgetBand(window.remaining),eligibility:qualification});
    }
    // prefer-then-overflow: the first eligible runtime of the role's order wins, so a saturated or cooling
    // preference simply is not in `ready` and the next one takes the operation without any special case.
    // A difficulty tier with ratio fill spreads its operations in proportion to the slots (4:1), then keeps the order;
    // otherwise the order itself is the fill (prefer, then overflow).
    const tierRatio=allocation.tierFill==='ratio'&&Boolean(tier);
    const locally=order&&tierRatio?(a,b)=>cmp(a.ratio,b.ratio)||cmp(a.preference,b.preference)||cmp(b.free,a.free)||cmp(a.rotation,b.rotation)
      :order?(a,b)=>cmp(a.preference,b.preference)||cmp(a.ratio,b.ratio)||cmp(b.free,a.free)||cmp(a.rotation,b.rotation)
      :(a,b)=>cmp(a.ratio,b.ratio)||cmp(b.free,a.free)||cmp(b.opsLeft,a.opsLeft)||cmp(a.rotation,b.rotation);
    // What this kernel alone would have picked, kept so the receipt can name what the shared view passed over.
    const localRanked=ledger?[...ready].sort(locally).map(item=>item.runtime):null;
    // The shared key comes first, the budget band second, and nothing else changes: a runtime no other kernel
    // is using beats an equally capable one that carries another workflow's operation; inside one shared load
    // the runtime with clearly more of its provider window left comes first; inside one band the local order decides.
    const bySharedOnly=ledger?(a,b)=>cmp(a.sharedLoad,b.sharedLoad)||locally(a,b):locally;
    const withoutBudget=probed?[...ready].sort(bySharedOnly).map(item=>item.runtime):null;
    ready.sort(ledger?(a,b)=>cmp(a.sharedLoad,b.sharedLoad)||cmp(b.band,a.band)||locally(a,b):(a,b)=>cmp(b.band,a.band)||locally(a,b));
    return {kind,role,ready,blocked,preference:order,localRanked,withoutBudget,
      budget:probed?Object.fromEntries(ready.map(item=>[item.runtime,item.remainingShare])):null,
      shared:ledger?{workflow,loads:{...view.loads},cooling:{...view.cooling}}:null};
  };

  return {
    schema:ALLOCATION,
    policy,
    maxParallelOps,
    // How wide one cut group may fan out (`allocation.fanOut`): the seam of a group runs alone, and at most
    // `maxPerGroup` of its children run at once, so ten slots are never all spent on one parent.
    fanOut:{seamFirst:fanOut.seamFirst!==false,
      maxPerGroup:finite(fanOut.maxPerGroup,Math.max(1,maxParallelOps-1))},
    sequential:Boolean(sequential),
    runtimeIds:[...ids],
    roleFor,
    review,
    /** Pick the runtime for one operation; `avoid` is absolute, `restrictTo` limits the pools to launchable targets. */
    allocate(kind,{avoid=[],restrictTo=null,difficulty=null,job=null}={}){
      const {role,ready,blocked,preference:order,localRanked,withoutBudget,budget:budgetView,shared:sharedView}=review(kind,{avoid,restrictTo,difficulty,job});
      if(inFlight()>=maxParallelOps)return {ok:false,kind,role,avoid,blocked,reason:`maxParallelOps ${maxParallelOps} is already in flight; release a slot before allocating ${kind}`};
      if(!ready.length)return {ok:false,kind,role,avoid,blocked,reason:`no runtime with the ${role} role, a free slot and budget for ${kind}: ${blocked.map(item=>`${item.runtime} (${item.reason})`).join(', ')||'no pool declares that role'}`};
      const chosen=ready[0];
      live.loads[chosen.runtime]=chosen.load+1;
      live.usedToday[chosen.runtime]=(live.usedToday[chosen.runtime]??0)+1;
      live.lastAllocated=chosen.runtime;
      // Everything the local order ranked ahead of the chosen runtime was passed over for one reason only: it
      // carries another kernel's operations. An empty list means the shared view changed nothing.
      const preferredOver=localRanked?localRanked.slice(0,Math.max(0,localRanked.indexOf(chosen.runtime))):[];
      const sharedLoad=Object.fromEntries(ready.filter(item=>item.sharedLoad>0).map(item=>[item.runtime,item.sharedLoad]));
      // What the budget alone moved: the runtimes the shared-and-local order ranked ahead of the chosen one, passed
      // over only because they have clearly less of their provider window left. Empty when the budget changed nothing.
      const sparedOver=withoutBudget?withoutBudget.slice(0,Math.max(0,withoutBudget.indexOf(chosen.runtime))):[];
      return {ok:true,kind,role,runtime:chosen.runtime,target:chosen.target,load:chosen.load+1,slots:chosen.slots,
        remaining:remainingOf(chosen.runtime),alternatives:ready.slice(1).map(item=>item.runtime),blocked,at:now(),
        policy,preference:order,overflowed:Boolean(order)&&chosen.preference>0,eligibility:chosen.eligibility??null,
        ...(budgetView?{budget:budgetView,sparedOver}:{}),
        ...(ledger?{shared:{workflow,loads:sharedView?.loads??{}},sharedLoad,preferredOver}:{})};
    },
    /** Independent review: the implement runtime is excluded while `verifyAvoidsImplementRuntime` holds. */
    allocateVerify(kind,{implementRuntime=null,avoid=[],restrictTo=null,difficulty=null,job=null}={}){
      const strict=allocation.verifyAvoidsImplementRuntime!==false;
      return this.allocate(kind,{avoid:strict&&implementRuntime?[...avoid,implementRuntime]:avoid,restrictTo,difficulty,job});
    },
    /** An operation the kernel actually launched: the shared ledger carries it until it is released or fails. */
    launched(runtime,{op=null}={}){
      need(Object.hasOwn(pools,runtime),`Unknown runtime ${runtime}`);
      const recorded=op?note('launched',{runtime,op}):null;
      return {ok:true,runtime,op,shared:Boolean(recorded?.ok)};
    },
    /**
     * An allocation the admission deferred before anything ran (the canonical writer was busy, the global ceiling
     * was reached): the slot and the day's count both come back, no failure is charged and nothing cools, because
     * the runtime did nothing and was refused nothing. Releasing it as a finished run left `usedToday` counting
     * deferrals - three per tick - as operations the runtime had carried.
     */
    deferred(runtime,{op=null}={}){
      rollDay();
      need(Object.hasOwn(pools,runtime),`Unknown runtime ${runtime}`);
      live.loads[runtime]=Math.max(0,load(runtime)-1);
      live.usedToday[runtime]=Math.max(0,(live.usedToday[runtime]??0)-1);
      note('released',{runtime,op});
      return {ok:true,runtime,load:load(runtime),remaining:remainingOf(runtime)};
    },
    /** An operation that finished: free the slot, charge the tokens it used and clear the failure streak. */
    release(runtime,{tokens=0,op=null}={}){
      rollDay();
      need(Object.hasOwn(pools,runtime),`Unknown runtime ${runtime}`);
      live.loads[runtime]=Math.max(0,load(runtime)-1);
      spend(runtime,tokens);
      delete live.streaks[runtime];
      note('released',{runtime,op});
      return {ok:true,runtime,load:load(runtime),remaining:remainingOf(runtime)};
    },
    /**
     * A launch or an operation failed: free the slot, refund the op (it produced nothing) and cool the pool
     * down for the classified reason, doubling the wait per consecutive failure up to `maxCooldownMs`.
     */
    failed(runtime,{reason='',tokens=0,op=null}={}){
      rollDay();
      need(Object.hasOwn(pools,runtime),`Unknown runtime ${runtime}`);
      live.loads[runtime]=Math.max(0,load(runtime)-1);
      spend(runtime,tokens);
      live.usedToday[runtime]=Math.max(0,(live.usedToday[runtime]??0)-1);
      const kind=classifyFailure(reason),base=finite(cooldownMs[kind],DEFAULT_COOLDOWN_MS.other);
      const failures=(live.streaks[runtime]??0)+1;
      // The cap limits the backoff, never the configured base: an auth lockout stays a day long.
      const wait=Math.min(Math.round(base*backoffFactor**(failures-1)),Math.max(maxCooldownMs,base));
      const until=now()+wait;
      live.streaks[runtime]=failures;
      live.cooling[runtime]={kind,until,cooldownMs:wait,reason:String(reason).slice(0,200)||null};
      note('released',{runtime,op});
      // A provider limit belongs to the provider, not to this workflow: a rate limit and an exhausted quota are
      // published so the other kernels skip the runtime too. An auth or local failure stays this kernel's own.
      if(SHARED_COOLING_KINDS.includes(kind))note('cooled',{runtime,until,reason:String(reason).slice(0,200)||null,kind});
      return {ok:false,runtime,kind,failures,cooldownMs:wait,until,wakeAt:new Date(until).toISOString(),shared:SHARED_COOLING_KINDS.includes(kind)&&Boolean(ledger)};
    },
    /** The shared ledger of this repository, or null when this allocator is the only one of its runtimes. */
    sharedLedger:ledger,
    /** What the other kernels hold right now: `{loads, ops, cooling}`, empty when there is no shared ledger. */
    sharedView(){return ledger?outside():EMPTY_SHARED;},
    /** At start: drop this workflow's own leftovers - ledger entries of operations that are no longer running. */
    sharedSync(ops=[]){return ledger?note('sync',{ops}):null;},
    /** Cooldowns learned from another kernel since the last call; the kernel records each one once. */
    takeSharedNotices(){return notices.splice(0,notices.length);},
    /** What the kernel prints and logs: loads, remaining budget per pool and every cooling runtime's wake time. */
    snapshot(){
      rollDay();
      const view=ledger?outside():null;
      return {
        ...(view?{shared:{workflow,loads:{...view.loads},cooling:{...view.cooling}}}:{}),
        schema:ALLOCATION,day:live.day,policy,preference:Object.fromEntries(Object.entries(preference).filter(([,list])=>Array.isArray(list)).map(([role,list])=>[role,[...list]])),
        maxParallelOps,inFlight:inFlight(),lastAllocated:live.lastAllocated,
        runtimes:Object.fromEntries(ids.map(id=>[id,{roles:[...(pools[id].roles??[])],slots:slots(id),load:load(id),free:Math.max(0,slots(id)-load(id)),usedToday:live.usedToday[id]??0,tokensToday:live.tokensToday[id]??0,remaining:remainingOf(id)}])),
        cooling:ids.filter(id=>cooling(id)).map(id=>({runtime:id,kind:live.cooling[id].kind,until:live.cooling[id].until,wakeAt:new Date(live.cooling[id].until).toISOString(),cooldownMs:live.cooling[id].cooldownMs,failures:live.streaks[id]??1,reason:live.cooling[id].reason}))
      };
    },
    /** Plain object for the kernel's state.json; restore with createAllocator({runtimes, state}). */
    serialize(){
      rollDay();
      return {
        schema:ALLOCATION,day:live.day,loads:{...live.loads},usedToday:{...live.usedToday},tokensToday:{...live.tokensToday},
        streaks:{...live.streaks},cooling:Object.fromEntries(Object.entries(live.cooling).map(([id,entry])=>[id,{...entry}])),
        lastAllocated:live.lastAllocated
      };
    },
    /** The targets this operation may actually launch; pass as `restrictTo` to keep allocation launchable. */
    launchableTargets(kind){return resolveExecutionChain({skill:'starci',op:kind}).candidates.map(candidate=>candidate.target);},
    /** The launch candidate for a runtime: the chain resolver supplies the provider launch shape for that target. */
    candidateFor(kind,target){
      const chain=resolveExecutionChain({skill:'starci',op:kind}).candidates;
      const found=chain.find(candidate=>candidate.target===target);
      need(found,`Runtime target ${target} is not launchable for ${kind}; that operation's environments offer ${chain.map(candidate=>candidate.target).join(', ')||'nothing'}. Add the target to the operation's environments in model/registry.yaml, or allocate with restrictTo: launchableTargets('${kind}').`);
      return found;
    }
  };
}
