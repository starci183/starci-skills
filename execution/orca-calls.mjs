import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readDistJson} from '../core/runtime-root.mjs';

/**
 * Typed Orca call runner. Every argv is built from providers/orca/calls.json, every exit code and
 * receipt is classified into a starci/orca-call-result@1 envelope, and an Orca failure is returned
 * as a result instead of thrown. Only a contract violation (unknown call, bad parameters) throws.
 */
export const RESULT_SCHEMA='starci/orca-call-result@1';
export const defaultOrcaExecutable=process.platform==='win32'?'orca.exe':'orca';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=value=>typeof value==='string'&&value.trim().length>0;

export function loadOrcaCalls(){return readDistJson('providers','orca','calls.json');}

export function getPath(value,dotted){
  let current=value;
  for(const key of dotted.split('.')){
    if(!plain(current)&&!Array.isArray(current))return undefined;
    current=current[key];
  }
  return current;
}

const replays=call=>call.kind==='mutation'&&(call.replay??'retry-request')==='retry-request';

function callOf(calls,name){
  need(plain(calls)&&calls.schema==='starci/orca-calls@1','Orca calls contract starci/orca-calls@1 is required');
  const call=calls.calls?.[name];
  need(plain(call),`Unknown Orca call: ${name}`);
  return call;
}

/** Compare every declared call against the live agent-context command registry. */
export function verifyLiveSchema(calls,agentContext){
  const errors=[];
  const commands=agentContext?.commands??agentContext?.result?.commands;
  if(!Array.isArray(commands))return {ok:false,errors:['agent-context did not return a command registry'],commandCount:0};
  const schemaVersion=agentContext?.schemaVersion??agentContext?.result?.schemaVersion;
  if(schemaVersion!==calls.liveSchema.schemaVersion)errors.push(`agent-context schemaVersion ${schemaVersion} differs from contract ${calls.liveSchema.schemaVersion}`);
  const byCommand=new Map(commands.map(entry=>[entry.command,entry]));
  for(const [name,call] of Object.entries(calls.calls)){
    const live=byCommand.get(call.command);
    if(!live){errors.push(`Call ${name}: command "${call.command}" is not in the live Orca registry`);continue;}
    const liveFlags=new Set(live.flags??[]);
    const expected=[...call.flags,calls.defaults.jsonFlag,...(replays(call)?[calls.idempotency.flag]:[])];
    for(const flag of expected)if(!liveFlags.has(flag))errors.push(`Call ${name}: flag --${flag} is not accepted by live "${call.command}"`);
  }
  return {ok:errors.length===0,errors,commandCount:commands.length};
}

/** Build argv for one declared call from named parameters; throws on any contract violation. */
export function buildArgs(calls,name,params={},{retryRequest=null}={}){
  const call=callOf(calls,name);
  need(plain(params),`Parameters for ${name} must be an object`);
  const allowed=new Set(call.flags);
  for(const key of Object.keys(params)){
    need(!(call.forbidden??[]).includes(key),`Call ${name} forbids --${key}`);
    need(allowed.has(key),`Call ${name} does not declare --${key}`);
  }
  for(const key of call.required??[])need(params[key]!==undefined&&params[key]!==null&&params[key]!=='',`Call ${name} requires --${key}`);
  for(const [key,values] of Object.entries(call.forbiddenValues??{})){
    if(params[key]!==undefined)need(!values.includes(String(params[key]).toLowerCase()),`Call ${name} rejects literal --${key} ${params[key]}`);
  }
  const args=call.command.split(' ');
  for(const flag of call.flags){
    const value=params[flag];
    if(value===undefined||value===null||value===false)continue;
    if(value===true){args.push(`--${flag}`);continue;}
    need(typeof value==='string'||typeof value==='number',`Call ${name}: --${flag} must be a string, number or boolean`);
    args.push(`--${flag}`,String(value));
  }
  if(retryRequest){
    need(replays(call),`Call ${name} cannot carry --${calls.idempotency.flag}`);
    args.push(`--${calls.idempotency.flag}`,retryRequest);
  }
  args.push(`--${calls.defaults.jsonFlag}`);
  return args;
}

/** Deterministic idempotency key for one logical mutation attempt. */
export function retryRequestId(parts){
  const material=JSON.stringify(parts);
  return `starci-${crypto.createHash('sha256').update(material).digest('hex').slice(0,24)}`;
}

function residualResourcesOf(receipt){
  const direct=getPath(receipt,'result.residualResources')??getPath(receipt,'result.worker.residualResources');
  if(Array.isArray(direct))return direct;
  const raw=getPath(receipt,'result.worker.residual_resources');
  if(typeof raw==='string'){try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return parsed;}catch{}}
  return [];
}

function matches(when,{exitCode,receipt}){
  if(when.exitCode!==undefined&&when.exitCode!==exitCode)return false;
  if(when.path){
    const value=getPath(receipt,when.path);
    if(when.exists!==undefined&&(value!==undefined)!==when.exists)return false;
    if(when.in&&!when.in.includes(value))return false;
    if(when.nonEmpty!==undefined&&(Array.isArray(value)&&value.length>0)!==when.nonEmpty)return false;
    if(when.exists===undefined&&!when.in&&when.nonEmpty===undefined&&value===undefined)return false;
  }
  return true;
}

