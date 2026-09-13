import fs from 'node:fs';
import path from 'node:path';
import {distPath, skillRoot} from '../core/runtime-root.mjs';
import {parseYaml} from '../core/yaml.mjs';
import {kindsReading, laneFor, readsOf, writesOf} from './graph.mjs';

/**
 * The one place that matches an operation's declared inputs and outputs against the things a workflow
 * actually touches. Before 5-plus the kernel kept its own sets for this - which kinds are "design kinds" and
 * therefore get the brand record, which operation settles a decision node, which operation completes a Work
 * record - and each set drifted from the catalog on its own schedule. Here there is one answer to each
 * question, read from `model/records.yaml` and `model/kinds.yaml`: what a file IS (`recordKindOfPath`), what
 * an operation may cite and produce (`ioPayload`, `ioBlock`), what it produced that it never declared
 * (`undeclaredWrites`), and which kind the graph names for a scope or a node kind (`intakeKindFor`,
 * `decisionKindFor`, `kindsReadingBrand`).
 *
 * Everything here is a pure function of the two profiles; the only I/O is `loadRecords`. That matters
 * because the same answers are needed in three places that cannot share a process - the contract the
 * operation is given, the check the kernel runs on its report, and the catalog validation that runs during
 * a bootstrap build before `.dist` exists.
 */
export const RECORDS_SCHEMA='starci/records@1';

/**
 * The closed catalog, in the order `model/records.yaml` declares it. `validateRecords` refuses a profile
 * that adds to this list or drops from it, exactly as `KINDS` closes the operation catalog.
 */
export const RECORD_KINDS=Object.freeze(['record','srs','sds','decision','brand','design','asset','code','grammar','evidence','runtime','integration']);

/**
 * Which record a Work node's own `index.yaml` is. The question is not the same as the catalog's `nodeKinds`
 * - an `implementation` node carries the `code` record by binding a repository, while the file that node is
 * written in stays the authored `record` - so the answer is which layout folder the node lives in: a `ui`
 * node's file is under `features/<f>/ui/**`, which the catalog calls `design`. A node kind that is not in
 * this map lives nowhere in particular and its file is its own authored record.
 */
