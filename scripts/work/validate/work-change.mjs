import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../engine/yaml.mjs';
import {canonicalJSON} from '../../../engine/canonical-json.mjs';import {sha256} from '../../../engine/digest.mjs';
import {slash} from '../../lib/path-key.mjs';
import {list, byCodeUnit} from '../../lib/list.mjs';
import {isDir,isFile} from '../../lib/fs-kind.mjs';

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
 * Declared intent is verified, never trusted: `kind: editorial` whose normative digest moved is
 * CHANGE_KIND_MISMATCH. A self-declaration has value only when something checks it - the same class
 * as an agent writing `verification: source inspection only` beside kernel-run checks.
 *
 * Expired evidence is marked, never deleted. A breaking change stales the evidence that covered the
 * changed or withdrawn content, with a reason naming the revision and the clause. History is what
 * lets somebody later ask whether a rule was ever proven; deleting it answers with silence.
 *
 * This check reports and never repairs. A script which judges and repairs is wrong twice when it is wrong.
 */
export const RESULT='starci/work-change@1';
export const CHANGE_KINDS=['initial','editorial','clarifying','breaking'];
const CHANGE_FIELDS=['rev','kind','at','withdraws','reason','retains'];
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
export {WorkChangeInputError};

const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&Boolean(value.trim());
const positiveInteger=value=>Number.isInteger(value)&&value>0;
const key=value=>canonicalJSON(value??null);
/** A word a person would recognize in both a clause and the sentence that explains why it went. */
const stems=value=>new Set(String(value??'').toLowerCase().match(/[a-z]{4,}/g)?.map(word=>word.replace(/(?:ed|ing|es|s)$/,''))??[]);
const REVISION_NAMED=new RegExp([String.raw`\brev(?:ision)?`,String.raw`\s*(?:\.\s*)?`,String.raw`\d+`].join(''),'i');
const namesRevision=value=>REVISION_NAMED.test(String(value??''));
const moment=value=>{const at=Date.parse(String(value??''));return Number.isFinite(at)?at:null;};

/** The normative projection: the record with every prose and lifecycle key removed, at every depth. */
export function normative(value){
  if(Array.isArray(value))return value.map(normative);
  if(!object(value))return value??null;
  const out={};
  for(const name of Object.keys(value))if(!PROSE.has(name)&&!LIFECYCLE.has(name))out[name]=normative(value[name]);
  return out;
}
/** What must not move for an edit to be prose. Two implementations of this would be two answers. */
export function normativeDigest(record){return sha256(canonicalJSON(normative(record)));}

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
 * The computed kind of the transition, from the two revisions themselves. `criteria` maps a criterion
 * id to its own normative digest, so an edited criterion is a break even when the rule's own text
 * stands unchanged.
 */
export function classifyChange(previous,current){
  if(!previous)return 'initial';
  const sameDigest=normativeDigest(previous.meta)===normativeDigest(current.meta);
  const held=[...previous.criteria.keys()];
  const sameCriteria=held.length===current.criteria.size&&held.every(id=>current.criteria.get(id)===previous.criteria.get(id));
  if(sameDigest&&sameCriteria)return 'editorial';
  const keptCriteria=held.every(id=>current.criteria.has(id)&&current.criteria.get(id)===previous.criteria.get(id));
  return keptCriteria&&additive(normative(previous.meta),normative(current.meta))?'clarifying':'breaking';
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
  if(!isDir(resolved,{followLinks:false}))throw new WorkChangeInputError(`Not a readable Work root: ${slash(root)}`);
  const records=new Map(),unreadable=[];
  collectWorkRecords(resolved,resolved,records,unreadable);
  attachAcceptanceCriteria(records);
  return {root:resolved,records,unreadable};
}

function changeInfo(record,previous,baseline){
  const change=object(record.meta.change)?record.meta.change:null;
  const declared=change&&text(change.kind)?change.kind.trim():null;
  const rev=change?change.rev:null;
  const digest=normativeDigest(record.meta);
  const statements=new Set(list(record.meta.statements).filter(text).map(item=>item.trim()));
  const withdraws=change?list(change.withdraws).filter(text).map(item=>item.trim()):[];
  const computed=baseline?classifyChange(previous,record):null;
  return {change,declared,rev,digest,statements,withdraws,computed};
}

