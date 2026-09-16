import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {CANDIDATE_PACKET,CANDIDATE_SNAPSHOT,bindRuntimeInputs,createCandidateSnapshot,sealCandidate,verifyCandidateIdentity} from './candidates.mjs';
import {parseRef} from './common.mjs';
import {candidateDisplayPath,candidateRootBindingDigest,pathInCandidateRoots} from './candidate-roots.mjs';
import {verifyRuntimePin} from './runtime-pin.mjs';

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
const matches=(file,scopes)=>scopes.some(scope=>{const normalized=clean(scope);if(!normalized.includes('*'))return file===normalized||file.startsWith(`${normalized.replace(/\/$/,'')}/`);try{return globExpression(normalized).test(file);}catch{return false;}});
const trackedFor=(git,root,scopes)=>{
  if(!scopes.length)return [];
  return execGit(git,root,['ls-files','-z','--',...scopes]).split('\0').map(clean).filter(Boolean);
};
const DEFAULT_EXCLUDED=[/(^|\/)\.git(\/|$)/,/(^|\/)node_modules(\/|$)/,/(^|\/)(dist|build|coverage|\.cache)(\/|$)/,
  /(^|\/)\.env([^/]*)$/,/(^|\/)(secrets?|credentials?)(\.|\/|$)/,/\.(pem|p12|pfx|key|enc)$/i,/(^|\/)\.starciwork\/_(local|resources)(\/|$)/];
const safeTracked=file=>!DEFAULT_EXCLUDED.some(pattern=>pattern.test(clean(file)));
const runtimeInternal=file=>/(^|\/)\.starciwork\/_local(\/|$)/.test(clean(file));
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
export function runtimeWriterHint({host='orca-native',repoRoot}={}){
  return {host,assurance:'detection-only',maxWriters:1,resource:candidateWriterResource(repoRoot),
    limitation:'the current native worker runs in an Orca worktree without an attested filesystem sandbox; serialization and drift checks detect contamination but do not prevent absolute-path writes'};
}

