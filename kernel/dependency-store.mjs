import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Dependencies are derived, not source: `node_modules` is a pure function of the lockfile and the install
 * command. Installing it per candidate root, per operation, made the install the most expensive part of a
 * proof - a monorepo pays minutes and gigabytes twice for every op, once for the candidate and once for the
 * base it is compared against - and the base was never paid for at all, which is why a protected proof of an
 * FE slice could only ever come back `inconclusive`.
 *
 * So the runtime keeps ONE store, keyed by the digest of what determines the tree, and every root that needs
 * those dependencies is linked to the same immutable directory. Two consequences the old shape could not have:
 * an install runs once per lockfile instead of once per root, and base and candidate provably execute against
 * the same bytes - the only way their comparison measures the code rather than the package manager.
 *
 * The key is the lockfile plus the exact install command, so a candidate that edits its manifest resolves to a
 * different key and gets its own tree: the "unless the operation changed package.json" case needs no rule.
 *
 * The tooling belongs to the repository under test, never to the runtime: a runner declared in `.claude` would
 * pin every product to one version of vitest and still could not supply the product's own library graph.
 */
export const DEPENDENCY_STORE='starci/dependency-store@1';
// Machine-scoped derived data, beside `machine.sqlite`, never inside the runtime source tree: a store under
// `.claude` would be walked by the pin seal and inventoried as candidate drift. `STARCI_DEPS_ROOT` moves it.
export const storeRootFor=(env=process.env)=>env.STARCI_DEPS_ROOT?path.resolve(env.STARCI_DEPS_ROOT)
  :path.join(env.LOCALAPPDATA||path.join(os.homedir(),'.local','state'),'StarCi','runtime','deps');
const LOCKFILES=['npm-shrinkwrap.json','package-lock.json'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

/** What determines the tree: the lockfile bytes and the command that turns them into one. Null when either is absent. */
export function dependencyKeyFor(root,{command}={}){
  const lockfile=LOCKFILES.find(file=>fs.existsSync(path.join(root,file)));
  if(!lockfile||!command)return {key:null,lockfile:lockfile??null,reason:lockfile?'no install command':'no deterministic lockfile'};
  const bytes=fs.readFileSync(path.join(root,lockfile));
  return {key:digest(Buffer.concat([Buffer.from(`${command}|${lockfile}|`),bytes])).slice(0,32),lockfile};
}
export const storePathFor=(key,{env=process.env,storeRoot=storeRootFor(env)}={})=>path.join(storeRoot,key);
export const storedModulesFor=(key,options)=>path.join(storePathFor(key,options),'node_modules');
const readyFile=entry=>path.join(entry,'.starci-ready.json');
export const storeEntryReady=entry=>{try{return JSON.parse(fs.readFileSync(readyFile(entry),'utf8'))?.schema===DEPENDENCY_STORE&&fs.existsSync(path.join(entry,'node_modules'));}catch{return false;}};

/**
 * Install one key's tree, once. Concurrent installers of the same key are not fought over with a lock: each
 * stages into its own directory and the rename decides, so a crash leaves a staging directory to sweep and
 * never a half-built entry a later run would trust.
 */
export function ensureStoredDependencies(root,{exec,command,timeoutMs=20*60*1000,env=process.env,storeRoot=storeRootFor(env),now=Date.now}={}){
  const {key,lockfile,reason}=dependencyKeyFor(root,{command});
  if(!key)return {schema:DEPENDENCY_STORE,ready:false,key:null,reason};
  const entry=path.join(storeRoot,key);
  if(storeEntryReady(entry))return {schema:DEPENDENCY_STORE,ready:true,key,lockfile,path:entry,nodeModules:path.join(entry,'node_modules'),reused:true,exitCode:0};
  const staging=path.join(storeRoot,'.staging',`${key}-${crypto.randomUUID()}`);
  fs.mkdirSync(staging,{recursive:true});
  try{
    // The manifest and its lockfile are the whole input; nothing else of the root is copied, so an install can
    // never read the candidate's working tree and a staged tree can never depend on where it was built.
    fs.copyFileSync(path.join(root,'package.json'),path.join(staging,'package.json'));
    fs.copyFileSync(path.join(root,lockfile),path.join(staging,lockfile));
    const result=exec(command,{cwd:staging,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,timeoutMs,maxBuffer:64*1024*1024,
      env:{...process.env,npm_config_cache:path.join(storeRoot,'.cache')}});
    const exitCode=Number.isInteger(result?.status)?result.status:1;
    const evidence=String(`${result?.stdout??''}${result?.stderr??''}`).slice(-2000);
    if(exitCode!==0||!fs.existsSync(path.join(staging,'node_modules')))
      return {schema:DEPENDENCY_STORE,ready:false,key,lockfile,exitCode,evidence,reason:'dependency install failed'};
    fs.writeFileSync(readyFile(staging),`${JSON.stringify({schema:DEPENDENCY_STORE,key,lockfile,command,at:now()},null,2)}\n`);
    try{fs.renameSync(staging,entry);}
    catch(error){ // Lost the race: the winner's entry is the same tree by construction, so it is simply used.
      if(!storeEntryReady(entry))throw error;
      return {schema:DEPENDENCY_STORE,ready:true,key,lockfile,path:entry,nodeModules:path.join(entry,'node_modules'),reused:true,exitCode:0,evidence};
    }
    return {schema:DEPENDENCY_STORE,ready:true,key,lockfile,path:entry,nodeModules:path.join(entry,'node_modules'),reused:false,exitCode:0,evidence};
  }finally{try{if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true,force:true});}catch{}}
}

/** Point one root at a stored tree. A real `node_modules` already there is left alone: it is not the store's to remove. */
export function linkDependencies(root,nodeModules){
  const link=path.join(root,'node_modules');
  let existing=null;try{existing=fs.lstatSync(link);}catch{}
  if(existing){
    if(!existing.isSymbolicLink())return {linked:false,link,reason:'root already holds its own node_modules'};
    let target=null;try{target=fs.realpathSync(link);}catch{}
    let wanted=nodeModules;try{wanted=fs.realpathSync(nodeModules);}catch{}
    if(target&&path.resolve(target)===path.resolve(wanted))return {linked:true,link,reused:true};
    fs.rmSync(link,{recursive:true,force:true});
  }
  fs.mkdirSync(root,{recursive:true});
  fs.symlinkSync(nodeModules,link,'junction');
  return {linked:true,link,reused:false};
}
/** Whether a resolved link target is the runtime's own dependency store: the one link outside a sealed root that is not drift. */
export function withinStore(target,{env=process.env,storeRoot=storeRootFor(env)}={}){
  const relative=path.relative(path.resolve(storeRoot),path.resolve(target));
  return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);
}
