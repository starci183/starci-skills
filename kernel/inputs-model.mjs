import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {identityPaths,identitySecretPresent,identitySecretVersion,VARIABLE,SLUG} from '../core/identity.mjs';
import {credentialVersionChanged} from './inputs-replacement.mjs';
import {fillWaitingAsks,workRootOf} from './fill.mjs';
import {integrationReadiness} from './inputs-readiness.mjs';

const same=(a,b)=>path.resolve(a)===path.resolve(b);
const keyOf=(slug,name,preparation,replacement)=>crypto.createHash('sha256').update(`${slug}:${name}:${JSON.stringify([preparation??null,replacement??null])}`).digest('hex').slice(0,24);

/** Freeze the workflow's actual ledger binding; the HTTP client never supplies a path or identity. */
export function inputBinding(state,dir){
  const workRoot=workRootOf(state);
  if(!state?.approved||!state.id||!state.host||!state.worktree||!workRoot)throw Error('Workflow input binding is incomplete.');
  return {id:state.id,dir:path.resolve(dir),workRoot:path.resolve(workRoot),worktree:path.resolve(state.worktree),host:path.resolve(state.host)};
}

export function readInputState(binding){
  try{
    const state=JSON.parse(fs.readFileSync(path.join(binding.dir,'state.json'),'utf8'));
    if(!state.approved||state.id!==binding.id||!same(state.worktree,binding.worktree)||!same(state.host,binding.host)
      ||!same(workRootOf(state),binding.workRoot))return null;
    return state;
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

/** This helper owns no workflow state. The kernel independently settles satisfied asks on its next tick. */
export function createInputModel({binding,read=()=>readInputState(binding),present=presenceReader(),write=writeInputCredential,version=identitySecretVersion}){
  const replacementWritten=field=>!field.replacement||credentialVersionChanged(field.replacement.baseline,
    version({workRoot:binding.workRoot,slug:field.slug,name:field.name}));
  let writes=Promise.resolve();
  const snapshot=()=>{
    const state=read();
    if(!state)return {workflow:binding.id,phase:'unavailable',fields:[],unresolved:[]};
    const {fields,unresolved}=credentialFields(state);
    return {workflow:binding.id,phase:state.finished?'finished':unresolved.length&&!fields.some(field=>field.pending)?'preparing':fields.some(field=>field.pending)?'waiting':'running',
      fields:fields.map(({replacement,...field})=>({...field,replacementReason:replacement?.reason??null,
        status:!field.pending?'complete':replacementWritten({...field,replacement})&&present({workRoot:binding.workRoot,slug:field.slug,name:field.name})?'saved':'pending'})),unresolved};
  };
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
      return {ok:results.every(result=>result.ok),results};
    };
    const result=writes.then(perform);
    writes=result.catch(()=>{});
    return result.finally(()=>{for(const entry of entries)entry.value='';});
  };
  return {snapshot,submit};
}
