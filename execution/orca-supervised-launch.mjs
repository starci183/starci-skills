#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveExecutionChain} from '../profiles/select.mjs';
import {attestOperationWorker,formatOrcaDisplayName,planOperationAgentLaunch} from './supervision.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const qwenModel='qwen3.8-flash';

function parseArgs(argv){
  const [command,...rest]=argv;
  const options={};
  for(let index=0;index<rest.length;index+=1){
    const flag=rest[index];
    need(flag.startsWith('--'),`Unexpected argument: ${flag}`);
    const key=flag.slice(2);
    need(!Object.hasOwn(options,key),`Duplicate option: --${key}`);
    if(key==='dry-run'){options[key]=true;continue;}
    need(index+1<rest.length&&!rest[index+1].startsWith('--'),`Missing value for --${key}`);
    options[key]=rest[++index];
  }
  return {command,options};
}

function exactWorktree(value){
  const relative=required(value,'workflow worktree path');
  need(relative!=='current'&&!relative.startsWith('path:'),'Workflow worktree must be a filesystem-relative path, not an Orca selector');
  need(!path.isAbsolute(relative),'Workflow worktree input must be relative');
  const resolved=path.resolve(relative);
  return {relative,path:resolved,selector:`path:${resolved}`};
}

function specText(file){
  const resolved=path.resolve(required(file,'operation spec file'));
  need(fs.existsSync(resolved)&&fs.statSync(resolved).isFile(),`Operation spec file does not exist: ${resolved}`);
  return required(fs.readFileSync(resolved,'utf8'),'operation spec');
}

function findObject(value,predicate){
  if(predicate(value))return value;
  if(Array.isArray(value))for(const item of value){const found=findObject(item,predicate);if(found)return found;}
  else if(plain(value))for(const item of Object.values(value)){const found=findObject(item,predicate);if(found)return found;}
  return null;
}

function taskFromReceipt(receipt){
  const task=findObject(receipt,value=>plain(value)&&typeof value.id==='string'&&value.id.startsWith('task_')&&typeof value.display_name==='string');
  need(task,'Orca task-create receipt is missing the created Task');
  return task;
}

function dispatchIdFromReceipt(receipt){
  const dispatch=findObject(receipt,value=>plain(value)&&typeof value.id==='string'&&value.id.startsWith('ctx_')&&(typeof value.task_id==='string'||typeof value.dispatch_id==='string'));
  need(dispatch,'Orca worker-start receipt is missing the supervised Dispatch');
  return dispatch.id;
}

function resultOf(receipt){return plain(receipt?.result)?receipt.result:receipt;}

function assertWorktree(workerShow,expectedPath){
  const result=resultOf(workerShow),actual=result?.terminal?.worktreePath;
  need(typeof actual==='string','Worker receipt is missing terminal.worktreePath');
  const normalize=value=>path.resolve(value).replaceAll('\\','/').toLowerCase();
  need(normalize(actual)===normalize(expectedPath),`Worker worktree mismatch: expected ${expectedPath}, received ${actual}`);
}

export function buildOperationLaunch({run,workflowTask,from,worktree,operation,scope,spec}){
  const runId=required(run,'nested workflow Run ID'),workflow=required(workflowTask,'parent workflow Task ID');
  const monitor=required(from,'Workflow Monitor terminal handle');
  need(monitor.startsWith('term_'),'--from must be the exact Workflow Monitor terminal handle');
  const target=exactWorktree(worktree),op=required(operation,'operation'),opScope=required(scope,'operation scope');
  const contract=required(spec,'operation spec');
  const selection=resolveExecutionChain({skill:'starci',op}).candidates[0];
  need(selection,'Operation provider chain is empty');
  const displayName=formatOrcaDisplayName('operation-agent',{operation:op,scope:opScope});
  const runAttestationArgs=['orchestration','run-show','--id',runId,'--json'];
  const taskArgs=['orchestration','task-create','--run',runId,'--from',monitor,
    '--task-title',`${op} - ${opScope}`,'--display-name',displayName,'--spec',contract,'--json'];
  const planned=planOperationAgentLaunch({taskId:'$operationTaskId',worktree:target.selector,selection,operation:op,scope:opScope});
  const start=planned.steps[0].args;
  const workerArgs=['orchestration','worker-start','--task',start.task,'--worktree',start.worktree,'--agent',start.agent,
    '--run',runId,'--from',monitor,'--display-name',displayName,'--timeout-ms','60000'];
  if(start.model)workerArgs.push('--model',start.model);
  if(start.effort)workerArgs.push('--effort',start.effort);
  workerArgs.push('--json');
  return {schema:'starci/orca-supervised-op-request@1',runId,workflowTask:workflow,from:monitor,
    worktree:target,operation:op,scope:opScope,displayName,selection,runAttestationArgs,taskArgs,workerArgs};
}

