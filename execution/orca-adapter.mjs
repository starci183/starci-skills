import {createOrcaCalls,getPath} from './orca-calls.mjs';
import {settleDispatch} from './orca-supervised-launch.mjs';

/**
 * Concrete Orca adapter for execution/orca.mjs, built on the typed call runner. Every injected
 * method returns the receipt shape the workflow runtime expects or throws an error that carries
 * the typed call result; no method composes argv or interprets exit codes itself.
 */
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const KEEPALIVE_KEYS=['_keepalive','_heartbeat'];

function fail(result,label){
  const error=Error(`${label}: Orca ${result.call} ${result.outcome} (${result.effectState}): ${result.reason??'no reason'}`);
  error.result=result;
  throw error;
}
const ok=(result,label)=>result.outcome==='ok'?result.receipt:fail(result,label);
const resultOf=receipt=>plain(receipt?.result)?receipt.result:receipt;

function selectorOf(worktree){
  if(typeof worktree==='string')return worktree;
  need(plain(worktree),'Worktree reference is required');
  if(worktree.kind==='existing-child')return `path:${text(worktree.id,'workflow child worktree id').split('::').at(-1)}`;
  if(worktree.kind==='new-child')return 'new-child';
  if(worktree.selector)return worktree.selector;
  return `path:${text(worktree.id,'worktree id')}`;
}

/** Separate a check receipt's messages from keepalive noise. */
export function boundaryMessages(receipt){
  const result=resultOf(receipt);
  const rows=Array.isArray(result?.messages)?result.messages:Array.isArray(result?.delivery?.messages)?result.delivery.messages:[];
  return rows.filter(row=>plain(row)&&!KEEPALIVE_KEYS.some(key=>row[key]===true));
}

