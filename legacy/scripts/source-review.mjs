// Same-mission source re-entry is justified by a separately measured quality result. The original
// source stays accepted history; this forecast binding owns pending replacement and delivery credit.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual as equal } from 'node:util';
import { acceptedProducerProof } from './producer-import.mjs';
import { deliveryRequestErrors } from './mission-scope.mjs';

const SOURCES = { 'backend.generate': 'backend-source-application', 'interface.generate': 'frontend-source-application' };
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const branch = (session, cell) => { if (!/^[1-9]\d*\/[1-9]\d*$/.test(cell)) throw Error('SOURCE_REVIEW_UNBOUND: invalid source coordinate'); const [n,m] = cell.split('/'); return path.join(session, `step-${n}/parallel-${m}`); };
const requestAt = (session, cell) => read(path.join(branch(session,cell),'request/request.json'));
const responseAt = (session, cell) => read(path.join(branch(session,cell),'response/response.json'));
const fail = message => { throw Error(`SOURCE_REVIEW_UNBOUND: ${message}`); };
const samePath = (a,b) => typeof a === 'string' && typeof b === 'string' && (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));
const git = (cwd,...args) => execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
const sourceKind = state => cell => SOURCES[state.steps?.[cell]];
const EMPTY_SHA='sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function prioritizePending(forecast,state,cell) {
  // Retained groups can follow unopened groups in the displayed history. Give this node first
  // pending priority; the planner still emits retained coordinates and actual prerequisites first.
  const first=forecast.chain.findIndex(group=>!group.some(cell=>state.attempts?.[cell]));
  forecast.chain.splice(first<0?forecast.chain.length:first,0,[cell]);
}

