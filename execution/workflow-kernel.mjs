import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {skillRoot} from '../core/runtime-root.mjs';
import {getPath} from './orca-calls.mjs';
import {waitTick} from './orca-protocol.mjs';
import {buildOperationLaunch,notifyTerminal,settleDispatch,startOperation,sweepWorktree} from './orca-supervised-launch.mjs';
import {validateReport} from './reports.mjs';
import {WORKFLOW_STATE,createStore,newWorkflowId,repositoryRoot} from './workflow-store.mjs';
import {createAllocator,loadRuntimes} from './runtime-allocator.mjs';
import {proofFinding,proofPlan,runAtBase} from './verify-proof.mjs';
import * as work from './work-ledger.mjs';
import * as llm from './llm-functions.mjs';

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
/** Work kind -> the operation kind that executes it; decision kinds are answered, never launched as work. */
export const WORK_OPERATION={implementation:'backend.implement',ui:'interface.implement',uat:'uat.verify',operations:'runtime.operate'};
export const DECISION_OPERATION={architecture:'architecture.decide',business:'business.decide','business-overview':'business.decide'};
const RESUME_LIMIT=5,RETRY_LIMIT=3,RESTART_LIMIT=3,VERIFY_ROUNDS=3,GATE_ROUNDS=3,LAUNCH_LIMIT=3,STALL_LIMIT=3;
/** Run-time growth is bounded too: ops nobody approved, shared changes per iteration, inferred rate limits. */
export const DYNAMIC_OPS_BUDGET=6;
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
    return [/test:container|postgres/i.test(command)?'postgres':null,/\be2e\b/i.test(command)?'e2e-runtime':null,
      /docker/i.test(command)?'docker':null,/kubectl|helm/i.test(command)?'cluster':null].filter(Boolean);
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

/** `<repo>/.starciwork/features` decides the mode: a repository that owns a Work tree is driven by it. */
export function detectLedgerMode(repoRoot,requested=null){
  if(requested){need(LEDGER_MODES.includes(requested),`Unsupported ledger mode ${requested}; use ${LEDGER_MODES.join(' or ')}`);return requested;}
  return fs.existsSync(path.join(String(repoRoot??''),'.starciwork','features'))?WORK_LEDGER:'plan';
}

/** The whole mutable state of one workflow. `schema` is the store's, so state.json is written atomically by it. */
export function createWorkflowState({job,inputs=[],worktree,branch,gates=[],store,host=null,launcher=null,
  ledgerMode='plan',scope=[],repoRoot=null}){
  need(plain(store)&&typeof store.id==='string','A workflow store is required');
  need(LEDGER_MODES.includes(ledgerMode),`Unsupported ledger mode ${ledgerMode}; use ${LEDGER_MODES.join(' or ')}`);
  return {schema:WORKFLOW_STATE,kernel:WORKFLOW_KERNEL,id:store.id,dir:store.dir,
    job:required(job,'job'),inputs:inputs.map(parseRef),worktree:path.resolve(required(worktree,'worktree')),
    branch:required(branch,'branch'),gates:gates.map(parseGate),host,launcher,
    ledgerMode,scope:[...scope],repoRoot:repoRoot?path.resolve(repoRoot):null,
    run:null,from:null,workflowTask:null,phase:'goal',approved:false,
    definitionOfDone:[],risks:[],questions:[],ledger:[],ops:[],needUser:[],gateResults:[],verifyRounds:{},gateRounds:0,
    decisions:[],ledgerSummary:null,
    dynamicOps:0,dynamicOpsBudget:DYNAMIC_OPS_BUDGET,sharedQueue:[],silences:{},preflight:null,
    head:null,iterations:0,counters:{},stalls:0,allocation:null,finished:null,createdAt:Date.now()};
}

const byId=(state,id)=>state.ops.find(op=>op.id===id)??null;
const ledgerItem=(state,id)=>state.ledger.find(item=>item.id===id)??null;
/** `paused` is live too: an op waiting for its shared change is not finished and never lets the job finish. */
const liveStatus=['pending','ready','running','answering','paused'];
const nextId=(state,prefix)=>`${prefix}-${state.counters[prefix]=(state.counters[prefix]??0)+1}`;
const componentKey=ledgerIds=>[...ledgerIds].sort().join('+')||'-';
/** The key a review round is counted against: the module on the Work ledger, the item set on a plan ledger. */
const groupKey=(state,ledgerIds)=>{
  if(state.ledgerMode!==WORK_LEDGER)return componentKey(ledgerIds);
  const modules=unique(ledgerIds.map(id=>ledgerItem(state,id)?.module).filter(Boolean)).sort();
  return modules.length?modules.join('+'):componentKey(ledgerIds);
};
const implementsLedger=op=>op.kind!=='review.verify'&&(op.ledgerIds??[]).length>0;

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
function gateDynamicOp(store,state,op){
  state.dynamicOps=(state.dynamicOps??0)+1;
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
  return state.ledgerMode===WORK_LEDGER?workGoalPhase(store,state,options):planGoalPhase(store,state,options);
}

/**
 * Plan ledger: one model call fills the whole plan form (definition of done, ledger, operations), the
 * kernel writes goal.md and goal.json and stops. Nothing is launched before the user approves.
 */
