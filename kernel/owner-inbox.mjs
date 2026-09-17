import crypto from 'node:crypto';
import {applyOwnerAction} from './owner-requests.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clean=value=>typeof value==='string'?value.trim():'';
const ACTIONS=['answer','choose','confirm','credential-saved','reopen'];

export function parseOwnerInboxCommand(payload){
  if(!plain(payload)||Object.keys(payload).some(key=>!['schema','action'].includes(key))||payload.schema!=='starci/owner-action@1'||!plain(payload.action))return {ok:false,code:'invalid-command'};
  const action=payload.action;
  if(!ACTIONS.includes(clean(action.type))||!clean(action.workflowId)||!clean(action.requestId)||!Number.isInteger(action.generation)||!Number.isInteger(action.revision))return {ok:false,code:'invalid-command'};
  if(!plain(action.actor)||action.actor.type!=='owner'||!clean(action.actor.receiptId)||!clean(action.actor.channel))return {ok:false,code:'owner-receipt-required'};
  return {ok:true,command:{schema:'starci/owner-action@1',action:structuredClone(action)}};
}

/** HTTP seam: atomically queues bytes only. It has no workflow state parameter and grants no authority. */
export function enqueueOwnerInbox(store,payload,{now=Date.now,random=()=>crypto.randomBytes(8).toString('hex')}={}){
  const parsed=parseOwnerInboxCommand(payload);if(!parsed.ok)return parsed;
  // §8: `paths.inbox` is removed. The queue is the ledger's `inbox` table, and one `push` is the atomic act
  // the temp-file-plus-rename used to be; `applyInbox` reads it back through `store.inbox.pending()`.
  if(typeof store?.inbox?.push!=='function')return {ok:false,code:'inbox-unavailable'};
  const id=`owner-${now()}-${random()}`,action=parsed.command.action;
  const job={schema:'starci/job@1',eventId:id,workflowId:action.workflowId,opId:clean(action.opId),attempt:Number(action.attempt??0),generation:action.generation,
    jobId:clean(action.jobId)||id,kind:'owner-action',role:'owner',payload:{requestId:action.requestId,action:parsed.command},status:'queued'};
  const row=store.inbox.push({kind:'owner-action',key:id,payload:job});
  return {ok:true,code:'queued',id,eventId:id,job,inboxId:row?.id??null};
}

/** Kernel seam: applies one already-read command and journals its outcome. */
export function applyOwnerInbox(store,state,payload,options={}){
  if(payload?.schema==='starci/job@1'&&payload?.kind==='owner-action')payload=payload.payload?.action;
  const parsed=parseOwnerInboxCommand(payload);
  if(!parsed.ok){store?.appendEvent?.({event:'owner-inbox-rejected',code:parsed.code});return parsed;}
  if(parsed.command.action.workflowId!==state?.id){const out={ok:false,code:'foreign-workflow'};store?.appendEvent?.({event:'owner-inbox-ignored',code:out.code});return out;}
  const result=applyOwnerAction(state,parsed.command.action,options);
  store?.appendEvent?.({event:result.ok?'owner-inbox-applied':'owner-inbox-rejected',request:parsed.command.action.requestId,type:parsed.command.action.type,code:result.code,receiptId:parsed.command.action.actor.receiptId});
  if(result.ok)store?.saveState?.(state);
  return result;
}
