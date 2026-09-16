import crypto from 'node:crypto';
import {normalizePolicyOptions} from '../core/policy-options.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clean=value=>typeof value==='string'?value.trim():'';
const list=value=>Array.isArray(value)?value:[];
const stable=value=>Array.isArray(value)?value.map(stable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const label=value=>clean(plain(value)?value.label??value.text:value).replace(/^\d+\.\s*/, '').replace(/\s+/g,' ');
const sameLabel=(left,right)=>label(left).toLocaleLowerCase('en-US')===label(right).toLocaleLowerCase('en-US');
function validDecisionRecord(raw,recordId){
  const payload=raw?.extensions?.work3?.srs;
  return plain(raw)&&raw.schema==='work/node@2'&&clean(raw.id)===recordId&&raw.kind==='business'&&plain(payload)
    &&payload.schema==='starci/srs-policy-decision@1'&&payload.decisionStatus==='open'
    &&['id','title','accountableRole','question','safeDisposition','closureCriteria'].every(key=>clean(payload[key]));
}

function readDecisionRecord(state,ask,ctx){
  const marker=(state.needUser??[]).find(item=>item.op===ask?.id&&item.kind==='decision'&&clean(item.record));
  const ids=[marker?.record,ask?.question?.record,ask?.ownerAnswer?.decisionRecord].map(clean).filter(Boolean);
  if(new Set(ids).size>1)return {ok:false,code:'decision-record-mismatch',reason:'the owner question, receipt and canonical decision marker name different records'};
  const recordId=ids[0]??'';
  if(!recordId)return {ok:false,code:'decision-record-unavailable',reason:'the owner question names no canonical decision record'};
  if(!ctx?.work)return {ok:false,code:'decision-work-unavailable',reason:'the canonical Work binding is unavailable'};
  const node=ctx.work.node(recordId);if(!node)return {ok:false,code:'decision-record-unavailable',reason:`the canonical Work tree has no record ${recordId}`};
  let raw;try{raw=ctx.work.api.readNode(ctx.work.at,node);}catch{return {ok:false,code:'decision-record-unreadable',reason:`the canonical decision record ${recordId} cannot be read`};}
  if(!validDecisionRecord(raw,recordId))return {ok:false,code:'decision-record-invalid',reason:`the canonical decision record ${recordId} is not an open work/node@2 business policy decision`};
  return {ok:true,marker,node,raw,recordId,payload:raw.extensions.work3.srs};
}

export function canonicalDecisionInput(state,ask,ctx){
  const record=readDecisionRecord(state,ask,ctx);if(!record.ok)return record;
  const {recordId,node,raw}=record;
  // requiredDecisions is the agenda of questions to settle, never their answers.
  const options=normalizePolicyOptions(raw.extensions.work3.srs.options);
  if(!options)return {ok:false,code:'decision-options-invalid',recordId,recordPath:node.path,question:clean(raw.extensions.work3.srs.question),
    reason:`Repair the canonical decision draft ${recordId}: options must contain at least two distinct concrete policy alternatives. requiredDecisions lists unresolved topics and cannot supply owner choices.`};
  const digest=hash({recordId,raw,options});
  return {ok:true,recordId,recordPath:node.path,question:clean(raw.extensions.work3.srs.question),options:options.map((label,index)=>({id:String(index+1),label})),digest};
}

function legacyTopicSelection(state,ask,ctx){
  if(ask?.kind!=='decision.prepare'||ask.refusal==='superseded'||ask.ownerRequestStatus!=='answered'||ask.status!=='done')return null;
  const answer=ask.ownerAnswer,receiptId=clean(answer?.receiptId);
  if(answer?.via!=='owner'||answer?.type!=='choose'||!receiptId||clean(ask.ownerContinuationReceipt)!==receiptId)return null;
  const record=readDecisionRecord(state,ask,ctx);if(!record.ok)return null;
  const topics=list(record.payload.requiredDecisions).map(label).filter(Boolean),oldOptions=list(ask.question?.options).map(label).filter(Boolean);
  const chosen=oldOptions[Number(answer.value)-1]??'';
  const exactAgenda=topics.length>0&&oldOptions.every(option=>topics.some(topic=>sameLabel(option,topic)))&&topics.some(topic=>sameLabel(topic,answer.selectedLabel));
  const canonicalInvalidation=list(record.payload.authorityRefs).map(clean).some(ref=>ref.includes(receiptId)&&ref.includes(ask.id)
    &&/\bselected topic\b/i.test(ref)&&/\bdid not settle\b/i.test(ref));
  const questionAgenda=oldOptions.every(option=>/^(whether|which|what|who|where|when|how)\b/i.test(option));
  if(oldOptions.length<2||!sameLabel(chosen,answer.selectedLabel)||(!exactAgenda&&!(canonicalInvalidation&&questionAgenda)))return null;
  const explicit=normalizePolicyOptions(record.payload.options);
  if(explicit?.some(option=>sameLabel(option,answer.selectedLabel)))return null;
  const requesters=list(ask.requesters).map(id=>state.ops.find(item=>item.id===id)).filter(Boolean);
  const linked=requesters.filter(item=>list(item.ownerContinuationReceipts).includes(receiptId));
  if(!linked.length||linked.some(item=>!['ready','pending','paused','blocked'].includes(item.status)))return null;
  return {...record,answer,receiptId,requesters:linked};
}

function withdrawLegacyTopicSelection(store,state,ask,ctx){
  const legacy=legacyTopicSelection(state,ask,ctx);if(!legacy)return false;
  const snapshot={schema:'starci/legacy-owner-decision-history@1',reason:'agenda-topic-was-not-a-policy-outcome',record:legacy.recordId,
    receiptId:legacy.receiptId,ownerAnswer:structuredClone(ask.ownerAnswer),
    ...(ask.answer!==undefined?{answer:structuredClone(ask.answer)}:{}),ownerContinuationReceipt:ask.ownerContinuationReceipt,
    decisionOptionsDigest:ask.decisionOptionsDigest??null,ownerRequestStatus:ask.ownerRequestStatus,
    ownerRequestRevision:Number(ask.ownerRequestRevision??0),question:structuredClone(ask.question),operation:{status:ask.status,attempt:Number(ask.attempt??0),
      refusal:ask.refusal??null,verdict:ask.verdict??null,dispatch:ask.dispatch??null,terminal:ask.terminal??null,
      candidateDigest:ask.candidateDigest??null,oracleDigest:ask.oracleDigest??null},requesters:legacy.requesters.map(requester=>({
      id:requester.id,status:requester.status,...(requester.answer!==undefined?{answer:structuredClone(requester.answer)}:{}),
      ownerContinuationReceipts:[...list(requester.ownerContinuationReceipts)],waitingFor:requester.waitingFor??null,dependsOn:[...list(requester.dependsOn)]}))};
  ask.ownerDecisionHistory=[...list(ask.ownerDecisionHistory),snapshot];
  for(const key of ['ownerAnswer','answer','ownerContinuationReceipt','ownerVerification','decisionOptionsDigest','decisionInputError','ownerRequestUpdatedAt'])delete ask[key];
  ask.ownerRequestStatus='preparing';ask.ownerRequestRevision=Number(snapshot.ownerRequestRevision)+1;
  ask.status='ready';ask.attempt=Number(ask.attempt??0)+1;ask.dispatch=null;ask.terminal=null;ask.nudged=false;ask.findings=[];ask.priorOpen=[];ask.retryFromCanonical=true;
  if(ask.refusal==='runtime-reconciliation')delete ask.refusal;
  for(const key of ['lease','pending','workerSettled','retryReconciled','baseHead','kernelOwnedAt','recordBlocks','quarantineSignature'])delete ask[key];
  for(const requester of legacy.requesters){
    requester.ownerContinuationReceipts=list(requester.ownerContinuationReceipts).filter(id=>id!==legacy.receiptId);
    if(!requester.ownerContinuationReceipts.length)delete requester.ownerContinuationReceipts;
    if(typeof requester.answer==='string'&&requester.answer.startsWith(`Authenticated owner action ${legacy.receiptId} `))delete requester.answer;
    requester.dependsOn=[...new Set([...list(requester.dependsOn),ask.id])];
    if(requester.status==='ready')requester.status='pending';
  }
  state.needUser??=[];
  if(!state.needUser.some(item=>item.op===ask.id&&item.kind==='decision'))state.needUser.push({op:ask.id,kind:'decision',record:legacy.recordId,options:[],requesters:legacy.requesters.map(item=>item.id)});
  store.appendEvent({event:'legacy-decision-semantics-withdrawn',ask:ask.id,record:legacy.recordId,receiptId:legacy.receiptId,
    requesters:legacy.requesters.map(item=>item.id),reason:'authenticated receipt selected a requiredDecisions agenda topic rather than a canonical policy option'});
  return true;
}

/** Refresh unanswered owner decisions from canonical Work without writing a Work byte. */
export function reconcileCanonicalDecisionInputs(store,state,ctx){
  const changed=new Set();
  for(const ask of (state.ops??[]).filter(op=>op.kind==='decision.prepare'&&op.refusal!=='superseded')){
    const withdrawn=withdrawLegacyTopicSelection(store,state,ask,ctx);if(withdrawn)changed.add(ask.id);
    if(ask.answer||ask.ownerAnswer)continue;
    const marker=(state.needUser??[]).find(item=>item.op===ask.id&&item.kind==='decision'&&clean(item.record));if(!marker)continue;
    const resolved=canonicalDecisionInput(state,ask,ctx),before=ask.decisionOptionsDigest??null;
    if(!resolved.ok){const priorError=ask.decisionInputError?.code;ask.ownerRequestStatus='preparing';ask.decisionInputError={code:resolved.code,reason:resolved.reason};ask.question={...(ask.question??{}),record:clean(marker.record),
      ...(clean(resolved.question)?{text:resolved.question,subject:resolved.question}:{}),options:[]};delete ask.question.presentation;marker.options=[];
      if(before!==null){ask.ownerRequestRevision=Number(ask.ownerRequestRevision??0)+1;delete ask.decisionOptionsDigest;}
      if(priorError!==resolved.code)store.appendEvent({event:'canonical-decision-input-unavailable',ask:ask.id,record:clean(marker.record),code:resolved.code});continue;}
    ask.question={...(ask.question??{}),record:resolved.recordId,text:resolved.question,subject:resolved.question,options:resolved.options};marker.options=resolved.options.map(option=>option.label);
    if(before!==resolved.digest)delete ask.question.presentation;
    if(withdrawn)ask.status='done';
    ask.ownerRequestStatus='waiting-owner';delete ask.decisionInputError;ask.decisionOptionsDigest=resolved.digest;
    if(before!==resolved.digest){ask.ownerRequestRevision=Number(ask.ownerRequestRevision??0)+1;changed.add(ask.id);store.appendEvent({event:'canonical-decision-input-reconciled',ask:ask.id,record:resolved.recordId,options:resolved.options.length,digest:resolved.digest});}
  }
  return [...changed];
}