export function buildMonitorLaunch({run,parentTask,from,worktree,workflow,spec}){
  const runId=required(run,'run ID'),parent=required(parentTask,'parent Coordinator Task ID');
  const coordinator=required(from,'parent Coordinator terminal handle');
  need(coordinator.startsWith('term_'),'--from must be the exact parent Coordinator terminal handle');
  const target=exactWorktree(worktree),name=required(workflow,'workflow name'),contract=required(spec,'Workflow Monitor spec');
  const displayName=formatOrcaDisplayName('workflow-manager',{workflow:name});
  const taskArgs=['orchestration','task-create','--run',runId,'--parent',parent,'--from',coordinator,
    '--task-title',`Monitor ${name}`,'--display-name',displayName,'--spec',contract,'--json'];
  return {schema:'starci/orca-supervised-monitor-request@1',runId,parentTask:parent,from:coordinator,
    worktree:target,workflow:name,displayName,taskArgs};
}

export function createOrcaRunner({executable=process.platform==='win32'?'orca.cmd':'orca',timeoutMs=90000}={}){
  return (args,{cwd}={})=>{
    const completed=spawnSync(executable,args,{cwd,encoding:'utf8',windowsHide:true,timeout:timeoutMs,shell:false});
    need(!completed.error,`Unable to execute Orca: ${completed.error?.message}`);
    let receipt;
    try{receipt=JSON.parse(completed.stdout);}catch{throw Error(`Orca returned non-JSON output for ${args.slice(0,2).join(' ')}`);}
    need(completed.status===0&&receipt?.ok!==false,receipt?.error?.message??`Orca command failed: ${args.slice(0,2).join(' ')}`);
    return receipt;
  };
}

export function startOperation(input,{runOrca=createOrcaRunner()}={}){
  const request=buildOperationLaunch(input),cwd=request.worktree.path;
  const runReceipt=runOrca(request.runAttestationArgs,{cwd}),observedRun=resultOf(runReceipt)?.run;
  need(observedRun?.id===request.runId,'Nested workflow Run attestation failed');
  need(observedRun?.coordinator_handle===request.from,'Operation can be launched only by the exact Workflow Monitor bound as nested Run coordinator');
  const taskReceipt=runOrca(request.taskArgs,{cwd}),task=taskFromReceipt(taskReceipt);
  need(task.display_name===request.displayName,`Created Task name mismatch: ${task.display_name??'unknown'}`);
  const workerArgs=request.workerArgs.map(value=>value==='$operationTaskId'?task.id:value);
  let dispatchId=null;
  try{
    const startReceipt=runOrca(workerArgs,{cwd});
    dispatchId=dispatchIdFromReceipt(startReceipt);
    let workerShow=runOrca(['orchestration','worker-show','--dispatch',dispatchId,'--json'],{cwd});
    assertWorktree(workerShow,cwd);
    attestOperationWorker({taskId:task.id,operation:request.operation,scope:request.scope,selection:request.selection,
      taskRecord:task,workerShow,phase:'provider-identity'});
    const terminal=resultOf(workerShow).worker.agent_terminal_handle;
    runOrca(['terminal','rename','--terminal',terminal,'--title',request.displayName,'--json'],{cwd});
    workerShow=runOrca(['orchestration','worker-show','--dispatch',dispatchId,'--json'],{cwd});
    assertWorktree(workerShow,cwd);
    const attestation=attestOperationWorker({taskId:task.id,operation:request.operation,scope:request.scope,
      selection:request.selection,taskRecord:task,workerShow,phase:'canonical-title'});
    return {schema:'starci/orca-supervised-op-launch@1',ok:true,task,dispatchId,attestation};
  }catch(error){
    if(dispatchId)try{runOrca(['orchestration','worker-stop','--dispatch',dispatchId,'--json'],{cwd});}catch{}
    throw Error(`Supervised operation launch rejected${dispatchId?` and fenced ${dispatchId}`:''}: ${error.message}`);
  }
}

