import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {CANDIDATE_PACKET,CANDIDATE_SNAPSHOT,bindRuntimeInputs,createCandidateSnapshot,sealCandidate,verifyCandidateIdentity} from './candidates.mjs';
import {parseRef} from './common.mjs';
import {candidateDisplayPath,candidateRootBindingDigest,pathInCandidateRoots} from './candidate-roots.mjs';
import {inspectJournal} from './journal.mjs';
import {verifyRuntimePin} from './runtime-pin.mjs';
import {RUNTIME_FILE_WRITE} from './store.mjs';

export const DETECTION_BRIDGE='starci/candidate-bridge@1';
export const ROOT_DETECTION_BRIDGE='starci/candidate-root-bridge@1';
export const ROOT_CANDIDATE_SNAPSHOT='starci/candidate-root-snapshot@1';
export const ROOT_CANDIDATE_PACKET='starci/candidate-root-packet@1';
/** What workflow state keeps of a candidate: identity, roots and digests. The manifests stay under the control root. */
export const CANDIDATE_RECORD='starci/candidate-record@1';
const CANDIDATE_FILES={bridge:'bridge.json',snapshot:'snapshot.json',packet:'candidate.json'};
const readJsonFile=(file,schema)=>{const value=JSON.parse(fs.readFileSync(file,'utf8')),accepted=Array.isArray(schema)?schema:[schema];if(!accepted.includes(value?.schema))throw new Error(`${file} is not a ${accepted.join(' or ')} record`);return value;};
const writeJsonAtomic=(file,value)=>{const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`);fs.renameSync(tmp,file);return file;};
const aggregateSnapshotFile=snapshot=>({...snapshot,roots:(snapshot.roots??[]).map(({snapshot:ignored,...root})=>root)});
function writeAggregateBridge(bridge){
  const serial={...bridge,roots:(bridge.roots??[]).map(({bridge:ignored,...root})=>root),snapshot:aggregateSnapshotFile(bridge.snapshot)};
  return writeJsonAtomic(path.join(bridge.snapshot.controlRoot,CANDIDATE_FILES.bridge),serial);
}
/** Rewrite the bridge under its control root after a mutation; the snapshot file stays the snapshot's own authority. */
export function writeCandidateBridge(bridge){return bridge.schema===ROOT_DETECTION_BRIDGE?writeAggregateBridge(bridge):writeJsonAtomic(path.join(bridge.snapshot.controlRoot,CANDIDATE_FILES.bridge),bridge);}
export function readCandidateSnapshot(controlRoot){
  const snapshot=readJsonFile(path.join(controlRoot,CANDIDATE_FILES.snapshot),[CANDIDATE_SNAPSHOT,ROOT_CANDIDATE_SNAPSHOT]);
  if(snapshot.schema===ROOT_CANDIDATE_SNAPSHOT)snapshot.roots=snapshot.roots.map(root=>({...root,snapshot:readCandidateSnapshot(root.controlRoot)}));
  return snapshot;
}
export function readCandidatePacket(controlRoot){
  const packet=readJsonFile(path.join(controlRoot,CANDIDATE_FILES.packet),[CANDIDATE_PACKET,ROOT_CANDIDATE_PACKET]);
  if(packet.schema===ROOT_CANDIDATE_PACKET)packet.roots=packet.roots.map(root=>({...root,packet:readCandidatePacket(root.controlRoot)}));
  return packet;
}
/** The bridge as last written, carrying the snapshot as last written: two files, one authority each. */
export function readCandidateBridge(controlRoot){
  const bridge=readJsonFile(path.join(controlRoot,CANDIDATE_FILES.bridge),[DETECTION_BRIDGE,ROOT_DETECTION_BRIDGE]);
  bridge.snapshot=readCandidateSnapshot(controlRoot);
  if(bridge.schema===ROOT_DETECTION_BRIDGE)bridge.roots=bridge.roots.map(root=>({...root,bridge:readCandidateBridge(root.controlRoot)}));
  return bridge;
}
export function candidateRecord(bridge,{status='running'}={}){
  const {snapshot}=bridge;
  if(bridge.schema===ROOT_DETECTION_BRIDGE){
    const primary=bridge.roots.find(root=>root.id==='source')??bridge.roots[0],primarySnapshot=primary.bridge?.snapshot??primary.snapshot;
    return {schema:CANDIDATE_RECORD,status,identity:{...bridge.identity},controlRoot:snapshot.controlRoot,workerRoot:primarySnapshot.workerRoot,
      baseRoot:primarySnapshot.baseRoot,oracleRoot:primarySnapshot.oracleRoot,acceptedHead:primarySnapshot.acceptedHead,bindingDigest:bridge.bindingDigest,
      rootBindings:bridge.rootBindings.map(binding=>({...binding})),roots:bridge.roots.map(root=>({id:root.id,role:root.role,controlRoot:root.controlRoot,
        repoRoot:root.repoRoot,workerRoot:(root.bridge?.snapshot??root.snapshot).workerRoot,baseRoot:(root.bridge?.snapshot??root.snapshot).baseRoot,
        oracleRoot:(root.bridge?.snapshot??root.snapshot).oracleRoot,acceptedHead:(root.bridge?.snapshot??root.snapshot).acceptedHead,
        workerWritable:Boolean(root.workerWritable),runtimeWritable:Boolean(root.runtimeWritable),readOnly:Boolean(root.readOnly)})),
      dependency:{command:primary.bridge?.dependency?.command??null,ready:primary.bridge?.dependency?.ready??true}};
  }
  return {schema:CANDIDATE_RECORD,status,identity:{...bridge.identity},controlRoot:snapshot.controlRoot,workerRoot:snapshot.workerRoot,
    baseRoot:snapshot.baseRoot,oracleRoot:snapshot.oracleRoot,acceptedHead:bridge.acceptedHead,
    dependency:{command:bridge.dependency?.command??null,ready:bridge.dependency?.ready??true}};
}
/**
 * A bridge an earlier build kept whole inside workflow state is put on disk under its own control root, so the
 * record can point at it. The snapshot is written beside it when the state carried a sealed one. Answers null
 * when the control root is gone: then there is nothing to point at and the next attempt begins a new candidate.
 */
export function persistInlineCandidate(inline){
  const bridge=inline?.bridge,controlRoot=bridge?.snapshot?.controlRoot??inline?.snapshot?.controlRoot;
  if(!bridge?.schema||typeof controlRoot!=='string'||!fs.existsSync(controlRoot))return null;
  if(inline.snapshot?.schema===CANDIDATE_SNAPSHOT)writeJsonAtomic(path.join(controlRoot,CANDIDATE_FILES.snapshot),inline.snapshot);
  else if(bridge.snapshot?.schema===CANDIDATE_SNAPSHOT&&!fs.existsSync(path.join(controlRoot,CANDIDATE_FILES.snapshot)))writeJsonAtomic(path.join(controlRoot,CANDIDATE_FILES.snapshot),bridge.snapshot);
  writeCandidateBridge({...bridge,snapshot:bridge.snapshot??inline.snapshot});
  const record=candidateRecord({...bridge,snapshot:readCandidateSnapshot(controlRoot)},{status:inline.status??'running'});
  if(Array.isArray(inline.observedFiles))record.observedFiles=[...inline.observedFiles];
  if(Array.isArray(inline.reasons))record.reasons=[...inline.reasons];
  if(inline.assurance)record.assurance=inline.assurance;
  if(inline.dependency&&typeof inline.dependency==='object')record.dependency={...record.dependency,...inline.dependency};
  if(inline.packet?.schema===CANDIDATE_PACKET){record.candidateDigest=inline.packet.candidateDigest;record.oracleDigest=inline.packet.oracleDigest;record.snapshotDigest=inline.packet.snapshotDigest;record.sealedAt=inline.packet.sealedAt;record.changed=(inline.packet.changes??[]).length;}
  return record;
}
const slash=value=>String(value??'').replaceAll('\\','/');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const clean=value=>slash(value).replace(/^\.\//,'');
export function resolveCandidateReference(value){
  const parsed=parseRef(value),literal=slash(parsed.ref),hash=literal.indexOf('#');
  const file=clean(hash<0?literal:literal.slice(0,hash)),fragment=hash<0?null:literal.slice(hash+1);
  if(!file||path.isAbsolute(file)||/^[A-Za-z]:\//.test(file)||file==='..'||file.startsWith('../')||file.includes('/../'))
    throw new Error(`candidate reference escapes the source root: ${literal}`);
  return {kind:parsed.kind,path:file,fragment,ref:literal};
}
const execGit=(git,root,args)=>{
  const result=git('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  if(result?.status!==0)throw new Error(`git ${args.join(' ')} failed: ${String(result?.stderr??'').trim()}`);
  return String(result.stdout??'');
};
const statusPaths=(git,root)=>{
  const fields=execGit(git,root,['status','--porcelain=v1','-z','--untracked-files=all']).split('\0');
  const paths=[];
  for(let index=0;index<fields.length;index++){
    const field=fields[index];if(!field)continue;
    const code=field.slice(0,2),file=clean(field.slice(3));
    if(code.includes('R')||code.includes('C')){const paired=clean(fields[++index]??'');if(file)paths.push(file);if(paired)paths.push(paired);}
    else if(file)paths.push(file);
  }
  return [...new Set(paths)].sort();
};
const fileState=(root,file)=>{
  const target=path.resolve(root,...clean(file).split('/')),relative=path.relative(path.resolve(root),target);
  if(relative.startsWith('..')||path.isAbsolute(relative))return {path:file,state:'escape'};
  try{
    const stat=fs.lstatSync(target);
    if(stat.isSymbolicLink()||!stat.isFile())return {path:file,state:'unsupported'};
    return {path:file,state:'file',sha256:sha256(fs.readFileSync(target)),size:stat.size,mode:stat.mode&0o777};
  }catch(error){return {path:file,state:error?.code==='ENOENT'?'absent':'unreadable'};}
};
const states=(root,paths)=>paths.map(file=>fileState(root,file));
const contentHead=(root,paths)=>`content:${sha256(JSON.stringify(states(root,paths).map(({path,sha256,size,mode})=>({path,sha256,size,mode}))))}`;
const globExpression=value=>{
  const escaped=clean(value).replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('**','\0').replaceAll('*','[^/]*').replaceAll('\0','.*');
  return new RegExp(`^${escaped}$`);
};
export const scopeMatches=(file,scopes)=>scopes.some(scope=>{const normalized=clean(scope);if(!normalized.includes('*'))return file===normalized||file.startsWith(`${normalized.replace(/\/$/,'')}/`);try{return globExpression(normalized).test(file);}catch{return false;}});
const matches=scopeMatches;
const trackedFor=(git,root,scopes)=>{
  if(!scopes.length)return [];
  return execGit(git,root,['ls-files','-z','--',...scopes]).split('\0').map(clean).filter(Boolean);
};
// `.starciwork/_local/inputs/` is the one permitted `_local` subtree: goal staging copies owner-named external
// files there, digest-bound, precisely so the candidate provenance rule can read them (see stageExternalInputs).
const DEFAULT_EXCLUDED=[/(^|\/)\.git(\/|$)/,/(^|\/)node_modules(\/|$)/,/(^|\/)(dist|build|coverage|\.cache)(\/|$)/,
  /(^|\/)\.env([^/]*)$/,/(^|\/)(secrets?|credentials?)(\.|\/|$)/,/\.(pem|p12|pfx|key|enc)$/i,/(^|\/)\.starciwork\/_local\/(?!inputs(?:\/|$))/,/(^|\/)\.starciwork\/_resources(\/|$)/];
const safeTracked=file=>!DEFAULT_EXCLUDED.some(pattern=>pattern.test(clean(file)));
export function candidateDependencyPlan(root,{declared=null,required=true}={}){
  if(typeof declared==='string'&&declared.trim())return {manager:'declared',command:declared.trim(),lifecycleScripts:'caller-declared'};
  if(!required)return {manager:null,command:null,ready:true,reason:'declared checks require no package tools'};
  const packageFile=path.join(root,'package.json'),npmLock=['npm-shrinkwrap.json','package-lock.json'].find(file=>fs.existsSync(path.join(root,file)));
  if(!fs.existsSync(packageFile))return {manager:null,command:null,ready:false,reason:'package tools are required but package.json is missing'};
  const manifest=readJson(packageFile)??{},declaredManager=String(manifest.packageManager??'').split('@')[0]||null;
  if(declaredManager&&declaredManager!=='npm')return {manager:declaredManager,command:null,ready:false,reason:`unsupported declared package manager: ${declaredManager}`};
  if(npmLock)return {manager:'npm',lockfile:npmLock,command:'npm ci --ignore-scripts --no-audit --no-fund',lifecycleScripts:'disabled'};
  const unsupported=[['pnpm','pnpm-lock.yaml'],['yarn','yarn.lock'],['bun','bun.lock'],['bun','bun.lockb']].find(([,file])=>fs.existsSync(path.join(root,file)));
  return {manager:unsupported?.[0]??declaredManager??'unknown',command:null,ready:false,
    reason:unsupported?`unsupported candidate dependency lockfile: ${unsupported[1]}`:'package manifest has no deterministic lockfile'};
}
export const candidateChecksNeedDependencies=checks=>(checks??[]).some(check=>{
  const command=String(check?.command??check??'').trim();
  return /(?:^|[\s"'=])(?:\.?[\\/])?node_modules[\\/]|\b(?:npm|pnpm|yarn|bun)\s+(?:run|exec|test|build|lint|typecheck)\b|\bnpx\b|(?:^|[;&|]\s*)(?:[^\s"']*[\\/])?(?:tsc|eslint|jest|vitest|next|nest)(?:\.cmd)?(?:\s|$)/i.test(command);
});
function externalDependencyLinks(candidateRoot){
  const base=path.resolve(candidateRoot),outside=[];
  const within=(target,link)=>{let resolved;try{resolved=fs.realpathSync(target);}catch{outside.push(clean(path.relative(base,link)));return false;}
    const relative=path.relative(base,resolved);if(relative.startsWith('..')||path.isAbsolute(relative)){outside.push(clean(path.relative(base,link)));return false;}return true;};
  const inspectModules=modules=>{const stat=fs.lstatSync(modules);if(stat.isSymbolicLink()&&!within(modules,modules))return;
    let entries=[];try{entries=fs.readdirSync(modules,{withFileTypes:true});}catch{return;}
    for(const entry of entries){const target=path.join(modules,entry.name),item=fs.lstatSync(target);
      if(item.isSymbolicLink())within(target,target);else if(item.isDirectory())inspectTree(target);}};
  const inspectTree=at=>{let entries=[];try{entries=fs.readdirSync(at,{withFileTypes:true});}catch{return;}
    for(const entry of entries){const target=path.join(at,entry.name);if(entry.name==='node_modules'){inspectModules(target);continue;}
      const item=fs.lstatSync(target);if(item.isDirectory()&&!item.isSymbolicLink())inspectTree(target);}};
  inspectTree(base);return [...new Set(outside)].sort();
}
const runtimeInternal=file=>/(^|\/)\.starciwork\/_local(\/|$)/.test(clean(file));
// Local workflow state is intentionally absent from candidate/model payloads, but it is still inventoried here.
// This walk includes Git-ignored files and hashes only their state; it never copies their bytes into a snapshot.
const runtimeLocalPaths=root=>{
  const base=path.join(path.resolve(root),'.starciwork','_local'),found=[];
  const walk=at=>{let entries=[];try{entries=fs.readdirSync(at,{withFileTypes:true});}catch{return;}
    for(const item of entries){const absolute=path.join(at,item.name),relative=clean(path.relative(root,absolute));
      if(item.isDirectory()&&!item.isSymbolicLink())walk(absolute);else found.push(relative);}};
  walk(base);return found.sort();
};
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const jsonDigest=value=>sha256(JSON.stringify(stable(value)));
const durableProjection=(workflowId,generation,journalFile)=>{let journal;try{
    journal=inspectJournal({file:journalFile});
    const row=journal.db.prepare('SELECT goal_identity,state_json FROM state_snapshots WHERE workflow_id=? AND generation=? AND state_json<>\'\' ORDER BY snapshot_id DESC LIMIT 1').get(workflowId,generation);
    if(!row?.state_json)return null;const state=JSON.parse(row.state_json);return {state,goalIdentity:row.goal_identity};
  }catch{return null;}finally{journal?.close();}};
const samePath=(a,b)=>{try{return slash(fs.realpathSync(path.resolve(a))).toLowerCase()===slash(fs.realpathSync(path.resolve(b))).toLowerCase();}catch{return false;}};
const commonStoreOwner=(git,worktree)=>{try{const result=git('git',['rev-parse','--git-common-dir'],{cwd:worktree,encoding:'utf8',windowsHide:true});if(result?.status!==0)return null;
    const common=path.resolve(worktree,String(result.stdout??'').trim());return path.basename(common).toLowerCase()==='.git'?path.dirname(common):null;}catch{return null;}};
const lastCustodySeq=(workflowId,generation,journalFile)=>{let journal;try{journal=inspectJournal({file:journalFile});
    return Number(journal.db.prepare("SELECT COALESCE(max(seq),0) AS seq FROM events WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written'").get(workflowId,generation)?.seq??0);
  }catch{return null;}finally{journal?.close();}};
const safeSegment=value=>typeof value==='string'&&value.length>0&&!value.includes('/')&&!value.includes('\\')?value:null;
const runtimePinDigest=state=>/^[a-f0-9]{64}$/.test(String(state?.engine?.runtimePin?.digest??''))?state.engine.runtimePin.digest:null;
// A foreign workflow may legitimately project state into a shared Git common-dir store while its source and
// authored Work stay in a branch checkout. The journal and common-dir routing are captured before launch; later
// exceptions require an exact post-baseline byte receipt written by the store, never a live pid or event shape.
const runtimeWriters=(root,ownWorkflow,git)=>{
  const workflows=path.join(path.resolve(root),'.starciwork','_local','workflows'),records=[];let entries=[];
  try{entries=fs.readdirSync(workflows,{withFileTypes:true});}catch{return records;}
  for(const entry of entries){if(!entry.isDirectory()||entry.isSymbolicLink()||entry.name===String(ownWorkflow))continue;
    const prefix=`.starciwork/_local/workflows/${entry.name}`,statePath=`${prefix}/state.json`,eventsPath=`${prefix}/events.jsonl`,lockPath=`${prefix}/kernel.lock`,
      state=readJson(path.join(root,...statePath.split('/'))),generation=Number(state?.engine?.generation),journalGiven=state?.engine?.journalFile;
    if(state?.schema!=='starci/workflow-state@1'||state.id!==entry.name||!Number.isInteger(generation)||generation<1||typeof journalGiven!=='string'||!journalGiven||
      typeof state.worktree!=='string'||!samePath(commonStoreOwner(git,state.worktree),root))continue;
    let journalFile;try{journalFile=fs.realpathSync(path.resolve(journalGiven));}catch{continue;}
    const durable=durableProjection(entry.name,generation,journalFile);if(!durable||jsonDigest(durable.state)!==jsonDigest(state))continue;
    const custodySeq=lastCustodySeq(entry.name,generation,journalFile);if(custodySeq===null)continue;
    records.push({workflowId:entry.name,generation,goalIdentity:durable.goalIdentity,journalFile:slash(journalFile),storeRoot:slash(fs.realpathSync(root)),
      sourceRoot:slash(fs.realpathSync(state.worktree)),runtimePinDigest:runtimePinDigest(state),prefix,statePath,eventsPath,lockPath,custodyAfterSeq:custodySeq});
  }
  return records.sort((a,b)=>a.workflowId.localeCompare(b.workflowId));
};
const currentRuntimeWriter=(bridge,writer,git)=>{
  const state=readJson(path.join(bridge.repoRoot,...writer.statePath.split('/'))),generation=Number(state?.engine?.generation),journalGiven=state?.engine?.journalFile;
  if(state?.schema!=='starci/workflow-state@1'||state.id!==writer.workflowId||!Number.isInteger(generation)||generation<writer.generation||
    typeof state.worktree!=='string'||!samePath(state.worktree,writer.sourceRoot)||!samePath(commonStoreOwner(git,state.worktree),bridge.repoRoot))return null;
  let journalFile;try{journalFile=slash(fs.realpathSync(path.resolve(journalGiven??'')));}catch{return null;}
  const transition=generation!==writer.generation||journalFile!==writer.journalFile,pinDigest=runtimePinDigest(state);
  if(!transition&&journalFile!==writer.journalFile)return null;
  if(transition&&!verifyRuntimePin(state?.engine?.runtimePin).ok)return null;
  if(!transition&&writer.runtimePinDigest&&pinDigest!==writer.runtimePinDigest)return null;
  const durable=durableProjection(writer.workflowId,generation,journalFile);
  if(!durable||durable.goalIdentity!==writer.goalIdentity||jsonDigest(durable.state)!==jsonDigest(state))return null;
  return {...writer,state,generation,journalFile,pinDigest,transition,custodyAfterSeq:transition?0:writer.custodyAfterSeq};
};
const operationArtifacts=(writer,state)=>{
  const names=new Map(),add=(name,authority)=>{if(name)names.set(`${writer.prefix}/${name}`,{name,authority});};
  for(const op of state?.ops??[]){const id=safeSegment(op?.id);if(!id)continue;
    add(`contracts/${id}.md`,'receipt');add(`checks/${id}.json`,'receipt');add(`checks/${id}-kernel.json`,'receipt');add(`checks/${id}.credential-request.json`,'receipt');
    const dispatches=new Set([op.dispatch,op.launch?.dispatch,op.priorStoppedAttempt?.dispatch,...(op.launchAttempts??[]).map(item=>item?.dispatchId)].map(safeSegment).filter(Boolean));
    for(const dispatch of dispatches){add(`reports/${dispatch}.json`,'receipt');for(let index=0;index<=(op.reports?.length??0);index+=1)add(`reports/${dispatch}.json.answered-${index}`,'receipt');}
  }
  return names;
};
const runtimeAuthority=(writer,artifacts,relative)=>{
  const name=relative.startsWith(`${writer.prefix}/`)?relative.slice(writer.prefix.length+1):null;
  if(!name)return null;
  if(['state.json','events.jsonl','kernel.lock','stop.flag'].includes(name)||/^events\.g\d+\.jsonl$/.test(name))return {name,authority:'receipt'};
  return artifacts.get(relative)??null;
};
const custodyReceipt=(bridge,writer,relative,name)=>{const current=fileState(bridge.repoRoot,relative);if(!['file','absent'].includes(current.state))return null;let journal;
  try{journal=inspectJournal({file:writer.journalFile});const rows=journal.db.prepare("SELECT seq,event_id,payload_json FROM events WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written' AND seq>? ORDER BY seq DESC").all(writer.workflowId,writer.generation,writer.custodyAfterSeq),target=path.join(bridge.repoRoot,...relative.split('/'));
    for(const row of rows){let payload;try{payload=JSON.parse(row.payload_json);}catch{continue;}
      const pathMatches=current.state==='absent'?slash(path.resolve(payload?.file??'')).toLowerCase()===slash(path.resolve(target)).toLowerCase():samePath(payload?.file,target);
      if(payload?.schema!==RUNTIME_FILE_WRITE||payload.relative!==name||!pathMatches)continue;
      if(payload.state!==current.state||payload.sha256!==(current.sha256??null)||payload.size!==(current.size??0))return null;
      return {journalSeq:row.seq,eventId:row.event_id,state:current.state,sha256:current.sha256??null,size:current.size??0};
    }
  }catch{return null;}finally{journal?.close();}return null;};
const acknowledgedForeignRuntime=(bridge,observed,{git}={})=>{
  const changed=new Set(observed),paths=[],records=[];
  for(const baseline of bridge.runtimeWriters??[]){const writer=currentRuntimeWriter(bridge,baseline,git);if(!writer)continue;
    const artifacts=operationArtifacts(writer,writer.state),relevant=[...changed].map(relative=>({relative,rule:runtimeAuthority(writer,artifacts,relative)})).filter(item=>item.rule);
    if(!relevant.length)continue;
    const receipts=relevant.map(item=>({...item,receipt:custodyReceipt(bridge,writer,item.relative,item.rule.name)}));
    if(receipts.some(item=>!item.receipt))continue;
    paths.push(...relevant.map(item=>item.relative));records.push({workflowId:writer.workflowId,generation:writer.generation,journalFile:writer.journalFile,
      previousGeneration:writer.transition?baseline.generation:null,previousJournalFile:writer.transition?baseline.journalFile:null,
      runtimePinDigest:writer.pinDigest,custodyAfterSeq:writer.custodyAfterSeq,paths:receipts.map(item=>({path:item.relative,...item.receipt}))});
  }
  return {paths:[...new Set(paths)],records};
};
const headOf=(git,root)=>execGit(git,root,['rev-parse','HEAD']).trim();
const same=(a,b)=>a?.state===b?.state&&a?.sha256===b?.sha256;
// Only two well-formed managed sections can authorize ignoring their interior bytes. Malformed states carry no
// outside digest by design; treating two missing digests as equal would let an unrelated human edit disappear.
const sameManagedOutside=(before,after)=>before?.state==='managed'&&after?.state==='managed'&&before.sha256===after.sha256;
const managedOutside=(root,record)=>{
  const file=clean(record?.path),target=path.resolve(root,...file.split('/')),relative=path.relative(path.resolve(root),target);
  if(!file||relative.startsWith('..')||path.isAbsolute(relative))return {path:file,state:'escape'};
  try{
    const text=fs.readFileSync(target,'utf8'),start=text.indexOf(String(record.start)),end=text.indexOf(String(record.end));
    if(start<0&&end<0)return {path:file,state:'unmanaged',sha256:sha256(text)};
    if(start<0||end<start||text.indexOf(String(record.start),start+1)>=0||text.indexOf(String(record.end),end+1)>=0)return {path:file,state:'malformed'};
    return {path:file,state:'managed',sha256:sha256(`${text.slice(0,start)}${text.slice(end+String(record.end).length)}`)};
  }catch(error){return {path:file,state:error?.code==='ENOENT'?'absent':'unreadable'};}
};

export function candidateWriterResource(repoRoot){
  const real=fs.realpathSync(repoRoot);return {key:`canonical-writer:${sha256(slash(real).toLowerCase())}`,units:1};
}
export const DEFAULT_MAX_CONCURRENT_WRITERS=10;
/**
 * The per-repository bound on simultaneously live writers: `allocation.maxConcurrentWriters` when the runtimes
 * profile declares a positive integer, else the default. Admission holds the cap; the kernel launch fence keeps
 * the holders' allowlists disjoint, so capacity beyond 1 never admits contending scopes.
 */
export const maxConcurrentWriters=profile=>{const given=Number(profile?.allocation?.maxConcurrentWriters);return Number.isInteger(given)&&given>=1?given:DEFAULT_MAX_CONCURRENT_WRITERS;};
/** Declared foreign write scopes (`foreignAllowlists` and `concurrentScopes` spellings merge) as one normalized glob list. */
const scopeUnion=(...lists)=>[...new Set(lists.flat().filter(item=>typeof item==='string').map(clean).filter(Boolean))].sort();
const writerBound=value=>Number.isInteger(value)&&value>=1?value:1;
/** Runtime-only public projections fence their exact file, while product roots retain repository-wide fencing. */
export function candidateBindingWriterResource(binding){
  if(binding?.role==='workflow-store'&&!binding.workerWritable&&(binding.runtimeManagedFiles??[]).length===1){
    const relative=clean(binding.runtimeManagedFiles[0].path),real=fs.realpathSync(binding.repoRoot);
    return {key:`runtime-projection:${sha256(`${slash(real).toLowerCase()}\n${relative.toLowerCase()}`)}`,units:1};
  }
  return candidateWriterResource(binding.repoRoot);
}
export function runtimeWriterHint({host='orca-native',repoRoot,maxWriters=1}={}){
  return {host,assurance:'detection-only',maxWriters:writerBound(maxWriters),resource:candidateWriterResource(repoRoot),
    limitation:'the current native worker runs in an Orca worktree without an attested filesystem sandbox; the bounded writer pool and drift checks detect contamination but do not prevent absolute-path writes'};
}

/** Capture accepted head, relevant input bytes and every pre-existing dirty path before a native worker starts. */
function beginSingleDetectionCandidate({identity,repoRoot,workerRoot,controlRoot,allowlist=[],references=[],inputPaths=[],oraclePaths=[],git,
  dependencyDigests={},environmentDigest='runtime-unpinned',ownedDirtyPaths=[],runtimeManagedFiles=[],dependencyInstall=null,dependencyRequired=false,nonGit=false,runtimePin=null,
  foreignAllowlists=[],concurrentScopes=[],maxWriters=1,now=Date.now}={}){
  if(runtimePin){const checked=verifyRuntimePin({...runtimePin,root:repoRoot});if(!checked.ok)throw new Error(`candidate runtime pin is invalid before snapshot: ${checked.reason}`);}
  const dirty=nonGit?[]:statusPaths(git,repoRoot).filter(file=>!runtimeInternal(file)),local=nonGit?[]:runtimeLocalPaths(repoRoot),allTracked=nonGit?[]:trackedFor(git,repoRoot,['.']);
  if(typeof environmentDigest!=='string'||!environmentDigest.trim())throw new TypeError('candidate environmentDigest must be a nonempty string');
  const resolveOnDisk=value=>{const reference=resolveCandidateReference(value),target=path.join(repoRoot,...reference.path.split('/'));
    try{if(fs.lstatSync(target).isDirectory()){const index=['index.yaml','index.yml','index.json','index.md'].find(name=>fs.existsSync(path.join(target,name)));if(index)return {...reference,path:`${reference.path.replace(/\/$/,'')}/${index}`};}}catch{}
    return reference;};
  const resolvedReferences=references.map(resolveOnDisk),resolvedInputs=inputPaths.map(resolveOnDisk);
  for(const reference of resolvedReferences){
    const state=fileState(repoRoot,reference.path);
    if(state.state!=='file'||!safeTracked(reference.path))throw new Error(`candidate reference is not a readable, permitted source file: ${reference.ref}`);
  }
  if(!oraclePaths.length)oraclePaths=[...allTracked,...dirty].filter(file=>file.startsWith('.starciwork/')||
    /(^|\/)(tests?|__tests__)(\/|$)|\.(spec|test|e2e-spec|container-spec)\.[cm]?[jt]sx?$/.test(file));
  // A dirty path can be a deletion or the source of a staged rename: tracked, listed, and absent on disk.
  // `inventory` lstats every oracle byte-for-byte, so an absent path must be dropped exactly as `sourcePaths`
  // drops it - its absence is already on the record through `dirtyBaseline`.
  oraclePaths=oraclePaths.filter(safeTracked).filter(file=>fileState(repoRoot,file).state==='file');
  const sourcePaths=[...new Set([...allTracked,...resolvedReferences.map(item=>item.path),...resolvedInputs.map(item=>item.path),...dirty])].filter(safeTracked)
    .filter(file=>fileState(repoRoot,file).state==='file').sort();
  const acceptedHead=nonGit?contentHead(repoRoot,sourcePaths):headOf(git,repoRoot);
  const snapshot=createCandidateSnapshot({identity,repoRoot,workerRoot,controlRoot,sourcePaths,oraclePaths,acceptedHead,dependencyDigests,
    environmentDigest,assurance:{requested:'detection-only'},now});
  const owned=new Set(ownedDirtyPaths.map(clean));
  // A path a prior attempt owned that is clean now was committed or reverted since: it is no longer owned, and
  // says so on the bridge. A path outside the allowlist was never this operation's to own.
  const droppedOwnedPaths=[...owned].filter(file=>!dirty.includes(file)).sort();
  for(const file of droppedOwnedPaths)owned.delete(file);
  const invalidOwned=[...owned].filter(file=>!matches(file,allowlist));
  if(invalidOwned.length)throw new Error(`owned dirty baseline paths must be inside the bounded allowlist: ${invalidOwned.join(', ')}`);
  const managed=runtimeManagedFiles.filter(item=>item&&typeof item.path==='string'&&typeof item.start==='string'&&typeof item.end==='string')
    .map(item=>({path:clean(item.path),start:item.start,end:item.end}));
  const dependencyPlan=nonGit?{manager:null,command:null,ready:true,reason:'non-Git runtime root'}:candidateDependencyPlan(workerRoot,{declared:dependencyInstall,required:dependencyRequired});
  const bridge={schema:DETECTION_BRIDGE,identity,snapshot,repoRoot:path.resolve(repoRoot),nonGit:Boolean(nonGit),runtimePin:runtimePin?{...runtimePin}:null,allowlist:[...allowlist],references:[...references],resolvedReferences,inputPaths:[...inputPaths],
    acceptedHead,sourceBaseline:states(repoRoot,sourcePaths),dirtyBaseline:states(repoRoot,dirty),dirtyBaselinePaths:dirty,
    localBaseline:states(repoRoot,local),runtimeWriters:nonGit?[]:runtimeWriters(repoRoot,identity.workflowId,git),
    runtimeManagedFiles:managed,runtimeManagedBaseline:managed.map(item=>managedOutside(repoRoot,item)),
    // A scoped non-Git binding (the canonical workflow store) does not inventory its surrounding repository.
    // Retain the exact file states so its own continuation still enters managed-section collision checks.
    runtimeManagedFullBaseline:nonGit?states(repoRoot,managed.map(item=>item.path)):[],
    ownedDirtyPaths:[...owned].sort(),droppedOwnedPaths,dependency:{mode:'candidate-local-install',...dependencyPlan,
      root:path.join(controlRoot,'dependencies'),candidateRoot:workerRoot,externalCache:'forbidden',externalSymlinks:'forbidden',assurance:'detection-only',ready:Boolean(dependencyPlan.ready)},
    // Foreign live scopes declared at begin are evidence only: freeze re-derives the live set from its caller,
    // so a scope recorded here can never silently reclassify a later real violation.
    concurrentScopes:scopeUnion(foreignAllowlists,concurrentScopes),
    writer:runtimeWriterHint({repoRoot,maxWriters}),beganAt:new Date(now()).toISOString()};
  fs.writeFileSync(path.join(controlRoot,'bridge.json'),`${JSON.stringify(bridge,null,2)}\n`,{flag:'wx'});
  return bridge;
}

const identityFields=value=>Object.fromEntries(['workflowId','opId','attempt','generation','jobId'].map(field=>[field,value[field]]));
const rootBridgeRecord=(binding,bridge)=>({id:binding.id,role:binding.role,repoRoot:path.resolve(binding.repoRoot),controlRoot:bridge.snapshot.controlRoot,
  runtimePin:binding.runtimePin?{...binding.runtimePin}:null,nonGit:Boolean(binding.nonGit),workerWritable:Boolean(binding.workerWritable),runtimeWritable:Boolean(binding.runtimeWritable),readOnly:Boolean(binding.readOnly)});
const rootSnapshotRecord=(binding,bridge)=>({id:binding.id,role:binding.role,repoRoot:path.resolve(binding.repoRoot),controlRoot:bridge.snapshot.controlRoot,
  workerRoot:bridge.snapshot.workerRoot,baseRoot:bridge.snapshot.baseRoot,oracleRoot:bridge.snapshot.oracleRoot,acceptedHead:bridge.snapshot.acceptedHead,
  snapshotDigest:bridge.snapshot.snapshotDigest,runtimePin:binding.runtimePin?{...binding.runtimePin}:null,nonGit:Boolean(binding.nonGit),workerWritable:Boolean(binding.workerWritable),runtimeWritable:Boolean(binding.runtimeWritable),readOnly:Boolean(binding.readOnly)});
const rootSnapshotDigest=(bindingDigest,roots)=>sha256(JSON.stringify({bindingDigest,roots:roots.map(root=>({id:root.id,snapshotDigest:root.snapshotDigest,acceptedHead:root.acceptedHead}))}));

/** Begin either the historical one-root candidate or an aggregate of independently sealed routed roots. */
export function beginDetectionCandidate(options={}){
  const roots=Array.isArray(options.roots)?options.roots:null;
  if(!roots)return beginSingleDetectionCandidate(options);
  if(!roots.length)throw new Error('multi-root candidate requires at least one accepted root');
  const ids=new Set();for(const root of roots){if(!root?.id||ids.has(root.id))throw new Error(`candidate root id is missing or duplicated: ${root?.id??''}`);ids.add(root.id);
    if(root.readOnly&&((root.allowlist??[]).length||(root.runtimePaths??[]).length||root.workerWritable||root.runtimeWritable))throw new Error(`read-only candidate root ${root.id} cannot carry writable scopes`);}
  const bindingDigest=options.bindingDigest??candidateRootBindingDigest(roots),begun=[];
  // Declared foreign scopes live in the same coordinate space as operation allowlists: route each one to the
  // root it belongs to exactly as `candidateRootBindings` routed this operation's own allowlist entries.
  const declaredScopes=scopeUnion(options.foreignAllowlists,options.concurrentScopes),foreignByRoot=new Map(roots.map(root=>[root.id,[]]));
  for(const scope of declaredScopes){try{const routed=pathInCandidateRoots(scope,roots);foreignByRoot.get(routed.rootId)?.push(routed.relative);}catch{}}
  try{
    for(const binding of roots){
      const bridge=beginSingleDetectionCandidate({...options,...binding,repoRoot:binding.repoRoot,
        workerRoot:path.join(options.workerRoot,'roots',binding.id),controlRoot:path.join(options.controlRoot,'roots',binding.id),
        allowlist:binding.allowlist??[],references:binding.references??[],inputPaths:binding.inputPaths??[],oraclePaths:binding.oraclePaths??[],
        ownedDirtyPaths:binding.ownedDirtyPaths??[],runtimeManagedFiles:binding.runtimeManagedFiles??[],dependencyInstall:binding.id==='source'?options.dependencyInstall:null,
        dependencyRequired:binding.id==='source'?Boolean(options.dependencyRequired):false,
        foreignAllowlists:[],concurrentScopes:foreignByRoot.get(binding.id)??[]});
      begun.push({binding,bridge});
    }
    const rootSnapshots=begun.map(({binding,bridge})=>rootSnapshotRecord(binding,bridge)),primary=begun.find(item=>item.binding.id==='source')??begun[0];
    const snapshot={schema:ROOT_CANDIDATE_SNAPSHOT,...identityFields(options.identity),bindingDigest,controlRoot:path.resolve(options.controlRoot),
      workerRoot:primary.bridge.snapshot.workerRoot,baseRoot:primary.bridge.snapshot.baseRoot,oracleRoot:primary.bridge.snapshot.oracleRoot,
      acceptedHead:primary.bridge.snapshot.acceptedHead,roots:rootSnapshots,createdAt:new Date(options.now?.()??Date.now()).toISOString()};
    snapshot.snapshotDigest=rootSnapshotDigest(bindingDigest,rootSnapshots);
    writeJsonAtomic(path.join(options.controlRoot,CANDIDATE_FILES.snapshot),snapshot);
    const bridge={schema:ROOT_DETECTION_BRIDGE,identity:identityFields(options.identity),bindingDigest,rootBindings:roots.map(binding=>({
      id:binding.id,role:binding.role,repoRoot:path.resolve(binding.repoRoot),workRoot:binding.workRoot?path.resolve(binding.workRoot):null,
      sourceRoot:binding.sourceRoot?path.resolve(binding.sourceRoot):null,
      sourceRootTrust:binding.sourceRootTrust??null,
      runtimePin:binding.runtimePin?{...binding.runtimePin}:null,
      primary:Boolean(binding.primary),nonGit:Boolean(binding.nonGit),workerWritable:Boolean(binding.workerWritable),runtimeWritable:Boolean(binding.runtimeWritable),readOnly:Boolean(binding.readOnly),
      allowlist:[...(binding.allowlist??[])],runtimePaths:[...(binding.runtimePaths??[])],references:(binding.references??[]).map(item=>({...item})),
      inputPaths:(binding.inputPaths??[]).map(item=>typeof item==='object'?{...item}:item),oraclePaths:[...(binding.oraclePaths??[])],ownedDirtyPaths:[...(binding.ownedDirtyPaths??[])],
      runtimeManagedFiles:(binding.runtimeManagedFiles??[]).map(item=>({...item}))})),
      roots:begun.map(({binding,bridge:child})=>rootBridgeRecord(binding,child)),snapshot,dependency:primary.bridge.dependency,
      concurrentScopes:declaredScopes,
      writer:{host:'orca-native',assurance:'detection-only',maxWriters:writerBound(options.maxWriters)*roots.filter(root=>root.workerWritable||root.runtimeWritable).length,
        resources:roots.filter(root=>root.workerWritable||root.runtimeWritable).map(candidateBindingWriterResource)},
      beganAt:new Date(options.now?.()??Date.now()).toISOString()};
    writeJsonAtomic(path.join(options.controlRoot,CANDIDATE_FILES.bridge),bridge);
    return readCandidateBridge(options.controlRoot);
  }catch(error){throw error;}
}

export function protectedOracleManifest(bridge,op,{expectedBaseFailures={}}={}){
  if(bridge.schema===ROOT_DETECTION_BRIDGE){
    const oracles=bridge.roots.flatMap(root=>protectedOracleManifest(root.bridge,op,{expectedBaseFailures}).oracles.map(item=>({
      ...item,id:`${root.id}:${item.id}`,rootId:root.id,rootRole:root.role,path:candidateDisplayPath(root,item.path)})));
    return {schema:'starci/oracle-manifest@1',digest:sha256(JSON.stringify(bridge.roots.map(root=>({id:root.id,digest:root.bridge.snapshot.oracle.digest})))),oracles};
  }
  const oracles=bridge.snapshot.oracle.entries.map((item,index)=>({id:`oracle-${index+1}`,path:item.path,sha256:item.sha256,
    ownerAttemptId:`kernel:${bridge.identity.workflowId}:${bridge.identity.generation}`,assertionIds:[...(op.acceptance??[])],kinds:[op.kind],
    command:(op.checks??[]).find(check=>String(check.command??'').includes(path.basename(item.path)))?.command??null,
    ...(expectedBaseFailures[item.path]?{expectedBaseFailure:expectedBaseFailures[item.path]}:{})})).filter(item=>item.command);
  return {schema:'starci/oracle-manifest@1',digest:bridge.snapshot.oracle.digest,oracles};
}
/** Record exact kernel-owned writes after the kernel made them. This remains detection-only, never an OS fence. */
export function acknowledgeRuntimeBaseline(bridge,paths=[]){
  if(bridge.schema===ROOT_DETECTION_BRIDGE){
    const grouped=new Map(bridge.roots.map(root=>[root.id,[]]));
    for(const given of paths){const routed=pathInCandidateRoots(given,bridge.rootBindings);grouped.get(routed.rootId)?.push(routed.relative);}
    const results=[];
    for(const root of bridge.roots){const bounded=grouped.get(root.id)??[];if(bounded.length)results.push({rootId:root.id,...acknowledgeRuntimeBaseline(root.bridge,bounded)});}
    const records=bridge.roots.map(root=>rootSnapshotRecord(root,root.bridge)),snapshot={...bridge.snapshot,roots:records};
    snapshot.snapshotDigest=rootSnapshotDigest(bridge.bindingDigest,records);bridge.snapshot=snapshot;
    writeJsonAtomic(path.join(snapshot.controlRoot,CANDIDATE_FILES.snapshot),snapshot);writeAggregateBridge(bridge);
    return {roots:results,paths:[...paths],assurance:'detection-only'};
  }
  const bounded=[...new Set(paths.map(clean))].filter(Boolean),entries=states(bridge.repoRoot,bounded);
  if(entries.some(item=>item.state!=='file'))throw new Error('runtime baseline inputs must be readable regular files');
  bindRuntimeInputs(bridge.snapshot,{canonicalRoot:bridge.repoRoot,paths:bounded});
  bridge.sourceBaseline=states(bridge.repoRoot,bridge.snapshot.source.entries.map(item=>item.path));
  const protectedPaths=bounded.filter(file=>!matches(file,bridge.allowlist));
  bridge.runtimeBaseline=entries;bridge.runtimeOwnedPaths=protectedPaths;writeCandidateBridge(bridge);
  return {paths:bounded,protectedPaths,rebaselinedPaths:bounded.filter(file=>!protectedPaths.includes(file)),entries,assurance:'detection-only'};
}

/** After confirmed worker settlement, copy the complete observed delta into the verifier snapshot and seal it. */
function freezeSingleDetectionCandidate(bridge,{git,reportedFiles=[],housekeepingPaths=[],foreignAllowlists=[],concurrentScopes=[],now=Date.now}={}){
  if(bridge.runtimePin){const checked=verifyRuntimePin({...bridge.runtimePin,root:bridge.repoRoot});if(!checked.ok)return {schema:DETECTION_BRIDGE,status:'quarantine',reasons:[`runtime-pin-drift:${checked.reason}`],observedFiles:[],assurance:bridge.writer};}
  const foreignScopes=scopeUnion(foreignAllowlists,concurrentScopes);
  const {repoRoot,snapshot}=bridge,postDirty=bridge.nonGit?[]:statusPaths(git,repoRoot).filter(file=>!runtimeInternal(file)),postLocal=bridge.nonGit?[]:runtimeLocalPaths(repoRoot),
    before=new Map([...(bridge.sourceBaseline??[]),...bridge.dirtyBaseline,...(bridge.localBaseline??[]),...(bridge.runtimeBaseline??[]),...(bridge.runtimeManagedFullBaseline??[])].map(item=>[item.path,item]));
  const candidates=[...new Set([...before.keys(),...postDirty,...postLocal])].sort(),after=new Map(states(repoRoot,candidates).map(item=>[item.path,item]));
  const observed=candidates.filter(file=>!same(before.get(file)??{path:file,state:'absent'},after.get(file)??{path:file,state:'absent'}));
  const runtimeAcknowledgement=acknowledgedForeignRuntime(bridge,observed,{git}),housekeeping=new Set([...housekeepingPaths.map(clean),...runtimeAcknowledgement.paths]),
    housekeepingObserved=observed.filter(file=>housekeeping.has(file)),observable=observed.filter(file=>!housekeeping.has(file));
  const owned=new Set(bridge.ownedDirtyPaths??[]),dirtyAtStart=new Set(bridge.dirtyBaselinePaths??bridge.dirtyBaseline.map(item=>item.path));
  const runtimeOwned=new Set(bridge.runtimeOwnedPaths??[]),runtimeDrift=observable.filter(file=>runtimeOwned.has(file));
  const managedByPath=new Map((bridge.runtimeManagedFiles??[]).map(item=>[clean(item.path),item])),managedBaseline=new Map((bridge.runtimeManagedBaseline??[]).map(item=>[clean(item.path),item]));
  const managedOnly=new Set(observable.filter(file=>{const record=managedByPath.get(file);return record&&sameManagedOutside(managedBaseline.get(file),managedOutside(repoRoot,record));}));
  // A public brief may already be tracked-dirty or untracked when an attempt starts. Prove its surrounding
  // human bytes first, then remove that exact managed-only change from both collision checks. Missing,
  // duplicated or malformed markers cannot enter managedOnly and remain an ordinary full-file delta.
  const candidateObserved=observable.filter(file=>!runtimeOwned.has(file)&&!managedOnly.has(file));
  // A change inside another live operation's own allowlist is that operation's in-flight write: distinct
  // retryable drift evidence, never this candidate's outside-allowlist violation, and never sealed into this
  // packet. Files outside every declared scope - including foreign scopes that went quiet - fail closed below.
  const foreignDriftPaths=new Set(candidateObserved.filter(file=>!matches(file,bridge.allowlist)&&matches(file,foreignScopes)));
  const baselineTouched=observable.filter(file=>dirtyAtStart.has(file)&&!owned.has(file)&&!managedOnly.has(file)&&!foreignDriftPaths.has(file));
  const outside=candidateObserved.filter(file=>!matches(file,bridge.allowlist)&&!foreignDriftPaths.has(file));
  const reasons=[...baselineTouched.map(file=>`pre-existing-user-work-modified:${file}`),...runtimeDrift.map(file=>`kernel-owned-write-drift:${file}`),...[...foreignDriftPaths].map(file=>`concurrent-writer-drift:${file}`),...outside.map(file=>`outside-allowlist:${file}`)];
  const currentHead=bridge.nonGit?contentHead(repoRoot,snapshot.source.entries.map(item=>item.path)):headOf(git,repoRoot);
  if(currentHead!==bridge.acceptedHead)reasons.push('canonical-head-drift');
  if(reasons.length)return {schema:DETECTION_BRIDGE,status:'quarantine',reasons,concurrentWriterDrift:[...foreignDriftPaths],observedFiles:observable,housekeepingObserved,runtimeAcknowledgements:runtimeAcknowledgement.records,assurance:bridge.writer};
  const alreadySealed=fs.existsSync(path.join(snapshot.controlRoot,CANDIDATE_FILES.packet));
  // Runtime-managed-only bytes are rebound into both verifier views before the first seal. This is the same
  // narrow mechanism as other kernel-owned writes, but selected only after proving the surrounding human bytes
  // unchanged. Replays keep the immutable packet and ignore these exact paths in canonical comparison.
  if(!alreadySealed&&managedOnly.size&&!bridge.nonGit)bindRuntimeInputs(snapshot,{canonicalRoot:repoRoot,paths:[...managedOnly]});
  // A crash after writing candidate.json may precede the workflow-state save. Replaying that freeze must verify
  // the existing immutable packet, never overwrite the worker bytes or remove the packet to get past EEXIST.
  for(const file of alreadySealed?[]:candidateObserved){
    const source=path.join(repoRoot,...file.split('/')),target=path.join(snapshot.workerRoot,...file.split('/'));
    if(after.get(file)?.state==='absent'){if(fs.existsSync(target))fs.rmSync(target);continue;}
    if(after.get(file)?.state!=='file')return {schema:DETECTION_BRIDGE,status:'quarantine',reasons:[`unsupported-observed-path:${file}`],observedFiles:observable,housekeepingObserved,runtimeAcknowledgements:runtimeAcknowledgement.records,assurance:bridge.writer};
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
  }
  const packet=sealCandidate(snapshot,{allowedWrites:candidateObserved,reportedFiles,now});
  const frozen=verifyCandidateIdentity(snapshot,packet,{canonicalRoot:repoRoot,
    expectedCanonicalEntries:packet.files.filter(item=>!managedByPath.has(item.path))});
  // Replaying a sealed freeze must bind the whole canonical delta, not only the paths already present in the
  // immutable packet. In particular, a newly-created allowlisted file is absent from packet.files, so byte
  // verification alone cannot see it. The observed Git delta and the sealed change set must be identical.
  const sealedChanges=new Set(packet.changes.map(change=>change.path));
  for(const file of candidateObserved)if(!sealedChanges.has(file)){
    frozen.ok=false;frozen.mismatches.push(`canonical-delta-added:${file}`);
  }
  for(const file of sealedChanges)if(!candidateObserved.includes(file)){
    frozen.ok=false;frozen.mismatches.push(`canonical-delta-missing:${file}`);
  }
  for(const change of packet.changes)if(change.afterSha256===null&&fileState(repoRoot,change.path).state!=='absent'){
    frozen.ok=false;frozen.mismatches.push(`canonical-deletion-drift:${change.path}`);
  }
  return frozen.ok?{schema:DETECTION_BRIDGE,status:'sealed',packet,snapshot,observedFiles:candidateObserved,housekeepingObserved,runtimeAcknowledgements:runtimeAcknowledgement.records,assurance:bridge.writer}:
    {schema:DETECTION_BRIDGE,status:'quarantine',reasons:frozen.mismatches,observedFiles:observable,housekeepingObserved,runtimeAcknowledgements:runtimeAcknowledgement.records,assurance:bridge.writer};
}

function reportMismatch(bindings,observed,reported){
  const routed=new Map(),unmatched=[];
  for(const raw of [...new Set(reported??[])]){const given=clean(raw);try{const found=pathInCandidateRoots(given,bindings),key=`${found.rootId}:${found.relative}`;
      routed.set(key,given);}catch{unmatched.push(given);}}
  const observedKeys=new Set(observed.map(item=>`${item.rootId}:${item.path}`)),missing=observed.filter(item=>!routed.has(`${item.rootId}:${item.path}`)).map(item=>item.displayPath);
  for(const [key,given] of routed)if(!observedKeys.has(key))unmatched.push(given);
  return {missing,extra:[...new Set(unmatched)].sort()};
}
const housekeepingIdentity=(bridge,value)=>{
  if(!value)return null;
  const workflowId=String(value.workflowId??''),opId=String(value.opId??''),dispatch=value.dispatch===null||value.dispatch===undefined?'':String(value.dispatch);
  if(workflowId!==String(bridge.identity.workflowId)||opId!==String(bridge.identity.opId)||[workflowId,opId,dispatch].some(item=>item.includes('/')||item.includes('\\')))
    throw new Error('candidate housekeeping identity does not match the trusted candidate identity');
  return {workflowId,opId,dispatch:dispatch||null};
};
const housekeepingFiles=identity=>{if(!identity)return [];const root=`.starciwork/_local/workflows/${identity.workflowId}`,files=[`${root}/state.json`,`${root}/events.jsonl`,`${root}/kernel.lock`,`${root}/stop.flag`,
    `${root}/checks/${identity.opId}.json`,`${root}/checks/${identity.opId}.credential-request.json`,`${root}/reports/wait-state.json`,'.starciwork/_local/workflows/supervisor.lock',
    '.starciwork/_local/workflows/runtime-loads.json','.starciwork/_local/workflows/runtime-budget.json',
    // The supervisor appends repository-wide launch diagnostics while operations run. It is neither product output
    // nor workflow authority; only this exact file is excluded (other logs, state and evidence remain observed).
    '.starciwork/_local/workflows/supervisor.log'];
  if(identity.dispatch)files.push(`${root}/reports/${identity.dispatch}.json`);return files;};
const aggregatePacketFile=packet=>({...packet,roots:(packet.roots??[]).map(({packet:ignored,...root})=>root)});

/** Freeze every bound root under one immutable aggregate identity; old one-root callers retain the v1 packet. */
export function freezeDetectionCandidate(bridge,{git,reportedFiles=[],requireReported=false,housekeeping=null,foreignAllowlists=[],concurrentScopes=[],now=Date.now}={}){
  const housekeepingRecord=housekeepingIdentity(bridge,housekeeping),trustedHousekeeping=housekeepingFiles(housekeepingRecord),
    foreignScopes=scopeUnion(foreignAllowlists,concurrentScopes);
  if(bridge.schema!==ROOT_DETECTION_BRIDGE){
    const frozen=freezeSingleDetectionCandidate(bridge,{git,reportedFiles,housekeepingPaths:trustedHousekeeping,foreignAllowlists:foreignScopes,now});
    if(requireReported&&frozen.status==='sealed'){
      const observed=frozen.observedFiles.map(file=>({rootId:'source',path:file,displayPath:file})),mismatch=reportMismatch([{id:'source',primary:true,repoRoot:bridge.repoRoot}],observed,reportedFiles);
      const reportDiagnostics={unmatched:mismatch.extra};
      if(mismatch.missing.length)return {...frozen,status:'quarantine',reasons:mismatch.missing.map(file=>`unreported-changed-file:${file}`),reportDiagnostics};
      return {...frozen,reportDiagnostics};
    }
    return frozen;
  }
  const bindingDigest=candidateRootBindingDigest(bridge.rootBindings);
  if(bindingDigest!==bridge.bindingDigest)return {schema:ROOT_DETECTION_BRIDGE,status:'quarantine',reasons:['candidate-root-binding-drift'],observedFiles:[],assurance:bridge.writer};
  const housekeepingByRoot=new Map(bridge.roots.map(root=>[root.id,[]]));
  for(const file of trustedHousekeeping){const routed=pathInCandidateRoots(file,bridge.rootBindings);housekeepingByRoot.get(routed.rootId)?.push(routed.relative);}
  const foreignByRoot=new Map(bridge.roots.map(root=>[root.id,[]]));
  for(const scope of foreignScopes){try{const routed=pathInCandidateRoots(scope,bridge.rootBindings);foreignByRoot.get(routed.rootId)?.push(routed.relative);}catch{}}
  const roots=[],observed=[],housekeepingObserved=[],runtimeAcknowledgements=[],concurrentDrift=[];let quarantined=false;
  for(const root of bridge.roots){
    const frozen=freezeSingleDetectionCandidate(root.bridge,{git,reportedFiles:[],housekeepingPaths:housekeepingByRoot.get(root.id)??[],foreignAllowlists:foreignByRoot.get(root.id)??[],now});
    if(frozen.status!=='sealed')quarantined=true;
    const changed=(frozen.observedFiles??[]).map(file=>({rootId:root.id,rootRole:root.role,path:file,displayPath:candidateDisplayPath(root,file)}));observed.push(...changed);
    housekeepingObserved.push(...(frozen.housekeepingObserved??[]).map(file=>({rootId:root.id,path:file,displayPath:candidateDisplayPath(root,file)})));
    runtimeAcknowledgements.push(...(frozen.runtimeAcknowledgements??[]).map(record=>({rootId:root.id,...record})));
    concurrentDrift.push(...(frozen.concurrentWriterDrift??[]).map(file=>({rootId:root.id,path:file,displayPath:candidateDisplayPath(root,file)})));
    roots.push({id:root.id,role:root.role,repoRoot:root.repoRoot,controlRoot:root.controlRoot,runtimePin:root.runtimePin?{...root.runtimePin}:null,workerWritable:Boolean(root.workerWritable),
      runtimeWritable:Boolean(root.runtimeWritable),readOnly:Boolean(root.readOnly),status:frozen.status,reasons:[...(frozen.reasons??[])],observedFiles:changed,
      concurrentWriterDrift:[...(frozen.concurrentWriterDrift??[])],
      runtimeAcknowledgements:(frozen.runtimeAcknowledgements??[]).map(record=>({...record})),
      ...(frozen.status==='sealed'?{acceptedHead:frozen.packet.acceptedHead,snapshotDigest:frozen.packet.snapshotDigest,candidateDigest:frozen.packet.candidateDigest,
        oracleDigest:frozen.packet.oracleDigest,environmentDigest:frozen.packet.environmentDigest,files:frozen.packet.files,changes:frozen.packet.changes}:{}),packet:frozen.packet});
  }
  if(quarantined)return {schema:ROOT_DETECTION_BRIDGE,status:'quarantine',reasons:roots.flatMap(root=>root.reasons.map(reason=>`${root.id}:${reason}`)),concurrentWriterDrift:concurrentDrift.map(item=>item.displayPath),observedFiles:observed.map(item=>item.displayPath),housekeepingObserved:housekeepingObserved.map(item=>item.displayPath),runtimeAcknowledgements,roots,assurance:bridge.writer};
  const mismatch=requireReported?reportMismatch(bridge.rootBindings,observed,reportedFiles):{missing:[],extra:[]};
  const reportDiagnostics={unmatched:mismatch.extra};
  if(mismatch.missing.length)return {schema:ROOT_DETECTION_BRIDGE,status:'quarantine',reasons:mismatch.missing.map(file=>`unreported-changed-file:${file}`),reportDiagnostics,
    observedFiles:observed.map(item=>item.displayPath),housekeepingObserved:housekeepingObserved.map(item=>item.displayPath),runtimeAcknowledgements,roots,assurance:bridge.writer};
  const primary=roots.find(root=>root.id==='source')??roots[0],packet={schema:ROOT_CANDIDATE_PACKET,...identityFields(bridge.identity),bindingDigest,
    acceptedHead:primary.acceptedHead,snapshotDigest:sha256(JSON.stringify({bindingDigest,roots:roots.map(root=>({id:root.id,digest:root.snapshotDigest}))})),
    candidateDigest:sha256(JSON.stringify({bindingDigest,roots:roots.map(root=>({id:root.id,digest:root.candidateDigest}))})),
    oracleDigest:sha256(JSON.stringify(roots.map(root=>({id:root.id,digest:root.oracleDigest})))),environmentDigest:primary.environmentDigest,
    dependencyDigests:primary.packet.dependencyDigests,reportedFiles:[...reportedFiles],reportDiagnostics,housekeeping:housekeepingRecord,
    runtimeHousekeepingWriters:bridge.roots.flatMap(root=>(root.bridge.runtimeWriters??[]).map(writer=>({rootId:root.id,workflowId:writer.workflowId,
      generation:writer.generation,goalIdentity:writer.goalIdentity,journalFile:writer.journalFile,storeRoot:writer.storeRoot,sourceRoot:writer.sourceRoot,
      runtimePinDigest:writer.runtimePinDigest,prefix:writer.prefix,custodyAfterSeq:writer.custodyAfterSeq,statePath:writer.statePath,eventsPath:writer.eventsPath,lockPath:writer.lockPath}))),runtimeAcknowledgements,
    roots:roots.map(root=>{const {packet:ignored,runtimeAcknowledgements:diagnostic,...record}=root;return record;}),
    files:roots.flatMap(root=>root.files.map(file=>({...file,rootId:root.id,rootRole:root.role,displayPath:candidateDisplayPath(root,file.path)}))),
    changes:roots.flatMap(root=>root.changes.map(change=>({...change,rootId:root.id,rootRole:root.role,displayPath:candidateDisplayPath(root,change.path)}))),
    assurance:bridge.writer,sealedAt:new Date(now()).toISOString()};
  const packetFile=path.join(bridge.snapshot.controlRoot,CANDIDATE_FILES.packet);
  try{fs.writeFileSync(packetFile,`${JSON.stringify(aggregatePacketFile(packet),null,2)}\n`,{flag:'wx'});}
  catch(error){if(error?.code!=='EEXIST')throw error;const existing=readJsonFile(packetFile,ROOT_CANDIDATE_PACKET),withoutTime=value=>{const {sealedAt,reportedFiles:diagnostic,reportDiagnostics:diagnosticMismatch,runtimeAcknowledgements:runtimeDiagnostics,...bound}=value;return bound;};if(JSON.stringify(withoutTime(existing))!==JSON.stringify(withoutTime(aggregatePacketFile(packet))))throw new Error('sealed multi-root candidate conflicts with current bytes, roots or identity; preserve it for reconciliation');return {schema:ROOT_DETECTION_BRIDGE,status:'sealed',packet:readCandidatePacket(bridge.snapshot.controlRoot),snapshot:bridge.snapshot,reportDiagnostics,housekeepingObserved:housekeepingObserved.map(item=>item.displayPath),runtimeAcknowledgements,observedFiles:observed.map(item=>item.displayPath),observedByRoot:observed,roots,assurance:bridge.writer};}
  return {schema:ROOT_DETECTION_BRIDGE,status:'sealed',packet:readCandidatePacket(bridge.snapshot.controlRoot),snapshot:bridge.snapshot,
    reportDiagnostics,housekeepingObserved:housekeepingObserved.map(item=>item.displayPath),runtimeAcknowledgements,observedFiles:observed.map(item=>item.displayPath),observedByRoot:observed,roots,assurance:bridge.writer};
}

/** Build an isolated dependency artifact. Checks keep candidate cwd and receive PATH/NODE_PATH explicitly. */
export function prepareCandidateDependencies(bridge,{exec,command=bridge?.dependency?.command,timeoutMs=20*60*1000}={}){
  if(bridge?.schema===ROOT_DETECTION_BRIDGE){const source=bridge.roots.find(root=>root.id==='source')??bridge.roots[0];return prepareCandidateDependencies(source.bridge,{exec,command:source.bridge?.dependency?.command,timeoutMs});}
  const candidateRoot=bridge.snapshot.workerRoot,plan=command?{...bridge.dependency,command}:candidateDependencyPlan(candidateRoot);
  if(!plan.command)return {...bridge.dependency,...plan,ready:Boolean(plan.ready)};
  const dependencyRoot=bridge.dependency.root;fs.mkdirSync(dependencyRoot,{recursive:true});
  const result=exec(plan.command,{cwd:candidateRoot,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,timeoutMs,maxBuffer:64*1024*1024,
    env:{...process.env,npm_config_cache:path.join(dependencyRoot,'.cache')}});
  const externalLinks=Number.isInteger(result?.status)&&result.status===0?externalDependencyLinks(candidateRoot):[];
  const ready=Number.isInteger(result?.status)&&result.status===0&&!externalLinks.length;
  return {...bridge.dependency,...plan,ready,exitCode:Number.isInteger(result?.status)?result.status:1,
    evidence:externalLinks.length?`dependency install created external links: ${externalLinks.join(', ')}`:String(`${result?.stdout??''}${result?.stderr??''}`).slice(-2000),candidateRoot,
    checkEnv:{NODE_PATH:path.join(candidateRoot,'node_modules'),PATH:`${path.join(candidateRoot,'node_modules','.bin')}${path.delimiter}${process.env.PATH??''}`}};
}
