import {parseYaml} from './yaml.mjs';
import { validateSpecification } from '../specifications/validate.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const profiles = Object.freeze(JSON.parse(fs.readFileSync(new URL('../schemas/profiles.json', import.meta.url), 'utf8')));
const metadataSchema = JSON.parse(fs.readFileSync(new URL('../schemas/work.schema.json', import.meta.url), 'utf8'));
const text = v => typeof v === 'string' && v.trim().length > 0;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sha = v => typeof v === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const digest = v => createHash('sha256').update(v).digest('hex');
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sha256(value) { return digest(value); }

/** Read-only binding/integrity validation; this does not establish semantic truth. */
export function validateWorkspace(root) {
  try { return validate(root); }
  catch { return {ok:false,errors:[{code:'MALFORMED_WORKSPACE',path:'.',message:'Malformed or unreadable workspace; no completion can be certified.'}],warnings:[],nodes:[],resources:[]}; }
}
function validate(root) {
  const errors = [], warnings = [], nodes = [], resources = [], evidence = [], ids = new Map();
  const issue = (code, p, message) => errors.push({code, path:p, message});
  const warn = (code, p, message) => warnings.push({code, path:p, message});
  let absolute;
  const rel = p => path.relative(absolute, p).split(path.sep).join('/') || '.';
  const within = (base, p) => { const r = path.relative(base,p); return r === '' || (!r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r)); };
  const result = () => ({ok:errors.length === 0, errors, warnings, nodes:nodes.map(n => ({id:n.meta.id, path:n.path, schema:n.meta.schema, kind:n.meta.kind, required:n.meta.required, state:n.meta.state ?? null, effectiveState:n.effectiveState ?? 'invalid', specDigest:n.specDigest, contextDigest:n.contextDigest??null, inputDigest:n.inputDigest ?? null, investigationDigest:n.meta.investigation?.contextDigest??null, completion:n.meta.completion?{inputDigest:n.meta.completion.inputDigest??null,evidence:Array.isArray(n.meta.completion.evidence)?[...n.meta.completion.evidence]:[]}:null, eligible:n.eligible ?? false, children:n.children.map(c => c.meta.id),dependsOn:(n.effectiveDeps??[]).map(d=>d.meta.id),refs:(n.effectiveRefs??[]).map(d=>d.meta.id),blockedBy:n.blockedBy??[],suspensionReasons:n.suspensionReasons??[]})), resources:resources.map(r => ({id:r.meta.id,kind:r.meta.kind,revision:r.meta.revision,path:r.path,specDigest:r.specDigest}))});
  try {
    absolute = path.resolve(root);
    if (fs.lstatSync(absolute).isSymbolicLink() || !fs.statSync(absolute).isDirectory()) throw new Error('Root must be a real directory, not a symlink.');
    absolute = fs.realpathSync(absolute);
  } catch { issue('ROOT',String(root),'Cannot read a real workspace directory.'); return result(); }
  function read(p, markdown=false) {
    try {
      if (fs.lstatSync(p).isSymbolicLink() || !within(absolute,fs.realpathSync(p))) { issue('UNSAFE_PATH',rel(p),'Metadata must not use symlinks or escape workspace.'); return null; }
      let source = fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''); let body = '';
      if (markdown) {
        const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
        if (!match) { issue('FRONTMATTER',rel(p),'Expected --- delimited JSON front matter.'); return null; }
        source=match[1]; body=match[2].replace(/\r\n/g,'\n').trim();
      }
      let meta;
      try { meta=parseYaml(source); } catch { issue('UNSUPPORTED_METADATA',rel(p),'Invalid YAML 1.2 metadata; duplicate keys, custom tags and aliases are not accepted.'); return null; }
      if (!object(meta)) { issue('METADATA_OBJECT',rel(p),'Metadata must be an object.'); return null; }
      if(!markdown){if(meta.description!==undefined&&typeof meta.description!=='string'){issue('DESCRIPTION',rel(p),'description must be text');return null;}body=(meta.description??'').replace(/\r\n/g,'\n').trim();}
      return {meta,body,markdown,path:rel(p),file:p,dir:path.dirname(p)};
    } catch { issue('READ',rel(p),'Cannot read metadata.'); return null; }
  }
  function register(item,type) {
    item.type=type;
    checkKeys(item.meta,metadataSchema.$defs[type],item.path);
    checkSecrets(item.meta,item.path);
    if (!text(item.meta.id) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(item.meta.id)) issue('ID',item.path,'Stable id is required and must contain only letters, digits, dot, underscore, colon or hyphen.');
    else if (ids.has(item.meta.id)) issue('DUPLICATE_ID',item.path,'Duplicate stable id.');
    else ids.set(item.meta.id,item);
    if (item.meta.schema !== `work/${type}@1` && !(type==='node'&&item.meta.schema==='work/node@2')) issue('SCHEMA',item.path,`Expected work/${type}@1 (nodes also support @2).`);
    if (item.meta.extensions !== undefined && !object(item.meta.extensions)) issue('EXTENSIONS',item.path,'extensions must be an object.');
  }
  function checkKeys(value,shape,p) {
    if(shape.$ref) {const target=shape.$ref.slice(2).split('/').reduce((v,k)=>v[k.replaceAll('~1','/').replaceAll('~0','~')],metadataSchema);checkKeys(value,target,p);return;}
    const matchesType=type=>type==='object'?object(value):type==='array'?Array.isArray(value):type==='integer'?Number.isInteger(value):type==='null'?value===null:typeof value===type;
    if(shape.type&&!matchesType(shape.type)){issue('SCHEMA_VALUE',p,`Metadata value must have schema type ${shape.type}.`);return;}
    if(Object.hasOwn(shape,'const')&&canonicalJSON(value)!==canonicalJSON(shape.const))issue('SCHEMA_VALUE',p,'Metadata value does not match its required schema constant.');
    if(Array.isArray(shape.enum)&&!shape.enum.some(item=>canonicalJSON(item)===canonicalJSON(value)))issue('SCHEMA_VALUE',p,'Metadata value is outside its published enum.');
    if(typeof value==='string'){
      if(Number.isInteger(shape.minLength)&&value.length<shape.minLength)issue('SCHEMA_VALUE',p,'Metadata text is shorter than the published minimum.');
      if(shape.pattern&&!new RegExp(shape.pattern,'u').test(value))issue('SCHEMA_VALUE',p,'Metadata text does not match its published pattern.');
    }
    if(Array.isArray(value)){
      if(Number.isInteger(shape.minItems)&&value.length<shape.minItems)issue('SCHEMA_VALUE',p,'Metadata list is shorter than the published minimum.');
      if(shape.uniqueItems&&new Set(value.map(canonicalJSON)).size!==value.length)issue('SCHEMA_VALUE',p,'Metadata list must contain unique values.');
      if(shape.items)value.forEach(v=>checkKeys(v,shape.items,p));
      return;
    }
    if(!object(value))return;
    for(const key of shape.required??[])if(!Object.hasOwn(value,key))issue('SCHEMA_VALUE',p,`Metadata object is missing required field ${key}.`);
    for(const [key,v]of Object.entries(value)) {
      if(shape.additionalProperties===false&&!Object.hasOwn(shape.properties??{},key))issue('UNKNOWN_FIELD',p,'Unknown reserved metadata field; correct its spelling or place extension data inside extensions/resource.details.');
      else if(Object.hasOwn(shape.properties??{},key))checkKeys(v,shape.properties[key],p);
    }
  }
  const workspace=read(path.join(absolute,'workspace.yaml'));
  if (workspace) register(workspace,'workspace');
  function walk(dir) {
    let entries;
    try { entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)); } catch { issue('READ_DIRECTORY',rel(dir),'Cannot enumerate directory.'); return; }
    for (const ent of entries) {
      if (ent.name === '_local' || ent.name === '_workflows' || ent.name === '_schema' || ent.name === '.git') continue;
      const p=path.join(dir,ent.name);
      if (ent.isSymbolicLink()) { issue('SYMLINK',rel(p),'Symlinks are not accepted in canonical workspace artifacts.'); continue; }
      if (ent.isDirectory()) { walk(p); continue; }
      let item;
      if (['index.md','index.yaml','node.yaml','node.md'].includes(ent.name)) {
        if (rel(p).split('/').slice(0,-1).some(part=>['evidence','assets','_resources'].includes(part.toLowerCase()))) { issue('LAYOUT',rel(p),'Nodes cannot be inside reserved evidence, assets or _resources directories.'); continue; }
        if(['index.md','index.yaml','node.yaml','node.md'].filter(name=>fs.existsSync(path.join(dir,name))).length>1){issue('NODE_FORMAT_CONFLICT',rel(p),'Use one node format per directory');continue;}
        if ((item=read(p,ent.name.endsWith('.md')))) {register(item,'node');item.children=[];nodes.push(item);}
      } else if (ent.name === 'resource.yaml') {
        if (!rel(p).startsWith('_resources/')) {issue('LAYOUT',rel(p),'Resources belong under _resources.');continue;}
        if ((item=read(p))) {register(item,'resource');resources.push(item);}
      } else if (ent.name === 'manifest.yaml' && path.basename(path.dirname(dir)) === 'evidence') {
        if ((item=read(p))) {register(item,'evidence');evidence.push(item);}
      }
    }
  }
  walk(absolute);
  const stringList = (v,p,label,required=false) => {
    if (v === undefined && !required) return [];
    if (!Array.isArray(v) || v.some(x=>!text(x)) || new Set(v).size!==v.length || (required && !v.length)) {issue('LIST',p,`${label} must be ${required?'a nonempty':'an'} array of unique nonempty strings.`);return [];}
    return v;
  };
  const resolve = (id,item,types) => {
    const target=ids.get(id);
    if (!target || !types.includes(target.type)) {issue('MISSING_REF',item.path,`Reference must resolve to ${types.join('/')} id.`);return null;}
    return target;
  };
  function checkSecrets(v,p) {
    if (!object(v) && !Array.isArray(v)) return;
    for (const [k,val] of Object.entries(v)) {
      if (/^(password|passwd|privateKey|accessToken|refreshToken|clientSecret|secretValue)$/i.test(k)) issue('PLAINTEXT_SECRET',p,'Plaintext credential fields are forbidden; use a sealed reference.');
      if (object(val)||Array.isArray(val)) checkSecrets(val,p);
    }
  }
  for (const r of resources) {
    for (const key of ['kind','owner','revision']) if (!text(r.meta[key])) issue('RESOURCE_FIELD',r.path,`${key} is required.`);
    if (!object(r.meta.details)) issue('RESOURCE_DETAILS',r.path,'details must be an object.');
    const files=[];
    if(r.meta.files!==undefined){
      if(!Array.isArray(r.meta.files))issue('RESOURCE_FILES',r.path,'files must be an array of local relative path objects.');
      else {
        const seen=new Set();
        for(const file of r.meta.files){
          if(!object(file)||!text(file.path)){issue('RESOURCE_FILE',r.path,'Each resource file requires a local relative path.');continue;}
          const parts=file.path.split(/[\\/]/);
          if(path.isAbsolute(file.path)||/^[A-Za-z]:|^[\\/]|:/.test(file.path)||parts.some(p=>p==='..'||p==='.'||p==='')){issue('RESOURCE_FILE_ESCAPE',r.path,'Resource files must be normalized local paths within the resource directory.');continue;}
          const normalized=parts.join('/');
          if(seen.has(normalized)){issue('RESOURCE_FILE_DUPLICATE',r.path,'A source file may only be listed once.');continue;}seen.add(normalized);
          try {
            let target=r.dir;for(const part of parts){target=path.join(target,part);if(fs.lstatSync(target).isSymbolicLink())throw new Error('symlink');}
            if(!within(r.dir,fs.realpathSync(target))||!fs.statSync(target).isFile())throw new Error('unsafe');
            files.push({path:normalized,sha256:digest(fs.readFileSync(target))});
          }catch{issue('RESOURCE_FILE_UNREADABLE',r.path,'Resource file missing, unreadable, non-file or symlink; no remote retrieval is performed.');}
        }
      }
    }
    r.specDigest=digest(canonicalJSON({metadata:r.meta,files:files.sort((a,b)=>a.path.localeCompare(b.path))}));
  }
  const operational = new Set(Object.entries(metadataSchema.$defs.node.properties).filter(([,shape])=>shape['x-operational']===true).map(([key])=>key));
  for (const n of nodes) {
    const candidates=nodes.filter(a=>a!==n && within(a.dir,n.dir) && a.dir!==n.dir).sort((a,b)=>b.dir.length-a.dir.length);
    n.parent=candidates[0]??null;if(n.parent)n.parent.children.push(n);
    if (!text(n.meta.kind)) issue('NODE_KIND',n.path,'kind is required.');
    if (typeof n.meta.required !== 'boolean') issue('REQUIRED',n.path,'required must be boolean.');
    if (!n.body) issue('EMPTY_SPEC',n.path,'Body must describe scope and observable done-when.');
    n.depIds=stringList(n.meta.dependsOn,n.path,'dependsOn'); n.refIds=stringList(n.meta.refs,n.path,'refs');
    if(n.meta.assertions !== undefined) stringList(n.meta.assertions,n.path,'assertions');
    if(n.meta.schema==='work/node@2'){
      if(n.markdown&&n.meta.description!==undefined)issue('DUPLICATE_BODY',n.path,'Markdown nodes use their prose body; do not duplicate it in description metadata.');
      if(n.meta.activity!==undefined&&!['idle','investigating','implementing','verifying'].includes(n.meta.activity))issue('ACTIVITY',n.path,'Unknown activity.');
      if(n.meta.blockers!==undefined)stringList(n.meta.blockers,n.path,'blockers');
      if(n.meta.investigation!==undefined&&(!object(n.meta.investigation)||!/^[a-f0-9]{64}$/.test(n.meta.investigation.contextDigest??'')))issue('INVESTIGATION',n.path,'Investigation needs the exact reviewed contextDigest.');
    }
    const ownedAssets=[];
    if(n.meta.assets!==undefined){
      if(!Array.isArray(n.meta.assets))issue('NODE_ASSETS',n.path,'Node input assets must be an array.');
      else {const seen=new Set();for(const asset of n.meta.assets){
        const value=asset?.path,parts=typeof value==='string'?value.split('/'):[];
        if(!text(value)||!value.startsWith('assets/')||value.includes('\\')||value.includes(':')||parts.some(p=>!p||p==='.'||p==='..')||seen.has(value)){issue('NODE_ASSET_PATH',n.path,'Node assets must be unique normalized paths under own assets/.');continue;}seen.add(value);
        try{let file=n.dir;for(const part of parts){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('symlink');}if(!within(n.dir,fs.realpathSync(file))||!fs.statSync(file).isFile())throw Error('escape');ownedAssets.push({path:value,sha256:digest(fs.readFileSync(file))});}catch{issue('NODE_ASSET_UNREADABLE',n.path,'Node asset missing, non-file or unsafe.');}
      }}
    }
    n.specDigest=digest(canonicalJSON({...(n.meta.assets!==undefined?{assets:ownedAssets}:{}),metadata:Object.fromEntries(Object.entries(n.meta).filter(([k])=>!operational.has(k)&&!(n.meta.schema==='work/node@2'&&k==='description'))),body:n.body}));
  }
  for (const n of nodes) {
    n.deps=n.depIds.map(id=>resolve(id,n,['node'])).filter(Boolean);
    n.refs=n.refIds.map(id=>resolve(id,n,['node','resource'])).filter(Boolean);
    if (n.children.length) {
      if ('state' in n.meta || 'completion' in n.meta) issue('BRANCH_STATE',n.path,'Branches must not store state or completion.');
    } else {
      if (!metadataSchema.$defs.node.properties.state.enum.includes(n.meta.state)) issue('STATE',n.path,'Leaf state must be one of the states published by work/node@1.');
      if(n.meta.schema==='work/node@2'&&!['uninvestigate','todo','done'].includes(n.meta.state))issue('STATE',n.path,'Version 2 has exactly uninvestigate, todo and done.');
      if (n.meta.state==='blocked' && !text(n.meta.blocker)) issue('BLOCKER',n.path,'Blocked leaves require a concrete blocker.');
      if (n.meta.state==='suspended' && !text(n.meta.suspensionReason)) issue('SUSPENSION_REASON',n.path,'Authored suspended leaves require a concrete suspensionReason; imported source is not approved or verified completion.');
      if (n.meta.state==='na' && !text(n.meta.naReason)) issue('NA_REASON',n.path,'N/A requires a reason.');
    }
  }
  for(const n of nodes){
    const deps=[...n.deps],refs=[...n.refs];
    for(let a=n.parent;a;a=a.parent){deps.push(...a.deps);refs.push(...a.refs.filter(r=>r.type!=='node'||!within(r.dir,n.dir)));}
    const unique=items=>[...new Map(items.map(item=>[item.meta.id,item])).values()].sort((a,b)=>a.meta.id.localeCompare(b.meta.id));
    n.effectiveDeps=unique(deps);n.effectiveRefs=unique(refs);
    const spec = n.meta.extensions?.work3?.specification;
    if (spec !== undefined) {
      const review = validateSpecification(spec);
      for (const message of review.errors) issue('SPECIFICATION', n.path, message);
      if (!['business','architecture'].includes(n.meta.kind) || spec?.op !== n.meta.kind + '.decide') issue('SPECIFICATION_OWNER', n.path, 'Specification must belong to its business/architecture node kind.');
      if (spec?.op === 'architecture.decide') {
        const businesses = [...n.effectiveRefs,...n.effectiveDeps].filter(r => r.type === 'node' && r.meta.kind === 'business' && r.meta.extensions?.work3?.specification).map(r => r.meta.extensions.work3.specification);
        for (const journey of Array.isArray(spec.journeys) ? spec.journeys : []) {
          const matches = businesses.flatMap(b => Array.isArray(b.journeys) ? b.journeys : []).filter(j => j.id === journey.id);
          if (matches.length && matches.some(j => canonicalJSON(j) !== canonicalJSON(journey))) issue('SPECIFICATION_JOURNEY_DRIFT', n.path, 'Architecture must preserve referenced business journey actions and expectations.');
          if (spec.status === 'pass' && !matches.length) issue('SPECIFICATION_JOURNEY_UNBOUND', n.path, 'Passing architecture journeys need a referenced business journey.');
        }
      }
      if (n.meta.state === 'done' && spec?.status !== 'pass') issue('SPECIFICATION_NOT_ACCEPTED', n.path, 'Draft or blocked specification cannot complete a node.');
      for (const source of Array.isArray(spec?.sources) ? spec.sources : []) {
        if (source?.kind !== 'observed') continue;
        const resource = n.effectiveRefs.find(r => r.type === 'resource' && r.meta.id === source.repository && r.meta.kind === 'repository');
        if (!resource) issue('SPECIFICATION_SOURCE_UNBOUND', n.path, 'Observed source repository must be a bound repository resource.');
        else if (resource.meta.revision !== source.revision) issue('SPECIFICATION_SOURCE_STALE', n.path, 'Source citation revision must match the bound repository revision.');
      }
    }
  }
  const visiting=new Set();
  const workspaceDigest=workspace?digest(canonicalJSON(workspace.meta)):'';
  function input(n) {
    if(n.inputDigest)return n.inputDigest;
    if(visiting.has(n)) {issue('CYCLE',n.path,'Dependency/reference cycle prevents trustworthy input binding.');return 'cycle';}
    visiting.add(n);
    const ancestors=[]; for(let a=n.parent;a;a=a.parent) ancestors.unshift(a);
    // An inherited reference to this scope is already represented by its own
    // specification/ancestor specifications. Expanding it again fabricates a
    // self-cycle when a goal points to its requirements subtree. Explicit refs
    // and all dependency edges still participate in normal cycle detection.
    const bindings = item => [...item.deps,...item.refs.filter(r=>item===n||r.type!=='node'||!within(r.dir,n.dir))].map(r=>({id:r.meta.id,digest:r.type==='resource'?r.specDigest:input(r)})).sort((a,b)=>a.id.localeCompare(b.id));
    const context={workspace:workspaceDigest,spec:n.specDigest,ancestors:ancestors.map(a=>({id:a.meta.id,spec:a.specDigest,bindings:bindings(a)})),bindings:bindings(n)};
    n.contextDigest=digest(canonicalJSON(context));
    n.inputDigest=digest(canonicalJSON({...context,children:n.children.map(c=>({id:c.meta.id,digest:input(c)})).sort((a,b)=>a.id.localeCompare(b.id))}));
    visiting.delete(n);return n.inputDigest;
  }
  nodes.forEach(input);
  function codeRefs(refs,item,required=false) {
    if(refs===undefined && !required)return [];
    if(!Array.isArray(refs) || (required && !refs.length)) {issue('CODE_REFS',item.path,'codeRefs requires a nonempty array of repository/full commit SHA bindings.');return [];}
    for(const ref of refs) {
      if(!object(ref)||!text(ref.repository)||!sha(ref.commit)) {issue('COMMIT',item.path,'Commit binding requires repository id and full lowercase 40/64 hex commit SHA.');continue;}
      const repo=resolve(ref.repository,item,['resource']);if(repo && repo.meta.kind!=='repository')issue('REPOSITORY_KIND',item.path,'Code binding must reference a repository resource.');
    }
    return refs;
  }
  for(const e of evidence) {
    e.startErrors=errors.length;
    e.node=resolve(e.meta.nodeId,e,['node']);
    if(!/^[a-f0-9]{64}$/.test(e.meta.inputDigest??''))issue('EVIDENCE_DIGEST',e.path,'inputDigest must be SHA-256.');
    e.bindings=[{nodeId:e.meta.nodeId,inputDigest:e.meta.inputDigest}];
    if(e.meta.bindings!==undefined){
      if(!Array.isArray(e.meta.bindings))issue('EVIDENCE_BINDINGS',e.path,'Additional bindings must be an array of unique nodeId/inputDigest objects.');
      else for(const binding of e.meta.bindings){
        if(!object(binding)||!text(binding.nodeId)||!/^[a-f0-9]{64}$/.test(binding.inputDigest??'')){issue('EVIDENCE_BINDING',e.path,'Each additional evidence binding requires nodeId and SHA-256 inputDigest.');continue;}
        resolve(binding.nodeId,e,['node']);
        if(e.bindings.some(b=>b.nodeId===binding.nodeId))issue('DUPLICATE_EVIDENCE_BINDING',e.path,'Each evidence node may be bound only once, including the primary node.');
        e.bindings.push(binding);
      }
    }
    if(!['pass','fail','not-run','inconclusive'].includes(e.meta.outcome))issue('OUTCOME',e.path,'Invalid evidence outcome.');
    if(!Array.isArray(e.meta.assertions))issue('ASSERTIONS',e.path,'Evidence assertions must be an array.');
    else {
      const seen=new Set();for(const a of e.meta.assertions) {
        if(!object(a)||!text(a.id)||!['pass','fail','not-run','inconclusive'].includes(a.outcome)||!text(a.observation))issue('ASSERTION',e.path,'Each assertion requires id, valid outcome and concrete observation.');
        if(seen.has(a?.id))issue('DUPLICATE_ASSERTION',e.path,'Duplicate assertion id.');seen.add(a?.id);
      }
    }
    codeRefs(e.meta.codeRefs,e);
    e.images=0;
    if(!Array.isArray(e.meta.assets))issue('ASSETS',e.path,'assets must be an array (empty is allowed for non-UI evidence).');
    else for(const asset of e.meta.assets) {
      if(!object(asset)||!text(asset.path)||!(/^[a-f0-9]{64}$/.test(asset.sha256??''))) {issue('ASSET',e.path,'Asset requires local relative path and lowercase SHA-256.');continue;}
      const parts=asset.path.split(/[\\/]/);
      if(path.isAbsolute(asset.path)||/^[A-Za-z]:|^[\\/]|:/.test(asset.path)||parts.includes('..')||parts.includes('.')||parts.includes('')) {issue('ASSET_ESCAPE',e.path,'Asset path must be a normalized relative local path without traversal.');continue;}
      if(asset.scope!==undefined&&!['node','evidence'].includes(asset.scope)){issue('ASSET_SCOPE',e.path,'Unknown asset ownership scope');continue;}
      const assetRoot=asset.scope==='node'?e.node?.dir:e.dir;
      if(!assetRoot||(asset.scope==='node'&&!asset.path.startsWith('assets/'))){issue('ASSET_SCOPE',e.path,'Node evidence must reference primary owner assets/');continue;}
      const target=path.resolve(assetRoot,...parts);
      try {
        let cursor=assetRoot;for(const part of parts){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw new Error('symlink');}
        if(!within(assetRoot,fs.realpathSync(target))||!fs.statSync(target).isFile())throw new Error('escape');
        const bytes=fs.readFileSync(target);if(digest(bytes)!==asset.sha256)issue('ASSET_HASH',e.path,'Asset hash does not match current bytes.');
        if((bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (bytes.length>=4 && bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217) || (bytes.length>=16 && bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))e.images++;
      } catch {issue('ASSET_UNREADABLE',e.path,'Asset missing, unreadable, non-file or symlink; external artifacts are unverified.');}
    }
    e.valid=errors.length===e.startErrors;
  }
  function verifyDone(n) {
    const profile=Object.hasOwn(profiles,n.meta.kind)?profiles[n.meta.kind]:null;
    if(!profile){issue('UNSUPPORTED_PROFILE',n.path,'Unknown leaf kind retained, but cannot earn done without a supported verification profile.');return false;}
    const c=n.meta.completion;
    if(!object(c)){issue('COMPLETION',n.path,'Done requires completion binding and evidence.');return false;}
    if(c.inputDigest!==n.inputDigest){issue('STALE_COMPLETION',n.path,'Completion no longer binds current semantic inputs.');n.stale=true;}
    const required=stringList(n.meta.assertions,n.path,'assertions',true);
    const evidenceIds=stringList(c.evidence,n.path,'completion.evidence',true);
    const refs=codeRefs(c.codeRefs,n,!!profile.code);
    for(const r of refs)if(object(r)&&!n.effectiveRefs.some(ref=>ref.meta.id===r.repository))issue('UNBOUND_REPOSITORY',n.path,'Completion repository resources must be included in own or inherited node refs.');
    const covered=new Set();
    for(const id of evidenceIds){
      const e=resolve(id,n,['evidence']);if(!e)continue;
      const binding=e.bindings.find(b=>b.nodeId===n.meta.id);
      if(!binding)issue('EVIDENCE_OWNER',n.path,'Evidence has no explicit binding for this node.');
      else if(binding.inputDigest!==n.inputDigest){issue('STALE_EVIDENCE',n.path,'Evidence does not bind current inputs for this node.');n.stale=true;}
      if(!e.valid || e.meta.outcome!=='pass' || !Array.isArray(e.meta.assertions) || !e.meta.assertions.length || e.meta.assertions.some(a=>!object(a)||a.outcome!=='pass'))issue('EVIDENCE_NOT_PASS',n.path,'Completion requires valid passing evidence and passing observations.');
      else e.meta.assertions.forEach(a=>covered.add(a.id));
      if(profile.code && refs.some(r=>!Array.isArray(e.meta.codeRefs)||!e.meta.codeRefs.some(er=>object(er)&&object(r)&&er.repository===r.repository&&er.commit===r.commit)))issue('CODE_EVIDENCE_BINDING',n.path,'Each code completion binding must appear in each selected evidence record.');
      if(profile.uat){
        const p=e.meta.provenance;
        if(!object(p)){issue('UAT_PROVENANCE',n.path,'UAT needs environment, actor or explicit anonymous, servedVersions, tool and capturedAt.');continue;}
        const env=resolve(p.environment,n,['resource']);if(env&&env.meta.kind!=='environment')issue('ENVIRONMENT_KIND',n.path,'UAT environment must reference an environment resource.');
        if(p.anonymous===true){if(p.actor!==undefined)issue('UAT_ACTOR',n.path,'Choose actor or anonymous, not both.');}
        else {const actor=resolve(p.actor,n,['resource']);if(actor&&actor.meta.kind!=='identity')issue('IDENTITY_KIND',n.path,'UAT actor must reference an identity resource.');}
        if(!text(p.tool)||!text(p.capturedAt)||!/^\d{4}-\d{2}-\d{2}T/.test(p.capturedAt)||!Number.isFinite(Date.parse(p.capturedAt)))issue('UAT_CAPTURE',n.path,'UAT requires tool and ISO timestamp.');
        codeRefs(p.servedVersions,n,true);
        if(Array.isArray(p.servedVersions))for(const version of p.servedVersions)if(!object(version)||!text(version.artifact)||sha(version.artifact))issue('SERVED_ARTIFACT',n.path,'Each served version requires an observed immutable artifact/build identity, distinct from source commit alone.');
        for(const r of [p.environment,p.actor,...(Array.isArray(p.servedVersions)?p.servedVersions.map(v=>v?.repository):[])].filter(Boolean))if(!n.effectiveRefs.some(ref=>ref.meta.id===r))issue('UNBOUND_PROVENANCE',n.path,'UAT provenance resources must be declared in own or inherited node refs for invalidation.');
        if(!text(p.servedVersionEvidence))issue('SERVED_VERSION_PROOF',n.path,'servedVersionEvidence must name an included assertion proving runtime version; source HEAD alone is insufficient.');
        else if(!Array.isArray(e.meta.assertions)||!e.meta.assertions.some(a=>object(a)&&a.id===p.servedVersionEvidence&&a.outcome==='pass'))issue('SERVED_VERSION_PROOF',n.path,'Runtime-version proof assertion is missing or not pass.');
      }
      if(profile.image && !e.images)issue('UI_CAPTURE',n.path,'UI completion requires a hashed local PNG, JPEG or WebP capture.');
      if(profile.behavior && (!Array.isArray(e.meta.assertions)||!e.meta.assertions.some(a=>object(a)&&a.kind==='behavior'&&a.outcome==='pass')))issue('UAT_BEHAVIOR',n.path,'UX completion requires a passing assertion with kind:behavior; screenshots alone are insufficient.');
    }
    for(const id of required)if(!covered.has(id))issue('ASSERTION_COVERAGE',n.path,'Required assertion not covered by passing evidence.');
    return true;
  }
  for(const n of nodes)if(!n.children.length && n.meta.state==='done')verifyDone(n);
  const globalInvalid=errors.some(e=>!nodes.some(n=>n.path===e.path));
  const rolling=new Set();
  function roll(n){
    if(n.effectiveState)return n.effectiveState;
    if(rolling.has(n))return 'invalid';rolling.add(n);
    const localInvalid=globalInvalid||errors.some(e=>e.path===n.path && !['STALE_COMPLETION','STALE_EVIDENCE'].includes(e.code));
    n.blockedBy=n.effectiveDeps.filter(d=>roll(d)!=='done').map(d=>d.meta.id);
    n.eligible=!localInvalid && n.blockedBy.length===0;
    n.suspensionReasons=[];
    if(n.stale)n.suspensionReasons.push({code:'INPUT_CHANGED',ids:[n.meta.id]});
    if(n.meta.state==='suspended')n.suspensionReasons.push({code:'DECLARED_SUSPENSION',ids:[n.meta.id]});
    if(n.children.length){
      n.children.forEach(roll);const required=n.children.filter(c=>c.meta.required).map(c=>c.effectiveState);
      n.effectiveState=localInvalid?'invalid':!required.length?'na':required.every(s=>s==='na')?'na':required.every(s=>['done','na'].includes(s))?'done':required.includes('invalid')?'invalid':required.includes('blocked')?'blocked':required.includes('suspended')?'suspended':required.some(s=>['doing','done'].includes(s))?'doing':'todo';
      if(n.effectiveState==='suspended')n.suspensionReasons.push({code:'CHILD_SUSPENDED',ids:n.children.filter(c=>c.meta.required&&c.effectiveState==='suspended').map(c=>c.meta.id)});
      if(n.children.some(c=>!c.meta.required&&!['done','na'].includes(c.effectiveState)))warn('OPTIONAL_UNMET',n.path,'Optional unfinished children remain visible but do not block parent rollup.');
    }else n.effectiveState=localInvalid?'invalid':n.stale?'suspended':n.meta.state;
    if(!localInvalid&&n.blockedBy.length&&(n.meta.state==='done'||n.effectiveState==='done')){
      issue('DEPENDENCY_NOT_DONE',n.path,'Prerequisites must be effectively done; N/A is not proof that a prerequisite exists.');
      n.effectiveState='suspended';n.suspensionReasons.push({code:'PREREQUISITE_NOT_DONE',ids:n.blockedBy});
    }
    if(n.meta.schema==='work/node@2'){
      const hasInvestigation=Boolean(n.meta.investigation);
      const reviewed=!hasInvestigation||n.meta.investigation.contextDigest===n.contextDigest;
      const unreviewedAncestors=[];for(let a=n.parent;a;a=a.parent)if(a.meta.schema==='work/node@2'&&a.meta.investigation&&a.meta.investigation.contextDigest!==a.contextDigest)unreviewedAncestors.push(a);
      const unreviewedAncestor=unreviewedAncestors.length>0;
      const unreviewedReference=n.effectiveRefs.some(r=>r.type==='node'&&roll(r)==='uninvestigate');
      const unreviewedDependency=n.effectiveDeps.some(d=>roll(d)==='uninvestigate');
      const wasBound=hasInvestigation||Boolean(n.meta.completion);
      const invalidatedDone=n.meta.state==='done'&&(n.blockedBy.length>0||Boolean(n.meta.blockers?.length));
      const uninvestigate=n.meta.state==='uninvestigate'||n.stale||invalidatedDone||!reviewed||(wasBound&&(unreviewedAncestor||unreviewedReference||unreviewedDependency));
      if(invalidatedDone&&n.meta.blockers?.length)n.suspensionReasons.push({code:'COMPLETION_BLOCKED',ids:[n.meta.id]});
      if(!reviewed)n.suspensionReasons.push({code:'CONTEXT_CHANGED',ids:[n.meta.id]});
      else if(n.meta.state==='uninvestigate')n.suspensionReasons.push({code:'NOT_INVESTIGATED',ids:[n.meta.id]});
      if(unreviewedAncestor)n.suspensionReasons.push({code:'ANCESTOR_NOT_INVESTIGATED',ids:unreviewedAncestors.map(a=>a.meta.id)});
      if(unreviewedReference)n.suspensionReasons.push({code:'REFERENCE_NOT_INVESTIGATED',ids:n.effectiveRefs.filter(r=>r.type==='node'&&r.effectiveState==='uninvestigate').map(r=>r.meta.id)});
      if(unreviewedDependency)n.suspensionReasons.push({code:'DEPENDENCY_NOT_INVESTIGATED',ids:n.effectiveDeps.filter(r=>r.effectiveState==='uninvestigate').map(r=>r.meta.id)});
      if(!localInvalid){const required=n.children.filter(c=>c.meta.required);n.effectiveState=uninvestigate?'uninvestigate':n.children.length?(required.length&&required.every(c=>c.effectiveState==='done')?'done':required.some(c=>c.effectiveState==='uninvestigate')?'uninvestigate':'todo'):n.meta.state;}
      n.eligible=!localInvalid&&!uninvestigate&&n.effectiveState!=='uninvestigate'&&n.blockedBy.length===0&&!(n.meta.blockers?.length);
    }
    rolling.delete(n);return n.effectiveState;
  }
  nodes.forEach(roll);
  for(const n of nodes)if(!n.children.length&&!Object.hasOwn(profiles,n.meta.kind)&&n.meta.state!=='done')warn('UNSUPPORTED_PROFILE',n.path,'Unknown kind is preserved; no verified completion profile is installed.');
  return result();
}

