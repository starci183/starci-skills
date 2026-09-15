import crypto from 'node:crypto';

export const OWNER_REQUEST_KINDS=['information','credential','account','access','consent','authority','business-decision','irreversible-confirmation'];
export const OWNER_REQUEST_STATES=['preparing','waiting-owner','answered','saved','verifying','verified','needs-correction','stale','cancelled'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clean=value=>typeof value==='string'?value.trim():'';
const list=value=>Array.isArray(value)?value:[];
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
const askKind=ask=>{
  const raw=clean(ask?.question?.kind||ask?.question?.stop);
  if(OWNER_REQUEST_KINDS.includes(raw))return raw;
  if(raw==='decision')return 'business-decision';
  if(raw==='provision')return 'information';
  return ask?.credential?'credential':'information';
};

export function requestKey(spec){
  return digest([clean(spec?.workflowId),clean(spec?.opId),Number(spec?.attempt??0),Number(spec?.generation??0),clean(spec?.jobId),clean(spec?.kind),clean(spec?.subject),clean(spec?.optionsDigest)]);
}

function guidance(ask){
  const preparation=list(ask?.credential?.preparations).find(item=>plain(item?.preparation))?.preparation??null;
  return {
    what:clean(ask?.question?.what||ask?.question?.text||ask?.goal),
    why:clean(ask?.question?.why||ask?.reason),
    where:clean(ask?.question?.where||preparation?.credential?.obtain),
    docs:list(ask?.question?.docs).concat(list(preparation?.sources)).filter(plain).map(source=>({title:clean(source.title),url:clean(source.url)})).filter(source=>source.url),
    prepared:list(ask?.question?.prepared).map(clean).filter(Boolean),
    ownerSteps:list(ask?.question?.ownerSteps).concat(list(preparation?.prerequisites).filter(step=>step?.owner==='owner')).map(step=>({action:clean(step.action),reason:clean(step.reason)})).filter(step=>step.action),
    afterSubmit:clean(ask?.question?.afterSubmit)
  };
}

/** Owner requests are projections of canonical ask operations. They are never an independent decision store. */
export function deriveOwnerRequests(state,{now=Date.now}={}){
  const workflowId=clean(state?.id),generation=Number(state?.engine?.generation??state?.generation??0),workflowJobId=clean(state?.engine?.jobId||state?.jobId);
  const decisionMarkers=new Map(list(state?.needUser).filter(item=>item?.kind==='decision'&&clean(item.op)&&clean(item.record)).map(item=>[clean(item.op),item]));
  return list(state?.ops).filter(ask=>{
    const legacyDecision=ask?.kind==='decision.prepare'&&!ask.ownerAnswer&&!ask.answer&&decisionMarkers.has(clean(ask.id));
    // A decision the kernel has not launched yet (queued behind the canonical writer) is shown as preparing, so the
    // owner sees every question the workflow will ask, not only the one being worked on.
    return ask?.question&&ask.refusal!=='superseded'&&ask.status!=='cancelled'&&ask.ownerRequestStatus!=='cancelled'&&(legacyDecision||OWNER_REQUEST_STATES.includes(ask.ownerRequestStatus)
      ||(!ask.ownerAnswer&&['running','waiting-owner','blocked','ready','pending'].includes(ask.status)&&(ask.kind==='provision.ask'||ask.kind==='decision.prepare')));
  }).map(ask=>{
    const decisionMarker=decisionMarkers.get(clean(ask.id)),kind=decisionMarker?'business-decision':askKind(ask),answer=plain(ask.ownerAnswer)?ask.ownerAnswer:null,verification=plain(ask.ownerVerification)?ask.ownerVerification:null;
    let status=clean(ask.ownerRequestStatus);
    if(!OWNER_REQUEST_STATES.includes(status))status=answer?(kind==='credential'?'saved':'answered'):['ready','pending'].includes(ask.status)?'preparing':'waiting-owner';
    if(verification?.status==='verified')status='verified';
    else if(verification?.status==='rejected')status='needs-correction';
    const subject=clean(ask?.question?.subject||ask?.credential?.provider||ask?.question?.text||ask.id);
    const base={workflowId,opId:clean(ask.id),attempt:Number(ask.attempt??ask.restarts??0),generation,jobId:clean(ask.jobId)||workflowJobId,kind,subject,optionsDigest:clean(ask.decisionOptionsDigest)||null};
    const optionSource=list(ask?.question?.options).length?ask.question.options:list(ask?.options).length?ask.options:list(decisionMarker?.options);
    return {...base,id:requestKey(base),status,revision:Number(ask.ownerRequestRevision??0),guidance:guidance(ask),decisionRecord:clean(decisionMarker?.record||ask?.question?.record)||null,
      options:optionSource.map((value,index)=>plain(value)?{id:clean(value.id)||String(index+1),label:clean(value.label||value.text)}:{id:String(index+1),label:clean(value)}).filter(item=>item.label).map((item,index)=>({...item,recommended:Number(ask?.question?.recommended)===index+1})),
      presentation:plain(ask?.question?.presentation)?{language:clean(ask.question.presentation.language),text:clean(ask.question.presentation.text),options:list(ask.question.presentation.options).map((label,index)=>({id:String(index+1),label:clean(plain(label)?label.label:label)})).filter(item=>item.label)}:null,
      credential:kind==='credential'?{custody:clean(ask?.credential?.custody),variables:list(ask?.credential?.variables).map(clean).filter(Boolean)}:null,
      updatedAt:Number(ask.ownerRequestUpdatedAt??now())};
  });
}

export const ownerRequestView=(state,options)=>({workflowId:clean(state?.id),requests:deriveOwnerRequests(state,options)});

function actualOwner(action){
  return action?.actor?.type==='owner'&&clean(action?.actor?.receiptId)&&clean(action?.actor?.channel);
}

/** Kernel-side transition. HTTP/UI code may enqueue this action but must never call it. */
export function applyOwnerAction(state,action,{now=Date.now,verificationReceipts=[]}={}){
  const kernelVerification=action?.type==='verification'&&action?.actor?.type==='kernel'&&clean(action?.actor?.receiptId);
  if(!plain(action)||(action?.type==='verification'?!kernelVerification:!actualOwner(action)))return {ok:false,code:'owner-receipt-required'};
  const current=deriveOwnerRequests(state,{now}).find(item=>item.id===action.requestId);
  if(!current)return {ok:false,code:'request-stale'};
  if(action.workflowId!==current.workflowId||Number(action.generation)!==current.generation||Number(action.revision)!==current.revision)return {ok:false,code:'request-stale',current};
  if(current.kind==='business-decision'&&clean(action.optionsDigest)!==clean(current.optionsDigest))return {ok:false,code:'decision-options-stale',current};
  const ask=list(state.ops).find(item=>item.id===current.opId);
  if(!ask)return {ok:false,code:'request-stale'};
  const type=clean(action.type),value=action.value;
  if(type==='credential-saved'){
    if(current.kind!=='credential'||!plain(action.storageReceipt)||action.storageReceipt.status!=='present'||clean(action.storageReceipt.custody)!==current.credential?.custody)return {ok:false,code:'custody-receipt-required'};
    const names=list(action.storageReceipt.variables).map(clean).sort();
    if(JSON.stringify(names)!==JSON.stringify(list(current.credential?.variables).map(clean).sort()))return {ok:false,code:'custody-receipt-mismatch'};
    ask.ownerAnswer={via:'owner',receiptId:action.actor.receiptId,channel:action.actor.channel,kind:'credential-presence',storageReceipt:structuredClone(action.storageReceipt)};
    ask.ownerRequestStatus='saved';
  }else if(type==='answer'||type==='choose'||type==='confirm'){
    if(current.kind==='credential')return {ok:false,code:'credential-requires-custody'};
    if((current.kind==='authority'||current.kind==='consent'||current.kind==='irreversible-confirmation')&&type!=='confirm')return {ok:false,code:'explicit-confirmation-required'};
    if(type==='choose'&&!current.options.some(option=>option.id===clean(value)))return {ok:false,code:'invalid-choice'};
    if(type==='answer'&&!clean(value))return {ok:false,code:'answer-required'};
    if(type==='confirm'&&value!==true)return {ok:false,code:'confirmation-required'};
    const selected=type==='choose'?current.options.find(option=>option.id===clean(value)):null;
    ask.ownerAnswer={via:'owner',receiptId:action.actor.receiptId,channel:action.actor.channel,type,value:type==='answer'?clean(value):value,
      ...(selected?{selectedLabel:selected.label}:{}),...(current.decisionRecord?{decisionRecord:current.decisionRecord}:{})};
    if(current.decisionRecord||selected)ask.question={...ask.question,...(current.decisionRecord?{record:current.decisionRecord}:{}),
      ...(current.options.length?{options:current.options.map(option=>({id:option.id,label:option.label}))}:{})};
    ask.ownerRequestStatus='answered';
  }else if(type==='verification'){
    const receipt=list(verificationReceipts).find(item=>item?.id===action.verificationReceiptId&&item?.requestId===current.id&&item?.origin==='kernel-verification');
    if(!receipt||!['verified','rejected'].includes(receipt.status))return {ok:false,code:'verification-receipt-required'};
    ask.ownerVerification={receiptId:receipt.id,status:receipt.status,at:receipt.at??now()};
    ask.ownerRequestStatus=receipt.status==='verified'?'verified':'needs-correction';
  }else if(type==='reopen'){
    ask.ownerRequestStatus='waiting-owner';
  }else return {ok:false,code:'unsupported-action'};
  ask.ownerRequestRevision=current.revision+1;ask.ownerRequestUpdatedAt=now();
  const request=deriveOwnerRequests(state,{now}).find(item=>item.opId===current.opId);
  return {ok:true,code:'applied',request,receipt:{schema:'starci/owner-action-receipt@1',requestId:current.id,opId:current.opId,
    revision:request.revision,actionType:type,ownerReceiptId:action.actor.receiptId,status:'applied'}};
}

/** Kernel-only credential verification bound to the accepted integration check and exact custody revisions. */
export function applyOwnerVerification(state,{requestId,generation,acceptedOp,evidence,acceptance,credentialVersions,receiptId,now=Date.now}={}){
  const request=deriveOwnerRequests(state,{now}).find(item=>item.id===requestId);
  if(!request||request.kind!=='credential'||request.generation!==generation)return {ok:false,code:'request-stale'};
  const ask=state.ops.find(item=>item.id===request.opId),stored=ask?.ownerAnswer?.storageReceipt?.versions;
  if(!plain(stored)||JSON.stringify(stored)!==JSON.stringify(credentialVersions))return {ok:false,code:'credential-version-mismatch'};
  if(acceptedOp?.kind!=='integration.verify'||acceptedOp?.status!=='done'||evidence?.evidenceResolved!==true||acceptance?.verdict!=='pass')return {ok:false,code:'provider-verification-required'};
  if(acceptedOp.generation!=null&&Number(acceptedOp.generation)!==generation)return {ok:false,code:'request-stale'};
  const id=clean(receiptId);if(!id)return {ok:false,code:'verification-receipt-required'};
  return applyOwnerAction(state,{type:'verification',workflowId:request.workflowId,requestId:request.id,generation:request.generation,revision:request.revision,
    verificationReceiptId:id,actor:{type:'kernel',receiptId:id,channel:'kernel'}},{now,verificationReceipts:[{id,requestId:request.id,origin:'kernel-verification',status:'verified',at:now()}]});
}

/** Select only credential asks owned by this accepted integration verifier and bind their launch versions. */
export function verifyAcceptedIntegrationOwnerRequests(state,{op,evidence,acceptance,receiptFor,now=Date.now}={}){
  if(op?.kind!=='integration.verify'||op?.status!=='done'||evidence?.evidenceResolved!==true||acceptance?.verdict!=='pass'||typeof receiptFor!=='function')return [];
  const results=[];
  for(const request of deriveOwnerRequests(state,{now}).filter(item=>item.kind==='credential')){
    const ask=state.ops.find(item=>item.id===request.opId);
    if(!ask?.requesters?.includes(op.id))continue;
    const rows=(op.credentialVersions??[]).filter(row=>row?.custody===request.credential?.custody&&request.credential.variables.includes(row.name));
    if(rows.length!==request.credential.variables.length||rows.some(row=>!plain(row.version)))continue;
    const versions=Object.fromEntries(rows.map(row=>[row.name,row.version]));
    const receipt=receiptFor({request,evidence,acceptance,op});
    const result=applyOwnerVerification(state,{requestId:request.id,generation:request.generation,acceptedOp:op,evidence,acceptance,
      credentialVersions:versions,receiptId:receipt?.id,now});
    results.push({requestId:request.id,opId:request.opId,...result});
  }
  return results;
}
