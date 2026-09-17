import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,verifyAnchor,verifyChain} from './ledger-db.mjs';
import {replaceStateSnapshot,stateGoalIdentity} from './store.mjs';

export const CONTINUATION_BRIEF='starci/workflow-continuation@1';
export const CONTINUATION_SECTION_START=`<!-- ${CONTINUATION_BRIEF}:managed-start -->`;
export const CONTINUATION_SECTION_END=`<!-- ${CONTINUATION_BRIEF}:managed-end -->`;
const SETTLED=new Set(['succeeded','failed','cancelled']);
const DONE=new Set(['done','skipped']);
const slash=value=>String(value??'').replaceAll('\\','/');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=value=>String(value??'').replaceAll('|','\\|').replace(/[\r\n]+/g,' ').trim()||'—';
const json=value=>text(JSON.stringify(value??null));
const list=value=>Array.isArray(value)?value:[];

const livePid=pid=>{try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}};
function readController(store,state){
  try{
    const file=state?.engine?.ledgerFile;
    if(typeof file!=='string'||!fs.existsSync(file))return {pid:null,startedAt:null,startupTokenDigest:null,alive:false};
    let ledger,lock=null;
    try{ledger=inspectLedger({file});
      lock=ledger.db.prepare("SELECT holder_pid,token,value_json,at,expires_at FROM signals WHERE scope=? AND key='kernel-lock'").get(state.id)??null;
    }finally{ledger?.close();}
    let value=null;try{value=JSON.parse(lock?.value_json??'null');}catch{}
    const pid=Number(lock?.holder_pid??value?.pid),
      alive=Number.isInteger(pid)&&pid>0&&(!lock?.expires_at||lock.expires_at>Date.now())&&livePid(pid),
      token=typeof lock?.token==='string'?lock.token:(typeof value?.startupToken==='string'?value.startupToken:null);
    return {pid:Number.isInteger(pid)&&pid>0?pid:null,startedAt:Number(lock?.at??value?.startedAt)||null,
      startupTokenDigest:token?sha256(token):null,alive};
  }catch{return {pid:null,startedAt:null,startupTokenDigest:null,alive:false};}
}

// The repo that owns `.starciwork` and, with it, the tracked anchor (`.starciwork/ledger-anchor.json`):
// ledgerFileFor(repoRoot) joins the same two segments, so this is the exact inverse.
const anchorRepoRoot=file=>path.dirname(path.dirname(file));

