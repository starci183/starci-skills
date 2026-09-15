import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openJournal} from './journal.mjs';
import {createAdmission} from './admission.mjs';
import {createJobs} from './jobs.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=value=>crypto.createHash('sha256').update(String(value??'')).digest('hex');
const safeError=error=>({name:String(error?.name??'Error').slice(0,80),code:error?.code?String(error.code).slice(0,80):null,messageDigest:digest(error?.message??error)});
const receiptFile=(journalFile,jobId)=>path.join(`${path.resolve(journalFile)}.workers`,`${digest(jobId)}.jsonl`);
export const stagedResultFile=(journalFile,jobId)=>path.join(`${path.resolve(journalFile)}.workers`,`${digest(jobId)}.result.json`);
function receipt(file,event,fields={}){try{fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.appendFileSync(file,`${JSON.stringify({schema:'starci/job-worker-lifecycle@1',at:Date.now(),pid:process.pid,event,...fields})}\n`,{encoding:'utf8',mode:0o600});}catch{}}
const resultIdentity=job=>({jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseTokenDigest:digest(job.lease_token),payloadDigest:digest(JSON.stringify(job.payload))});
const sameIdentity=(a,b)=>Object.keys(b).every(key=>a?.[key]===b[key]);
function readStagedResult(journalFile,job){const file=stagedResultFile(journalFile,job.job_id);if(!fs.existsSync(file))return null;let staged;try{staged=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){throw Object.assign(Error('staged result is unreadable'),{code:'STARCI_STAGED_RESULT_INVALID',effectUnknown:true,cause:error});}const expected=resultIdentity(job),actualDigest=digest(JSON.stringify(staged?.result));if(staged?.schema!=='starci/staged-job-result@1'||!sameIdentity(staged.identity,expected)||staged.resultDigest!==actualDigest)throw Object.assign(Error('staged result identity or digest mismatch'),{code:'STARCI_STAGED_RESULT_INVALID',effectUnknown:true});return {...staged,file};}
export function hasReplayableStagedResult(journalFile,job){try{return Boolean(readStagedResult(journalFile,job));}catch{return false;}}
function stageResult(journalFile,job,result){const file=stagedResultFile(journalFile,job.job_id),existing=readStagedResult(journalFile,job);if(existing){if(existing.resultDigest!==digest(JSON.stringify(result)))throw Object.assign(Error('staged result conflicts with completed provider result'),{code:'STARCI_STAGED_RESULT_CONFLICT',effectUnknown:true});return existing;}const staged={schema:'starci/staged-job-result@1',identity:resultIdentity(job),resultDigest:digest(JSON.stringify(result)),result};fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temporary=`${file}.${process.pid}.${crypto.randomUUID()}.tmp`;fs.writeFileSync(temporary,JSON.stringify(staged),{encoding:'utf8',mode:0o600,flag:'wx'});try{fs.renameSync(temporary,file);}catch(error){try{fs.unlinkSync(temporary);}catch{}const raced=readStagedResult(journalFile,job);if(!raced||raced.resultDigest!==staged.resultDigest)throw error;return raced;}return {...staged,file};}

async function completeWithRetry(complete,spec,{attempts=4,wait=delay,onFailure=()=>{}}={}){
  let last;for(let attempt=1;attempt<=attempts;attempt+=1){try{const result=complete(spec);if(!result?.ok)throw Object.assign(Error(result?.reason??'stale completion fence'),{code:'STARCI_COMPLETION_REJECTED'});return result;}catch(error){last=error;onFailure(error,attempt);if(attempt<attempts)await wait(Math.min(250,25*2**(attempt-1)));}}
  throw last;
}