async function proofAt(root,session,state,cell,kind) {
  const request = requestAt(session,cell);
  if (request.expected?.goalVersion !== state.mission.version || state.attempts?.[cell]?.status !== 'matched') fail('the original proof must be accepted under the same current mission');
  const authority = deliveryRequestErrors(state,request,root); if(authority.length) fail(authority.join('; '));
  const [step,parallel] = cell.split('/').map(Number);
  const proof = await acceptedProducerProof(root,state.id,step,parallel,kind,{hostRoot:state.workflowOwner.sourceRoot});
  if (!samePath(proof.sessionRoot,session)) fail('proof belongs to another workflow owner');
  return {cell,kind,proof};
}
async function boundProof(root,session,state,binding) {
  const actual = await proofAt(root,session,state,binding.cell,binding.kind);
  if(!equal(binding,actual)) fail('original request, source, repository or evidence manifest changed');
  return requestAt(session,binding.cell);
}
function methodShape(method) {
  if(!method || !/^request\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(method.ref ?? '') || method.ref === 'request/request.json' || !/^sha256:[a-f0-9]{64}$/.test(method.sha256 ?? '') || method.sha256===EMPTY_SHA) fail('review needs an exact nonempty frozen request-side method');
}
function checkMethod(request,method,original) {
  if(!request.frozenInputs?.some(item=>equal(item,method)) || original.frozenInputs?.some(item=>item.sha256===method.sha256)) fail('review requires new method bytes, frozen before execution');
}
function sourceBinding(subject) {
  const alias = subject.kind === SOURCES['backend.generate'] ? '@workspaces/be' : '@workspaces/fe';
  const binding = subject.proof.bindings.find(item=>item.alias===alias && item.worktree && item.repositoryHash);
  if(!binding || subject.proof.heads.length !== 1 || subject.proof.heads[0] !== binding.revision) fail('source must have one actual committed repository binding');
  return binding;
}
async function reviewedSources(root,session,state,forecast,subject) {
  const selected = new Map([[subject.cell,subject]]); let changed=true;
  while(changed) { changed=false;
    for(const cell of forecast.chain.flat()) {
      if(selected.has(cell) || !sourceKind(state)(cell) || state.attempts?.[cell]?.status!=='matched') continue;
      const refs = Object.values(requestAt(session,cell).inputs ?? {});
      if([...selected.values()].some(item=>item.proof.artifactRefs.some(ref=>refs.includes(ref)))) {
        selected.set(cell,await proofAt(root,session,state,cell,sourceKind(state)(cell))); changed=true;
      }
    }
  }
  return [...selected.values()];
}
function counterpartRelated(session,forecast,subject,counterpart) {
  const original=requestAt(session,subject.cell),other=requestAt(session,counterpart.cell);
  if(counterpart.proof.artifactRefs.some(ref=>Object.values(original.inputs ?? {}).includes(ref)) || subject.proof.artifactRefs.some(ref=>Object.values(other.inputs ?? {}).includes(ref))) return true;
  const repair=forecast.sourceRepairs?.[counterpart.cell],prior=repair && forecast.sourceReviews?.[repair.review]?.subject;
  return Boolean(prior && prior.proof.artifactRefs.some(ref=>Object.values(original.inputs ?? {}).includes(ref)));
}
async function checkReview(root,session,state,review) {
  const original = await boundProof(root,session,state,review.subject); sourceBinding(review.subject); methodShape(review.method);
  if(!original.expected.criteria.some(item=>item.id===review.criterionId && item.required)) fail('review must address a required original source criterion');
  for(const other of [...review.counterparts,...review.affected]) await boundProof(root,session,state,other);
  return original;
}
async function resultOf(root,session,state,forecast,cell) {
  if(state.attempts?.[cell]?.status !== 'matched') return null;
  const review = forecast.sourceReviews[cell];
  await proofAt(root,session,state,cell,'quality-verification');
  const request=requestAt(session,cell), response=responseAt(session,cell), attempt=state.attempts[cell];
  const results=(response.fields?.['gate-result'] ?? []).map(ref=>({ref,value:read(path.join(branch(session,cell),ref))}));
  const executed=results.filter(({value})=>value.required && ['pass','fail'].includes(value.status));
  const red=executed.filter(({value})=>value.status==='fail' && value.exitCode!==0 && Number.isInteger(value.exitCode) && value.classification==='in-boundary' && value.debt===null && value.configRef===review.method.ref);
  for(const {value} of red) {
    const entry=attempt.evidenceManifest.files.find(item=>item.ref===value.evidenceRef);
    const times=[attempt.startedAt,attempt.endedAt,value.observedAt].map(Date.parse);
    if(!entry || !readFileSync(path.join(branch(session,cell),value.evidenceRef)).length || times.some(value=>!Number.isFinite(value)) || times[2]<times[0] || times[2]>times[1]) fail('failure diagnostics must be actual nonempty evidence measured inside the accepted review');
    if(value.sourceHead!==sourceBinding(review.subject).revision || !request.requirements.gates.some(gate=>gate.gate===value.gate && gate.required && gate.commandRef===value.commandRef && gate.configRef===value.configRef)) fail('failure must measure the exact declared subject and gate');
  }
  return {red,green:results.length>0 && results.every(({value})=>value.status==='pass' && value.debt===null),proof:await proofAt(root,session,state,cell,'quality-verification')};
}

