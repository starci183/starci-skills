import fs from 'node:fs';
import path from 'node:path';

/** The host-local credential filename, resolved only against a verified runtime main root. */
export const SECRET_ENV_FILE='secret.env';
/** The configured credential variable grammar shared by validation and secret resolution. */
export const ENV_NAME=/^[A-Z_][A-Z0-9_]{0,63}$/;
export const CREDENTIAL_FILE_MAX_BYTES=1024*1024;
const resolvedValues = new Set();
const remember = value => {
  if (typeof value === 'string' && value.length >= 6) resolvedValues.add(value);
  return value;
};

/** Filter credentials resolved by this process; the values never leave their resolution owner. */
export function redactResolvedSecrets(text) {
  let clean = text;
  for (const value of resolvedValues) if (clean.includes(value)) clean = clean.split(value).join('[redacted:resolved-secret]');
  return clean;
}

/** Check lexical availability only; blank and conventional template markers never prove provider validity. */
export function credentialPresent(value){
  if(typeof value!=='string'||!value.trim())return false;
  return !/^(?:CHANGE_ME|REPLACE_ME|PLACEHOLDER|TODO|<[^>]*>|YOUR_[A-Z0-9_]+)$/i.test(value.trim());
}

/** Read one configured credential file with a finite byte budget; no effects beyond the read. */
export function readSecretBytes(file){
  const before=fs.lstatSync(file);
  if(!before.isFile()||before.isSymbolicLink())throw new Error('credential file must be a regular file');
  if(before.size>CREDENTIAL_FILE_MAX_BYTES)throw new Error('credential file exceeds the byte budget');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
  let bytes;
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.dev!==before.dev||stat.ino!==before.ino)throw new Error('credential file changed during resolution');
    bytes=Buffer.alloc(CREDENTIAL_FILE_MAX_BYTES+1);
    let count=0;
    while(count<bytes.length){const n=fs.readSync(fd,bytes,count,bytes.length-count,null);if(n===0)break;count+=n;}
    if(count>CREDENTIAL_FILE_MAX_BYTES)throw new Error('credential file exceeds the byte budget');
    return bytes.subarray(0,count);
  }catch(error){bytes?.fill(0);throw error;}finally{fs.closeSync(fd);}
}

const readCredentialFile = file => { const bytes=readSecretBytes(file); try{return bytes.toString('utf8');}finally{bytes.fill(0);} };

/** Parse a dotenv file (KEY=VALUE lines, # comments, optional export/quotes). An absent file is {}. */
export function readDotenv(file){
  let text='';try{text=readCredentialFile(file);}catch(error){if(error?.code==='ENOENT')return {};throw error;}
  const out={};
  for(const line of text.split(/\r?\n/)){
    const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!m)continue;
    let value=m[2];
    if(value.length>=2&&(value[0]==='"'||value[0]==="'")&&value.at(-1)===value[0])value=value.slice(1,-1);
    out[m[1]]=value;
  }
  return out;
}

/**
 * Resolve a configured variable or its supported NAME_FILE custody pointer. An explicitly supplied
 * blank variable disables the value; it must not resurrect a file value. Never print the result.
 */
export function connectorSecret(name,env=process.env){
  if(typeof name!=='string'||!ENV_NAME.test(name))return null;
  if(Object.hasOwn(env,name))return typeof env[name]==='string'?remember(env[name].trim()||null):null;
  const pointer=typeof env[`${name}_FILE`]==='string'?env[`${name}_FILE`].trim():'';
  if(!pointer)return null;
  try{const value=readCredentialFile(pointer).trim();return remember(value||null);}catch{return null;}
}

/**
 * Load the verified runtime main's local credentials below the actual environment without mutating
 * either input. The caller owns repository identity; this base-tier reader never infers a root from cwd.
 * Absence is allowed so the action-specific gate can name only the credentials that action requires.
 */
export function secretEnv(verifiedRuntimeRoot,env=process.env){
  if(typeof verifiedRuntimeRoot!=='string'||!path.isAbsolute(verifiedRuntimeRoot))
    throw new TypeError('secretEnv requires an absolute verified runtime root');
  if(env===null||typeof env!=='object'||Array.isArray(env))throw new TypeError('secretEnv requires an environment mapping');
  const root=fs.lstatSync(verifiedRuntimeRoot);
  if(!root.isDirectory()||root.isSymbolicLink())throw new Error('secretEnv runtime root must be a regular directory');
  const file=path.join(verifiedRuntimeRoot,SECRET_ENV_FILE);
  let stat;
  try{stat=fs.lstatSync(file);}catch(error){if(error?.code==='ENOENT')return {...env};throw error;}
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('secret.env must be a regular file');
  const local = readDotenv(file);
  const resolved = {...local,...env};
  for (const name of Object.keys(local)) if (typeof resolved[name] === 'string') remember(resolved[name]);
  return resolved;
}

/** Select a supplied age identity without inventing custody or running a key tool. Inline execution awaits its owned isolation capability. */
export function sopsIdentityEnv(env,{identity=null,required=false,platform=process.platform}={}){
  const refuse=(reason,message)=>{
    const error=new Error(`SOPS identity [${reason}]: ${message}`);
    error.name='SopsIdentityRefusal';error.identityRefusal=reason;
    return {mode:'refused',env:null,error};
  };
  if(!env||typeof env!=='object'||Array.isArray(env))return refuse('invalid-environment','an environment mapping is required');
  const names=name=>Object.keys(env).filter(key=>platform==='win32'?key.toUpperCase()===name:key===name);
  const inline=names('SOPS_AGE_KEY'),files=names('SOPS_AGE_KEY_FILE');
  if(inline.length>1||files.length>1)return refuse('ambiguous-environment','multiple Windows aliases select an age identity');
  if(inline.length){
    const name=inline[0];
    if(!credentialPresent(env[name]))return refuse('disabled-inline','SOPS_AGE_KEY is explicitly empty or invalid');
    remember(env[name].trim());
    return {...refuse('inline-context-unqualified','the supplied SOPS_AGE_KEY awaits an owned selected-identity isolation capability; no SOPS process was launched'),inlineName:name};
  }
  let file=identity;
  if(files.length){
    const value=env[files[0]];
    if(!credentialPresent(value))return refuse('disabled-file','SOPS_AGE_KEY_FILE is explicitly empty or invalid');
    if(identity!==null&&identity!==undefined&&identity!==value)return refuse('conflicting-files','two different original identity files were explicitly selected');
    file=value;
  }
  if(file!==null&&file!==undefined){
    if(!credentialPresent(file))return refuse('invalid-file','the original identity file selection is empty or invalid');
    if(!path.isAbsolute(file))return refuse('identity-file-location-unqualified','select the original identity by its absolute path; caller and SOPS working directories may differ');
    try{
      const stat=fs.lstatSync(file);
      if(!stat.isFile()||stat.isSymbolicLink())return refuse('identity-file-unavailable','the explicitly selected original identity must be a regular non-symlink file');
    }catch{return refuse('identity-file-unavailable','the explicitly selected original identity file is unavailable');}
    return {mode:'file',env:{...env,SOPS_AGE_KEY_FILE:file},error:null};
  }
  if(required)return refuse('identity-not-supplied','supply SOPS_AGE_KEY locally or select the original SOPS_AGE_KEY_FILE; no home default was inferred');
  return {mode:'public-recipient',env:{...env},error:null};
}
