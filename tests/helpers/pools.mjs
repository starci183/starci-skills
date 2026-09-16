/**
 * goal.md §3 names each runtime pool by its independently-quota'd provider window
 * (`codex-agent`, `claude-agent`, `claude-fable`, `qwen-agent`, `devin-agent`) with the
 * model pinned inside the pool per role. Until the profile merges that naming,
 * `model/runtimes.yaml` keys the same pools by their primary model id
 * (`gpt-5.6-sol`, `claude-opus`, ...). These helpers resolve either spelling to the
 * key the loaded profile actually uses, so a spec asserts pool identity and never one
 * spelling. Nothing here widens an assertion: `idOf` returns the exact member key,
 * `poolOf` canonicalizes to the goal pool name.
 */
import fs from 'node:fs';
import {parseYaml} from '../../core/yaml.mjs';

export const GOAL_POOLS=Object.freeze(['codex-agent','claude-agent','claude-fable','qwen-agent','devin-agent']);

/** Model-keyed runtime id -> the goal §3 pool that owns its provider window. */
export const POOL_OF_MODEL=Object.freeze({
  'gpt-5.6-sol':'codex-agent','gpt-5.6-luna':'codex-agent','gpt-6-astra':'codex-agent',
  'claude-opus':'claude-agent','claude-fable-5.1':'claude-fable',
  'qwen3.8-flash':'qwen-agent','devin-agent':'devin-agent'});

/** Canonical goal pool name for any spelling; unknown ids (fixtures) pass through unchanged. */
export const poolOf=id=>POOL_OF_MODEL[id]??id;

/** The runtime key this id resolves to inside `runtimes` (a `profile.runtimes`/`registry.targets` map). */
export const idOf=(runtimes,id)=>runtimes?.[id]?id:POOL_OF_MODEL[id]&&runtimes?.[POOL_OF_MODEL[id]]?POOL_OF_MODEL[id]:id;

/** Every runtime key of `runtimes` that belongs to the goal pool, in profile order. */
export const poolMembers=(runtimes,pool)=>Object.keys(runtimes??{}).filter(id=>poolOf(id)===pool);

export const canonicalPools=ids=>ids.map(poolOf);
export const distinctPools=ids=>[...new Set(ids.map(poolOf))];

/** 'pool' when the profile is keyed by goal §3 pool names, 'model' while keyed by model ids. */
export const namingOf=profile=>Object.keys(profile?.runtimes??{}).some(id=>GOAL_POOLS.includes(id))?'pool':'model';

/** goal §3 pool caps and the global ceiling, for assertions that name a number. */
export const GOAL_POOL_CAPS=Object.freeze({'codex-agent':8,'claude-agent':6,'claude-fable':2,'qwen-agent':4,'devin-agent':0});
export const GOAL_MAX_PARALLEL_OPS=20;

/** A pool that opens only through an explicit owner quota slot (goal §3 `devin-agent`). */
export const quotaGated=(runtimes,id)=>{const key=idOf(runtimes,id);return poolOf(key)==='devin-agent'||runtimes?.[key]?.capacityAuthority==='explicit-workflow-quota';};

/**
 * The prefer-then-overflow expectation for one role: each distinct pool of the preference
 * list contributes its runtime key `maxParallel` times, in preference order. Quota-gated
 * pools contribute nothing until the owner grants them slots. Derived from the loaded
 * profile, so the expectation is exact under either naming.
 */
export function expectedFill(profile,role,{exclude=[]}={}){
  const order=distinctPools(profile.allocation?.preference?.[role]??[]);
  const out=[];
  for(const pool of order){
    if(exclude.map(poolOf).includes(pool))continue;
    const key=poolMembers(profile.runtimes,pool)[0];
    if(!key||quotaGated(profile.runtimes,key))continue;
    out.push(...Array(profile.runtimes[key].maxParallel).fill(key));
  }
  return out;
}

/** Least-loaded order for `role` with no preference list: all-zero load ranks by free slots, ties keep profile order. */
export function expectedLeastLoaded(profile,role){
  return Object.keys(profile.runtimes)
    .filter(id=>profile.runtimes[id].roles?.includes(role)&&!quotaGated(profile.runtimes,id))
    .sort((a,b)=>profile.runtimes[b].maxParallel-profile.runtimes[a].maxParallel);
}

export function loadRuntimeProfile(){
  return parseYaml(fs.readFileSync(new URL('../../model/runtimes.yaml',import.meta.url),'utf8'));
}
