import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {skillRoot} from '../core/runtime-root.mjs';
import {getPath} from './orca-calls.mjs';
import {waitTick} from './orca-protocol.mjs';
import {buildOperationLaunch,notifyTerminal,settleDispatch,startOperation,sweepWorktree} from './orca-supervised-launch.mjs';
import {validateReport} from './reports.mjs';
import {WORKFLOW_STATE,createStore,listWorkflows,newWorkflowId,repositoryRoot,workflowsRoot} from './workflow-store.mjs';
import {grammarRepository,resolveLedgerRoot,samePath,sharedLedgerStatus} from './ledger-routing.mjs';
import {createAllocator,loadRuntimes} from './runtime-allocator.mjs';
import {loadsFileFor,readLoads} from './runtime-loads.mjs';
import {resolveExecutionChain} from '../profiles/select.mjs';
import {proofFinding,proofPlan,runAtBase} from './verify-proof.mjs';
import {stepsFor} from './contract-steps.mjs';
import {parseYaml} from '../core/yaml.mjs';
import * as work from './work-ledger.mjs';
import * as llm from './llm-functions.mjs';
import * as graph from './kind-graph.mjs';

/**
 * The StarCi 5.0 workflow kernel: one process per job. It assesses the goal into a ledger and a dynamic
 * list of operations, stops for the user's approval, then runs a pool of operations in ONE worktree under
 * disjoint allowlists until every ledger item is implemented, verified and the job gates are green.
 *
 * There is no Coordinator, no per-module Monitor and no provider chain: a runtime comes from the allocator,
 * every transition is an event in the workflow store, and `done` is never taken on trust - the kernel
 * re-runs the operation's own checks itself and commits only what it could reproduce.
 */
export const WORKFLOW_KERNEL='starci/workflow-kernel@1';
export const FINAL_REPORT='starci/workflow-final-report@1';
export const GOAL_RECORD='starci/workflow-goal@1';
/**
 * Two ledgers, one loop. `work` is the product ledger: the canonical Work tree is the TODO list, so the
 * goal phase derives the operations from authored nodes and every accepted slice is written back into the
 * node that asked for it. `plan` is the model-assessed ledger, for a job in a repository that has no Work
 * tree: `assessGoal` invents the ledger and nothing is written outside the workflow directory.
 */
export const LEDGER_MODES=['work','plan'];
export const WORK_LEDGER='work';
/**
 * Work kind -> the operation kind that executes it. This is the fallback only: the lane of the node
 * (`profiles/kinds.yaml` through `execution/kind-graph.mjs`) decides the kind of every step, and this map is
 * what a tree whose kind graph cannot be read falls back to. Decision kinds are answered, never launched.
 */
export const WORK_OPERATION={implementation:'backend.implement',ui:'interface.implement',uat:'uat.verify',e2e:'e2e.verify',operations:'runtime.operate'};
export const DECISION_OPERATION={architecture:'architecture.decide',business:'business.decide','business-overview':'business.decide',brand:'brand.decide'};
/**
 * The brand is a decision like any other, and the one every design-family operation reads: the node kind
 * `brand` is answered by `brand.decide`, which authors the brand record (name, family, colour tokens and their
 * roles, the mascot and logo assets, what is forbidden, the imagery prompt rules) and bumps its `rev`.
 */
export const BRAND_KIND='brand';
export const BRAND_DECIDE='brand.decide';
/**
 * Kinds the graph names that the operator registry still launches under their 4.x operator id. The graph is
 * the kernel's vocabulary (roles, lanes, routes); `ops/registry.yaml` is the launchable operator set, and the
 * two are allowed to differ - a lane step is resolved to a launchable operator here, once, at the launch seam.
 */
export const LAUNCH_OPERATOR={'frontend.implement':'interface.implement','architecture.revise':'architecture.decide'};
/** The operator contract a kind launches with: the catalog's `operator` first, then the alias map, then the kind itself. */
export const launchOperator=kind=>{let fromGraph=null;try{fromGraph=graph.operatorOf(kind);}catch{fromGraph=null;}return (fromGraph&&fromGraph!==kind?fromGraph:null)??LAUNCH_OPERATOR[kind]??kind;};
/** The graph's role for a kind; the runtimes profile keeps its own `roleOfKind` map as the fallback. */
export const kindRole=kind=>{try{return graph.roleOf(kind);}catch{return null;}};
/**
 * The one kind that authors a Work record instead of working from one, and the only kind whose write scope is
 * its own node's `index.yaml`. It runs before the node's lane, never inside it: no lane names it, no route
 * creates it, and the kernel creates exactly one per node when the ledger reports that node incomplete.
 */
export const AUTHOR_KIND='work.author';
/** What stays the kernel's inside a record an author op may otherwise write. Compared before and after, never reverted field by field. */
export const RECORD_OWNED=['state','completion','extensions.work3.kernel'];
const RESUME_LIMIT=5,RETRY_LIMIT=3,RESTART_LIMIT=3,VERIFY_ROUNDS=3,GATE_ROUNDS=3,LAUNCH_LIMIT=3;
/** A workflow with nothing running and nothing launchable waits this long before it stops for the user: a runtime that is cooling for five minutes is not a dead environment. */
export const STALL_MS=30*60*1000;
/** Run-time growth is bounded too: ops nobody approved, shared changes per iteration, inferred rate limits. */
export const DYNAMIC_OPS_BUDGET=64;
const SHARED_OPS_PER_ITERATION=3,SILENCE_LIMIT=2,RATE_LIMIT_WINDOW_MS=30*60*1000;
const CHECK_TIMEOUT_MS=30*60*1000,LAUNCH_WAIT_MS=180000,POLL_MS=5000;
/** The validator: two rejects of one op stop it at the user, three unavailable verdicts in a row name the outage; memory and diff are bounded in bytes. */
export const VALIDATOR_REJECT_LIMIT=2,VALIDATOR_UNAVAILABLE_LIMIT=3;
const VALIDATOR_MEMORY_LINES=40,VALIDATOR_MEMORY_BYTES=12*1024,VALIDATOR_DIFF_BYTES=120*1024;
const REF_KINDS=['srs','sds','plan','brief','note','design','uat','file','dir','url'];

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const csv=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
const unique=list=>[...new Set(list)];
const slash=value=>String(value??'').replaceAll('\\','/');
const normalize=value=>slash(value).replace(/^\.\//,'');
const tail=(text,max=400)=>String(text??'').replace(/\s+$/,'').slice(-max);
const firstLine=value=>String(value??'').split('\n').map(line=>line.trim()).find(Boolean)??'';
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);};
const sleepSync=ms=>{if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};
const runCommand=(command,{cwd,timeoutMs=CHECK_TIMEOUT_MS}={})=>spawnSync(command,{cwd,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,maxBuffer:64*1024*1024});

/** Allowlist entries are paths or `dir/**` globs; two operations may run together only when no root contains the other. */
const allowRoot=entry=>normalize(entry).replace(/\/?\*+$/,'').replace(/\/+$/,'');
const covers=(a,b)=>{const x=allowRoot(a),y=allowRoot(b);return x===y||y.startsWith(`${x}/`)||x.startsWith(`${y}/`);};
export const allowlistsOverlap=(a=[],b=[])=>a.some(one=>b.some(other=>covers(one,other)));
const inside=(file,allowlist=[])=>allowlist.some(entry=>{const root=allowRoot(entry);return file===root||file.startsWith(`${root}/`);});
/** Paths named inside free text (a blocker detail, a review finding): only tokens that carry a directory separator. */
const pathsIn=text=>unique(String(text??'').match(/[A-Za-z0-9_@.][A-Za-z0-9_@./-]*\/[A-Za-z0-9_@./-]+/g)??[]).map(normalize);
/**
 * A dynamic op stays inside the approved scope, matched against the scope entries that name a path or a
 * feature folder: an entry by prefix, or as a path segment. A scope given as a Work node id (`demo.sales`)
 * constrains the ledger, not a file path, so it never refuses an op's allowlist here.
 */
const pathScopes=scope=>(scope??[]).map(entry=>normalize(entry).replace(/^features\//,'').replace(/\/+$/,''))
  .filter(key=>key&&!(key.includes('.')&&!key.includes('/')));
const inScopePath=(file,scope=[])=>{
  const keys=pathScopes(scope);
  return !keys.length||keys.some(key=>covers(key,file)||`/${normalize(file)}/`.includes(`/${key}/`));
};

/**
 * The guard surface (`execution/kernel-guards.mjs`): path protection, resource locks, git serialization and
 * the worktree preflight. It is loaded optionally, because a tree that ships without it must still run the
 * kernel - the fallbacks below are the same contract, implemented minimally, and every call goes through
 * `ctx.guards`, so a test or a host can inject its own.
 */
const FALLBACK_GUARDS={
  protectedPaths:(node,repoRoot)=>{
    const relative=slash(node?.path??'');
    if(!relative)return [];
    return [`.starciwork/${relative}`,`.starciwork/${slash(path.dirname(relative))}/evidence/**`];
  },
  revertProtected:(git,{cwd,paths=[]}={})=>{
    const shown=git('git',['status','--porcelain','--',...paths.map(allowRoot)],{cwd,encoding:'utf8',windowsHide:true});
    const changed=shown.status===0?unique((shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
      .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,'')))):[];
    if(changed.length)git('git',['checkout','--',...changed],{cwd,encoding:'utf8',windowsHide:true});
    return {reverted:changed,removed:[]};
  },
  parseSharedChangePaths:detail=>pathsIn(detail),
  resourceLocks:op=>unique([...(op?.resources??[]),...(op?.checks??[]).flatMap(check=>{
    const command=String(check?.command??'');
    return [/localhost:5432|127\.0\.0\.1:5432|localhost:8089|start:dev|docker compose/i.test(command)?'local-stack':null,
      /playwright|uat\.verify/i.test(command)?'e2e-runtime':null,/kubectl|helm/i.test(command)?'cluster':null].filter(Boolean);
  })]),
  resourcesClash:(a,b)=>FALLBACK_GUARDS.resourceLocks(a).some(lock=>FALLBACK_GUARDS.resourceLocks(b).includes(lock)),
  gitQueue:fn=>fn(),
  preflight:()=>({ok:true,fixes:[],problems:[]})
};
const loadedGuards=await import('./kernel-guards.mjs').then(module=>module,()=>null);
export const kernelGuards=Object.fromEntries(Object.entries(FALLBACK_GUARDS)
  .map(([name,fallback])=>[name,typeof loadedGuards?.[name]==='function'?loadedGuards[name]:fallback]));

function parseRef(ref){
  if(plain(ref))return {kind:ref.kind??'file',ref:required(ref.ref??ref.path,'input ref')};
  const value=required(ref,'input ref');
  const [head,...rest]=value.split(':');
  return REF_KINDS.includes(head)&&rest.length?{kind:head,ref:rest.join(':').trim()}:{kind:'file',ref:value};
}
function parseGate(gate){
  if(plain(gate))return {name:required(gate.name,'gate name'),command:required(gate.command,'gate command'),timeoutMs:gate.timeoutMs??null};
  const value=required(gate,'gate');
  const index=value.indexOf('=');
  need(index>0,`A gate must be "name=command": ${value}`);
  return {name:value.slice(0,index).trim(),command:value.slice(index+1).trim(),timeoutMs:null};
}

export function currentBranch(cwd,git=spawnSync){
  const shown=git('git',['rev-parse','--abbrev-ref','HEAD'],{cwd,encoding:'utf8',windowsHide:true});
  return shown.status===0?(shown.stdout??'').trim():'unknown';
}

/* ------------------------------------------------------------------ the lane: one workflow, one worktree */

/**
 * A **lane** is the worktree one workflow owns: the kernel, every operation of that workflow and nothing else
 * live in it, on its own branch, and Orca shows it as one top-level row `[Workflow] <id>`. This is not the
 * kind lane a node travels (`state.lanes`, `laneOf`); it is the place the whole workflow happens.
 *
 * Two workflows never share a worktree, because sharing one is what made three workflows' agents hang under a
 * single Orca row with no way to tell whose operation is whose. The branch is merged back into the branch the
 * lane was cut from when, and only when, the workflow finishes `done`.
 */
