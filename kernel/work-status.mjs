import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';

/**
 * How far along a Work tree is, as a number an owner reads rather than one they infer.
 *
 * Three facts are derived here, and they are derived because authoring any of them would let the tree
 * claim them:
 *
 *  1. A parent's state. `features/<feature>/index.yaml` and the catalog at the root carry no `state`:
 *     they are `done` when every required record beneath them is done, `stale` when a record beneath
 *     them has a proof that no longer holds, and otherwise `todo` with the counts that say how far
 *     along they are. A parent that authors a state is a finding (PARENT_AUTHORS_STATE), never a
 *     fallback - a hand-written `done` on a parent is the one number nothing underneath has to earn.
 *
 *  2. Agreed and proven, counted apart. `state: done` says a record was agreed and reviewed; proven
 *     says something demonstrated it. They are different facts, so they are different columns. A done
 *     record that nothing has demonstrated is honest - a specification is a skeleton implementation
 *     completes - and is never reported as an error. What is reported is the size of the gap, because a
 *     corpus of 79 agreed business records with zero demonstrated implementations reads as finished
 *     until the two numbers are printed side by side.
 *
 *     Proof is computed over the forward edge and only the forward edge: the provers of a record are
 *     the records whose own `proves` names it, are themselves `done`, and keep evidence that is not
 *     stale. A record's `proven.by`/`proven.at` is the kernel's denormalised inverse of exactly those
 *     edges, so reading it would let a table inherit an annotation that its own source can contradict -
 *     which is the failure this report exists to end. It is therefore not read here at all.
 *
 *  3. Blocked. Nobody authors `state: blocked`. A record is blocked when an ordering dependency it
 *     declares - `composes[].rule` or `dependsOn` - is not done AND the record's own `blockedBy` prose
 *     names that record, so the derived fact and the authored reason are the same fact (the
 *     DEPENDENCY_NOT_DONE condition of the record checker). `refs` is deliberately not an ordering
 *     edge: the layout specification has it bind a semantic input "without implying execution order",
 *     so a ref that is not done is a dependency to re-read, not a stop.
 *
 * Staleness is read from the evidence a record keeps: a manifest carrying `stale: true` (the checker's
 * PROOF_STALE condition) means the proof was taken against an input the record has since moved past.
 * The record keeps its history; what it loses is the claim that the history still demonstrates it. The
 * record checker is growing the stricter form of the same condition - `work/evidence.recordDigest`
 * against the record's current normative digest, so proof means proof of what the record says now - and
 * this module consumes that verdict when it lands rather than re-deriving a digest of its own.
 *
 * This module derives; it does not validate. The record checker owns the finding codes above and the
 * completion conditions, and this module consumes rather than recomputes them wherever its report is
 * present. `ledgerSummary` in ./ledger.mjs stays as it is: it counts a validator projection, which
 * carries neither `proven` nor the evidence manifests, so it can count states and kinds and nothing
 * about demonstration.
 */

/** Every record kind, the family it is counted under, and whether it is a record that authors state. */
export const KINDS={
  'work/business-rule':{family:'br',record:true},
  'work/acceptance-criterion':{family:'ac',record:false},
  'work/functional-requirement':{family:'fr',record:true},
  'work/non-functional-requirement':{family:'nfr',record:true},
  'work/data':{family:'data',record:true},
  'work/customer-journey':{family:'journey',record:true},
  'work/policy-decision':{family:'decision',record:true},
  'work/sds-component':{family:'sds',record:true},
  'work/ui-screen':{family:'ui',record:true},
  'work/implementation':{family:'impl',record:true},
  'work/uat-flow':{family:'uat',record:true},
  'work/brand':{family:'brand',record:true},
  'work/evidence':{family:'evidence',record:false},
  'work/feature':{family:'feature',record:false,parent:true},
  'work/catalog':{family:'catalog',record:false,parent:true},
  'work/workspace':{family:'workspace',record:false}
};
/** The states a record may author. Anything else is an authored word this derivation will not read. */
export const RECORD_STATES=['todo','done','uninvestigate','suspended'];
/** The columns of one family row, in the order they are printed. */
export const COLUMNS=['total','done','proven','todo','stale','blocked'];
/** Directories that are never Work: kernel custody, local runtime state, payload and version control. */
const SKIP=new Set(['.git','node_modules','assets','_local','_resources','_workflows','kernel-evidence','kernel-strays','kernel-headless','kernel-approvals']);
/** A stable record id as the tree writes them: dot-separated lowercase segments, `br.task.title.required`. */
const ID_IN_PROSE=/[a-z][a-z0-9]*(?:\.[a-z0-9][a-z0-9-]*)+/g;

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const slash=value=>String(value).replaceAll('\\','/');
const list=value=>Array.isArray(value)?value:value===undefined||value===null?[]:[value];
const strings=value=>list(value).filter(entry=>typeof entry==='string'&&entry.trim()).map(entry=>entry.trim());

