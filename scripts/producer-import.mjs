import { locateWorkflowSession, RUNTIME_REVISION } from './workflow-root.mjs';
import { existsSync, lstatSync, realpathSync, readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, kindOf } from './operator-md.mjs';
import { packageForOrigin } from './retired-operators.mjs';
import { withSessionLock } from './session-lock.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const positive=v=>Number.isSafeInteger(v)&&v>0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const currentMarked=(...documents)=>documents.some(value=>value?.contractVersion!==undefined||value?.runtimeRevision!==undefined);
const safeRelative=p=>typeof p==='string'&&p.length>0&&!path.isAbsolute(p)&&!path.win32.isAbsolute(p)&&!/[\\:\0]/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..');
function within(base,relative,{missing=false}={}){
  if(!safeRelative(relative))throw Error('unsafe import path');
  let current=base;
  for(const piece of relative.split('/')){
    current=path.join(current,piece);
    if(!existsSync(current)){if(missing)continue;throw Error('import file is missing');}
    if(lstatSync(current).isSymbolicLink())throw Error('import symlinks are forbidden');
    const rel=path.relative(realpathSync(base),realpathSync(current));
    if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('import realpath escaped its root');
  }
  return current;
}
function roots(hostRoot,sourceSessionId,targetSessionId,sourceStep,sourceParallel,targetStep,targetParallel){
  if(!ID.test(sourceSessionId)||!ID.test(targetSessionId)||sourceSessionId===targetSessionId||![sourceStep,sourceParallel,targetStep,targetParallel].every(positive))throw Error('import session IDs and coordinates must be strict and distinct');
  const origin=locateWorkflowSession(hostRoot,sourceSessionId),destination=locateWorkflowSession(hostRoot,targetSessionId);
  const archive=origin.archive;
  const sourceSession=origin.session,targetSession=destination.session;
  const source=within(sourceSession,`step-${sourceStep}/parallel-${sourceParallel}`);
  const target=within(targetSession,`step-${targetStep}/parallel-${targetParallel}`,{missing:true});
  return {sourceSession,targetSession,source,target,archive};
}
// The evidence range: imported slots sit at step numbers from resources/orchestrator.json#session.imports.stepBase upward, where no chain cell is ever numbered.
export function importStepBase(root){try{return JSON.parse(readFileSync(path.join(root,'resources','orchestrator.json'),'utf8')).session?.imports?.stepBase??100;}catch{return 100;}}
// The range is enforced where a new import is written, never on read: a slot already on disk was lawful when it was written and its bytes are still held by the import gate.
function withinEvidenceRange(step,stepBase){if(!(Number.isInteger(step)&&step>=stepBase))throw Error(`import coordinate step ${step} is below the evidence range (orchestrator.json#session.imports.stepBase = ${stepBase}); a chain is numbered from 1 and must never grow onto an imported slot`);}
function evidenceOnly(targetSession,step,parallel){
  const state=json(within(targetSession,'state.json')),key=`${step}/${parallel}`;
  if(state.steps?.[key]!==undefined||state.requestHashes?.[key]!==undefined||state.current===key||(state.chain??[]).flat(Infinity).includes(key)||JSON.stringify(state.leases??{}).includes(`"${key}"`))throw Error('import coordinate is reserved for executed work; imports are evidence-only');
}
function inventory(base){
  const files=[];
  const walk=relative=>{const dir=within(base,relative);for(const name of readdirSync(dir).sort()){const rel=relative+'/'+name,full=within(base,rel),stat=lstatSync(full);if(stat.isDirectory())walk(rel);else if(stat.isFile())files.push({path:rel,sha256:hash(readFileSync(full))});else throw Error('import only accepts regular files');}};
  walk('request');walk('response');
  if(files.length>512)throw Error('producer bundle exceeds the bounded import inventory');
  return files.sort((a,b)=>a.path.localeCompare(b.path));
}
function metadata(source,manifest){
  const request=json(within(source,'request/request.json')),response=json(within(source,'response/response.json'));
  if(request.sessionId!==manifest.sourceSessionId||request.step!==manifest.sourceStep||request.parallel!==manifest.sourceParallel||response.step!==manifest.sourceStep||response.parallel!==manifest.sourceParallel||request.operatorId!==response.operatorId||response.status!=='done')throw Error('origin is not the named completed producer');
  return {request,response};
}
async function originalProducer(r,m){
  if(r.archive){
    const {verifyRetention}=await import('./session-cleanup.mjs');
    const retained=await verifyRetention(r.archive,json(within(r.archive,'retention.json')));
    if(retained.id!==m.sourceSessionId)throw Error('retained origin is not the requested source session');
  }
  if(existsSync(path.join(r.source,'import.json')))throw Error('an imported slot cannot be laundered into a new producer');
  const original=metadata(r.source,m),state=json(within(r.sourceSession,'state.json')),key=`${m.sourceStep}/${m.sourceParallel}`;
  if(state.id!==m.sourceSessionId||state.steps?.[key]!==original.request.operatorId||state.requestHashes?.[key]!==hash(readFileSync(within(r.source,'request/request.json'))))throw Error('origin request does not match its original session operator and frozen request hash');
  try{for(const refs of Object.values(original.response.fields??{}))for(const ref of Array.isArray(refs)?refs:[refs])if(!lstatSync(within(r.source,ref)).isFile())throw Error('not a file');}catch{throw Error('origin output is missing or unsafe');}
  return {...original,state,key};
}
async function currentProducerProof(root,r,m,original){
  const {request,response,state,key}=original;
  const {V22_CONTRACT}=await import('./validate-request.mjs');
  if(state.runtimeRevision!==RUNTIME_REVISION||state.upgrade||state.contractVersion!==V22_CONTRACT||request.contractVersion!==V22_CONTRACT||response.contractVersion!==V22_CONTRACT)throw Error('current producer requires an original current runtime revision and matching contracts; legacy evidence is not current proof');
  const attempt=state.attempts?.[key],ref=`step-${m.sourceStep}/parallel-${m.sourceParallel}`;
  if(!attempt||attempt.status!=='matched'||!attempt.endedAt)throw Error('current producer has no matched accepted attempt');
  if(request.exchange!==undefined||attempt.id!==request.attempt?.id||attempt.id!==response.attempt?.id||attempt.operatorId!==request.operatorId
    ||attempt.number!==request.attempt?.number||attempt.number!==response.attempt?.number
    ||attempt.kind!==request.attempt?.kind||attempt.previous!==request.attempt?.previous
    ||attempt.expectedVersion!==request.expected?.version||attempt.expectedVersion!==response.attempt?.expectedVersion
    ||attempt.expectedHash!==hash(Buffer.from(JSON.stringify(request.expected)))||!same(attempt.expected,request.expected)
    ||!same(attempt.frozenInputs,request.frozenInputs)||attempt.requestRef!==`${ref}/request/request.json`||attempt.responseRef!==`${ref}/response/response.json`
    ||response.comparison?.verdict!=='matched'||response.comparison?.next!=='advance'||!same(attempt.comparison,response.comparison))throw Error('current producer identity differs from its original accepted attempt');
  const sealed=await evidenceManifestErrors(r.source,attempt.evidenceManifest);
  if(sealed.length)throw Error('current producer accepted '+sealed.join('; '));
  // Current receipts owe the complete output contract. Only request dispatch state is historical:
  // the original operator law replays at acceptance phase, including its nested exchanges.
  const {validateResponse}=await import('./validate-response.mjs');
  const typed=await validateResponse(root,r.source,{requirements:request.requirements??{}});
  if(typed.errors.length)throw Error('current producer fails its full typed output gate: '+typed.errors.slice(0,2).join('; '));
  const {validateStep}=await import('./validate-step.mjs');
  const checked=await validateStep(root,r.source,{origin:true,operator:true,requestPhase:'accept'});
  if(checked.errors.length)throw Error('current producer fails its accepted operator gate: '+checked.errors.slice(0,2).join('; '));
  const stable=await evidenceManifestErrors(r.source,attempt.evidenceManifest);
  if(stable.length)throw Error('current producer changed during proof validation: '+stable.join('; '));
  return {sessionId:m.sourceSessionId,step:m.sourceStep,parallel:m.sourceParallel,operatorId:request.operatorId,attemptId:attempt.id,
    ref,requestRef:attempt.requestRef,requestHash:state.requestHashes[key],responseRef:attempt.responseRef,manifestFingerprint:attempt.evidenceManifest.fingerprint};
}
async function originAuthority(root,r,m,{requireCurrent=false}={}){
  const original=await originalProducer(r,m);
  // A current marker never falls back to the legacy compatibility gate, including partial downgrades.
  if(currentMarked(original.request,original.response,original.state)){
    await currentProducerProof(root,r,m,original);return original;
  }
  if(requireCurrent)throw Error('current receiver requires an original accepted current producer; legacy evidence is inspection-only');
  // Legacy output-only compatibility is restricted to legacy inspection receivers. It cannot
  // supply Inputs to a current workflow or satisfy the exported current proof checker.
  const {validateResponse}=await import('./validate-response.mjs');
  const result=await validateResponse(root,r.source,{requirements:original.request.requirements??{},origin:true});
  if(result.errors.length)throw Error('origin response fails its typed output gate: '+result.errors.slice(0,2).join('; '));
  return original;
}