export async function runDurableJob({journalFile,jobId,leaseToken,open=openJournal,spawnChild=spawn,wait=delay,admissionFactory=createAdmission,jobsFactory=createJobs}={}){
  const lifecycle=receiptFile(journalFile,jobId);receipt(lifecycle,'wrapper-started',{jobIdDigest:digest(jobId)});let journal,job,jobs,admission,providerRan=false,resultDigest=null,bound=false;
  const event=(kind,payload={})=>{receipt(lifecycle,kind,payload);try{journal?.appendEvent({eventId:`${jobId}:${kind}${Number.isInteger(payload.attempt)?`:${payload.attempt}`:''}`,workflowId:job?.workflow_id??'unbound',entityType:'job',entityId:jobId,generation:job?.generation??0,kind:`job-${kind}`,payload});}catch{}};
  try{
    journal=open({file:journalFile});admission=admissionFactory({journal});jobs=jobsFactory({journal,admission});job=journal.getJob(jobId);
    if(!job)throw Object.assign(Error('stale durable job fence'),{code:'STARCI_STALE_JOB'});
    if(['succeeded','failed','cancelled'].includes(job.status))throw Object.assign(Error('durable job is already terminal'),{code:'STARCI_INACTIVE_JOB'});
    if(job.lease_token!==leaseToken)throw Object.assign(Error('stale durable job fence'),{code:'STARCI_STALE_JOB'});
    const stagedReplay=job.status==='effect_unknown'?readStagedResult(journalFile,job):null;
    const initial=job.status==='leased'&&job.worker_id==null,replay=(job.status==='running'&&job.worker_id==='completion-replay-pending')||Boolean(stagedReplay);
    if(!initial&&!replay)throw Object.assign(Error('durable job is not available for this wrapper'),{code:'STARCI_INACTIVE_JOB'});
    const claimed=initial
      ?journal.db.prepare("UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status='leased' AND worker_id IS NULL").run(`pid:${process.pid}`,Date.now(),jobId,leaseToken)
      :stagedReplay
        ?journal.db.prepare("UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status='effect_unknown'").run(`pid:${process.pid}`,Date.now(),jobId,leaseToken)
        :journal.db.prepare("UPDATE jobs SET worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status='running' AND worker_id='completion-replay-pending'").run(`pid:${process.pid}`,Date.now(),jobId,leaseToken);
    if(claimed.changes!==1)throw Object.assign(Error('durable job active-state fence changed'),{code:'STARCI_STALE_JOB'});bound=true;event('wrapper-bound',{workerPid:process.pid,replay});
    const staged=stagedReplay??readStagedResult(journalFile,job);let result;
    if(staged){result=staged.result;resultDigest=staged.resultDigest;event('result-replayed',{resultDigest});}
    else{if(job.payload.handler==='model-function'){providerRan=true;result=(await runModelWithHeartbeat(job,leaseToken,{journalFile,admission,spawnChild,event})).result;}
      else if(job.payload.handler==='command'){providerRan=true;result=await runCommand(job.payload,job,leaseToken,{admission,spawnChild,event});}
      else throw Object.assign(Error(`Unknown durable job handler`),{code:'STARCI_UNKNOWN_HANDLER'});
      resultDigest=digest(JSON.stringify(result));const saved=stageResult(journalFile,job,result);if(saved.resultDigest!==resultDigest)throw Object.assign(Error('staged result digest changed'),{code:'STARCI_STAGED_RESULT_CONFLICT',effectUnknown:true});event('result-ready',{resultDigest});}
    await completeWithRetry(spec=>jobs.complete(spec),{jobId,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken,eventId:`${jobId}:${job.generation}:terminal`,status:'succeeded',result},{wait,onFailure:(error,attempt)=>event('completion-retry',{attempt,...safeError(error),resultDigest})});
    try{fs.unlinkSync(stagedResultFile(journalFile,jobId));}catch(error){if(error?.code!=='ENOENT')event('staged-result-cleanup-failed',{...safeError(error),resultDigest});}
    event('wrapper-completed',{status:'succeeded',resultDigest});return {ok:true};
  }catch(error){
    event('wrapper-failed',{providerRan,...safeError(error)});
    if(bound&&job&&jobs){
      try{
        if(resultDigest){journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,result_json=?,updated_at=? WHERE job_id=? AND lease_token=?").run(JSON.stringify({reason:'terminal persistence failed after result',resultDigest}),Date.now(),jobId,leaseToken);event('completion-uncommitted',{providerRan,resultDigest,...safeError(error)});}
        else if(error?.effectUnknown){journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,result_json=?,updated_at=? WHERE job_id=? AND lease_token=?").run(JSON.stringify({reasonDigest:digest(error.message)}),Date.now(),jobId,leaseToken);event('effect-unknown',{pid:error.pid??null,...safeError(error)});}
        else await completeWithRetry(spec=>jobs.complete(spec),{jobId,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken,eventId:`${jobId}:${job.generation}:terminal`,status:'failed',result:{reason:String(error?.stack??error)}},{wait,onFailure:(failure,attempt)=>event('failure-completion-retry',{attempt,...safeError(failure)})});
      }catch(completionError){try{journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,result_json=?,updated_at=? WHERE job_id=? AND lease_token=?").run(JSON.stringify({reason:'terminal persistence failed',error:safeError(completionError)}),Date.now(),jobId,leaseToken);}catch{}event('completion-uncommitted',{providerRan,...safeError(completionError)});}
    }
    return {ok:false,error};
  }finally{try{journal?.close();}catch(error){receipt(lifecycle,'journal-close-failed',safeError(error));}}
}

function runCommand({command,args=[],shellCommand,cwd,timeoutMs,env=null},ownedJob,token,{admission,spawnChild,event}){return new Promise((resolve,reject)=>{const options={cwd,env:env?{...process.env,...env}:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']};const child=shellCommand?spawnChild(shellCommand,{...options,shell:true}):spawnChild(command,args,options);event('nested-started',{nestedPid:child.pid??null,handler:'command'});let stdout='',stderr='',timedOut=false;const pulse=setInterval(()=>admission.renew({jobId:ownedJob.job_id,generation:ownedJob.generation,leaseToken:token,ttlMs:15*60*1000}),5*60*1000),timer=setTimeout(async()=>{timedOut=true;clearInterval(pulse);const stopped=await stopOwnedTree(child.pid,spawnChild);reject(stopped?Error(`Command timed out after ${timeoutMs}ms and its process tree was stopped`):Object.assign(Error(`Command timed out after ${timeoutMs}ms; process-tree termination is unconfirmed`),{effectUnknown:true,pid:child.pid}));},timeoutMs);child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('error',error=>{clearInterval(pulse);clearTimeout(timer);event('nested-error',{nestedPid:child.pid??null,...safeError(error)});reject(error);});child.on('close',(status,signal)=>{clearInterval(pulse);clearTimeout(timer);event('nested-closed',{nestedPid:child.pid??null,status:Number.isInteger(status)?status:null,signal:signal??null,stdoutDigest:digest(stdout),stderrDigest:digest(stderr)});if(!timedOut)resolve({status,stdout,stderr});});});}

function runModelWithHeartbeat(job,token,{journalFile,admission,spawnChild,event}){return new Promise((resolve,reject)=>{const executor=path.join(path.dirname(fileURLToPath(import.meta.url)),'job-model-worker.mjs');const child=spawnChild(process.execPath,[executor,journalFile,job.job_id],{windowsHide:true,stdio:['ignore','pipe','pipe']});event('nested-started',{nestedPid:child.pid??null,handler:'model-function',functionName:job.payload.functionName});let stdout='',stderr='',lineBuffer='',providerEvent=0,timedOut=false;const observe=data=>{lineBuffer+=data;const lines=lineBuffer.split(/\r?\n/);lineBuffer=lines.pop()??'';for(const line of lines){let item;try{item=JSON.parse(line);}catch{continue;}const type=String(item?.type??item?.event??'').slice(0,80),sessionId=item?.thread_id??item?.threadId??item?.session_id??null;if(sessionId)event('provider-session',{attempt:++providerEvent,type,sessionId:String(sessionId).slice(0,160)});else if(type)event('provider-event',{attempt:++providerEvent,type,itemType:String(item?.item?.type??'').slice(0,80)});}};const pulse=setInterval(()=>admission.renew({jobId:job.job_id,generation:job.generation,leaseToken:token,ttlMs:15*60*1000}),5*60*1000),timeoutMs=Number(job.payload?.modelTimeoutMs??30*60*1000),timer=setTimeout(async()=>{timedOut=true;clearInterval(pulse);const stopped=await stopOwnedTree(child.pid,spawnChild);reject(stopped?Error(`Model executor timed out after ${timeoutMs}ms and its process tree was stopped`):Object.assign(Error('Model executor timed out; process-tree termination is unconfirmed'),{effectUnknown:true,pid:child.pid}));},timeoutMs);child.stdout.on('data',data=>{stdout+=data;observe(String(data));});child.stderr.on('data',data=>stderr+=data);child.on('error',error=>{clearInterval(pulse);clearTimeout(timer);event('nested-error',{nestedPid:child.pid??null,...safeError(error)});reject(error);});child.on('close',(status,signal)=>{clearInterval(pulse);clearTimeout(timer);event('nested-closed',{nestedPid:child.pid??null,status:Number.isInteger(status)?status:null,signal:signal??null,stdoutDigest:digest(stdout),stderrDigest:digest(stderr),providerEvents:providerEvent});if(timedOut)return;if(status!==0)return reject(Error(stderr||`Model executor exited ${status}`));try{resolve(JSON.parse(stdout));}catch(error){reject(Error(`Model executor returned invalid JSON: ${error.message}`));}});});}

function stopOwnedTree(pid,spawnChild=spawn){return new Promise(resolve=>{if(!Number.isInteger(pid)||pid<=0)return resolve(false);if(process.platform==='win32'){const killer=spawnChild('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>resolve(false));killer.on('close',status=>resolve(status===0));return;}try{process.kill(pid,'SIGTERM');}catch(error){return resolve(error?.code==='ESRCH');}setTimeout(()=>{try{process.kill(pid,0);resolve(false);}catch(error){resolve(error?.code==='ESRCH');}},250);});}

const invoked=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){const [journalFile,jobId,leaseToken]=process.argv.slice(2);const result=await runDurableJob({journalFile,jobId,leaseToken});if(!result.ok)process.exitCode=1;}
