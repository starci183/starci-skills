import {spawn} from 'node:child_process';
import {openJournal} from './journal.mjs';
import {createAdmission} from './admission.mjs';
import {createJobs} from './jobs.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [journalFile,jobId,leaseToken]=process.argv.slice(2);
const journal=openJournal({file:journalFile}),admission=createAdmission({journal}),jobs=createJobs({journal,admission});
const job=journal.getJob(jobId);
if(!job||job.lease_token!==leaseToken){journal.close();process.exitCode=2;}
else{
  journal.db.prepare("UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=?").run(`pid:${process.pid}`,Date.now(),jobId,leaseToken);
  try{
    let result;
    if(job.payload.handler==='model-function')result=(await runModelWithHeartbeat(job,leaseToken)).result;
    else if(job.payload.handler==='command')result=await runCommand(job.payload,job,leaseToken);
    else throw Error(`Unknown durable job handler ${job.payload.handler}`);
    jobs.complete({jobId,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken,eventId:`${jobId}:${job.generation}:terminal`,status:'succeeded',result});
  }catch(error){if(error?.effectUnknown){journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,result_json=?,updated_at=? WHERE job_id=? AND lease_token=?").run(JSON.stringify({reason:String(error.message)}),Date.now(),jobId,leaseToken);journal.appendEvent({eventId:`${jobId}:${job.generation}:effect-unknown`,workflowId:job.workflow_id,entityType:'job',entityId:jobId,generation:job.generation,kind:'job-effect-unknown',payload:{reason:String(error.message),pid:error.pid??null}});}else jobs.complete({jobId,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken,eventId:`${jobId}:${job.generation}:terminal`,status:'failed',result:{reason:String(error?.stack??error)}});process.exitCode=1;}
  finally{journal.close();}
}

function runCommand({command,args=[],shellCommand,cwd,timeoutMs,env=null},ownedJob,token){return new Promise((resolve,reject)=>{const options={cwd,env:env?{...process.env,...env}:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']};const child=shellCommand?spawn(shellCommand,{...options,shell:true}):spawn(command,args,options);let stdout='',stderr='',timedOut=false;const pulse=setInterval(()=>admission.renew({jobId:ownedJob.job_id,generation:ownedJob.generation,leaseToken:token,ttlMs:15*60*1000}),5*60*1000),timer=setTimeout(async()=>{timedOut=true;clearInterval(pulse);const stopped=await stopOwnedTree(child.pid);reject(stopped?Error(`Command timed out after ${timeoutMs}ms and its process tree was stopped`):Object.assign(Error(`Command timed out after ${timeoutMs}ms; process-tree termination is unconfirmed`),{effectUnknown:true,pid:child.pid}));},timeoutMs);child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('error',error=>{clearInterval(pulse);clearTimeout(timer);reject(error);});child.on('close',status=>{clearInterval(pulse);clearTimeout(timer);if(!timedOut)resolve({status,stdout,stderr});});});}

function runModelWithHeartbeat(job,token){return new Promise((resolve,reject)=>{const executor=path.join(path.dirname(fileURLToPath(import.meta.url)),'job-model-worker.mjs');const child=spawn(process.execPath,[executor,journalFile,job.job_id],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false;const pulse=setInterval(()=>admission.renew({jobId:job.job_id,generation:job.generation,leaseToken:token,ttlMs:15*60*1000}),5*60*1000),timeoutMs=Number(job.payload?.modelTimeoutMs??30*60*1000),timer=setTimeout(async()=>{timedOut=true;clearInterval(pulse);const stopped=await stopOwnedTree(child.pid);reject(stopped?Error(`Model executor timed out after ${timeoutMs}ms and its process tree was stopped`):Object.assign(Error('Model executor timed out; process-tree termination is unconfirmed'),{effectUnknown:true,pid:child.pid}));},timeoutMs);child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('error',error=>{clearInterval(pulse);clearTimeout(timer);reject(error);});child.on('close',status=>{clearInterval(pulse);clearTimeout(timer);if(timedOut)return;if(status!==0)return reject(Error(stderr||`Model executor exited ${status}`));try{resolve(JSON.parse(stdout));}catch(error){reject(Error(`Model executor returned invalid JSON: ${error.message}`));}});});}

function stopOwnedTree(pid){return new Promise(resolve=>{if(!Number.isInteger(pid)||pid<=0)return resolve(false);if(process.platform==='win32'){const killer=spawn('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>resolve(false));killer.on('close',status=>resolve(status===0));return;}try{process.kill(pid,'SIGTERM');}catch(error){return resolve(error?.code==='ESRCH');}setTimeout(()=>{try{process.kill(pid,0);resolve(false);}catch(error){resolve(error?.code==='ESRCH');}},250);});}
