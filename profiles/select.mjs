import {loadConfig,validateConfig} from '../scripts/config.mjs';
import { readDistJson } from '../core/runtime-root.mjs';
const registry=readDistJson('profiles','registry.json');
const runtimes=Object.fromEntries(registry.runtimes.map(name=>[name,readDistJson('profiles',`${name}.json`)]));
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const normalizeRuntime=runtime=>registry.aliases[runtime]??runtime;
/** Select policy only; never switch models, dispatch workers or grant tools. */
export function selectProfile({runtime,op,profile,config=loadConfig(),model=config.model,effort=config.effort,language=config.language,imageGenerationAvailable=false}) {
  validateConfig({language,model,effort});
  runtime=normalizeRuntime(runtime);
  if(!Object.hasOwn(runtimes,runtime)||typeof op!=='string'||!op||typeof imageGenerationAvailable!=='boolean'||(model!==null&&(typeof model!=='string'||!model.trim())))throw Error('Invalid runtime/profile selection');
  const role=registry.reasoningOps.includes(op)?'reasoning':'working';
  const id=profile??registry.defaults[runtime][role];
  if(!Object.hasOwn(runtimes[runtime].profiles,id))throw Error('Unknown or retired profile');
  const selected=runtimes[runtime].profiles[id];
  if(selected.role!==role)throw Error('Profile role does not own this operator');
  return {runtime,provider:runtimes[runtime].provider,profile:id,role,model:model??selected.model,effort,language,imageGeneration:selected.imageGeneration&&imageGenerationAvailable,allowDeferredArtwork:['claude','qwen'].includes(runtime)&&!selected.imageGeneration};
}

function operatorRoute(skill,op){
  const operator=registry.operators?.[op];
  if(!operator||operator.skill!==skill)throw Error('Unknown skill/operator route');
  const role=registry.reasoningOps.includes(op)?'reasoning':'working';
  const chain=operator.chain??registry.skills?.[skill]?.chains?.[role];
  if(!Array.isArray(chain)||!chain.length)throw Error('Skill/operator chain is missing');
  return {role,chain};
}

/** Return the immutable ordered candidates that an external orchestrator such as Orca may launch. */
export function resolveExecutionChain({skill='starci',op}){
  const {role,chain}=operatorRoute(skill,op),seen=new Set();
  const candidates=chain.map((target,priority)=>{
    if(seen.has(target))throw Error('Duplicate target in execution chain');seen.add(target);
    const route=registry.targets?.[target];
    if(!plain(route))throw Error('Unknown execution target');
    const runtime=normalizeRuntime(route.runtime),profiles=runtimes[runtime]?.profiles,selected=profiles?.[route.profile];
    if(!selected||selected.role!==role)throw Error('Execution target role mismatch');
    if(!plain(route.orcaLaunch)||route.orcaLaunch.kind!=='managed-agent')throw Error('Automatic Orca chains require supervised managed agents');
    return {priority,target,runtime,provider:runtimes[runtime].provider,profile:route.profile,role,model:selected.model,orcaLaunch:structuredClone(route.orcaLaunch)};
  });
  return {schema:'starci/execution-chain@1',skill,op,role,candidates};
}

function inventoryMap(inventory){
  if(!Array.isArray(inventory))throw Error('Observed Orca agent inventory is required');
  const out=new Map();
  for(const item of inventory){
    const value=typeof item==='string'?{runtime:item,status:'ready'}:item;
    if(!plain(value)||typeof value.runtime!=='string'||!['ready','unavailable'].includes(value.status))throw Error('Invalid Orca agent inventory');
    const runtime=normalizeRuntime(value.runtime);
    if(!Object.hasOwn(runtimes,runtime)||out.has(runtime))throw Error('Invalid or duplicate Orca runtime');
    if(value.profiles!==undefined&&(!Array.isArray(value.profiles)||value.profiles.some(x=>typeof x!=='string')))
      throw Error('Invalid Orca profile inventory');
    out.set(runtime,{...value,runtime});
  }
  return out;
}

/** Select the first ready candidate. A failed candidate may be skipped only after verified no effects. */
export function selectExecutionTarget({skill='starci',op,inventory,attempts=[],config=loadConfig()}){
  const chain=resolveExecutionChain({skill,op}),available=inventoryMap(inventory);
  if(!Array.isArray(attempts))throw Error('Invalid execution attempts');
  const attempted=new Map();
  for(const attempt of attempts){
    if(!plain(attempt)||typeof attempt.target!=='string'||attempted.has(attempt.target))throw Error('Invalid execution attempt');
    if(attempt.effectState!==registry.fallback.requiredEffectState)throw Error('Unsafe fallback after partial or unknown effects');
    if(!registry.fallback.allowedReasons.includes(attempt.reason))throw Error('Fallback reason requires reconciliation or user action');
    attempted.set(attempt.target,attempt);
  }
  const skipped=[];
  for(const candidate of chain.candidates){
    if(attempted.has(candidate.target)){skipped.push({target:candidate.target,reason:attempted.get(candidate.target).reason});continue;}
    const observed=available.get(candidate.runtime);
    if(!observed||observed.status!=='ready'){skipped.push({target:candidate.target,reason:'unavailable'});continue;}
    if(observed.profiles&&!observed.profiles.includes(candidate.profile)){skipped.push({target:candidate.target,reason:'unsupported'});continue;}
    const execution=selectProfile({runtime:candidate.runtime,op,profile:candidate.profile,config,imageGenerationAvailable:observed.imageGenerationAvailable===true});
    return {schema:'starci/execution-selection@1',skill,op,selected:{...candidate,...execution},skipped,exhausted:false};
  }
  return {schema:'starci/execution-selection@1',skill,op,selected:null,skipped,exhausted:true};
}
