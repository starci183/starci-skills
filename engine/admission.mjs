import { createHash } from 'node:crypto';

const PATH_LEASE_PREFIX='path:';
const GLOB_META=/[*?[\]{}]/;
// Next.js App Router spells route segments as literal directory names: dynamic `[lang]`, catch-all
// `[...slug]` and optional catch-all `[[...opt]]`, optionally behind an intercept prefix `(.)`, `(..)`,
// `(...)` or `(..)(..)`. Route groups `(group)`, parallel slots `@slot` and intercepts on a static name
// carry no glob meta at all. A segment of exactly this shape is a concrete name, never a character class;
// every consumer that hands an owned path to a glob engine escapes it (git: ownedPathspec below).
const APP_ROUTER_SEGMENT=/^(?:\(\.{1,3}\))*(?:\[\[\.\.\.[A-Za-z0-9_$-]+\]\]|\[(?:\.\.\.)?[A-Za-z0-9_$-]+\])$/;

/** A Next.js App Router bracket segment (`[id]`, `[...slug]`, `[[...opt]]`, `(.)[id]`) — a literal directory name. */
export const isAppRouterSegment=part=>APP_ROUTER_SEGMENT.test(String(part??''));

/** A path segment that is a real glob (`*`, `?`, `{a,b}`, a bare character class), not an App Router name. */
export const isGlobSegment=part=>GLOB_META.test(String(part??''))&&!isAppRouterSegment(part);

/**
 * The git pathspec for one concrete owned path. Git reads a plain pathspec as a glob, so `src/app/[id]`
 * would also match a sibling `src/app/i`; `:(literal)` pins it to the named directory. Admission
 * refuses a glob, so every owned path is literal.
 */
export const ownedPathspec=spec=>`:(literal)${String(spec??'').replace(/\\/g,'/')||'.'}`;

const plainPath=value=>typeof value==='string'?value:value?.path;

/**
 * Canonical workspace-relative path prefix used by planning, leases and report boundaries. In a
 * multi-repository project the caller includes the repository binding prefix (for example `my-app/`).
 * A directory prefix is spelled either bare (`docs/`) or with a trailing `/**`, which normalizes to
 * the same prefix; every other glob, absolute path and parent traversal is refused because it is not
 * a concrete ownership boundary. A Next.js App Router segment (`[lang]`, `[...slug]`, `[[...opt]]`,
 * `(group)`, `@slot`, `(.)photo`) is a literal directory name and is admitted as one.
 */
