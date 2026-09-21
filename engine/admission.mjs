const PATH_LEASE_PREFIX='path:';
const GLOB_META=/[*?[\]{}]/;

const plainPath=value=>typeof value==='string'?value:value?.path;

/**
 * Canonical workspace-relative path prefix used by planning, leases and report boundaries. In a
 * multi-repository project the caller includes the repository binding prefix (for example `nivo-fe/`).
 * A legacy trailing `/**` is accepted as spelling for the directory prefix; every other glob,
 * absolute path and parent traversal is refused because it is not a concrete ownership boundary.
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

const object=value=>{
  if(value&&typeof value==='object')return value;
  if(typeof value!=='string'||!value.trim())return {};
  try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:{};}catch{return {};}
};

const payloadOf=job=>object(job?.payload??job?.payload_json);
const resultOf=job=>object(job?.result??job?.result_json);

/**
 * Classify a settled attempt for retry accounting. Infrastructure is free only when the durable result
 * explicitly proves `effectState: none`; unknown or partial effects consume the ordinary business budget.
 */
export function retryDisposition(job){
  const result=resultOf(job),reason=String(result.reason??'');
  const infrastructure=result.retryClass==='infrastructure'||reason==='dispatch-rejected'||reason==='provider-unavailable';
  const explicitlyReusable=(result.retryable===true&&result.attemptConsumed===false)||result.retryClass==='infrastructure';
  const noEffect=infrastructure&&result.effectState==='none'&&explicitlyReusable;
  return {
    retryClass:noEffect?'infrastructure':'business',
    effectState:result.effectState??'unknown',
    resumable:noEffect,
    consumesBusinessRetry:!noEffect,
  };
}

/**
 * Derive the next retry/resume identity. A proven no-effect launch rejection reuses the queued durable
 * attempt; an effectful/business failure advances both durable and business attempt ordinals.
 */
export function deriveRetryLineage(priorJob){
  if(!priorJob?.job_id&&!priorJob?.jobId)throw Error('retry lineage needs a prior durable job');
  const payload=payloadOf(priorJob),disposition=retryDisposition(priorJob);
  const priorAttempt=Number(priorJob.attempt);
  if(!Number.isInteger(priorAttempt)||priorAttempt<1)throw Error('retry lineage needs a positive durable attempt');
  const priorBusiness=Number(payload.retry?.businessAttempt??payload.businessAttempt??priorAttempt);
  const priorJobId=priorJob.job_id??priorJob.jobId;
  return {
    retryOf:disposition.resumable?null:priorJobId,
    resumeOf:disposition.resumable?priorJobId:null,
    attempt:priorAttempt+(disposition.resumable?0:1),
    businessAttempt:priorBusiness+(disposition.consumesBusinessRetry?1:0),
    retryClass:disposition.retryClass,
    effectState:disposition.effectState,
    resumed:disposition.resumable,
    reusesDurableAttempt:disposition.resumable,
    consumesBusinessRetry:disposition.consumesBusinessRetry,
  };
}
