import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateAgainst} from './json-schema.mjs';
import {sessionRootOf} from './validate-request.mjs';
import {evidenceManifestErrors} from './evidence-manifest.mjs';
import {listenerPidByPort} from './serve-runtime.mjs';
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const PROBE_HEADERS=Object.freeze({'x-apollo-operation-name':'StarCiRuntimeObservation'});
async function confined(branch,ref){if(!/^response\/artifacts\/[A-Za-z0-9_.-]+\.json$/.test(ref))throw Error('NOOP_PROOF_UNBOUND: observation references stay in response/artifacts');const file=path.join(branch,ref),relative=path.relative(await realpath(branch),await realpath(file));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('NOOP_PROOF_UNBOUND: observation escaped its branch');return file;}
async function readBound(branch,address){const file=await confined(branch,address?.ref??''),bytes=await readFile(file);if(sha(bytes)!==address.sha256)throw Error('NOOP_PROOF_CHANGED: observation bytes differ from the retained hash');return JSON.parse(bytes);}
async function probe(url){const startedAt=new Date().toISOString();const response=await fetch(url,{method:'GET',headers:PROBE_HEADERS,redirect:'manual',signal:AbortSignal.timeout(10000)});const body=Buffer.from(await response.arrayBuffer());return{url,method:'GET',headers:PROBE_HEADERS,status:response.status,bodySha256:sha(body),startedAt,endedAt:new Date().toISOString()};}
const ownerFile=host=>path.join(host,'.worktrees/sessions/central-runtime/owner.json');
const endpointOrigins=entry=>[...new Set(Object.values(entry.endpoints??{}).map(url=>new URL(url).origin))].sort();
function checkUrls(entry,urls){if(JSON.stringify([...new Set(urls.map(url=>new URL(url).origin))].sort())!==JSON.stringify(endpointOrigins(entry)))throw Error('NOOP_PROOF_UNBOUND: probe every declared endpoint origin and no foreign origin');for(const url of urls){const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('NOOP_PROOF_UNBOUND: endpoints contain no credential or unsupported scheme');}}
// Recognize existing runtime owner filename variants and identity's route-prefixed lease.
// Other routes are independent. Any concurrent owner.json change is caught by the full-byte seal.
async function leases(host,routeKey){const owner=routeKey.replace('/','-');return(await readdir(path.dirname(ownerFile(host)))).filter(name=>[`${owner}.lease.json`,`runtime-${owner}.lease.json`,`identity-${owner}.lease.json`].includes(name)).sort();}
function socket(entry){const port=entry.server?.port,pid=listenerPidByPort(port);if(!Number.isInteger(port)||pid!==(entry.server?.listenerPid??entry.server?.pid))throw Error('NOOP_SOCKET_UNBOUND: the OS socket table must name the recorded listener');return{port,pid};}
function checkout(entry,wantedCommit){const worktree=entry.server?.worktree;if(typeof worktree!=='string'||!path.isAbsolute(worktree))throw Error('NOOP_SOURCE_UNBOUND: the runtime record must name its absolute serving worktree');const git=args=>execFileSync('git',['-C',worktree,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();const head=git(['rev-parse','HEAD']);git(['merge-base','--is-ancestor',wantedCommit,head]);if(head!==entry.head)throw Error('NOOP_SOURCE_UNBOUND: actual serving checkout HEAD differs from the registry');return{worktree,head,wantedCommit,ancestor:true};}
async function artifactDirectory(branch){const base=await realpath(branch),target=path.join(branch,'response/artifacts');let ancestor=target;while(true){try{const resolved=await realpath(ancestor),relative=path.relative(base,resolved);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('NOOP_PROOF_UNBOUND: artifact directory escaped its branch');break;}catch(error){if(error.code!=='ENOENT')throw error;ancestor=path.dirname(ancestor);}}await mkdir(target,{recursive:true});const relative=path.relative(base,await realpath(target));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('NOOP_PROOF_UNBOUND: artifact directory escaped its branch');return target;}

export async function captureRuntimeObservation({root,hostRoot,branch,label,urls}){
 if(!/^[a-z][a-z0-9-]*$/.test(label))throw Error('NOOP_PROOF_UNBOUND: safe observation label required');
 const session=sessionRootOf(branch);if(!session)throw Error('SESSION_MISSING: observation belongs to an open runtime invocation');
 const state=JSON.parse(await readFile(path.join(session,'state.json'))),request=JSON.parse(await readFile(path.join(branch,'request/request.json'))),cell=`${request.step}/${request.parallel}`;
 if(request.operatorId!=='runtime.serve'||state.attempts?.[cell]?.status!=='running'||state.attempts[cell].id!==request.attempt?.id)throw Error('NOOP_PROOF_UNBOUND: capture requires the actual running runtime attempt');
 const before=await readFile(ownerFile(hostRoot)),registry=JSON.parse(before),entry=registry.runtimes?.[request.requirements.routeKey];
 if(!entry||entry.status!=='ready'||entry.lease!==null||(await leases(hostRoot,request.requirements.routeKey)).length)throw Error('NOOP_RUNTIME_BUSY: ready unleased registry observation required');
 checkUrls(entry,urls);const pids=[...new Set([entry.server?.pid,entry.server?.listenerPid].filter(Number.isInteger))];if(!pids.length||pids.some(pid=>!alive(pid)))throw Error('NOOP_PROCESS_UNAVAILABLE: every recorded process must be alive');
 const probes=[];for(const url of urls){const result=await probe(url);if(result.status<200||result.status>=400)throw Error('NOOP_ENDPOINT_UNAVAILABLE: a declared endpoint is not healthy');probes.push(result);}
 const listener=socket(entry),source=checkout(entry,request.requirements.commit);
 if(sha(await readFile(ownerFile(hostRoot)))!==sha(before)||(await leases(hostRoot,request.requirements.routeKey)).length)throw Error('NOOP_INVENTORY_DRIFT: registry or lease changed during observation');
 const registryRef=`response/artifacts/${label}-registry.json`,ref=`response/artifacts/${label}.json`;
 await artifactDirectory(branch);await writeFile(path.join(branch,registryRef),before,{flag:'wx'});
 const observation={version:1,routeKey:request.requirements.routeKey,observedAt:new Date().toISOString(),registry:{ref:registryRef,sha256:sha(before)},processes:pids.map(pid=>({pid,alive:true})),listener,source,probes,activeLeaseFiles:[]};
 const bytes=JSON.stringify(observation,null,2)+'\n';await writeFile(path.join(branch,ref),bytes,{flag:'wx'});return{ref,sha256:sha(bytes)};
}

export async function runtimeNoopProofErrors({root,hostRoot,branch,request,response,delta}){
 const errors=[];const say=message=>errors.push('NOOP_PROOF_UNBOUND: '+message);
 try{
  const proof=delta.noOpProof;if(!proof||proof.before.ref===proof.after.ref)throw Error('NOOP_PROOF_UNBOUND: distinct before and after observations are required');
  const snapshots=[];const schema=JSON.parse(await readFile(path.join(root,'readiness/initialization/runtime/owner.schema.json')));
  const session=sessionRootOf(branch),state=JSON.parse(await readFile(path.join(session,'state.json'))),attempt=state.attempts?.[`${request.step}/${request.parallel}`];
  if(!attempt||attempt.id!==request.attempt?.id||!['running','matched'].includes(attempt.status))throw Error('NOOP_PROOF_UNBOUND: proof belongs to its current or accepted runtime attempt');
  const startedAt=Date.parse(attempt.startedAt),completedAt=Date.parse(response.actual?.observedAt);
  if(!Number.isFinite(startedAt)||!Number.isFinite(completedAt)||completedAt<startedAt)throw Error('NOOP_PROOF_UNBOUND: finite invocation startedAt and actual.observedAt bounds are required');
  for(const address of [proof.before,proof.after]){
   const observation=await readBound(branch,address),registry=await readBound(branch,observation.registry),entry=registry.runtimes?.[request.requirements.routeKey];
   const fields=['endpoints','head','contains','generation','status','server','lease'];
   const projection=Object.fromEntries(fields.map(key=>[key,entry?.[key]]));
   if(projection.server)projection.server=Object.fromEntries(Object.keys(schema.$defs.entry.properties.server.oneOf[0].properties).filter(key=>key in projection.server).map(key=>[key,projection.server[key]]));
   errors.push(...validateAgainst({type:'object',additionalProperties:false,required:fields,properties:Object.fromEntries(fields.map(key=>[key,schema.$defs.entry.properties[key]])),$defs:schema.$defs},projection).map(e=>'NOOP_REGISTRY_INVALID: '+e));
   errors.push(...validateAgainst(schema.properties.generation,registry.generation).map(e=>'NOOP_REGISTRY_INVALID: '+e));
   if(observation.version!==1||observation.routeKey!==request.requirements.routeKey||!entry||entry.status!=='ready'||entry.lease!==null||!Array.isArray(observation.activeLeaseFiles)||observation.activeLeaseFiles.length)throw Error('NOOP_PROOF_UNBOUND: exact healthy unleased route required');
   if(!Number.isFinite(Date.parse(observation.observedAt))||Date.parse(observation.observedAt)<startedAt||Date.parse(observation.observedAt)>completedAt)say('observations must be fresh within this invocation');
   const pids=[...new Set([entry.server?.pid,entry.server?.listenerPid].filter(Number.isInteger))].sort((a,b)=>a-b);
   if(!pids.length||JSON.stringify(observation.processes?.map(p=>p.pid).sort((a,b)=>a-b))!==JSON.stringify(pids)||observation.processes.some(p=>p.alive!==true))say('both recorded wrapper and listener processes must be observed alive');
   if(observation.listener?.port!==entry.server?.port||observation.listener?.pid!==(entry.server?.listenerPid??entry.server?.pid))say('the observed socket owner must equal the exact recorded listener and port');
   if(typeof entry.server?.worktree!=='string'||!path.isAbsolute(entry.server.worktree)||observation.source?.worktree!==entry.server.worktree||observation.source?.head!==entry.head||observation.source?.wantedCommit!==request.requirements.commit||observation.source?.ancestor!==true)say('the actual serving checkout HEAD and Git ancestry must be observed from the recorded worktree');
   checkUrls(entry,observation.probes.map(p=>p.url));
   for(const p of observation.probes)if(p.method!=='GET'||JSON.stringify(p.headers)!==JSON.stringify(PROBE_HEADERS)||p.status<200||p.status>=400||!/^sha256:[a-f0-9]{64}$/.test(p.bodySha256)||!(Date.parse(p.startedAt)>=Date.parse(attempt.startedAt)&&Date.parse(p.endedAt)>=Date.parse(p.startedAt)&&Date.parse(p.endedAt)<=Date.parse(observation.observedAt)))say('every endpoint needs a fresh successful read-only probe with the fixed non-secret operation header');
   if(entry.head!==delta.runtimeLadder.servedHead||entry.head!==delta.runtimeLadder.observed.head||entry.generation!==delta.generation||!entry.contains.includes(request.requirements.commit)||entry.server.pid!==delta.runtimeLadder.server?.pid||entry.server.port!==delta.runtimeLadder.server?.port)say('generation, head, wanted ancestry and process must equal the unchanged registry entry');
   snapshots.push({observation,registry,entry});
  }
  const [before,after]=snapshots;
  if(before.observation.registry.sha256!==after.observation.registry.sha256||before.observation.registry.ref===after.observation.registry.ref||Date.parse(after.observation.observedAt)<Date.parse(before.observation.observedAt))say('separate captures must prove identical registry bytes in chronological order');
  if(delta.inventoryFingerprint!==before.observation.registry.sha256)say('inventory fingerprint must equal the captured registry bytes');
  if(attempt.status==='matched')errors.push(...await evidenceManifestErrors(branch,attempt.evidenceManifest));
  else{
   const current=await readFile(ownerFile(hostRoot));if(sha(current)!==after.observation.registry.sha256||(await leases(hostRoot,request.requirements.routeKey)).length)say('current registry or lease changed before acceptance');
   for(const p of after.observation.processes)if(!alive(p.pid))say('recorded process is no longer alive at acceptance');
   const listener=socket(after.entry);if(listener.port!==after.observation.listener?.port||listener.pid!==after.observation.listener?.pid)say('socket ownership changed before acceptance');
   if(JSON.stringify(checkout(after.entry,request.requirements.commit))!==JSON.stringify(after.observation.source))say('actual serving checkout or ancestry changed before acceptance');
   for(const p of after.observation.probes){const fresh=await probe(p.url);if(fresh.status<200||fresh.status>=400)say('endpoint no longer answers at acceptance');}
   if(sha(await readFile(ownerFile(hostRoot)))!==sha(current)||(await leases(hostRoot,request.requirements.routeKey)).length)say('registry or lease changed while verifying acceptance');
  }
 }catch(error){errors.push(error.message);}
 return errors;
}

async function main(){const [branchArg,label,...urls]=process.argv.slice(2);if(!branchArg||!label||!urls.length)throw Error('usage: runtime-observation.mjs <branch> <label> <read-only probe URL...>');const root=path.resolve(import.meta.dirname,'..'),hostRoot=path.dirname(root);console.log(JSON.stringify(await captureRuntimeObservation({root,hostRoot,branch:path.resolve(branchArg),label,urls})));}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