export function startMonitor(input,{runOrca=createOrcaRunner()}={}){
  const request=buildMonitorLaunch(input),cwd=request.worktree.path;
  const taskReceipt=runOrca(request.taskArgs,{cwd}),task=taskFromReceipt(taskReceipt);
  need(task.display_name===request.displayName,`Created Monitor Task name mismatch: ${task.display_name??'unknown'}`);
  const workerArgs=['orchestration','worker-start','--task',task.id,'--worktree',request.worktree.selector,
    '--agent','codex','--model','gpt-5.6-sol','--effort','high','--run',request.runId,'--from',request.from,
    '--display-name',request.displayName,'--timeout-ms','60000','--json'];
  let dispatchId=null;
  try{
    const startReceipt=runOrca(workerArgs,{cwd});
    dispatchId=dispatchIdFromReceipt(startReceipt);
    let show=runOrca(['orchestration','worker-show','--dispatch',dispatchId,'--json'],{cwd});
    assertWorktree(show,cwd);
    const effective=resultOf(show)?.worker?.startOptions?.launch?.effective;
    need(effective?.agent==='codex'&&effective?.model==='gpt-5.6-sol','Workflow Monitor provider attestation failed');
    const terminal=resultOf(show).worker.agent_terminal_handle;
    runOrca(['terminal','rename','--terminal',terminal,'--title',request.displayName,'--json'],{cwd});
    show=runOrca(['orchestration','worker-show','--dispatch',dispatchId,'--json'],{cwd});
    need(resultOf(show)?.terminal?.title===request.displayName,`Workflow Monitor title mismatch: expected ${request.displayName}`);
    return {schema:'starci/orca-supervised-monitor-launch@1',ok:true,task,dispatchId,terminal};
  }catch(error){
    if(dispatchId)try{runOrca(['orchestration','worker-stop','--dispatch',dispatchId,'--json'],{cwd});}catch{}
    throw Error(`Supervised Workflow Monitor launch rejected${dispatchId?` and fenced ${dispatchId}`:''}: ${error.message}`);
  }
}

function usage(){return `Usage:\n  node orca-supervised-launch.mjs start-op --run <nested-workflow-run> --workflow-task <parent-workflow-task> --from <monitor-terminal> --worktree <relative-path> --operation <op> --scope <scope> --spec-file <relative-file> [--dry-run]\n  node orca-supervised-launch.mjs start-monitor --run <run> --parent-task <task> --from <coordinator-terminal> --worktree <relative-path> --workflow <name> --spec-file <relative-file> [--dry-run]`;}

export function main(argv=process.argv.slice(2)){
  const {command,options}=parseArgs(argv);
  need(['start-op','start-monitor'].includes(command),usage());
  const common={run:options.run,from:options.from,worktree:options.worktree,spec:specText(options['spec-file'])};
  const request=command==='start-op'
    ?buildOperationLaunch({...common,workflowTask:options['workflow-task'],operation:options.operation,scope:options.scope})
    :buildMonitorLaunch({...common,parentTask:options['parent-task'],workflow:options.workflow});
  const output=options['dry-run']?request:command==='start-op'?startOperation({...common,workflowTask:options['workflow-task'],operation:options.operation,scope:options.scope}):startMonitor({...common,parentTask:options['parent-task'],workflow:options.workflow});
  process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){try{main();}catch(error){process.stderr.write(`${JSON.stringify({ok:false,error:{message:error.message}},null,2)}\n`);process.exitCode=1;}}

export const supervisedQwenModel=qwenModel;
