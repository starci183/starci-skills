import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CANDIDATE_SNAPSHOT='starci/candidate-snapshot@1';
export const CANDIDATE_PACKET='starci/candidate-packet@1';
export const ASSURANCE_MODES=Object.freeze(['hard-boundary','detection-only']);

const slash=value=>String(value??'').replaceAll('\\','/');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const identityOf=value=>{
  const required=['workflowId','opId','attempt','generation','jobId'];
  for(const field of required)if(value?.[field]===undefined||value?.[field]===null||String(value[field]).trim()==='')
    throw new TypeError(`candidate identity requires ${field}`);
  return Object.fromEntries(required.map(field=>[field,value[field]]));
};
const cleanRelative=value=>{
  const normalized=slash(value).replace(/^\.\//,'');
  if(!normalized||path.isAbsolute(value)||normalized==='..'||normalized.startsWith('../')||normalized.includes('/../'))
    throw new Error(`candidate path escapes its root: ${value}`);
  if(normalized==='.git'||normalized.startsWith('.git/'))throw new Error(`candidate path may not include Git metadata: ${value}`);
  return normalized;
};
const within=(root,target)=>{
  const relative=path.relative(path.resolve(root),path.resolve(target));
  return relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative));
};
const realRoot=root=>fs.realpathSync(root);
const safeSource=(root,relative)=>{
  const target=path.join(root,...cleanRelative(relative).split('/'));
  const stat=fs.lstatSync(target);
  if(stat.isSymbolicLink()||!stat.isFile())throw new Error(`candidate inputs must be regular files: ${relative}`);
  const real=fs.realpathSync(target);
  if(!within(realRoot(root),real))throw new Error(`candidate input resolves outside its root: ${relative}`);
  return {target:real,stat};
};
const entry=(root,relative)=>{
  const {target,stat}=safeSource(root,relative),bytes=fs.readFileSync(target);
  return {path:cleanRelative(relative),sha256:sha256(bytes),size:bytes.length,mode:stat.mode&0o777};
};
const inventory=(root,paths)=>[...new Set((paths??[]).map(cleanRelative))].sort().map(file=>entry(root,file));
const digestEntries=entries=>sha256(JSON.stringify(entries));
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`,{flag:'wx'});};
const copyEntries=(from,to,entries)=>{
  for(const item of entries){
    const target=path.join(to,...item.path.split('/'));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(from,...item.path.split('/')),target,fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target,item.mode);
  }
};
const replaceFile=(from,to,relative)=>{const target=path.join(to,...relative.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target))fs.rmSync(target);fs.copyFileSync(path.join(from,...relative.split('/')),target);};
const ensureSeparate=(workerRoot,controlRoot)=>{
  const worker=path.resolve(workerRoot),control=path.resolve(controlRoot);
  if(within(worker,control)||within(control,worker))throw new Error('candidate metadata and protected oracles must be outside the worker-writable root');
};

export function assuranceFor({requested='detection-only',adapterAttestation=null}={}){
  if(!ASSURANCE_MODES.includes(requested))throw new TypeError(`unknown candidate assurance mode: ${requested}`);
  if(requested==='hard-boundary'){
    if(!adapterAttestation||adapterAttestation.verdict!=='pass'||!adapterAttestation.enforcesWrites)
      throw new Error('hard-boundary requires a passing adapter attestation that enforces writes');
    return {mode:'hard-boundary',preventsOutOfScopeWrites:true,attestation:adapterAttestation};
  }
  return {mode:'detection-only',preventsOutOfScopeWrites:false,
    limitation:'managed candidate copies and drift checks detect mutations; they do not prevent a worker from writing elsewhere'};
}

/** Materialize versioned source bytes for a worker and protected oracle bytes under the control root. */
export function createCandidateSnapshot({identity,repoRoot,workerRoot,controlRoot,sourcePaths=[],oraclePaths=[],acceptedHead,
  dependencyDigests={},environmentDigest=null,assurance={requested:'detection-only'},now=Date.now}={}){
  const bound=identityOf(identity);
  if(!repoRoot||!workerRoot||!controlRoot||!acceptedHead)throw new TypeError('candidate snapshot requires repoRoot, workerRoot, controlRoot and acceptedHead');
  ensureSeparate(workerRoot,controlRoot);
  if(fs.existsSync(workerRoot)||fs.existsSync(controlRoot))throw new Error('candidate roots must be new');
  fs.mkdirSync(workerRoot,{recursive:true});fs.mkdirSync(controlRoot,{recursive:true});
  const sourceEntries=inventory(repoRoot,sourcePaths),oracleEntries=inventory(repoRoot,oraclePaths);
  copyEntries(repoRoot,workerRoot,sourceEntries);
  const oracleRoot=path.join(controlRoot,'oracles');fs.mkdirSync(oracleRoot,{recursive:true});copyEntries(repoRoot,oracleRoot,oracleEntries);
  const baseRoot=path.join(controlRoot,'base');fs.mkdirSync(baseRoot,{recursive:true});copyEntries(repoRoot,baseRoot,sourceEntries);
  const sourceDigest=digestEntries(sourceEntries),oracleDigest=digestEntries(oracleEntries);
  const record={schema:CANDIDATE_SNAPSHOT,...bound,acceptedHead,workerRoot:path.resolve(workerRoot),controlRoot:path.resolve(controlRoot),
    oracleRoot:path.resolve(oracleRoot),baseRoot:path.resolve(baseRoot),source:{digest:sourceDigest,entries:sourceEntries},oracle:{digest:oracleDigest,entries:oracleEntries},
    dependencyDigests,environmentDigest,assurance:assuranceFor(assurance),createdAt:new Date(now()).toISOString()};
  record.snapshotDigest=sha256(JSON.stringify({...record,workerRoot:slash(record.workerRoot),controlRoot:slash(record.controlRoot),oracleRoot:slash(record.oracleRoot)}));
  writeJson(path.join(controlRoot,'snapshot.json'),record);
  return record;
}

export function inventoryCandidate(snapshot,{paths=snapshot.source.entries.map(item=>item.path)}={}){
  return inventory(snapshot.workerRoot,paths);
}
/** Add kernel-owned pre-worker bytes to both verifier views without changing protected oracle bytes. */
export function bindRuntimeInputs(snapshot,{canonicalRoot,paths=[]}={}){
  const updated=new Map(snapshot.source.entries.map(item=>[item.path,item]));
  for(const given of paths){const relative=cleanRelative(given),item=entry(canonicalRoot,relative);replaceFile(canonicalRoot,snapshot.workerRoot,relative);replaceFile(canonicalRoot,snapshot.baseRoot,relative);updated.set(relative,item);}
  snapshot.source.entries=[...updated.values()].sort((a,b)=>a.path.localeCompare(b.path));snapshot.source.digest=digestEntries(snapshot.source.entries);
  snapshot.snapshotDigest=sha256(JSON.stringify({...snapshot,workerRoot:slash(snapshot.workerRoot),controlRoot:slash(snapshot.controlRoot),oracleRoot:slash(snapshot.oracleRoot),snapshotDigest:undefined}));
  fs.writeFileSync(path.join(snapshot.controlRoot,'snapshot.json'),`${JSON.stringify(snapshot,null,2)}\n`);
  return snapshot.source;
}
const walkFiles=(root,current=root,out=[])=>{
  for(const dirent of fs.readdirSync(current,{withFileTypes:true})){
    const absolute=path.join(current,dirent.name),relative=slash(path.relative(root,absolute));
    if(relative==='.git'||relative.startsWith('.git/'))throw new Error('candidate worker root contains forbidden Git metadata');
    if(dirent.isSymbolicLink())throw new Error(`candidate contains a symbolic link or junction: ${relative}`);
    if(dirent.isDirectory())walkFiles(root,absolute,out);
    else if(dirent.isFile())out.push(relative);
    else throw new Error(`candidate contains an unsupported filesystem entry: ${relative}`);
  }
  return out;
};

/** Seal exact candidate bytes. `reportedFiles` is retained only as untrusted diagnostic data. */
export function sealCandidate(snapshot,{candidatePaths,allowedWrites=[],reportedFiles=[],now=Date.now}={}){
  if(snapshot?.schema!==CANDIDATE_SNAPSHOT)throw new TypeError('a candidate snapshot is required');
  const allowed=new Set(allowedWrites.map(cleanRelative));
  const discovered=walkFiles(snapshot.workerRoot);
  if(candidatePaths){
    const declared=new Set(candidatePaths.map(cleanRelative));
    const hidden=discovered.filter(file=>!declared.has(file));
    if(hidden.length)throw new Error(`candidatePaths omitted files present in the worker root: ${hidden.join(', ')}`);
  }
  const files=inventory(snapshot.workerRoot,discovered);
  const source=new Map(snapshot.source.entries.map(item=>[item.path,item])),current=new Map(files.map(item=>[item.path,item]));
  const changes=[...new Set([...source.keys(),...current.keys()])].sort().filter(file=>source.get(file)?.sha256!==current.get(file)?.sha256)
    .map(file=>current.get(file)??{path:file,sha256:null,size:0,mode:null});
  const undeclared=changes.filter(item=>!allowed.has(item.path));
  if(undeclared.length)throw new Error(`candidate changed files outside its allowed writes: ${undeclared.map(item=>item.path).join(', ')}`);
  const oracleNow=inventory(snapshot.oracleRoot,snapshot.oracle.entries.map(item=>item.path));
  if(digestEntries(oracleNow)!==snapshot.oracle.digest)throw new Error('protected oracle bytes changed before candidate sealing');
  const packet={schema:CANDIDATE_PACKET,...identityOf(snapshot),acceptedHead:snapshot.acceptedHead,snapshotDigest:snapshot.snapshotDigest,
    candidateDigest:digestEntries(files),oracleDigest:snapshot.oracle.digest,environmentDigest:snapshot.environmentDigest,
    dependencyDigests:snapshot.dependencyDigests,files,changes:changes.map(item=>({path:item.path,beforeSha256:source.get(item.path)?.sha256??null,afterSha256:item.sha256})),
    assurance:snapshot.assurance,reportedFiles:[...reportedFiles],sealedAt:new Date(now()).toISOString()};
  const packetFile=path.join(snapshot.controlRoot,'candidate.json');
  try{writeJson(packetFile,packet);}
  catch(error){
    if(error?.code!=='EEXIST')throw error;
    const existing=JSON.parse(fs.readFileSync(packetFile,'utf8'));
    const binding=value=>{const {sealedAt,reportedFiles,...bound}=value;return bound;};
    if(JSON.stringify(binding(existing))!==JSON.stringify(binding(packet)))
      throw new Error('sealed candidate conflicts with current bytes or identity; preserve it for reconciliation');
    return existing;
  }
  return packet;
}

/** Read-only drift check. A mismatch requires quarantine; this function never restores or deletes bytes. */
export function verifyCandidateIdentity(snapshot,packet,{canonicalRoot=null,expectedCanonicalEntries=null}={}){
  const mismatches=[];
  try{if(digestEntries(inventory(snapshot.workerRoot,packet.files.map(item=>item.path)))!==packet.candidateDigest)mismatches.push('candidate-drift');}
  catch(error){mismatches.push(`candidate-unreadable: ${error.message}`);}
  try{if(digestEntries(inventory(snapshot.oracleRoot,snapshot.oracle.entries.map(item=>item.path)))!==packet.oracleDigest)mismatches.push('oracle-drift');}
  catch(error){mismatches.push(`oracle-unreadable: ${error.message}`);}
  if(canonicalRoot&&expectedCanonicalEntries){
    try{if(digestEntries(inventory(canonicalRoot,expectedCanonicalEntries.map(item=>item.path)))!==digestEntries(expectedCanonicalEntries))mismatches.push('canonical-drift');}
    catch(error){mismatches.push(`canonical-unreadable: ${error.message}`);}
  }
  return {ok:mismatches.length===0,verdict:mismatches.length?'quarantine':'pass',mismatches,
    assurance:packet.assurance,action:mismatches.length?'preserve candidate and canonical bytes for reconciliation; do not autorevert':'continue'};
}

const readHead=(root,git)=>{
  const result=git('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true});
  return result?.status===0?String(result.stdout??'').trim():null;
};

/** Expected-head and byte-level CAS immediately before the single canonical writer is allowed to promote. */
export function prepareCandidateIntegration(snapshot,packet,{canonicalRoot,canonicalRoots=null,git,ignoreCanonicalPaths=[],mode='hard-isolation'}={}){
  if(snapshot?.schema==='starci/candidate-root-snapshot@1'||packet?.schema==='starci/candidate-root-packet@1'){
    const reasons=[],roots=[],expected=new Map(Object.entries(canonicalRoots??{}).map(([id,root])=>[id,path.resolve(root)]));
    if(snapshot?.schema!=='starci/candidate-root-snapshot@1'||packet?.schema!=='starci/candidate-root-packet@1')reasons.push('candidate root snapshot and packet schemas disagree');
    if(snapshot?.bindingDigest!==packet?.bindingDigest)reasons.push('candidate-root-binding-digest-mismatch');
    const packets=new Map((packet?.roots??[]).map(root=>[root.id,root.packet??root])),snapshots=new Map((snapshot?.roots??[]).map(root=>[root.id,root.snapshot??root]));
    if(!expected.size)reasons.push('expected canonical root bindings are required for a multi-root candidate');
    for(const root of snapshot?.roots??[]){
      const actual=expected.get(root.id),stored=path.resolve(root.repoRoot),rootPacket=packets.get(root.id),rootSnapshot=snapshots.get(root.id);
      if(!actual||actual!==stored){reasons.push(`candidate-root-binding-mismatch:${root.id}`);continue;}
      if(!rootPacket||!rootSnapshot){reasons.push(`candidate-root-record-missing:${root.id}`);continue;}
      const ignored=ignoreCanonicalPaths.map(value=>{const absolute=path.isAbsolute(value)||/^[A-Za-z]:[\\/]/.test(value);if(!absolute)return value;const relative=path.relative(actual,path.resolve(value));return relative.startsWith('..')||path.isAbsolute(relative)?null:slash(relative);}).filter(Boolean);
      const prepared=prepareCandidateIntegration(rootSnapshot,rootPacket,{canonicalRoot:actual,git,ignoreCanonicalPaths:ignored,mode});roots.push({id:root.id,role:root.role,...prepared});
      for(const reason of prepared.reasons??[])reasons.push(`${root.id}:${reason}`);
    }
    for(const root of packet?.roots??[])if(!snapshots.has(root.id))reasons.push(`candidate-root-packet-added:${root.id}`);
    return {schema:'starci/candidate-root-integration@1',...identityOf(packet),bindingDigest:packet?.bindingDigest??null,
      candidateDigest:packet?.candidateDigest??null,snapshotDigest:packet?.snapshotDigest??null,mode,status:reasons.length?'quarantine':'ready',reasons,roots,changes:packet?.changes??[],preparedAt:new Date().toISOString()};
  }
  const ignored=new Set(ignoreCanonicalPaths.map(cleanRelative));
  if(!['hard-isolation','detection-canonical'].includes(mode))throw new TypeError(`unknown candidate integration mode: ${mode}`);
  const detection=mode==='detection-canonical';
  const expected=detection?packet.files:snapshot.source.entries;
  const universe=[...new Set([...snapshot.source.entries.map(item=>item.path),...packet.files.map(item=>item.path)])].filter(file=>!ignored.has(file));
  const identity=verifyCandidateIdentity(snapshot,packet),head=(()=>{try{return String(packet.acceptedHead??'').startsWith('content:')
    ?`content:${digestEntries(inventory(canonicalRoot,snapshot.source.entries.map(item=>item.path)))}`:readHead(canonicalRoot,git);}catch{return null;}})(),mismatches=[];
  const byPath=new Map(expected.filter(item=>!ignored.has(item.path)).map(item=>[item.path,item]));
  for(const file of universe){const wanted=byPath.get(file);try{const actual=entry(canonicalRoot,file);if(!wanted||actual.sha256!==wanted.sha256)mismatches.push(`canonical-drift:${file}`);}
    catch(error){if(wanted)mismatches.push(`canonical-${error?.code==='ENOENT'?'missing':'unreadable'}:${file}`);}}
  if(mismatches.length)mismatches.unshift('canonical-drift');
  identity.mismatches.push(...mismatches);identity.ok=identity.mismatches.length===0;identity.verdict=identity.ok?'pass':'quarantine';
  const reasons=[...identity.mismatches];
  if(head!==packet.acceptedHead)reasons.push(`expected-head-mismatch: expected ${packet.acceptedHead}, observed ${head??'unavailable'}`);
  return {schema:'starci/candidate-integration@1',...identityOf(packet),candidateDigest:packet.candidateDigest,
    snapshotDigest:packet.snapshotDigest,mode,expectedHead:packet.acceptedHead,observedHead:head,status:reasons.length?'quarantine':'ready',reasons,
    changes:packet.changes,preparedAt:new Date().toISOString()};
}

/**
 * Promote a prepared candidate through the sole integrator. The CAS is repeated before writes. Unknown user
 * changes are quarantined and never reverted. A caller journals the intent before invoking this function and
 * reconciles an `unknown`/partial receipt; this filesystem step cannot pretend to be a Git transaction.
 */
export function applyPreparedIntegration(snapshot,packet,prepared,{canonicalRoot,canonicalRoots=null,git,ignoreCanonicalPaths=[]}={}){
  if(prepared?.schema==='starci/candidate-root-integration@1'){
    if(prepared.status!=='ready'||prepared.candidateDigest!==packet?.candidateDigest)throw new Error('multi-root integration requires the matching ready preparation');
    const fresh=prepareCandidateIntegration(snapshot,packet,{canonicalRoot,canonicalRoots,git,ignoreCanonicalPaths,mode:prepared.mode??'hard-isolation'});
    if(fresh.status!=='ready')return {...fresh,outcome:'quarantine',applied:[]};
    const snapshots=new Map(snapshot.roots.map(root=>[root.id,root.snapshot??root])),packets=new Map(packet.roots.map(root=>[root.id,root.packet??root])),applied=[];
    for(const root of fresh.roots){
      const result=applyPreparedIntegration(snapshots.get(root.id),packets.get(root.id),root,{canonicalRoot:canonicalRoots[root.id],git,ignoreCanonicalPaths});
      applied.push({rootId:root.id,outcome:result.outcome,applied:result.applied??[]});
      if(result.outcome!=='applied')return {...fresh,status:'reconcile',outcome:'unknown',reason:`root ${root.id} did not settle`,applied};
    }
    return {...fresh,outcome:'applied',applied};
  }
  if(prepared?.status!=='ready'||prepared?.candidateDigest!==packet?.candidateDigest)throw new Error('integration requires the matching ready preparation');
  const fresh=prepareCandidateIntegration(snapshot,packet,{canonicalRoot,git,ignoreCanonicalPaths,mode:prepared.mode??'hard-isolation'});
  if(fresh.status!=='ready')return {...fresh,outcome:'quarantine',applied:[]};
  const applied=[];
  try{
    for(const change of packet.changes){
      const relative=cleanRelative(change.path),target=path.join(canonicalRoot,...relative.split('/'));
      if(change.afterSha256===null){if(fs.existsSync(target))fs.rmSync(target);applied.push({path:relative,effect:'deleted'});continue;}
      const source=path.join(snapshot.workerRoot,...relative.split('/'));
      const current=entry(snapshot.workerRoot,relative);
      if(current.sha256!==change.afterSha256)throw new Error(`candidate drift while integrating ${relative}`);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.copyFileSync(source,target);
      applied.push({path:relative,effect:'written',sha256:change.afterSha256});
    }
    return {...fresh,outcome:'applied',applied};
  }catch(error){return {...fresh,status:'reconcile',outcome:'unknown',reason:error.message,applied};}
}