export const laneRowTitle=id=>`[Workflow] ${required(id,'workflow id')}`;
export const LANE_NAME=/^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** `--lane` alone takes the workflow id as the name; `--lane <name>` takes that name, validated as one segment. */
export function laneNameOf(value,id){
  const named=typeof value==='string'&&value.trim()&&value.trim()!=='true'?value.trim():String(id);
  need(LANE_NAME.test(named),`A lane name is one path segment of letters, digits, dot, dash or underscore: ${named}`);
  return named;
}
const laneBranchRef=value=>String(value??'').replace(/^refs\/heads\//,'').trim();
/** The lane row Orca just created, read from its receipt - never guessed, because the branch is Orca's to name. */
function laneReceipt(receipt){
  const row=getPath(receipt,'result.worktree');
  const worktree=[row?.path,row?.worktreePath,row?.root,row?.directory].find(value=>typeof value==='string'&&value.trim());
  const branch=[row?.branch,row?.branchRef,row?.ref].map(laneBranchRef).find(Boolean);
  return {worktree:worktree?path.resolve(worktree):null,branch:branch??null,orcaId:row?.id??null};
}
/**
 * The workflow whose lane is this worktree, if any. A lane never opens a lane of its own: the rows would nest
 * and the owner would be back to guessing whose operation is whose.
 */
export function laneOwnerOf(roots,worktree){
  const target=path.resolve(worktree);
  for(const root of unique((roots??[]).filter(Boolean).map(item=>path.resolve(item)))){
    let entries=[];
    try{entries=listWorkflows(root);}catch{entries=[];}
    for(const entry of entries){
      const lane=entry.state?.lane;
      if(plain(lane)&&lane.worktree&&samePath(lane.worktree,target))return {id:entry.id,dir:entry.dir,lane};
    }
  }
  return null;
}
/**
 * Create the lane of one workflow: an Orca worktree of this repository, on a new branch cut from the branch the
 * caller is on, as a top-level row named `[Workflow] <id>` and marked in progress. Every failure is Orca's own
 * reason - a name that already exists is surfaced, never worked around.
 */
export function openLane(orca,{id,name,repoRoot,base,baseBranch,cwd=base,git=spawnSync}){
  need(plain(orca)&&typeof orca.invoke==='function','--lane needs an Orca runner: the lane is an Orca worktree');
  const created=orca.invoke('worktree-create',{repo:`path:${slash(path.resolve(repoRoot))}`,name,
    'base-branch':required(baseBranch,'base branch'),setup:'skip','no-parent':true},{cwd});
  need(created.outcome==='ok',`orca worktree create --name ${name} failed (${created.effectState??'unknown'}): ${created.reason??'no reason'}`);
  const row=laneReceipt(created.receipt);
  need(row.worktree&&fs.existsSync(row.worktree),`orca worktree create --name ${name} reported no worktree on disk: ${slash(row.worktree??'')}`);
  const branch=(()=>{const here=currentBranch(row.worktree,git);return here&&here!=='unknown'&&here!=='HEAD'?here:row.branch;})();
  need(branch,`The lane ${name} has no branch: neither the receipt nor ${slash(row.worktree)} names one`);
  const titled=orca.invoke('worktree-set',{worktree:`path:${slash(row.worktree)}`,'display-name':laneRowTitle(id),
    'workspace-status':'in-progress'},{cwd});
  need(titled.outcome==='ok',`orca worktree set --display-name "${laneRowTitle(id)}" failed: ${titled.reason??'no reason'}`);
  return {name,worktree:row.worktree,branch,orcaId:row.orcaId,
    base:{worktree:path.resolve(base),branch:baseBranch}};
}
/** The lane as a reader sees it: both trees, both branches, and the merge that took it home. */
export function laneView(state){
  const lane=state?.lane;
  if(!plain(lane))return null;
  return {name:lane.name??null,worktree:lane.worktree?slash(lane.worktree):null,branch:lane.branch??null,
    base:{worktree:lane.base?.worktree?slash(lane.base.worktree):null,branch:lane.base?.branch??null},
    orcaId:lane.orcaId??null,
    merged:plain(lane.merged)?{commit:lane.merged.commit??null,into:lane.merged.into??lane.base?.branch??null,at:lane.merged.at??null}:null,
    conflict:plain(lane.conflict)?{files:[...(lane.conflict.files??[])]}:null,
    closed:plain(lane.closed)?{at:lane.closed.at??null,preservedBranch:lane.closed.preservedBranch??lane.branch??null}:null};
}
/** Tell Orca what the row is now; the workflow's outcome never depends on the sidebar, so a refusal is recorded, not thrown. */
function setLaneStatus(orca,store,state,status){
  if(!plain(orca)||typeof orca.invoke!=='function'||!plain(state.lane))return null;
  const result=orca.invoke('worktree-set',{worktree:`path:${slash(state.lane.worktree)}`,'workspace-status':status},
    {cwd:fs.existsSync(state.lane.base?.worktree??'')?state.lane.base.worktree:state.lane.worktree});
  if(result.outcome!=='ok')store.appendEvent({event:'lane-status-failed',status,reason:result.reason??null});
  return result;
}
/** The files a refused merge names: the unmerged paths, or - when git refused before starting - the ones it listed. */
function mergeConflictFiles(run,result){
  const unmerged=run(['diff','--name-only','--diff-filter=U']);
  const listed=unmerged.status===0?(unmerged.stdout??'').split('\n').map(line=>line.trim()).filter(Boolean):[];
  if(listed.length)return unique(listed.map(normalize));
  return unique(`${result.stdout??''}\n${result.stderr??''}`.split('\n')
    .filter(line=>/^\s+\S/.test(line)).map(line=>normalize(line.trim())).filter(Boolean)).slice(0,20);
}
/**
 * The lane goes home: `git merge --no-ff` of the lane branch into the base branch, run in the base worktree.
 *
 * A conflict is not a merge the kernel may force. The base worktree is somebody's working copy - it may carry
 * uncommitted changes and a kernel of its own - so git refusing to overwrite a pending file is treated exactly
 * like a content conflict: the merge is aborted, nothing in the base is stashed or reset, and the workflow
 * finishes `blocked` with the conflicting files in a `merge` needUser item for the owner to settle by hand.
 */
function mergeLane(store,state,ctx){
  const lane=state.lane;
  const base=lane.base?.worktree;
  const git=ctx?.git??spawnSync;
  const run=args=>git('git',args,{cwd:base,encoding:'utf8',windowsHide:true,env:{...process.env,ALLOW_SECRET_SCAN:'1'}});
  // The base worktree may have moved on. A merge goes into whatever branch is checked out there, so a different
  // branch is not this lane's merge at all: it is refused like a conflict and the owner settles it.
  const on=currentBranch(base,git);
  if(on!==lane.base.branch){
    const reason=`the base worktree ${slash(base)} is on ${on}, not ${lane.base.branch}`;
    lane.conflict={files:[],at:Date.now(),reason};
    store.appendEvent({event:'lane-merge-conflict',id:state.id,branch:lane.branch,base:lane.base.branch,files:[],reason});
    return {ok:false,files:[]};
  }
  const message=`merge(workflow): ${state.id} - ${lane.branch} into ${lane.base.branch}`;
  const merged=run(['merge','--no-ff','--no-edit','-m',message,lane.branch]);
  if(merged.status===0){
    const shown=run(['rev-parse','HEAD']);
    const commit=shown.status===0?(shown.stdout??'').trim():null;
    lane.merged={commit,into:lane.base.branch,at:Date.now()};
    delete lane.conflict;
    // The item asked for exactly this merge; a workflow resumed after a conflict is no longer waiting on it.
    state.needUser=state.needUser.filter(item=>item.kind!=='merge');
    store.appendEvent({event:'lane-merged',id:state.id,branch:lane.branch,base:lane.base.branch,commit});
    setLaneStatus(ctx?.orca,store,state,'completed');
    return {ok:true,commit};
  }
  const files=mergeConflictFiles(run,merged);
  // Abort whatever git did start; with nothing started there is nothing to abort and the refusal says so.
  run(['merge','--abort']);
  lane.conflict={files,at:Date.now(),reason:tail(merged.stderr,400)||tail(merged.stdout,400)};
  store.appendEvent({event:'lane-merge-conflict',id:state.id,branch:lane.branch,base:lane.base.branch,files,
    reason:lane.conflict.reason});
  return {ok:false,files};
}

/**
 * A resolved Work tree decides the mode: a repository driven by one, whether it owns that tree or shares the
 * tree another repository of the same product owns (`ledgerRoot`), is driven by it.
 */
export function detectLedgerMode(repoRoot,requested=null,ledgerRoot=null){
  if(requested){need(LEDGER_MODES.includes(requested),`Unsupported ledger mode ${requested}; use ${LEDGER_MODES.join(' or ')}`);return requested;}
  const root=ledgerRoot?String(ledgerRoot):path.join(String(repoRoot??''),'.starciwork');
  return fs.existsSync(path.join(root,'features'))?WORK_LEDGER:'plan';
}

/**
 * The ledger this workflow works, resolved once and then a fact of the workflow: `state.ledgerRoot` and
 * `state.ledgerOwner` are written at goal time and reused on every resume, so a long job can never drift onto
 * another tree because a route file changed underneath it. An explicit `--ledger-root` always re-resolves.
 */
export function ledgerBinding(state,{repoRoot,host=null,ledgerRoot=null,git=spawnSync,resolve=resolveLedgerRoot}={}){
  // Only a tree the user named (--ledger-root) is remembered as given; a routed or local one is resolved again on
  // every start, so a binding recorded by an older rule never outlives the rule.
  if(!ledgerRoot&&state.ledgerSource==='option'&&state.ledgerRoot&&plain(state.ledgerOwner)&&state.ledgerOwner.repoRoot)
    return {source:state.ledgerSource??'state',ledgerRoot:state.ledgerRoot,ownerRepoRoot:state.ledgerOwner.repoRoot,
      ownerRepository:state.ledgerOwner.repository??null,ownerRole:state.ledgerOwner.role??null,
      project:state.ledgerOwner.project??null,role:state.codeRole??null,side:state.codeSide??null,
      roles:plain(state.ledgerRoles)?state.ledgerRoles:null,
      sharedLedger:Boolean(state.ledgerShared),exists:true};
  const resolved=resolve({repoRoot,host,options:ledgerRoot?{'ledger-root':ledgerRoot}:{},git});
  state.ledgerRoot=resolved.ledgerRoot;
  state.ledgerOwner={repoRoot:resolved.ownerRepoRoot,repository:resolved.ownerRepository,role:resolved.ownerRole,project:resolved.project};
  state.ledgerSource=resolved.source;
  state.ledgerShared=Boolean(resolved.sharedLedger);
  state.codeRole=resolved.role??null;
  state.codeSide=resolved.side??null;
  // Every role the binding declares, kept so a resumed run still knows the repositories that are neither the
  // code nor the ledger owner - the optional `grammar` one a reported `grammar-gap` is grown in.
  state.ledgerRoles=plain(resolved.roles)?resolved.roles:null;
  return resolved;
}

/** The whole mutable state of one workflow. `schema` is the store's, so state.json is written atomically by it. */
export function createWorkflowState({job,inputs=[],worktree,branch,gates=[],store,host=null,launcher=null,
  ledgerMode='plan',scope=[],repoRoot=null,ledgerRoot=null,ledgerOwner=null,ledgerSource=null,ledgerShared=false,
  codeRole=null,codeSide=null,lane=null}){
  need(plain(store)&&typeof store.id==='string','A workflow store is required');
  need(LEDGER_MODES.includes(ledgerMode),`Unsupported ledger mode ${ledgerMode}; use ${LEDGER_MODES.join(' or ')}`);
  return {schema:WORKFLOW_STATE,kernel:WORKFLOW_KERNEL,id:store.id,dir:store.dir,
    job:required(job,'job'),inputs:inputs.map(parseRef),worktree:path.resolve(required(worktree,'worktree')),
    branch:required(branch,'branch'),gates:gates.map(parseGate),host,launcher,
    // The worktree above is this workflow's lane when it owns one: the tree it runs in, and the branch that is
    // merged back into `lane.base.branch` when the workflow finishes done.
    lane:plain(lane)?{...lane}:null,
    ledgerMode,scope:[...scope],repoRoot:repoRoot?path.resolve(repoRoot):null,
    // The code root is the worktree above; these name the tree the Work itself lives in, which may belong to
    // another repository of the same product.
    ledgerRoot:ledgerRoot?path.resolve(ledgerRoot):null,ledgerOwner:plain(ledgerOwner)?{...ledgerOwner}:null,
    ledgerSource,ledgerShared:Boolean(ledgerShared),codeRole,codeSide,
    // The repositories the binding declares by role, resolved at goal time and on every resume; `grammar` is the
    // one the kernel routes to itself, and null here means this workflow may not change the grammar.
    ledgerRoles:null,
    run:null,from:null,workflowTask:null,phase:'goal',approved:false,
    definitionOfDone:[],risks:[],questions:[],ledger:[],ops:[],needUser:[],gateResults:[],verifyRounds:{},gateRounds:0,
    lanes:{},
    decisions:[],ledgerSummary:null,brand:null,
    // The critique of the goal (`critiqueGoal`) and, when its verdict was `refuse`, the owner's own override of it.
    critique:null,critiqueOverride:null,
    dynamicOps:0,dynamicOpsBudget:DYNAMIC_OPS_BUDGET,sharedQueue:[],silences:{},preflight:null,
    head:null,iterations:0,counters:{},stalls:0,allocation:null,finished:null,createdAt:Date.now()};
}

const byId=(state,id)=>state.ops.find(op=>op.id===id)??null;
const ledgerItem=(state,id)=>state.ledger.find(item=>item.id===id)??null;
/** `paused` is live too: an op waiting for its shared change is not finished and never lets the job finish. */
const liveStatus=['pending','ready','running','answering','paused'];
const nextId=(state,prefix)=>`${prefix}-${state.counters[prefix]=(state.counters[prefix]??0)+1}`;
const componentKey=ledgerIds=>[...ledgerIds].sort().join('+')||'-';
/**
 * The key a review round is counted against: the reviewed item set. Counting per module burned a feature's
 * three rounds on three different nodes, so the fourth node of a feature was never reviewed at all.
 */
const groupKey=(state,ledgerIds)=>{
  return componentKey(ledgerIds);
};
const implementsLedger=op=>op.kind!=='review.verify'&&(op.ledgerIds??[]).length>0;

/* ------------------------------------------------------------------ lanes */

/**
 * A lane is the template a Work node travels: the ordered kinds that must each be accepted before the node's
 * ledger entry may be called done. `state.lanes[nodeId] = {lane:[kind,...], done:[kind,...], checks, head}`
 * is the whole bookkeeping - the graph owns the template, the kernel owns the progress.
 *
 * Backend work is built and then reviewed; frontend work is drawn, built and then proved by a UAT run. The
 * node is one ledger item either way, so the user approves a template, not a pile of operations.
 */
export const LANE_LAYOUTS=['backend','frontend'];
/** The layout a node path declares: `features/x/implementation/frontend/**` is frontend work. */
export function nodeLayout(node){
  const where=slash(node?.path??'');
  for(const layout of LANE_LAYOUTS)if(new RegExp(`(^|/)implementation/${layout}(/|$)`).test(where))return layout;
  return null;
}
/** Kinds the kernel plans itself (`planVerifyOps`), so a node never derives one as its own next step. */
export const KERNEL_PLANNED_KINDS=['review.verify'];
/** The lane record of one node, created the first time the node is seen and never re-templated after that. */
export function laneOf(state,node){
  state.lanes=plain(state.lanes)?state.lanes:{};
  const id=String(node?.id??'');
  const existing=state.lanes[id];
  if(existing?.lane?.length)return existing;
  const lane=(()=>{try{return graph.laneFor({kind:node?.kind??null,layout:nodeLayout(node),repositoryRole:node?.repository??null});}catch{return [];}})();
  // A node that already has accepted ops (a state from before lanes existed) starts its lane where those ops left it.
  // An accepted author op is not one of them: it completed the record the lane is templated from, it walked no step.
  const accepted=state.ops.filter(op=>op.nodeId===id&&op.status==='done'&&op.kind!==AUTHOR_KIND).map(op=>op.kind);
  return state.lanes[id]={lane:[...lane],done:unique([...(existing?.done??[]),...accepted]),checks:[...(existing?.checks??[])],
    // `authored` is the bound on record authoring, not lane progress: it survives a re-template of the lane.
    ...(existing?.authored?{authored:existing.authored}:{}),
    head:existing?.head??state.ops.find(op=>op.nodeId===id&&op.status==='done'&&op.head&&op.kind!==AUTHOR_KIND)?.head??null};
}
/**
 * How the kernel reads a Work tree from anywhere that is not the run context: `deriveWorkOp` has the api and
 * the location, the run loop has `ctx.work`. Both answer the same three things, so one reader serves both.
 */
const ledgerAccess=ctx=>{
  if(!plain(ctx))return null;
  if(plain(ctx.work))return {api:ctx.work.api??null,at:ctx.work.at??{repoRoot:ctx.work.repoRoot,workRoot:ctx.work.workRoot},loaded:ctx.work.loaded??null};
  if(ctx.api)return {api:ctx.api,at:ctx.at??null,loaded:ctx.loaded??null};
  return null;
};
const workRootOf=at=>typeof at==='string'?path.join(at,'.starciwork')
  :plain(at)?(at.workRoot?String(at.workRoot):at.repoRoot?path.join(String(at.repoRoot),'.starciwork'):null):null;
const UI_KIND='ui';
/**
 * The `ui` node that is a node's interface design record: itself when it is one, else the ui node it references,
 * else the one beside it under its feature (`features/<feature>/ui/index.yaml`). The projection is asked first;
 * a record written after the tree was read is still found on disk, because the record, not the projection, is
 * the authority for what the interface lane still has to do.
 */
function designNodeOf(access,node){
  if(!plain(node))return null;
  if(node.kind===UI_KIND)return node;
  const nodes=access?.loaded?.nodes;
  const byRef=(Array.isArray(node.refs)?node.refs:[]).map(id=>typeof nodes?.get==='function'?nodes.get(id):null).find(item=>item?.kind===UI_KIND);
  if(byRef)return byRef;
  const module=workModule(node);
  const beside=(access?.loaded?.list??[]).find(item=>item?.kind===UI_KIND&&slash(item.path??'')===`${module}/ui/index.yaml`);
  if(beside)return beside;
  const root=workRootOf(access?.at);
  if(!root||!module.startsWith('features/'))return null;
  const file=path.join(root,module,'ui','index.yaml');
  return fs.existsSync(file)?{id:null,path:`${module}/ui/index.yaml`,kind:UI_KIND,state:null}:null;
}
/**
 * The interface design record a node reads: the `ui:` spec of its ui node - surfaces, states, the candidate
 * images under the node's own assets and the `artworkSlots` the drawing declared - with the record's own state
 * and file. It is read from disk, never inferred: a feature whose ui node was never drawn has surfaces without
 * candidates, and a feature with no ui node at all has no record.
 */
export function designRecord(ctx,node){
  const access=ledgerAccess(ctx);
  if(!access||!plain(node))return null;
  const design=designNodeOf(access,node);
  const root=workRootOf(access.at);
  if(!design||!root||!design.path)return null;
  const file=path.join(root,String(design.path));
  let raw;
  try{raw=parseYaml(fs.readFileSync(file,'utf8'));}catch{return null;}
  if(!plain(raw)||raw.kind!==UI_KIND)return null;
  const spec=plain(raw.ui)?raw.ui:{};
  return {...spec,node:raw.id??design.id??null,state:raw.state??design.state??null,file:slash(file)};
}
const declared=value=>Array.isArray(value)?value.length>0:plain(value)?Object.keys(value).length>0:false;
const slotGenerated=slot=>plain(slot)&&typeof slot.file==='string'&&slot.file.trim()!=='';
/**
 * Predicates an `optionalWhen` lane step reads. Both are facts of the node's design record, never a judgement:
 * `node.hasInterfaceDesign` is true when that record names its surfaces and the candidate images that drew them
 * (so there is nothing left to draw), and `node.hasNoArtworkSlots` is true when it declares no artwork slot or
 * every slot already names its generated file (so there is no artwork left to produce). A node with no record
 * satisfies neither: the step runs until the record says otherwise.
 */
export function lanePredicates(ctx=null,node=null){
  const record=designRecord(ctx,node);
  const drawn=Boolean(record)&&declared(record.surfaces)&&declared(record.assets);
  const slots=Array.isArray(record?.artworkSlots)?record.artworkSlots:[];
  return {
    'node.hasInterfaceDesign':drawn,
    // A record that was never drawn has declared nothing yet: the artwork step stays until the drawing says otherwise.
    'node.hasNoArtworkSlots':drawn&&(!slots.length||slots.every(slotGenerated))
  };
}
const laneNext=(entry,predicates=null)=>{
  try{return graph.nextKind(entry?.lane??[],entry?.done??[],{predicates:predicates??{}});}catch{return null;}
};
const laneText=lane=>(lane??[]).join(' -> ');
/**
 * The optional steps the node's own design record retires right now, kept on the lane entry so every line the
 * user reads - the contract, the status view, the goal table - prints the lane as it is walked, not the template.
 */
const laneSkip=(entry,predicates=null)=>{
  if(!entry?.lane?.length)return [];
  try{entry.skipped=graph.skippedKinds(entry.lane,entry.done??[],{predicates:predicates??{}});}catch{entry.skipped=Array.isArray(entry.skipped)?entry.skipped:[];}
  return entry.skipped;
};
/** The lane as the node walks it: every mandatory step and every optional step its record did not retire. */
const laneWalked=entry=>(entry?.lane??[]).filter(kind=>!(entry?.skipped??[]).includes(kind));
/** `2/3`: how much of a node's walked lane is accepted. What `workflow-status` prints per node. */
const laneProgress=entry=>{const walked=laneWalked(entry);return walked.length?`${(entry.done??[]).filter(kind=>walked.includes(kind)).length}/${walked.length}`:null;};
/** The build step of a lane: its one implement-role kind, which is what a repair of that node must be. */
const laneBuildKind=entry=>(entry?.lane??[]).find(kind=>kindRole(kind)==='implement')??null;
/** The lane an operation belongs to: its own node, or - for a kernel review - the node set it judges. */
const laneEntryOf=(state,op)=>state?.lanes?.[op?.nodeId??'']??state?.lanes?.[(op?.ledgerIds??[])[0]??'']??null;
/** The id of one lane step: the node id for the first step, then the node id plus the step's action word. */
const laneOpId=(nodeId,kind,first,taken)=>workOpId(first?nodeId:`${nodeId}-${String(kind).split('.').at(-1)}`,taken);
/** Every route the kernel applies is logged the same way, so the log names the rule that moved an operation. */
const routed=(store,op,on,to,origin=null,extra={})=>store.appendEvent({event:'routed',op:op.id,on,to,origin,...extra});
/** The route for one situation, or null; a graph that knows no rule leaves the caller its own default. */
// The kernel's verdict words (`fail` on a review, `reject` from the validator) map onto the graph's route vocabulary.
const ROUTE_VERDICTS={fail:'findings',reject:'rejected'};
const routeOf=query=>{try{return graph.routeFor({...query,...(query?.verdict?{verdict:ROUTE_VERDICTS[query.verdict]??query.verdict}:{})});}catch{return null;}};
/**
 * A route may name the kind literally, the reporter's own kind (`same`, resolved by the graph) or the lane's
 * build step (`lane-build`), which only the kernel can resolve. Anything else yields null and the caller
 * keeps its own default, so an unknown sentinel never launches an operation of an invented kind.
 */
function routeKind(route,state,op){
  // The graph resolves `same`/`lane.build` itself when it has the context; without it, it hands the symbol back
  // as `unresolved` and the kernel, which knows the op and its lane, resolves it here.
  const named=route?.kind??route?.unresolved??null;
  if(!named)return null;
  if(graph.KINDS.includes(named))return named;
  if(named==='same')return op?.kind??null;
  if(/build|lane/.test(named))return laneBuildKind(laneEntryOf(state,op));
  return null;
}

function toOp(raw,index){
  const id=typeof raw?.id==='string'&&raw.id.trim()?raw.id.trim():`op-${index+1}`;
  return {id,kind:required(raw?.kind,`kind of operation ${id}`),goal:required(raw?.goal,`goal of operation ${id}`),
    nodeId:typeof raw?.nodeId==='string'&&raw.nodeId.trim()?raw.nodeId.trim():null,
    ledgerIds:[...(raw.ledgerIds??[])],allowlist:[...(raw.allowlist??[])],references:[...(raw.references??[])],
    checks:(raw.checks??[]).map(check=>({name:required(check?.name,'check name'),command:required(check?.command,'check command')})),
    acceptance:[...(raw.acceptance??[])],dependsOn:[...(raw.dependsOn??[])],timeoutMs:raw.timeoutMs??null,
    resources:[...(raw.resources??[])],requesters:[...(raw.requesters??[])],
    status:'pending',origin:raw.origin??'plan',attempt:1,resumes:0,repairs:0,restarts:0,launchFailures:0,
    priorOpen:[...(raw.priorOpen??[])],findings:[...(raw.findings??[])],avoidRuntimes:[...(raw.avoidRuntimes??[])],
    runtime:null,target:null,task:null,dispatch:null,terminal:null,contractFile:null,nudged:false,
    kernelOwned:[],kernelOwnedAt:null,waitingFor:null,refusal:null,createdIteration:0,
    reports:[],files:[],head:null,verdict:null,validation:null,validatorRejects:0,needsReplan:Boolean(raw.needsReplan)};
}
function addOp(store,state,raw,reason){
  const op=toOp({...raw,id:raw.id??nextId(state,raw.origin??'op')},state.ops.length);
  need(op.allowlist.length,`Operation ${op.id} has an empty allowlist`);
  op.createdIteration=state.iterations;
  state.ops.push(op);
  store.appendEvent({event:'op-created',op:op.id,kind:op.kind,origin:op.origin,reason,allowlist:op.allowlist,ledgerIds:op.ledgerIds});
  gateDynamicOp(store,state,op);
  return op;
}

/* ------------------------------------------------------------------ the dynamic-op gate */

export const dynamicBudget=state=>Number.isFinite(state?.dynamicOpsBudget)?state.dynamicOpsBudget:DYNAMIC_OPS_BUDGET;
/**
 * An op nobody approved is bounded twice. Past `state.dynamicOpsBudget` ops created at run time, and for an
 * op whose whole allowlist falls outside the approved `scope`, the kernel refuses to run it: the op exists
 * (so the graph and the final report still name it) but it is `blocked` and becomes a `needUser` item. A node
 * derived op is scope-checked by the Work ledger itself, so only its budget is counted here.
 */
const KERNEL_ORIGINS=['ledger','verify','gate','architecture'];
/** Ops the kernel itself derives from the ledger or its own rules: counted against nothing but their own bounds. */
const countsAgainstBudget=op=>!KERNEL_ORIGINS.includes(op.origin);
function gateDynamicOp(store,state,op){
  if(!countsAgainstBudget(op))return true;
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  // A kernel-origin op an older build refused under the budget is superseded, never reinstated by --allow-dynamic.
  for(const op of state.ops)if(!countsAgainstBudget(op)&&op.refusal==='dynamic-op'){op.refusal='superseded';state.needUser=state.needUser.filter(item=>item.op!==op.id||item.kind!=='dynamic-op');}
  const budget=dynamicBudget(state);
  // In Work-ledger mode the scope names features (ledger ids), not file paths: the ledger itself bounds the
  // work, so only the budget gates a dynamic op there.
  const outside=op.nodeId||state.ledgerMode==='work'||!state.scope?.length?[]:op.allowlist.filter(entry=>!inScopePath(entry,state.scope));
  const reason=state.dynamicOps>budget?`beyond the dynamic-op budget of ${budget} for this workflow`
    :outside.length===op.allowlist.length&&outside.length?`outside the approved scope ${state.scope.join(', ')}: ${outside.join(', ')}`:null;
  if(!reason)return true;
  op.status='blocked';op.refusal='dynamic-op';
  state.needUser.push({op:op.id,kind:'dynamic-op',
    detail:`${op.id} (${op.kind}) was created at run time ${reason}; raise it with workflow-approve --id ${state.id} --allow-dynamic <n>`});
  store.appendEvent({event:'dynamic-op-refused',op:op.id,kind:op.kind,origin:op.origin,reason,
    dynamicOps:state.dynamicOps,budget,allowlist:op.allowlist});
  return false;
}

/* ------------------------------------------------------------------ phase: goal */

/**
 * Phase `goal`. The Work ledger mode derives the TODO list from the authored tree; the plan mode asks a
 * model to assess one. Either way the kernel writes goal.md and goal.json and stops for the one approval.
 */
export function goalPhase(store,state,options={}){
  const phased=state.ledgerMode===WORK_LEDGER?workGoalPhase(store,state,options):planGoalPhase(store,state,options);
  // goal.md is written by the phase (a model renders the plan one), so the critique section and the lane header
  // are spliced in afterwards: whatever else the page says, a reader sees the objections to the goal before the
  // definition of done, and the worktree this workflow owns before anything else.
  if(phased?.ok&&plain(state.critique))noteCritiqueInGoal(store,state);
  if(phased?.ok&&plain(state.lane))noteLaneInGoal(store,state);
  return {...phased,...(plain(state.lane)?{lane:laneView(state)}:{}),...(plain(state.critique)?{critique:critiqueView(state)}:{})};
}

/** The two lines of goal.md that name the lane and the base it goes home to, under the title. */
export function laneHeaderLines(state){
  const lane=state.lane;
  return [`Lane \`${lane.name}\` - worktree \`${slash(lane.worktree)}\` on branch \`${lane.branch}\`: this workflow`,
    `owns that tree alone. Its branch is merged into \`${lane.base?.branch}\` in \`${slash(lane.base?.worktree??'')}\` when the workflow finishes done.`];
}
function noteLaneInGoal(store,state){
  let page='';
  try{page=fs.readFileSync(store.paths.goal,'utf8');}catch{page='';}
  if(page.includes(`Lane \`${state.lane.name}\``))return;
  const lines=page.split('\n');
  const title=lines.findIndex(line=>line.startsWith('# '));
  const header=['',...laneHeaderLines(state)];
  lines.splice(title<0?0:title+1,0,...header);
  fs.writeFileSync(store.paths.goal,lines.join('\n'));
}

/* ------------------------------------------------------------------ the critique of the goal */

/**
 * Every goal a person writes is critiqued by the runtime before anything is planned from it. The critique is a
 * phase of the kernel, not a helper session: `critiqueGoal` is called in both ledger modes after the assessment
 * and before the approval page is written, its verdict is recorded in `state.critique`, in goal.json and in
 * goal.md above the definition of done, and the verdict has consequences - `revise` binds every operation
 * through its contract, `refuse` refuses the approval until the question is answered or the owner overrides it.
 * A provider that cannot answer never blocks a workflow: that is one event and one line on the page.
 */
/** Decision kinds whose accepted record is the product's own law: what a goal is critiqued against. */
const DECIDED_KINDS=['business','business-overview','architecture'];
/** Keys of an srs/sds payload that carry what the record states and what it was accepted against. */
const STATEMENT_KEYS=['statements','acceptanceCriteria','acceptance','criteria','closureCriteria','invariants','requirement','goal','question'];
/**
 * The statements of one decided record: the strings under a statement key of its `extensions.work3.srs` or
 * `.sds` payload, flattened, trimmed and capped, so the critic reads what the record states and not its tree.
 */
export function recordStatements(payload,{max=12,maxChars=300}={}){
  const found=[];
  const collect=(value,depth)=>{
    if(found.length>=max||depth>6)return;
    if(typeof value==='string'){const line=String(value).replace(/\s+/g,' ').trim();if(line)found.push(line.slice(0,maxChars));return;}
    if(Array.isArray(value)){for(const item of value)collect(item,depth+1);return;}
    if(plain(value))for(const item of Object.values(value))collect(item,depth+1);
  };
  const walk=(value,depth)=>{
    if(found.length>=max||depth>6)return;
    if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
    if(!plain(value))return;
    for(const [key,item] of Object.entries(value))STATEMENT_KEYS.includes(key)?collect(item,depth+1):walk(item,depth+1);
  };
  walk(payload,0);
  return unique(found).slice(0,max);
}
/**
 * The records the product has already accepted in scope: every decided business or architecture node with the
 * statements and acceptance criteria of its authored payload. This is the evidence the critic names, so an
 * objection that contradicts one of them is actionable and one that names none is dropped.
 */
export function decidedRecords(api,at,loaded,{scope=[],max=40}={}){
  const list=Array.isArray(loaded?.list)?loaded.list:[];
  const chosen=scope.length?list.filter(node=>scope.some(entry=>scopeNames(node,entry))):list;
  const records=[];
  for(const node of chosen){
    if(records.length>=max)break;
    if(!DECIDED_KINDS.includes(node.kind)||node.state!=='done')continue;
    let raw=null;
    try{raw=typeof api?.readNode==='function'?api.readNode(at,node):null;}catch{raw=null;}
    const work3=raw?.extensions?.work3??null;
    records.push({id:node.id,kind:node.kind,
      title:[raw?.description,raw?.title,raw?.name].map(value=>String(value??'').trim()).find(Boolean)||String(node.id),
      statements:recordStatements(work3?.srs??work3?.sds??work3??null)});
  }
  return records;
}

/**
 * Run the critique and record it. The providers are the host's supervisor runtimes (`supervisor.runtimes` in
 * config.json, astra then fable) unless the caller names its own chain. An unanswered critique is
 * `goal-critique-unavailable` and the workflow carries on: a dead provider is not a veto over the owner's job.
 */
export function critiqueGoalPhase(store,state,{critiqueGoal=llm.critiqueGoal,providers=null,cwd=state.worktree,runHeadless,
  ledger=[],decisions=[],records=[],material=[],constraints=[]}={}){
  const chain=providers??critiqueRuntimes(state.host??'');
  const critiqued=typeof critiqueGoal==='function'?critiqueGoal({job:state.job,scope:state.scope??[],ledger,decisions,
    records,material,brand:state.brand??null,constraints,providers:chain,cwd,runHeadless}):null;
  if(!critiqued?.ok){
    state.critique={verdict:'unavailable',objections:[],required:[],alternatives:[],question:null,prerequisites:[],provider:null,
      at:Date.now(),reason:critiqued?.reason??'critiqueGoal was not available'};
    store.appendEvent({event:'goal-critique-unavailable',reason:state.critique.reason,
      attempts:critiqued?.attempts?.length??0,providers:chain});
    return state.critique;
  }
  state.critique={verdict:critiqued.verdict,objections:(critiqued.objections??[]).map(item=>({...item})),
    required:[...(critiqued.required??[])],alternatives:[...(critiqued.alternatives??[])],
    question:critiqued.question??null,prerequisites:(critiqued.prerequisites??[]).filter(plain).map(item=>({...item})),
    provider:critiqued.provider??null,at:Date.now(),
    ...((critiqued.dropped??[]).length?{dropped:critiqued.dropped.length}:{})};
  store.appendEvent({event:'goal-critiqued',verdict:state.critique.verdict,objections:state.critique.objections.length,
    provider:state.critique.provider,...(state.critique.prerequisites.length?{prerequisites:state.critique.prerequisites.length}:{}),
    ...(state.critique.dropped?{dropped:state.critique.dropped}:{})});
  return state.critique;
}
/**
 * A prerequisite the critique names is acted on, not only printed. "Add X to the backend" with no record of X
 * is the common case: the goal phase plans the intake that authors X's records first (`work.author` for a
 * feature, `brand.decide` for the brand) and holds every other operation of the goal behind it, so the build
 * starts from a record and never from the prompt. A prerequisite the tree already holds changes nothing; a
 * `decision` is the owner's and stays on the page (`prerequisite-owner`).
 */
function planCritiquePrerequisites(store,state,{loaded,workRoot,repositories={},ctx=null}){
  const listed=(state.critique?.prerequisites??[]).filter(plain);
  const planned=[];
  for(const item of listed){
    const entry=item.kind==='brand'?'brand':slash(String(item.feature??'')).replace(/\/+$/,'');
    if(!entry)continue;
    if(item.kind==='decision'){store.appendEvent({event:'prerequisite-owner',kind:item.kind,feature:item.feature??null,why:item.why});continue;}
    const held=entry==='brand'?Boolean(state.brand):loaded.list.some(node=>scopeNames(node,entry));
    if(held){store.appendEvent({event:'prerequisite-held',kind:item.kind,feature:entry,why:item.why});continue;}
    const existing=state.ops.find(op=>op.intake?.scope===entry);
    if(existing){planned.push(existing);continue;}
    const raw=intakeOp(state,{workRoot,loaded,index:state.ops.filter(op=>op.intake?.scope==='brand').length,entry,repositories});
    const op=toOp(raw,state.ops.length);op.intake=raw.intake;op.difficulty='hard';op.prerequisite={kind:item.kind,why:item.why};
    if(ctx)locateSharedTreePaths(op,ctx);
    state.ops.push(op);planned.push(op);
    store.appendEvent({event:'intake-planned',op:op.id,scope:op.intake.scope,kind:op.kind,allowlist:op.allowlist,prerequisite:item.kind,why:item.why});
  }
  const ids=unique(planned.map(op=>op.id));
  if(ids.length)for(const op of state.ops){if(!ids.includes(op.id))op.dependsOn=unique([...(op.dependsOn??[]),...ids]);}
  return planned;
}
const critiqueView=state=>({verdict:state.critique?.verdict??null,objections:(state.critique?.objections??[]).length,
  required:(state.critique?.required??[]).length,provider:state.critique?.provider??null,
  ...((state.critique?.prerequisites??[]).length?{prerequisites:state.critique.prerequisites.length}:{}),
  ...(plain(state.critiqueOverride)?{overridden:state.critiqueOverride.reason}:{})});

export const CRITIQUE_HEADING='## Phản biện (critique)';
const sentence=value=>{const line=firstLine(value);return !line?'(not stated)':/[.!?]$/.test(line)?line:`${line}.`;};
/** The critique as the user reads it on the approval page: the verdict, the objections with their evidence, then what it demands. */
export function critiqueLines(state){
  const critique=plain(state.critique)?state.critique:{verdict:'unavailable'};
  const by=critique.provider?` (critic \`${critique.provider}\`)`:'';
  const lines=[CRITIQUE_HEADING,``];
  if(critique.verdict==='unavailable'){
    lines.push(`Phản biện: chưa chạy được - no critic runtime answered (${critique.reason??'unavailable'}), so this goal`,
      `was never challenged. The approval is not blocked by that, and nothing here binds an operation.`);
    return [...lines,``];
  }
  lines.push({
    sound:`Verdict: \`sound\`${by} - the critique found nothing that blocks this goal; proceed as written.`,
    revise:`Verdict: \`revise\`${by} - proceed only under the required changes below. They are part of the goal you approve here, and every operation of this workflow carries them in its contract.`,
    refuse:`Verdict: \`refuse\`${by} - this goal contradicts an accepted record or cannot be verified at all, so the approval is refused. Answer the question below and run the goal again, or accept the critique with \`workflow-approve --id ${state.id} --accept-critique "<reason>"\`.`
  }[critique.verdict]??`Verdict: \`${critique.verdict}\`${by}.`);
  if((critique.objections??[]).length){
    lines.push(``);
    for(const objection of critique.objections)
      lines.push(`- **${objection.kind}** - ${sentence(objection.claim)} Evidence: ${sentence(objection.evidence)} Consequence: ${sentence(objection.consequence)}`);
  }
  if(critique.dropped)lines.push(``,`${critique.dropped} objection(s) named no evidence and were dropped by the kernel.`);
  if(['revise','refuse'].includes(critique.verdict)&&(critique.required??[]).length)
    lines.push(``,`### Required changes`,``,...critique.required.map((item,index)=>`${index+1}. ${firstLine(item)}`));
  if((critique.alternatives??[]).length)lines.push(``,`### Alternatives`,``,...critique.alternatives.map(item=>`- ${firstLine(item)}`));
  if(critique.verdict==='refuse'&&critique.question)lines.push(``,`### Question`,``,firstLine(critique.question));
  if((critique.prerequisites??[]).length){
    const opOf=item=>state.ops?.find(op=>op.intake?.scope===(item.kind==='brand'?'brand':slash(String(item.feature??'')).replace(/\/+$/,'')))?.id??null;
    lines.push(``,`### Prerequisites`,``,...critique.prerequisites.map(item=>{
      const op=opOf(item);
      return `- **${item.kind}**${item.feature?` of \`${item.feature}\``:''} - ${sentence(item.why)}${item.kind==='decision'?' The owner decides it.':op?` Planned first as \`${op}\`; every other operation waits for it.`:' The tree already holds it.'}`;
    }));
  }
  if(plain(state.critiqueOverride))lines.push(``,
    `Override: the owner accepted this critique - "${firstLine(state.critiqueOverride.reason)}". An override is the owner's decision, so the kernel does not ask again.`);
  return [...lines,``];
}
/** Write the section into goal.md above the definition of done, replacing the one that is already there. */
function noteCritiqueInGoal(store,state){
  let page='';
  try{page=fs.readFileSync(store.paths.goal,'utf8');}catch{page='';}
  const lines=page.split('\n');
  const section=critiqueLines(state);
  const at=lines.findIndex(line=>line.trim()===CRITIQUE_HEADING);
  if(at>=0){
    let end=at+1;
    while(end<lines.length&&!lines[end].startsWith('## '))end+=1;
    lines.splice(at,end-at,...section);
  }else{
    const heading=lines.findIndex(line=>line.startsWith('## '));
    const title=lines.findIndex(line=>line.startsWith('# '));
    lines.splice(heading>=0?heading:title<0?lines.length:title+1,0,...section);
  }
  const text=lines.join('\n');
  fs.writeFileSync(store.paths.goal,text.endsWith('\n')?text:`${text}\n`);
}

/**
 * Plan ledger: one model call fills the whole plan form (definition of done, ledger, operations), the
 * kernel writes goal.md and goal.json and stops. Nothing is launched before the user approves.
 */
export function planGoalPhase(store,state,{assessGoal=llm.assessGoal,critiqueGoal=llm.critiqueGoal,renderGoalMarkdown=llm.renderGoalMarkdown,extractMaterial=llm.extractMaterial,cwd=state.worktree,providers,runHeadless}={}){
  need(!state.approved,`Workflow ${state.id} is already approved; run workflow-run`);
  need(typeof assessGoal==='function','assessGoal is not available yet in execution/llm-functions.mjs');
  const material=typeof extractMaterial==='function'?extractMaterial(state.inputs.map(item=>item.ref),{cwd}):[];
  const assessed=assessGoal({job:state.job,inputs:state.inputs,material,constraints:[
    `every op runs in the one worktree ${slash(state.worktree)} on branch ${state.branch}: allowlists of ops that may run in parallel must be disjoint`,
    `at most ${state.maxParallelOps??10} ops run at a time, and the kernel re-runs every declared check itself before it accepts a done`,
    ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)],providers,cwd,runHeadless});
  if(!assessed?.ok){
    store.appendEvent({event:'goal-failed',attempts:assessed?.attempts??null});
    store.saveState(state);
    return {ok:false,id:state.id,reason:assessed?.reason??'assessGoal produced no valid plan',attempts:assessed?.attempts??[]};
  }
  const plan=assessed.value;
  need(Array.isArray(plan.ledger)&&plan.ledger.length,'The plan has no ledger');
  need(Array.isArray(plan.ops)&&plan.ops.length,'The plan has no operations');
  state.definitionOfDone=[...(plan.definitionOfDone??[])];
  state.risks=[...(plan.risks??[])];state.questions=[...(plan.questions??[])];
  // `assessed` is what the plan claims the item already is; `status` is the kernel's own lifecycle. An item
  // the plan calls done has no op building it, so it is carried as `preexisting`: approved by the user, not
  // verified by the kernel, and named as such in the final report.
  state.ledger=plan.ledger.map((item,index)=>({id:item.id??`goal-${index+1}`,title:required(item.title,'ledger title'),
    inputRef:item.inputRef??null,assessed:item.status??'unknown',status:item.status==='done'?'preexisting':'planned',evidence:[]}));
  need(new Set(state.ledger.map(item=>item.id)).size===state.ledger.length,'Ledger ids are not unique');
  state.ops=plan.ops.map(toOp);
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Operation ids are not unique');
  for(const op of state.ops){
    need(op.allowlist.length,`Operation ${op.id} has an empty allowlist`);
    for(const dependency of op.dependsOn)need(byId(state,dependency),`Operation ${op.id} depends on the unknown ${dependency}`);
    for(const id of op.ledgerIds)need(ledgerItem(state,id),`Operation ${op.id} claims the unknown ledger item ${id}`);
  }
  if(plan.gates&&!state.gates.length)state.gates=plan.gates.map(parseGate);
  // Overlapping allowlists are not fatal: the scheduler never runs two overlapping operations at once.
  const overlaps=[];
  for(const [index,op] of state.ops.entries())for(const other of state.ops.slice(index+1)){
    if(allowlistsOverlap(op.allowlist,other.allowlist)&&!other.dependsOn.includes(op.id)&&!op.dependsOn.includes(other.id))overlaps.push([op.id,other.id]);
  }
  // The goal is critiqued before the page that asks for the approval is written: the plan the model assessed is
  // exactly what the critic reads, so an objection to it is an objection to what the user is about to approve.
  critiqueGoalPhase(store,state,{critiqueGoal,providers,cwd,runHeadless,material,
    ledger:state.ledger.map(item=>({id:item.id,kind:null,title:item.title})),
    constraints:[`the ledger of this goal was assessed by a model, not authored: a ledger item the plan calls done is approved by the user and never verified by the kernel`,
      ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)]});
  writeJson(store.paths.goalJson,{schema:GOAL_RECORD,id:state.id,job:state.job,inputs:state.inputs,ledgerMode:state.ledgerMode,
    definitionOfDone:state.definitionOfDone,risks:state.risks,questions:state.questions,critique:state.critique??null,
    ledger:state.ledger,ops:state.ops.map(op=>({id:op.id,kind:op.kind,goal:op.goal,
      ledgerIds:op.ledgerIds,allowlist:op.allowlist,references:op.references,checks:op.checks,acceptance:op.acceptance,dependsOn:op.dependsOn})),
    gates:state.gates,serializedOverlaps:overlaps,assessedBy:assessed.provider??null});
  const markdown=typeof renderGoalMarkdown==='function'?renderGoalMarkdown(plan,{job:state.job}):null;
  fs.writeFileSync(store.paths.goal,markdown??fallbackGoalMarkdown(state));
  state.phase='awaiting-approval';
  store.appendEvent({event:'goal',ops:state.ops.length,ledger:state.ledger.length,gates:state.gates.length,overlaps});
  store.saveState(state);
  return {ok:true,id:state.id,goal:store.paths.goal,goalJson:store.paths.goalJson,
    ops:state.ops.length,ledger:state.ledger.length,gates:state.gates.length,overlaps,
    next:`review ${slash(store.paths.goal)} and approve with workflow-approve --id ${state.id}`};
}

function fallbackGoalMarkdown(state){
  return [`# ${state.job}`,``,`Workflow \`${state.id}\` - branch \`${state.branch}\``,``,`## Definition of done`,
    ...state.definitionOfDone.map(item=>`- ${item}`),``,`## Goal ledger`,
    ...state.ledger.map(item=>`- \`${item.id}\` ${item.title}${item.inputRef?` (${item.inputRef})`:''}`),``,`## Operations`,
    ...state.ops.map(op=>`- \`${op.id}\` ${op.kind}: ${firstLine(op.goal)} - allowlist ${op.allowlist.join(', ')}${op.dependsOn.length?` - after ${op.dependsOn.join(', ')}`:''}`),
    ...(state.gates.length?[``,`## Job gates`,...state.gates.map(gate=>`- ${gate.name}: \`${gate.command}\``)]:[])].join('\n')+'\n';
}

/* ------------------------------------------------------------------ phase: goal on the Work ledger */

/**
 * Run the shipped Work validator and return its projection. The binary is resolved from the skill root, so
 * the same call works whether the kernel runs from the authored tree or from its `.dist` copy; `work-ledger`
 * takes this as its injected `validate` instead of guessing the host layout.
 */
export function validateWorkTree({repoRoot,workRoot=null}={}){
  const root=path.resolve(required(repoRoot,'repository root'));
  const tree=workRoot?path.resolve(workRoot):path.join(root,'.starciwork');
  const bin=path.join(skillRoot,'bin','starci.mjs');
  const shown=spawnSync(process.execPath,[bin,'validate',tree],{encoding:'utf8',windowsHide:true,maxBuffer:96*1024*1024});
  const output=(shown.stdout??'').trim();
  need(output,`The Work validator produced no output for ${slash(tree)}: ${tail(shown.stderr,300)||`exit ${shown.status}`}`);
  try{return JSON.parse(output);}catch{throw Error(`The Work validator did not print JSON for ${slash(tree)}`);}
}

/** An operation id that is also a safe file name: the Work id with every other character folded to `-`. */
/** One Work node -> one operation form; the goal phase and the run-time ledger sync both use it. */
/** Checks the kernel runs itself as gates (whole-tree validator, end-to-end suites): never per operation, never in parallel. */
// Only the whole-tree validator is the kernel's own check. End-to-end checks belong to the op that owns them: the
// product's e2e suite starts its own throwaway stack (Testcontainers), so ops may run it in parallel and a slice
// is not accepted until its e2e scenarios are green.
export const KERNEL_CHECK=/^work-valid$/i;
/**
 * The design grammar the host installs (knowledge/grammars/<family>/{DNA,family,idioms}.yaml and the UI composition
 * state canon) is a reference of every design-family operation: a drawing, a frontend build or a walk without it
 * invents its own look. Product-agnostic: every grammar family the host carries is listed.
 *
 * The brand record is the second half of that material and it is the product's own: these kinds are what
 * `brand.decide` exists for, so each of them references the brand file and every asset beside it, and each of
 * them refuses to run on a tree that has no brand record at all. `grammar.update` is in the list for the same
 * reason from the other end: it grows the language every drawing reads, so it reads the whole canon and the
 * identity the new unit has to live inside before it adds a word to either.
 */
export const DESIGN_KINDS=['interface.draw','interface.asset','frontend.implement','uat.verify','grammar.update'];
/** The repository a node is delivered in when it is not this kernel's own; null when it is ours or unknown. */
function foreignNodeOf(ctx,op){
  if(!ctx?.work||!op?.nodeId||!ctx.work.code?.repository||typeof ctx.work.api?.nodeRepository!=='function')return null;
  const node=ctx.work.node(op.nodeId);
  if(!node)return null;
  try{const declared=ctx.work.api.nodeRepository(ctx.work.api.readNode(ctx.work.at??ctx.work.repoRoot,node));return declared&&declared!==ctx.work.code.repository?declared:null;}catch{return null;}
}
export function grammarReferences(root=skillRoot){
  // The whole canon, not a shortlist: every grammar family file, every frontend pattern, every UI rule the host carries.
  const found=[];
  const walk=dir=>{try{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.ya?ml$/i.test(entry.name))found.push(slash(file));}}catch{}};
  for(const relative of [['knowledge','grammars'],['knowledge','patterns','fe'],['knowledge','ui']])walk(path.join(root,...relative));
  return unique(found).sort();
}
/**
 * The brand record as the Work ledger answers it. A ledger build that knows about brands always carries the
 * field - `{node, rev, file, spec}` or `null` - and one that does not carries none, which is the only way the
 * kernel tells "this product has no brand yet" from "this tree was never asked about brands".
 */
const brandAware=ctx=>{const access=ledgerAccess(ctx);return Boolean(access?.loaded)&&Object.hasOwn(access.loaded,'brand');};
/** A brand the kernel can hand to an operation: the node exists and its record carries a spec or a rev. A brand node with nothing authored yet is a brand still to decide, not one to read. */
const brandOf=ctx=>{const brand=ledgerAccess(ctx)?.loaded?.brand;return plain(brand)&&(plain(brand.spec)||(brand.rev!==null&&brand.rev!==undefined))?brand:null;};
/**
 * The brand spec in the fields the kernel reads. The authored shape is the Work schema's (`identity.name`,
 * `color.tokens[]`, `mascot.assets[]`, `imagery.promptRules`); a spec that already names these fields flat is
 * read as it is, so an injected ledger and a real record answer the same. Asset paths are made tree-relative.
 */