/** Read-only impact graph: input propagation is distinct from ancestor spec inheritance. */
export function impactWorkspace(root,id){
  const validation=validateWorkspace(root);
  const targetNode=validation.nodes.find(n=>n.id===id), targetResource=validation.resources.find(r=>r.id===id);
  const item=targetNode??targetResource;
  if(!item)return {ok:false,errors:[...validation.errors,{code:'MISSING_TARGET',path:'.',message:'Impact target must resolve to a node or resource id.'}],warnings:validation.warnings,target:null,affected:[]};
  const byId=new Map(validation.nodes.map(n=>[n.id,n]));
  const edges=new Map();
  const edge=(from,to,reason)=>{if(!edges.has(from))edges.set(from,[]);edges.get(from).push({to,reason});};
  for(const n of validation.nodes){
    for(const dep of n.dependsOn)edge(dep,n.id,'dependency');
    for(const ref of n.refs)edge(ref,n.id,'reference');
    for(const child of n.children)edge(child,n.id,'child-input');
  }
  const affected=new Map(),queue=[id],visited=new Set([id]);
  function affect(to,via,reason,direct){
    if(to!==id){let entry=affected.get(to);if(!entry){entry={id:to,path:byId.get(to)?.path,kind:byId.get(to)?.kind,direct,via:[],reasons:[]};affected.set(to,entry);}entry.direct ||= direct;if(!entry.via.includes(via))entry.via.push(via);if(!entry.reasons.includes(reason))entry.reasons.push(reason);}
    if(!visited.has(to)){visited.add(to);queue.push(to);}
  }
  if(targetNode){
    const descendants=[...targetNode.children],seen=new Set();
    while(descendants.length){const child=descendants.shift();if(seen.has(child))continue;seen.add(child);affect(child,id,'ancestor-spec',true);descendants.push(...(byId.get(child)?.children??[]));}
  }
  while(queue.length){const current=queue.shift();for(const {to,reason}of edges.get(current)??[])affect(to,current,reason,current===id);}
  return {ok:validation.ok,errors:validation.errors,warnings:validation.warnings,target:{id:item.id,path:item.path,type:targetNode?'node':'resource'},affected:[...affected.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(a=>({...a,via:a.via.sort(),reasons:a.reasons.sort()}))};
}

/** Read-only stale/uninvestigated inventory derived from the canonical validator. */
export function staleWorkspace(root){
  const validation=validateWorkspace(root);
  const staleCodes=new Set(['INPUT_CHANGED','CONTEXT_CHANGED','ANCESTOR_NOT_INVESTIGATED','REFERENCE_NOT_INVESTIGATED','DEPENDENCY_NOT_INVESTIGATED','PREREQUISITE_NOT_DONE','COMPLETION_BLOCKED']);
  const nodes=validation.nodes.filter(n=>n.schema==='work/node@2'&&(n.effectiveState==='uninvestigate'||n.completion?.inputDigest!==undefined&&n.completion.inputDigest!==n.inputDigest)).map(n=>{
    const reasons=n.suspensionReasons??[];
    const hadReceipt=Boolean(n.investigationDigest||n.completion);
    const stale=hadReceipt&&(reasons.some(r=>staleCodes.has(r.code))||Boolean(n.completion&&n.completion.inputDigest!==n.inputDigest));
    const causes=[...new Set(reasons.filter(r=>staleCodes.has(r.code)).flatMap(r=>r.ids).concat(stale&&reasons.some(r=>r.code==='CONTEXT_CHANGED')?[n.id]:[]))].sort();
    return {id:n.id,path:n.path,authoredState:n.state,effectiveState:n.effectiveState,status:stale?'stale-reviewed':'not-yet-investigated',causes,oldDigests:{investigation:n.investigationDigest,completion:n.completion?.inputDigest??null},currentDigests:{context:n.contextDigest,input:n.inputDigest},completionEvidence:n.completion?.evidence??[]};
  });
  return {ok:validation.ok,errors:validation.errors,warnings:validation.warnings,nodes};
}