/** Capture accepted head, relevant input bytes and every pre-existing dirty path before a native worker starts. */
function beginSingleDetectionCandidate({identity,repoRoot,workerRoot,controlRoot,allowlist=[],references=[],inputPaths=[],oraclePaths=[],git,
  dependencyDigests={},environmentDigest='runtime-unpinned',ownedDirtyPaths=[],runtimeManagedFiles=[],dependencyInstall=null,nonGit=false,runtimePin=null,now=Date.now}={}){
  if(runtimePin){const checked=verifyRuntimePin({...runtimePin,root:repoRoot});if(!checked.ok)throw new Error(`candidate runtime pin is invalid before snapshot: ${checked.reason}`);}
  const dirty=nonGit?[]:statusPaths(git,repoRoot).filter(file=>!runtimeInternal(file)),allTracked=nonGit?[]:trackedFor(git,repoRoot,['.']);
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
  const bridge={schema:DETECTION_BRIDGE,identity,snapshot,repoRoot:path.resolve(repoRoot),nonGit:Boolean(nonGit),runtimePin:runtimePin?{...runtimePin}:null,allowlist:[...allowlist],references:[...references],resolvedReferences,inputPaths:[...inputPaths],
    acceptedHead,sourceBaseline:states(repoRoot,sourcePaths),dirtyBaseline:states(repoRoot,dirty),dirtyBaselinePaths:dirty,
    runtimeManagedFiles:managed,runtimeManagedBaseline:managed.map(item=>managedOutside(repoRoot,item)),
    ownedDirtyPaths:[...owned].sort(),droppedOwnedPaths,dependency:{mode:'isolated-artifact',command:dependencyInstall,
      root:path.join(controlRoot,'dependencies'),externalCache:'forbidden',symlinkedDependencies:'forbidden',assurance:'detection-only',ready:dependencyInstall===null},
    writer:runtimeWriterHint({repoRoot}),beganAt:new Date(now()).toISOString()};
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
  try{
    for(const binding of roots){
      const bridge=beginSingleDetectionCandidate({...options,...binding,repoRoot:binding.repoRoot,
        workerRoot:path.join(options.workerRoot,'roots',binding.id),controlRoot:path.join(options.controlRoot,'roots',binding.id),
        allowlist:binding.allowlist??[],references:binding.references??[],inputPaths:binding.inputPaths??[],oraclePaths:binding.oraclePaths??[],
        ownedDirtyPaths:binding.ownedDirtyPaths??[],runtimeManagedFiles:binding.runtimeManagedFiles??[],dependencyInstall:binding.id==='source'?options.dependencyInstall:null});
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
      runtimePin:binding.runtimePin?{...binding.runtimePin}:null,
      primary:Boolean(binding.primary),nonGit:Boolean(binding.nonGit),workerWritable:Boolean(binding.workerWritable),runtimeWritable:Boolean(binding.runtimeWritable),readOnly:Boolean(binding.readOnly),
      allowlist:[...(binding.allowlist??[])],runtimePaths:[...(binding.runtimePaths??[])],references:(binding.references??[]).map(item=>({...item})),
      inputPaths:(binding.inputPaths??[]).map(item=>typeof item==='object'?{...item}:item),oraclePaths:[...(binding.oraclePaths??[])],ownedDirtyPaths:[...(binding.ownedDirtyPaths??[])],
      runtimeManagedFiles:(binding.runtimeManagedFiles??[]).map(item=>({...item}))})),
      roots:begun.map(({binding,bridge:child})=>rootBridgeRecord(binding,child)),snapshot,dependency:primary.bridge.dependency,
      writer:{host:'orca-native',assurance:'detection-only',maxWriters:roots.filter(root=>root.workerWritable||root.runtimeWritable).length,
        resources:roots.filter(root=>root.workerWritable||root.runtimeWritable).map(root=>candidateWriterResource(root.repoRoot))},
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
function freezeSingleDetectionCandidate(bridge,{git,reportedFiles=[],now=Date.now}={}){
  if(bridge.runtimePin){const checked=verifyRuntimePin({...bridge.runtimePin,root:bridge.repoRoot});if(!checked.ok)return {schema:DETECTION_BRIDGE,status:'quarantine',reasons:[`runtime-pin-drift:${checked.reason}`],observedFiles:[],assurance:bridge.writer};}
  const {repoRoot,snapshot}=bridge,postDirty=bridge.nonGit?[]:statusPaths(git,repoRoot).filter(file=>!runtimeInternal(file)),before=new Map([...(bridge.sourceBaseline??[]),...bridge.dirtyBaseline,...(bridge.runtimeBaseline??[])].map(item=>[item.path,item]));
  const candidates=[...new Set([...before.keys(),...postDirty])].sort(),after=new Map(states(repoRoot,candidates).map(item=>[item.path,item]));
  const observed=candidates.filter(file=>!same(before.get(file)??{path:file,state:'absent'},after.get(file)??{path:file,state:'absent'}));
  const owned=new Set(bridge.ownedDirtyPaths??[]),dirtyAtStart=new Set(bridge.dirtyBaselinePaths??bridge.dirtyBaseline.map(item=>item.path));
  const runtimeOwned=new Set(bridge.runtimeOwnedPaths??[]),runtimeDrift=observed.filter(file=>runtimeOwned.has(file));
  const managedByPath=new Map((bridge.runtimeManagedFiles??[]).map(item=>[clean(item.path),item])),managedBaseline=new Map((bridge.runtimeManagedBaseline??[]).map(item=>[clean(item.path),item]));
  const managedOnly=new Set(observed.filter(file=>{const record=managedByPath.get(file);return record&&sameManagedOutside(managedBaseline.get(file),managedOutside(repoRoot,record));}));
  // A public brief may already be tracked-dirty or untracked when an attempt starts. Prove its surrounding
  // human bytes first, then remove that exact managed-only change from both collision checks. Missing,
  // duplicated or malformed markers cannot enter managedOnly and remain an ordinary full-file delta.
  const baselineTouched=observed.filter(file=>dirtyAtStart.has(file)&&!owned.has(file)&&!managedOnly.has(file));
  const candidateObserved=observed.filter(file=>!runtimeOwned.has(file)&&!managedOnly.has(file)),outside=candidateObserved.filter(file=>!matches(file,bridge.allowlist));
  const reasons=[...baselineTouched.map(file=>`pre-existing-user-work-modified:${file}`),...runtimeDrift.map(file=>`kernel-owned-write-drift:${file}`),...outside.map(file=>`outside-allowlist:${file}`)];
  const currentHead=bridge.nonGit?contentHead(repoRoot,snapshot.source.entries.map(item=>item.path)):headOf(git,repoRoot);
  if(currentHead!==bridge.acceptedHead)reasons.push('canonical-head-drift');
  if(reasons.length)return {schema:DETECTION_BRIDGE,status:'quarantine',reasons,observedFiles:observed,assurance:bridge.writer};
  const alreadySealed=fs.existsSync(path.join(snapshot.controlRoot,CANDIDATE_FILES.packet));
  // Runtime-managed-only bytes are rebound into both verifier views before the first seal. This is the same
  // narrow mechanism as other kernel-owned writes, but selected only after proving the surrounding human bytes
  // unchanged. Replays keep the immutable packet and ignore these exact paths in canonical comparison.
  if(!alreadySealed&&managedOnly.size)bindRuntimeInputs(snapshot,{canonicalRoot:repoRoot,paths:[...managedOnly]});
  // A crash after writing candidate.json may precede the workflow-state save. Replaying that freeze must verify
  // the existing immutable packet, never overwrite the worker bytes or remove the packet to get past EEXIST.
  for(const file of alreadySealed?[]:candidateObserved){
    const source=path.join(repoRoot,...file.split('/')),target=path.join(snapshot.workerRoot,...file.split('/'));
    if(after.get(file)?.state==='absent'){if(fs.existsSync(target))fs.rmSync(target);continue;}
    if(after.get(file)?.state!=='file')return {schema:DETECTION_BRIDGE,status:'quarantine',reasons:[`unsupported-observed-path:${file}`],observedFiles:observed,assurance:bridge.writer};
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
  return frozen.ok?{schema:DETECTION_BRIDGE,status:'sealed',packet,snapshot,observedFiles:candidateObserved,assurance:bridge.writer}:
    {schema:DETECTION_BRIDGE,status:'quarantine',reasons:frozen.mismatches,observedFiles:observed,assurance:bridge.writer};
}

// A relative report path belongs to the primary source root. Requiring the displayed absolute path for every
// other root prevents one same-named relative file from accidentally reporting changes in two repositories.
const reportVariants=(binding,relative)=>new Set(binding?.primary||binding?.id==='source'
  ?[candidateDisplayPath(binding,relative),clean(relative)]:[candidateDisplayPath(binding,relative)]);
function reportMismatch(bindings,observed,reported){
  const normalized=new Set((reported??[]).map(clean)),missing=[],extra=[];
  for(const item of observed){const binding=bindings.find(root=>root.id===item.rootId),variants=reportVariants(binding,item.path);if(![...variants].some(value=>normalized.has(value)))missing.push(item.displayPath);}
  for(const given of normalized){
    let matched=false;for(const item of observed){const binding=bindings.find(root=>root.id===item.rootId);if(reportVariants(binding,item.path).has(given)){matched=true;break;}}
    if(!matched)extra.push(given);
  }
  return {missing,extra};
}
const aggregatePacketFile=packet=>({...packet,roots:(packet.roots??[]).map(({packet:ignored,...root})=>root)});

/** Freeze every bound root under one immutable aggregate identity; old one-root callers retain the v1 packet. */
export function freezeDetectionCandidate(bridge,{git,reportedFiles=[],requireReported=false,now=Date.now}={}){
  if(bridge.schema!==ROOT_DETECTION_BRIDGE){
    const frozen=freezeSingleDetectionCandidate(bridge,{git,reportedFiles,now});
    if(requireReported&&frozen.status==='sealed'){
      const observed=frozen.observedFiles.map(file=>({rootId:'source',path:file,displayPath:file})),mismatch=reportMismatch([{id:'source',primary:true,repoRoot:bridge.repoRoot}],observed,reportedFiles);
      if(mismatch.missing.length||mismatch.extra.length)return {...frozen,status:'quarantine',reasons:[...mismatch.missing.map(file=>`unreported-changed-file:${file}`),...mismatch.extra.map(file=>`reported-file-not-changed:${file}`)]};
    }
    return frozen;
  }
  const bindingDigest=candidateRootBindingDigest(bridge.rootBindings);
  if(bindingDigest!==bridge.bindingDigest)return {schema:ROOT_DETECTION_BRIDGE,status:'quarantine',reasons:['candidate-root-binding-drift'],observedFiles:[],assurance:bridge.writer};
  const roots=[],observed=[];let quarantined=false;
  for(const root of bridge.roots){
    const frozen=freezeSingleDetectionCandidate(root.bridge,{git,reportedFiles:[],now});
    if(frozen.status!=='sealed')quarantined=true;
    const changed=(frozen.observedFiles??[]).map(file=>({rootId:root.id,rootRole:root.role,path:file,displayPath:candidateDisplayPath(root,file)}));observed.push(...changed);
    roots.push({id:root.id,role:root.role,repoRoot:root.repoRoot,controlRoot:root.controlRoot,runtimePin:root.runtimePin?{...root.runtimePin}:null,workerWritable:Boolean(root.workerWritable),
      runtimeWritable:Boolean(root.runtimeWritable),readOnly:Boolean(root.readOnly),status:frozen.status,reasons:[...(frozen.reasons??[])],observedFiles:changed,
      ...(frozen.status==='sealed'?{acceptedHead:frozen.packet.acceptedHead,snapshotDigest:frozen.packet.snapshotDigest,candidateDigest:frozen.packet.candidateDigest,
        oracleDigest:frozen.packet.oracleDigest,environmentDigest:frozen.packet.environmentDigest,files:frozen.packet.files,changes:frozen.packet.changes}:{}),packet:frozen.packet});
  }
  if(quarantined)return {schema:ROOT_DETECTION_BRIDGE,status:'quarantine',reasons:roots.flatMap(root=>root.reasons.map(reason=>`${root.id}:${reason}`)),observedFiles:observed.map(item=>item.displayPath),roots,assurance:bridge.writer};
  const mismatch=requireReported?reportMismatch(bridge.rootBindings,observed,reportedFiles):{missing:[],extra:[]};
  if(mismatch.missing.length||mismatch.extra.length)return {schema:ROOT_DETECTION_BRIDGE,status:'quarantine',reasons:[...mismatch.missing.map(file=>`unreported-changed-file:${file}`),...mismatch.extra.map(file=>`reported-file-not-changed:${file}`)],observedFiles:observed.map(item=>item.displayPath),roots,assurance:bridge.writer};
  const primary=roots.find(root=>root.id==='source')??roots[0],packet={schema:ROOT_CANDIDATE_PACKET,...identityFields(bridge.identity),bindingDigest,
    acceptedHead:primary.acceptedHead,snapshotDigest:sha256(JSON.stringify({bindingDigest,roots:roots.map(root=>({id:root.id,digest:root.snapshotDigest}))})),
    candidateDigest:sha256(JSON.stringify({bindingDigest,roots:roots.map(root=>({id:root.id,digest:root.candidateDigest}))})),
    oracleDigest:sha256(JSON.stringify(roots.map(root=>({id:root.id,digest:root.oracleDigest})))),environmentDigest:primary.environmentDigest,
    dependencyDigests:primary.packet.dependencyDigests,reportedFiles:[...reportedFiles],roots:roots.map(root=>{const {packet:ignored,...record}=root;return record;}),
    files:roots.flatMap(root=>root.files.map(file=>({...file,rootId:root.id,rootRole:root.role,displayPath:candidateDisplayPath(root,file.path)}))),
    changes:roots.flatMap(root=>root.changes.map(change=>({...change,rootId:root.id,rootRole:root.role,displayPath:candidateDisplayPath(root,change.path)}))),
    assurance:bridge.writer,sealedAt:new Date(now()).toISOString()};
  const packetFile=path.join(bridge.snapshot.controlRoot,CANDIDATE_FILES.packet);
  try{fs.writeFileSync(packetFile,`${JSON.stringify(aggregatePacketFile(packet),null,2)}\n`,{flag:'wx'});}
  catch(error){if(error?.code!=='EEXIST')throw error;const existing=readJsonFile(packetFile,ROOT_CANDIDATE_PACKET),withoutTime=value=>{const {sealedAt,reportedFiles:diagnostic,...bound}=value;return bound;};if(JSON.stringify(withoutTime(existing))!==JSON.stringify(withoutTime(aggregatePacketFile(packet))))throw new Error('sealed multi-root candidate conflicts with current bytes, roots or identity; preserve it for reconciliation');return {schema:ROOT_DETECTION_BRIDGE,status:'sealed',packet:readCandidatePacket(bridge.snapshot.controlRoot),snapshot:bridge.snapshot,observedFiles:observed.map(item=>item.displayPath),observedByRoot:observed,roots,assurance:bridge.writer};}
  return {schema:ROOT_DETECTION_BRIDGE,status:'sealed',packet:readCandidatePacket(bridge.snapshot.controlRoot),snapshot:bridge.snapshot,
    observedFiles:observed.map(item=>item.displayPath),observedByRoot:observed,roots,assurance:bridge.writer};
}

/** Build an isolated dependency artifact. Checks keep candidate cwd and receive PATH/NODE_PATH explicitly. */
export function prepareCandidateDependencies(bridge,{exec,command=bridge?.dependency?.command,timeoutMs=20*60*1000}={}){
  if(bridge?.schema===ROOT_DETECTION_BRIDGE){const source=bridge.roots.find(root=>root.id==='source')??bridge.roots[0];return prepareCandidateDependencies(source.bridge,{exec,command:source.bridge?.dependency?.command,timeoutMs});}
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
