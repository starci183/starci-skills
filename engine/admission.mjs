const PATH_LEASE_PREFIX='path:';
const GLOB_META=/[*?[\]{}]/;

const plainPath=value=>typeof value==='string'?value:value?.path;

/**
 * Canonical workspace-relative path prefix used by planning, leases and report boundaries. In a
 * multi-repository project the caller includes the repository binding prefix (for example `nivo-fe/`).
 * A directory prefix is spelled either bare (`docs/`) or with a trailing `/**`, which normalizes to
 * the same prefix; every other glob, absolute path and parent traversal is refused because it is not
 * a concrete ownership boundary.
 */
export function normalizeOwnedPath(value){
  let input=String(plainPath(value)??'').trim().replace(/\\/g,'/');
  input=input.replace(/\/\*\*\/$/,'').replace(/\/\*\*$/,'');
  if(!input||input.startsWith('/')||/^[A-Za-z]:\//.test(input))throw Error(`owned path must be repository-relative: ${JSON.stringify(plainPath(value)??value)}`);
  const parts=[];
  for(const part of input.split('/')){
    if(!part||part==='.')continue;
    if(part==='..')throw Error(`owned path must not traverse its repository: ${JSON.stringify(plainPath(value)??value)}`);
    if(GLOB_META.test(part))throw Error(`owned path must be a concrete prefix, not a glob: ${JSON.stringify(plainPath(value)??value)}`);
    parts.push(part);
  }
  if(!parts.length)throw Error(`owned path must name a concrete repository-relative prefix: ${JSON.stringify(plainPath(value)??value)}`);
  return parts.join('/');
}

/** Normalize, de-duplicate and collapse descendants already covered by an owned ancestor. */
export function normalizeOwnedPaths(values=[]){
  const paths=[...new Set(values.map(normalizeOwnedPath))].sort((a,b)=>a.length-b.length||a.localeCompare(b));
  return paths.filter((candidate,index)=>!paths.slice(0,index).some(parent=>ownedPathsIntersect(parent,candidate)));
}

/** Path-prefix overlap: equality or either concrete path being below the other. */
export function ownedPathsIntersect(left,right){
  const a=normalizeOwnedPath(left),b=normalizeOwnedPath(right);
  return a===b||a.startsWith(`${b}/`)||b.startsWith(`${a}/`);
}

/** The durable resource identity for one normalized concrete owned path. */
export const ownedPathLeaseKey=value=>`${PATH_LEASE_PREFIX}${normalizeOwnedPath(value)}`;

/** One capacity-one request per minimal owned prefix. */
export const ownedPathLeaseRequests=values=>normalizeOwnedPaths(values).map(path=>({resourceKey:`${PATH_LEASE_PREFIX}${path}`,units:1}));

const leasePath=resourceKey=>String(resourceKey??'').startsWith(PATH_LEASE_PREFIX)
  ?String(resourceKey).slice(PATH_LEASE_PREFIX.length):null;

/**
 * Find durable path leases that overlap a requested parent/child prefix. Lease-row existence is the
 * fence; expiry is only a recovery signal and does not by itself prove the prior worker has no effect.
 */
export function findOwnedPathLeaseConflicts(db,requests,{excludeJobId=null}={}){
  const requested=[...new Set(requests.map(item=>item?.resourceKey??item).filter(key=>leasePath(key)!==null))];
  if(!requested.length)return [];
  const held=db.prepare("SELECT resource_key,job_id,workflow_id,op_id,attempt,generation,expires_at FROM leases WHERE resource_key LIKE 'path:%' ORDER BY resource_key,job_id").all();
  const conflicts=[];
  for(const requestKey of requested){
    const requestPath=leasePath(requestKey);
    for(const row of held){
      if(excludeJobId&&row.job_id===excludeJobId)continue;
      const heldPath=leasePath(row.resource_key);
      if(ownedPathsIntersect(requestPath,heldPath))conflicts.push({requested:requestKey,held:row.resource_key,...row});
    }
  }
  return conflicts;
}

/**
 * The concurrent-operation ceiling one workflow is admitted at. Two declared numbers meet here and
 * the LOWER of them admits: the owner's `budgets.maxOps` (per workflow) and `maxParallelOps` from
 * modules/models/runtimes.yaml (fleet-wide). A null, absent or non-positive value is unbounded, so
 * a workflow with no owner budget still meets the fleet ceiling. A parallelism gear raises what
 * `api estimate` requests and never raises either of these.
 */
export function opSlotCeiling({maxOps=null,maxParallelOps=null}={}){
  const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
  const owner=positive(maxOps),fleet=positive(maxParallelOps);
  if(owner===null&&fleet===null)return {ceiling:null,source:null};
  if(owner===null)return {ceiling:fleet,source:'maxParallelOps'};
  if(fleet===null)return {ceiling:owner,source:'budgets.maxOps'};
  return owner<=fleet?{ceiling:owner,source:'budgets.maxOps'}:{ceiling:fleet,source:'maxParallelOps'};
}

/**
 * Admission against that ceiling. `running` is how many operations of the one workflow already hold
 * a slot; a job at or above the ceiling is refused `max-ops` rather than launched and left to
 * discover the cap from a provider.
 */
export function admitOpSlot({running=0,maxOps=null,maxParallelOps=null}={}){
  const {ceiling,source}=opSlotCeiling({maxOps,maxParallelOps});
  const held=Math.max(0,Number(running)||0);
  if(ceiling===null)return {ok:true,running:held,ceiling:null,ceilingSource:null,reason:null};
  return held<ceiling
    ?{ok:true,running:held,ceiling,ceilingSource:source,reason:null}
    :{ok:false,running:held,ceiling,ceilingSource:source,reason:'max-ops'};
}

const object=value=>{
  if(value&&typeof value==='object')return value;
  if(typeof value!=='string'||!value.trim())return {};
  try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:{};}catch{return {};}
};