/** Every `index.yaml` and every `evidence/<id>/manifest.yaml` below a Work root, in path order. */
function walkTree(workRoot){
  const files=[];
  const walk=dir=>{
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
    for(const entry of [...entries].sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(dir,entry.name);
      if(entry.isSymbolicLink())continue;
      if(entry.isDirectory()){if(!SKIP.has(entry.name))walk(file);continue;}
      if(entry.name==='index.yaml'||entry.name==='manifest.yaml')files.push(file);
    }
  };
  walk(workRoot);
  return files;
}

/** The ordering dependencies a record declares. `refs` is not one of them, by the layout specification. */
function dependencies(raw){
  const composed=list(raw.composes).map(entry=>plain(entry)?entry.rule:entry);
  return [...new Set([...strings(composed),...strings(raw.dependsOn)])];
}

/**
 * Read one Work tree into records. Nothing here judges: the parse keeps what the file authored, and every
 * derived word below is computed from the whole set, never from one file's own claim about itself.
 */
export function readWorkTree({workRoot}){
  const root=path.resolve(workRoot);
  if(!fs.existsSync(root))throw Error(`No Work tree at ${root}`);
  const records=[],evidence=[],findings=[];
  for(const file of walkTree(root)){
    const relative=slash(path.relative(root,file));
    let raw;
    try{raw=parseYaml(fs.readFileSync(file,'utf8'));}
    catch(error){findings.push({code:'UNREADABLE_RECORD',path:relative,message:error.message});continue;}
    if(!plain(raw)){findings.push({code:'UNREADABLE_RECORD',path:relative,message:'The file is not a YAML mapping.'});continue;}
    const schema=typeof raw.schema==='string'?raw.schema.trim():'';
    const kind=KINDS[schema];
    if(!kind){
      if(schema!=='')findings.push({code:'UNKNOWN_SCHEMA',path:relative,id:raw.id??null,message:`No record family owns schema ${schema}.`});
      continue;
    }
    if(kind.family==='evidence'){
      evidence.push({path:relative,id:raw.id??null,record:typeof raw.record==='string'?raw.record.trim():null,
        outcome:raw.outcome??null,stale:raw.stale===true,staleReason:typeof raw.staleReason==='string'?raw.staleReason.trim():null});
      continue;
    }
    if(kind.family==='workspace')continue;
    const state=typeof raw.state==='string'?raw.state.trim():null;
    const node={
      path:relative,directory:slash(path.dirname(relative)).replace(/^\.$/,''),id:typeof raw.id==='string'?raw.id.trim():relative,
      schema,family:kind.family,record:kind.record===true,parent:kind.parent===true,
      title:typeof raw.title==='string'?raw.title.trim():null,
      state,required:raw.required!==false,
      // The forward edge, authored by whatever did the demonstrating. `proven` is the kernel's inverse
      // of these and is deliberately not read: a cache cannot be the evidence that it is correct.
      proves:strings(raw.proves),
      dependsOn:dependencies(raw),refs:strings(raw.refs),blockedBy:strings(raw.blockedBy)
    };
    records.push(node);
  }
  return {workRoot:root,records,evidence,findings};
}

/** Which feature owns a record: the catalog entry whose directory contains it, else its top directory. */
function featureOf(node,catalog){
  for(const entry of catalog)if(node.directory===entry.directory||node.directory.startsWith(`${entry.directory}/`))return entry.id;
  const [top]=node.directory.split('/');
  return node.directory===''?'(root)':top;
}

const emptyRow=()=>Object.fromEntries(COLUMNS.map(column=>[column,0]));
const addRow=(into,from)=>{for(const column of COLUMNS)into[column]+=from[column];return into;};

/**
 * Derive a parent's state from the records beneath it: `done` only when every required one is done,
 * `stale` when a proof beneath it no longer holds, `todo` otherwise. Nothing beneath it at all is
 * `todo` too - an empty parent has demonstrated nothing, and calling it done would be the vacuous
 * `done` this whole derivation exists to refuse.
 */
export function deriveState(states){
  const required=states.filter(entry=>entry.required);
  if(required.length&&required.every(entry=>entry.state==='done'&&!entry.stale))return 'done';
  if(states.some(entry=>entry.stale))return 'stale';
  return 'todo';
}

