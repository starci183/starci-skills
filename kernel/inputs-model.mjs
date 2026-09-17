import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {identityPaths,identitySecretPresent,identitySecretVersion,VARIABLE,SLUG} from '../core/identity.mjs';
import {credentialVersionChanged} from './inputs-replacement.mjs';
import {fillWaitingAsks,workRootOf} from './fill.mjs';
import {integrationReadiness} from './inputs-readiness.mjs';
import {deriveOwnerRequests} from './owner-requests.mjs';
import {parseOwnerInboxCommand} from './owner-inbox.mjs';
import {createStore} from './store.mjs';

const same=(a,b)=>path.resolve(a)===path.resolve(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keyOf=(slug,name,preparation,replacement)=>crypto.createHash('sha256').update(`${slug}:${name}:${JSON.stringify([preparation??null,replacement??null])}`).digest('hex').slice(0,24);

/**
 * Freeze the workflow's actual ledger binding; the HTTP client never supplies a path or identity.
 *
 * Runtime 1.0.4: a workflow owns no directory (`store.dir` is gone), so the binding carries the
 * ledger's `repoRoot` instead - enough for anything holding the binding (the detached input helper,
 * a later poll) to open its own `store` and read the one ledger every writer shares.
 */
export function inputBinding(state,store){
  const workRoot=workRootOf(state);
  if(!state?.approved||!state.id||!state.host||!state.worktree||!workRoot||!store?.repoRoot)throw Error('Workflow input binding is incomplete.');
  return {id:state.id,repoRoot:path.resolve(store.repoRoot),workRoot:path.resolve(workRoot),worktree:path.resolve(state.worktree),host:path.resolve(state.host)};
}

/** One short-lived store, opened from a binding and always closed - callers never hold the handle. */
function withBoundStore(binding,fn){
  const store=createStore({repoRoot:binding.repoRoot,id:binding.id});
  try{return fn(store);}finally{store.close();}
}

export function readInputState(binding){
  try{
    return withBoundStore(binding,store=>{
      const state=store.loadState();
      if(!state||!state.approved||state.id!==binding.id||!same(state.worktree,binding.worktree)||!same(state.host,binding.host)
        ||!same(workRootOf(state),binding.workRoot))return null;
      return state;
    });
  }catch{return null;}
}

/** Only typed current asks create writable fields. Duplicate requesters share one custody/name field. */
export function credentialFields(state){
  const waiting=new Set(fillWaitingAsks(state).map(ask=>ask.id)),fields=new Map(),unresolved=[];
  for(const ask of state?.ops??[]){
    const pending=waiting.has(ask.id),completed=ask.status==='done'&&ask.answer?.via==='fill';
    if(!pending&&!completed)continue;
    if(pending&&!ask.credential?.ready){
      unresolved.push({ask:ask.id,code:'integration-research-pending'});continue;
    }
    const slug=String(ask.credential?.custody??'').replace(/^identity:/,'');
    const variables=ask.credential?.variables??[];
    if(!SLUG.test(slug)||!variables.length||variables.some(name=>!VARIABLE.test(name))){
      if(pending)unresolved.push({ask:ask.id,code:'credential-declaration-missing'});
      continue;
    }
    for(const name of variables){
      const prep=ask.credential?.preparations?.find(item=>item.name===name)?.preparation;
      if(pending&&!integrationReadiness({credential:{name,custody:`identity:${slug}`},preparation:prep},{stage:'input'}).ok){
        unresolved.push({ask:ask.id,code:'integration-research-pending'});continue;
      }
      const replacement=ask.credential?.replacements?.find(item=>item.name===name)??null;
      const id=keyOf(slug,name,prep,replacement),field=fields.get(id)??{id,slug,name,replacement,provider:ask.credential?.provider??slug,
        label:prep?.credential?.label??name,meaning:prep?.credential?.meaning??'',obtain:prep?.credential?.obtain??'',
        sources:prep?.sources?.map(source=>({url:source.url,title:source.title}))??[],
        ownerSteps:prep?.prerequisites?.filter(step=>step.owner==='owner').map(step=>({action:step.action,reason:step.reason}))??[],
        asks:[],tasks:[],pending:false};
      field.pending||=pending;
      field.asks.push(ask.id);
      for(const requester of ask.requesters??[]){
        const op=state.ops.find(item=>item.id===requester);
        if(!field.tasks.some(task=>task.id===requester))field.tasks.push({id:requester,label:op?.title??op?.goal??op?.kind??requester});
      }
      fields.set(id,field);
    }
  }
  const all=[...fields.values()];
  return {fields:all.filter(field=>field.pending||!all.some(other=>other.pending&&other.slug===field.slug&&other.name===field.name)),unresolved};
}

/** Safe progress only: no credential values, evidence bytes or capability-bearing URLs are included. */
export function preparationProgress(state){
  const waiting=new Set(fillWaitingAsks(state).map(ask=>ask.id)),rows=[];
  const text=(value,limit=500)=>typeof value==='string'?value.trim().slice(0,limit):'';
  const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.href.length<=2048?url.href:null;}catch{return null;}};
  for(const ask of state.ops??[]){
    if(!waiting.has(ask.id)||ask.credential?.ready)continue;
    for(const item of (Array.isArray(ask.credential?.preparations)?ask.credential.preparations:[]).slice(0,64)){
      const name=text(item?.name,160);if(!name)continue;
      const prep=plain(item?.preparation)&&item.preparation.schema==='starci/integration-preparation@1'?item.preparation:null,credential=plain(prep?.credential)?prep.credential:{};
      const docs=(Array.isArray(prep?.sources)?prep.sources:[]).slice(0,32).flatMap(source=>{const url=safeUrl(source?.url),readAt=Date.parse(source?.readAt??''),title=text(source?.title,240);
        return source?.official===true&&Number.isFinite(readAt)&&readAt<=Date.now()+5*60*1000&&text(source?.observation,1)&&title&&url?[{title,url}]:[];});
      const prerequisites=(Array.isArray(prep?.prerequisites)?prep.prerequisites:[]).slice(0,32).flatMap(step=>{
        const id=text(step?.id,160),owner=['workflow','owner'].includes(step?.owner)?step.owner:null,status=['ready','pending'].includes(step?.status)?step.status:null,
          action=text(step?.action),reason=text(step?.reason);
        return id&&owner&&status&&action&&reason?[{id,owner,status,action,reason,proofPresent:text(step?.evidence,1).length>0}]:[];});
      rows.push({ask:text(ask.id,160),name,label:text(credential.label,240)||name,provider:text(item?.provider??ask.credential?.provider,240)||null,
        tasks:(Array.isArray(ask.requesters)?ask.requesters:[]).slice(0,16).flatMap(id=>{const safeId=text(id,160);if(!safeId)return [];const op=state.ops.find(candidate=>candidate.id===id);return [{id:safeId,label:text(op?.title??op?.goal??op?.kind??id,500)}];}),
        errors:[...new Set((Array.isArray(item?.errors)?item.errors:[]).map(error=>text(error,80)).filter(error=>/^[a-z0-9-]+$/.test(error)))].slice(0,16),docs,prerequisites,
        verificationSteps:(Array.isArray(prep?.verification?.steps)?prep.verification.steps:[]).filter(step=>typeof step==='string'&&step.trim()).slice(0,32).length});
    }
  }
  return rows;
}

