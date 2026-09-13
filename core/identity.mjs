import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml,stringifyYaml} from './yaml.mjs';

/**
 * The custody of a credential, and the one command that puts a value into it.
 *
 * A credential used to live in an environment variable: whoever exported it owned it, it was gone on the next
 * machine and in the next terminal, and the tree could not say who had set it or when. Custody is an encrypted
 * identity resource of the Work tree instead - `_resources/identity/<slug>/resource.yaml` beside
 * `secrets.enc.yaml` - so the tree names the identity, the provider subject, the role and the variable NAMES,
 * and sops holds the values under the host's own age or GPG key (the product repositories already carry a
 * `.sops.yaml`).
 *
 * Two rules run through every line here. The VALUE is read from stdin and from nowhere else - never an
 * argument, because an argument is in the process table, the shell history and every log of the launch - and it
 * is never printed, never returned and never put in an error. And a value only ever reaches sops: the encrypted
 * file is the only place it comes to rest.
 */
export const IDENTITY_RESOURCE='work/resource@1';
export const IDENTITY_ROOT='_resources/identity';
export const IDENTITY_SECRETS='secrets.enc.yaml';
export const SLUG=/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;
export const VARIABLE=/^[A-Za-z][A-Za-z0-9_]*$/;

const need=(condition,message)=>{if(!condition)throw Error(message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

/** The three paths of one custody inside a Work tree. */
export function identityPaths(workRoot,slug){
  need(SLUG.test(String(slug??'')),`An identity slug is lowercase words joined by - _ or . (got ${slug})`);
  const folder=path.join(workRoot,IDENTITY_ROOT,slug);
  return {folder,resource:path.join(folder,'resource.yaml'),secrets:path.join(folder,IDENTITY_SECRETS)};
}

/**
 * The Work tree a command was run against: the one named, else the nearest `.starciwork` at or above the
 * directory it was run in. A command that cannot find one says so rather than creating a tree nobody asked for.
 */
export function findWorkRoot(from=process.cwd(),given=null){
  if(given)return path.resolve(given);
  let at=path.resolve(from);
  for(;;){
    if(path.basename(at)==='.starciwork')return at;
    const candidate=path.join(at,'.starciwork');
    if(fs.existsSync(candidate))return candidate;
    const up=path.dirname(at);
    if(up===at)throw Error('No .starciwork tree at or above this directory; name it with --work-root <path>.');
    at=up;
  }
}

/**
 * Windows resolves an executable through PATHEXT and Node does not do that for us unless we run a shell - and
 * we will not run a shell, because a shell is one more place an argument could be logged. So the executable is
 * found here, explicitly, and spawned by its absolute path.
 */
export function resolveExecutable(name,{env=process.env}={}){
  const separator=process.platform==='win32'?';':':';
  const extensions=process.platform==='win32'
    ?String(env.PATHEXT??'.COM;.EXE;.BAT;.CMD').split(';').map(item=>item.trim()).filter(Boolean)
    :[''];
  for(const entry of String(env.PATH??env.Path??'').split(separator).filter(Boolean)){
    for(const extension of ['',...extensions]){
      const candidate=path.join(entry.replace(/^"|"$/g,''),`${name}${extension}`);
      try{if(fs.statSync(candidate).isFile())return candidate;}catch{/* the next entry */}
    }
  }
  return null;
}

/**
 * Run a resolved executable. On Windows a `.cmd` or `.bat` is a script the command processor runs, and Node
 * refuses to spawn one directly; `shell: true` would fix that by joining the arguments naively, which breaks
 * the first path with a space in it. So the command line is built here, quoted, and handed to the processor
 * verbatim. No argument of ours is ever a credential value, so nothing sensitive can be in a command line.
 */
function runExecutable(run,executable,args,options){
  if(process.platform!=='win32'||!/\.(cmd|bat)$/i.test(executable))return run(executable,args,options);
  const quote=value=>`"${String(value).replace(/"/g,'\\"')}"`;
  const line=[quote(executable),...args.map(quote)].join(' ');
  return run(options?.env?.ComSpec??process.env.ComSpec??'cmd.exe',['/d','/s','/c',`"${line}"`],
    {...options,windowsVerbatimArguments:true});
}

/** Read the whole of stdin, and nothing else: this is the only door a credential value comes through. */
export function readStdin(stream=process.stdin){
  return new Promise((resolve,reject)=>{
    let text='';
    stream.setEncoding?.('utf8');
    stream.on('data',chunk=>{text+=chunk;});
    stream.on('end',()=>resolve(text));
    stream.on('error',reject);
  });
}

const refuse=reason=>({ok:false,reason});

/**
 * Put one value into the custody of `<slug>` under the variable `<name>`. The value is never echoed, never
 * returned and never written anywhere but the encrypted file; the answer is the paths and the variable names
 * the custody now holds.
 *
 * `sops --set` would take the value as a command-line argument, which is exactly what this command exists to
 * avoid, so an existing file is decrypted, the key is set in memory, and the whole file is encrypted again.
 * The plaintext hand-off to sops is a file because sops reads a file: it is written inside the custody folder
 * with owner-only permissions, overwritten with zeros and removed before this function returns, whatever
 * happens - and it is the only moment a value is on disk unencrypted.
 */
export function setIdentitySecret({workRoot,slug,name,value,env=process.env,run=spawnSync,now=()=>new Date().toISOString()}){
  need(VARIABLE.test(String(name??'')),`A credential variable is a name like STRIPE_SECRET_KEY (got ${name})`);
  need(typeof value==='string'&&value.trim(),'The credential value is read from stdin and must not be empty');
  const paths=identityPaths(workRoot,slug);
  const sops=resolveExecutable('sops',{env});
  if(!sops)return refuse('sops is not on PATH; install sops (https://github.com/getsops/sops) and run this again. No value was read from stdin into any file.');
  const version=runExecutable(run,sops,['--version'],{encoding:'utf8',env,windowsHide:true});
  if(version?.error||version?.status!==0)return refuse(`sops is on PATH at ${slash(sops)} but does not run (${tail(version)}); no value was written.`);
  fs.mkdirSync(paths.folder,{recursive:true});
  const existing=fs.existsSync(paths.secrets);
  let secrets={};
  if(existing){
    const decrypted=runExecutable(run,sops,['--decrypt','--input-type','yaml','--output-type','yaml',paths.secrets],{encoding:'utf8',env,windowsHide:true});
    if(decrypted?.error||decrypted?.status!==0)
      return refuse(`sops cannot decrypt ${slash(paths.secrets)} - the key this file was encrypted for is not available to this host (${tail(decrypted)}). Nothing was written.`);
    try{const parsed=parseYaml(String(decrypted.stdout??''));secrets=plain(parsed)?parsed:{};}
    catch{return refuse(`${slash(paths.secrets)} does not decrypt to a mapping of variable names; nothing was written.`);}
  }
  secrets[name]=value;
  const staging=path.join(paths.folder,`.${name}.staging.yaml`);
  let written=null;
  try{
    fs.writeFileSync(staging,stringifyYaml(secrets),{mode:0o600});
    const encrypted=runExecutable(run,sops,['--encrypt','--input-type','yaml','--output-type','yaml',staging],{encoding:'utf8',env,windowsHide:true});
    if(encrypted?.error||encrypted?.status!==0)
      return refuse(`sops cannot encrypt for this tree - no age or GPG key is configured for it (${tail(encrypted)}). Check .sops.yaml and the host key; nothing was written.`);
    written=String(encrypted.stdout??'');
    if(!written.trim())return refuse('sops produced no encrypted output; nothing was written.');
  }finally{
    // The one moment a value is on disk unencrypted ends here, whatever happened above.
    try{const size=fs.statSync(staging).size;fs.writeFileSync(staging,Buffer.alloc(size,0));}catch{/* never existed */}
    try{fs.rmSync(staging,{force:true});}catch{/* nothing to remove */}
  }
  fs.writeFileSync(paths.secrets,written);
  const resource=writeIdentityResource(paths,{slug,name,now});
  return {ok:true,schema:'starci/identity-custody@1',custody:`identity:${slug}`,
    resource:slash(paths.resource),secrets:slash(paths.secrets),
    variables:[...resource.details.variables],created:!existing,
    next:`Declare it on the integration record as \`credential: {name: ${name}, providedBy: owner, custody: identity:${slug}}\`. The value is readable only through \`sops exec-env ${slash(paths.secrets)} '<command>'\`.`};
}

/** The readable half of a custody: who the identity is, what it may do and which variables it holds - no value. */
function writeIdentityResource(paths,{slug,name,now}){
  let record=null;
  if(fs.existsSync(paths.resource)){try{record=parseYaml(fs.readFileSync(paths.resource,'utf8'));}catch{record=null;}}
  const details=plain(record?.details)?{...record.details}:{};
  const existing=Array.isArray(details.variables)?details.variables.filter(item=>typeof item==='string'):[];
  const resource={schema:IDENTITY_RESOURCE,id:`identity.${slug}`,kind:'identity',
    owner:typeof record?.owner==='string'&&record.owner.trim()?record.owner:'owner',
    revision:now(),
    details:{alias:details.alias??slug,
      provider:details.provider??'(the outside system this identity belongs to)',
      subject:details.subject??'(who this identity is on that system - the account, the sender, the merchant)',
      role:details.role??'(what this identity is allowed to do)',
      variables:[...new Set([...existing,name])].sort(),
      secrets:IDENTITY_SECRETS}};
  fs.writeFileSync(paths.resource,stringifyYaml(resource));
  return resource;
}

const slash=value=>String(value).replaceAll('\\','/');
/** What a failed sops run said, bounded and never the value: sops reports on files and keys, not on content. */
const tail=result=>{
  const text=`${result?.stderr??''}${result?.error?.message??''}`.trim().replace(/\s+/g,' ');
  return text?text.slice(-200):`exit ${result?.status??'unknown'}`;
};
