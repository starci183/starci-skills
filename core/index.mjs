import {parseYaml} from './yaml.mjs';
import { validateSpecification } from '../specifications/validate.mjs';
import { validateSDSBindings, SDS_SCHEMA } from '../specifications/sds.mjs';
import {classifySDSPath,validateSDSMap,SDS_AGGREGATE_SCHEMA} from '../specifications/sds-map.mjs';
import {classifySRSPath,validateSRSGraph,SRS_AGGREGATE_SCHEMA} from '../specifications/srs-sections.mjs';
import { validateSRSV3Bindings, SRS_V3_SCHEMA } from '../specifications/srs-v3.mjs';
import { readDistJson } from './runtime-root.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const profiles = Object.freeze(readDistJson('schemas', 'profiles.json'));
const metadataSchema = readDistJson('schemas', 'work.schema.json');
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
/** Hash immutable design inputs, masking only explicitly selected authored leaves.
 * Ordinary validation and semantic hashes are unchanged; this grants no writes. */
export function authoredWorkspace(root,targets) {
  if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||!targets.every(text))throw Error('Exact authored target IDs required');
  return validate(root,null,null,targets);
}
/** Predict exact leaf completion without changing any file or granting acceptance. */
export function previewCompletion(root,completions) {
  try {
    if(!object(completions))throw Error('Expected completion map');
    return {...validate(root,structuredClone(completions)),preview:true};
  } catch {return {ok:false,preview:true,errors:[{code:'COMPLETION_PREVIEW',path:'.',message:'Invalid completion preview; no files were changed.'}],warnings:[],nodes:[],resources:[]};}
}
/** Validate a sealed, new evidence directory against live Work without publishing it. */
export function previewEvidence(root,{directory,nodeId,name}) {
  try {return {...validate(root,null,{directory,nodeId,name}),preview:true};}
  catch {return {ok:false,preview:true,errors:[{code:'EVIDENCE_PREVIEW',path:'.',message:'Invalid staged evidence; nothing was published.'}],warnings:[],nodes:[],resources:[]};}
}
function validate(root,completions=null,candidate=null,authoredTargets=null) {
  let authoredBinding,authoredAssets;
  const errors = [], warnings = [], nodes = [], resources = [], evidence = [], jsonFiles = [], accountFiles = [], reservedDirectories = [], ids = new Map(), splitSrsEntries=[],splitSdsEntries=[];
  const issue = (code, p, message) => errors.push({code, path:p, message});
  const warn = (code, p, message) => warnings.push({code, path:p, message});
  let absolute;
  const rel = p => path.relative(absolute, p).split(path.sep).join('/') || '.';
  const within = (base, p) => { const r = path.relative(base,p); return r === '' || (!r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r)); };
  const result = () => ({ok:errors.length === 0, errors, warnings,...(authoredTargets?{authoredBinding,authoredAssets}:{}), nodes:nodes.map(n => ({id:n.meta.id, path:n.path, schema:n.meta.schema, kind:n.meta.kind, required:n.meta.required, state:n.meta.state ?? null, effectiveState:n.effectiveState ?? 'invalid', specDigest:n.specDigest, contextDigest:n.contextDigest??null, inputDigest:n.inputDigest ?? null, investigationDigest:n.meta.investigation?.contextDigest??null, completion:n.meta.completion?{inputDigest:n.meta.completion.inputDigest??null,...(Object.hasOwn(n.meta.completion,'review')?{review:structuredClone(n.meta.completion.review)}:{evidence:Array.isArray(n.meta.completion.evidence)?[...n.meta.completion.evidence]:[]})}:null, eligible:n.eligible ?? false, children:n.children.map(c => c.meta.id),dependsOn:(n.effectiveDeps??[]).map(d=>d.meta.id),refs:(n.effectiveRefs??[]).map(d=>d.meta.id),blockedBy:n.blockedBy??[],blockers:n.meta.blockers??[],suspensionReasons:n.suspensionReasons??[]})), resources:resources.map(r => ({id:r.meta.id,kind:r.meta.kind,revision:r.meta.revision,path:r.path,specDigest:r.specDigest}))});
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
    if(type==='node'&&completions&&Object.hasOwn(completions,item.meta.id))item.meta={...item.meta,state:'done',completion:completions[item.meta.id]};
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
    if(typeof value==='number'&&Number.isFinite(shape.minimum)&&value<shape.minimum)issue('SCHEMA_VALUE',p,'Metadata number is below the published minimum.');
    if(Array.isArray(value)){
      if(Number.isInteger(shape.minItems)&&value.length<shape.minItems)issue('SCHEMA_VALUE',p,'Metadata list is shorter than the published minimum.');
      if(shape.uniqueItems&&new Set(value.map(canonicalJSON)).size!==value.length)issue('SCHEMA_VALUE',p,'Metadata list must contain unique values.');
      if(shape.items)value.forEach(v=>checkKeys(v,shape.items,p));
      return;
    }
    if(!object(value))return;
    for(const key of shape.required??[])if(!Object.hasOwn(value,key))issue('SCHEMA_VALUE',p,`Metadata object is missing required field ${key}.`);
    for(const [key,v]of Object.entries(value)) {
      if(shape.additionalProperties===false&&!Object.hasOwn(shape.properties??{},key))issue('UNKNOWN_FIELD',p,`Unknown reserved metadata field ${key}; correct its spelling or place extension data inside extensions/resource.details.`);
      else if(Object.hasOwn(shape.properties??{},key))checkKeys(v,shape.properties[key],p);
    }
  }
  const workspace=read(path.join(absolute,'workspace.yaml'));
  if (workspace) register(workspace,'workspace');
  function hasCanonicalNode(dir){
    try{return fs.readdirSync(dir,{withFileTypes:true}).some(ent=>{if(ent.name==='.git'||ent.name==='assets'||ent.name.startsWith('_'))return false;const p=path.join(dir,ent.name);if(ent.isDirectory())return hasCanonicalNode(p);if(ent.name!=='index.yaml')return false;try{return /(?:^|\n)\s*schema:\s*work\/node@2(?:\s|$)/.test(fs.readFileSync(p,'utf8'));}catch{return false;}});}catch{return false;}
  }
  const canonicalV2=hasCanonicalNode(absolute);
  function walk(dir, inAssets=false) {
    let entries;
    try { entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)); } catch { issue('READ_DIRECTORY',rel(dir),'Cannot enumerate directory.'); return; }
    for (const ent of entries) {
      if (ent.name === '.git') continue;
      const p=path.join(dir,ent.name);
      if (ent.isSymbolicLink()) { issue('SYMLINK',rel(p),'Symlinks are not accepted in canonical workspace artifacts.'); continue; }
      // Asset folders contain payloads, not Work metadata. Still traverse them
      // to reject symlinks; a fixture named index.yaml is not a child node.
      if(inAssets){if(ent.isDirectory())walk(p,true);continue;}
      if (ent.isDirectory()) {
        // Only the workspace-root local state is excluded; nested underscore folders remain invalid.
        if(dir===absolute&&ent.name==='_local')continue;
        if(ent.name.startsWith('_')){if(canonicalV2)reservedDirectories.push(rel(p));else if(!['_local','_workflows','_schema','_archive'].includes(ent.name))walk(p);}
        else walk(p,ent.name==='assets');
        continue;
      }
      let item;
      if(ent.name.toLowerCase().endsWith('.json'))jsonFiles.push(p);
      if(ent.name==='accounts.yaml')accountFiles.push(p);
      if (['index.yaml','node.yaml','node.md'].includes(ent.name)) {
        if (rel(p).split('/').slice(0,-1).some(part=>['evidence','assets','_resources'].includes(part.toLowerCase()))) { issue('LAYOUT',rel(p),'Nodes cannot be inside reserved evidence, assets or _resources directories.'); continue; }
        if ((item=read(p,ent.name.endsWith('.md')))) {register(item,'node');if(item.meta.schema==='work/node@2'&&ent.name!=='index.yaml')issue('CANONICAL_FORMAT',item.path,'work/node@2 is canonical YAML index.yaml only.');item.children=[];nodes.push(item);}
      } else if (ent.name === 'resource.yaml') {
        if (!rel(p).startsWith('_resources/')) {issue('LAYOUT',rel(p),'Resources belong under _resources.');continue;}
        if ((item=read(p))) {register(item,'resource');resources.push(item);}
      } else if (ent.name === 'manifest.yaml' && path.basename(path.dirname(dir)) === 'evidence') {
        if ((item=read(p))) {register(item,'evidence');evidence.push(item);}
      }
    }
  }
  walk(absolute);
  if(candidate) {
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidate.name))throw Error('Unsafe evidence name');
    const owner=nodes.find(n=>n.meta.id===candidate.nodeId),stage=fs.realpathSync(candidate.directory);
    const localStaging=path.join(absolute,'_local','evidence-staging');
    const directLocalStage=path.dirname(stage)===localStaging;
    if(!owner||fs.lstatSync(candidate.directory).isSymbolicLink()||(within(absolute,stage)&&!directLocalStage)||!fs.statSync(stage).isDirectory())throw Error('Invalid evidence staging ownership');
    const meta=parseYaml(fs.readFileSync(path.join(stage,'manifest.yaml'),'utf8'));
    if(meta.nodeId!==candidate.nodeId||!Array.isArray(meta.assets))throw Error('Staged evidence owner mismatch');
    const allowed=new Set(['manifest.yaml',...meta.assets.filter(a=>a.scope!=='node').map(a=>a.path)]);
    const scan=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,ent.name),relative=path.relative(stage,file).split(path.sep).join('/');
      if(ent.isSymbolicLink()||ent.name.startsWith('_')||ent.name==='.git'||ent.name.toLowerCase().endsWith('.json')||ent.name==='manifest.yaml'&&relative!=='manifest.yaml'||['index.yaml','node.yaml','node.md','resource.yaml','accounts.yaml'].includes(ent.name))throw Error('Unsafe staged artifact');
      if(ent.isDirectory())scan(file);else if(!ent.isFile()||!allowed.has(relative))throw Error('Unsealed staged file');
    }};scan(stage);
    const destination=path.join(owner.dir,'evidence',candidate.name);
    if(fs.existsSync(destination))throw Error('Never overwrite published evidence');
    const item={meta,body:'',markdown:false,path:rel(path.join(destination,'manifest.yaml')),file:path.join(stage,'manifest.yaml'),dir:stage};
    register(item,'evidence');evidence.push(item);
  }
  if(completions)for(const id of Object.keys(completions))if(!nodes.some(n=>n.meta.id===id))issue('COMPLETION_TARGET',id,'Completion preview target does not exist.');
  const nodesByDirectory=new Map();for(const n of nodes){const items=nodesByDirectory.get(n.dir)??[];items.push(n);nodesByDirectory.set(n.dir,items);}for(const [dir,items] of nodesByDirectory)if(items.length>1)issue('NODE_FORMAT_CONFLICT',rel(dir),'A Work folder must contain exactly one node metadata file.');
  if(canonicalV2){
    for(const p of reservedDirectories)issue('RESERVED_DIRECTORY',p,'Canonical Work v2 keeps no underscore-prefixed directories; collocate owned YAML records and assets with their node.');
    for(const p of jsonFiles)issue('JSON_ARTIFACT',rel(p),'Canonical Work records and results use YAML; JSON files are not accepted inside Work.');
  }
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
  const ownedAccounts = new Set();
  for (const n of nodes) {
    const candidates=nodes.filter(a=>a!==n && within(a.dir,n.dir) && a.dir!==n.dir).sort((a,b)=>b.dir.length-a.dir.length);
    n.parent=candidates[0]??null;if(n.parent)n.parent.children.push(n);
    if (!text(n.meta.kind)) issue('NODE_KIND',n.path,'kind is required.');
    if (typeof n.meta.required !== 'boolean') issue('REQUIRED',n.path,'required must be boolean.');
    const structured=['businessOverview','business','architecture','ui','implementation','uat'].filter(key=>n.meta[key]!==undefined);
    if(structured.length>1)issue('MODULE_SPEC',n.path,'A module node owns at most one business, architecture, UI, implementation or UAT specification.');
    if(n.meta.business!==undefined&&n.meta.kind!=='business')issue('MODULE_SPEC_OWNER',n.path,'business belongs to a business node.');
    if(n.meta.businessOverview!==undefined&&(n.meta.kind!=='business-overview'||!(n.path==='business/index.yaml'||/(?:^|\/)business\/overview\/index\.yaml$/.test(n.path))))issue('MODULE_SPEC_OWNER',n.path,'businessOverview belongs to business/overview/index.yaml or the legacy product business/index.yaml, with kind business-overview.');
    if(n.meta.architecture!==undefined&&n.meta.kind!=='architecture')issue('MODULE_SPEC_OWNER',n.path,'architecture belongs to an architecture node.');
    if(n.meta.ui!==undefined&&n.meta.kind!=='ui')issue('MODULE_SPEC_OWNER',n.path,'ui belongs to a UI node.');
    if(n.meta.implementation!==undefined&&n.meta.kind!=='implementation')issue('MODULE_SPEC_OWNER',n.path,'implementation belongs to an implementation node.');
    if(n.meta.uat!==undefined&&n.meta.kind!=='uat')issue('MODULE_SPEC_OWNER',n.path,'uat belongs to a uat node.');
    if (!n.body && !structured.length) issue('EMPTY_SPEC',n.path,'Node must have concise description text or one structured module specification.');
    n.depIds=stringList(n.meta.dependsOn,n.path,'dependsOn'); n.refIds=stringList(n.meta.refs,n.path,'refs');
    if(n.meta.assertions !== undefined) stringList(n.meta.assertions,n.path,'assertions');
    if(n.meta.schema==='work/node@2'){
      if(n.markdown&&n.meta.description!==undefined)issue('DUPLICATE_BODY',n.path,'Markdown nodes use their prose body; do not duplicate it in description metadata.');
      if(n.meta.activity!==undefined&&!['idle','investigating','implementing','verifying'].includes(n.meta.activity))issue('ACTIVITY',n.path,'Unknown activity.');
      if(n.meta.blockers!==undefined)stringList(n.meta.blockers,n.path,'blockers');
      if(n.meta.investigation!==undefined&&(!object(n.meta.investigation)||!/^[a-f0-9]{64}$/.test(n.meta.investigation.contextDigest??'')))issue('INVESTIGATION',n.path,'Investigation needs the exact reviewed contextDigest.');
      if(n.meta.history!==undefined)issue('CURRENT_ONLY',n.path,'Canonical Work v2 stores current specification and status only; Git retains history.');
      if(n.meta.ui!==undefined){
        if(!/(?:^|\/)ui(?:\/[^/]+)*\/index\.yaml$/.test(n.path))issue('UI_LAYOUT',n.path,'A UI specification belongs at ui/index.yaml or a recursively nested scope under ui/.');
        const states=new Set((n.meta.ui.states??[]).map(s=>String(s?.name??'').toLowerCase()));for(const required of ['loading','empty','error','interaction'])if(!states.has(required))issue('UI_STATE_COVERAGE',n.path,`UI specification must describe the ${required} state.`);
      }
      if(n.meta.implementation!==undefined&&!/(?:^|\/)implementation\/(?:frontend|backend)(?:\/[^/]+)*\/index\.yaml$/.test(n.path))issue('IMPLEMENTATION_LAYOUT',n.path,'Structured implementation belongs under implementation/frontend/ or implementation/backend/, with optional nested scopes.');
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
    if(n.meta.ui!==undefined){const declared=new Set((n.meta.assets??[]).map(a=>a?.path));for(const asset of n.meta.ui.assets??[]){if(!declared.has(asset?.path))issue('UI_ASSET_BINDING',n.path,'Every ui.assets path must also appear in top-level assets so its current bytes bind the UI specification.');}}
    const localFiles=[];
    for(const value of Object.values(n.meta.uat?.localFiles??{})){
      if(!text(value)||path.isAbsolute(value)||value.includes('\\')||value.includes(':')||value.split('/').some(part=>!part||part==='.'||part==='..')){issue('LOCAL_FILE_PATH',n.path,'UAT local files must be normalized relative paths beside the owning index.yaml.');continue;}
      try{const file=path.resolve(n.dir,value);if(!within(n.dir,file)||fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('unsafe');localFiles.push({path:value,sha256:digest(fs.readFileSync(file))});}catch{issue('LOCAL_FILE_UNREADABLE',n.path,'A declared UAT local file is missing, unreadable, non-file or unsafe.');}
    }
    const accountsPath=path.join(n.dir,'accounts.yaml');
    if(fs.existsSync(accountsPath)){
      ownedAccounts.add(path.resolve(accountsPath));
      if(n.meta.schema!=='work/node@2'||n.meta.kind!=='uat'||n.meta.uat?.localFiles?.accounts!=='accounts.yaml')issue('ACCOUNTS_OWNER',rel(accountsPath),'accounts.yaml is allowed only beside its owning Work v2 UAT index.yaml and must be declared as uat.localFiles.accounts.');
      else try{
        const accounts=parseYaml(fs.readFileSync(accountsPath,'utf8'));
        const validAccount=a=>object(a)&&Object.keys(a).sort().join(',')==='password,role,username'&&text(a.role)&&text(a.username)&&text(a.password);
        if(!object(accounts)||Object.keys(accounts).sort().join(',')!=='accounts,disposable,schema'||accounts.schema!=='work/disposable-accounts@1'||accounts.disposable!==true||!Array.isArray(accounts.accounts)||accounts.accounts.length===0||!accounts.accounts.every(validAccount))throw Error('schema');
      }catch{issue('ACCOUNTS_SCHEMA',rel(accountsPath),'Disposable accounts must match work/disposable-accounts@1 exactly: disposable true and nonempty role, username and password strings only.');}
    }
    n.ownedAssets=ownedAssets;
    n.specDigest=digest(canonicalJSON({...(n.meta.assets!==undefined?{assets:ownedAssets}:{}),...(localFiles.length?{localFiles:localFiles.sort((a,b)=>a.path.localeCompare(b.path))}:{}),metadata:Object.fromEntries(Object.entries(n.meta).filter(([k])=>!operational.has(k)&&!(n.meta.schema==='work/node@2'&&k==='description'))),body:n.body}));
  }
  if(canonicalV2)for(const p of accountFiles)if(!ownedAccounts.has(path.resolve(p)))issue('ACCOUNTS_OWNER',rel(p),'accounts.yaml is allowed only beside its owning Work v2 UAT index.yaml and must be declared as uat.localFiles.accounts.');
  for (const n of nodes) {
    n.deps=n.depIds.map(id=>resolve(id,n,['node'])).filter(Boolean);
    n.refs=n.refIds.map(id=>resolve(id,n,['node','resource'])).filter(Boolean);
    if (n.children.length) {
      if ('state' in n.meta || 'completion' in n.meta) issue('BRANCH_STATE',n.path,'Branches must not store state or completion.');
      if(n.meta.schema==='work/node@2'&&n.meta.kind==='implementation'&&path.basename(n.dir)==='implementation'&&n.meta.implementation!==undefined)issue('IMPLEMENTATION_PARENT',n.path,'The implementation parent is thin and derives status from frontend/backend children; it carries no implementation payload.');
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
    const splitSrs=n.meta.extensions?.work3?.srs;
    const splitSds=n.meta.extensions?.work3?.sds;
    const overviewClassification=splitSds===undefined?null:classifySDSPath(n.path,n.children.length>0);
    if(overviewClassification?.type==='overview'){
      if(n.meta.kind!=='architecture'||n.children.length)issue('SDS_LAYOUT',n.path,'Structured architecture overview is an architecture leaf.');
      if(spec!==undefined)issue('SDS_DUPLICATE',n.path,'Use either the structured overview or one legacy specification, never both.');
      if(n.meta.sourceRefs?.length)issue('SDS_SOURCE_MAPPING',n.path,'Overview decisions may summarize feasibility but sourceRefs and revision proof belong to Implementation.');
      splitSdsEntries.push({path:n.path,nodeId:n.meta.id,workRefs:n.refIds,payload:splitSds,classification:overviewClassification});
      if(n.meta.state==='done'&&splitSds?.status!=='accepted')issue('SDS_NOT_ACCEPTED',n.path,'A reviewed architecture overview must have status accepted before it can complete.');
    }
    const sdsMatch = n.path.match(/^(.*(?:^|\/)architecture\/)sds\/(?:[^/]+\/)*index\.yaml$/);
    if(sdsMatch){
      const archRoot=sdsMatch[1];
      if(n.meta.kind!=='architecture')issue('SDS_LAYOUT',n.path,'SDS branches and leaves have kind architecture.');
      for(const suffix of ['index.yaml','overview/index.yaml','sds/index.yaml'])if(!nodes.some(x=>x.path===archRoot+suffix&&x.meta.kind==='architecture'))issue('SDS_LAYOUT',n.path,'Nested SDS requires architecture/index.yaml, overview/index.yaml and sds/index.yaml.');
      if(n.children.length&&spec!==undefined)issue('SDS_BRANCH_PAYLOAD',n.path,'SDS branches aggregate; do not duplicate their descendant design.');
      if(splitSds!==undefined){
        const classification=classifySDSPath(n.path,n.children.length>0);
        if(spec!==undefined)issue('SDS_DUPLICATE',n.path,'Use either a split SDS section or one legacy specification, never both.');
        if(!classification)issue('SDS_SECTION_PATH',n.path,'Typed SDS content must live under architecture/sds.');
        else {
          if(n.children.length&&!classification.aggregate)issue('SDS_BRANCH_PAYLOAD',n.path,'A detailed SDS item cannot also aggregate child scopes.');
          if(classification.aggregate&&splitSds?.schema!==SDS_AGGREGATE_SCHEMA)issue('SDS_AGGREGATE',n.path,'SDS parent indexes use starci/sds-aggregate@1 metadata.');
          if(n.meta.sourceRefs?.length)issue('SDS_SOURCE_MAPPING',n.path,'SDS is source-independent; sourceRefs and revision proof belong to Implementation.');
          splitSdsEntries.push({path:n.path,nodeId:n.meta.id,workRefs:n.refIds,payload:splitSds,classification});
        }
      } else if(!n.children.length&&(spec!==undefined||n.meta.state!=='uninvestigate')&&spec?.schema!==SDS_SCHEMA)issue('SDS_VERSION',n.path,'New SDS authoring requires a typed source-independent section; readable legacy leaves use starci/specification@3.');
      if(!n.children.length&&n.meta.state==='done'&&splitSds!==undefined&&splitSds.status!=='accepted')issue('SDS_NOT_ACCEPTED',n.path,'A reviewed SDS leaf must have status accepted before it can complete.');
    }
    const srsMatch = n.path.match(/^(.*(?:^|\/)business\/)srs\/(?:[^/]+\/)*index\.yaml$/);
    if(srsMatch){
      const businessRoot=srsMatch[1], srsRoot=businessRoot+'srs/index.yaml';
      if(n.meta.kind!=='business')issue('SRS_LAYOUT',n.path,'SRS branches and leaves have kind business.');
      if(n.meta.sourceRefs?.length)issue('SRS_CODE_INPUT',n.path,'SRS is a source-of-truth contract independent of source code; sourceRefs belong to Implementation proof.');
      if(!nodes.some(x=>x.path===businessRoot+'index.yaml')||!nodes.some(x=>x.path===srsRoot)||!nodes.some(x=>x.path===businessRoot+'overview/index.yaml'&&x.meta.kind==='business-overview'))issue('SRS_LAYOUT',n.path,'Nested SRS requires business/index.yaml, business/overview/index.yaml and business/srs/index.yaml.');
      if(n.meta.business!==undefined)issue('SRS_DUPLICATE',n.path,'Version 2 SRS is the sole detailed payload; do not duplicate it in business.');
      if(n.children.length&&spec!==undefined)issue('SRS_BRANCH_PAYLOAD',n.path,'SRS branches aggregate descendant requirements; only leaves carry specifications.');
      if(splitSrs!==undefined){
        const classification=classifySRSPath(n.path,n.children.length>0);
        if(spec!==undefined)issue('SRS_DUPLICATE',n.path,'Use either a split SRS section or one legacy cohesive specification, never both.');
        if(!classification)issue('SRS_SECTION_PATH',n.path,'Typed SRS content must live under business/srs.');
        else {
          if(n.children.length&&!classification.aggregate)issue('SRS_BRANCH_PAYLOAD',n.path,'A detailed SRS item cannot also aggregate child scopes.');
          if(classification.aggregate&&splitSrs?.schema!==SRS_AGGREGATE_SCHEMA)issue('SRS_AGGREGATE',n.path,'SRS parent indexes use starci/srs-aggregate@1 metadata.');
          splitSrsEntries.push({path:n.path,nodeId:n.meta.id,workRefs:n.refIds,payload:splitSrs,classification});
        }
      } else if(!n.children.length&&(spec!==undefined||n.meta.state!=='uninvestigate')&&!['starci/specification@2',SRS_V3_SCHEMA].includes(spec?.schema))issue('SRS_VERSION',n.path,'New SRS authoring requires a typed split section; readable legacy leaves use starci/specification@2 or starci/srs@3; uninvestigated placeholders cannot complete.');
      if(!n.children.length&&n.meta.state==='done'&&splitSrs!==undefined&&splitSrs.status!=='accepted')issue('SRS_NOT_ACCEPTED',n.path,'A reviewed SRS section must have status accepted before it can complete.');
      if(spec?.schema===SRS_V3_SCHEMA){const suffix=n.path.slice((businessRoot+'srs/').length), expected=suffix.startsWith('functional-requirements/')?'functional-requirement':suffix.startsWith('non-functional-requirements/')?'non-functional-requirement':suffix.startsWith('business-rules/')?'business-rule':suffix.startsWith('data/')?'data':suffix.startsWith('customer-journeys/')?'customer-journey':null;if(!expected||spec.nodeType!==expected)issue('SRS_NODE_TYPE',n.path,'SRS@3 nodeType must match its canonical functional-requirements/non-functional-requirements/business-rules/data/customer-journeys folder.');}
    }
    if (spec !== undefined) {
      const review = validateSpecification(spec);
      for (const message of review.errors) issue('SPECIFICATION', n.path, message);
      if (!['business','architecture'].includes(n.meta.kind) || spec?.op !== n.meta.kind + '.decide') issue('SPECIFICATION_OWNER', n.path, 'Specification must belong to its business/architecture node kind.');
      if (spec?.op === 'architecture.decide') {
        const businessInputs = r => r.type === 'node' ? [r,...r.children.flatMap(businessInputs)] : [];
        if(spec.schema===SDS_SCHEMA&&review.ok){
          if(n.children.length)issue('SDS_BRANCH_PAYLOAD',n.path,'SDS payloads belong to leaves.');
          if(n.meta.sourceRefs?.length||n.meta.architecture!==undefined)issue('SDS_SOURCE_MAPPING',n.path,'Source mapping and legacy duplicate architecture payload belong to Implementation, not SDS.');
          const allowedNodeIds=new Set([...n.effectiveRefs,...n.effectiveDeps].flatMap(businessInputs).map(x=>x.meta.id));
          for(const message of validateSDSBindings(spec,{nodes,allowedNodeIds}))issue('SDS_BINDING',n.path,message);
        }
        const businesses = [...n.effectiveRefs,...n.effectiveDeps].flatMap(businessInputs).filter(r=>r.meta.kind==='business'&&r.meta.extensions?.work3?.specification).map(r=>r.meta.extensions.work3.specification);
        if(spec.schema==='starci/specification@2') for(const business of businesses.filter(b=>b.schema==='starci/specification@2')) {
          for(const field of ['requirements','flows','actors','data','externalInterfaces','acceptance']) for(const input of business[field]??[]) {
            const output=(spec[field]??[]).find(row=>row.id===input.id);
            if(!output||canonicalJSON(output)!==canonicalJSON(input))issue('SPECIFICATION_BUSINESS_DRIFT',n.path,'Architecture must preserve referenced SRS '+field+' item '+input.id+' unchanged; service calls are separate.');
          }
        }
        for (const journey of Array.isArray(spec.journeys) ? spec.journeys : []) {
          const matches = businesses.flatMap(b => Array.isArray(b.journeys) ? b.journeys : []).filter(j => j.id === journey.id);
          if (matches.length && matches.some(j => canonicalJSON(j) !== canonicalJSON(journey))) issue('SPECIFICATION_JOURNEY_DRIFT', n.path, 'Architecture must preserve referenced business journey actions and expectations.');
          if (spec.status === 'pass' && !matches.length) issue('SPECIFICATION_JOURNEY_UNBOUND', n.path, 'Passing architecture journeys need a referenced business journey.');
        }
      }
      if(spec?.schema===SRS_V3_SCHEMA&&review.ok){const walk=x=>[x,...x.children.flatMap(walk)],rootPrefix=n.path.split('business/')[0]+'business/',allowed=nodes.filter(item=>item.type==='node'&&item.path.startsWith(rootPrefix));for(const input of [...n.effectiveRefs,...n.effectiveDeps])allowed.push(...(input.type==='node'?walk(input):[input]));for(const message of validateSRSV3Bindings(spec,{nodes,allowedNodeIds:new Set(allowed.map(x=>x.meta.id))}))issue('SRS_BINDING',n.path,message);}
      if (n.meta.state === 'done' && spec?.status !== 'pass') issue('SPECIFICATION_NOT_ACCEPTED', n.path, 'Draft or blocked specification cannot complete a node.');
      for (const source of Array.isArray(spec?.sources) ? spec.sources : []) {
        if (source?.kind !== 'observed') continue;
        if (n.meta.schema === 'work/node@2') {
          const bindings = (Array.isArray(n.meta.sourceRefs) ? n.meta.sourceRefs : []).filter(ref => object(ref) && ref.repository === source.repository && ref.path === source.path);
          if (!bindings.length) issue('SPECIFICATION_SOURCE_UNBOUND', n.path, 'Observed source needs an owning-node sourceRefs entry with the same repository and path.');
          else if (bindings.some(ref => ref.revision !== source.revision)) issue('SPECIFICATION_SOURCE_STALE', n.path, 'Observed source revision must match every owning-node sourceRefs entry for that repository and path.');
          continue;
        }
        const resource = n.effectiveRefs.find(r => r.type === 'resource' && r.meta.id === source.repository && r.meta.kind === 'repository');
        if (!resource) issue('SPECIFICATION_SOURCE_UNBOUND', n.path, 'Observed source repository must be a bound repository resource.');
        else if (resource.meta.revision !== source.revision) issue('SPECIFICATION_SOURCE_STALE', n.path, 'Source citation revision must match the bound repository revision.');
      }
    }
  }
  for(const finding of validateSRSGraph(splitSrsEntries))issue(finding.code,finding.path,finding.message);
  const businessEntries=nodes.filter(node=>node.meta.kind==='business'||node.meta.kind==='business-overview').map(node=>({nodeId:node.meta.id,path:node.path}));
  for(const finding of validateSDSMap(splitSdsEntries,splitSrsEntries,businessEntries))issue(finding.code,finding.path,finding.message);
  const srs3=nodes.filter(n=>{const s=n.meta.extensions?.work3?.specification;return s?.schema===SRS_V3_SCHEMA&&validateSpecification(s).ok;});
  const srsIds=new Map();for(const n of srs3){const spec=n.meta.extensions.work3.specification;if(srsIds.has(spec.id))issue('SRS_ITEM_ID',n.path,`Duplicate SRS item id ${spec.id}.`);else srsIds.set(spec.id,n);}for(const n of srs3){const spec=n.meta.extensions.work3.specification,c=spec.content,declared=(type,id)=>spec.refs.some(r=>r.type===type&&r.itemId===id);const requireRefs=(ids,type,label)=>{for(const id of ids??[])if(!declared(type,id))issue('SRS_GRAPH',n.path,`${label} ${id} needs an explicit typed ${type} ref.`);};
    if(spec.nodeType==='functional-requirement'){requireRefs(c.businessRuleRefs,'business-rule','FR business rule');requireRefs(c.nfrRefs,'non-functional-requirement','FR NFR');}
    if(spec.nodeType==='business-rule')for(const id of c.appliesTo)if(!spec.refs.some(r=>r.itemId===id&&['functional-requirement','customer-journey'].includes(r.type)))issue('SRS_GRAPH',n.path,`Business rule appliesTo ${id} needs an explicit typed FR/journey ref.`);
    if(spec.nodeType==='data')for(const transition of c.transitions)for(const id of transition.ruleRefs)if(!spec.refs.some(r=>r.type==='business-rule'&&r.itemId===id))issue('SRS_GRAPH',n.path,`Data transition rule ${id} needs an explicit typed business-rule ref.`);
    if(spec.nodeType==='non-functional-requirement'&&c.scope.kind==='selected')for(const id of c.scope.refs)if(!spec.refs.some(r=>r.itemId===id&&['functional-requirement','customer-journey'].includes(r.type)))issue('SRS_GRAPH',n.path,`NFR scope ${id} needs an explicit typed FR/journey ref.`);
    if(spec.nodeType==='non-functional-requirement')for(const id of c.acceptanceRefs)if(!spec.refs.some(r=>r.type==='acceptance'&&r.itemId===id))issue('SRS_GRAPH',n.path,`NFR acceptance ${id} needs an explicit typed ref.`);
    if(spec.nodeType==='customer-journey'){for(const stage of c.stages){requireRefs([stage.functionalRequirementRef],'functional-requirement','Journey FR');requireRefs(stage.nfrRefs,'non-functional-requirement','Journey NFR');const frRef=spec.refs.find(r=>r.itemId===stage.functionalRequirementRef&&r.type==='functional-requirement'),flowRef=spec.refs.find(r=>r.itemId===stage.flowRef&&r.type==='flow');if(!flowRef)issue('SRS_GRAPH',n.path,`Journey flow ${stage.flowRef} needs an explicit typed flow ref.`);else if(frRef&&flowRef.nodeId!==frRef.nodeId)issue('SRS_JOURNEY_OWNER',n.path,`Journey flow ${stage.flowRef} must belong to functional requirement ${stage.functionalRequirementRef}.`);}for(const route of c.significantPaths)requireRefs([route.branchRef],'branch','Journey branch');}
  }
  const visiting=new Set();
  const workspaceDigest=workspace?digest(canonicalJSON(workspace.meta)):'';
  const semanticBase=(subject,specOf,digestNode)=>{
    const ancestors=[];for(let a=subject.parent;a;a=a.parent)ancestors.unshift(a);
    const bindings=item=>[...item.deps,...item.refs.filter(r=>item===subject||r.type!=='node'||!within(r.dir,subject.dir))].map(r=>({id:r.meta.id,digest:r.type==='resource'?r.specDigest:digestNode(r)})).sort((a,b)=>a.id.localeCompare(b.id));
    return {workspace:workspaceDigest,spec:specOf(subject),ancestors:ancestors.map(a=>({id:a.meta.id,spec:specOf(a),bindings:bindings(a)})),bindings:bindings(subject)};
  };
  // Split SRS/SDS payloads use semantic IDs instead of legacy nodeId/itemId
  // tuples. Resolve those IDs to their exact Work owners for digest freshness,
  // but keep them outside the ordinary Work refs graph so reciprocal design
  // relationships do not manufacture dependency cycles.
  const splitOwners={srs:new Map(),sds:new Map()};
  const own=(space,id,nodeId)=>{if(text(id)&&!splitOwners[space].has(id))splitOwners[space].set(id,nodeId);};
  for(const entry of splitSrsEntries.filter(item=>!item.classification.aggregate)){
    const p=entry.payload;own('srs',p?.id,entry.nodeId);
    if(entry.classification.type==='functional-requirement'){
      for(const flow of [p?.mainFlow,...(p?.alternativeFlows??[]),...(p?.exceptionFlows??[])])own('srs',flow?.id,entry.nodeId);
      for(const acceptance of p?.acceptanceCriteria??[])own('srs',acceptance?.id,entry.nodeId);
    }
  }
  for(const entry of splitSdsEntries.filter(item=>!item.classification.aggregate))own('sds',entry.payload?.id,entry.nodeId);
  const semantic=(space,ids)=>[...new Set((ids??[]).filter(text))].map(id=>({space,id}));
  const splitSemanticRefs=node=>{
    const srs=node.meta.extensions?.work3?.srs,sds=node.meta.extensions?.work3?.sds,refs=[];
    if(srs?.schema?.startsWith('starci/srs-')){
      if(srs.schema==='starci/srs-functional-requirement@1')refs.push(...semantic('srs',[...(srs.businessRuleRefs??[]),...(srs.dataRefs??[]),...(srs.nonFunctionalRefs??[]),...(srs.decisionRefs??[])]));
      if(['starci/srs-non-functional-requirement@1','starci/srs-business-rule@1'].includes(srs.schema))refs.push(...semantic('srs',srs.decisionRefs));
      if(srs.schema==='starci/srs-data-definition@1')refs.push(...semantic('srs',(srs.relations??[]).map(row=>row?.dataRef)));
      if(srs.schema==='starci/srs-customer-journey@1')refs.push(...semantic('srs',[...(srs.stages??[]).flatMap(stage=>[stage?.requirementRef,stage?.flowRef,...(stage?.acceptanceRefs??[])]),...(srs.branches??[]).flatMap(branch=>[branch?.requirementRef,branch?.flowRef,...(branch?.acceptanceRefs??[])])]));
    }
    if(sds?.schema?.startsWith('starci/sds-')){
      if(sds.schema==='starci/sds-flow@1'){
        for(const business of sds.businessRefs??[])refs.push(...semantic('srs',[...(business?.requirementIds??[]),...(business?.flowIds??[]),...(business?.acceptanceIds??[])]));
        refs.push(...semantic('sds',[sds.entryPoint?.componentRef,...(sds.participants??[]),...(sds.topologyRefs??[]),...(sds.verificationRefs??[]),...[sds.mainSequence,...(sds.alternativeSequences??[]),...(sds.exceptionSequences??[])].flatMap(sequence=>(sequence?.steps??[]).flatMap(step=>[step?.componentRef,...(step?.contractRefs??[]),...(step?.dataRefs??[])]))]));
      }
      if(sds.schema==='starci/sds-component@1')refs.push(...semantic('sds',[...(sds.interfaceRefs??[]),...(sds.dataRefs??[]),...(sds.qualityRefs??[]),...(sds.verificationRefs??[])]));
      if(sds.schema==='starci/sds-contract@1')refs.push(...semantic('sds',[sds.callerComponentRef,sds.receiverComponentRef]));
      if(sds.schema==='starci/sds-data-model@1')refs.push(...semantic('sds',[sds.ownerComponentRef]));
      if(sds.schema==='starci/sds-quality@1'){refs.push(...semantic('srs',sds.businessRefs));refs.push(...semantic('sds',[...(sds.scopeRefs??[]),...(sds.verificationRefs??[])]));}
      if(sds.schema==='starci/sds-deployment@1')refs.push(...semantic('sds',(sds.placements??[]).map(placement=>placement?.componentRef)));
      if(sds.schema==='starci/sds-decision@1')refs.push(...semantic('sds',sds.affectedRefs));
      if(sds.schema==='starci/sds-verification@1'){refs.push(...semantic('srs',sds.businessAcceptanceRefs));refs.push(...semantic('sds',sds.scopeRefs));}
    }
    return refs.map(ref=>splitOwners[ref.space].get(ref.id)).filter(ownerId=>text(ownerId)&&ownerId!==node.meta.id).map(nodeId=>({nodeId}));
  };
  // Untagged SDS@3 designRefs predate typed freshness and must not change the
  // digest of an untouched legacy owner. Split schemas opt in; after that
  // boundary, all owner context is followed.
  const specificationOwnerRefs=node=>{const spec=node.meta.extensions?.work3?.specification;return [...(spec?.refs??[]),...(spec?.designRefs??[]),...splitSemanticRefs(node)].filter(ref=>text(ref?.nodeId));};
  const specificationSeedRefs=node=>{
    const spec=node.meta.extensions?.work3?.specification,split=splitSemanticRefs(node);
    if(split.length)return split;
    if(spec?.schema===SRS_V3_SCHEMA)return (spec.refs??[]).filter(ref=>text(ref?.nodeId));
    return [];
  };
  function input(n) {
    if(n.inputDigest)return n.inputDigest;
    if(visiting.has(n)) {issue('CYCLE',n.path,'Dependency/reference cycle prevents trustworthy input binding.');return 'cycle';}
    visiting.add(n);
    // An inherited reference to this scope is already represented by its own
    // specification/ancestor specifications. Expanding it again fabricates a
    // self-cycle when a goal points to its requirements subtree. Explicit refs
    // and all dependency edges still participate in normal cycle detection.
    const typedBase=target=>digest(canonicalJSON(semanticBase(target,x=>x.specDigest,input)));
    const specificationLinks=[],pending=[...specificationSeedRefs(n)];while(pending.length){const ref=pending.shift(),target=nodes.find(x=>x.meta.id===ref.nodeId);if(target&&!specificationLinks.some(x=>x.id===target.meta.id)){specificationLinks.push({id:target.meta.id,digest:typedBase(target)});pending.push(...specificationOwnerRefs(target));}}specificationLinks.sort((a,b)=>a.id.localeCompare(b.id));
    const context={...semanticBase(n,x=>x.specDigest,input),...(specificationLinks.length?{specificationLinks}:{})};
    n.contextDigest=digest(canonicalJSON(context));
    n.inputDigest=digest(canonicalJSON({...context,children:n.children.map(c=>({id:c.meta.id,digest:input(c)})).sort((a,b)=>a.id.localeCompare(b.id))}));
    visiting.delete(n);return n.inputDigest;
  }
  nodes.forEach(input);
  if(authoredTargets){
    const selected=new Set(authoredTargets),cache=new Map(),active=new Set();
    const shape=n=>({id:n.meta.id,path:n.path,schema:n.meta.schema,kind:n.meta.kind,required:n.meta.required,blockers:n.meta.blockers??[],assertions:n.meta.assertions??[],dependsOn:n.depIds,refs:n.refIds,children:n.children.map(c=>c.meta.id)});
    const spec=n=>selected.has(n.meta.id)?digest(canonicalJSON({authored:shape(n)})):n.specDigest;
    function masked(n){
      if(cache.has(n))return cache.get(n);
      if(active.has(n))throw Error('Authored input graph has a cycle');active.add(n);
      const typedBase=target=>digest(canonicalJSON(semanticBase(target,spec,masked)));
      const specificationLinks=[],pending=[...specificationSeedRefs(n)];while(pending.length){const ref=pending.shift(),target=nodes.find(x=>x.meta.id===ref.nodeId);if(target&&!specificationLinks.some(x=>x.id===target.meta.id)){specificationLinks.push({id:target.meta.id,digest:typedBase(target)});pending.push(...specificationOwnerRefs(target));}}specificationLinks.sort((a,b)=>a.id.localeCompare(b.id));const value=digest(canonicalJSON({...semanticBase(n,spec,masked),...(specificationLinks.length?{specificationLinks}:{}),children:n.children.map(c=>({id:c.meta.id,digest:masked(c)})).sort((a,b)=>a.id.localeCompare(b.id))}));
      active.delete(n);cache.set(n,value);return value;
    }
    authoredAssets=authoredTargets.map(id=>{const n=nodes.find(n=>n.meta.id===id);return {id,assets:n?.ownedAssets??[]};});
    authoredBinding=authoredTargets.map(id=>{const n=nodes.find(n=>n.meta.id===id);if(!n||n.children.length)throw Error('Authored output must be an existing exact leaf');return {...shape(n),invariantDigest:masked(n)};});
  }
  function codeRefs(refs,item,required=false) {
    if(refs===undefined && !required)return [];
    if(!Array.isArray(refs) || (required && !refs.length)) {issue('CODE_REFS',item.path,'codeRefs requires a nonempty array of repository/full commit SHA bindings.');return [];}
    for(const ref of refs) {
      if(!object(ref)||!text(ref.repository)||!sha(ref.commit)) {issue('COMMIT',item.path,'Commit binding requires repository id and full lowercase 40/64 hex commit SHA.');continue;}
      const repo=resolve(ref.repository,item,['resource']);if(repo && repo.meta.kind!=='repository')issue('REPOSITORY_KIND',item.path,'Code binding must reference a repository resource.');
    }
    return refs;
  }
  function sourceIdentity(value,item,owner,assets) {
    if(!object(value)||value.schema!=='starci/source-identity@1'||!Array.isArray(value.repositories)||!value.repositories.length){issue('SOURCE_IDENTITY',item.path,'Versioned nonempty direct source identity required.');return;}
    if(owner?.meta.schema!=='work/node@2'||owner?.meta.kind!=='implementation')issue('SOURCE_IDENTITY_SCOPE',item.path,'Direct source identity is restricted to current implementation nodes.');
    const seen=new Set();
    const normalized=p=>typeof p==='string'&&p.trim().length>0&&p===p.trim()&&!/[\\\x00-\x1f:]/.test(p)&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
    for(const r of value.repositories){
      if(!object(r)){issue('SOURCE_IDENTITY',item.path,'Invalid repository identity.');continue;}
      if(seen.has(r.repository))issue('SOURCE_IDENTITY',item.path,'Duplicate repository identity.');seen.add(r.repository);
      let validOrigin=false;
      try{const u=new URL(r.origin);validOrigin=['https:','ssh:'].includes(u.protocol)&&!!u.hostname&&!u.password&&!u.search&&!u.hash&&(u.protocol==='ssh:'?(!u.username||u.username==='git'):!u.username)&&u.pathname.length>1&&u.href===r.origin;}catch{}
      if(!validOrigin)issue('SOURCE_ORIGIN',item.path,'Origin must be a normalized credential-free HTTPS or SSH repository URL.');
      const cov=r.coverage;
      if(!object(cov)||!['full-tree','scoped'].includes(cov.kind)||!Array.isArray(cov.paths)||!text(cov.dependencyCoverage)||!Array.isArray(cov.limitations)||cov.limitations.some(v=>!text(v))||(cov.kind==='full-tree'?cov.paths.length!==0:!cov.paths.length||cov.paths.some(p=>!normalized(p))||!cov.limitations.length))issue('SOURCE_COVERAGE',item.path,'Declare full-tree or explicit normalized scoped coverage, dependency coverage and honest limitations.');
      if(r.state==='committed'){
        if(!sha(r.commit)||Object.hasOwn(r,'baseCommit')||Object.hasOwn(r,'snapshot'))issue('SOURCE_STATE',item.path,'Committed identity requires only an exact commit, not dirty snapshot fields.');
      }else if(r.state==='dirty'){
        if(Object.hasOwn(r,'commit')||!sha(r.baseCommit)||!object(r.snapshot)||!normalized(r.snapshot.artifact)||!/^[a-f0-9]{64}$/.test(r.snapshot.sha256??''))issue('SOURCE_STATE',item.path,'Dirty identity requires baseCommit and a preserved snapshot, never a tested commit claim.');
        if(assets&&!assets.some(a=>object(a)&&a.path===r.snapshot?.artifact&&a.sha256===r.snapshot?.sha256))issue('SOURCE_SNAPSHOT',item.path,'Dirty source snapshot must be an included byte-verified evidence asset.');
      }else issue('SOURCE_STATE',item.path,'Unknown source state.');
    }
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
    if(e.meta.sourceIdentity!==undefined){sourceIdentity(e.meta.sourceIdentity,e,e.node,Array.isArray(e.meta.assets)?e.meta.assets:[]);if(e.meta.codeRefs!==undefined)issue('SOURCE_IDENTITY_MIXED',e.path,'Do not mix direct and legacy source proof.');}
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
    if(!object(c)){issue('COMPLETION',n.path,'Done requires a current completion binding and its supported verification record.');return false;}
    if(c.inputDigest!==n.inputDigest){issue('STALE_COMPLETION',n.path,'Completion no longer binds current semantic inputs.');n.stale=true;}
    const required=stringList(n.meta.assertions,n.path,'assertions',true);
    if(Object.hasOwn(c,'review')){
      const spec=n.meta.extensions?.work3?.specification;
      const splitSrs=n.meta.extensions?.work3?.srs,srsSection=splitSrs===undefined?null:classifySRSPath(n.path,false);
      const splitSds=n.meta.extensions?.work3?.sds,sdsSection=splitSds===undefined?null:classifySDSPath(n.path,false);
      const supported=n.meta.schema==='work/node@2'&&(
        (n.meta.kind==='business-overview'&&object(n.meta.businessOverview))||
        (n.meta.kind==='business'&&spec?.schema==='starci/specification@2'&&spec.op==='business.decide')||
        (n.meta.kind==='architecture'&&spec?.schema===SDS_SCHEMA&&spec.op==='architecture.decide')||
        (n.meta.kind==='business'&&spec?.schema===SRS_V3_SCHEMA&&spec.op==='business.decide')||
        (n.meta.kind==='business'&&srsSection?.type&&splitSrs?.schema===srsSection.expectedSchema)||
        (n.meta.kind==='architecture'&&sdsSection?.type&&splitSds?.schema===sdsSection.expectedSchema));
      if(!supported)issue('DESIGN_REVIEW_SCOPE',n.path,'Inline review is restricted to current structured Business overview, split source-independent SDS and their readable legacy formats; other profiles require their existing proof.');
      if(Object.hasOwn(c,'evidence')||Object.hasOwn(c,'codeRefs')||Object.hasOwn(c,'sourceIdentity'))issue('DESIGN_REVIEW_MIXED',n.path,'Design review cannot be mixed with evidence or source completion bindings.');
      const review=c.review,seen=new Set();
      if(!object(review)||review.schema!=='starci/design-review@1'||!text(review.reviewer)||!text(review.authority)||!text(review.reviewedAt)||!/^\d{4}-\d{2}-\d{2}T/.test(review.reviewedAt)||!Number.isFinite(Date.parse(review.reviewedAt)))issue('DESIGN_REVIEW',n.path,'Review needs declared reviewer, actual authority provenance and an ISO review time; the validator does not authenticate them.');
      if(!Array.isArray(review?.observations)||!review.observations.length)issue('DESIGN_REVIEW_OBSERVATIONS',n.path,'Review must contain concrete current assertion observations.');
      else for(const a of review.observations){
        if(!object(a)||!text(a.id)||!required.includes(a.id)||seen.has(a.id)||a.outcome!=='pass'||!text(a.observation))issue('DESIGN_REVIEW_OBSERVATION',n.path,'Each required design assertion needs one unique passing observation; unknown, failed or missing claims cannot complete design.');
        if(object(a))seen.add(a.id);
      }
      for(const id of required)if(!seen.has(id))issue('ASSERTION_COVERAGE',n.path,'Required design assertion has no reviewed observation.');
      if(!Array.isArray(review?.limitations)||review.limitations.some(v=>!text(v)))issue('DESIGN_REVIEW_LIMITATIONS',n.path,'Review limitations must be an explicit list; known material blockers cannot be hidden here.');
      return true;
    }
    const evidenceIds=stringList(c.evidence,n.path,'completion.evidence',true);
    const direct=Object.hasOwn(c,'sourceIdentity');
    if(direct){sourceIdentity(c.sourceIdentity,n,n);if(c.codeRefs!==undefined)issue('SOURCE_IDENTITY_MIXED',n.path,'Do not mix direct and legacy source proof.');}
    const refs=codeRefs(c.codeRefs,n,!!profile.code&&!direct);
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
      if(direct&&canonicalJSON(c.sourceIdentity)!==canonicalJSON(e.meta.sourceIdentity))issue('SOURCE_EVIDENCE_BINDING',n.path,'Every selected evidence record must bind the exact tested source identity and coverage.');
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