const payloadOf=job=>object(job?.payload??job?.payload_json);
const resultOf=job=>object(job?.result??job?.result_json);

/** The settled verdict of an attempt that asked the owner and waits for the answer. */
export const AWAITING_OWNER='awaiting-owner';

/**
 * Classify a settled attempt for retry accounting. Infrastructure is free only when the durable result
 * explicitly proves `effectState: none`; unknown or partial effects consume the ordinary business budget.
 * An attempt settled `awaiting-owner` asked a question and did not fail: its successor is a new durable
 * attempt (the ask attempt ran) that spends no business retry.
 */
export function retryDisposition(job){
  const result=resultOf(job),reason=String(result.reason??'');
  const infrastructure=result.retryClass==='infrastructure'||reason==='dispatch-rejected'||reason==='provider-unavailable';
  const explicitlyReusable=(result.retryable===true&&result.attemptConsumed===false)||result.retryClass==='infrastructure';
  const noEffect=infrastructure&&result.effectState==='none'&&explicitlyReusable;
  const ownerAnswer=!noEffect&&result.verdict===AWAITING_OWNER;
  return {
    retryClass:noEffect?'infrastructure':ownerAnswer?'owner-answer':'business',
    effectState:result.effectState??'unknown',
    resumable:noEffect,
    consumesBusinessRetry:!noEffect&&!ownerAnswer,
  };
}

/**
 * Derive the next retry/resume identity. A proven no-effect launch rejection reuses the queued durable
 * attempt; an effectful/business failure advances both durable and business attempt ordinals.
 * `options.priorBusinessAttempt` overrides the predecessor's recorded business attempt (a cut ordinal counts
 * its own chain, see cutRetryLineage); `options.attempt` is the durable attempt the new row actually takes
 * when that differs from predecessor+1 (a cut ordinal shares the op's durable attempt counter).
 */
export function deriveRetryLineage(priorJob,{attempt=null,priorBusinessAttempt=null}={}){
  if(!priorJob?.job_id&&!priorJob?.jobId)throw Error('retry lineage needs a prior durable job');
  const payload=payloadOf(priorJob),disposition=retryDisposition(priorJob);
  const priorAttempt=Number(priorJob.attempt);
  if(!Number.isInteger(priorAttempt)||priorAttempt<1)throw Error('retry lineage needs a positive durable attempt');
  const priorBusiness=Number(priorBusinessAttempt??payload.retry?.businessAttempt??payload.businessAttempt??priorAttempt);
  const priorJobId=priorJob.job_id??priorJob.jobId;
  return {
    retryOf:disposition.resumable?null:priorJobId,
    resumeOf:disposition.resumable?priorJobId:null,
    attempt:disposition.resumable?priorAttempt:Number.isInteger(attempt)?attempt:priorAttempt+1,
    businessAttempt:priorBusiness+(disposition.consumesBusinessRetry?1:0),
    retryClass:disposition.retryClass,
    effectState:disposition.effectState,
    resumed:disposition.resumable,
    reusesDurableAttempt:disposition.resumable,
    consumesBusinessRetry:disposition.consumesBusinessRetry,
  };
}

/** The cut slice a job row carries, or null: {id, ordinal} identify one bounded SAME-op slice. */
export function cutOf(job){
  const cut=payloadOf(job).cut;
  return cut&&cut.id!=null&&cut.ordinal!=null?{id:String(cut.id),ordinal:Number(cut.ordinal),total:Number(cut.total)}:null;
}

/**
 * Retry lineage of a cut ordinal. A cut's ordinals share the op's durable attempt counter but are
 * independent slices, so the predecessor is the latest job with the SAME op, cut id AND ordinal - never a
 * sibling ordinal that happened to run later - and the business attempt counts only that ordinal's own
 * business attempts (1 + every earlier same-ordinal attempt whose disposition consumed one). `ordinalJobs`
 * are that ordinal's prior jobs (any order); the result is null when the ordinal has none (a first attempt).
 */
export function cutRetryLineage(ordinalJobs,{attempt=null}={}){
  const jobs=[...(ordinalJobs??[])].sort((a,b)=>Number(a.attempt)-Number(b.attempt));
  if(!jobs.length)return null;
  const prior=jobs.at(-1);
  const priorBusinessAttempt=1+jobs.slice(0,-1).filter(job=>retryDisposition(job).consumesBusinessRetry).length;
  return deriveRetryLineage(prior,{attempt,priorBusinessAttempt});
}
