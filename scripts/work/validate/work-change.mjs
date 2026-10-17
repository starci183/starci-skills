import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../engine/yaml.mjs';
import {canonicalJSON} from '../../../engine/canonical-json.mjs';import {sha256} from '../../../engine/digest.mjs';
import {slash} from '../../lib/path-key.mjs';
import {isDir,isFile} from '../../lib/fs-kind.mjs';
import {isLiteWorkRoot,workPathAllowed} from '../../lib/work-edition.mjs';

/**
 * The change record: the part of the Work model that decides how far an edit travels.
 *
 * Whether an edit is small cannot be decided by the size of the diff. Turning `never reopened` into
 * `may be reopened` is the smallest possible diff and the largest possible semantic change, while
 * rewriting three paragraphs of description changes nothing at all. So the rule is not "a small edit
 * is local" - it is "prose is local, normative content propagates", and this module computes which of
 * the two happened instead of asking the author.
 *
 * Four kinds, and what each is allowed to do:
 *   initial     the record's first revision; there is nothing to travel from.
 *   editorial   prose only. The normative digest must not move, and nothing downstream is touched.
 *   clarifying  adds a statement or an acceptance criterion. Existing criteria keep their evidence;
 *               only the new one lacks proof.
 *   breaking    edits or withdraws an existing statement. Every assertion bound to the changed
 *               statement becomes history.
 *
 * This module keeps the vocabulary (CHANGE_KINDS, RESULT), the normative digest (`normative`) and the tree reader (`readWorkTree`) that other
 * validators share; the change gate that compared two revisions had no runtime caller and was removed with the runtime specs that were its
 * only users (owner ruling no-runtime-specs, 2026-10-17).
 */
export const RESULT='starci/work-change@1';
export const CHANGE_KINDS=['initial','editorial','clarifying','breaking'];
const MAX_INPUT_BYTES=4*1024*1024;
const SKIP_DIRECTORY=/^[._]|^(?:assets|node_modules)$/;

/**
 * Prose. A key whose value is there to be read by a person and carries no obligation: removing every
 * one of them from a record leaves exactly what the record commits the product to.
 */
const PROSE=new Set(['title','description','summary','note','notes','reason','rationale','consequence',
  'recommendationReason','observation','context']);
/**
 * Lifecycle and bookkeeping. `state` is a claim about progress, `evidence` names the proof, `change`
 * is this record itself - none of them are the content being promised, and a todo->done move must not
 * read as an edit nobody declared.
 */
const LIFECYCLE=new Set(['change','state','activity','blockers','blockedBy','evidence','proven','provenBy','completion','history']);

class WorkChangeInputError extends Error{constructor(message,code='INVALID_INPUT'){super(message);this.name='WorkChangeInputError';this.code=code;}}

const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&Boolean(value.trim());
const key=value=>canonicalJSON(value??null);
const REVISION_NAMED=new RegExp([String.raw`\brev(?:ision)?`,String.raw`\s*(?:\.\s*)?`,String.raw`\d+`].join(''),'i');

/** The normative projection: the record with every prose and lifecycle key removed, at every depth. */
export function normative(value){
  if(Array.isArray(value))return value.map(normative);
  if(!object(value))return value??null;
  const out={};
  for(const name of Object.keys(value))if(!PROSE.has(name)&&!LIFECYCLE.has(name))out[name]=normative(value[name]);
  return out;
}
/** What must not move for an edit to be prose. Two implementations of this would be two answers. */
function normativeDigest(record){return sha256(canonicalJSON(normative(record)));}

/**
 * Additive means every previous obligation survives untouched: a list gained items, an object gained
 * keys, and nothing that was there was edited or dropped. That is what "adds a statement" means, and
 * it is the only difference between a clarification and a break.
 */
function additive(previous,current){
  if(Array.isArray(previous)){
    if(!Array.isArray(current))return false;
    const held=new Set(current.map(key));
    return previous.every(item=>held.has(key(item)));
  }
  if(object(previous)){
    if(!object(current))return false;
    return Object.keys(previous).every(name=>Object.hasOwn(current,name)&&additive(previous[name],current[name]));
  }
  return key(previous)===key(current);
}


/**
 * Every record of one Work tree, read once, keyed by its stable id. Evidence is the kernel-written
 * `evidence` block inside the record it proves - one record, one proof, in the file it belongs to.
 */
function addReadableRecord(target,resolved,records,unreadable){
  if(!isFile(target,{followLinks:false,maxBytes:MAX_INPUT_BYTES})){
    unreadable.push(slash(path.relative(resolved,target)));
    return;
  }
  let meta=null;
  try{meta=parseYaml(fs.readFileSync(target,'utf8'));}
  catch{unreadable.push(slash(path.relative(resolved,target)));return;}
  if(!object(meta))return;
  const at=slash(path.relative(resolved,target));
  const id=text(meta.id)?meta.id.trim():`path:${at}`;
  records.set(id,{id,path:at,meta,criteria:new Map(),evidence:object(meta.evidence)?meta.evidence:null});
}

function collectWorkRecords(dir,resolved,records,unreadable){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const target=path.join(dir,entry.name);
    if(!workPathAllowed(resolved,target,{dir:entry.isDirectory()}))continue;
    if(entry.isDirectory()){
      if(!SKIP_DIRECTORY.test(entry.name)&&isDir(target,{followLinks:false}))collectWorkRecords(target,resolved,records,unreadable);
      continue;
    }
    if(entry.name!=='index.yaml')continue;
    addReadableRecord(target,resolved,records,unreadable);
  }
}

function attachAcceptanceCriteria(records){
  for(const record of records.values()){
    if(record.meta.schema!=='work/acceptance-criterion@1'||!text(record.meta.rule))continue;
    const rule=records.get(record.meta.rule.trim());
    if(rule)rule.criteria.set(record.id,normativeDigest(record.meta));
  }
}

export function readWorkTree(root){
  const resolved=path.resolve(root);
  if(!fs.existsSync(resolved)&&isLiteWorkRoot(resolved))return {root:resolved,records:new Map(),unreadable:[]};
  if(!isDir(resolved,{followLinks:false}))throw new WorkChangeInputError(`Not a readable Work root: ${slash(root)}`);
  const records=new Map(),unreadable=[];
  collectWorkRecords(resolved,resolved,records,unreadable);
  attachAcceptanceCriteria(records);
  return {root:resolved,records,unreadable};
}