function validateChangeDeclaration(record,{change,declared,rev,statements,withdraws},add){
  for(const name of Object.keys(change))if(!CHANGE_FIELDS.includes(name))
    add('CHANGE_INVALID',record,`change.${name} is not a field of the change record`,{expected:CHANGE_FIELDS});
  if(!positiveInteger(rev))add('CHANGE_INVALID',record,'change.rev must be a positive integer',{observed:rev??null});
  if(!CHANGE_KINDS.includes(declared))add('CHANGE_INVALID',record,'change.kind must be one of the four change kinds',{expected:CHANGE_KINDS,observed:declared});
  if(moment(change.at)===null)add('CHANGE_INVALID',record,'change.at must be a parseable timestamp',{observed:change.at??null});
  validateWithdrawals(record,{change,declared,statements,withdraws},add);
  // A first revision has no predecessor, so its kind is decidable without a baseline.
  if(rev===1&&declared!==null&&CHANGE_KINDS.includes(declared)&&declared!=='initial')
    add('CHANGE_KIND_MISMATCH',record,'rev 1 has no previous revision to travel from',{expected:'initial',observed:declared});
  if(declared==='initial'&&positiveInteger(rev)&&rev!==1)
    add('CHANGE_INVALID',record,'an initial change record is rev 1',{observed:rev});
}

function validateWithdrawals(record,{change,declared,statements,withdraws},add){
  if(change.withdraws!==undefined&&(!Array.isArray(change.withdraws)||change.withdraws.length!==withdraws.length))
    add('CHANGE_INVALID',record,'change.withdraws must be a list of non-empty statements');
  if(withdraws.length&&declared!=='breaking')
    add('WITHDRAWS_WITHOUT_BREAKING',record,'withdrawing a statement is a breaking change; a withdrawal that is not declared as one is indistinguishable from a clarification',{observed:declared});
  for(const clause of withdraws)if(statements.has(clause))
    add('WITHDRAWS_STILL_PRESENT',record,'a withdrawn statement is still one of the record statements',{observed:clause});
}

function validateBaselineChange(record,previous,{change,declared,rev,withdraws,computed},coveredByOwner,add){
  validateRevisionTravel(record,previous,{change,declared,rev,computed},coveredByOwner,add);
  if(previous&&withdraws.length)validateWithdrawnWereHeld(record,previous,withdraws,add);
  if(previous?.evidence&&!record.evidence)
    add('EVIDENCE_DELETED',record,'expired evidence is marked, never deleted; history is what lets somebody later ask whether this was ever proven',{observed:previous.evidence.recordDigest??'the evidence block'});
}

function validateRevisionTravel(record,previous,{change,declared,rev,computed},coveredByOwner,add){
  const previousRev=previous&&object(previous.meta.change)&&positiveInteger(previous.meta.change.rev)?previous.meta.change.rev:null;
  const moved=computed!=='initial'&&computed!=='editorial';
  if(previous&&positiveInteger(rev)&&previousRev!==null&&rev<previousRev)
    add('REV_NOT_MONOTONIC',record,'a revision never goes backwards',{expected:`> ${previousRev}`,observed:rev});
  if(previous&&moved&&!coveredByOwner(record)&&(rev===null||previousRev===null||rev===previousRev))
    add('CHANGE_UNRECORDED',record,'normative content moved and no revision declared it',{expected:previousRev===null?'a change record':`rev > ${previousRev}`,observed:rev,computed});
  else if(previous&&change&&CHANGE_KINDS.includes(declared)&&positiveInteger(rev)&&previousRev!==null&&rev>previousRev&&declared!==computed)
    add('CHANGE_KIND_MISMATCH',record,'the declared kind is not the kind this edit actually is',{expected:computed,observed:declared});
}