export function brandFields(brand){
  const spec=plain(brand?.spec)?brand.spec:{};
  const treePath=entry=>{const p=slash(String(entry??'')).replace(/^\.\//,'');return !p?'':p.startsWith(`${BRAND_DIRECTORY}/`)?p:`${BRAND_DIRECTORY}/${p}`;};
  const tokenMap=Array.isArray(spec.color?.tokens)
    ?Object.fromEntries(spec.color.tokens.filter(plain).filter(item=>typeof item.token==='string'&&item.token).map(item=>[item.token,{value:item.value??null,role:item.role??null}]))
    :null;
  const mascot=Array.isArray(spec.mascot?.assets)?spec.mascot.assets.filter(plain).map(item=>treePath(item.path)).filter(Boolean):null;
  const rev=spec.rev??brand?.rev??null;
  return {
    name:spec.identity?.name??spec.name??brand?.name??null,
    family:spec.identity?.family??spec.family??brand?.family??null,
    rev:rev===undefined?null:rev,
    colorTokens:plain(spec.colorTokens)?spec.colorTokens:tokenMap,
    mascotAssets:unique((Array.isArray(spec.mascotAssets)?spec.mascotAssets.map(entry=>slash(String(entry??''))):mascot??[]).filter(Boolean)),
    forbidden:Array.isArray(spec.forbidden)?spec.forbidden:Array.isArray(spec.imagery?.forbidden)?spec.imagery.forbidden:null,
    imageryPromptRules:Array.isArray(spec.imageryPromptRules)?spec.imageryPromptRules:Array.isArray(spec.imagery?.promptRules)?spec.imagery.promptRules:null
  };
}
const BRAND_DIRECTORY='brand';
/** The brand file and every asset beside it, as the ledger names them; a ledger that names none adds nothing. */
const brandReferencesOf=(api,loaded)=>{
  if(typeof api?.brandReferences!=='function'||!loaded?.brand)return [];
  try{return unique((api.brandReferences(loaded)??[]).map(entry=>slash(String(entry??''))).filter(Boolean));}catch{return [];}
};
/** What a contract prints and the status records: the brand's identity and its artwork, never the whole spec. */
export function brandSummary(loaded){
  const brand=loaded?.brand;
  if(!plain(brand)||!(plain(brand.spec)||(brand.rev!==null&&brand.rev!==undefined)))return null;
  const fields=brandFields(brand);
  return {node:brand.node??null,file:brand.file?slash(String(brand.file)):null,name:fields.name,family:fields.family,rev:fields.rev,mascotAssets:fields.mascotAssets};
}
/** What the validator is given: the brand as rules, trimmed to the fields a verdict may be founded on. */
export const BRAND_PAYLOAD=['name','family','rev','colorTokens','mascotAssets','forbidden','imageryPromptRules'];
export function brandPayload(loaded){
  const brand=loaded?.brand;
  if(!plain(brand))return null;
  const fields=brandFields(brand);
  const value={};
  for(const field of BRAND_PAYLOAD){
    const given=fields[field];
    if(given!==undefined&&given!==null&&!(Array.isArray(given)&&!given.length))value[field]=given;
  }
  return Object.keys(value).length?value:null;
}
/**
 * The brand summary on the state, and the one event a changed `rev` owes every operation that already read it.
 * A new rev is not the kernel's to act on beyond this: the Work validator binds a completion to the digest of
 * what it was built from, so a frontend-facing node whose brand moved is reopened in the tree itself and
 * `syncLedgerOps` picks it up on the next iteration like any other newly schedulable node.
 */
function noteBrand(store,state,loaded,{op=null,silent=false}={}){
  if(!loaded||!Object.hasOwn(loaded,'brand'))return state.brand??null;
  const summary=brandSummary(loaded);
  const changed=String(state.brand?.rev??'')!==String(summary?.rev??'');
  state.brand=summary;
  if(changed&&!silent&&summary?.rev!==null&&summary?.rev!==undefined)
    store.appendEvent({event:'brand-revised',rev:summary.rev,node:summary.node??null,...(op?{op:op.id}:{})});
  return summary;
}
/**
 * On a shared ledger the Work tree is in the owner repository, not in this worktree: an allowlist entry under
 * `.starciwork/` and a reference that names a tree file are rewritten to the owner's absolute path, so the
 * operation writes and reads the one tree there is. A ledger that is here is left alone.
 */
function locateSharedTreePaths(op,ctx){
  const owner=ctx?.work?.shared?ctx.work.ledger?.repoRoot:null;
  if(!owner)return op;
  const root=slash(owner),workRoot=slash(ctx.work.ledger?.workRoot??path.join(owner,'.starciwork'));
  op.allowlist=unique((op.allowlist??[]).map(entry=>/^\.starciwork\//.test(slash(entry))?`${root}/${slash(entry)}`:entry));
  op.references=unique((op.references??[]).map(entry=>{
    const relative=slash(entry);
    if(/^[A-Za-z]:\//.test(relative)||relative.startsWith('/'))return relative;
    try{return fs.existsSync(path.join(workRoot,relative))?`${workRoot}/${relative}`:relative;}catch{return relative;}
  }));
  return op;
}
/**
 * A frontend implementation is built against the drawing of its feature. While the `ui` node that is that
 * drawing is not done the build waits (`lane-waits-design`, recorded once per drawing), and a feature with no ui
 * node at all is the user's: a build that invents its own screen leaves nothing for the walk to compare
 * against. True when the node must not start its lane now; the same answer in the goal phase and in the run.
 */
function designGate(store,state,access,node,entry){
  if(!plain(node)||node.kind===UI_KIND||!(entry?.lane??[]).includes('frontend.implement'))return false;
  const design=designRecord(access,node);
  if(!design){
    if(!state.needUser.some(item=>item.node===node.id&&item.kind==='design'))
      state.needUser.push({node:node.id,kind:'design',detail:`no interface design record: the feature of ${node.id} has no ui node for the build to be drawn against; author one (features/<feature>/ui/index.yaml) or reference one`});
    return true;
  }
  if(design.state!=='done'){
    const waiting=design.node??design.file;
    if(entry.waitsDesign!==waiting){entry.waitsDesign=waiting;store.appendEvent({event:'lane-waits-design',node:node.id,design:design.node??null,file:design.file});}
    return true;
  }
  state.needUser=state.needUser.filter(item=>!(item.kind==='design'&&item.node===node.id));
  delete entry.waitsDesign;
  return false;
}
/**
 * The candidate images a ui node's record names, as the hashed evidence assets of its completion: the `ui`
 * completion profile requires a hashed local capture, and the drawing's candidates under the node's own `assets/`
 * are exactly that. Read and hashed here, so the evidence binds the bytes the record was accepted with.
 */
function designEvidenceAssets(access,node){
  if(!plain(node)||node.kind!==UI_KIND)return [];
  const record=designRecord(access,node);
  const root=workRootOf(access?.at);
  if(!record||!root)return [];
  const directory=path.join(root,path.dirname(String(node.path??'')));
  const assets=[];
  for(const entry of Array.isArray(record.assets)?record.assets:[]){
    const relative=slash(String(entry?.path??'')).replace(/^\.\//,'');
    if(!relative.startsWith('assets/')||relative.split('/').some(part=>part===''||part==='..'))continue;
    try{
      const bytes=fs.readFileSync(path.join(directory,relative));
      assets.push({path:relative,scope:'node',sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    }catch{/* a declared candidate that is not on disk is the validator's finding, not a kernel guess */}
  }
  return assets;
}
/** The design record of a node other than itself, tree-relative, as one reference of every op built or walked against it. */
function designReferenceOf(access,node){
  if(!plain(node)||node.kind===UI_KIND)return [];
  const record=designRecord(access,node);
  const root=workRootOf(access?.at);
  if(!record?.file||!root)return [];
  const relative=slash(path.relative(root,record.file));
  return relative&&!relative.startsWith('..')?[relative]:[];
}
export function deriveWorkOp(api,repoRoot,node,{id,opOfNode=new Map(),index=0,lane=null,done=[],loaded=null}){
  // Lane-aware: the kind of this operation is the node's next lane step, not a fixed map of the node kind.
  const template=lane?.length?lane:(()=>{try{return graph.laneFor({kind:node.kind,layout:nodeLayout(node),repositoryRole:node.repository??null});}catch{return [];}})();
  const access={api,at:repoRoot,loaded};
  const step=(()=>{try{return graph.nextKind(template,done,{predicates:lanePredicates(access,node)});}catch{return null;}})();
  const design=DESIGN_KINDS.includes(step??'');
  // A ui node's drawing and artwork steps author the design body of the node's own record - the `ui:` spec
  // and the candidates and artwork under its assets - so the exact record path is granted, the way a decision
  // is granted its own record; every other kind is kept off the record the kernel owns.
  const ownRecord=node.kind===UI_KIND&&design?[`.starciwork/${slash(node.path)}`]:[];
  return toOp({id,nodeId:node.id,
    kind:step??WORK_OPERATION[node.kind]??'task.execute',goal:describeNode(api,repoRoot,node),
    ledgerIds:[node.id],allowlist:unique([...node.allowlist,...ownRecord]),
    // A design-family step reads two bodies of material it may never invent: the installed grammar and the
    // product's own brand record with its assets.
    references:unique([node.path,...(node.refs??[]),...(design?grammarReferences():[]),...(design?brandReferencesOf(api,loaded):[]),...designReferenceOf(access,node)]),
    // The whole-tree validator is the kernel's own gate at acceptance: parallel operations must not fail on a sibling's in-progress ledger write.
    checks:node.checks.filter(check=>!KERNEL_CHECK.test(check.assertion??'')).map(check=>({name:check.assertion??check.command,command:check.command})),
    acceptance:node.assertions.length?node.assertions:[`${node.id} satisfies the Work contract it authored`],
    resources:[...(node.resources??[])],
    // An eligible node has no unsettled dependency, so a dependency inside this set is already done; the
    // mapping is kept so a tree that validates differently still schedules in dependency order.
    dependsOn:(node.dependsOn??[]).map(dep=>opOfNode.get(dep)).filter(Boolean),origin:'ledger'},index);
}

/**
 * Dynamic operations: the Work tree is re-read every iteration and every newly schedulable node (a node the
 * user added, or one whose dependencies just became done) becomes an operation of this workflow.
 */
export function syncLedgerOps(store,state,ctx){
  if(!ctx.work)return [];
  let loaded;
  try{loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});}
  catch(error){store.appendEvent({event:'ledger-sync-failed',reason:error.message});return [];}
  ctx.work.loaded=loaded;
  // A brand that moved since the last read is named here too: the re-read is what makes the new rev current.
  noteBrand(store,state,loaded);
  // An operation created before the repository rule for a node another repository delivers is settled and blocked.
  for(const op of state.ops){
    if(!op.nodeId||op.refusal==='out-of-repository'||!ctx.work.code.repository||typeof ctx.work.api.nodeRepository!=='function')continue;
    const node=loaded.nodes.get(op.nodeId);
    if(!node)continue;
    let foreign=null;try{foreign=ctx.work.api.nodeRepository(ctx.work.api.readNode(ctx.work.at,node));}catch{foreign=null;}
    if(!foreign||foreign===ctx.work.code.repository)continue;
    if(liveStatus.includes(op.status)&&op.dispatch&&ctx.orca){
      settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'out-of-repository',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
      if(op.runtime)ctx.allocator.release(op.runtime,{op:op.id});
    }
    op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
    for(const item of state.ledger)if(item.id===op.nodeId)item.status='out-of-repository';
    store.appendEvent({event:'op-out-of-repository',op:op.id,node:op.nodeId,repository:foreign,own:ctx.work.code.repository});
  }
  let quarantined=false;
  if(!loaded.ok&&quarantineStrays(store,state,ctx,loaded).length){
    // Strays an abandoned operation left in the tree were moved aside: the tree is read again before anything
    // is concluded from its errors.
    try{loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});ctx.work.loaded=loaded;quarantined=loaded.ok;}catch{/* the invalid branch below says what it sees */}
  }
  if(!loaded.ok){
    // No node of an invalid tree is a trustworthy TODO, so nothing is derived from it - and that is said once per
    // distinct set of errors, never silently and never on every tick.
    const signature=unique(loaded.errors.map(error=>`${error.code}:${error.path??''}`)).sort().join('|');
    if(state.ledgerInvalid!==signature){
      state.ledgerInvalid=signature;
      store.appendEvent({event:'ledger-invalid',errors:loaded.errors.slice(0,8).map(error=>({code:error.code,path:error.path??null,message:String(error.message??'').slice(0,160)}))});
    }
    return [];
  }
  if(state.ledgerInvalid||quarantined){
    state.ledgerInvalid=null;store.appendEvent({event:'ledger-valid-again',...(quarantined?{after:'quarantine'}:{})});
    // Ops the validator exhausted only because the whole-tree check was red are judged again now that it is green.
    for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&state.needUser.some(entry=>entry.op===item.id&&entry.kind==='validator'&&/work-valid/.test(String(entry.detail??''))))){
      op.status='ready';op.validatorRejects=0;op.dispatch=null;op.terminal=null;
      state.needUser=state.needUser.filter(entry=>!(entry.op===op.id&&entry.kind==='validator'));
      store.appendEvent({event:'op-readmitted',op:op.id,reason:'the tree is valid again; the validator rejected only its whole-tree check'});
    }
  }
  const scope=state.scope.length?state.scope:null;
  const taken=new Set(state.ops.map(op=>op.id));
  const opOfNode=new Map(state.ops.filter(op=>op.nodeId).map(op=>[op.nodeId,op.id]));
  const added=[];
  pruneAnsweredQuestions(store,state,loaded);
  const candidates=ctx.work.api.executableCandidates(loaded,{scope,repository:ctx.work.code.repository,side:ctx.work.side});
  // A "ledger incomplete" item is only as current as the tree: once its node is schedulable, done, or no longer
  // a candidate at all (foreign, ineligible), the item is stale and goes.
  const incomplete=new Set(candidates.filter(node=>!node.schedulable).map(node=>node.id));
  const doneNow=new Set(loaded.list.filter(node=>node.state==='done').map(node=>node.id));
  state.needUser=state.needUser.filter(item=>{
    if(item.kind!=='ledger')return true;
    if(item.node)return incomplete.has(item.node);
    // An op-keyed item (a refused write) is stale once that op is done and its node is back in the tree, or the node is done.
    const op=state.ops.find(candidate=>candidate.id===item.op);
    if(!op)return true;
    if(doneNow.has(op.nodeId??''))return false;
    return !(op.status==='done'&&op.nodeId&&loaded.nodes.has(op.nodeId));
  });
  for(const node of candidates){
    if(!node.schedulable){
      const authored=authorRecordOp(store,state,ctx,node,taken);
      if(authored)added.push(authored.id);
      continue;
    }
    const entry=laneOf(state,node);
    const mine=state.ops.filter(op=>op.nodeId===node.id);
    // The op that completed this node's record is not a step of its lane: it precedes the lane, so the lane's
    // first step is still the first step and still carries the node's own id.
    const laneOps=mine.filter(op=>op.kind!==AUTHOR_KIND);
    // One step at a time: a node yields its next lane step only when nothing of it is still in flight.
    if(mine.some(op=>op.status!=='done'))continue;
    if(!laneOps.length&&designGate(store,state,{api:ctx.work.api,at:ctx.work.at,loaded},node,entry))continue;
    const predicates=lanePredicates({api:ctx.work.api,at:ctx.work.at,loaded},node);
    laneSkip(entry,predicates);
    const next=laneNext(entry,predicates);
    // No next step means the lane is walked; `review.verify` is the kernel's own (planVerifyOps), not the node's.
    const onDisk=(()=>{try{return ctx.work.api.readNode(ctx.work.at,node)?.state??node.state;}catch{return node.state;}})();
    if(!next&&laneOps.length&&onDisk==='todo'&&!entry.recordedAttempt){
      // The lane is walked but the tree still says todo: an earlier done write was refused (a rule since fixed).
      // Record it once more from the lane's merged checks; a second refusal stays in needUser.
      const last=[...laneOps].reverse().find(op=>op.status==='done')??laneOps.at(-1);
      entry.recordedAttempt=state.iterations;
      store.appendEvent({event:'lane-record-retry',node:node.id,op:last.id});
      recordDone(store,state,last,ctx,{checks:entry.checks??[]},{nodeId:node.id,head:entry.head??last.head});
      ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,last,ctx,node.id));
      continue;
    }
    if(!next||KERNEL_PLANNED_KINDS.includes(next)||mine.some(op=>op.kind===next))continue;
    const id=laneOpId(node.id,next,!laneOps.length,taken);opOfNode.set(node.id,id);
    const op=deriveWorkOp(ctx.work.api,ctx.work.at,node,{id,opOfNode,index:state.ops.length,lane:entry.lane,done:entry.done,loaded});
    locateSharedTreePaths(op,ctx);
    op.difficulty=op.difficulty??'medium';
    op.createdIteration=state.iterations;
    state.ops.push(op);
    if(!ledgerItem(state,node.id))
      state.ledger.push({id:node.id,title:describeNode(ctx.work.api,ctx.work.at,node),inputRef:node.path,kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[],lane:[...entry.lane]});
    added.push(op.id);
    store.appendEvent({event:'op-added',op:op.id,node:node.id,kind:op.kind,
      reason:laneOps.length?`lane step ${entry.done.length+1} of ${laneWalked(entry).length} (${laneText(laneWalked(entry))})`:'newly schedulable Work node'});
    gateDynamicOp(store,state,op);
  }
  return added;
}

/** The one path an operation may be given inside the ledger: the node's own `index.yaml`, exactly as the guard names it. */
function recordPath(state,ctx,node){
  const root=ctx.work.ledger?.repoRoot??ctx.work.repoRoot??state.worktree;
  const owned=(ctx.guards??kernelGuards).protectedPaths(node,root)??[];
  return owned.find(entry=>/index\.ya?ml$/.test(entry))??null;
}

/**
 * An incomplete record is an operation's job, not the user's. A candidate the ledger reports `schedulable:false`
 * (it declares no write scope, or no check) gets exactly one `work.author` op whose allowlist is that node's own
 * `index.yaml` and whose only check is the kernel's own whole-tree validator. The bound is the point: one author
 * op per node per workflow, and a record that is still incomplete after that op was accepted is the question the
 * user has to answer - `settleAuthoredRecord` raises it and no second author op is ever created.
 *
 * Two cases keep today's behaviour instead. A tree another repository owns is not in this worktree, so no
 * operation here can be given a path inside it; and a node whose `index.yaml` the guard cannot name has no
 * write scope to grant. Both stay a `needUser` item, because inventing one is exactly what the ledger prevents.
 */
function authorRecordOp(store,state,ctx,node,taken){
  const lane=laneOf(state,node);
  const record=ctx.work.shared?null:recordPath(state,ctx,node);
  const stop=detail=>{
    if(!state.needUser.some(item=>item.node===node.id&&item.kind==='ledger'))state.needUser.push({node:node.id,kind:'ledger',detail});
    return null;
  };
  if(lane.authored){
    const op=byId(state,lane.authored);
    // Still in flight: the record is being completed and there is nothing to tell the user yet. Finished any
    // other way - accepted, refused, blocked - the node is the user's, because its one author op is spent.
    if(op&&liveStatus.includes(op.status))return null;
    return stop(`ledger incomplete: ${node.reason}`);
  }
  if(!record)return stop(`ledger incomplete: ${node.reason}`);
  const id=workOpId(`${node.id}-author`,taken);
  const op=toOp({id,nodeId:node.id,kind:AUTHOR_KIND,
    goal:`Complete the Work record of ${node.id} so the kernel can launch it: ${node.reason}`,
    // No ledger item: the node enters the workflow's ledger when its own lane starts, not when its record is written.
    ledgerIds:[],allowlist:[record],references:unique([node.path,...(node.refs??[])]),
    checks:[{name:'work-valid',command:workValidateCommand(ctx)}],
    acceptance:['the node declares an allowlist and checks that name its assertions','the tree validates'],
    origin:'ledger'},state.ops.length);
  op.difficulty='hard';
  op.createdIteration=state.iterations;
  lane.authored=op.id;
  state.ops.push(op);
  // The record is being completed now, so it is no longer a question for the user.
  state.needUser=state.needUser.filter(item=>!(item.kind==='ledger'&&item.node===node.id));
  store.appendEvent({event:'op-added',op:op.id,node:node.id,kind:op.kind,reason:`ledger incomplete: ${node.reason}`});
  gateDynamicOp(store,state,op);
  return op;
}

export function workOpId(nodeId,taken=new Set()){
  const base=String(nodeId??'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^[-._]+/,'').replace(/[-._]+$/,'')||'node';
  let id=base;
  for(let suffix=2;taken.has(id);suffix+=1)id=`${base}-${suffix}`;
  taken.add(id);
  return id;
}
/** The module a node belongs to: its feature directory, falling back to the first two id segments. */
export function workModule(node){
  const parts=slash(node?.path??'').split('/').filter(Boolean);
  if(parts[0]==='features'&&parts[1])return `features/${parts[1]}`;
  const id=String(node?.id??'');
  return id.split('.').slice(0,2).join('.')||id||'-';
}
/** The authored node is the record: its description is the operation goal, never a model's paraphrase. */
function describeNode(api,repoRoot,node){
  try{
    const raw=api.readNode(repoRoot,node);
    const text=[raw?.description,raw?.title,raw?.name].map(value=>String(value??'').trim()).find(Boolean);
    return text||String(node.id);
  }catch{return String(node.id);}
}
const ledgerErrorText=errors=>errors.slice(0,3).map(error=>typeof error==='string'?error:JSON.stringify(error)).join('; ');

/**
 * Work ledger: the TODO list already exists, so the kernel never asks a model to invent one. It loads the
 * tree through the shipped validator, lists the decision candidates and the schedulable executable
 * candidates in scope, and derives every operation from its node - goal from `description`, allowlist from
 * `implementation.changes[].files`, checks from `extensions.work3.checks`, acceptance from `assertions`.
 * A node that declares no allowlist or no checks cannot be launched: it becomes a `needUser` item named
 * "ledger incomplete" in goal.md, because guessing a scope for authored work is not the kernel's to do.
 * The model is asked for one thing only: the definition of done and the risks and questions around it.
 */
/** Whether a scope entry names this node: by id prefix or by tree path, the way the ledger's own scope filter reads it. */
function scopeNames(node,entry){
  const key=slash(String(entry??'')).replace(/\/+$/,''),id=String(node?.id??''),where=slash(node?.path??'');
  return Boolean(key)&&(id===key||id.startsWith(`${key}.`)||where===key||where.startsWith(`${key}/`)||where.startsWith(`features/${key}/`));
}
/**
 * The intake operation of a scope entry the tree does not know. `brand` is authored and decided by one
 * `brand.decide` op on the one brand record; a feature is authored by one `work.author` op that mirrors the shape
 * of an existing feature - module record, business overview and SRS drafts, architecture skeleton - every record
 * `todo`, so the owner reads drafts and the decisions stay the owner's. Neither op closes a Work node: the records
 * it writes are the nodes the tree has afterwards.
 */
function intakeOp(state,{workRoot,loaded,index,entry=null,repositories={}}){
  const name=slash(String(entry??'')).replace(/\/+$/,'');
  const check={name:'work-tree-validates',command:validateCommandAt(workRoot)};
  if(name==='brand'){
    return {id:`brand-${index+1}`,kind:BRAND_DECIDE,nodeId:null,intake:{scope:'brand'},
      goal:`Author and decide the brand record .starciwork/brand/index.yaml of this product from the job: ${state.job}. The name, the design family, every colour token with the role it plays and the source file it is traced to, the fonts, the mascot and logo assets (generate a placeholder mascot with the image model when the product has none), what is forbidden and the rules every imagery prompt must carry.`,
      ledgerIds:[],allowlist:['.starciwork/brand/index.yaml','.starciwork/brand/**'],
      // The frontend repository the tokens are traced to is a read-only reference here, never a place to write.
      references:unique(['workspace.yaml',...Object.entries(repositories).filter(([role])=>role!=='be').map(([,root])=>slash(root)),...grammarReferences()]),checks:[check],
      acceptance:['.starciwork/brand/index.yaml is a valid brand node: name, family, colour tokens with their roles and sources, the mascot and logo assets, the forbidden list and the imagery prompt rules','the Work tree still validates'],origin:'ledger'};
  }
  // The example the drafts mirror: the first feature module the tree already has, with its business and architecture roots.
  const paths=loaded.list.map(node=>slash(node.path??''));
  const features=unique(paths.map(where=>(where.match(/^features\/([^/]+)\//)??[])[1]).filter(Boolean)).sort();
  const example=features[0]?`features/${features[0]}`:null;
  const roots=example?[`${example}/index.yaml`,`${example}/business/index.yaml`,`${example}/business/overview/index.yaml`,`${example}/architecture/index.yaml`,`${example}/architecture/overview/index.yaml`]:[];
  const found=paths.filter(where=>roots.includes(where));
  // Always a real record to mirror: the module roots when the tree has them, else the first record under the example.
  const exampleRefs=found.length?found:paths.filter(where=>example&&where.startsWith(`${example}/`)).sort().slice(0,1);
  return {id:`${name.replace(/[^A-Za-z0-9._-]+/g,'-')}-intake`,kind:AUTHOR_KIND,nodeId:null,intake:{scope:name,example},
    goal:`Author the Work records of the feature ${name} from the job: ${state.job}. Mirror the shape of the existing feature ${example??'(none yet)'}: the module record, the business overview and SRS as full drafts, the architecture as a skeleton; every leaf record todo (the module, business, srs, architecture and sds roots carry no state, exactly as the example), every open question an open decision.`,
    ledgerIds:[],allowlist:[`.starciwork/features/${name}/**`],
    references:unique(['workspace.yaml',...exampleRefs]),checks:[check],
    acceptance:[`features/${name} has a module record, a business overview, SRS records and an architecture skeleton, every leaf record todo and the whole feature valid - the roots (module, business, srs, architecture, sds) carry no state, as in the example feature`,'no existing feature changed','the Work tree still validates'],origin:'ledger'};
}
export function workGoalPhase(store,state,{assessGoal=llm.assessGoal,critiqueGoal=llm.critiqueGoal,ledgerApi=work,validate=validateWorkTree,cwd=state.worktree,providers,runHeadless,
  ledgerRoot=null,git=spawnSync,resolveLedger=resolveLedgerRoot}={}){
  need(!state.approved,`Workflow ${state.id} is already approved; run workflow-run`);
  // The Work ledger is the branch content of the worktree; only the workflow history lives in the main repository.
  const repoRoot=state.repoRoot??path.resolve(state.worktree);
  state.repoRoot=repoRoot;
  // ... unless another repository of the same product owns the tree: then the code is here and the Work is there.
  const binding=ledgerBinding(state,{repoRoot,host:state.host,ledgerRoot,git,resolve:resolveLedger});
  const at={repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot};
  const repository=ledgerApi.repositoryName?.(repoRoot)??null;
  const loaded=ledgerApi.loadLedger({...at,validate});
  const scope=state.scope.length?state.scope:null;
  const executables=ledgerApi.executableCandidates(loaded,{scope,repository,side:binding.side});
  const ready=executables.filter(node=>node.schedulable),incomplete=executables.filter(node=>!node.schedulable);
  // A scope entry that names nothing in the tree is a feature - or the brand - still to be authored. The workflow
  // then begins with one intake operation that writes those records from the job, and the tree, once it has them,
  // says what follows: decisions the owner takes, lanes the kernel walks. Nothing is invented by the kernel itself.
  const absent=(scope??[]).filter(entry=>!loaded.list.some(node=>scopeNames(node,entry)));
  const repositories=(()=>{try{return Object.fromEntries(bindingRoutes(binding.binding,{source:path.dirname(path.resolve(state.host??''))}).map(route=>[route.role,route.directory]));}catch{return {};}})();
  // The folders of the other bound repositories, and the folder they all live in, so a path naming one of them
  // is never mistaken for a path of this worktree.
  state.otherRepositories=unique(Object.values(repositories).map(root=>path.basename(String(root))).filter(name=>name&&name!==path.basename(repoRoot)));
  state.repositoriesRoot=state.host?path.basename(path.dirname(path.dirname(path.resolve(state.host)))):null;
  const intake=absent.map((entry,index)=>intakeOp(state,{workRoot:binding.ledgerRoot,loaded,index,entry,repositories}));
  state.decisions=ledgerApi.decisionCandidates(loaded,{scope}).map(node=>({id:node.id,kind:node.kind,path:node.path,
    operation:DECISION_OPERATION[node.kind]??'business.decide',title:describeNode(ledgerApi,at,node)}));
  state.ledgerSummary=ledgerApi.ledgerSummary(loaded,{scope});
  // The brand is part of what the user approves: goal.md and goal.json name the record every design step reads.
  noteBrand(store,state,loaded,{silent:true});
  if(!loaded.ok)state.needUser.push({kind:'ledger',detail:`the Work tree does not validate, so no node in it is a trustworthy TODO: ${ledgerErrorText(loaded.errors)}`});
  for(const node of incomplete)state.needUser.push({node:node.id,kind:'ledger',detail:`ledger incomplete: ${node.reason}`});
  need(ready.length||incomplete.length||state.decisions.length||intake.length,
    `No eligible Work node in scope ${scope?scope.join(', '):'(the whole tree)'}: there is nothing for this workflow to do`);
  // The lane is the template the user approves: every node gets its record here, before any op exists. A
  // frontend build whose drawing is not done yet keeps its lane and waits; it enters the ops once the ui node is.
  state.lanes={};
  for(const node of ready)laneOf(state,node);
  // A held node is still a goal item: it stays `planned` in the ledger with no op, so the workflow cannot finish
  // around it, and its first op is created by `syncLedgerOps` once the drawing it waits for is done.
  const launchable=ready.filter(node=>!designGate(store,state,{api:ledgerApi,at,loaded},node,state.lanes[node.id]));
  state.ledger=ready.map(node=>({id:node.id,title:describeNode(ledgerApi,repoRoot,node),inputRef:node.path,
    kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[],
    lane:[...(state.lanes[node.id]?.lane??[])]}));
  const taken=new Set(),opOfNode=new Map();
  for(const node of launchable)opOfNode.set(node.id,workOpId(node.id,taken));
  state.ops=[...launchable.map((node,index)=>deriveWorkOp(ledgerApi,at,node,
    {id:opOfNode.get(node.id),opOfNode,index,lane:state.lanes[node.id]?.lane??null,done:[],loaded})),
    ...intake.map((raw,index)=>{const op=toOp(raw,launchable.length+index);op.intake=raw.intake;op.difficulty='hard';return op;})];
  for(const op of state.ops.filter(item=>item.intake))store.appendEvent({event:'intake-planned',op:op.id,scope:op.intake.scope,kind:op.kind,allowlist:op.allowlist});
  for(const op of state.ops)locateSharedTreePaths(op,{work:{shared:binding.sharedLedger,ledger:{repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot}}});
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Work operation ids are not unique');
  const assessed=typeof assessGoal==='function'?assessGoal({job:state.job,inputs:state.inputs,
    ledger:state.ledger.map(item=>({id:item.id,kind:item.kind,title:item.title,module:item.module})),
    constraints:[
      `the ledger is the authored Work tree under ${slash(binding.ledgerRoot)} and is not yours to change`,
      ...(binding.sharedLedger?[`that tree is owned by ${binding.ownerRepository??slash(binding.ownerRepoRoot)}, not by this repository: the code is written here and the Work is recorded there`]:[]),
      `every op runs in the one worktree ${slash(state.worktree)} on branch ${state.branch} under the node's own allowlist`,
      ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)],providers,cwd,runHeadless}):null;
  if(assessed?.ok){
    state.definitionOfDone=[...(assessed.value.definitionOfDone??[])];
    // Difficulty x model capability: the assessment rates every node; the allocator routes by tier inside the quota.
    const rated=new Map((assessed.value.difficulty??[]).map(item=>[item.op,item.level]));
    for(const op of state.ops){op.difficulty=rated.get(op.id)??rated.get(op.nodeId)??op.difficulty??'medium';}
    state.risks=[...(assessed.value.risks??[])];
    state.questions=[...(assessed.value.questions??[])];
  }else{
    // The TODO list is a fact of the tree, so a model that cannot answer does not block the goal: the
    // definition of done falls back to the ledger itself and the failure is recorded as such.
    state.definitionOfDone=state.ledger.map(item=>`\`${item.id}\` is done with checks the kernel re-ran itself`);
    state.questions=incomplete.map(node=>`${node.id}: ${node.reason}`);
    store.appendEvent({event:'goal-assessment-failed',reason:assessed?.reason??'assessGoal was not available',attempts:assessed?.attempts?.length??0});
  }
  // The critique runs whether or not the assessment answered: the job text is the goal, and the records the
  // product already accepted are what it is challenged against. An unanswered critique is an event, never a stop.
  critiqueGoalPhase(store,state,{critiqueGoal,providers,cwd,runHeadless,
    ledger:state.ledger.map(item=>({id:item.id,kind:item.kind,title:item.title})),
    decisions:state.decisions.map(item=>({id:item.id,kind:item.kind,title:item.title})),
    records:decidedRecords(ledgerApi,at,loaded,{scope:state.scope}),
    constraints:[
      `the ledger is the authored Work tree under ${slash(binding.ledgerRoot)}: the goal may not add, drop or rewrite a node, so an objection to the ledger is an objection to the scope of this goal`,
      `the Work tree ${loaded.ok?'validates':'does NOT validate'}, and ${state.ledgerSummary?.eligible??0} of ${state.ledgerSummary?.total??0} nodes in scope are eligible`,
      ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)]});
  planCritiquePrerequisites(store,state,{loaded,workRoot:binding.ledgerRoot,repositories,
    ctx:{work:{shared:binding.sharedLedger,ledger:{repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot}}}});
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Work operation ids are not unique');
  writeJson(store.paths.goalJson,{schema:GOAL_RECORD,id:state.id,job:state.job,inputs:state.inputs,
    ledgerMode:state.ledgerMode,scope:state.scope,workRoot:slash(loaded.workRoot),ledgerValid:loaded.ok,
    ledgerSource:binding.source,ledgerShared:binding.sharedLedger,ledgerOwner:state.ledgerOwner,codeRepository:repository,codeSide:binding.side??null,
    definitionOfDone:state.definitionOfDone,risks:state.risks,questions:state.questions,critique:state.critique??null,
    ledger:state.ledger,decisions:state.decisions,ledgerSummary:state.ledgerSummary,brand:state.brand??null,
    lanes:Object.fromEntries(Object.entries(state.lanes??{}).map(([node,entry])=>[node,[...entry.lane]])),
    ops:state.ops.map(op=>({id:op.id,nodeId:op.nodeId,kind:op.kind,goal:op.goal,ledgerIds:op.ledgerIds,
      allowlist:op.allowlist,references:op.references,checks:op.checks,acceptance:op.acceptance,dependsOn:op.dependsOn})),
    gates:state.gates,needUser:state.needUser,assessedBy:assessed?.provider??null});
  fs.writeFileSync(store.paths.goal,workGoalMarkdown(state,loaded));
  state.phase='awaiting-approval';
  store.appendEvent({event:'goal',ledgerMode:state.ledgerMode,scope:state.scope,ops:state.ops.length,
    ledger:state.ledger.length,decisions:state.decisions.length,incomplete:incomplete.length,gates:state.gates.length});
  store.saveState(state);
  return {ok:true,id:state.id,ledgerMode:state.ledgerMode,goal:store.paths.goal,goalJson:store.paths.goalJson,
    ops:state.ops.length,ledger:state.ledger.length,decisions:state.decisions.length,
    incomplete:incomplete.map(node=>node.id),needUser:state.needUser,gates:state.gates.length,
    ledgerRoot:slash(binding.ledgerRoot),ledgerSource:binding.source,ledgerShared:binding.sharedLedger,
    ledgerOwner:binding.sharedLedger?(binding.ownerRepository??slash(binding.ownerRepoRoot)):null,
    next:`review ${slash(store.paths.goal)} and approve with workflow-approve --id ${state.id}`};
}

/** goal.md in ledger mode: the nodes the kernel will execute, as the TODO the user approves. */
function workGoalMarkdown(state,loaded){
  const overlaps=[];
  for(const [index,op] of state.ops.entries())for(const other of state.ops.slice(index+1))
    if(!work.disjoint(op.allowlist,other.allowlist))overlaps.push(`\`${op.id}\` and \`${other.id}\` share paths, so they never run at the same time`);
  const lines=[`# ${state.job}`,``,
    `Workflow \`${state.id}\` - branch \`${state.branch}\` - ledger \`work\` (${slash(loaded.workRoot)})`,
    ...(state.ledgerShared?[``,`The Work tree is owned by \`${state.ledgerOwner?.repository??slash(state.ledgerOwner?.repoRoot??'')}\`, not by this repository: code is written and committed in \`${slash(state.worktree)}\`, and every Work record is written and committed in the owner.`]:[]),
    `Scope: ${state.scope.length?state.scope.map(item=>`\`${item}\``).join(', '):'the whole Work tree'}. `+
    `The Work tree ${loaded.ok?'validates':'does NOT validate'}; ${state.ledgerSummary?.eligible??0} of ${state.ledgerSummary?.total??0} nodes in scope are eligible.`,``,
    `## Definition of done`,``,...state.definitionOfDone.map((item,index)=>`${index+1}. ${item}`),``,
    `## Work nodes this workflow executes`,``,
    `Each node travels its lane: every step is one operation, and the node is recorded done only when the last`,
    `step is accepted. The lane is the template you approve here.`,``,
    `| op | node | kind | lane | module | checks | allowlist |`,`| --- | --- | --- | --- | --- | --- | --- |`];
  for(const op of state.ops){
    const item=ledgerItem(state,op.ledgerIds[0]);
    const entry=state.lanes?.[op.nodeId??''];
    const walked=laneWalked(entry);
    const lane=walked.length?`${laneText(walked)} (this op: step ${walked.indexOf(op.kind)+1} of ${walked.length})`:op.kind;
    lines.push(`| \`${op.id}\` | ${op.nodeId?`\`${op.nodeId}\``:op.intake?`intake of \`${op.intake.scope}\``:'-'} | ${item?.kind??'-'} | ${lane} | ${item?.module??'-'} | ${op.checks.length} | ${op.allowlist.map(entry=>`\`${entry}\``).join(', ')||'-'} |`);
  }
  if(state.decisions.length){
    lines.push(``,`## Decisions still open in scope`,``,`These are answered by a decision, not by an operation in a worktree.`,``);
    for(const decision of state.decisions)lines.push(`- \`${decision.id}\` (${decision.kind}) ${firstLine(decision.title)}`);
  }
  const incomplete=state.needUser.filter(item=>item.kind==='ledger');
  if(incomplete.length){
    lines.push(``,`## Needs you first`,``,
      `A node whose record declares no write scope or no check cannot be launched. The kernel creates one`,
      `\`work.author\` operation per such node - whose only write scope is that node's own \`index.yaml\` - and`,
      `comes back to you only if the record is still incomplete after that operation was accepted. Anything`,
      `listed here without a node id is yours from the start.`,``);
    for(const item of incomplete)lines.push(`- ${item.node?`\`${item.node}\` `:''}${item.detail}`);
  }
  if(overlaps.length)lines.push(``,`## Serialized by a shared allowlist`,``,...overlaps.map(item=>`- ${item}`));
  const proposal=state.quotaProposal??proposeQuota(state);
  lines.push(``,`## Runtime allocation (the user sets this at approval)`,``,`Proposed from the difficulty of the operations (${proposal.summary}). Approve with \`workflow-approve --id ${state.id} --allocation ${proposal.text}\` or pass your own order and slots.`,``,`| runtime | slots (ratio) | difficulty | why |`,`| --- | --- | --- | --- |`,...proposal.rows.map(row=>`| \`${row.runtime}\` | ${row.slots} | ${row.tags} | ${row.why} |`),``,`Slots are both the parallel cap and the fill ratio inside a difficulty tier (4:1 means four operations on the first runtime for one on the second); a runtime without a tag takes every difficulty.`);
  if(state.gates.length)lines.push(``,`## Job gates`,``,...state.gates.map(gate=>`- ${gate.name}: \`${gate.command}\``));
  for(const [heading,items] of [['Risks',state.risks],['Questions',state.questions]]){
    if(!items.length)continue;
    lines.push(``,`## ${heading}`,``,...items.map(item=>`- ${item}`));
  }
  return `${lines.join('\n')}\n`;
}

/** The one human gate of the runtime: nothing is launched until the plan is approved. */
/** The launch chain of one operation kind, in order, or nothing when the registry cannot resolve it. */
function chainTargets(kind){
  try{return resolveExecutionChain({skill:'starci',op:launchOperator(kind)}).candidates.map(candidate=>candidate.target);}catch{return [];}
}
/** The repository's shared runtime ledger as this workflow sees it; an unreadable one is simply nothing shared. */
function sharedLoadsOf(state){
  try{return readLoads({path:loadsFileFor(state.dir),workflow:state.id});}catch{return null;}
}
/** A quota proposal from the difficulty mix: hard/medium operations lean on the strongest runtimes, easy ones on the cheapest. The user always sets the final numbers. */
export function proposeQuota(state,{runtimes=null,shared=undefined}={}){
  const profile=runtimes??(()=>{try{return loadRuntimes();}catch{return null;}})();
  const ops=state.ops.filter(op=>op.status!=='done');
  const hard=ops.filter(op=>op.difficulty==='hard').length,easy=ops.filter(op=>op.difficulty==='easy').length,medium=ops.length-hard-easy;
  const total=Math.min(ops.length||1,profile?.maxParallelOps??10);
  const order=(profile?.allocation?.preference?.implement??['gpt-5.6-sol','claude-opus','qwen3.8-flash']).filter(id=>profile?.runtimes?.[id]);
  const weights=order.map((id,index)=>index===0?hard+medium*0.6+easy*0.2:index===1?hard*0.4+medium*0.4+easy*0.3:medium*0.2+easy*0.8);
  const sum=weights.reduce((a,b)=>a+b,0)||1;
  let rows=order.map((id,index)=>({runtime:id,slots:Math.max(index===0?1:0,Math.round(total*weights[index]/sum)),tags:index===0?'hard+medium':index===1?'hard+medium':'easy+medium',why:index===0?'strongest tier: hard and most medium operations':index===1?'second tier: medium operations and overflow':'cheapest tier: easy operations and overflow'}));
  const cap=id=>profile?.runtimes?.[id]?.maxParallel;
  rows=rows.map(row=>({...row,slots:Number.isFinite(cap(row.runtime))&&cap(row.runtime)>0?Math.min(row.slots,cap(row.runtime)):row.slots}));
  // Every role the plan needs has a runtime with a slot: a `work.author` op needs the plan role, and a proposal
  // that gave its only slot to a runtime without it left a workflow stalled at its first tick.
  const rolesOf=id=>Array.isArray(profile?.runtimes?.[id]?.roles)?profile.runtimes[id].roles:[];
  for(const role of unique(ops.map(op=>kindRole(op.kind)).filter(Boolean))){
    if(rows.some(row=>row.slots>0&&rolesOf(row.runtime).includes(role)))continue;
    const able=rows.find(row=>rolesOf(row.runtime).includes(role));
    if(able){able.slots=Math.max(1,able.slots);able.why=`${able.why}; the only proposed runtime with the ${role} role`;continue;}
    const id=Object.keys(profile?.runtimes??{}).find(candidate=>rolesOf(candidate).includes(role));
    if(id)rows.push({runtime:id,slots:1,tags:'hard+medium',why:`the ${role} role: no runtime in the preference order has it`});
  }
  // ... and every kind's launch chain: a kind whose chain is [fable, astra] cannot run on a quota that names
  // only Sol, Opus and Qwen, whatever their roles. The first runtime of the chain gets a slot.
  for(const kind of unique(ops.map(op=>op.kind).filter(Boolean))){
    const targets=chainTargets(kind);
    if(!targets.length||rows.some(row=>row.slots>0&&targets.includes(row.runtime)))continue;
    const row=rows.find(item=>targets.includes(item.runtime));
    if(row){row.slots=Math.max(1,row.slots);row.why=`${row.why}; in the launch chain of ${kind}`;continue;}
    rows.push({runtime:targets[0],slots:1,tags:'hard+medium',why:`first of the launch chain of ${kind}`});
  }
  // ... and what the other workflows of this repository are already on: when the first runtime of a kind's chain
  // carries another kernel's operations, the next chain runtime that has the role is proposed a slot as well, so a
  // lane opened while another lane is on Fable proposes Astra without the owner having to say it.
  const outside=shared===undefined?sharedLoadsOf(state):plain(shared)?shared:null;
  for(const kind of unique(ops.map(op=>op.kind).filter(Boolean))){
    const targets=chainTargets(kind);
    const first=targets[0];
    const holder=first?(outside?.ops?.[first]??[])[0]?.workflow??null:null;
    if(!holder)continue;
    const role=kindRole(kind);
    const next=targets.slice(1).find(id=>profile?.runtimes?.[id]&&(!role||rolesOf(id).includes(role)));
    if(!next)continue;
    const row=rows.find(item=>item.runtime===next);
    if(row){row.slots=Math.max(1,row.slots);row.why=`${row.why}; ${first} is busy with ${holder}`;continue;}
    rows.push({runtime:next,slots:1,tags:'hard+medium',why:`next in the launch chain of ${kind}: ${first} is busy with ${holder}`});
  }
  const text=rows.map(row=>`${row.runtime}=${row.slots}:${row.tags}`).join(',');
  const proposal={rows,text,summary:`${hard} hard, ${medium} medium, ${easy} easy of ${ops.length} operations; up to ${total} in parallel`};
  state.quotaProposal=proposal;
  return proposal;
}

export function approve(store,state,{allocation=null,allowDynamic=null,acceptCritique=null}={}){
  // A goal the critique refused is not approvable as it stands: either the question is answered and the goal is
  // written again, or the owner overrides the critique on the record. An override is the owner's own decision, so
  // it is taken once and never asked for again.
  const refused=state.critique?.verdict==='refuse'&&!plain(state.critiqueOverride);
  const accepted=String(acceptCritique??'').trim();
  if(refused){
    need(accepted,`The critique of goal ${state.id} returned \`refuse\`: ${state.critique.question??'it named no question'} `+
      `Answer that and run workflow-goal again, or accept the critique with workflow-approve --id ${state.id} --accept-critique "<reason>".`);
    state.critiqueOverride={reason:accepted,at:Date.now()};
    store.appendEvent({event:'critique-overridden',reason:accepted,question:state.critique.question??null,
      objections:(state.critique.objections??[]).length});
    noteCritiqueInGoal(store,state);
  }
  if(allocation)state.quota=parseQuota(allocation);
  // `--allow-dynamic N` is the user raising the run-time op budget; ops the gate refused are reinstated with it.
  if(allowDynamic!==null&&allowDynamic!==undefined&&String(allowDynamic).trim()){
    const budget=Number(allowDynamic);
    need(Number.isInteger(budget)&&budget>=0,`--allow-dynamic takes a non-negative integer (0 forbids run-time ops): ${allowDynamic}`);
    const raised=budget>dynamicBudget(state);
    state.dynamicOpsBudget=budget;
    if(raised){
      for(const op of state.ops.filter(item=>item.status==='blocked'&&item.refusal==='dynamic-op')){op.status='pending';op.refusal=null;}
      state.needUser=state.needUser.filter(item=>item.kind!=='dynamic-op');
    }
  }
  // A workflow that finished `blocked` stopped for the user's decision; the user approving it again IS that
  // decision, so the finish is cleared and the supervisor starts a kernel that carries on from where it stopped.
  if(state.finished&&state.finished.outcome==='blocked'&&state.approved){
    const before=state.finished;
    state.finished=null;state.phase='run';state.stalls=0;state.stalledSince=null;state.kernelErrors=0;
    // The ops a limit exhausted - the validator's rejections, the launch attempts, the restarts, a stall - are the
    // items the policy could not settle, and the owner approving again says: try them again. Their counters start
    // over and their questions go; an op the kernel refused on principle (superseded, out of the repository, a
    // dynamic op over budget) stays refused, because approving again does not change what it was refused for.
    const readmitted=[];
    for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal)){
      op.status='ready';op.validatorRejects=0;op.launchFailures=0;op.restarts=0;op.dispatch=null;op.terminal=null;op.nudged=false;
      state.needUser=state.needUser.filter(entry=>!(entry.op===op.id&&['validator','environment','restart','stall'].includes(entry.kind)));
      readmitted.push(op.id);
    }
    store.appendEvent({event:'resumed-after-block',reason:before.reason??null,budget:dynamicBudget(state),readmitted});
    for(const id of readmitted)store.appendEvent({event:'op-readmitted',op:id,reason:'the owner approved the workflow again after it finished blocked'});
  }
  // The user sets the runtime allocation at approval; without --allocation the proposal from goal.md is used and recorded.
  if(!state.quota){const proposal=state.quotaProposal??proposeQuota(state);state.quota=parseQuota(proposal.text);state.quotaSource='proposal';}else state.quotaSource=allocation?'user':state.quotaSource??'user';
  // On the Work ledger a plan may legitimately start with no operation: every candidate in scope declares an
  // incomplete record, and the first ledger sync turns each of those into one `work.author` op. Anything else
  // with no operation is an empty plan and stays unapprovable.
  const toAuthor=state.ledgerMode===WORK_LEDGER?state.needUser.filter(item=>item.kind==='ledger'&&item.node).length:0;
  need(state.ops.length||toAuthor,`Workflow ${state.id} has no plan to approve; run workflow-goal first`);
  state.approved=true;
  if(state.phase!=='finished')state.phase='run';
  store.appendEvent({event:'approved',ops:state.ops.length,toAuthor,quota:state.quota,dynamicOpsBudget:dynamicBudget(state),
    critique:state.critique?.verdict??null});
  store.saveState(state);
  return {ok:true,id:state.id,phase:state.phase,approved:true,ops:state.ops.length,ledger:state.ledger.length,
    quota:state.quota,dynamicOpsBudget:dynamicBudget(state),
    ...(plain(state.critique)?{critique:critiqueView(state)}:{})};
}

