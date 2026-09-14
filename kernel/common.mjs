import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {skillRoot} from '../core/runtime-root.mjs';
import {ORCA_HOST} from '../hosts/orca/calls.mjs';
import {resolveLedgerRoot} from './routing.mjs';
import * as graph from './graph.mjs';
import {DECISION_OPERATION} from './io.mjs';

/**
 * What every concern of the kernel needs and none of them owns.
 *
 * The kernel was split by concern - the goal, the intake, the owner loop, the lanes, the terminals, the
 * verification - and a split by concern only holds if the pieces do not import each other in a circle. So the
 * primitives two or more of them need live here and nowhere else: the tiny value helpers, the bounds, the
 * allowlist algebra, the shape of an operation, the graph lookups that answer a route, and the addressing of a
 * shared Work tree. This module imports no other kernel concern, which is what makes the rest of them a tree.
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
 * (`model/kinds.yaml` through `kernel/graph.mjs`) decides the kind of every step, and this map is
 * what a tree whose kind graph cannot be read falls back to. Decision kinds are answered, never launched.
 */
export const WORK_OPERATION={implementation:'backend.implement',ui:'interface.implement',uat:'uat.verify',e2e:'e2e.verify',operations:'runtime.operate'};
export {DECISION_OPERATION};
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
/**
 * Its sibling: the kind that cuts one node too big for a single operation into child nodes with disjoint write
 * scopes. It carries the same operator contract (`work.author`, sequence `work.cut`) and the same standing -
 * before the lane, no route, no lane names it, one per node, planned by the kernel itself - but it is a kind of
 * its own because that is what the goal page, the status view and the events show: a heavy node reads
 * `1 implementation.plan -> seam -> N backend.implement -> 1 e2e.verify -> 1 review.verify`.
 */
export const PLAN_KIND='implementation.plan';
/** The two kinds that author a Work record instead of working from one. Neither walks a step of any lane. */
export const AUTHORS_RECORD=[AUTHOR_KIND,PLAN_KIND];
export const authorsRecord=kind=>AUTHORS_RECORD.includes(String(kind??''));
/** What stays the kernel's inside a record an author op may otherwise write. Compared before and after, never reverted field by field. */
export const RECORD_OWNED=['state','completion','extensions.work3.kernel'];
export const RESUME_LIMIT=5,RETRY_LIMIT=3,RESTART_LIMIT=3,VERIFY_ROUNDS=3,GATE_ROUNDS=3,LAUNCH_LIMIT=3;
/** A workflow with nothing running and nothing launchable waits this long before it stops for the user: a runtime that is cooling for five minutes is not a dead environment. */
export const STALL_MS=30*60*1000;
/** Run-time growth is bounded too: ops nobody approved, shared changes per iteration, inferred rate limits. */
export const DYNAMIC_OPS_BUDGET=64;
export const SHARED_OPS_PER_ITERATION=3,SILENCE_LIMIT=2,RATE_LIMIT_WINDOW_MS=30*60*1000;
export const CHECK_TIMEOUT_MS=30*60*1000,LAUNCH_WAIT_MS=180000,POLL_MS=5000;
/** The validator: two rejects of one op stop it at the user, three unavailable verdicts in a row name the outage; memory and diff are bounded in bytes. */
export const VALIDATOR_REJECT_LIMIT=2,VALIDATOR_UNAVAILABLE_LIMIT=3;
export const VALIDATOR_MEMORY_LINES=40,VALIDATOR_MEMORY_BYTES=12*1024,VALIDATOR_DIFF_BYTES=120*1024;
export const REF_KINDS=['srs','sds','plan','brief','note','design','uat','file','dir','url'];

export const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const need=(condition,message)=>{if(!condition)throw Error(message);};
export const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
export const csv=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
export const unique=list=>[...new Set(list)];
export const slash=value=>String(value??'').replaceAll('\\','/');
export const normalize=value=>slash(value).replace(/^\.\//,'');
export const tail=(text,max=400)=>String(text??'').replace(/\s+$/,'').slice(-max);
export const firstLine=value=>String(value??'').split('\n').map(line=>line.trim()).find(Boolean)??'';
export const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
export const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);};
export const sleepSync=ms=>{if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};
export const runCommand=(command,{cwd,timeoutMs=CHECK_TIMEOUT_MS}={})=>spawnSync(command,{cwd,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,maxBuffer:64*1024*1024});
export const oneLine=(text,max=200)=>String(text??'').replace(/\s*\r?\n\s*/g,' ').trim().slice(0,max);
export const clockOf=ctx=>typeof ctx?.now==='function'?ctx.now():Date.now();

