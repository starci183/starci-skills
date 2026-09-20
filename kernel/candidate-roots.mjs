import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {coversLedgerScope,parseRef,plain,slash,unique} from './common.mjs';
import {verifyRuntimePin} from './runtime-pin.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const absolute=value=>path.isAbsolute(String(value??''))||/^[A-Za-z]:[\\/]/.test(String(value??''));
const outside=relative=>relative===''?false:relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative);
const clean=value=>slash(String(value??'')).replace(/^\.\//,'');
const fragmentOf=literal=>{const at=literal.indexOf('#');return {key:at<0?literal:literal.slice(0,at),fragment:at<0?'':literal.slice(at)};};
const bindingShape=binding=>({id:binding.id,role:binding.role,repoRoot:slash(path.resolve(binding.repoRoot)),
  workRoot:binding.workRoot?slash(path.resolve(binding.workRoot)):null,
  sourceRoot:binding.sourceRoot?slash(path.resolve(binding.sourceRoot)):null,
  sourceRootTrust:binding.sourceRootTrust??null,
  runtimePin:binding.runtimePin?{schema:binding.runtimePin.schema??null,digest:binding.runtimePin.digest??null,version:binding.runtimePin.version??null}:null,
  primary:Boolean(binding.primary),nonGit:Boolean(binding.nonGit),readOnly:Boolean(binding.readOnly),
  workerWritable:Boolean(binding.workerWritable),runtimeWritable:Boolean(binding.runtimeWritable),
  allowlist:[...(binding.allowlist??[])].sort(),runtimePaths:[...(binding.runtimePaths??[])].sort(),
  references:(binding.references??[]).map(item=>({kind:item.kind??'file',ref:item.ref??item.path,sourceRef:item.sourceRef??null,
    path:item.path??null,fragment:item.fragment??null})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  inputPaths:(binding.inputPaths??[]).map(item=>plain(item)?{kind:item.kind??'file',ref:item.ref??item.path,sourceRef:item.sourceRef??null,path:item.path??null,fragment:item.fragment??null}:clean(item)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  oraclePaths:[...(binding.oraclePaths??[])].sort(),ownedDirtyPaths:[...(binding.ownedDirtyPaths??[])].sort(),
  runtimeManagedFiles:(binding.runtimeManagedFiles??[]).map(item=>({path:item.path,start:item.start,end:item.end})).sort((a,b)=>a.path.localeCompare(b.path))});

/** Stable identity for the exact accepted root binding; persisted candidates compare this before reuse. */
export const candidateRootBindingDigest=bindings=>sha256(JSON.stringify((bindings??[]).map(bindingShape).sort((a,b)=>a.id.localeCompare(b.id))));

export function candidateAcceptedRoots(state,work=null,{runtimeStoreRoot=null}={}){
  const source=path.resolve(state.worktree),owner=path.resolve(work?.ledger?.repoRoot??source),shared=owner!==source;
  const roots=[{id:'source',role:'source',repoRoot:source,primary:true}];
  if(shared)roots.push({id:'work',role:'work',repoRoot:owner,workRoot:path.resolve(work?.ledger?.workRoot??path.join(owner,'.starciwork')),primary:false});
  else roots[0]={...roots[0],role:'source+work',workRoot:path.resolve(work?.ledger?.workRoot??path.join(source,'.starciwork'))};
  const storeRoot=runtimeStoreRoot?path.resolve(runtimeStoreRoot):null;
  if(storeRoot&&!roots.some(root=>path.resolve(root.repoRoot)===storeRoot))
    // This binding observes only the exact public continuation supplied below. Treating the canonical backend
    // as an ordinary Git root would make unrelated workflows/*.md projections contaminate concurrent kernels.
    roots.push({id:'store',role:'workflow-store',repoRoot:storeRoot,primary:false,nonGit:true});
  const runtimeRoot=state.engine?.runtimePin?.root;
  if(runtimeRoot&&fs.existsSync(runtimeRoot)){const checked=verifyRuntimePin(state.engine.runtimePin),sealedSource=checked.ok&&checked.sourceRoot?path.resolve(checked.sourceRoot):null;
    roots.push({id:'runtime',role:'runtime-input',repoRoot:path.resolve(runtimeRoot),
    // New pins bind the original authored root inside their verified manifest, so its authored references remain
    // meaningful after relocation. Historical pins retain the live workflow host fallback and its existence check.
    sourceRoot:sealedSource??(state.host?path.resolve(state.host):null),sourceRootTrust:sealedSource?'sealed-runtime-pin':'legacy-live-host',
    runtimePin:{schema:state.engine.runtimePin.schema,digest:state.engine.runtimePin.digest,version:state.engine.runtimePin.version},primary:false,nonGit:true});
  }
  return roots;
}

const rootRelative=(root,value)=>{
  const relative=path.relative(path.resolve(root),path.resolve(String(value)));
  return outside(relative)?null:clean(relative);
};
const routePath=(value,roots,{workRelative=false}={})=>{
  const literal=String(value??'');
  if(absolute(literal)){
    const matches=roots.map(root=>({root,relative:rootRelative(root.repoRoot,literal)})).filter(item=>item.relative!==null)
      .sort((a,b)=>b.root.repoRoot.length-a.root.repoRoot.length);
    if(!matches.length)throw new Error(`candidate path is outside the accepted routed roots: ${slash(literal)}`);
    return matches[0];
  }
  const normalized=clean(literal),work=roots.find(root=>root.id==='work');
  if(!normalized||normalized==='..'||normalized.startsWith('../')||normalized.includes('/../'))throw new Error(`candidate path is outside the accepted routed roots: ${slash(literal)}`);
  if(work&&(workRelative||normalized==='.starciwork'||normalized.startsWith('.starciwork/')))return {root:work,relative:normalized};
  return {root:roots[0],relative:normalized};
};

// The sealed payload carries authored `knowledge/**` as-is. A source-spelled reference maps to itself; a
// public `.json` spelling (compiled `knowledge/<x>.json`, or the old `.dist/knowledge/<x>.json`) may stand
// for the authored `<x>.yaml`, or `index.yaml` for the `INDEX.json` public name, or an authored `.json`
// that exists verbatim. Candidates are tried in order against the sealed tree; the trailing `.dist`
// spellings keep a pin sealed before the migration (compiled JSON only) resolvable.
const compiledCanonRelatives=relative=>{
  const cleanRelative=clean(relative),
    authored=cleanRelative.match(/^knowledge\/(grammars\/.*|patterns\/fe\/.*|ui\/.*)\.ya?ml$/i),
    publicName=cleanRelative.match(/^(?:\.dist\/)?knowledge\/((?:grammars\/.*|patterns\/fe\/.*|ui\/.*))\.json$/i);
  if(authored){
    // Source spelling seals verbatim; the `.dist` compiled name is the pre-migration-pin fallback.
    const compiledName=cleanRelative.replace(/\.ya?ml$/i,'.json').replace(/\/index\.json$/i,'/INDEX.json');
    return [cleanRelative,`.dist/${compiledName}`];
  }
  if(!publicName)return [];
  const stem=`knowledge/${publicName[1]}`;
  const candidates=[`${stem}.json`,`${stem}.yaml`,`${stem}.yml`,`.dist/${stem}.json`];
  if(/\/index$/i.test(stem))candidates.push(`${stem.slice(0,-'/index'.length)}/index.yaml`);
  return candidates;
};

// Resolve every segment from the sealed directory itself so the mapping remains case-correct and cannot
// escape through a link or `..` segment.
const sealedCanonFile=(root,relative)=>{
  let cursor=path.resolve(root);
  for(const wanted of clean(relative).split('/').filter(Boolean)){
    const match=fs.readdirSync(cursor,{withFileTypes:true}).find(entry=>entry.name.toLowerCase()===wanted.toLowerCase());
    if(!match)return null;
    cursor=path.join(cursor,match.name);
  }
  return cursor;
};

function containedCanonicalFile(root,given){
  const canonicalNames=['index.yaml','index.yml','index.json','index.md'];
  let target=path.resolve(root,given),relative=rootRelative(root,target);
  if(relative===null)throw new Error(`candidate reference escapes its accepted root: ${slash(given)}`);
  const rootReal=fs.realpathSync(root),segments=relative.split('/').filter(Boolean);let cursor=path.resolve(root);
  for(const segment of segments){cursor=path.join(cursor,segment);const stat=fs.lstatSync(cursor);if(stat.isSymbolicLink())throw new Error(`candidate reference traverses a symbolic link: ${slash(given)}`);}
  let stat=fs.lstatSync(target);
  if(stat.isDirectory()){
    const index=canonicalNames.find(name=>fs.existsSync(path.join(target,name)));
    if(!index)throw Object.assign(new Error(`candidate reference directory has no canonical index: ${slash(given)}`),{code:'EISDIR'});
    target=path.join(target,index);relative=clean(path.join(relative,index));stat=fs.lstatSync(target);
    if(stat.isSymbolicLink())throw new Error(`candidate reference traverses a symbolic link: ${slash(given)}`);
  }
  const real=fs.realpathSync(target),back=path.relative(rootReal,real);
  if(!stat.isFile()||outside(back))throw new Error(`candidate reference is not a contained regular file: ${slash(given)}`);
  return {target:real,relative};
}

// A source directory is an input inventory, not a Work node. Bind every tracked regular file so the
// candidate digests the actual code instead of silently selecting an index or accepting an opaque folder.
function sourceDirectoryFiles(root,relative){
  let cursor=path.resolve(root);
  for(const segment of relative.split('/').filter(Boolean)){
    const names=fs.readdirSync(cursor),matches=names.filter(name=>name.toLowerCase()===segment.toLowerCase()),
      actual=names.includes(segment)?segment:matches.length===1&&fs.existsSync(path.join(cursor,segment))?matches[0]:segment;
    cursor=path.join(cursor,actual);if(fs.lstatSync(cursor).isSymbolicLink())throw new Error(`candidate source directory traverses a symbolic link: ${relative}`);
  }
  // Git returns canonical tracked spelling even when Windows accepted a differently cased reference.
  const canonical=path.relative(fs.realpathSync(root),fs.realpathSync(cursor));
  if(outside(canonical))throw new Error(`candidate source directory escapes its accepted root: ${relative}`);
  relative=clean(canonical);
  const inventory=spawnSync('git',['--literal-pathspecs','-C',root,'ls-files','-z','--',`${relative.replace(/\/$/,'')}/`],
    {encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
  if(inventory.status!==0)throw new Error(`candidate source directory cannot be inventoried: ${relative}`);
  const paths=unique(inventory.stdout.split('\0').filter(Boolean)).sort();
  if(!paths.length||paths.length>10000)throw new Error(`candidate source directory requires 1..10000 tracked files: ${relative}`);
  return paths.map(file=>{
    if(!file.startsWith(`${relative.replace(/\/$/,'')}/`)||/(^|\/)(?:\.git|node_modules)(?:\/|$)/.test(file))
      throw new Error(`candidate source directory contains an unsupported input: ${file}`);
    return containedCanonicalFile(root,file);
  });
}

/** Resolve node ids and Work-/repository-/absolute references only through the accepted routing roots. */
export function resolveCandidateReferences(op,state,ctx){
  const roots=candidateAcceptedRoots(state,ctx.work),source=roots[0],workBinding=roots.find(root=>root.id==='work')??source;
  const runtimeBinding=roots.find(root=>root.id==='runtime');
  const workRoot=path.resolve(ctx.work?.ledger?.workRoot??path.join(source.repoRoot,'.starciwork'));
  const nodes=ctx.work?.loaded?.nodes,list=ctx.work?.loaded?.list??[];
  return (op.references??[]).flatMap(value=>{
    const parsed=parseRef(value),literal=slash(parsed.ref),{key,fragment}=fragmentOf(literal);let routed=null,target=null;
    const node=nodes?.get?.(key)??list.find(item=>item.id===key||item.path===key);
    if(key==='.claude'){
      if(!runtimeBinding||!verifyRuntimePin(state.engine?.runtimePin).ok)throw new Error('candidate runtime reference .claude requires the verified workflow runtime pin');
      target=path.join(runtimeBinding.repoRoot,'SKILL.md');routed={root:runtimeBinding,relative:'SKILL.md'};
    }
    else if(node?.path){target=path.join(workRoot,node.path);routed={root:workBinding,relative:rootRelative(workBinding.repoRoot,target)};}
    else if(absolute(key)){
      target=path.resolve(key);
      try{routed=routePath(target,roots);}
      catch(error){
        const sourceRoot=runtimeBinding?.sourceRoot,sourceRelative=sourceRoot?rootRelative(sourceRoot,target):null,
          candidates=sourceRelative===null?[]:compiledCanonRelatives(sourceRelative);
        const trustedRelocation=runtimeBinding?.sourceRootTrust==='sealed-runtime-pin';
        if(!runtimeBinding||!sourceRoot||!candidates.length||(!trustedRelocation&&!fs.existsSync(target)))throw error;
        target=candidates.map(candidate=>sealedCanonFile(runtimeBinding.repoRoot,candidate)).find(Boolean)??null;
        if(!target)throw error;
        routed={root:runtimeBinding,relative:rootRelative(runtimeBinding.repoRoot,target)};
      }
    }
    else {
      const normalized=clean(key),workDirect=normalized==='.starciwork'||normalized.startsWith('.starciwork/')
        ?path.join(workBinding.repoRoot,normalized):path.join(workRoot,normalized);
      if(fs.existsSync(workDirect)){target=workDirect;routed={root:workBinding,relative:rootRelative(workBinding.repoRoot,target)};}
      else {const sourceDirect=path.join(source.repoRoot,normalized);if(fs.existsSync(sourceDirect)){target=sourceDirect;routed={root:source,relative:normalized};}}
    }
    if(!routed||routed.relative===null||!target)throw new Error(`candidate reference is not resolved by the loaded Work tree or repository: ${key}`);
    let checked;try{
      const stat=fs.lstatSync(target),isSourceDirectory=routed.root.id==='source'&&rootRelative(workRoot,target)===null&&stat.isDirectory();
      if(isSourceDirectory&&fragment)throw new Error('a source directory reference cannot select a file fragment');
      checked=isSourceDirectory?sourceDirectoryFiles(routed.root.repoRoot,routed.relative):[containedCanonicalFile(routed.root.repoRoot,routed.relative)];
    }catch(error){throw new Error(`candidate reference is not a readable, contained routed file: ${literal} (${error.message})`);}
    return checked.map(file=>({kind:parsed.kind,ref:`${file.relative}${fragment}`,sourceRef:literal,rootId:routed.root.id,rootRole:routed.root.role,
      path:file.relative,fragment:fragment?fragment.slice(1):null}));
  });
}

/**
 * Partition one operation's worker writes, runtime-owned writes, inputs and retry baselines by routed root.
 * Relative source paths retain the historical shape; external Work paths are never accepted without routing.
 */
export function candidateRootBindings({state,op,work=null,resolvedReferences=[],runtimePaths=op?.kernelOwned??[],runtimeManagedFiles=[],runtimeStoreRoot=null}={}){
  const accepted=candidateAcceptedRoots(state,work,{runtimeStoreRoot:runtimeManagedFiles.length?runtimeStoreRoot:null}),byId=new Map(accepted.map(root=>[root.id,{...root,allowlist:[],references:[],inputPaths:[],
    oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[]}])) , workRoot=accepted.find(root=>root.id==='work');
  const add=(field,value,{workRelative=false}={})=>{const {root,relative}=routePath(value,accepted,{workRelative});if(!relative)throw new Error(`candidate ${field} path is empty`);
    if(root.role==='workflow-store')throw new Error(`candidate ${field} cannot claim the runtime-managed workflow-store root: ${slash(value)}`);
    if(root.role==='runtime-input'&&['allowlist','runtimePaths'].includes(field))throw new Error(`candidate ${field} cannot write the read-only runtime-input root: ${slash(value)}`);
    // The ledger record sits inside a routable root but outside every operation allowlist: a scope that covers
    // `runtime.sqlite*` or `.starciwork/**` is refused at compile time, whatever it routed to.
    if(field==='allowlist'&&coversLedgerScope(relative))throw new Error(`scope-covers-ledger: candidate allowlist cannot cover the workflow record: ${slash(value)}`);
    byId.get(root.id)[field].push(relative);return {root,relative};};
  for(const entry of op.allowlist??[])add('allowlist',entry);
  for(const entry of runtimePaths??[])add('runtimePaths',entry);
  for(const item of runtimeManagedFiles??[]){const {root,relative}=routePath(item.path,accepted,{workRelative:Boolean(workRoot)});if(root.role==='runtime-input')throw new Error(`candidate runtime-managed path cannot write the read-only runtime-input root: ${slash(item.path)}`);
    if(root.role==='workflow-store'&&!/^workflows\/[^/]+\.md$/i.test(relative))throw new Error(`candidate runtime-managed workflow-store path is not a public continuation: ${slash(item.path)}`);
    const binding=byId.get(root.id);binding.runtimeManagedFiles.push({...item,path:relative});binding.runtimePaths.push(relative);}
  for(const reference of resolvedReferences??[]){
    const root=byId.get(reference.rootId??'source');if(!root)throw new Error(`candidate reference names an unaccepted root: ${reference.rootId}`);
    const ref={kind:reference.kind??'file',ref:reference.ref??reference.path,sourceRef:reference.sourceRef??reference.ref??reference.path,
      rootId:root.id,rootRole:root.role,path:reference.path??fragmentOf(reference.ref??'').key,fragment:reference.fragment??null};
    root.references.push(ref);root.inputPaths.push(ref);
  }
  for(const entry of runtimePaths??[])add('inputPaths',entry);
  for(const entry of op.ownedBaselinePaths??[])add('ownedDirtyPaths',entry);
  const bindings=[...byId.values()].filter(root=>root.id!=='runtime'||root.references.length||root.inputPaths.length).map(root=>({...root,allowlist:unique(root.allowlist),references:root.references,
    inputPaths:root.inputPaths,runtimePaths:unique(root.runtimePaths),ownedDirtyPaths:unique(root.ownedDirtyPaths),
    workerWritable:root.role!=='runtime-input'&&root.allowlist.length>0,runtimeWritable:root.role!=='runtime-input'&&root.runtimePaths.length>0,
    readOnly:root.role==='runtime-input'||(root.allowlist.length===0&&root.runtimePaths.length===0)}));
  // The source snapshot is always present for checks, source identity and the historical candidate cwd. Work is
  // present only when accepted routing actually supplied a distinct owner root.
  return {schema:'starci/candidate-root-bindings@1',bindings,bindingDigest:candidateRootBindingDigest(bindings)};
}

export function candidateDisplayPath(binding,relative){return binding.primary||binding.id==='source'?clean(relative):slash(path.join(binding.repoRoot,relative));}

export function pathInCandidateRoots(value,bindings){
  const roots=(bindings??[]).map(binding=>({...binding,repoRoot:path.resolve(binding.repoRoot)}));
  const {root,relative}=routePath(value,roots);
  return {rootId:root.id,relative,displayPath:candidateDisplayPath(root,relative)};
}

export const candidateBindingsEqual=(left,right)=>candidateRootBindingDigest(left)===candidateRootBindingDigest(right);