/* ------------------------------------------------------------------ contract */

/**
 * The operation contract. The kernel owns every concrete value (goal, ledger items, allowlist, acceptance,
 * checks, report command); the process prose - cook until done, the mandatory ping, the never list - is
 * reused from docs/supervision-templates/op.md so one template serves every operation kind.
 */
/** Job-wide rulings the user gave at approval time (`<store>/rulings.md`) travel inside every contract and in the validator memory. */
function rulingsText(store){
  const file=path.join(store.dir,'rulings.md');
  if(!fs.existsSync(file))return '';
  return fs.readFileSync(file,'utf8').trim();
}
function jobRulings(store){
  const body=rulingsText(store);
  return body?[`## Job rulings (apply to every operation)`,body,``]:[];
}

/**
 * The lane line of a contract: the template this operation's node travels and which step this operation is.
 * An operation that belongs to no lane (a plan-ledger op, a shared change, a gate repair) gets no line.
 */
export function laneLine(state,op){
  const entry=laneEntryOf(state,op);
  if(!entry?.lane?.length)return null;
  // An author op is no step of the lane: it is what makes the lane launchable, so it is named as preceding it.
  const walked=laneWalked(entry);
  if(op?.kind===AUTHOR_KIND)return `Lane: this op precedes ${laneText(walked)}, which the kernel launches itself once this record is complete`;
  const at=walked.indexOf(op.kind);
  return `Lane: ${laneText(walked)} (this op: step ${at<0?(entry.done??[]).length+1:at+1} of ${walked.length})`;
}

/**
 * The brand, in the contract of every operation that may draw, build or judge a surface. It is short on
 * purpose - the identity, the rev and where the artwork is - because the record itself is in the references
 * right above it: the block exists so no design operation can claim it did not know the brand was there.
 */
function brandBlock(op,brand){
  if(!plain(brand)||!DESIGN_KINDS.includes(op.kind))return [];
  return [`## Brand`,
    `- name: ${brand.name??'(unnamed)'} - family: ${brand.family??'-'} - rev: ${brand.rev??'-'}`,
    ...(brand.file?[`- record: \`${brand.file}\``]:[]),
    ...(brand.mascotAssets?.length?brand.mascotAssets.map(entry=>`- mascot/logo: \`${entry}\``):[`- no mascot or logo asset is declared`]),
    `Every colour, font, icon and illustration you produce comes from this record and the installed grammar; you never invent one beside them.`,``];
}

/**
 * What the critique of the goal demanded, in the contract of every operation of that goal. A `revise` verdict is
 * not advice the kernel filed away: the changes the critic required are part of the goal the user approved, so
 * they travel under the goal of every op and bind it as the goal itself does. Any other verdict renders nothing.
 */
function critiqueBlock(critique){
  const required=critique?.verdict==='revise'?(critique.required??[]).map(item=>firstLine(item)).filter(Boolean):[];
  if(!required.length)return [];
  return [`## Goal critique - required`,...required.map(item=>`- ${item}`),
    `The critique of this workflow's goal returned \`revise\`: these changes are part of the goal the user approved and bind this operation exactly as the goal above does.`,``];
}

export function renderContract({template,op,state,store,launcher=state.launcher,run=state.run,
  guards=kernelGuards,protectedPaths=null,brand=state.brand??null,critique=state.critique??null}){
  const text=String(template??'');
  for(const heading of ['## Cook until done','## Ping (mandatory)','## Never'])
    need(text.includes(heading),`The operation template has no "${heading}" section`);
  const afterCook=text.split('## Cook until done')[1];
  const cook=`## Cook until done${afterCook.split('## Never')[0]}`.replace(/\s+$/,'');
  const never=`## Never${text.split('## Never')[1]}`.replace(/\s+$/,'');
  const checksFile=slash(store.checksPath(op.id));
  const reportsDir=slash(store.paths.reports);
  const items=(op.ledgerIds??[]).map(id=>{const item=ledgerItem(state,id);return `- \`${id}\` ${item?.title??'(unknown goal item)'}${item?.inputRef?` - ${item.inputRef}`:''}`;});
  const locks=guards.resourceLocks(op);
  const owned=protectedPaths??op.kernelOwned??[];
  const sections=[
    `# Operation contract - \`${op.kind}\` - op \`${op.id}\` - attempt ${op.attempt}`,``,
    `Runtime StarCi 5.0. One worktree \`${slash(state.worktree)}\` on branch \`${state.branch}\`. Other operations are running beside you in this same worktree: never touch a path outside your allowlist, never commit, never switch branches. Your Task id, Dispatch id and terminal handle are in the dispatch preamble.`,``,
    ...(laneLine(state,op)?[laneLine(state,op),``]:[]),
    `## Goal`,op.goal,``,
    ...critiqueBlock(critique),
    ...(op.nodeId?(op.kind===AUTHOR_KIND
      ?[`## Work node you author`,`- \`${op.nodeId}\` - you complete this record so the kernel can launch the node's own work; you do not do that work. Its \`index.yaml\` is in your allowlist, and inside that file \`${RECORD_OWNED.join('`, `')}\` stay the kernel's: it reads them back, reverts the file if they moved and downgrades your report to \`failed\`. Never edit another node's \`index.yaml\`.`,``]
      :[`## Work node you close`,`- \`${op.nodeId}\` - the kernel writes its \`state\`, \`completion\` and evidence itself after it has reproduced your checks. Never edit a Work \`index.yaml\` unless it is in your allowlist.`,``]):[]),
    ...(items.length?[`## Goal items you close`,...items,``]:[]),
    `## Allowlist`,...op.allowlist.map(entry=>`- \`${entry}\``),
    `Anything else is out of scope. Name the exact paths you need in \`open[]\`, or report \`blocked\` with \`shared-change\` and the exact repository paths in the detail - a \`shared-change\` that names no path is sent straight back to you.`,``,
    ...(owned.length?[`## Never touch (kernel-owned)`,...owned.map(entry=>`- \`${entry}\``),
      `The kernel owns the node's \`state\`, \`completion\`, \`extensions.work3.kernel\` and its evidence. It reverts anything you write here and downgrades your report to \`failed\`.`,``]:[]),
    `## Resources`,...(locks.length?locks.map(entry=>`- \`${entry}\``):['- none: this operation claims no shared resource']),
    `Two operations that share a resource never run at the same time; never start, stop or reset one you did not declare.`,``,
    `## References`,...(op.references.length?op.references.map(entry=>`- ${entry}`):['- the goal and the allowlist above']),``,
    ...brandBlock(op,brand),
    ...(op.priorOpen.length?[`## Open items you inherit`,...op.priorOpen.map(item=>`- ${item}`),``]:[]),
    ...(op.findings.length?[`## Findings you must resolve`,...op.findings.map(item=>`- ${typeof item==='string'?item:JSON.stringify(item)}`),``]:[]),
    `## Acceptance`,...(op.acceptance.length?op.acceptance.map((item,index)=>`${index+1}. ${item}`):['1. the goal above holds']),``,
    stepsFor(op,{node:op.nodeId?state.ledger.find(item=>item.nodeId===op.nodeId)??null:null}),``,
    ...jobRulings(store),
    cook,``,
    `## Checks to run`,...(op.checks.length?op.checks.map(check=>`- ${check.name}: \`${check.command}\``):['- none were declared: run the checks this code already has and record them']),
    `Record every command with its exit code in \`${checksFile}\` as a JSON array \`[{"name","command","exitCode","evidence"}]\`.`,
    `The kernel re-runs these exact commands itself after your report and computes your changed files from git: a \`done\` the machine cannot reproduce is downgraded to \`failed\` and comes back to you.`,``,
    `## Report (exactly once, at the end)`,
    `\`node ${launcher} report --run ${run} --from <your terminal> --task <op task> --dispatch <your dispatch> --reports-dir ${reportsDir} --outcome done|partial|failed|ask|blocked --summary "<what you did, what the checks showed, what is left>" --files <comma-separated changed paths> --checks-file ${checksFile} [--open "<item>,<item>"] [--question "<text>" --options "a,b"] [--blocker shared-change|sds-gap|interface-gap|brand-gap|grammar-gap|environment|authority:<detail>]\``,
    `- \`done\` needs every check exiting 0 and no open item; otherwise report \`partial\` (with \`--open\`) or \`failed\`.`,
    `- \`ask\` pauses you until the kernel answers in this terminal; then continue and report again.`,
    `- The command must print \`ok:true\`. Never report twice; never exit without reporting.`,``,
    never
  ];
  const contract=`${sections.join('\n').replace(/\n{3,}/g,'\n\n')}\n`;
  need(!/<launcher>|<nested run>|<runtime dir>|<reports dir>/.test(contract),'The rendered contract still carries a template placeholder');
  return contract;
}

/* ------------------------------------------------------------------ kernel-owned paths */

/**
 * The ledger paths this kernel owns for an operation's node - its `index.yaml` (where `state`, `completion`
 * and `extensions.work3.kernel` live) and its `evidence/**`. An operation is granted one only when its own
 * allowlist names that exact file (an `architecture.decide` op authors the design body of its node), never
 * through a directory glob.
 */
export function kernelOwnedPaths(state,op,ctx){
  if(!ctx?.work||!op.nodeId)return [];
  // A ledger another repository owns is not in this worktree at all: an operation cannot write it here, so
  // there is no path here to protect and no fingerprint to take.
  if(ctx.work.shared)return [];
  const node=ctx.work.node(op.nodeId);
  if(!node)return [];
  const granted=(op.allowlist??[]).map(normalize);
  return unique(((ctx.guards??kernelGuards).protectedPaths(node,ctx.work.ledger?.repoRoot??ctx.work.repoRoot)??[]).map(normalize))
    .filter(file=>!granted.includes(file));
}

/** Content fingerprint of those paths: at acceptance the only pending change there must be the kernel's own. */
export function protectedFingerprint(root,paths=[]){
  const files=[];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true}))
    entry.isDirectory()?walk(path.join(dir,entry.name)):files.push(path.join(dir,entry.name));};
  for(const entry of paths){
    const target=path.join(root,allowRoot(entry));
    try{if(fs.statSync(target).isDirectory())walk(target);else files.push(target);}catch{files.push(target);}
  }
  return unique(files).sort().map(file=>{
    const name=normalize(path.relative(root,file));
    try{return `${name}:${crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')}`;}catch{return `${name}:absent`;}
  }).join('\n');
}

/**
 * Before any machine verification: revert what the operation wrote into the kernel's own ledger paths and
 * report it. A report that touched them is never accepted - it is downgraded to `failed` and comes back.
 */
/**
 * After an accepted done, files the operation left dirty outside every live allowlist are stray: they belong
 * to no running or paused operation, so they are reverted (tracked) or removed (untracked) and recorded as a
 * finding for the module review. Kernel-owned ledger paths are handled by guardKernelPaths, never here.
 */
function cleanStrayFiles(store,state,op,ctx){
  if(typeof ctx.git!=='function')return [];
  const shown=ctx.git('git',['status','--porcelain'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  const live=state.ops.filter(item=>['running','paused','answering','ready'].includes(item.status)&&item.id!==op.id).flatMap(item=>item.allowlist??[]);
  const ledger=/^\.starciwork\//;
  const entries=(shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>({code:line.slice(0,2),file:normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))}))
    .filter(entry=>!inside(entry.file,live)&&!inside(entry.file,op.kernelOwned??[])&&!ledger.test(entry.file)&&!entry.file.startsWith('.gitmounts/'));
  if(!entries.length)return [];
  const tracked=entries.filter(entry=>!entry.code.startsWith('??')).map(entry=>entry.file);
  const untracked=entries.filter(entry=>entry.code.startsWith('??')).map(entry=>entry.file);
  if(tracked.length)ctx.git('git',['checkout','--',...tracked],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  for(const file of untracked){try{fs.rmSync(path.join(state.worktree,file),{recursive:true,force:true});}catch{}}
  const finding=`operation ${op.id} left changes outside every live allowlist; the kernel reverted ${tracked.length} tracked and removed ${untracked.length} untracked path(s): ${[...tracked,...untracked].slice(0,12).join(', ')}`;
  op.strayFiles=[...tracked,...untracked];
  state.reviewFindings=[...(state.reviewFindings??[]),{op:op.id,finding}];
  store.appendEvent({event:'stray-files-reverted',op:op.id,tracked,untracked});
  return op.strayFiles;
}

/**
 * Untracked paths under the Work tree that no live operation's allowlist covers were left by an operation that
 * was never accepted (settled, blocked, out of repository): the owner kernel removes them, so a kernel sharing
 * the tree never has to step around them. Tracked changes and kernel-owned records are never touched here.
 */
/**
 * An invalid tree whose every error sits under an untracked path that no live operation owns is not the
 * owner's problem to untangle: an abandoned operation left those files (a settled intake once left half a
 * feature in the base worktree and every backend op failed `work-valid` for an hour). They are moved, whole,
 * to `<store>/strays/<timestamp>/` - kept for the owner, out of the tree - and the tree is read again.
 * Tracked files are never touched; a stray inside a live op's allowlist is that op's, and stays.
 */
function quarantineStrays(store,state,ctx,loaded){
  if(!ctx.work||ctx.work.shared||typeof ctx.git!=='function'||!Array.isArray(loaded?.errors)||!loaded.errors.length)return [];
  const root=ctx.work.ledger?.repoRoot??ctx.work.repoRoot??state.worktree;
  const shown=ctx.git('git',['status','--porcelain','--','.starciwork'],{cwd:root,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  const untracked=(shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(line=>line.startsWith('??'))
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))).filter(file=>file.startsWith('.starciwork/')&&!/(^|\/)_local\//.test(file));
  if(!untracked.length)return [];
  const live=state.ops.filter(item=>liveStatus.includes(item.status)).flatMap(item=>item.allowlist??[]).map(normalize);
  const treePaths=loaded.errors.map(error=>normalize(`.starciwork/${String(error.path??'')}`));
  const owns=(stray,file)=>file===stray||file.startsWith(stray.endsWith('/')?stray:`${stray}/`);
  // Every error must sit under a stray nobody owns; one error on a tracked or owned path and nothing moves.
  const culprits=unique(treePaths.map(file=>untracked.find(stray=>owns(stray,file))).filter(Boolean));
  if(!culprits.length||culprits.length!==unique(treePaths.map(file=>untracked.find(stray=>owns(stray,file))??'∅')).length)return [];
  if(culprits.some(stray=>inside(stray,live)))return [];
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const moved=[];
  for(const stray of culprits){
    const from=path.join(root,stray),to=path.join(store.dir,'strays',stamp,stray);
    try{
      fs.mkdirSync(path.dirname(to),{recursive:true});
      // The store may live on another drive than the worktree (an Orca worktree on C:, the repository on D:):
      // a rename cannot cross drives, a copy followed by the removal can.
      try{fs.renameSync(from,to);}catch(error){if(error?.code!=='EXDEV')throw error;fs.cpSync(from,to,{recursive:true});fs.rmSync(from,{recursive:true,force:true});}
      moved.push({from:stray,to:slash(to)});
    }catch(error){store.appendEvent({event:'stray-quarantine-failed',path:stray,reason:String(error?.message??error)});}
  }
  if(moved.length)store.appendEvent({event:'stray-quarantined',strays:moved,errors:loaded.errors.slice(0,5).map(error=>`${error.code} ${error.path??''}`)});
  return moved;
}
function sweepTreeStrays(store,state,ctx){
  if(!ctx.work||ctx.work.shared||typeof ctx.git!=='function')return [];
  const shown=ctx.git('git',['status','--porcelain','--','.starciwork'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  // Only what a known, no-longer-live operation could have left is swept: an untracked path inside the allowlist of
  // a blocked or settled op. A path no op ever owned may be a person's draft and is left where it is.
  const live=state.ops.filter(item=>['running','paused','answering','ready','pending'].includes(item.status)).flatMap(item=>item.allowlist??[]);
  const abandoned=state.ops.filter(item=>['blocked','ready','pending'].includes(item.status)&&!item.dispatch).flatMap(item=>item.allowlist??[]);
  const owned=/(?:^|\/)(?:evidence|_local)\/|(?:^|\/)index\.ya?ml$/;
  const strays=(shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(line=>line.startsWith('??'))
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,'')))
    .filter(file=>file.startsWith('.starciwork/')&&!owned.test(file)&&!inside(file,live)&&inside(file,abandoned));
  for(const file of strays){try{fs.rmSync(path.join(state.worktree,file),{recursive:true,force:true});}catch{}}
  if(strays.length)store.appendEvent({event:'tree-strays-removed',strays});
  return strays;
}

function guardKernelPaths(store,state,op,ctx){
  const paths=op.kernelOwned??[];
  if(!paths.length)return [];
  const root=ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree;
  if(protectedFingerprint(root,paths)===(op.kernelOwnedAt??''))return [];
  const result=ctx.guards.gitQueue(()=>ctx.guards.revertProtected(ctx.git,{cwd:state.worktree,paths}))??{};
  const reverted=unique([...(result.reverted??[]),...(result.removed??[])]).map(normalize);
  op.kernelOwnedAt=protectedFingerprint(root,paths);
  const touched=reverted.length?reverted:paths;
  store.appendEvent({event:'kernel-paths-modified',op:op.id,node:op.nodeId,paths:touched,reverted,protected:paths});
  return touched;
}

/** The kernel-owned blocks of one node's record, as one comparable string; `null` when the record cannot be read. */
function recordBlocks(ctx,nodeId){
  if(!ctx?.work||!nodeId||typeof ctx.work.api.readNode!=='function')return null;
  const node=ctx.work.node(nodeId);
  if(!node)return null;
  try{
    const raw=ctx.work.api.readNode(ctx.work.at,node);
    return JSON.stringify({state:raw?.state??null,completion:raw?.completion??null,
      kernel:raw?.extensions?.work3?.kernel??null});
  }catch{return null;}
}

/**
 * `work.author` is the one kind whose allowlist names its own node's `index.yaml`, so that file cannot be
 * protected as a whole - the op exists to write it. What stays the kernel's is protected inside it instead:
 * `state`, `completion` and `extensions.work3.kernel` are read back and compared with the snapshot taken at
 * launch. A changed block is reverted with the rest of the file and the report is not accepted, exactly as a
 * written kernel path is for any other op: a completion an agent writes itself is a claim, not a record.
 */
function guardRecordBlocks(store,state,op,ctx){
  if(op.kind!==AUTHOR_KIND||typeof op.recordBlocks!=='string')return [];
  const now=recordBlocks(ctx,op.nodeId);
  if(now===null||now===op.recordBlocks)return [];
  const paths=op.allowlist??[];
  const cwd=ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree;
  const result=ctx.guards.gitQueue(()=>ctx.guards.revertProtected(ctx.git,{cwd,paths}))??{};
  op.recordBlocks=recordBlocks(ctx,op.nodeId)??op.recordBlocks;
  const reverted=unique([...(result.reverted??[]),...(result.removed??[])]).map(normalize);
  const touched=reverted.length?reverted:paths;
  store.appendEvent({event:'record-blocks-modified',op:op.id,node:op.nodeId,blocks:RECORD_OWNED,paths:touched,reverted});
  return touched;
}

/* ------------------------------------------------------------------ launch */

/**
 * 5.0 has no provider chain: the allocator names exactly one runtime, so the launcher must try exactly one
 * candidate. `startOperation({candidates})` is that seam - the launcher takes the resolved selection instead
 * of resolving a chain - so nothing here has to pretend a target was unavailable. The allocated target is
 * still proven to belong to the operation's declared environments first, and the request is rebuilt from the
 * candidate alone so a mismatch is caught before any Orca effect. Why the other targets were not used is
 * recorded in the kernel's own `launched` event (`allocation`), never as a fake launcher attempt.
 */
export function launchWithCandidate(orca,{cwd,run,workflowTask,from,worktree,operation,scope,spec,candidate,runtime=null,wait,build=buildOperationLaunch,start=startOperation}){
  const input={run,workflowTask,from,worktree,operation,scope,spec};
  const target=required(candidate?.target,'allocated runtime target');
  const chain=build(input).candidates.map(item=>item.selection.target);
  need(chain.includes(target),`The allocated target ${target} is not in the ${operation} chain (${chain.join(', ')})`);
  const notAllocated=chain.filter(item=>item!==target);
  const request=build({...input,candidates:[candidate]});
  need(request.candidates.length===1,`The allocated candidate list built ${request.candidates.length} candidates`);
  need(JSON.stringify(request.candidates[0].selection)===JSON.stringify(candidate),
    `The built candidate is not the allocated one: ${request.candidates[0].selection.target}`);
  const launched=start(input,{orca,wait,candidates:[candidate]});
  return {...launched,allocation:{runtime,target,notAllocated,
    reason:'the runtime allocator assigned this operation to one runtime; the launcher was handed that candidate alone'}};
}

function launchOp(orca,store,state,op,allocated,ctx){
  if(op.needsReplan)replanOp(store,state,op,ctx);
  // A design operation derived before the brand was decided gets the record now: its references are the material
  // it must read, and by launch time that material exists.
  if(DESIGN_KINDS.includes(op.kind)){
    const brand=brandReferencesOf(ctx.work?.api,ctx.work?.loaded);
    if(brand.length)op.references=unique([...op.references,...brand]);
  }
  op.kernelOwned=kernelOwnedPaths(state,op,ctx);
  const contract=renderContract({template:ctx.template,op,state,store,guards:ctx.guards,protectedPaths:op.kernelOwned});
  fs.writeFileSync(store.contractPath(op.id),contract);
  op.contractFile=store.contractPath(op.id);
  const relative=path.relative(process.cwd(),state.worktree)||'.';
  // A launch that throws - Orca unreachable, a spec the command line cannot carry - is a failed launch, never the
  // end of the kernel: the op records it, avoids the runtime, and the loop goes on.
  let launched;
  try{
    launched=ctx.launch(orca,{cwd:state.worktree,run:state.run,workflowTask:state.workflowTask??state.id,from:state.from,
      worktree:relative,operation:launchOperator(op.kind),kind:op.kind,scope:op.id,spec:operationSpec(op,contract),candidate:allocated.candidate,runtime:allocated.runtime,wait:ctx.wait});
  }catch(error){
    launched={ok:false,stopReason:String(error?.message??error).slice(0,300),attempts:[{target:allocated.target,stage:'launch',effectState:'threw',reason:String(error?.message??error).slice(0,240)}]};
  }
  op.launch={ok:Boolean(launched?.ok),target:launched?.selection?.target??allocated.target,
    task:launched?.task?.id??null,dispatch:launched?.dispatchId??null,stopReason:launched?.stopReason??null};
  if(!launched?.ok){
    op.launchFailures+=1;
    ctx.allocator.failed(allocated.runtime,{reason:launched?.stopReason??'launch failed',op:op.id});
    op.avoidRuntimes=unique([...op.avoidRuntimes,allocated.runtime]);
    // The attempts travel with the event: a launch that failed is only diagnosable from what Orca said at each step.
    store.appendEvent({event:'launch-failed',op:op.id,runtime:allocated.runtime,stopReason:launched?.stopReason??null,attempts:launched?.attempts?.length??0,
      detail:(launched?.attempts??[]).slice(0,4).map(attempt=>({target:attempt.target??null,stage:attempt.stage??null,effectState:attempt.effectState??null,reason:String(attempt.reason??'').slice(0,240)}))});
    if(op.launchFailures>=LAUNCH_LIMIT){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'environment',detail:`no runtime could launch ${op.id} (${op.launchFailures} attempts, last ${launched?.stopReason??'unknown'})`});
    }
    return {ok:false,reason:launched?.stopReason??'launch failed'};
  }
  op.status='running';op.runtime=allocated.runtime;op.target=allocated.target;
  // The launch is what the other kernels of this repository must see: the allocation alone could still fail.
  ctx.allocator.launched?.(allocated.runtime,{op:op.id});
  if(!op.baseHead){const shown=ctx.git('git',['rev-parse','HEAD'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});op.baseHead=shown.status===0?(shown.stdout??'').trim():null;}
  op.task=launched.task.id;op.dispatch=launched.dispatchId;op.terminal=launched.terminal;op.nudged=false;
  // A launch is an external effect: the state that names it is written before anything else can interrupt the kernel.
  store.saveState(state);
  store.appendEvent({event:'launched',op:op.id,kind:op.kind,node:op.nodeId,attempt:op.attempt,runtime:op.runtime,target:op.target,
    dispatch:op.dispatch,terminal:op.terminal,allocation:launched.allocation??null});
  // Work v2 authors only uninvestigate, todo and done, so the launch is recorded in the node's kernel block.
  ledgerWrite(store,state,op,ctx,'in-progress',node=>ctx.work.api.markInProgress(ctx.work.at,node,{opId:op.id,dispatch:op.dispatch}));
  // The baseline is taken after the kernel's own in-progress write, so only the operation's edits are caught.
  op.kernelOwnedAt=op.kernelOwned.length?protectedFingerprint(ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree,op.kernelOwned):null;
  // An author op holds the whole record, so the file cannot be fingerprinted as a unit: the blocks inside it
  // that stay the kernel's are snapshotted instead, after the same in-progress write.
  if(op.kind===AUTHOR_KIND)op.recordBlocks=recordBlocks(ctx,op.nodeId);
  return {ok:true};
}

/** A blocked operation whose design gap was settled is planned again with the new material. */
function replanOp(store,state,op,ctx){
  const planned=ctx.planOp({node:{id:op.id,operation:op.kind,attempt:op.attempt,priorOpen:op.priorOpen,findings:op.findings},
    workflow:state.id,ownership:unique(state.ops.flatMap(item=>item.allowlist)),sdsMaterial:[],
    priorReports:op.reports,cwd:ctx.cwd});
  op.needsReplan=false;
  if(!planned?.ok){store.appendEvent({event:'replan-failed',op:op.id,attempts:planned?.attempts?.length??0});return false;}
  const plan=planned.value;
  op.goal=plan.goal??op.goal;
  op.allowlist=plan.allowlist?.length?plan.allowlist:op.allowlist;
  op.references=plan.references?.length?plan.references:op.references;
  op.checks=plan.checks?.length?plan.checks.map(check=>({name:check.name,command:check.command})):op.checks;
  op.acceptance=plan.acceptance?.length?plan.acceptance:op.acceptance;
  store.appendEvent({event:'replanned',op:op.id,allowlist:op.allowlist});
  return true;
}

/* ------------------------------------------------------------------ schedule */

/** The launchable targets of one operation kind, or null when the allocator cannot name them. */
function launchableFor(allocator,kind){
  if(typeof allocator.launchableTargets!=='function')return null;
  try{return allocator.launchableTargets(kind);}catch{return null;}
}

/**
 * The brand node of the tree: the one the brand record names, or the `brand` node the tree carries. A node
 * still `todo` is preferred, because that is the one a decision is owed.
 */
function brandNode(ctx){
  const loaded=ledgerAccess(ctx)?.loaded;
  if(!loaded)return null;
  const named=loaded.brand?.node?loaded.nodes?.get?.(loaded.brand.node)??null:null;
  if(named)return named;
  const list=loaded.list??[];
  return list.find(node=>node.kind===BRAND_KIND&&node.state==='todo')??list.find(node=>node.kind===BRAND_KIND)??null;
}
/**
 * The `brand.decide` operation: one per workflow, created the moment a design operation needs a brand record
 * the tree does not have. It is a decision - it authors the brand record and its assets, and its only check is
 * that the tree still validates afterwards - so it is created exactly the way the `sds-gap` route creates
 * `architecture.revise`, from the node the tree already carries. A tree that carries no brand node at all is
 * the one thing the kernel cannot invent: a brand is the product's identity, so it asks the user once.
 */
