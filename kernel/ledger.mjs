import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The product ledger is the canonical Work tree `<repo>/.starciwork/features/**\/index.yaml`
 * (work/node@2). This module is the only ledger API the workflow kernel uses: it reads the tree
 * through the shipped validator, selects the operations that may be scheduled, and writes back
 * exactly four things — `state`, `completion`, `extensions.work3.kernel` and an evidence manifest.
 * Every other authored line of an index.yaml is preserved byte for byte.
 */
export const DECISION_KINDS=['business','business-overview','architecture','brand'];
export const EXECUTABLE_KINDS=['implementation','uat','e2e','operations','ui','integration'];
export const KERNEL_EXTENSION=['extensions','work3','kernel'];
/** Where a record declares the outside systems it talks to. The list is data, never prose. */
export const INTEGRATION_EXTENSION=['extensions','work3','integrations'];
/** The node kind that carries one integration's live proof, one per declared integration. */
export const INTEGRATION_KIND='integration';
/**
 * The record kinds that may declare an integration: the business (SRS) and design (SDS) sides of a
 * feature, which are the two records an integration is derived from. An implementation node that names a
 * provider is not a declaration - it is code written against one a record already declared.
 */
export const INTEGRATION_DECLARING_KINDS=['business','business-overview','module','architecture'];
/** What an evidence manifest proved against: the product's own API, or the outside system itself. */
export const PROOF_BOUNDARIES=['api','live'];
/** A credential is the owner's. No other provider of one is a declaration the runtime will act on. */
export const CREDENTIAL_PROVIDER='owner';
/**
 * Where a credential lives, and the only place one may live: an encrypted identity resource of this Work tree.
 * `identity:<slug>` is `_resources/identity/<slug>/` - `resource.yaml` (the alias, the provider subject, the
 * role and the variable NAMES, never a value) beside `secrets.enc.yaml` (sops, the host's own key).
 *
 * An environment variable is not custody: it belongs to whichever terminal happened to export it, it is gone on
 * the next machine, and the tree cannot say who set it or when. `RESOURCE_ROOT` is where the tree keeps them.
 */
