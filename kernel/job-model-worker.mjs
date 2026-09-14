import {openJournal} from './journal.mjs';
import * as modelFunctions from '../models/functions.mjs';
import {attestModelResult} from './job-attestation.mjs';

const [journalFile,jobId]=process.argv.slice(2),journal=openJournal({file:journalFile}),job=journal.getJob(jobId);
try{if(!job||job.payload?.handler!=='model-function')throw Error(`Missing model job ${jobId}`);const fn=modelFunctions[job.payload.functionName];if(typeof fn!=='function')throw Error(`Unknown model function ${job.payload.functionName}`);const result=fn(job.payload.args);process.stdout.write(JSON.stringify({result:attestModelResult(result,{functionName:job.payload.functionName,jobId,generation:job.generation,executorPid:process.pid,input:job.payload.args}),executorPid:process.pid}));}
catch(error){process.stderr.write(String(error?.stack??error));process.exitCode=1;}
finally{journal.close();}