/** Allowlist entries are paths or `dir/**` globs; two operations may run together only when no root contains the other. */
export const allowRoot=entry=>normalize(entry).replace(/\/?\*+$/,'').replace(/\/+$/,'');
export const covers=(a,b)=>{const x=allowRoot(a),y=allowRoot(b);return x===y||y.startsWith(`${x}/`)||x.startsWith(`${y}/`);};
export const allowlistsOverlap=(a=[],b=[])=>a.some(one=>b.some(other=>covers(one,other)));
export const inside=(file,allowlist=[])=>allowlist.some(entry=>{const root=allowRoot(entry);return file===root||file.startsWith(`${root}/`);});
/** A path inside a Work tree, in either spelling: the tree-relative `.starciwork/...` or the owner's absolute one. */
export const isWorkTreePath=entry=>/(^|\/)\.starciwork(\/|$)/.test(slash(entry));
/**
 * A build or a repair scope composed from OTHER operations' allowlists: the code they touched, never the Work
 * tree. One tree is shared by a project's repositories, so a `.starciwork` entry inherited from a design op puts
 * another workflow's in-flight records inside a builder's write scope - a gate repair once committed a kernel
 * block into a frontend record that way, and was later blamed for a record a frontend lane was still writing.
 */
export const buildScope=entries=>unique(entries??[]).filter(entry=>!isWorkTreePath(entry));
/** Paths named inside free text (a blocker detail, a review finding): only tokens that carry a directory separator. */
export const pathsIn=text=>unique(String(text??'').match(/[A-Za-z0-9_@.][A-Za-z0-9_@./-]*\/[A-Za-z0-9_@./-]+/g)??[]).map(normalize);
/**
 * A dynamic op stays inside the approved scope, matched against the scope entries that name a path or a
 * feature folder: an entry by prefix, or as a path segment. A scope given as a Work node id (`demo.sales`)
 * constrains the ledger, not a file path, so it never refuses an op's allowlist here.
 */
