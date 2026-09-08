import path from 'node:path';

const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.trim().length>0;
const exact=(x,required,optional=[])=>plain(x)&&required.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>required.includes(k)||optional.includes(k));
const unique=xs=>new Set(xs).size===xs.length;
const cleanPath=p=>text(p)&&!p.startsWith('/')&&!p.startsWith('\\')&&!/^[A-Za-z]:/.test(p)&&!p.split(/[\\/]+/).includes('..');
const flags=['business','authorization','schema','architecture','external','destructive','highRisk'];

export function validateFlashPolicy(policy){
  const errors=[];
  if(!exact(policy,['schema','mode','purpose','activation','routes','limits','requiredFacts','eligible','examples','authority','validation'])||policy.schema!=='starci/flash-policy@1'||policy.mode!=='FLASH')return {ok:false,errors:['Invalid FLASH policy']};
  if(!Array.isArray(policy.routes)||!unique(policy.routes)||!['flash','plan','inspect'].every(x=>policy.routes.includes(x)))errors.push('FLASH routes must include flash, plan and inspect');
  if(!plain(policy.limits)||!text(policy.limits.effectCeiling)||!text(policy.limits.paths))errors.push('FLASH limits are incomplete');
  if(!Array.isArray(policy.requiredFacts)||!['mode','operation','repository','scope','impact','checks'].every(x=>policy.requiredFacts.includes(x)))errors.push('FLASH required facts are incomplete');
  if(!Array.isArray(policy.eligible)||!policy.eligible.length||!plain(policy.authority)||!Array.isArray(policy.validation)||!policy.validation.length)errors.push('FLASH constraints are incomplete');
  return {ok:errors.length===0,errors};
}

function validateFacts(facts){
  const errors=[];
  if(!exact(facts,['schema','mode','operation','repository','scope','impact','checks'],['active'])||facts.schema!=='starci/flash-facts@1')return ['A structured FLASH classification is required'];
  if(facts.mode!==null&&facts.mode!=='FLASH')errors.push('Unknown mode; FLASH has no aliases');
  if(!['inspect','edit'].includes(facts.operation))errors.push('Operation must be inspect or edit');
  if(!exact(facts.repository,['id','root','binding'])||![facts.repository.id,facts.repository.root,facts.repository.binding].every(text)||!path.isAbsolute(facts.repository.root))errors.push('Known repository id, absolute root and binding are required');
  if(!exact(facts.scope,['outcome','paths','clear','cohesive'])||!text(facts.scope.outcome)||!Array.isArray(facts.scope.paths)||!facts.scope.paths.length||!facts.scope.paths.every(cleanPath)||!unique(facts.scope.paths))errors.push('Explicit unique repository-relative target paths and outcome are required');
  if(!plain(facts.scope)||typeof facts.scope.clear!=='boolean'||typeof facts.scope.cohesive!=='boolean')errors.push('Scope clarity and cohesion must be explicit booleans');
  if(!exact(facts.impact,flags)||flags.some(k=>typeof facts.impact[k]!=='boolean'))errors.push('Every FLASH impact flag must be explicit');
  if(!Array.isArray(facts.checks)||!facts.checks.length||!facts.checks.every(text)||!unique(facts.checks))errors.push('At least one unique focused check is required');
  if(facts.active!==undefined&&typeof facts.active!=='boolean')errors.push('active must be a boolean');
  return errors;
}

/** Pure policy selection. It neither edits files nor creates approval, Work, or lifecycle records. */
export function selectFlash(policy,facts){
  const policyCheck=validateFlashPolicy(policy);
  if(!policyCheck.ok)throw Error(policyCheck.errors.join('; '));
  const malformed=validateFacts(facts);
  if(malformed.length)throw Error(malformed.join('; '));
  if(facts.operation==='inspect')return {kind:'inspect',reasons:['read-only-inspection']};
  if(facts.mode!=='FLASH')return {kind:'plan',reasons:['explicit-FLASH-opt-in-required']};
  const reasons=[];
  if(facts.active)reasons.push('FLASH-repair-already-active');
  if(!facts.scope.clear)reasons.push('scope-ambiguous');
  if(!facts.scope.cohesive)reasons.push('scope-not-cohesive');
  for(const flag of flags)if(facts.impact[flag])reasons.push(`${flag}-impact`);
  if(reasons.length)return {kind:'plan',reasons};
  return {kind:'flash',request:{
    schema:'starci/flash-request@1',
    mode:'FLASH',
    repository:structuredClone(facts.repository),
    scope:structuredClone(facts.scope),
    checks:structuredClone(facts.checks),
    effectCeiling:'local-source-and-focused-local-checks'
  }};
}

/** Recheck actual mutation scope. Expansion returns Plan; it is never silently absorbed. */
export function recheckFlash(selection,current){
  if(selection?.kind!=='flash'||selection.request?.schema!=='starci/flash-request@1')throw Error('A selected FLASH request is required');
  if(!exact(current,['repository','changedPaths','impact'])||!exact(current.repository,['id','root','binding'])||!Array.isArray(current.changedPaths)||!current.changedPaths.every(cleanPath)||!exact(current.impact,flags)||flags.some(k=>typeof current.impact[k]!=='boolean'))throw Error('Structured current FLASH scope is required');
  const reasons=[];
  const bound=selection.request.repository;
  if(current.repository.id!==bound.id||current.repository.root!==bound.root||current.repository.binding!==bound.binding)reasons.push('repository-binding-changed');
  const allowed=new Set(selection.request.scope.paths);
  if(!unique(current.changedPaths)||current.changedPaths.some(p=>!allowed.has(p)))reasons.push('path-scope-expanded');
  for(const flag of flags)if(current.impact[flag])reasons.push(`${flag}-impact`);
  return reasons.length?{kind:'plan',reasons}:{kind:'flash',request:structuredClone(selection.request)};
}

/** Validate honest focused-check reporting; this does not create acceptance or completion evidence. */
export function validateFlashResult(selection,result){
  const errors=[];
  if(selection?.kind!=='flash'||selection.request?.schema!=='starci/flash-request@1')return {ok:false,errors:['A selected FLASH request is required']};
  if(!exact(result,['repository','changedPaths','impact','checks'])||!exact(result.repository,['id','root','binding'])||!Array.isArray(result.changedPaths)||!exact(result.impact,flags)||flags.some(k=>typeof result.impact[k]!=='boolean')||!Array.isArray(result.checks))return {ok:false,errors:['A structured FLASH result with current impact is required']};
  const scope=recheckFlash(selection,{repository:result.repository,changedPaths:result.changedPaths,impact:result.impact});
  if(scope.kind==='plan')errors.push(...scope.reasons);
  const ids=result.checks.map(x=>x?.id);
  if(!unique(ids))errors.push('Duplicate check results');
  for(const id of selection.request.checks){
    const check=result.checks.find(x=>x?.id===id);
    if(!exact(check??{},['id','status','observation'])||!['pass','fail','unavailable'].includes(check.status)||!text(check.observation))errors.push(`Missing actual result for check: ${id}`);
  }
  if(result.checks.some(x=>!selection.request.checks.includes(x?.id)))errors.push('Unrequested check result');
  return {ok:errors.length===0,errors,verified:errors.length===0&&result.checks.every(x=>x.status==='pass')};
}