export function planGoalPhase(store,state,{assessGoal=llm.assessGoal,renderGoalMarkdown=llm.renderGoalMarkdown,extractMaterial=llm.extractMaterial,cwd=state.worktree,providers,runHeadless}={}){
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
  writeJson(store.paths.goalJson,{schema:GOAL_RECORD,id:state.id,job:state.job,inputs:state.inputs,ledgerMode:state.ledgerMode,
    definitionOfDone:state.definitionOfDone,risks:state.risks,questions:state.questions,
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
export const KERNEL_CHECK=/^(work-valid|backend-e2e-pass|producer-e2e-pass|.*e2e.*)$/i;
export function deriveWorkOp(api,repoRoot,node,{id,opOfNode=new Map(),index=0}){
  return toOp({id,nodeId:node.id,
    kind:WORK_OPERATION[node.kind]??'task.execute',goal:describeNode(api,repoRoot,node),
    ledgerIds:[node.id],allowlist:node.allowlist,
    references:unique([node.path,...(node.refs??[])]),
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
  try{loaded=ctx.work.api.loadLedger({repoRoot:ctx.work.repoRoot,validate:ctx.work.validate});}
  catch(error){store.appendEvent({event:'ledger-sync-failed',reason:error.message});return [];}
  if(!loaded.ok)return [];
  ctx.work.loaded=loaded;
  const scope=state.scope.length?state.scope:null;
  const known=new Set(state.ops.map(op=>op.nodeId).filter(Boolean));
  const taken=new Set(state.ops.map(op=>op.id));
  const opOfNode=new Map(state.ops.filter(op=>op.nodeId).map(op=>[op.nodeId,op.id]));
  const added=[];
  // An operation created before the repository rule for a node another repository delivers is settled and blocked.
  for(const op of state.ops){
    if(!op.nodeId||op.refusal==='out-of-repository'||!ctx.work.repository||typeof ctx.work.api.nodeRepository!=='function')continue;
    const node=loaded.nodes.get(op.nodeId);
    if(!node)continue;
    let foreign=null;try{foreign=ctx.work.api.nodeRepository(ctx.work.api.readNode(ctx.work.repoRoot,node));}catch{foreign=null;}
    if(!foreign||foreign===ctx.work.repository)continue;
    if(liveStatus.includes(op.status)&&op.dispatch&&ctx.orca){
      settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'out-of-repository',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
      if(op.runtime)ctx.allocator.release(op.runtime);
    }
    op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
    for(const item of state.ledger)if(item.id===op.nodeId)item.status='out-of-repository';
    store.appendEvent({event:'op-out-of-repository',op:op.id,node:op.nodeId,repository:foreign,own:ctx.work.repository});
  }
  for(const node of ctx.work.api.executableCandidates(loaded,{scope,repository:ctx.work.repository})){
    if(known.has(node.id))continue;
    if(!node.schedulable){
      if(!state.needUser.some(item=>item.node===node.id))state.needUser.push({node:node.id,kind:'ledger',detail:`ledger incomplete: ${node.reason}`});
      continue;
    }
    const id=workOpId(node.id,taken);opOfNode.set(node.id,id);
    const op=deriveWorkOp(ctx.work.api,ctx.work.repoRoot,node,{id,opOfNode,index:state.ops.length});
    op.difficulty=op.difficulty??'medium';
    op.createdIteration=state.iterations;
    state.ops.push(op);
    state.ledger.push({id:node.id,title:describeNode(ctx.work.api,ctx.work.repoRoot,node),inputRef:node.path,kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[]});
    added.push(op.id);
    store.appendEvent({event:'op-added',op:op.id,node:node.id,reason:'newly schedulable Work node'});
    gateDynamicOp(store,state,op);
  }
  return added;
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
export function workGoalPhase(store,state,{assessGoal=llm.assessGoal,ledgerApi=work,validate=validateWorkTree,cwd=state.worktree,providers,runHeadless}={}){
  need(!state.approved,`Workflow ${state.id} is already approved; run workflow-run`);
  // The Work ledger is the branch content of the worktree; only the workflow history lives in the main repository.
  const repoRoot=state.repoRoot??path.resolve(state.worktree);
  state.repoRoot=repoRoot;
  const loaded=ledgerApi.loadLedger({repoRoot,validate});
  const scope=state.scope.length?state.scope:null;
  const executables=ledgerApi.executableCandidates(loaded,{scope});
  const ready=executables.filter(node=>node.schedulable),incomplete=executables.filter(node=>!node.schedulable);
  state.decisions=ledgerApi.decisionCandidates(loaded,{scope}).map(node=>({id:node.id,kind:node.kind,path:node.path,
    operation:DECISION_OPERATION[node.kind]??'business.decide',title:describeNode(ledgerApi,repoRoot,node)}));
  state.ledgerSummary=ledgerApi.ledgerSummary(loaded,{scope});
  if(!loaded.ok)state.needUser.push({kind:'ledger',detail:`the Work tree does not validate, so no node in it is a trustworthy TODO: ${ledgerErrorText(loaded.errors)}`});
  for(const node of incomplete)state.needUser.push({node:node.id,kind:'ledger',detail:`ledger incomplete: ${node.reason}`});
  need(ready.length||incomplete.length||state.decisions.length,
    `No eligible Work node in scope ${scope?scope.join(', '):'(the whole tree)'}: there is nothing for this workflow to do`);
  state.ledger=ready.map(node=>({id:node.id,title:describeNode(ledgerApi,repoRoot,node),inputRef:node.path,
    kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[]}));
  const taken=new Set(),opOfNode=new Map();
  for(const node of ready)opOfNode.set(node.id,workOpId(node.id,taken));
  state.ops=ready.map((node,index)=>deriveWorkOp(ledgerApi,repoRoot,node,{id:opOfNode.get(node.id),opOfNode,index}));
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Work operation ids are not unique');
  const assessed=typeof assessGoal==='function'?assessGoal({job:state.job,inputs:state.inputs,
    ledger:state.ledger.map(item=>({id:item.id,kind:item.kind,title:item.title,module:item.module})),
    constraints:[
      `the ledger is the authored Work tree under ${slash(repoRoot)}/.starciwork and is not yours to change`,
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
  writeJson(store.paths.goalJson,{schema:GOAL_RECORD,id:state.id,job:state.job,inputs:state.inputs,
    ledgerMode:state.ledgerMode,scope:state.scope,workRoot:slash(loaded.workRoot),ledgerValid:loaded.ok,
    definitionOfDone:state.definitionOfDone,risks:state.risks,questions:state.questions,
    ledger:state.ledger,decisions:state.decisions,ledgerSummary:state.ledgerSummary,
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
    next:`review ${slash(store.paths.goal)} and approve with workflow-approve --id ${state.id}`};
}

/** goal.md in ledger mode: the nodes the kernel will execute, as the TODO the user approves. */
function workGoalMarkdown(state,loaded){
  const overlaps=[];
  for(const [index,op] of state.ops.entries())for(const other of state.ops.slice(index+1))
    if(!work.disjoint(op.allowlist,other.allowlist))overlaps.push(`\`${op.id}\` and \`${other.id}\` share paths, so they never run at the same time`);
  const lines=[`# ${state.job}`,``,
    `Workflow \`${state.id}\` - branch \`${state.branch}\` - ledger \`work\` (${slash(loaded.workRoot)})`,
    `Scope: ${state.scope.length?state.scope.map(item=>`\`${item}\``).join(', '):'the whole Work tree'}. `+
    `The Work tree ${loaded.ok?'validates':'does NOT validate'}; ${state.ledgerSummary?.eligible??0} of ${state.ledgerSummary?.total??0} nodes in scope are eligible.`,``,
    `## Definition of done`,``,...state.definitionOfDone.map((item,index)=>`${index+1}. ${item}`),``,
    `## Work nodes this workflow executes`,``,`| op | node | kind | module | checks | allowlist |`,`| --- | --- | --- | --- | --- | --- |`];
  for(const op of state.ops){
    const item=ledgerItem(state,op.ledgerIds[0]);
    lines.push(`| \`${op.id}\` | \`${op.nodeId}\` | ${item?.kind??'-'} | ${item?.module??'-'} | ${op.checks.length} | ${op.allowlist.map(entry=>`\`${entry}\``).join(', ')||'-'} |`);
  }
  if(state.decisions.length){
    lines.push(``,`## Decisions still open in scope`,``,`These are answered by a decision, not by an operation in a worktree.`,``);
    for(const decision of state.decisions)lines.push(`- \`${decision.id}\` (${decision.kind}) ${firstLine(decision.title)}`);
  }
  const incomplete=state.needUser.filter(item=>item.kind==='ledger');
  if(incomplete.length){
    lines.push(``,`## Needs you first`,``);
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
/** A quota proposal from the difficulty mix: hard/medium operations lean on the strongest runtimes, easy ones on the cheapest. The user always sets the final numbers. */
export function proposeQuota(state,{runtimes=null}={}){
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
  const text=rows.map(row=>`${row.runtime}=${row.slots}:${row.tags}`).join(',');
  const proposal={rows,text,summary:`${hard} hard, ${medium} medium, ${easy} easy of ${ops.length} operations; up to ${total} in parallel`};
  state.quotaProposal=proposal;
  return proposal;
}

export function approve(store,state,{allocation=null,allowDynamic=null}={}){
  if(allocation)state.quota=parseQuota(allocation);
  // `--allow-dynamic N` is the user raising the run-time op budget; ops the gate refused are reinstated with it.
  if(allowDynamic!==null&&allowDynamic!==undefined&&String(allowDynamic).trim()){
    const budget=Number(allowDynamic);
    need(Number.isInteger(budget)&&budget>0,`--allow-dynamic takes a positive integer: ${allowDynamic}`);
    const raised=budget>dynamicBudget(state);
    state.dynamicOpsBudget=budget;
    if(raised){
      for(const op of state.ops.filter(item=>item.status==='blocked'&&item.refusal==='dynamic-op')){op.status='pending';op.refusal=null;}
      state.needUser=state.needUser.filter(item=>item.kind!=='dynamic-op');
    }
  }
  // The user sets the runtime allocation at approval; without --allocation the proposal from goal.md is used and recorded.
  if(!state.quota){const proposal=state.quotaProposal??proposeQuota(state);state.quota=parseQuota(proposal.text);state.quotaSource='proposal';}else state.quotaSource=allocation?'user':state.quotaSource??'user';
  need(state.ops.length,`Workflow ${state.id} has no plan to approve; run workflow-goal first`);
  state.approved=true;
  if(state.phase!=='finished')state.phase='run';
  store.appendEvent({event:'approved',ops:state.ops.length,quota:state.quota,dynamicOpsBudget:dynamicBudget(state)});
  store.saveState(state);
  return {ok:true,id:state.id,phase:state.phase,approved:true,ops:state.ops.length,ledger:state.ledger.length,
    quota:state.quota,dynamicOpsBudget:dynamicBudget(state)};
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

export function renderContract({template,op,state,store,launcher=state.launcher,run=state.run,
  guards=kernelGuards,protectedPaths=null}){
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
    `## Goal`,op.goal,``,
    ...(op.nodeId?[`## Work node you close`,`- \`${op.nodeId}\` - the kernel writes its \`state\`, \`completion\` and evidence itself after it has reproduced your checks. Never edit a Work \`index.yaml\` unless it is in your allowlist.`,``]:[]),
    ...(items.length?[`## Goal items you close`,...items,``]:[]),
    `## Allowlist`,...op.allowlist.map(entry=>`- \`${entry}\``),
    `Anything else is out of scope. Name the exact paths you need in \`open[]\`, or report \`blocked\` with \`shared-change\` and the exact repository paths in the detail - a \`shared-change\` that names no path is sent straight back to you.`,``,
    ...(owned.length?[`## Never touch (kernel-owned)`,...owned.map(entry=>`- \`${entry}\``),
      `The kernel owns the node's \`state\`, \`completion\`, \`extensions.work3.kernel\` and its evidence. It reverts anything you write here and downgrades your report to \`failed\`.`,``]:[]),
    `## Resources`,...(locks.length?locks.map(entry=>`- \`${entry}\``):['- none: this operation claims no shared resource']),
    `Two operations that share a resource never run at the same time; never start, stop or reset one you did not declare.`,``,
    `## References`,...(op.references.length?op.references.map(entry=>`- ${entry}`):['- the goal and the allowlist above']),``,
    ...(op.priorOpen.length?[`## Open items you inherit`,...op.priorOpen.map(item=>`- ${item}`),``]:[]),
    ...(op.findings.length?[`## Findings you must resolve`,...op.findings.map(item=>`- ${typeof item==='string'?item:JSON.stringify(item)}`),``]:[]),
    `## Acceptance`,...(op.acceptance.length?op.acceptance.map((item,index)=>`${index+1}. ${item}`):['1. the goal above holds']),``,
    ...jobRulings(store),
    cook,``,
    `## Checks to run`,...(op.checks.length?op.checks.map(check=>`- ${check.name}: \`${check.command}\``):['- none were declared: run the checks this code already has and record them']),
    `Record every command with its exit code in \`${checksFile}\` as a JSON array \`[{"name","command","exitCode","evidence"}]\`.`,
    `The kernel re-runs these exact commands itself after your report and computes your changed files from git: a \`done\` the machine cannot reproduce is downgraded to \`failed\` and comes back to you.`,``,
    `## Report (exactly once, at the end)`,
    `\`node ${launcher} report --run ${run} --from <your terminal> --task <op task> --dispatch <your dispatch> --reports-dir ${reportsDir} --outcome done|partial|failed|ask|blocked --summary "<what you did, what the checks showed, what is left>" --files <comma-separated changed paths> --checks-file ${checksFile} [--open "<item>,<item>"] [--question "<text>" --options "a,b"] [--blocker shared-change|sds-gap|environment|authority:<detail>]\``,
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
  const node=ctx.work.node(op.nodeId);
  if(!node)return [];
  const granted=(op.allowlist??[]).map(normalize);
  return unique(((ctx.guards??kernelGuards).protectedPaths(node,ctx.work.repoRoot)??[]).map(normalize))
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

function guardKernelPaths(store,state,op,ctx){
  const paths=op.kernelOwned??[];
  if(!paths.length)return [];
  const root=ctx.work?.repoRoot??state.worktree;
  if(protectedFingerprint(root,paths)===(op.kernelOwnedAt??''))return [];
  const result=ctx.guards.gitQueue(()=>ctx.guards.revertProtected(ctx.git,{cwd:state.worktree,paths}))??{};
  const reverted=unique([...(result.reverted??[]),...(result.removed??[])]).map(normalize);
  op.kernelOwnedAt=protectedFingerprint(root,paths);
  const touched=reverted.length?reverted:paths;
  store.appendEvent({event:'kernel-paths-modified',op:op.id,node:op.nodeId,paths:touched,reverted,protected:paths});
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
  op.kernelOwned=kernelOwnedPaths(state,op,ctx);
  const contract=renderContract({template:ctx.template,op,state,store,guards:ctx.guards,protectedPaths:op.kernelOwned});
  fs.writeFileSync(store.contractPath(op.id),contract);
  op.contractFile=store.contractPath(op.id);
  const relative=path.relative(process.cwd(),state.worktree)||'.';
  const launched=ctx.launch(orca,{cwd:state.worktree,run:state.run,workflowTask:state.workflowTask??state.id,from:state.from,
    worktree:relative,operation:op.kind,scope:op.id,spec:contract,candidate:allocated.candidate,runtime:allocated.runtime,wait:ctx.wait});
  op.launch={ok:Boolean(launched?.ok),target:launched?.selection?.target??allocated.target,
    task:launched?.task?.id??null,dispatch:launched?.dispatchId??null,stopReason:launched?.stopReason??null};
  if(!launched?.ok){
    op.launchFailures+=1;
    ctx.allocator.failed(allocated.runtime,{reason:launched?.stopReason??'launch failed'});
    op.avoidRuntimes=unique([...op.avoidRuntimes,allocated.runtime]);
    store.appendEvent({event:'launch-failed',op:op.id,runtime:allocated.runtime,stopReason:launched?.stopReason??null,attempts:launched?.attempts?.length??0});
    if(op.launchFailures>=LAUNCH_LIMIT){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'environment',detail:`no runtime could launch ${op.id} (${op.launchFailures} attempts, last ${launched?.stopReason??'unknown'})`});
    }
    return {ok:false,reason:launched?.stopReason??'launch failed'};
  }
  op.status='running';op.runtime=allocated.runtime;op.target=allocated.target;
  if(!op.baseHead){const shown=ctx.git('git',['rev-parse','HEAD'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});op.baseHead=shown.status===0?(shown.stdout??'').trim():null;}
  op.task=launched.task.id;op.dispatch=launched.dispatchId;op.terminal=launched.terminal;op.nudged=false;
  // A launch is an external effect: the state that names it is written before anything else can interrupt the kernel.
  store.saveState(state);
  store.appendEvent({event:'launched',op:op.id,kind:op.kind,node:op.nodeId,attempt:op.attempt,runtime:op.runtime,target:op.target,
    dispatch:op.dispatch,terminal:op.terminal,allocation:launched.allocation??null});
  // Work v2 authors only uninvestigate, todo and done, so the launch is recorded in the node's kernel block.
  ledgerWrite(store,state,op,ctx,'in-progress',node=>ctx.work.api.markInProgress(ctx.work.repoRoot,node,{opId:op.id,dispatch:op.dispatch}));
  // The baseline is taken after the kernel's own in-progress write, so only the operation's edits are caught.
  op.kernelOwnedAt=op.kernelOwned.length?protectedFingerprint(ctx.work?.repoRoot??state.worktree,op.kernelOwned):null;
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
    const allocated=ctx.allocator.allocate(op.kind,{avoid,restrictTo:launchableFor(ctx.allocator,op.kind),difficulty:op.difficulty??null});
    if(!allocated?.ok){store.appendEvent({event:'allocation-deferred',op:op.id,reason:allocated?.reason??'no runtime',avoid});continue;}
    let candidate=null;
    try{candidate=allocated.candidate??ctx.allocator.candidateFor(op.kind,allocated.target);}
    catch(error){
      ctx.allocator.failed(allocated.runtime,{reason:'not launchable'});
      op.avoidRuntimes=unique([...op.avoidRuntimes,allocated.runtime]);
      store.appendEvent({event:'allocation-rejected',op:op.id,runtime:allocated.runtime,reason:error.message});
      continue;
    }
    const result=launchOp(orca,store,state,op,{...allocated,candidate},ctx);
    if(result.ok)launched.push(op.id);
  }
  if(launched.length)state.stalls=0;
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
    if(op.kind==='review.verify')item.status='verified';
    else item.status='implemented';
  }
}

/* ------------------------------------------------------------------ writing the Work ledger back */

/**
 * Every ledger write goes through here. A refused write is never silent and never fatal: the node keeps its
 * original bytes (work-ledger restores them itself), the refusal is an event, and the workflow carries it to
 * the user instead of reporting a green slice over a ledger that does not say so.
 */
function ledgerWrite(store,state,op,ctx,step,action){
  if(!ctx.work||!op.nodeId)return null;
  const node=ctx.work.node(op.nodeId);
  if(!node){
    store.appendEvent({event:'ledger-node-missing',op:op.id,node:op.nodeId,step});
    state.needUser.push({op:op.id,kind:'ledger',detail:`the Work node ${op.nodeId} is no longer in the validated tree, so ${step} could not be recorded`});
    return null;
  }
  try{
    const result=action(node);
    store.appendEvent({event:'ledger-write',op:op.id,node:op.nodeId,step});
    return result;
  }catch(error){
    store.appendEvent({event:'ledger-write-failed',op:op.id,node:op.nodeId,step,reason:error.message});
    state.needUser.push({op:op.id,kind:'ledger',detail:`the Work node ${op.nodeId} refused ${step}: ${error.message}`});
    return null;
  }
}

/** The checks the kernel itself re-ran, carrying the assertion each one proves (the check name is that id). */
const provenChecks=checks=>checks.map(check=>({name:check.name,command:check.command,exitCode:check.exitCode,assertion:check.name}));

/** An accepted slice becomes `done` plus one evidence manifest on the node that asked for the work. */
function recordDone(store,state,op,ctx,verified){
  if(!ctx.work||!op.nodeId)return;
  const decision=['architecture.decide','business.decide'].includes(op.kind);
  if(decision){
    ledgerWrite(store,state,op,ctx,'decided',node=>ctx.work.api.markDecided(ctx.work.repoRoot,node,{
      by:'starci-kernel',
      digest:ctx.work.digest,
      review:{reviewer:op.runtime??'starci-kernel',
        authority:`the kernel accepted ${op.id} after re-running its checks itself`,
        observations:decisionObservations(ctx,node,op),
        limitations:['Only the operation allowlist was reviewed.']}}));
    return;
  }
  // A completion binds its source directly (starci/source-identity@1) so the tree needs no repository resource record;
  // the identity is scoped to the operation allowlist, which is exactly what the kernel verified.
  const identity=ctx.work.origin&&/^[a-f0-9]{40,64}$/.test(String(op.head??''))&&typeof ctx.work.api.buildSourceIdentity==='function'
    ?ctx.work.api.buildSourceIdentity({repository:ctx.work.repository??path.basename(ctx.work.repoRoot),origin:ctx.work.origin,commit:op.head,paths:op.allowlist??[],
      dependencyCoverage:'Dependencies were not re-verified by this operation.',limitations:['Only the operation allowlist was verified by the kernel.']})
    :null;
  ledgerWrite(store,state,op,ctx,'done',node=>ctx.work.api.markDone(ctx.work.repoRoot,node,{
    opId:op.id,head:op.head??null,checks:provenChecks(verified.checks),verifiedBy:'starci-kernel',digest:ctx.work.digest,...(identity?{sourceIdentity:identity}:{}),
    evidence:{outcome:'pass',environment:'local',actor:'starci-kernel',tool:'starci-kernel',
      servedVersionEvidence:`Checks re-run by the StarCi kernel in workflow ${state.id} on branch ${state.branch}`}}));
}

/**
 * The ledger write is the kernel's own change to the repository, so it is committed too - under the node
 * directory it belongs to and with the same `Work:` trailer - instead of being left dirty in the worktree.
 * It follows the operation's commit because a completion binds the head of the slice it proves.
 */
function commitLedgerWrite(store,state,op,ctx){
  if(!ctx.work||!op.nodeId)return null;
  const node=ctx.work.node(op.nodeId);
  if(!node)return null;
  const files=changedFiles(state,op,ctx,[`.starciwork/${slash(path.dirname(node.path))}`]);
  if(!files.length)return null;
  // Ledger writes carry 64-hex digests that a repository secrets guard mistakes for keys; the kernel is the
  // author of those digests, so it declares the scan skipped for exactly this commit.
  const run=args=>ctx.git('git',args,{cwd:state.worktree,encoding:'utf8',windowsHide:true,env:{...process.env,ALLOW_SECRET_SCAN:'1'}});
  run(['config','core.longpaths','true']);
  if(run(['add','--',...files]).status!==0){store.appendEvent({event:'ledger-commit-failed',op:op.id,node:op.nodeId,reason:'git add'});return null;}
  const committed=run(['commit','-q','-m',`work(${op.nodeId}): record ${op.id} in the Work ledger\n\nWork: ${op.nodeId}`]);
  if(committed.status!==0){store.appendEvent({event:'ledger-commit-failed',op:op.id,node:op.nodeId,reason:tail(committed.stderr,200)});return null;}
  const shown=run(['rev-parse','HEAD']);
  const head=shown.status===0?(shown.stdout??'').trim():null;
  if(head)state.head=head;
  store.appendEvent({event:'ledger-commit',op:op.id,node:op.nodeId,files,head});
  return head;
}

/** A decision is settled by observations, one per authored assertion; with none authored, one for the node. */
function decisionObservations(ctx,node,op){
  const authored=(()=>{try{const raw=ctx.work.api.readNode(ctx.work.repoRoot,node);return Array.isArray(raw.assertions)?raw.assertions.map(String):[];}catch{return [];}})();
  const observation=firstLine(op.reports.at(-1)?.summary)||`${op.id} settled this decision`;
  return (authored.length?authored:[String(node.id)]).map(id=>({id,outcome:'pass',observation}));
}

/**
 * A reported SDS gap reopens the design, it does not repair it in place: the architecture node the operation
 * names - or, failing that, the one in its own module - returns to `todo` and gets an `architecture.decide`
 * operation of its own, which the blocked operation then waits for.
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
const workValidateCommand=ctx=>`node ${slash(path.join(skillRoot,'bin','starci.mjs'))} validate ${slash(path.join(ctx.work.repoRoot,'.starciwork'))}`;

function reopenArchitecture(store,state,op,report,ctx,blocker){
  const architecture=architectureNodeFor(ctx,op,blocker.detail);
  if(!architecture)return null;
  ledgerWrite(store,state,op,ctx,'reopened',()=>ctx.work.api.markReopened(ctx.work.repoRoot,architecture,
    {reason:`${op.id} reported an SDS gap: ${blocker.detail}`,by:'starci-kernel'}));
  const designFile=`.starciwork/${slash(architecture.path)}`;
  const decide=addOp(store,state,{kind:'architecture.decide',nodeId:architecture.id,
    goal:`Settle the design gap ${op.id} hit, in the architecture node ${architecture.id}: ${blocker.detail}`,
    ledgerIds:op.ledgerIds,allowlist:[designFile],references:unique([architecture.path,...op.references]),
    checks:[{name:'work-tree-validates',command:workValidateCommand(ctx)}],
    acceptance:[`${architecture.id} records the decision for: ${blocker.detail}`],origin:'architecture'},
    `sds-gap reported by ${op.id}`);
  op.status='pending';op.attempt+=1;op.dependsOn=unique([...op.dependsOn,decide.id]);
  op.priorOpen=unique([...(report.open??[]),`the design gap is settled by ${decide.id} in ${architecture.path}; read the updated design first`]);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'sds-gap',op:op.id,node:op.nodeId,architecture:architecture.id,decide:decide.id});
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
  try{const raw=ctx.work.api.readNode(ctx.work.repoRoot,node);return {id:node.id,description:raw?.description??null,assertions:Array.isArray(raw?.assertions)?raw.assertions.map(String):[]};}
  catch{return {id:node.id,description:null,assertions:[]};}
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
  try{result=ctx.validateOp({op,node:validatorNode(ctx,op),diff,checks:verified.checks,references:op.references,
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

/* ------------------------------------------------------------------ result policy */

function retryOp(store,state,op,findings,ctx,reason){
  op.repairs+=1;
  if(op.repairs>RETRY_LIMIT){
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
    op.repairs=RETRY_LIMIT;
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
  const created=addOp(store,state,{kind:'backend.implement',goal:`Apply the shared change ${op.id} cannot make: ${detail}`,
    ledgerIds:op.ledgerIds,allowlist:paths,references:op.references,checks:op.checks,
    acceptance:[detail],origin:'shared',requesters:[op.id]},`shared-change reported by ${op.id}`);
  if(created)created.sharedDepth=(op.sharedDepth??0)+1;
  return created;
}

/** One shared request: merge into an existing shared op, create one, or queue it for the next iteration. */
function requestSharedChange(store,state,op,{paths,detail,open=[]}){
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
  if(blocker.kind==='sds-gap'){
    if(ctx.work&&reopenArchitecture(store,state,op,report,ctx,blocker))return 'sds-gap';
    const design=unique([...state.inputs.filter(item=>item.kind==='sds').map(item=>item.ref),
      ...pathsIn(blocker.detail).filter(file=>/\.(md|yaml|yml|json)$/.test(file))]);
    if(!design.length){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'sds-gap',detail:`${blocker.detail} (no design input to change)`});
      return 'escalate-to-user';
    }
    const architecture=addOp(store,state,{kind:'architecture.decide',goal:`Settle the design gap ${op.id} hit: ${blocker.detail}`,
      ledgerIds:op.ledgerIds,allowlist:design,references:op.references,checks:[],
      acceptance:[`the design records the decision for: ${blocker.detail}`],origin:'architecture'},`sds-gap reported by ${op.id}`);
    op.status='pending';op.attempt+=1;op.needsReplan=true;op.dependsOn=unique([...op.dependsOn,architecture.id]);
    op.priorOpen=unique([...(report.open??[]),`the design gap is settled by ${architecture.id}; read the updated design first`]);
    op.dispatch=null;op.terminal=null;
    return 'sds-gap';
  }
  op.status='blocked';
  state.needUser.push({op:op.id,kind:blocker.kind,detail:blocker.detail});
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
  if(report.outcome==='done'){
    const verified=machineVerify(state,op,ctx);
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
    if(op.kind==='review.verify'){
      const findings=reviewFindings(report);
      if(findings.length)return repairFromVerify(store,state,op,findings,ctx);
      op.verdict='pass';
    }
    recordDone(store,state,op,ctx,verified);
    ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,op,ctx));
    markLedger(state,op,op.head);
    store.appendEvent({event:'op-done',op:op.id,node:op.nodeId,runtime:op.runtime,head:op.head,files,
      checks:verified.checks.map(check=>`${check.name}=${check.exitCode}`),committed:commit.committed});
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
    return retryOp(store,state,op,failing.length?failing:[report.summary],ctx,'failed');
  }
  if(report.outcome==='ask')return answerOrEscalate(orca,store,state,op,report,ctx);
  return handleBlocked(store,state,op,report,ctx);
}

const reviewFindings=report=>{
  const findings=Array.isArray(report.findings)&&report.findings.length?report.findings:report.open??[];
  return findings.map(item=>typeof item==='string'?item:JSON.stringify(item));
};

/** A review that found something becomes one repair operation; the next review is created when it is done. */
function repairFromVerify(store,state,op,findings,ctx){
  op.verdict='fail';
  const key=groupKey(state,op.ledgerIds);
  for(const id of op.ledgerIds){const item=ledgerItem(state,id);if(item&&item.status==='verified')item.status='implemented';}
  if((state.verifyRounds[key]??1)>=VERIFY_ROUNDS){
    state.needUser.push({op:op.id,kind:'review',detail:`${key} still fails review after ${VERIFY_ROUNDS} rounds: ${findings[0]??'no finding text'}`});
    store.appendEvent({event:'verify-limit',op:op.id,component:key,findings:findings.slice(0,3)});
    return 'verify-limit';
  }
  if(!findings.length){
    state.needUser.push({op:op.id,kind:'review',detail:`${op.id} failed review without naming a finding`});
    return 'verify-without-findings';
  }
  const named=unique(findings.flatMap(pathsIn)).filter(file=>inside(file,op.allowlist));
  addOp(store,state,{kind:'backend.implement',goal:`Resolve the review findings of ${op.id}`,ledgerIds:op.ledgerIds,
    allowlist:named.length?named:op.allowlist,references:op.references,checks:op.checks,acceptance:op.acceptance,
    findings,origin:'repair'},`review findings of ${op.id}`);
  store.appendEvent({event:'verify-findings',op:op.id,component:key,findings:findings.length,allowlist:named});
  return 'repair-from-findings';
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
      ctx.allocator.release(runtime);
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

/** A ledger group whose implementing operations are all done gets one independent review. */
function planVerifyOps(store,state,ctx){
  const ready=state.ledger.filter(item=>item.status==='implemented').map(item=>item.id)
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
    if((state.verifyRounds[key]??0)>=VERIFY_ROUNDS){store.appendEvent({event:'verify-exhausted',component:key,rounds:state.verifyRounds[key]});continue;}
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
  addOp(store,state,{kind:'backend.implement',goal:`Make the job gates pass: ${failed.map(result=>result.name).join(', ')}`,
    ledgerIds:[],allowlist:unique(state.ops.flatMap(op=>op.allowlist)),references:[],
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
    const loaded=ctx.work.api.loadLedger({repoRoot:ctx.work.repoRoot,validate:ctx.work.validate});
    state.ledgerSummary=ctx.work.api.ledgerSummary(loaded,{scope:state.scope.length?state.scope:null});
  }catch{/* a tree that cannot be re-read leaves the approved summary in place */}
  return state.ledgerSummary;
}

function finish(store,state,outcome,reason=null,ctx=null){
  const final={schema:FINAL_REPORT,id:state.id,job:state.job,outcome,reason,branch:state.branch,head:state.head,
    ledgerMode:state.ledgerMode,scope:state.scope,ledgerSummary:refreshLedgerSummary(state,ctx),decisions:state.decisions,
    definitionOfDone:state.definitionOfDone,
    ledger:state.ledger.map(item=>({...item})),
    acceptedAsPreexisting:state.ledger.filter(item=>item.status==='preexisting').map(item=>item.id),
    gates:state.gateResults.map(result=>({name:result.name,command:result.command,status:result.status,exitCode:result.exitCode})),
    needUser:state.needUser,
    ops:state.ops.map(op=>({id:op.id,kind:op.kind,node:op.nodeId,origin:op.origin,status:op.status,runtime:op.runtime,attempt:op.attempt,
      allowlist:op.allowlist,ledgerIds:op.ledgerIds,head:op.head,verdict:op.verdict,validation:op.validation??null,files:op.files})),
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
  ctx.allocator.failed(runtime,{reason:'rate-limited (inferred from repeated silence)'});
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
    if(observed.liveness==='rate-limited'){ctx.allocator.failed(op.runtime,{reason:`rate-limited (${observed.reason??'provider screen'})`});store.appendEvent({event:'rate-limit-parked',op:op.id,runtime:op.runtime});}
    else ctx.allocator.release(op.runtime);
    if(observed.liveness==='stalled-silent'&&noteSilence(store,state,op,ctx))op.avoidRuntimes=unique([...op.avoidRuntimes,op.runtime].filter(Boolean));
    op.restarts+=1;
    store.appendEvent({event:'settled',op:op.id,liveness:observed.liveness,restarts:op.restarts});
    noteAnomaly(store,state,`settled:${op.id}:${observed.liveness}`,{op:op.id,runtime:op.runtime,liveness:observed.liveness});
    triageAnomaly(store,state,`settled:${op.id}:${observed.liveness}`,{...ctx,orca});
    if(op.restarts>RESTART_LIMIT){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} was restarted ${op.restarts} times (${observed.liveness})`});
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
export function reconcileWithOrca(orca,store,state,{cwd=state.worktree,wait=sleepSync}={}){
  const listed=orca.invoke('worker-list',{run:state.run},{cwd});
  if(listed.outcome!=='ok')return {orphans:[],reason:listed.reason};
  const live=(getPath(listed.receipt,'result.workers')??[]).filter(w=>['ready','running','starting'].includes(w.workerState)||(w.workerState==='unsupervised'&&['dispatched','pending','ready'].includes(w.dispatchStatus)));
  const known=new Set(state.ops.map(op=>op.dispatch).filter(Boolean));
  const orphans=[];
  for(const worker of live){
    if(known.has(worker.dispatchId))continue;
    const settlement=settleDispatch(orca,worker.dispatchId,{cwd,reason:'orphan dispatch not named by any operation',terminalHandle:worker.agentTerminalHandle??null,closeTerminal:true,wait});
    orphans.push({dispatch:worker.dispatchId,terminal:worker.agentTerminalHandle??null,effectState:settlement.effectState});
  }
  if(orphans.length)store.appendEvent({event:'reconciled-orphans',orphans});
  return {orphans};
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
export const TRIAGE_AFTER=3;
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
  if(option==='resume-ops'){for(const op of state.ops)if(op.status==='blocked'&&op.refusal!=='dynamic-op'){op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='park-runtime'){const runtime=entry.detail?.runtime;if(runtime)ctx.allocator.failed(runtime,{reason:`triage: ${signature}`});}
  else if(option==='settle-op'){const op=state.ops.find(item=>item.id===entry.detail?.op&&item.status==='running');if(op){settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'triage',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='restart-kernel'){fs.writeFileSync(path.join(store.dir,'stop.flag'),'triage restart');}
  else state.needUser.push({kind:'triage',detail:`${signature}: ${JSON.stringify(entry.detail).slice(0,300)}`});
  return option;
}

export function runLoop(orca,store,state,{cwd=state.worktree,allocator,planOp=llm.planOp,decide=llm.decide,validateOp=llm.validateOp,template,supervisor=null,validator=null,
  wait=sleepSync,exec=runCommand,git=spawnSync,launch=launchWithCandidate,maxIterations=Infinity,guards=kernelGuards,
  ledgerApi=work,validate=validateWorkTree,waitTimeoutMs=900000,tickMs=120000,pollMs=POLL_MS,now=Date.now}={}){
  need(state.approved,`Workflow ${state.id} is not approved; run workflow-approve --id ${state.id}`);
  need(plain(allocator),'A runtime allocator is required');
  need(typeof template==='string'&&template.trim(),'The operation contract template is required');
  required(state.run,'Orca run id');required(state.from,'own terminal handle');
  // `validateOp:null` is an explicit choice to run without the validator; it is recorded once as `validator-skipped`.
  const ctx={cwd,allocator,planOp,decide,validateOp,template,wait,exec,git,launch,now,guards,work:null,orca,
    supervisor:supervisor??supervisorRuntimes(state.host??''),validator:validator??validatorRuntimes(state.host??'')};
  // A state written before these bounds existed resumes with them.
  state.dynamicOps=Number.isFinite(state.dynamicOps)?state.dynamicOps:0;
  state.dynamicOpsBudget=dynamicBudget(state);
  state.sharedQueue=Array.isArray(state.sharedQueue)?state.sharedQueue:[];
  state.silences=plain(state.silences)?state.silences:{};
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
    const loaded=ledgerApi.loadLedger({repoRoot,validate});
    // The kernel block is part of a node's semantic digest, so a completion must bind the digest the
    // validator reports AFTER that block is written: every transition resolves it through this reader.
    const digest=({node})=>{
      const fresh=ledgerApi.loadLedger({repoRoot,validate}).nodes.get(node.id)?.inputDigest;
      need(/^[a-f0-9]{64}$/.test(String(fresh??'')),`The Work validator reports no inputDigest for ${node.id}`);
      return fresh;
    };
    const remote=ctx.git('git',['remote','get-url','origin'],{cwd:repoRoot,encoding:'utf8',windowsHide:true});
    const origin=remote.status===0?ledgerApi.normalizeOrigin?.((remote.stdout??'').trim())??null:null;
    ctx.work={api:ledgerApi,loaded,repoRoot,validate,digest,origin,repository:ledgerApi.repositoryName?.(repoRoot)??null,node:id=>loaded.nodes.get(id)??null};
    store.appendEvent({event:'ledger-loaded',workRoot:slash(loaded.workRoot),valid:loaded.ok,nodes:loaded.list.length,scope:state.scope});
  }
  // Operations created before a rule change carry their old check lists: the kernel-owned checks are stripped on load.
  for(const op of state.ops)if(Array.isArray(op.checks))op.checks=op.checks.filter(check=>!KERNEL_CHECK.test(check.name??''));
  reconcileWithOrca(orca,store,state,{cwd,wait});
  for(let iteration=0;iteration<maxIterations&&!state.finished;iteration+=1){
    if(iteration>0&&iteration%RECONCILE_EVERY===0)reconcileWithOrca(orca,store,state,{cwd,wait});
    if(stopRequested(store)){store.appendEvent({event:'stopped',reason:'stop flag'});store.saveState(state);return state;}
    state.iterations+=1;
    store.appendEvent({event:'tick',iteration:state.iterations,
      ops:state.ops.map(op=>`${op.id}=${op.status}`),ledger:state.ledger.map(item=>`${item.id}=${item.status}`)});
    answerQuestions(orca,store,state,ctx);
    resumePaused(store,state);
    drainSharedQueue(store,state);
    syncLedgerOps(store,state,ctx);
    planVerifyOps(store,state,ctx);
    scheduleOps(orca,store,state,ctx);
    state.allocation=typeof allocator.serialize==='function'?allocator.serialize():allocator.snapshot?.()??null;
    const running=state.ops.filter(op=>op.status==='running');
    // Fast path: an operation whose report is already on disk is accepted before any blocking wait.
    const early=acceptReports(orca,store,state,ctx);
    if(Array.isArray(early)&&early.length){store.appendEvent({event:'accepted-early',ops:early.map(item=>item.op)});store.saveState(state);continue;}
    if(running.length){
      const tick=waitTick(orca,{cwd:state.worktree,run:state.run,from:state.from,timeoutMs:waitTimeoutMs,tickMs,
        reportsDir:store.paths.reports,now,wait});
      if(tick.event==='check-failed'){noteAnomaly(store,state,`check-failed:${tick.check?.reason??'unknown'}`,{reason:tick.check?.reason??null});triageAnomaly(store,state,`check-failed:${tick.check?.reason??'unknown'}`,{...ctx,orca});}
    store.appendEvent({event:'wait',result:tick.event,ticks:tick.ticks,
        liveness:(tick.liveness??[]).map(item=>`${item.dispatch}:${item.liveness}`)});
      acceptReports(orca,store,state,ctx);
      settleStalled(orca,store,state,ctx,tick);
      store.saveState(state);
      continue;
    }
    if(state.ops.some(op=>liveStatus.includes(op.status))){
      // Nothing could be launched and nothing is running: every runtime is busy, cooling or out of budget.
      state.stalls+=1;
      store.appendEvent({event:'stalled',stalls:state.stalls,allocation:state.allocation});
      if(state.stalls>=STALL_LIMIT){
        state.needUser.push({kind:'environment',detail:`no runtime accepted an operation in ${state.stalls} iterations`});
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

export function kernelMain(command,options={},{orca,cwd=process.cwd(),wait=sleepSync,functions={}}={}){
  const worktree=path.resolve(cwd);
  const repoRoot=repositoryRoot(worktree);
  const open=id=>{
    const store=createStore({repoRoot,id:required(id,'workflow id')});
    const state=store.loadState();
    need(plain(state)&&state.kernel===WORKFLOW_KERNEL,`No workflow kernel state in ${slash(store.dir)}`);
    // A state written before the ledger mode existed resumes as a plan-ledger workflow.
    state.ledgerMode=LEDGER_MODES.includes(state.ledgerMode)?state.ledgerMode:'plan';
    state.scope=Array.isArray(state.scope)?state.scope:[];
    state.decisions=Array.isArray(state.decisions)?state.decisions:[];
    // Ledger root = the worktree (branch content); the store root above = the main repository (history).
    state.repoRoot=state.repoRoot??worktree;
    if(options.allocation)state.quota=parseQuota(options.allocation);
    return {store,state};
  };
  if(command==='workflow-goal'){
    const job=required(options.job,'job');
    const host=hostOf(options,repoRoot);
    const store=createStore({repoRoot,id:options.id??newWorkflowId(job)});
    const ledgerMode=detectLedgerMode(worktree,options.ledger??null);
    const state=createWorkflowState({job,inputs:csv(options.inputs),worktree,branch:currentBranch(worktree),
      gates:csv(options.gates),store,host,launcher:launcherOf(host),ledgerMode,scope:csv(options.scope),repoRoot:worktree});
    if(options.allocation)state.quota=parseQuota(options.allocation);
    store.appendEvent({event:'created',job,inputs:state.inputs,worktree:slash(worktree),branch:state.branch,
      ledgerMode,scope:state.scope});
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,...goalPhase(store,state,{cwd:worktree,...functions})};
  }
  if(command==='workflow-stop'){
    const {store}=open(options.id);
    fs.writeFileSync(path.join(store.dir,'stop.flag'),String(Date.now()));
    return {schema:WORKFLOW_KERNEL,command,id:options.id,dir:store.dir,stopRequested:true,next:'the running kernel exits at its next iteration (at most one wait tick); workflow-run resumes from state.json'};
  }
  if(command==='workflow-approve'){
    const {store,state}=open(options.id);
    return {schema:WORKFLOW_KERNEL,command,dir:store.dir,
      ...approve(store,state,{allocation:options.allocation??null,allowDynamic:options['allow-dynamic']??null})};
  }
  if(command==='workflow-status'){
    const {store,state}=open(options.id);
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:state.phase,approved:state.approved,
      iterations:state.iterations,head:state.head,ledgerMode:state.ledgerMode,scope:state.scope,
      ledgerSummary:state.ledgerSummary,decisions:state.decisions,preflight:state.preflight??null,
      dynamicOps:state.dynamicOps??0,dynamicOpsBudget:dynamicBudget(state),sharedQueue:state.sharedQueue??[],
      ledger:state.ledger.map(item=>({id:item.id,status:item.status,title:item.title,evidence:item.evidence})),
      ops:state.ops.map(op=>({id:op.id,kind:op.kind,status:op.status,runtime:op.runtime,attempt:op.attempt})),
      workNodes:state.ops.filter(op=>op.nodeId).map(op=>({op:op.id,node:op.nodeId,status:op.status})),
      gates:state.gateResults,needUser:state.needUser,finished:state.finished,
      events:store.readEvents().slice(-20),final:readJson(store.paths.final,null)};
  }
  if(command==='workflow-run'){
    const {store,state}=open(options.id);
    need(state.approved,`Workflow ${state.id} is not approved yet; run workflow-approve --id ${state.id}`);
    const launchFile=options['launch-file']?path.resolve(worktree,options['launch-file']):store.paths.launch;
    let from=options.from??state.from,run=options.run??state.run;
    if(!from){const launch=awaitLaunch(launchFile,{wait});from=launch.from;run=run??launch.run??null;state.workflowTask=launch.task??state.workflowTask;}
    state.from=required(from,'own terminal handle');
    // `run-bound` is the one-time hand-off this kernel performed; joining a run it already has is `run-resumed`.
    const binding=!run;
    state.run=run??bindRun(orca,{cwd:worktree,state,from:state.from});
    state.host=state.host??hostOf(options,repoRoot);
    state.launcher=state.launcher??launcherOf(state.host);
    store.appendEvent({event:binding?'run-bound':'run-resumed',run:state.run,from:state.from,iterations:state.iterations});
    const finished=(()=>{const release=acquireKernelLock(store);try{fs.rmSync(path.join(store.dir,'stop.flag'),{force:true});return runLoop(orca,store,state,{cwd:worktree,wait,
      // Slots are derived from the operations that are actually running; saved loads may belong to a dead kernel.
      supervisor:supervisorRuntimes(state.host),validator:validatorRuntimes(state.host),
      allocator:createAllocator({runtimes:withSupervisorPreference(loadRuntimes(),supervisorRuntimes(state.host)),state:{...(state.allocation??{}),loads:Object.fromEntries(Object.entries(state.ops.filter(op=>op.status==='running'&&op.runtime).reduce((acc,op)=>{acc[op.runtime]=(acc[op.runtime]??0)+1;return acc;},{})))},quota:state.quota??null}),template:templateOf(state.host),
      maxIterations:options['max-iterations']?Number(options['max-iterations']):Infinity,...functions});}finally{release();}})()
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:finished.phase,ledgerMode:finished.ledgerMode,
      finished:finished.finished,ledger:finished.ledger.map(item=>`${item.id}=${item.status}`),
      ledgerSummary:finished.ledgerSummary,needUser:finished.needUser,head:finished.head,iterations:finished.iterations};
  }
  throw Error(`Unsupported workflow kernel command: ${command}`);
}

// The CLI surface is the canonical launcher (`orca-supervised-launch.mjs workflow-goal|workflow-approve|
// workflow-run|workflow-status`), which routes straight into kernelMain; this module stays import-only.
