import {readDistJson} from '../core/runtime-root.mjs';
import {resolveExecutionChain} from '../profiles/select.mjs';

/**
 * Runtime allocation: pools with slots and budgets instead of an ordered provider chain. The kernel asks
 * for the next runtime for an operation kind; the allocator answers with one eligible runtime - one that has
 * the role, a free slot, a daily budget and no cooldown - and records loads so a saturated provider never
 * blocks the pool. A launch that fails is classified and the pool cools down with exponential backoff, so a
 * rate limit parks one runtime instead of stalling the workflow. All time comes from the injected `now`.
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

export function loadRuntimes(){return readDistJson('profiles','runtimes.json');}

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
    copy.allocation.tiers=plain(copy.allocation.tiers)?Object.fromEntries(Object.entries(copy.allocation.tiers).map(([level,list])=>[level,list.filter(id=>order.includes(id)).concat(order.filter(id=>!list.includes(id)))])):copy.allocation.tiers;
  }
  return copy;
}

export function createAllocator({runtimes=loadRuntimes(),now=Date.now,state=null,quota=null}={}){
  runtimes=applyQuota(runtimes,quota);
  need(plain(runtimes)&&plain(runtimes.runtimes),'Runtime allocation needs a runtimes profile with a runtimes map');
  const pools=runtimes.runtimes,ids=Object.keys(pools),allocation=plain(runtimes.allocation)?runtimes.allocation:{};
  need(ids.length,'Runtime allocation needs at least one runtime pool');
  const cooldownMs={...DEFAULT_COOLDOWN_MS,...(plain(allocation.cooldownMs)?allocation.cooldownMs:{})};
  const backoffFactor=finite(allocation.backoffFactor,DEFAULT_BACKOFF_FACTOR);
  const maxCooldownMs=finite(allocation.maxCooldownMs,DEFAULT_MAX_COOLDOWN_MS);
  const maxParallelOps=finite(runtimes.maxParallelOps,DEFAULT_MAX_PARALLEL_OPS);
  const policy=typeof allocation.policy==='string'?allocation.policy:LEAST_LOADED;
  const preference=plain(allocation.preference)?allocation.preference:{};
  const live=adoptState(state,utcDay(now()));

  const rollDay=()=>{const today=utcDay(now());if(today===live.day)return;live.day=today;live.usedToday={};live.tokensToday={};};
  const slots=id=>Math.max(0,finite(pools[id]?.maxParallel,1));
  const load=id=>live.loads[id]??0;
  const opsLeft=id=>finite(pools[id]?.budget?.opsPerDay,Infinity)-(live.usedToday[id]??0);
  const tokensLeft=id=>finite(pools[id]?.budget?.tokensPerDay,Infinity)-(live.tokensToday[id]??0);
  const cooling=id=>{const entry=live.cooling[id];return entry&&entry.until>now()?entry:null;};
  const inFlight=()=>ids.reduce((total,id)=>total+load(id),0);
  /** Round-robin tie-break: the runtime right after the last allocated one wins an otherwise exact tie. */
  const rotation=id=>{const last=ids.indexOf(live.lastAllocated);return last<0?ids.indexOf(id):(ids.indexOf(id)-last-1+ids.length)%ids.length;};
  const roleFor=kind=>runtimes.roleOfKind?.[kind]??'implement';
  /** The role's preference order, or null when the role declares none: then least-loaded ranks the pools. */
  const tiers=plain(allocation.tiers)?allocation.tiers:{};
  /** The order for one allocation: the difficulty tier when declared, else the role's preference, else least-loaded. */
  const preferenceOf=(role,difficulty=null)=>{
    if(policy!==PREFER_THEN_OVERFLOW)return null;
    const tier=difficulty&&Array.isArray(tiers[difficulty])?tiers[difficulty].filter(id=>(pools[id]?.roles??[]).includes(role)):null;
    const list=tier&&tier.length?tier:preference[role];
    return Array.isArray(list)&&list.length?list.filter(id=>typeof id==='string'):null;
  };
  /** Position in the preference order; an unlisted but eligible runtime sorts after every preferred one. */
  const rank=(list,id)=>{const at=list.indexOf(id);return at<0?list.length:at;};
  const spend=(id,tokens)=>{if(Number.isFinite(tokens)&&tokens>0)live.tokensToday[id]=(live.tokensToday[id]??0)+tokens;};
  const remainingOf=id=>({ops:orNull(opsLeft(id)),tokens:orNull(tokensLeft(id))});

  /** Rank every pool for one kind: ready candidates in allocation order plus why each other was skipped. */
  const review=(kind,{avoid=[],restrictTo=null,difficulty=null}={})=>{
    rollDay();
    const role=roleFor(kind),ready=[],blocked=[],order=preferenceOf(role,difficulty);
    for(const id of ids){
      const pool=pools[id],cool=cooling(id),free=slots(id)-load(id);
      const reason=!Array.isArray(pool?.roles)||!pool.roles.includes(role)?`no ${role} role`
        :avoid.includes(id)?'avoided'
        :Array.isArray(restrictTo)&&!restrictTo.includes(id)?'not launchable for this operation'
        :cool?`cooling after ${cool.kind} until ${new Date(cool.until).toISOString()}`
        :free<=0?'no free slot'
        :opsLeft(id)<=0?'daily op budget exhausted'
        :tokensLeft(id)<=0?'daily token budget exhausted'
        :null;
      if(reason){blocked.push({runtime:id,reason});continue;}
      ready.push({runtime:id,target:pool.target??id,load:load(id),free,slots:slots(id),ratio:load(id)/slots(id),opsLeft:opsLeft(id),tokensLeft:tokensLeft(id),rotation:rotation(id),preference:order?rank(order,id):null});
    }
    // prefer-then-overflow: the first eligible runtime of the role's order wins, so a saturated or cooling
    // preference simply is not in `ready` and the next one takes the operation without any special case.
    if(order)ready.sort((a,b)=>cmp(a.preference,b.preference)||cmp(a.ratio,b.ratio)||cmp(b.free,a.free)||cmp(a.rotation,b.rotation));
    else ready.sort((a,b)=>cmp(a.ratio,b.ratio)||cmp(b.free,a.free)||cmp(b.opsLeft,a.opsLeft)||cmp(a.rotation,b.rotation));
    return {kind,role,ready,blocked,preference:order};
  };

  return {
    schema:ALLOCATION,
    policy,
    maxParallelOps,
    runtimeIds:[...ids],
    roleFor,
    review,
    /** Pick the runtime for one operation; `avoid` is absolute, `restrictTo` limits the pools to launchable targets. */
    allocate(kind,{avoid=[],restrictTo=null,difficulty=null}={}){
      const {role,ready,blocked,preference:order}=review(kind,{avoid,restrictTo,difficulty});
      if(inFlight()>=maxParallelOps)return {ok:false,kind,role,avoid,blocked,reason:`maxParallelOps ${maxParallelOps} is already in flight; release a slot before allocating ${kind}`};
      if(!ready.length)return {ok:false,kind,role,avoid,blocked,reason:`no runtime with the ${role} role, a free slot and budget for ${kind}: ${blocked.map(item=>`${item.runtime} (${item.reason})`).join(', ')||'no pool declares that role'}`};
      const chosen=ready[0];
      live.loads[chosen.runtime]=chosen.load+1;
      live.usedToday[chosen.runtime]=(live.usedToday[chosen.runtime]??0)+1;
      live.lastAllocated=chosen.runtime;
      return {ok:true,kind,role,runtime:chosen.runtime,target:chosen.target,load:chosen.load+1,slots:chosen.slots,
        remaining:remainingOf(chosen.runtime),alternatives:ready.slice(1).map(item=>item.runtime),blocked,at:now(),
        policy,preference:order,overflowed:Boolean(order)&&chosen.preference>0};
    },
    /** Independent review: the implement runtime is excluded while `verifyAvoidsImplementRuntime` holds. */
    allocateVerify(kind,{implementRuntime=null,avoid=[],restrictTo=null,difficulty=null}={}){
      const strict=allocation.verifyAvoidsImplementRuntime!==false;
      return this.allocate(kind,{avoid:strict&&implementRuntime?[...avoid,implementRuntime]:avoid,restrictTo,difficulty});
    },
    /** An operation that finished: free the slot, charge the tokens it used and clear the failure streak. */
    release(runtime,{tokens=0}={}){
      rollDay();
      need(Object.hasOwn(pools,runtime),`Unknown runtime ${runtime}`);
      live.loads[runtime]=Math.max(0,load(runtime)-1);
      spend(runtime,tokens);
      delete live.streaks[runtime];
      return {ok:true,runtime,load:load(runtime),remaining:remainingOf(runtime)};
    },
    /**
     * A launch or an operation failed: free the slot, refund the op (it produced nothing) and cool the pool
     * down for the classified reason, doubling the wait per consecutive failure up to `maxCooldownMs`.
     */
    failed(runtime,{reason='',tokens=0}={}){
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
      return {ok:false,runtime,kind,failures,cooldownMs:wait,until,wakeAt:new Date(until).toISOString()};
    },
    /** What the kernel prints and logs: loads, remaining budget per pool and every cooling runtime's wake time. */
    snapshot(){
      rollDay();
      return {
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
      need(found,`Runtime target ${target} is not launchable for ${kind}; that operation's environments offer ${chain.map(candidate=>candidate.target).join(', ')||'nothing'}. Add the target to the operation's environments in profiles/registry.yaml, or allocate with restrictTo: launchableTargets('${kind}').`);
      return found;
    }
  };
}
