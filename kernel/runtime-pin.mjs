import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RUNTIME_PIN='starci/runtime-pin@1';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const slash=value=>value.replaceAll('\\','/');
const filesUnder=(root,at=root)=>fs.readdirSync(at,{withFileTypes:true}).flatMap(item=>{
  const absolute=path.join(at,item.name);
  if(item.isSymbolicLink())throw Error(`Runtime payload contains a link: ${absolute}`);
  if(item.isDirectory())return filesUnder(root,absolute);
  if(!item.isFile())throw Error(`Runtime payload contains a non-file: ${absolute}`);
  return [slash(path.relative(root,absolute))];
});

/** Seal an already-built payload. Building and testing are separate prerequisites, never implicit live effects. */
export function sealRuntime({sourceRoot,buildsRoot,version}={}){
  const root=path.resolve(sourceRoot);
  const paths=[...filesUnder(path.join(root,'.dist')).map(file=>`.dist/${file}`),'bin/starci.mjs','bin/starci-skills.mjs',
    'scripts/config.mjs','core/runtime-root.mjs','core/yaml.mjs','init/AGENTS.md','init/CLAUDE.md',
    'package.json','SKILL.md','docs/supervision-templates/op.md'];
  const entries=paths.sort().map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
  const digest=hash(JSON.stringify({version,entries})),target=path.resolve(buildsRoot,digest);
  if(fs.existsSync(target)){const pin={schema:RUNTIME_PIN,root:target,digest,version};const checked=verifyRuntimePin(pin);if(!checked.ok)throw Error(checked.reason);return pin;}
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const stage=`${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.mkdirSync(stage);
  for(const entry of entries){const out=path.join(stage,entry.path);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(root,entry.path),out);}
  fs.writeFileSync(path.join(stage,'runtime-pin.json'),JSON.stringify({schema:RUNTIME_PIN,version,digest,entries}));
  fs.renameSync(stage,target);
  return {schema:RUNTIME_PIN,root:target,digest,version};
}

export function verifyRuntimePin(pin){
  try{
    if(pin?.schema!==RUNTIME_PIN||!pin.root||!/^[a-f0-9]{64}$/.test(pin.digest))throw Error('Invalid runtime pin identity');
    const root=fs.realpathSync(pin.root),manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-pin.json'),'utf8'));
    if(manifest.schema!==RUNTIME_PIN||manifest.digest!==pin.digest||manifest.version!==pin.version||!Array.isArray(manifest.entries)||!manifest.entries.length)throw Error('Runtime pin manifest mismatch');
    if(hash(JSON.stringify({version:manifest.version,entries:manifest.entries}))!==pin.digest)throw Error('Runtime pin digest mismatch');
    const seen=new Set();
    for(const entry of manifest.entries){
      if(typeof entry.path!=='string'||path.isAbsolute(entry.path)||entry.path.split(/[\\/]/).includes('..')||seen.has(entry.path))throw Error('Unsafe runtime pin entry');
      seen.add(entry.path);
      const file=path.join(root,entry.path),real=fs.realpathSync(file),relative=path.relative(root,real);
      if(relative.startsWith('..')||path.isAbsolute(relative)||fs.lstatSync(file).isSymbolicLink())throw Error('Runtime pin entry escapes payload');
      if(hash(fs.readFileSync(real))!==entry.sha256)throw Error(`Runtime pin changed: ${entry.path}`);
    }
    const actual=filesUnder(root).filter(file=>file!=='runtime-pin.json');
    if(actual.some(file=>!seen.has(file))||actual.length!==seen.size)throw Error('Runtime pin contains unsealed files');
    return {ok:true,launcher:path.join(root,'bin','starci.mjs')};
  }catch(error){return {ok:false,reason:error.message};}
}