function validateWithdrawnWereHeld(record,previous,withdraws,add){
  const held=new Set(list(previous.meta.statements).filter(text).map(item=>item.trim()));
  for(const clause of withdraws)if(!held.has(clause))
    add('WITHDRAWS_UNKNOWN_STATEMENT',record,'a withdrawal names a statement the previous revision did not carry',{observed:clause});
}

function changedClauseStems(withdraws,baseline,previous,statements){
  return new Set([...withdraws.flatMap(item=>[...stems(item)]),
    ...(baseline&&previous?list(previous.meta.statements).filter(text).filter(item=>!statements.has(item.trim())).flatMap(item=>[...stems(item)]):[])]);
}

function validateEvidenceFreshness(record,previous,{change,declared,statements,withdraws,computed},baseline,add){
  const proof=record.evidence;
  const stale=proof?.stale===true;
  if(proof){
    const clause=changedClauseStems(withdraws,baseline,previous,statements);
    validateProofFreshness(record,proof,previous?.evidence??null,{changeAt:change?moment(change.at):null,clause,broke:declared==='breaking'||computed==='breaking',stale,computed,declared},add);
  }
  if(record.meta.state==='done'&&stale)
    add('STATE_RESTS_ON_STALE_EVIDENCE',record,'the evidence of this record is history; a rule whose proof expired returns to todo',{observed:'state: done'});
}

/** A stale reason names the revision that expired the proof and, when a clause went, at least two of its words. */
const staleReasonNamesIt=(reason,clause)=>namesRevision(reason)&&(clause.size===0||[...stems(reason)].filter(word=>clause.has(word)).length>=2);

function validateProofFreshness(record,proof,before,{changeAt,clause,broke,stale,computed,declared},add){
  const capturedAt=moment(proof.provenance?.capturedAt);
  // `recordDigest` is the kernel's capture token; compare it with the previous token rather than recomputing it here.
  const recaptured=before!==null&&text(proof.recordDigest)&&proof.recordDigest!==before.recordDigest;
  const predates=before!==null?!recaptured:capturedAt===null||changeAt===null||capturedAt<changeAt;
  if(!text(proof.recordDigest))
    add('EVIDENCE_DIGEST_MISSING',record,'proof that does not say what it was captured against cannot be judged expired later',{observed:'evidence.recordDigest'});
  if(broke&&predates&&!stale)
    add('EVIDENCE_STALE_UNMARKED',record,'a breaking change expires the evidence bound to the content it changed',{observed:proof.recordDigest??null,expected:'stale: true with a staleReason'});
  if(stale&&!staleReasonNamesIt(proof.staleReason,clause))
    add('STALE_REASON_UNNAMED',record,'stale evidence names the revision that expired it and the clause that went',{observed:proof.staleReason??null});
  if(before&&before.stale!==true&&stale&&!broke)
    add('EVIDENCE_STALED_WITHOUT_BREAK',record,'only a breaking change expires evidence; prose and clarifications leave existing proof standing',{observed:proof.staleReason??null,computed:computed??declared});
}

const textOrNull=value=>(text(value)?value:null);

const declaredRevOf=record=>{const change=record&&object(record.meta.change)?record.meta.change:null;return change&&positiveInteger(change.rev)?change.rev:null;};

/**
 * The ids whose declared revision went up since the baseline. An acceptance criterion is owned by its rule, and the
 * rule's revision declares it: demanding a second change record on the criterion would ask the author to declare the
 * same edit twice.
 */
function revisionMovedIds(current,baseline){
  if(!baseline)return new Set();
  return new Set([...current.records.values()].filter(record=>{
    const was=declaredRevOf(baseline.records.get(record.id)??null),now=declaredRevOf(record);
    return was!==null&&now!==null&&now>was;
  }).map(record=>record.id));
}

function recordSummary(record,{declared,rev,digest,withdraws,computed}){
  const proof=record.evidence;
  const stale=proof?.stale===true;
  return {id:record.id,path:record.path,schema:textOrNull(record.meta.schema),
    state:textOrNull(record.meta.state),rev:positiveInteger(rev)?rev:null,declaredKind:declared,computedKind:computed,
    normativeDigest:digest,withdraws,criteria:[...record.criteria.keys()].sort(byCodeUnit),
    evidence:proof?{recordDigest:textOrNull(proof.recordDigest),outcome:textOrNull(proof.outcome),stale}:null};
}

