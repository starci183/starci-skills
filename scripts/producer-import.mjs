import { existsSync, lstatSync, realpathSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, kindOf } from './operator-md.mjs';
import { packageForOrigin } from './retired-operators.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const positive=v=>Number.isSafeInteger(v)&&v>0;
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
  const sessions=within(hostRoot,'.worktrees/sessions');
  const sourceSession=within(sessions,sourceSessionId),targetSession=within(sessions,targetSessionId);
  const source=within(sourceSession,`step-${sourceStep}/parallel-${sourceParallel}`);
  const target=within(targetSession,`step-${targetStep}/parallel-${targetParallel}`,{missing:true});
  return {sourceSession,targetSession,source,target};
}
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
async function originAuthority(root,r,m){
  if(existsSync(path.join(r.source,'import.json')))throw Error('an imported slot cannot be laundered into a new producer');
  const original=metadata(r.source,m),state=json(within(r.sourceSession,'state.json')),key=`${m.sourceStep}/${m.sourceParallel}`;
  if(state.id!==m.sourceSessionId||state.steps?.[key]!==original.request.operatorId||state.requestHashes?.[key]!==hash(readFileSync(within(r.source,'request/request.json'))))throw Error('origin request does not match its original session operator and frozen request hash');
  try{for(const refs of Object.values(original.response.fields??{}))for(const ref of Array.isArray(refs)?refs:[refs])if(!lstatSync(within(r.source,ref)).isFile())throw Error('not a file');}catch{throw Error('origin output is missing or unsafe');}
  // The origin's declared outputs and bytes are judged by this tree; its `next` is routing history of the tree that ran it, not an output (validate-response.mjs#validateResponse, origin).
  const {validateResponse}=await import('./validate-response.mjs');
  const result=await validateResponse(root,r.source,{requirements:original.request.requirements??{},origin:true});
  if(result.errors.length)throw Error('origin response fails its typed output gate: '+result.errors.slice(0,2).join('; '));
  return original;
}
function manifestShape(m){
  const keys=['schemaVersion','sourceSessionId','sourceStep','sourceParallel','targetSessionId','targetStep','targetParallel','files'];
  if(!m||typeof m!=='object'||Object.keys(m).sort().join()!==keys.sort().join()||m.schemaVersion!==1||!Array.isArray(m.files)||!m.files.length||m.files.length>512)throw Error('invalid import manifest shape');
  const seen=new Set();for(const f of m.files){if(!f||Object.keys(f).sort().join()!=='path,sha256'||!safeRelative(f.path)||!/^(request|response)\//.test(f.path)||!/^sha256:[a-f0-9]{64}$/.test(f.sha256)||seen.has(f.path))throw Error('invalid import file inventory');seen.add(f.path);}
}

export async function validateImportedInput(root,session,inputRef,kind,{hostRoot=path.dirname(root),receivingSessionId=path.basename(session)}={}){
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
    const origin=await originAuthority(root,r,m);metadata(r.target,m);
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
  const r=roots(hostRoot,sourceSessionId,targetSessionId,sourceStep,sourceParallel,targetStep,targetParallel);
  if(existsSync(r.target))throw Error('import target already exists; never overwrite evidence');
  evidenceOnly(r.targetSession,targetStep,targetParallel);await originAuthority(root,r,m);m.files=inventory(r.source);manifestShape(m);
  const bytes=m.files.map(f=>[f.path,readFileSync(within(r.source,f.path))]);
  if(bytes.some(([p,b])=>hash(b)!==m.files.find(f=>f.path===p).sha256))throw Error('origin changed during import');
  mkdirSync(r.target,{recursive:true});
  for(const [p,b]of bytes){const dest=within(r.target,p,{missing:true});mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,b,{flag:'wx'});}
  writeFileSync(path.join(r.target,'import.json'),JSON.stringify(m,null,2)+'\n',{flag:'wx'});
  return {target:r.target,files:m.files.length,sourceSessionId};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failed=error=>{process.stderr.write(error.message+'\n');process.exitCode=1;};
  try{if(process.argv.length!==8)throw Error('usage: node producer-import.mjs <source-session> <source-step> <source-parallel> <target-session> <target-step> <target-parallel>');const [sourceSessionId,s,p,targetSessionId,t,q]=process.argv.slice(2);importProducer({sourceSessionId,sourceStep:Number(s),sourceParallel:Number(p),targetSessionId,targetStep:Number(t),targetParallel:Number(q)}).then(result=>process.stdout.write(JSON.stringify(result)+'\n'),failed);}catch(error){failed(error);}
}