export const IDENTITY_CUSTODY=/^identity:[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;
export const IDENTITY_ROOT='_resources/identity';
export const IDENTITY_RESOURCE_SCHEMA='work/resource@1';
export const IDENTITY_SECRETS='secrets.enc.yaml';
/** The paths of one identity custody inside a Work tree, from its slug. */
export const identityPaths=slug=>({folder:`${IDENTITY_ROOT}/${slug}`,
  resource:`${IDENTITY_ROOT}/${slug}/resource.yaml`,secrets:`${IDENTITY_ROOT}/${slug}/${IDENTITY_SECRETS}`});
export const EVIDENCE_SCHEMA='work/evidence@1';
export const REVIEW_SCHEMA='starci/design-review@1';
export const HOST_BIN=new URL('../bin/starci.mjs',import.meta.url);
/** The directory a repository keeps its Work tree in, when the tree is its own. */
export const LEDGER_DIRECTORY='.starciwork';
/** The product's one brand record and the directory holding its masters, both at the tree root. */
export const BRAND_FILE='brand/index.yaml';
export const BRAND_ASSETS='brand/assets';
/** The two sides of a product an `implementation/<side>/**` layout names. */
export const LAYOUT_SIDES=['frontend','backend'];

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const slash=value=>String(value).replaceAll('\\','/').replace(/^\.\//,'');
const unique=values=>[...new Set(values)];
const nowIso=()=>new Date().toISOString();
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const HEX=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
/** work/node@2 ids allow letters, digits, dot, colon, dash and underscore-free separators only. */
export const sanitizeId=value=>{
  const cleaned=String(value).replace(/[^A-Za-z0-9._:-]+/g,'-').replace(/^[^A-Za-z0-9]+/,'');
  need(cleaned,`Cannot derive a Work id from ${value}`);
  return cleaned;
};

// ---------------------------------------------------------------------------- reading the ledger

function runValidator(workRoot){
  const result=spawnSync(process.execPath,[fileURLToPath(HOST_BIN),'validate',workRoot],{encoding:'utf8',windowsHide:true,maxBuffer:96*1024*1024});
  const out=(result.stdout??'').trim();
  need(out,`Work validator produced no output for ${workRoot}: ${(result.stderr??'').trim()||`exit ${result.status}`}`);
  try{return JSON.parse(out);}catch{throw Error(`Work validator did not print JSON for ${workRoot}`);}
}

/**
 * Where a ledger lives: the repository that owns it and the tree inside it. Every path helper below takes
 * this, as a plain repository root (the tree is then `<root>/.starciwork`) or as `{repoRoot,workRoot}` — which
 * is how a workflow in one repository works a ledger another repository owns.
 */
export function ledgerLocation(where){
  if(plain(where)){
    const root=path.resolve(text(where.repoRoot,'repository root'));
    return {repoRoot:root,workRoot:where.workRoot?path.resolve(where.workRoot):path.join(root,LEDGER_DIRECTORY)};
  }
  const root=path.resolve(text(where,'repository root'));
  return {repoRoot:root,workRoot:path.join(root,LEDGER_DIRECTORY)};
}

/**
 * The product's brand as the kernel reads it: `{node, rev, file, spec}`, or null when the tree authors
 * none. The validator projection names the record; the authored file is where the spec itself lives.
 */
function readBrand(at,list,summary){
  const node=list.find(item=>item.kind==='brand')??null;
  if(!node)return null;
  const file=nodeFile(at,node);
  let spec=null;
  try{
    const raw=parseYaml(fs.readFileSync(file,'utf8'));
    if(plain(raw)&&plain(raw.brand))spec=raw.brand;
  }catch{/* an unreadable or malformed brand is a validator finding, not a crash in the reader */}
  const revOf=value=>typeof value==='string'&&value.trim()?value.trim():null;
  return {node,rev:revOf(spec?.rev)??revOf(summary?.rev),file,spec};
}

/** Load the Work tree. `validate` is injectable so the kernel and the tests share one shape. */
export function loadLedger({repoRoot,workRoot=null,validate=null}={}){
  const at=ledgerLocation(repoRoot);
  const root=at.repoRoot;
  const work=workRoot?path.resolve(workRoot):at.workRoot;
  const raw=validate?validate({repoRoot:root,workRoot:work}):runValidator(work);
  need(plain(raw),'The Work validator result must be an object');
  const list=Array.isArray(raw.nodes)?raw.nodes.filter(node=>plain(node)&&typeof node.id==='string'):[];
  return {
    ok:raw.ok===true,
    errors:Array.isArray(raw.errors)?raw.errors:[],
    warnings:Array.isArray(raw.warnings)?raw.warnings:[],
    repoRoot:root,workRoot:work,at:{repoRoot:root,workRoot:work},
    nodes:new Map(list.map(node=>[node.id,node])),list,
    brand:readBrand({repoRoot:root,workRoot:work},list,plain(raw.brand)?raw.brand:null),
    resources:Array.isArray(raw.resources)?raw.resources:[]
  };
}

/**
 * Everything an operation has to be handed when its work touches the brand: the record itself, then every
 * master under `brand/assets/**`. Absolute paths, the record first, the masters sorted, symlinks skipped.
 * A tree with no brand record returns nothing rather than an empty promise of one.
 */
export function brandReferences(ledger){
  if(!plain(ledger?.brand))return [];
  const {workRoot}=ledgerLocation({repoRoot:ledger.repoRoot,workRoot:ledger.workRoot});
  const masters=[];
  const walk=dir=>{
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
    for(const entry of [...entries].sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(dir,entry.name);
      if(entry.isSymbolicLink())continue;
      if(entry.isDirectory())walk(file);
      else if(entry.isFile())masters.push(file);
    }
  };
  walk(path.join(workRoot,...BRAND_ASSETS.split('/')));
  return [ledger.brand.file,...masters.sort((a,b)=>a.localeCompare(b))];
}

/** Absolute path of a node's index.yaml. A node may carry an explicit `file` for out-of-tree reads. */
export function nodeFile(repoRoot,node){
  const {workRoot}=ledgerLocation(repoRoot);
  if(typeof node==='string')return path.join(workRoot,node);
  need(plain(node),'A Work node is required');
  if(node.file)return path.resolve(node.file);
  return path.join(workRoot,text(node.path,`path of node ${node.id}`));
}
export const nodeDirectory=(repoRoot,node)=>path.dirname(nodeFile(repoRoot,node));

/** Parse the authored node. The validator view is a projection; the file is the record. */
export function readNode(repoRoot,node){
  const file=nodeFile(repoRoot,node);
  const parsed=parseYaml(fs.readFileSync(file,'utf8'));
  need(plain(parsed),`Node ${file} is not a YAML mapping`);
  return parsed;
}

// ---------------------------------------------------------------------------- candidate selection

const scopeList=scope=>scope===null||scope===undefined?null:(Array.isArray(scope)?scope:[scope]).map(slash).filter(Boolean);
export const inScope=(node,scopes)=>{
  if(!scopes)return true;
  const id=String(node.id??''),nodePath=slash(node.path??'');
  return scopes.some(entry=>{
    const key=entry.replace(/\/+$/,'');
    return id===key||id.startsWith(`${key}.`)||nodePath===key||nodePath.startsWith(`${key}/`)||nodePath.startsWith(`features/${key}/`);
  });
};

/**
 * Files a node is allowed to touch: the union of implementation.changes[].files it authored and of
 * extensions.work3.allowlist (a list, or `{files:[...]}`), which is the only legal place for kinds that may
 * not carry an implementation payload (uat, operations, ui).
 */
export function nodeAllowlist(raw){
  const changes=Array.isArray(raw?.implementation?.changes)?raw.implementation.changes:[];
  const declared=raw?.extensions?.work3?.allowlist;
  const extra=Array.isArray(declared)?declared:Array.isArray(declared?.files)?declared.files:[];
  return unique([...changes.flatMap(change=>Array.isArray(change?.files)?change.files:[]),...extra].filter(file=>typeof file==='string'&&file.trim()).map(file=>slash(file.trim())));
}

/** The evidence record id for an operation: never the node id itself, which would be a duplicate stable id. */
export function evidenceIdFor(opId){return `${sanitizeId(text(opId,'operation id'))}-evidence`;}

/** A git remote as the validator wants an origin: a normalized credential-free https or ssh URL. */
export function normalizeOrigin(remote){
  const raw=String(remote??'').trim();
  if(!raw)return null;
  const scp=raw.match(/^([\w.-]+)@([\w.-]+):(.+)$/);
  const candidate=scp?`ssh://${scp[1]}@${scp[2]}/${scp[3]}`:raw;
  try{const url=new URL(candidate);if(!['https:','ssh:'].includes(url.protocol)||url.password||url.search||url.hash)return null;url.username=url.protocol==='ssh:'?url.username:'';return url.href;}catch{return null;}
}

/** Checks the kernel must re-run itself: extensions.work3.checks entries. */
export function nodeChecks(raw){
  const checks=raw?.extensions?.work3?.checks;
  if(!Array.isArray(checks))return [];
  return checks.filter(plain).filter(check=>typeof check.command==='string'&&check.command.trim()).map(check=>({
    assertion:typeof check.assertion==='string'&&check.assertion.trim()?check.assertion.trim():null,
    command:check.command.trim(),
    scope:typeof check.scope==='string'&&check.scope.trim()?check.scope.trim():null,
    note:typeof check.note==='string'&&check.note.trim()?check.note.trim():null
  }));
}

/** The repository a node says it is delivered in (`extensions.work3.scope.repository`), or null when it names none. */
export function nodeRepository(raw){
  const declared=raw?.extensions?.work3?.scope?.repository;
  return typeof declared==='string'&&declared.trim()?sanitizeId(declared.trim()):null;
}

/**
 * Where a node sits inside its feature: `implementation/frontend/receipt` for
 * `features/sales/implementation/frontend/receipt/index.yaml`. A node outside `features/<feature>/` keeps its
 * whole directory path, so the layout is always the authored shape and never a guess about the id.
 */
export function layoutOf(node){
  const file=slash(typeof node==='string'?node:node?.path??'');
  const parts=file.replace(/\/index\.ya?ml$/,'').replace(/\/+$/,'').split('/').filter(Boolean);
  return (parts[0]==='features'&&parts.length>2?parts.slice(2):parts).join('/');
}
/** The side of the product a layout claims: `implementation/frontend/**` is frontend work, `implementation/backend/**` backend. */
export function layoutSide(node){
  const parts=layoutOf(node).split('/');
  return parts[0]==='implementation'&&LAYOUT_SIDES.includes(parts[1])?parts[1]:null;
}

function enrich(ledger,node){
  const raw=readNode(ledger.at??ledger.repoRoot,node);
  const allowlist=nodeAllowlist(raw),checks=nodeChecks(raw);
  const assertions=Array.isArray(raw.assertions)?raw.assertions.filter(item=>typeof item==='string'):[];
  const missing=[];
  if(!allowlist.length)missing.push('implementation.changes[].files');
  if(!checks.length)missing.push('extensions.work3.checks');
  const declaredResources=raw?.extensions?.work3?.resources;
  const resources=Array.isArray(declaredResources)?declaredResources.filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim()):[];
  return {...node,file:nodeFile(ledger.at??ledger.repoRoot,node),repository:nodeRepository(raw),layout:layoutOf(node),side:layoutSide(node),resources,
    allowlist,checks,assertions,schedulable:missing.length===0,reason:missing.length?`Node ${node.id} declares no ${missing.join(' and no ')}; the kernel cannot launch it`:null};
}

/**
 * Executable work the kernel may consider now: an executable kind, authored todo, and unblocked by
 * the validator. A candidate without an allowlist or without checks is returned with
 * `schedulable:false` and a reason; the kernel must refuse to launch it rather than guess a scope.
 *
 * `repository` and `side` are the two ways a node belongs to a job. A node that names its repository is
 * delivered there and nowhere else. A node that names none is claimed by the side of the product its layout
 * sits in, so a backend workflow never picks up `implementation/frontend/**` and a frontend workflow never
 * picks up `implementation/backend/**` — which is what lets both work one shared tree.
 */
export function executableCandidates(ledger,{scope=null,repository=null,side=null}={}){
  const scopes=scopeList(scope);
  need(!side||LAYOUT_SIDES.includes(side),`A layout side is ${LAYOUT_SIDES.join(' or ')}: ${side}`);
  return ledger.list
    .filter(node=>EXECUTABLE_KINDS.includes(node.kind)&&node.state==='todo'&&node.eligible===true&&inScope(node,scopes))
    .map(node=>enrich(ledger,node))
    .filter(node=>node.repository
      ?(!repository||node.repository===repository)
      :(!side||!node.side||node.side===side));
}

/** Decision work: a model or the user answers it; nothing is launched into a worktree. */
export function decisionCandidates(ledger,{scope=null}={}){
  const scopes=scopeList(scope);
  return ledger.list.filter(node=>DECISION_KINDS.includes(node.kind)&&node.state==='todo'&&node.eligible===true&&inScope(node,scopes));
}

/** A glob narrows to its literal directory prefix, so `x/**` and `x/*.ts` both guard `x/`. */
const allowKey=entry=>{
  const value=slash(entry).replace(/^\/+/,'');
  const star=value.indexOf('*');
  if(star<0)return value;
  const cut=value.lastIndexOf('/',star);
  return cut<0?'':`${value.slice(0,cut)}/`;
};
const covers=(a,b)=>a===b||b.startsWith(a.endsWith('/')?a:`${a}/`);

/** True when no file in `aFiles` can be written by an operation holding `bFiles` (prefix semantics). */
export function disjoint(aFiles,bFiles){
  const left=(aFiles??[]).map(allowKey).filter(Boolean),right=(bFiles??[]).map(allowKey).filter(Boolean);
  if(!left.length||!right.length)return true;
  return !left.some(a=>right.some(b=>covers(a,b)||covers(b,a)));
}

// ---------------------------------------------------------------------------- the line-level editor

const LINE_SPLIT=/(?<=\n)/;
const RESERVED=new Set(['true','false','null','yes','no','on','off','~','y','n']);
const body=line=>line.replace(/\r?\n$/,'');
const indentOf=line=>/^ */.exec(line)[0].length;
const numberish=value=>/^[0-9]/.test(value)&&!Number.isNaN(Number(value));
const plainSafe=value=>value.length>0&&/^[A-Za-z0-9][A-Za-z0-9 ._\-/@+=]*$/.test(value)&&!/ $/.test(value)&&!RESERVED.has(value.toLowerCase())&&!numberish(value);
const scalar=value=>{
  if(typeof value==='boolean'||typeof value==='number')return String(value);
  const value_=String(value);
  return plainSafe(value_)?value_:JSON.stringify(value_);
};
const entriesOf=value=>Object.entries(value).filter(([,item])=>item!==null&&item!==undefined);

/** Emit one mapping entry as YAML lines: 2-space indentation, plain scalars, quoted when unsafe. */
function emitLines(key,value,indent){
  const pad=' '.repeat(indent);
  if(Array.isArray(value)){
    if(!value.length)return [`${pad}${key}: []`];
    const out=[`${pad}${key}:`];
    for(const item of value){
      if(Array.isArray(item))throw Error('Nested sequences are not emitted by the kernel editor');
      if(!plain(item)){out.push(`${pad}  - ${scalar(item)}`);continue;}
      const entries=entriesOf(item);
      if(!entries.length){out.push(`${pad}  - {}`);continue;}
      const first=emitLines(entries[0][0],entries[0][1],indent+4);
      out.push(`${pad}  - ${first[0].slice(indent+4)}`,...first.slice(1));
      for(const [name,item_] of entries.slice(1))out.push(...emitLines(name,item_,indent+4));
    }
    return out;
  }
  if(plain(value)){
    const entries=entriesOf(value);
    if(!entries.length)return [`${pad}${key}: {}`];
    return [`${pad}${key}:`,...entries.flatMap(([name,item])=>emitLines(name,item,indent+2))];
  }
  return [`${pad}${key}: ${scalar(value)}`];
}
const emitNested=(keys,value,indent)=>keys.length===1?emitLines(keys[0],value,indent):[`${' '.repeat(indent)}${keys[0]}:`,...emitNested(keys.slice(1),value,indent+2)];
/** Serialize a whole document; used for the evidence manifest, which the kernel owns outright. */
export const emitDocument=value=>entriesOf(value).flatMap(([key,item])=>emitLines(key,item,0)).join('\n').concat('\n');

function keyMatch(line,key,indent){
  if(indentOf(line)!==indent||line.length<=indent)return null;
  const rest=line.slice(indent);
  if(!rest.startsWith(`${key}:`))return null;
  const after=rest.slice(key.length+1);
  if(after&&!after.startsWith(' '))return null;
  return {inline:after.trim()};
}

/** Find a block by exact indentation: it runs until the next non-blank line that dedents out of it. */
function findBlock(lines,key,indent,from,to){
  for(let index=from;index<to;index+=1){
    const hit=keyMatch(body(lines[index]),key,indent);
    if(!hit)continue;
    let end=index;
    for(let probe=index+1;probe<to;probe+=1){
      const line=body(lines[probe]);
      if(!line.trim())continue;
      const depth=indentOf(line);
      if(depth>indent||(depth===indent&&line.slice(indent).startsWith('- '))){end=probe;continue;}
      break;
    }
    return {start:index,end,inline:hit.inline};
  }
  return null;
}

function childIndentOf(lines,block,indent){
  for(let probe=block.start+1;probe<=block.end;probe+=1){
    const line=body(lines[probe]);
    if(line.trim())return indentOf(line);
  }
  return indent+2;
}

function upsert(lines,keys,value,eol,indent=0,from=0,to=lines.length){
  const [key,...rest]=keys;
  const block=findBlock(lines,key,indent,from,to);
  const emit=chunk=>chunk.map(line=>`${line}${eol}`);
  if(!block){
    if(to>0&&!/\n$/.test(lines[to-1]))lines[to-1]=`${lines[to-1]}${eol}`;
    lines.splice(to,0,...emit(emitNested(keys,value,indent)));
    return;
  }
  if(block.inline&&block.inline!=='{}')throw Error(`Cannot edit ${key}: its value is inline (${block.inline.slice(0,40)})`);
  if(!rest.length){
    lines.splice(block.start,block.end-block.start+1,...emit(emitLines(key,value,indent)));
    return;
  }
  if(block.inline==='{}'){
    lines[block.start]=`${' '.repeat(indent)}${key}:${eol}`;
    lines.splice(block.start+1,0,...emit(emitNested(rest,value,indent+2)));
    return;
  }
  const child=childIndentOf(lines,block,indent);
  need(child>indent,`Cannot edit ${key}: unsupported child layout`);
  upsert(lines,rest,value,eol,child,block.start+1,block.end+1);
}

/** Replace the value of a top-level scalar, inserting it after the node header when absent. */
function setScalar(lines,key,value,eol){
  const block=findBlock(lines,key,0,0,lines.length);
  if(block){lines.splice(block.start,block.end-block.start+1,`${key}: ${scalar(value)}${eol}`);return;}
  let at=0;
  for(let index=0;index<lines.length;index+=1){
    const line=body(lines[index]);
    if(['schema','id','kind','required'].some(header=>keyMatch(line,header,0)))at=index+1;
  }
  if(at>0&&!/\n$/.test(lines[at-1]))lines[at-1]=`${lines[at-1]}${eol}`;
  lines.splice(at,0,`${key}: ${scalar(value)}${eol}`);
}

/** Apply the only edits the kernel owns. Every untouched line keeps its exact original bytes. */
export function applyEdits(source,{state=null,completion=null,kernel=null}={}){
  const lines=source.split(LINE_SPLIT);
  const eol=/\r\n$/.test(lines[0]??'')?'\r\n':'\n';
  if(state!==null)setScalar(lines,'state',state,eol);
  if(completion!==null)upsert(lines,['completion'],completion,eol);
  if(kernel!==null)upsert(lines,KERNEL_EXTENSION,kernel,eol);
  return lines.join('');
}

const contains=(actual,expected)=>{
  if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((item,index)=>contains(actual[index],item));
  if(plain(expected))return plain(actual)&&entriesOf(expected).every(([key,item])=>contains(actual[key],item));
  return actual===expected||String(actual)===String(expected);
};

/**
 * Write one node edit. The file is re-parsed and the intended fields asserted; on any failure the
 * original bytes are restored and the call throws, so a half-written ledger never survives.
 * `parse` is injectable only so the restore path itself can be tested.
 */
export function writeNode(repoRoot,node,{state=null,completion=null,kernel=null,parse=parseYaml}={}){
  const file=nodeFile(repoRoot,node);
  const original=fs.readFileSync(file);
  const updated=applyEdits(original.toString('utf8'),{state,completion,kernel});
  fs.writeFileSync(file,updated);
  try{
    const parsed=parse(fs.readFileSync(file,'utf8'));
    need(plain(parsed),'The rewritten node is not a YAML mapping');
    if(state!==null)need(parsed.state===state,`state did not round-trip as ${state}`);
    if(completion!==null)need(contains(parsed.completion,completion),'completion did not round-trip');
    if(kernel!==null)need(contains(parsed.extensions?.work3?.kernel,kernel),'extensions.work3.kernel did not round-trip');
  }catch(error){
    fs.writeFileSync(file,original);
    throw Error(`Refused the ledger write to ${slash(file)} and restored the original: ${error.message}`);
  }
  return {file,state,completion,kernel,changed:updated!==original.toString('utf8')};
}

// ---------------------------------------------------------------------------- state transitions

const existingKernel=(repoRoot,node)=>{
  const raw=readNode(repoRoot,node);
  const kernel=raw.extensions?.work3?.kernel;
  return {raw,kernel:plain(kernel)?kernel:{}};
};
const HEX64=/^[a-f0-9]{64}$/;

/**
 * `state` and `completion` are operational fields and stay out of the semantic digest, but
 * `extensions` does not: writing the kernel block changes the node's inputDigest. So every
 * transition writes the kernel block first, reads the settled digest, and only then binds
 * completion — otherwise the validator answers STALE_COMPLETION on the receipt we just wrote.
 * Pass `inputDigest` (or a `digest` resolver) to avoid a second validator run.
 */
function settledDigest(repoRoot,node,{inputDigest=null,digest=null}){
  if(inputDigest){need(HEX64.test(inputDigest),'inputDigest must be a lowercase sha-256');return inputDigest;}
  if(typeof digest==='function'){
    const resolved=digest({repoRoot,node});
    need(typeof resolved==='string'&&HEX64.test(resolved),`The digest resolver returned no sha-256 for ${node.id}`);
    return resolved;
  }
  const fresh=loadLedger({repoRoot}).nodes.get(node.id)?.inputDigest;
  need(typeof fresh==='string'&&HEX64.test(fresh),`The Work validator reports no inputDigest for ${node.id}; pass inputDigest explicitly`);
  return fresh;
}
/** Two writes, one outcome: any failure restores the node's original bytes and undoes side effects. */
function transact(repoRoot,node,steps){
  const file=nodeFile(repoRoot,node);
  const original=fs.readFileSync(file);
  const undo=[];
  try{return steps(task=>undo.push(task));}
  catch(error){
    fs.writeFileSync(file,original);
    for(const task of undo.reverse())try{task();}catch{/* best effort: the node bytes are what matter */}
    throw error;
  }
}
const checkList=checks=>{
  need(Array.isArray(checks)&&checks.length,'done requires at least one check the kernel ran');
  const verified=checks.map(check=>{
    need(plain(check)&&typeof check.name==='string'&&typeof check.command==='string'&&Number.isInteger(check.exitCode),'Each check needs name, command and an integer exitCode');
    return {name:check.name,command:check.command,exitCode:check.exitCode,...(check.assertion?{assertion:String(check.assertion)}:{})};
  });
  need(verified.every(check=>check.exitCode===0),'done cannot carry a failing check');
  return verified;
};
/** Assertion ids a passing check set proves: its declared `assertion`, else the check name. */
export const checkAssertions=checks=>unique((checks??[]).filter(check=>plain(check)&&check.exitCode===0).map(check=>String(check.assertion??check.name)));
function coverAssertions(raw,checks,assertions){
  const required=(Array.isArray(raw.assertions)?raw.assertions:[]).map(String);
  const covered=new Set(assertions?assertions.map(item=>String(plain(item)?item.id:item)):checkAssertions(checks));
  const missing=required.filter(id=>!covered.has(id));
  need(!missing.length,`Cannot mark ${raw.id} done: no passing check proves ${missing.join(', ')}. Declare the assertion on a check in extensions.work3.checks or pass explicit assertions.`);
  return required;
}
/** Direct source identity for an implementation node; `origin` must be a credential-free URL. */
export function buildSourceIdentity({repository,origin,commit,paths=[],dependencyCoverage='Dependencies were not re-verified by this operation.',limitations=[]}){
  need(HEX.test(String(commit??'')),'A source identity needs a full commit sha');
  // Coverage names source files, normalized the way the validator wants: no trailing slash, no empty segment, no
  // ledger record (the tree is the kernel's, never the slice's source) - an allowlist entry that is not a source path is dropped.
  const scoped=paths.filter(item=>typeof item==='string'&&item.trim()).map(item=>slash(item.trim()).replace(/\/+$/,''))
    .filter(item=>item&&!item.startsWith('/')&&!/(^|\/)\.starciwork(\/|$)/.test(item)&&!/(^|\/)_local(\/|$)/.test(item)&&item.split('/').every(segment=>segment&&segment!=='.'&&segment!=='..'));
  return {schema:'starci/source-identity@1',repositories:[{
    repository:sanitizeId(repository),origin:text(origin,'repository origin url'),state:'committed',commit:String(commit),
    coverage:scoped.length
      ?{kind:'scoped',paths:unique(scoped),dependencyCoverage,limitations:limitations.length?limitations:['Only the operation allowlist was verified.']}
      :{kind:'full-tree',paths:[],dependencyCoverage,limitations}
  }]};
}
/** Only a code-bearing profile (implementation, release) binds its source; any other kind binds nothing, or the validator refuses it. */
const sourceBinding=(repository,head,sourceIdentity,bindSource=true)=>!bindSource?{}:sourceIdentity
  ?{sourceIdentity}
  :(HEX.test(String(head??''))?{codeRefs:[{repository,commit:String(head)}]}:{});

/**
 * An operation was launched for this node. Work v2 authors exactly uninvestigate, todo and done, so
 * in-flight is not a ledger state: the launch is recorded in the kernel block and `state` stays todo
 * until the kernel has proof. Nothing else about the node changes.
 */
export function markInProgress(repoRoot,node,{opId,dispatch=null,startedAt=null,parse=parseYaml}={}){
  const id=text(opId,'operation id'),{kernel}=existingKernel(repoRoot,node);
  return writeNode(repoRoot,node,{kernel:{...kernel,opId:id,dispatch:dispatch?text(dispatch,'dispatch id'):kernel.dispatch??null,head:null,checks:null,verifiedBy:null,at:startedAt??nowIso()},parse});
}

/**
 * The kernel re-ran the checks itself and accepted the slice. It refuses to write done when the
 * node's authored assertions are not all proven by a passing check, so a green receipt always
 * names what proved it.
 */
export function markDone(repoRoot,node,{opId,head=null,checks=[],verifiedBy='starci-kernel',at=null,repository=null,assertions=null,sourceIdentity=null,evidence=null,inputDigest=null,digest=null,bindSource=true,contractDigest=null,contractKind=null,proof=null,provisional=[],parse=parseYaml}={}){
  const id=text(opId,'operation id'),evidenceId=evidenceIdFor(id);
  // A proof remembers the rules it was proven under: the digest of the kind's declaration travels into the
  // kernel block, so a node completed under a rule that has since moved is reopened rather than trusted.
  const boundRules=contractDigest===null||contractDigest===undefined?null:String(contractDigest).trim();
  need(boundRules===null||HEX64.test(boundRules),'contractDigest must be a lowercase sha-256 of the kind declaration');
  // A proof also remembers which decisions it rests on that the OWNER has not taken yet. An overturned
  // provisional decision finds every node that lists it and reopens exactly those, and nothing else.
  const open=[...new Set((Array.isArray(provisional)?provisional:[]).map(id=>String(id).trim()).filter(Boolean))];
  return transact(repoRoot,node,register=>{
    const {raw,kernel}=existingKernel(repoRoot,node);
    const verified=checkList(checks);
    coverAssertions(raw,verified,assertions);
    const repo=repository?sanitizeId(repository):repositoryName(repoRoot);
    writeNode(repoRoot,node,{kernel:{...kernel,opId:id,head:head??null,checks:verified,verifiedBy:text(verifiedBy,'verifier'),at:at??nowIso(),...(boundRules?{contractDigest:boundRules,...(typeof contractKind==='string'&&contractKind.trim()?{contractKind:contractKind.trim()}:{})}:{}),...(open.length?{provisional:open}:{})},parse});
    const bound=settledDigest(repoRoot,node,{inputDigest,digest});
    // The manifest has to bind the same settled digest, so write it here rather than before pass one.
    const folder=path.join(nodeDirectory(repoRoot,node),'evidence',evidenceId),fresh=evidence&&!fs.existsSync(folder);
    const written=evidence?writeEvidence(repoRoot,node,{...(plain(evidence)?evidence:{}),opId:id,head,checks,repository:repo,assertions,sourceIdentity:bindSource?sourceIdentity:null,bindSource,inputDigest:bound,...(proof?{proof}:{})}):null;
    if(fresh)register(()=>fs.rmSync(folder,{recursive:true,force:true}));
    const completion={inputDigest:bound,evidence:[evidenceId],...sourceBinding(repo,head,sourceIdentity,bindSource)};
    return {...writeNode(repoRoot,node,{state:'done',completion,parse}),evidence:written};
  });
}

/** Accepted work became wrong again: the node returns to todo, its stored proof is kept as history. */
export function markReopened(repoRoot,node,{reason,by='starci-kernel',at=null,parse=parseYaml}={}){
  const {kernel}=existingKernel(repoRoot,node);
  const entry={reason:text(reason,'reopen reason'),by:text(by,'reopening actor'),at:at??nowIso()};
  const reopened=[...(Array.isArray(kernel.reopened)?kernel.reopened:[]),entry];
  return writeNode(repoRoot,node,{state:'todo',kernel:{...kernel,reopened},parse});
}

/**
 * A decision node is settled by a collocated review, never by an execution receipt. Every authored
 * assertion needs exactly one passing observation and no observation may invent an id.
 */
export function markDecided(repoRoot,node,{rev=null,review,by='starci-kernel',at=null,inputDigest=null,digest=null,parse=parseYaml}={}){
  need(plain(review),'A decision needs a review payload');
  return transact(repoRoot,node,()=>{
    const {raw,kernel}=existingKernel(repoRoot,node);
    const required=(Array.isArray(raw.assertions)?raw.assertions:[]).map(String),seen=new Set();
    const observations=(Array.isArray(review.observations)?review.observations:[]).map(item=>{
      need(plain(item)&&typeof item.id==='string'&&typeof item.observation==='string','Each review observation needs id and observation');
      const id=String(item.id);
      need(!required.length||required.includes(id),`Review observation ${id} is not an authored assertion of ${raw.id}`);
      need(!seen.has(id),`Review observation ${id} is declared twice`);
      seen.add(id);
      return {id,outcome:item.outcome??'pass',observation:item.observation};
    });
    need(observations.length,'A decision review needs at least one observation');
    const missing=required.filter(id=>!seen.has(id));
    need(!missing.length,`Cannot decide ${raw.id}: no passing observation for ${missing.join(', ')}`);
    const when=at??nowIso();
    writeNode(repoRoot,node,{kernel:{...kernel,rev:rev??null,verifiedBy:text(by,'deciding actor'),at:when,head:null,checks:null},parse});
    const completion={inputDigest:settledDigest(repoRoot,node,{inputDigest,digest}),review:{
      schema:REVIEW_SCHEMA,
      reviewer:text(review.reviewer??by,'reviewer'),
      authority:text(review.authority??by,'review authority'),
      reviewedAt:review.reviewedAt??when,
      observations,
      limitations:(Array.isArray(review.limitations)?review.limitations:[]).filter(item=>typeof item==='string'&&item.trim())
    }};
    return writeNode(repoRoot,node,{state:'done',completion,parse});
  });
}

// ---------------------------------------------------------------------------- evidence

export function repositoryName(repoRoot){
  const root=ledgerLocation(repoRoot).repoRoot;
  const manifest=path.join(root,'package.json');
  if(fs.existsSync(manifest)){
    try{
      const name=JSON.parse(fs.readFileSync(manifest,'utf8')).name;
      if(typeof name==='string'&&name.trim())return sanitizeId(name.replace(/^@/,'').replaceAll('/','-'));
    }catch{/* a malformed manifest is not the ledger's problem */}
  }
  return sanitizeId(path.basename(root));
}

/**
 * Write `<node dir>/evidence/<opId>-evidence/manifest.yaml` as a work/evidence@1 record. The id is the
 * sanitized operation id plus `-evidence` (an op named after its node must not duplicate the node id), which is also what markDone lists in `completion.evidence`, and the
 * record binds the node by digest so stale proof cannot be reused.
 */
export function writeEvidence(repoRoot,node,evidence={}){
  const id=evidenceIdFor(evidence.opId);
  const raw=readNode(repoRoot,node);
  const repository=evidence.repository?sanitizeId(evidence.repository):repositoryName(repoRoot);
  const head=evidence.head??null;
  const checks=(Array.isArray(evidence.checks)?evidence.checks:[]).filter(plain);
  const failed=checks.some(check=>check.exitCode!==0);
  const assertions=(Array.isArray(evidence.assertions)&&evidence.assertions.length
    ?evidence.assertions.map(item=>({id:String(item.id),outcome:item.outcome??'pass',observation:String(item.observation),...(item.kind?{kind:String(item.kind)}:{})}))
    :checks.map(check=>({id:String(check.assertion??check.name??check.command),outcome:check.exitCode===0?'pass':'fail',observation:`${check.command} exited ${check.exitCode}`})));
  const directory=path.join(nodeDirectory(repoRoot,node),'evidence',id);
  fs.mkdirSync(directory,{recursive:true});
  const assets=(Array.isArray(evidence.assets)?evidence.assets:[]).filter(plain).map(asset=>{
    const relative=slash(text(asset.path,'asset path'));
    const sha=asset.sha256??(fs.existsSync(path.join(directory,relative))?sha256(fs.readFileSync(path.join(directory,relative))):null);
    need(sha,`Asset ${relative} has no sha256 and no file under ${slash(directory)}`);
    return {path:relative,sha256:sha,...(asset.scope?{scope:asset.scope}:{})};
  });
  const proof=readProof(evidence.proof);
  const bound=settledDigest(repoRoot,node,{inputDigest:evidence.inputDigest??null,digest:evidence.digest??null});
  // `nodeId` + `inputDigest` already bind the primary node; repeating it in `bindings` is a
  // DUPLICATE_EVIDENCE_BINDING, so only extra nodes this record also proves belong there.
  const extra=(Array.isArray(evidence.bindings)?evidence.bindings:[]).filter(plain).filter(item=>item.nodeId!==(node.id??raw.id)).map(item=>({nodeId:String(item.nodeId),inputDigest:String(item.inputDigest)}));
  const manifest={
    schema:EVIDENCE_SCHEMA,id,nodeId:text(node.id??raw.id,'node id'),inputDigest:bound,
    ...(extra.length?{bindings:extra}:{}),
    outcome:evidence.outcome??(failed?'fail':'pass'),
    assertions,assets,
    ...(proof?{proof}:{}),
    provenance:{
      environment:sanitizeId(evidence.environment??'local'),
      actor:sanitizeId(evidence.actor??'starci-kernel'),
      servedVersions:[{repository,commit:HEX.test(String(head??''))?String(head):'0'.repeat(40),artifact:evidence.artifact??'worktree'}],
      tool:evidence.tool??'starci-kernel',
      capturedAt:evidence.capturedAt??nowIso(),
      servedVersionEvidence:evidence.servedVersionEvidence??`Kernel-run checks on ${repository}@${head??'worktree'}`
    },
    ...(evidence.bindSource===false?{}:evidence.sourceIdentity?{sourceIdentity:evidence.sourceIdentity}:(HEX.test(String(head??''))?{codeRefs:[{repository,commit:String(head)}]}:{})),
    ...(checks.length?{extensions:{work3:{kernel:{checks:checks.map(check=>({name:String(check.name??''),command:String(check.command??''),exitCode:Number(check.exitCode)}))}}}}:{})
  };
  const file=path.join(directory,'manifest.yaml');
  const body_=emitDocument(manifest);
  fs.writeFileSync(file,body_);
  const parsed=(evidence.parse??parseYaml)(body_);
  need(contains(parsed,{schema:EVIDENCE_SCHEMA,id,nodeId:manifest.nodeId,outcome:manifest.outcome,inputDigest:bound,...(proof?{proof}:{})}),`The evidence manifest for ${id} did not round-trip`);
  return file;
}

/**
 * What an evidence record says it proved against. `boundary` is required once a proof is given at all,
 * because "unspecified" is the state that let four faked channels read as verified; `fakes` defaults to the
 * empty list, which is the only honest default for a record that names none.
 */
function readProof(value){
  if(value===null||value===undefined)return null;
  need(plain(value),'An evidence proof is {boundary, fakes}');
  const boundary=text(value.boundary,'evidence proof boundary');
  need(PROOF_BOUNDARIES.includes(boundary),`An evidence proof boundary is ${PROOF_BOUNDARIES.join(' or ')}: ${boundary}`);
  const fakes=Array.isArray(value.fakes)?value.fakes:value.fakes===null||value.fakes===undefined?[]:null;
  need(fakes,'An evidence proof lists its fakes as provider ids');
  return {boundary,fakes:unique(fakes.map(item=>text(item,'faked provider id')))};
}

// ---------------------------------------------------------------------------- external integrations

/**
 * An external integration is proven live, or it is not proven. Four `e2e.verify` operations once reported
 * four chatbot delivery nodes verified without ever asking the owner for a credential, because a faked
 * channel was inside their contract and nothing in the tree said otherwise. These functions are what makes
 * that impossible to repeat: the integration is a declared record, its node is required, and every proof
 * says what it was proven against.
 */

/** Read a whole Work tree without the validator: the bounded filesystem read a status view can afford. */
export const LEDGER_SCAN_LIMIT=4000;

/**
 * The tree as files, for a reader that must not spawn the validator (the status view). It answers the same
 * `{at, list, nodes}` shape the integration functions below read, with `file` on every node, and stops at
 * `limit` records so a pathological tree cannot hang a status page. A path that is not a tree answers null.
 */
export function readLedgerTree(workRoot,{limit=LEDGER_SCAN_LIMIT}={}){
  const root=path.resolve(text(workRoot,'work tree root'));
  let stat;
  try{stat=fs.statSync(root);}catch{return null;}
  if(!stat.isDirectory())return null;
  const list=[];
  const walk=dir=>{
    if(list.length>=limit)return;
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
    for(const entry of [...entries].sort((a,b)=>a.name.localeCompare(b.name))){
      if(list.length>=limit)return;
      if(entry.isSymbolicLink())continue;
      const file=path.join(dir,entry.name);
      // `_local` is execution state and `assets` is payload; neither holds a Work node, and both can be large.
      if(entry.isDirectory()){if(!['_local','assets','node_modules','.git'].includes(entry.name))walk(file);continue;}
      if(entry.name!=='index.yaml')continue;
      let raw;
      try{raw=parseYaml(fs.readFileSync(file,'utf8'));}catch{continue;}
      if(!plain(raw)||typeof raw.id!=='string'||!raw.id.trim())continue;
      list.push({id:raw.id.trim(),kind:typeof raw.kind==='string'?raw.kind:null,state:typeof raw.state==='string'?raw.state:null,
        path:slash(path.relative(root,file)),file});
    }
  };
  walk(root);
  const repoRoot=path.dirname(root);
  return {at:{repoRoot,workRoot:root},repoRoot,workRoot:root,list,nodes:new Map(list.map(node=>[node.id,node])),bounded:list.length>=limit};
}

const treeAt=ledger=>ledger?.at??ledger?.repoRoot;
const trimmed=value=>typeof value==='string'&&value.trim()?value.trim():null;
/** A record the reader cannot parse is a validator finding, not a crash in a status view. */
function tryReadNode(ledger,node){try{return readNode(treeAt(ledger),node);}catch{return null;}}

/**
 * The integrations a tree declares, as `{id, provider, credential:{name, providedBy, custody, slug, where}, sandbox?,
 * declaredBy}` under `list`, and every shape defect under `problems`. An entry the runtime cannot act on -
 * no credential name, or a credential somebody other than the owner provides - is a finding rather than a
 * silent skip, because that is exactly the declaration a faked proof hides behind. An entry with an id is
 * still listed even when its credential is a finding, so the tree still owes it an `integration` node.
 */
export function declaredIntegrations(ledger){
  const list=[],problems=[];
  const fault=(declaredBy,id,code,detail)=>problems.push({code,id:id??null,declaredBy,detail});
  for(const node of (ledger?.list??[]).filter(item=>INTEGRATION_DECLARING_KINDS.includes(item.kind))){
    const raw=tryReadNode(ledger,node);
    const declared=raw?.extensions?.work3?.integrations;
    if(declared===null||declared===undefined)continue;
    if(!Array.isArray(declared)){fault(node.id,null,'integration-shape','extensions.work3.integrations must be a list of declarations');continue;}
    for(const entry of declared){
      if(!plain(entry)){fault(node.id,null,'integration-shape','each declared integration is a mapping of id, provider and credential');continue;}
      const id=typeof entry.id==='string'&&entry.id.trim()?entry.id.trim():null;
      const provider=typeof entry.provider==='string'&&entry.provider.trim()?entry.provider.trim():null;
      if(!id){fault(node.id,null,'integration-shape','a declared integration needs an id the integration node is named after');continue;}
      if(!provider)fault(node.id,id,'integration-shape','a declared integration names the outside system it talks to');
      const credential=plain(entry.credential)?entry.credential:null;
      const name=typeof credential?.name==='string'&&credential.name.trim()?credential.name.trim():null;
      const providedBy=typeof credential?.providedBy==='string'&&credential.providedBy.trim()?credential.providedBy.trim():null;
      // Custody, not a place. An environment variable is nobody's: it is lost across machines and terminals and
      // the tree cannot say who set it. A credential lives in an encrypted identity resource of the Work tree
      // (`identity:<slug>` -> `_resources/identity/<slug>/secrets.enc.yaml`, sops), and the declaration names
      // that custody. `where` is the 5.1 spelling and is still read, as a deprecation, so an older tree is told
      // what to change rather than failing on a rule it predates.
      const custody=typeof credential?.custody==='string'&&credential.custody.trim()?credential.custody.trim():null;
      const where=typeof credential?.where==='string'&&credential.where.trim()?credential.where.trim():null;
      if(!name)fault(node.id,id,'credential-missing',`integration ${id} declares no credential name; the exact variable is what the owner is asked for`);
      else if(providedBy!==CREDENTIAL_PROVIDER)fault(node.id,id,'credential-not-owner',`integration ${id} says its credential is provided by ${providedBy??'nobody'}; a credential is the owner's`);
      if(name&&!custody)fault(node.id,id,'credential-custody-missing',
        `integration ${id} names no credential custody; declare \`custody: identity:<slug>\` - the encrypted identity resource of this tree that holds ${name}${where?` (it still carries the retired \`where: ${where}\`, which names a place, not a custody)`:''}`);
      else if(custody&&!IDENTITY_CUSTODY.test(custody))fault(node.id,id,'credential-custody-missing',
        `integration ${id} declares custody ${custody}; the only custody a credential has is \`identity:<slug>\` of this tree`);
      list.push({id,provider,declaredBy:node.id,declaredPath:node.path,
        ...(plain(entry.preparation)?{preparation:entry.preparation}:{}),
        credential:{name,providedBy:providedBy??null,custody,
          slug:custody&&IDENTITY_CUSTODY.test(custody)?custody.slice('identity:'.length):null,where},
        ...(typeof entry.sandbox==='string'&&entry.sandbox.trim()?{sandbox:entry.sandbox.trim()}:{})});
    }
  }
  return {list,problems};
}

/** The integration id a node proves: `features/<f>/integration/<id>/index.yaml` names it in its layout. */
export function integrationIdOf(node){
  const parts=layoutOf(node).split('/').filter(Boolean);
  if(parts[0]==='integration'&&parts.length>1)return parts.slice(1).join('/');
  return null;
}

/** The nodes that carry an integration proof; one per declared integration is what the tree owes. */
export function integrationNodes(ledger){return (ledger?.list??[]).filter(node=>node.kind===INTEGRATION_KIND);}

/** A node proves an integration when its layout names it, or when the tail of its id does. */
const provesIntegration=(node,id)=>integrationIdOf(node)===id||String(node.id??'').split('.').at(-1)===id;

/**
 * The declared ids the tree holds no `integration` node for. The kernel lists them as `ledger incomplete`
 * and closes them with `work.author`: an integration nobody has to prove is an integration nobody proves.
 */
export function missingIntegrationNodes(ledger){
  const nodes=integrationNodes(ledger);
  return unique(declaredIntegrations(ledger).list.map(item=>item.id)).filter(id=>!nodes.some(node=>provesIntegration(node,id)));
}

/** Every evidence manifest under the tree's nodes, with what it says it proved against. */
function evidenceManifests(ledger){
  const at=treeAt(ledger);
  const out=[];
  for(const node of ledger?.list??[]){
    let folders;
    let directory;
    try{directory=path.join(nodeDirectory(at,node),'evidence');}catch{continue;}
    try{folders=fs.readdirSync(directory,{withFileTypes:true});}catch{continue;}
    for(const folder of folders){
      if(!folder.isDirectory())continue;
      const file=path.join(directory,folder.name,'manifest.yaml');
      let manifest;
      try{manifest=parseYaml(fs.readFileSync(file,'utf8'));}catch{continue;}
      if(!plain(manifest))continue;
      const proof=plain(manifest.proof)?manifest.proof:null;
      out.push({file,node:node.id,nodeId:typeof manifest.nodeId==='string'?manifest.nodeId:node.id,
        outcome:typeof manifest.outcome==='string'?manifest.outcome:null,
        proof:proof&&PROOF_BOUNDARIES.includes(proof.boundary)
          ?{boundary:proof.boundary,fakes:(Array.isArray(proof.fakes)?proof.fakes:[]).filter(item=>typeof item==='string').map(item=>item.trim()).filter(Boolean)}
          :null});
    }
  }
  return out;
}

/**
 * Per declared integration, what the tree can honestly claim about it. `live` needs a passing manifest with
 * `proof.boundary: live` on its own integration node - the only evidence `integration.verify` writes.
 * `fake` is an integration that appears only in some other proof's `proof.fakes` (an `e2e.verify` run
 * against `boundary: api`). `none` is an integration nothing proved at all. There is no fourth state, and
 * a failed live run is `none` rather than `live`: it ran, it did not prove.
 */
export function integrationProofStatus(ledger){
  const nodes=integrationNodes(ledger);
  const manifests=evidenceManifests(ledger);
  const seen=new Set();
  const out=[];
  for(const item of declaredIntegrations(ledger).list){
    if(seen.has(item.id))continue;
    seen.add(item.id);
    const node=nodes.find(candidate=>provesIntegration(candidate,item.id))??null;
    const own=node?manifests.filter(entry=>entry.nodeId===node.id&&entry.proof?.boundary==='live'):[];
    const live=own.filter(entry=>entry.outcome==='pass');
    const faked=manifests.filter(entry=>entry.proof?.boundary==='api'&&entry.proof.fakes.includes(item.id));
    const evidence=[...own,...faked].map(entry=>({file:entry.file,node:entry.nodeId,outcome:entry.outcome,boundary:entry.proof.boundary,fakes:entry.proof.fakes}));
    out.push({id:item.id,provider:item.provider,node:node?.id??null,proven:live.length?'live':faked.length?'fake':'none',evidence});
  }
  return out;
}

// ---------------------------------------------------------------------------- a proof under which rules

/** Stable key order at every depth, so the same declaration always hashes to the same digest. */
const canonical=value=>{
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(plain(value))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value===undefined?null:value);
};