function ensureBrandDecide(store,state,ctx){
  const existing=state.ops.find(op=>op.kind===BRAND_DECIDE&&op.refusal!=='superseded');
  if(existing)return existing;
  const node=brandNode(ctx);
  if(!node){
    const detail='no brand record: author .starciwork/brand/index.yaml (a work.author or brand.decide op)';
    if(!state.needUser.some(item=>item.kind==='brand')){
      state.needUser.push({kind:'brand',detail});
      store.appendEvent({event:'brand-missing',detail});
    }
    return null;
  }
  const file=`.starciwork/${slash(node.path)}`;
  // The record and the folder around it: the assets a brand decision produces live beside the file it writes.
  const folder=`.starciwork/${slash(path.dirname(node.path))}/**`;
  const op=addOp(store,state,{id:nextId(state,'brand'),kind:BRAND_DECIDE,nodeId:node.id,
    goal:`Decide the brand in ${node.id}: the name, the design family, every colour token with the role it plays, the fonts, the mascot and logo assets, what is forbidden and the rules every imagery prompt must carry. Every design operation of this workflow is built and judged against this record.`,
    // No ledger item: a decision is not a slice of the goal, it is what the slices are measured against.
    ledgerIds:[],allowlist:unique([file,folder]),
    references:unique([node.path,...(node.refs??[]),...grammarReferences()]),
    checks:[{name:'work-tree-validates',command:workValidateCommand(ctx)}],
    acceptance:[`${node.id} records the brand: name, family, colour tokens with their roles, the mascot and logo assets, the forbidden list and the imagery prompt rules`,
      'the Work tree still validates'],origin:'ledger'},
    'a design operation cannot run before the brand is decided');
  op.difficulty='hard';
  store.appendEvent({event:'brand-decide-created',op:op.id,node:node.id,allowlist:op.allowlist});
  return op;
}
/**
 * A design-family operation reads the brand; without a brand record it would invent one, so it does not run.
 * The op waits behind the `brand.decide` operation this creates (and, if the tree carries no brand node, behind
 * the user) instead of being launched with nothing to read.
 */
function deferForBrand(store,state,op,ctx){
  if(!DESIGN_KINDS.includes(op.kind)||!brandAware(ctx)||brandOf(ctx))return false;
  const decide=ensureBrandDecide(store,state,ctx);
  if(decide&&decide.id!==op.id&&!op.dependsOn.includes(decide.id)){
    op.dependsOn=unique([...op.dependsOn,decide.id]);
    op.status='pending';
  }
  store.appendEvent({event:'schedule-deferred',op:op.id,reason:'brand missing',...(decide?{waitingFor:decide.id}:{})});
  return true;
}

function scheduleOps(orca,store,state,ctx){
  for(const op of state.ops){
    if(op.status!=='pending')continue;
    const dependencies=op.dependsOn.map(id=>byId(state,id));
    if(dependencies.some(dependency=>dependency&&['blocked','failed'].includes(dependency.status))){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} can never start: it depends on ${op.dependsOn.join(', ')}`});
      store.appendEvent({event:'op-blocked',op:op.id,reason:'dependency blocked'});
      continue;
    }
    if(dependencies.every(dependency=>!dependency||dependency.status==='done'))op.status='ready';
  }
  const launched=[];
  for(const op of state.ops.filter(item=>item.status==='ready')){
    const busy=state.ops.filter(item=>['running','answering'].includes(item.status));
    if(busy.length>=ctx.allocator.maxParallelOps)break;
    // A design operation on a tree with no brand record is not launched at all: the brand is decided first.
    if(deferForBrand(store,state,op,ctx))continue;
    // On the Work ledger the authored files decide parallelism, through the ledger's own prefix semantics.
    const overlaps=other=>ctx.work?!ctx.work.api.disjoint(other.allowlist,op.allowlist):allowlistsOverlap(other.allowlist,op.allowlist);
    if(busy.some(overlaps)){
      store.appendEvent({event:'schedule-deferred',op:op.id,reason:'allowlist overlaps a running operation'});
      continue;
    }
    // Declared and inferred resource locks (postgres, e2e-runtime, docker, cluster) are as serializing as paths.
    const clashing=busy.filter(other=>ctx.guards.resourcesClash(op,other));
    if(clashing.length){
      store.appendEvent({event:'schedule-deferred',op:op.id,reason:'resource lock clashes a running operation',
        resources:ctx.guards.resourceLocks(op),clashes:clashing.map(other=>other.id)});
      continue;
    }
    const avoid=unique([...op.avoidRuntimes,...avoidForVerify(state,op)]);
    // Allocation stays inside the targets this operation can actually launch, so a runtime whose role has
    // no profile for this operation is never chosen and then rejected.
    // The allocator is asked for the op's own kind (the graph knows its role); the launchable chain is the
    // operator registry's, so a lane kind it does not carry is resolved to its operator id first.
    if(foreignNodeOf(ctx,op)){
      op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
      store.appendEvent({event:'launch-refused',op:op.id,reason:'the node is delivered by another repository'});
      continue;
    }
    const allocated=ctx.allocator.allocate(op.kind,{avoid,restrictTo:launchableFor(ctx.allocator,launchOperator(op.kind)),difficulty:op.difficulty??null});
    if(!allocated?.ok){
      // Every runtime that could carry the op is on its own avoid list: the list has served its purpose (one restart
      // per runtime) and now only starves the op. It is cleared and the op gets one more round on any runtime;
      // past the restart limit that round is the user's call instead.
      const reason=String(allocated?.reason??'no runtime');
      const starved=op.avoidRuntimes.length&&/\(avoided\)/.test(reason)&&!/\(no free slot\)|\(cooling|\(budget|\(rate/.test(reason);
      if(starved){
        if(op.restarts>RESTART_LIMIT){op.status='blocked';state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} failed on every runtime that can run it (${op.avoidRuntimes.join(', ')}) after ${op.restarts} restarts`});store.appendEvent({event:'avoid-exhausted',op:op.id,avoid:op.avoidRuntimes});continue;}
        store.appendEvent({event:'avoid-reset',op:op.id,avoid:op.avoidRuntimes,restarts:op.restarts});
        op.avoidRuntimes=[];
      }
      store.appendEvent({event:'allocation-deferred',op:op.id,reason,avoid});continue;
    }
    // The shared view changed the choice: an equally capable runtime no other kernel is on took the operation.
    if(allocated.preferredOver?.length)store.appendEvent({event:'allocation-shared',op:op.id,runtime:allocated.runtime,
      preferredOver:allocated.preferredOver,sharedLoad:allocated.sharedLoad??{}});
    // The probed provider budget changed the choice: a runtime with clearly more of its window left took the operation.
    if(allocated.sparedOver?.length)store.appendEvent({event:'allocation-budgeted',op:op.id,runtime:allocated.runtime,
      sparedOver:allocated.sparedOver,remaining:allocated.budget??{}});
    let candidate=null;
    try{candidate=allocated.candidate??ctx.allocator.candidateFor(launchOperator(op.kind),allocated.target);}
    catch(error){
      ctx.allocator.failed(allocated.runtime,{reason:'not launchable',op:op.id});
      op.avoidRuntimes=unique([...op.avoidRuntimes,allocated.runtime]);
      store.appendEvent({event:'allocation-rejected',op:op.id,runtime:allocated.runtime,reason:error.message});
      continue;
    }
    const result=launchOp(orca,store,state,op,{...allocated,candidate},ctx);
    if(result.ok)launched.push(op.id);
  }
  if(launched.length){state.stalls=0;state.stalledSince=null;}
  return launched;
}

/** A verify operation must never run on a runtime that implemented the ledger items it judges. */
function avoidForVerify(state,op){
  if(op.kind!=='review.verify')return [];
  return unique(state.ops.filter(other=>other.id!==op.id&&implementsLedger(other)&&other.ledgerIds.some(id=>op.ledgerIds.includes(id)))
    .map(other=>other.runtime).filter(Boolean));
}

/* ------------------------------------------------------------------ machine verification */

/** Re-run the operation's own checks. A `done` the kernel cannot reproduce is not a `done`. */
export function machineVerify(state,op,{exec,cwd=state.worktree}={}){
  const checks=[];
  // The whole-tree validator is the kernel's own gate at acceptance, never an operation check.
  for(const check of (op.checks??[]).filter(check=>!KERNEL_CHECK.test(check.name??''))){
    const result=exec(check.command,{cwd,timeoutMs:op.timeoutMs??CHECK_TIMEOUT_MS});
    const exitCode=Number.isInteger(result?.status)?result.status:1;
    checks.push({name:check.name,command:check.command,exitCode,evidence:tail(`${result?.stdout??''}${result?.stderr??''}`)});
  }
  return {ok:checks.every(check=>check.exitCode===0),checks,failed:checks.filter(check=>check.exitCode!==0)};
}

/**
 * The changed files of this worktree, filtered to the operation's allowlist: the kernel never trusts
 * report.files. `exclude` is the kernel-owned ledger set, which no operation commit may ever carry.
 */
export function changedFiles(state,op,{git},allowlist=op.allowlist,{exclude=[]}={}){
  const shown=git('git',['status','--porcelain'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  return unique((shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))))
    .filter(file=>inside(file,allowlist)&&!inside(file,exclude));
}

function commitOp(state,op,files,{git}){
  const run=args=>git('git',args,{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  const head=()=>{const shown=run(['rev-parse','HEAD']);return shown.status===0?(shown.stdout??'').trim():null;};
  if(!files.length)return {committed:false,head:head(),reason:'the operation changed nothing inside its allowlist'};
  const added=run(['add','--',...files]);
  if(added.status!==0)return {committed:false,head:null,reason:`git add: ${tail(added.stderr,300)}`};
  // One op, one commit, and in ledger mode a `Work:` trailer so the history names the node it closes.
  const message=[`feat(${op.id}): ${firstLine(op.goal).slice(0,80)}`,...(op.nodeId?['',`Work: ${op.nodeId}`]:[])].join('\n');
  const committed=run(['commit','-q','-m',message]);
  if(committed.status!==0)return {committed:false,head:null,reason:`git commit: ${tail(committed.stderr,300)}`};
  return {committed:true,head:head(),files};
}

function markLedger(state,op,head){
  for(const id of op.ledgerIds){
    const item=ledgerItem(state,id);
    if(!item)continue;
    item.evidence=[...(item.evidence??[]),{opId:op.id,kind:op.kind,head:head??null}];
    // Only the LAST step of a node's lane proves it (`review.verify` on a backend lane, `uat.verify` on a frontend
    // one); an earlier prove step such as `e2e.verify` leaves the item implemented so the review is still planned.
    const lane=op.nodeId?state.lanes?.[op.nodeId]?.lane:null;
    // A lane that ends on a design step - a ui node, drawn then its artwork generated - is complete when that
    // step is accepted: no review is planned for it, so its last step is the one that settles the item.
    const entry=op.nodeId?state.lanes?.[op.nodeId]:null;
    const walked=laneWalked(entry);
    const proves=Array.isArray(lane)&&lane.length
      ?lane.at(-1)===op.kind||(!lane.includes('review.verify')&&walked.length>0&&walked.every(kind=>kind===op.kind||(entry.done??[]).includes(kind)))
      :(op.kind==='review.verify'||kindRole(op.kind)==='verify');
    item.status=proves?'verified':'implemented';
  }
}

/* ------------------------------------------------------------------ writing the Work ledger back */

/**
 * Every ledger write goes through here. A refused write is never silent and never fatal: the node keeps its
 * original bytes (work-ledger restores them itself), the refusal is an event, and the workflow carries it to
 * the user instead of reporting a green slice over a ledger that does not say so.
 */
function ledgerWrite(store,state,op,ctx,step,action,nodeId=op.nodeId){
  if(!ctx.work||!nodeId)return null;
  const node=ctx.work.node(nodeId);
  if(!node){
    store.appendEvent({event:'ledger-node-missing',op:op.id,node:nodeId,step});
    state.needUser.push({op:op.id,kind:'ledger',detail:`the Work node ${nodeId} is no longer in the validated tree, so ${step} could not be recorded`});
    return null;
  }
  try{
    const result=action(node);
    store.appendEvent({event:'ledger-write',op:op.id,node:nodeId,step});
    return result;
  }catch(error){
    store.appendEvent({event:'ledger-write-failed',op:op.id,node:nodeId,step,reason:error.message});
    state.needUser.push({op:op.id,kind:'ledger',detail:`the Work node ${nodeId} refused ${step}: ${error.message}`});
    return null;
  }
}

/** The checks the kernel itself re-ran, carrying the assertion each one proves (the check name is that id). */
const provenChecks=checks=>checks.map(check=>({name:check.name,command:check.command,exitCode:check.exitCode,assertion:check.name}));

/**
 * An accepted slice becomes `done` plus one evidence manifest on the node that asked for the work. On a lane
 * this is the LAST step only: `nodeId`, `checks` and `head` are passed in, because the step that completes a
 * lane may be a kernel review that names several nodes and proves them with the checks every step ran.
 */
/**
 * The checks the kernel owns (`work-valid`: the whole-tree validator) are stripped from every op, so the kernel
 * proves them itself when it records a node done: it validates the tree now and adds one passing check per
 * kernel-owned assertion the node declares. A tree that does not validate proves nothing and the write is refused.
 */
function kernelProof(ctx,nodeId){
  if(!ctx.work||typeof ctx.work.api.readNode!=='function')return [];
  const node=ctx.work.node(nodeId);
  if(!node)return [];
  let owned=[];
  try{owned=ctx.work.api.nodeChecks(ctx.work.api.readNode(ctx.work.at,node)).filter(check=>KERNEL_CHECK.test(check.assertion??''));}catch{owned=[];}
  if(!owned.length)return [];
  let ok=false;
  try{ok=Boolean(ctx.work.validate({repoRoot:ctx.work.ledger?.repoRoot??ctx.work.repoRoot,workRoot:ctx.work.ledger?.workRoot??null}).ok);}catch{ok=false;}
  return owned.map(check=>({name:check.assertion,command:workValidateCommand(ctx),exitCode:ok?0:1,assertion:check.assertion}));
}

function recordDone(store,state,op,ctx,verified,{nodeId=op.nodeId,head=op.head}={}){
  if(ctx.work&&!nodeId&&op.kind===BRAND_DECIDE){rereadBrand(store,state,op,ctx);return;}
  if(!ctx.work||!nodeId)return;
  verified={...verified,checks:[...(verified?.checks??[]),...kernelProof(ctx,nodeId)]};
  const decision=['architecture.decide','architecture.revise','business.decide',BRAND_DECIDE].includes(op.kind)||kindRole(op.kind)==='decide';
  if(decision){
    ledgerWrite(store,state,op,ctx,'decided',node=>ctx.work.api.markDecided(ctx.work.at,node,{
      by:'starci-kernel',
      // A revision of an accepted design bumps its rev, so a reopened decision is not read as the first one.
      // A brand decision always does: every surface already built from the old brand is bound to that rev.
      rev:['architecture.revise',BRAND_DECIDE].includes(op.kind)?nextRev(ctx,node):null,
      digest:ctx.work.digest,
      review:{reviewer:op.runtime??'starci-kernel',
        authority:`the kernel accepted ${op.id} after re-running its checks itself`,
        observations:decisionObservations(ctx,node,op),
        limitations:['Only the operation allowlist was reviewed.']}}),nodeId);
    if(op.kind===BRAND_DECIDE)rereadBrand(store,state,op,ctx);
    return;
  }
  // A completion binds its source directly (starci/source-identity@1) so the tree needs no repository resource record;
  // the identity is scoped to the operation allowlist, which is exactly what the kernel verified.
  // Source identity names the repository the slice is IN, which is the worktree this kernel commits in - never
  // the repository that happens to own the ledger the record is written to.
  const repository=ctx.work.code.repository??path.basename(ctx.work.code.repoRoot);
  // Only a code-bearing node (implementation, release) binds its source; the validator refuses a source identity or
  // code refs on any other kind, and that is what a review found and an agent "fixed" by hand once.
  const bindsCode=node=>['implementation','release'].includes(String(node?.kind??''));
  const identity=ctx.work.code.origin&&/^[a-f0-9]{40,64}$/.test(String(head??''))&&typeof ctx.work.api.buildSourceIdentity==='function'
    ?ctx.work.api.buildSourceIdentity({repository,origin:ctx.work.code.origin,commit:head,paths:op.allowlist??[],
      dependencyCoverage:'Dependencies were not re-verified by this operation.',limitations:['Only the operation allowlist was verified by the kernel.']})
    :null;
  ledgerWrite(store,state,op,ctx,'done',node=>ctx.work.api.markDone(ctx.work.at,node,{
    opId:op.id,head:head??null,checks:provenChecks(verified.checks),verifiedBy:'starci-kernel',digest:ctx.work.digest,repository,bindSource:bindsCode(node),...(identity&&bindsCode(node)?{sourceIdentity:identity}:{}),
    evidence:{outcome:'pass',environment:'local',actor:'starci-kernel',tool:'starci-kernel',
      // A ui node's completion carries its candidates as hashed captures: what the drawing produced is what is proven.
      assets:designEvidenceAssets({api:ctx.work.api,at:ctx.work.at,loaded:ctx.work.loaded},node),
      servedVersionEvidence:`Checks re-run by the StarCi kernel in workflow ${state.id} on branch ${state.branch}`}}),nodeId);
}

/**
 * An accepted brand decision is read back from the tree at once, and that is all the kernel does about it: the
 * new record and its rev become the material of every operation launched from here on, and the Work validator -
 * which binds a completion to the digest of what it was built from - is what reopens the frontend-facing nodes
 * that were built against the old brand. `syncLedgerOps` then picks them up as newly schedulable nodes.
 */
function rereadBrand(store,state,op,ctx){
  try{
    const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});
    if(loaded.ok)ctx.work.loaded=loaded;
    noteBrand(store,state,loaded,{op});
  }catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
}

/** The rev a revision writes: one past whatever the node's kernel block carries, and 1 when it carries none. */
function nextRev(ctx,node){
  try{
    const raw=ctx.work.api.readNode(ctx.work.repoRoot,node);
    const rev=Number(raw?.extensions?.work3?.kernel?.rev);
    return Number.isFinite(rev)?rev+1:1;
  }catch{return 1;}
}

/**
 * One accepted operation is one lane step. The node keeps `todo` with the kernel's `in-progress` block until
 * the LAST step of its lane is accepted; only then is `done` written, and with the checks every step of the
 * lane proved - the implement step's checks are what cover the node's authored assertions, and the prove step
 * (a kernel `review.verify`, or the lane's own `uat.verify`) is what allows the write at all.
 */
function laneNodesOf(state,op){
  if(op.nodeId)return state?.lanes?.[op.nodeId]?.lane?.length?[op.nodeId]:[];
  if(state.ledgerMode!==WORK_LEDGER)return [];
  return (op.ledgerIds??[]).filter(id=>state?.lanes?.[id]?.lane?.length);
}
const mergeProven=checks=>{
  const seen=new Map();
  for(const check of checks)seen.set(`${check.name}|${check.command}`,check);
  return [...seen.values()];
};
function advanceLanes(store,state,op,ctx,verified){
  const nodes=laneNodesOf(state,op);
  if(!nodes.length||!ctx.work)return {handled:false,completed:[]};
  const completed=[];
  for(const nodeId of nodes){
    const entry=state.lanes[nodeId];
    entry.done=unique([...(entry.done??[]),op.kind]);
    entry.checks=mergeProven([...(entry.checks??[]),...provenChecks(verified.checks)]);
    entry.head=op.head??entry.head??null;
    const predicates=lanePredicates(ctx,ctx.work.node(nodeId));
    laneSkip(entry,predicates);
    const next=laneNext(entry,predicates);
    store.appendEvent({event:'lane-step',op:op.id,node:nodeId,kind:op.kind,
      step:laneProgress(entry),lane:entry.lane,skipped:[...(entry.skipped??[])],next:next??null});
    if(next){
      // Not done yet: the node keeps the kernel block of the step that just landed, and waits for the next one.
      ledgerWrite(store,state,op,ctx,'in-progress',node=>ctx.work.api.markInProgress(ctx.work.repoRoot,node,{opId:op.id,dispatch:op.dispatch}),nodeId);
      continue;
    }
    recordDone(store,state,op,ctx,{checks:entry.checks},{nodeId,head:entry.head??op.head});
    ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,op,ctx,nodeId));
    completed.push(nodeId);
  }
  return {handled:true,completed};
}

/**
 * An accepted `work.author` op is measured against the tree, never against its own report: the ledger is
 * reloaded and the candidate enriched again, so the answer comes from `executableCandidates` exactly as the
 * next iteration will read it. A node that is schedulable now is logged `record-authored` and its own lane
 * creates its first step on the next iteration. A node that is still not schedulable is the one thing the
 * kernel cannot do for the user: the incompleteness is raised once, and `authorRecordOp` never creates a
 * second author op for it.
 *
 * The node keeps `state: todo` throughout, because authoring a record is not completing work: no `markDone`,
 * no completion, no evidence manifest - only the kernel's own `in-progress` receipt from the launch.
 */
function settleAuthoredRecord(store,state,op,ctx){
  const nodeId=op.nodeId;
  let candidate=null;
  try{
    const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});
    if(loaded.ok){
      ctx.work.loaded=loaded;
      candidate=ctx.work.api.executableCandidates(loaded,{scope:state.scope.length?state.scope:null,
        repository:ctx.work.code.repository,side:ctx.work.side}).find(item=>item.id===nodeId)??null;
    }
  }catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
  if(candidate?.schedulable){
    state.needUser=state.needUser.filter(item=>!(item.kind==='ledger'&&item.node===nodeId));
    store.appendEvent({event:'record-authored',node:nodeId,op:op.id,allowlist:candidate.allowlist,
      checks:candidate.checks.map(check=>check.assertion??check.command),
      lane:[...(state.lanes?.[nodeId]?.lane??[])]});
    return 'record-authored';
  }
  const detail=`ledger incomplete: ${candidate?.reason??`${nodeId} is still not launchable after ${op.id} completed its record`}`;
  if(!state.needUser.some(item=>item.kind==='ledger'&&item.node===nodeId))state.needUser.push({node:nodeId,kind:'ledger',detail});
  store.appendEvent({event:'record-still-incomplete',node:nodeId,op:op.id,detail});
  return 'record-still-incomplete';
}

/**
 * A completion the kernel wrote can be refused by a later rule (a source coverage path that is not a source path).
 * The record is the kernel's, so the kernel rewrites it from what it knows - the kernel block's checks and head,
 * the completion's own paths, sanitized - instead of leaving the whole tree invalid for a human to fix by hand.
 */
/**
 * A lane is templated the first time its node is seen. When the kinds profile later moves a node to another lane -
 * a `ui` node that used to share the frontend lane, say - the recorded template is stale, so at load every lane
 * whose fresh template differs and still contains every accepted step is re-templated; a lane that already
 * walked a step the new template does not know keeps its old one, and the mismatch stays visible in the events.
 */
/**
 * A `ledger` question on the user's list names a node the kernel could not record; when the tree now says that
 * node is done - a later retry wrote it, or the record was repaired - the question is answered and is dropped,
 * with an event, so the morning list carries only what is still true.
 */
function pruneAnsweredQuestions(store,state,loaded){
  if(!Array.isArray(state.needUser)||!loaded?.nodes)return;
  const kept=[];
  for(const item of state.needUser){
    const keyed=item?.op?state.ops.find(candidate=>candidate.id===item.op):null;
    // A question about an op that was since superseded, or about a shared change that is no longer blocked, has no reason left.
    if(keyed&&keyed.refusal==='superseded'){store.appendEvent({event:'need-user-answered',op:item.op,kind:item.kind,reason:'superseded'});continue;}
    if(item?.kind==='shared-change'){
      const named=(String(item.detail??'').match(/waits for the shared change (\S+), which is blocked/)??[])[1];
      const shared=named?state.ops.find(candidate=>candidate.id===named):null;
      if(shared&&shared.status!=='blocked'){store.appendEvent({event:'need-user-answered',op:item.op??null,kind:item.kind,reason:`${named} is ${shared.status}`});continue;}
    }
    if(item?.kind!=='ledger'){kept.push(item);continue;}
    // Keyed by node, or by the op whose write was refused: the nodes that op closes (its own, or the set a review names).
    const op=item.op?state.ops.find(candidate=>candidate.id===item.op):null;
    const nodes=item.node?[item.node]:op?unique([...(op.nodeId?[op.nodeId]:[]),...(op.ledgerIds??[])]):[];
    const answered=nodes.length>0&&nodes.every(id=>loaded.nodes.get(id)?.state==='done');
    if(answered){store.appendEvent({event:'need-user-answered',node:item.node??null,op:item.op??null,nodes,detail:String(item.detail??'').slice(0,160)});continue;}
    kept.push(item);
  }
  state.needUser=kept;
}
function retemplateLanes(store,state,loaded){
  for(const [id,entry] of Object.entries(plain(state.lanes)?state.lanes:{})){
    const node=loaded?.nodes?.get?.(id);
    if(!node||!Array.isArray(entry?.lane)||!entry.lane.length)continue;
    let fresh=[];
    try{fresh=graph.laneFor({kind:node.kind,layout:nodeLayout(node),repositoryRole:node.repository??null});}catch{continue;}
    if(!fresh.length||fresh.join('|')===entry.lane.join('|'))continue;
    const done=entry.done??[];
    if(!done.every(kind=>fresh.includes(kind))){store.appendEvent({event:'lane-template-stale',node:id,lane:entry.lane,fresh,done});continue;}
    const before=[...entry.lane];
    entry.lane=[...fresh];entry.skipped=[];
    for(const item of state.ledger)if(item.id===id&&Array.isArray(item.lane))item.lane=[...fresh];
    store.appendEvent({event:'lane-retemplated',node:id,from:before,to:fresh});
  }
}
function repairKernelRecords(store,state,ctx,loaded){
  if(!ctx.work||loaded.ok||!Array.isArray(loaded.errors))return [];
  const api=ctx.work.api;
  if(typeof api.markDone!=='function'||typeof api.buildSourceIdentity!=='function'||typeof api.readNode!=='function')return [];
  const refused=unique(loaded.errors.filter(error=>['SOURCE_COVERAGE','SOURCE_IDENTITY','CODE_REFS'].includes(error.code)).map(error=>String(error.path??'')).filter(Boolean));
  const repaired=[];
  for(const node of loaded.list){
    const own=refused.some(file=>file===node.path||file.startsWith(`${path.posix.dirname(node.path)}/evidence/`));
    if(!own||node.state!=='done')continue;
    let raw;try{raw=api.readNode(ctx.work.at??ctx.work.repoRoot,node);}catch{continue;}
    const kernel=raw?.extensions?.work3?.kernel;
    if(!kernel?.opId||!kernel.head||!Array.isArray(kernel.checks))continue;
    const identity=raw?.completion?.sourceIdentity?.repositories?.[0];
    const bindsCode=['implementation','release'].includes(String(node.kind??''));
    try{
      const rebuilt=bindsCode&&identity?api.buildSourceIdentity({repository:identity.repository,origin:identity.origin,commit:kernel.head,paths:identity.coverage?.paths??[],
        dependencyCoverage:identity.coverage?.dependencyCoverage??'Dependencies were not re-verified by this operation.',limitations:identity.coverage?.limitations??['Only the operation allowlist was verified by the kernel.']}):null;
      ctx.guards.gitQueue(()=>{
        api.markDone(ctx.work.at??ctx.work.repoRoot,node,{opId:kernel.opId,head:kernel.head,checks:kernel.checks,verifiedBy:kernel.verifiedBy??'starci-kernel',at:kernel.at??null,
          digest:ctx.work.digest,bindSource:bindsCode,...(rebuilt?{sourceIdentity:rebuilt}:{}),
          evidence:{outcome:'pass',environment:'local',actor:'starci-kernel',tool:'starci-kernel',servedVersionEvidence:`Checks re-run by the StarCi kernel in workflow ${state.id} on branch ${state.branch}`}});
        commitLedgerWrite(store,state,{id:kernel.opId,nodeId:node.id},ctx,node.id);
      });
      repaired.push(node.id);
      store.appendEvent({event:'kernel-record-repaired',node:node.id,op:kernel.opId,codes:refused.length});
    }catch(error){store.appendEvent({event:'kernel-record-repair-failed',node:node.id,reason:String(error.message).slice(0,200)});}
  }
  if(repaired.length){try{ctx.work.loaded=api.loadLedger({repoRoot:ctx.work.at??ctx.work.repoRoot,validate:ctx.work.validate});}catch{}}
  return repaired;
}

/**
 * The ledger write is the kernel's own change to the repository, so it is committed too - under the node
 * directory it belongs to and with the same `Work:` trailer - instead of being left dirty in the worktree.
 * It follows the operation's commit because a completion binds the head of the slice it proves.
 */
function commitLedgerWrite(store,state,op,ctx,nodeId=op.nodeId){
  if(!ctx.work||!nodeId)return null;
  const node=ctx.work.node(nodeId);
  if(!node)return null;
  // The write happens where the tree is, so the commit happens there too: in the owner repository, on whatever
  // branch it is on, with the same `Work:` trailer. A shared ledger is the only case where that is not here.
  const cwd=ctx.work.ledger?.repoRoot??state.worktree;
  const scope=normalize(path.join(path.relative(cwd,ctx.work.ledger?.workRoot??path.join(cwd,'.starciwork')),path.dirname(node.path)));
  // Ledger writes carry 64-hex digests that a repository secrets guard mistakes for keys; the kernel is the
  // author of those digests, so it declares the scan skipped for exactly this commit.
  const run=args=>ctx.git('git',args,{cwd,encoding:'utf8',windowsHide:true,env:{...process.env,ALLOW_SECRET_SCAN:'1'}});
  const files=ledgerChanges(run,scope);
  if(!files.length)return null;
  run(['config','core.longpaths','true']);
  if(run(['add','--',...files]).status!==0){store.appendEvent({event:'ledger-commit-failed',op:op.id,node:nodeId,reason:'git add'});return null;}
  const committed=run(['commit','-q','-m',`work(${nodeId}): record ${op.id} in the Work ledger\n\nWork: ${nodeId}`]);
  if(committed.status!==0){store.appendEvent({event:'ledger-commit-failed',op:op.id,node:nodeId,reason:tail(committed.stderr,200)});return null;}
  const shown=run(['rev-parse','HEAD']);
  const head=shown.status===0?(shown.stdout??'').trim():null;
  // `state.head` is the head of the code this workflow produced; a commit in another repository is never that.
  if(head&&!ctx.work.shared)state.head=head;
  if(head)op.ledgerCommit=head;
  store.appendEvent({event:'ledger-commit',op:op.id,node:nodeId,files,head,ledgerCommit:head,
    ...(ctx.work.shared?{repository:ctx.work.ledger.repository,shared:true}:{})});
  return head;
}

/** Pending ledger paths under one node directory, read where the tree lives rather than in this worktree. */
function ledgerChanges(run,scope){
  const shown=run(['status','--porcelain','--',scope]);
  if(shown.status!==0)return [];
  return unique((shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))))
    .filter(file=>inside(file,[scope]));
}

/** A decision is settled by observations, one per authored assertion; with none authored, one for the node. */
function decisionObservations(ctx,node,op){
  const authored=(()=>{try{const raw=ctx.work.api.readNode(ctx.work.at,node);return Array.isArray(raw.assertions)?raw.assertions.map(String):[];}catch{return [];}})();
  const observation=firstLine(op.reports.at(-1)?.summary)||`${op.id} settled this decision`;
  return (authored.length?authored:[String(node.id)]).map(id=>({id,outcome:'pass',observation}));
}

/**
 * A reported SDS gap reopens the design, it does not repair it in place: the architecture node the operation
 * names - or, failing that, the one in its own module - returns to `todo` and gets the kind the `sds-gap`
 * route names (`architecture.revise`: fix the SDS text, bump its rev), which the blocked operation waits for.
 */
function architectureNodeFor(ctx,op,detail){
  const nodes=ctx.work.loaded.list.filter(node=>node.kind==='architecture');
  const named=pathsIn(detail);
  const byPath=nodes.find(node=>named.some(file=>slash(node.path).includes(file)||file.includes(slash(path.dirname(node.path)))));
  if(byPath)return byPath;
  const own=ctx.work.node(op.nodeId);
  const key=own?workModule(own):null;
  return nodes.find(node=>key&&workModule(node)===key)??null;
}

/** The check a design change must survive: the Work tree still validates after the decision is written. */
const validateCommandAt=workRoot=>`node ${slash(path.join(skillRoot,'bin','starci.mjs'))} validate ${slash(workRoot)}`;
const workValidateCommand=ctx=>validateCommandAt(ctx.work.ledger?.workRoot??path.join(ctx.work.repoRoot,'.starciwork'));

/** `then: reopen` - the reporter waits for the op the route created and runs again with the settled material. */
function reopenRequester(store,state,op,open,created,note){
  op.status='pending';op.attempt+=1;op.dependsOn=unique([...op.dependsOn,created.id]);
  op.priorOpen=unique([...(open??[]),note]);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'op-reopened',op:op.id,waitingFor:created.id,note});
}

function reopenArchitecture(store,state,op,report,ctx,blocker){
  const architecture=architectureNodeFor(ctx,op,blocker.detail);
  if(!architecture)return null;
  const route=routeOf({blocker:'sds-gap',kind:op.kind})??{kind:'architecture.revise',origin:'architecture',then:'reopen'};
  ledgerWrite(store,state,op,ctx,'reopened',()=>ctx.work.api.markReopened(ctx.work.at,architecture,
    {reason:`${op.id} reported an SDS gap: ${blocker.detail}`,by:'starci-kernel'}));
  const designFile=`.starciwork/${slash(architecture.path)}`;
  // The revision owns the node file and the SDS folder around it: a design fix is text, and its text is there.
  const designFolder=`.starciwork/${slash(path.dirname(architecture.path))}/**`;
  const decide=addOp(store,state,{kind:routeKind(route,state,op)??'architecture.revise',nodeId:architecture.id,
    goal:`Revise the design ${op.id} found incomplete, in the architecture node ${architecture.id}: ${blocker.detail}. Fix the SDS text itself and bump its rev.`,
    ledgerIds:op.ledgerIds,allowlist:unique([designFile,designFolder]),references:unique([architecture.path,...op.references]),
    checks:[{name:'work-tree-validates',command:workValidateCommand(ctx)}],
    acceptance:[`${architecture.id} records the decision for: ${blocker.detail}`],origin:route.origin??'architecture'},
    `sds-gap reported by ${op.id}`);
  reopenRequester(store,state,op,report.open,decide,`the design gap is settled by ${decide.id} in ${architecture.path}; read the updated design first`);
  store.appendEvent({event:'sds-gap',op:op.id,node:op.nodeId,architecture:architecture.id,decide:decide.id});
  routed(store,op,'sds-gap',decide.id,decide.origin,{kind:decide.kind,node:architecture.id,then:route.then});
  return decide;
}

/* ------------------------------------------------------------------ the validator */

/**
 * One validator per workflow, shared by every op: not an agent in a terminal (a serial bottleneck whose context
 * rots and that would itself need supervising) but an identity with memory - a headless `validateOp` call the
 * kernel makes for each result its own machine verification and proof already passed, before anything is
 * committed or written into the ledger. The kernel owns the memory (`<store>/validator/memory.md`, rebuilt
 * from `verdicts.jsonl` and the job rulings, bounded in lines and bytes) and hands it into every call, so the
 * verdicts stay consistent across ops. The verdict is data: it decides accept, retry or stop-at-the-user and
 * changes nothing else.
 */
const validatorPaths=store=>{const dir=path.join(store.dir,'validator');return {dir,memory:path.join(dir,'memory.md'),verdicts:path.join(dir,'verdicts.jsonl')};};
export function readValidatorMemory(store){try{return fs.readFileSync(validatorPaths(store).memory,'utf8');}catch{return '';}}
const oneLine=(text,max=200)=>String(text??'').replace(/\s*\r?\n\s*/g,' ').trim().slice(0,max);
function readVerdicts(store){
  let text='';try{text=fs.readFileSync(validatorPaths(store).verdicts,'utf8');}catch{return [];}
  return text.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
}
/** The memory page: job rulings first (binding), then the latest verdict lines, oldest dropped until the page fits. */
export function renderValidatorMemory(store,state){
  const lines=readVerdicts(store).slice(-VALIDATOR_MEMORY_LINES).map(item=>{
    const finding=item.verdict==='reject'&&item.findings?.[0]?` - finding: ${item.findings[0].file}: ${oneLine(item.findings[0].detail,120)}`:'';
    return `- ${item.op} | ${item.verdict} | ${oneLine(item.summary||item.reason||'')}${finding}`;
  });
  const rulings=oneLine(rulingsText(store),6*1024);
  const render=list=>[`# Validator memory - workflow ${state.id}`,``,`Job: ${firstLine(state.job)}`,``,
    ...(rulings?[`## Job rulings (binding)`,``,rulings,``]:[]),
    `## Verdicts (oldest first, op | verdict | summary)`,``,...(list.length?list:['- none yet']),``].join('\n');
  let text=render(lines);
  while(Buffer.byteLength(text)>VALIDATOR_MEMORY_BYTES&&lines.length>1){lines.shift();text=render(lines);}
  return text;
}
function recordVerdict(store,state,op,record){
  const paths=validatorPaths(store);
  fs.mkdirSync(paths.dir,{recursive:true});
  fs.appendFileSync(paths.verdicts,`${JSON.stringify({at:Date.now(),op:op.id,node:op.nodeId,attempt:op.attempt,...record})}\n`);
  fs.writeFileSync(paths.memory,renderValidatorMemory(store,state));
}

