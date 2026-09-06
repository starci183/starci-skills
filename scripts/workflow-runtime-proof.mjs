import {createHash} from 'node:crypto';
import {readFileSync, realpathSync, lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const hash=value=>'sha256:'+createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')}}`:JSON.stringify(value);
const requireThat=(condition,reason)=>{if(!condition)throw Error('COORDINATION_RUNTIME: '+reason);};
const instant=(value,label)=>{const at=Date.parse(value);requireThat(Number.isFinite(at),label+' requires a finite timestamp');return at;};
const fullHead=value=>/^[a-f0-9]{40}$/.test(value??'');
const refs=value=>Array.isArray(value)?value:value?[value]:[];
function safeFile(base,ref){
 requireThat(typeof ref==='string'&&!path.isAbsolute(ref)&&!path.win32.isAbsolute(ref)&&!/[\\:\0]/.test(ref)&&ref.split('/').every(part=>part&&part!=='.'&&part!=='..'),'evidence reference must be session-relative');
 let target=base;for(const part of ref.split('/')){target=path.join(target,part);requireThat(!lstatSync(target).isSymbolicLink(),'evidence cannot traverse a symlink');}
 const relative=path.relative(realpathSync(base),realpathSync(target));requireThat(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'evidence escaped its owner');return target;
}
function document(proof,ref){
 const state=JSON.parse(readFileSync(safeFile(proof.sessionRoot,'state.json'),'utf8'));
 const attempt=state.attempts?.[`${proof.step}/${proof.parallel}`];
 requireThat(attempt?.status==='matched'&&attempt.id===proof.attemptId&&attempt.evidenceManifest?.fingerprint===proof.manifestFingerprint,'accepted producer identity or seal changed during evidence reading');
 const prefix=`${proof.ref}/`;requireThat(ref.startsWith(prefix),'artifact must belong to its accepted producer');
 const relative=ref.slice(prefix.length),entry=attempt?.evidenceManifest?.files.find(file=>file.ref===relative);
 const bytes=readFileSync(safeFile(proof.sessionRoot,ref));requireThat(entry&&entry.sha256===hash(bytes),'artifact changed or was not sealed by its original producer');
 return JSON.parse(bytes);
}
function envelope(proof){
 const state=JSON.parse(readFileSync(safeFile(proof.sessionRoot,'state.json'),'utf8'));
 const requestBytes=readFileSync(safeFile(proof.sessionRoot,proof.requestRef));requireThat(hash(requestBytes)===proof.requestHash,'accepted producer request changed during evidence reading');
 const request=JSON.parse(requestBytes);
 const response=document(proof,proof.responseRef),attempt=state.attempts[`${proof.step}/${proof.parallel}`];
 return{state,request,response,attempt};
}
function output(proof,response,kind){const all=refs(response.fields?.[kind]);requireThat(all.length===1,kind+' must have one declared accepted artifact');return document(proof,`${proof.ref}/${all[0]}`);}
function selected(selector,label){requireThat(selector&&typeof selector.sessionId==='string'&&Number.isSafeInteger(selector.step)&&selector.step>0&&Number.isSafeInteger(selector.parallel)&&selector.parallel>0,label+' requires an exact current producer selector');}
function endpoint(url){let result;try{result=new URL(url);}catch{throw Error('COORDINATION_RUNTIME: tested endpoint is invalid');}requireThat(['http:','https:'].includes(result.protocol)&&!result.username&&!result.password,'tested endpoint must be HTTP(S) without credentials');return result;}

// Pure join of records whose original current producer and byte seals the public reader verifies.
// This does not upgrade context heads to served heads and supplies no receipt acceptance shortcut.
export function joinRuntimeEvidence({alias,routeKey,env,pinned,project,coordination,before,after,verification}){
 requireThat(['@workspaces/fe','@workspaces/be'].includes(alias),'integration requires an explicit frontend or backend source role');
 requireThat(coordination?.coordinatorSessionId&&coordination?.assignment,'combined verification must freeze its coordinator and assignment');
 const role=alias.slice(-2);requireThat(routeKey===`${project}/${role}`,'runtime route must belong to the verifier project and exact source role');
 requireThat(fullHead(pinned),'verifier must pin the source role explicitly');
 for(const [label,record] of [['before',before],['after',after]]){
  requireThat(record.coordination?.coordinatorSessionId===coordination.coordinatorSessionId&&canonical(record.coordination?.assignment)===canonical(coordination.assignment),'runtime '+label+' does not freeze the same coordinator assignment');
  requireThat(record.routeKey===routeKey&&record.env===env&&record.wantedCommit===pinned,'runtime '+label+' differs from the frozen role, environment or source commit');
  requireThat(record.entry.status==='ready'&&record.entry.lease===null&&fullHead(record.entry.head)&&record.entry.contains?.includes(pinned),'runtime '+label+' is not ready with the exact wanted ancestry');
  requireThat(record.source.head===record.entry.head&&record.source.wantedCommit===pinned&&record.source.ancestor===true&&record.source.worktree===record.entry.server?.worktree,'runtime '+label+' lacks measured serving checkout identity');
  requireThat(instant(record.startedAt,label+' start')<=instant(record.finishedAt,label+' end'),'runtime observation order is invalid');
 }
 const projection=record=>({routeKey:record.routeKey,env:record.env,head:record.entry.head,contains:record.entry.contains,generation:record.entry.generation,server:record.entry.server,endpoints:record.entry.endpoints,source:record.source});
 requireThat(canonical(projection(before))===canonical(projection(after)),'served runtime changed across the verification interval');
 const start=instant(verification.startedAt,'verification start'),end=instant(verification.finishedAt,'verification end');
 requireThat(start<=end&&instant(before.finishedAt,'before finish')<=start&&instant(after.startedAt,'after start')>=end,'accepted runtime observations must bracket the actual verification run');
 requireThat(verification.role===role&&verification.commit===pinned,'actual verification names a different source role or commit');
 requireThat(verification.servedHead===before.entry.head,'actual verification names another served head');
 const declared=endpoint(before.entry.endpoints?.[role==='fe'?'frontend':'api']);
 requireThat(verification.urls.length>0,'actual verification has no measured endpoint');
 for(const raw of verification.urls){const measured=endpoint(raw);requireThat(measured.origin===declared.origin,'actual tested endpoint has a foreign runtime origin');if(role==='be')requireThat(measured.pathname===declared.pathname,'API test targeted another endpoint path');}
 return{alias,revision:before.entry.head,worktree:before.source.worktree,endpoint:declared.href,runtimeFingerprint:hash(canonical({before:before.fingerprint,after:after.fingerprint,entry:projection(before),verification}))};
}

async function runtimeRecord(root,selector,hostRoot){
 selected(selector,'runtime');const {acceptedProducerProof}=await import('./producer-import.mjs');
 const proof=await acceptedProducerProof(root,selector.sessionId,selector.step,selector.parallel,'delta',{hostRoot});
 requireThat(proof.operatorId==='runtime.serve','runtime proof must be emitted by runtime.serve');
 const {request,response,attempt}=envelope(proof),delta=output(proof,response,'delta');
 requireThat(delta.convergence==='already-converged'&&delta.noOpProof,'runtime proof needs measured immutable paired endpoints; mutation-only prose is insufficient');
 const observations=[];
 for(const address of [delta.noOpProof.before,delta.noOpProof.after]){
  const bytes=readFileSync(safeFile(proof.sessionRoot,`${proof.ref}/${address.ref}`));requireThat(hash(bytes)===address.sha256,'runtime observation digest changed');
  const observation=document(proof,`${proof.ref}/${address.ref}`),registryAddress=observation.registry;
  const registryBytes=readFileSync(safeFile(proof.sessionRoot,`${proof.ref}/${registryAddress.ref}`));requireThat(hash(registryBytes)===registryAddress.sha256,'captured registry digest changed');
  const registry=document(proof,`${proof.ref}/${registryAddress.ref}`),entry=registry.runtimes?.[request.requirements.routeKey];
  requireThat(entry&&observation.routeKey===request.requirements.routeKey,'observation measured another registry route');
  observations.push({observation,entry});
 }
 requireThat(canonical(observations[0].entry)===canonical(observations[1].entry),'runtime changed within its own observation proof');
 const first=observations[0],last=observations[1];
 requireThat(first.entry.head===delta.runtimeLadder?.servedHead&&first.entry.generation===delta.generation,'delta does not attest the measured served generation');
 return{routeKey:request.requirements.routeKey,env:request.requirements.env,wantedCommit:request.requirements.commit,coordination:request.coordination,entry:last.entry,source:last.observation.source,startedAt:attempt.startedAt,finishedAt:attempt.endedAt,fingerprint:proof.manifestFingerprint};
}

async function verificationRecord(root,selector,hostRoot,mainRequest,mainProof,role){
 selected(selector,'verification');const wantedKind=role==='fe'?'uat-flow-verification':'api-verification';requireThat(selector.kind===wantedKind,'verification kind does not prove the requested role');
 const {acceptedProducerProof}=await import('./producer-import.mjs');
 const proof=await acceptedProducerProof(root,selector.sessionId,selector.step,selector.parallel,wantedKind,{hostRoot});
 const {state,request,response,attempt}=envelope(proof);
 requireThat(proof.operatorId===(role==='fe'?'uat.verify':'api.verify'),'verification has another owning operator');
 requireThat(state.project===mainProof.project&&request.requirements.env===mainRequest.requirements.env,'verifier project or environment differs');
 requireThat(request.coordination?.coordinatorSessionId===mainRequest.coordination?.coordinatorSessionId&&canonical(request.coordination?.assignment)===canonical(mainRequest.coordination?.assignment),'verification does not freeze the same assignment');
 const id=mainRequest.coordination.integration.criterionId;
 requireThat(request.expected?.criteria?.some(item=>item.id===id&&item.required)&&response.comparison?.criteria?.some(item=>item.criterionId===id&&item.verdict==='matched'),'verification does not prove the mandatory integrated criterion');
 requireThat(canonical(request.coordination?.integration?.repositories)===canonical(mainRequest.coordination.integration.repositories),'verification does not freeze the same integrated repository tuple');
 const commit=request.contexts?.find(context=>context.alias===`@workspaces/${role}`)?.head;
 let servedHead,urls,start=attempt.startedAt,end=attempt.endedAt;
 if(role==='be'){
  const cases=output(proof,response,'api-cases');requireThat(cases.commit===commit&&cases.servedContainsCommit===true&&cases.exitCode===0,'API result does not attest the pinned commit');
  requireThat(instant(cases.startedAt,'API run start')>=instant(start,'API attempt start')&&instant(cases.startedAt,'API run start')<=instant(end,'API attempt end'),'API run is outside its current accepted invocation');
  servedHead=cases.servedHead;urls=[cases.endpoint];
 }else{
  const snapshot=output(proof,response,'uat-snapshot');requireThat(snapshot.provenance?.fe===commit&&snapshot.isolation?.servedContainsCommit===true,'browser result does not attest the pinned frontend');servedHead=snapshot.isolation.servedHead;
  const results=refs(response.fields?.['walk-result']).map(ref=>document(proof,`${proof.ref}/${ref}`));
  requireThat(results.length>0&&results.every(result=>result.outcome==='pass'),'frontend verification requires actual successful browser walk records');
  urls=results.flatMap(result=>{requireThat(instant(result.startedAt,'walk start')>=instant(start,'browser attempt start')&&instant(result.finishedAt,'walk end')<=instant(end,'browser attempt end'),'browser walk is outside its current accepted invocation');return[result.route,...result.steps.map(step=>step.url).filter(Boolean)];});
 }
 return{role,commit,servedHead,urls,startedAt:start,finishedAt:end,fingerprint:proof.manifestFingerprint};
}

export async function verifiedIntegrationBindings(root,verifierProof,verifierRequest,integration,{hostRoot=path.dirname(root)}={}){
 const {acceptedProducerProof}=await import('./producer-import.mjs');
 requireThat(['uat.verify','api.verify','quality.verify'].includes(verifierProof.operatorId),'integrated criterion requires a declared current verifier');
 const kind=verifierProof.operatorId==='uat.verify'?'uat-flow-verification':verifierProof.operatorId==='api.verify'?'api-verification':'quality-verification';
 const current=await acceptedProducerProof(root,verifierProof.sessionId,verifierProof.step,verifierProof.parallel,kind,{hostRoot});
 requireThat(current.requestHash===verifierProof.requestHash&&current.manifestFingerprint===verifierProof.manifestFingerprint,'main verifier proof changed');
 const main=envelope(current);requireThat(canonical(main.request)===canonical(verifierRequest)&&canonical(main.request.coordination?.integration)===canonical(integration),'integration must be frozen in the exact current verifier request');
 requireThat(Array.isArray(integration?.runtime)&&integration.runtime.length>0,'integrated runtime selectors are required');
 requireThat(new Set(integration.runtime.map(item=>item.alias)).size===integration.runtime.length,'each source role has exactly one runtime tuple');
 const bindings=[];
 for(const selector of integration.runtime){
  const role=selector.alias?.slice(-2),pinned=verifierRequest.contexts?.find(context=>context.alias===selector.alias)?.head;
  const before=await runtimeRecord(root,selector.before,hostRoot),after=await runtimeRecord(root,selector.after,hostRoot);
  requireThat(before.fingerprint!==after.fingerprint,'before and after must be distinct accepted runtime observations');
  const verification=await verificationRecord(root,selector.verification,hostRoot,verifierRequest,{project:main.state.project},role);
  const binding=joinRuntimeEvidence({alias:selector.alias,routeKey:selector.routeKey,env:verifierRequest.requirements.env,pinned,project:main.state.project,coordination:verifierRequest.coordination,before,after,verification});
  const git=args=>execFileSync('git',['-C',binding.worktree,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  requireThat(path.isAbsolute(binding.worktree)&&git(['rev-parse','HEAD'])===binding.revision,'serving worktree moved after integrated verification');
  git(['merge-base','--is-ancestor',pinned,binding.revision]);
  const common=git(['rev-parse','--git-common-dir']),real=realpathSync(path.isAbsolute(common)?common:path.resolve(binding.worktree,common));
  binding.repositoryHash=hash(process.platform==='win32'?real.toLowerCase():real);bindings.push(binding);
 }
 return bindings.sort((a,b)=>a.alias.localeCompare(b.alias));
}