// Read-only exact original proof, shared by imports and coordinated consumer admission. References
// are relative to the original session. Repository identity is the normalized Git common directory;
// a context-only binding has no verified repository identity until a proving workspace supplies it.
export async function acceptedProducerProof(root,sessionId,step,parallel,kind,{hostRoot=path.dirname(root)}={}){
  if(!ID.test(sessionId)||![step,parallel].every(positive)||typeof kind!=='string'||!kind)throw Error('producer proof identity and kind must be explicit and strict');
  const origin=locateWorkflowSession(hostRoot,sessionId);
  const r={sourceSession:origin.session,source:within(origin.session,`step-${step}/parallel-${parallel}`),archive:origin.archive};
  const m={sourceSessionId:sessionId,sourceStep:step,sourceParallel:parallel};
  const original=await originalProducer(r,m),proof=await currentProducerProof(root,r,m,original);
  const fields=original.response.fields?.[kind],refs=Array.isArray(fields)?fields:[fields];
  const packages=await loadOperatorPackages(root),pkg=packages.find(item=>item.manifest.id===original.request.operatorId);
  if(!refs.length||refs.some(ref=>typeof ref!=='string')||!pkg?.en.tables.outputs?.rows.some(row=>kindOf(row.kind)===kind))throw Error('producer proof kind was not emitted by its original operator');
  const bindings=new Map((original.request.contexts??[]).filter(context=>/^@workspaces\//.test(context.alias)&&context.head)
    .map(context=>[context.alias,{alias:context.alias,revision:context.head,worktree:null,repositoryHash:null}]));
  const workspace=original.request.environment?.workspace,commits=original.response.commits??[];
  let heads=[];
  if(workspace){
    if(!path.isAbsolute(workspace.worktree)||!workspace.alias||!/^[a-f0-9]{40}$/.test(workspace.revision??''))throw Error('producer proof workspace requires an absolute worktree, alias and full commit');
    const git=args=>execFileSync('git',['-C',workspace.worktree,...args],{encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']}).trim();
    const full=oid=>{if(!/^[a-f0-9]{40}$/.test(oid??''))throw Error('producer proof commit must be a full object ID');const resolved=git(['rev-parse','--verify',`${oid}^{commit}`]);if(resolved!==oid)throw Error('producer proof commit resolves to a different object');return resolved;};
    const base=full(workspace.revision);heads=commits.map(full);
    const common=git(['rev-parse','--git-common-dir']),real=realpathSync(path.isAbsolute(common)?common:path.resolve(workspace.worktree,common));
    bindings.set(workspace.alias,{alias:workspace.alias,revision:heads.at(-1)??base,worktree:workspace.worktree,repositoryHash:hash(process.platform==='win32'?real.toLowerCase():real)});
  }else if(commits.length)throw Error('producer proof commits have no proving workspace boundary');
  const artifacts=refs.map(ref=>({ref:`${proof.ref}/${ref}`,sha256:original.state.attempts[`${step}/${parallel}`].evidenceManifest.files.find(file=>file.ref===ref)?.sha256}));
  if(artifacts.some(artifact=>!artifact.sha256))throw Error('producer proof artifact is outside its accepted manifest');
  return {...proof,sessionRoot:r.sourceSession,artifacts,artifactRefs:artifacts.map(artifact=>artifact.ref),bindings:[...bindings.values()].sort((a,b)=>a.alias.localeCompare(b.alias)),heads};
}
function manifestShape(m){
  const keys=['schemaVersion','sourceSessionId','sourceStep','sourceParallel','targetSessionId','targetStep','targetParallel','files'];
  if(!m||typeof m!=='object'||Object.keys(m).sort().join()!==keys.sort().join()||m.schemaVersion!==1||!Array.isArray(m.files)||!m.files.length||m.files.length>512)throw Error('invalid import manifest shape');
  const seen=new Set();for(const f of m.files){if(!f||Object.keys(f).sort().join()!=='path,sha256'||!safeRelative(f.path)||!/^(request|response)\//.test(f.path)||!/^sha256:[a-f0-9]{64}$/.test(f.sha256)||seen.has(f.path))throw Error('invalid import file inventory');seen.add(f.path);}
}

export async function validateImportedInput(root,session,inputRef,kind,{hostRoot=path.dirname(root),receivingSessionId=path.basename(session),receivingContractVersion}={}){
  const match=/^step-([1-9]\d*)\/parallel-([1-9]\d*)\/(?:[a-z][a-z-]*\/)?response\//.exec(inputRef);
  // Existing local inputs keep their existing contract; this gate only owns explicit foreign imports.
  if(!match)return [];
  const branch=path.join(session,`step-${match[1]}`,`parallel-${match[2]}`),manifestFile=path.join(branch,'import.json');
  let producer;try{producer=json(path.join(branch,'request/request.json'));}catch{return existsSync(manifestFile)?['import producer request is missing']:[];}
  if(!existsSync(manifestFile)&&(!producer.sessionId||producer.sessionId===receivingSessionId))return [];
  try{
    if(!existsSync(manifestFile))throw Error('foreign producer requires an explicit import manifest');
    const m=json(manifestFile);manifestShape(m);
    if(m.targetSessionId!==receivingSessionId||m.targetSessionId!==path.basename(session)||m.targetStep!==Number(match[1])||m.targetParallel!==Number(match[2]))throw Error('import target does not match the receiving input coordinate');
    const r=roots(hostRoot,m.sourceSessionId,m.targetSessionId,m.sourceStep,m.sourceParallel,m.targetStep,m.targetParallel);
    if(path.resolve(r.target)!==path.resolve(branch))throw Error('import target is outside the Source session root');
    within(r.targetSession,`step-${m.targetStep}/parallel-${m.targetParallel}/import.json`);
    evidenceOnly(r.targetSession,m.targetStep,m.targetParallel);
    const receiver=json(within(r.targetSession,'state.json'));
    const origin=await originAuthority(root,r,m,{requireCurrent:currentMarked(receiver,{contractVersion:receivingContractVersion})});metadata(r.target,m);
    const original=inventory(r.source),copied=inventory(r.target),normalize=v=>JSON.stringify([...v].sort((a,b)=>a.path.localeCompare(b.path)));
    if(normalize(original)!==normalize(m.files)||normalize(copied)!==normalize(m.files))throw Error('import bytes or origin inventory changed');
    const relative=path.relative(r.target,within(session,inputRef)).split(path.sep).join('/');
    const fields=origin.response.fields?.[kind],refs=Array.isArray(fields)?fields:[fields];
    if(!refs.includes(relative))throw Error('referenced import was not an output emitted by its original producer');
    const packages=await loadOperatorPackages(root),pkg=packageForOrigin(root,packages,origin.request.operatorId,kind);
    if(!pkg)throw Error('import kind is not an output the original operator declares');
    return [];
  }catch(error){return [`request.json: import ${kind}: ${error.message}`];}
}

export async function importProducer({sourceSessionId,sourceStep,sourceParallel,targetSessionId,targetStep,targetParallel,root=ROOT,hostRoot=path.dirname(root)}){
  const m={schemaVersion:1,sourceSessionId,sourceStep,sourceParallel,targetSessionId,targetStep,targetParallel,files:[]};
  const locate=()=>roots(hostRoot,sourceSessionId,targetSessionId,sourceStep,sourceParallel,targetStep,targetParallel);
  let r=locate();
  withinEvidenceRange(targetStep,importStepBase(root));
  let currentOrigin=false;
  const snapshot=async()=>{
    const origin=await originAuthority(root,r,m,{requireCurrent:currentMarked(json(within(r.targetSession,'state.json')))});
    currentOrigin=currentMarked(origin.request,origin.response,origin.state);m.files=inventory(r.source);manifestShape(m);
    const bytes=m.files.map(f=>[f.path,readFileSync(within(r.source,f.path))]);
    if(bytes.some(([p,b])=>hash(b)!==m.files.find(f=>f.path===p).sha256))throw Error('origin changed during import');
    return bytes;
  };
  let bytes;
  if(r.archive)bytes=await snapshot();
  else try{bytes=await withSessionLock(r.sourceSession,snapshot);}
  catch(error){
    if(existsSync(path.join(r.sourceSession,'state.json')))throw error;
    r=locate();if(!r.archive)throw error;bytes=await snapshot();
  }
  // Never hold source and receiver locks together. Publish only a fully staged copy.
  return withSessionLock(r.targetSession,async()=>{
    if(existsSync(r.target))throw Error('import target already exists; never overwrite evidence');
    const receiver=json(within(r.targetSession,'state.json'));
    if(currentMarked(receiver)&&!currentOrigin)throw Error('current receiver requires an original accepted current producer; legacy evidence is inspection-only');
    if(receiver.contractVersion==='starci/v2.2' && (receiver.lifecycle?.phase!=='active'||receiver.status!=='running'))throw Error('import receiver must be an active running session');
    evidenceOnly(r.targetSession,targetStep,targetParallel);
    const stageRef=`step-${targetStep}/.parallel-${targetParallel}-import-${randomUUID()}`;
    const stage=within(r.targetSession,stageRef,{missing:true});
    mkdirSync(stage,{recursive:true});
    try{
      for(const [p,b]of bytes){const dest=within(stage,p,{missing:true});mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,b,{flag:'wx'});}
      writeFileSync(path.join(stage,'import.json'),JSON.stringify(m,null,2)+'\n',{flag:'wx'});
      if(JSON.stringify(inventory(stage))!==JSON.stringify(m.files))throw Error('staged import differs from the frozen source snapshot');
      renameSync(stage,r.target);
    }finally{if(existsSync(stage))rmSync(within(r.targetSession,stageRef),{recursive:true});}
    return {target:r.target,files:m.files.length,sourceSessionId};
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failed=error=>{process.stderr.write(error.message+'\n');process.exitCode=1;};
  try{if(process.argv.length!==8)throw Error('usage: node producer-import.mjs <source-session> <source-step> <source-parallel> <target-session> <target-step> <target-parallel>');const [sourceSessionId,s,p,targetSessionId,t,q]=process.argv.slice(2);importProducer({sourceSessionId,sourceStep:Number(s),sourceParallel:Number(p),targetSessionId,targetStep:Number(t),targetParallel:Number(q)}).then(result=>process.stdout.write(JSON.stringify(result)+'\n'),failed);}catch(error){failed(error);}
}