/** Presence only; cache by encrypted-file metadata, never by a decrypted value. */
export function presenceReader(verify=identitySecretPresent){
  const cache=new Map();
  return ({workRoot,slug,name},refresh=false)=>{
    let stamp='missing';
    try{const stat=fs.statSync(identityPaths(workRoot,slug).secrets);stamp=`${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;}catch{}
    const key=`${workRoot}:${slug}:${name}`,before=cache.get(key);
    if(!refresh&&before?.stamp===stamp)return before.ok;
    let ok=false;
    try{ok=Boolean(verify({workRoot,slug,name})?.ok);}catch{}
    cache.set(key,{stamp,ok});return ok;
  };
}

/** The canonical public command receives the value on stdin. Its output is discarded, even on failure. */
export function writeInputCredential({binding,field,value,spawnProcess=spawn}){
  return new Promise(resolve=>{
    const child=spawnProcess(process.execPath,[path.join(binding.host,'bin','starci.mjs'),'identity','set',field.slug,
      '--name',field.name,'--work-root',binding.workRoot,
      ...(field.replacement?['--expected-write-revision',field.replacement.baseline.writeRevision??'none']:[])],
    {cwd:binding.worktree,stdio:['pipe','ignore','ignore'],windowsHide:true});
    const timeout=setTimeout(()=>{child.kill();resolve({ok:false,code:'storage-unavailable'});},60000);
    child.once('error',()=>{clearTimeout(timeout);resolve({ok:false,code:'storage-unavailable'});});
    child.once('exit',code=>{clearTimeout(timeout);resolve({ok:code===0,code:code===0?'saved':'storage-unavailable'});});
    child.stdin.on('error',()=>{});
    child.stdin.end(value);
  });
}

/** The one command the ledger's `inbox` table accepts from this helper: a validated owner action row, applied by `applyOwnerInbox` on the kernel's own tick (never here). */
const enqueueOwnerAction=(binding,payload)=>{
  const parsed=parseOwnerInboxCommand(payload);
  if(!parsed.ok)return parsed;
  return withBoundStore(binding,store=>{
    const row=store.inbox.push({kind:'owner-action',key:parsed.command.action.requestId,payload:parsed.command});
    return {ok:true,code:'queued',id:row.id,eventId:String(row.id),job:parsed.command};
  });
};

/** This helper owns no workflow state. The kernel independently settles satisfied asks on its next tick. */
export function createInputModel({binding,read=()=>readInputState(binding),present=presenceReader(),write=writeInputCredential,version=identitySecretVersion,
  enqueue=payload=>enqueueOwnerAction(binding,payload)}){
  const replacementWritten=field=>!field.replacement||credentialVersionChanged(field.replacement.baseline,
    version({workRoot:binding.workRoot,slug:field.slug,name:field.name}));
  let writes=Promise.resolve();
  const snapshot=()=>{
    const state=read();
    if(!state)return {workflow:binding.id,phase:'unavailable',fields:[],unresolved:[]};
    const {fields,unresolved}=credentialFields(state),preparation=preparationProgress(state);
    return {workflow:binding.id,phase:state.finished?'finished':unresolved.length&&!fields.some(field=>field.pending)?'preparing':fields.some(field=>field.pending)?'waiting':'running',
      fields:fields.map(({replacement,...field})=>({...field,replacementReason:replacement?.reason??null,
        status:!field.pending?'complete':replacementWritten({...field,replacement})&&present({workRoot:binding.workRoot,slug:field.slug,name:field.name})?'saved':'pending'})),
      preparation,ownerRequests:deriveOwnerRequests(state).filter(request=>request.kind!=='credential'),unresolved};
  };
  const queueAction=(state,request,action,actor)=>enqueue({schema:'starci/owner-action@1',action:{...action,
    workflowId:request.workflowId,opId:request.opId,attempt:request.attempt,generation:request.generation,jobId:request.jobId,
    requestId:request.id,revision:request.revision,...(request.optionsDigest?{optionsDigest:request.optionsDigest}:{}),actor}});
  const submit=body=>{
    // Refuse an entire malformed or foreign batch before the first write; never echo submitted strings.
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='entries')
      ||!Array.isArray(body.entries)||!body.entries.length||body.entries.length>64)return Promise.resolve({ok:false,code:'invalid-request'});
    const entries=body.entries;
    if(entries.some(entry=>!entry||Object.keys(entry).some(key=>!['id','value'].includes(key))||typeof entry.id!=='string'
      ||typeof entry.value!=='string'||entry.value.length>16384)||new Set(entries.map(entry=>entry.id)).size!==entries.length)
      return Promise.resolve({ok:false,code:'invalid-request'});
    const perform=async()=>{
      let state=read();
      if(!state||state.finished)return {ok:false,code:'workflow-unavailable'};
      let allow=new Map(credentialFields(state).fields.filter(field=>field.pending).map(field=>[field.id,field]));
      if(entries.some(entry=>!allow.has(entry.id)))return {ok:false,code:'request-changed'};
      const results=[];
      for(const entry of entries){
        state=read();
        allow=new Map(credentialFields(state).fields.filter(field=>field.pending).map(field=>[field.id,field]));
        const field=allow.get(entry.id);
        if(!state||state.finished||!field){results.push({id:entry.id,ok:false,code:'request-changed'});continue;}
        if(!entry.value.trim()){results.push({id:entry.id,ok:false,code:'empty'});continue;}
        // A repeat submission never overwrites a stored secret while the kernel is catching up.
        if(replacementWritten(field)&&present({workRoot:binding.workRoot,slug:field.slug,name:field.name},true)){
          results.push({id:entry.id,ok:true,code:'saved'});continue;
        }
        let result;
        try{result=await write({binding,field,value:entry.value});}catch{result={ok:false};}
        entry.value='';
        const ok=Boolean(result?.ok)&&replacementWritten(field)&&present({workRoot:binding.workRoot,slug:field.slug,name:field.name},true);
        results.push({id:entry.id,ok,code:ok?'saved':'storage-unavailable'});
      }
      const queued=[];
      if(results.every(result=>result.ok)){
        state=read();const requests=deriveOwnerRequests(state).filter(request=>request.kind==='credential');
        for(const request of requests){
          const ask=state.ops.find(item=>item.id===request.opId),variables=ask?.credential?.variables??[],custody=request.credential?.custody,
            slug=String(custody??'').replace(/^identity:/,'');
          if(!variables.length||!variables.every(name=>present({workRoot:binding.workRoot,slug,name},true)))continue;
          const versions=Object.fromEntries(variables.map(name=>[name,version({workRoot:binding.workRoot,slug,name})]));
          const receipt=crypto.randomBytes(16).toString('hex'),result=queueAction(state,request,{type:'credential-saved',
            storageReceipt:{status:'present',custody,variables,versions}}, {type:'owner',receiptId:receipt,channel:'orca-input'});
          queued.push({requestId:request.id,ok:Boolean(result?.ok),code:result?.code??'inbox-unavailable'});
        }
      }
      return {ok:results.every(result=>result.ok)&&queued.every(result=>result.ok),results,queued};
    };
    const result=writes.then(perform);
    writes=result.catch(()=>{});
    return result.finally(()=>{for(const entry of entries)entry.value='';});
  };
  const submitOwnerAction=body=>{
    if(!plain(body)||Object.keys(body).some(key=>!['requestId','revision','type','value','optionsDigest'].includes(key))||typeof body.requestId!=='string'
      ||!Number.isInteger(body.revision)||!['answer','choose','confirm'].includes(body.type))return {ok:false,code:'invalid-request'};
    const state=read();if(!state||state.finished)return {ok:false,code:'workflow-unavailable'};
    const request=deriveOwnerRequests(state).find(item=>item.id===body.requestId&&item.kind!=='credential');
    if(!request||request.revision!==body.revision||String(request.optionsDigest??'')!==String(body.optionsDigest??''))return {ok:false,code:'request-changed'};
    const result=queueAction(state,request,{type:body.type,value:body.value},{type:'owner',receiptId:crypto.randomBytes(16).toString('hex'),channel:'orca-input'});
    return result?.ok?{ok:true,code:'queued'}:{ok:false,code:result?.code??'inbox-unavailable'};
  };
  return {snapshot,submit,submitOwnerAction};
}
