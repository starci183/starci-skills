// sonar-ext-custody.mjs — custody plumbing of sonar-local.mjs: launching a .mjs fake under node, and reading one custody reference
// (a sops member of a repository's .starcistacks tree, its materialized sibling, or a secret.env variable named `env:NAME`).
import fs from 'node:fs';
import path from 'node:path';
import {decrypt} from '../api/sops/decrypt.mjs';
import {sonarAnalysisEnvironment} from './sonar-credentials.mjs';
import {resolveSops} from '../api/sops/resolve-sops.mjs';
import {runProgram} from '../api/process/run-program.mjs';
import {resolveRealTool} from '../api/process/resolve-real-tool.mjs';
import {isEnvironmentReference,readEnvironmentCustody} from './sonar-host-secrets.mjs';

const sopsInvocation=Object.freeze({runProgram,resolveRealTool});

/** A .mjs/.js "binary" (the specs' fake sops) runs under this node; anything else runs directly. */
export const launcher=(bin,args)=>/\.[cm]?js$/i.test(bin)?[process.execPath,[bin,...args]]:[bin,args];

const custodyInside=(cfg,ref,plainFile)=>path.isAbsolute(String(ref))
  ?/[\\/]\.starcistacks[\\/]/.test(plainFile)
  :plainFile.startsWith(cfg.stackDir+path.sep);

/** The sops result of decrypting one binary-store .enc member: the owner's call file, the identity the environment selects, the selected tool or the one found. */
export const decryptMember=({env,sops=null,identity=null,timeoutMs},enc)=>{
  const tool=sops??resolveSops(env,{pathext:true,wingetPackageTree:true});
  const command=['--decrypt','--input-type','binary','--output-type','binary',enc];
  const [bin,args]=tool?launcher(tool,command):[null,command];
  return decrypt(bin,args,{env,identity,invocation:sopsInvocation,maxBuffer:1024*1024,timeout:timeoutMs});
};

/** The .enc member decrypted by sops: a read verdict, or null after recording why it could not serve. */
const decryptCustody=(cfg,enc,name,reasons,remember)=>{
  const result=decryptMember({env:sonarAnalysisEnvironment(cfg),sops:cfg.sops,identity:cfg.identity,timeoutMs:cfg.timeoutMs},enc);
  if(result.error?.identityRefusal)return {present:false,name,identityRefusal:result.error.identityRefusal,reason:result.error.message};
  const value=result.status===0?String(result.stdout??'').trim():'';
  if(value)return {present:true,value:remember(value),via:'sops',name};
  let reason;
  if(result.error?.code==='SOPS_MISSING')reason='sops is not installed';
  else if(result.error?.code==='ETIMEDOUT')reason=`sops did not decrypt ${name}.enc within ${cfg.timeoutMs}ms`;
  else if(result.error)reason=`sops failed to start: ${result.error.code??result.error.message}`;
  else reason=`sops could not decrypt ${name}.enc (exit ${result.status})`;
  reasons.push(reason);
  return null;
};

/**
 * Read one custody member into memory. Returns {present, value?, via?, reason?}; `value` is for a child
 * env or a header only. The .enc member decrypted by sops wins; the materialized sibling is the fallback.
 */
export function readCustody(cfg,ref,{remember}){
  // A relative reference is a member of the configured stack; an absolute one (a declaration credential,
  // resolved from its repository root) must still sit inside a repository's .starcistacks custody tree. A reference
  // `env:NAME` is a secret.env variable of the resolved environment.
  if(isEnvironmentReference(ref))return readEnvironmentCustody(sonarAnalysisEnvironment(cfg),ref,{remember});
  const plainFile=path.resolve(cfg.stackDir,ref);
  const name=String(ref).replaceAll('\\','/');
  const inside=custodyInside(cfg,ref,plainFile);
  if(!inside)return {present:false,name,reason:`custody reference ${name} is outside a stack custody tree`};
  const enc=`${plainFile}.enc`;
  const reasons=[];
  if(fs.existsSync(enc)){
    const verdict=decryptCustody(cfg,enc,name,reasons,remember);
    if(verdict)return verdict;
  }
  if(fs.existsSync(plainFile)){
    const value=fs.readFileSync(plainFile,'utf8').trim();
    if(value)return {present:true,value:remember(value),via:'materialized',name};
    reasons.push(`${name} is empty`);
  }
  if(!fs.existsSync(enc)&&!fs.existsSync(plainFile))reasons.push(`${name}(.enc) is not in custody ${cfg.stackDir}`);
  return {present:false,name,reason:reasons.join('; ')};
}
