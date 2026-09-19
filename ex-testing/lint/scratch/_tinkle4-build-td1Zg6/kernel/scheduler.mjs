export const DEFAULT_SCHEDULER_POLICY={maxUnverifiedCandidates:3,reservedReviewSlots:2};
const finite=value=>Number.isFinite(value)?value:0;
const identity=job=>`${job.workflowId??job.workflow_id}/${job.jobId??job.job_id}`;

export function rankJobs({jobs=[],graph={criticalPath:()=>0,unlockCount:()=>0},now=Date.now,progress={},eligibility,policy=DEFAULT_SCHEDULER_POLICY}={}){
  const chosen=[],deferred=[],stamp=typeof now==='function'?now():now;
  for(const job of jobs){
    if(job.status!=='queued'){deferred.push({job,reason:`job is ${job.status}`});continue;}
    if(['model','operation','judge'].includes(job.kind)&&typeof eligibility!=='function'){deferred.push({job,reason:'model eligibility unavailable'});continue;}
    const eligible=eligibility?eligibility(job):{eligible:true,reasons:[]};
    if(!eligible?.eligible){deferred.push({job,reason:(eligible?.reasons??['ineligible']).join('; ')});continue;}
    const review=/review|verify|repair|judge/.test(`${job.kind} ${job.role??''}`);
    const builders=finite(progress.unverifiedCandidates);
    if(!review&&builders>=policy.maxUnverifiedCandidates){deferred.push({job,reason:'unverified candidate backlog reached its limit'});continue;}
    const score={finish:review?2:(job.attempt>1?1:0),critical:finite(graph.criticalPath?.(job)),unlocks:finite(graph.unlockCount?.(job)),age:Math.max(0,stamp-finite(job.createdAt??job.created_at))};
    chosen.push({job,score});
  }
  chosen.sort((a,b)=>b.score.finish-a.score.finish||b.score.critical-a.score.critical||b.score.unlocks-a.score.unlocks||b.score.age-a.score.age||identity(a.job).localeCompare(identity(b.job)));
  return {ranked:chosen,deferred};
}

export function scheduleJobs({capacity=0,runningReview=0,...input}={}){
  const result=rankJobs(input),policy=input.policy??DEFAULT_SCHEDULER_POLICY;
  let general=Math.max(0,capacity-Math.max(0,policy.reservedReviewSlots-runningReview));
  const selected=[];
  for(const entry of result.ranked){const review=/review|verify|repair|judge/.test(`${entry.job.kind} ${entry.job.role??''}`);if(review&&selected.length<capacity)selected.push(entry);else if(general>0&&selected.length<capacity){selected.push(entry);general-=1;}}
  // Reserved review capacity is lendable when no review work is ready.
  if(!result.ranked.some(entry=>/review|verify|repair|judge/.test(`${entry.job.kind} ${entry.job.role??''}`)))for(const entry of result.ranked)if(!selected.includes(entry)&&selected.length<capacity)selected.push(entry);
  return {...result,selected};
}

export function updateProgressBudget(current={},observation={}){
  const next={attempts:finite(current.attempts),modelCalls:finite(current.modelCalls),tokens:finite(current.tokens),elapsedMs:finite(current.elapsedMs),lastProgress:current.lastProgress??null};
  next.attempts+=finite(observation.attempts);next.modelCalls+=finite(observation.modelCalls);next.tokens+=finite(observation.tokens);next.elapsedMs+=finite(observation.elapsedMs);
  const fingerprint=observation.progressFingerprint??null;
  if(fingerprint&&fingerprint!==next.lastProgress){next.attempts=0;next.modelCalls=0;next.tokens=0;next.elapsedMs=0;next.lastProgress=fingerprint;next.progressed=true;}else next.progressed=false;
  return next;
}

export function progressExhausted(progress,limits){return ['attempts','modelCalls','tokens','elapsedMs'].some(key=>Number.isFinite(limits?.[key])&&finite(progress?.[key])>=limits[key]);}
