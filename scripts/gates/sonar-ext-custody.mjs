// sonar-ext-custody.mjs — custody plumbing of sonar-local.mjs: finding the sops binary, launching a .mjs fake under node,
// and sealing a minted analysis token into a runtime extension's ext/<service>/secrets directory (the example apps' tokens).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {encrypt} from '../api/sops/encrypt.mjs';

const IS_WINDOWS=process.platform==='win32';

/** PATH lookup with PATHEXT and the winget package tree, the way scripts/api/sops/lib.mjs resolveSops finds sops. */
export function resolveCommand(command,env=process.env){
  const dirs=(env.PATH||'').split(IS_WINDOWS?';':':').filter(Boolean);
  if(IS_WINDOWS&&env.LOCALAPPDATA){
    const winget=path.join(env.LOCALAPPDATA,'Microsoft','WinGet');
    dirs.push(path.join(winget,'Links'));
    const packages=path.join(winget,'Packages');
    try{
      for(const entry of fs.readdirSync(packages)){
        const dir=path.join(packages,entry);
        dirs.push(dir);
        try{for(const nested of fs.readdirSync(dir,{withFileTypes:true}))if(nested.isDirectory())dirs.push(path.join(dir,nested.name));}catch{/* unreadable */}
      }
    }catch{/* no winget packages */}
  }
  const exts=IS_WINDOWS?(env.PATHEXT||'.EXE;.CMD;.BAT').split(';').filter(Boolean):[''];
  for(const dir of dirs)for(const ext of exts){
    const candidate=path.join(dir,`${command}${ext}`);
    if(fs.existsSync(candidate))return candidate;
  }
  return null;
}

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
  const sops=cfg.sops??resolveCommand('sops');
  if(!sops)return {ok:false,reason:'sops is not installed'};
  const tmp=path.join(os.tmpdir(),`sonar-local-${process.pid}-${Date.now().toString(36)}`);
  try{
    fs.writeFileSync(tmp,value,{mode:0o600});
    const [bin,args]=launcher(sops,['--encrypt','--age',recipient,'--input-type','binary','--output-type','json',tmp]);
    const result=encrypt(bin,args,{identity:cfg.identity,timeout:cfg.timeoutMs});
    if(result.status!==0||!String(result.stdout??'').trim())return {ok:false,reason:scrub(`sops --encrypt of ${path.basename(file)} exited ${result.status}: ${String(result.stderr).trim().split(/\r?\n/).slice(-2).join(' ')}`)};
    fs.writeFileSync(`${file}.enc`,result.stdout);
    return {ok:true};
  }finally{
    try{fs.rmSync(tmp,{force:true});}catch{/* best effort */}
  }
}
