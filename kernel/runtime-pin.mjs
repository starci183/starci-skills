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

/**
 * The tracked head of every workflow a ledger root carries (§12). It is recorded in the pin RECORD, never
 * inside the payload: the payload is content-addressed and immutable, while an anchor moves with every
 * checkpoint - sealing one into the payload would change the runtime's digest each time a workflow ticked.
 * What this buys is the check §12 asks for: a pin and a checkout that disagree about which history is the
 * agreed one are caught when the pin is verified, not halfway through a resumed run.
 */
export const anchorFor=repoRoot=>{
  try{const anchor=JSON.parse(fs.readFileSync(path.join(repoRoot,'.starciwork','ledger-anchor.json'),'utf8'));
    return {repoRoot:slash(path.resolve(repoRoot)),ledgerId:anchor?.ledgerId??null,
      workflows:Object.fromEntries(Object.entries(anchor?.workflows??{}).map(([id,row])=>[id,{generation:row?.generation??null,eventsHead:row?.eventsHead??null,seq:row?.seq??null}]))};
  }catch(error){return {repoRoot:slash(path.resolve(repoRoot)),ledgerId:null,workflows:{},reason:String(error?.message??error)};}
};

/**
 * The runtime payload is the source tree itself now that `.dist` is retired: every directory the kernel,
 * the launcher and the CLI import from or read contracts out of, plus the top-level documents the runtime
 * entry needs. `examples/` contributes its authored metadata only (md/yaml/json/txt) - its node_modules are
 * workspace links that can never appear inside a sealed, content-addressed payload.
 */
const RUNTIME_PAYLOAD_DIRS=['approvals','bin','cli','contracts','core','docs','execution','hosts','init','kernel','knowledge','legacy','models','modules','providers','schemas','scripts','specifications','workflows'];
const RUNTIME_PAYLOAD_FILES=['INDEX.yaml','README.yaml','UPDATE.yaml','SKILL.md','config.json','config.example.yaml','package.json'];
const EXAMPLE_DOC=/\.(?:md|ya?ml|json|txt)$/i;
const EXAMPLE_SKIP_DIRS=new Set(['node_modules','_local']);
const exampleDocs=(root,at=root)=>fs.readdirSync(at,{withFileTypes:true}).flatMap(item=>{
  const absolute=path.join(at,item.name);
  if(item.isSymbolicLink())return [];
  if(item.isDirectory())return EXAMPLE_SKIP_DIRS.has(item.name)?[]:exampleDocs(root,absolute);
  return item.isFile()&&EXAMPLE_DOC.test(item.name)?[slash(path.relative(root,absolute))]:[];
});