export async function editSourceReview(root,session,state,forecast,edit) {
  const cell=edit.cell;
  if(edit.kind==='review') {
    const kind=sourceKind(state)(cell); if(!kind) fail('only an accepted source operator can enter source review');
    if(Object.values(forecast.sourceReviews ?? {}).some(value=>value.subject.cell===cell)) fail('source already has its unique review');
    const subject=await proofAt(root,session,state,cell,kind), original=requestAt(session,cell); sourceBinding(subject); methodShape(edit.method);
    if(original.frozenInputs?.some(item=>item.sha256===edit.method.sha256)) fail('the review method must change');
    if(!original.expected.criteria.some(item=>item.id===edit.criterionId && item.required)) fail('name the original required source criterion');
    if(!Array.isArray(edit.gates) || !edit.gates.length || !edit.gates.some(item=>item.required===true && item.configRef===edit.method.ref) || edit.gates.some(item=>!item.commandRef || !item.configRef)) fail('freeze the actual diagnostic gate plan with its changed method as the required gate configuration');
    const counterparts=[];
    for(const counterpart of edit.counterparts ?? []) {
      if(counterpart===cell || counterparts.some(item=>item.cell===counterpart) || !sourceKind(state)(counterpart)) fail('counterpart must be a distinct exact accepted source');
      counterparts.push(await proofAt(root,session,state,counterpart,sourceKind(state)(counterpart)));
    }
    if(counterparts.some(item=>!counterpartRelated(session,forecast,subject,item))) fail('counterpart has no original source dependency or exact repaired predecessor relationship');
    const next=`review:${cell}`, affected=await reviewedSources(root,session,state,forecast,subject);
    (forecast.sourceReviews ??= {})[next]={subject,counterparts,affected,criterionId:edit.criterionId,method:structuredClone(edit.method),gates:structuredClone(edit.gates)};
    forecast.steps[next]='quality.verify'; forecast.nodes[next]=`${forecast.nodes[cell]}:source-review`;
    // The diagnostic enables the same downstream goal without claiming the original source outcome.
    const consumer=Object.keys(forecast.steps).find(target=>!state.attempts?.[target] && target!==next && (forecast.evidenceDependencies[target] ?? []).some(dep=>affected.some(item=>item.cell===dep)));
    if(!consumer) fail('review needs an unopened delivery consumer under the current goal');
    forecast.goals[next]={prerequisite:consumer}; forecast.presets[next]={gates:structuredClone(edit.gates),thresholds:[],explicitE2eRequest:false,sonarScope:'new-code',declaredDebts:[],resume:null};
    forecast.dependencies[next]=[cell,...counterparts.map(item=>item.cell)]; forecast.evidenceDependencies[next]=[...forecast.dependencies[next]];
    forecast.handoffs[next]=cell;
    for(const target of Object.keys(forecast.steps)) if(target!==next && !state.attempts?.[target] && (forecast.evidenceDependencies[target] ?? []).some(dep=>affected.some(item=>item.cell===dep))) forecast.dependencies[target]=[...new Set([...(forecast.dependencies[target] ?? []),next])];
    prioritizePending(forecast,state,next); return;
  }
  const review=forecast.sourceReviews?.[edit.review];
  if(!review || review.subject.cell!==cell) fail('source repair must name its exact declared review');
  const original=await checkReview(root,session,state,review), result=await resultOf(root,session,state,forecast,edit.review);
  if(!result?.red.some(item=>item.ref===edit.gateRef)) fail('source repair requires its executed required in-boundary red gate without debt');
  if(Object.values(forecast.sourceRepairs ?? {}).some(value=>value.source===cell)) fail('source already has its unique repair');
  const replacements={};
  for(const [kind,replacement] of Object.entries(edit.replacements ?? {})) {
    const repair=forecast.sourceRepairs?.[replacement];
    if(!repair || !SOURCES[forecast.steps[replacement]] || SOURCES[forecast.steps[replacement]]!==kind) fail('replacement must be a source repair of the original producer kind');
    const prior=forecast.sourceReviews[repair.review].subject;
    if(!prior.proof.artifactRefs.includes(original.inputs?.[kind])) fail('replacement does not replace an original producer input');
    const proof=await proofAt(root,session,state,replacement,kind);
    if(!review.counterparts.some(item=>equal(item,proof))) fail('review did not measure the exact replacement counterpart');
    replacements[kind]={prior,replacement:proof};
  }
  const next=`source-repair:${cell}`;
  for(const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','units','imports','partitions']) if(forecast[field]?.[cell]!==undefined) (forecast[field] ??= {})[next]=structuredClone(forecast[field][cell]);
  forecast.presets[next]=structuredClone(original.requirements); forecast.nodes[next]=`${forecast.nodes[cell]}:source-repair`;
  forecast.dependencies[next]=[...new Set([...(forecast.dependencies[next] ?? []),edit.review,...Object.values(replacements).map(item=>item.replacement.cell)])];
  forecast.evidenceDependencies[next]=[...new Set([...(forecast.evidenceDependencies[next] ?? []),...Object.values(replacements).map(item=>item.replacement.cell)])];
  (forecast.sourceRepairs ??= {})[next]={source:cell,review:edit.review,gateRef:edit.gateRef,diagnostic:result.proof,replacements};
  for(const target of Object.keys(forecast.steps)) if(target!==next && !state.attempts?.[target]) {
    for(const field of ['dependencies','evidenceDependencies']) forecast[field][target]=(forecast[field][target] ?? []).map(dep=>dep===cell ? next : dep);
    if(forecast.handoffs?.[target]===cell) forecast.handoffs[target]=next;
    if(forecast.units?.[target]) forecast.units[target].dependsOn=(forecast.units[target].dependsOn ?? []).map(dep=>dep===cell ? next : dep);
  }
  prioritizePending(forecast,state,next);
}

export function remapSourceReviews(forecast,map) {
  for(const review of Object.values(forecast.sourceReviews ?? {})) {
    for(const item of [review.subject,...review.counterparts,...review.affected]) item.cell=map(item.cell);
  }
  for(const repair of Object.values(forecast.sourceRepairs ?? {})) { repair.source=map(repair.source); repair.review=map(repair.review); }
}

// A fresh forecast under the same confirmation cannot erase a review or resurrect retired proof.
// These records may address retained execution outside its current display chain.
export function carrySourceReviews(forecast,prior) {
  for(const key of ['sourceReviews','sourceRepairs']) if(Object.keys(prior?.[key] ?? {}).length) forecast[key]={...structuredClone(prior[key]),...(forecast[key] ?? {})};
}

export async function sourceReviewCoverage(root,session,state,forecast) {
  const errors=[],pending=[],retired=new Set(),obligations=new Map();
  if(!forecast) return {errors,pending,retiredSources:[]};
  for(const [cell,review] of Object.entries(forecast.sourceReviews ?? {})) try {
    await checkReview(root,session,state,review);
    for(const subject of review.affected) if(!obligations.has(subject.cell)) obligations.set(subject.cell,{subject,reviewCell:cell});
  }catch(error){errors.push(error.message);}
  for(const [sourceCell,{subject,reviewCell}] of obligations) try {
    const own=Object.entries(forecast.sourceReviews ?? {}).find(([,item])=>item.subject.cell===sourceCell), cell=own?.[0] ?? reviewCell;
    const result=own ? await resultOf(root,session,state,forecast,cell) : null;
    const pair=Object.entries(forecast.sourceRepairs ?? {}).find(([,item])=>item.source===sourceCell);
    let resolved=Boolean(result?.green);
    if(result?.red.length) { retired.add(sourceCell);
      if(pair && state.attempts?.[pair[0]]?.status==='matched') {
        const admission=await sourceReviewAdmissionErrors(root,session,state,requestAt(session,pair[0]),forecast);
        if(admission.length) fail(admission.join('; '));
        await proofAt(root,session,state,pair[0],subject.kind); resolved=true;
      }
    }
    if(!resolved) pending.push({sourceCell,goal:requestAt(session,sourceCell).goal,reviewCell:cell,...(pair?{repairCell:pair[0]}:{}),...(forecast.partitions?.[sourceCell]?{partition:forecast.partitions[sourceCell]}:{})});
  }catch(error){errors.push(error.message);}
  return {errors,pending,retiredSources:[...retired]};
}

export async function sourceReviewAdmissionErrors(root,session,state,request,forecast) {
  const errors=[],cell=`${request.step}/${request.parallel}`,review=forecast.sourceReviews?.[cell],repair=forecast.sourceRepairs?.[cell];
  try {
    if(review) {
      const original=await checkReview(root,session,state,review), binding=sourceBinding(review.subject);
      if(request.operatorId!=='quality.verify' || !equal(request.requirements.gates,review.gates) || (request.requirements.declaredDebts ?? []).length || request.inputs?.[review.subject.kind]!==review.subject.proof.artifactRefs[0]) fail('review must measure its exact source with the frozen debt-free gate plan');
      for(const kind of Object.values(SOURCES)) if(kind!==review.subject.kind && request.inputs?.[kind]) fail('a review measures one producer head; counterpart proof is frozen context');
      if((request.environment?.writes ?? []).some(ref=>ref!=='response') || (request.environment?.exclusive ?? []).length || !samePath(request.environment?.workspace?.worktree,binding.worktree) || request.environment.workspace.alias!==binding.alias || request.environment.workspace.revision!==binding.revision || request.contexts?.find(item=>item.alias===binding.alias)?.head!==binding.revision) fail('source review is readonly at its exact bound head');
      if(!state.attempts?.[cell] && git(binding.worktree,'rev-parse','HEAD')!==binding.revision) fail('fresh review must execute at the actual subject checkout HEAD');
      checkMethod(request,review.method,original);
      for(const other of review.counterparts) { const bound=sourceBinding(other); if(!request.contexts?.some(item=>item.alias===bound.alias && item.head===bound.revision)) fail('counterpart repository head is not frozen in the review'); }
      return errors;
    }
    if(repair) {
      const item=forecast.sourceReviews[repair.review],original=await checkReview(root,session,state,item),result=await resultOf(root,session,state,forecast,repair.review);
      if(!result?.red.some(entry=>entry.ref===repair.gateRef) || !equal(result.proof,repair.diagnostic)) fail('source repair has no unchanged genuine failed diagnostic');
      const inputs=structuredClone(original.inputs ?? {});
      for(const [kind,replacement] of Object.entries(repair.replacements)) { await boundProof(root,session,state,replacement.prior); await boundProof(root,session,state,replacement.replacement); if(!replacement.prior.proof.artifactRefs.includes(inputs[kind]) || !item.counterparts.some(other=>equal(other,replacement.replacement))) fail('source input substitution is not the reviewed exact producer repair'); inputs[kind]=replacement.replacement.proof.artifactRefs[0]; }
      for(const other of Object.values(forecast.sourceRepairs ?? {})) {
        const prior=forecast.sourceReviews[other.review].subject;
        if(prior.proof.artifactRefs.some(ref=>Object.values(inputs).includes(ref))) fail('repair cannot consume a retired original producer instead of its accepted replacement');
      }
      if(request.operatorId!==original.operatorId || request.attempt?.kind!=='repair' || request.attempt.previous!==original.attempt.id || request.attempt.number!==original.attempt.number+1 || request.resume || !equal(request.unit,original.unit) || !equal(request.requirements,original.requirements) || !equal(request.inputs,inputs)) fail('repair must preserve the original owner, unit, requirements and inputs except exact repaired counterpart');
      if(!equal(request.goal,original.goal)) fail('repair cannot change the original source goal obligation');
      const {expectedNotWeakenedErrors}=await import('./validate-request.mjs');
      const expectedErrors=expectedNotWeakenedErrors(original.expected,request.expected);
      if(expectedErrors.length) fail(expectedErrors.join('; '));
      if(Object.entries(state.attempts ?? {}).some(([other,value])=>other!==cell && value.previous===original.attempt.id)) fail('accepted source already has another successor');
      for(const field of ['writes','exclusive','mode','outputRoot']) if(!equal(request.environment?.[field],original.environment?.[field])) fail('repair may not expand effect or resource authority');
      const binding=sourceBinding(item.subject),workspace=request.environment?.workspace;
      if(workspace?.alias!==binding.alias || !samePath(workspace.worktree,binding.worktree) || request.contexts?.find(context=>context.alias===binding.alias)?.head!==workspace.revision) fail('repair cannot change its source repository, role or checkout');
      checkMethod(request,item.method,original);
      git(workspace.worktree,'merge-base','--is-ancestor',binding.revision,workspace.revision);
      // Opening checks current HEAD; accepted replay is judged in its immutable invocation context.
      if(!state.attempts?.[cell] && git(workspace.worktree,'rev-parse','HEAD')!==workspace.revision) fail('repair base must be the actual current source head');
      return errors;
    }
    // Do not recursively replay unrelated ancestors while their operator is validating an Input.
    // Only consumers of a reviewed source need this delivery barrier; goal credit has its own join.
    const possible=Object.values(forecast.sourceReviews ?? {}).flatMap(item=>item.affected);
    const named=new Set([...(forecast.dependencies?.[cell] ?? []),...(forecast.evidenceDependencies?.[cell] ?? [])]);
    if(!possible.some(item=>item.cell!==cell && (named.has(item.cell) || item.proof.artifactRefs.some(ref=>Object.values(request.inputs ?? {}).includes(ref))))) return errors;
    const coverage=await sourceReviewCoverage(root,session,state,forecast); errors.push(...coverage.errors);
    const blocked=new Set([...coverage.pending.map(item=>item.sourceCell),...coverage.retiredSources]);
    const dependencies=new Set([...(forecast.dependencies?.[cell] ?? []),...(forecast.evidenceDependencies?.[cell] ?? [])]);
    for(const source of blocked) {
      if(source===cell) continue;
      const kind=sourceKind(state)(source); if(!kind) continue;
      const response=responseAt(session,source),ref=response.fields[kind],full=`step-${source.split('/')[0]}/parallel-${source.split('/')[1]}/${ref}`;
      if(dependencies.has(source) || Object.values(request.inputs ?? {}).includes(full)) errors.push('SOURCE_REVIEW_PENDING: this consumer requires the verified replacement of its reviewed source');
    }
  } catch(error) { errors.push(error.message); }
  return errors;
}
