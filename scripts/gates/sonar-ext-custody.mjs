// sonar-ext-custody.mjs — custody plumbing of sonar-local.mjs: launching a .mjs fake under node,
// and sealing a minted analysis token into a runtime extension's ext/<service>/secrets directory (the example apps' tokens).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {encrypt} from '../api/sops/encrypt.mjs';
import {decrypt} from '../api/sops/decrypt.mjs';
import {sonarAnalysisEnvironment} from './sonar-credentials.mjs';
import {resolveSops} from '../api/sops/lib.mjs';
import {runProgram} from '../api/process/run-program.mjs';
import {resolveRealTool} from '../api/process/resolve-real-tool.mjs';

const sopsInvocation=Object.freeze({runProgram,resolveRealTool});

/** A .mjs/.js "binary" (the specs' fake sops) runs under this node; anything else runs directly. */
export const launcher=(bin,args)=>/\.(?:c|m)?js$/i.test(bin)?[process.execPath,[bin,...args]]:[bin,args];

/** A runtime extension's custody directory: <runtime>/ext/<service>/secrets, a host tree no stack-secret tool manages. */
export const extSecretsDir=file=>{
  const dir=path.dirname(file);
  if(path.basename(dir)!=='secrets')return null;
  const ext=path.dirname(path.dirname(dir));
  return path.basename(ext)==='ext'&&(path.dirname(ext)===skillRoot||path.basename(path.dirname(ext))==='.claude')?dir:null;
};

/** The one age recipient the sealed members of an extension custody directory share; null when there is none or they differ. */
function extRecipient(dir){
  const recipients=new Set();
  for(const name of fs.existsSync(dir)?fs.readdirSync(dir):[]){
    if(!name.endsWith('.enc'))continue;
    try{for(const r of JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')).sops?.age??[])if(typeof r.recipient==='string')recipients.add(r.recipient);}catch{/* not a sops json member */}
  }
  return recipients.size===1?[...recipients][0]:null;
}

/**
 * Seal a value as a member of a runtime extension's custody (ext/<service>/secrets) with sops, to the recipient its
 * sealed siblings already share: the same recipient, never a new key. Only the .enc twin is written. The value
 * travels through a 0600 temp file read by sops - never argv.
 */
export function sealExtCustody(cfg,file,value,{scrub}){
  const dir=extSecretsDir(file);
  const recipient=extRecipient(dir);
  if(!recipient)return {ok:false,reason:`${path.basename(dir)} holds no sealed member with exactly one age recipient to seal to`};
  const env=sonarAnalysisEnvironment(cfg);
  const sops=cfg.sops??resolveSops(env,{pathext:true,wingetPackageTree:true});
  const tmp=path.join(os.tmpdir(),`sonar-local-${process.pid}-${Date.now().toString(36)}`);
  try{
    fs.writeFileSync(tmp,value,{mode:0o600});
    const command=['--encrypt','--age',recipient,'--input-type','binary','--output-type','json',tmp];
    const [bin,args]=sops?launcher(sops,command):[null,command];
    const result=encrypt(bin,args,{identity:cfg.identity,env,invocation:sopsInvocation,timeout:cfg.timeoutMs});
    if(result.error?.identityRefusal)return {ok:false,identityRefusal:result.error.identityRefusal,reason:result.error.message};
    if(result.status!==0||!String(result.stdout??'').trim())return {ok:false,reason:scrub(`sops --encrypt of ${path.basename(file)} exited ${result.status}: ${String(result.stderr).trim().split(/\r?\n/).slice(-2).join(' ')}`)};
    fs.writeFileSync(`${file}.enc`,result.stdout);
    return {ok:true};
  }finally{
    try{fs.rmSync(tmp,{force:true});}catch{/* best effort */}
  }
}

/**
 * Read one custody member into memory. Returns {present, value?, via?, reason?}; `value` is for a child
 * env or a header only. The .enc member decrypted by sops wins; the materialized sibling is the fallback.
 */
export function readCustody(cfg,ref,{remember}){
  // A relative reference is a member of the configured stack; an absolute one (a declaration credential,
  // resolved from its repository root) must still sit inside a custody tree - a repository's
  // .starcistacks or a runtime's extension tree (.claude/ext/<service>, or this runtime's own ext/ when it is a
  // lane worktree, where a host custody path resolves - scripts/gates/runtime-host.mjs resolveCustodyFile).
  const plainFile=path.resolve(cfg.stackDir,ref);
  const name=String(ref).replace(/\\/g,'/');
  const inside=path.isAbsolute(String(ref))
    ?/[\\/]\.starcistacks[\\/]/.test(plainFile)||/[\\/]\.claude[\\/]ext[\\/]/.test(plainFile)||plainFile.startsWith(path.join(skillRoot,'ext')+path.sep)
    :plainFile.startsWith(cfg.stackDir+path.sep);
  if(!inside)return {present:false,name,reason:`custody reference ${name} is outside a stack custody tree`};
  const enc=`${plainFile}.enc`;
  const reasons=[];
  if(fs.existsSync(enc)){
    const env=sonarAnalysisEnvironment(cfg);
    const sops=cfg.sops??resolveSops(env,{pathext:true,wingetPackageTree:true});
    const command=['--decrypt','--input-type','binary','--output-type','binary',enc];
    const [bin,args]=sops?launcher(sops,command):[null,command];
    const result=decrypt(bin,args,{env,identity:cfg.identity,invocation:sopsInvocation,maxBuffer:1024*1024,timeout:cfg.timeoutMs});
    if(result.error?.identityRefusal)return {present:false,name,identityRefusal:result.error.identityRefusal,reason:result.error.message};
    const value=result.status===0?String(result.stdout??'').trim():'';
    if(value)return {present:true,value:remember(value),via:'sops',name};
    reasons.push(result.error?.code==='SOPS_MISSING'?'sops is not installed':result.error?.code==='ETIMEDOUT'?`sops did not decrypt ${name}.enc within ${cfg.timeoutMs}ms`:result.error?`sops failed to start: ${result.error.code??result.error.message}`:`sops could not decrypt ${name}.enc (exit ${result.status})`);
  }
  if(fs.existsSync(plainFile)){
    const value=fs.readFileSync(plainFile,'utf8').trim();
    if(value)return {present:true,value:remember(value),via:'materialized',name};
    reasons.push(`${name} is empty`);
  }
  if(!fs.existsSync(enc)&&!fs.existsSync(plainFile))reasons.push(`${name}(.enc) is not in custody ${cfg.stackDir}`);
  return {present:false,name,reason:reasons.join('; ')};
}