/** Seal the runtime payload. Building and testing are separate prerequisites, never implicit live effects. */
export function sealRuntime({sourceRoot,buildsRoot,version,ledgerRoots=[]}={}){
  const root=fs.realpathSync(path.resolve(sourceRoot)),authoredSourceRoot=slash(root);
  // Only entries that exist are sealed: a minimal fixture root may carry just `.dist` (pre-migration layout)
  // or just the source set, and a real tree carries the source set plus a not-yet-deleted `.dist` during the
  // transition. Sealing `.dist` when present keeps old-layout canon references inside the pin resolvable; once
  // the compiled tree is deleted from source, pins simply stop containing it.
  const dirs=[...RUNTIME_PAYLOAD_DIRS,'.dist'].filter(dir=>{try{return fs.statSync(path.join(root,dir)).isDirectory();}catch{return false;}});
  // A seal is two reads of the same bytes, never a hash pass followed by a later copy pass: a source file that
  // moves between the two leaves the staged copy carrying bytes the manifest never named, and every later pin
  // verification refuses a payload that sealed itself mid-write. Each entry is hashed from the bytes read for
  // the copy, so the digest always describes the payload as sealed - a file that vanishes mid-seal fails the
  // attempt instead of sealing a ghost.
  const payloadPaths=()=>[...dirs.flatMap(dir=>filesUnder(path.join(root,dir)).map(file=>`${dir}/${file}`)),
    ...(fs.existsSync(path.join(root,'examples'))?exampleDocs(path.join(root,'examples')).map(file=>`examples/${file}`):[]),
    ...RUNTIME_PAYLOAD_FILES.filter(file=>fs.existsSync(path.join(root,file)))];
  let entries=null,lastError=null;
  for(let attempt=0;attempt<3&&!entries;attempt+=1){
    try{
      const paths=payloadPaths();
      if(!paths.length)throw Error(`Runtime payload is empty: ${root} carries none of the sealed entries`);
      const staged=[];for(const file of paths.sort())staged.push({path:file,bytes:fs.readFileSync(path.join(root,file))});
      entries=staged.map(({path:file,bytes})=>({path:file,sha256:hash(bytes),bytes}));
    }catch(error){
      lastError=error;
      if(!['ENOENT','EBUSY','EPERM','ENOTDIR'].includes(error?.code)||attempt===2)throw error;
    }
  }
  if(!entries)throw lastError;
  const digest=hash(JSON.stringify({version,sourceRoot:authoredSourceRoot,entries:entries.map(({path:file,sha256})=>({path:file,sha256}))})),target=path.resolve(buildsRoot,digest);
  const anchors=ledgerRoots.map(anchorFor);
  if(fs.existsSync(target)){const pin={schema:RUNTIME_PIN,root:target,digest,version,sourceRoot:authoredSourceRoot,...(anchors.length?{anchors}:{})};const checked=verifyRuntimePin(pin);if(!checked.ok)throw Error(checked.reason);return pin;}
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const stage=`${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.mkdirSync(stage);
  for(const entry of entries){const out=path.join(stage,entry.path);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,entry.bytes);}
  fs.writeFileSync(path.join(stage,'runtime-pin.json'),JSON.stringify({schema:RUNTIME_PIN,version,digest,sourceRoot:authoredSourceRoot,entries:entries.map(({path:file,sha256})=>({path:file,sha256}))}));
  fs.renameSync(stage,target);
  return {schema:RUNTIME_PIN,root:target,digest,version,sourceRoot:authoredSourceRoot,...(anchors.length?{anchors}:{})};
}

export function verifyRuntimePin(pin,{anchors='ignore'}={}){
  try{
    if(pin?.schema!==RUNTIME_PIN||!pin.root||!/^[a-f0-9]{64}$/.test(pin.digest))throw Error('Invalid runtime pin identity');
    const root=fs.realpathSync(pin.root),manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-pin.json'),'utf8'));
    if(manifest.schema!==RUNTIME_PIN||manifest.digest!==pin.digest||manifest.version!==pin.version||!Array.isArray(manifest.entries)||!manifest.entries.length)throw Error('Runtime pin manifest mismatch');
    const sourceRoot=typeof manifest.sourceRoot==='string'&&manifest.sourceRoot.trim()?slash(manifest.sourceRoot):null;
    if(sourceRoot&&(!path.isAbsolute(sourceRoot)&&!/^[A-Za-z]:\//.test(sourceRoot)))throw Error('Runtime pin authored source identity is invalid');
    if(sourceRoot&&pin.sourceRoot!==undefined&&slash(path.resolve(pin.sourceRoot))!==slash(path.resolve(sourceRoot)))throw Error('Runtime pin authored source identity mismatch');
    const digestInput=sourceRoot?{version:manifest.version,sourceRoot,entries:manifest.entries}:{version:manifest.version,entries:manifest.entries};
    if(hash(JSON.stringify(digestInput))!==pin.digest)throw Error('Runtime pin digest mismatch');
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
    // A recorded anchor is checked only when asked: an operator verifying the payload has no ledger in hand,
    // while a kernel about to resume does, and for it a head that moved under the pin is a refusal.
    if(anchors==='check'&&Array.isArray(pin.anchors)){
      for(const recorded of pin.anchors){
        const live=anchorFor(recorded.repoRoot);
        if(recorded.ledgerId&&live.ledgerId&&recorded.ledgerId!==live.ledgerId)throw Error(`Runtime pin anchor identity mismatch: ${recorded.repoRoot}`);
        for(const [id,row] of Object.entries(recorded.workflows??{})){
          const now=live.workflows?.[id];
          if(!now)throw Error(`Runtime pin anchor is missing a sealed workflow: ${id}`);
          if(row.eventsHead&&now.eventsHead&&row.eventsHead!==now.eventsHead&&Number(now.generation??0)<Number(row.generation??0))
            throw Error(`Runtime pin anchor moved backwards: ${id}`);
        }
      }
    }
    return {ok:true,launcher:path.join(root,'bin','starci.mjs'),sourceRoot,anchors:Array.isArray(pin.anchors)?pin.anchors.length:0};
  }catch(error){return {ok:false,reason:error.message};}
}