/** The unified diff of the op's changed files against the head it started from; an untracked file is rendered as an added one. */
export function opDiff(state,op,files,{git}){
  const run=args=>git('git',args,{cwd:state.worktree,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  const base=op.baseHead??'HEAD';
  let text='';
  if(files.length){
    const shown=run(['diff','--no-color',base,'--',...files]);
    if(shown.status===0)text=shown.stdout??'';
    // `git diff <head>` shows nothing for a file git does not track yet: an added file is rendered as one.
    const others=run(['ls-files','--others','--exclude-standard','--',...files]);
    for(const file of (others.status===0?(others.stdout??''):'').split('\n').map(line=>normalize(line.trim())).filter(Boolean)){
      let body='';try{body=fs.readFileSync(path.join(state.worktree,file),'utf8');}catch{continue;}
      text+=`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n${body.split('\n').map(line=>`+${line}`).join('\n')}\n`;
    }
  }
  const truncated=Buffer.byteLength(text)>VALIDATOR_DIFF_BYTES;
  if(truncated)text=`${Buffer.from(text).subarray(0,VALIDATOR_DIFF_BYTES).toString()}\n[diff truncated by the kernel at ${VALIDATOR_DIFF_BYTES} bytes; the validator sees a prefix]\n`;
  return {files,base,text,truncated};
}
/** The authored node the op closes, as the validator reads it: id, description and the assertions it must satisfy. */
function validatorNode(ctx,op){
  if(!ctx.work||!op.nodeId)return null;
  const node=ctx.work.node(op.nodeId);
  if(!node)return null;
  try{
    const raw=ctx.work.api.readNode(ctx.work.repoRoot,node);
    const all=Array.isArray(raw?.assertions)?raw.assertions.map(String):[];
    // An assertion this op does not carry a check for is proven elsewhere: by the kernel (work-valid) or by a later
    // lane step (the e2e run, the review). The validator is told so, or it rejects the op for what is not its job.
    const own=new Set((op.checks??[]).map(check=>String(check.name??'')));
    let named=[];try{named=ctx.work.api.nodeChecks(raw).map(check=>check.assertion).filter(Boolean);}catch{named=[];}
    const deferred=all.filter(assertion=>KERNEL_CHECK.test(assertion)||(named.includes(assertion)&&!own.has(assertion)));
    return {id:node.id,description:raw?.description??null,assertions:all.filter(assertion=>!deferred.includes(assertion)),deferred};
  }
  catch{return {id:node.id,description:null,assertions:[],deferred:[]};}
}
/** Runtimes the allocator has parked: the validator skips them instead of paying a call into a closed door. */
const coolingRuntimes=allocator=>{try{return (allocator?.snapshot?.()?.cooling??[]).map(item=>item?.runtime).filter(Boolean);}catch{return [];}};
const findingText=finding=>`validator: ${finding.file}${finding.line?`:${finding.line}`:''}${finding.assertion?` [${finding.assertion}]`:''} - ${finding.detail}`;

/**
 * Ask the validator about one result the kernel already reproduced. Returns `{verdict}` with `findings` on a
 * reject. `unavailable` (no provider, no parseable answer) never blocks: it is recorded, counted, and after
 * VALIDATOR_UNAVAILABLE_LIMIT in a row it is a needUser item. With `validateOp:null` the step is skipped once,
 * on the record.
 */
function validateAccepted(store,state,op,ctx,{files,verified}){
  if(ctx.validateOp===null||ctx.validateOp===undefined){
    if(!state.validatorSkipped){state.validatorSkipped=true;store.appendEvent({event:'validator-skipped',reason:'no validator function was given to this kernel'});}
    return {verdict:'skipped'};
  }
  // A review or a no-op slice changed nothing: there is no diff to judge, and a call on nothing could only misjudge.
  if(!files.length){store.appendEvent({event:'validator-skipped',op:op.id,reason:'the operation changed nothing inside its allowlist, so there is no diff to judge'});return {verdict:'skipped'};}
  const providers=ctx.validator??llm.DEFAULT_VALIDATOR_RUNTIMES;
  const diff=opDiff(state,op,files,ctx);
  let result;
  // The kernel's own check (`work-valid`) is proven by the kernel, not by the agent: it goes to the validator with the
  // re-run checks, so an acceptance statement naming it is never rejected as unproven (repair-5 was, four times).
  const proven=[...verified.checks,...kernelProof(ctx,op.nodeId??op.ledgerIds?.[0]??null)];
  try{result=ctx.validateOp({op,node:validatorNode(ctx,op),diff,checks:proven,references:op.references,
    // The brand travels with every verdict: a colour, a font, an icon or an artwork slot outside it is a defect,
    // and the validator can only say so if it was given the record the operation was supposed to read.
    brand:brandPayload(ctx.work?.loaded),
    memory:readValidatorMemory(store),providers,skip:coolingRuntimes(ctx.allocator),cwd:ctx.cwd});}
  catch(error){result={ok:false,verdict:'unavailable',reason:error.message};}
  const verdict=llm.VALIDATOR_VERDICTS.includes(result?.verdict)?result.verdict:'unavailable';
  const summary=oneLine(result?.summary),provider=result?.provider??null,reason=oneLine(result?.reason)||null;
  const findings=(Array.isArray(result?.findings)?result.findings:[]).filter(item=>item&&typeof item.file==='string');
  op.validation={verdict,summary:summary||null,provider,at:ctx.now(),...(verdict==='unavailable'?{reason}:{})};
  for(const dropped of Array.isArray(result?.dropped)?result.dropped:[])
    store.appendEvent({event:'validator-finding-dropped',op:op.id,file:dropped.file,detail:oneLine(dropped.detail),diffFiles:files});
  recordVerdict(store,state,op,{head:state.head??op.baseHead??null,verdict,summary,findings,provider,usage:result?.usage??null,reason,diffTruncated:diff.truncated});
  if(verdict==='unavailable'){
    state.validatorUnavailable=(state.validatorUnavailable??0)+1;
    store.appendEvent({event:'validator-unavailable',op:op.id,reason,consecutive:state.validatorUnavailable,attempts:(result?.attempts??[]).length});
    if(state.validatorUnavailable>=VALIDATOR_UNAVAILABLE_LIMIT&&!state.needUser.some(item=>item.kind==='validator'&&!item.op))
      state.needUser.push({kind:'validator',detail:`the validator answered nothing usable for ${state.validatorUnavailable} op results in a row (${providers.join(', ')}); last: ${reason??'unknown'}`});
    return {verdict};
  }
  state.validatorUnavailable=0;
  if(verdict==='accept'){store.appendEvent({event:'validated',op:op.id,summary,provider,usage:result?.usage??null});return {verdict};}
  store.appendEvent({event:'validator-rejected',op:op.id,summary,provider,findings:findings.slice(0,5).map(findingText),usage:result?.usage??null});
  return {verdict,findings:findings.map(findingText)};
}

/**
 * `interface-gap`: a frontend implementation found the accepted design silent about what it must build. The
 * route puts the lane's draw step back in front of it instead of letting it invent a surface of its own.
 */
function reopenInterface(store,state,op,report,blocker,ctx=null){
  const route=routeOf({blocker:'interface-gap',kind:op.kind})??{kind:'interface.draw',origin:'architecture',then:'reopen'};
  // The gap is in the design record, so the drawing is done on the feature's ui node - its record and its
  // assets - not on the implementation's code paths; a feature with no ui node redraws where the requester is.
  const access=ctx?.work?{api:ctx.work.api,at:ctx.work.at,loaded:ctx.work.loaded}:null;
  const design=access?designNodeOf(access,ctx.work.node(op.nodeId))??null:null;
  const designPath=design?.path?slash(design.path):null;
  const target=design?.id?{nodeId:design.id,allowlist:unique([`.starciwork/${path.posix.dirname(designPath)}/**`,`.starciwork/${designPath}`]),references:unique([designPath,...op.references])}
    :{nodeId:op.nodeId,allowlist:op.allowlist,references:op.references};
  const draw=addOp(store,state,{id:nextId(state,'draw'),kind:routeKind(route,state,op)??'interface.draw',nodeId:target.nodeId,
    goal:`Draw the surface ${op.id} found missing in the accepted design: ${blocker.detail}`,
    ledgerIds:op.ledgerIds,allowlist:target.allowlist,references:target.references,checks:op.checks,
    acceptance:[`the accepted design answers: ${blocker.detail}`],origin:route.origin??'architecture'},
    `interface-gap reported by ${op.id}`);
  if(draw)locateSharedTreePaths(draw,ctx);
  reopenRequester(store,state,op,report.open,draw,`the interface gap is drawn by ${draw.id}; read the accepted design again first`);
  routed(store,op,'interface-gap',draw.id,draw.origin,{kind:draw.kind,node:op.nodeId??null,then:route.then});
  return draw;
}

/**
 * `grammar-gap`: a drawing or a build met a shape the installed grammar cannot render, and it is not a
 * composition of existing contracts. The route grows the grammar once - in the grammar's own repository, as one
 * semantic unit, published and recorded in the canon - and the requester reads that canon again behind it,
 * instead of inventing the shape beside the grammar in a product page.
 *
 * The one thing the kernel will not guess is where a language lives. A workspace binding with no `grammar`
 * repository role means this workflow may not change the grammar at all: nothing is created, nothing is
 * reopened, the requester stays blocked, and the question reaches the user naming the file that would answer it.
 */
function growGrammar(store,state,op,report,blocker,ctx=null){
  const grammar=ctx?.work?.grammar??null;
  if(!grammar){
    op.status='blocked';
    const detail=`grammar-gap from ${op.id} but the workspace binds no grammar repository (role \`grammar\` in .workspaces/projects/<project>/work.json)`;
    if(!state.needUser.some(item=>item.op===op.id&&item.kind==='environment'&&item.detail===detail))
      state.needUser.push({op:op.id,kind:'environment',detail});
    store.appendEvent({event:'grammar-unbound',op:op.id,node:op.nodeId??null,detail:blocker.detail});
    return 'grammar-unbound';
  }
  const route=routeOf({blocker:'grammar-gap',kind:op.kind})??{kind:'grammar.update',origin:'architecture',then:'reopen'};
  const named=grammar.package?` (\`${grammar.package}\`)`:'';
  // The grammar repository and the canon that names its units: both are outside the product tree, and the
  // operation may write nothing else - a product page is exactly what this route exists to prevent.
  const canon=[path.join(skillRoot,'knowledge','grammars'),path.join(skillRoot,'knowledge','patterns','fe')]
    .map(entry=>`${slash(entry)}/**`);
  const grow=addOp(store,state,{id:nextId(state,'grammar'),kind:routeKind(route,state,op)??'grammar.update',nodeId:op.nodeId??null,
    goal:`Grow the installed grammar${named} by the one semantic unit ${op.id} found missing: ${blocker.detail}. Try to express it as a composition of existing contracts first and write that attempt down; only a shape that does not compose becomes a new unit, implemented with its stories and tests, published at a new version and recorded in the canon. No product page.`,
    ledgerIds:op.ledgerIds,allowlist:unique([`${slash(grammar.root)}/**`,...canon]),
    references:unique([...op.references,...grammarReferences()]),checks:op.checks,
    acceptance:[`the grammar renders: ${blocker.detail}`,
      'the grammar package is published at a new version and the consumer imports it',
      'the canon names the new unit'],origin:route.origin??'architecture'},
    `grammar-gap reported by ${op.id}`);
  reopenRequester(store,state,op,report.open,grow,`the grammar is grown by ${grow.id}; read the canon again first`);
  store.appendEvent({event:'grammar-gap',op:op.id,node:op.nodeId??null,grammar:slash(grammar.root),package:grammar.package??null,grow:grow.id});
  routed(store,op,'grammar-gap',grow.id,grow.origin,{kind:grow.kind,node:op.nodeId??null,then:route.then});
  return 'grammar-gap';
}

/* ------------------------------------------------------------------ result policy */

/**
 * How many times one op may be retried. The `validator-reject` route carries its own, lower limit: the accept
 * path that re-validates a written ledger (`validateAccepted`) reads it from here, so the bound lives in the
 * graph with every other route bound and not in two places.
 */
export const validatorRejectLimit=()=>routeOf({verdict:'reject'})?.limit??RETRY_LIMIT;
const retryLimitFor=reason=>reason==='validator-reject'?validatorRejectLimit():RETRY_LIMIT;

function retryOp(store,state,op,findings,ctx,reason){
  op.repairs+=1;
  if(op.repairs>retryLimitFor(reason)){
    const chosen=ctx.decide({situation:`${op.kind} ${op.id} is still failing after ${op.repairs-1} retries (${reason})`,
      options:['retry-other-runtime','split','escalate-to-user'],
      context:{goal:firstLine(op.goal),allowlist:op.allowlist,findings,runtime:op.runtime},cwd:ctx.cwd});
    const option=chosen?.ok?chosen.value.option:'escalate-to-user';
    store.appendEvent({event:'decide',op:op.id,option,rationale:chosen?.ok?chosen.value.rationale:'decide produced no valid option'});
    if(option==='escalate-to-user'){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} exhausted its retries: ${findings[0]??reason}`});
      return 'escalate-to-user';
    }
    if(option==='split'){
      if(op.allowlist.length>1){
        op.status='done';op.verdict='split';
        for(const entry of op.allowlist)addOp(store,state,{kind:op.kind,goal:`${firstLine(op.goal)} - only \`${entry}\``,
          ledgerIds:op.ledgerIds,allowlist:[entry],references:op.references,checks:op.checks,acceptance:op.acceptance,
          findings,origin:'repair'},`split of ${op.id}`);
        return 'split';
      }
      store.appendEvent({event:'split-refused',op:op.id,reason:'a single-path allowlist cannot be split'});
    }
    op.avoidRuntimes=unique([...op.avoidRuntimes,op.runtime].filter(Boolean));
    op.repairs=retryLimitFor(reason);
  }
  op.status='ready';op.attempt+=1;op.findings=findings;op.priorOpen=[];op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'retry',op:op.id,attempt:op.attempt,reason,findings:findings.slice(0,3)});
  return 'retry';
}

function resumeOp(store,state,op,report,ctx){
  op.resumes+=1;
  if(op.resumes>RESUME_LIMIT){
    const chosen=ctx.decide({situation:`${op.id} reported partial ${op.resumes} times`,options:['resume-once-more','escalate-to-user'],
      context:{open:report.open,summary:report.summary},cwd:ctx.cwd});
    const option=chosen?.ok?chosen.value.option:'escalate-to-user';
    store.appendEvent({event:'decide',op:op.id,option,rationale:chosen?.ok?chosen.value.rationale:'decide produced no valid option'});
    if(option!=='resume-once-more'){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} never finishes: ${report.open?.[0]??report.summary}`});
      return 'escalate-to-user';
    }
    op.resumes=RESUME_LIMIT;
  }
  op.status='ready';op.attempt+=1;op.priorOpen=[...(report.open??[])];op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'resume',op:op.id,attempt:op.attempt,open:op.priorOpen.slice(0,3)});
  return 'resume';
}

function answerOrEscalate(orca,store,state,op,report,ctx){
  const chosen=ctx.decide({situation:`${op.id} asked: ${report.question?.text}`,options:['answer','escalate-to-user'],
    context:{options:report.question?.options??[],goal:firstLine(op.goal),allowlist:op.allowlist,acceptance:op.acceptance},cwd:ctx.cwd});
  const option=chosen?.ok?chosen.value.option:'escalate-to-user';
  store.appendEvent({event:'decide',op:op.id,option,rationale:chosen?.ok?chosen.value.rationale:'decide produced no valid option'});
  if(option==='answer'&&chosen.value.instructions){
    // The answered report file is retained out of the way so the operation can report once more on the same Dispatch.
    const file=store.reportPath(op.dispatch);
    if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
    op.answer=chosen.value.instructions;op.status='answering';
    return 'answer';
  }
  op.status='blocked';
  state.needUser.push({op:op.id,kind:'authority',detail:report.question?.text??'the operation asked a question the kernel cannot answer'});
  return 'escalate-to-user';
}

/* ------------------------------------------------------------------ shared changes */

/**
 * A shared change is a path outside the operation's allowlist that its slice needs. The discipline is four
 * rules: the blocker must name concrete repository paths (a detail that names none is sent straight back to
 * the operation, as if it had asked a question); one shared op per distinct path set, where a path-prefix
 * overlap merges into the pending or running shared op and appends the requester; at most
 * three new shared ops per iteration, the rest queued; and the requester is `paused` - not `pending`, so
 * nothing reschedules it - until its shared op is `done`.
 */
const sharedAlive=op=>op.origin==='shared'&&liveStatus.includes(op.status);
const pathSetsOverlap=(a=[],b=[])=>a.some(one=>b.some(other=>covers(one,other)));
const sharedThisIteration=state=>state.ops.filter(op=>op.origin==='shared'&&op.createdIteration===state.iterations).length;

function pauseForShared(store,state,op,open,shared,note){
  op.status='paused';op.waitingFor=shared?.id??null;
  op.priorOpen=unique([...open,note]);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  if(shared)op.dependsOn=unique([...op.dependsOn,shared.id]);
  store.appendEvent({event:'op-paused',op:op.id,waitingFor:op.waitingFor,note});
}

const SHARED_DEPTH_LIMIT=2;
function createSharedOp(store,state,op,detail,paths){
  // The route decides what a shared change IS: the same build kind as the requester, created as `shared`.
  const route=routeOf({blocker:'shared-change',kind:op.kind})??{kind:'same',origin:'shared',then:'pause'};
  const created=addOp(store,state,{kind:routeKind(route,state,op)??op.kind,
    goal:`Apply the shared change ${op.id} cannot make: ${detail}`,
    ledgerIds:op.ledgerIds,allowlist:paths,references:op.references,checks:op.checks,
    acceptance:[detail],origin:route.origin??'shared',requesters:[op.id]},`shared-change reported by ${op.id}`);
  if(created){
    created.sharedDepth=(op.sharedDepth??0)+1;
    routed(store,op,'shared-change',created.id,created.origin,{kind:created.kind,paths,then:route.then});
  }
  return created;
}

/**
 * Whether a path names this worktree and not another repository: relative, no escape, and no segment that is
 * the folder of another bound repository or the folder every repository lives in (a `Repositories/other/...`
 * path is Source-relative, which an operation inside one worktree cannot reach). A new top-level folder is fine.
 */
function insideWorktree(state,entry){
  const relative=normalize(entry);
  if(!relative||path.isAbsolute(relative)||/^[A-Za-z]:/.test(relative))return false;
  const parts=relative.split('/').filter(Boolean);
  if(!parts.length||parts.includes('..'))return false;
  const others=new Set([...(state?.otherRepositories??[]),...(state?.repositoriesRoot?[state.repositoriesRoot]:[])].map(name=>String(name).toLowerCase()));
  return !parts.some(part=>others.has(part.toLowerCase()));
}
/**
 * A shared op an older build created for paths outside this worktree is settled: blocked as out-of-repository,
 * and every requester waiting on it is answered the way a fresh request now is.
 */
function refuseForeignShared(store,state,ctx){
  for(const op of state.ops){
    if(op.origin!=='shared'||!['pending','ready','running','paused','blocked'].includes(op.status)||op.refusal)continue;
    const allowlist=op.allowlist??[];
    if(!allowlist.length||allowlist.some(entry=>insideWorktree(state,entry)))continue;
    if(op.status==='running'&&op.dispatch&&ctx?.orca)settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'out-of-repository',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(op.runtime&&op.status==='running')ctx.allocator?.release?.(op.runtime);
    op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
    store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths:allowlist,reason:'outside this repository',settled:true});
    for(const id of op.requesters??[]){
      const requester=state.ops.find(candidate=>candidate.id===id);
      if(!requester||!['paused','pending'].includes(requester.status))continue;
      requester.priorOpen=unique([...(requester.priorOpen??[]),`the shared change ${op.id} named ${allowlist.join(', ')}, which is not in this repository; a shared change reaches only this worktree - record what you need from another repository as a source or an open gap in your own record, never as a change`]);
      requester.status='ready';requester.attempt=(requester.attempt??1)+1;requester.waitingFor=null;requester.dispatch=null;requester.terminal=null;
      store.appendEvent({event:'op-resumed',op:requester.id,reason:`${op.id} was out of this repository`});
    }
  }
}
/** One shared request: merge into an existing shared op, create one, or queue it for the next iteration. */
function requestSharedChange(store,state,op,{paths,detail,open=[]}){
  // The Work tree is the kernel's record, never an operation's: a shared change that names a ledger path is
  // refused and carried to the user as a finding. A read-only kind may not request one at all.
  const ledgerPaths=paths.filter(entry=>/^\.?\/?\.starciwork\//.test(slash(entry)));
  // A path of another repository is not a shared change: a shared change reaches only this worktree. The op is
  // told so and reports again - what it needs from another repository is a source or an open gap in its record.
  const foreign=paths.filter(entry=>!insideWorktree(state,entry));
  if(foreign.length&&!ledgerPaths.length){
    const file=store.reportPath(op.dispatch);
    if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
    op.answer=`The path(s) ${foreign.join(', ')} are not in this repository (${slash(state.worktree)}); a shared change reaches only this worktree. Record what you need from another repository in your own record - as a source it is traced to, or as an open gap - and report again without naming it as a change.`;
    op.status='answering';
    store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths:foreign,reason:'outside this repository'});
    return 'shared-change-foreign';
  }
  if(ledgerPaths.length||graph.isReadOnly?.(op.kind)){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'ledger-path',detail:`${op.id} (${op.kind}) asked for a change the kernel will not delegate: ${ledgerPaths.length?ledgerPaths.join(', '):'a read-only kind requested a shared change'}: ${detail}`});
    store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths,reason:ledgerPaths.length?'ledger path':'read-only kind'});
    return 'shared-change-refused';
  }
  // A shared op that itself needs a shared change is a design problem, not a scheduling one: two levels deep it stops.
  if((op.sharedDepth??0)>=SHARED_DEPTH_LIMIT){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'shared-depth',detail:`${op.id} is a shared change ${op.sharedDepth} levels deep and still needs ${paths.join(', ')}: ${detail}`});
    store.appendEvent({event:'shared-change-depth',op:op.id,depth:op.sharedDepth,paths});
    return 'shared-change-depth';
  }
  const existing=state.ops.find(item=>sharedAlive(item)&&pathSetsOverlap(item.allowlist,paths));
  if(existing){
    existing.requesters=unique([...(existing.requesters??[]),op.id]);
    // A shared op that has not launched yet absorbs the new paths; one already running keeps its allowlist.
    if(['pending','ready','paused'].includes(existing.status))existing.allowlist=unique([...existing.allowlist,...paths]);
    store.appendEvent({event:'shared-change-merged',op:op.id,shared:existing.id,paths,
      allowlist:existing.allowlist,requesters:existing.requesters});
    pauseForShared(store,state,op,open,existing,`the shared change is made by ${existing.id}; continue your own allowlist afterwards`);
    return 'shared-change-merged';
  }
  if(sharedThisIteration(state)>=SHARED_OPS_PER_ITERATION){
    state.sharedQueue=[...(state.sharedQueue??[]),{op:op.id,paths,detail,open}];
    store.appendEvent({event:'shared-change-deferred',op:op.id,paths,cap:SHARED_OPS_PER_ITERATION});
    pauseForShared(store,state,op,open,null,`the shared change for ${paths.join(', ')} waits for a free shared slot`);
    return 'shared-change-deferred';
  }
  const shared=createSharedOp(store,state,op,detail,paths);
  pauseForShared(store,state,op,open,shared,`the shared change is made by ${shared.id}; continue your own allowlist afterwards`);
  return 'shared-change';
}

/** Queued shared requests are retried once per iteration, under the same merge rule and the same cap. */
export function drainSharedQueue(store,state){
  const queue=state.sharedQueue??[];
  if(!queue.length)return [];
  // Emptied first: a request the cap defers again re-queues itself through the same path.
  state.sharedQueue=[];
  const created=[];
  for(const request of queue){
    const op=byId(state,request.op);
    if(!op||op.status!=='paused')continue;
    if(requestSharedChange(store,state,op,request)==='shared-change')created.push(op.waitingFor);
  }
  return created;
}

/** A paused op returns to `ready` exactly when its shared op is done, carrying the head that proves it. */
export function resumePaused(store,state){
  const resumed=[];
  for(const op of state.ops.filter(item=>item.status==='paused'&&item.waitingFor)){
    const shared=byId(state,op.waitingFor);
    if(!shared)continue;
    if(shared.status==='done'){
      op.status='ready';op.attempt+=1;op.waitingFor=null;
      op.priorOpen=[`shared change ${shared.id} done at ${shared.head??state.head??'unknown'}`];
      op.dispatch=null;op.terminal=null;op.nudged=false;
      store.appendEvent({event:'shared-change-resumed',op:op.id,shared:shared.id,head:shared.head??state.head??null});
      resumed.push(op.id);
      continue;
    }
    if(['blocked','failed'].includes(shared.status)){
      op.status='blocked';op.waitingFor=null;
      state.needUser.push({op:op.id,kind:'shared-change',detail:`${op.id} waits for the shared change ${shared.id}, which is ${shared.status}`});
      store.appendEvent({event:'shared-change-blocked',op:op.id,shared:shared.id});
    }
  }
  return resumed;
}

function handleBlocked(store,state,op,report,ctx){
  const blocker=report.blocker??{kind:'environment',detail:report.summary};
  if(blocker.kind==='shared-change'){
    const named=ctx.guards.parseSharedChangePaths(`${blocker.detail} ${(report.open??[]).join(' ')}`)??[];
    const paths=unique(named.map(normalize)).filter(file=>!inside(file,op.allowlist));
    if(!paths.length){
      // No path, no shared op: this is a question to the kernel, and the kernel answers it in the terminal.
      const file=store.reportPath(op.dispatch);
      if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
      op.answer=`Your shared-change block named no repository path outside your allowlist. Name the exact paths you need changed, repository-relative, one per line, then report again.`;
      op.status='answering';
      store.appendEvent({event:'shared-change-unnamed',op:op.id,detail:blocker.detail});
      return 'shared-change-unnamed';
    }
    return requestSharedChange(store,state,op,{paths,detail:blocker.detail,open:[...(report.open??[])]});
  }
  // A frontend build that has no design to build from is drawn first, never guessed at.
  if(blocker.kind==='interface-gap'){
    reopenInterface(store,state,op,report,blocker,ctx);
    return 'interface-gap';
  }
  // A shape the installed grammar cannot render is grown into the grammar, once, never invented beside it.
  if(blocker.kind==='grammar-gap')return growGrammar(store,state,op,report,blocker,ctx);
  if(blocker.kind==='sds-gap'){
    if(ctx.work&&reopenArchitecture(store,state,op,report,ctx,blocker))return 'sds-gap';
    const design=unique([...state.inputs.filter(item=>item.kind==='sds').map(item=>item.ref),
      ...pathsIn(blocker.detail).filter(file=>/\.(md|yaml|yml|json)$/.test(file))]);
    if(!design.length){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'sds-gap',detail:`${blocker.detail} (no design input to change)`});
      return 'escalate-to-user';
    }
    // The same route, on a plan ledger: the design inputs are the allowlist, and the op is re-planned after.
    const route=routeOf({blocker:'sds-gap',kind:op.kind})??{kind:'architecture.revise',origin:'architecture',then:'reopen'};
    const architecture=addOp(store,state,{kind:routeKind(route,state,op)??'architecture.revise',
      goal:`Settle the design gap ${op.id} hit: ${blocker.detail}`,
      ledgerIds:op.ledgerIds,allowlist:design,references:op.references,checks:[],
      acceptance:[`the design records the decision for: ${blocker.detail}`],origin:route.origin??'architecture'},`sds-gap reported by ${op.id}`);
    op.needsReplan=true;
    reopenRequester(store,state,op,report.open,architecture,`the design gap is settled by ${architecture.id}; read the updated design first`);
    routed(store,op,'sds-gap',architecture.id,architecture.origin,{kind:architecture.kind,then:route.then});
    return 'sds-gap';
  }
  // `environment`, `authority` and anything the graph has no rule for: the user decides, the kernel does not guess.
  op.status='blocked';
  state.needUser.push({op:op.id,kind:blocker.kind,detail:blocker.detail});
  routed(store,op,blocker.kind,'needUser',null,{then:routeOf({blocker:blocker.kind,kind:op.kind})?.then??null});
  return 'escalate-to-user';
}

/** One accepted report, one deterministic action. `done` passes through machine verification and a commit. */
export function applyOpReport(orca,store,state,op,report,ctx){
  if(validatorOnlyBlock(report)){
    store.appendEvent({event:'validator-only-block',op:op.id,note:'treated as partial: the kernel owns work-valid'});
    report={...report,outcome:'partial',open:[...(report.open??[]),'previous attempt was blocked only by the whole-tree validator while a sibling wrote the ledger; the kernel validates at acceptance'],blocker:null,signal:{type:'worker_done',orcaOutcome:'succeeded'}};
  }
  const checked=validateReport(report,{allowlist:op.allowlist});
  op.reports.push({attempt:op.attempt,runtime:op.runtime,outcome:report.outcome,summary:report.summary,
    files:report.files,open:report.open,checks:report.checks,blocker:report.blocker,question:report.question,valid:checked.ok});
  if(!checked.ok){
    store.appendEvent({event:'report-rejected',op:op.id,errors:checked.errors});
    return retryOp(store,state,op,checked.errors.map(error=>`your previous report was rejected: ${error}`),ctx,'report-rejected');
  }
  store.appendEvent({event:'report',op:op.id,outcome:report.outcome,runtime:op.runtime,attempt:op.attempt});
  // The kernel-owned ledger paths are reverted before anything is verified, and writing them is never accepted.
  const touched=guardKernelPaths(store,state,op,ctx);
  if(touched.length){
    op.reports.at(-1).downgradedTo='failed';
    return retryOp(store,state,op,[`operation modified kernel-owned ledger paths: ${touched.join(', ')}`],ctx,'kernel-paths-modified');
  }
  // The record-authoring op holds its own node's index.yaml, so the blocks inside it the kernel owns are guarded
  // by comparison rather than by path. A changed block is the same refusal as a written kernel path.
  const blocks=guardRecordBlocks(store,state,op,ctx);
  if(blocks.length){
    op.reports.at(-1).downgradedTo='failed';
    return retryOp(store,state,op,[`operation modified kernel-owned fields (${RECORD_OWNED.join(', ')}) of the Work record it authors: ${blocks.join(', ')}`],ctx,'record-blocks-modified');
  }
  if(report.outcome==='done'){
    const verified=machineVerify(state,op,ctx);
    // `work-valid` is the kernel's own check and is stripped from every operation's list, so an op that edits the
    // tree is held to it here: the record it wrote must leave a tree that still validates, before anything is committed.
    if(op.kind===AUTHOR_KIND){
      const command=workValidateCommand(ctx);
      const tree=(()=>{try{return {ok:Boolean(ctx.work.validate({repoRoot:ctx.work.ledger?.repoRoot??ctx.work.repoRoot,workRoot:ctx.work.ledger?.workRoot??null}).ok),reason:null};}
        catch(error){return {ok:false,reason:error.message};}})();
      verified.checks.push({name:'work-valid',command,exitCode:tree.ok?0:1,evidence:tree.reason??''});
      if(!tree.ok){
        verified.ok=false;
        verified.failed=[...verified.failed,verified.checks.at(-1)];
      }
    }
    writeJson(store.checksPath(`${op.id}-kernel`),{schema:'starci/workflow-kernel-checks@1',op:op.id,attempt:op.attempt,
      runtime:op.runtime,checks:verified.checks,verifiedAt:Date.now()});
    if(!verified.ok){
      op.reports.at(-1).downgradedTo='failed';
      store.appendEvent({event:'machine-verify-failed',op:op.id,failed:verified.failed.map(check=>`${check.name}=${check.exitCode}`)});
      return retryOp(store,state,op,verified.failed.map(check=>`the kernel re-ran ${check.name} (\`${check.command}\`) and it exited ${check.exitCode}: ${check.evidence}`),ctx,'machine-verify-failed');
    }
    const files=changedFiles(state,op,ctx,op.allowlist,{exclude:op.kernelOwned??[]});
    // Proof by contrast: the specs this operation added must fail on the code it started from. A green check
    // alone is not evidence that the behavior changed.
    const plan=proofPlan(op,{changedFiles:files});
    if(plan.mode==='fail-before'&&op.baseHead){
      const proof=runAtBase({worktree:state.worktree,baseHead:op.baseHead,opHead:state.head??op.baseHead,specs:plan.specs,commands:plan.commands,git:ctx.git,exec:ctx.exec,timeoutMs:op.timeoutMs??CHECK_TIMEOUT_MS});
      op.proof={verdict:proof.verdict,reason:proof.reason??null,specs:plan.specs};
      store.appendEvent({event:'proof',op:op.id,verdict:proof.verdict,specs:plan.specs,reason:proof.reason??null});
      if(proof.verdict==='contradiction'){
        op.reports.at(-1).downgradedTo='failed';
        return retryOp(store,state,op,[proofFinding(proof)],ctx,'proof-contradiction');
      }
      if(proof.verdict==='weak'){const finding=proofFinding(proof);op.proofFindings=[...(op.proofFindings??[]),finding];state.needUser.push({op:op.id,kind:'proof',detail:finding});}
    }
    // The validator judges what the machine could not: a reject is a contradiction of the report, the op comes
    // back with the findings; a second reject of the same op stops it at the user instead of a third launch.
    const validation=validateAccepted(store,state,op,ctx,{files,verified});
    if(validation.verdict==='reject'){
      op.reports.at(-1).downgradedTo='failed';
      op.validatorRejects=(op.validatorRejects??0)+1;
      if(op.validatorRejects>=VALIDATOR_REJECT_LIMIT){
        op.status='blocked';
        state.needUser.push({op:op.id,kind:'validator',detail:`${op.id} was rejected by the validator ${op.validatorRejects} times: ${validation.findings[0]}`});
        store.appendEvent({event:'validator-exhausted',op:op.id,rejects:op.validatorRejects,findings:validation.findings.slice(0,3)});
        return 'validator-exhausted';
      }
      return retryOp(store,state,op,validation.findings,ctx,'validator-reject');
    }
    const commit=ctx.guards.gitQueue(()=>commitOp(state,op,files,ctx));
    if(!commit.committed&&files.length){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'environment',detail:`the work could not be committed: ${commit.reason}`});
      store.appendEvent({event:'commit-failed',op:op.id,reason:commit.reason,files});
      return 'commit-failed';
    }
    if(commit.head)state.head=commit.head;
    op.status='done';op.files=files;op.head=commit.head??state.head;op.verifiedChecks=verified.checks;
    // An author op closes no node: it completed a record, so what follows is the ledger's answer, not a completion.
    if(op.kind===AUTHOR_KIND){
      const settled=settleAuthoredRecord(store,state,op,ctx);
      store.appendEvent({event:'op-done',op:op.id,node:op.nodeId,runtime:op.runtime,head:op.head,files,
        checks:verified.checks.map(check=>`${check.name}=${check.exitCode}`),committed:commit.committed});
      ctx.guards.gitQueue(()=>cleanStrayFiles(store,state,op,ctx));
      if(ctx.orca)closeOpTerminal(ctx.orca,store,state,op);
      return settled;
    }
    if(op.kind==='review.verify'){
      const findings=reviewFindings(report);
      if(findings.length)return repairFromVerify(store,state,op,findings,ctx);
      op.verdict='pass';
    }
    // One accepted op is one lane step: the lane decides whether the node is told `in-progress` or `done`.
    const lanes=advanceLanes(store,state,op,ctx,verified);
    if(!lanes.handled){
      recordDone(store,state,op,ctx,verified);
      ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,op,ctx));
    }
    markLedger(state,op,op.head);
    store.appendEvent({event:'op-done',op:op.id,node:op.nodeId,runtime:op.runtime,head:op.head,files,
      checks:verified.checks.map(check=>`${check.name}=${check.exitCode}`),committed:commit.committed});
    if(ctx.orca)closeOpTerminal(ctx.orca,store,state,op);
    ctx.guards.gitQueue(()=>cleanStrayFiles(store,state,op,ctx));
    return 'done';
  }
  if(report.outcome==='partial'){
    if(op.kind==='review.verify'){op.status='done';op.verdict='fail';return repairFromVerify(store,state,op,reviewFindings(report),ctx);}
    return resumeOp(store,state,op,report,ctx);
  }
  if(report.outcome==='failed'){
    if(op.kind==='review.verify'){op.status='done';op.verdict='fail';return repairFromVerify(store,state,op,reviewFindings(report),ctx);}
    const failing=(report.checks??[]).filter(check=>check.exitCode!==0)
      .map(check=>`${check.name} failed (exit ${check.exitCode}): ${check.evidence??''}`);
    // A red UAT run is not retried against the same code: the lane's build step is repaired first.
    if(kindRole(op.kind)==='verify')return repairFromUat(store,state,op,failing.length?failing:reviewFindings(report),ctx);
    return retryOp(store,state,op,failing.length?failing:[report.summary],ctx,'failed');
  }
  if(report.outcome==='ask')return answerOrEscalate(orca,store,state,op,report,ctx);
  return handleBlocked(store,state,op,report,ctx);
}