function readLedger(state){
  const file=state?.engine?.ledgerFile;
  if(typeof file!=='string')return {file:null,jobs:[],leases:[],snapshot:null,snapshotHead:null,eventsHead:null,kernelLock:null,chain:null,anchor:null,error:null};
  if(!fs.existsSync(file)){
    let anchor=null;try{anchor=verifyAnchor(null,anchorRepoRoot(file));}catch(error){anchor={ok:false,reason:String(error?.message??error)};}
    return {file,jobs:[],leases:[],snapshot:null,snapshotHead:null,eventsHead:null,kernelLock:null,chain:null,anchor,error:null};
  }
  let ledger;
  try{
    ledger=inspectLedger({file});
    const jobs=ledger.db.prepare('SELECT job_id,workflow_id,op_id,attempt,generation,kind,status,worker_id,deadline,lease_token FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id').all(state.id);
    const leases=ledger.db.prepare('SELECT resource_key,job_id,workflow_id,op_id,attempt,generation,token,expires_at FROM leases WHERE workflow_id=? ORDER BY job_id,resource_key').all(state.id);
    const row=ledger.db.prepare('SELECT checkpoint_id,generation,goal_identity,state_json,events_head,created_at FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id DESC LIMIT 1').get(state.id);
    const eventsHead=ledger.db.prepare('SELECT seq,digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(state.id)??null;
    const kernelLock=ledger.db.prepare("SELECT holder_pid,token,value_json,at,expires_at FROM signals WHERE scope=? AND key='kernel-lock'").get(state.id)??null;
    let snapshot=null;
    if(row?.state_json){try{snapshot={...row,state:JSON.parse(row.state_json)};}catch{snapshot={...row,state:null,error:'latest durable state body is unreadable'};}}
    let chain=null;
    try{chain=verifyChain(ledger.db,{workflowId:state.id});}catch(error){chain={ok:false,reason:String(error?.message??error)};}
    let anchor=null;
    try{anchor=verifyAnchor(ledger,anchorRepoRoot(file));}catch(error){anchor={ok:false,reason:String(error?.message??error)};}
    return {file:path.resolve(file),version:ledger.version,jobs,leases,snapshot,snapshotHead:row?.events_head??null,eventsHead,kernelLock,chain,anchor,error:null};
  }catch(error){return {file:path.resolve(file),jobs:[],leases:[],snapshot:null,snapshotHead:null,eventsHead:null,kernelLock:null,chain:null,anchor:null,error:String(error?.message??error)};}
  finally{ledger?.close();}
}

/** The kernel-lock signal proves a newer-than-snapshot event head belongs to a live kernel, not a rewound record. */
const kernelLockHeld=(lock,controller)=>{
  const holder=Number(lock?.holder_pid);
  if(Number.isInteger(holder)&&holder>0&&(!lock.expires_at||lock.expires_at>Date.now())&&livePid(holder))return true;
  const own=Number(controller?.pid);
  return Boolean(controller?.alive)&&Number.isInteger(own)&&own>0&&livePid(own);
};

/** Prefer the latest durable body when it matches this workflow and generation; state.json is only a projection. */
export function durableContinuationState(state,ledgerView){
  const durable=ledgerView?.snapshot?.state;
  return plain(durable)&&durable.id===state?.id&&durable.engine?.generation===state?.engine?.generation?durable:state;
}

/** Read-only invariants at stop/resume boundaries. Unknown effects remain resumable only under their exact fence. */
export function continuationBoundary(state,{ledgerView=readLedger(state),controller={alive:false}}={}){
  if(typeof state?.engine?.journalFile==='string'&&typeof state?.engine?.ledgerFile!=='string')
    return {ok:false,reason:'ledger-unmigrated',findings:[{code:'ledger-unmigrated',detail:'the workflow record still names journalFile without a ledgerFile; ledger-migrate must run before any continuation'}],ledgerView};
  // The anchor is the tracked counter-record (§12): a file the hash chain alone cannot prove, because anyone
  // able to write the untracked ledger can recompute a self-consistent chain for it. A restored, rolled-back
  // or never-cloned ledger fails here before its chain is even read as authoritative.
  if(ledgerView.anchor&&ledgerView.anchor.ok===false)
    return {ok:false,reason:ledgerView.anchor.reason,findings:[{code:ledgerView.anchor.reason,detail:`the tracked ledger anchor does not verify against this ledger file${ledgerView.anchor.workflowId?` for workflow ${ledgerView.anchor.workflowId}`:''}`,...(ledgerView.anchor.workflowId?{anchorWorkflowId:ledgerView.anchor.workflowId}:{})}],ledgerView};
  if(ledgerView.chain&&ledgerView.chain.ok===false)
    return {ok:false,reason:'ledger-chain-broken',findings:[{code:'ledger-chain-broken',detail:`the workflow event hash chain does not verify${Number.isInteger(ledgerView.chain.brokenAt)?` at seq ${ledgerView.chain.brokenAt}`:''}${ledgerView.chain.reason?`: ${ledgerView.chain.reason}`:''}`}],ledgerView};
  // One transaction commits snapshot+events+jobs+leases, so a live head newer than the snapshot's events_head is
  // legal only while a kernel holds the lock: a crash mid-tick commits neither; a rewound file leaves orphans.
  const headDigest=ledgerView.eventsHead?.digest??null;
  if(headDigest!==(ledgerView.snapshotHead??null)&&!kernelLockHeld(ledgerView.kernelLock,controller))
    return {ok:false,reason:'ledger-head-mismatch',findings:[{code:'ledger-head-mismatch',detail:'events exist past the latest durable snapshot while no live pid holds the kernel lock'}],ledgerView};
  const findings=[];
  const jobs=new Map(ledgerView.jobs.map(job=>[job.job_id,job]));
  const leasesByJob=new Map();
  for(const lease of ledgerView.leases){const rows=leasesByJob.get(lease.job_id)??[];rows.push(lease);leasesByJob.set(lease.job_id,rows);}
  const claimed=new Set();
  const issue=(code,detail,identity={})=>findings.push({code,detail,...identity});
  for(const op of list(state?.ops)){
    const identity={opId:op.id??null,attempt:op.attempt??null,generation:state?.engine?.generation??null,
      jobId:op.lease?.jobId??null,taskId:op.task??op.launch?.task??null,dispatchId:op.dispatch??op.launch?.dispatch??null,terminal:op.terminal??null};
    if(op.dispatch&&op.launch?.dispatch&&op.dispatch!==op.launch.dispatch)issue('dispatch-identity-drift','operation dispatch differs from its launch receipt',identity);
    if(op.task&&op.launch?.task&&op.task!==op.launch.task)issue('task-identity-drift','operation task differs from its launch receipt',identity);
    // A running op with a retained late report carries its custody in the report record, not a lease: the
    // retry path proved the lease stale and cleared it on the record, and the replay re-derives custody from
    // the retained dispatch/task identity. Its dispatch, task and terminal must still be exact.
    const lateReportCustody=op.lateReportRecovery?.schema==='starci/answered-decision-late-report@1'
      &&op.lateReportRecovery.dispatch===identity.dispatchId&&op.lateReportRecovery.task===identity.taskId;
    if(op.status==='running'&&(!identity.taskId||!identity.dispatchId||!identity.terminal||(!identity.jobId&&!lateReportCustody)))
      issue('running-identity-incomplete','a running operation lacks its exact job/task/dispatch/terminal identity',identity);
    if(!op.lease)continue;
    claimed.add(op.lease.jobId);
    const job=jobs.get(op.lease.jobId),held=leasesByJob.get(op.lease.jobId)??[];
    if(!job){issue('lease-job-unproven','state carries an operation lease whose durable job is absent',identity);continue;}
    // The lease generation binds the durable job, not the current enrollment: a writer reservation retained
    // across a retry deliberately predates `state.engine.generation` (the reconcile passes re-prove it), so
    // the exact identity here is job <-> lease <-> lease rows, all still fenced in the same ledger.
    const exact=job.workflow_id===state.id&&job.op_id===op.id&&job.attempt===op.lease.attempt&&
      job.generation===op.lease.generation&&job.kind==='operation'&&op.lease.workflowId===state.id&&
      op.lease.opId===op.id&&op.lease.attempt===op.attempt;
    if(!exact)issue('lease-identity-drift','state, operation lease and durable job do not share the full workflow/op/attempt/generation identity',identity);
    if(job.lease_token!==op.lease.leaseToken)issue('lease-token-drift','the durable job is fenced by a different lease token',identity);
    if(!held.length&&!SETTLED.has(job.status))issue('writer-reservation-missing','an unsettled operation job has no durable resource lease',identity);
    for(const row of held)if(row.workflow_id!==state.id||row.op_id!==op.id||row.attempt!==op.lease.attempt||row.generation!==op.lease.generation)
      issue('writer-identity-drift',`resource ${row.resource_key} does not bind the operation lease identity`,identity);
    if(DONE.has(op.status)&&(!SETTLED.has(job.status)||held.length))
      issue('settled-operation-retains-writer','a settled operation still owns an unsettled job or durable writer reservation',identity);
  }
  for(const lease of ledgerView.leases)if(!claimed.has(lease.job_id)){
    const job=jobs.get(lease.job_id),identity={jobId:lease.job_id,opId:lease.op_id,attempt:lease.attempt,generation:lease.generation,kind:job?.kind??null};
    if(!job){issue('orphan-writer-reservation',`resource ${lease.resource_key} has no durable job identity`,identity);continue;}
    // Model, judge and command-check jobs own admission identities of their own. They are not operation writers
    // merely because state.ops has no matching `op.lease`; their exact durable job/lease fence is the authority.
    if(['model','judge','check'].includes(job.kind)){
      const exact=job.workflow_id===state.id&&job.op_id===lease.op_id&&job.attempt===lease.attempt&&
        job.generation===lease.generation&&job.lease_token===lease.token;
      if(!exact)issue('job-reservation-identity-drift',`resource ${lease.resource_key} does not bind its model/judge/check job identity and token`,identity);
      if(SETTLED.has(job.status))issue('settled-job-retains-reservation',`terminal ${job.kind} job ${job.job_id} still owns resource ${lease.resource_key}`,identity);
      continue;
    }
    issue('orphan-writer-reservation',`operation resource ${lease.resource_key} is not represented by an exact operation lease in state`,identity);
  }
  if(controller.alive&&(!controller.pid||!controller.startupTokenDigest))issue('controller-identity-unproven','the live controller lacks an exact PID/startup-token identity',{pid:controller.pid??null});
  if(ledgerView.error)issue('ledger-unreadable',ledgerView.error,{ledgerFile:ledgerView.file});
  return {ok:findings.length===0,findings,ledgerView};
}

function headOf(root,git=spawnSync){
  const shown=git('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true});
  return shown?.status===0?String(shown.stdout??'').trim():null;
}
const row=cells=>`| ${cells.map(text).join(' | ')} |`;
const bullets=items=>items.length?items.map(item=>`- ${text(item)}`).join('\n'):'- None';

const storeRepoRoot=store=>store.repoRoot;
function assertContinuationTarget(root,target){
  const parts=path.relative(root,target).split(path.sep);let current=root;
  for(const [index,part] of parts.entries()){
    current=path.join(current,part);let stat;
    try{stat=fs.lstatSync(current);}catch(error){if(error.code==='ENOENT')return;throw error;}
    const leaf=index===parts.length-1;
    if(stat.isSymbolicLink()||(leaf?!stat.isFile():!stat.isDirectory())||(leaf&&stat.size>1024*1024))
      throw Error('Public continuation must use real directories and a bounded regular Markdown file, never a link');
  }
}
export function bindContinuationPath(store,state=null){
  const root=storeRepoRoot(store),workflows=path.join(root,'workflows'),id=String(state?.id??store.id??'');
  const explicit=state?.continuation?.publicFile??state?.continuationFile??null;
  if(typeof explicit==='string'&&explicit.trim()){
    const target=path.resolve(root,explicit),relative=path.relative(workflows,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)||path.extname(target).toLowerCase()!=='.md')throw Error('Public continuation binding must be a Markdown file under workflows/');
    assertContinuationTarget(root,target);store.paths.continuation=target;return target;
  }
  const canonical=path.join(workflows,`${id}.md`);
  assertContinuationTarget(root,canonical);
  if(fs.existsSync(canonical)){store.paths.continuation=canonical;return canonical;}
  // Friendly briefs need an explicit identity declaration. A goal index can mention many workflow IDs and
  // must never become a workflow's checkpoint just because its prose (or an old generated section) names one.
  let matched=[];try{matched=fs.readdirSync(workflows,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.toLowerCase().endsWith('.md')).map(entry=>path.join(workflows,entry.name)).filter(file=>{
    try{
      const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||stat.size>1024*1024)return false;
      const body=fs.readFileSync(file,'utf8');
      const start=body.indexOf(CONTINUATION_SECTION_START),end=body.indexOf(CONTINUATION_SECTION_END);
      if((start<0)!==(end<0)||end<start||body.indexOf(CONTINUATION_SECTION_START,start+1)>=0||body.indexOf(CONTINUATION_SECTION_END,end+1)>=0)return false;
      const authored=start<0?body:body.slice(0,start)+body.slice(end+CONTINUATION_SECTION_END.length);
      const declarations=authored.split(/\r?\n/).map(line=>{
        const match=line.match(/^Workflow ID:\s*(?:`([^`\s]+)`|([^`\s]+))\s*$/);return match?.[1]??match?.[2];
      }).filter(Boolean);
      if(declarations.length)return declarations.length===1&&declarations[0]===id;
      return body.startsWith(`<!-- ${CONTINUATION_BRIEF} -->\n# Workflow continuation: ${id}\n`)||body.startsWith(`<!-- ${CONTINUATION_BRIEF} -->\r\n# Workflow continuation: ${id}\r\n`);
    }catch{return false;}
  });}catch{matched=[];}
  store.paths.continuation=matched.length===1?matched[0]:canonical;assertContinuationTarget(root,store.paths.continuation);return store.paths.continuation;
}
export function continuationPath(store,state=null){return bindContinuationPath(store,state);}