/**
 * The status of one Work tree: a row per family per feature, the derived state of every parent, and the
 * findings that say the tree claimed something it may not author.
 */
export function workStatus({workRoot,feature=null}={}){
  const tree=readWorkTree({workRoot});
  const findings=[...tree.findings];
  const byId=new Map(tree.records.map(node=>[node.id,node]));
  const catalog=[];
  for(const node of tree.records.filter(entry=>entry.schema==='work/catalog')){
    let raw;
    try{raw=parseYaml(fs.readFileSync(path.join(tree.workRoot,node.path),'utf8'));}catch{raw=null;}
    for(const entry of list(raw?.features))if(plain(entry)&&typeof entry.id==='string')
      catalog.push({id:entry.id.trim(),directory:slash(entry.directory??`features/${entry.id.trim()}`).replace(/\/+$/,''),
        description:typeof entry.description==='string'?entry.description.trim():null});
  }

  // A parent authors no state; a record authors one of the known words and nothing else.
  for(const node of tree.records){
    if(!node.record){
      if(node.state!==null)findings.push({code:'PARENT_AUTHORS_STATE',path:node.path,id:node.id,
        message:`A ${node.family} derives its state from the records beneath it; it authored ${node.state}.`});
      continue;
    }
    if(node.state===null)findings.push({code:'RECORD_WITHOUT_STATE',path:node.path,id:node.id,
      message:'A record authors its own state; this one authors none, so nothing beneath can be counted.'});
    else if(!RECORD_STATES.includes(node.state))findings.push({code:'UNKNOWN_STATE',path:node.path,id:node.id,
      message:`${node.state} is not a state a record may author.`});
  }

  // Staleness comes from the evidence a record keeps, never from the record's own word for itself.
  const staleByRecord=new Map(),evidenceByRecord=new Map();
  for(const manifest of tree.evidence){
    const owner=manifest.record&&byId.has(manifest.record)?manifest.record
      :[...byId.values()].find(node=>manifest.path.startsWith(`${node.directory}/evidence/`))?.id??null;
    if(!owner)continue;
    evidenceByRecord.set(owner,[...evidenceByRecord.get(owner)??[],manifest]);
    if(manifest.stale)staleByRecord.set(owner,{code:'PROOF_STALE',evidence:manifest.path,reason:manifest.staleReason});
  }

  /**
   * A record demonstrates another only if it is itself finished and its own evidence still holds: a
   * prover that is todo, or whose proof went stale, proves nothing, and a prover with no evidence at
   * all is an authored claim about itself rather than a demonstration of anything.
   */
  const demonstrates=node=>node.state==='done'&&!staleByRecord.has(node.id)&&(evidenceByRecord.get(node.id)??[]).some(manifest=>manifest.outcome!=='fail');
  const proversOf=new Map();
  for(const node of tree.records.filter(entry=>entry.record)){
    for(const id of node.proves){
      if(!byId.has(id)){findings.push({code:'PROVES_NAMES_NO_RECORD',path:node.path,id:node.id,
        message:`proves names ${id}, which is not a record of this tree.`});continue;}
      if(demonstrates(node))proversOf.set(id,[...proversOf.get(id)??[],node.id]);
    }
  }

  const derived=new Map();
  for(const node of tree.records.filter(entry=>entry.record)){
    const stale=staleByRecord.get(node.id)??null;
    const blockers=node.dependsOn
      .filter(id=>byId.get(id)?.state!=='done')
      .filter(id=>node.blockedBy.some(reason=>[...reason.matchAll(ID_IN_PROSE)].some(match=>match[0]===id)))
      .map(id=>({code:'DEPENDENCY_NOT_DONE',id,state:byId.get(id)?.state??null,
        reason:node.blockedBy.find(entry=>[...entry.matchAll(ID_IN_PROSE)].some(match=>match[0]===id))??null}));
    const proven=(proversOf.get(node.id)??[]).sort((a,b)=>a.localeCompare(b));
    derived.set(node.id,{node,feature:featureOf(node,catalog),state:node.state,stale:stale!==null,staleReason:stale,
      blocked:blockers.length>0,blockers,proven,agreed:node.state==='done',
      effectiveState:node.state==='done'&&stale!==null?'stale':node.state});
  }

  const features=new Map();
  for(const entry of catalog)features.set(entry.id,{id:entry.id,title:entry.description,families:new Map(),records:[]});
  for(const item of derived.values()){
    const owner=features.get(item.feature)??{id:item.feature,title:null,families:new Map(),records:[]};
    features.set(item.feature,owner);
    owner.records.push(item);
    const row=owner.families.get(item.node.family)??emptyRow();
    row.total+=1;
    if(item.effectiveState==='done')row.done+=1;
    if(item.proven.length)row.proven+=1;
    if(item.effectiveState!=='done')row.todo+=1;
    if(item.stale)row.stale+=1;
    if(item.blocked)row.blocked+=1;
    owner.families.set(item.node.family,row);
  }

  const shown=[...features.values()].filter(entry=>feature===null||entry.id===feature);
  if(feature!==null&&!shown.length)throw Error(`No feature ${feature} in ${tree.workRoot}`);
  const report=shown.map(entry=>{
    const totals=[...entry.families.values()].reduce(addRow,emptyRow());
    const states=entry.records.map(item=>({required:item.node.required,state:item.effectiveState,stale:item.stale}));
    return {
      id:entry.id,title:entry.title,derivedState:deriveState(states),totals,
      families:[...entry.families.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([family,row])=>({family,...row})),
      blocked:entry.records.filter(item=>item.blocked).flatMap(item=>item.blockers.map(blocker=>({id:item.node.id,by:blocker.id,state:blocker.state,reason:blocker.reason}))),
      stale:entry.records.filter(item=>item.stale).map(item=>({id:item.node.id,state:item.effectiveState,evidence:item.staleReason?.evidence??null,reason:item.staleReason?.reason??null}))
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));

  const everyState=[...derived.values()].map(item=>({required:item.node.required,state:item.effectiveState,stale:item.stale}));
  const parents=tree.records.filter(node=>node.parent).map(node=>{
    const beneath=[...derived.values()].filter(item=>node.directory===''||item.node.directory.startsWith(`${node.directory}/`));
    return {id:node.id,path:node.path,authoredState:node.state,
      derivedState:deriveState(beneath.map(item=>({required:item.node.required,state:item.effectiveState,stale:item.stale}))),
      totals:beneath.reduce((row,item)=>{
        row.total+=1;
        if(item.effectiveState==='done')row.done+=1;else row.todo+=1;
        if(item.proven.length)row.proven+=1;
        if(item.stale)row.stale+=1;
        if(item.blocked)row.blocked+=1;
        return row;
      },emptyRow())};
  // The root first, then each feature: a parent is read before the parents it contains.
  }).sort((a,b)=>a.path.split('/').length-b.path.split('/').length||a.path.localeCompare(b.path));

  return {
    schema:'starci/work-status@1',ok:findings.length===0,workRoot:tree.workRoot,
    records:tree.records.length,counted:derived.size,
    totals:report.map(entry=>entry.totals).reduce(addRow,emptyRow()),
    derivedState:deriveState(everyState),
    features:report,parents,findings
  };
}

/** The same report as a table: one block per feature, one line per family, the reasons underneath. */
export function formatWorkStatus(status){
  const width=Object.fromEntries(COLUMNS.map(column=>[column,Math.max(column.length,...status.features.flatMap(feature=>feature.families.map(row=>String(row[column]).length)),0)]));
  const family=Math.max(6,...status.features.flatMap(feature=>feature.families.map(row=>row.family.length)));
  const line=(name,row)=>`  ${name.padEnd(family)}  ${COLUMNS.map(column=>String(row[column]).padStart(width[column])).join('  ')}`;
  const head=`  ${'family'.padEnd(family)}  ${COLUMNS.map(column=>column.padStart(width[column])).join('  ')}`;
  const lines=[`${path.basename(status.workRoot)}: ${status.derivedState} - ${status.totals.done} of ${status.totals.total} records done, ${status.totals.proven} proven`];
  for(const feature of status.features){
    lines.push('',`${feature.id} [${feature.derivedState}]${feature.title?` - ${feature.title}`:''}`,head);
    for(const row of feature.families)lines.push(line(row.family,row));
    lines.push(line('total',feature.totals));
    for(const entry of feature.blocked)lines.push(`    blocked ${entry.id}: ${entry.by} is ${entry.state??'absent'} - ${entry.reason??'no reason authored'}`);
    for(const entry of feature.stale)lines.push(`    stale   ${entry.id}: ${entry.reason??entry.evidence??'proof no longer holds'}`);
  }
  if(status.findings.length){
    lines.push('','findings');
    for(const finding of status.findings)lines.push(`  [${finding.code}] ${finding.id??finding.path}: ${finding.message}`);
  }
  return lines.join('\n');
}