/**
 * The digest of the rules an operation of this kind is held to: its `model/kinds.yaml` entry, its operator
 * contract and the validator rules that judge it. The kernel supplies all three - this module owns only the
 * canonical form, so a digest written today and a digest computed tomorrow compare byte for byte.
 */
export function contractDigestOf({kind,kindRecord=null,operator=null,rules=[]}={}){
  return sha256(Buffer.from(canonical({
    kind:text(kind,'operation kind'),
    kindRecord:kindRecord??null,
    operator:operator??null,
    rules:(Array.isArray(rules)?rules:[rules]).filter(item=>item!==null&&item!==undefined).map(String)
  }),'utf8'));
}

/**
 * Done nodes whose stored proof was taken under a declaration that has since moved: `[{node, stored,
 * current}]`. Only a node the kernel itself completed is considered (its kernel block names the `opId` that
 * wrote it), so a decided record settled by review is never dragged in. A node the kernel completed and that
 * stored no digest at all reads as `stored: null` - a proof that does not remember its rules is exactly the
 * case §8 of the 5-plus design reopens. `kindOf(node,{raw,kernel})` is how the kernel tells this module
 * which kind ran, because the ledger stores the node kind and the kernel knows the operation kind;
 * `digestOf(kind,{node,opId})` answering null means the kernel has no declaration to compare and the node is
 * left alone.
 */