const pathScopes=scope=>(scope??[]).map(entry=>normalize(entry).replace(/^features\//,'').replace(/\/+$/,''))
  .filter(key=>key&&!(key.includes('.')&&!key.includes('/')));
export const inScopePath=(file,scope=[])=>{
  const keys=pathScopes(scope);
  return !keys.length||keys.some(key=>covers(key,file)||`/${normalize(file)}/`.includes(`/${key}/`));
};

/**
 * The guard surface (`kernel/guards.mjs`): path protection, resource locks, git serialization and
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
const loadedGuards=await import('./guards.mjs').then(module=>module,()=>null);
export const kernelGuards=Object.fromEntries(Object.entries(FALLBACK_GUARDS)
  .map(([name,fallback])=>[name,typeof loadedGuards?.[name]==='function'?loadedGuards[name]:fallback]));

export function parseRef(ref){
  if(plain(ref))return {kind:ref.kind??'file',ref:required(ref.ref??ref.path,'input ref')};
  const value=required(ref,'input ref');
  const [head,...rest]=value.split(':');
  return REF_KINDS.includes(head)&&rest.length?{kind:head,ref:rest.join(':').trim()}:{kind:'file',ref:value};
}
export function parseGate(gate){
  if(plain(gate))return {name:required(gate.name,'gate name'),command:required(gate.command,'gate command'),timeoutMs:gate.timeoutMs??null};
  const value=required(gate,'gate');
  const index=value.indexOf('=');
  need(index>0,`A gate must be "name=command": ${value}`);
  return {name:value.slice(0,index).trim(),command:value.slice(index+1).trim(),timeoutMs:null};
}
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

export function currentBranch(cwd,git=spawnSync){
  const shown=git('git',['rev-parse','--abbrev-ref','HEAD'],{cwd,encoding:'utf8',windowsHide:true});
  return shown.status===0?(shown.stdout??'').trim():'unknown';
}

/**
 * The host the kernel runs on, as the runner describes itself: Orca (`ORCA_HOST`) or the headless host. A runner
 * that says nothing is Orca, which is what every runner before hosts existed was.
 */
export function hostDescriptorOf(orca){
  const host=orca?.host;
  if(!plain(host)||typeof host.name!=='string')return ORCA_HOST;
  return {name:host.name,capabilities:Array.isArray(host.capabilities)?[...host.capabilities]:[],sequential:host.sequential===true};
}
/** The capabilities a kind needs that this host lacks; `[]` when the kind may run here (or the graph does not know it). */
export function hostMissing(host,kind){
  let needs=[];
  try{needs=graph.needsOf(kind);}catch{needs=[];}
  const offered=Array.isArray(host?.capabilities)?host.capabilities:[];
  return needs.filter(capability=>!offered.includes(capability));
}

/* ------------------------------------------------------------------ the shape of one operation */

export const byId=(state,id)=>state.ops.find(op=>op.id===id)??null;
export const ledgerItem=(state,id)=>state.ledger.find(item=>item.id===id)??null;
/** `paused` is live too: an op waiting for its shared change is not finished and never lets the job finish. */
export const liveStatus=['pending','ready','running','answering','paused'];
export const nextId=(state,prefix)=>`${prefix}-${state.counters[prefix]=(state.counters[prefix]??0)+1}`;

export function toOp(raw,index){
  const id=typeof raw?.id==='string'&&raw.id.trim()?raw.id.trim():`op-${index+1}`;
  return {id,kind:required(raw?.kind,`kind of operation ${id}`),goal:required(raw?.goal,`goal of operation ${id}`),
    nodeId:typeof raw?.nodeId==='string'&&raw.nodeId.trim()?raw.nodeId.trim():null,
    ledgerIds:[...(raw.ledgerIds??[])],allowlist:[...(raw.allowlist??[])],references:[...(raw.references??[])],
    checks:(raw.checks??[]).map(check=>({name:required(check?.name,'check name'),command:required(check?.command,'check command')})),
    acceptance:[...(raw.acceptance??[])],dependsOn:[...(raw.dependsOn??[])],timeoutMs:raw.timeoutMs??null,
    resources:[...(raw.resources??[])],requesters:[...(raw.requesters??[])],
    status:'pending',origin:raw.origin??'plan',attempt:1,resumes:0,repairs:0,restarts:0,launchFailures:0,
    // Relaunches the kernel owes the operation nothing for: a prompt that never reached the agent's tab.
    infraRestarts:0,contractBytes:0,tabReadAt:null,tabRead:null,
    priorOpen:[...(raw.priorOpen??[])],findings:[...(raw.findings??[])],avoidRuntimes:[...(raw.avoidRuntimes??[])],
    runtime:null,target:null,task:null,dispatch:null,terminal:null,contractFile:null,nudged:false,
    kernelOwned:[],kernelOwnedAt:null,waitingFor:null,refusal:null,createdIteration:0,question:plain(raw.question)?{...raw.question}:null,
    reports:[],files:[],head:null,verdict:null,validation:null,validatorRejects:0,needsReplan:Boolean(raw.needsReplan)};
}
export function addOp(store,state,raw,reason){
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
const KERNEL_ORIGINS=['ledger','verify','gate','architecture','business'];
/** Ops the kernel itself derives from the ledger or its own rules: counted against nothing but their own bounds. */
export const countsAgainstBudget=op=>!KERNEL_ORIGINS.includes(op.origin);
export function gateDynamicOp(store,state,op){
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

/* ------------------------------------------------------------------ routes */

/** Every route the kernel applies is logged the same way, so the log names the rule that moved an operation. */
export const routed=(store,op,on,to,origin=null,extra={})=>store.appendEvent({event:'routed',op:op.id,on,to,origin,...extra});
/** The route for one situation, or null; a graph that knows no rule leaves the caller its own default. */
// The kernel's verdict words (`fail` on a review, `reject` from the validator) map onto the graph's route vocabulary.
const ROUTE_VERDICTS={fail:'findings',reject:'rejected'};
export const routeOf=query=>{try{return graph.routeFor({...query,...(query?.verdict?{verdict:ROUTE_VERDICTS[query.verdict]??query.verdict}:{})});}catch{return null;}};
/** The lane an operation belongs to: its own node, or - for a kernel review - the node set it judges. */
export const laneEntryOf=(state,op)=>state?.lanes?.[op?.nodeId??'']??state?.lanes?.[(op?.ledgerIds??[])[0]??'']??null;
/** The build step of a lane: its one implement-role kind, which is what a repair of that node must be. */
export const laneBuildKind=entry=>(entry?.lane??[]).find(kind=>kindRole(kind)==='implement')??null;
/**
 * A route may name the kind literally, the reporter's own kind (`same`, resolved by the graph) or the lane's
 * build step (`lane-build`), which only the kernel can resolve. Anything else yields null and the caller
 * keeps its own default, so an unknown sentinel never launches an operation of an invented kind.
 */
export function routeKind(route,state,op){
  // The graph resolves `same`/`lane.build` itself when it has the context; without it, it hands the symbol back
  // as `unresolved` and the kernel, which knows the op and its lane, resolves it here.
  const named=route?.kind??route?.unresolved??null;
  if(!named)return null;
  if(graph.KINDS.includes(named))return named;
  if(named==='same')return op?.kind??null;
  if(/build|lane/.test(named))return laneBuildKind(laneEntryOf(state,op));
  return null;
}

/* ------------------------------------------------------------------ the Work tree, addressed */

/** Checks the kernel runs itself as gates (whole-tree validator, end-to-end suites): never per operation, never in parallel. */
// Only the whole-tree validator is the kernel's own check. End-to-end checks belong to the op that owns them: the
// product's e2e suite starts its own throwaway stack (Testcontainers), so ops may run it in parallel and a slice
// is not accepted until its e2e scenarios are green.
export const KERNEL_CHECK=/^work-valid$/i;
/** The check a design change must survive: the Work tree still validates after the decision is written. */
export const validateCommandAt=workRoot=>`node ${slash(path.join(skillRoot,'bin','starci.mjs'))} validate ${slash(workRoot)}`;
export const workValidateCommand=ctx=>validateCommandAt(ctx.work.ledger?.workRoot??path.join(ctx.work.repoRoot,'.starciwork'));

/**
 * How the kernel reads a Work tree from anywhere that is not the run context: `deriveWorkOp` has the api and
 * the location, the run loop has `ctx.work`. Both answer the same three things, so one reader serves both.
 */
export const ledgerAccess=ctx=>{
  if(!plain(ctx))return null;
  if(plain(ctx.work))return {api:ctx.work.api??null,at:ctx.work.at??{repoRoot:ctx.work.repoRoot,workRoot:ctx.work.workRoot},loaded:ctx.work.loaded??null};
  if(ctx.api)return {api:ctx.api,at:ctx.at??null,loaded:ctx.loaded??null};
  return null;
};
export const workRootOf=at=>typeof at==='string'?path.join(at,'.starciwork')
  :plain(at)?(at.workRoot?String(at.workRoot):at.repoRoot?path.join(String(at.repoRoot),'.starciwork'):null):null;
export const UI_KIND='ui';

/**
 * On a shared ledger the Work tree is in the owner repository, not in this worktree: an allowlist entry under
 * `.starciwork/` and a reference that names a tree file are rewritten to the owner's absolute path, so the
 * operation writes and reads the one tree there is. A ledger that is here is left alone.
 */
/**
 * The allowlist a report is checked against names the shared tree both ways: the agent writes at the owner's
 * absolute path and reports the file the way the tree names it (`.starciwork/...`). The first grammar drawing
 * was rejected for `.starciwork/features/sales/ui/index.yaml` while its allowlist held only the absolute form.
 */
export function reportAllowlist(op,ctx){
  const owner=ctx?.work?.shared?ctx.work.ledger?.repoRoot:null;
  const entries=(op?.allowlist??[]).map(slash);
  if(!owner)return entries;
  const prefix=`${slash(owner)}/`;
  return unique(entries.flatMap(entry=>entry.startsWith(`${prefix}.starciwork/`)?[entry,entry.slice(prefix.length)]:[entry]));
}
export function locateSharedTreePaths(op,ctx){
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

/* ------------------------------------------------------------------ naming a Work node */

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
export function describeNode(api,repoRoot,node){
  try{
    const raw=api.readNode(repoRoot,node);
    const text=[raw?.description,raw?.title,raw?.name].map(value=>String(value??'').trim()).find(Boolean);
    return text||String(node.id);
  }catch{return String(node.id);}
}

/**
 * The design grammar the host installs (knowledge/grammars/<family>/{DNA,family,idioms}.yaml and the UI composition
 * state canon) is a reference of every design-family operation: a drawing, a frontend build or a walk without it
 * invents its own look. Product-agnostic: every grammar family the host carries is listed.
 */
export function grammarReferences(root=skillRoot){
  // The whole canon, not a shortlist: every grammar family file, every frontend pattern, every UI rule the host carries.
  const found=[];
  const walk=dir=>{try{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.ya?ml$/i.test(entry.name))found.push(slash(file));}}catch{}};
  for(const relative of [['knowledge','grammars'],['knowledge','patterns','fe'],['knowledge','ui']])walk(path.join(root,...relative));
  return unique(found).sort();
}

/** Job-wide rulings the user gave at approval time (`<store>/rulings.md`) travel inside every contract and in the validator memory. */
export function rulingsText(store){
  const file=path.join(store.dir,'rulings.md');
  if(!fs.existsSync(file))return '';
  return fs.readFileSync(file,'utf8').trim();
}
export function jobRulings(store){
  const body=rulingsText(store);
  return body?[`## Job rulings (apply to every operation)`,body,``]:[];
}