/** Classify one completed process into outcome/effectState using the call's declared rules. */
export function classifyReceipt(calls,name,{exitCode,receipt,spawnError=null,parseError=null}){
  const call=callOf(calls,name);
  const mutation=call.kind==='mutation';
  const base={stage:getPath(receipt,'result.worker.stage')??getPath(receipt,'result.stage')??getPath(receipt,'result.failedStage')??null,
    residualResources:residualResourcesOf(receipt),recovery:null};
  const recoveryKey=(outcome,effectState)=>effectState==='committed'?null:effectState==='none'?'failed':effectState;
  const finish=(outcome,effectState,reason)=>({...base,outcome,effectState,reason,
    recovery:call.recovery?.[recoveryKey(outcome,effectState)]??null});
  if(spawnError)return finish(mutation?'unknown':'failed',mutation?'unknown':'none',`Unable to execute Orca: ${spawnError}`);
  if(parseError)return finish(mutation?'unknown':'failed',mutation?'unknown':'none',`Orca returned non-JSON output: ${parseError}`);
  for(const rule of call.classify??[]){
    if(matches(rule.when,{exitCode,receipt}))return finish(rule.outcome,rule.effectState,rule.reason??getPath(receipt,'error.message')??getPath(receipt,'result.worker.last_error')??null);
  }
  const ok=exitCode===0&&receipt?.ok!==false;
  if(ok){
    const missing=(call.receipt??[]).filter(path=>getPath(receipt,path)===undefined);
    if(missing.length)return finish(mutation?'unknown':'failed',mutation?'unknown':'none',`Receipt is missing ${missing.join(', ')}`);
    return finish('ok',mutation?'committed':'none',null);
  }
  const message=getPath(receipt,'error.message')??getPath(receipt,'result.worker.last_error')??`Orca exited ${exitCode}`;
  if(base.residualResources.length)return finish('failed','partial',message);
  if(mutation&&!plain(receipt?.error)&&!plain(receipt?.result))return finish('unknown','unknown',message);
  return finish('failed','none',message);
}

/** Create a runner bound to one executable and one calls contract. */
export function createOrcaCalls({executable=defaultOrcaExecutable,calls=loadOrcaCalls(),spawn=spawnSync,now=Date.now}={}){
  need(plain(calls)&&calls.schema==='starci/orca-calls@1','Orca calls contract starci/orca-calls@1 is required');
  const runOnce=(name,args,{cwd})=>{
    const call=callOf(calls,name);
    const started=now();
    const completed=spawn(executable,args,{cwd,encoding:'utf8',windowsHide:true,shell:false,maxBuffer:64*1024*1024,
      timeout:(call.timeoutMs??calls.defaults.timeoutMs)+calls.defaults.spawnGraceMs});
    const attempt={args,exitCode:completed.status??null,durationMs:now()-started,stderr:typeof completed.stderr==='string'?completed.stderr.slice(-4000):'',receipt:null};
    let classification;
    if(completed.error)classification=classifyReceipt(calls,name,{exitCode:attempt.exitCode,receipt:null,spawnError:completed.error.message});
    else{
      try{attempt.receipt=JSON.parse(completed.stdout);}
      catch(error){classification=classifyReceipt(calls,name,{exitCode:attempt.exitCode,receipt:null,parseError:error.message});}
      if(!classification)classification=classifyReceipt(calls,name,{exitCode:attempt.exitCode,receipt:attempt.receipt});
    }
    return {attempt,classification};
  };
  function invoke(name,params={},{cwd=process.cwd(),retryRequest=null,replayUnknown=true}={}){
    const call=callOf(calls,name);
    const attempts=[];
    let args=buildArgs(calls,name,params);
    let {attempt,classification}=runOnce(name,args,{cwd});
    attempts.push({...attempt,...classification});
    if(classification.outcome==='unknown'&&replays(call)&&replayUnknown){
      const id=retryRequest??retryRequestId({name,params});
      args=buildArgs(calls,name,params,{retryRequest:id});
      ({attempt,classification}=runOnce(name,args,{cwd}));
      attempts.push({...attempt,...classification,retryRequest:id});
    }
    const last=attempts.at(-1);
    return {schema:RESULT_SCHEMA,call:name,command:call.command,kind:call.kind,args:last.args,exitCode:last.exitCode,
      outcome:classification.outcome,effectState:classification.effectState,reason:classification.reason,stage:classification.stage,
      residualResources:classification.residualResources,recovery:classification.recovery,receipt:last.receipt,attempts};
  }
  function verify({cwd=process.cwd()}={}){
    const context=invoke('agent-context',{},{cwd});
    if(context.outcome!=='ok')return {ok:false,errors:[`agent-context failed: ${context.reason}`],commandCount:0,result:context};
    return {...verifyLiveSchema(calls,context.receipt),result:context};
  }
  return {calls,executable,invoke,verify};
}

/** Return the receipt of an ok result or throw an error that carries the typed envelope. */
export function unwrap(result){
  if(result?.outcome==='ok')return result.receipt;
  const error=Error(`Orca ${result?.call??'call'} ${result?.outcome??'failed'} (${result?.effectState??'unknown'}): ${result?.reason??'no reason'}`);
  error.result=result;
  throw error;
}