export function createOrcaAdapter({orca=createOrcaCalls(),cwd=process.cwd(),from=null,repo=null}={}){
  const invoke=(name,params,options={})=>orca.invoke(name,params,{cwd,...options});
  const withFrom=params=>from?{...params,from}:params;
  return {
    orca,
    async createRun({objective}){
      const receipt=ok(invoke('run-create',withFrom({objective:text(objective,'run objective')})),'createRun');
      return {runId:text(getPath(receipt,'result.run.id'),'created Run id'),receipt};
    },
    async createTask({runId,title,displayName,spec,deps=[],parentTaskId=null}){
      const params=withFrom({run:text(runId,'run id'),spec:text(spec,'task spec'),'task-title':title??undefined,'display-name':displayName??undefined,deps:deps.length?JSON.stringify(deps):undefined,parent:parentTaskId??undefined});
      const receipt=ok(invoke('task-create',params),'createTask');
      const task=getPath(receipt,'result.task');
      need(plain(task)&&typeof task.id==='string','task-create receipt is missing the Task');
      if(displayName)need(task.display_name===displayName,`Created Task name mismatch: ${task.display_name??'unknown'}`);
      return {taskId:task.id,taskRecord:task,receipt};
    },
    async dispatchWorker({runId,taskId,worktree,selection,displayName,launchPlan}){
      const start=launchPlan?.steps?.[0]?.args??{};
      const params=withFrom({task:text(taskId,'task id'),worktree:selectorOf(worktree),agent:text(start.agent??selection?.orcaLaunch?.agent,'Orca agent id'),run:text(runId,'run id'),'display-name':displayName??undefined,'timeout-ms':120000});
      if(worktree?.kind==='new-child'){params.name=worktree.name;params.repo=repo??undefined;params.setup='run';}
      if(start.model)params.model=start.model;
      if(start.effort)params.effort=start.effort;
      const result=invoke('worker-start',params);
      if(result.outcome!=='ok'){
        const dispatchId=getPath(result.receipt,'result.dispatch.id')??null;
        const settlement=dispatchId&&result.effectState!=='none'?settleDispatch(orca,dispatchId,{cwd,reason:`worker-start ${result.outcome}`}):null;
        const error=Error(`dispatchWorker: Orca worker-start ${result.outcome} (${settlement?.effectState??result.effectState}): ${result.reason??'no reason'}`);
        error.result=result;error.settlement=settlement;error.effectState=settlement?.effectState??result.effectState;
        throw error;
      }
      const dispatchId=text(getPath(result.receipt,'result.dispatch.id'),'created Dispatch id');
      const worktreeId=getPath(result.receipt,'result.worker.worktree_id')??getPath(result.receipt,'result.worktree.id')??null;
      return worktree?.kind==='new-child'?{dispatchId,worktreeId:text(worktreeId,'created workflow child worktree id'),receipt:result.receipt}:{dispatchId,receipt:result.receipt};
    },
    async setWorktreeParent({worktreeId,parentWorktree,displayName=null}){
      const params={worktree:`id:${text(worktreeId,'worktree id')}`,'parent-worktree':text(parentWorktree?.selector,'parent worktree selector')};
      if(displayName)params['display-name']=displayName;
      return {status:'updated',receipt:ok(invoke('worktree-set',params),'setWorktreeParent')};
    },
    async showWorktree({worktreeId}){
      const receipt=ok(invoke('worktree-show',{worktree:`id:${text(worktreeId,'worktree id')}`}),'showWorktree');
      return {worktree:getPath(receipt,'result.worktree'),receipt};
    },
    async showWorker({dispatchId}){
      return ok(invoke('worker-show',{dispatch:text(dispatchId,'dispatch id')}),'showWorker');
    },
    async renameTerminal({terminalHandle,title}){
      ok(invoke('terminal-rename',{terminal:text(terminalHandle,'terminal handle'),title:text(title,'terminal title')}),'renameTerminal');
      return {status:'renamed',title};
    },
    async stopWorker({dispatchId,reason='superseded'}){
      return {status:'settled',...settleDispatch(orca,text(dispatchId,'dispatch id'),{cwd,reason})};
    },
    async releaseWorker({dispatchId}){
      const result=invoke('worker-release',{dispatch:text(dispatchId,'dispatch id')});
      const releaseState=getPath(result.receipt,'result.state')??null;
      need(result.outcome!=='unknown',`releaseWorker: ${result.reason}`);
      return {status:result.outcome==='ok'?'released':'retained',releaseState,effectState:result.effectState,receipt:result.receipt};
    },
    async integrateChange(){
      throw Error('integrateChange is coordinator-owned: perform the reviewed integration in the main worktree and record it explicitly; the adapter never merges');
    },
    /** One blocking boundary wait with optional acknowledgement; a timeout is an empty ok result. */
    async waitBoundary({runId=null,types=['worker_done','worker_failed','escalation','question'],timeoutMs=900000,ack=null}={}){
      const params={wait:true,types:types.join(','),'timeout-ms':timeoutMs};
      if(runId)params.run=runId;
      if(ack)params.ack=ack;
      const result=invoke('check',params);
      if(result.outcome!=='ok')return {ok:false,messages:[],deliveryId:null,timedOut:false,result};
      const messages=boundaryMessages(result.receipt);
      const deliveryId=getPath(result.receipt,'result.delivery.id')??getPath(result.receipt,'result.deliveryId')??null;
      return {ok:true,messages,deliveryId,timedOut:messages.length===0,result};
    },
    async sendBoundary({to,type,subject,body,taskId=null,dispatchId=null,outcome=null,filesModified=null}){
      const params=withFrom({subject:text(subject,'subject'),type:text(type,'message type'),body:body??undefined,to:to??undefined,'task-id':taskId??undefined,'dispatch-id':dispatchId??undefined,outcome:outcome??undefined,'files-modified':Array.isArray(filesModified)?filesModified.join(','):filesModified??undefined});
      return {status:'sent',receipt:ok(invoke('send',params),'sendBoundary')};
    }
  };
}