export function normalizeOwnedPath(value){
  let input=String(plainPath(value)??'').trim().replace(/\\/g,'/');
  input=input.replace(/\/\*\*\/$/,'').replace(/\/\*\*$/,'');
  if(!input||input.startsWith('/')||/^[A-Za-z]:\//.test(input))throw Error(`owned path must be repository-relative: ${JSON.stringify(plainPath(value)??value)}`);
  const parts=[];
  for(const part of input.split('/')){
    if(!part||part==='.')continue;
    if(part==='..')throw Error(`owned path must not traverse its repository: ${JSON.stringify(plainPath(value)??value)}`);
    if(isGlobSegment(part))throw Error(`owned path must be a concrete prefix, not a glob: ${JSON.stringify(plainPath(value)??value)}`);
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
export const ownedPathLeaseRequests=values=>normalizeOwnedPaths(values).map(path=>({resourceKey:ownedPathLeaseKey(path),units:1}));

const leasePath=resourceKey=>String(resourceKey??'').startsWith(PATH_LEASE_PREFIX)
  ?String(resourceKey).slice(PATH_LEASE_PREFIX.length):null;

/**
 * The spelling two lease paths are compared in. The same file must compare equal however a workflow
 * spelled it (a past incident had `apps/app/src/messages/vi.json` spelled bare for
 * the fe repository while the repository-prefixed spelling of the same file never overlapped it). `canonicalOf`
 * (scripts/kernel/lease-canon.mjs) resolves a path to its app-relative form in a bound app
 * (be/<path>, fe/<path>) — for a held row through its holder job, so every spelling of one file
 * compares as one key; paths on Windows compare case-insensitively, as its file
 * systems do.
 */
export const leaseCompareForm=(leasePathValue,{canonicalOf=null,row=null,platform=process.platform}={})=>{
  let value=normalizeOwnedPath(leasePathValue);
  if(canonicalOf){try{value=normalizeOwnedPath(canonicalOf(value,row)??value);}catch{/* an unresolvable spelling compares as written */}}
  return platform==='win32'?value.toLowerCase():value;
};

/**
 * Find durable path leases that overlap a requested parent/child prefix. Lease-row existence is the
 * fence; expiry is only a recovery signal and does not by itself prove the prior worker has no effect.
 * Both sides are compared in leaseCompareForm, so a bare and a repository-prefixed spelling of one
 * file overlap and the same relative path in two repositories does not.
 */
export function findOwnedPathLeaseConflicts(db,requests,{excludeJobId=null,canonicalOf=null,platform=process.platform}={}){
  const requested=[...new Set(requests.map(item=>item?.resourceKey??item).filter(key=>leasePath(key)!==null))];
  if(!requested.length)return [];
  const held=db.prepare("SELECT resource_key,job_id,workflow_id,op_id,try_no AS attempt,generation,expires_at FROM leases WHERE resource_key LIKE 'path:%' ORDER BY resource_key,job_id").all();
  const formOf=new Map();
  const compare=(key,row)=>{
    const id=`${row?.job_id??''}\0${key}`;
    if(!formOf.has(id))formOf.set(id,leaseCompareForm(leasePath(key),{canonicalOf,row,platform}));
    return formOf.get(id);
  };
  const conflicts=[];
  for(const requestKey of requested){
    const requestPath=compare(requestKey,null);
    for(const row of held){
      if(excludeJobId&&row.job_id===excludeJobId)continue;
      if(ownedPathsIntersect(requestPath,compare(row.resource_key,row)))conflicts.push({requested:requestKey,held:row.resource_key,...row});
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

const rowObject=value=>{
  if(value&&typeof value==='object')return value;
  if(typeof value!=='string'||!value.trim())return {};
  try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:{};}catch{return {};}
};

/**
 * The durable payload/result of a job-shaped row: the parsed object when the row carries the decoded
 * field (a mapped ledger row), else the tolerant parse of its `*_json` text — a missing, blank or
 * unparsable field reads as {}. Several scripts spell this by hand; these are the one pair to cite.
 */
export const payloadOf=job=>rowObject(job?.payload??job?.payload_json);
export const resultOf=job=>rowObject(job?.result??job?.result_json);

/** The settled verdict of an attempt that asked the owner and waits for the answer. */
export const AWAITING_OWNER='awaiting-owner';
/**
 * jobs.status of a try that ended asking the owner (report outcome ask): settled, but neither a failure nor a spent try
 * (its unit's try budget and business retries ignore it). A retry or resume may follow it exactly as it follows `failed`.
 */
export const AWAITING_OWNER_STATUS='awaiting_owner';
export const RETRYABLE_JOB_STATUSES=Object.freeze(['failed',AWAITING_OWNER_STATUS]);
/** Every jobs.status that holds nothing the runtime still needs (mirrors engine/db/ledger.mjs JOB_STATUSES.settled). */
export const SETTLED_JOB_LIST=Object.freeze(['succeeded','failed',AWAITING_OWNER_STATUS,'cancelled']);
/** The tries of a unit that spent budget: every try but the ones that only waited on the owner. */
export const spentTries=tries=>tries.filter(job=>job.status!==AWAITING_OWNER_STATUS).length;
// An attempt the environment killed with effects on the tree (a host terminal wipe: every Orca terminal
// gone at once, scripts/kernel/cli.mjs hostTerminalWipeOf) settles failed with this retryClass: its retry
// is a new durable attempt that continues the partial tree and spends no business retry.
export const RETRY_CLASS_ENVIRONMENT='environment';

/**
 * Classify a settled attempt for retry accounting. Infrastructure is free only when the durable result
 * explicitly proves `effectState: none`; unknown or partial effects consume the ordinary business budget.
 * An attempt settled `awaiting-owner` asked a question and did not fail: its successor is a new durable
 * attempt (the ask attempt ran) that spends no business retry. Nor does one settled `peerBlocked`
 * (api settle: every red check was a peer's change, scripts/kernel/gate-attribution.mjs), nor one settled
 * with retryClass environment (RETRY_CLASS_ENVIRONMENT).
 */
export function retryDisposition(job){
  const result=resultOf(job),reason=String(result.reason??'');
  const infrastructure=result.retryClass==='infrastructure'||reason==='dispatch-rejected'||reason==='provider-unavailable';
  const explicitlyReusable=(result.retryable===true&&result.attemptConsumed===false)||result.retryClass==='infrastructure';
  const noEffect=infrastructure&&result.effectState==='none'&&explicitlyReusable;
  const ownerAnswer=!noEffect&&result.verdict===AWAITING_OWNER;
  const peerBlocked=!noEffect&&!ownerAnswer&&result.verdict!=='pass'&&Boolean(result.peerBlocked&&typeof result.peerBlocked==='object');
  const environment=!noEffect&&!ownerAnswer&&!peerBlocked&&result.retryClass===RETRY_CLASS_ENVIRONMENT&&result.attemptConsumed===false;
  return {
    retryClass:noEffect?'infrastructure':ownerAnswer?'owner-answer':peerBlocked?'peer-blocked':environment?RETRY_CLASS_ENVIRONMENT:'business',
    effectState:result.effectState??'unknown',
    resumable:noEffect,
    consumesBusinessRetry:!noEffect&&!ownerAnswer&&!peerBlocked&&!environment,
  };
}

/**
 * A row retired while still queued - `api reconcile --drop` (result.verdict `dropped`) or a goal revision
 * that superseded it (result.reason `goal-revision-superseded`) - with no dispatch binding in its payload.
 * It ran nothing, so it is no attempt: never a retry predecessor, never a cut seam, never the latest job
 * of its ordinal (inc-5005d003825a: a retry chained to a dropped ordinal-1 row as business attempt 2 and
 * lost the owner-answer lineage; inc-b428eb47fde3: ordinal 2 read a dropped seam as dependency-failed).
 */
export function retiredBeforeDispatch(job){
  if(job?.status!=='cancelled')return false;
  const result=resultOf(job),payload=payloadOf(job);
  if(result.verdict!=='dropped'&&result.reason!=='goal-revision-superseded')return false;
  const runtime=payload.hierarchy?.runtime??{};
  const bound=Boolean(job.worker_id||payload.managed||payload.orca||runtime.dispatchId||runtime.terminalHandle
    ||(Array.isArray(payload.rejectedDispatches)&&payload.rejectedDispatches.length));
  return !bound;
}


/** The cut slice a job row carries, or null: {id, ordinal} identify one bounded SAME-op slice. */
export function cutOf(job){
  const cut=payloadOf(job).cut;
  return cut&&cut.id!=null&&cut.ordinal!=null?{id:String(cut.id),ordinal:Number(cut.ordinal),total:Number(cut.total)}:null;
}


/* ------------------------------------------------------------ work units (H3, H4, H5) */

/** The default try budget of a unit (Q13; DBTREE work_units.try_budget). Only the owner or the Supervisor raises one. */
export const UNIT_TRY_BUDGET=5;
const shortDigest=value=>createHash('sha256').update(value).digest('hex').slice(0,16);
const lineagePaths=list=>(Array.isArray(list)?list:[]).map(item=>typeof item==='string'?item:item?.path).filter(p=>typeof p==='string'&&p.trim());
const normList=list=>[...new Set(lineagePaths(list).map(p=>p.replace(/\\/g,'/').replace(/\/\*\*$/,'').replace(/\/+$/,'')))].sort();

/**
 * The work identity of a job (DBTREE work_units.subject_key): a cut slice is `cut:<id>#<ordinal>`, an op about one
 * named subject `subject:<s>`, else the digest of its records, else of its owned paths. One op, one subject key and
 * one goal revision are ONE unit (UNIQUE(workflow_id, op_id, subject_key, goal_revision)): a try of the same work can
 * never start a fresh budget.
 */
export function unitSubjectKey({cut=null,params=null,records=[],ownedPaths=[]}={}){
  if(cut?.id!=null&&cut?.ordinal!=null)return `cut:${cut.id}#${Number(cut.ordinal)}`;
  const subject=typeof params?.subject==='string'&&params.subject.trim()?params.subject.trim():null;
  if(subject)return `subject:${subject}`;
  const recs=normList(records);
  if(recs.length)return `records:${shortDigest(recs.join('|'))}`;
  return `paths:${shortDigest(normList(ownedPaths).join('|'))}`;
}

/** Two jobs are tries of one work unit (jobs.unit_id). */
export const sameUnit=(a,b)=>Boolean(a?.unit_id&&a.unit_id===b?.unit_id);

const OPEN_TRY=['queued','ready','leased','running','answering','reported','deciding','effect_unknown'];
const refuseUnit=(message,code,extra={})=>Object.assign(new Error(message),{code,...extra});
/** The jobs.retry_class of a successor of `last` (DBTREE: business | infra | resume | follow-up). */
const retryClassOf=(last,disposition)=>last.status==='cancelled'?'resume'
  :disposition?.retryClass==='business'?'business'
    :disposition?.retryClass==='infrastructure'||disposition?.retryClass===RETRY_CLASS_ENVIRONMENT?'infra':'follow-up';
/**
 * Admit one more try of a unit (the code side of DBTREE jobs_enqueue_guard + work_units_done_guard), pure over the
 * unit's row and its tries. `tries` are the unit's jobs with {job_id, status, try_no, result_json?} (result_json the
 * settle result retryDisposition reads); `unit` is the work_units row. Returns {tryNo, retryOf, resumeOf, retryClass,
 * reopen} or throws a typed refusal:
 *   unit-in-flight             a try of the unit is still open (edit it, or let it settle first)
 *   unit-already-passed        the unit is done; a re-run needs an explicit reopen with a reason (H5)
 *   retry-lineage-invalid      retryOf is not the unit's latest try, or that try did not fail (H4)
 *   unit-try-budget-exhausted  try_no would pass work_units.try_budget; only the owner or the Supervisor raises it (H3)
 */
export function admitUnitTry({unit=null,tries=[],retryOf=null,reopen=null}={}){
  const ordered=[...tries].sort((a,b)=>Number(a.try_no)-Number(b.try_no));
  const last=ordered.at(-1)??null;
  if(!unit||!last){
    if(retryOf)throw refuseUnit(`--retry-of ${retryOf} names no earlier try of this unit`,'retry-lineage-invalid');
    return {tryNo:1,retryOf:null,resumeOf:null,retryClass:null,reopen:null};
  }
  const open=ordered.filter(job=>OPEN_TRY.includes(job.status));
  if(open.length)throw refuseUnit(`unit ${unit.unit_id} already has an open try ${open.map(j=>`${j.job_id} (${j.status})`).join(', ')}: edit that try (api graph-edit widen|params) or let it settle`,'unit-in-flight',{open:open.map(j=>j.job_id)});
  if(retryOf&&retryOf!==last.job_id)throw refuseUnit(`--retry-of ${retryOf} is not the latest try of unit ${unit.unit_id} (${last.job_id} is): a retry follows the unit's latest failed try`,'retry-lineage-invalid',{latest:last.job_id});
  const done=unit.state==='done'||last.status==='succeeded';
  if(done&&!(reopen?.reason&&reopen?.by))throw refuseUnit(`unit ${unit.unit_id} already passed (${last.job_id}); running it again needs an explicit reopen with a reason (--reopen <reason>)`,'unit-already-passed',{passed:last.job_id});
  if(retryOf&&!done&&!RETRYABLE_JOB_STATUSES.includes(last.status))throw refuseUnit(`--retry-of ${retryOf} is ${last.status}: a retry follows a FAILED or awaiting_owner try of the same unit`,'retry-lineage-invalid');
  const tryNo=Number(last.try_no)+1;
  if(tryNo-(ordered.length-spentTries(ordered))>Number(unit.try_budget))throw refuseUnit(`unit ${unit.unit_id} spent ${spentTries(ordered)} of its ${unit.try_budget} tries: the owner or the Supervisor decides (api unit --raise-budget), never another try`,'unit-try-budget-exhausted',{tries:Number(last.try_no),budget:Number(unit.try_budget)});
  if(done)return {tryNo,retryOf:null,resumeOf:null,retryClass:'follow-up',reopen:{reason:String(reopen.reason),by:String(reopen.by)}};
  const disposition=RETRYABLE_JOB_STATUSES.includes(last.status)?retryDisposition(last):null;
  const resume=last.status==='cancelled';
  return {tryNo,retryOf:resume?null:last.job_id,resumeOf:resume?last.job_id:null,retryClass:retryClassOf(last,disposition),reopen:null};
}