export function staleProofs(ledger,{digestOf,kindOf=null}={}){
  need(typeof digestOf==='function','staleProofs needs a digestOf(kind) the kernel supplies');
  const stale=[];
  for(const node of (ledger?.list??[]).filter(item=>item.state==='done')){
    const raw=tryReadNode(ledger,node);
    const kernel=raw?.extensions?.work3?.kernel;
    if(!plain(kernel)||!trimmed(kernel.opId))continue;
    const kind=typeof kindOf==='function'?kindOf(node,{raw,kernel}):node.kind;
    if(!trimmed(kind))continue;
    const current=trimmed(digestOf(kind,{node,opId:kernel.opId}));
    if(!current)continue;
    const stored=trimmed(kernel.contractDigest);
    if(stored===current)continue;
    stale.push({node,stored,current});
  }
  return stale;
}

// ---------------------------------------------------------------------------- status

/** Counts per kind and state plus the ids a kernel run may pick up, for `workflow-status`. */
export function ledgerSummary(ledger,{scope=null}={}){
  const scopes=scopeList(scope);
  const nodes=ledger.list.filter(node=>inScope(node,scopes));
  const summary={scope:scopes,total:nodes.length,eligible:0,states:{},kinds:{},executableEligible:[],decisionEligible:[]};
  for(const node of nodes){
    const state=String(node.state??'derived'),kind=String(node.kind??'unknown');
    summary.states[state]=(summary.states[state]??0)+1;
    const bucket=summary.kinds[kind]??={total:0,eligible:0,states:{}};
    bucket.total+=1;bucket.states[state]=(bucket.states[state]??0)+1;
    if(node.eligible===true){summary.eligible+=1;bucket.eligible+=1;}
    if(node.eligible===true&&state==='todo'){
      if(EXECUTABLE_KINDS.includes(kind))summary.executableEligible.push(node.id);
      if(DECISION_KINDS.includes(kind))summary.decisionEligible.push(node.id);
    }
  }
  return summary;
}
