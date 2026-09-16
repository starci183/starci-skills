import path from 'node:path';
import {createHash} from 'node:crypto';
import {liveStatus,need,plain,readJson} from './common.mjs';

/**
 * The typed question record (`starci/question@1`): one question asked of the owner, bound to the goal
 * revision it was derived under. The model may author the question's CONTENT - the label, the closed
 * option set - but the record, its digest, its rendering and its answer are the kernel's. A question is
 * never a paragraph of prose that a terminal parses back into meaning; it is a value with a digest, and
 * every answer binds that digest so a reply written against one question can never settle another.
 */
export const QUESTION_RECORD='starci/question@1';
/** The answer envelope (`starci/question-answer@1`): `workflow-answer --envelope` and the typed path carry it. */
export const ANSWER_ENVELOPE='starci/question-answer@1';
export const FIELD_TYPES=Object.freeze(['select','multi','text','confirm']);
const CONFIRM_TRUE=['yes','true','confirmed','confirm'],CONFIRM_FALSE=['no','false','declined','decline'];

const clean=value=>typeof value==='string'?value.trim():'';
const list=value=>Array.isArray(value)?value:[];
/** Canonical JSON: object keys sorted at every depth, so the digest binds content, not key order. */
const stable=value=>Array.isArray(value)?value.map(stable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

/**
 * The goal revision a question is bound to. The goal machinery owns the counter; this module only reads it:
 * `state.goalRev` when the workflow carries it, the `rev` of `goal.json` when only the file advanced, else 1.
 */
export function goalRevOf(state,store=null){
  const direct=Number(state?.goalRev??state?.goal?.rev);
  if(Number.isInteger(direct)&&direct>0)return direct;
  const file=store?.paths?.goalJson?Number(readJson(store.paths.goalJson,null)?.rev):NaN;
  return Number.isInteger(file)&&file>0?file:1;
}

/* ------------------------------------------------------------------ the record */

/** One field of the record. `select`/`multi` carry a closed option set; `text`/`confirm` never do. */
function fieldOf(raw,index){
  need(plain(raw),`Question field ${index+1} is not an object`);
  const type=clean(raw.type)||(list(raw.options).length>1?'select':'text');
  need(FIELD_TYPES.includes(type),`Question field ${index+1} has unsupported type ${type}`);
  const id=clean(raw.id)||`field-${index+1}`;
  const label=clean(raw.label??raw.text);
  need(label,`Question field ${id} has no label`);
  const field={id,type,label};
  if(raw.required===false)field.required=false;
  if(type==='select'||type==='multi'){
    const options=list(raw.options).map((option,at)=>{
      const built=plain(option)?{id:clean(option.id)||String(at+1),label:clean(option.label??option.text)}:{id:String(at+1),label:clean(option)};
      need(built.label,`Option ${at+1} of field ${id} has no label`);
      return built;
    });
    need(options.length>(type==='select'?1:0),`Field ${id} is ${type} but offers ${options.length} options - a closed choice needs ${type==='select'?'at least two':'at least one'}`);
    need(new Set(options.map(option=>option.id)).size===options.length,`Field ${id} repeats an option id`);
    field.options=options;
  }else need(!list(raw.options).length,`Field ${id} is ${type} but carries options - only select and multi do`);
  return field;
}

/**
 * The canonical record. `goalRev` may be `null` for a record still travelling (a report file's copy): an
 * unbound record is a carrier of typed fields, never an answerable question - the kernel re-issues it under
 * the current revision before it can be answered. The digest is over the canonical record alone; answer
 * state never enters it.
 */
export function buildQuestion({questionId,goalRev=null,fields,context={},at}={}){
  const id=clean(questionId);
  need(id,'A question record needs a questionId');
  const rev=goalRev===null||goalRev===undefined?null:Number(goalRev);
  need(rev===null||(Number.isInteger(rev)&&rev>0),`Invalid goalRev ${goalRev} for question ${id}`);
  const built=list(fields).map(fieldOf);
  need(built.length,`Question ${id} carries no fields`);
  need(new Set(built.map(field=>field.id)).size===built.length,`Question ${id} repeats a field id`);
  const record={schema:QUESTION_RECORD,questionId:id,goalRev:rev,fields:built,context:plain(context)?{...context}:{},askedAt:Number(at)||Date.now()};
  return {...record,digest:hash({schema:record.schema,questionId:record.questionId,goalRev:record.goalRev,fields:record.fields,context:record.context})};
}

/** Check a record without building it: shape, field schema, and that the digest is the canonical one. */
export function validateQuestion(record){
  const errors=[];
  if(!plain(record)||record.schema!==QUESTION_RECORD)return {ok:false,errors:['Not a starci/question@1 record']};
  if(!clean(record.questionId))errors.push('questionId is missing');
  if(record.goalRev!==null&&!(Number.isInteger(record.goalRev)&&record.goalRev>0))errors.push(`goalRev ${record.goalRev} is not a positive revision or null`);
  if(!list(record.fields).length)errors.push('fields is empty');
  else list(record.fields).forEach((field,index)=>{try{fieldOf(field,index);}catch(error){errors.push(String(error.message));}});
  if(!plain(record.context))errors.push('context is not an object');
  if(!errors.length&&clean(record.digest)!==hash({schema:record.schema,questionId:record.questionId,goalRev:record.goalRev,fields:record.fields,context:record.context}))
    errors.push('digest does not match the canonical record');
  return {ok:errors.length===0,errors};
}

/**
 * The loose question a report or an op carries (`{text, options, kind}`) as typed fields: a closed set of
 * two or more options is a `select`, anything else is a `text`. An `options` member may be a bare label or
 * `{id,label}`; its id is the answerable value, its position only chooses the default id.
 */
export function questionFields(question){
  const text=clean(question?.text);
  const options=list(question?.options).map((option,index)=>plain(option)
    ?{id:clean(option.id)||String(index+1),label:clean(option.label??option.text)}
    :{id:String(index+1),label:clean(option)}).filter(option=>option.label);
  return [options.length>1
    ?{id:'answer',type:'select',label:text,options}
    :{id:'answer',type:'text',label:text}];
}

/** The record a report carries: typed fields over the question the worker declared, bound where the caller knows it. */
export function recordForQuestion(question,{questionId,goalRev=null,context={},at}={}){
  return buildQuestion({questionId,goalRev,fields:questionFields(question),context,at});
}

/* ------------------------------------------------------------------ the renderer */

/**
 * The one renderer for a question record, written for the Orca terminal: the model never writes this
 * markup. Closed fields render their numbered options; `text` asks for a line and `confirm` offers
 * yes/no - always in this order, always in this shape, so an answer number means the same thing everywhere
 * the question is shown.
 */
export function renderQuestion(record){
  need(plain(record)&&list(record.fields).length,`Cannot render question ${record?.questionId??'(none)'}: it has no fields`);
  const lines=[`Question ${clean(record.questionId)}${record.goalRev?` (goal rev ${record.goalRev})`:' (goal revision unbound)'}`];
  for(const [key,value] of Object.entries(record.context??{}))
    if(typeof value==='string'&&value.trim())lines.push(`  ${key}: ${value.trim().slice(0,240)}`);
  record.fields.forEach((field,index)=>{
    const hint={select:'choose one',multi:'choose any',text:'free text',confirm:'confirm'}[field.type]??field.type;
    lines.push(`${index+1}. ${field.label} - ${hint}`);
    if(field.type==='select'||field.type==='multi')field.options.forEach((option,at)=>lines.push(`   ${at+1}) ${option.label}`));
    if(field.type==='confirm')lines.push('   1) yes','   2) no');
  });
  return lines;
}

/* ------------------------------------------------------------------ the answer */

/** The canonical answer envelope. `answers` is keyed by field id; `note` is a free annotation, never an answer. */
export function buildAnswer({questionId,digest,goalRev,answers,note,at}={}){
  need(clean(questionId),'An answer envelope needs questionId');
  need(clean(digest),`An answer to ${questionId} needs the question digest`);
  need(Number.isInteger(Number(goalRev))&&Number(goalRev)>0,`An answer to ${questionId} needs a positive goalRev`);
  need(plain(answers),`An answer to ${questionId} needs an answers object`);
  return {schema:ANSWER_ENVELOPE,questionId:clean(questionId),digest:clean(digest),goalRev:Number(goalRev),answers:{...answers},
    ...(clean(note)?{note:clean(note)}:{}),answeredAt:Number(at)||Date.now()};
}

/**
 * `--choice <n>` / `--note "..."` on an envelope: the command line's positional answer becomes the typed
 * one. A number picks the n-th offered option BY ID; a note answers a `text` field, and on a question that
 * has none it is an annotation on the envelope - never a smuggled-in option.
 */
export function envelopeForCommand(record,{choice=null,note=null}={}){
  const answers={};
  const picked=choice!==null&&choice!==undefined&&String(choice).trim()?String(choice).trim():null;
  for(const field of record.fields){
    if(field.type==='select'&&picked)answers[field.id]=field.options[Number(picked)-1]?.id??picked;
    else if(field.type==='multi'&&picked)
      answers[field.id]=picked.split(',').map(part=>Number(part.trim())-1).filter(at=>at>=0).map(at=>field.options[at]?.id??String(at+1));
    else if(field.type==='confirm'&&picked){const at=Number(picked)-1;answers[field.id]=at===0?'yes':at===1?'no':picked;}
    else if(field.type==='text'&&clean(note))answers[field.id]=clean(note);
    else if(field.type==='text'&&picked&&record.fields.every(item=>item.type==='text'))answers[field.id]=picked;
  }
  const annotated=clean(note)&&!record.fields.some(field=>field.type==='text');
  return {schema:ANSWER_ENVELOPE,questionId:record.questionId,digest:record.digest,goalRev:record.goalRev,answers,...(annotated?{note:clean(note)}:{})};
}

function fieldAnswer(field,value,errors){
  if(field.type==='select'){
    const option=field.options.find(item=>item.id===String(value??'').trim());
    if(option)return {option:option.id,label:option.label};
    errors.push(`${field.id}: "${String(value??'')}" is not one of the offered options (${field.options.map(item=>item.id).join(', ')})`);return null;
  }
  if(field.type==='multi'){
    const values=list(value).map(item=>String(item??'').trim());
    if(!Array.isArray(value)){errors.push(`${field.id}: expected a list of offered option ids`);return null;}
    const bad=values.filter(item=>!field.options.some(option=>option.id===item));
    if(bad.length){errors.push(`${field.id}: ${bad.join(', ')} ${bad.length===1?'is':'are'} not offered`);return null;}
    const ids=[...new Set(values)];
    return {options:ids,labels:ids.map(id=>field.options.find(option=>option.id===id).label)};
  }
  if(field.type==='text'){
    const text=clean(value);
    if(!text){errors.push(`${field.id}: expected a non-empty text answer`);return null;}
    return {text:text.slice(0,4000)};
  }
  const lowered=String(value??'').trim().toLowerCase();
  if(value===true||CONFIRM_TRUE.includes(lowered))return {confirmed:true};
  if(value===false||CONFIRM_FALSE.includes(lowered))return {confirmed:false};
  errors.push(`${field.id}: expected a confirmation (yes/no), got "${String(value??'')}"`);return null;
}

/**
 * Validate an answer envelope against the record it names. Identity first - the answer must bind the exact
 * question (id, revision and content digest) - then every field: a `select` value must be an offered option
 * id, `multi` a list of them, `text` a string, `confirm` a yes/no. Nothing is coerced into a nearby option:
 * an answer that does not fit is rejected, and the question stays open to be answered again.
 */
export function validateAnswer(record,envelope){
  const errors=[],values={};
  if(!plain(envelope))return {ok:false,errors:['The answer is not an object'],values};
  if(envelope.schema!==undefined&&envelope.schema!==ANSWER_ENVELOPE)errors.push(`Unsupported answer schema ${envelope.schema}`);
  if(clean(envelope.questionId)!==record.questionId)errors.push(`the answer names ${clean(envelope.questionId)||'no question'}, not ${record.questionId}`);
  if(Number(envelope.goalRev)!==record.goalRev)errors.push(`the answer binds goal rev ${envelope.goalRev??'?'} but the question binds rev ${record.goalRev}`);
  if(clean(envelope.digest)!==record.digest)errors.push('the answer binds different question content (digest mismatch)');
  const answers=plain(envelope.answers)?envelope.answers:null;
  if(!answers)errors.push('answers must be an object keyed by field id');
  for(const key of Object.keys(answers??{}))if(!record.fields.some(field=>field.id===key))errors.push(`unknown field ${key}`);
  for(const field of record.fields){
    if(answers&&!(field.id in answers)){if(field.required!==false)errors.push(`missing answer for field ${field.id}`);continue;}
    if(answers){const value=fieldAnswer(field,answers[field.id],errors);if(value!==null)values[field.id]=value;}
  }
  return {ok:errors.length===0,errors,values};
}

/* ------------------------------------------------------------------ lifecycle */

/** A record is stale when the revision it binds is not the workflow's current one. */
export const questionStale=(record,goalRev)=>plain(record)&&Number.isInteger(Number(goalRev))&&Number(goalRev)>0&&record.goalRev!==Number(goalRev);

/** The same question asked again under a new revision: new digest, and `supersedes` names what it replaces. */
export function reaskQuestion(record,goalRev,{at}={}){
  return buildQuestion({questionId:record.questionId,goalRev,fields:record.fields,
    context:{...(plain(record.context)?record.context:{}),supersedes:record.digest},at});
}

/**
 * Issue a question: build the record bound to the workflow's current goal revision, store it on the op as
 * `question.typed`, and journal `asked`. Issuing the same content under the same revision twice is one
 * question, not two - the existing record stands and no second event is written.
 */
export function issueQuestion(store,state,op,{fields=null,context={},at}={}){
  const goalRev=goalRevOf(state,store);
  const record=buildQuestion({questionId:op.id,goalRev,
    fields:fields??questionFields({text:op.question?.text??op.goal,options:op.question?.options}),
    context:{op:op.id,kind:op.question?.kind??'decision',...(op.question?.from?{from:op.question.from}:{}),...context},at});
  const existing=plain(op.question?.typed)?op.question.typed:null;
  if(existing&&existing.digest===record.digest)return existing;
  op.question={...(op.question??{}),typed:record};
  store.appendEvent({event:'asked',op:op.id,question:record.questionId,digest:record.digest,goalRev:record.goalRev,fields:record.fields.length});
  return record;
}

/**
 * Every open question bound to an older revision is stale: it is re-asked under the current one (new digest)
 * and the move is journaled. A question already settled is left on the record as history - nothing re-asks
 * a question the owner already answered.
 */
export function markStaleQuestions(store,state,{goalRev=goalRevOf(state,store),at}={}){
  const reasked=[];
  for(const op of list(state?.ops)){
    const record=plain(op?.question?.typed)?op.question.typed:null;
    if(!record||!questionStale(record,goalRev))continue;
    const open=(liveStatus.includes(op.status)||(op.status==='blocked'&&!op.refusal))&&!op.answer&&!op.ownerAnswer;
    let fresh=null;
    if(open){
      fresh=reaskQuestion(record,goalRev,{at});
      op.question={...op.question,typed:fresh};delete op.question.presentation;
      op.ownerRequestRevision=Number(op.ownerRequestRevision??0)+1;
      reasked.push(op.id);
      store.appendEvent({event:'asked',op:op.id,question:fresh.questionId,digest:fresh.digest,goalRev:fresh.goalRev,fields:fresh.fields.length,reason:'re-asked under the current goal revision'});
    }
    store.appendEvent({event:'question-stale',op:op.id,question:record.questionId,digest:record.digest,from:record.goalRev,to:goalRev,...(fresh?{reasked:fresh.digest}:{})});
  }
  return reasked;
}

/** The kernel's own answer to a question, journaled as itself - never confused with the owner's `answered`. */
export function noteKernelAnswer(store,op,record,{option=null,label=null,instructions=null,reason=null}={}){
  store.appendEvent({event:'kernel-answer',op:op.id,question:record?.questionId??null,digest:record?.digest??null,
    goalRev:record?.goalRev??null,option:option===null?null:String(option),label:label??null,
    ...(instructions?{instructions:String(instructions).slice(0,400)}:{}),reason:reason??null});
}

/**
 * The `--envelope` / `--envelope-file` argument of `workflow-answer`: a typed answer envelope as inline JSON
 * or a file. Parsing lives here so the command line and the inbox command carry the same shape.
 */
export function answerEnvelopeArg(options){
  const inline=clean(options?.envelope),file=clean(options?.['envelope-file']);
  if(!inline&&!file)return null;
  let raw=null;
  if(inline){try{raw=JSON.parse(inline);}catch{need(false,'--envelope is not valid JSON');}}
  else raw=readJson(path.resolve(file),null);
  need(plain(raw),'--envelope must be a JSON object with questionId, digest, goalRev and answers');
  return raw;
}