const reviewFindings=report=>{
  const findings=Array.isArray(report.findings)&&report.findings.length?report.findings:report.open??[];
  return findings.map(item=>typeof item==='string'?item:JSON.stringify(item));
};

/** The review rounds one reviewed node set may use: the `review-findings` route's bound. */
const reviewRounds=()=>routeOf({verdict:'fail',kind:'review.verify'})?.limit??VERIFY_ROUNDS;

/** A review that found something becomes one repair operation; the next review is created when it is done. */
function repairFromVerify(store,state,op,findings,ctx){
  op.verdict='fail';
  const key=groupKey(state,op.ledgerIds);
  const route=routeOf({verdict:'fail',kind:op.kind})??{kind:'lane-build',origin:'repair',then:'retry',limit:VERIFY_ROUNDS};
  const rounds=Number.isFinite(route.limit)?route.limit:VERIFY_ROUNDS;
  for(const id of op.ledgerIds){const item=ledgerItem(state,id);if(item&&item.status==='verified')item.status='implemented';}
  if((state.verifyRounds[key]??1)>=rounds){
    state.needUser.push({op:op.id,kind:'review',detail:`${key} still fails review after ${rounds} rounds: ${findings[0]??'no finding text'}`});
    store.appendEvent({event:'verify-limit',op:op.id,component:key,findings:findings.slice(0,3)});
    return 'verify-limit';
  }
  if(!findings.length){
    state.needUser.push({op:op.id,kind:'review',detail:`${op.id} failed review without naming a finding`});
    return 'verify-without-findings';
  }
  const named=unique(findings.flatMap(pathsIn)).filter(file=>inside(file,op.allowlist));
  // The repair is the lane's build step, so a finding on frontend work comes back as frontend work.
  const repair=addOp(store,state,{kind:routeKind(route,state,op)??'backend.implement',
    goal:`Resolve the review findings of ${op.id}`,ledgerIds:op.ledgerIds,
    allowlist:named.length?named:op.allowlist,references:op.references,checks:op.checks,acceptance:op.acceptance,
    findings,origin:route.origin??'repair'},`review findings of ${op.id}`);
  store.appendEvent({event:'verify-findings',op:op.id,component:key,findings:findings.length,allowlist:named});
  routed(store,op,'review-findings',repair.id,repair.origin,{kind:repair.kind,limit:rounds,then:route.then});
  return 'repair-from-findings';
}

/**
 * A UAT run that came back red: the route turns it into a repair of the lane's build step, and the run itself
 * is reopened behind that repair instead of being retried against the code it already failed. It shares the
 * review-round counter, so a flow cannot bounce between build and UAT forever.
 */
function repairFromUat(store,state,op,findings,ctx){
  const key=groupKey(state,op.ledgerIds);
  const route=routeOf({outcome:'failed',kind:op.kind})??{kind:'lane-build',origin:'repair',then:'reopen',limit:VERIFY_ROUNDS};
  const rounds=Number.isFinite(route.limit)?route.limit:VERIFY_ROUNDS;
  op.verdict='fail';
  if((state.verifyRounds[key]??0)>=rounds){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'uat',detail:`${key} still fails UAT after ${rounds} rounds: ${findings[0]??'no finding text'}`});
    store.appendEvent({event:'uat-limit',op:op.id,component:key,findings:findings.slice(0,3)});
    return 'uat-limit';
  }
  state.verifyRounds[key]=(state.verifyRounds[key]??0)+1;
  const named=unique(findings.flatMap(pathsIn)).filter(file=>inside(file,op.allowlist));
  const repair=addOp(store,state,{kind:routeKind(route,state,op)??'frontend.implement',nodeId:op.nodeId,
    goal:`Fix what the UAT run ${op.id} found red: ${firstLine(findings[0]??'the flow does not pass')}`,
    ledgerIds:op.ledgerIds,allowlist:named.length?named:op.allowlist,references:op.references,
    checks:op.checks,acceptance:op.acceptance,findings,origin:route.origin??'repair'},`uat findings of ${op.id}`);
  reopenRequester(store,state,op,findings,repair,`the UAT repair ${repair.id} lands first; then run the flow again`);
  store.appendEvent({event:'uat-findings',op:op.id,component:key,round:state.verifyRounds[key],findings:findings.length});
  routed(store,op,'uat-failed',repair.id,repair.origin,{kind:repair.kind,limit:rounds,then:route.then});
  return 'repair-from-uat';
}

/* ------------------------------------------------------------------ accept, verify, gates */

/** The validator is the kernel's gate; an operation blocked only by it is resumed, never escalated as a shared change. */
function validatorOnlyBlock(report){
  if(report?.outcome!=='blocked'||report?.blocker?.kind!=='shared-change')return false;
  const failing=(report.checks??[]).filter(check=>check.exitCode!==0);
  return failing.length>0&&failing.every(check=>/work-valid/i.test(check.name??''))&&/\.starciwork|work-valid|validator/i.test(report.blocker.detail??'');
}

function acceptReports(orca,store,state,ctx){
  // The report file is the source of truth: a report whose Orca signal failed to send is still a report.
  const reports=store.readReports().filter(report=>report?.dispatch&&report?.outcome);
  const actions=[];
  for(const op of state.ops.filter(item=>item.status==='running')){
    const report=reports.find(item=>item.dispatch===op.dispatch);
    if(!report)continue;
    const dispatch=op.dispatch,runtime=op.runtime;
    const action=applyOpReport(orca,store,state,op,report,ctx);
    actions.push({op:op.id,action});
    state.stalls=0;
    if(op.status!=='answering'){
      ctx.allocator.release(runtime,{op:op.id});
      orca.invoke('worker-release',{dispatch},{cwd:state.worktree});
      sweepWorktree(orca,{cwd:state.worktree,from:state.from});
    }
  }
  return actions;
}

/**
 * What one review covers. On the Work ledger a review is per module, because that is the unit a reviewer can
 * judge as a whole; on a plan ledger it is the connected component of items an operation joined together.
 */
function verifyComponents(state,ready){
  if(state.ledgerMode===WORK_LEDGER){
    const groups=new Map();
    for(const id of ready){
      const key=ledgerItem(state,id)?.module??id;
      groups.set(key,(groups.get(key)??new Set()).add(id));
    }
    return [...groups.values()];
  }
  const components=[];
  for(const id of ready){
    const family=new Set(state.ops.filter(op=>implementsLedger(op)&&op.ledgerIds.includes(id)).flatMap(op=>op.ledgerIds).filter(other=>ready.includes(other)));
    family.add(id);
    const existing=components.find(component=>[...family].some(member=>component.has(member)));
    if(existing)for(const member of family)existing.add(member);
    else components.push(family);
  }
  return components;
}

/**
 * A lane proves itself with `review.verify` only when its template names that step and it has not run yet. A
 * frontend lane proves itself with its own `uat.verify` step instead, so no review is planned for it; an item
 * with no lane (a plan-ledger goal item) keeps the 4.x rule that every implemented item is reviewed.
 */
// A review is the LAST prove step of a lane: it is planned only when every step before it is accepted, so a
// backend node is reviewed after its e2e scenarios are green, never in parallel with them.
const laneWantsReview=(state,id,ctx=null)=>{
  const entry=state?.lanes?.[id];
  if(!entry?.lane?.length)return true;
  return entry.lane.includes('review.verify')&&laneNext(entry,lanePredicates(ctx,ctx?.work?.node?.(id)??null))==='review.verify';
};

/** A ledger group whose implementing operations are all done gets one independent review. */
function planVerifyOps(store,state,ctx){
  const ready=state.ledger.filter(item=>item.status==='implemented').map(item=>item.id)
    .filter(id=>laneWantsReview(state,id,ctx))
    .filter(id=>{
      const ops=state.ops.filter(op=>op.ledgerIds.includes(id));
      return ops.some(implementsLedger)&&ops.filter(implementsLedger).every(op=>op.status==='done')
        &&!ops.some(op=>op.kind==='review.verify'&&liveStatus.includes(op.status));
    });
  if(!ready.length)return [];
  const created=[];
  for(const component of verifyComponents(state,ready)){
    const ledgerIds=[...component].sort();
    const key=groupKey(state,ledgerIds);
    // The review of one group is bounded: past the last round the group waits for the user, it is not reviewed again.
    if((state.verifyRounds[key]??0)>=reviewRounds()){
      for(const id of ledgerIds){const item=ledgerItem(state,id);if(item)item.status='review-exhausted';}
      state.needUser.push({kind:'review',detail:`${key} used its ${reviewRounds()} review rounds and is implemented again; decide whether the last findings stand`});
      store.appendEvent({event:'verify-exhausted',component:key,rounds:state.verifyRounds[key]});
      continue;
    }
    const implementers=state.ops.filter(op=>implementsLedger(op)&&op.ledgerIds.some(id=>ledgerIds.includes(id)));
    state.verifyRounds[key]=(state.verifyRounds[key]??0)+1;
    const op=addOp(store,state,{kind:'review.verify',
      goal:`Verify, without repairing anything, that ${ledgerIds.map(id=>ledgerItem(state,id)?.title??id).join('; ')} is implemented as the goal requires. Report every finding in open[]; an empty open[] means you accept the work.`,
      ledgerIds,allowlist:unique(implementers.flatMap(item=>item.allowlist)),
      references:unique(implementers.flatMap(item=>item.references)),
      checks:dedupeChecks(implementers.flatMap(item=>item.checks)),
      acceptance:unique(implementers.flatMap(item=>item.acceptance)),
      avoidRuntimes:unique(implementers.map(item=>item.runtime).filter(Boolean)),origin:'verify'},
      `round ${state.verifyRounds[key]} of ${key}`);
    created.push(op.id);
  }
  return created;
}
const dedupeChecks=checks=>{const seen=new Map();for(const check of checks)if(!seen.has(check.command))seen.set(check.command,check);return [...seen.values()];};

/** The job gates are the kernel's own commands, never an operation's claim. A failing gate becomes one repair. */
export function runGates(store,state,ctx){
  if(!state.gates.length)return {ok:true,results:[]};
  const results=state.gates.map(gate=>{
    const result=ctx.exec(gate.command,{cwd:state.worktree,timeoutMs:gate.timeoutMs??CHECK_TIMEOUT_MS});
    const exitCode=Number.isInteger(result?.status)?result.status:1;
    return {name:gate.name,command:gate.command,exitCode,status:exitCode===0?'passed':'failed',evidence:tail(`${result?.stdout??''}${result?.stderr??''}`)};
  });
  state.gateResults=results;
  const failed=results.filter(result=>result.exitCode!==0);
  store.appendEvent({event:'gates',round:state.gateRounds,results:results.map(result=>`${result.name}=${result.exitCode}`)});
  if(!failed.length)return {ok:true,results};
  state.gateRounds+=1;
  if(state.gateRounds>GATE_ROUNDS){
    state.needUser.push({kind:'gate',detail:`${failed.map(result=>result.name).join(', ')} still fail after ${GATE_ROUNDS} repair rounds`});
    return {ok:false,repaired:false,results};
  }
  // The repair scope is the code every op touched - never the Work tree: a gate repair once carried `.starciwork`
  // paths from a design op's allowlist and committed a kernel block into a frontend record.
  addOp(store,state,{kind:'backend.implement',goal:`Make the job gates pass: ${failed.map(result=>result.name).join(', ')}`,
    ledgerIds:[],allowlist:unique(state.ops.flatMap(op=>op.allowlist)).filter(entry=>!/(^|\/)\.starciwork(\/|$)/.test(slash(entry))),references:[],
    checks:failed.map(result=>({name:result.name,command:result.command})),
    acceptance:failed.map(result=>`${result.name} exits 0`),
    findings:failed.map(result=>`${result.name} failed (exit ${result.exitCode}): ${result.evidence}`),origin:'gate'},
    `gate round ${state.gateRounds}`);
  return {ok:false,repaired:true,results};
}

/** Re-read the Work tree so the final report states what the ledger says now, not what it said at approval. */
function refreshLedgerSummary(state,ctx){
  if(!ctx?.work)return state.ledgerSummary;
  try{
    const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});
    state.ledgerSummary=ctx.work.api.ledgerSummary(loaded,{scope:state.scope.length?state.scope:null});
  }catch{/* a tree that cannot be re-read leaves the approved summary in place */}
  return state.ledgerSummary;
}

/**
 * A done workflow hands its lane back before it writes its final report: the outcome the report states is the
 * outcome after the merge, so a lane that cannot go home is `blocked` in the report and not `done` with a
 * footnote. A base worktree that is no longer on disk is not a failure - there is nothing to merge into, and
 * the branch is kept either way.
 */
function settleLane(store,state,outcome,ctx){
  if(outcome!=='done'||!plain(state.lane)||plain(state.lane.merged))return null;
  const base=state.lane.base?.worktree;
  if(!base||!fs.existsSync(base)){
    store.appendEvent({event:'lane-merge-skipped',id:state.id,branch:state.lane.branch,base:slash(base??''),
      reason:'the base worktree is not on disk'});
    return null;
  }
  const merged=mergeLane(store,state,ctx);
  if(merged.ok)return null;
  const detail=`the lane branch ${state.lane.branch} does not merge into ${state.lane.base.branch} in ${slash(base)}: ${merged.files.length?`conflicts in ${merged.files.join(', ')}`:firstLine(state.lane.conflict?.reason)||'git refused the merge'}; merge it by hand, then approve the workflow again`;
  if(!state.needUser.some(item=>item.kind==='merge'))state.needUser.push({kind:'merge',detail});
  return {outcome:'blocked',reason:detail};
}

function finish(store,state,outcome,reason=null,ctx=null){
  // The lane is merged first, because a refused merge changes the outcome this report states.
  const settled=settleLane(store,state,outcome,ctx);
  if(settled){outcome=settled.outcome;reason=settled.reason;}
  const final={schema:FINAL_REPORT,id:state.id,job:state.job,outcome,reason,branch:state.branch,head:state.head,
    lane:laneView(state),
    ledgerMode:state.ledgerMode,scope:state.scope,ledgerSummary:refreshLedgerSummary(state,ctx),decisions:state.decisions,brand:state.brand??null,
    ledgerRoot:state.ledgerRoot?slash(state.ledgerRoot):null,ledgerShared:Boolean(state.ledgerShared),ledgerOwner:state.ledgerOwner??null,
    definitionOfDone:state.definitionOfDone,
    ledger:state.ledger.map(item=>({...item})),
    acceptedAsPreexisting:state.ledger.filter(item=>item.status==='preexisting').map(item=>item.id),
    gates:state.gateResults.map(result=>({name:result.name,command:result.command,status:result.status,exitCode:result.exitCode})),
    needUser:state.needUser,
    ops:state.ops.map(op=>({id:op.id,kind:op.kind,node:op.nodeId,origin:op.origin,status:op.status,runtime:op.runtime,attempt:op.attempt,
      allowlist:op.allowlist,ledgerIds:op.ledgerIds,head:op.head,ledgerCommit:op.ledgerCommit??null,verdict:op.verdict,validation:op.validation??null,files:op.files})),
    iterations:state.iterations,finishedAt:Date.now()};
  writeJson(store.paths.final,final);
  state.finished={outcome,reason,report:store.paths.final};
  state.phase='finished';
  store.appendEvent({event:'finished',outcome,reason,ledger:state.ledger.map(item=>`${item.id}=${item.status}`)});
  store.saveState(state);
  return final;
}

/**
 * Nobody reports a rate limit: the runtime simply goes quiet. Two `stalled-silent` settlements of the same
 * runtime inside half an hour are read as exactly that, the allocator is told, and the window is cleared so
 * the inference needs two fresh silences before it fires again.
 */
function noteSilence(store,state,op,ctx){
  const runtime=op.runtime;
  if(!runtime)return false;
  const at=ctx.now();
  const window=[...(state.silences?.[runtime]??[]),at].filter(time=>at-time<=RATE_LIMIT_WINDOW_MS);
  state.silences={...(state.silences??{}),[runtime]:window};
  if(window.length<SILENCE_LIMIT)return false;
  ctx.allocator.failed(runtime,{reason:'rate-limited (inferred from repeated silence)',op:op.id});
  state.silences[runtime]=[];
  store.appendEvent({event:'rate-limit-inferred',op:op.id,runtime,silences:window.length,windowMs:RATE_LIMIT_WINDOW_MS});
  return true;
}

export function settleStalled(orca,store,state,ctx,tick){
  for(const op of state.ops.filter(item=>item.status==='running')){
    const observed=(tick.liveness??[]).find(item=>item.dispatch===op.dispatch);
    if(!observed)continue;
    if(observed.liveness==='stalled-idle'&&!op.nudged){
      notifyTerminal(orca,{cwd:state.worktree,terminal:op.terminal,wait:ctx.wait,
        text:'Continue; when you are finished report exactly once with the report command in your contract'});
      op.nudged=true;
      store.appendEvent({event:'nudged',op:op.id,liveness:observed.liveness});
      continue;
    }
    if(!['stalled-prompt','stalled-silent','stalled-idle','dead','rate-limited'].includes(observed.liveness))continue;
    settleDispatch(orca,op.dispatch,{cwd:state.worktree,reason:observed.liveness,terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(observed.liveness==='rate-limited'){ctx.allocator.failed(op.runtime,{reason:`rate-limited (${observed.reason??'provider screen'})`,op:op.id});store.appendEvent({event:'rate-limit-parked',op:op.id,runtime:op.runtime});}
    else ctx.allocator.release(op.runtime,{op:op.id});
    if(observed.liveness==='stalled-silent'&&noteSilence(store,state,op,ctx))op.avoidRuntimes=unique([...op.avoidRuntimes,op.runtime].filter(Boolean));
    op.restarts+=1;
    store.appendEvent({event:'settled',op:op.id,liveness:observed.liveness,restarts:op.restarts});
    noteAnomaly(store,state,`settled:${op.id}:${observed.liveness}`,{op:op.id,runtime:op.runtime,liveness:observed.liveness});
    triageAnomaly(store,state,`settled:${op.id}:${observed.liveness}`,{...ctx,orca});
    if(op.restarts>RESTART_LIMIT){
      op.status='blocked';
      if(observed.liveness==='rate-limited'){
        // A provider limit is time, not a defect: the op cools down and comes back on another runtime by itself.
        op.refusal='rate-limited';op.coolUntil=ctx.now()+RATE_LIMIT_COOLDOWN_MS;
        store.appendEvent({event:'rate-limit-cooling',op:op.id,runtime:op.runtime,until:op.coolUntil,restarts:op.restarts});
      }else state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} was restarted ${op.restarts} times (${observed.liveness})`});
      continue;
    }
    op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;op.avoidRuntimes=unique([...op.avoidRuntimes,op.runtime].filter(Boolean));
  }
}

function answerQuestions(orca,store,state,ctx){
  for(const op of state.ops.filter(item=>item.status==='answering')){
    const delivered=notifyTerminal(orca,{cwd:state.worktree,terminal:op.terminal,text:op.answer,wait:ctx.wait});
    store.appendEvent({event:'answered',op:op.id,delivered:delivered.delivered??null});
    op.status='running';
  }
}

/* ------------------------------------------------------------------ the loop */

/**
 * Phase `run`. One iteration: schedule every operation whose dependencies are done and whose allowlist is
 * free, wait one tick, accept the reports that arrived (machine verification, commit, ledger), create the
 * reviews and repairs the results imply, and - when nothing is left to run - run the job gates and finish.
 * Every iteration appends a `tick` event and saves state, so re-running `workflow-run` continues.
 */
/**
 * Reconcile the kernel's picture with Orca's: a live Dispatch of this Run that no operation names is an orphan
 * (a launch the kernel lost) and is settled; the check is cheap and runs at start and every RECONCILE_EVERY ticks.
 */
export const RECONCILE_EVERY=10;
/** The terminals Orca lists for a worktree, as `{handle,title}`; an unreachable Orca lists none. */
function listTerminals(orca,cwd){
  try{const listed=orca.invoke('terminal-list',{},{cwd});return listed.outcome==='ok'?(getPath(listed.receipt,'result.terminals')??[]).filter(plain):[];}catch{return [];}
}
const closeTerminal=(orca,cwd,handle)=>{try{const closed=orca.invoke('terminal-close',{terminal:handle},{cwd});return closed.outcome==='ok';}catch{return false;}};
/**
 * The kernel's own Orca terminal: the tab titled `[Kernel] <id>` in the worktree. One that already exists (a
 * previous start of this workflow) is reused and any duplicate is closed; none exists, one is created. A
 * process restart therefore never adds a tab.
 */
function ownKernelTerminal(orca,store,state,worktree){
  const title=`[Kernel] ${state.id}`;
  const mine=listTerminals(orca,worktree).filter(item=>item.title===title&&item.handle);
  for(const extra of mine.slice(1)){closeTerminal(orca,worktree,extra.handle);store.appendEvent({event:'kernel-terminal-closed',terminal:extra.handle,reason:'duplicate'});}
  if(mine[0]){store.appendEvent({event:'kernel-terminal',terminal:mine[0].handle,reused:true});return mine[0].handle;}
  const shell=process.platform==='win32'?'powershell -NoLogo':'bash';
  const created=orca.invoke('terminal-create',{worktree:`path:${path.resolve(worktree)}`,title,command:shell},{cwd:worktree});
  const handle=getPath(created.receipt,'result.terminal.handle')??null;
  need(handle,`The kernel could not open its own Orca terminal: ${created.reason??'terminal-create failed'}; pass --from <own terminal>`);
  store.appendEvent({event:'kernel-terminal',terminal:handle});
  return handle;
}
/**
 * An operation's terminal has no reader once its report is accepted: it is closed with the acceptance. A
 * blocked or failed op keeps its terminal, which is where its last words are. `sweepStaleTerminals` closes
 * what an older build or a lost kernel left behind: `[Op]` tabs of this workflow's done ops, and `[Kernel]` tabs
 * of this workflow that are not the one the kernel is in. Tabs of other workflows are never touched.
 */
function closeOpTerminal(orca,store,state,op){
  if(!op?.terminal)return;
  const handle=op.terminal;
  if(closeTerminal(orca,state.worktree,handle))store.appendEvent({event:'op-terminal-closed',op:op.id,terminal:handle});
  op.terminal=null;
}
export function sweepStaleTerminals(orca,store,state,{cwd=state.worktree}={}){
  const closed=[];
  const doneIds=new Set(state.ops.filter(op=>op.status==='done'||op.refusal==='superseded').map(op=>op.id));
  for(const item of listTerminals(orca,cwd)){
    const title=String(item.title??'');
    if(title===`[Kernel] ${state.id}`&&item.handle!==state.from){if(closeTerminal(orca,cwd,item.handle))closed.push({terminal:item.handle,reason:'stale kernel tab'});continue;}
    const op=title.startsWith('[Op] ')?title.slice(title.lastIndexOf(' - ')+3).trim():null;
    if(op&&doneIds.has(op)&&!state.ops.some(candidate=>candidate.terminal===item.handle&&liveStatus.includes(candidate.status))){
      if(closeTerminal(orca,cwd,item.handle))closed.push({terminal:item.handle,op,reason:'op done'});
    }
  }
  if(closed.length)store.appendEvent({event:'terminals-swept',closed});
  return closed;
}
export function reconcileWithOrca(orca,store,state,{cwd=state.worktree,wait=sleepSync,allocator=null}={}){
  const listed=orca.invoke('worker-list',{run:state.run},{cwd});
  if(listed.outcome!=='ok')return {orphans:[],dead:[],reason:listed.reason};
  const live=(getPath(listed.receipt,'result.workers')??[]).filter(w=>['ready','running','starting'].includes(w.workerState)||(w.workerState==='unsupervised'&&['dispatched','pending','ready'].includes(w.dispatchStatus)));
  const known=new Set(state.ops.map(op=>op.dispatch).filter(Boolean));
  const orphans=[];
  for(const worker of live){
    if(known.has(worker.dispatchId))continue;
    const settlement=settleDispatch(orca,worker.dispatchId,{cwd,reason:'orphan dispatch not named by any operation',terminalHandle:worker.agentTerminalHandle??null,closeTerminal:true,wait});
    orphans.push({dispatch:worker.dispatchId,terminal:worker.agentTerminalHandle??null,effectState:settlement.effectState});
  }
  if(orphans.length)store.appendEvent({event:'reconciled-orphans',orphans});
  // The other direction: an op the kernel believes is running, whose Dispatch Orca no longer lists and whose
  // terminal is gone, has no agent behind it. Nothing would ever observe it, so it is settled and queued again
  // here; a report file it left is not touched - acceptReports consumes that first.
  const terminals=orca.invoke('terminal-list',{},{cwd});
  const handles=new Set((getPath(terminals.receipt,'result.terminals')??[]).map(item=>item.handle).filter(Boolean));
  const liveDispatches=new Set(live.map(worker=>worker.dispatchId));
  const dead=[];
  if(terminals.outcome==='ok')for(const op of state.ops.filter(item=>item.status==='running'&&item.dispatch)){
    if(liveDispatches.has(op.dispatch)||(op.terminal&&handles.has(op.terminal)))continue;
    if(fs.existsSync(path.join(store.paths.reports,`${op.dispatch}.json`)))continue;
    const settlement=settleDispatch(orca,op.dispatch,{cwd,reason:'dead: no worker and no terminal',terminalHandle:op.terminal,closeTerminal:false,wait});
    if(allocator&&op.runtime)allocator.release(op.runtime,{op:op.id});
    op.restarts+=1;
    dead.push({op:op.id,dispatch:op.dispatch,terminal:op.terminal,runtime:op.runtime,effectState:settlement.effectState,restarts:op.restarts});
    if(op.restarts>RESTART_LIMIT){
      op.status='blocked';op.dispatch=null;op.terminal=null;
      state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} lost its agent ${op.restarts} times; the last terminal ${op.terminal??'?'} no longer exists`});
      continue;
    }
    op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;
  }
  if(dead.length)store.appendEvent({event:'reconciled-dead',dead});
  return {orphans,dead};
}

/**
 * Triage: the one place a model reads an anomaly the policy table could not classify. It is called only when
 * the same anomaly signature repeats, it may only pick from a closed option set, and every pick is recorded so
 * the next occurrence becomes a rule instead of another call.
 */
/** The decide role's preference starts with the supervisor runtimes that exist in the profile. */
const plainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function withSupervisorPreference(profile,runtimes){
  if(!profile||!plainObject(profile.runtimes))return profile;
  const known=runtimes.filter(id=>profile.runtimes[id]);
  if(!known.length)return profile;
  const copy=structuredClone(profile);
  copy.allocation=copy.allocation??{};copy.allocation.preference=copy.allocation.preference??{};
  copy.allocation.preference.decide=[...known,...((copy.allocation.preference.decide??[]).filter(id=>!known.includes(id)))];
  return copy;
}
export const DEFAULT_SUPERVISOR_RUNTIMES=['claude-fable-5.1','gpt-6-astra'];
/** `<host>/config.json` may set `critique.runtimes`: the critics every goal is challenged on, first answer wins. Astra first by default: one call per goal, and Fable's week is the scarcer window. */
export function critiqueRuntimes(host){
  try{
    const config=JSON.parse(fs.readFileSync(path.join(host,'config.json'),'utf8'));
    const listed=Array.isArray(config?.critique?.runtimes)?config.critique.runtimes:typeof config?.critique==='string'?[config.critique]:null;
    const runtimes=(listed??[]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());
    return runtimes.length?runtimes:llm.DEFAULT_CRITIC_RUNTIMES;
  }catch{return llm.DEFAULT_CRITIC_RUNTIMES;}
}
/** `<host>/config.json` may set `supervisor.runtimes`: the models triage and decide operations prefer, strongest first. */
export function supervisorRuntimes(host){
  try{
    const config=JSON.parse(fs.readFileSync(path.join(host,'config.json'),'utf8'));
    const listed=Array.isArray(config?.supervisor?.runtimes)?config.supervisor.runtimes:typeof config?.supervisor==='string'?[config.supervisor]:null;
    const runtimes=(listed??[]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());
    return runtimes.length?runtimes:DEFAULT_SUPERVISOR_RUNTIMES;
  }catch{return DEFAULT_SUPERVISOR_RUNTIMES;}
}
/** `<host>/config.json` may set `validator.runtimes`: the providers the one validator of a workflow is called on, in order. */
export function validatorRuntimes(host){
  try{
    const config=JSON.parse(fs.readFileSync(path.join(host,'config.json'),'utf8'));
    const listed=Array.isArray(config?.validator?.runtimes)?config.validator.runtimes:typeof config?.validator==='string'?[config.validator]:null;
    const runtimes=(listed??[]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());
    return runtimes.length?runtimes:llm.DEFAULT_VALIDATOR_RUNTIMES;
  }catch{return llm.DEFAULT_VALIDATOR_RUNTIMES;}
}
/**
 * The task spec travels on one Orca command line, and Windows bounds a command line near 32k characters: a
 * 142-file allowlist once made `task-create` fail with ENAMETOOLONG and took the kernel down with it. A contract
 * past this length is handed over as its head plus where the whole of it is, and the agent reads the file.
 */
export const SPEC_LIMIT=12000;
export function operationSpec(op,contract){
  const text=String(contract??'');
  if(text.length<=SPEC_LIMIT)return text;
  const file=slash(String(op?.contractFile??''));
  const head=text.slice(0,SPEC_LIMIT-900);
  return `${head}\n\n[...]\n\nThis contract is longer than a task can carry (${text.length} characters). The COMPLETE contract - the allowlist, the working order, the report command and every rule after this point - is in the file \`${file}\`. Read that file in full before you do anything: it is the task, and a rule you did not read still binds you.`;
}
export const TRIAGE_AFTER=3;
/**
 * One stage of an iteration that throws is recorded (`kernel-error`) and the loop goes on; the same stage
 * failing this many times in a row stops the workflow for the user instead of letting a supervisor restart a
 * kernel that dies at the same line every minute.
 */
export const KERNEL_ERROR_LIMIT=5;
/** How long an op blocked by a provider rate limit waits before it is re-admitted on another runtime. */
export const RATE_LIMIT_COOLDOWN_MS=60*60*1000;
/**
 * An op the restart limit blocked for a rate limit is not the user's question: once its cooldown has passed it is
 * ready again with its restarts cleared and the limited runtime avoided. An op blocked by an older build - a
 * `restarted N times (rate-limited)` question with no cooldown recorded - is given one at load and released the
 * same way, and its question goes.
 */
