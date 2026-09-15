import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {CANDIDATE_PACKET,CANDIDATE_SNAPSHOT,bindRuntimeInputs,createCandidateSnapshot,sealCandidate,verifyCandidateIdentity} from './candidates.mjs';
import {parseRef} from './common.mjs';

export const DETECTION_BRIDGE='starci/candidate-bridge@1';
/** What workflow state keeps of a candidate: identity, roots and digests. The manifests stay under the control root. */
export const CANDIDATE_RECORD='starci/candidate-record@1';
const CANDIDATE_FILES={bridge:'bridge.json',snapshot:'snapshot.json',packet:'candidate.json'};
const readJsonFile=(file,schema)=>{const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value?.schema!==schema)throw new Error(`${file} is not a ${schema} record`);return value;};
const writeJsonAtomic=(file,value)=>{const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`);fs.renameSync(tmp,file);return file;};
/** Rewrite the bridge under its control root after a mutation; the snapshot file stays the snapshot's own authority. */
export function writeCandidateBridge(bridge){return writeJsonAtomic(path.join(bridge.snapshot.controlRoot,CANDIDATE_FILES.bridge),bridge);}
export function readCandidateSnapshot(controlRoot){return readJsonFile(path.join(controlRoot,CANDIDATE_FILES.snapshot),CANDIDATE_SNAPSHOT);}
export function readCandidatePacket(controlRoot){return readJsonFile(path.join(controlRoot,CANDIDATE_FILES.packet),CANDIDATE_PACKET);}
/** The bridge as last written, carrying the snapshot as last written: two files, one authority each. */
export function readCandidateBridge(controlRoot){
  const bridge=readJsonFile(path.join(controlRoot,CANDIDATE_FILES.bridge),DETECTION_BRIDGE);
  bridge.snapshot=readCandidateSnapshot(controlRoot);
  return bridge;
}
export function candidateRecord(bridge,{status='running'}={}){
  const {snapshot}=bridge;
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
    return {path:file,state:'file',sha256:sha256(fs.readFileSync(target)),size:stat.size};
  }catch(error){return {path:file,state:error?.code==='ENOENT'?'absent':'unreadable'};}
};
const states=(root,paths)=>paths.map(file=>fileState(root,file));
const globExpression=value=>{
  const escaped=clean(value).replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('**','\0').replaceAll('*','[^/]*').replaceAll('\0','.*');
  return new RegExp(`^${escaped}$`);
};
const matches=(file,scopes)=>scopes.some(scope=>{const normalized=clean(scope);if(!normalized.includes('*'))return file===normalized||file.startsWith(`${normalized.replace(/\/$/,'')}/`);try{return globExpression(normalized).test(file);}catch{return false;}});
const trackedFor=(git,root,scopes)=>{
  if(!scopes.length)return [];
  return execGit(git,root,['ls-files','-z','--',...scopes]).split('\0').map(clean).filter(Boolean);
};
const DEFAULT_EXCLUDED=[/(^|\/)\.git(\/|$)/,/(^|\/)node_modules(\/|$)/,/(^|\/)(dist|build|coverage|\.cache)(\/|$)/,
  /(^|\/)\.env([^/]*)$/,/(^|\/)(secrets?|credentials?)(\.|\/|$)/,/\.(pem|p12|pfx|key|enc)$/i,/(^|\/)\.starciwork\/_resources(\/|$)/];
const safeTracked=file=>!DEFAULT_EXCLUDED.some(pattern=>pattern.test(clean(file)));
const headOf=(git,root)=>execGit(git,root,['rev-parse','HEAD']).trim();
const same=(a,b)=>a?.state===b?.state&&a?.sha256===b?.sha256;

export function candidateWriterResource(repoRoot){
  const real=fs.realpathSync(repoRoot);return {key:`canonical-writer:${sha256(slash(real).toLowerCase())}`,units:1};
}
export function runtimeWriterHint({host='orca-native',repoRoot}={}){
  return {host,assurance:'detection-only',maxWriters:1,resource:candidateWriterResource(repoRoot),
    limitation:'the current native worker runs in an Orca worktree without an attested filesystem sandbox; serialization and drift checks detect contamination but do not prevent absolute-path writes'};
}

/** Capture accepted head, relevant input bytes and every pre-existing dirty path before a native worker starts. */
export function beginDetectionCandidate({identity,repoRoot,workerRoot,controlRoot,allowlist=[],references=[],inputPaths=[],oraclePaths=[],git,
  dependencyDigests={},environmentDigest='runtime-unpinned',ownedDirtyPaths=[],dependencyInstall=null,now=Date.now}={}){
  const acceptedHead=headOf(git,repoRoot),dirty=statusPaths(git,repoRoot),allTracked=trackedFor(git,repoRoot,['.']);
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
  oraclePaths=oraclePaths.filter(safeTracked);
  const sourcePaths=[...new Set([...allTracked,...resolvedReferences.map(item=>item.path),...resolvedInputs.map(item=>item.path),...dirty])].filter(safeTracked)
    .filter(file=>fileState(repoRoot,file).state==='file').sort();
  const snapshot=createCandidateSnapshot({identity,repoRoot,workerRoot,controlRoot,sourcePaths,oraclePaths,acceptedHead,dependencyDigests,
    environmentDigest,assurance:{requested:'detection-only'},now});
  const owned=new Set(ownedDirtyPaths.map(clean));
  // A path a prior attempt owned that is clean now was committed or reverted since: it is no longer owned, and
  // says so on the bridge. A path outside the allowlist was never this operation's to own.
  const droppedOwnedPaths=[...owned].filter(file=>!dirty.includes(file)).sort();
  for(const file of droppedOwnedPaths)owned.delete(file);
  const invalidOwned=[...owned].filter(file=>!matches(file,allowlist));
  if(invalidOwned.length)throw new Error(`owned dirty baseline paths must be inside the bounded allowlist: ${invalidOwned.join(', ')}`);
  const bridge={schema:DETECTION_BRIDGE,identity,snapshot,repoRoot:path.resolve(repoRoot),allowlist:[...allowlist],references:[...references],resolvedReferences,inputPaths:[...inputPaths],
    acceptedHead,sourceBaseline:states(repoRoot,sourcePaths),dirtyBaseline:states(repoRoot,dirty),dirtyBaselinePaths:dirty,
    ownedDirtyPaths:[...owned].sort(),droppedOwnedPaths,dependency:{mode:'isolated-artifact',command:dependencyInstall,
      root:path.join(controlRoot,'dependencies'),externalCache:'forbidden',symlinkedDependencies:'forbidden',assurance:'detection-only',ready:dependencyInstall===null},
    writer:runtimeWriterHint({repoRoot}),beganAt:new Date(now()).toISOString()};
  fs.writeFileSync(path.join(controlRoot,'bridge.json'),`${JSON.stringify(bridge,null,2)}\n`,{flag:'wx'});
  return bridge;
}

export function protectedOracleManifest(bridge,op,{expectedBaseFailures={}}={}){
  const oracles=bridge.snapshot.oracle.entries.map((item,index)=>({id:`oracle-${index+1}`,path:item.path,sha256:item.sha256,
    ownerAttemptId:`kernel:${bridge.identity.workflowId}:${bridge.identity.generation}`,assertionIds:[...(op.acceptance??[])],kinds:[op.kind],
    command:(op.checks??[]).find(check=>String(check.command??'').includes(path.basename(item.path)))?.command??null,
    ...(expectedBaseFailures[item.path]?{expectedBaseFailure:expectedBaseFailures[item.path]}:{})})).filter(item=>item.command);
  return {schema:'starci/oracle-manifest@1',digest:bridge.snapshot.oracle.digest,oracles};
}
/** Record exact kernel-owned writes after the kernel made them. This remains detection-only, never an OS fence. */
export function acknowledgeRuntimeBaseline(bridge,paths=[]){
  const bounded=[...new Set(paths.map(clean))].filter(Boolean),entries=states(bridge.repoRoot,bounded);
  if(entries.some(item=>item.state!=='file'))throw new Error('runtime baseline inputs must be readable regular files');
  bindRuntimeInputs(bridge.snapshot,{canonicalRoot:bridge.repoRoot,paths:bounded});
  bridge.sourceBaseline=states(bridge.repoRoot,bridge.snapshot.source.entries.map(item=>item.path));
  bridge.runtimeBaseline=entries;bridge.runtimeOwnedPaths=bounded;writeCandidateBridge(bridge);return {paths:bounded,entries,assurance:'detection-only'};
}

/** After confirmed worker settlement, copy the complete observed delta into the verifier snapshot and seal it. */
export function freezeDetectionCandidate(bridge,{git,reportedFiles=[],now=Date.now}={}){
  const {repoRoot,snapshot}=bridge,postDirty=statusPaths(git,repoRoot),before=new Map([...(bridge.sourceBaseline??[]),...bridge.dirtyBaseline,...(bridge.runtimeBaseline??[])].map(item=>[item.path,item]));
  const candidates=[...new Set([...before.keys(),...postDirty])].sort(),after=new Map(states(repoRoot,candidates).map(item=>[item.path,item]));
  const observed=candidates.filter(file=>!same(before.get(file)??{path:file,state:'absent'},after.get(file)??{path:file,state:'absent'}));
  const owned=new Set(bridge.ownedDirtyPaths??[]),dirtyAtStart=new Set(bridge.dirtyBaselinePaths??bridge.dirtyBaseline.map(item=>item.path));
  const baselineTouched=observed.filter(file=>dirtyAtStart.has(file)&&!owned.has(file));
  const runtimeOwned=new Set(bridge.runtimeOwnedPaths??[]),runtimeDrift=observed.filter(file=>runtimeOwned.has(file));
  const candidateObserved=observed.filter(file=>!runtimeOwned.has(file)),outside=candidateObserved.filter(file=>!matches(file,bridge.allowlist));
  const reasons=[...baselineTouched.map(file=>`pre-existing-user-work-modified:${file}`),...runtimeDrift.map(file=>`kernel-owned-write-drift:${file}`),...outside.map(file=>`outside-allowlist:${file}`)];
  if(headOf(git,repoRoot)!==bridge.acceptedHead)reasons.push('canonical-head-drift');
  if(reasons.length)return {schema:DETECTION_BRIDGE,status:'quarantine',reasons,observedFiles:observed,assurance:bridge.writer};
  const alreadySealed=fs.existsSync(path.join(snapshot.controlRoot,CANDIDATE_FILES.packet));
  // A crash after writing candidate.json may precede the workflow-state save. Replaying that freeze must verify
  // the existing immutable packet, never overwrite the worker bytes or remove the packet to get past EEXIST.
  for(const file of alreadySealed?[]:candidateObserved){
    const source=path.join(repoRoot,...file.split('/')),target=path.join(snapshot.workerRoot,...file.split('/'));
    if(after.get(file)?.state==='absent'){if(fs.existsSync(target))fs.rmSync(target);continue;}
    if(after.get(file)?.state!=='file')return {schema:DETECTION_BRIDGE,status:'quarantine',reasons:[`unsupported-observed-path:${file}`],observedFiles:observed,assurance:bridge.writer};
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
  }
  const packet=sealCandidate(snapshot,{allowedWrites:candidateObserved,reportedFiles,now});
  const frozen=verifyCandidateIdentity(snapshot,packet,{canonicalRoot:repoRoot,expectedCanonicalEntries:packet.files});
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
  return frozen.ok?{schema:DETECTION_BRIDGE,status:'sealed',packet,snapshot,observedFiles:candidateObserved,assurance:bridge.writer}:
    {schema:DETECTION_BRIDGE,status:'quarantine',reasons:frozen.mismatches,observedFiles:observed,assurance:bridge.writer};
}

/** Build an isolated dependency artifact. Checks keep candidate cwd and receive PATH/NODE_PATH explicitly. */
export function prepareCandidateDependencies(bridge,{exec,command=bridge?.dependency?.command,timeoutMs=20*60*1000}={}){
  if(!command)return {...bridge.dependency,ready:true,reason:'no dependency installation declared'};
  const dependencyRoot=bridge.dependency.root;fs.mkdirSync(dependencyRoot,{recursive:true});
  for(const name of ['package.json','package-lock.json','npm-shrinkwrap.json']){
    const source=path.join(bridge.snapshot.workerRoot,name),target=path.join(dependencyRoot,name);
    if(fs.existsSync(source)){const stat=fs.lstatSync(source);if(stat.isSymbolicLink()||!stat.isFile())throw new Error(`dependency manifest is not a regular candidate file: ${name}`);fs.copyFileSync(source,target);}
  }
  const result=exec(command,{cwd:dependencyRoot,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,timeoutMs,maxBuffer:64*1024*1024,
    env:{npm_config_cache:path.join(dependencyRoot,'.cache')}});
  const ready=Number.isInteger(result?.status)&&result.status===0;
  return {...bridge.dependency,ready,exitCode:Number.isInteger(result?.status)?result.status:1,
    evidence:String(`${result?.stdout??''}${result?.stderr??''}`).slice(-2000),candidateRoot:bridge.snapshot.workerRoot,
    checkEnv:{NODE_PATH:path.join(dependencyRoot,'node_modules'),PATH:`${path.join(dependencyRoot,'node_modules','.bin')}${path.delimiter}${process.env.PATH??''}`}};
}
