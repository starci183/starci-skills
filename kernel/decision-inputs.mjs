import crypto from 'node:crypto';
import {normalizePolicyOptions} from '../core/policy-options.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clean=value=>typeof value==='string'?value.trim():'';
const stable=value=>Array.isArray(value)?value.map(stable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function validDecisionRecord(raw,recordId){
  const payload=raw?.extensions?.work3?.srs;
  return plain(raw)&&raw.schema==='work/node@2'&&clean(raw.id)===recordId&&raw.kind==='business'&&plain(payload)
    &&payload.schema==='starci/srs-policy-decision@1'&&payload.decisionStatus==='open'
    &&['id','title','accountableRole','question','safeDisposition','closureCriteria'].every(key=>clean(payload[key]));
}

export function canonicalDecisionInput(state,ask,ctx){
  const marker=(state.needUser??[]).find(item=>item.op===ask?.id&&item.kind==='decision'&&clean(item.record));
  const markerRecord=clean(marker?.record),questionRecord=clean(ask?.question?.record);
  if(markerRecord&&questionRecord&&markerRecord!==questionRecord)return {ok:false,code:'decision-record-mismatch',reason:'the owner question and canonical decision marker name different records'};
  const recordId=markerRecord||questionRecord;
  if(!recordId)return {ok:false,code:'decision-record-unavailable',reason:'the owner question names no canonical decision record'};
  if(!ctx?.work)return {ok:false,code:'decision-work-unavailable',reason:'the canonical Work binding is unavailable'};
  const node=ctx.work.node(recordId);if(!node)return {ok:false,code:'decision-record-unavailable',reason:`the canonical Work tree has no record ${recordId}`};
  let raw;try{raw=ctx.work.api.readNode(ctx.work.at,node);}catch{return {ok:false,code:'decision-record-unreadable',reason:`the canonical decision record ${recordId} cannot be read`};}
  if(!validDecisionRecord(raw,recordId))return {ok:false,code:'decision-record-invalid',reason:`the canonical decision record ${recordId} is not an open work/node@2 business policy decision`};
  // requiredDecisions is the agenda of questions to settle, never their answers.
  const options=normalizePolicyOptions(raw.extensions.work3.srs.options);
  if(!options)return {ok:false,code:'decision-options-invalid',reason:`Repair the canonical decision draft ${recordId}: options must contain at least two distinct concrete policy alternatives. requiredDecisions lists unresolved topics and cannot supply owner choices.`};
  const digest=hash({recordId,raw,options});
  return {ok:true,recordId,recordPath:node.path,question:clean(raw.extensions.work3.srs.question),options:options.map((label,index)=>({id:String(index+1),label})),digest};
}

/** Refresh unanswered owner decisions from canonical Work without writing a Work byte. */
export function reconcileCanonicalDecisionInputs(store,state,ctx){
  const changed=[];
  for(const ask of (state.ops??[]).filter(op=>op.kind==='decision.prepare'&&!op.answer&&!op.ownerAnswer&&op.refusal!=='superseded')){
    const marker=(state.needUser??[]).find(item=>item.op===ask.id&&item.kind==='decision'&&clean(item.record));if(!marker)continue;
    const resolved=canonicalDecisionInput(state,ask,ctx),before=ask.decisionOptionsDigest??null;
    if(!resolved.ok){const priorError=ask.decisionInputError?.code;ask.ownerRequestStatus='preparing';ask.decisionInputError={code:resolved.code,reason:resolved.reason};ask.question={...(ask.question??{}),record:clean(marker.record),options:[]};delete ask.question.presentation;marker.options=[];
      if(before!==null){ask.ownerRequestRevision=Number(ask.ownerRequestRevision??0)+1;delete ask.decisionOptionsDigest;}
      if(priorError!==resolved.code)store.appendEvent({event:'canonical-decision-input-unavailable',ask:ask.id,record:clean(marker.record),code:resolved.code});continue;}
    ask.question={...(ask.question??{}),record:resolved.recordId,text:resolved.question,subject:resolved.question,options:resolved.options};marker.options=resolved.options.map(option=>option.label);
    if(before!==resolved.digest)delete ask.question.presentation;
    ask.ownerRequestStatus='waiting-owner';delete ask.decisionInputError;ask.decisionOptionsDigest=resolved.digest;
    if(before!==resolved.digest){ask.ownerRequestRevision=Number(ask.ownerRequestRevision??0)+1;changed.push(ask.id);store.appendEvent({event:'canonical-decision-input-reconciled',ask:ask.id,record:resolved.recordId,options:resolved.options.length,digest:resolved.digest});}
  }
  return changed;
}