export function buildContinuationBrief(store,state,{now=Date.now,git=spawnSync}={}){
  const ledgerView=readLedger(state),current=durableContinuationState(state,ledgerView),controller=readController(store,state);
  const boundary=continuationBoundary(current,{ledgerView,controller});
  const stateBytes=JSON.stringify(current);
  const actualHead=headOf(current.worktree??current.repoRoot??process.cwd(),git);
  const complete=list(current.ops).filter(op=>DONE.has(op.status));
  const remaining=list(current.ops).filter(op=>!DONE.has(op.status));
  const blockers=[...list(current.needUser).map(item=>`${item.code??item.kind??'need-user'}: ${item.detail??item.question??json(item)}`),
    ...remaining.filter(op=>op.status==='blocked'||op.refusal).map(op=>`${op.id}: ${op.refusal??op.blocker?.detail??'blocked'}`)];
  const unknown=boundary.findings.length||remaining.some(op=>op.lease||op.dispatch);
  const next=controller.alive?`Wait for controller PID ${controller.pid} to exit, then run workflow-status and inspect this brief again.`
    :boundary.findings.length?`Reconcile the exact identities in Boundary findings. Preserve every unknown effect and writer; do not clear a lease from process absence alone.`
      :current.finished?`Inspect the final report at ${store.paths.final}; do not reopen accepted work without a new authorized retry boundary.`
        :`Resume with workflow-run --id ${current.id} through the same sealed runtime. The kernel lock admits one controller and exact live operation identities are reconciled before a new dispatch.`;
  const lines=[`<!-- ${CONTINUATION_BRIEF} -->`,`# Workflow continuation: ${current.id}`,'',
    `Generated: ${new Date(typeof now==='function'?now():now).toISOString()}`,'',
    '## Checkpoint identity','',
    row(['Field','Value']),row(['---','---']),
    row(['Workflow',current.id]),row(['Job',current.job]),row(['Phase',current.phase]),row(['Approved',String(Boolean(current.approved))]),
    row(['Workflow generation',current.engine?.generation??'not enrolled']),row(['Goal identity',stateGoalIdentity(current)]),
    row(['State SHA-256',sha256(stateBytes)]),row(['Projected state',slash(store.paths.state)]),
    row(['Durable checkpoint',ledgerView.snapshot?.checkpoint_id??'none']),row(['Durable ledger',ledgerView.file??'none']),
    row(['Runtime pin digest',current.engine?.runtimePin?.digest??'none']),row(['Runtime pin root',slash(current.engine?.runtimePin?.root??'none')]),
    row(['Worktree',slash(current.worktree??current.repoRoot)]),row(['Branch',current.branch]),row(['Accepted workflow head',current.head??'none']),
    row(['Observed source HEAD',actualHead??'unavailable']),row(['Controller PID',controller.pid??'none']),
    row(['Controller alive',String(controller.alive)]),row(['Controller token digest',controller.startupTokenDigest??'none']),
    '', '## Scope','',bullets(list(current.scope).length?current.scope:['No explicit scope list; read the approved goal and definition of done below.']),
    '', 'Definition of done:', '',bullets(list(current.definitionOfDone)),
    '', '## Completed or accepted operations','',row(['Operation','Kind','Status','Attempt','Head','Files / evidence']),row(['---','---','---','---','---','---']),
    ...(complete.length?complete.map(op=>row([op.id,op.kind,op.status,op.attempt,op.head??op.ledgerCommit??'none',list(op.files).join(', ')||list(op.reports).map(report=>report.dispatch??report.outcome).join(', ')||'none'])):[row(['None','—','—','—','—','—'])]),
    '', '## Remaining work and exact execution identity','',row(['Operation','Kind','Status','Attempt / generation','Job','Task / dispatch / terminal']),row(['---','---','---','---','---','---']),
    ...(remaining.length?remaining.map(op=>row([op.id,op.kind,op.status,`${op.attempt??'—'} / ${op.lease?.generation??current.engine?.generation??'—'}`,op.lease?.jobId??'none',`${op.task??op.launch?.task??'none'} / ${op.dispatch??op.launch?.dispatch??'none'} / ${op.terminal??'none'}`])):[row(['None','—','—','—','—','—'])]),
    '', '## Authorized same-workflow amendments','',...(list(current.amendments).length
      ?list(current.amendments).flatMap(item=>[
        `- \`${text(item.digest)}\` on frozen goal \`${text(item.baseGoalIdentity)}\``,
        `  - owner grant: thread \`${text(item.authority?.source?.threadId)}\`, message ${item.authority?.source?.messageIdAvailability==='available'?`\`${text(item.authority?.source?.messageId)}\``:'not exposed'} at ${item.authority?.source?.at?text(item.authority.source.at):'event time not exposed'}`,
        `  - coordinator application: thread \`${text(item.coordinator?.source?.threadId)}\`, message ${item.coordinator?.source?.messageIdAvailability==='available'?`\`${text(item.coordinator?.source?.messageId)}\``:'not exposed'} at ${item.coordinator?.source?.at?text(item.coordinator.source.at):'event time not exposed'}`,
        `  - clarifications: ${list(item.changes?.clarifications).map(text).join('; ')||'none'}`,
        ...list(item.changes?.supersedeDefinitionOfDone).flatMap(replacement=>[
          `  - historical criterion superseded: ${text(replacement?.from)}`,
          `    effective criterion: ${text(replacement?.to)}`]),
        `  - operation effect assignments: ${Object.entries(item.changes?.operationEffects??{}).map(([opId,effects])=>`${text(opId)} => paths [${list(effects?.paths).map(text).join(', ')}], resources [${list(effects?.resources).map(text).join(', ')}], external [${list(effects?.external).map(text).join(', ')}]`).join('; ')||'none'}`,
        `  - effect ceiling: paths [${list(item.changes?.effectCeiling?.paths).map(text).join(', ')}], resources [${list(item.changes?.effectCeiling?.resources).map(text).join(', ')}], external [${list(item.changes?.effectCeiling?.external).map(text).join(', ')}]`])
      :['- None; the frozen goal has no same-ID amendment.']),
    '', '## Owner decisions','',bullets(list(current.decisions).map(json)),
    '', '## Blockers','',bullets(blockers),
    '', '## Boundary findings','',boundary.findings.length?boundary.findings.map(item=>`- **${text(item.code)}** — ${text(item.detail)} (${json(Object.fromEntries(Object.entries(item).filter(([key])=>!['code','detail'].includes(key))))})`).join('\n'):'- None; the saved identities are internally consistent.',
    '', '## Next safe action','',next,'',
    unknown?'Unknown or live effects are intentionally preserved. This Markdown is a human-readable continuation brief; the ledger record, runtime pin, candidate packets, reports and source commits remain authoritative.':'This Markdown is a human-readable continuation brief; the ledger record, runtime pin, candidate packets, reports and source commits remain authoritative.',''];
  return {schema:CONTINUATION_BRIEF,state:current,stateDigest:sha256(stateBytes),boundary,controller,head:actualHead,markdown:lines.join('\n')};
}

const managedSection=markdown=>`${CONTINUATION_SECTION_START}\n${markdown.trimEnd()}\n${CONTINUATION_SECTION_END}\n`;
function mergeManagedSection(existing,markdown,file){
  const start=existing.indexOf(CONTINUATION_SECTION_START),end=existing.indexOf(CONTINUATION_SECTION_END);
  if(start<0&&end<0){
    // The former hidden-only exporter owned a whole file beginning with the v1 marker. Preserve compatibility by
    // converting that generated file; otherwise append beside human notes rather than replacing them.
    if(existing.startsWith(`<!-- ${CONTINUATION_BRIEF} -->`))return managedSection(markdown);
    return `${existing.trimEnd()}${existing.trim()?`\n\n`:''}${managedSection(markdown)}`;
  }
  if(start<0||end<start||existing.indexOf(CONTINUATION_SECTION_START,start+1)>=0||existing.indexOf(CONTINUATION_SECTION_END,end+1)>=0)
    throw Error(`Refusing to update malformed StarCi continuation markers: ${slash(file)}`);
  const after=end+CONTINUATION_SECTION_END.length;
  return `${existing.slice(0,start)}${managedSection(markdown)}${existing.slice(after).replace(/^\r?\n/,'')}`;
}

/** Atomically update one managed section of the public continuation without replacing the ledger record or human notes. */
export function exportContinuationBrief(store,state,options={}){
  const file=continuationPath(store,state),built=buildContinuationBrief(store,state,options);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const next=mergeManagedSection(existing,built.markdown,file);
  const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,next);replaceStateSnapshot(tmp,file);
  return {...built,file:path.resolve(file)};
}