/**
 * `--work` alone decides everything a single checkout can decide; `--against` a previous tree decides
 * the transition itself. Without a baseline the transition findings are not evaluable, and the report
 * says so rather than calling the tree clean on checks it never ran.
 */
export function checkWorkChange({workRoot,baselineRoot=null}={}){
  if(!text(workRoot))throw new WorkChangeInputError('--work is required');
  const current=readWorkTree(workRoot);
  const baseline=baselineRoot===null||baselineRoot===undefined?null:readWorkTree(baselineRoot);
  const findings=[];
  const add=(code,record,detail,extra={})=>{findings.push({code,id:record.id,path:record.path,detail,...extra});};
  const summaries=checkRecords(current,baseline,add);

  // A record the check cannot read is not a clean record: it is a record nothing was decided about.
  const unreadable=[...current.unreadable.map(at=>({tree:'work',path:at})),...(baseline?baseline.unreadable.map(at=>({tree:'baseline',path:at})):[])];
  for(const item of unreadable)
    findings.push({code:'RECORD_UNREADABLE',id:`path:${item.path}`,path:item.path,
      detail:'the record is not readable YAML 1.2, so no change about it was decided',observed:item.tree});
  const sortedFindings = findings.toSorted((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id)||String(a.observed??'').localeCompare(String(b.observed??'')));
  return {schema:RESULT,workRoot:slash(current.root),baseline:baseline?slash(baseline.root):null,
    clean:findings.length===0,
    coverage:coverageOf(current,baseline,summaries,unreadable),
    records:summaries,findings:sortedFindings,
    limitations:limitationsOf(baseline)};
}

/** Every record of the work tree in id order: its declaration, baseline transition and evidence judged, its summary returned. */
function checkRecords(current,baseline,add){
  const summaries=[];
  const revMoved=revisionMovedIds(current,baseline);
  const coveredByOwner=record=>record.meta.schema==='work/acceptance-criterion@1'&&text(record.meta.rule)&&revMoved.has(record.meta.rule.trim());
  for(const record of [...current.records.values()].sort((a,b)=>a.id.localeCompare(b.id))){
    const previous=baseline?.records.get(record.id)??null;
    const info=changeInfo(record,previous,baseline);
    if(info.change)validateChangeDeclaration(record,info,add);
    if(baseline)validateBaselineChange(record,previous,info,coveredByOwner,add);
    validateEvidenceFreshness(record,previous,info,Boolean(baseline),add);
    summaries.push(recordSummary(record,info));
  }
  return summaries;
}

const coverageOf=(current,baseline,summaries,unreadable)=>({records:current.records.size,governed:summaries.filter(item=>item.declaredKind!==null).length,
  proven:summaries.filter(item=>item.evidence).length,stale:summaries.filter(item=>item.evidence?.stale).length,compared:baseline?summaries.filter(item=>item.computedKind!==null).length:0,
  unreadable:unreadable.map(item=>item.path)});

const limitationsOf=baseline=>[baseline?'The transition is computed between two given trees; neither is independently authenticated as the revision it claims to be.':'No baseline was given, so no transition was computed: the declared kind was not verified against the edit, withdrawals were not matched to a previous revision, and an undeclared edit cannot be seen. Pass --against a previous Work tree for those.',
  'Prose and lifecycle keys are excluded from the normative digest by name, so a normative obligation written into a description travels nowhere.',
  'Evidence staleness is judged from the evidence block the record carries, its recordDigest and its capture time; no proof was re-run and no assertion was re-observed.',
  'A manifest\'s recordDigest is the capturing kernel\'s own token and is not recomputed here: this module owns what an edit is, not what a record hashes to. It is compared between revisions, never to a value this check derives.',
  'Which proof kinds a record still owes (requiresProof) is a different question from how far its edit travelled, and is not decided here.',
  'This check reports and never repairs: it writes nothing into the Work tree.'];