const NODE_RECORD=Object.freeze({ui:'design',brand:'brand',business:'srs','business-overview':'srs',module:'srs',
  architecture:'sds',decision:'decision',integration:'integration'});

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const listOf=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];
const need=(condition,message)=>{if(!condition)throw Error(message);};
const slash=value=>String(value).replaceAll('\\','/').replace(/^\.\//,'');

let distProfile=null;

/**
 * Load the record catalog. Without `profileDir` it is the compiled `.dist/model/records.json`, exactly as
 * `loadKinds` loads the operation catalog - and, when `.dist` has not been published yet, the authored
 * `model/records.yaml` beside this module, because `ops/validate.mjs` needs this catalog during the very
 * build that publishes `.dist`. With `profileDir` the authored YAML (or a fixture) is read directly.
 */
export function loadRecords({profileDir=null}={}){
  if(!profileDir){
    if(!distProfile){
      const compiled=distPath('model','records.json');
      distProfile=fs.existsSync(compiled)
        ?JSON.parse(fs.readFileSync(compiled,'utf8'))
        :readRecordsFrom(path.join(skillRoot,'model'));
    }
    return distProfile;
  }
  return readRecordsFrom(path.resolve(profileDir));
}

function readRecordsFrom(dir){
  for(const name of ['records.yaml','records.yml'])
    if(fs.existsSync(path.join(dir,name)))return parseYaml(fs.readFileSync(path.join(dir,name),'utf8'));
  const json=path.join(dir,'records.json');
  if(fs.existsSync(json))return JSON.parse(fs.readFileSync(json,'utf8'));
  throw Error(`No records profile in ${dir}: expected records.yaml`);
}

const recordsOf=profile=>{
  const value=profile??loadRecords();
  need(plain(value)&&plain(value.records),'A records profile with a records catalog is required');
  return value;
};
/** One catalog entry; throws for a record kind the profile does not declare, because an unknown one is a bug. */
export function recordEntry(record,{records=null}={}){
  const entry=recordsOf(records).records[record];
  need(plain(entry),`Unknown record kind ${record}; the catalog is ${RECORD_KINDS.join(', ')}`);
  return entry;
}
/** What a record kind is derived from - the only kinds a record of this kind may cite. */
export function recordReads(record,{records=null}={}){return listOf(recordEntry(record,{records}).reads);}

/**
 * Every way the record catalog can be wrong, as named errors (`[]` means valid). The catalog is what makes a
 * duplicate and a conflict a matter of ids, so an authored mistake here is a mistake in every reconciliation
 * that follows: a record derived from a kind nobody declares, an entry missing the purpose or the layout the
 * kernel reads, or a catalog that no longer agrees with the closed `RECORD_KINDS` list.
 */
export function validateRecords(given=null){
  const errors=[];
  const profile=given??loadRecords();
  const fail=(code,message,detail={})=>{errors.push({code,message,...detail});};
  if(!plain(profile)||!plain(profile.records)){fail('record-shape','A records profile needs a records catalog');return errors;}
  if(profile.schema!==RECORDS_SCHEMA)fail('record-shape',`Unexpected records profile schema ${profile.schema}`,{schema:profile.schema??null});
  const catalogue=Object.keys(profile.records);
  for(const record of RECORD_KINDS)if(!catalogue.includes(record))fail('catalog-drift',`The record catalog is missing the required kind ${record}`,{record});
  for(const record of catalogue)if(!RECORD_KINDS.includes(record))fail('catalog-drift',`${record} is not in the closed RECORD_KINDS list of kernel/io.mjs`,{record});
  for(const [record,entry] of Object.entries(profile.records)){
    if(!plain(entry)){fail('record-shape',`Record kind ${record} is not a mapping`,{record});continue;}
    if(typeof entry.purpose!=='string'||!entry.purpose.trim())fail('record-shape',`Record kind ${record} must declare a one-line purpose`,{record});
    for(const field of ['layout','nodeKinds','reads'])
      if(!Array.isArray(entry[field]))fail('record-shape',`Record kind ${record} must declare ${field} as a list`,{record,field});
    for(const source of listOf(entry.reads)){
      if(!catalogue.includes(source))fail('unknown-record-read',`Record kind ${record} is derived from ${source}, which the catalog does not declare`,{record,reads:source});
      // A record derived from itself would make every restatement of it legal by declaration.
      else if(source===record)fail('unknown-record-read',`Record kind ${record} declares itself as its own source`,{record,reads:source});
    }
  }
  return errors;
}

/* ------------------------------------------------------------------ paths */

/**
 * What one path IS, by the layout the record catalog declares. The order is the specificity order of that
 * catalog, most specific first: a decision lives inside the business tree, evidence and asset bytes live
 * inside whatever record they belong to, and only when nothing more specific claims the path does the node's
 * own `index.yaml` answer for it.
 *
 * Two prefixes stand outside the Work tree and are matched first: `repository:` is the bound source
 * repository, and `grammar:` is the installed grammar package. An operator contract writes its templates in
 * the same vocabulary - `N/` is the node's own folder and `E/` its evidence - so the same function answers
 * for an authored contract and for a file a report listed. `nodeKind` resolves the `N/` template: a `ui`
 * node's `index.yaml` is the design record, an `implementation` node's is the node's own authored record.
 *
 * `null` means the path is not a record at all - the workspace file, a `_resources` or `_local` entry, the
 * runtime state the kernel keeps - and a caller must not treat that as a record it may or may not write.
 */
export function recordKindOfPath(file,{nodeKind=null,records=null}={}){
  if(typeof file!=='string'||!file.trim())return null;
  const value=slash(file.trim());
  const known=record=>record&&(!records||Object.hasOwn(recordsOf(records).records,record))?record:null;
  if(value.startsWith('grammar:'))return known('grammar');
  if(value.startsWith('repository:'))return known('code');
  const parts=value.split('/').filter(Boolean);
  const has=name=>parts.includes(name);
  if(has('knowledge')&&has('grammars'))return known('grammar');
  // Evidence before assets: a capture kept inside an evidence bundle is part of that proof, not artwork.
  if(parts[0]==='E'||has('evidence'))return known('evidence');
  if(has('assets'))return known('asset');
  if(has('decisions'))return known('decision');
  if(has('business'))return known('srs');
  if(has('architecture'))return known('sds');
  if(has('integration'))return known('integration');
  if(has('ui'))return known('design');
  if(has('brand'))return known('brand');
  // `_local` and `_resources` are the runtime's own state, never a Work record.
  if(parts.some(part=>part.startsWith('_')))return null;
  if(parts[parts.length-1]==='index.yaml'){
    const kind=typeof nodeKind==='string'?nodeKind.split('.')[0]:null;
    return known(parts[0]==='N'&&kind?(NODE_RECORD[kind]??'record'):'record');
  }
  // Anything that is neither in the Work tree nor one of its templates is the product itself.
  return ['.starciwork','N','E'].includes(parts[0])?null:known('code');
}

/**
 * The files an operation changed that its kind never declared it would produce, as `{file, record}` rows.
 * This is the mechanical half of the input/output rule: it needs no model, it runs before the validator, and
 * a non-empty answer downgrades the report to `failed`. A path that is not a record at all is not a finding -
 * the kernel's own state files are not the operation's output.
 */
export function undeclaredWrites(kind,files=[],{profile=null,records=null,nodeKind=null}={}){
  const allowed=new Set(writesOf(kind,{profile}));
  const listed=Array.isArray(files)?files:[files];
  const found=[];
  for(const file of listed){
    const record=recordKindOfPath(file,{nodeKind,records});
    if(!record||allowed.has(record))continue;
    found.push({file,record});
  }
  return found;
}

/* ------------------------------------------------------------------ the contract */

/**
 * What the kind declares, as the payload `validateOp` is given: the rule the validator applies is that a
 * record cited outside `reads` or written outside `writes` is a defect, and this is the list it applies it to.
 */
export function ioPayload(kind,{profile=null}={}){
  return {reads:readsOf(kind,{profile}),writes:writesOf(kind,{profile})};
}

/**
 * The same declaration as markdown, printed under the goal of every operation contract, so the operation
 * knows which records it may cite and which it may produce before it reads its allowlist.
 */
export function ioBlock(kind,{profile=null,records=null}={}){
  const describe=record=>`- \`${record}\` - ${String(recordEntry(record,{records}).purpose).trim()}`;
  const reads=readsOf(kind,{profile}),writes=writesOf(kind,{profile});
  const lines=['## Reads'];
  lines.push(...(reads.length?reads.map(describe):['- nothing declared; this operation cites no record.']));
  lines.push('','## Produces');
  lines.push(...(writes.length
    ?writes.map(describe)
    :['- nothing: this operation reads and reports, and repairs nothing it finds.']));
  return lines.join('\n');
}

/* ------------------------------------------------------------------ the kernel's questions */

/**
 * Which operation kinds read the brand record. This replaces the kernel's hard-coded `DESIGN_KINDS`: the
 * brand payload goes to the operations whose declaration says they read it, so settling one more kind inside
 * the identity is an edit to the catalog rather than to the kernel.
 */
export function kindsReadingBrand({profile=null}={}){return kindsReading('brand',{profile});}

/**
 * The kind that opens a scope the tree does not hold yet. The product's identity is settled by the one kind
 * that authors the brand record; everything else is authored as Work first, which is what an intake is.
 */
export function intakeKindFor(scope){return String(scope??'').trim()==='brand'?'brand.decide':'work.author';}

/**
 * The operation that settles one decision node, read from the lanes instead of from a table beside them: a
 * decision node's lane is a single step, and that step is the answer. `null` when no lane claims the node
 * kind, or when its lane is a sequence - a node that must be built and proven is not settled by one decision.
 */
export function decisionKindFor(nodeKind,{profile=null}={}){
  const steps=laneFor({kind:nodeKind,layout:null},{profile});
  return steps.length===1?steps[0]:null;
}