function readmitCooled(store,state,ctx){
  const now=typeof ctx?.now==='function'?ctx.now():Date.now();
  for(const item of state.needUser.filter(entry=>entry.kind==='environment'&&/\(rate-limited\)$/.test(String(entry.detail??'')))){
    const op=state.ops.find(candidate=>candidate.id===item.op);
    if(!op||op.status!=='blocked'||op.refusal)continue;
    op.refusal='rate-limited';op.coolUntil=now;
    state.needUser=state.needUser.filter(entry=>entry!==item);
    store.appendEvent({event:'rate-limit-cooling',op:op.id,runtime:op.runtime,until:op.coolUntil,restarts:op.restarts,migrated:true});
  }
  for(const op of state.ops.filter(candidate=>candidate.status==='blocked'&&candidate.refusal==='rate-limited')){
    if(!(Number(op.coolUntil??0)<=now))continue;
    const limited=op.runtime;
    op.status='ready';op.refusal=null;op.coolUntil=null;op.restarts=0;op.dispatch=null;op.terminal=null;op.nudged=false;
    op.avoidRuntimes=unique([...(op.avoidRuntimes??[]),limited].filter(Boolean));
    store.appendEvent({event:'rate-limit-readmitted',op:op.id,avoid:op.avoidRuntimes});
  }
}
function guardedStage(store,state,ctx,stage,fn){
  try{fn();state.kernelErrors=0;return 'ok';}
  catch(error){
    const message=String(error?.stack??error?.message??error).slice(0,600);
    state.kernelErrors=(state.kernelErrors??0)+1;
    store.appendEvent({event:'kernel-error',stage,count:state.kernelErrors,message});
    if(state.kernelErrors<KERNEL_ERROR_LIMIT){store.saveState(state);return 'error';}
    state.needUser.push({kind:'environment',detail:`the kernel failed ${state.kernelErrors} times in a row at ${stage}: ${String(error?.message??error).slice(0,240)}`});
    finish(store,state,'blocked',`the kernel keeps failing at ${stage}`,ctx);
    return 'stop';
  }
}
export const TRIAGE_OPTIONS=['resume-ops','park-runtime','settle-op','restart-kernel','needUser'];
export function noteAnomaly(store,state,signature,detail){
  state.anomalies=state.anomalies??{};
  const entry=state.anomalies[signature]=state.anomalies[signature]??{count:0,detail,firstAt:Date.now(),triaged:null};
  entry.count+=1;entry.lastAt=Date.now();
  return entry;
}
export function triageAnomaly(store,state,signature,ctx){
  const entry=state.anomalies?.[signature];
  if(!entry||entry.count<TRIAGE_AFTER||entry.triaged||typeof ctx.decide!=='function')return null;
  const chosen=ctx.decide({situation:`Anomaly repeated ${entry.count} times: ${signature}`,options:TRIAGE_OPTIONS,providers:ctx.supervisor??DEFAULT_SUPERVISOR_RUNTIMES,
    context:{detail:entry.detail,recentEvents:store.readEvents({since:Math.max(0,(store.readEvents().at(-1)?.seq??0)-40)}).map(e=>`${e.event}${e.op?` ${e.op}`:''}${e.reason?` ${String(e.reason).slice(0,80)}`:''}`),ops:state.ops.map(op=>`${op.id}=${op.status}`)},cwd:state.worktree});
  const option=chosen?.ok&&TRIAGE_OPTIONS.includes(chosen.value.option)?chosen.value.option:'needUser';
  entry.triaged={option,rationale:chosen?.ok?chosen.value.rationale:null,at:Date.now()};
  store.appendEvent({event:'triage',signature,option,rationale:entry.triaged.rationale,count:entry.count});
  // Resume only what a transient cause blocked: an op with a refusal (out of repository, superseded, dynamic budget) stays blocked whatever the anomaly.
  if(option==='resume-ops'){for(const op of state.ops)if(op.status==='blocked'&&!op.refusal){op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='park-runtime'){const runtime=entry.detail?.runtime;if(runtime)ctx.allocator.failed(runtime,{reason:`triage: ${signature}`});}
  else if(option==='settle-op'){const op=state.ops.find(item=>item.id===entry.detail?.op&&item.status==='running');if(op){settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'triage',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='restart-kernel'){fs.writeFileSync(path.join(store.dir,'stop.flag'),'triage restart');}
  else state.needUser.push({kind:'triage',detail:`${signature}: ${JSON.stringify(entry.detail).slice(0,300)}`});
  return option;
}

export function runLoop(orca,store,state,{cwd=state.worktree,allocator,planOp=llm.planOp,decide=llm.decide,validateOp=llm.validateOp,template,supervisor=null,validator=null,
  wait=sleepSync,exec=runCommand,git=spawnSync,launch=launchWithCandidate,maxIterations=Infinity,guards=kernelGuards,
  ledgerApi=work,validate=validateWorkTree,ledgerRoot=null,resolveLedger=resolveLedgerRoot,
  waitTimeoutMs=900000,tickMs=120000,pollMs=POLL_MS,now=Date.now}={}){
  need(state.approved,`Workflow ${state.id} is not approved; run workflow-approve --id ${state.id}`);
  need(plain(allocator),'A runtime allocator is required');
  need(typeof template==='string'&&template.trim(),'The operation contract template is required');
  required(state.run,'Orca run id');required(state.from,'own terminal handle');
  // `validateOp:null` is an explicit choice to run without the validator; it is recorded once as `validator-skipped`.
  const ctx={cwd,allocator,planOp,decide,validateOp,template,wait,exec,git,launch,now,guards,work:null,orca,
    supervisor:supervisor??supervisorRuntimes(state.host??''),validator:validator??validatorRuntimes(state.host??'')};
  // A state written before these bounds existed resumes with them.
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  state.dynamicOpsBudget=dynamicBudget(state);
  // The budget counts only shared and repair ops; a kernel-origin op an older build refused under it is superseded,
  // never reinstated by --allow-dynamic, and its needUser item goes with it.
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  for(const op of state.ops)if(!countsAgainstBudget(op)&&op.refusal==='dynamic-op'){op.refusal='superseded';state.needUser=state.needUser.filter(item=>item.op!==op.id||item.kind!=='dynamic-op');}
  // An op the validator exhausted gets one more round on a fresh kernel start: the validator's rules may have changed.
  for(const op of state.ops)if(op.status==='blocked'&&!op.refusal&&(op.validatorRejects??0)>=validatorRejectLimit()&&!op.validatorReset){op.status='ready';op.validatorRejects=0;op.validatorReset=true;op.dispatch=null;op.terminal=null;state.needUser=state.needUser.filter(item=>!(item.op===op.id&&item.kind==='validator'));}
  state.sharedQueue=Array.isArray(state.sharedQueue)?state.sharedQueue:[];
  state.silences=plain(state.silences)?state.silences:{};
  state.lanes=plain(state.lanes)?state.lanes:{};
  // A kind graph that cannot be read is not fatal - lanes simply do not apply - but it is never silent.
  const graphProblems=(()=>{try{return graph.validateGraph().map(item=>typeof item==='string'?item:`${item.code??'graph'}: ${item.message??JSON.stringify(item)}`);}catch(error){return [error.message];}})();
  if(graphProblems.length)store.appendEvent({event:'kind-graph-problem',problems:graphProblems.slice(0,5)});
  // The worktree itself is a precondition: long paths, the hooks env for kernel commits, the autocrlf state.
  const checked=guards.preflight({worktree:state.worktree,git})??{};
  state.preflight={ok:Boolean(checked.ok),fixes:[...(checked.fixes??[])],problems:[...(checked.problems??[])]};
  store.appendEvent({event:'preflight',ok:state.preflight.ok,fixes:state.preflight.fixes,problems:state.preflight.problems});
  for(const problem of state.preflight.problems)
    if(!state.needUser.some(item=>item.kind==='environment'&&item.detail===problem))
      state.needUser.push({kind:'environment',detail:problem});
  if(state.ledgerMode===WORK_LEDGER){
    // The Work tree is read once per run: every write below goes back into the node the operation closes.
    const repoRoot=state.repoRoot??repositoryRoot(state.worktree);
    state.repoRoot=repoRoot;
    // Two repositories, two jobs: the code is written, checked and committed here, and the Work is read and
    // recorded in the repository that owns the tree - which is this one unless the product routes it elsewhere.
    const binding=ledgerBinding(state,{repoRoot,host:state.host,ledgerRoot,git:ctx.git,resolve:resolveLedger});
    const at={repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot};
    const loaded=ledgerApi.loadLedger({...at,validate});
    // The kernel block is part of a node's semantic digest, so a completion must bind the digest the
    // validator reports AFTER that block is written: every transition resolves it through this reader.
    const digest=({node})=>{
      const fresh=ledgerApi.loadLedger({...at,validate}).nodes.get(node.id)?.inputDigest;
      need(/^[a-f0-9]{64}$/.test(String(fresh??'')),`The Work validator reports no inputDigest for ${node.id}`);
      return fresh;
    };
    const remote=ctx.git('git',['remote','get-url','origin'],{cwd:repoRoot,encoding:'utf8',windowsHide:true});
    const origin=remote.status===0?ledgerApi.normalizeOrigin?.((remote.stdout??'').trim())??null:null;
    // `code` identifies the slice every receipt names; `ledger` is where the record is written. They are the
    // same repository in a single-repository job, and `repoRoot`/`origin`/`repository` keep the old meaning:
    // the ledger is read at `repoRoot`, the code is named by `repository` at `origin`.
    const code={repoRoot,origin,repository:ledgerApi.repositoryName?.(repoRoot)??null};
    const ledger={repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot,
      repository:binding.ownerRepository??ledgerApi.repositoryName?.(binding.ownerRepoRoot)??null};
    const shared=binding.sharedLedger?{owner:ledger.repository??slash(ledger.repoRoot),root:slash(ledger.workRoot)}:null;
    ctx.work={api:ledgerApi,loaded,validate,digest,node:id=>loaded.nodes.get(id)??null,
      code,ledger,at,shared:Boolean(shared),side:binding.side??null,source:binding.source,
      // The repositories of the product by role, and the one optional role the kernel routes to itself: the
      // grammar. Null when the binding declares none, which is a question for the user, never a guessed root.
      roles:plain(binding.roles)?binding.roles:null,grammar:grammarRepository(binding.roles),
      repoRoot:ledger.repoRoot,workRoot:ledger.workRoot,origin:code.origin,repository:code.repository};
    repairKernelRecords(store,state,ctx,loaded);
    retemplateLanes(store,state,loaded);
    pruneAnsweredQuestions(store,state,loaded);
    // The brand of this tree, as it stands at the start of the run: every design contract prints it from here.
    noteBrand(store,state,loaded,{silent:true});
    store.appendEvent({event:'ledger-loaded',workRoot:slash(loaded.workRoot),valid:loaded.ok,nodes:loaded.list.length,
      scope:state.scope,source:binding.source,code:code.repository,...(shared?{'ledger-shared':shared}:{})});
    // A shared tree is somebody else's working copy: the kernel commits into it, so it refuses to start over
    // a pending change it does not own rather than sweep that change into a `work(...)` commit.
    if(shared){
      const status=sharedLedgerStatus({ownerRepoRoot:ledger.repoRoot,ledgerRoot:ledger.workRoot,git:ctx.git});
      if(status.strays?.length)store.appendEvent({event:'ledger-shared-strays',owner:shared.owner,root:shared.root,strays:status.strays});
      if(!status.ok){
        // Not a finish: the pending change is somebody's work in progress, so this kernel steps back and the
        // supervisor tries again next round; the item stays in needUser until the owner commits or drops it.
        const detail=`the Work ledger ${shared.root} is owned by ${shared.owner} and carries uncommitted changes the kernel does not own: ${status.foreign.slice(0,12).join(', ')}`;
        if(!state.needUser.some(item=>item.kind==='ledger'&&item.detail===detail))state.needUser.push({kind:'ledger',detail});
        store.appendEvent({event:'ledger-shared-dirty',owner:shared.owner,root:shared.root,foreign:status.foreign});
        store.appendEvent({event:'preflight-blocked',reason:'the shared Work ledger carries uncommitted changes the kernel does not own'});
        store.saveState(state);
        return state;
      }
    }
  }
  // Operations created before a rule change carry their old check lists: the kernel-owned checks are stripped on load.
  for(const op of state.ops)if(Array.isArray(op.checks))op.checks=op.checks.filter(check=>!KERNEL_CHECK.test(check.name??''));
  reconcileWithOrca(orca,store,state,{cwd,wait,allocator});
  // The shared runtime ledger is a repository-wide file: this kernel's own entries for operations that are no
  // longer running are leftovers of a crashed start and would hold a slot of an expensive runtime for everybody.
  const swept=allocator.sharedSync?.(state.ops.filter(op=>op.status==='running').map(op=>op.id));
  if(swept?.dropped?.length)store.appendEvent({event:'runtime-loads-swept',dropped:swept.dropped});
  sweepTreeStrays(store,state,ctx);
  sweepStaleTerminals(orca,store,state,{cwd});
  state.buildStamp=buildStamp();
  for(let iteration=0;iteration<maxIterations&&!state.finished;iteration+=1){
    if(iteration>0&&iteration%RECONCILE_EVERY===0){reconcileWithOrca(orca,store,state,{cwd,wait,allocator});sweepTreeStrays(store,state,ctx);sweepStaleTerminals(orca,store,state,{cwd});}
    if(stopRequested(store)){store.appendEvent({event:'stopped',reason:'stop flag'});store.saveState(state);return state;}
    applyInbox(store,state,ctx);
    if(state.restartRequested){const reason=state.restartRequested;state.restartRequested=null;store.appendEvent({event:'stopped',reason:`restart: ${reason}`});store.saveState(state);return state;}
    if(state.buildStamp&&buildStamp()&&buildStamp()!==state.buildStamp){store.appendEvent({event:'build-changed',from:state.buildStamp,to:buildStamp()});store.appendEvent({event:'stopped',reason:'build changed'});store.saveState(state);return state;}
    state.iterations+=1;
    store.appendEvent({event:'tick',iteration:state.iterations,
      ops:state.ops.map(op=>`${op.id}=${op.status}`),ledger:state.ledger.map(item=>`${item.id}=${item.status}`)});
    answerQuestions(orca,store,state,ctx);
    refuseForeignShared(store,state,{...ctx,orca});
    readmitCooled(store,state,ctx);
    resumePaused(store,state);
    drainSharedQueue(store,state);
    if(guardedStage(store,state,ctx,'sync',()=>{syncLedgerOps(store,state,ctx);planVerifyOps(store,state,ctx);})==='stop')break;
    if(guardedStage(store,state,ctx,'schedule',()=>scheduleOps(orca,store,state,ctx))==='stop')break;
    state.allocation=typeof allocator.serialize==='function'?allocator.serialize():allocator.snapshot?.()??null;
    // A provider limit another kernel ran into is this kernel's limit too; it is recorded once, when it is learned.
    for(const notice of allocator.takeSharedNotices?.()??[])
      store.appendEvent({event:'runtime-cooling-shared',runtime:notice.runtime,until:notice.until,wakeAt:notice.wakeAt,from:notice.from,reason:notice.reason??null});
    const running=state.ops.filter(op=>op.status==='running');
    // Fast path: an operation whose report is already on disk is accepted before any blocking wait.
    let early=null;
    if(guardedStage(store,state,ctx,'accept',()=>{early=acceptReports(orca,store,state,ctx);})==='stop')break;
    if(Array.isArray(early)&&early.length){store.appendEvent({event:'accepted-early',ops:early.map(item=>item.op)});store.saveState(state);continue;}
    if(running.length){
      const tick=waitTick(orca,{cwd:state.worktree,run:state.run,from:state.from,timeoutMs:waitTimeoutMs,tickMs,
        reportsDir:store.paths.reports,now,wait});
      if(tick.event==='check-failed'){noteAnomaly(store,state,`check-failed:${tick.check?.reason??'unknown'}`,{reason:tick.check?.reason??null});triageAnomaly(store,state,`check-failed:${tick.check?.reason??'unknown'}`,{...ctx,orca});}
    store.appendEvent({event:'wait',result:tick.event,ticks:tick.ticks,
        liveness:(tick.liveness??[]).map(item=>`${item.dispatch}:${item.liveness}`)});
      if(guardedStage(store,state,ctx,'accept',()=>acceptReports(orca,store,state,ctx))==='stop')break;
      settleStalled(orca,store,state,ctx,tick);
      store.saveState(state);
      continue;
    }
    if(state.ops.some(op=>liveStatus.includes(op.status))){
      // Nothing could be launched and nothing is running: every runtime is busy, cooling or out of budget.
      state.stalls+=1;
      state.stalledSince=state.stalledSince??now();
      store.appendEvent({event:'stalled',stalls:state.stalls,since:state.stalledSince,allocation:state.allocation});
      if(now()-state.stalledSince>=STALL_MS){
        state.needUser.push({kind:'environment',detail:`no runtime accepted an operation for ${Math.round((now()-state.stalledSince)/60000)} minutes (${state.stalls} attempts)`});
        finish(store,state,'blocked','no runtime accepted an operation',ctx);
        break;
      }
      store.saveState(state);
      wait(pollMs);
      continue;
    }
    const gate=runGates(store,state,ctx);
    if(gate.ok){
      const unverified=state.ledger.filter(item=>!['verified','preexisting'].includes(item.status));
      if(unverified.length)state.needUser.push({kind:'ledger',detail:`never verified: ${unverified.map(item=>`${item.id} (${item.status})`).join(', ')}`});
      finish(store,state,state.needUser.length?'blocked':'done',state.needUser.length?'the policy could not settle every goal item':null,ctx);
      break;
    }
    if(!gate.repaired){finish(store,state,'blocked','the job gates still fail',ctx);break;}
    store.saveState(state);
  }
  store.saveState(state);
  return state;
}

/* ------------------------------------------------------------------ cli */

/** Wait for the launch handle the terminal's creator writes (own handle, optional Orca run). */
export function awaitLaunch(file,{wait=sleepSync,timeoutMs=LAUNCH_WAIT_MS,intervalMs=2000,now=Date.now}={}){
  const started=now();
  for(;;){
    const launch=readJson(file,null);
    if(launch?.from)return launch;
    need(now()-started<=timeoutMs,`No launch handle in ${slash(file)} within ${timeoutMs} ms; pass --from <own terminal>`);
    wait(intervalMs);
  }
}

/**
 * A resumed kernel is expected to be the terminal Orca bound as the Run's coordinator; only that terminal may
 * launch operations. When the tab is gone (closed by a person, or by an older build) and the kernel opened a
 * new one, the Run is re-bound to it once - which fences the live Dispatches of the old tab, so the reconcile
 * that follows settles them - and the event says so. A matching coordinator changes nothing.
 */
export function rebindRunIfNeeded(orca,store,state,{cwd}){
  if(!state.run||!state.from)return false;
  let coordinator=null;
  try{const shown=orca.invoke('run-show',{id:state.run},{cwd});coordinator=getPath(shown.receipt,'result.run.coordinator_handle')??null;}catch{return false;}
  if(!coordinator||coordinator===state.from)return false;
  const bound=orca.invoke('run-use',{id:state.run,from:state.from},{cwd});
  store.appendEvent({event:'run-rebound',run:state.run,from:state.from,was:coordinator,ok:bound.outcome==='ok',...(bound.outcome==='ok'?{}:{reason:bound.reason??null})});
  return bound.outcome==='ok';
}
function bindRun(orca,{cwd,state,from}){
  const created=orca.invoke('run-create',{objective:`Workflow ${state.id}: ${firstLine(state.job)}`,from},{cwd});
  need(created.outcome==='ok',`run-create failed: ${created.reason}`);
  const run=getPath(created.receipt,'result.run.id');
  const shownRun=orca.invoke('run-show',{id:run},{cwd});
  const coordinator=getPath(shownRun.receipt,'result.run.coordinator_handle')??null;
  if(coordinator!==from){
    // Binding is a one-time hand-off: a repeated run-use from the same terminal bumps Orca's consumer generation
    // and invalidates every live Dispatch of the Run, so a resumed kernel never re-binds.
    const bound=orca.invoke('run-use',{id:run,from},{cwd});
    need(bound.outcome==='ok',`run-use failed: ${bound.reason}`);
  }
  return run;
}

const hostOf=(options,repoRoot)=>path.resolve(options.host??path.join(repoRoot,'.claude'));
const launcherOf=host=>slash(path.join(host,'.dist','execution','orca-supervised-launch.mjs'));
const templateOf=host=>fs.readFileSync(path.join(host,'docs','supervision-templates','op.md'),'utf8');

/**
 * The four commands of the runtime, as the canonical launcher routes them. `functions` is the injection
 * seam for the model functions and the process helpers, so the command path is testable without a provider.
 */
/** `--allocation gpt-5.6-sol=5,claude-opus=3,qwen3.8-flash=2`: slots per runtime in priority order. */
export function parseQuota(value){
  if(!value)return null;
  const order=[],slots={},tags={};
  for(const entry of String(value).split(',').map(item=>item.trim()).filter(Boolean)){
    const [id,rest]=entry.split('=');
    const [n,tagText]=String(rest??'').split(':');
    need(id&&Number.isFinite(Number(n)),`--allocation entries are <runtime>=<slots>[:<easy+medium+hard>]: ${entry}`);
    const runtime=id.trim();
    order.push(runtime);slots[runtime]=Number(n);
    const levels=String(tagText??'').split('+').map(level=>level.trim()).filter(Boolean);
    for(const level of levels)need(['easy','medium','hard'].includes(level),`--allocation difficulty tags are easy|medium|hard: ${entry}`);
    if(levels.length)tags[runtime]=levels;
  }
  return {order,slots,tags,total:Object.values(slots).reduce((a,b)=>a+b,0)};
}

/** One kernel per workflow: a pid lock in the store refuses a second process; a stop flag ends the loop cleanly. */
function acquireKernelLock(store){
  const lock=path.join(store.dir,'kernel.lock');
  const existing=(()=>{try{return JSON.parse(fs.readFileSync(lock,'utf8'));}catch{return null;}})();
  if(existing?.pid&&existing.pid!==process.pid){
    let alive=false;try{process.kill(existing.pid,0);alive=true;}catch{alive=false;}
    need(!alive,`Another kernel (pid ${existing.pid}) already runs workflow ${store.id}; run workflow-stop first`);
  }
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:Date.now()}));
  return ()=>{try{const now=JSON.parse(fs.readFileSync(lock,'utf8'));if(now.pid===process.pid)fs.rmSync(lock);}catch{}};
}
export function stopRequested(store){return fs.existsSync(path.join(store.dir,'stop.flag'));}
/** Whether the kernel of this store is a live process, by its lock. */
export function kernelAlive(store){
  const lock=readJson(path.join(store.dir,'kernel.lock'),null);
  const pid=Number(lock?.pid);
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}catch{return false;}
}
/**
 * A command for a running kernel is a file in the store's inbox, never a write to its state: the kernel holds
 * the state in memory and would save over the change at its next tick. The kernel applies inbox commands at the
 * start of every iteration, in order, and records each (`inbox-applied`).
 */
export function queueInbox(store,command){
  const file=path.join(store.paths.inbox,`${Date.now()}-${Math.random().toString(16).slice(2,8)}.json`);
  fs.writeFileSync(file,JSON.stringify({...command,at:new Date().toISOString()}));
  return file;
}
function applyInbox(store,state,ctx){
  let files=[];
  try{files=fs.readdirSync(store.paths.inbox).filter(name=>name.endsWith('.json')).sort();}catch{return;}
  for(const name of files){
    const file=path.join(store.paths.inbox,name);
    let command=null;
    try{command=JSON.parse(fs.readFileSync(file,'utf8'));}catch{command=null;}
    try{fs.rmSync(file,{force:true});}catch{}
    if(!plain(command))continue;
    if(command.kind==='approve'){
      const before={budget:dynamicBudget(state),quota:JSON.stringify(state.quota??null)};
      approve(store,state,{allocation:command.allocation??null,allowDynamic:command.allowDynamic??null,acceptCritique:command.acceptCritique??null});
      const quotaChanged=JSON.stringify(state.quota??null)!==before.quota;
      store.appendEvent({event:'inbox-applied',kind:'approve',allocation:command.allocation??null,allowDynamic:command.allowDynamic??null,budget:{from:before.budget,to:dynamicBudget(state)},quotaChanged});
      // The allocator was built from the quota at start: a new allocation takes effect at the next kernel start,
      // which the supervisor gives within a minute once this loop returns.
      if(quotaChanged)state.restartRequested='allocation changed';
    }else store.appendEvent({event:'inbox-ignored',kind:command.kind??null});
  }
}
/**
 * The kernel loads its code once; a rebuild of the runtime is a new kernel. Every tick compares the module's
 * modification time with the one recorded at start, and a change ends the loop cleanly (`build-changed`) so the
 * supervisor starts the new code within a minute - no stop flag, no hand restart.
 */
const KERNEL_MODULE=(()=>{try{return new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');}catch{return null;}})();
export function buildStamp(){try{return KERNEL_MODULE?Math.round(fs.statSync(KERNEL_MODULE).mtimeMs):null;}catch{return null;}}

export function kernelMain(command,options={},{orca,cwd=process.cwd(),wait=sleepSync,functions={}}={}){
  const worktree=path.resolve(cwd);
  const repoRoot=repositoryRoot(worktree);
  // The ledger a job works decides where its own runtime state lives too: a repository that shares another
  // repository's Work tree keeps no `.starciwork` of its own, so the workflow directory belongs to the owner.
  const routed=()=>{try{return resolveLedgerRoot({repoRoot:worktree,host:hostOf(options,repoRoot),options});}catch{return null;}};
  const storeRootFor=id=>{
    if(fs.existsSync(path.join(workflowsRoot(repoRoot),id,'state.json')))return repoRoot;
    const resolved=routed();
    return resolved?.sharedLedger&&fs.existsSync(path.join(workflowsRoot(resolved.ownerRepoRoot),id,'state.json'))
      ?resolved.ownerRepoRoot:repoRoot;
  };
  const open=id=>{
    const workflowId=required(id,'workflow id');
    const store=createStore({repoRoot:storeRootFor(workflowId),id:workflowId});
    const state=store.loadState();
    need(plain(state)&&state.kernel===WORKFLOW_KERNEL,`No workflow kernel state in ${slash(store.dir)}`);
    // A state written before the ledger mode existed resumes as a plan-ledger workflow.
    state.ledgerMode=LEDGER_MODES.includes(state.ledgerMode)?state.ledgerMode:'plan';
    state.scope=Array.isArray(state.scope)?state.scope:[];
    state.decisions=Array.isArray(state.decisions)?state.decisions:[];
    // A state written before lanes existed resumes with none: its nodes keep the single-step behaviour.
    state.lanes=plain(state.lanes)?state.lanes:{};
    // Ledger root = the worktree (branch content); the store root above = the main repository (history).
    state.repoRoot=state.repoRoot??worktree;
    if(options.allocation)state.quota=parseQuota(options.allocation);
    return {store,state};
  };
  if(command==='workflow-goal'){
    const job=required(options.job,'job');
    const host=hostOf(options,repoRoot);
    const id=options.id??newWorkflowId(job);
    // `--lane` makes this workflow its own Orca worktree row, cut from the branch this command runs on. The id is
    // decided first, because it names both the lane and the row the owner reads.
    const lane=options.lane===undefined||options.lane===false||options.lane==='false'?null:(()=>{
      const owner=laneOwnerOf([repoRoot,(()=>{try{return routed()?.ownerRepoRoot??null;}catch{return null;}})()],worktree);
      need(!owner,`${slash(worktree)} is already the lane of workflow ${owner?.id}; a lane never opens a lane of its own - run workflow-goal --lane from the base worktree`);
      return openLane(orca,{id,name:laneNameOf(options.lane,id),repoRoot,base:worktree,baseBranch:currentBranch(worktree),cwd:worktree});
    })();
    // Everything below resolves against the tree this workflow actually runs in: the lane when it has one.
    const code=lane?lane.worktree:worktree;
    // Resolved before the store exists, because a shared ledger moves the workflow directory into its owner.
    const ledger=resolveLedgerRoot({repoRoot:code,host,options});
    const store=createStore({repoRoot:ledger.sharedLedger?ledger.ownerRepoRoot:repoRoot,id});
    const ledgerMode=detectLedgerMode(code,options.ledger??null,ledger.exists?ledger.ledgerRoot:null);
    const state=createWorkflowState({job,inputs:csv(options.inputs),worktree:code,branch:lane?lane.branch:currentBranch(code),
      gates:csv(options.gates),store,host,launcher:launcherOf(host),ledgerMode,scope:csv(options.scope),repoRoot:code,lane,
      ledgerRoot:ledger.exists?ledger.ledgerRoot:null,ledgerShared:ledger.sharedLedger,ledgerSource:ledger.source,
      codeRole:ledger.role,codeSide:ledger.side,
      ledgerOwner:ledger.exists?{repoRoot:ledger.ownerRepoRoot,repository:ledger.ownerRepository,role:ledger.ownerRole,project:ledger.project}:null});
    if(options.allocation)state.quota=parseQuota(options.allocation);
    store.appendEvent({event:'created',job,inputs:state.inputs,worktree:slash(code),branch:state.branch,
      ledgerMode,scope:state.scope,ledgerRoot:slash(ledger.ledgerRoot),ledgerSource:ledger.source,
      ...(lane?{lane:lane.name}:{}),
      ...(ledger.sharedLedger?{'ledger-shared':{owner:ledger.ownerRepository??slash(ledger.ownerRepoRoot),root:slash(ledger.ledgerRoot)}}:{})});
    if(lane)store.appendEvent({event:'lane-created',name:lane.name,worktree:slash(lane.worktree),branch:lane.branch,
      orcaId:lane.orcaId,base:{worktree:slash(lane.base.worktree),branch:lane.base.branch},row:laneRowTitle(id)});
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,
      ...goalPhase(store,state,{cwd:code,ledgerRoot:options['ledger-root']??null,...functions})};
  }
  if(command==='workflow-lane-close'){
    const {store,state}=open(options.id);
    need(plain(state.lane),`Workflow ${state.id} has no lane: there is no worktree of its own to close`);
    need(!kernelAlive(store),`The kernel of ${state.id} is still running; run workflow-stop --id ${state.id} first`);
    if(plain(state.lane.closed))return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,lane:laneView(state),closed:true,
      next:'the lane was already closed; its branch is preserved'};
    need(plain(state.lane.merged),`The lane ${state.lane.name} of ${state.id} is not merged into ${state.lane.base?.branch} yet; a lane is closed only after it went home`);
    need(plain(orca)&&typeof orca.invoke==='function','workflow-lane-close needs an Orca runner: the lane is an Orca worktree');
    const removed=orca.invoke('worktree-rm',{worktree:`path:${slash(state.lane.worktree)}`,force:true},
      {cwd:fs.existsSync(state.lane.base?.worktree??'')?state.lane.base.worktree:worktree});
    need(removed.outcome==='ok',`orca worktree rm ${slash(state.lane.worktree)} failed (${removed.effectState??'unknown'}): ${removed.reason??'no reason'}`);
    state.lane.closed={at:Date.now(),preservedBranch:laneBranchRef(getPath(removed.receipt,'result.preservedBranch'))||state.lane.branch};
    store.appendEvent({event:'lane-closed',name:state.lane.name,worktree:slash(state.lane.worktree),
      branch:state.lane.branch,preservedBranch:state.lane.closed.preservedBranch});
    store.saveState(state);
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,lane:laneView(state),closed:true,
      next:`the worktree is gone and branch ${state.lane.closed.preservedBranch} is preserved`};
  }
  if(command==='workflow-stop'){
    const {store}=open(options.id);
    fs.writeFileSync(path.join(store.dir,'stop.flag'),String(Date.now()));
    return {schema:WORKFLOW_KERNEL,command,id:options.id,dir:store.dir,stopRequested:true,next:'the running kernel exits at its next iteration (at most one wait tick); workflow-run resumes from state.json'};
  }
  if(command==='workflow-approve'){
    const {store,state}=open(options.id);
    // A live kernel owns the state: the command is queued in its inbox and applied at its next tick.
    if(state.approved&&kernelAlive(store)){
      const file=queueInbox(store,{kind:'approve',allocation:options.allocation??null,allowDynamic:options['allow-dynamic']??null,
        acceptCritique:options['accept-critique']??null});
      return {schema:WORKFLOW_KERNEL,command,dir:store.dir,id:state.id,queued:true,inbox:file,
        next:'the running kernel applies this at its next iteration (event inbox-applied); a new allocation restarts the kernel through the supervisor'};
    }
    return {schema:WORKFLOW_KERNEL,command,dir:store.dir,
      ...approve(store,state,{allocation:options.allocation??null,allowDynamic:options['allow-dynamic']??null,
        acceptCritique:options['accept-critique']??null})};
  }
  if(command==='workflow-status'){
    const {store,state}=open(options.id);
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:state.phase,approved:state.approved,
      iterations:state.iterations,head:state.head,ledgerMode:state.ledgerMode,scope:state.scope,
      worktree:slash(state.worktree),branch:state.branch,lane:laneView(state),
      ledgerRoot:state.ledgerRoot?slash(state.ledgerRoot):null,ledgerSource:state.ledgerSource??null,
      ledgerShared:Boolean(state.ledgerShared),ledgerOwner:state.ledgerOwner??null,codeSide:state.codeSide??null,
      ledgerSummary:state.ledgerSummary,decisions:state.decisions,brand:state.brand??null,preflight:state.preflight??null,
      critique:state.critique??null,critiqueOverride:state.critiqueOverride??null,
      dynamicOps:state.dynamicOps??0,dynamicOpsBudget:dynamicBudget(state),sharedQueue:state.sharedQueue??[],
      ledger:state.ledger.map(item=>({id:item.id,status:item.status,title:item.title,evidence:item.evidence})),
      ops:state.ops.map(op=>({id:op.id,kind:op.kind,status:op.status,runtime:op.runtime,attempt:op.attempt})),
      // Per node: the lane it travels and how much of it is accepted - `lane: 2/3` is the line a user reads.
      lanes:Object.fromEntries(Object.entries(state.lanes??{}).map(([node,entry])=>
        [node,{lane:laneText(laneWalked(entry)),done:[...(entry.done??[])],skipped:[...(entry.skipped??[])],progress:laneProgress(entry)}])),
      workNodes:state.ops.filter(op=>op.nodeId).map(op=>({op:op.id,node:op.nodeId,status:op.status,kind:op.kind,
        lane:laneText(laneWalked(state.lanes?.[op.nodeId]))||null,progress:laneProgress(state.lanes?.[op.nodeId])})),
      gates:state.gateResults,needUser:state.needUser,finished:state.finished,
      events:store.readEvents().slice(-20),final:readJson(store.paths.final,null)};
  }
  if(command==='workflow-run'){
    const {store,state}=open(options.id);
    need(state.approved,`Workflow ${state.id} is not approved yet; run workflow-approve --id ${state.id}`);
    const launchFile=options['launch-file']?path.resolve(worktree,options['launch-file']):store.paths.launch;
    let from=options.from??state.from,run=options.run??state.run;
    if(!from&&fs.existsSync(launchFile)){const launch=awaitLaunch(launchFile,{wait});from=launch.from;run=run??launch.run??null;state.workflowTask=launch.task??state.workflowTask;}
    if(!from){
      // No coordinator terminal handed this kernel a handle (the supervisor started it): the kernel is its own
      // Orca terminal in the worktree - the one titled after it, reused across restarts, never a new tab per start.
      from=ownKernelTerminal(orca,store,state,worktree);
      state.kernelTerminalOwned=true;
    }
    state.from=required(from,'own terminal handle');
    // `run-bound` is the one-time hand-off this kernel performed; joining a run it already has is `run-resumed`.
    const binding=!run;
    state.run=run??bindRun(orca,{cwd:worktree,state,from:state.from});
    if(!binding)rebindRunIfNeeded(orca,store,state,{cwd:worktree});
    state.host=state.host??hostOf(options,repoRoot);
    state.launcher=state.launcher??launcherOf(state.host);
    store.appendEvent({event:binding?'run-bound':'run-resumed',run:state.run,from:state.from,iterations:state.iterations});
    const finished=(()=>{const release=acquireKernelLock(store);try{fs.rmSync(path.join(store.dir,'stop.flag'),{force:true});return runLoop(orca,store,state,{cwd:worktree,wait,
      // Slots are derived from the operations that are actually running; saved loads may belong to a dead kernel.
      supervisor:supervisorRuntimes(state.host),validator:validatorRuntimes(state.host),
      // Every kernel of this repository shares one runtime ledger beside the workflow directories, so an
      // expensive runtime another workflow is on is load here too and a provider cooldown is seen by all.
      allocator:createAllocator({runtimes:withSupervisorPreference(loadRuntimes(),supervisorRuntimes(state.host)),state:{...(state.allocation??{}),loads:Object.fromEntries(Object.entries(state.ops.filter(op=>op.status==='running'&&op.runtime).reduce((acc,op)=>{acc[op.runtime]=(acc[op.runtime]??0)+1;return acc;},{})))},quota:state.quota??null,shared:{path:loadsFileFor(store.dir),workflow:state.id},budget:{path:path.dirname(store.dir)}}),template:templateOf(state.host),
      ledgerRoot:options['ledger-root']??null,
      maxIterations:options['max-iterations']?Number(options['max-iterations']):Infinity,...functions});}finally{release();}})()
    // The kernel's own tab is the Run's coordinator terminal, so it lives as long as the workflow: a pause or a
    // rebuild leaves it for the next start to reuse (a new tab would have to re-bind the Run and fence every live
    // Dispatch). A finished workflow closes it: nobody reads it any more.
    if(finished.finished&&state.kernelTerminalOwned&&state.from){try{orca.invoke('terminal-close',{terminal:state.from},{cwd:worktree});}catch{}store.appendEvent({event:'kernel-terminal-closed',terminal:state.from});state.from=null;state.kernelTerminalOwned=false;store.saveState(state);}
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:finished.phase,ledgerMode:finished.ledgerMode,
      finished:finished.finished,lane:laneView(finished),ledger:finished.ledger.map(item=>`${item.id}=${item.status}`),
      ledgerSummary:finished.ledgerSummary,needUser:finished.needUser,head:finished.head,iterations:finished.iterations,
      ledgerRoot:finished.ledgerRoot?slash(finished.ledgerRoot):null,ledgerShared:Boolean(finished.ledgerShared),
      ledgerOwner:finished.ledgerShared?(finished.ledgerOwner?.repository??slash(finished.ledgerOwner?.repoRoot??'')):null};
  }
  throw Error(`Unsupported workflow kernel command: ${command}`);
}

// The CLI surface is the canonical launcher (`orca-supervised-launch.mjs workflow-goal|workflow-approve|
// workflow-run|workflow-status`), which routes straight into kernelMain; this module stays import-only.
