import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {canonicalJSON,sha256} from '../core/index.mjs';
import {EventEmitter} from 'node:events';
import {preparedEntry,inputAsk} from './helpers/input-fixture.mjs';
import {encodePng,screen} from './helpers/png.mjs';
import {brandColours} from '../checks/render.mjs';
import {refreshCredentialPreparation,deferForIntegrationPreparation,normalizePreparationAuthority,reconcileStoppedNativeRetryLease,stageAnsweredDecisionLateReport,lateReportReplayMatches,restoreDeferredReportOperation,persistLaunchAttempts} from '../kernel/kernel.mjs';
import {reserveStartup} from '../kernel/startup-lock.mjs';
import {reconcileWorkflowInputs} from '../kernel/inputs.mjs';
import {credentialFields} from '../kernel/inputs-model.mjs';
import {inputFiles,privateJson} from '../kernel/inputs-server.mjs';
import {canonicalTarget,resolveExecutionChain} from '../kernel/chains.mjs';
import {ORCA_HOST,createOrcaCalls} from '../hosts/orca/calls.mjs';
import {HEADLESS_HOST,createHeadlessHost} from '../hosts/headless/host.mjs';
import {reportOutcome} from '../hosts/orca/protocol.mjs';
import {keepsAskTab} from '../kernel/terminals.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {spawn,spawnSync} from 'node:child_process';
import {validateGoalPlan,validateOp} from '../models/functions.mjs';
import {createStore} from '../kernel/store.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {createAllocator} from '../kernel/schedule.mjs';
import {loadsFileFor} from '../kernel/loads.mjs';
import {resolveLedgerRoot} from '../kernel/routing.mjs';
import {RESTART_LIMIT,toOp} from '../kernel/common.mjs';
import * as work from '../kernel/ledger.mjs';
import {describeLane,laneFor,nextKind,roleOf as graphRoleOf,routeFor,validateGraph} from '../kernel/graph.mjs';
import {machineVerify} from '../kernel/kernel.mjs';
import {attributedFiles} from '../kernel/verify.mjs';
import {relocateLauncher,reviveSupervisor} from '../kernel/kernel.mjs';
import {BRAND_DECIDE,BRAND_PAYLOAD,DESIGN_KINDS,DYNAMIC_OPS_BUDGET,RATE_LIMIT_COOLDOWN_MS,SPEC_LIMIT,critiqueRuntimes,operationSpec,queueInbox,credentialNeed,rebindRunIfNeeded,reportAllowlist,sharedCheckCommand,treeForVerdict,treeVerdictFor,TRIAGE_AFTER,TRIAGE_OPTIONS,VALIDATOR_REJECT_LIMIT,VALIDATOR_UNAVAILABLE_LIMIT,applyOpReport,approve,brandPayload,brandSummary,buildScope,changedFiles,createWorkflowState,writesWorkRecords,designRecord,detectLedgerMode,drainSharedQueue,goalPhase,hostDescriptorOf,hostMissing,kernelGuards,kernelMain,laneLine,lanePredicates,launchOperator,launchWithCandidate,LONG_CONTRACT_GRACE_MS,PERCEPTION_GRACE_MS,perceptionProviders,refundRetiredGenerationProbations,noteAnomaly,prepareWorkGate,producedKindVerdict,restoreDurableCheckpoint,recoverSatisfiedDependencyBlocks,sweepResolvedReviewLines,readValidatorMemory,INFRA_RESTART_LIMIT,infrastructureCause,reconcileWithOrca,renderContract,resumePaused,retryableOperation,runLoop,settleStalled,nativeActivityProof,triageAnomaly,validatorRejectLimit,workModule,workOpId,proposeQuota,LAUNCH_DAILY_CAP,decisionAllowlistFor,irreversibleEffect,ownerProvisionNeed,OP_DEADLINE_MS,TAB_STATUSES,ownerItems,sweepStaleLines,sweepStaleTerminals,askFillLine,ownerFillLines} from '../kernel/kernel.mjs';
import {GOAL_SPIN_LIMIT,adoptReportRev,applyInbox,evaluateGoalMetrics,goalMetricsOf,goalRevOf,metricsBindingOp,normalizeDoneMetrics,noteGoalMetrics,opInputDigests,propagateInvalidation,reopenStaleOp,reviseGoal,validateGoalRevision} from '../kernel/kernel.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const runtimeProfile=parseYaml(fs.readFileSync(new URL('../model/runtimes.yaml',import.meta.url),'utf8'));
const worktree='fixtures/orca/agentos-r14-sales';
const cwd=path.resolve(worktree);
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const noWait=()=>{};
/**
 * A real `runLoop`/`waitTick` cycle paces itself against wall-clock `now()`, so `wait:noWait` alone (no real
 * sleep) still burns real seconds: `waitTick`'s hot path (nothing running, nothing to report) never calls the
 * injected `wait` at all - it only ever compares `now()-started` against a timeout - so with a frozen clock that
 * comparison would never cross the threshold and the loop would spin forever. A real clock only terminated it by
 * genuinely burning wall time between calls. This clock keeps that same "every read moves the clock forward"
 * guarantee without the real delay: `now()` advances by a tiny epsilon on every read (so a bare polling loop
 * still converges, just after CPU-speed reads instead of real milliseconds) and `wait(ms)` advances it by the
 * full requested amount (so an explicit sleep still counts as what it says). Every deadline the kernel computes
 * from `now()` still resolves after the same number of logical steps - none of the real delay.
 */
// 200ms of epsilon per read is far below every real threshold this runtime compares against (the smallest,
// waitTimeoutMs/tickMs, are already seconds; heartbeat/stall grace windows are 10-20 minutes), so it cannot
// change which branch a scenario takes - it only bounds how many synchronous reads a bare polling loop needs
// before its own timeout math notices the (virtual) time has passed, instead of spinning on real fs/CPU work.
const CLOCK_EPSILON_MS=200;
const fakeClock=(start=Date.now())=>{let t=start;return {now:()=>{const value=t;t+=CLOCK_EPSILON_MS;return value;},wait:ms=>{t+=Math.max(0,Number(ms)||0);}};};
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-workflow-kernel-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const flag=(args,name)=>{const index=args.indexOf(`--${name}`);return index<0?null:args[index+1];};
const events=store=>store.readEvents();
const indexOfEvent=(list,predicate)=>list.findIndex(predicate);

test('persisted launch attempts retain bounded cleanup custody',()=>{
  const [attempt]=persistLaunchAttempts([{target:'codex',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-1',effectState:'none',cleanup:{complete:false,reason:'terminal retained for audit'},privatePayload:'not persisted'}}]);
  assert.deepEqual(attempt.settlement.cleanup,{complete:false,reason:'terminal retained for audit'});assert.equal(attempt.settlement.privatePayload,undefined);
});

/**
 * One scripted Orca for a whole 5.0 workflow: it launches command-terminal (qwen) and managed-agent
 * (claude, codex) operations through the real launcher, and the blocking wait "finishes" each live
 * operation by writing the next report scripted for its operation id.
 */
function scriptedOrca({reportsDir,scripts,run='run_wf'}){
  const terminals=new Map(),dispatches=new Map(),tasks=new Map(),live=new Map(),shows=new Map();
  const taken=new Map();let counter=0;const sends=[];
  const opOf=spec=>(String(spec??'').match(/op `([^`]+)`/)??[null,'unknown'])[1];
  const newHandle=()=>`term_${++counter}`;
  /**
   * What one tab shows, for the kernel's own `terminal-read`. A test that cares about the screen sets it with
   * `setScreen`; the default is a tab the contract reached and that is sitting at its prompt - what
   * `stalled-idle` was always supposed to mean - so the nudge-and-settle tests judge the same path they did.
   */
  const screens=new Map();
  const IDLE_TAB=['=== TASK ===','Task id: task_fake','● I have read the contract and started.','','❯'];
  const screenOf=handle=>{
    if(screens.has(handle))return screens.get(handle);
    const terminal=terminals.get(handle);
    if(!terminal)return IDLE_TAB;
    return terminal.sent
      ?['∵ Thinking… 1s','⠼ working (12s · esc to cancel)','qwen3.8-flash (Token Plan Singapore)']
      :['>_ Qwen Code (v0.23.3)','>   Type your message or @path/to/file','qwen3.8-flash (Token Plan Singapore)'];
  };
  let coordinator='term_kernel';
  const handlers={
    // The Run's coordinator is a fact of the fake: `run-use` moves it, the way Orca re-binds a Run to a new tab.
    'run-show':()=>json(0,{ok:true,result:{run:{id:run,coordinator_handle:coordinator}}}),
    'run-create':()=>json(0,{ok:true,result:{run:{id:run}}}),
    'run-use':args=>{coordinator=flag(args,'from')??coordinator;return json(0,{ok:true,result:{run:{id:run}}});},
    'task-create':args=>{
      const id=`task_${++counter}`;
      tasks.set(id,{id,display_name:flag(args,'display-name'),op:opOf(flag(args,'spec'))});
      return json(0,{ok:true,result:{task:{id,display_name:flag(args,'display-name'),task_id:id}}});
    },
    'task-update':()=>json(0,{ok:true,result:{task:{status:'ready'}}}),
    'task-list':()=>json(0,{ok:true,result:{tasks:[...tasks.values()].map(task=>({id:task.id,display_name:task.display_name}))}}),
    'terminal-create':args=>{
      const handle=newHandle();
      terminals.set(handle,{handle,title:flag(args,'title'),status:'running',sent:false,worktreePath:cwd,lastOutputAt:Date.now()});
      return json(0,{ok:true,result:{terminal:{handle}}});
    },
    'terminal-read':args=>{
      const handle=flag(args,'terminal');
      return json(0,{ok:true,result:{terminal:{handle,status:terminals.get(handle)?.status??'running',tail:screenOf(handle)}}});
    },
    'terminal-send':args=>{const terminal=terminals.get(flag(args,'terminal'));if(terminal)terminal.sent=true;return json(0,{ok:true,result:{}});},
    'terminal-rename':args=>{const terminal=terminals.get(flag(args,'terminal'));if(terminal)terminal.title=flag(args,'title');return json(0,{ok:true,result:{}});},
    'terminal-list':()=>json(0,{ok:true,result:{terminals:[...terminals.values()]}}),
    'terminal-close':args=>{terminals.delete(flag(args,'terminal'));return json(0,{ok:true,result:{}});},
    dispatch:args=>{
      const id=`ctx_${++counter}`,task=flag(args,'task'),handle=flag(args,'to');
      dispatches.set(id,{id,task,handle,op:tasks.get(task)?.op??'unknown'});
      live.set(id,dispatches.get(id));
      return json(0,{ok:true,result:{dispatch:{id,task_id:task},preamble:'=== PREAMBLE ===\nreport once\n=== TASK ===\nDo it'}});
    },
    'dispatch-show':args=>{
      const task=flag(args,'task');
      const found=[...dispatches.values()].find(item=>item.task===task);
      return json(0,{ok:true,result:{dispatch:{id:found?.id,task_id:task,assignee_handle:found?.handle,status:'dispatched'}}});
    },
    'worker-start':args=>{
      const id=`ctx_${++counter}`,handle=newHandle(),task=flag(args,'task');
      const agent=flag(args,'agent'),model=flag(args,'model')??null;
      terminals.set(handle,{handle,title:`Terminal ${counter}`,status:'running',sent:true,worktreePath:cwd,lastOutputAt:Date.now()});
      dispatches.set(id,{id,task,handle,agent,model,op:tasks.get(task)?.op??'unknown'});
      live.set(id,dispatches.get(id));
      return json(0,{ok:true,result:{state:'ready',dispatchId:id,taskId:task,launch:{effective:{agent,model}},
        effects:[{kind:'terminal',role:'agent',id:handle},{kind:'dispatch_input',state:'accepted'}]}});
    },
    'worker-show':args=>{
      const id=flag(args,'dispatch');
      // What Orca knows about a Dispatch no operation launched through this fake: a test that wants a failed
      // Dispatch with its `last_failure` puts the record in `shows`, and worker-show answers with it.
      const shown=shows.get(id);
      const found=dispatches.get(id);
      if(!found&&shown)return json(0,{ok:true,result:{dispatch:{id,...shown},worker:{state:'failed'},observation:{exactWorker:false,status:'exited'},terminal:null}});
      if(!found)return json(1,{ok:false,error:{message:'unknown dispatch'}});
      const terminal=terminals.get(found.handle);
      return json(0,{ok:true,result:{dispatch:{id:found.id,task_id:found.task,status:'dispatched',...(shown??{})},
        worker:{state:'ready',agent_terminal_handle:found.handle,startOptions:{launch:{effective:{agent:found.agent,model:found.model}}},
          effects:[{kind:'dispatch_input',state:'accepted'}]},
        observation:{exactWorker:true,status:'running'},
        terminal:{title:terminal?.title??null,worktreePath:cwd}}});
    },
    'worker-list':()=>json(0,{ok:true,result:{workers:[...live.values()].map(item=>({dispatchId:item.id,taskId:item.task,
      workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:item.handle}))}}),
    'worker-release':args=>{live.delete(flag(args,'dispatch'));return json(0,{ok:true,result:{dispatchId:flag(args,'dispatch'),state:'released',processAction:'none'}});},
    'worker-stop':args=>json(0,{ok:true,result:{state:'stopped',dispatchId:flag(args,'dispatch')}}),
    check:args=>{
      if(args.includes('--peek'))return json(0,{ok:true,result:{messages:[]}});
      // The blocking wait: every live operation that still has a scripted report finishes now.
      for(const dispatch of live.values()){
        const queue=scripts[dispatch.op];
        const file=path.join(reportsDir,`${dispatch.id}.json`);
        if(!queue?.length||fs.existsSync(file))continue;
        const {effect,...script}=queue.shift();
        // What the agent left on disk beside its report: a design record, a committed file.
        if(typeof effect==='function')effect();
        const report=buildReport({...script,run,task:dispatch.task,dispatch:dispatch.id,from:dispatch.handle});
        report.sent={messageId:`msg_${dispatch.id}`,sentAt:1,type:report.signal.type};
        fs.mkdirSync(reportsDir,{recursive:true});
        fs.writeFileSync(file,JSON.stringify(report));
        taken.set(dispatch.id,dispatch.op);
      }
      return json(0,{ok:true,result:{deliveryId:`delivery_${counter}`,messages:[]}});
    },
    send:args=>{sends.push(args);return json(0,{ok:true,result:{message:{id:`msg_${++counter}`}}});}
  };
  const spawn=(executable,args)=>{
    const key=args[0]==='terminal'?`terminal-${args[1]}`:args[0]==='agent-context'?'agent-context':args[1];
    const handler=handlers[key];
    if(!handler)throw Error(`Unexpected fake Orca call: ${args.join(' ')}`);
    return handler(args);
  };
  const setScreen=(handle,lines)=>{screens.set(handle,[...lines]);return handle;};
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),terminals,dispatches,live,shows,sends,screens,setScreen,IDLE_TAB};
}

/** Pools instead of a chain: least-index-free runtime per role, honouring `avoid`. */
function fakeAllocator({maxParallelOps=3,pools={implement:['qwen-agent','claude-agent','codex-agent'],verify:['qwen-agent','claude-fable','codex-agent'],decide:['claude-fable','codex-agent'],write:['codex-agent','claude-agent','qwen-agent'],plan:['claude-fable','codex-agent']}}={}){
  const busy=new Set(),requests=[];
  // The kind graph is the role authority, exactly as the real allocator reads it; the rest is the 4.x guess.
  // A kind the graph does not carry yet is not fatal for the allocator, exactly as in the real one: the role is
  // guessed from the kind's own action word.
  const roleOf=kind=>{
    let fromGraph=null;
    try{fromGraph=graphRoleOf(kind);}catch{fromGraph=null;}
    return fromGraph??(kind==='review.verify'?'verify':/\.decide$/.test(kind)?'decide':'implement');
  };
  return {
    maxParallelOps,requests,
    allocate(kind,{avoid=[]}={}){
      const role=roleOf(kind),free=(pools[role]??[]).filter(id=>!busy.has(id)&&!avoid.includes(id));
      requests.push({kind,role,avoid:[...avoid],chosen:free[0]??null});
      if(!free.length)return {ok:false,reason:`no runtime with a free slot for ${kind}`,avoid};
      busy.add(free[0]);
      return {ok:true,runtime:free[0],target:free[0],role,alternatives:free.slice(1)};
    },
    // A read-only preview of the same order, which the kernel asks for when it wants to NAME a runtime without
    // taking a slot (the review escalation records which runtime the group will get next).
    review(kind,{avoid=[]}={}){
      const role=roleOf(kind);
      return {role,ready:(pools[role]??[]).filter(id=>!busy.has(id)&&!avoid.includes(id)).map(id=>({runtime:id,target:id})),blocked:[]};
    },
    release(runtime){busy.delete(runtime);},
    failed(runtime){busy.delete(runtime);},
    snapshot(){return {busy:[...busy]};},
    serialize(){return {busy:[...busy]};},
    candidateFor(kind,target){
      const found=resolveExecutionChain({skill:'starci',op:kind}).candidates.find(candidate=>candidate.target===canonicalTarget(target));
      if(!found)throw Error(`Runtime target ${target} is not launchable for ${kind}`);
      return found;
    }
  };
}

const passing=(name,command)=>({name,command,exitCode:0,evidence:'ok'});
/** A fake worktree git: porcelain lists the dirty files until a commit clears the ones that were added. */
function fakeGit(dirty){
  const calls=[];let pending=[...dirty],staged=[];
  return {calls,git:(executable,args)=>{
    calls.push(args[0]);
    if(args[0]==='status')return {status:0,stdout:pending.map(file=>` M ${file}`).join('\n'),stderr:''};
    if(args[0]==='add'){staged=args.slice(args.indexOf('--')+1);return {status:0,stdout:'',stderr:''};}
    if(args[0]==='commit'){pending=pending.filter(file=>!staged.includes(file));staged=[];return {status:0,stdout:'',stderr:''};}
    if(args[0]==='rev-parse')return {status:0,stdout:'abc1234\n',stderr:''};
    return {status:0,stdout:'',stderr:''};
  },dirty:()=>pending,add:file=>pending.push(file)};
}

/**
 * The `kernel/guards.mjs` surface, stubbed so each test owns exactly what the path protection, the
 * resource locks, the git queue and the preflight do. The kernel defaults to the real module; these tests
 * inject the contract instead, because a fake worktree git cannot check anything out.
 */
function stubGuards(overrides={}){
  const calls={queue:0,enter:[],preflight:0};
  const slashed=value=>String(value).replaceAll('\\','/');
  const locks=op=>[...new Set(op?.resources??[])];
  return {calls,
    protectedPaths:node=>{const relative=slashed(node.path);return [`.starciwork/${relative}`,`.starciwork/${slashed(path.dirname(relative))}/evidence/**`];},
    revertProtected:()=>({reverted:[],removed:[]}),
    resourceLocks:locks,
    resourcesClash:(a,b)=>locks(a).some(lock=>locks(b).includes(lock)),
    gitQueue:fn=>{calls.queue+=1;return fn();},
    preflight:()=>{calls.preflight+=1;return {ok:true,fixes:[],problems:[]};},
    parseSharedChangePaths:detail=>[...new Set(String(detail??'').match(/[A-Za-z0-9_@.][A-Za-z0-9_@.*/-]*\/[A-Za-z0-9_@.*/-]+/g)??[])],
    ...overrides};
}
const running=(state,id,dispatch,runtime='qwen-agent')=>{
  const op=state.ops.find(item=>item.id===id);
  Object.assign(op,{status:'running',dispatch,runtime,terminal:`term_${dispatch}`});
  return op;
};
/** The validator as a stub: every result is accepted, so the tests above judge the kernel, not a model. */
const acceptAll=()=>({ok:true,verdict:'accept',summary:'stub validator: accepted',findings:[],dropped:[],provider:'stub',usage:null});
/**
 * The critic as a stub. Every goal is critiqued by the runtime, so every test that runs a goal phase hands one
 * in: `sound` with no objection, which changes no page and binds no operation. The verdicts that do are the
 * subject of their own tests below.
 */
const critique=(value={})=>()=>({ok:true,schema:'starci/goal-critique@1',verdict:'sound',objections:[],dropped:[],
  required:[],alternatives:[],question:null,provider:'stub-critic',attempt:0,attempts:[],usage:null,...value});
const soundCritique=critique();

function setup({job='Implement the sales slice',plan,scripts,dirty=[],exec,allocator=fakeAllocator(),gates=[],critiqueGoal,orca=null}){
  const repo=tmp();
  const store=createStore({repoRoot:repo,id:'20260912-104251-kernel-spec'});
  const state=createWorkflowState({job,inputs:['sds:.starciwork/features/sales/sds.md'],worktree:cwd,
    branch:'starci183/agentos-r14-sales',gates,store,host:path.resolve('.'),launcher:'L.mjs'});
  const goal=goalPhase(store,state,{assessGoal:()=>({ok:true,provider:'fake',value:plan}),
    critiqueGoal:critiqueGoal??soundCritique,
    renderGoalMarkdown:(value,{job:title})=>`# ${title}\n\n${value.ledger.map(item=>`- ${item.title}`).join('\n')}\n`,
    extractMaterial:()=>[{file:'sds.md',text:'design'}],cwd});
  // `orca` is a factory for another host (the headless one); the scripted Orca is the default.
  const fake=orca?orca({store,scripts}):scriptedOrca({reportsDir:store.paths.reports,scripts});
  const git=fakeGit(dirty);
  const runs=[];
  const clock=fakeClock();
  const run=(options={})=>runLoop(fake.orca,store,state,{cwd,allocator,template,wait:clock.wait,now:clock.now,
    reconcileInputs:()=>{},refreshPreparation:()=>{},deferPreparation:()=>false,
    exec:exec??((command)=>{runs.push(command);return {status:0,stdout:`${command} ok`,stderr:''};}),
    git:git.git,planOp:()=>{throw Error('planOp must not be called on this path');},
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    validateOp:acceptAll,
    waitTimeoutMs:2000,tickMs:1000,maxIterations:12,...options});
  return {repo,store,state,goal,fake,git,run,runs,allocator,clock,
    cleanup:()=>fs.rmSync(repo,{recursive:true,force:true})};
}

const salesPlan={
  definitionOfDone:['order intake persists an order','the receipt is rendered'],
  ledger:[{id:'goal-1',title:'Order intake',inputRef:'sds:SDS-FR-SALES-03',status:'absent'}],
  ops:[{id:'op-intake',kind:'backend.implement',goal:'Implement order intake.',ledgerIds:['goal-1'],
    allowlist:['apps/agentos-controlplane/src/sales/intake.ts'],references:['.starciwork/features/sales/sds.md#3'],
    checks:[{name:'unit',command:'npx vitest run sales'}],acceptance:['intake persists an order'],dependsOn:[]}]
};

const auditPlan=(operation='stales',command='node bin/starci.mjs check-stales --work .starciwork --repo source=. ' )=>({
  definitionOfDone:['the selected source state is measured without repair'],
  ledger:[{id:'audit-scope',title:'Read-only source audit',inputRef:'source:current',status:'absent'}],
  ops:[{id:'audit-source',kind:'review.verify',operation,goal:'Measure the selected source state without changing it.',ledgerIds:['audit-scope'],
    allowlist:['runtime/audit/**'],references:['src/**'],checks:[{name:'source-staleness',command:command.trim()}],
    acceptance:['the typed current finding report is retained without delivery acceptance'],dependsOn:[]}]
});
const stalenessReport=(findings=[{id:'finding-1',bindingId:'source:audit-scope',nodeId:'audit-scope',category:'source-drift',
  status:'revalidation-needed',layer:'source',code:'SOURCE_IDENTITY_CHANGED',detail:'The declared source identity changed.',expected:'accepted revision',
  observed:'current revision',route:'review.verify',operator:'review.verify',impactSetId:'impact-audit-scope',repairCandidate:null}])=>{
  const report={schema:'starci/source-staleness-report@1',workRoot:'C:/fixture/.starciwork',targets:['audit-scope'],
    baselineDigest:'b'.repeat(64),clean:findings.length===0,
    coverage:{mode:'canonical-work',closure:'synthetic exact target closure',selectedNodeIds:['audit-scope'],sourceBindings:[]},
    limitations:['Synthetic structural fixture; no semantic or runtime proof.'],impactGraph:{edges:[],impactSets:[{id:'impact-audit-scope',rootNodeId:'audit-scope',affectedNodeIds:['audit-scope']}]},
    currentInputs:{work:{ok:true,selectedNodes:1,snapshotDigest:'c'.repeat(64)},repositories:[{id:'source',root:'C:/fixture',head:'d'.repeat(40),
      dirty:false,originDigest:'e'.repeat(64),credentialFreeOrigin:true,snapshotDigest:'f'.repeat(64)}]},
    subjects:[{id:'audit-scope',path:'audit/index.yaml',kind:'implementation',inputDigest:'1'.repeat(64),effectiveState:'todo',
      status:'revalidation-needed',findingIds:findings.map(item=>item.id)}],findings};
  return {...report,reportDigest:sha256(canonicalJSON(report))};
};

test('typed stale findings settle a real report and durable journal as measurement without delivery or repair',()=>{
  const harness=setup({plan:auditPlan(),scripts:{}});let journal=null;
  try{
    approve(harness.store,harness.state);harness.state.run='run_wf';harness.state.from='term_kernel';
    journal=openJournal({file:path.join(harness.repo,'runtime','audit.sqlite')});
    harness.store.bindJournal(journal,1,{state:harness.state});harness.store.saveState(harness.state);
    const op=running(harness.state,'audit-source','ctx_audit'),report=buildReport({outcome:'partial',run:'run_wf',task:'task_audit',
      dispatch:'ctx_audit',from:'term_ctx_audit',summary:'The exact scanner measured one current stale binding.',files:[],
      checks:[{name:'source-staleness',command:op.checks[0].command,exitCode:1,evidence:'typed source-staleness report contains one finding'}],
      open:['SOURCE_IDENTITY_CHANGED audit-record requires revalidation']});
    report.sent={messageId:'msg_audit',sentAt:1,type:report.signal.type};
    fs.writeFileSync(harness.store.reportPath(report.dispatch),`${JSON.stringify(report,null,2)}\n`);
    const persisted=harness.store.readReports().find(item=>item.dispatch===report.dispatch);
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>1234,work:null,
      exec:()=>({status:1,stdout:JSON.stringify(stalenessReport()),stderr:''})};
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,op,persisted,ctx),'audit-measured');
    harness.store.saveState(harness.state);
    assert.equal(op.status,'done');assert.equal(op.verdict,'findings');assert.equal(op.audit.outcome,'findings');
    assert.equal(op.audit.findingCount,1);assert.deepEqual(op.files,[]);
    assert.equal(harness.state.ledger[0].status,'planned','measurement is not delivery or ledger completion');
    assert.equal(harness.state.ops.length,1,'a finding never creates a repair operation');
    const log=events(harness.store);assert.equal(log.filter(event=>event.event==='audit-measured').length,1);
    assert.equal(log.some(event=>['op-done','verify-findings','retry'].includes(event.event)),false);
    const saved=journal.db.prepare("SELECT state_json FROM state_snapshots WHERE workflow_id=? AND generation=1 AND state_json<>'' ORDER BY snapshot_id DESC LIMIT 1")
      .get(harness.state.id);
    const durable=JSON.parse(saved.state_json),durableOp=durable.ops.find(item=>item.id==='audit-source');
    assert.equal(durableOp.operation,'stales');assert.equal(durableOp.audit.outcome,'findings');
    assert.equal(durable.ledger[0].status,'planned');
  }finally{journal?.close();harness.cleanup();}
});

test('a pending durable audit check remains replayable and its persisted findings settle on the next pass',()=>{
  const harness=setup({plan:auditPlan(),scripts:{}});
  try{
    approve(harness.store,harness.state);const op=running(harness.state,'audit-source','ctx_pending_audit');
    op.candidate={status:'sealed',digest:'candidate-audit',observedFiles:[]};
    const report=buildReport({outcome:'partial',run:'run_wf',task:'task_pending_audit',dispatch:op.dispatch,from:'term_pending_audit',
      summary:'The exact scanner measured one current stale binding.',files:[],
      checks:[{name:op.checks[0].name,command:op.checks[0].command,exitCode:1,evidence:'typed source-staleness report contains one finding'}],
      open:['SOURCE_IDENTITY_CHANGED audit-record requires revalidation']});
    report.sent={messageId:'msg_pending_audit',sentAt:1,type:report.signal.type};
    const pending=Object.assign(Error('durable check is running'),{code:'STARCI_JOB_PENDING',job:{identity:{jobId:'bridge-audit-check'},status:'running'}}),
      base={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>1234,work:null,engine:{}};
    assert.throws(()=>applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,{...base,exec:()=>{throw pending;}}),error=>error===pending);
    assert.equal(op.status,'running');assert.equal(op.dispatch,'ctx_pending_audit');assert.equal(op.refusal,null);
    assert.deepEqual(op.candidate,{status:'sealed',digest:'candidate-audit',observedFiles:[]});
    assert.equal(events(harness.store).some(event=>event.event==='audit-measurement-failed'),false);
    assert.equal(fs.existsSync(harness.store.checksPath(`${op.id}-audit`)),false);
    const action=applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,{...base,
      exec:()=>({status:1,stdout:JSON.stringify(stalenessReport()),stderr:''})});
    assert.equal(action,'audit-measured');assert.equal(op.status,'done');assert.equal(op.verdict,'findings');
    assert.equal(op.audit.findingCount,1);assert.equal(op.refusal,null);
  }finally{harness.cleanup();}
});

test('typed architecture violations are findings while architecture input errors fail the audit',()=>{
  const plan=auditPlan('lint','starci architecture check .'),harness=setup({plan,scripts:{}});
  try{
    approve(harness.store,harness.state);const op=running(harness.state,'audit-source','ctx_arch_findings');
    const report=buildReport({outcome:'partial',run:'run_wf',task:'task_arch',dispatch:op.dispatch,from:'term_arch',summary:'Static architecture finding measured.',
      files:[],checks:[{name:op.checks[0].name,command:op.checks[0].command,exitCode:1,evidence:'ARCH_APP_IMPORT'}],open:['ARCH_APP_IMPORT apps/api/main.ts']});
    report.sent={messageId:'msg_arch',sentAt:1,type:report.signal.type};
    const output={schema:'starci/architecture-check@1',ok:false,repository:'C:/fixture',kinds:['backend'],files:1,compiler:{version:'fixture'},
      violations:[{ruleId:'ARCH_APP_IMPORT',path:'apps/api/main.ts'}],errors:[],limitations:['static only']};
    const action=applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,{cwd,allocator:harness.allocator,guards:stubGuards(),
      git:harness.git.git,wait:noWait,now:()=>1234,work:null,exec:()=>({status:1,stdout:JSON.stringify(output),stderr:''})});
    assert.equal(action,'audit-measured');assert.equal(op.verdict,'findings');assert.equal(op.audit.findingCount,1);
    assert.equal(harness.state.ledger[0].status,'planned');assert.equal(harness.state.ops.length,1);
  }finally{harness.cleanup();}
});

test('audit failures fail closed without retries or repairs, while legacy review behavior stays unchanged',()=>{
  for(const scenario of [
    {name:'malformed stale output',plan:auditPlan(),result:{status:1,stdout:'not json',stderr:''}},
    {name:'wrong stale protocol',plan:auditPlan(),result:{status:1,stdout:JSON.stringify({...stalenessReport(),schema:'other/report@1'}),stderr:''}},
    {name:'stale report digest mismatch',plan:auditPlan(),result:{status:1,stdout:JSON.stringify({...stalenessReport(),reportDigest:'0'.repeat(64)}),stderr:''}},
    {name:'lint has no exact checks',plan:auditPlan('lint','npm run lint'),mutate:op=>{op.checks=[];},result:{status:0,stdout:'clean',stderr:''}},
    {name:'architecture input unavailable',plan:auditPlan('lint','starci architecture check .'),result:{status:1,stdout:JSON.stringify({schema:'starci/architecture-check@1',ok:false,
      violations:[],errors:[{ruleId:'ARCH_CONFIG_INVALID',message:'missing config'}]}),stderr:''}},
    {name:'stack input unavailable',plan:auditPlan('lint','starci stacks check . --environment dev --deployment-model missing.yaml'),result:{status:1,
      stdout:JSON.stringify({schema:'starci/application-stacks-check@1',ok:false,errors:[{code:'deployment-model-unavailable'}]}),stderr:''}},
    {name:'Work input malformed',plan:auditPlan('lint','starci validate .starciwork'),result:{status:1,
      stdout:JSON.stringify({ok:false,errors:[{code:'UNSUPPORTED_METADATA'}]}),stderr:''}},
    {name:'unstructured lint exit',plan:auditPlan('lint','npm run lint'),result:{status:1,stdout:'lint failed',stderr:''}}
  ]){
    const harness=setup({plan:scenario.plan,scripts:{}});
    try{
      approve(harness.store,harness.state);const op=running(harness.state,'audit-source',`ctx_${scenario.name.replaceAll(' ','_')}`);scenario.mutate?.(op);
      const report=buildReport({outcome:'failed',run:'run_wf',task:'task_audit',dispatch:op.dispatch,from:`term_${op.dispatch}`,
        summary:scenario.name,files:[],checks:op.checks.length?[{name:op.checks[0].name,command:op.checks[0].command,exitCode:1,evidence:scenario.name}]:[]});
      report.sent={messageId:`msg_${op.dispatch}`,sentAt:1,type:report.signal.type};
      const before=harness.state.ops.length,ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,
        now:()=>1234,work:null,exec:()=>scenario.result};
      assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,ctx),'audit-failed',scenario.name);
      assert.equal(op.status,'blocked',scenario.name);assert.equal(op.refusal,'audit-measurement-failed',scenario.name);
      assert.equal(harness.state.ops.length,before,scenario.name);assert.equal(harness.state.ledger[0].status,'planned',scenario.name);
      assert.equal(events(harness.store).some(event=>['verify-findings','retry','op-done'].includes(event.event)),false,scenario.name);
    }finally{harness.cleanup();}
  }
  const invalid=setup({plan:auditPlan(),scripts:{}});
  try{
    approve(invalid.store,invalid.state);const op=running(invalid.state,'audit-source','ctx_invalid_audit');
    const report=buildReport({outcome:'partial',run:'run_wf',task:'task_invalid',dispatch:op.dispatch,from:'term_invalid',summary:'Invalid worker report.',
      files:[],checks:[{name:op.checks[0].name,command:op.checks[0].command,exitCode:1,evidence:'finding'}],open:['measured finding']});
    report.open=[];report.sent={messageId:'msg_invalid',sentAt:1,type:report.signal.type};
    assert.equal(applyOpReport(invalid.fake.orca,invalid.store,invalid.state,op,report,{cwd,allocator:invalid.allocator,guards:stubGuards(),
      git:invalid.git.git,wait:noWait,now:()=>1234,work:null,exec:()=>({status:1,stdout:JSON.stringify(stalenessReport()),stderr:''})}),'audit-failed');
    assert.equal(op.status,'blocked');assert.equal(invalid.state.ops.length,1);
    assert.equal(events(invalid.store).some(event=>event.event==='retry'||event.event==='verify-findings'),false);
  }finally{invalid.cleanup();}
  const protectedWrite=setup({plan:auditPlan(),scripts:{}});
  try{
    approve(protectedWrite.store,protectedWrite.state);const op=running(protectedWrite.state,'audit-source','ctx_protected_audit');
    op.kernelOwned=['.starciwork/features/audit/index.yaml'];op.kernelOwnedAt='before-worker-write';
    const report=buildReport({outcome:'partial',run:'run_wf',task:'task_protected',dispatch:op.dispatch,from:'term_protected',
      summary:'Finding plus an invalid protected write.',files:[],checks:[{name:op.checks[0].name,command:op.checks[0].command,exitCode:1,evidence:'finding'}],open:['measured finding']});
    report.sent={messageId:'msg_protected',sentAt:1,type:report.signal.type};
    const guards=stubGuards({revertProtected:()=>({reverted:['.starciwork/features/audit/index.yaml'],removed:[]})});
    assert.equal(applyOpReport(protectedWrite.fake.orca,protectedWrite.store,protectedWrite.state,op,report,{cwd,allocator:protectedWrite.allocator,
      guards,git:protectedWrite.git.git,wait:noWait,now:()=>1234,work:null,
      exec:()=>({status:1,stdout:JSON.stringify(stalenessReport()),stderr:''})}),'audit-failed');
    assert.equal(op.status,'blocked');assert.equal(op.refusal,'audit-measurement-failed');assert.equal(protectedWrite.state.ops.length,1);
    assert.equal(events(protectedWrite.store).some(event=>event.event==='retry'||event.event==='verify-findings'),false);
  }finally{protectedWrite.cleanup();}
  const legacyPlan=auditPlan();delete legacyPlan.ops[0].operation;
  legacyPlan.ops[0].checks=[{name:'review',command:'node --test tests/review.spec.mjs'}];
  const legacy=setup({plan:legacyPlan,scripts:{}});
  try{
    approve(legacy.store,legacy.state);const op=running(legacy.state,'audit-source','ctx_legacy');
    const report=buildReport({outcome:'partial',run:'run_wf',task:'task_legacy',dispatch:'ctx_legacy',from:'term_ctx_legacy',summary:'Delivery review found a defect.',
      files:[],checks:[{name:'review',command:op.checks[0].command,exitCode:1,evidence:'defect'}],open:['repair the reviewed delivery']});
    report.sent={messageId:'msg_legacy',sentAt:1,type:report.signal.type};
    const action=applyOpReport(legacy.fake.orca,legacy.store,legacy.state,op,report,{cwd,allocator:legacy.allocator,guards:stubGuards(),git:legacy.git.git,
      wait:noWait,now:()=>1234,work:null,exec:()=>({status:1,stdout:'',stderr:''})});
    assert.notEqual(action,'audit-measured');assert.ok(legacy.state.ops.length>1,'legacy review still routes a repair');
  }finally{legacy.cleanup();}
});

test('a named audit contract permits only control transport and requires files empty',()=>{
  const harness=setup({plan:auditPlan(),scripts:{}});
  try{
    const op=harness.state.ops[0],contract=renderContract({template,op,state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Named audit protocol/);
    assert.match(contract,/Do not create, edit or delete source, Work, stack, documentation, evidence or allowlist artifacts/);
    assert.match(contract,/only permitted writes are the exact check control file/);
    assert.match(contract,/omit the `--files` argument/);
    assert.match(contract,/must carry `files: \[\]`/);
    assert.doesNotMatch(contract,/--files <comma-separated changed paths>/);
    assert.match(contract,/--capability "<your Dispatch capability from the injected Orca preamble>"/);
    assert.match(contract,/A report file alone does not prove Orca accepted the signal/);
    const headless=renderContract({template,op,state:{...harness.state,hostAdapter:'headless'},store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.doesNotMatch(headless,/--capability/,'headless reports do not require Orca native custody');
    assert.match(contract,/This `partial` completes the measurement/);
    assert.match(contract,/Unavailable, malformed or failed measurement is not a successful audit/);
    assert.match(contract,/Preserve actual exit codes and all findings/);
    assert.doesNotMatch(contract,/## Cook until done|partial` is allowed only|report as if that check passed/);
    const ping=template.split('## Ping (mandatory)')[1].split('## Never')[0].trim();
    assert.ok(contract.includes(`## Ping (mandatory)\n${ping}`),'audit preserves the real heartbeat protocol');
  }finally{harness.cleanup();}
});

test('the goal phase writes goal.md and goal.json and stops: nothing is launched before the approval',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    assert.equal(harness.goal.ok,true);
    assert.equal(harness.state.phase,'awaiting-approval');
    assert.equal(harness.state.approved,false);
    assert.match(fs.readFileSync(harness.store.paths.goal,'utf8'),/# Implement the sales slice/);
    const recorded=JSON.parse(fs.readFileSync(harness.store.paths.goalJson,'utf8'));
    assert.equal(recorded.schema,'starci/workflow-goal@1');
    // The plan the kernel consumes is exactly a valid starci/goal-plan@1 form.
    assert.equal(validateGoalPlan(salesPlan).ok,true);
    assert.deepEqual(recorded.ledger.map(item=>[item.id,item.assessed,item.status]),[['goal-1','absent','planned']]);
    assert.deepEqual(recorded.ops.map(op=>op.id),['op-intake']);
    assert.deepEqual(events(harness.store).map(event=>event.event),['goal-critiqued','goal'],'the goal was critiqued before the page that asks for the approval was written');
    assert.deepEqual(fs.readdirSync(harness.store.paths.contracts),[]);
    // The loop refuses to run an unapproved plan, and no Orca call was ever made.
    assert.throws(()=>harness.run(),/not approved/);
    assert.equal(harness.fake.dispatches.size,0);
    assert.deepEqual(harness.store.loadState().ops.map(op=>op.status),['pending']);
    const state=harness.store.loadState();
    const contract=renderContract({template,op:state.ops[0],state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Cook until done/);assert.match(contract,/## Ping \(mandatory\)/);
    assert.match(contract,/partial` is allowed only when your session budget/,'implementation retains its completion loop');
    assert.match(contract,/Exclude the exact check control file .*kernel transport, not operation output/);
    assert.match(contract,/## Acceptance/);assert.match(contract,/## Never/);
    // A plan-mode backend.implement op without a Work node still gets the implement.ledger working order.
    assert.match(contract,/## Working order \(mandatory, in this order\)\nSequence `implement\.ledger`\./);
    assert.match(contract,/## Definition of done for this kind/);
    assert.match(contract,/node L\.mjs report --run run_wf/);
    assert.match(contract,/- `apps\/agentos-controlplane\/src\/sales\/intake\.ts`/);
    assert.doesNotMatch(contract,/<launcher>|<nested run>|<runtime dir>|<reports dir>/);
  }finally{harness.cleanup();}
});

test('kernel restart recovers collided approved input refs before any downstream input consumer',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    const {store,state}=harness;approve(store,state);state.run='run_wf';state.from='term_kernel';
    const refs=structuredClone(state.inputs),ops=structuredClone(state.ops);
    state.inputs={...refs,phase:'ready',page:'synthetic-existing-page'};store.saveState(state);
    Object.assign(state,store.loadState());
    let consumed=false;
    harness.run({maxIterations:0,refreshPreparation:(_store,resumed)=>{
      assert.deepEqual(resumed.inputs.map(item=>item.ref),refs.map(item=>item.ref));
      assert.deepEqual(resumed.inputs.filter(item=>item.kind==='sds'),refs);consumed=true;
    }});
    assert.equal(consumed,true);assert.deepEqual(state.inputs,refs);assert.deepEqual(store.loadState().inputs,refs);
    assert.deepEqual(state.ops,ops);assert.equal(state.ownerInputs.page,'synthetic-existing-page');
    assert.equal(state.approved,true);assert.equal(state.iterations,0);assert.equal(harness.fake.dispatches.size,0);
    assert.equal(events(store).filter(event=>event.event==='input-references-recovered').length,1);
    harness.run({maxIterations:0});assert.equal(events(store).filter(event=>event.event==='input-references-recovered').length,1);
  }finally{harness.cleanup();}
});

test('kernel restart refuses ungrounded input recovery before launching or reading downstream inputs',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    const {store,state}=harness;approve(store,state);state.run='run_wf';state.from='term_kernel';
    state.inputs={...state.inputs,phase:'ready'};
    fs.rmSync(store.paths.goalJson);
    const collided=structuredClone(state.inputs),ops=structuredClone(state.ops);
    harness.run({refreshPreparation:()=>{throw Error('A refused resume cannot reach downstream input consumers');}});
    assert.equal(state.finished.outcome,'blocked');assert.equal(state.finished.reason,'workflow input references require runtime repair');
    assert.equal(state.needUser.filter(item=>item.code==='workflow-input-repair').length,1);
    assert.deepEqual(state.inputs,collided);assert.deepEqual(state.ops,ops);assert.equal(state.approved,true);
    assert.equal(state.iterations,0);assert.equal(harness.fake.dispatches.size,0);
    assert.equal(events(store).some(event=>event.event==='host'),false,'refusal happens before normal startup');
    assert.equal(events(store).filter(event=>event.event==='input-reference-recovery-refused').length,1);
    harness.run();assert.equal(state.needUser.filter(item=>item.code==='workflow-input-repair').length,1);
  }finally{harness.cleanup();}
});

test('after the approval three independent operations launch in one iteration on three runtimes, and a dependent one waits for its dependency',()=>{
  const file=name=>`apps/agentos-controlplane/src/${name}/index.ts`;
  const op4='op-receipt';
  const plan={definitionOfDone:['the slice works'],ledger:[{id:'goal-1',title:'Sales slice',inputRef:'sds:SDS-FR-SALES-03',status:'absent'}],
    ops:['intake','catalog','pricing'].map(name=>({id:`op-${name}`,kind:'backend.implement',goal:`Implement ${name}.`,
      ledgerIds:['goal-1'],allowlist:[file(name)],references:['sds.md'],checks:[{name:'unit',command:`npx vitest run ${name}`}],
      acceptance:[`${name} works`],dependsOn:[]}))
      .concat([{id:op4,kind:'backend.implement',goal:'Implement the receipt.',ledgerIds:['goal-1'],
        allowlist:[file('receipt')],references:['sds.md'],checks:[{name:'unit',command:'npx vitest run receipt'}],
        acceptance:['the receipt renders'],dependsOn:['op-intake']}])};
  const done=(name)=>({outcome:'done',summary:`${name} implemented.`,files:[file(name)],checks:[passing('unit',`npx vitest run ${name}`)]});
  const harness=setup({plan,scripts:{'op-intake':[done('intake')],'op-catalog':[done('catalog')],'op-pricing':[done('pricing')],[op4]:[done('receipt')]},
    dirty:[file('intake'),file('catalog'),file('pricing'),file('receipt')]});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    harness.run({maxIterations:2});
    const log=events(harness.store);
    const firstWait=indexOfEvent(log,event=>event.event==='wait');
    const launches=log.filter(event=>event.event==='launched');
    const firstRound=launches.filter((event,index)=>log.indexOf(event)<firstWait);
    assert.deepEqual(log.slice(0,firstWait).filter(e=>e.event==='launched').map(e=>e.op).sort(),['op-catalog','op-intake','op-pricing']);
    assert.equal(new Set(firstRound.map(event=>event.runtime)).size,3);
    assert.deepEqual(firstRound.map(event=>event.runtime).sort(),['claude-agent','codex-agent','qwen-agent']);
    // Every launch names the one candidate the allocator decided, with no faked skip attempts.
    for(const event of firstRound){
      assert.equal(event.allocation.override,undefined);
      assert.equal(event.allocation.target,event.runtime);
      assert.match(event.allocation.reason,/handed that candidate alone/);
      assert.ok(event.allocation.notAllocated.length>=1&&!event.allocation.notAllocated.includes(event.runtime));
    }
    const dependent=indexOfEvent(log,event=>event.event==='launched'&&event.op===op4);
    const dependency=indexOfEvent(log,event=>event.event==='op-done'&&event.op==='op-intake');
    assert.ok(dependency>=0&&dependent>dependency,'the dependent operation launched only after its dependency was done');
    assert.ok(dependent>firstWait,'the dependent operation was not launched in the first iteration');
    assert.equal(launches.length,4);
    assert.deepEqual(harness.state.ops.filter(item=>item.status==='done').map(item=>item.id).sort(),
      ['op-catalog','op-intake','op-pricing','op-receipt']);
  }finally{harness.cleanup();}
});

test('a done report whose check the kernel cannot reproduce is downgraded and retried; the reproducible one is committed and becomes ledger evidence',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const report=summary=>({outcome:'done',summary,files:[file],checks:[passing('unit','npx vitest run sales')]});
  const attempts=[];
  const harness=setup({plan:salesPlan,dirty:[file],
    scripts:{'op-intake':[report('Intake implemented.'),report('Intake implemented for real.')],
      'verify-1':[{outcome:'done',summary:'Review passed: acceptance 1 holds.',files:[],checks:[passing('review','npx vitest run sales')]}]},
    exec:command=>{attempts.push(command);return {status:attempts.length===1?1:0,stdout:'',stderr:attempts.length===1?'1 failed test':''};}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run();
    const log=events(harness.store);
    const downgraded=log.find(event=>event.event==='machine-verify-failed');
    assert.ok(downgraded,'the unreproducible done was downgraded');
    assert.deepEqual(downgraded.failed,['unit=1']);
    const retried=log.find(event=>event.event==='retry');
    assert.equal(retried.op,'op-intake');assert.equal(retried.attempt,2);
    assert.match(retried.findings[0],/the kernel re-ran unit/);
    const intake=state.ops.find(item=>item.id==='op-intake');
    assert.equal(intake.status,'done');assert.equal(intake.attempt,2);
    assert.deepEqual(intake.reports.map(item=>item.outcome),['done','done']);
    assert.equal(intake.reports[0].downgradedTo,'failed');
    assert.deepEqual(intake.files,[file]);
    assert.equal(intake.head,'abc1234');
    // The preflight probes git first (rev-parse), so the commit sequence is read from the first `add`.
    const gitCalls=harness.git.calls.filter(name=>['add','commit','rev-parse'].includes(name));
    assert.deepEqual(gitCalls.slice(gitCalls.indexOf('add'),gitCalls.indexOf('add')+3),['add','commit','rev-parse']);
    assert.deepEqual(state.ledger.map(item=>[item.id,item.status]),[['goal-1','verified']]);
    assert.deepEqual(state.ledger[0].evidence.map(item=>[item.opId,item.kind,item.head]),
      [['op-intake','backend.implement','abc1234'],['verify-1','review.verify','abc1234']]);
    assert.equal(state.finished.outcome,'done');
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.schema,'starci/workflow-final-report@1');
    assert.equal(final.outcome,'done');assert.equal(final.head,'abc1234');
    assert.deepEqual(final.needUser,[]);
    assert.deepEqual(JSON.parse(fs.readFileSync(harness.store.checksPath('op-intake-kernel'),'utf8')).checks.map(item=>item.exitCode),[0]);
  }finally{harness.cleanup();}
});

test('the review of a ledger group is created when its implementing operations are done and never runs on a runtime that implemented it',()=>{
  const one='apps/agentos-controlplane/src/sales/intake.ts',two='apps/agentos-controlplane/src/sales/receipt.ts';
  const plan={definitionOfDone:['the slice works'],ledger:[{id:'goal-1',title:'Order intake',inputRef:'sds:3',status:'absent'}],
    ops:[{id:'op-intake',kind:'backend.implement',goal:'Implement intake.',ledgerIds:['goal-1'],allowlist:[one],
      references:['sds.md'],checks:[{name:'unit',command:'npx vitest run intake'}],acceptance:['intake persists'],dependsOn:[]},
      {id:'op-receipt',kind:'backend.implement',goal:'Implement the receipt.',ledgerIds:['goal-1'],allowlist:[two],
        references:['sds.md'],checks:[{name:'unit',command:'npx vitest run receipt'}],acceptance:['the receipt renders'],dependsOn:[]}]};
  const allocator=fakeAllocator();
  const harness=setup({plan,allocator,dirty:[one,two],
    scripts:{'op-intake':[{outcome:'done',summary:'Intake done.',files:[one],checks:[passing('unit','npx vitest run intake')]}],
      'op-receipt':[{outcome:'done',summary:'Receipt done.',files:[two],checks:[passing('unit','npx vitest run receipt')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('review','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run();
    const verify=state.ops.find(item=>item.kind==='review.verify');
    assert.ok(verify,'a review operation was created');
    assert.equal(verify.id,'verify-1');
    assert.deepEqual(verify.ledgerIds,['goal-1']);
    assert.deepEqual(verify.allowlist.sort(),[one,two].sort());
    assert.deepEqual(verify.acceptance.sort(),['intake persists','the receipt renders']);
    const implementRuntimes=['op-intake','op-receipt'].map(id=>state.ops.find(item=>item.id===id).runtime);
    const request=harness.allocator.requests.find(item=>item.kind==='review.verify');
    assert.deepEqual(request.avoid.sort(),[...implementRuntimes].sort());
    assert.ok(!implementRuntimes.includes(verify.runtime),`the review ran on ${verify.runtime}, which implemented the group`);
    assert.equal(state.verifyRounds['goal-1'],1);
    assert.equal(state.finished.outcome,'done');
    const created=events(harness.store).find(event=>event.event==='op-created'&&event.op==='verify-1');
    assert.equal(created.origin,'verify');
    const doneIntake=indexOfEvent(events(harness.store),event=>event.event==='op-done'&&event.op==='op-receipt');
    assert.ok(indexOfEvent(events(harness.store),event=>event.event==='op-created'&&event.op==='verify-1')>doneIntake);
  }finally{harness.cleanup();}
});

test('the loop is resumable: a run that stops after one iteration continues from state.json to the same finished workflow',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setup({plan:salesPlan,dirty:[file],
    scripts:{'op-intake':[{outcome:'done',summary:'Intake done.',files:[file],checks:[passing('unit','npx vitest run sales')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('review','npx vitest run sales')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const stopped=harness.run({maxIterations:1});
    assert.equal(stopped.finished,null);
    assert.equal(stopped.iterations,1);
    assert.equal(stopped.ops[0].status,'done');
    const saved=harness.store.loadState();
    assert.equal(saved.ops[0].status,'done');
    assert.equal(saved.run,'run_wf');assert.equal(saved.approved,true);
    const resumeClock=fakeClock();
    const resumed=runLoop(harness.fake.orca,harness.store,saved,{cwd,allocator:fakeAllocator(),template,wait:resumeClock.wait,now:resumeClock.now,validateOp:acceptAll,
      exec:command=>({status:0,stdout:`${command} ok`,stderr:''}),git:harness.git.git,waitTimeoutMs:2000,tickMs:1000,maxIterations:8});
    assert.equal(resumed.finished.outcome,'done');
    // The second run continues the same counter and the same event log instead of starting over.
    assert.equal(resumed.iterations,3);
    assert.deepEqual(resumed.ledger.map(item=>item.status),['verified']);
    const ticks=events(harness.store).filter(event=>event.event==='tick');
    assert.deepEqual(ticks.map(event=>event.iteration),[1,2,3]);
    assert.deepEqual(ticks[1].ops,['op-intake=done']);
    assert.equal(JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8')).outcome,'done');
  }finally{harness.cleanup();}
});

test('the four launcher commands drive one workflow directory: goal, approve, status',()=>{
  const repo=tmp();
  spawnSync('git',['init','--quiet'],{cwd:repo,encoding:'utf8',windowsHide:true});
  const functions={assessGoal:()=>({ok:true,provider:'fake',value:salesPlan}),critiqueGoal:soundCritique,extractMaterial:()=>[]};
  const orca={invoke:()=>{throw Error('no Orca call belongs to the goal phase');}};
  try{
    const goal=kernelMain('workflow-goal',{job:'Implement the sales slice',inputs:'sds:.starciwork/features/sales/sds.md',
      gates:'unit=npm test'},{orca,cwd:repo,functions});
    assert.equal(goal.ok,true);
    assert.match(goal.id,/^\d{8}-\d{6}-implement-the-sales-slice$/);
    assert.match(fs.readFileSync(goal.goal,'utf8'),/## Ledger/);
    assert.equal(JSON.parse(fs.readFileSync(goal.goalJson,'utf8')).gates[0].command,'npm test');
    assert.match(goal.next,/workflow-approve --id/);
    const before=kernelMain('workflow-status',{id:goal.id},{orca,cwd:repo});
    assert.equal(before.approved,false);
    assert.deepEqual(before.ops,[{id:'op-intake',kind:'backend.implement',status:'pending',runtime:null,attempt:1}]);
    assert.equal(before.final,null);
    assert.throws(()=>kernelMain('workflow-run',{id:goal.id},{orca,cwd:repo,functions}),/not approved/);
    const approved=kernelMain('workflow-approve',{id:goal.id},{orca,cwd:repo});
    assert.equal(approved.approved,true);assert.equal(approved.phase,'run');
    const after=kernelMain('workflow-status',{id:goal.id},{orca,cwd:repo});
    assert.equal(after.approved,true);
    assert.deepEqual(after.events.map(event=>event.event),['created','goal-critiqued','goal','approved']);
    assert.throws(()=>kernelMain('workflow-status',{id:'20260912-000000-missing'},{orca,cwd:repo}),/No workflow kernel state/);
    assert.throws(()=>kernelMain('workflow-nope',{},{orca,cwd:repo}),/Unsupported workflow kernel command/);
  }finally{fs.rmSync(repo,{recursive:true,force:true});}
});

// Before the 5-plus ruling this test ended with a `review` item on the owner's list after three rounds. The
// owner could do nothing with it - "decide whether the last findings stand" is not a decision anyone can take
// from a terminal - so a spent review bound now escalates INSIDE the runtime: one more repair on a runtime that
// has not worked the group, and, because these findings cite no decided record, the rule they are arguing about
// is settled as a PROVISIONAL decision the work carries on with. The bound itself is still a bound: the
// escalations are capped per group per day, and a group that spends them is parked exactly as before.
test('a spent review bound escalates inside the runtime: one more repair on an unused runtime, and findings that cite no decided record become a provisional decision',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const done=summary=>({outcome:'done',summary,files:[file],checks:[passing('unit','npx vitest run sales')]});
  const finding=round=>({outcome:'partial',summary:`Review round ${round} rejected the work.`,files:[],
    checks:[passing('review','npx vitest run sales')],open:[`${file} still does not persist the receipt (round ${round})`]});
  const harness=setup({plan:salesPlan,dirty:[file],
    scripts:{'op-intake':[done('Intake implemented.')],'verify-1':[finding(1)],'repair-1':[done('Receipt added.')],
      'verify-2':[finding(2)],'repair-2':[done('Receipt fixed.')],'verify-3':[finding(3)],
      'ask-1':[{outcome:'done',files:[],checks:[passing('work-tree-validates','node starci.mjs validate')],
        summary:'decision: demo.sales.business.srs.policy-decision.d-receipt\nrecommended: 2\n1. keep the receipt in memory\n2. persist the receipt with the order'}],
      'repair-3':[done('Receipt persisted with the order, as the ruling says.')],
      'verify-4':[{outcome:'done',summary:'The receipt is persisted.',files:[],checks:[passing('review','npx vitest run sales')]}]}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:24});
    assert.deepEqual(state.ops.map(op=>op.id),['op-intake','verify-1','repair-1','verify-2','repair-2','verify-3','repair-3','ask-1','verify-4']);
    // Each repair is scoped to the file the finding named, inside the reviewed group's allowlist.
    assert.deepEqual(state.ops.find(op=>op.id==='repair-1').allowlist,[file]);
    const log=events(harness.store);
    // The bound fired once, escalated once, and the escalation named the runtime the group had not used.
    const escalated=log.find(event=>event.event==='verify-escalated');
    assert.deepEqual([escalated.group,escalated.round,escalated.cap,escalated.hidden,escalated.cited,escalated.op],
      ['goal-1',1,6,true,[],'repair-3']);
    assert.ok(escalated.avoid.includes(state.ops.find(op=>op.id==='repair-2').runtime),'the runtimes that already built it are avoided');
    assert.ok(escalated.runtime&&!escalated.avoid.includes(escalated.runtime),'the escalation names the runtime the group has not had');
    assert.equal(log.filter(event=>event.event==='verify-limit').length,1);
    assert.ok(log.some(event=>event.event==='verify-hidden-decision'&&event.group==='goal-1'));
    // The escalation repair waited for the ruling and carried it; nothing was asked of the owner.
    assert.deepEqual(state.ops.find(op=>op.id==='repair-3').provisional,['demo.sales.business.srs.policy-decision.d-receipt']);
    assert.match(String(state.ops.find(op=>op.id==='repair-3').answer),/provisional: option 2 - persist the receipt with the order/);
    assert.equal(state.needUser.some(item=>item.kind==='review'),false,'a mechanical bound is never the owner\'s item');
    assert.deepEqual(state.provisional.map(entry=>[entry.decision,entry.op,entry.recommended,entry.answered]),
      [['demo.sales.business.srs.policy-decision.d-receipt','ask-1',2,null]]);
    // One escalation bought one repair AND the review that judges it, and that review passed.
    assert.equal(state.verifyRounds['goal-1'],4);
    assert.equal(state.ledger[0].status,'verified');
    assert.equal(state.finished.outcome,'done','a provisional decision does not block the workflow');
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.outcome,'done');
    assert.match(final.provisionalReport,/^## Provisional decisions \(1\)/);
    assert.match(final.provisionalReport,/workflow-answer --id .* --op ask-1 --choice <n>/);
    // The same question, in the one section every page the owner reads carries: what waits, and what to type.
    assert.match(final.ownerReport,/^## Owner \(\d+\)\n/);
    assert.ok(final.owner.some(entry=>entry.kind==='decision'&&entry.op==='ask-1'),'the provisional decision is on the owner\'s list');
    assert.match(final.ownerReport,/- decision ask-1 \(tab [^)]+\): demo\.sales\.business\.srs\.policy-decision\.d-receipt: the runtime took option 2[^\n]*\n {2}how: starci workflow-answer --id [^\n]*--op ask-1 --choice <n>/);
    // The masker cannot tell a long workflow id from a key: `how` is built from ids and must never be run through it.
    assert.equal(final.ownerReport.includes('[redacted]'),false,'the command the owner types names the workflow, not a mask');
    assert.ok(final.ownerReport.includes(`--id ${final.id} --op ask-1`));
  }finally{harness.cleanup();}
});

/**
 * A record a `work.author` op is writing right now is not a question for the owner: they can do nothing with it
 * but wait for the kernel. The line goes while the author op is on it, and comes back the moment that op blocks -
 * because then the record really is nobody's job but theirs.
 */
test('a ledger line an author op is on is dropped from the owner\'s list, and comes back when that op blocks',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    const state=harness.state;
    const author=state.ops[0];
    Object.assign(author,{id:'n-four-author',kind:'work.author',nodeId:'demo.sales.four',status:'running',refusal:null});
    const line={node:'demo.sales.four',kind:'ledger',detail:'ledger incomplete: demo.sales.four declares no write scope'};
    state.needUser=[line];
    assert.deepEqual(sweepStaleLines(harness.store,state).length,0,'the drop is not one of the stale mechanical lines');
    assert.deepEqual(state.needUser,[],'an author op is on it, so it is not the owner\'s');
    const dropped=events(harness.store).at(-1);
    assert.deepEqual([dropped.event,dropped.node,dropped.reason],['owner-line-dropped','demo.sales.four','an author op is on it']);

    state.needUser=[line];
    author.status='blocked';author.refusal='shared-change';
    sweepStaleLines(harness.store,state);
    assert.deepEqual(state.needUser,[line],'the author op blocked: the record is the owner\'s again');
    assert.deepEqual(ownerItems(state).map(entry=>[entry.kind,entry.op]),[['ledger','demo.sales.four']]);
  }finally{harness.cleanup();}
});

/**
 * The deadline exists for a runtime that went away, not for a person who went to lunch. A `provision.ask` sits in
 * its tab waiting for the owner to put a credential into custody, and `op-overrun` killing that tab - the one
 * place the question is printed - is exactly the failure the owner's list was written against.
 */
test('an op waiting for the owner never overruns, however long the owner takes',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    let clock=0;
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>clock,work:null};
    const ask=running(harness.state,'op-intake','ctx_ask');
    ask.kind='provision.ask';ask.origin='ask';ask.launchedAt=0;
    ask.question={kind:'credential',text:'PAYMENTS_API_TOKEN into identity:payments',options:[],from:'op-x'};
    clock=OP_DEADLINE_MS.default+60*60*1000;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[]});
    assert.equal(ask.status,'running','the wait for the owner has no deadline');
    assert.equal(events(harness.store).some(event=>event.event==='op-overrun'),false);
    assert.equal(ask.restarts,0);
    // The same op on any other kind is over: the deadline is not gone, only the wait for a person is exempt.
    ask.kind='backend.implement';ask.question=null;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[]});
    assert.equal(events(harness.store).find(event=>event.event==='op-overrun').op,'op-intake');
  }finally{harness.cleanup();}
});

test('a stopped native overrun preserves its candidate baseline and advances to a fresh durable attempt',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);harness.state.run='run_wf';harness.state.from='term_kernel';
    const op=running(harness.state,'op-intake','ctx_native');Object.assign(op,{kind:'backend.implement',attempt:1,launchedAt:0,lease:{jobId:'job-native'},candidate:{status:'running'}});
    let call=null;const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>OP_DEADLINE_MS.default+1,work:null,
      engine:{settleStoppedOperation(candidate,input){call={candidate,input};delete candidate.lease;candidate.ownedBaselinePaths=['src/preserved.ts'];return {ok:true,effectState:'none',observedFiles:['src/preserved.ts'],candidateDigest:'candidate-1'};}}};
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[]});
    assert.equal(call.candidate,op);assert.equal(call.input.dispatch,'ctx_native');assert.equal(call.input.settlement.schema,'starci/orca-supervised-settlement@1');assert.equal(call.input.settlement.effectState,'none');assert.equal(op.status,'ready');assert.equal(op.attempt,2);assert.deepEqual(op.ownedBaselinePaths,['src/preserved.ts']);assert.equal(op.priorStoppedAttempt.candidateDigest,'candidate-1');assert.equal(events(harness.store).some(event=>event.event==='native-attempt-reconciled'&&event.dispatch==='ctx_native'),true);
  }finally{harness.cleanup();}
});

test('fresh exact native heartbeat outranks a prompt-shaped screen but mismatched identity does not',()=>{
  const now=Date.parse('2026-09-15T01:00:00Z'),state={run:'run-exact',worktree:cwd},op={dispatch:'ctx-exact',task:'task-exact'};
  const runner=runId=>({invoke(name,args){assert.equal(name,'worker-show');assert.equal(args.dispatch,'ctx-exact');return {outcome:'ok',receipt:{result:{dispatch:{id:'ctx-exact',run_id:runId,task_id:'task-exact',last_heartbeat_at:new Date(now-30_000).toISOString()},worker:{dispatch_id:'ctx-exact'},observation:{exactWorker:true,status:'running'}}}};}});
  assert.equal(nativeActivityProof(runner('run-exact'),state,op,now).active,true);
  assert.equal(nativeActivityProof(runner('another-run'),state,op,now).active,false);
  assert.equal(nativeActivityProof(runner('run-exact'),state,op,now+3*60*1000).active,false,'a stale heartbeat cannot suppress bounded settlement');
});

test('stalled-prompt does not terminate a native worker with fresh exact host activity',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);const now=Date.parse('2026-09-15T01:00:00Z');harness.state.run='run-exact';harness.state.from='term-kernel';
    const op=running(harness.state,'op-intake','ctx-active');Object.assign(op,{task:'task-active',launchedAt:now-10*60*1000,lease:{jobId:'job-active'}});
    const base=harness.fake.orca,orca={...base,invoke(name,args,options){if(name==='worker-show')return {outcome:'ok',receipt:{result:{dispatch:{id:'ctx-active',run_id:'run-exact',task_id:'task-active',last_heartbeat_at:new Date(now-20_000).toISOString()},worker:{dispatch_id:'ctx-active'},observation:{exactWorker:true,status:'running'}}}};return base.invoke(name,args,options);}};
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>now,work:null,engine:{settleStoppedOperation(){throw Error('fresh worker must not settle');}}};
    settleStalled(orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx-active',liveness:'stalled-prompt'}]});
    assert.equal(op.status,'running');assert.ok(op.lease);assert.equal(events(harness.store).some(event=>event.event==='native-settlement-deferred'&&event.dispatch==='ctx-active'),true);
  }finally{harness.cleanup();}
});

/** And the tab itself survives every sweep while the op is on it: `TAB_STATUSES` is what "somebody reads it" means. */
test('the sweep keeps the tab a provision.ask is asking the owner in, and closes it once the op is not on it',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ask=harness.state.ops[0];
    Object.assign(ask,{id:'ask-cred',kind:'provision.ask',status:'paused',terminal:'term_ask_cred',dispatch:null,nodeId:null});
    harness.fake.terminals.set('term_ask_cred',{handle:'term_ask_cred',title:'[Op] provision.ask - ask-cred',status:'running',sent:true,worktreePath:cwd});
    for(const status of TAB_STATUSES){
      ask.status=status;
      const closed=sweepStaleTerminals(harness.fake.orca,harness.store,harness.state,{cwd,now:()=>0});
      assert.equal(closed.some(item=>item.terminal==='term_ask_cred'),false,`the owner is being asked in that tab and the op is ${status}`);
      assert.ok(harness.fake.terminals.has('term_ask_cred'));
    }
    // Failed: nobody is on the tab any more, and it is swept like every other tab of a finished attempt.
    ask.status='failed';
    assert.deepEqual(sweepStaleTerminals(harness.fake.orca,harness.store,harness.state,{cwd,now:()=>0})
      .filter(item=>item.terminal==='term_ask_cred').map(item=>item.op),['ask-cred']);
    assert.equal(harness.fake.terminals.has('term_ask_cred'),false);
  }finally{harness.cleanup();}
});

test('durable recovery keeps the validated coordinator of this invocation and sweep closes only the stale handle',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    const state=harness.state,checkpoint=structuredClone(state);
    Object.assign(checkpoint,{approved:true,from:'term_old',run:'run_wf',hostAdapter:'old-host',launcher:'old-launcher'});
    checkpoint.ops[0].goal='semantic goal from durable checkpoint';
    Object.assign(state,{approved:false,from:'term_current',run:'run_wf',hostAdapter:'orca',launcher:'sealed-launcher'});
    restoreDurableCheckpoint(state,checkpoint,{workflowId:state.id,from:'term_current',run:'run_wf',hostAdapter:'orca',launcher:'sealed-launcher',kernelTerminalOwned:true,arbitrary:'ignored'});
    assert.equal(state.approved,true);assert.equal(state.ops[0].goal,'semantic goal from durable checkpoint');
    assert.deepEqual([state.from,state.run,state.hostAdapter,state.launcher,state.kernelTerminalOwned],['term_current','run_wf','orca','sealed-launcher',true]);
    assert.equal(state.arbitrary,undefined);
    harness.fake.terminals.set('term_current',{handle:'term_current',title:`[Kernel] ${state.id}`,status:'running',worktreePath:cwd});
    harness.fake.terminals.set('term_old',{handle:'term_old',title:`[Kernel] ${state.id}`,status:'running',worktreePath:cwd});
    const closed=sweepStaleTerminals(harness.fake.orca,harness.store,state,{cwd,now:()=>0});
    assert.ok(harness.fake.terminals.has('term_current'),'the process coordinator survives recovery and sweep');
    assert.equal(harness.fake.terminals.has('term_old'),false);assert.deepEqual(closed.map(item=>item.terminal),['term_old']);
    assert.throws(()=>restoreDurableCheckpoint(state,{...checkpoint,id:'another-workflow'},{workflowId:state.id,from:'x',run:'y'}),/workflow identity mismatch/);
  }finally{harness.cleanup();}
});

test('a dependency block is re-admitted from its exact transition receipt when the dependency later completes',()=>{
  const recorded=[];
  const store={readEvents:()=>[{event:'shared-change-blocked',op:'requester',shared:'shared'}],appendEvent:event=>recorded.push(event)};
  const requester={id:'requester',kind:'backend.implement',status:'blocked',refusal:null,attempt:2,dependsOn:['shared'],reports:[]};
  const shared={id:'shared',kind:'backend.implement',status:'done',refusal:null,head:'a'.repeat(40)};
  const ask={id:'ask',kind:'decision.prepare',status:'done',answer:null},ownerWait={id:'owner-wait',kind:'backend.implement',status:'paused',waitingFor:'ask',dependsOn:[]};
  const state={ops:[requester,shared,ask,ownerWait],needUser:[{op:'requester',kind:'shared-change'},{op:'ask',kind:'decision'}],head:null};
  assert.deepEqual(recoverSatisfiedDependencyBlocks(store,state),['requester']);
  assert.deepEqual([requester.status,requester.attempt,requester.priorOpen.length],['ready',3,1]);
  assert.equal(state.needUser.some(item=>item.op==='requester'),false);assert.equal(state.needUser.some(item=>item.op==='ask'),true);
  assert.deepEqual([ownerWait.status,ownerWait.waitingFor],['paused','ask'],'an owner wait is unchanged');
  assert.equal(recorded[0].event,'dependency-readmitted');
  const refused={id:'refused',kind:'backend.implement',status:'blocked',refusal:'out-of-repository',dependsOn:['shared']};state.ops.push(refused);
  assert.deepEqual(recoverSatisfiedDependencyBlocks(store,state,{events:[{event:'shared-change-blocked',op:'refused',shared:'shared'}]}),[]);
  const stale={id:'stale',kind:'backend.implement',status:'blocked',refusal:null,attempt:3,dependsOn:['shared'],reports:[]};
  const staleState={ops:[stale,shared],needUser:[{op:'stale',kind:'authority'}]};
  assert.deepEqual(recoverSatisfiedDependencyBlocks(store,staleState,{events:[{event:'shared-change-blocked',op:'stale',shared:'shared',attempt:2},{event:'report',op:'stale',attempt:3}]}),[],
    'a stale dependency receipt cannot erase a newer authority block');
  staleState.needUser=[];stale.lease={jobId:'live'};
  assert.deepEqual(recoverSatisfiedDependencyBlocks(store,staleState,{events:[{event:'shared-change-blocked',op:'stale',shared:'shared',attempt:3}]}),[],'a live native lease is never inferred settled');
  const decision={id:'decision',kind:'decision.prepare',status:'done'},ownerBlocked={id:'owner-blocked',kind:'backend.implement',status:'blocked',refusal:null,attempt:1,dependsOn:['decision'],blockedByDependency:{id:'decision',attempt:1}};
  assert.deepEqual(recoverSatisfiedDependencyBlocks(store,{ops:[ownerBlocked,decision],needUser:[]},{events:[]}),[],'a completed decision operation is still an owner boundary');
});

test('a stale review line drops only after a later accepted review receipt resolves the current ledger proof',()=>{
  const events=[],head='b'.repeat(40),id='node-a';
  const old={id:'verify-old',kind:'review.verify',status:'done',verdict:'fail',ledgerIds:[id]};
  const accepted={id:'verify-new',kind:'review.verify',status:'done',verdict:'pass',head,ledgerIds:[id]};
  const state={ops:[old,accepted],ledger:[{id,status:'verified',evidence:[{opId:'verify-new',kind:'review.verify',head}]}],verifyFindings:{},needUser:[{op:'verify-old',kind:'review'},{op:'ask-real',kind:'decision'}]};
  const store={appendEvent:event=>events.push(event)};
  assert.deepEqual(sweepResolvedReviewLines(store,state),['verify-old']);assert.deepEqual(state.needUser.map(item=>item.op),['ask-real']);
  assert.equal(events[0].event,'resolved-review-line-dropped');
  const unresolved={...state,ops:[old],ledger:[{id,status:'implemented',evidence:[]}],verifyFindings:{[id]:['open finding']},needUser:[{op:'verify-old',kind:'review'},{op:'ask-real',kind:'decision'}]};
  assert.deepEqual(sweepResolvedReviewLines(store,unresolved),[]);assert.deepEqual(unresolved.needUser.map(item=>item.op),['verify-old','ask-real']);
  const earlier={id:'verify-earlier',kind:'review.verify',status:'done',verdict:'pass',head,ledgerIds:[id]};
  const laterFailure={id:'verify-later-failure',kind:'review.verify',status:'done',verdict:'fail',ledgerIds:[id]};
  const wrongOrder={ops:[earlier,laterFailure],ledger:[{id,status:'verified',evidence:[{opId:'verify-earlier',kind:'review.verify',head}]}],verifyFindings:{},needUser:[{op:'verify-later-failure',kind:'review'}]};
  assert.deepEqual(sweepResolvedReviewLines(store,wrongOrder),[],'an accepted review before the failed review cannot resolve the newer failure');
});

/* ------------------------------------------------------------------ the Work ledger as the TODO list */

const DIGEST=letter=>letter.repeat(64);
const ARCHITECTURE=`schema: work/node@2
id: demo.sales.architecture.sds.intake
kind: architecture
required: true
state: done
description: The accepted intake design.
assertions:
  - architecture-quality
completion:
  inputDigest: ${DIGEST('a')}
  review:
    schema: starci/design-review@1
    reviewer: Root coordinator
    authority: The user accepted the design.
    reviewedAt: "2026-09-01T00:00:00.000Z"
    observations:
      - id: architecture-quality
        outcome: pass
        observation: The flows trace the SRS.
    limitations: []
`;
const BACKEND=`schema: work/node@2
id: demo.sales.implementation.backend.intake
kind: implementation
required: true
state: todo
dependsOn:
  - demo.sales.architecture.sds.intake
description: Implement order intake against the accepted SDS.
assertions:
  - unit-tests-pass
  - work-valid
implementation:
  status: mixed
  changes:
    - what: Persist an order.
      why: Nothing is stored yet.
      repository: demo-backend
      directory: .
      files:
        - apps/agentos-controlplane/src/sales/intake.ts
extensions:
  work3:
    checks:
      - assertion: unit-tests-pass
        command: npx vitest run intake
      - assertion: work-valid
        command: node starci.mjs validate .starciwork
`;
const UNCHECKED=`schema: work/node@2
id: demo.sales.implementation.frontend.receipt
kind: implementation
required: true
state: todo
description: Render the receipt.
implementation:
  status: mixed
  changes:
    - what: Render it.
      why: The route is empty.
      repository: demo-frontend
      directory: .
      files:
        - apps/agentos-controlplane/src/sales/receipt.tsx
`;
/** A node whose record says nothing a kernel could launch: no write scope and no check. Its job is `work.author`. */
const UNAUTHORED=`schema: work/node@2
id: demo.sales.implementation.backend.refund
kind: implementation
required: true
state: todo
description: Refund a paid order.
`;
/**
 * What an accepted `work.author` op leaves behind, merged into the record as it stands: the kernel's own
 * in-progress receipt already created `extensions.work3`, so the checks go inside it instead of beside it.
 */
function authorRecord(file){
  const text=fs.readFileSync(file,'utf8');
  const checks='    checks:\n      - assertion: refund-restores-balance\n        command: npx vitest run refund\n';
  const scope='assertions:\n  - refund-restores-balance\nimplementation:\n  status: mixed\n  changes:\n'
    +'    - what: Refund the order.\n      why: The endpoint does not exist.\n      repository: demo-backend\n'
    +'      directory: .\n      files:\n        - apps/agentos-controlplane/src/sales/refund.ts\n';
  const merged=text.includes('\n  work3:\n')?text.replace('\n  work3:\n',`\n  work3:\n${checks}`)
    :`${text}extensions:\n  work3:\n${checks}`;
  fs.writeFileSync(file,`${scope}${merged}`);
}
/** A frontend implementation node: the lane of this one is drawn, built and then proved by a UAT run. */
const FRONTEND=`schema: work/node@2
id: demo.sales.implementation.frontend.cart
kind: implementation
required: true
state: todo
description: Build the cart surface from the accepted design.
assertions:
  - cart-renders
implementation:
  status: mixed
  changes:
    - what: Render the cart.
      why: The route is empty.
      repository: demo-frontend
      directory: .
      files:
        - apps/web/src/cart/index.tsx
extensions:
  work3:
    checks:
      - assertion: cart-renders
        command: npx vitest run cart
`;
const OVERVIEW=`schema: work/node@2
id: demo.payments.business.overview
kind: business-overview
required: true
state: todo
description: What payments promises the customer.
`;
const WORK_NODES=[
  {id:'demo.sales.architecture.sds.intake',path:'features/sales/architecture/sds/intake/index.yaml',kind:'architecture',state:'done',eligible:false,inputDigest:DIGEST('a'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:{inputDigest:DIGEST('a')}},
  {id:'demo.sales.implementation.backend.intake',path:'features/sales/implementation/backend/intake/index.yaml',kind:'implementation',state:'todo',eligible:true,inputDigest:DIGEST('c'),dependsOn:['demo.sales.architecture.sds.intake'],refs:[],blockedBy:[],children:[],completion:null},
  {id:'demo.sales.implementation.frontend.receipt',path:'features/sales/implementation/frontend/receipt/index.yaml',kind:'implementation',state:'todo',eligible:true,inputDigest:DIGEST('d'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null},
  {id:'demo.payments.business.overview',path:'features/payments/business/overview/index.yaml',kind:'business-overview',state:'todo',eligible:true,inputDigest:DIGEST('e'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null}
];
const FRONTEND_NODE={id:'demo.sales.implementation.frontend.cart',path:'features/sales/implementation/frontend/cart/index.yaml',kind:'implementation',state:'todo',eligible:true,inputDigest:DIGEST('g'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null};
const UI='demo.sales.ui';
const UI_FILE='.starciwork/features/sales/ui/index.yaml';
const UI_RECORD=`schema: work/node@2
id: demo.sales.ui
kind: ui
required: true
state: todo
description: The sales surfaces, drawn before they are built.
assertions:
  - sales-surfaces-drawn
extensions:
  work3:
    allowlist:
      files:
        - .starciwork/features/sales/ui/**
    checks:
      - assertion: sales-surfaces-drawn
        command: node starci.mjs validate .starciwork
`;
const UI_NODE={id:UI,path:'features/sales/ui/index.yaml',kind:'ui',state:'todo',eligible:true,inputDigest:DIGEST('u'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null,authored:UI_RECORD};
const UNAUTHORED_NODE={id:'demo.sales.implementation.backend.refund',path:'features/sales/implementation/backend/refund/index.yaml',kind:'implementation',state:'todo',eligible:true,inputDigest:DIGEST('h'),dependsOn:[],refs:['features/sales/architecture/sds/intake/index.yaml'],blockedBy:[],children:[],completion:null};
const AUTHORED={'demo.sales.architecture.sds.intake':ARCHITECTURE,'demo.sales.implementation.backend.intake':BACKEND,
  'demo.sales.implementation.frontend.receipt':UNCHECKED,'demo.payments.business.overview':OVERVIEW,
  [FRONTEND_NODE.id]:FRONTEND,[UNAUTHORED_NODE.id]:UNAUTHORED};

/** A Work tree on disk plus the validator projection of it, injected instead of spawning the real one. */
function workRepo(nodes=WORK_NODES){
  const repo=tmp();
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'@demo/backend'}));
  for(const item of nodes){
    const file=path.join(repo,'.starciwork',item.path);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    // A node may carry its own record text (`authored`), for a fixture that exists in two states of one id.
    fs.writeFileSync(file,item.authored??AUTHORED[item.id]);
  }
  // The injected projection answers a fresh digest, the way the real validator does after a kernel write.
  const validate=()=>({ok:true,errors:[],warnings:[],nodes:nodes.map(({authored,...node})=>({...node,inputDigest:DIGEST('f')})),resources:[]});
  const node=id=>path.join(repo,'.starciwork',nodes.find(item=>item.id===id).path);
  const read=id=>parseYaml(fs.readFileSync(node(id),'utf8'));
  return {repo,validate,node,read};
}

/* ------------------------------------------------------------------ the brand half of the ledger */

/**
 * The brand node, in the two states a tree can be in: one still to be decided (no record for a design op to
 * read) and one a decision already settled, carrying the `rev` every surface built from it is bound to.
 */
const BRAND_RECORD=(state,rev=null)=>`schema: work/node@2
id: demo.brand
kind: brand
required: true
state: ${state}
description: The brand of the product - identity, colour tokens, mascot.
assertions:
  - brand-tokens-declared
${rev===null?'':`rev: ${rev}
brand:
  rev: ${rev}
  identity:
    name: Aurora
    family: starci
    owner: Product owner
  color:
    tokens:
      - token: --starci-core-accent
        value: "oklch(0.72 0.15 35)"
        role: primary
  typography:
    family: system-ui
  iconography:
    set: []
  imagery:
    style: []
  forbidden: []
  sources: []
extensions:
  work3:
    kernel:
      rev: ${rev}
`}`;
const brandNodeFixture=(state,rev=null)=>({id:'demo.brand',path:'brand/index.yaml',kind:'brand',state,
  eligible:true,inputDigest:DIGEST('b'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null,
  authored:BRAND_RECORD(state,rev)});
const BRAND_TODO=brandNodeFixture('todo');
const BRAND_DECIDED=brandNodeFixture('done',3);
const MASCOT='brand/assets/mascot-front.png';
const brandSpec=rev=>({name:'Aurora',family:'aurora',rev,
  colorTokens:{'--brand-ink':{value:'oklch(0.21 0.01 275)',role:'text'},'--brand-accent':{value:'oklch(0.72 0.15 35)',role:'accent'}},
  mascotAssets:[MASCOT],forbidden:['the bare word white inside a style tag'],
  imageryPromptRules:['every imagery prompt names the mascot sheet and the accent token']});
/**
 * What `kernel/ledger.mjs` will answer once the brand node kind lands: `loadLedger` carries
 * `brand = {node, rev, file, spec} | null`, `brandReferences` names the record and every asset beside it, and a
 * `brand` node is a decision candidate. The rev is read from the record on disk, so an accepted `brand.decide`
 * moves it exactly as the real loader would.
 */
const brandLedger=tree=>({...work,
  loadLedger:where=>{
    const loaded=work.loadLedger(where);
    let rev=null;
    try{rev=Number(tree.read('demo.brand')?.extensions?.work3?.kernel?.rev);}catch{rev=null;}
    const brand=Number.isFinite(rev)?{node:'demo.brand',rev,file:'brand/index.yaml',spec:brandSpec(rev)}:null;
    return {...loaded,brand};
  },
  brandReferences:loaded=>loaded?.brand?[loaded.brand.file,...(loaded.brand.spec?.mascotAssets??[])]:[]});
/** A ledger that knows about brands and whose tree carries no brand node at all. */
const brandlessLedger=()=>({...work,loadLedger:where=>({...work.loadLedger(where),brand:null}),brandReferences:()=>[]});
const brandDone=summary=>({outcome:'done',summary,files:[],
  checks:[passing('work-tree-validates','node starci.mjs validate .starciwork')],effect:()=>{
    const file=path.join(activeRepo,'.starciwork/brand/index.yaml'),record=parseYaml(fs.readFileSync(file,'utf8'));
    record.rev=1;record.brand={rev:1,identity:{name:'Aurora',family:'starci',owner:'Product owner'},
      color:{tokens:[{token:'--starci-core-accent',value:'oklch(0.72 0.15 35)',role:'primary'}]},
      typography:{family:'system-ui'},iconography:{set:[]},imagery:{style:[]},forbidden:[],sources:[]};
    fs.writeFileSync(file,stringifyYaml(record));
  }});
/**
 * `ops/registry.yaml` does not carry a brand operator yet - the kinds catalog is the sibling's to extend - so
 * here the launchable chain of a brand decision is the architecture decision's, which has the same role.
 */
const brandAllocator=()=>{
  const allocator=fakeAllocator();
  return {...allocator,candidateFor:(kind,target)=>allocator.candidateFor(kind===BRAND_DECIDE?'architecture.decide':kind,target)};
};
/** And the same at the launch seam: the brand decision launches with the architecture decision's contract. */
const brandLaunch=(orca,input)=>launchWithCandidate(orca,{...input,operation:input.operation===BRAND_DECIDE?'architecture.decide':input.operation});

/**
 * The receipt node of WORK_NODES declares no check, so the kernel authors its record: this stands in for that
 * op in every test that is not about authoring. A fresh object per call - the scripted Orca shifts the queue.
 */
const receiptAuthor=()=>({'demo.sales.implementation.frontend.receipt-author':[{outcome:'done',
  summary:'I described the receipt but could not settle which files render it.',
  files:[],checks:[passing('work-valid','node starci.mjs validate .starciwork')]}]});

/**
 * The repositories a workspace binding declares beyond the ledger owner, as `resolveLedgerRoot` carries them:
 * `setupWork({binding})` hands the kernel exactly that map, which is how a test gives this workflow a `grammar`
 * repository without a second git fixture. Without it the resolution is local and the map is null - a product
 * whose grammar this workflow may not change.
 */
const bindingRoles=roles=>input=>({...resolveLedgerRoot(input),roles});

function setupWork({nodes=WORK_NODES,scope=[],reintake=[],migrate=[],scripts={},dirty=[],exec,allocator=fakeAllocator(),gates=[],assessGoal,
  critiqueGoal,ledgerApi,validateOp=acceptAll,binding=null}={}){
  const tree=workRepo(nodes);
  activeRepo=tree.repo;
  const store=createStore({repoRoot:tree.repo,id:'20260912-110000-work-ledger'});
  const state=createWorkflowState({job:'Finish the sales slice',worktree:cwd,branch:'starci183/sales',
    gates,store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'work',scope,reintake,migrate,repoRoot:tree.repo});
  const api=ledgerApi?ledgerApi(tree):undefined;
  const goal=goalPhase(store,state,{validate:tree.validate,cwd,...(api?{ledgerApi:api}:{}),
    critiqueGoal:critiqueGoal??soundCritique,
    assessGoal:assessGoal??(({ledger})=>({ok:true,provider:'fake',value:{definitionOfDone:[`the ${ledger.length} listed nodes are done`],risks:[],questions:[]}}))});
  const fake=scriptedOrca({reportsDir:store.paths.reports,scripts});
  const git=fakeGit(dirty);
  const commits=[];
  const clock=fakeClock();
  const run=(options={})=>runLoop(fake.orca,store,state,{cwd,allocator,template,wait:clock.wait,now:clock.now,validate:tree.validate,
    reconcileInputs:()=>{},refreshPreparation:()=>{},deferPreparation:()=>false,
    ...(api?{ledgerApi:api}:{}),
    exec:exec??(command=>({status:0,stdout:`${command} ok`,stderr:''})),
    git:(executable,args)=>{if(args[0]==='commit')commits.push(args[args.indexOf('-m')+1]);return git.git(executable,args);},
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    validateOp,
    ...(binding?{resolveLedger:bindingRoles(binding)}:{}),
    waitTimeoutMs:2000,tickMs:1000,maxIterations:12,...options});
  return {...tree,api,store,state,goal,fake,git,run,commits,allocator,clock,cleanup:()=>fs.rmSync(tree.repo,{recursive:true,force:true})};
}

test('a launched audit with a Work node leaves every canonical Work byte unchanged through its finding report',()=>{
  const subject={...structuredClone(WORK_NODES[1]),dependsOn:[]},script={outcome:'partial',summary:'The exact scanner measured one current finding.',files:[],
    checks:[{name:'source-staleness',command:auditPlan().ops[0].checks[0].command,exitCode:1,evidence:'typed source-staleness finding'}],
    open:['SOURCE_IDENTITY_CHANGED requires revalidation']};
  const auditId=`${subject.id}-implement`;
  const harness=setupWork({nodes:[subject],scripts:{[auditId]:[script]},exec:()=>({status:1,stdout:JSON.stringify(stalenessReport()),stderr:''})});
  try{
    const raw=auditPlan().ops[0];harness.state.ops=[toOp({...raw,id:auditId,nodeId:subject.id,ledgerIds:[subject.id]},0)];
    approve(harness.store,harness.state);harness.state.run='run_wf';harness.state.from='term_kernel';
    const workRoot=path.join(harness.repo,'.starciwork'),snapshot=()=>{
      const rows=[];const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
        if(dir===workRoot&&entry.name==='_local')continue;
        const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else rows.push([path.relative(workRoot,file).replaceAll('\\','/'),fs.readFileSync(file).toString('base64')]);}};
      walk(workRoot);return rows;
    };
    const before=snapshot(),state=harness.run({maxIterations:8}),after=snapshot(),op=state.ops.find(item=>item.id===auditId);
    assert.deepEqual(after,before,'launch, settlement and final reporting do not mark the inspected Work node in progress or done');
    assert.equal(op.status,'done');assert.equal(op.verdict,'findings');assert.equal(op.audit.outcome,'findings');
    assert.equal(state.ledger[0].status,'planned');
    const log=events(harness.store);assert.deepEqual(log.filter(event=>event.event==='launched').map(event=>[event.op,event.operation]),[[auditId,'stales']]);
    assert.ok(log.some(event=>event.event==='audit-ledger-write-skipped'&&event.step==='in-progress'&&event.node===subject.id));
    assert.equal(log.some(event=>event.event==='ledger-write'&&event.op===auditId),false);
    assert.equal(log.some(event=>['verify-findings','retry'].includes(event.event)&&event.op===auditId),false);
  }finally{harness.cleanup();}
});

/**
 * A scope the tree does not know yet is not an error and not a guess: the workflow begins with the one op that
 * authors it - a feature's records as drafts, or the brand record - and the tree says what follows.
 */
test('a scope entry that names nothing in the tree begins with an intake operation: a feature is authored as drafts, the brand is authored and decided',()=>{
  const collab=setupWork({scope:['collab']});
  try{
    assert.equal(collab.goal.ok,true);
    assert.deepEqual(collab.state.ops.map(op=>[op.id,op.kind,op.nodeId,op.origin,op.intake]),
      [['collab-intake','work.author',null,'ledger',{scope:'collab',feature:'collab',layers:[],example:'features/payments',mode:'author'}]]);
    const op=collab.state.ops[0];
    assert.deepEqual(op.allowlist,['.starciwork/features/collab/**']);
    assert.deepEqual(op.ledgerIds,[],'an intake closes no node: the records it writes are the nodes');
    // The first feature of the tree is the example: its business overview is one of the roots the drafts mirror.
    assert.ok(op.references.includes('workspace.yaml')&&op.references.includes('features/payments/business/overview/index.yaml'),'the example feature is a reference');
    assert.deepEqual(op.checks.map(check=>check.name),['work-tree-validates']);
    assert.match(op.goal,/Author the Work records of the feature collab from the job: Finish the sales slice/);
    assert.match(op.goal,/A new feature is not appended beside the decided ones/);
    assert.ok(op.acceptance.some(line=>line.includes('extensions.work3.reconciliation: one row {case, record, decision, reads, hands, detail}')),'the acceptance demands the typed reconciliation');
    assert.doesNotMatch(op.goal+op.acceptance.join(' '),/sds-gap/,'an intake never reports a gap against another feature');
    assert.ok(op.references.includes('features/sales/architecture/sds/intake/index.yaml'),'the decided records of the other features are references');
    assert.equal(op.intake.mode,'author');
    assert.deepEqual(events(collab.store).filter(event=>event.event==='intake-planned').map(event=>[event.op,event.scope,event.kind,event.mode]),[['collab-intake','collab','work.author','author']]);
    assert.deepEqual(collab.state.ledger,[],'nothing is a goal item until the tree has it');
    // The contract renders the intake sequence, not a record completion.
    const contract=renderContract({template,op,state:collab.state,store:collab.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/Sequence `work\.intake`/);
    assert.match(contract,/mirror that shape exactly under the allowlist/);
    assert.doesNotMatch(contract,/## Work node you author/);
  }finally{collab.cleanup();}
  const brand=setupWork({scope:['brand'],ledgerApi:brandlessLedger});
  try{
    assert.deepEqual(brand.state.ops.map(op=>[op.id,op.kind,op.nodeId,op.intake]),[['brand-1',BRAND_DECIDE,null,{scope:'brand'}]]);
    assert.deepEqual(brand.state.ops[0].allowlist,['.starciwork/brand/index.yaml','.starciwork/brand/**']);
    assert.ok(brand.state.ops[0].references.some(entry=>/knowledge\/grammars\//.test(entry)),'the brand is decided inside the installed grammar');
    assert.match(brand.state.ops[0].goal,/Author and decide the brand record/);
  }finally{brand.cleanup();}
  // A scope the tree does know plans no intake - unless the owner asks for its drafts to be reconciled again.
  const known=setupWork({scope:['payments']});
  try{assert.equal(known.state.ops.some(op=>op.intake),false);}finally{known.cleanup();}
  const again=setupWork({scope:['payments'],reintake:['payments']});
  try{
    const op=again.state.ops.find(item=>item.intake);
    assert.ok(op,'a reintake plans the intake op over the existing drafts');
    assert.deepEqual([op.id,op.intake.scope,op.intake.mode,op.allowlist],['payments-intake','payments','reconcile',['.starciwork/features/payments/**']]);
    assert.match(op.goal,/Continue the existing Work records of the feature payments/);
    assert.match(op.goal,/Preserve current accepted leaves, their stable IDs, substantive content and completion evidence/);
    assert.deepEqual(events(again.store).filter(event=>event.event==='intake-planned').map(event=>event.mode),['reconcile']);
  }finally{again.cleanup();}
});

/**
 * A rule that turns a bound into an escalation applies to what an older rule already parked for the owner. The
 * kernel judges those items again once, on start, under the current rule: a spent review is escalated, a deep
 * shared change is authored as a node, a refused record path is refused again and the code paths carry on, a
 * spent launch cools and comes back, a requester blocked behind a blocked shared change waits instead. What the
 * current rule still parks stays parked - and the pass runs once per rule, never once per start.
 */
test('the items an older rule parked for the owner are judged again under the current rule, once, on kernel start',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const base=state.ops[0];
    const clone=(id,extra)=>{const copy=structuredClone(base);Object.assign(copy,{id,nodeId:null,ledgerIds:[],origin:'repair',status:'blocked',refusal:null,dispatch:null,terminal:null,reports:[],dependsOn:[],requesters:[],findings:[],priorOpen:[]},extra);return copy;};
    // 1. a launch the old rule gave up on
    state.ops.push(clone('env-1',{restarts:4}));
    state.needUser.push({op:'env-1',kind:'environment',detail:'env-1 was restarted 4 times (stalled-idle)'});
    // 2. a requester blocked behind a shared change that is blocked but alive
    state.ops.push(clone('shared-9',{origin:'shared',requesters:['req-1'],allowlist:['src/shared/nine.ts']}));
    state.ops.push(clone('req-1',{dependsOn:['shared-9']}));
    state.needUser.push({op:'req-1',kind:'shared-change',detail:'req-1 waits for the shared change shared-9, which is blocked'});
    // 3. a record path refused outright although code paths were asked for beside it
    state.ops.push(clone('repair-x',{allowlist:['src/mine.ts'],reports:[{attempt:1,outcome:'blocked',summary:'needs more',blocker:{kind:'shared-change',detail:'.starciwork/features/payments/index.yaml and src/other/file.ts must change'},open:[]}]}));
    state.needUser.push({op:'repair-x',kind:'ledger-path',detail:'repair-x asked for a change the kernel will not delegate: .starciwork/features/payments/index.yaml'});
    // 4. a record path alone: the op is told the rule and runs again
    state.ops.push(clone('shared-y',{origin:'shared',allowlist:['src/y.ts'],reports:[{attempt:1,outcome:'blocked',summary:'assets missing',blocker:{kind:'shared-change',detail:'.starciwork/features/payments/ui/assets/a.png'},open:[]}]}));
    state.needUser.push({op:'shared-y',kind:'ledger-path',detail:'shared-y asked for a change the kernel will not delegate: .starciwork/features/payments/ui/assets/a.png'});
    // 5. a review the old rule parked after its rounds, and its companion line
    const node=state.ledger[0];node.status='review-exhausted';
    base.status='done';
    state.ops.push(clone('verify-x',{kind:'review.verify',origin:'verify',status:'done',ledgerIds:[node.id],allowlist:[...base.allowlist],reports:[{attempt:1,outcome:'partial',summary:'review',open:['P1 src/a.ts:1 breaks a rule nobody decided']}]}));
    state.verifyRounds[node.id]=3;
    state.needUser.push({op:'verify-x',kind:'review',detail:`${node.id} still fails review after 3 rounds: P1 src/a.ts:1 breaks a rule nobody decided`});
    state.needUser.push({kind:'review',detail:`${node.id} used its 3 review rounds and is implemented again; decide whether the last findings stand`});
    // 6. the list the finish recomputes anyway
    state.needUser.push({kind:'ledger',detail:`never verified: ${node.id} (review-exhausted)`});
    // 7. a genuine owner item: a provision. It stays.
    state.needUser.push({op:'req-1',kind:'credential',detail:'TELEGRAM_BOT_TOKEN'});
    // 8. a stale line about a shared change that has since finished, and a requester blocked behind an alive shared change with no line of its own
    state.ops.push(clone('shared-done',{origin:'shared',status:'done'}));
    state.needUser.push({op:'shared-done',kind:'shared-depth',detail:'shared-done is a shared change 2 levels deep and still needs src/x.ts'});
    state.ops.push(clone('req-2',{dependsOn:['shared-9','shared-done']}));
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    const rejudged=log.filter(event=>event.event==='parked-rejudged');
    assert.equal(rejudged.length,1);
    const rule=rejudged[0].rule;assert.match(rule,/^5\.0\.0-plus/);
    const routes=Object.fromEntries(rejudged[0].routed.map(entry=>[`${entry.kind}:${entry.op??'-'}`,entry.route]));
    assert.equal(routes['environment:env-1'],'launch-cooling');
    assert.equal(routes['shared-change:req-1'],'waits-for:shared-9');
    assert.equal(routes['ledger-path:shared-y'],'readmitted');
    assert.ok(routes['ledger-path:repair-x'],'the code paths of a split request carry on');
    assert.equal(routes['review:verify-x'],'verify-escalated');
    assert.equal(routes['review:-'],'companion-line');
    assert.equal(routes['ledger:-'],'recomputed-at-finish');
    assert.equal(routes['shared-depth:shared-done'],'stale:done');
    assert.equal(routes['blocked-requester:req-2'],'waits-for:shared-9');
    const byId=id=>state2.ops.find(item=>item.id===id);
    // The launch cooled and came back at once; the requester waits; the record-only request runs again with the rule in hand.
    assert.ok(log.some(event=>event.event==='launch-cooling'&&event.op==='env-1'));
    assert.ok(log.some(event=>event.event==='launch-readmitted'&&event.op==='env-1'));
    assert.notEqual(byId('env-1').status,'blocked');
    assert.equal(byId('req-1').waitingFor,'shared-9');
    assert.equal(byId('req-2').status,'paused');
    assert.notEqual(byId('shared-y').status,'blocked');
    assert.match(byId('shared-y').findings.at(-1),/not a change any operation may ask for/);
    // The record path is refused with the same event the live rule uses, and the code path became a shared change.
    const refused=log.find(event=>event.event==='ledger-path-refused'&&event.op==='repair-x');
    assert.deepEqual([refused.paths,refused.continued,refused.rejudged],[['.starciwork/features/payments/index.yaml'],['src/other/file.ts'],true]);
    assert.notEqual(byId('repair-x').status,'blocked');
    // The spent review is escalated inside the runtime: one repair, and a provisional question because the finding cites no decided record.
    assert.ok(log.some(event=>event.event==='verify-escalated'&&event.component===node.id&&event.hidden===true));
    // The hidden decision is prepared by the kernel, so it is a decision.prepare whatever its finding mentions.
    const hidden=state2.ops.find(item=>item.kind==='decision.prepare'&&/keeps failing and its findings cite no decided record/.test(item.question?.text??''));
    assert.ok(hidden,'the hidden decision is a decision.prepare, never a provision');
    assert.equal(hidden.question.prepared,true);
    assert.equal(state2.ops.some(item=>item.kind==='provision.ask'),false);
    assert.ok(state2.ops.some(item=>item.origin==='repair'&&item.ledgerIds.includes(node.id)&&item.id!==base.id),'the escalation is a repair op');
    // What is genuinely the owner's stays; everything mechanical is gone from the list.
    const kinds=state2.needUser.map(item=>item.kind);
    assert.ok(kinds.includes('credential'),'a provision stays the owner\'s');
    for(const gone of ['environment','shared-change','ledger-path','review','ledger'])assert.equal(kinds.includes(gone),false,`${gone} is no longer on the owner's list`);
    assert.equal(state2.parkRule,rule);
    // Once per rule: the next start finds the stamp and judges nothing again.
    const again=store.readEvents().length;
    harness.run({maxIterations:1});
    assert.equal(store.readEvents().slice(again).some(event=>event.event==='parked-rejudged'),false);
  }finally{harness.cleanup();}
});

/**
 * `--migrate` is the one workflow that executes no node: one intake per feature, in migrate mode, over allowlists
 * that never meet, bringing the decided records under the current model without re-deciding them.
 */
test('workflow-goal --migrate plans one migrate-mode intake per feature and no node: the decided records are brought under the model in parallel',()=>{
  const one=setupWork({migrate:['payments']});
  try{
    assert.equal(one.goal.ok,true);
    assert.deepEqual(one.state.ledger,[],'a migration executes no node');
    assert.deepEqual(one.state.decisions,[],'a migration decides nothing');
    const op=one.state.ops.find(item=>item.intake);
    assert.deepEqual(one.state.ops.map(item=>item.id),['payments-intake']);
    assert.deepEqual([op.kind,op.intake.scope,op.intake.mode],['work.author','payments','migrate']);
    assert.deepEqual(op.allowlist,['.starciwork/features/payments/index.yaml','.starciwork/features/payments/business/**','.starciwork/features/payments/architecture/**','.starciwork/features/payments/integration/**'],
      'the implementation and ui records are never in a migration\'s reach');
    assert.match(op.goal,/Bring the decided records of the feature payments under the current Work model without re-deciding any of them/);
    assert.match(op.goal,/extensions\.work3\.integrations/);
    assert.match(op.goal,/custody: identity:<slug>/);
    assert.match(op.goal,/never write a secret value anywhere/);
    assert.ok(op.acceptance.some(line=>/no decided record of payments changed its state, its rev or its substance/.test(line)));
    assert.ok(op.acceptance.some(line=>/one todo integration node features\/payments\/integration\/<id>\/index\.yaml exists per entry/.test(line)));
    assert.deepEqual(events(one.store).filter(event=>event.event==='intake-planned').map(event=>event.mode),['migrate']);
    // The tree is re-read every iteration and still derives no node op: the intakes are the whole workflow.
    approve(one.store,one.state);
    one.state.run='run_wf';one.state.from='term_kernel';
    const state2=one.run({maxIterations:1});
    assert.ok(state2.ops.every(op=>op.intake),`a migration executes no node even after the tree is re-read: ${state2.ops.map(op=>op.id).join(', ')}`);
  }finally{one.cleanup();}
  // `all` is every feature of the tree, each its own op with its own allowlist, so they run side by side.
  // Only a feature with a decided business or architecture record has something to bring under the model.
  let all=null;
  try{all=setupWork({migrate:['all']});}catch(error){assert.match(error.message,/finds no feature with a decided business or architecture record/);return;}
  try{
    const intakes=all.state.ops.filter(item=>item.intake);
    assert.ok(intakes.length>=1);
    assert.equal(intakes.length,all.state.ops.length);
    assert.ok(intakes.every(item=>item.intake.mode==='migrate'));
    const seen=new Set();
    for(const item of intakes)for(const entry of item.allowlist){assert.equal(seen.has(entry),false,`${entry} belongs to one intake`);seen.add(entry);}
  }finally{all.cleanup();}
});

/**
 * A lost agent is a mechanical bound like an idle restart: the terminal reconciliation parks it as an environment
 * line with no cooldown of its own, and the kernel migrates that line to a cooldown every tick - the op comes back
 * with its counters cleared, and the owner is never asked to fix a terminal.
 */
/**
 * A mechanical line about an op that has since moved on is stale and would finish the workflow blocked over
 * nothing: the kernel drops it every tick. A line about an op still blocked without a refusal stays.
 */
/**
 * A record author an older rule split by allowlist entry was marked done with verdict `split` and never accepted:
 * its children are withdrawn and it runs again as one operation, so its records reach the tree properly.
 */
test('a record author an older rule split is run again as one operation, and its split children are withdrawn',()=>{
  const harness=setupWork({scope:['collab']});
  try{
    const store=harness.store,state=harness.state;
    const intake=state.ops.find(op=>op.intake);
    intake.status='done';intake.verdict='split';
    state.ops.push({...structuredClone(intake),id:'repair-1',origin:'repair',status:'ready',verdict:null,intake:null,goal:`${intake.goal.split('\n')[0]} - only \`.starciwork/features/collab/index.yaml\``,allowlist:['.starciwork/features/collab/index.yaml']});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    assert.deepEqual(log.filter(event=>event.event==='split-withdrawn').map(event=>event.op),['repair-1']);
    assert.deepEqual(log.filter(event=>event.event==='split-parent-readmitted').map(event=>event.op),[intake.id]);
    const again=state2.ops.find(op=>op.id===intake.id);
    assert.notEqual(again.status,'done');
    assert.equal(again.verdict,null);
    assert.match(again.findings.at(-1),/run again as one operation over the whole allowlist/);
    assert.equal(state2.ops.find(op=>op.id==='repair-1').refusal,'superseded');
  }finally{harness.cleanup();}
});

/**
 * A gate repair holds only the files the gate's evidence names when it names any inside the job's allowlists -
 * so the rest of the job keeps running beside it - and the whole job's allowlist only when the evidence names none.
 */
/**
 * Two operations share one allowlist folder: the validator judges the files each one reported, never the
 * neighbour's dirty file beside them; and an op the validator blocked over files it never claimed is re-admitted.
 */
test('the validator judges only the files the op claimed, and a block over unclaimed files is lifted at start',()=>{
  const own='apps/agentos-controlplane/src/intake/index.ts',foreign='apps/agentos-controlplane/src/intake/other.ts';
  const plan={definitionOfDone:['the slice works'],ledger:[{id:'goal-1',title:'Intake',inputRef:'sds:3',status:'absent'}],
    ops:[{id:'op-intake',kind:'backend.implement',goal:'Implement intake.',ledgerIds:['goal-1'],allowlist:[own,foreign],references:['sds.md'],
      checks:[{name:'integration',command:'npx vitest run intake'}],acceptance:['intake works'],dependsOn:[]}]};
  const seen=[];
  const harness=setup({plan,dirty:[own,foreign],scripts:{'op-intake':[{outcome:'done',summary:'Intake done.',files:[own],checks:[passing('integration','npx vitest run intake')]}],
    'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('integration','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({guards:stubGuards(),maxIterations:6,validateOp:payload=>{seen.push(payload);return acceptAll();}});
    const judged=seen.find(item=>item.op.id==='op-intake');
    assert.deepEqual(judged.diff.files,[own],'the neighbour\'s dirty file under the same allowlist is not in the diff the validator judges');
    const scoped=events(harness.store).find(event=>event.event==='validator-scope-attributed'&&event.op==='op-intake');
    assert.deepEqual([scoped.judged,scoped.left],[[own],[foreign]]);
    // An op an older build blocked over the neighbour's file is re-admitted at the next start, told to leave it alone.
    const op=state.ops.find(item=>item.id==='op-intake');
    op.status='blocked';op.validatorRejects=2;op.findings=[`validator: ${foreign} - this second file is outside the operation goal`];
    state.needUser.push({op:op.id,kind:'validator',detail:'op-intake was rejected by the validator 2 times'});
    harness.git.add(own);harness.git.add(foreign);
    const again=harness.run({guards:stubGuards(),maxIterations:1,validateOp:acceptAll});
    const readmitted=again.ops.find(item=>item.id==='op-intake');
    assert.ok(events(harness.store).some(event=>event.event==='validator-readmitted'&&event.op==='op-intake'&&event.files.includes(foreign)));
    assert.ok(!again.needUser.some(line=>line.op==='op-intake'&&line.kind==='validator'),'the validator line is gone');
    assert.equal(readmitted.validatorRejects,0);
  }finally{harness.cleanup();}
});

test('a gate repair is scoped to the files the failing gate names, and to the whole job only when it names none',()=>{
  const file=name=>`apps/agentos-controlplane/src/${name}/index.ts`;
  const plan={definitionOfDone:['both slices work'],ledger:[{id:'goal-1',title:'Sales slice',inputRef:'sds:3',status:'absent'}],
    ops:['intake','receipt'].map(name=>({id:`op-${name}`,kind:'backend.implement',goal:`Implement ${name}.`,ledgerIds:['goal-1'],
      allowlist:[file(name)],references:['sds.md'],checks:[{name:'integration',command:`npx vitest run ${name}`}],acceptance:[`${name} works`],dependsOn:[]}))};
  const done=name=>({outcome:'done',summary:`${name} done.`,files:[file(name)],checks:[passing('integration',`npx vitest run ${name}`)]});
  const harness=setup({plan,gates:['typecheck=npx tsc --noEmit'],dirty:[file('intake'),file('receipt')],
    scripts:{'op-intake':[done('intake')],'op-receipt':[done('receipt')],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('integration','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    // The gate fails and names exactly one file of the job; everything else passes.
    const state=harness.run({guards:stubGuards(),maxIterations:14,exec:command=>/tsc/.test(command)
      ?{status:2,stdout:'',stderr:`${file('intake')}(3,7): error TS2307: Cannot find module './x'`}
      :{status:0,stdout:`${command} ok`,stderr:''}});
    const repair=state.ops.find(op=>op.origin==='gate');
    assert.ok(repair,'a gate repair was planned');
    assert.deepEqual(repair.allowlist,[file('intake')],'the repair holds only the file the gate named, so the rest of the job runs beside it');
    const narrowed=events(harness.store).find(event=>event.event==='gate-scope-narrowed');
    assert.deepEqual([narrowed.gates,narrowed.files],[['typecheck'],[file('intake')]]);
  }finally{harness.cleanup();}
});

test('a mechanical line about an op that moved on is dropped from the owner\'s list every tick',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const op=state.ops[0];
    op.status='running';op.dispatch='ctx_live';op.terminal='term_live';op.runtime='gpt-6-astra';
    state.needUser.push({op:op.id,kind:'triage',detail:`settled:${op.id}:stalled-idle`});
    state.needUser.push({op:'nobody',kind:'credential',detail:'TELEGRAM_BOT_TOKEN'});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    // Whichever pass met the line first - the once-per-rule judgement on start or the per-tick sweep - names it as stale.
    const stale=[...log.filter(event=>event.event==='need-user-stale-dropped').flatMap(event=>event.dropped.map(entry=>[entry.kind,entry.op])),
      ...log.filter(event=>event.event==='parked-rejudged').flatMap(event=>event.routed.filter(entry=>/^stale:/.test(entry.route)).map(entry=>[entry.kind,entry.op]))];
    assert.deepEqual(stale,[['triage',op.id]]);
    assert.deepEqual(state2.needUser.map(item=>item.kind),['credential'],'the provision stays; the stale mechanical line is gone');
  }finally{harness.cleanup();}
});

/**
 * A red corner of the tree another workflow owns is not the op's failure: a report that failed only on the
 * whole-tree validator is read as done and judged by the kernel's scoped verdict, and an op an older rule parked
 * for spending its retries on that validator comes back with its retries cleared.
 */
test('a report that failed only on the whole-tree validator is read as done, and retries spent on it are a cooldown, not the owner\'s',()=>{
  const harness=setup({plan:sharedPlan,scripts:{}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('a foreign validator error is not a decision');},validateOp:null};
    const op=running(harness.state,'op-a','ctx_a');
    const report=buildReport({outcome:'failed',run:'run_wf',task:'task_a',dispatch:'ctx_a',from:'term_ctx_a',
      summary:'my files pass; the whole-tree validator exits 1 on six Sales UI assets another workflow has not landed',
      checks:[{name:'unit',command:'npx vitest run a',exitCode:0,evidence:'ok'},{name:'work-tree-validates',command:'node starci.mjs validate .starciwork',exitCode:1,evidence:'NODE_ASSET_UNREADABLE features/sales/ui/index.yaml'}]});
    report.sent={messageId:'msg_a',sentAt:1,type:report.signal.type};
    const before=events(harness.store).length;
    applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,ctx);
    const log=events(harness.store).slice(before);
    assert.deepEqual(log.filter(event=>event.event==='validator-only-block').map(event=>[event.op,event.from,event.to]),[['op-a','failed','done']]);
    assert.equal(log.some(event=>event.event==='retry'&&event.op==='op-a'),false,'the foreign error costs no round: '+JSON.stringify(log.filter(event=>event.event==='retry').map(event=>[event.reason,event.findings])));
  }finally{harness.cleanup();}
  const parked=setupWork();
  try{
    const store=parked.store,state=parked.state;
    const op=state.ops[0];
    op.status='blocked';op.repairs=4;
    state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} exhausted its retries: work-tree-validates failed (exit 1): NODE_ASSET_UNREADABLE features/sales/ui/index.yaml`});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    const state2=parked.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    assert.ok(log.some(event=>event.event==='launch-cooling'&&event.op===op.id&&event.migrated===true));
    assert.ok(log.some(event=>event.event==='launch-readmitted'&&event.op===op.id));
    const back=state2.ops.find(item=>item.id===op.id);
    assert.equal(back.repairs,0,'the retries spent on the validator are cleared');
    assert.equal(state2.needUser.some(item=>item.kind==='authority'),false,'a validator bound is never the owner\'s');
  }finally{parked.cleanup();}
});

/**
 * A stall over a bound that time lifts - the daily op budget of every runtime that could take the op - is a wait,
 * never a finish: the budget rolls with the UTC day. A finish an older rule declared over such a stall is withdrawn
 * on the next start, and the supervisor never treats it as finished.
 */
/**
 * An environment blocker an op reported is retried once per build - a new build is what changes the environment
 * it saw - and a finish declared blocked over the owner's list is withdrawn once that list is empty and work remains.
 */
test('an op-reported environment blocker is retried once per build, and a blocked finish is withdrawn once the list is empty',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const op=state.ops[0];
    op.status='blocked';op.reports=[{attempt:1,outcome:'blocked',summary:'the operator forbids it',blocker:{kind:'environment',detail:'Compiled work.author excludes integration output'}}];
    state.needUser.push({op:op.id,kind:'environment',detail:'Compiled work.author excludes integration output'});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    state.finished={outcome:'blocked',reason:'the policy could not settle every goal item',report:'x'};state.phase='finished';
    // The fixture's own ledger line is not the owner's item under test: the environment line is the only one left.
    state.needUser=state.needUser.filter(item=>item.kind!=='ledger');
    const before=store.readEvents().length;
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    assert.ok(log.some(event=>event.event==='environment-retried'&&event.op===op.id));
    assert.ok(log.some(event=>event.event==='finish-withdrawn'&&/settled and work remains/.test(event.because)));
    assert.equal(state2.finished,null);
    assert.equal(state2.needUser.some(item=>item.kind==='environment'),false);
    const again=state2.ops.find(item=>item.id===op.id);
    assert.notEqual(again.status,'blocked');
    assert.match(again.findings.at(-1),/the runtime was rebuilt since you reported the environment blocker/);
    // The same build never retries it twice: a second start with the same stamp leaves a re-blocked op alone.
    again.status='blocked';again.reports.push({attempt:2,outcome:'blocked',summary:'still',blocker:{kind:'environment',detail:'Compiled work.author excludes integration output'}});
    state2.needUser.push({op:op.id,kind:'environment',detail:'still'});
    const after=store.readEvents().length;
    harness.run({maxIterations:1});
    assert.equal(store.readEvents().slice(after).some(event=>event.event==='environment-retried'),false);
  }finally{harness.cleanup();}
});

test('a stall over a spent daily budget is a wait, and a finish declared over one is withdrawn on start',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    state.finished={outcome:'blocked',reason:'no runtime accepted an operation',report:'x'};state.phase='finished';
    state.needUser.push({kind:'environment',detail:'no runtime accepted an operation for 30 minutes (71 attempts)'});
    for(const op of state.ops)if(op.status==='ready')op.deferral={reason:'no runtime with the plan role, a free slot and budget for work.author: claude-fable-5.1 (daily op budget exhausted), gpt-6-astra (daily op budget exhausted)',at:0};
    const before=store.readEvents().length;
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    assert.ok(log.some(event=>event.event==='finish-withdrawn'&&event.reason==='no runtime accepted an operation'));
    assert.equal(state2.finished,null);
    assert.equal(state2.needUser.some(item=>/^no runtime accepted an operation/.test(item.detail??'')),false);
  }finally{harness.cleanup();}
});

/** A dependency in a cooldown is alive: what depends on it waits, and nothing is put to the owner. */
test('a dependency in a cooldown is alive, so its dependant waits instead of being blocked as never starting',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const base=state.ops[0];
    const cooling={...structuredClone(base),id:'shared-c',origin:'shared',nodeId:null,ledgerIds:[],status:'blocked',refusal:'launch-cooling',coolUntil:Date.now()+60*60*1000,dispatch:null,terminal:null,requesters:['req-c']};
    const waiting={...structuredClone(base),id:'req-c',origin:'repair',nodeId:null,ledgerIds:[],status:'pending',dependsOn:['shared-c'],dispatch:null,terminal:null};
    state.ops.push(cooling,waiting);
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const state2=harness.run({maxIterations:1});
    const req=state2.ops.find(op=>op.id==='req-c');
    assert.notEqual(req.status,'blocked','a cooling dependency is not a dead one');
    assert.equal(state2.needUser.some(item=>/can never start/.test(item.detail??'')),false);
  }finally{harness.cleanup();}
});

test('an op that lost its agent past the restart limit cools down and comes back, and the owner is not asked',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const op=state.ops[0];
    op.status='blocked';op.runtime='gpt-6-astra';op.restarts=4;
    state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} lost its agent 4 times; the last terminal term_x no longer exists`});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    assert.deepEqual(log.filter(event=>event.event==='launch-cooling').map(event=>[event.op,event.migrated]),[[op.id,true]]);
    assert.ok(log.some(event=>event.event==='launch-readmitted'&&event.op===op.id),'the cooldown is already due: the op is re-admitted at once');
    const readmitted=state2.ops.find(item=>item.id===op.id);
    assert.notEqual(readmitted.status,'blocked');
    assert.equal(readmitted.restarts,0);
    assert.equal(state2.needUser.some(item=>item.kind==='environment'),false,'a lost agent is time, not the owner\'s');
  }finally{harness.cleanup();}
});

/**
 * The marker is the ruling. An ask op that answered from a decided record and still wrote `blocked` beside it
 * (asking for a Work path it had no business with) is settled on the marker: the requester carries the answer,
 * the ask is done, and nothing is sent to a terminal that may already be gone.
 */
/**
 * A record-authoring op writes records under its allowlist and nothing else. One that asks for a shared change -
 * the identity resource it was only meant to declare, the code that reads the variable - is told the rule in its
 * next attempt, and no shared op is opened on product code on its behalf.
 */
test('a record-authoring op that asks for a shared change is told the rule and runs again; no shared op opens on product code for it',()=>{
  const harness=setup({plan:sharedPlan,scripts:{}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const guards=stubGuards();
    const ctx={cwd,allocator:harness.allocator,guards,git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('a refused shared change is not a decision');}};
    const intake=running(harness.state,'op-a','ctx_intake');
    intake.kind='work.author';intake.intake={scope:'chatbot',mode:'migrate'};intake.allowlist=['.starciwork/features/chatbot/index.yaml','.starciwork/features/chatbot/integration/**'];
    const before=harness.state.ops.length;
    const report=buildReport({outcome:'blocked',run:'run_wf',task:'task_intake',dispatch:'ctx_intake',from:'term_ctx_intake',
      summary:'no custody exists',blocker:{kind:'shared-change',detail:'.starciwork/_resources/identity/chatbot-telegram/secrets.enc.yaml and src/modules/bussiness/pod-credential/channel-provider.ts must change'}});
    report.sent={messageId:'msg_intake',sentAt:1,type:report.signal.type};
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,intake,report,ctx),'retry');
    assert.equal(harness.state.ops.length,before,'no shared op was opened');
    assert.equal(intake.status,'ready');
    assert.match(intake.findings.at(-1),/declared, never created/);
    const refused=events(harness.store).filter(event=>event.event==='shared-change-refused'&&event.op==='op-a');
    assert.deepEqual(refused.map(event=>event.reason),['record-authoring op']);
  }finally{harness.cleanup();}
});

test('an ask op that found the answer is settled on its marker whatever outcome it wrote, and the requester carries the answer',()=>{
  const harness=setup({plan:sharedPlan,scripts:{}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const guards=stubGuards();
    const ctx={cwd,allocator:harness.allocator,guards,git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('an answered question is not a decision');}};
    const op=id=>harness.state.ops.find(item=>item.id===id);
    const requester=op('op-a');
    requester.status='paused';requester.waitingFor='ask-9';requester.dependsOn=[...(requester.dependsOn??[]),'ask-9'];
    const ask={...structuredClone(requester),id:'ask-9',kind:'decision.prepare',origin:'ask',status:'running',dispatch:'ctx_ask-9',terminal:'term_ask-9',
      requesters:['op-a'],dependsOn:[],waitingFor:null,ledgerIds:[],reports:[],attempt:1,runtime:'gpt-6-astra',
      question:{kind:'decision',text:'Which refund window holds?',options:[],from:'op-a'},
      allowlist:['.starciwork/features/sales/business/srs/business-rules/policy-decisions/**'],checks:[],acceptance:['the question is answered from a decided record or drafted as one decision record']};
    harness.state.ops.push(ask);
    const report=buildReport({outcome:'blocked',run:'run_wf',task:'task_ask-9',dispatch:'ctx_ask-9',from:'term_ask-9',
      summary:'answered-from: demo.sales.business.overview the refund window is 14 days, decided there',
      blocker:{kind:'shared-change',detail:'.starciwork/features/sales/ui/index.yaml must change'}});
    report.sent={messageId:'msg_ask-9',sentAt:1,type:report.signal.type};
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,ask,report,ctx),'owner-ask-settled');
    assert.equal(op('ask-9').status,'done');
    const log=events(harness.store);
    assert.deepEqual(log.filter(event=>event.event==='owner-ask-marker-honoured').map(event=>[event.op,event.outcome,event.marker]),[['ask-9','blocked','answered-from']]);
    assert.ok(log.some(event=>event.event==='owner-ask-answered-from-record'&&event.record==='demo.sales.business.overview'));
    assert.equal(log.some(event=>event.event==='shared-change-refused'&&event.op==='ask-9'),false,'the blocked line beside the marker is noise');
    assert.notEqual(op('op-a').status,'paused','the requester carries the answer');
    assert.match(JSON.stringify(op('op-a')),/Answered from the decided record demo\.sales\.business\.overview/);
  }finally{harness.cleanup();}
});

test('an op the restart limit blocked for a rate limit cools down and is re-admitted on another runtime, and an older block is migrated',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const op=state.ops[0];
    // An older build's block: a question, no cooldown recorded. The first pass gives it one and drops the question.
    op.status='blocked';op.runtime='gpt-5.6-sol';op.restarts=4;
    state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} was restarted 4 times (rate-limited)`});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    // One tick: the block is migrated to a cooldown that is already due, so the op is re-admitted at once.
    const state2=harness.run({maxIterations:1});
    const log=store.readEvents().slice(before);
    assert.deepEqual(log.filter(event=>event.event==='rate-limit-cooling').map(event=>[event.op,event.migrated]),[[op.id,true]]);
    assert.deepEqual(log.filter(event=>event.event==='rate-limit-readmitted').map(event=>[event.op,event.avoid]),[[op.id,['gpt-5.6-sol']]]);
    assert.equal(state2.needUser.some(item=>item.kind==='environment'),false,'the question is gone: a limit is time, not a defect');
    const readmitted=state2.ops.find(item=>item.id===op.id);
    assert.equal(readmitted.restarts,0);
    assert.notEqual(readmitted.status,'blocked');
    assert.ok(RATE_LIMIT_COOLDOWN_MS>=30*60*1000);
    // The avoidance is stamped and expires with the cooldown: an hour later Sol is open to the op again.
    assert.equal(typeof readmitted.avoidedAt['gpt-5.6-sol'],'number');
    readmitted.status='ready';readmitted.avoidedAt['gpt-5.6-sol']=Date.now()-RATE_LIMIT_COOLDOWN_MS-1;
    const state3=harness.run({maxIterations:1});
    const later=state3.ops.find(item=>item.id===op.id);
    assert.deepEqual(later.avoidRuntimes,[]);
    assert.deepEqual(store.readEvents().filter(event=>event.event==='avoid-expired').map(event=>[event.op,event.runtimes]),[[op.id,['gpt-5.6-sol']]]);
  }finally{harness.cleanup();}
});

// "no runtime could launch op-3 (3 attempts, last chain-exhausted)" was an item on the owner's list, and there
// was nothing the owner could do with it: a launcher that will not start is time, not a decision. The op cools
// for the same window a provider limit uses and comes back by itself - capped, because an environment that
// still refuses it after six re-admissions in one day really is broken, and that IS the owner's.
test('a spent launch bound cools the op and re-admits it, and only the daily cap reaches the owner',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    const op=state.ops[0];
    op.status='blocked';op.refusal='launch-cooling';op.coolUntil=0;op.launchFailures=3;op.runtime='gpt-5.6-sol';
    op.coolReason=`no runtime could launch ${op.id} (3 attempts, last chain-exhausted)`;
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const before=store.readEvents().length;
    const after=harness.run({maxIterations:1});
    const readmitted=store.readEvents().slice(before).filter(event=>event.event==='launch-readmitted');
    assert.deepEqual(readmitted.map(event=>[event.op,event.readmissions,event.cap]),[[op.id,1,LAUNCH_DAILY_CAP]]);
    const back=after.ops.find(item=>item.id===op.id);
    assert.deepEqual([back.refusal,back.launchFailures,back.restarts],[null,0,0]);
    assert.equal(after.needUser.some(item=>item.kind==='environment'),false,'a mechanical bound is never the owner\'s item');
    // Past the cap the environment is the owner's after all, and the item says exactly what kept failing.
    back.status='blocked';back.refusal='launch-cooling';back.coolUntil=0;
    back.launchReadmissions={day:new Date().toISOString().slice(0,10),count:LAUNCH_DAILY_CAP};
    const spent=harness.run({maxIterations:1});
    assert.deepEqual(store.readEvents().filter(event=>event.event==='launch-cap-reached').map(event=>[event.op,event.readmissions]),
      [[op.id,LAUNCH_DAILY_CAP]]);
    assert.match(spent.needUser.find(item=>item.kind==='environment').detail,
      /no runtime could launch .* it was re-admitted 6 times today and the environment still refuses it/);
  }finally{harness.cleanup();}
});

test('approving a workflow that finished blocked resumes it, and questions whose reason is gone go with it',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    approve(store,state);
    state.finished={outcome:'blocked',reason:'the policy could not settle every goal item',report:null};state.phase='finished';
    const gone=state.ops[0];gone.status='blocked';gone.refusal='superseded';
    state.needUser.push({op:gone.id,kind:'ledger-path',detail:`${gone.id} asked for a change the kernel will not delegate`});
    state.ops.push({...gone,id:'shared-1',refusal:null,status:'pending',requesters:['x']});
    state.needUser.push({op:'x',kind:'shared-change',detail:'x waits for the shared change shared-1, which is blocked'});
    // Ops a limit exhausted: the validator's rejections and the launch attempts. Approving again is the owner's "try again".
    const spent=state.ops.find(item=>item.id==='shared-1');spent.status='blocked';spent.validatorRejects=2;spent.avoidRuntimes=['gpt-5.6-sol'];
    state.needUser.push({op:spent.id,kind:'validator',detail:`${spent.id} was rejected by the validator 2 times: ...`});
    const unlaunched={...gone,id:'shared-2',refusal:null,status:'blocked',launchFailures:3,requesters:['x']};state.ops.push(unlaunched);
    state.needUser.push({op:unlaunched.id,kind:'environment',detail:`no runtime could launch ${unlaunched.id} (3 attempts, last Operation can be launched only by the exact Workflow Monitor)`});
    approve(store,state,{allowDynamic:'64'});
    assert.equal(state.finished,null,'the user answering is the resume');
    assert.equal(state.phase,'run');
    assert.equal(state.dynamicOpsBudget,64);
    assert.deepEqual(events(store).filter(event=>event.event==='resumed-after-block').map(event=>[event.budget,event.readmitted]),[[64,[spent.id,unlaunched.id]]]);
    assert.deepEqual([spent.status,spent.validatorRejects,spent.avoidRuntimes,unlaunched.status,unlaunched.launchFailures],['ready',0,[],'ready',0],'a clean slate: counters and avoided runtimes alike');
    assert.equal(gone.status,'blocked','an op refused on principle stays refused');
    assert.deepEqual(state.needUser.filter(item=>['validator','environment'].includes(item.kind)),[],'their questions went with the block');
    assert.deepEqual(events(store).filter(event=>event.event==='op-readmitted').map(event=>event.op),[spent.id,unlaunched.id]);
    // The pruning runs with the tree at the next sync; here it is exercised through one loop tick.
    state.run='run_wf';state.from='term_kernel';
    const after=harness.run({maxIterations:1});
    assert.deepEqual(after.needUser.filter(item=>['ledger-path','shared-change'].includes(item.kind)),[],'a superseded op and an unblocked shared change ask nothing');
  }finally{harness.cleanup();}
});

test('the quota proposal gives every role the plan needs a runtime with a slot',()=>{
  const harness=setupWork({scope:['collab']});
  try{
    // The one op is a work.author (plan role). The Codex window carries plan - it is the middle tier of the
    // downgrade - so the strongest runtime covers the role; the head of the chain, Fable, is what no implement
    // order ever names.
    const proposal=harness.state.quotaProposal;
    const sol=proposal.rows.find(row=>row.runtime==='codex-agent');
    assert.ok(sol&&sol.slots>=1,`a runtime with the plan role has a slot: ${proposal.text}`);
    const fable=proposal.rows.find(row=>row.runtime==='claude-fable');
    assert.ok(fable&&fable.slots>=1,`the preferred plan runtime has a slot: ${proposal.text}`);
    assert.match(fable.why,/launch chain of work\.author/);
  }finally{harness.cleanup();}
});

test('a shared change naming a path of another repository is refused and the op is answered, never delegated',()=>{
  const nodeId='demo.sales.implementation.backend.intake';
  const foreign={outcome:'blocked',summary:'The token must be added in the frontend.',files:[],checks:[],
    blocker:{kind:'shared-change',detail:'../demo-frontend/src/app/globals.css'}};
  const harness=setupWork({dirty:['apps/agentos-controlplane/src/sales/intake.ts'],
    scripts:{[nodeId]:[foreign,{outcome:'done',summary:'Recorded the source gap in the record instead.',files:['apps/agentos-controlplane/src/sales/intake.ts'],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:12});
    const log=events(harness.store);
    assert.deepEqual(log.filter(event=>event.event==='shared-change-refused').map(event=>[event.op,event.reason,event.paths]),
      [[nodeId,'outside this repository',['../demo-frontend/src/app/globals.css']]]);
    assert.equal(state.ops.some(op=>op.origin==='shared'),false,'no shared op was created for a foreign path');
    assert.equal(state.ops.find(op=>op.id===nodeId).status,'done','the op reported again with the gap recorded');
  }finally{harness.cleanup();}
});

test('a command for a running kernel is an inbox file the loop applies at its next tick; a new allocation ends the loop for a restart',()=>{
  const harness=setupWork();
  try{
    const store=harness.store,state=harness.state;
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    queueInbox(store,{kind:'approve',allowDynamic:'64'});
    const after=harness.run({maxIterations:1});
    assert.equal(after.dynamicOpsBudget,64,'the budget was raised from the inbox, never by a write to the state file');
    const applied=events(store).filter(event=>event.event==='inbox-applied');
    assert.deepEqual(applied.map(event=>[event.kind,event.budget.to,event.quotaChanged]),[['approve',64,false]]);
    assert.equal(fs.readdirSync(store.paths.inbox).length,0,'the command was consumed');
    // A new allocation cannot take effect in the running allocator: the loop ends and says why.
    // Retired pool ids in an owner allocation still resolve to their provider windows.
    queueInbox(store,{kind:'approve',allocation:'claude-opus=2:hard+medium,gpt-5.6-sol=1:hard+medium'});
    const restarted=harness.run({maxIterations:3});
    assert.deepEqual(events(store).filter(event=>event.event==='stopped').map(event=>event.reason).slice(-1),['restart: allocation changed']);
    assert.equal(restarted.quota.slots['claude-agent'],2);
    assert.equal(restarted.quota.slots['codex-agent'],1);
  }finally{harness.cleanup();}
});

test('an accepted op closes its terminal, and the reconcile sweep closes stale kernel and done-op tabs of this workflow only',()=>{
  const nodeId='demo.sales.implementation.backend.intake';
  const done=summary=>({outcome:'done',summary,files:['apps/agentos-controlplane/src/sales/intake.ts'],checks:[passing('unit-tests-pass','npx vitest run intake')]});
  const harness=setupWork({dirty:['apps/agentos-controlplane/src/sales/intake.ts'],scripts:{[nodeId]:[done('Intake implemented.')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    // Tabs an older build left behind: a stale kernel tab of this workflow, a done-op tab of this workflow, and a tab of another workflow.
    harness.fake.terminals.set('term_stale_kernel',{handle:'term_stale_kernel',title:`[Kernel] ${harness.state.id}`,status:'running',sent:false,worktreePath:cwd});
    harness.fake.terminals.set('term_other',{handle:'term_other',title:'[Kernel] some-other-workflow',status:'running',sent:false,worktreePath:cwd});
    harness.fake.terminals.set('term_foreign_op',{handle:'term_foreign_op',title:'[Op] backend.implement - other.workflow.op',status:'running',sent:true,worktreePath:cwd});
    // A blocked op of this workflow still holding the tab of its last attempt: nobody reads it, it goes too.
    const blocked={...harness.state.ops[0],id:'shared-9',kind:'e2e.verify',status:'blocked',terminal:'term_blocked_op',dispatch:null,requesters:['x']};harness.state.ops.push(blocked);
    // Its rename never landed: the tab carries the agent's default title and is matched by the handle the op holds.
    harness.fake.terminals.set('term_blocked_op',{handle:'term_blocked_op',title:'Qwen - agentos',status:'running',sent:true,worktreePath:cwd});
    // A prepared decision the owner has not answered: its tab is where they see the question, so it stays.
    const asked={...harness.state.ops[0],id:'ask-7',kind:'decision.prepare',status:'done',terminal:'term_ask_open',dispatch:null,requesters:['x'],nodeId:null,
      reports:[{outcome:'done',summary:'decision: demo.sales.business.srs.decision.d-demo\nrecommended: 1\n1. keep\n2. drop',files:[],checks:[]}]};harness.state.ops.push(asked);
    harness.fake.terminals.set('term_ask_open',{handle:'term_ask_open',title:'[Op] decision.prepare - ask-7',status:'running',sent:true,worktreePath:cwd});
    // A sibling workflow of this store root that finished, and its kernel tab left behind.
    const siblingDir=path.join(path.dirname(harness.store.dir),'sibling-done');fs.mkdirSync(siblingDir,{recursive:true});
    fs.writeFileSync(path.join(siblingDir,'state.json'),JSON.stringify({id:'sibling-done',finished:{outcome:'done'}}));
    harness.fake.terminals.set('term_sibling',{handle:'term_sibling',title:'[Kernel] sibling-done',status:'running',sent:false,worktreePath:cwd});
    const state=harness.run({maxIterations:8});
    const op=state.ops.find(item=>item.id===nodeId);
    assert.equal(op.status,'done');
    assert.equal(op.terminal,null,'the accepted op has no terminal any more');
    const log=events(harness.store);
    assert.deepEqual(log.filter(event=>event.event==='op-terminal-closed').map(event=>event.op),[nodeId]);
    assert.ok(log.some(event=>event.event==='terminals-swept'&&event.closed.some(item=>item.terminal==='term_blocked_op'&&item.reason==='op blocked')),'the blocked op tab was swept');
    assert.equal(harness.fake.terminals.has('term_blocked_op'),false);
    assert.equal(harness.fake.terminals.has('term_sibling'),false,'the kernel tab of the finished sibling workflow was swept');
    assert.ok(harness.fake.terminals.has('term_other'),'a kernel tab of a workflow this store root does not know is left alone');
    assert.equal(state.ops.find(item=>item.id===blocked.id).terminal,null);
    assert.ok(typeof state.lastSweepAt==='number');
    assert.ok(log.some(event=>event.event==='terminals-swept'&&event.closed.some(item=>item.terminal==='term_stale_kernel'&&item.reason==='stale kernel tab')),'the stale kernel tab of this workflow was swept');
    assert.ok(harness.fake.terminals.has('term_other'),'another workflow\'s kernel tab is never touched');
    assert.ok(harness.fake.terminals.has('term_foreign_op'),'another workflow\'s op tab is never touched');
    assert.equal(harness.fake.terminals.has('term_stale_kernel'),false);
    assert.ok(harness.fake.terminals.has('term_ask_open'),'the tab of an unanswered prepared decision stays open for the owner');
    assert.ok(log.some(event=>event.event==='ask-tab-kept'&&event.op==='ask-7'));
    // Answered, the question has no reader: the next sweep closes the tab.
    state.ops.find(item=>item.id==='ask-7').answer={choice:'1',note:null,at:1,via:'command'};
    harness.run({maxIterations:1});
    assert.equal(harness.fake.terminals.has('term_ask_open'),false,'an answered decision\'s tab is swept');
  }finally{harness.cleanup();}
});

test('untracked strays that alone make the tree invalid are quarantined beside the store, the tree is read again, and ops the red tree had exhausted are judged again',()=>{
  const nodeId='demo.sales.implementation.backend.intake';
  const harness=setupWork({dirty:['apps/agentos-controlplane/src/sales/intake.ts'],scripts:{}});
  try{
    const {store,state,repo}=harness;
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    // Half a feature an abandoned op left in the tree: untracked, owned by nobody, and invalid.
    const stray=path.join(repo,'.starciwork','features','collab','architecture','sds','x','index.yaml');
    fs.mkdirSync(path.dirname(stray),{recursive:true});
    fs.writeFileSync(stray,'schema: work/node@2\nid: demo.collab.x\nkind: architecture\nstate: todo\n');
    // The fake validator projection says the tree is invalid because of it, and the fake git lists it as untracked.
    const validate=()=>({ok:false,errors:[{code:'SDS_MAP',path:'features/collab/architecture/sds/x/index.yaml',message:'Unsupported SDS status'}],warnings:[],nodes:[],resources:[]});
    const git=(executable,args,options)=>args[0]==='status'&&args.includes('.starciwork')?{status:0,stdout:'?? .starciwork/features/collab/\n',stderr:''}:harness.git.git(executable,args,options);
    // An op the validator exhausted while the tree was red.
    const op=state.ops.find(item=>item.id===nodeId);
    op.status='blocked';op.validatorRejects=2;
    state.needUser.push({op:op.id,kind:'validator',detail:`${op.id} was rejected by the validator 2 times: the required work-valid check exits 1`});
    // The tree is invalid exactly while the stray is in it.
    const after=harness.run({maxIterations:2,git,validate:()=>fs.existsSync(stray)?validate():harness.validate()});
    const log=events(store);
    const quarantined=log.find(event=>event.event==='stray-quarantined');
    assert.ok(quarantined,'the stray was quarantined');
    assert.deepEqual(quarantined.strays.map(item=>item.from),['.starciwork/features/collab/']);
    assert.equal(fs.existsSync(stray),false,'the stray left the tree');
    assert.ok(fs.existsSync(path.join(store.dir,'strays')),'and is kept beside the store');
    assert.ok(log.some(event=>event.event==='ledger-valid-again'));
    // The op the red tree had exhausted is not blocked any more (a kernel start re-admits validator-blocked ops; a mid-run recovery says `op-readmitted`).
    assert.notEqual(after.ops.find(item=>item.id===nodeId).status,'blocked');
    assert.equal(after.needUser.some(item=>item.kind==='validator'),false);
  }finally{harness.cleanup();}
});

test('a run bound to a coordinator tab that is gone is re-bound to the tab the kernel is in, once, and a matching one is left alone',()=>{
  const harness=setupWork();
  try{
    const {store,state}=harness;
    state.run='run_wf';state.from='term_new';
    const calls=[];
    const orca={invoke:(command,params)=>{calls.push([command,params]);
      if(command==='run-show')return {outcome:'ok',receipt:{ok:true,result:{run:{id:'run_wf',coordinator_handle:'term_gone'}}}};
      if(command==='run-use')return {outcome:'ok',receipt:{ok:true,result:{}}};
      return {outcome:'ok',receipt:{}};}};
    assert.equal(rebindRunIfNeeded(orca,store,state,{cwd}),true);
    assert.deepEqual(calls.map(([command])=>command),['run-show','run-use']);
    assert.deepEqual(calls[1][1],{id:'run_wf',from:'term_new'});
    assert.deepEqual(events(store).filter(event=>event.event==='run-rebound').map(event=>[event.from,event.was,event.ok]),[['term_new','term_gone',true]]);
    // The coordinator already is this tab: nothing is re-bound.
    const quiet={invoke:(command)=>command==='run-show'?{outcome:'ok',receipt:{ok:true,result:{run:{id:'run_wf',coordinator_handle:'term_new'}}}}:{outcome:'ok',receipt:{}}};
    assert.equal(rebindRunIfNeeded(quiet,store,state,{cwd}),false);
  }finally{harness.cleanup();}
});

test('the engine prepares one authentic canonical Work gate for every Work-writing kind and rejects a forged name',()=>{
  const ctx={engine:{},work:{repoRoot:'D:/product',ledger:{workRoot:'D:/canonical/.starciwork'}}},op={kind:'architecture.revise',checks:[]};
  assert.equal(prepareWorkGate(op,ctx),true);assert.equal(op.checks.length,1);assert.equal(op.checks[0].name,'work-valid');assert.match(op.checks[0].command,/D:[\\/]canonical[\\/]\.starciwork/);assert.equal(op.checks[0].runtimePrepared,true);
  assert.equal(prepareWorkGate(op,ctx),false);assert.equal(op.checks.length,1,'the exact runtime gate is deduplicated');
  assert.throws(()=>prepareWorkGate({kind:'architecture.revise',checks:[{name:'work-valid',command:'exit 0'}]},ctx),/reserved for the exact canonical Work validator/);
  assert.throws(()=>prepareWorkGate({kind:'architecture.revise',checks:[]},{engine:{},work:null}),/canonical Work binding is unavailable/);
});

test('engine record-kind validation sees every sealed observed write while legacy attribution remains report-bound',()=>{
  const record='.starciwork/features/sales/ui/index.yaml';
  const op={kind:'backend.implement',nodeId:null,reports:[{files:[]}]};
  assert.deepEqual(producedKindVerdict(op,[record],{}).produced,[]);
  const verdict=producedKindVerdict(op,[record],{engine:{}});
  assert.deepEqual(verdict.produced,[record]);assert.deepEqual(verdict.undeclared.map(item=>item.file),[record]);
  assert.equal(producedKindVerdict(op,[record],{engine:{},kindsProfile:{}}).ok,false,'an unavailable kind schema fails closed');
});

test('an intake op planned by an older build carries the current goal and acceptance after a sync, its allowlist untouched',()=>{
  const harness=setupWork({scope:['collab']});
  try{
    const {store,state}=harness;
    approve(store,state);
    const op=state.ops.find(item=>item.intake?.scope==='collab');
    op.acceptance=['features/collab has a module record, a business overview, SRS records and an architecture skeleton, all todo and valid','no existing feature changed','the Work tree still validates'];
    op.goal='an older wording';
    const allowlist=[...op.allowlist];
    state.run='run_wf';state.from='term_kernel';
    const after=harness.run({maxIterations:1});
    const fresh=after.ops.find(item=>item.id===op.id);
    assert.match(fresh.acceptance[0],/every leaf record todo and the whole feature valid - the roots/);
    assert.match(fresh.goal,/every leaf record todo/);
    assert.deepEqual(fresh.allowlist,allowlist);
    assert.deepEqual(events(store).filter(event=>event.event==='intake-retemplated').map(event=>[event.op,event.changed]),[[op.id,['goal','acceptance']]]);
  }finally{harness.cleanup();}
});

test('an op that wrote the brand record is judged by the record on disk, not by the summary the sync read before it ran',()=>{
  const fresh={brand:{rev:1},list:[]},stale={brand:{rev:4},list:[]};
  const ctx={work:{loaded:stale,at:{repoRoot:'r',workRoot:'w'},validate:null,api:{loadLedger:()=>fresh}}};
  assert.equal(treeForVerdict(ctx,['apps/x.ts']),stale,'an op elsewhere is judged by the tree as last read');
  assert.equal(treeForVerdict(ctx,['.starciwork/brand/index.yaml']),fresh,'the brand op is judged by what it wrote');
  assert.equal(ctx.work.loaded,fresh,'and the kernel reads on from there');
  assert.equal(treeForVerdict({work:{...ctx.work,api:{loadLedger:()=>{throw Error('gone');}}}},['.starciwork/brand/index.yaml']),fresh,'an unreadable tree falls back to the last read');
  assert.equal(treeForVerdict(null,['.starciwork/brand/index.yaml']),null);
});

test('a rejected attempt closes its tab before the next one opens, and a validator-exhausted block leaves no idle tab',()=>{
  const nodeId='demo.sales.implementation.backend.intake';
  const done=summary=>({outcome:'done',summary,files:['apps/agentos-controlplane/src/sales/intake.ts'],checks:[passing('unit-tests-pass','npx vitest run intake')]});
  const harness=setupWork({dirty:['apps/agentos-controlplane/src/sales/intake.ts'],scripts:{[nodeId]:[done('first'),done('second')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const reject=()=>({ok:true,verdict:'reject',summary:'not yet',findings:[{file:'apps/agentos-controlplane/src/sales/intake.ts',detail:'the receipt is not rendered'}],dropped:[],provider:'stub',usage:null});
    const state=harness.run({maxIterations:8,validateOp:reject});
    const op=state.ops.find(item=>item.id===nodeId);
    assert.equal(op.status,'blocked');
    assert.equal(op.terminal,null,'a blocked op holds no tab');
    const log=events(harness.store);
    const closed=log.filter(event=>event.event==='op-terminal-closed').map(event=>event.op);
    assert.deepEqual(closed,[nodeId,nodeId],'the retried attempt and the exhausted one each closed their tab');
    assert.ok(log.findIndex(event=>event.event==='op-terminal-closed')<log.findIndex(event=>event.event==='retry'),'the tab closes before the retry is announced');
    assert.deepEqual([...harness.fake.terminals.values()].filter(term=>term.title?.startsWith('[Op]')&&term.title.includes(nodeId)&&!term.title.includes('-author')).map(term=>[term.handle,term.title]),[],'no tab of the blocked op is left');
  }finally{harness.cleanup();}
});

test('an accepted intake settles by what the tree holds under its scope and the workflow finishes done, asking nothing about a node called null',()=>{
  const file='.starciwork/features/collab/index.yaml';
  const harness=setupWork({scope:['collab'],dirty:[file],scripts:{'collab-intake':[{outcome:'done',summary:'Authored the collab drafts.',files:[file],
    checks:[passing('work-tree-validates','node starci.mjs validate')],
    effect:()=>{fs.mkdirSync(path.dirname(path.join(activeRepo,file)),{recursive:true});fs.writeFileSync(path.join(activeRepo,file),['schema: work/node@2','id: demo.collab','kind: module','extensions:','  work3:','    reconciliation:','      - case: reference','        record: demo.sales.architecture.sds.intake','        detail: collab admits through the intake contract sales decided',''].join(String.fromCharCode(10)));}}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    // An older build's question about the intake, left in the state: it goes with the first sync.
    harness.state.needUser.push({node:null,kind:'ledger',detail:'ledger incomplete: null is still not launchable after collab-intake completed its record'});
    const state=harness.run({maxIterations:8});
    const log=events(harness.store);
    assert.equal(state.ops[0].status,'done');
    assert.equal(log.some(event=>event.event==='record-still-incomplete'),false,'an intake is never an incomplete record');
    assert.deepEqual(log.filter(event=>event.event==='intake-authored').map(event=>[event.op,event.scope]),[['collab-intake','collab']]);
    assert.deepEqual(log.filter(event=>event.event==='need-user-answered').map(event=>event.reason),['an intake authors records, not a node']);
    assert.deepEqual(state.needUser,[]);
    assert.equal(state.finished?.outcome,'done',JSON.stringify(state.finished));
  }finally{harness.cleanup();}
});

test('a kernel paused by the stop flag releases its own tab, and the next start opens a new one',()=>{
  const harness=setupWork();
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';harness.state.kernelTerminalOwned=true;
    harness.fake.terminals.set('term_kernel',{handle:'term_kernel',title:`[Kernel] ${harness.state.id}`,status:'running',sent:false,worktreePath:cwd});
    fs.writeFileSync(path.join(harness.store.dir,'stop.flag'),'');
    const state=harness.run({maxIterations:3});
    assert.equal(state.from,null);assert.equal(state.kernelTerminalOwned,false);
    assert.equal(harness.fake.terminals.has('term_kernel'),false,'the paused kernel left no tab');
    assert.deepEqual(events(harness.store).filter(event=>event.event==='kernel-terminal-closed').map(event=>event.reason),['paused by stop flag']);
  }finally{harness.cleanup();}
});

test('a report on a shared tree is checked against both spellings of its allowlist: the absolute path of the owner and the tree-relative one',()=>{
  const ctx={work:{shared:true,ledger:{repoRoot:'C:/owner/backend',workRoot:'C:/owner/backend/.starciwork'}}};
  assert.deepEqual(reportAllowlist({allowlist:['C:/owner/backend/.starciwork/features/sales/ui/**','apps/x/**']},ctx),
    ['C:/owner/backend/.starciwork/features/sales/ui/**','.starciwork/features/sales/ui/**','apps/x/**']);
  assert.deepEqual(reportAllowlist({allowlist:['.starciwork/features/sales/ui/**']},{work:{shared:false}}),['.starciwork/features/sales/ui/**'],'a local tree is left as it is');
});

test('a check re-run for a shared-ledger op names the tree at its owner: the bare .starciwork argument becomes the absolute work root',()=>{
  const ctx={work:{shared:true,ledger:{repoRoot:'C:/owner/backend',workRoot:'C:/owner/backend/.starciwork'}}};
  assert.equal(sharedCheckCommand('node starci.mjs validate .starciwork',ctx),'node starci.mjs validate C:/owner/backend/.starciwork');
  assert.equal(sharedCheckCommand('node starci.mjs validate .starciwork/features/sales',ctx),'node starci.mjs validate C:/owner/backend/.starciwork/features/sales');
  assert.equal(sharedCheckCommand('npm run test:unit -- .starciwork-ish',ctx),'npm run test:unit -- .starciwork-ish','a longer word is not the tree');
  assert.equal(sharedCheckCommand('node starci.mjs validate .starciwork',{work:{shared:false}}),'node starci.mjs validate .starciwork','a local tree is left as it is');
  const seen=[];
  const verified=machineVerify({worktree:'C:/fe'},{checks:[{name:'tree',command:'node starci.mjs validate .starciwork'}]},{exec:command=>{seen.push(command);return {status:0,stdout:'',stderr:''};},work:ctx.work});
  assert.deepEqual(seen,['node starci.mjs validate C:/owner/backend/.starciwork']);
  assert.equal(verified.ok,true);
});

test('a question only the owner can answer pauses the op and opens an ask op; an ask that reports a decision lifts its own stop, the answer is delivered, and a mechanical question stays with the kernel',()=>{
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  // A provision the owner opens on an outside system: there is nothing to type into a field, so this one is
  // still asked by its own operation in its own tab. A credential is not - the kernel asks that one by form.
  const question={outcome:'ask',summary:'Need a ruling.',files:[],checks:[],question:{text:'Which e-invoicing provider sandbox account does the chatbot deliver through, and who registers it?',options:['the provider\'s own sandbox tenant','a shared partner tenant'],kind:'account'}};
  const askReport={outcome:'done',summary:'decision: demo.sales.business.srs.decision.d-telegram-token\n1. the provider\'s own sandbox tenant\n2. a shared partner tenant',files:[],checks:[passing('work-tree-validates','node starci.mjs validate')]};
  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[question,{outcome:'done',summary:'Intake implemented with the ruling.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
    'ask-1':[askReport]}});
  try{
    const {store,state}=harness;
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    // Tick 1: the op asks; the kernel never hands a credential question to the supervisor model (the harness decide throws).
    let after=harness.run({maxIterations:1});
    const requester=after.ops.find(op=>op.id===nodeId),ask=after.ops.find(op=>['decision.prepare','provision.ask'].includes(op.kind));
    assert.ok(ask,'a decision.prepare op was opened');
    // The decision lands where the tree keeps its policy decisions, under the feature folder read from the tree.
    assert.deepEqual([ask.id,ask.origin,ask.allowlist,ask.requesters,ask.question.kind,ask.question.from],['ask-1','ask',['.starciwork/features/sales/business/srs/business-rules/policy-decisions/**'],[nodeId],'account',nodeId]);
    assert.equal(ask.question.stop,'account','an account on an outside system is a stop reason: the requester waits');
    assert.deepEqual([requester.status,requester.waitingFor],['paused','ask-1']);
    assert.ok(events(store).some(event=>event.event==='owner-ask-opened'&&event.op===nodeId&&event.ask==='ask-1'));
    const contract=renderContract({template,op:ask,state:after,store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Question for the owner\nAsked by `demo\.sales\.implementation\.backend\.intake` \(account\): Which e-invoicing provider sandbox account/);
    assert.match(contract,/## Credentials and configuration/);
    // The ask op reads the records and reports a DECISION: "where does the owner provide it" is a design
    // question - where a value lives - and the word "token" only chose the tab. The kernel takes the report by
    // its content, so the stop is LIFTED, the recommendation is taken provisionally, and the requester carries on.
    after=harness.run({maxIterations:4});
    assert.deepEqual(events(store).filter(event=>event.event==='ask-reclassified').map(event=>[event.ask,event.from,event.to]),
      [['ask-1','provision','decision']]);
    assert.equal(after.needUser.some(item=>item.kind==='decision'),false,'nothing is left for the owner to provide');
    assert.deepEqual((after.provisional??[]).map(entry=>[entry.decision,entry.op,entry.recommended,entry.options.length]),
      [['demo.sales.business.srs.decision.d-telegram-token','ask-1',1,2]]);
    assert.match(String(after.ops.find(op=>op.id===nodeId).answer),/^provisional: option 1 - the provider's own sandbox tenant/);
    // The owner answers through the inbox: the same option confirms what the runtime had already carried.
    queueInbox(store,{kind:'answer',op:'ask-1',choice:'1',note:'our own tenant, never a partner\'s'});
    after=harness.run({maxIterations:6});
    const resumed=after.ops.find(op=>op.id===nodeId);
    assert.equal(after.needUser.some(item=>item.kind==='decision'),false,'the question is gone');
    const log=events(store);
    assert.deepEqual(log.filter(event=>event.event==='owner-answered').map(event=>[event.ask,event.choice,event.requesters]),[['ask-1','1',[nodeId]]]);
    assert.deepEqual(log.filter(event=>event.event==='decision-confirmed').map(event=>event.decision),['demo.sales.business.srs.decision.d-telegram-token']);
    assert.ok(log.some(event=>event.event==='owner-answer-delivered'&&event.op===nodeId));
    assert.equal(resumed.status,'done','the requester finished on the ruling');
    assert.match(renderContract({template,op:{...resumed,answer:resumed.answer},state:after,store,launcher:'L.mjs',run:'run_wf'}),/## Answer to the question you asked earlier\n/);
  }finally{harness.cleanup();}
  // A mechanical question is the kernel's: the supervisor model answers it and no ask op exists.
  const mechanical=setupWork({dirty:[file],scripts:{[nodeId]:[{...question,question:{text:'Run the unit suite with vitest or jest?',options:['vitest','jest'],kind:'mechanical'}},{outcome:'done',summary:'Done.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(mechanical.store,mechanical.state);mechanical.state.run='run_wf';mechanical.state.from='term_kernel';
    const after=mechanical.run({maxIterations:6,decide:()=>({ok:true,value:{option:'answer',instructions:'vitest, as the repository already does',rationale:'tooling'}})});
    assert.equal(after.ops.some(op=>['decision.prepare','provision.ask'].includes(op.kind)),false);
    assert.ok(events(mechanical.store).some(event=>event.event==='decide'&&event.option==='answer'));
  }finally{mechanical.cleanup();}
});

/**
 * Two asks share the feature's policy-decisions folder because that is where every decision of the feature is
 * kept, and neither is authoring in it: each writes at most one NEW slug folder of its own, and the whole-tree
 * validator is what catches a duplicate. Serializing them bought nothing and cost an hour of the owner's day -
 * three credential tabs they never saw sat behind one decision draft that shared nothing with them. An op that
 * really does edit that folder still waits, because it edits what is there.
 */
test('an ask is never deferred for the decision folder another ask holds, and a work.author on that folder still is',()=>{
  const decisions='.starciwork/features/sales/business/srs/business-rules/policy-decisions/**';
  const harness=setupWork({allocator:fakeAllocator({maxParallelOps:6}),scripts:{}});
  try{
    const {store,state}=harness;
    const ready=(id,kind)=>({...state.ops[0],id,kind,status:'ready',allowlist:[decisions],dispatch:null,terminal:null,
      requesters:[],nodeId:null,ledgerIds:[],dependsOn:[],origin:'ask',
      question:{kind:kind==='provision.ask'?'credential':'decision',stop:kind==='provision.ask'?'credential':null,text:`the question of ${id}`,options:[]}});
    state.ops.push(ready('ask-a','decision.prepare'));
    state.ops.push(ready('ask-b','provision.ask'));
    state.ops.push({...ready('author-c','work.author'),origin:'ledger',question:null});
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    const after=harness.run({maxIterations:1});
    const deferred=events(store).filter(event=>event.event==='schedule-deferred'&&event.reason==='allowlist overlaps a running operation').map(event=>event.op);
    assert.deepEqual(deferred,['author-c'],'only the op that edits the folder waits for the ops holding it');
    const status=id=>after.ops.find(op=>op.id===id).status;
    assert.deepEqual([status('ask-a'),status('ask-b')],['running','running'],'both asks run: neither waits for the other');
    assert.equal(status('author-c'),'ready','the work.author is not launched and is not blocked either - it is simply next');
  }finally{harness.cleanup();}
});

test('an environment blocker that names a credential is the question of the owner, put by a provision.ask op, and credentialNeed reads the detail',()=>{
  assert.equal(credentialNeed('TELEGRAM_BOT_TOKEN is not set; the delivery worker reads it in delivery.module.ts'),true);
  assert.equal(credentialNeed('the Zalo OA api key the owner has not provided'),true);
  assert.equal(credentialNeed('docker is not installed on this host'),false);
  // A credential is one member of a class: whatever the runtime cannot obtain for itself stops the requester.
  assert.deepEqual(ownerProvisionNeed('the e-invoice provider sandbox account the owner must open'),{kind:'account'});
  assert.deepEqual(ownerProvisionNeed('no real bank statement to reconcile against'),{kind:'dataset'});
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[{outcome:'blocked',summary:'Cannot deliver without the bot token.',files:[],checks:[],blocker:{kind:'environment',detail:'TELEGRAM_BOT_TOKEN is not provided; apps/agentos-controlplane/src/chatbot/delivery.module.ts reads it at boot'}}]}});
  try{
    approve(harness.store,harness.state);harness.state.run='run_wf';harness.state.from='term_kernel';
    const after=harness.run({maxIterations:1});
    const ask=after.ops.find(op=>['decision.prepare','provision.ask'].includes(op.kind));
    assert.ok(ask,'the credential need became the question of the owner');
    assert.deepEqual([ask.question.kind,ask.question.from,ask.question.stop],['credential',nodeId,'credential']);
    assert.equal(after.ops.find(op=>op.id===nodeId).status,'paused');
    assert.equal(after.needUser.some(item=>item.kind==='environment'),false,'no bare environment line nobody answers');
  }finally{harness.cleanup();}
  // The second stop reason: an effect nobody can take back. The requester waits, exactly as for a credential.
  const undoable=setupWork({dirty:[file],scripts:{[nodeId]:[{outcome:'blocked',summary:'This would reach real people.',files:[],checks:[],blocker:{kind:'authority',detail:'completing the slice sends the overdue notice to real customers, which cannot be recalled'}}]}});
  try{
    approve(undoable.store,undoable.state);undoable.state.run='run_wf';undoable.state.from='term_kernel';
    const after=undoable.run({maxIterations:1});
    const ask=after.ops.find(op=>['decision.prepare','provision.ask'].includes(op.kind));
    assert.deepEqual([ask.question.kind,ask.question.stop],['irreversible','irreversible']);
    assert.equal(after.ops.find(op=>op.id===nodeId).status,'paused','only the owner performs an effect nobody can undo');
    assert.equal(irreversibleEffect('the run publishes the release to production'),true);
  }finally{undoable.cleanup();}
  // An `authority` block that names nothing the owner must provide is a decision, and the work carries on.
  const open=setupWork({dirty:[file],scripts:{[nodeId]:[{outcome:'blocked',summary:'Two rules are possible here.',files:[],checks:[],blocker:{kind:'authority',detail:'the design does not say whether a supervisor may approve their own request'}}]}});
  try{
    approve(open.store,open.state);open.state.run='run_wf';open.state.from='term_kernel';
    const after=open.run({maxIterations:1});
    const ask=after.ops.find(op=>['decision.prepare','provision.ask'].includes(op.kind));
    assert.deepEqual([ask.question.kind,ask.question.stop],['decision',null]);
    const requester=after.ops.find(op=>op.id===nodeId);
    assert.deepEqual([requester.status,requester.waitingFor,requester.dependsOn.includes(ask.id)],['pending',null,true]);
    assert.equal(after.needUser.some(item=>item.kind==='authority'),false);
  }finally{open.cleanup();}
});

test('kernel startup discovers existing credential waits before the first tick, repairs ungrounded asks, and owns the helper and page',()=>{
  const harness=setupWork({scope:['sales']});
  try{
    const {store,state}=harness;
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    harness.run({maxIterations:0});
    const requester=state.ops.find(op=>op.nodeId==='demo.sales.implementation.backend.intake');
    assert.ok(requester);
    const originalAttempt=requester.attempt,originalAllowlist=[...requester.allowlist];
    const ask=inputAsk('synthetic-existing-ask',['SERVICE_TOKEN'],{requesters:[requester.id]});
    requester.status='paused';requester.waitingFor=ask.id;requester.dependsOn.push(ask.id);state.ops.push(ask);
    const owner='demo.sales.architecture.sds.intake',file=harness.node(owner),record=parseYaml(fs.readFileSync(file,'utf8')),entry=preparedEntry();
    delete entry.preparation;record.extensions??={};record.extensions.work3??={};record.extensions.work3.integrations=[entry];fs.writeFileSync(file,stringifyYaml(record));
    const files=inputFiles(store.dir),browserCalls=[];let launches=0;
    const browser={verify:()=>({ok:true}),invoke:(name,params)=>{
      browserCalls.push({name,params});
      if(name==='tab-list')return {outcome:'ok',receipt:{result:{tabs:[]}}};
      if(name==='tab-create')return {outcome:'ok',effectState:'committed',receipt:{result:{browserPageId:'synthetic-input-page'}}};
      throw Error('Unexpected browser call '+name);
    }};
    let runtimeCtx=null;
    const options={maxIterations:0,refreshPreparation:(...args)=>{runtimeCtx=args[2];return refreshCredentialPreparation(...args);},deferPreparation:deferForIntegrationPreparation,
      reconcileInputs:(_orca,currentStore,currentState,ctx)=>reconcileWorkflowInputs(browser,currentStore,currentState,{...ctx,
        alive:pid=>pid===101,spawnProcess:()=>{launches++;const child=new EventEmitter();child.pid=101;child.unref=()=>{};return child;}})};
    harness.run(options);
    assert.equal(ask.credential.ready,false);assert.equal(credentialFields(state).fields.length,0);
    assert.equal(ask.inputMode,'gui');assert.equal(requester.status,'pending');
    assert.equal(requester.attempt,originalAttempt+1);
    const preparationAuthor=state.ops.find(op=>op.integrationPreparation?.owner===owner);
    assert.ok(preparationAuthor,'existing owning-record repair is admitted on startup');
    normalizePreparationAuthority(store,state,preparationAuthor,runtimeCtx);
    assert.equal(preparationAuthor.nodeId,owner);
    assert.deepEqual(preparationAuthor.allowlist,['.starciwork/features/sales/architecture/sds/intake/index.yaml'],
      'the preparation author can write only its owning declaration');
    assert.deepEqual(requester.allowlist,originalAllowlist,'requester authority is preserved');
    assert.equal(launches,1);assert.equal(state.ownerInputs.phase,'starting');
    const session=JSON.parse(fs.readFileSync(files.session,'utf8'));
    assert.equal(session.binding.workRoot,path.join(harness.repo,'.starciwork'));
    privateJson(files.lock,{pid:101,session:session.id});privateJson(files.server,{pid:101,session:session.id,port:32123});
    harness.run(options);
    assert.equal(launches,1);assert.equal(state.ownerInputs.page,'synthetic-input-page');
    assert.equal(browserCalls.filter(call=>call.name==='tab-create').length,1);
    assert.equal(browserCalls.find(call=>call.name==='tab-create').params.worktree,`path:${state.worktree.replaceAll('\\','/')}`);
    assert.equal(state.approved,true);assert.equal(state.iterations,0,'startup did not need a scheduling tick or model launch');

    // A reused author from an older workflow is repaired before it can be admitted again; read-only references
    // do not broaden its write authority.
    preparationAuthor.nodeId=null;preparationAuthor.allowlist=['.starciwork/features'];harness.store.saveState(state);
    normalizePreparationAuthority(store,state,preparationAuthor,runtimeCtx);
    assert.equal(preparationAuthor.nodeId,owner);
    assert.deepEqual(preparationAuthor.allowlist,['.starciwork/features/sales/architecture/sds/intake/index.yaml']);
    assert.ok(events(store).some(event=>event.event==='integration-preparation-authority-refreshed'&&event.op===preparationAuthor.id));
  }finally{harness.cleanup();}
});

/**
 * The owner's ruling of 2026-09-14, as the kernel keeps it. A credential used to be asked for by an agent in a
 * terminal tab: it printed a wall of text with a command for the owner to compose and then polled them for the
 * word `set`, and the owner looked at that tab and asked whether it was even asking them anything. So no agent
 * is launched for a credential at all. The kernel prints ONE line - the variables, the custody, the exact
 * command - the owner runs it and answers its prompts, and the kernel settles the ask itself by PRESENCE.
 */
test('a credential provision is never launched: the kernel prints one command, waits without a deadline, and settles the ask itself when the custody holds every variable',()=>{
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const blocked={outcome:'blocked',summary:'Cannot deliver without the bot credentials.',files:[],checks:[],
    blocker:{kind:'environment',detail:'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not provided; their custody identity:chatbot-telegram is declared and delivery.module.ts reads them at boot'}};
  const done={outcome:'done',summary:'Intake implemented against the provided credentials.',files:[file],
    checks:[passing('unit-tests-pass','npx vitest run intake')]};
  const VARIABLES=['TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID'];
  /** sops is not in a unit test; presence is the one thing it answers, so that answer is the seam. */
  const custody=harness=>path.join(harness.repo,'.starciwork','_resources','identity','chatbot-telegram','secrets.enc.yaml');
  const fillIn=harness=>{fs.mkdirSync(path.dirname(custody(harness)),{recursive:true});
    fs.writeFileSync(custody(harness),'# sops-encrypted\n');};
  const holds=names=>({name})=>names.includes(name)?{ok:true}:{ok:false,reason:`identity:chatbot-telegram does not hold ${name}`};

  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[blocked,done]}});
  try{
    const {store,state}=harness;
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    let after=harness.run({maxIterations:3,verifyPresence:holds([])});
    const ask=after.ops.find(op=>op.kind==='provision.ask');
    assert.ok(ask,'the credential need is still the owner\'s question');
    // This legacy presence test injects researched synthetic requirements; the startup test above exercises admission itself.
    Object.assign(ask.credential,inputAsk('synthetic-prepared',VARIABLES,{slug:'chatbot-telegram'}).credential);
    // Waiting, and waiting for nothing that runs: no dispatch, no runtime, no terminal, no launch deadline.
    assert.deepEqual([ask.status,ask.fill,ask.dispatch,ask.terminal,ask.runtime,ask.launchedAt],
      ['running',true,null,null,null,null]);
    assert.equal(after.ops.find(op=>op.id===nodeId).status,'paused','the requester waits for the owner, not for an agent');
    const log=events(store);
    const waiting=log.filter(event=>event.event==='provision-fill-waiting');
    assert.equal(waiting.length,1,'the owner is told once, not once per iteration');
    assert.deepEqual([waiting[0].ask,waiting[0].variables,waiting[0].custody],[ask.id,VARIABLES,'identity:chatbot-telegram']);
    // The exact command, with the tree it fills: the owner copies this line and nothing else.
    assert.equal(waiting[0].command,ask.fillCommand);
    assert.match(ask.fillCommand,/^node .*bin\/starci\.mjs identity fill chatbot-telegram --name TELEGRAM_BOT_TOKEN --name TELEGRAM_CHAT_ID --work-root .*\.starciwork$/);
    assert.equal(log.some(event=>event.event==='launched'&&event.op===ask.id),false,'no runtime is ever asked to ask the owner');
    assert.equal(log.some(event=>event.event==='allocation-deferred'&&event.op===ask.id),false,'and it holds no slot while it waits');
    // The same line is what every page of this workflow shows.
    assert.deepEqual(ownerFillLines(after),[`## Owner (1)`,`- ${askFillLine(ask)}`]);
    assert.match(askFillLine(ask),/Credentials page in Orca/);
    assert.doesNotMatch(askFillLine(ask),/copy and run/);
    assert.match(askFillLine({...ask,inputMode:'cli'}),/^Fill TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID for identity:chatbot-telegram: copy and run  node /);
    // An op waiting for the owner is never a stall and never an overrun: it waits as long as the owner takes.
    ask.launchedAt=1;
    settleStalled(harness.fake.orca,store,after,{allocator:harness.allocator,now:()=>Date.now(),wait:noWait},
      {liveness:[{dispatch:null,liveness:'dead'},{dispatch:ask.dispatch,liveness:'stalled-idle'}]});
    assert.deepEqual([ask.status,ask.restarts],['running',0]);
    assert.equal(events(store).some(event=>['op-overrun','settled'].includes(event.event)&&event.op===ask.id),false);
    ask.launchedAt=null;
    // The owner runs the command: the custody holds both variables, and the kernel sees it at the next tick.
    fillIn(harness);
    after=harness.run({maxIterations:8,verifyPresence:holds(VARIABLES)});
    const settled=events(store).filter(event=>event.event==='provision-filled');
    assert.deepEqual(settled.map(event=>[event.ask,event.variables,event.custody,event.via]),
      [[ask.id,VARIABLES,'identity:chatbot-telegram','fill']]);
    assert.deepEqual(events(store).filter(event=>event.event==='credential-present').map(event=>event.provided),
      VARIABLES.map(name=>`${name} in identity:chatbot-telegram`));
    assert.deepEqual([after.ops.find(op=>op.id===ask.id).status,after.ops.find(op=>op.id===nodeId).status],['done','done']);
    assert.match(String(after.ops.find(op=>op.id===nodeId).answer),/The owner provided TELEGRAM_CHAT_ID in identity:chatbot-telegram/);
    assert.equal(ownerFillLines(after).length,0,'nothing is owed once the custody holds it');
  }finally{harness.cleanup();}

  // `workflow-answer --note set` is the same ruling by the other door: it runs the same presence check, and a
  // credential nobody filled in is a refusal that names what is missing - never a `done` taken on the word.
  const byCommand=setupWork({dirty:[file],scripts:{[nodeId]:[blocked,done]}});
  try{
    const {store,state}=byCommand;
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    let after=byCommand.run({maxIterations:3,verifyPresence:holds([])});
    const ask=after.ops.find(op=>op.kind==='provision.ask');
    queueInbox(store,{kind:'answer',op:ask.id,note:'set'});
    after=byCommand.run({maxIterations:1,verifyPresence:holds([])});
    const refused=events(store).find(event=>event.event==='inbox-rejected'&&event.kind==='answer');
    assert.match(refused.reason,/TELEGRAM_BOT_TOKEN: identity:chatbot-telegram does not hold TELEGRAM_BOT_TOKEN/);
    assert.match(refused.reason,/identity fill chatbot-telegram --name/);
    assert.equal(after.ops.find(op=>op.id===ask.id).status,'running','a word is not a credential');
    fillIn(byCommand);
    queueInbox(store,{kind:'answer',op:ask.id,note:'set'});
    after=byCommand.run({maxIterations:8,verifyPresence:holds(VARIABLES)});
    assert.deepEqual(events(store).filter(event=>event.event==='provision-filled').map(event=>event.via),['command']);
    assert.deepEqual([after.ops.find(op=>op.id===ask.id).status,after.ops.find(op=>op.id===nodeId).status],['done','done']);
  }finally{byCommand.cleanup();}
});

// The first owner questions were written under `features/shared/` and `features/workspace/` - folders that do
// not exist, because the id segment is not a path - and the whole tree went red. The feature FOLDER is read
// from the node's own path, and the decision is an SRS policy-decision leaf where the tree keeps them.
test('the decision folder of an owner question comes from the feature folder in the tree, never from the id segment',()=>{
  const ctx={work:{node:id=>id==='nivo.shared.implementation.backend.platform-isolation'
    ?{path:'features/shared-lifecycle/implementation/backend/platform-isolation/index.yaml'}:null,loaded:{list:[]}}};
  assert.deepEqual(decisionAllowlistFor({},{nodeId:'nivo.shared.implementation.backend.platform-isolation',ledgerIds:[],allowlist:['src/x/**']},ctx),
    ['.starciwork/features/shared-lifecycle/business/srs/business-rules/policy-decisions/**']);
  assert.deepEqual(decisionAllowlistFor({},{nodeId:null,ledgerIds:[],allowlist:['C:/owner/.starciwork/features/workspace-dashboard/ui/**']},ctx),
    ['.starciwork/features/workspace-dashboard/business/srs/business-rules/policy-decisions/**']);
  assert.deepEqual(decisionAllowlistFor({},{nodeId:null,ledgerIds:[],allowlist:['apps/x/**']},ctx),
    ['.starciwork/decisions/**'],'no feature known: the tree-level folder');
});

test('the kernel operation deadline reaches the host through the allocated launcher',()=>{
  const plan=structuredClone(salesPlan);plan.ops[0].timeoutMs=47*60*1000;
  const harness=setup({plan,scripts:{},allocator:fakeAllocator({pools:{implement:['claude-agent']}})});
  try{
    approve(harness.store,harness.state);harness.state.run='run_wf';harness.state.from='term_kernel';
    const received=[];
    harness.run({maxIterations:1,launch:(orca,args)=>launchWithCandidate(orca,{...args,
      build:()=>({candidates:[{selection:args.candidate}]}),
      start:input=>{received.push(input.timeoutMs);return {ok:true,selection:args.candidate,
        task:{id:'task_deadline'},dispatchId:'ctx_deadline',terminal:{handle:'term_deadline'},attempts:[]};}
    })});
    assert.deepEqual(received,[47*60*1000]);
  }finally{harness.cleanup();}
});

test('a launch Orca refuses because the coordinator pane is gone replaces the kernel tab, re-binds the Run and tries again without counting a runtime failure',()=>{
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[{outcome:'done',summary:'Intake implemented.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    const {store,state}=harness;
    approve(store,state);state.run='run_wf';state.from='term_dead';state.kernelTerminalOwned=true;
    let refused=0;
    const launch=(orca,params)=>{
      if(refused===0){refused+=1;return {ok:false,stopReason:'Operation Task creation failed (none): The coordinator terminal has no stable pane identity.',attempts:[{target:'gpt-5.6-sol',stage:'task-create',effectState:'none',reason:'no stable pane identity'}]};}
      return launchWithCandidate(orca,params);
    };
    const after=harness.run({maxIterations:6,launch});
    const op=after.ops.find(item=>item.id===nodeId);
    assert.equal(op.status,'done','the op launched on the second try and finished');
    assert.equal(op.launchFailures,0,'a lost pane is not a launch failure of the runtime');
    assert.notEqual(after.from,'term_dead');
    assert.ok(after.from,'the kernel has a tab again');
    const log=events(store);
    assert.deepEqual(log.filter(event=>event.event==='coordinator-tab-recovered').map(event=>[event.was,event.terminal===after.from]),[['term_dead',true]]);
    assert.equal(log.some(event=>event.event==='launch-failed'),false);
  }finally{harness.cleanup();}
});

test('a contract longer than a task can carry is handed over as its head plus the file it lives in',()=>{
  const short='## Goal\nshort';
  assert.equal(operationSpec({contractFile:'D:/w/contracts/op.md'},short),short);
  const long=`## Goal\n${'x'.repeat(SPEC_LIMIT+5000)}\n## Never\nthe tail rule`;
  const spec=operationSpec({contractFile:'D:\\w\\contracts\\gate-1.md'},long);
  assert.ok(spec.length<SPEC_LIMIT,'the spec fits a command line');
  assert.ok(spec.startsWith('## Goal\nxxx'),'the head of the contract is kept');
  assert.match(spec,/COMPLETE contract .* is in the file `D:\/w\/contracts\/gate-1\.md`/);
  assert.match(spec,/longer than a task can carry \(\d+ characters\)/);
});

test('on the Work ledger the goal is derived from the authored nodes, and a node without checks is named as needing the user',()=>{
  const asked=[];
  const harness=setupWork({assessGoal:payload=>{asked.push(payload);return {ok:true,provider:'fake',value:{definitionOfDone:['order intake persists an order'],risks:['the receipt is not in scope'],questions:[]}};}});
  try{
    assert.equal(harness.goal.ok,true);
    assert.equal(harness.goal.ledgerMode,'work');
    assert.equal(harness.state.phase,'awaiting-approval');
    // Exactly one schedulable node became an op; everything about it comes from the node, nothing invented.
    assert.deepEqual(harness.state.ops.map(op=>[op.id,op.kind,op.nodeId]),
      [['demo.sales.implementation.backend.intake','backend.implement','demo.sales.implementation.backend.intake']]);
    const op=harness.state.ops[0];
    assert.equal(op.goal,'Implement order intake against the accepted SDS.');
    assert.deepEqual(op.allowlist,['apps/agentos-controlplane/src/sales/intake.ts']);
    assert.deepEqual(op.checks,[{name:'unit-tests-pass',command:'npx vitest run intake'}]);
    assert.deepEqual(op.acceptance,['unit-tests-pass','work-valid']);
    assert.deepEqual(op.references,['features/sales/implementation/backend/intake/index.yaml']);
    assert.equal(op.origin,'ledger');
    // The contract of a ledger implementation op carries the implement.ledger working order, interpolated
    // from the node's own check command and assertion id, between the acceptance and the process prose.
    const contract=renderContract({template,op,state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Working order \(mandatory, in this order\)\nSequence `implement\.ledger`\./);
    assert.match(contract,/1\. Read `features\/sales\/implementation\/backend\/intake\/index\.yaml` and the node assertions \(`unit-tests-pass`, `work-valid`\)/);
    assert.match(contract,/2\. Write or extend the spec\(s\)[^\n]*they MUST fail now/);
    assert.match(contract,/4\. Run every listed check verbatim: unit-tests-pass: `npx vitest run intake`\./);
    assert.match(contract,/## Definition of done for this kind\n- every assertion \(`unit-tests-pass`, `work-valid`\)/);
    assert.ok(contract.indexOf('## Acceptance')<contract.indexOf('## Working order')&&contract.indexOf('## Working order')<contract.indexOf('## Cook until done'));
    assert.doesNotMatch(contract,/Implement, run every check, read the failures/,'the template no longer repeats the working order');
    // The model was asked for the definition of done only: it never saw an operation form to fill.
    assert.equal(asked.length,1);
    assert.ok(Array.isArray(asked[0].ledger)&&asked[0].ledger.length===1);
    assert.equal(asked[0].material,undefined,'the ledger replaces the material: no file text is shipped to the model');
    assert.equal(asked[0].ops,undefined,'no operation form is asked for');
    assert.ok(asked[0].constraints.some(item=>/is not yours to change/.test(item)));
    assert.deepEqual(asked[0].ledger.map(item=>item.id),['demo.sales.implementation.backend.intake']);
    assert.deepEqual(harness.state.definitionOfDone,['order intake persists an order']);
    // The unchecked node is not guessed at: it is ledger-incomplete and waits for the user.
    assert.deepEqual(harness.state.needUser,[{node:'demo.sales.implementation.frontend.receipt',kind:'ledger',
      detail:'ledger incomplete: Node demo.sales.implementation.frontend.receipt declares no extensions.work3.checks; the kernel cannot launch it'}]);
    assert.deepEqual(harness.goal.incomplete,['demo.sales.implementation.frontend.receipt']);
    // A decision in scope is listed, never launched into a worktree.
    assert.deepEqual(harness.state.decisions.map(item=>[item.id,item.operation]),[['demo.payments.business.overview','business.decide']]);
    // The lane is part of what the user approves: the node's template, per node, in goal.md.
    assert.deepEqual(harness.state.lanes['demo.sales.implementation.backend.intake'],
      {lane:['backend.implement','e2e.verify','security.verify','perf.verify','review.verify'],done:[],checks:[],head:null});
    const markdown=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(markdown,/## Work nodes this workflow executes/);
    assert.match(markdown,/backend\.implement.*e2e\.verify.*security\.verify.*perf\.verify.*review\.verify \(this op: step 1 of 5\)/);
    assert.match(markdown,/`demo\.sales\.implementation\.backend\.intake`/);
    assert.match(markdown,/## Decisions still open in scope/);
    assert.match(markdown,/## Needs you first/);
    assert.match(markdown,/ledger incomplete/);
    const recorded=JSON.parse(fs.readFileSync(harness.store.paths.goalJson,'utf8'));
    assert.equal(recorded.ledgerMode,'work');
    assert.equal(recorded.ledgerSummary.total,4);
    assert.deepEqual(recorded.ledgerSummary.executableEligible,['demo.sales.implementation.backend.intake','demo.sales.implementation.frontend.receipt']);
    // Nothing was written into the Work tree by the goal phase.
    assert.equal(harness.read('demo.sales.implementation.backend.intake').state,'todo');
    assert.equal(harness.read('demo.sales.implementation.backend.intake').extensions.work3.kernel,undefined);
    assert.equal(workOpId('demo.sales:intake'),'demo.sales-intake');
    assert.equal(workModule(WORK_NODES[1]),'features/sales');
    assert.equal(detectLedgerMode(harness.repo),'work');
    assert.equal(detectLedgerMode(path.join(harness.repo,'nowhere')),'plan');
    assert.throws(()=>detectLedgerMode(harness.repo,'invented'),/Unsupported ledger mode/);
  }finally{harness.cleanup();}
  // Scope narrows the tree: only the payments decision is in scope, and no op is derived.
  const scoped=setupWork({scope:['payments']});
  try{
    assert.deepEqual(scoped.state.ops,[]);
    assert.deepEqual(scoped.state.decisions.map(item=>item.id),['demo.payments.business.overview']);
    assert.deepEqual(scoped.state.ledgerSummary.executableEligible,[]);
  }finally{scoped.cleanup();}
});

test('an accepted slice is written back into its Work node: in-progress, done, evidence and a Work commit trailer',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setupWork({dirty:[file],
    scripts:{'demo.sales.implementation.backend.intake':[{outcome:'done',summary:'Intake implemented.',files:[file],
      checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      [`${'demo.sales.implementation.backend.intake'}-verify`]:[{outcome:'done',summary:'The intake scenarios pass through the API on the real stack.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      ...receiptAuthor()}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    // The validator is told which assertions are not this op's to prove: the kernel-owned work-valid, and the ones
    // a later lane step (e2e, review) carries; it must never reject the op for those.
    const seen=[];
    const capture=input=>{seen.push({op:input.op.id,assertions:input.node?.assertions??null,deferred:input.node?.deferred??null});return acceptAll();};
    const state=harness.run({validateOp:capture});
    const judged=seen.find(item=>item.op==='demo.sales.implementation.backend.intake');
    assert.deepEqual(judged.assertions,['unit-tests-pass']);
    assert.deepEqual(judged.deferred,['work-valid']);

    const node=harness.read('demo.sales.implementation.backend.intake');
    assert.equal(node.state,'done');
    assert.equal(node.completion.inputDigest,DIGEST('f'));
    // The last step of the lane writes the completion, so the evidence record is named after the review.
    assert.deepEqual(node.completion.evidence,['verify-1-evidence']);
    // The kernel-owned assertion is stripped from every op and proven by the kernel itself when it records the node.
    assert.deepEqual(node.extensions.work3.kernel.checks.filter(check=>check.assertion==='work-valid').map(check=>check.exitCode),[0],'the kernel proved work-valid by validating the tree');
    // No lane op ever carries the kernel-owned check. The one exception is the record-authoring op, whose
    // whole check IS the whole-tree validator - and the kernel runs that one itself before it accepts the record.
    assert.deepEqual(state.ops.filter(op=>(op.checks??[]).some(check=>/work-valid/.test(check.name??''))).map(op=>op.kind),['work.author']);
    assert.equal(node.extensions.work3.kernel.verifiedBy,'starci-kernel');
    assert.deepEqual(node.extensions.work3.kernel.checks.map(check=>[check.assertion,check.exitCode]),[['unit-tests-pass',0],['work-valid',0]]);
    // The authored checks survive the write; the kernel owns only state, completion and its own block.
    assert.deepEqual(node.extensions.work3.checks.map(check=>check.command),['npx vitest run intake','node starci.mjs validate .starciwork']);
    assert.equal(node.description,'Implement order intake against the accepted SDS.');
    const manifest=parseYaml(fs.readFileSync(path.join(path.dirname(harness.node('demo.sales.implementation.backend.intake')),
      'evidence','verify-1-evidence','manifest.yaml'),'utf8'));
    assert.equal(manifest.schema,'work/evidence@1');
    assert.equal(manifest.nodeId,'demo.sales.implementation.backend.intake');
    assert.equal(manifest.outcome,'pass');
    assert.equal(manifest.provenance.actor,'starci-kernel');
    // The commit names the node it closes.
    assert.match(harness.commits[0],/^feat\(demo\.sales\.implementation\.backend\.intake\): Implement order intake/);
    assert.match(harness.commits[0],/\nWork: demo\.sales\.implementation\.backend\.intake$/);
    const events=harness.store.readEvents();
    // The backend lane is build then review: the node is `in-progress` until the review is accepted.
    // Five launches write `in-progress`: three lane steps of the intake node, and the author op of the receipt node.
    assert.deepEqual(events.filter(event=>event.event==='ledger-write').map(event=>event.step),['in-progress','in-progress','in-progress','in-progress','in-progress','done']);
    assert.equal(events.find(event=>event.event==='ledger-write'&&event.step==='done').op,'verify-1');
    assert.deepEqual(state.lanes['demo.sales.implementation.backend.intake'].lane,['backend.implement','e2e.verify','security.verify','perf.verify','review.verify']);
    assert.deepEqual(state.lanes['demo.sales.implementation.backend.intake'].done,['backend.implement','e2e.verify','review.verify']);
    assert.deepEqual(events.filter(event=>event.event==='lane-step').map(event=>[event.kind,event.step,event.next]),
      [['backend.implement','1/3','e2e.verify'],['e2e.verify','2/3','review.verify'],['review.verify','3/3',null]]);
    assert.equal(events.find(event=>event.event==='ledger-loaded').valid,true);
    // One review per module, on a runtime that did not implement it.
    const verify=state.ops.find(item=>item.kind==='review.verify');
    assert.equal(verify.id,'verify-1');
    assert.equal(verify.nodeId,null);
    assert.notEqual(verify.runtime,state.ops[0].runtime);
    assert.equal(state.verifyRounds['demo.sales.implementation.backend.intake'],1,'rounds are counted per reviewed node set, not per feature');
    assert.deepEqual(state.ledger.map(item=>[item.module,item.status]),[['features/sales','verified']]);
    assert.equal(state.finished.outcome,'blocked','the frontend node has not finished authoring its record');
    // The ledger-incomplete frontend node became one `work.author` op on its own record, and nothing else of it.
    const author=state.ops.find(item=>item.kind==='work.author');
    assert.equal(author.id,'demo.sales.implementation.frontend.receipt-author');
    assert.deepEqual(author.allowlist,['.starciwork/features/sales/implementation/frontend/receipt/index.yaml']);
    assert.deepEqual(author.ledgerIds,[],'the node enters the workflow ledger when its own lane starts, not when its record is written');
    assert.equal(harness.read('demo.sales.implementation.frontend.receipt').state,'todo','authoring a record never completes the node');
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.ledgerMode,'work');
    assert.equal(final.ledgerSummary.total,4);
    assert.deepEqual(final.decisions.map(item=>item.id),['demo.payments.business.overview']);
    assert.deepEqual(final.ops.map(op=>[op.id,op.node]),[['demo.sales.implementation.backend.intake','demo.sales.implementation.backend.intake'],['demo.sales.implementation.frontend.receipt-author','demo.sales.implementation.frontend.receipt'],['demo.sales.implementation.backend.intake-verify','demo.sales.implementation.backend.intake'],['verify-1',null]]);
  }finally{harness.cleanup();}
});

test('a reported SDS gap routes to architecture.revise on the architecture node and reopens the requester',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const design='.starciwork/features/sales/architecture/sds/intake/index.yaml';
  const harness=setupWork({dirty:[file,design],
    scripts:{'demo.sales.implementation.backend.intake':[
      {outcome:'blocked',summary:'The SDS does not say how a partial order is persisted.',files:[],checks:[],
        blocker:{kind:'sds-gap',detail:'features/sales/architecture/sds/intake/index.yaml does not map the partial-order case'}},
      {outcome:'done',summary:'Intake implemented against the settled design.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'architecture-1':[{outcome:'done',summary:'The partial-order case is now mapped.',files:[design],
        checks:[passing('work-tree-validates','starci validate')]}],
      [`${'demo.sales.implementation.backend.intake'}-verify`]:[{outcome:'done',summary:'The intake scenarios pass through the API on the real stack.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      ...receiptAuthor()}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    const gap=harness.store.readEvents().find(event=>event.event==='sds-gap');
    assert.equal(gap.architecture,'demo.sales.architecture.sds.intake');
    assert.equal(gap.decide,'architecture-1');
    const decide=state.ops.find(item=>item.id==='architecture-1');
    // The route names the kind: a gap in an accepted design is revised, not decided from scratch.
    assert.equal(decide.kind,'architecture.revise');
    assert.equal(decide.nodeId,'demo.sales.architecture.sds.intake');
    assert.deepEqual(decide.allowlist,[design,'.starciwork/features/sales/architecture/sds/intake/**']);
    assert.equal(decide.status,'done');
    // Every route application names itself in the log.
    const route=harness.store.readEvents().find(event=>event.event==='routed'&&event.on==='sds-gap');
    assert.deepEqual([route.op,route.to,route.origin,route.kind,route.then],
      ['demo.sales.implementation.backend.intake','architecture-1','architecture','architecture.revise','reopen']);
    // The implementation waited for the decision before it ran again.
    const implement=state.ops.find(item=>item.id==='demo.sales.implementation.backend.intake');
    assert.ok(implement.dependsOn.includes('architecture-1'));
    assert.equal(implement.status,'done');
    assert.ok(harness.store.readEvents().some(event=>event.event==='op-reopened'&&event.op===implement.id&&event.waitingFor==='architecture-1'));
    const architecture=harness.read('demo.sales.architecture.sds.intake');
    // A revision bumps the rev of the design it rewrote.
    assert.equal(architecture.extensions.work3.kernel.rev,1);
    // Reopened, then decided again by a collocated review: the kernel never fakes an execution receipt here.
    assert.equal(architecture.state,'done');
    assert.equal(architecture.extensions.work3.kernel.reopened.length,1);
    assert.match(architecture.extensions.work3.kernel.reopened[0].reason,/reported an SDS gap/);
    assert.equal(architecture.completion.review.schema,'starci/design-review@1');
    assert.deepEqual(architecture.completion.review.observations.map(item=>item.id),['architecture-quality']);
    assert.equal(architecture.completion.inputDigest,DIGEST('f'));
    const steps=harness.store.readEvents().filter(event=>event.event==='ledger-write').map(event=>event.step);
    // The backend node stays in-progress through its build step; only the review step writes `done`.
    assert.deepEqual(steps,['in-progress','in-progress','reopened','in-progress','decided','in-progress','in-progress','in-progress','in-progress','done']);
  }finally{harness.cleanup();}
});

/**
 * The owner's ruling of 2026-09-14, on the tree. A requirement the SRS does not settle is not a reason to stop
 * and not a design question either: the business node that owns the record is reopened, the requirement is
 * revised towards its most reasonable reading with the reason in its decision log, its `rev` is bumped, and the
 * operation that could not derive its work from it reads the settled record behind it.
 */
const SALES_SRS=`schema: work/node@2
id: demo.sales.business.srs.intake
kind: business
required: true
state: done
description: What order intake must do.
`;
const SALES_BUSINESS={id:'demo.sales.business.srs.intake',path:'features/sales/business/srs/intake/index.yaml',
  kind:'business',state:'done',eligible:false,inputDigest:DIGEST('s'),dependsOn:[],refs:[],blockedBy:[],children:[],
  completion:{inputDigest:DIGEST('s')},authored:SALES_SRS};

test('a reported requirement gap routes to business.revise on the business node, reopens the requester and bumps the rev',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const requirement='.starciwork/features/sales/business/srs/intake/index.yaml';
  const harness=setupWork({nodes:[...WORK_NODES,SALES_BUSINESS],dirty:[file,requirement],
    scripts:{'demo.sales.implementation.backend.intake':[
      {outcome:'blocked',summary:'The SRS says both that a partial order is billable and that it is not.',files:[],checks:[],
        blocker:{kind:'srs-gap',detail:'features/sales/business/srs/intake/index.yaml does not settle whether a partial order is billable'}},
      {outcome:'done',summary:'Intake implemented against the settled requirement.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'business-1':[{outcome:'done',summary:'rev 1: a partial order is billable for the fulfilled lines only.',files:[requirement],
        checks:[passing('work-tree-validates','starci validate')]}],
      [`${'demo.sales.implementation.backend.intake'}-verify`]:[{outcome:'done',summary:'The intake scenarios pass through the API on the real stack.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      ...receiptAuthor()}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    const gap=harness.store.readEvents().find(event=>event.event==='srs-gap');
    assert.equal(gap.business,'demo.sales.business.srs.intake');
    assert.equal(gap.revise,'business-1');
    const revise=state.ops.find(item=>item.id==='business-1');
    // The route names the kind and the origin: a requirement gap is a requirement repair, never a design one.
    assert.equal(revise.kind,'business.revise');
    assert.equal(revise.origin,'business');
    assert.equal(revise.nodeId,'demo.sales.business.srs.intake');
    assert.deepEqual(revise.allowlist,[requirement,'.starciwork/features/sales/business/srs/intake/**']);
    assert.match(revise.goal,/State the readings the record admits/);
    assert.match(revise.goal,/say why in the decision log and bump its rev/);
    assert.equal(revise.status,'done');
    const route=harness.store.readEvents().find(event=>event.event==='routed'&&event.on==='srs-gap');
    assert.deepEqual([route.op,route.to,route.origin,route.kind,route.then],
      ['demo.sales.implementation.backend.intake','business-1','business','business.revise','reopen']);
    // The implementation waited for the revision, then read the settled requirement.
    const implement=state.ops.find(item=>item.id==='demo.sales.implementation.backend.intake');
    assert.ok(implement.dependsOn.includes('business-1'));
    assert.equal(implement.status,'done');
    assert.ok(harness.store.readEvents().some(event=>event.event==='op-reopened'&&event.op===implement.id&&event.waitingFor==='business-1'));
    // Accepting the revision settles the node as a decision WITH a bumped rev: a reopened requirement is not
    // read as the first one, and everything built on the old reading is bound to the rev it was built under.
    const business=harness.read('demo.sales.business.srs.intake');
    assert.equal(business.extensions.work3.kernel.rev,1);
    assert.equal(business.state,'done');
    assert.equal(business.extensions.work3.kernel.reopened.length,1);
    assert.match(business.extensions.work3.kernel.reopened[0].reason,/reported a requirement gap/);
    assert.equal(business.completion.review.schema,'starci/design-review@1');
    // A kernel-origin repair counts against nothing: the owner approved the goal, not this repair.
    assert.equal(state.ops.filter(item=>item.refusal==='dynamic-op').length,0);
  }finally{harness.cleanup();}
});

/**
 * The other half of the same ruling, one phase earlier. A hidden decision the critic marked decisive is the
 * owner's and is prepared before any operation of its feature runs; one it marked non-decisive costs nobody a
 * question here at all, because the record repair settles it towards the most reasonable reading when an
 * operation actually hits it.
 */
test('a decisive hidden decision is planned as an owner question before the work of its feature; a non-decisive one is not',()=>{
  const objections=[
    {kind:'hidden-decision',claim:'The goal decides that a support agent may refund an order',
      evidence:'features/sales/business/srs/intake/index.yaml',consequence:'Money leaves without a manager.',decisive:true},
    {kind:'hidden-decision',claim:'The goal names the receipt column "total_vat"',
      evidence:'features/sales/architecture/sds/intake/index.yaml',consequence:'Two spellings of one column.',decisive:false}];
  const harness=setupWork({nodes:[...WORK_NODES,SALES_BUSINESS],
    critiqueGoal:critique({verdict:'revise',objections,required:['name who may refund an order']})});
  try{
    const state=harness.state,events=harness.store.readEvents();
    const ask=state.ops.find(op=>['decision.prepare','provision.ask'].includes(op.kind));
    assert.ok(ask,'the decisive hidden decision became one owner question');
    assert.equal(ask.question.kind,'decision','the provisional kind: the ask writes a decision record and the work goes on');
    assert.match(ask.question.text,/a support agent may refund an order/);
    assert.match(ask.question.text,/Money leaves without a manager/);
    // Exactly one: the non-decisive objection is deferred to the record repair, not asked about.
    assert.equal(state.ops.filter(op=>['decision.prepare','provision.ask'].includes(op.kind)).length,1);
    const planned=events.filter(event=>event.event==='decision-planned');
    assert.equal(planned.length,1);
    assert.equal(planned[0].op,ask.id);
    assert.equal(planned[0].feature,'sales');
    assert.ok(events.some(event=>event.event==='hidden-decision-deferred'&&/total_vat/.test(event.claim)));
    // It stands in front of every operation of its feature: the question is prepared before the work, not after.
    const sales=state.ops.filter(op=>op.id!==ask.id&&/\.sales\./.test(op.id));
    assert.ok(sales.length,JSON.stringify(state.ops.map(op=>op.id)));
    for(const op of sales)assert.ok(op.dependsOn.includes(ask.id)||op.waitingFor===ask.id,op.id);
    assert.deepEqual(planned[0].ops,sales.map(op=>op.id));
    // And the owner reads on the goal page what each hidden decision costs them.
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(page,/This one moves money, authority or customer data, so it is put to you before the work of its feature starts/);
    assert.match(page,/the runtime settles it towards the most reasonable reading when an operation hits it/);
  }finally{harness.cleanup();}
  // A decisive decision about a feature no operation of this goal touches is reported, never turned into a
  // question nobody is waiting for: the kernel does not invent work for a feature it is not doing.
  const elsewhere=setupWork({nodes:[...WORK_NODES,SALES_BUSINESS],
    critiqueGoal:critique({verdict:'revise',required:['name who may refund'],objections:[{kind:'hidden-decision',
      claim:'The goal decides who may read a stored card',evidence:'features/billing/business/srs/cards/index.yaml',
      consequence:'Customer data is shown to more people.',decisive:true}]})});
  try{
    assert.equal(elsewhere.state.ops.some(op=>['decision.prepare','provision.ask'].includes(op.kind)),false);
    const unplanned=elsewhere.store.readEvents().find(event=>event.event==='decision-unplanned');
    assert.equal(unplanned.feature,'billing');
    assert.match(unplanned.reason,/no operation of this goal touches it/);
  }finally{elsewhere.cleanup();}
});

/* ------------------------------------------------------------------ lanes and routes */

const CART='demo.sales.implementation.frontend.cart';
const cartFile='apps/web/src/cart/index.tsx';
const CART_CAPTURE='.starciwork/features/sales/implementation/frontend/cart/assets/cart-resting.png';
const CART_MARKUP='.starciwork/features/sales/implementation/frontend/cart/assets/cart-resting.html';
const captureCart=()=>{
  const colour=brandColours({color:{tokens:[{token:'--brand-accent',value:'oklch(0.72 0.15 35)',role:'primary'}]}})[0].hex;
  const capture=path.join(activeRepo,CART_CAPTURE),markup=path.join(activeRepo,CART_MARKUP);fs.mkdirSync(path.dirname(capture),{recursive:true});
  fs.writeFileSync(capture,encodePng(screen({width:24,height:24,bands:[{hex:colour,rows:12}]})));
  fs.writeFileSync(markup,'<main><section><h2>Cart</h2><ul><li>One</li><li>Two</li><li>Three</li></ul></section></main>');
};
const cartDone=summary=>({outcome:'done',summary,files:[cartFile,CART_CAPTURE,CART_MARKUP],checks:[passing('cart-renders','npx vitest run cart')],effect:captureCart});
const uatDone=summary=>({outcome:'done',summary,files:[cartFile],checks:[passing('cart-renders','npx vitest run cart')]});
const cartRed=summary=>({outcome:'failed',summary,files:[],
  checks:[{name:'cart-renders',command:'npx vitest run cart',exitCode:1,evidence:'1 failed spec: the total is empty'}]});
/**
 * What a real drawing leaves behind: the node's design record. This one declares the screen and no artwork
 * slot, so the lane's optional `interface.asset` step is retired and the build follows the drawing directly.
 */
let activeRepo=null;
const UI_PAYLOAD=(slots='[]')=>`ui:
  status: proposed
  intent: The cart, drawn inside the grammar and the brand.
  surfaces:
    - name: cart
      route: /cart
      purpose: Review the cart before paying.
      actors:
        - customer
  states:
    - name: loading
      trigger: the items load
      behavior: skeleton rows
    - name: empty
      trigger: no item
      behavior: the mascot invites a first item
    - name: error
      trigger: the cart cannot load
      behavior: an inline error with retry
    - name: interaction
      trigger: a quantity is edited
      behavior: the line total updates in place
    - name: resting
      trigger: items present
      behavior: lists the items
  accessibility:
    - keyboard reachable
  responsive:
    - narrow and wide
  assets:
    - path: assets/cart-resting.png
      role: candidate for cart resting, narrow
      provenance: image model
      generation:
        tool: image_gen.imagegen
        promptPath: assets/cart-resting.prompt.txt
        inputRefs:
          - brand/index.yaml
  observations: []
  gaps: []
  artworkSlots: ${slots}
assets:
  - path: assets/cart-resting.png
    description: Candidate for cart resting, narrow.
`;
/** Bytes the validator reads as a PNG: the signature and a little padding. */
const PNG_BYTES=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(24)]);
const drawn=(report,slots='[]')=>({...report,effect:()=>{
  const file=path.join(activeRepo,UI_FILE);
  fs.appendFileSync(file,UI_PAYLOAD(slots));
  fs.mkdirSync(path.join(path.dirname(file),'assets'),{recursive:true});
  fs.writeFileSync(path.join(path.dirname(file),'assets','cart-resting.png'),PNG_BYTES);
  fs.writeFileSync(path.join(path.dirname(file),'assets','cart-resting.prompt.txt'),'Synthetic ImageGen direction fixture.');
}});
const uiDone=summary=>({outcome:'done',summary,files:[UI_FILE],checks:[passing('sales-surfaces-drawn','node starci.mjs validate .starciwork')]});

test('the kind graph is the lane and route authority: it validates, and the kernel reads the same answers from it',()=>{
  assert.deepEqual(validateGraph(),[]);
  // The ui node is the design record and walks its own lane; the implementation node builds against it.
  assert.deepEqual(laneFor({kind:'ui'}),['interface.draw','interface.asset']);
  assert.deepEqual(laneFor({kind:'implementation',layout:'frontend'}),['frontend.implement','uat.verify','security.verify','perf.verify']);
  assert.deepEqual(laneFor({kind:'implementation',layout:null}),['backend.implement','e2e.verify','security.verify','perf.verify','review.verify']);
  assert.deepEqual(laneFor({kind:'operations'}),['runtime.operate','review.verify']);
  assert.equal(nextKind(laneFor({kind:'ui'}),['interface.draw']),'interface.asset','with no record read the artwork step is mandatory');
  assert.equal(nextKind(laneFor({kind:'ui'}),['interface.draw'],{predicates:{'node.hasNoArtworkSlots':true}}),null);
  assert.equal(nextKind(laneFor({kind:'implementation',layout:'frontend'}),['frontend.implement']),'uat.verify');
  assert.equal(describeLane(['interface.draw','frontend.implement']),'`interface.draw` -> `frontend.implement`');
  assert.equal(routeFor({blocker:'sds-gap',kind:'backend.implement'}).kind,'architecture.revise');
  assert.equal(routeFor({blocker:'shared-change',kind:'frontend.implement'}).kind,'frontend.implement','`same` is the requester own kind');
  assert.equal(routeFor({verdict:'findings',kind:'review.verify'}).limit,3);
  assert.equal(routeFor({outcome:'failed',kind:'uat.verify'}).then,'reopen');
  assert.equal(validatorRejectLimit(),2,'the validator-reject route carries its own, lower bound');
  assert.equal(routeFor({blocker:'environment',kind:'backend.implement'}).needUser,true);
  assert.equal(routeFor({blocker:'weather',kind:'backend.implement'}),null);
  // Two lane kinds are younger than the operator registry, so the launch seam resolves them to an operator id.
  assert.equal(launchOperator('frontend.implement'),'interface.implement');
  assert.equal(launchOperator('architecture.revise'),'architecture.decide');
  assert.equal(launchOperator('backend.implement'),'backend.implement');
});

test('a frontend Work node travels its lane: interface.draw, then frontend.implement, then uat.verify, and the node is recorded done only after the UAT step',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE,CART_CAPTURE,CART_MARKUP],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('The cart surface is drawn.'))],
      [CART]:[cartDone('The cart is built from the accepted design.')],
      [`${CART}-verify`]:[uatDone('The cart flow passes end to end.')]}});
  try{
    // The lane is in goal.md before anything launches: the user approves a template, not a pile of ops.
    const markdown=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(markdown,/interface\.draw.*interface\.asset \(this op: step 1 of 2\)/);
    assert.deepEqual(harness.state.lanes[UI].lane,['interface.draw','interface.asset']);
    assert.deepEqual(harness.state.lanes[CART].lane,['frontend.implement','uat.verify','security.verify','perf.verify']);
    // The implementation waits for the drawing: its first op exists only once the ui node is done.
    assert.deepEqual(harness.state.ops.map(op=>[op.id,op.kind]),[[UI,'interface.draw']]);
    assert.deepEqual(events(harness.store).filter(event=>event.event==='lane-waits-design').map(event=>[event.node,event.design]),[[CART,UI]]);
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    // One step at a time, each one its own operation on the node's own allowlist.
    assert.deepEqual(state.ops.map(op=>[op.id,op.kind,op.status,op.nodeId]),
      [[UI,'interface.draw','done',UI],[CART,'frontend.implement','done',CART],[`${CART}-verify`,'uat.verify','done',CART]],
      JSON.stringify({ops:state.ops.map(op=>({id:op.id,status:op.status,attempt:op.attempt,findings:op.findings,reports:op.reports})),events:events(harness.store).slice(-20)}));
    assert.deepEqual(state.lanes[UI].done,['interface.draw']);
    assert.deepEqual(state.lanes[CART].done,['frontend.implement','uat.verify']);
    // The build read the drawing: the ui record is a reference of every op built or walked against it.
    assert.ok(state.ops.find(op=>op.id===CART).references.includes('features/sales/ui/index.yaml'));
    assert.ok(state.ops.find(op=>op.id===CART).allowlist.includes('.starciwork/features/sales/implementation/frontend/cart/assets/**'));
    const log=events(harness.store);
    // The drawing's record declares no artwork slot, so the asset step is retired and the ui lane is walked as one.
    assert.deepEqual(log.filter(event=>event.event==='lane-step').map(event=>[event.kind,event.step,event.skipped,event.next]),
      [['interface.draw','1/1',['interface.asset'],null],['frontend.implement','1/2',['security.verify','perf.verify'],'uat.verify'],['uat.verify','2/2',['security.verify','perf.verify'],null]]);
    // Each node hears `done` exactly once, from the step that closes its lane; the build step only reports progress.
    const writes=log.filter(event=>event.event==='ledger-write');
    assert.deepEqual(writes.filter(event=>event.step==='done').map(event=>[event.op,event.node]),[[UI,UI],[`${CART}-verify`,CART]]);
    assert.ok(writes.some(event=>event.step==='in-progress'&&event.op===CART));
    assert.equal(writes.at(-1).op,`${CART}-verify`);
    const node=harness.read(CART);
    assert.equal(node.state,'done');
    assert.deepEqual(node.completion.evidence,[`${CART}-verify-evidence`]);
    assert.deepEqual(node.extensions.work3.kernel.checks.map(check=>[check.assertion,check.exitCode]),[['cart-renders',0]]);
    const evidence=parseYaml(fs.readFileSync(path.join(harness.repo,'.starciwork/features/sales/implementation/frontend/cart/evidence',`${CART}-verify-evidence`,'manifest.yaml'),'utf8'));
    assert.deepEqual(evidence.assets.map(asset=>asset.path),['assets/cart-resting.html','assets/cart-resting.png'],'the completion hashes the implementation-owned capture and matching markup');
    // A frontend lane proves itself with its own UAT step: no kernel review is planned for it.
    assert.equal(state.ops.some(op=>op.kind==='review.verify'),false);
    assert.deepEqual(state.ledger.map(item=>[item.id,item.status]),[[UI,'verified'],[CART,'verified']]);
    assert.equal(state.finished.outcome,'done');
    // Every contract says which lane it belongs to and which step it is.
    assert.match(fs.readFileSync(harness.store.contractPath(CART),'utf8'),/Lane: frontend\.implement -> uat\.verify \(this op: step 1 of 2\)/);
    assert.equal(laneLine(state,{nodeId:CART,kind:'uat.verify'}),'Lane: frontend.implement -> uat.verify (this op: step 2 of 2)');
    assert.equal(laneLine(state,{nodeId:UI,kind:'interface.draw'}),'Lane: interface.draw (this op: step 1 of 1)');
    // The status command prints the lane per node.
    const status=kernelMain('workflow-status',{id:harness.store.id},{orca:{invoke:()=>{throw Error('status makes no Orca call');}},cwd:harness.repo});
    assert.deepEqual(status.lanes[UI],{lane:'interface.draw',done:['interface.draw'],skipped:['interface.asset'],progress:'1/1'});
    assert.deepEqual(status.lanes[CART],{lane:'frontend.implement -> uat.verify',done:['frontend.implement','uat.verify'],skipped:['security.verify','perf.verify'],progress:'2/2'});
    assert.deepEqual(status.workNodes.map(item=>[item.op,item.progress]),
      [[UI,'1/1'],[CART,'2/2'],[`${CART}-verify`,'2/2']]);
  }finally{harness.cleanup();}
});

test('a red UAT run routes to a repair of the lane build step and reopens the run behind it, bounded by the review rounds',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE,CART_CAPTURE,CART_MARKUP],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],[CART]:[cartDone('Built.')],
      [`${CART}-verify`]:[cartRed('The cart total stays empty.'),uatDone('The flow passes now.')],
      'repair-1':[cartDone('The total is summed.')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:24});
    const repair=state.ops.find(op=>op.origin==='repair');
    assert.equal(repair.id,'repair-1');
    assert.equal(repair.kind,'frontend.implement','the repair is the lane build step, not a backend op');
    assert.equal(repair.nodeId,CART);
    assert.deepEqual(repair.findings,['cart-renders failed (exit 1): 1 failed spec: the total is empty']);
    const route=events(harness.store).find(event=>event.event==='routed'&&event.on==='uat-failed');
    assert.deepEqual([route.op,route.to,route.origin,route.kind,route.limit,route.then],
      [`${CART}-verify`,'repair-1','repair','frontend.implement',3,'reopen']);
    // The UAT run itself waited for the repair instead of being retried against the code it failed on.
    const uat=state.ops.find(op=>op.id===`${CART}-verify`);
    assert.ok(uat.dependsOn.includes('repair-1'));
    assert.equal(uat.attempt,2);
    assert.equal(uat.status,'done');
    assert.equal(state.verifyRounds[CART],1,'build-and-UAT shares the review-round counter');
    assert.equal(harness.read(CART).state,'done');
    assert.equal(state.finished.outcome,'done');
  }finally{harness.cleanup();}
});

/**
 * The brand is the second body of material a design operation may never invent. A tree that has a brand record
 * hands it to every design-family op twice: as references (the record and every asset beside it) and as the
 * short Brand block of the contract. The validator is given the same record as rules.
 */
test('a design operation carries the brand record and its assets, prints the Brand block in its contract, and the validator is given the brand as rules',()=>{
  const judged=[];
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE,CART_CAPTURE,CART_MARKUP],ledgerApi:brandLedger,
    validateOp:payload=>{judged.push(payload);return acceptAll();},
    scripts:{[UI]:[drawn(uiDone('The cart surface is drawn.'))],
      [CART]:[cartDone('The cart is built from the accepted design.')],
      [`${CART}-verify`]:[uatDone('The cart flow passes end to end.')]}});
  try{
    // The brand of the tree is what the user approves, and it is on the state before any op is launched.
    assert.deepEqual(harness.state.brand,{node:'demo.brand',file:'brand/index.yaml',name:'Aurora',family:'aurora',rev:3,mascotAssets:[MASCOT]});
    assert.deepEqual(JSON.parse(fs.readFileSync(harness.store.paths.goalJson,'utf8')).brand,harness.state.brand);
    // The first lane step is a design kind, so the record and its assets are references of the operation itself.
    const op=harness.state.ops[0];
    assert.equal(op.kind,'interface.draw');
    assert.ok(op.references.includes('brand/index.yaml'),'the brand record is a reference of the drawing');
    assert.ok(op.references.includes(MASCOT),'so is every asset beside it');
    assert.ok(op.references.some(entry=>/knowledge\/grammars\//.test(entry)),'the installed grammar is still referenced');
    // The Brand block sits under the references, so the operation cannot claim it did not know the brand.
    const contract=renderContract({template,op,state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Brand\n- name: Aurora - family: aurora - rev: 3\n- record: `brand\/index\.yaml`\n- mascot\/logo: `brand\/assets\/mascot-front\.png`/);
    assert.match(contract,/## Brand[\s\S]*never invent one beside them\./);
    assert.ok(contract.indexOf('## References')<contract.indexOf('## Brand'),'the block is under the references it summarises');
    // A kind that draws nothing gets no brand block: the brand is the design family's material, not everyone's.
    assert.doesNotMatch(renderContract({template,op:{...op,kind:'backend.implement'},state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'}),/## Brand/);
    // `grammar.update` is in the list from the other end: it grows the language every drawing reads, so it gets
    // the whole canon and the identity the new unit has to live inside before it adds a word to either.
    // The set is what the catalog derives from `reads: [brand]`, in catalog order, so only membership is pinned here.
    assert.deepEqual([...DESIGN_KINDS].sort(),['content.generate','frontend.implement','grammar.update','interface.asset','interface.draw','uat.verify']);
    assert.match(renderContract({template,op:{...op,kind:'grammar.update'},state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'}),/## Brand/);
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    assert.equal(state.finished.outcome,'done');
    // Nothing was deferred and no decision was needed: the tree already had its brand.
    assert.equal(events(harness.store).some(event=>event.event==='schedule-deferred'&&event.reason==='brand missing'),false);
    assert.equal(state.ops.some(item=>item.kind===BRAND_DECIDE),false);
    // The verdict on a design result is founded on the brand, trimmed to the fields a rule can be read from.
    // Only the drawing leaves a diff here - the fake git's commit clears it - and a result with no diff is not judged.
    assert.deepEqual(judged.map(payload=>payload.op.kind),['interface.draw','frontend.implement']);
    for(const payload of judged)
      assert.deepEqual(Object.keys(payload.brand).sort(),[...BRAND_PAYLOAD].sort(),`${payload.op.kind} was judged against the brand`);
    assert.equal(judged[0].brand.name,'Aurora');
    assert.equal(judged[0].brand.rev,3);
    assert.deepEqual(judged[0].brand.mascotAssets,[MASCOT]);
    assert.deepEqual(judged[0].brand.colorTokens['--brand-accent'],{value:'oklch(0.72 0.15 35)',role:'accent'});
    assert.deepEqual(judged[0].brand.forbidden,['the bare word white inside a style tag']);
    // brandPayload is exactly that trim, and brandSummary is the identity the contract prints.
    const loaded=harness.api.loadLedger({repoRoot:harness.repo,validate:harness.validate});
    assert.deepEqual(brandPayload(loaded),judged[0].brand);
    assert.deepEqual(brandSummary(loaded),harness.state.brand);
    assert.equal(brandPayload({brand:null}),null);
    assert.equal(brandSummary({}),null);
  }finally{harness.cleanup();}
});

/**
 * The same tree without the record: the design op is not launched with nothing to read. The kernel creates the
 * `brand.decide` operation from the brand node the tree already carries and the design op waits behind it.
 */
test('a design operation on a tree with no brand record is deferred and waits for the brand.decide op the kernel creates from the todo brand node',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_TODO],dirty:[cartFile,UI_FILE,CART_CAPTURE,CART_MARKUP],ledgerApi:brandLedger,allocator:brandAllocator(),
    scripts:{'brand-1':[brandDone('The brand is decided: tokens, mascot, forbidden list.')],
      [UI]:[drawn(uiDone('Drawn inside the decided brand.'))],
      [CART]:[cartDone('Built from the drawing and the brand assets.')],
      [`${CART}-verify`]:[uatDone('The flow passes end to end.')]}});
  try{
    // No record yet: the brand is a decision in the goal, the drawing op is the only operation, and it carries
    // no brand reference because there is nothing to reference.
    assert.equal(harness.state.brand,null);
    assert.deepEqual(harness.state.decisions.map(item=>[item.id,item.kind,item.operation]),[['demo.brand','brand','brand.decide']]);
    assert.deepEqual(harness.state.ops.map(op=>[op.id,op.kind]),[[UI,'interface.draw']]);
    assert.equal(harness.state.ops[0].references.includes('brand/index.yaml'),false);
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:24,launch:brandLaunch});
    const log=events(harness.store);
    // The drawing was deferred for the brand, and told what it waits for.
    const deferred=log.filter(event=>event.event==='schedule-deferred'&&event.reason==='brand missing');
    assert.deepEqual(deferred.map(event=>[event.op,event.waitingFor]),[[UI,'brand-1']]);
    // The decide op is the brand node's own record plus the folder its assets live in, and its only check is
    // that the tree still validates.
    const decide=state.ops.find(op=>op.kind===BRAND_DECIDE);
    assert.equal(decide.id,'brand-1');
    assert.equal(decide.nodeId,'demo.brand');
    assert.equal(decide.origin,'ledger');
    assert.deepEqual(decide.ledgerIds,[],'a decision is not a slice of the goal');
    assert.deepEqual(decide.allowlist,['.starciwork/brand/index.yaml','.starciwork/brand/**']);
    assert.deepEqual(decide.checks.map(check=>check.name),['work-tree-validates']);
    assert.match(decide.goal,/Decide the brand in demo\.brand: the name, the design family, every colour token/);
    assert.deepEqual(log.filter(event=>event.event==='brand-decide-created').map(event=>[event.op,event.node]),[['brand-1','demo.brand']]);
    // The decision was settled as a decision: state done, a review on the node, and a bumped rev.
    const record=harness.read('demo.brand');
    assert.equal(record.state,'done');
    assert.equal(record.extensions.work3.kernel.rev,1);
    assert.deepEqual(record.completion.review.observations.map(item=>[item.id,item.outcome]),[['brand-tokens-declared','pass']]);
    // A new rev is named once, after the kernel re-read the tree it had just written.
    assert.deepEqual(log.filter(event=>event.event==='brand-revised').map(event=>[event.rev,event.node,event.op]),[[1,'demo.brand','brand-1']]);
    assert.deepEqual(state.brand,{node:'demo.brand',file:'brand/index.yaml',name:'Aurora',family:'aurora',rev:1,mascotAssets:[MASCOT]});
    // Only then did the drawing launch - and it launched with the brand it had to read.
    const launchedDraw=log.findIndex(event=>event.event==='launched'&&event.op===UI);
    const brandAccepted=log.findIndex(event=>event.event==='op-done'&&event.op==='brand-1');
    assert.ok(brandAccepted>=0&&launchedDraw>brandAccepted,'the drawing launched after the brand was decided');
    const draw=state.ops.find(op=>op.id===UI);
    assert.ok(draw.dependsOn.includes('brand-1'));
    assert.ok(draw.references.includes('brand/index.yaml')&&draw.references.includes(MASCOT));
    assert.match(fs.readFileSync(harness.store.contractPath(UI),'utf8'),/## Brand\n- name: Aurora - family: aurora - rev: 1/);
    // The node still walked its whole lane and is recorded done by its last step.
    assert.deepEqual(state.ops.map(op=>[op.id,op.kind,op.status]),
      [[UI,'interface.draw','done'],['brand-1',BRAND_DECIDE,'done'],
        [CART,'frontend.implement','done'],[`${CART}-verify`,'uat.verify','done']]);
    assert.equal(harness.read(CART).state,'done');
    assert.equal(state.finished.outcome,'done');
  }finally{harness.cleanup();}
});

test('a tree that knows about brands and carries no brand node asks the user once and launches no design operation',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE],dirty:[cartFile,UI_FILE],ledgerApi:brandlessLedger,
    scripts:{[UI]:[drawn(uiDone('This must never run.'))]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:8});
    const log=events(harness.store);
    assert.equal(log.some(event=>event.event==='launched'),false,'no design op was launched without a brand');
    assert.deepEqual(log.filter(event=>event.event==='brand-missing').map(event=>event.detail),
      ['no brand record: author .starciwork/brand/index.yaml (a work.author or brand.decide op)']);
    assert.deepEqual(state.needUser.filter(item=>item.kind==='brand'),
      [{kind:'brand',detail:'no brand record: author .starciwork/brand/index.yaml (a work.author or brand.decide op)'}],
      'the question is asked exactly once, however many iterations defer');
    assert.equal(state.ops.some(op=>op.kind===BRAND_DECIDE),false,'there is no node to decide');
    assert.equal(state.finished,null,'a missing brand is a question the workflow waits on; nothing ran and nothing stopped it within the stall window');
  }finally{harness.cleanup();}
});

/**
 * The interface design record is the feature's `ui` node - its `ui:` spec, read from disk - and it answers the
 * two lane predicates as facts, never a judgement: whether the surfaces were drawn (surfaces and candidate
 * images named) and whether every declared artwork slot already has its generated file.
 */
test('the lane predicates read the ui record: declared artwork slots keep the asset step, generated slots or none retire it, and an implementation node reads the ui node beside it',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],ledgerApi:brandLedger});
  try{
    const access={api:work,at:{repoRoot:harness.repo}};
    const record=text=>fs.writeFileSync(path.join(harness.repo,UI_FILE),text);
    const lane=['interface.draw','interface.asset'];
    const profile={kinds:{},lanes:[{id:'design/ui',match:[{kind:'ui'}],steps:[{kind:'interface.draw'},{kind:'interface.asset',optionalWhen:'node.hasNoArtworkSlots'}]}]};
    const next=(done,predicates)=>nextKind(lane,done,{predicates,profile});
    const slot=file=>`
    - id: empty-cart-mascot
      screen: cart
      state: empty
      region: hero
      purpose: the empty cart says something
      brief: the mascot holding an empty basket
      size:
        w: 960
        h: 720
        viewport: narrow
      format: png
      references:
        - ${MASCOT}
      crop:
        x: 120
        y: 80
        w: 480
        h: 360${file?`
      file: ${file}
      sha256: ${'a'.repeat(64)}
      status: generated`:''}`;
    // A ui record with no spec yet: neither predicate holds, the drawing runs and the artwork step after it is due.
    const bare=designRecord(access,UI_NODE);
    assert.equal(bare.node,UI);assert.equal(bare.state,'todo');assert.equal(bare.surfaces,undefined);
    assert.deepEqual(lanePredicates(access,UI_NODE),{'node.hasInterfaceDesign':false,'node.hasNoArtworkSlots':false});
    assert.equal(next([],lanePredicates(access,UI_NODE)),'interface.draw');
    assert.equal(next(['interface.draw'],lanePredicates(access,UI_NODE)),'interface.asset');
    // Drawn, with a slot the asset step still owes: the artwork step stays.
    record(UI_RECORD+UI_PAYLOAD(slot(null)));
    const drawn=designRecord(access,UI_NODE);
    assert.deepEqual(drawn.artworkSlots.map(entry=>[entry.id,entry.screen,entry.state,entry.size.w,entry.crop.x]),[['empty-cart-mascot','cart','empty',960,120]]);
    assert.deepEqual(lanePredicates(access,UI_NODE),{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':false});
    assert.equal(next(['interface.draw'],lanePredicates(access,UI_NODE)),'interface.asset');
    // The slot generated: nothing left to produce.
    record(UI_RECORD+UI_PAYLOAD(slot('assets/artwork/empty-cart-mascot.png')));
    assert.deepEqual(lanePredicates(access,UI_NODE),{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':true});
    assert.equal(next(['interface.draw'],lanePredicates(access,UI_NODE)),null);
    // No slot at all: the same answer, straight from the drawing.
    record(UI_RECORD+UI_PAYLOAD('[]'));
    assert.deepEqual(lanePredicates(access,UI_NODE),{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':true});
    // An implementation node of the feature reads the same record - the ui node beside it - and a node of a
    // feature with no ui node has none.
    const read=designRecord(access,FRONTEND_NODE);
    assert.equal(read.node,UI);assert.equal(read.file,path.join(harness.repo,UI_FILE).replaceAll('\\','/'));
    assert.deepEqual(lanePredicates(access,FRONTEND_NODE),{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':true});
    assert.equal(designRecord(access,{...FRONTEND_NODE,id:'demo.payments.implementation.frontend.pay',path:'features/payments/implementation/frontend/pay/index.yaml'}),null);
    // A record that is not a mapping, or not a ui node, is no record: the steps stay.
    record('- not a record\n');
    assert.equal(designRecord(access,UI_NODE),null);
    assert.deepEqual(lanePredicates(access,UI_NODE),{'node.hasInterfaceDesign':false,'node.hasNoArtworkSlots':false});
    assert.equal(designRecord(access,null),null);
    assert.equal(designRecord(null,UI_NODE),null);
  }finally{harness.cleanup();}
});

test('a frontend implementation that reports an interface gap routes to interface.draw and reopens the requester',()=>{
  const gap={outcome:'blocked',summary:'The accepted design never drew the empty cart.',files:[],checks:[],
    blocker:{kind:'interface-gap',detail:'the accepted design has no empty state for apps/web/src/cart/index.tsx'}};
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE,CART_CAPTURE,CART_MARKUP],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],
      [CART]:[gap,cartDone('Built from the completed design.')],
      'draw-1':[uiDone('The empty state is drawn.')],
      [`${CART}-verify`]:[uatDone('The flow passes.')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:24});
    const draw=state.ops.find(op=>op.id==='draw-1');
    assert.equal(draw.kind,'interface.draw');
    // The gap is drawn on the feature's design record, never on the implementation's code paths.
    assert.equal(draw.nodeId,UI);
    assert.deepEqual(draw.allowlist,['.starciwork/features/sales/ui/**',UI_FILE]);
    assert.ok(draw.references.includes('features/sales/ui/index.yaml'));
    assert.equal(draw.origin,'architecture');
    assert.equal(draw.status,'done');
    const route=events(harness.store).find(event=>event.event==='routed'&&event.on==='interface-gap');
    assert.deepEqual([route.op,route.to,route.origin,route.kind,route.then],
      [CART,'draw-1','architecture','interface.draw','reopen']);
    const build=state.ops.find(op=>op.id===CART);
    assert.ok(build.dependsOn.includes('draw-1'));
    assert.equal(build.attempt,2);
    assert.equal(build.status,'done');
    assert.match(build.priorOpen.at(-1),/the interface gap is drawn by draw-1/);
    assert.deepEqual(state.lanes[CART].done,['frontend.implement','uat.verify']);
    assert.equal(harness.read(CART).state,'done');
    assert.equal(state.finished.outcome,'done');
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ the grammar gap */

const slash=value=>String(value).replaceAll('\\','/');
const GRAMMAR_ROOT=path.resolve(os.tmpdir(),'starci-grammar-spec','starci-grammar');
/** The binding a product with its own grammar repository declares: `grammar`, beside `be` and `fe`. */
const grammarBinding={grammar:{role:'grammar',directory:GRAMMAR_ROOT,origin:'https://github.com/demo/starci-grammar.git',
  declared:'https://github.com/demo/starci-grammar.git',package:'@starci/grammar'}};
/** The grammar op's chain is Opus then Sol, so the implement pool must lead with a runtime that can launch it. */
const grammarAllocator=()=>fakeAllocator({pools:{implement:['claude-agent','codex-agent','qwen-agent'],
  verify:['qwen-agent','claude-fable','codex-agent'],decide:['claude-fable','codex-agent'],
  write:['codex-agent','claude-agent','qwen-agent'],plan:['claude-agent','claude-fable']}});
const grammarGap={outcome:'blocked',summary:'The accepted design needs a stepped progress rail the grammar has no contract for.',
  files:[],checks:[],blocker:{kind:'grammar-gap',detail:'no contract renders a stepped progress rail for the cart checkout'}};

test('a frontend build that reports a grammar gap routes to grammar.update in the bound grammar repository and reopens the requester',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE,CART_CAPTURE,CART_MARKUP],ledgerApi:brandLedger,
    allocator:grammarAllocator(),binding:grammarBinding,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],
      [CART]:[grammarGap,cartDone('Built with the grown grammar unit.')],
      'grammar-1':[{outcome:'done',summary:'ProgressRail published at 0.5.0; the canon names it.',files:[],
        checks:[passing('cart-renders','npx vitest run cart')]}],
      [`${CART}-verify`]:[uatDone('The flow passes.')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:24});
    const grow=state.ops.find(op=>op.id==='grammar-1');
    assert.ok(grow,'the gap created one grammar operation');
    assert.equal(grow.kind,'grammar.update');
    assert.equal(grow.origin,'architecture');
    // It writes the grammar repository and the canon, and nothing of the product: the build's code paths are gone.
    assert.deepEqual(grow.allowlist,[`${slash(GRAMMAR_ROOT)}/**`,
      `${slash(path.join(path.resolve('.'),'knowledge','grammars'))}/**`,
      `${slash(path.join(path.resolve('.'),'knowledge','patterns','fe'))}/**`]);
    assert.equal(grow.allowlist.some(entry=>entry.includes('apps/web')),false);
    assert.ok(grow.references.some(entry=>/knowledge\/grammars\//.test(entry)),'the whole canon is its material');
    assert.deepEqual(grow.acceptance,['the grammar renders: no contract renders a stepped progress rail for the cart checkout',
      'the grammar package is published at a new version and the consumer imports it',
      'the canon names the new unit']);
    assert.match(grow.goal,/Grow the installed grammar \(`@starci\/grammar`\)/);
    assert.match(grow.goal,/composition of existing contracts first/);
    assert.equal(grow.status,'done');
    const route=events(harness.store).find(event=>event.event==='routed'&&event.on==='grammar-gap');
    assert.deepEqual([route.op,route.to,route.origin,route.kind,route.then],
      [CART,'grammar-1','architecture','grammar.update','reopen']);
    assert.deepEqual(events(harness.store).filter(event=>event.event==='grammar-gap').map(event=>[event.op,event.grow,event.package]),
      [[CART,'grammar-1','@starci/grammar']]);
    // The build waits behind it, reads the canon again, and the node still completes through its own lane.
    const build=state.ops.find(op=>op.id===CART);
    assert.ok(build.dependsOn.includes('grammar-1'));
    assert.equal(build.attempt,2);
    assert.equal(build.status,'done');
    assert.match(build.priorOpen.at(-1),/the grammar is grown by grammar-1; read the canon again first/);
    assert.ok(state.lanes[CART].done.includes('frontend.implement')&&state.lanes[CART].done.includes('uat.verify'));
    assert.equal(harness.read(CART).state,'done');
    assert.equal(state.finished.outcome,'done');
  }finally{harness.cleanup();}
});

test('without a grammar role in the workspace binding the kernel creates no grammar operation and asks the user',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],[CART]:[grammarGap]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:12});
    // Where a language lives is the one thing the kernel will not guess: no op, no reopen, the requester blocked.
    assert.equal(state.ops.some(op=>op.kind==='grammar.update'),false);
    assert.equal(events(harness.store).some(event=>event.event==='routed'&&event.on==='grammar-gap'),false);
    const build=state.ops.find(op=>op.id===CART);
    assert.equal(build.status,'blocked');
    assert.equal(build.attempt,1,'nothing was reopened behind a repository that does not exist');
    const asked=state.needUser.filter(item=>item.op===CART&&item.kind==='environment');
    assert.equal(asked.length,1);
    assert.match(asked[0].detail,/grammar-gap from demo\.sales\.implementation\.frontend\.cart but the workspace binds no grammar repository/);
    assert.match(asked[0].detail,/role `grammar` in \.workspaces\/projects\/<project>\/work\.json/);
    assert.deepEqual(events(harness.store).filter(event=>event.event==='grammar-unbound').map(event=>event.op),[CART]);
    assert.equal(state.finished.outcome,'blocked');
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ the kernel-owned ledger paths */

test('the kernel-owned ledger paths are protected: the contract forbids them, changedFiles drops them, and an operation that wrote them is reverted and never accepted',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const nodeId='demo.sales.implementation.backend.intake';
  const done=summary=>({outcome:'done',summary,files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]});
  const harness=setupWork({dirty:[file],
    scripts:{[nodeId]:[done('Intake implemented, and the node marked done.'),done('Intake implemented.')],
      [`${'demo.sales.implementation.backend.intake'}-verify`]:[{outcome:'done',summary:'The intake scenarios pass through the API on the real stack.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      ...receiptAuthor()}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const nodeFile=harness.node(nodeId);
    const forgery='# forged by the operation\n';
    // The stub stands in for `git checkout --`: the forged line is what a revert takes back out.
    const guards=stubGuards({revertProtected:(git,{paths})=>{
      const before=fs.readFileSync(nodeFile,'utf8');
      if(!before.includes(forgery))return {reverted:[],removed:[]};
      fs.writeFileSync(nodeFile,before.replaceAll(forgery,''));
      return {reverted:[paths[0]],removed:[]};
    }});
    // The operation writes the node's own index.yaml while it runs: the first wait tick is that moment.
    let forged=false;
    const orca={...harness.fake.orca,invoke:(name,params,options)=>{
      const result=harness.fake.orca.invoke(name,params,options);
      if(name==='check'&&!forged){forged=true;fs.appendFileSync(nodeFile,forgery);}
      return result;
    }};
    const forgeClock=fakeClock();
    const state=runLoop(orca,harness.store,harness.state,{cwd,allocator:harness.allocator,template,wait:forgeClock.wait,now:forgeClock.now,validateOp:acceptAll,
      validate:harness.validate,guards,exec:command=>({status:0,stdout:`${command} ok`,stderr:''}),
      git:harness.git.git,waitTimeoutMs:2000,tickMs:1000,maxIterations:12});
    const op=state.ops.find(item=>item.id===nodeId);
    // Every contract of the node names what the kernel owns, so "never touch" is not folklore.
    const contract=fs.readFileSync(harness.store.contractPath(nodeId),'utf8');
    assert.match(contract,/## Never touch \(kernel-owned\)/);
    assert.match(contract,/- `\.starciwork\/features\/sales\/implementation\/backend\/intake\/index\.yaml`/);
    assert.match(contract,/- `\.starciwork\/features\/sales\/implementation\/backend\/intake\/evidence\/\*\*`/);
    assert.deepEqual(op.kernelOwned,['.starciwork/features/sales/implementation/backend/intake/index.yaml',
      '.starciwork/features/sales/implementation/backend/intake/evidence/**']);
    const log=events(harness.store);
    const modified=log.find(event=>event.event==='kernel-paths-modified');
    assert.ok(modified,'the write into the kernel-owned paths was caught');
    assert.deepEqual(modified.reverted,['.starciwork/features/sales/implementation/backend/intake/index.yaml']);
    // The report is downgraded to failed with the finding, never accepted, and the op comes back.
    assert.equal(op.reports[0].outcome,'done');
    assert.equal(op.reports[0].downgradedTo,'failed');
    const retried=log.find(event=>event.event==='retry'&&event.op===nodeId);
    assert.match(retried.findings[0],/^operation modified kernel-owned ledger paths: \.starciwork\/features\/sales/);
    assert.ok(log.findIndex(event=>event.event==='kernel-paths-modified')<log.findIndex(event=>event.event==='op-done'),
      'the revert happened before anything was accepted');
    // The forgery was taken back out, and the second attempt is the one the kernel accepted.
    assert.equal(fs.readFileSync(nodeFile,'utf8').includes(forgery),false);
    assert.equal(op.status,'done');assert.equal(op.attempt,2);
    assert.equal(harness.read(nodeId).state,'done');
    assert.equal(harness.read(nodeId).extensions.work3.kernel.verifiedBy,'starci-kernel');
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ an incomplete record is an op's job */

const REFUND='demo.sales.implementation.backend.refund';
const REFUND_RECORD='.starciwork/features/sales/implementation/backend/refund/index.yaml';
const REFUND_AUTHOR=`${REFUND}-author`;
const authorReport=summary=>({outcome:'done',summary,files:[REFUND_RECORD],
  checks:[passing('work-valid','node starci.mjs validate .starciwork')]});
/** Run one workflow over the unauthored node, letting the test decide what the operation does while it runs. */
function runAuthoring({scripts,whileRunning=()=>{},guards=null,maxIterations=12}){
  const harness=setupWork({nodes:[UNAUTHORED_NODE],dirty:[REFUND_RECORD],scripts});
  approve(harness.store,harness.state);
  harness.state.run='run_wf';harness.state.from='term_kernel';
  const nodeFile=harness.node(REFUND);
  const orca={...harness.fake.orca,invoke:(name,params,options)=>{
    const result=harness.fake.orca.invoke(name,params,options);
    // The operation edits the record while it runs; the wait tick is the moment it has done so.
    if(name==='check')whileRunning(nodeFile);
    return result;
  }};
  const commits=[];
  const state=runLoop(orca,harness.store,harness.state,{cwd,allocator:harness.allocator,template,wait:harness.clock.wait,now:harness.clock.now,
    validateOp:acceptAll,validate:harness.validate,...(guards?{guards:guards(nodeFile)}:{}),
    exec:command=>({status:0,stdout:`${command} ok`,stderr:''}),
    git:(executable,args)=>{if(args[0]==='commit')commits.push(args[args.indexOf('-m')+1]);return harness.git.git(executable,args);},
    waitTimeoutMs:2000,tickMs:1000,maxIterations});
  return {harness,state,commits,nodeFile,log:events(harness.store)};
}

test('a ledger-incomplete node becomes exactly one work.author op on its own record, and the completed record starts the node lane',()=>{
  // Two iterations are the whole story: the author op completes the record, and the lane's first step is created.
  const {harness,state,commits,log}=runAuthoring({maxIterations:2,
    scripts:{[REFUND_AUTHOR]:[authorReport('The record now declares its write scope and one check per assertion.')]},
    whileRunning:file=>{if(!fs.readFileSync(file,'utf8').includes('refund-restores-balance'))authorRecord(file);}});
  try{
    // At approval the node is still the ledger's own question: no op was derived from a record that says nothing.
    assert.deepEqual(harness.goal.incomplete,[REFUND]);
    // One author op, and its write scope is exactly the node's own index.yaml - nothing else in the tree.
    const authors=state.ops.filter(op=>op.kind==='work.author');
    assert.deepEqual(authors.map(op=>op.id),[REFUND_AUTHOR]);
    const author=authors[0];
    assert.deepEqual(author.allowlist,[REFUND_RECORD]);
    assert.equal(author.origin,'ledger');
    assert.equal(author.nodeId,REFUND);
    assert.deepEqual(author.ledgerIds,[]);
    assert.match(author.goal,/^Complete the Work record of demo\.sales\.implementation\.backend\.refund so the kernel can launch it: Node .* declares no implementation\.changes\[\]\.files and no extensions\.work3\.checks/);
    assert.deepEqual(author.checks.map(check=>check.name),['work-valid']);
    assert.match(author.checks[0].command,/bin\/starci\.mjs validate .*\.starciwork$/);
    assert.deepEqual(author.acceptance,['the node declares an allowlist and checks that name its assertions','the tree validates']);
    assert.equal(author.status,'done');
    assert.equal(state.lanes[REFUND].authored,REFUND_AUTHOR);
    // Its contract grants the record and still forbids what stays the kernel's inside it.
    const contract=fs.readFileSync(harness.store.contractPath(REFUND_AUTHOR),'utf8');
    assert.match(contract,/# Operation contract - `work\.author`/);
    assert.match(contract,/## Work node you author/);
    assert.match(contract,/`state`, `completion`, `extensions\.work3\.kernel` stay the kernel's/);
    assert.match(contract,/## Never touch \(kernel-owned\)\n- `\.starciwork\/features\/sales\/implementation\/backend\/refund\/evidence\/\*\*`/);
    assert.doesNotMatch(contract,/## Never touch \(kernel-owned\)\n- `\.starciwork\/features\/sales\/implementation\/backend\/refund\/index\.yaml`/);
    assert.match(contract,/Lane: this op precedes backend\.implement -> e2e\.verify -> security\.verify -> perf\.verify -> review\.verify, which the kernel launches itself once this record is complete/);
    assert.match(contract,/Sequence `work\.author`/);
    // The record it wrote is committed, and the kernel measured the result against the tree, not against the report.
    assert.match(commits[0],/^feat\(demo\.sales\.implementation\.backend\.refund-author\): Complete the Work record/);
    const recorded=log.find(event=>event.event==='record-authored');
    assert.equal(recorded.node,REFUND);
    assert.equal(recorded.op,REFUND_AUTHOR);
    assert.deepEqual(recorded.allowlist,['apps/agentos-controlplane/src/sales/refund.ts']);
    assert.deepEqual(recorded.checks,['refund-restores-balance']);
    // The node is schedulable now, so its lane created its first step - with the node's own id, because the
    // author op preceded the lane rather than walking a step of it.
    const first=state.ops.find(op=>op.nodeId===REFUND&&op.kind==='backend.implement');
    assert.equal(first.id,REFUND);
    assert.deepEqual(first.allowlist,['apps/agentos-controlplane/src/sales/refund.ts']);
    assert.deepEqual(first.checks,[{name:'refund-restores-balance',command:'npx vitest run refund'}]);
    assert.deepEqual(state.lanes[REFUND].lane,['backend.implement','e2e.verify','security.verify','perf.verify','review.verify']);
    assert.deepEqual(state.lanes[REFUND].done,[],'authoring the record walked no step of the lane');
    assert.deepEqual(state.ledger.map(item=>item.id),[REFUND]);
    // Authoring is not completion: the node keeps todo and has no proof of anything.
    const node=harness.read(REFUND);
    assert.equal(node.state,'todo');
    assert.equal(node.completion,undefined);
    assert.equal(node.extensions.work3.kernel.opId,REFUND);
    assert.deepEqual(node.assertions,['refund-restores-balance']);
    assert.equal(state.needUser.some(item=>item.kind==='ledger'&&item.node===REFUND),false,
      'a record the kernel completed is no longer a question for the user');
  }finally{harness.cleanup();}
});

test('an author op that moved what the kernel owns inside the record is reverted and never accepted',()=>{
  const forgery=`completion:\n  inputDigest: ${DIGEST('f')}\n`;
  let forged=false;
  // The stub stands in for `git checkout --`: the forged completion is what a revert takes back out.
  const guards=nodeFile=>stubGuards({revertProtected:(git,{paths})=>{
    const before=fs.readFileSync(nodeFile,'utf8');
    if(!before.includes(forgery))return {reverted:[],removed:[]};
    fs.writeFileSync(nodeFile,before.replaceAll(forgery,''));
    return {reverted:[paths[0]],removed:[]};
  }});
  // Three iterations: the forged attempt, the attempt that authors the record, and the lane's first step.
  const {harness,state,log}=runAuthoring({guards,maxIterations:3,
    scripts:{[REFUND_AUTHOR]:[authorReport('The record is complete and the node is done.'),
      authorReport('The record declares its write scope and one check per assertion.')]},
    whileRunning:file=>{
      const text=fs.readFileSync(file,'utf8');
      // Already authored, or forged and waiting for the kernel to read the record back: nothing to do here.
      if(text.includes('refund-restores-balance')||text.includes('completion:'))return;
      if(!forged){forged=true;fs.appendFileSync(file,forgery);return;}
      authorRecord(file);
    }});
  try{
    const author=state.ops.find(op=>op.id===REFUND_AUTHOR);
    const moved=log.find(event=>event.event==='record-blocks-modified');
    assert.ok(moved,'the write into the kernel-owned fields of the record was caught');
    assert.deepEqual(moved.blocks,['state','completion','extensions.work3.kernel']);
    assert.deepEqual(moved.reverted,[REFUND_RECORD]);
    assert.equal(author.reports[0].outcome,'done');
    assert.equal(author.reports[0].downgradedTo,'failed');
    const retried=log.find(event=>event.event==='retry'&&event.op===REFUND_AUTHOR);
    assert.match(retried.findings[0],/^operation modified kernel-owned fields \(state, completion, extensions\.work3\.kernel\) of the Work record it authors: \.starciwork\/features\/sales/);
    assert.ok(log.findIndex(event=>event.event==='record-blocks-modified')<log.findIndex(event=>event.event==='op-done'),
      'the revert happened before anything was accepted');
    // The refusal is not a dead end: the second attempt authors the record and is accepted.
    assert.equal(author.attempt,2);
    assert.equal(author.status,'done');
    assert.ok(log.some(event=>event.event==='record-authored'&&event.node===REFUND));
    assert.equal(harness.read(REFUND).completion,undefined,'no completion an operation wrote itself survived');
  }finally{harness.cleanup();}
});

test('a record that is still incomplete after its author op asks the user once and never gets a second author op',()=>{
  const {harness,state,log}=runAuthoring({
    scripts:{[REFUND_AUTHOR]:[authorReport('I described the work but left the scope open.')]}});
  try{
    assert.deepEqual(state.ops.filter(op=>op.kind==='work.author').map(op=>op.id),[REFUND_AUTHOR],
      'one author op per node per workflow, whatever it left behind');
    assert.equal(state.ops.find(op=>op.id===REFUND_AUTHOR).status,'done');
    const still=log.find(event=>event.event==='record-still-incomplete');
    assert.equal(still.node,REFUND);
    assert.match(still.detail,/^ledger incomplete: Node demo\.sales\.implementation\.backend\.refund declares no implementation\.changes\[\]\.files and no extensions\.work3\.checks/);
    assert.equal(log.some(event=>event.event==='record-authored'),false);
    // Exactly one question for the user, and no lane was ever started for the node.
    assert.deepEqual(state.needUser.filter(item=>item.kind==='ledger'&&item.node===REFUND).length,1);
    assert.equal(state.ops.some(op=>op.nodeId===REFUND&&op.kind!=='work.author'),false);
    assert.deepEqual(state.ledger,[]);
    assert.equal(harness.read(REFUND).state,'todo');
    assert.equal(state.finished.outcome,'blocked');
  }finally{harness.cleanup();}
});

/** A credential ask an older build launched as an agent, and that agent could not prepare, becomes a fill wait at start. */
test('a blocked credential ask from an older build is taken over by the kernel as a fill wait at start',()=>{
  const harness=setupWork({});
  try{
    const store=harness.store,state=harness.state;
    const requester={...state.ops[0],id:'op-send',kind:'integration.verify',status:'paused',waitingFor:'ask-3',dispatch:null,terminal:null,nodeId:null};
    const ask={...state.ops[0],id:'ask-3',kind:'provision.ask',status:'blocked',origin:'ask',requesters:['op-send'],nodeId:null,dispatch:null,terminal:'term_old_ask',
      allowlist:['.starciwork/features/sales/business/srs/business-rules/policy-decisions/**'],
      question:{kind:'credential',stop:'credential',from:'op-send',text:'PAY_API_KEY is not provided for the payments provider in identity:payments',options:[]}};
    state.ops.push(requester,ask);
    state.needUser.push({op:'ask-3',kind:'decision',detail:'ask-3 could not prepare the question of op-send: PAY_API_KEY for payments in identity:payments'});
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    const after=harness.run({maxIterations:1});
    const taken=after.ops.find(op=>op.id==='ask-3');
    assert.deepEqual([taken.status,taken.fill,taken.credential?.custody,taken.credential?.variables],['running',true,'identity:payments',['PAY_API_KEY']]);
    assert.ok(!after.needUser.some(line=>line.op==='ask-3'),'the "could not prepare" line is gone: the kernel asks now');
    assert.ok(events(store).some(event=>event.event==='provision-fill-readmitted'&&event.ask==='ask-3'&&event.was==='blocked'));
    assert.ok(events(store).some(event=>event.event==='provision-fill-waiting'&&event.ask==='ask-3'));
    assert.equal(after.ops.find(op=>op.id==='op-send').status,'paused','the requester still waits, now on the custody');
  }finally{harness.cleanup();}
});

/** A credential ask waiting with no command to copy is asked again every tick, and named the moment its custody is knowable. */
test('a fill-waiting ask with no command yet is named at the next tick, and the owner is told once',()=>{
  const harness=setupWork({});
  try{
    const store=harness.store,state=harness.state;state.host=path.resolve('.');
    const requester={...state.ops[0],id:'zalo-bot-author',kind:'work.author',status:'paused',waitingFor:'ask-6',dispatch:null,terminal:null,nodeId:null,
      reports:[{outcome:'blocked',summary:'blocked',blocker:{kind:'authority',detail:'ZALO_BOT_TOKEN for zalo-bot-api in identity:chatbot-zalo-bot'}}]};
    const ask={...state.ops[0],id:'ask-6',kind:'provision.ask',status:'running',origin:'ask',requesters:['zalo-bot-author'],nodeId:null,dispatch:null,terminal:null,
      fill:true,fillCommand:null,credential:{variables:['ZALO_BOT_TOKEN'],custody:null,provider:null},reports:[],
      allowlist:['.starciwork/features/sales/business/srs/business-rules/policy-decisions/**'],
      question:{kind:'credential',stop:'credential',from:'zalo-bot-author',text:'Which command proves ZALO_BOT_TOKEN against zalo-bot-api?',options:[]}};
    state.ops.push(requester,ask);
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    const after=harness.run({maxIterations:2});
    const named=after.ops.find(op=>op.id==='ask-6');
    assert.equal(named.credential.custody,'identity:chatbot-zalo-bot','the slug the requester reported is the slug');
    assert.match(String(named.fillCommand),/identity fill chatbot-zalo-bot --name ZALO_BOT_TOKEN/);
    assert.deepEqual(events(store).filter(event=>event.event==='provision-fill-named').map(event=>event.ask),['ask-6'],'told once, not every tick');
  }finally{harness.cleanup();}
});

/** A kernel that finds its supervisor's pulse stale and its pid gone starts one, once per window; a fresh pulse or no pulse means nothing. */
test('a kernel revives a dead supervisor from its stale pulse, once per window, and leaves a live or absent one alone',()=>{
  const harness=setupWork({});
  try{
    const store=harness.store,state=harness.state;state.host=path.resolve('.');
    const file=path.join(path.dirname(store.dir),'supervisor.lock');
    const spawned=[];const spawn=(executable,args,options)=>{spawned.push({executable,args,cwd:options.cwd});return 777;};
    let clock=10*60*1000;const now=()=>clock;
    assert.equal(reviveSupervisor(store,state,{},{now,spawn,alive:()=>false}),null,'no pulse was ever written: a kernel run by hand has no supervisor to miss');
    fs.writeFileSync(file,JSON.stringify({pid:4242,at:clock-60*1000}));
    assert.equal(reviveSupervisor(store,state,{},{now,spawn,alive:()=>false}),null,'a pulse one minute old is a live supervisor');
    fs.writeFileSync(file,JSON.stringify({pid:4242,at:clock-6*60*1000}));
    assert.equal(reviveSupervisor(store,state,{},{now,spawn,alive:()=>true}),null,'stale pulse but the pid still answers: it is only slow');
    assert.equal(reviveSupervisor(store,state,{},{now,spawn,alive:()=>false}),777,'stale pulse and no process: revived');
    assert.deepEqual(spawned[0].args.slice(1),['workflow-supervise','--host',state.host]);
    assert.match(spawned[0].args[0],/bin[\\/]starci\.mjs$/);
    assert.equal(reviveSupervisor(store,state,{},{now,spawn,alive:()=>false}),null,'not twice inside the window');
    const revived=events(store).filter(event=>event.event==='supervisor-revived');
    assert.deepEqual(revived.map(event=>[event.pid,event.lastPid]),[[777,4242]]);
  }finally{harness.cleanup();}
});

test('a persisted launcher this build no longer has is replaced by the one it has, and a relative stand-in is left alone',()=>{
  const harness=setupWork({});
  try{
    const store=harness.store,state=harness.state;
    state.host=path.resolve('.');
    state.launcher='D:/Repositories/somewhere/.claude/.dist/execution/orca-supervised-launch.mjs';
    assert.equal(relocateLauncher(store,state),true);
    assert.equal(state.launcher,path.resolve('.dist/hosts/orca/launch.mjs').replaceAll('\\','/'));
    const moved=events(store).find(event=>event.event==='launcher-relocated');
    assert.match(moved.from,/orca-supervised-launch\.mjs$/);
    state.launcher='L.mjs';
    assert.equal(relocateLauncher(store,state),false,'a relative launcher is a test stand-in and never touched');
    assert.equal(state.launcher,'L.mjs');
  }finally{harness.cleanup();}
});

test('changedFiles asks git for every untracked file by name, so a new record in a new folder is attributable',()=>{
  const record='.starciwork/features/chatbot/business/srs/business-rules/policy-decisions/d-x/index.yaml';
  const seen=[];
  const git=(executable,args)=>{seen.push(args);return {status:0,stdout:`?? ${record}\n`,stderr:''};};
  const op={allowlist:['.starciwork/features/chatbot/business/srs/business-rules/policy-decisions/**'],reports:[{files:[record]}]};
  const files=changedFiles({worktree:cwd},op,{git});
  assert.deepEqual(files,[record]);
  assert.ok(seen[0].includes('--untracked-files=all'),'without it git shows the new folder, which no report names');
  assert.deepEqual(attributedFiles(op,files),[record]);
});

test('changedFiles never carries a kernel-owned path, even when the allowlist is the whole feature folder',()=>{
  const ledger='.starciwork/features/sales/implementation/backend/intake';
  const git=fakeGit([`${ledger}/index.yaml`,`${ledger}/evidence/run-1/manifest.yaml`,'.starciwork/features/sales/notes.md']).git;
  const state={worktree:cwd},op={allowlist:['.starciwork/features/sales/**']};
  assert.equal(changedFiles(state,op,{git}).length,3);
  assert.deepEqual(changedFiles(state,op,{git},op.allowlist,{exclude:[`${ledger}/index.yaml`,`${ledger}/evidence/**`]}),
    ['.starciwork/features/sales/notes.md']);
});

/**
 * One project has one Work tree, owned by the backend repository and written by the frontend repository too, so
 * a record a frontend lane is writing right now is dirty in the backend's worktree beside the backend's own work.
 * A backend build whose allowlist covers that record - here through the old rule that gave a repair the union of
 * every operation's allowlist - is not its author, and the kernel must not blame it: what an operation produced
 * is what it said it produced and the worktree confirms. The same file, once the operation does claim it, is the
 * finding it always was.
 */
test('a record another workflow left dirty in the shared tree is not attributed to a backend build, but a record that build claims still is',()=>{
  const foreign='.starciwork/features/sales/ui/index.yaml';
  const unioned=[intakeFile,'.starciwork/features/sales/**'];
  const plan={definitionOfDone:['order intake persists an order'],
    ledger:[{id:'goal-1',title:'Order intake',inputRef:'sds:SDS-FR-SALES-03',status:'absent'}],
    ops:[{id:'op-intake',kind:'backend.implement',goal:'Implement order intake.',ledgerIds:['goal-1'],
      allowlist:unioned,references:['.starciwork/features/sales/sds.md#3'],
      checks:[{name:'unit',command:'npx vitest run sales'}],acceptance:['intake persists an order'],dependsOn:[]}]};
  const unclaimed=setup({plan,dirty:[intakeFile,foreign],
    scripts:{'op-intake':[doneReport(intakeFile,'sales')],'verify-1':[reviewPassed]}});
  try{
    approve(unclaimed.store,unclaimed.state);
    unclaimed.state.run='run_wf';unclaimed.state.from='term_kernel';
    const state=unclaimed.run();
    const op=state.ops.find(item=>item.id==='op-intake');
    assert.equal(op.status,'done');
    assert.equal(events(unclaimed.store).some(event=>event.event==='io-undeclared-write'),false,
      'the drawing record the frontend lane was writing is not this build\'s product');
    assert.equal(op.reports.at(-1).downgradedTo,undefined);
    assert.equal(op.attempt,1,'the build was never sent back for a record it did not write');
  }finally{unclaimed.cleanup();}

  const claimed=setup({plan,dirty:[intakeFile,foreign],
    scripts:{'op-intake':[{outcome:'done',summary:'Intake implemented and the screen record updated.',
      files:[intakeFile,foreign],checks:[passing('unit','npx vitest run sales')]}]}});
  try{
    approve(claimed.store,claimed.state);
    claimed.state.run='run_wf';claimed.state.from='term_kernel';
    const state=claimed.run();
    const op=state.ops.find(item=>item.id==='op-intake');
    const undeclared=events(claimed.store).find(event=>event.event==='io-undeclared-write');
    assert.deepEqual(undeclared?.files,[foreign]);
    assert.equal(op.reports[0].downgradedTo,'failed');
    assert.match(op.findings[0],/produced a design record it does not declare: \.starciwork\/features\/sales\/ui\/index\.yaml/);
  }finally{claimed.cleanup();}
});

/**
 * The same rule one step earlier: a scope composed from OTHER operations' allowlists is code, never the Work
 * tree, so a code builder is not handed the records another lane is writing in the first place. `runGates`
 * already held this by hand; `buildScope` is the one rule, and the review escalation now applies it too - except
 * where the new op's own kind declares it writes a record (`writesWorkRecords`), because a redraw or a decision
 * is sent back to change exactly those records.
 */
test('a scope composed from other operations allowlists carries no Work tree path, and a record-writing kind keeps its records',()=>{
  assert.deepEqual(buildScope(['apps/web/src/cart/**','.starciwork/features/sales/ui/**','apps/web/src/cart/**']),
    ['apps/web/src/cart/**']);
  assert.deepEqual(buildScope(['C:/owner/backend/.starciwork/features/sales/ui/index.yaml','src/sales/intake.ts',
    'C:\\owner\\backend\\.starciwork\\features\\sales']),['src/sales/intake.ts']);
  // Which kinds the filter applies to is the catalog's answer, not a list the kernel remembers.
  assert.deepEqual(['backend.implement','frontend.implement','review.verify','task.execute'].map(kind=>writesWorkRecords(kind)),
    [false,false,false,false]);
  assert.deepEqual(['interface.draw','architecture.decide','work.author'].map(kind=>writesWorkRecords(kind)),[true,true,true]);
});

test('an exact amended path permits its owner-authorized cross-kind form repair without weakening wildcard IO checks',()=>{
  const decision='.starciwork/features/login/business/srs/business-rules/policy-decisions/d-login-platform-billing-ledger/index.yaml';
  const business='.starciwork/features/login/business/index.yaml';
  const broad='.starciwork/features/login/business/**';
  const op={kind:'decision.prepare',allowlist:[decision,business,broad],amendmentEffects:[
    {amendment:'owner-grant',paths:[business,broad],resources:[],external:[]}
  ]};
  const verdict=producedKindVerdict(op,[decision,business,'.starciwork/features/login/business/overview/index.yaml'],{engine:{}});
  assert.deepEqual(verdict.undeclared,[{file:'.starciwork/features/login/business/overview/index.yaml',record:'srs'}],
    'the exact amended parent is authorized, while a broad amendment path does not silently grant new record kinds');
});

/* ------------------------------------------------------------------ shared-change discipline */

const sharedPlan={definitionOfDone:['the slice works'],
  ledger:[{id:'goal-1',title:'Sales slice',inputRef:'sds:3',status:'absent'}],
  ops:['a','b','c','d','e','f'].map(name=>({id:`op-${name}`,kind:'backend.implement',goal:`Implement ${name}.`,
    ledgerIds:['goal-1'],allowlist:[`apps/web/src/${name}/index.ts`],references:['sds.md'],
    checks:[{name:'unit',command:`npx vitest run ${name}`}],acceptance:[`${name} works`],dependsOn:[]}))};

test('a shared change must name its paths, is deduped by path set, is capped per iteration, and pauses its requester until it is done',()=>{
  const harness=setup({plan:sharedPlan,scripts:{}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    harness.state.iterations=1;
    const guards=stubGuards();
    const ctx={cwd,allocator:harness.allocator,guards,git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('a shared change is not a decision');}};
    const block=(id,detail)=>{
      const op=running(harness.state,id,`ctx_${id}`);
      const report=buildReport({outcome:'blocked',run:'run_wf',task:`task_${id}`,dispatch:op.dispatch,from:op.terminal,
        summary:`${id} cannot make the change alone.`,blocker:{kind:'shared-change',detail}});
      report.sent={messageId:`msg_${id}`,sentAt:1,type:report.signal.type};
      return applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,ctx);
    };
    const op=id=>harness.state.ops.find(item=>item.id===id);
    // The Work tree is never delegated: a shared change naming ONLY ledger paths is refused in the operation's own
    // terminal and is never an item on the owner's list - there is nothing for the owner to decide, because the
    // answer is a rule of the runtime. (Before the 5-plus ruling this blocked the op with a `ledger-path` item.)
    harness.state.ops.push({...structuredClone(harness.state.ops[0]),id:'op-ledger',status:'pending',dispatch:null,terminal:null,runtime:null});
    assert.equal(block('op-ledger','.starciwork/features/sales/migration/index.yaml must drop its source identity'),'shared-change-refused');
    assert.equal(op('op-ledger').status,'answering');
    assert.match(op('op-ledger').answer,/the kernel's own record/);
    assert.equal(harness.state.needUser.some(item=>item.kind==='ledger-path'),false,'a mechanical refusal is never the owner\'s item');
    assert.deepEqual(events(harness.store).slice(-2).map(event=>event.event),['ledger-path-refused','shared-change-refused']);
    assert.equal(harness.state.ops.some(item=>item.origin==='shared'),false,'no shared op was created for a ledger path');
    // One concrete path set becomes one shared op, and the requester is paused - never pending, never rescheduled.
    assert.equal(block('op-a','packages/contracts/widget.ts must register the entity'),'shared-change');
    const shared=op('shared-1');
    assert.equal(shared.origin,'shared');
    assert.deepEqual(shared.allowlist,['packages/contracts/widget.ts']);
    assert.deepEqual(shared.requesters,['op-a']);
    assert.equal(op('op-a').status,'paused');
    assert.equal(op('op-a').waitingFor,'shared-1');
    // A path-prefix overlap merges into the existing shared op and appends the requester.
    assert.equal(block('op-b','packages/contracts/** must expose the same entity'),'shared-change-merged');
    assert.deepEqual(shared.requesters,['op-a','op-b']);
    assert.deepEqual(shared.allowlist,['packages/contracts/widget.ts','packages/contracts/**']);
    assert.equal(harness.state.ops.filter(item=>item.origin==='shared').length,1);
    // Distinct path sets get their own shared ops, up to three in one iteration.
    assert.equal(block('op-c','libs/telemetry/trace.ts needs the span'),'shared-change');
    assert.equal(block('op-d','src/shared/env.ts needs the flag'),'shared-change');
    assert.equal(block('op-e','apps/api/src/registry.ts needs the route'),'shared-change-deferred');
    assert.deepEqual(harness.state.ops.filter(item=>item.origin==='shared').map(item=>item.id),['shared-1','shared-2','shared-3']);
    assert.equal(op('op-e').status,'paused');
    assert.equal(op('op-e').waitingFor,null);
    assert.deepEqual(harness.state.sharedQueue.map(item=>item.op),['op-e']);
    // The cap is per iteration: the queued request waits while the iteration is full, then becomes its own op.
    assert.deepEqual(drainSharedQueue(harness.store,harness.state),[]);
    assert.deepEqual(harness.state.sharedQueue.map(item=>item.op),['op-e']);
    harness.state.iterations=2;
    assert.deepEqual(drainSharedQueue(harness.store,harness.state),['shared-4']);
    assert.deepEqual(harness.state.sharedQueue,[]);
    assert.equal(op('op-e').waitingFor,'shared-4');
    assert.deepEqual(op('shared-4').allowlist,['apps/api/src/registry.ts']);
    // A shared-change block that names no path is a question to the kernel, answered in the operation's terminal.
    assert.equal(block('op-f','the core module has to register it first'),'shared-change-unnamed');
    assert.equal(op('op-f').status,'answering');
    assert.match(op('op-f').answer,/[Nn]ame the exact paths/);
    assert.equal(harness.state.ops.filter(item=>item.origin==='shared').length,4);
    // A paused requester returns to ready only when its shared op is done, carrying the head that proves it.
    Object.assign(op('shared-1'),{status:'done',head:'def5678'});
    assert.deepEqual(resumePaused(harness.store,harness.state).sort(),['op-a','op-b']);
    assert.equal(op('op-a').status,'ready');
    assert.equal(op('op-a').attempt,2);
    assert.deepEqual(op('op-a').priorOpen,['shared change shared-1 done at def5678']);
    // A shared op blocked without a refusal is still alive - the kernel cools, re-admits or authors it - so its
    // requester keeps waiting; one the kernel refused for good blocks its requesters instead of leaving them paused forever.
    op('shared-2').status='blocked';
    resumePaused(harness.store,harness.state);
    assert.equal(op('op-c').status,'paused','a blocked shared op the kernel will re-admit keeps its requester waiting');
    op('shared-2').refusal='launch-exhausted';
    resumePaused(harness.store,harness.state);
    assert.equal(op('op-c').status,'blocked');
    assert.match(harness.state.needUser.find(item=>item.op==='op-c').detail,/waits for the shared change shared-2, which is blocked/);
    const log=events(harness.store).map(event=>event.event);
    for(const name of ['shared-change-merged','shared-change-deferred','op-paused','shared-change-unnamed','shared-change-resumed','shared-change-blocked'])
      assert.ok(log.includes(name),`the log records ${name}`);
  }finally{harness.cleanup();}
});

// One bad path used to cost an operation its whole request: a shared change that named the Work tree AND the
// code it actually needed was refused outright and became a `ledger-path` item nobody could answer. The ruling
// splits it - the record paths are refused with one event, the code paths carry on - and the refusal is
// mechanical, so it is never on the owner's list either way.
test('a shared change that asks for record paths and code paths is split: the record paths are refused, the code paths continue',()=>{
  const harness=setup({plan:sharedPlan,scripts:{}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    harness.state.iterations=1;
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('a shared change is not a decision');}};
    const op=harness.state.ops.find(item=>item.id==='op-a');
    Object.assign(op,{status:'running',dispatch:'disp_mixed',terminal:'term_mixed',runtime:'qwen3.8-flash'});
    const report=buildReport({outcome:'blocked',run:'run_wf',task:'task_a',dispatch:'disp_mixed',from:'term_mixed',
      summary:'op-a cannot make the change alone.',
      blocker:{kind:'shared-change',detail:'.starciwork/features/sales/index.yaml and packages/contracts/widget.ts must both name the span'}});
    report.sent={messageId:'msg_a',sentAt:1,type:report.signal.type};
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,ctx),'shared-change');
    const refused=events(harness.store).find(event=>event.event==='ledger-path-refused');
    assert.deepEqual([refused.op,refused.paths,refused.continued],
      ['op-a',['.starciwork/features/sales/index.yaml'],['packages/contracts/widget.ts']]);
    const shared=harness.state.ops.find(item=>item.id===op.waitingFor);
    assert.deepEqual(shared.allowlist,['packages/contracts/widget.ts'],'only the code path is delegated');
    assert.equal(harness.state.needUser.some(item=>item.kind==='ledger-path'),false,'a mechanical refusal is never the owner\'s item');
  }finally{harness.cleanup();}
});

// A shared change two levels deep used to be a `shared-depth` item on the owner's list, and there was nothing
// the owner could do with it: the depth is the runtime's own bound, and the change is work nobody wrote down.
// It becomes one Work node now, authored by a `work.author` op and scheduled like any other node.
test('a shared change too deep to delegate again becomes one Work node the kernel authors, not a question for the owner',()=>{
  const harness=setup({plan:sharedPlan,scripts:{}});
  try{
    approve(harness.store,harness.state,{allowDynamic:9});
    harness.state.run='run_wf';harness.state.from='term_kernel';
    harness.state.iterations=1;
    const node={id:'demo.sales.implementation.backend.intake',path:'features/sales/implementation/backend/intake/index.yaml'};
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,wait:noWait,decide:()=>{throw Error('a depth bound is not a decision');},
      work:{at:{repoRoot:cwd,workRoot:`${cwd}/.starciwork`},loaded:{list:[node]},node:id=>id===node.id?node:null}};
    const deep=harness.state.ops.find(item=>item.id==='op-a');
    Object.assign(deep,{status:'running',dispatch:'disp_deep',terminal:'term_deep',runtime:'qwen3.8-flash',
      sharedDepth:2,nodeId:node.id});
    const report=buildReport({outcome:'blocked',run:'run_wf',task:'task_a',dispatch:'disp_deep',from:'term_deep',
      summary:'op-a cannot make the change alone.',
      blocker:{kind:'shared-change',detail:'packages/platform/runtime.ts must expose the span before anything else can'}});
    report.sent={messageId:'msg_a',sentAt:1,type:report.signal.type};
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,deep,report,ctx),'shared-authored');
    const authored=events(harness.store).find(event=>event.event==='shared-authored');
    assert.deepEqual([authored.op,authored.node,authored.depth,authored.paths],
      ['op-a','.starciwork/features/sales/implementation/shared-op-a/index.yaml',2,['packages/platform/runtime.ts']]);
    const author=harness.state.ops.find(item=>item.id===authored.author);
    assert.deepEqual([author.kind,author.origin,author.allowlist],
      ['work.author','ledger',['.starciwork/features/sales/implementation/shared-op-a/index.yaml','.starciwork/features/sales/implementation/shared-op-a/**']]);
    assert.deepEqual(author.sharedAuthored,['packages/platform/runtime.ts']);
    assert.match(author.goal,/do not make the change/);
    // The requester waits for that node's record exactly as it waits for any shared op, and nothing is asked.
    assert.deepEqual([deep.status,deep.waitingFor],['paused',author.id]);
    assert.equal(harness.state.needUser.some(item=>item.kind==='shared-depth'),false,'a mechanical bound is never the owner\'s item');
    assert.equal(events(harness.store).some(event=>event.event==='shared-change-depth'),false);
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ the dynamic-op gate */

test('an operation created at run time past the dynamic budget, or wholly outside the approved scope, becomes a needUser item instead of running',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setup({plan:salesPlan,dirty:[file],
    scripts:{'op-intake':[{outcome:'done',summary:'Intake done.',files:[file],checks:[passing('unit','npx vitest run sales')]}],
      'verify-1':[{outcome:'partial',summary:'Review round 1 rejected the work.',files:[],
        checks:[passing('review','npx vitest run sales')],open:[`${file} does not persist the receipt`]}]}});
  try{
    assert.equal(harness.state.dynamicOpsBudget,DYNAMIC_OPS_BUDGET);
    const approved=approve(harness.store,harness.state,{allowDynamic:0});
    assert.equal(approved.dynamicOpsBudget,0);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20,guards:stubGuards()});
    // The review is the kernel's own op and counts against nothing; the repair it asked for is the first dynamic op and is refused, not run.
    const refused=state.ops.find(item=>item.origin==='repair');
    assert.equal(refused.status,'blocked');
    assert.equal(refused.refusal,'dynamic-op');
    assert.equal(refused.runtime,null);
    const event=events(harness.store).find(item=>item.event==='dynamic-op-refused');
    assert.equal(event.op,refused.id);
    assert.match(event.reason,/beyond the dynamic-op budget of 0/);
    assert.match(state.needUser.find(item=>item.kind==='dynamic-op').detail,/--allow-dynamic/);
    assert.equal(state.finished.outcome,'blocked');
    // The user raising the budget reinstates exactly the ops the gate refused.
    const raised=approve(harness.store,harness.state,{allowDynamic:9});
    assert.equal(raised.dynamicOpsBudget,9);
    assert.equal(state.ops.find(item=>item.origin==='repair').status,'pending');
    assert.equal(state.needUser.some(item=>item.kind==='dynamic-op'),false);
  }finally{harness.cleanup();}
  // Scope is the second bound: a run-time op whose whole allowlist is outside the approved feature folders waits.
  // The kernel's own review is never gated; the repair it derives from a finding is.
  const scoped=setup({plan:salesPlan,dirty:['apps/agentos-controlplane/src/sales/intake.ts'],
    scripts:{'op-intake':[{outcome:'done',summary:'Intake done.',files:['apps/agentos-controlplane/src/sales/intake.ts'],
      checks:[passing('unit','npx vitest run sales')]}],
      'verify-1':[{outcome:'partial',summary:'Review round 1 rejected the work.',files:[],
        checks:[passing('review','npx vitest run sales')],open:['apps/agentos-controlplane/src/sales/intake.ts does not persist the receipt']}]}});
  try{
    approve(scoped.store,scoped.state);
    scoped.state.scope=['payments'];
    scoped.state.run='run_wf';scoped.state.from='term_kernel';
    const state=scoped.run({maxIterations:8,guards:stubGuards()});
    assert.equal(state.ops.find(item=>item.kind==='review.verify').status,'done','the review ran: kernel-origin ops are not scope-gated');
    const refused=state.ops.find(item=>item.origin==='repair');
    assert.equal(refused.status,'blocked');
    const event=events(scoped.store).find(item=>item.event==='dynamic-op-refused');
    assert.match(event.reason,/outside the approved scope payments/);
    assert.equal(state.finished.outcome,'blocked');
  }finally{scoped.cleanup();}
});

/* ------------------------------------------------------------------ resource locks, the git queue, the preflight */

test('two operations that need the same resource never run at once, the contract lists the locks, and the gates run with nothing running',()=>{
  const file=name=>`apps/agentos-controlplane/src/${name}/index.ts`;
  const plan={definitionOfDone:['both slices work'],ledger:[{id:'goal-1',title:'Sales slice',inputRef:'sds:3',status:'absent'}],
    ops:['intake','receipt'].map(name=>({id:`op-${name}`,kind:'backend.implement',goal:`Implement ${name}.`,ledgerIds:['goal-1'],
      allowlist:[file(name)],references:['sds.md'],resources:['postgres'],
      checks:[{name:'integration',command:`npx vitest run ${name}`}],acceptance:[`${name} works`],dependsOn:[]}))};
  const done=name=>({outcome:'done',summary:`${name} done.`,files:[file(name)],checks:[passing('integration',`npx vitest run ${name}`)]});
  const gateRuns=[];
  const harness=setup({plan,gates:['unit=npm test'],dirty:[file('intake'),file('receipt')],
    scripts:{'op-intake':[done('intake')],'op-receipt':[done('receipt')],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('integration','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({guards:stubGuards(),exec:command=>{
      // The job gates are the kernel's own commands and are never run beside a live operation.
      if(command==='npm test')gateRuns.push(harness.state.ops.filter(op=>op.status==='running').map(op=>op.id));
      return {status:0,stdout:`${command} ok`,stderr:''};
    }});
    const log=events(harness.store);
    const deferred=log.find(event=>event.event==='schedule-deferred'&&/resource lock/.test(event.reason));
    assert.ok(deferred,'the second operation was deferred by the resource lock');
    assert.deepEqual(deferred.resources,['postgres']);
    assert.equal(deferred.clashes.length,1);
    const launches=log.filter(event=>event.event==='launched').map(event=>event.op);
    const waits=log.filter(event=>event.event==='wait');
    assert.deepEqual(launches.slice(0,2),['op-intake','op-receipt']);
    assert.ok(log.findIndex(event=>event.event==='launched'&&event.op==='op-receipt')>log.indexOf(waits[0]),
      'the second operation launched only after a wait, never beside the first');
    const contract=fs.readFileSync(harness.store.contractPath('op-intake'),'utf8');
    assert.match(contract,/## Resources/);
    assert.match(contract,/- `postgres`/);
    assert.ok(gateRuns.length>=1,'the gates ran');
    for(const snapshot of gateRuns.filter(Array.isArray))assert.deepEqual(snapshot,[],'a gate ran while an operation was running');
    assert.equal(state.finished.outcome,'done');
  }finally{harness.cleanup();}
});

test('the preflight runs once at the start, its problems become needUser items, and every kernel git mutation goes through the queue',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setup({plan:salesPlan,dirty:[file],
    scripts:{'op-intake':[{outcome:'done',summary:'Intake done.',files:[file],checks:[passing('unit','npx vitest run sales')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('review','npx vitest run sales')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const order=[];
    const guards=stubGuards({
      preflight:()=>({ok:false,fixes:['set core.longpaths true so a deep evidence path can be written'],
        problems:['the pre-commit secrets guard does not honour ALLOW_SECRET_SCAN']}),
      gitQueue:fn=>{order.push('queue-enter');try{return fn();}finally{order.push('queue-exit');}}
    });
    const state=harness.run({guards,git:(executable,args)=>{order.push(args[0]);return harness.git.git(executable,args);}});
    const preflight=events(harness.store).filter(event=>event.event==='preflight');
    assert.equal(preflight.length,1,'the preflight is one call per run, not one per iteration');
    assert.equal(preflight[0].ok,false);
    assert.deepEqual(preflight[0].fixes,['set core.longpaths true so a deep evidence path can be written']);
    assert.equal(state.preflight.problems.length,1);
    assert.deepEqual(state.needUser.filter(item=>item.kind==='environment').map(item=>item.detail),
      ['the pre-commit secrets guard does not honour ALLOW_SECRET_SCAN']);
    // The operation commit is one serialized block: nothing else touches the index inside it.
    const add=order.indexOf('add');
    assert.deepEqual(order.slice(add-1,add+4),['queue-enter','add','commit','rev-parse','queue-exit']);
    assert.equal(state.finished.outcome,'blocked','a preflight problem the kernel cannot fix stops the workflow at the user');
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ run binding and inferred rate limits */

test('a second workflow-run process is refused before run binding or terminal effects',async()=>{
  const repo=tmp(),host=path.resolve('.'),functions={assessGoal:()=>({ok:true,provider:'fake',value:salesPlan}),critiqueGoal:soundCritique,extractMaterial:()=>[]};
  const fake=scriptedOrca({reportsDir:path.join(repo,'reports'),scripts:{}});let child;
  try{
    const created=kernelMain('workflow-goal',{job:'Lock the sales slice',host},{orca:fake.orca,cwd:repo,functions});kernelMain('workflow-approve',{id:created.id},{orca:fake.orca,cwd:repo});
    child=spawn(process.execPath,['-e','setTimeout(()=>{},30000)'],{stdio:'ignore',windowsHide:true});
    const store=createStore({repoRoot:repo,id:created.id});const reserved=reserveStartup(store.dir,{pid:child.pid});assert.equal(reserved.ok,true);
    const running=(await import('../kernel/startup-lock.mjs')).acquireStartup(store.dir,{launchToken:reserved.token,pid:child.pid});fs.writeFileSync(path.join(store.dir,'kernel.lock'),JSON.stringify({pid:child.pid,startedAt:Date.now(),startupToken:running.token}));
    fake.terminals.set('term_live_worker',{handle:'term_live_worker',title:'[Op] live',status:'running',sent:true,worktreePath:repo});
    const before=fake.terminals.size;assert.throws(()=>kernelMain('workflow-run',{id:created.id,'max-iterations':'0'},{orca:fake.orca,cwd:repo,functions}),/another kernel or unresolved launch/);
    assert.equal(fake.terminals.size,before,'no coordinator terminal was created or native worker swept');assert.equal(fake.terminals.has('term_live_worker'),true);
    assert.equal(store.readEvents().some(event=>['run-bound','run-resumed'].includes(event.event)),false);
  }finally{if(child)try{child.kill();}catch{}fs.rmSync(repo,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('a kernel that already has its run records run-resumed; only a real bind records run-bound',()=>{
  const repo=tmp();
  spawnSync('git',['init','--quiet'],{cwd:repo,encoding:'utf8',windowsHide:true});
  const functions={assessGoal:()=>({ok:true,provider:'fake',value:salesPlan}),critiqueGoal:soundCritique,extractMaterial:()=>[]};
  const {orca}=scriptedOrca({reportsDir:path.join(repo,'reports'),scripts:{}});
  try{
    const host=path.resolve('.');
    const resumedGoal=kernelMain('workflow-goal',{job:'Resume the sales slice',host},{orca,cwd:repo,functions});
    kernelMain('workflow-approve',{id:resumedGoal.id},{orca,cwd:repo});
    kernelMain('workflow-run',{id:resumedGoal.id,from:'term_kernel',run:'run_wf','max-iterations':'0'},{orca,cwd:repo,functions});
    const resumedEvents=createStore({repoRoot:repo,id:resumedGoal.id}).readEvents().map(event=>event.event);
    assert.ok(resumedEvents.includes('run-resumed'));
    assert.equal(resumedEvents.includes('run-bound'),false);
    const boundGoal=kernelMain('workflow-goal',{job:'Bind the sales slice',host},{orca,cwd:repo,functions});
    kernelMain('workflow-approve',{id:boundGoal.id},{orca,cwd:repo});
    kernelMain('workflow-run',{id:boundGoal.id,from:'term_kernel','max-iterations':'0'},{orca,cwd:repo,functions});
    // Without a handle and without a launch file (the supervisor started it), the kernel opens its own terminal.
    const ownGoal=kernelMain('workflow-goal',{job:'Own terminal for the sales slice',host},{orca,cwd:repo,functions});
    kernelMain('workflow-approve',{id:ownGoal.id},{orca,cwd:repo});
    kernelMain('workflow-run',{id:ownGoal.id,'max-iterations':'0'},{orca,cwd:repo,functions});
    const ownEvents=createStore({repoRoot:repo,id:ownGoal.id}).readEvents();
    const opened=ownEvents.find(event=>event.event==='kernel-terminal');
    assert.match(opened.terminal,/^term_/);
    assert.equal(ownEvents.find(event=>event.event==='run-bound').from,opened.terminal,'the kernel is the terminal it opened');
    const boundEvents=createStore({repoRoot:repo,id:boundGoal.id}).readEvents().map(event=>event.event);
    assert.ok(boundEvents.includes('run-bound'));
    assert.equal(boundEvents.includes('run-resumed'),false);
  }finally{fs.rmSync(repo,{recursive:true,force:true});}
});

/**
 * An ask op holding a provision waits for the owner in its tab by design, so its idleness is the wait and the
 * stall detector leaves it alone; an ask op on any other question is provisional, never waits, and an idle one
 * is nudged like any other op.
 */
/**
 * An attempt past its deadline is over whatever the liveness probe says: it is settled as an overrun and relaunched
 * on another runtime, and a job gate waiting behind its allowlist is not held for a day by a probe that says "working".
 */
test('an op past its deadline is settled as an overrun and relaunched elsewhere, whatever the probe says',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    let clock=0;
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>clock,work:null};
    const op=running(harness.state,'op-intake','ctx_long','gpt-6-astra');
    op.kind='review.verify';op.launchedAt=0;
    clock=2*60*60*1000;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_long',liveness:'working'}]});
    assert.equal(op.status,'running','two hours is inside a review\'s three');
    clock=4*60*60*1000;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_long',liveness:'working'}]});
    const overrun=events(harness.store).find(event=>event.event==='op-overrun');
    assert.deepEqual([overrun.op,overrun.runtime,overrun.deadlineMs],['op-intake','gpt-6-astra',3*60*60*1000]);
    assert.equal(op.status,'ready');
    assert.equal(op.restarts,1);
    assert.ok(op.avoidRuntimes.includes('gpt-6-astra'),'the runtime that never came back is avoided for the cooldown');
  }finally{harness.cleanup();}
});

/**
 * The five readings of a tab the probe called `stalled-idle`. `telegram-bot-author` was called idle
 * thirty-nine seconds after its launch, nudged, settled, relaunched, settled and cooled, and the kernel never
 * looked at the screen that said which of these five things was happening.
 */
const stalledTab=(harness,{dispatch,lines,kind=null})=>{
  const op=running(harness.state,'op-intake',dispatch);
  if(kind)op.kind=kind;
  harness.fake.setScreen(op.terminal,lines);
  return op;
};

test('a retry refunds the probation its retired generations consumed for unfinished operations, on the record',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    const state=harness.state;
    state.engine={schema:'starci/engine@1',generation:3};
    state.modelEligibility={probationBudget:{initial:6,remaining:2},probationScopes:{
      'wf/op-intake/backend.implement/implement':{initial:2,remaining:0,consumedJobs:['j1','j2'],refundedJobs:[],consumedReceipts:[
        {jobId:'j1',runtimeId:'gpt-5.6-sol',workflowId:state.id,opId:'op-intake',generation:1,at:1},
        {jobId:'j2',runtimeId:'claude-opus',workflowId:state.id,opId:'op-intake',generation:2,at:2}]},
      'wf/op-done/backend.implement/implement':{initial:2,remaining:1,consumedJobs:['j9'],refundedJobs:[],consumedReceipts:[{jobId:'j9',runtimeId:'gpt-5.6-sol',workflowId:state.id,opId:'op-done',generation:1,at:1}]}}};
    state.ops.push({id:'op-done',kind:'backend.implement',status:'done',allowlist:[],references:[],checks:[],acceptance:[],dependsOn:[],ledgerIds:[],reports:[]});
    const asked=[];
    const runtime={refundUnbegunProbation(op,proof,identity){asked.push([op.id,proof.code,proof.jobId,proof.generation,identity.probationRuntime]);return {ok:true,code:'probation-refunded'};}};
    const result=refundRetiredGenerationProbations(harness.store,state,runtime,{generation:3});
    assert.deepEqual(asked,[['op-intake','runtime-restart-settlement','j1',1,'gpt-5.6-sol'],['op-intake','runtime-restart-settlement','j2',2,'claude-opus']],'a done operation is not refunded, a current-generation receipt is not either');
    assert.equal(result.refunded.length,2);
    const event=events(harness.store).find(item=>item.event==='retired-generation-probation-refunded');
    assert.deepEqual(event.refunded.map(item=>item.jobId),['j1','j2']);
  }finally{harness.cleanup();}
});

test('a partial report advances the attempt once, whichever side advanced it: the typed settlement or the resume',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('no decision');}};
    const op=running(harness.state,'op-intake','ctx_p');
    const report=buildReport({outcome:'partial',run:'run_wf',task:'task_p',dispatch:'ctx_p',from:'term_ctx_p',summary:'half done',open:['the rest']});
    report.sent={messageId:'msg_p',sentAt:1,type:report.signal.type};
    op.attempt=2;op.attemptAdvanced=true;
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,op,report,ctx),'resume');
    assert.equal(op.attempt,2,'the settlement already advanced it');
    assert.equal(op.attemptAdvanced,undefined);
    const again=running(harness.state,'op-intake','ctx_p2');again.attempt=2;
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,again,{...report,dispatch:'ctx_p2'},ctx),'resume');
    assert.equal(again.attempt,3,'without the settlement the resume advances it');
  }finally{harness.cleanup();}
});

test('a tab the heuristics call idle is read once more by the perception model: working waits, idle nudges as before',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const idleFrame=['=== TASK === op-intake','● Reconciling the intake records.','','❯','  ⏵⏵ bypass permissions on'];
    const seen=[];
    const perceive=({lines,providers})=>{seen.push({lines,providers});return {ok:true,verdict:'working',reason:'a status line is drawing below the fold',provider:'qwen3.8-flash'};};
    let now=LONG_CONTRACT_GRACE_MS+1;
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>now,work:null,perceive,
      runtimeProfile:{allocation:{tiers:{easy:['qwen3.8-flash','claude-opus']}},runtimes:{'qwen3.8-flash':{provider:'qwen',roles:['implement','verify']},'claude-opus':{provider:'claude',roles:['implement','decide']}}}};
    const op=stalledTab(harness,{dispatch:'ctx_idle',lines:idleFrame});
    op.launchedAt=0;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_idle',liveness:'stalled-idle'}]});
    assert.equal(seen.length,1,'the model read the tab once');
    assert.deepEqual(seen[0].providers,['qwen3.8-flash'],'the cheapest verify-capable tier reads screens');
    assert.deepEqual(events(harness.store).filter(event=>['nudged','settled'].includes(event.event)),[],'working means wait');
    const perception=events(harness.store).find(event=>event.event==='perception');
    assert.deepEqual([perception.op,perception.verdict,perception.provider],['op-intake','working','qwen3.8-flash']);
    assert.equal(op.status,'running');
    // Within the grace window the reading stands without another call.
    now+=PERCEPTION_GRACE_MS-1000;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_idle',liveness:'stalled-idle'}]});
    assert.equal(seen.length,1);
    assert.equal(events(harness.store).filter(event=>event.event==='nudged').length,0);
    // After it, the model says idle: the tab is nudged exactly as it was before the sense existed.
    now+=2000;
    ctx.perceive=()=>({ok:true,verdict:'idle',reason:'the prompt is empty and nothing runs',provider:'qwen3.8-flash'});
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_idle',liveness:'stalled-idle'}]});
    assert.equal(events(harness.store).filter(event=>event.event==='nudged').length,1);
    assert.equal(op.nudged,true);
    // Nudged and still idle at the next reading: settled as before, but as the kernel's own perception - the
    // incident is recorded and the runtime is not avoided.
    now+=PERCEPTION_GRACE_MS+1000;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_idle',liveness:'stalled-idle'}]});
    assert.equal(events(harness.store).filter(event=>event.event==='settled').length,1);
    const incident=events(harness.store).find(event=>event.event==='runtime-incident');
    assert.deepEqual([incident.kind,incident.op,incident.attempt,incident.refunded],['perception-settlement','op-intake',1,false],'no engine runtime here, so nothing to refund; the incident still stands');
    assert.deepEqual(op.avoidRuntimes??[],[],'the same runtime may take the operation again');
    assert.equal(op.status,'ready');
  }finally{harness.cleanup();}
});

test('a tab the contract never reached is relaunched, and the operation is not charged a restart for it',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null};
    const op=stalledTab(harness,{dispatch:'ctx_blank',
      lines:['>_ OpenAI Codex (v0.20.0)','   model: gpt-5.6-sol','▌ Ask Codex anything']});
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_blank',liveness:'stalled-idle'}]});
    const read=events(harness.store).find(event=>event.event==='tab-read');
    assert.deepEqual([read.op,read.verdict],['op-intake','prompt-missing']);
    assert.equal(op.status,'ready','the launch is tried again');
    assert.equal(op.restarts,0,'the agent did nothing: the prompt never reached its tab');
    assert.equal(op.infraRestarts,1);
    assert.deepEqual(op.avoidRuntimes,[],'the same runtime may take it again');
    assert.deepEqual(events(harness.store).map(event=>event.event).filter(name=>['nudged','settled'].includes(name)),[]);
  }finally{harness.cleanup();}
});

test('a tab whose last words are a question is routed as the ask report the operation never wrote',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null};
    const op=stalledTab(harness,{dispatch:'ctx_q',
      lines:['=== TASK ===','● I found two ways to wire the webhook.','● Should I proceed with option 2?','','❯']});
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_q',liveness:'stalled-idle'}]});
    const read=events(harness.store).find(event=>event.event==='tab-read');
    assert.deepEqual([read.verdict,read.text],['asked','Should I proceed with option 2?']);
    const opened=events(harness.store).find(event=>event.event==='owner-ask-opened');
    assert.equal(opened.op,'op-intake');
    const ask=harness.state.ops.find(item=>item.id===opened.ask);
    assert.equal(ask.question.text,'Should I proceed with option 2?');
    assert.equal(op.restarts,0,'a question is not a stall and is never restarted away');
    // The report file the operation would have written is on disk, marked as the tab's reading.
    const written=fs.readdirSync(harness.store.paths.reports).find(name=>name.startsWith('ctx_q.json'));
    assert.match(written,/^ctx_q\.json\.asked-/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(harness.store.paths.reports,written),'utf8')).via,'tab-read');
  }finally{harness.cleanup();}
});

test('a tab that finished its turn without a report is judged as a failed report carrying its last words',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null};
    const op=stalledTab(harness,{dispatch:'ctx_fin',
      lines:['=== TASK ===','● I updated the intake module and the unit tests pass.',
        '  node L.mjs report --run run_wf --outcome done','  Error: Cannot find module \'L.mjs\'','','❯']});
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_fin',liveness:'stalled-idle'}]});
    const read=events(harness.store).find(event=>event.event==='tab-read');
    assert.equal(read.verdict,'finished-unreported');
    assert.equal(op.status,'ready');
    assert.equal(op.attempt,2,'the ordinary retry, not a blind restart');
    assert.equal(op.restarts,0);
    assert.match(op.findings.join('\n'),/Cannot find module/,'the last words are the next attempt\'s finding');
  }finally{harness.cleanup();}
});

test('a tab still drawing a turn is not nudged and not settled: the wait is simply extended',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null};
    const op=stalledTab(harness,{dispatch:'ctx_busy',
      lines:['⠧ Report task outcome','  Read 1 file, listed 3 directories, ran 9 shell commands','','❯']});
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_busy',liveness:'stalled-idle'}]});
    assert.equal(events(harness.store).find(event=>event.event==='tab-read').verdict,'working');
    assert.equal(op.status,'running');
    assert.equal(op.nudged,false);
    assert.equal(op.restarts,0);
    assert.deepEqual(events(harness.store).map(event=>event.event).filter(name=>['nudged','settled'].includes(name)),[]);
  }finally{harness.cleanup();}
});

test('an operation that authors a record is owed three minutes before any stall verdict; an ordinary one is not',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    let clock=0;
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>clock,work:null};
    const op=stalledTab(harness,{dispatch:'ctx_author',kind:'work.author',
      lines:['=== TASK ===','Task id: task_1','● Opening the contract.','','❯']});
    op.launchedAt=0;
    clock=39*1000;
    const idle=()=>settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_author',liveness:'stalled-idle'}]});
    idle();
    const grace=events(harness.store).find(event=>event.event==='stall-grace');
    assert.deepEqual([grace.op,grace.kind,grace.graceMs],['op-intake','work.author',3*60*1000]);
    assert.equal(op.nudged,false,'thirty-nine seconds into a long contract is not evidence of anything');
    assert.deepEqual(events(harness.store).map(event=>event.event).filter(name=>['nudged','settled','tab-read'].includes(name)),[]);
    clock=4*60*1000;
    idle();
    assert.equal(op.nudged,true,'past the grace the tab is read and an idle one is nudged as before');
    // A build with an ordinary contract has no grace at all: the same thirty-nine seconds settle it as before.
    const plain=stalledTab(harness,{dispatch:'ctx_plain',kind:'backend.implement',lines:harness.fake.IDLE_TAB});
    plain.launchedAt=clock;plain.nudged=true;
    clock+=39*1000;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_plain',liveness:'stalled-idle'}]});
    assert.equal(events(harness.store).filter(event=>event.event==='settled').length,1);
  }finally{harness.cleanup();}
});

test('an ask op waiting for a provision is not a stalled op; one on a provisional question is nudged like any other',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null};
    const ask=running(harness.state,'op-intake','ctx_ask');
    ask.kind='provision.ask';ask.origin='ask';ask.question={kind:'credential',text:'TELEGRAM_BOT_TOKEN',options:[],from:'op-x'};
    const before=events(harness.store).length;
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_ask',liveness:'stalled-idle'}]});
    assert.equal(ask.status,'running');
    assert.deepEqual(events(harness.store).slice(before).filter(event=>['nudged','settled'].includes(event.event)),[],'the wait for the owner is not a stall');
    ask.kind='decision.prepare';ask.question={kind:'decision',text:'Which window?',options:[],from:'op-x'};
    settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch:'ctx_ask',liveness:'stalled-idle'}]});
    assert.deepEqual(events(harness.store).slice(before).map(event=>event.event).filter(name=>['nudged','settled'].includes(name)),['nudged']);
  }finally{harness.cleanup();}
});

test('two silent stalls of one runtime inside half an hour are inferred as a rate limit and reported to the allocator',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const failed=[];
    const allocator={...harness.allocator,failed:(runtime,info)=>failed.push([runtime,info?.reason??null])};
    let clock=0;
    const ctx={cwd,allocator,guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>clock,work:null};
    const silence=dispatch=>{
      running(harness.state,'op-intake',dispatch);
      settleStalled(harness.fake.orca,harness.store,harness.state,ctx,{liveness:[{dispatch,liveness:'stalled-silent'}]});
    };
    silence('ctx_s1');
    assert.deepEqual(failed,[],'one silence is a stall, not a rate limit');
    clock=10*60*1000;
    silence('ctx_s2');
    assert.deepEqual(failed,[['qwen-agent','rate-limited (inferred from repeated silence)']]);
    const inferred=events(harness.store).find(event=>event.event==='rate-limit-inferred');
    assert.equal(inferred.runtime,'qwen-agent');
    assert.equal(inferred.windowMs,30*60*1000);
    assert.deepEqual(harness.state.silences['qwen-agent'],[],'the window is cleared, so the inference needs two fresh silences');
    assert.ok(harness.state.ops[0].avoidRuntimes.includes('qwen-agent'));
    clock=60*60*1000;
    silence('ctx_s3');
    assert.equal(failed.length,1,'a silence outside the window does not infer a second rate limit');
  }finally{harness.cleanup();}
});

test('the kernel defaults to the real guard module when it is on disk',()=>{
  assert.equal(typeof kernelGuards.protectedPaths,'function');
  assert.equal(kernelGuards.gitQueue(()=>7),7);
  assert.deepEqual(kernelGuards.resourceLocks({kind:'backend.implement',resources:['postgres'],checks:[]}),['postgres']);
  assert.equal(kernelGuards.resourcesClash({resources:['docker']},{resources:['docker']}),true);
  assert.equal(kernelGuards.resourcesClash({resources:['docker']},{resources:['postgres']}),false);
});

test('reconcile settles a live dispatch no operation names, and a repeated anomaly is triaged once through a closed option set',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    running(harness.state,'op-intake','ctx_known');
    harness.fake.live.set('ctx_known',{id:'ctx_known',task:'task_k',handle:'term_k'});
    harness.fake.live.set('ctx_orphan',{id:'ctx_orphan',task:'task_o',handle:'term_o'});
    const reconciled=reconcileWithOrca(harness.fake.orca,harness.store,harness.state,{cwd,wait:noWait});
    assert.deepEqual(reconciled.orphans.map(item=>item.dispatch),['ctx_orphan']);
    assert.ok(harness.fake.live.has('ctx_known'),'the dispatch an operation names is left alone');
    assert.ok(!harness.fake.live.has('ctx_orphan'),'the orphan is released');
    assert.equal(events(harness.store).at(-1).event,'reconciled-orphans');

    // The other direction: a running op whose dispatch Orca no longer lists and whose terminal is gone is dead:
    // settled, its runtime released, queued again; one whose terminal still exists is left alone.
    harness.state.ops.push({...structuredClone(harness.state.ops[0]),id:'op-ship',status:'pending',dispatch:null,terminal:null,runtime:null,restarts:0});
    running(harness.state,'op-ship','ctx_gone');harness.state.ops.find(op=>op.id==='op-ship').terminal='term_gone';
    harness.fake.terminals.set('term_k',{handle:'term_k',title:'k',status:'running',sent:true,worktreePath:cwd,lastOutputAt:Date.now()});
    const released=[];
    const dead=reconcileWithOrca(harness.fake.orca,harness.store,harness.state,{cwd,wait:noWait,allocator:{release:runtime=>released.push(runtime)}});
    assert.deepEqual(dead.dead.map(item=>[item.op,item.restarts]),[['op-ship',1]]);
    assert.deepEqual(released,['qwen-agent']);
    const ship=harness.state.ops.find(op=>op.id==='op-ship');
    assert.equal(ship.status,'ready');assert.equal(ship.dispatch,null);
    assert.equal(harness.state.ops.find(op=>op.id==='op-intake').status,'running','a dispatch Orca still lists is alive');
    assert.equal(events(harness.store).at(-1).event,'reconciled-dead');

    const asked=[];
    const decide=({situation,options})=>{asked.push({situation,options});return {ok:true,value:{option:'park-runtime',rationale:'the runtime keeps dying'}};};
    const parked=[];
    const ctx={cwd,allocator:{...harness.allocator,failed:(runtime,info)=>parked.push([runtime,info.reason])},guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null,decide,orca:harness.fake.orca};
    for(let count=1;count<=TRIAGE_AFTER;count+=1){
      noteAnomaly(harness.store,harness.state,'settled:op-intake:dead',{op:'op-intake',runtime:'qwen-agent',liveness:'dead'});
      assert.equal(triageAnomaly(harness.store,harness.state,'settled:op-intake:dead',ctx),count<TRIAGE_AFTER?null:'park-runtime');
    }
    assert.equal(asked.length,1,'the model is asked exactly once per signature');
    assert.deepEqual(asked[0].options,TRIAGE_OPTIONS);
    assert.deepEqual(parked,[['qwen-agent','triage: settled:op-intake:dead']]);
    noteAnomaly(harness.store,harness.state,'settled:op-intake:dead',{});
    assert.equal(triageAnomaly(harness.store,harness.state,'settled:op-intake:dead',ctx),null,'a triaged signature is a rule now, not another call');
    const triaged=events(harness.store).find(event=>event.event==='triage');
    assert.equal(triaged.option,'park-runtime');
    assert.equal(triageAnomaly(harness.store,harness.state,'missing',{}),null,'no decider or no entry is a no-op');
  }finally{harness.cleanup();}
});

/**
 * The defect this rule answers: a dozen Codex operations finished their work, told Orca they could not run the
 * kernel's report command (the launcher was not on disk), and were recorded as "dead: no worker and no
 * terminal" - charged a restart each and launched again from scratch. The last words are read first now.
 */
const lastFailure=value=>JSON.stringify(value);
const reportBody='I removed the unrelated helper and wrote the decision record. The prescribed tree validator passed, '
  +'but the contract report command failed with MODULE_NOT_FOUND for D:/repo/.dist/execution/orca-supervised-launch.mjs';

test('a dispatch that left last words is not dead: the worker report becomes the op\'s own report, and the body comes back as its finding',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const op=running(harness.state,'op-intake','ctx_words');
    op.terminal='term_words';op.task='task_words';
    harness.fake.shows.set('ctx_words',{status:'failed',last_failure:lastFailure({provenance:'worker_report',outcome:'failed',
      subject:'Decision prepared; contract reporter missing',body:reportBody})});
    const released=[];
    const reconciled=reconcileWithOrca(harness.fake.orca,harness.store,harness.state,{cwd,wait:noWait,allocator:{release:runtime=>released.push(runtime)}});

    assert.deepEqual(reconciled.dead.map(item=>[item.op,item.cause,item.restarts]),[['op-intake','worker-report',0]],
      'the op keeps its restart count: the report command failed, the operation did not');
    assert.equal(reconciled.dead[0].lastWords.subject,'Decision prepared; contract reporter missing');
    assert.equal(reconciled.dead[0].lastWords.body,reportBody.slice(0,200),'the event carries the head of the body, not the whole of it');
    assert.deepEqual(released,[],'the runtime stays taken: the op is still running, and acceptReports releases it with the report');
    assert.equal(op.status,'running');assert.equal(op.dispatch,'ctx_words');
    const spoke=events(harness.store).find(event=>event.event==='dispatch-last-words');
    assert.deepEqual([spoke.op,spoke.dispatch,spoke.outcome,spoke.subject],
      ['op-intake','ctx_words','failed','Decision prepared; contract reporter missing']);

    // The report file is a report like any other: the ordinary acceptance path reads it on the next tick.
    const written=JSON.parse(fs.readFileSync(harness.store.reportPath('ctx_words'),'utf8'));
    assert.equal(written.schema,'starci/op-report@1');
    assert.equal(written.outcome,'failed');
    assert.equal(written.via,'orca-worker-report');
    assert.deepEqual([written.files,written.checks],[[],[]]);
    assert.match(written.summary,/Decision prepared; contract reporter missing - I removed the unrelated helper/);
    const ctx={cwd,allocator:harness.allocator,guards:stubGuards(),git:harness.git.git,exec:()=>({status:0,stdout:'',stderr:''}),
      now:()=>0,work:null,wait:noWait,decide:()=>{throw Error('last words are not a decision');},validateOp:acceptAll};
    assert.equal(applyOpReport(harness.fake.orca,harness.store,harness.state,op,written,ctx),'retry');
    const retry=events(harness.store).findLast(event=>event.event==='retry');
    assert.match(retry.findings.join(' '),/contract report command failed with MODULE_NOT_FOUND/);
  }finally{harness.cleanup();}
});

test('a restart the environment caused is charged to the environment: infraRestarts counts it, the op is never cooled, and only its own cap reaches the owner',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    harness.fake.shows.set('ctx_stalled',{status:'failed',last_failure:lastFailure({provenance:'orca',reason:'agent_prompt_stalled'})});
    const op=harness.state.ops[0];
    const owner=harness.state.needUser.length;
    for(let round=1;round<=RESTART_LIMIT+2;round+=1){
      Object.assign(op,{status:'running',dispatch:'ctx_stalled',runtime:'qwen3.8-flash',terminal:'term_stalled'});
      const reconciled=reconcileWithOrca(harness.fake.orca,harness.store,harness.state,{cwd,wait:noWait});
      assert.deepEqual(reconciled.dead.map(item=>[item.cause,item.restarts,item.infraRestarts]),[['infrastructure',0,round]]);
      assert.equal(op.status,'ready',`round ${round}: a prompt Orca never delivered never blocks the op`);
      assert.equal(op.refusal,null,'an infrastructure restart never cools the op');
      assert.equal(op.restarts,0,'the op is charged nothing it did not do');
    }
    assert.equal(harness.state.needUser.length,owner,'past the ordinary restart limit the op is still running, not on the owner\'s list');
    assert.match(op.infraCause,/agent_prompt_stalled/);

    // A truly broken environment still surfaces - under its own, higher cap, and naming the last cause.
    op.infraRestarts=INFRA_RESTART_LIMIT;
    Object.assign(op,{status:'running',dispatch:'ctx_stalled',runtime:'qwen3.8-flash',terminal:'term_stalled'});
    reconcileWithOrca(harness.fake.orca,harness.store,harness.state,{cwd,wait:noWait});
    assert.equal(op.status,'blocked');
    assert.equal(harness.state.needUser.length,owner+1);
    assert.equal(harness.state.needUser.at(-1).kind,'environment');
    assert.match(harness.state.needUser.at(-1).detail,/never to its own work: the task was never delivered to the agent/);
  }finally{harness.cleanup();}
});

test('the infrastructure causes are the ones the runtime owns; a failure of the work itself is the op\'s',()=>{
  assert.match(infrastructureCause('Error [ERR_MODULE_NOT_FOUND]: Cannot find module'),/MODULE_NOT_FOUND/);
  assert.match(infrastructureCause('worker-start failed: agent_prompt_stalled'),/never delivered/);
  assert.match(infrastructureCause('session_not_reported'),/never reported/);
  assert.match(infrastructureCause('the agent terminal was closed by Orca'),/closed the terminal/);
  assert.match(infrastructureCause('spawn ENOENT D:/repo/.dist/execution/orca-supervised-launch.mjs'),/not on disk/);
  assert.match(infrastructureCause('ENOENT L.mjs',{launcher:'D:/repo/L.mjs'}),/not on disk \(ENOENT L\.mjs\)/);
  assert.equal(infrastructureCause('npx vitest run sales exited 1'),null);
  assert.equal(infrastructureCause('ENOENT ./fixtures/orders.json'),null,'a file the operation\'s own work is missing is the operation\'s');
  assert.equal(infrastructureCause(null),null);
});

/* ------------------------------------------------------------------ the validator */

const intakeFile='apps/agentos-controlplane/src/sales/intake.ts',receiptFile='apps/agentos-controlplane/src/sales/receipt.ts';
const twoOpPlan={definitionOfDone:['the slice works'],ledger:[{id:'goal-1',title:'Order intake',inputRef:'sds:3',status:'absent'}],
  ops:[{id:'op-intake',kind:'backend.implement',goal:'Implement intake.',ledgerIds:['goal-1'],allowlist:[intakeFile],
    references:['sds.md#3'],checks:[{name:'unit',command:'npx vitest run intake'}],acceptance:['intake persists'],dependsOn:[]},
    {id:'op-receipt',kind:'backend.implement',goal:'Implement the receipt.',ledgerIds:['goal-1'],allowlist:[receiptFile],
      references:['sds.md#4'],checks:[{name:'unit',command:'npx vitest run receipt'}],acceptance:['the receipt renders'],dependsOn:[]}]};
const doneReport=(file,name)=>({outcome:'done',summary:`${name} implemented.`,files:[file],checks:[passing('unit',`npx vitest run ${name}`)]});
const reviewPassed={outcome:'done',summary:'Review passed.',files:[],checks:[passing('review','npx vitest run intake')]};
/** The fake worktree git answers `diff` with one hunk per requested file, so the validator input carries a real-looking diff. */
const diffGit=git=>(executable,args)=>{
  if(args[0]==='diff'){const files=args.slice(args.indexOf('--')+1);return {status:0,stdout:files.map(file=>`diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n+export const changed='${path.basename(file)}';\n`).join(''),stderr:''};}
  return git(executable,args);
};

test('the validator accepts a result the kernel reproduced: the commit follows, the verdict is remembered and the next call carries that memory',()=>{
  const seen=[];
  const validator=input=>{seen.push(input);return {ok:true,verdict:'accept',summary:`${input.op.id} satisfies its acceptance`,findings:[],dropped:[],provider:'gpt-5.6-sol',usage:{input:900,output:40,total:940,cost:null}};};
  const harness=setup({plan:twoOpPlan,dirty:[intakeFile,receiptFile],
    scripts:{'op-intake':[doneReport(intakeFile,'intake')],'op-receipt':[doneReport(receiptFile,'receipt')],'verify-1':[reviewPassed]}});
  try{
    fs.writeFileSync(path.join(harness.store.dir,'rulings.md'),'Never accept a spec without an assertion.\n');
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({validateOp:validator,git:diffGit(harness.git.git),validator:['gpt-5.6-sol','claude-opus']});
    assert.equal(state.finished.outcome,'done');
    // Exactly the two implementing results were judged; the review changed no file, so it was skipped on the record.
    assert.deepEqual(seen.map(input=>input.op.id),['op-intake','op-receipt']);
    const first=seen[0];
    assert.deepEqual(first.providers,['gpt-5.6-sol','claude-opus']);
    assert.deepEqual(first.diff.files,[intakeFile]);
    assert.match(first.diff.text,/\+export const changed='intake\.ts';/);
    assert.equal(first.diff.truncated,false);
    assert.deepEqual(first.checks.map(check=>[check.name,check.exitCode]),[['unit',0]]);
    assert.deepEqual(first.references,['sds.md#3']);
    assert.deepEqual(first.op.acceptance,['intake persists']);
    assert.equal(first.memory,'','the first call of a workflow has no verdict to remember yet');
    // The second call carries the first verdict and the job rulings: one identity across ops.
    assert.match(seen[1].memory,/## Job rulings \(binding\)\n\nNever accept a spec without an assertion\./);
    assert.match(seen[1].memory,/- op-intake \| accept \| op-intake satisfies its acceptance/);
    const log=events(harness.store);
    const validated=log.filter(event=>event.event==='validated');
    assert.deepEqual(validated.map(event=>[event.op,event.summary,event.provider]),[['op-intake','op-intake satisfies its acceptance','gpt-5.6-sol'],['op-receipt','op-receipt satisfies its acceptance','gpt-5.6-sol']]);
    assert.ok(log.findIndex(event=>event.event==='validated'&&event.op==='op-intake')<log.findIndex(event=>event.event==='op-done'&&event.op==='op-intake'),'the verdict precedes the commit');
    assert.deepEqual(log.filter(event=>event.event==='validator-skipped').map(event=>event.op),['verify-1']);
    const intake=state.ops.find(op=>op.id==='op-intake');
    assert.equal(intake.status,'done');
    assert.deepEqual([intake.validation.verdict,intake.validation.provider,intake.validation.summary],['accept','gpt-5.6-sol','op-intake satisfies its acceptance']);
    // Memory and verdict log live under the store, kernel-written.
    const verdicts=fs.readFileSync(path.join(harness.store.dir,'validator','verdicts.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert.deepEqual(verdicts.map(item=>[item.op,item.verdict,item.provider,item.usage.total,item.head]),[['op-intake','accept','gpt-5.6-sol',940,'abc1234'],['op-receipt','accept','gpt-5.6-sol',940,'abc1234']]);
    const memory=readValidatorMemory(harness.store);
    assert.match(memory,/^# Validator memory - workflow 20260912-104251-kernel-spec/);
    assert.match(memory,/- op-receipt \| accept \| op-receipt satisfies its acceptance\n$/);
    assert.ok(Buffer.byteLength(memory)<12*1024);
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.ops.find(op=>op.id==='op-intake').validation.verdict,'accept');
  }finally{harness.cleanup();}
});

test('a validator reject sends the op back with the finding; the second reject of the same op stops it at the user',()=>{
  const verdicts=[];
  const validator=input=>{verdicts.push(input.op.attempt);return {ok:true,verdict:'reject',summary:'the spec cannot fail',
    findings:[{file:intakeFile,line:12,assertion:'intake persists',detail:'the added spec asserts nothing about persistence'}],dropped:[],provider:'gpt-5.6-sol',usage:null};};
  const harness=setup({plan:salesPlan,dirty:[intakeFile],
    scripts:{'op-intake':[doneReport(intakeFile,'sales'),doneReport(intakeFile,'sales'),doneReport(intakeFile,'sales')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({validateOp:validator,git:diffGit(harness.git.git)});
    const op=state.ops[0];
    assert.deepEqual(verdicts,[1,2],'the op was judged twice and never launched a third time');
    assert.equal(op.status,'blocked');
    assert.equal(op.validatorRejects,VALIDATOR_REJECT_LIMIT);
    assert.equal(op.attempt,2);
    assert.deepEqual(op.reports.map(report=>report.downgradedTo),['failed','failed']);
    const log=events(harness.store);
    const retried=log.find(event=>event.event==='retry'&&event.op==='op-intake');
    assert.equal(retried.reason,'validator-reject');
    assert.equal(retried.findings[0],'validator: apps/agentos-controlplane/src/sales/intake.ts:12 [intake persists] - the added spec asserts nothing about persistence');
    // The relaunched contract carries the finding, so the operation knows what the validator refused.
    assert.match(fs.readFileSync(harness.store.contractPath('op-intake'),'utf8'),/## Findings you must resolve\n- validator: apps\/agentos-controlplane\/src\/sales\/intake\.ts:12/);
    const exhausted=log.find(event=>event.event==='validator-exhausted');
    assert.equal(exhausted.op,'op-intake');assert.equal(exhausted.rejects,2);
    assert.deepEqual(log.filter(event=>event.event==='validator-rejected').length,2);
    assert.match(state.needUser.find(item=>item.kind==='validator').detail,/op-intake was rejected by the validator 2 times: validator: apps/);
    // Nothing was ever committed: a rejected result leaves the worktree dirty for the retry, never the history.
    assert.ok(!harness.git.calls.includes('commit'));
    assert.equal(state.ledger[0].status,'planned');
    assert.equal(state.finished.outcome,'blocked');
    assert.equal(op.validation.verdict,'reject');
  }finally{harness.cleanup();}
});

test('a finding outside the diff is dropped on the record, and a reject made only of such findings is no verdict',()=>{
  const answers=[
    {verdict:'reject',summary:'receipt and intake are wrong',findings:[{file:'apps/agentos-controlplane/src/sales/receipt.ts',detail:'the receipt is not rendered'},{file:`./${intakeFile}`,detail:'intake drops the order id'}]},
    {verdict:'reject',summary:'the receipt is wrong',findings:[{file:'apps/agentos-controlplane/src/sales/receipt.ts',detail:'the receipt is not rendered'}]}
  ];
  // The real validateOp over a stubbed provider: the drop rule is the function's, the events are the kernel's.
  const validator=input=>validateOp({...input,runHeadless:()=>JSON.stringify(answers.shift())});
  const harness=setup({plan:salesPlan,dirty:[intakeFile],
    scripts:{'op-intake':[doneReport(intakeFile,'sales'),doneReport(intakeFile,'sales')],'verify-1':[reviewPassed]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({validateOp:validator,git:diffGit(harness.git.git)});
    const log=events(harness.store);
    const dropped=log.filter(event=>event.event==='validator-finding-dropped');
    assert.deepEqual(dropped.map(event=>[event.op,event.file,event.detail]),[['op-intake','apps/agentos-controlplane/src/sales/receipt.ts','the receipt is not rendered'],['op-intake','apps/agentos-controlplane/src/sales/receipt.ts','the receipt is not rendered']]);
    assert.deepEqual(dropped[0].diffFiles,[intakeFile]);
    // First result: one finding survived, so it is a reject and the op comes back with only that finding.
    const retried=log.find(event=>event.event==='retry'&&event.op==='op-intake');
    assert.deepEqual(retried.findings,['validator: apps/agentos-controlplane/src/sales/intake.ts - intake drops the order id']);
    // Second result: every finding pointed outside the diff, so the answer counts as unavailable and the commit proceeds.
    const unavailable=log.find(event=>event.event==='validator-unavailable');
    assert.equal(unavailable.op,'op-intake');
    assert.match(unavailable.reason,/every finding named a file outside the diff/);
    assert.equal(unavailable.consecutive,1);
    const op=state.ops[0];
    assert.equal(op.status,'done');assert.equal(op.validatorRejects,1);assert.equal(op.validation.verdict,'unavailable');
    assert.equal(state.finished.outcome,'done');
  }finally{harness.cleanup();}
});

test('an unavailable validator never blocks a commit, is counted, and three in a row become one needUser item',()=>{
  const file=name=>`apps/agentos-controlplane/src/${name}/index.ts`;
  const plan={definitionOfDone:['the slice works'],ledger:[{id:'goal-1',title:'Sales slice',inputRef:'sds:3',status:'absent'}],
    ops:['intake','catalog','pricing'].map(name=>({id:`op-${name}`,kind:'backend.implement',goal:`Implement ${name}.`,
      ledgerIds:['goal-1'],allowlist:[file(name)],references:['sds.md'],checks:[{name:'unit',command:`npx vitest run ${name}`}],acceptance:[`${name} works`],dependsOn:[]}))};
  let calls=0;
  const validator=()=>{calls+=1;if(calls===1)throw Error('codex exec exited 1: no session');return {ok:false,verdict:'unavailable',reason:'no provider produced a valid verdict',attempts:[{provider:'gpt-5.6-sol',attempt:0,errors:['rate-limited']}],usage:null};};
  const harness=setup({plan,dirty:['intake','catalog','pricing'].map(file),
    scripts:{'op-intake':[doneReport(file('intake'),'intake')],'op-catalog':[doneReport(file('catalog'),'catalog')],'op-pricing':[doneReport(file('pricing'),'pricing')],'verify-1':[reviewPassed]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({validateOp:validator,git:diffGit(harness.git.git)});
    assert.equal(calls,3);
    assert.deepEqual(state.ops.filter(op=>op.kind==='backend.implement').map(op=>[op.status,op.validation.verdict]),[['done','unavailable'],['done','unavailable'],['done','unavailable']]);
    const log=events(harness.store);
    const unavailable=log.filter(event=>event.event==='validator-unavailable');
    assert.deepEqual(unavailable.map(event=>event.consecutive),[1,2,3]);
    assert.match(unavailable[0].reason,/codex exec exited 1/,'a throwing validator is an unavailable verdict, never a crash');
    assert.equal(unavailable[1].attempts,1);
    assert.equal(log.filter(event=>event.event==='op-done').length,4,'every result was committed regardless');
    assert.equal(state.validatorUnavailable,VALIDATOR_UNAVAILABLE_LIMIT);
    const asked=state.needUser.filter(item=>item.kind==='validator');
    assert.equal(asked.length,1,'the outage is one item, not one per op');
    assert.match(asked[0].detail,new RegExp(`the validator answered nothing usable for 3 op results in a row \\(${critiqueRuntimes(harness.state.host).join(', ')}\\)`),'the named pair is the configured validator pool, whichever pool the host config selects');
    assert.equal(state.finished.outcome,'blocked');
    const verdicts=fs.readFileSync(path.join(harness.store.dir,'validator','verdicts.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert.deepEqual(verdicts.map(item=>item.verdict),['unavailable','unavailable','unavailable']);
    assert.match(readValidatorMemory(harness.store),/- op-pricing \| unavailable \| no provider produced a valid verdict/);
  }finally{harness.cleanup();}
});

test('with validateOp:null the step is skipped once on the record, and the kernel commits as before',()=>{
  const harness=setup({plan:salesPlan,dirty:[intakeFile],scripts:{'op-intake':[doneReport(intakeFile,'sales')],'verify-1':[reviewPassed]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({validateOp:null});
    assert.equal(state.finished.outcome,'done');
    const skipped=events(harness.store).filter(event=>event.event==='validator-skipped');
    assert.equal(skipped.length,1);
    assert.match(skipped[0].reason,/no validator function/);
    assert.equal(state.ops[0].validation,null);
    assert.ok(!fs.existsSync(path.join(harness.store.dir,'validator')));
  }finally{harness.cleanup();}
});

test('the kernel holds its launch in the repository runtime ledger and clears the entry when the report is accepted',()=>{
  // The one test that runs the real allocator: what it writes into the shared ledger is the contract between
  // the kernels of a repository, and a fake cannot prove it.
  const scripts={'op-intake':[]};
  const harness=setup({plan:salesPlan,dirty:[intakeFile],scripts});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const file=loadsFileFor(harness.store.dir);
    assert.equal(path.dirname(file),path.dirname(harness.store.dir));
    const allocator=createAllocator({runtimes:runtimeProfile,now:()=>Date.UTC(2026,8,12,9),
      shared:{path:file,workflow:harness.store.id}});
    harness.run({allocator,maxIterations:1});
    const launched=events(harness.store).find(event=>event.event==='launched');
    assert.equal(launched.op,'op-intake');
    const ledger=()=>JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(ledger().schema,'starci/runtime-loads@1');
    assert.deepEqual(ledger().runtimes[launched.runtime].live.map(item=>[item.workflow,item.op]),
      [[harness.store.id,'op-intake']]);
    assert.equal(ledger().runtimes[launched.runtime].usedToday,0,'reservation and launch are projected work, not completed service');
    // The report lands: the slot is released locally and the entry leaves the shared ledger with it.
    scripts['op-intake'].push(doneReport(intakeFile,'sales'));
    harness.run({allocator,maxIterations:2});
    assert.equal(harness.state.ops.find(op=>op.id==='op-intake').status,'done');
    assert.deepEqual(ledger().runtimes[launched.runtime].live.filter(item=>item.op==='op-intake'),[]);
    assert.equal(ledger().runtimes[launched.runtime].usedToday,1);
  }finally{harness.cleanup();}
});

test('the quota proposal opens the next chain runtime when the first one is busy with another workflow',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-quota-loads-'));
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});});
  const other='20260912-100000-other';
  fs.mkdirSync(path.join(root,other),{recursive:true});
  fs.writeFileSync(path.join(root,other,'kernel.lock'),JSON.stringify({pid:process.pid,startedAt:1}));
  const state={id:'20260912-104251-mine',dir:path.join(root,'20260912-104251-mine'),
    ops:[{id:'op-decide',kind:'architecture.decide',status:'pending',difficulty:'hard'}]};
  // Alone in the repository the proposal names the Fable window, the first runtime of the decide chain, and
  // marks nothing busy.
  const alone=proposeQuota(state);
  assert.equal(alone.rows.some(row=>row.runtime==='claude-fable-5.1'),false,'a retired pool id never names a row');
  assert.equal(alone.rows.find(row=>row.runtime==='claude-fable').slots,1);
  assert.doesNotMatch(alone.text,/busy with/);
  // A ledger another kernel wrote still names the retired pool id; it folds into the claude-fable window.
  fs.writeFileSync(loadsFileFor(state.dir),JSON.stringify({schema:'starci/runtime-loads@1',
    runtimes:{'claude-fable-5.1':{live:[{workflow:other,op:'op-other',since:1}],cooling:null,usedToday:1,day:new Date().toISOString().slice(0,10)}}}));
  const shared=proposeQuota(state);
  const astra=shared.rows.find(row=>row.runtime==='codex-agent');
  assert.equal(astra.slots,1);
  assert.match(astra.why,/claude-fable is busy with 20260912-100000-other/);
  assert.match(shared.text,/codex-agent=1/);
  // A lane is added, never taken away: the busy runtime keeps the slot this workflow's own quota gives it.
  assert.equal(shared.rows.find(row=>row.runtime==='claude-fable').slots,1);
});

/* ------------------------------------------------------------------ the critique of the goal */

/**
 * Every goal a person writes is critiqued by the runtime before anything is planned from it, and the verdict has
 * consequences: `sound` changes nothing, `revise` binds every operation through its contract, `refuse` refuses
 * the approval until the owner answers the question or overrides the critique on the record. A critic that
 * cannot answer is an event, never a stop.
 */
const objection=(extra={})=>({kind:'consistency',claim:'The goal writes the receipt in the backend',
  evidence:'demo.billing.architecture.sds.ledger',consequence:'Two components would own one write path.',...extra});

test('the goal is critiqued before the approval: a sound verdict stands above the definition of done and the approval passes',()=>{
  const asked=[];
  const harness=setupWork({critiqueGoal:payload=>{asked.push(payload);return critique()();}});
  try{
    assert.equal(harness.goal.ok,true);
    // What the critic is given: the job, the TODO nodes, the decisions still open, and the records the product
    // already accepted - the evidence an objection has to name.
    assert.equal(asked.length,1);
    assert.equal(asked[0].job,'Finish the sales slice');
    assert.deepEqual(asked[0].ledger.map(item=>[item.id,item.kind]),[['demo.sales.implementation.backend.intake','implementation']]);
    assert.deepEqual(asked[0].decisions.map(item=>item.id),['demo.payments.business.overview']);
    assert.deepEqual(asked[0].records,[{id:'demo.sales.architecture.sds.intake',kind:'architecture',
      title:'The accepted intake design.',statements:[]}]);
    assert.deepEqual(new Set(asked[0].providers),new Set(critiqueRuntimes(harness.state.host)),'the injected critic sees both configured validator peers without a fallback-order promise');
    assert.ok(asked[0].constraints.some(item=>/may not add, drop or rewrite a node/.test(item)));
    assert.deepEqual(harness.goal.critique,{verdict:'sound',objections:0,required:0,provider:'stub-critic'});
    assert.equal(harness.state.critique.verdict,'sound');
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.ok(page.includes('## Phản biện (critique)'),'the critique is a section of the page the user approves');
    assert.ok(page.indexOf('## Phản biện (critique)')<page.indexOf('## Definition of done'),
      'the objections to the goal are read before the definition of done derived from it');
    assert.match(page,/Verdict: `sound` \(critic `stub-critic`\) - the critique found nothing that blocks this goal/);
    assert.equal(/### Required changes/.test(page),false);
    // The verdict is on the record in goal.json and as one event, and nothing about it binds an operation.
    assert.equal(JSON.parse(fs.readFileSync(harness.store.paths.goalJson,'utf8')).critique.verdict,'sound');
    const critiqued=events(harness.store).filter(event=>event.event==='goal-critiqued');
    assert.deepEqual(critiqued.map(event=>[event.verdict,event.objections,event.provider]),[['sound',0,'stub-critic']]);
    const contract=renderContract({template,op:harness.state.ops[0],state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.doesNotMatch(contract,/## Goal critique/);
    assert.equal(approve(harness.store,harness.state).approved,true);
  }finally{harness.cleanup();}
});

test('a prerequisite the critique names and the tree lacks is planned as the intake that authors it first, and every other operation waits for it',()=>{
  const asked=[];
  const harness=setupWork({critiqueGoal:payload=>{asked.push(payload);return critique({verdict:'revise',objections:[objection()],
    required:['author the chat records before touching the backend'],
    prerequisites:[{kind:'sds',feature:'chat',why:'the goal extends the chat module and the tree holds no record of it'},
      {kind:'srs',feature:'sales',why:'already there'},
      {kind:'sds',feature:'module command contract',why:'a contract, not a feature'},
      {kind:'decision',feature:'chat',why:'who owns the message write'}]})();}});
  try{
    const {state,store}=harness;
    const intake=state.ops.find(op=>op.intake?.scope==='chat');
    assert.ok(intake,'the intake of the missing feature is an operation of the goal');
    assert.equal(intake.id,'chat-intake');assert.equal(intake.kind,'work.author');assert.deepEqual(intake.allowlist,['.starciwork/features/chat/**']);
    assert.deepEqual(intake.prerequisite,{kind:'sds',why:'the goal extends the chat module and the tree holds no record of it'});
    for(const op of state.ops.filter(op=>op.id!==intake.id))assert.ok(op.dependsOn.includes(intake.id),`${op.id} waits for the intake`);
    assert.equal(intake.dependsOn.includes(intake.id),false);
    assert.equal(state.ops.filter(op=>op.intake?.scope==='sales').length,0,'a prerequisite the tree holds plans nothing');
    const log=events(store);
    assert.deepEqual(log.filter(event=>event.event==='intake-planned').map(event=>[event.op,event.prerequisite]),[['chat-intake','sds']]);
    assert.deepEqual(log.filter(event=>event.event==='prerequisite-held').map(event=>event.feature),['sales']);
    assert.deepEqual(log.filter(event=>event.event==='prerequisite-owner').map(event=>event.why),['who owns the message write']);
    assert.deepEqual(log.filter(event=>event.event==='prerequisite-unresolved').map(event=>event.feature),['module command contract'],'a contract name is not a feature to author');
    assert.equal(state.ops.some(op=>/module/.test(op.id)),false);
    assert.equal(log.find(event=>event.event==='goal-critiqued').prerequisites,4);
    const page=fs.readFileSync(store.paths.goal,'utf8');
    assert.match(page,/### Prerequisites\n\n- \*\*sds\*\* of `chat` - the goal extends the chat module and the tree holds no record of it\. Planned first as `chat-intake`; every other operation waits for it\./);
    assert.match(page,/- \*\*srs\*\* of `sales` - already there\. The tree already holds it\./);
    assert.match(page,/- \*\*decision\*\* of `chat` - who owns the message write\. The owner decides it\./);
    assert.equal(harness.goal.critique.prerequisites,4);
    assert.equal(JSON.parse(fs.readFileSync(store.paths.goalJson,'utf8')).ops.find(op=>op.id==='chat-intake').kind,'work.author');
  }finally{harness.cleanup();}
});

test('the critics use the canonical validator pool and invalid configuration fails closed',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-critics-'));
  try{
    fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));
    assert.deepEqual(new Set(critiqueRuntimes(root)),new Set(['claude-fable','codex-agent']));
    // A legacy critique.runtimes list still names the retired model pools; each resolves to its window, so the
    // pair identifies the opus-sol pool.
    fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({language:'vi',model:null,effort:'medium',critique:{runtimes:['claude-opus','gpt-5.6-sol']}}));
    assert.deepEqual(new Set(critiqueRuntimes(root)),new Set(['claude-agent','codex-agent']));
    fs.writeFileSync(path.join(root,'config.json'),'{not json');
    assert.throws(()=>critiqueRuntimes(root));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a revise verdict lists what it requires on the goal page and in the contract of every operation',()=>{
  const harness=setupWork({critiqueGoal:critique({verdict:'revise',
    objections:[objection(),objection({kind:'testability',claim:'"the receipt feels fast" is in the goal',
      evidence:'the job text',consequence:'No check can ever prove it.'})],
    dropped:[{kind:'premise',claim:'I would not do it this way',evidence:'',consequence:'none'}],
    required:['render the receipt in the frontend node, not in the backend one','state the latency the receipt is measured against'],
    alternatives:['reuse the existing receipt renderer instead of writing a second one']})});
  try{
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(page,/Verdict: `revise` \(critic `stub-critic`\) - proceed only under the required changes below\./);
    assert.match(page,/- \*\*consistency\*\* - The goal writes the receipt in the backend\. Evidence: demo\.billing\.architecture\.sds\.ledger\. Consequence: Two components would own one write path\./);
    assert.match(page,/- \*\*testability\*\* - "the receipt feels fast" is in the goal\. Evidence: the job text\./);
    assert.match(page,/1 objection\(s\) named no evidence and were dropped by the kernel\./);
    assert.match(page,/### Required changes\n\n1\. render the receipt in the frontend node, not in the backend one\n2\. state the latency the receipt is measured against/);
    assert.match(page,/### Alternatives\n\n- reuse the existing receipt renderer instead of writing a second one/);
    assert.deepEqual(harness.goal.critique,{verdict:'revise',objections:2,required:2,provider:'stub-critic'});
    // Every operation of the workflow carries the required changes under its goal and above its allowlist.
    for(const op of harness.state.ops){
      const contract=renderContract({template,op,state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
      assert.match(contract,/## Goal critique - required\n- render the receipt in the frontend node, not in the backend one\n- state the latency the receipt is measured against/);
      assert.ok(contract.indexOf('## Goal critique - required')>contract.indexOf('## Goal'));
      assert.ok(contract.indexOf('## Goal critique - required')<contract.indexOf('## Allowlist'));
    }
    assert.equal(approve(harness.store,harness.state).approved,true);
  }finally{harness.cleanup();}
});

test('the overlaps the critic finds are the three cases: a conflict is listed for the owner on the goal page, a reference is a record to cite, and the intake contract carries both',()=>{
  const overlaps=[
    {record:'demo.sales.architecture.sds.intake',case:'conflict',evidence:'sales decided a synchronous intake contract; collab needs an asynchronous one'},
    {record:'demo.sales.business.overview',case:'reference',evidence:'the refund window collab follows is already decided there'},
    // A case outside the closed two is not a case: the kernel drops it instead of inventing a fourth.
    {record:'demo.sales.business.overview',case:'change',evidence:'x'}];
  const harness=setupWork({scope:['collab'],critiqueGoal:critique({verdict:'revise',objections:[objection()],required:['reconcile against the sales records'],overlaps})});
  try{
    assert.deepEqual(harness.state.critique.overlaps.map(item=>[item.record,item.case]),
      [['demo.sales.architecture.sds.intake','conflict'],['demo.sales.business.overview','reference']]);
    assert.deepEqual(events(harness.store).filter(event=>event.event==='goal-critiqued').map(event=>event.overlaps),[2]);
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(page,/### Conflicts for the owner\n\n- `demo\.sales\.architecture\.sds\.intake` - sales decided a synchronous intake contract/);
    assert.match(page,/the owner decides it with `workflow-answer`/);
    assert.match(page,/### Records to cite\n\n- `demo\.sales\.business\.overview` - the refund window/);
    // The intake is the one operation whose job the overlaps describe, so its contract carries them as rows to write.
    const intake=harness.state.ops.find(op=>op.intake);
    const contract=renderContract({template,op:intake,state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Reconciliation the critic found\n- `demo\.sales\.architecture\.sds\.intake` conflicts with this feature[^\n]*write a `conflict` row naming it and a todo decision record under `collab`/);
    assert.match(contract,/- `demo\.sales\.business\.overview` already holds part of this feature[^\n]*`reference` row citing it by id/);
    // The dropped 'change' overlap produced no row: the overview is named exactly once, as the reference it is.
    assert.equal((contract.match(/^- `demo.sales.business.overview`/gm)??[]).length,1);
  }finally{harness.cleanup();}
});

test('a red tree counts against an op only where the op could have caused it: foreign errors are evidence, not a rejection',()=>{
  const errors=[{code:'NODE_ASSET_UNREADABLE',path:'features/sales/ui/index.yaml',message:'asset missing'},{code:'SRS_LAYOUT',path:'features/shared/business/srs/decisions/x/index.yaml',message:'layout'}];
  const ctx={work:{ledger:{repoRoot:'C:/owner',workRoot:'C:/owner/.starciwork'},validate:()=>({ok:false,errors}),node:()=>({path:'features/sales/implementation/backend/intake/index.yaml'})}};
  const backend={nodeId:'demo.sales.implementation.backend.intake',allowlist:['apps/agentos-controlplane/src/sales/**'],files:['apps/agentos-controlplane/src/sales/intake.ts']};
  const verdict=treeVerdictFor(ctx,backend);
  assert.deepEqual([verdict.ok,verdict.own.length,verdict.foreign.length],[true,0,2],'a backend slice is not failed by the missing assets of a drawing');
  const drawing={nodeId:null,allowlist:['C:/owner/.starciwork/features/sales/ui/**'],files:[]};
  const judged=treeVerdictFor(ctx,drawing);
  assert.deepEqual([judged.ok,judged.own.map(e=>e.code),judged.foreign.length],[false,['NODE_ASSET_UNREADABLE'],1],'the op that wrote the ui record owns its error');
  assert.equal(treeVerdictFor({work:{...ctx.work,validate:()=>({ok:true,errors:[]})}},backend).ok,true);
});

test('an op the validator exhausted on the whole-tree check is re-admitted while the tree is still red, once every remaining error is foreign to it',()=>{
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const done=n=>({outcome:'done',summary:`Intake implemented, attempt ${n}.`,files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]});
  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[done(1),done(2),done(3),done(4)]}});
  try{
    const {store,state}=harness;
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    // The tree stays red on a record another lane wrote; nothing of it is under this op. The validator keeps
    // rejecting on the whole-tree check (as it did on a real backend), so the op is exhausted mid-run.
    const foreign=()=>({ok:false,errors:[{code:'NODE_ASSET_UNREADABLE',path:'features/sales/ui/index.yaml',message:'asset missing'}],warnings:[],nodes:[],resources:[]});
    const reject=()=>({ok:true,verdict:'reject',summary:'red tree',findings:[{file,detail:'The required `work-valid` check (`starci.mjs validate`) exits 1'}],dropped:[],provider:'stub',usage:null});
    const after=harness.run({maxIterations:8,validate:foreign,validateOp:reject,ledgerApi:{...work,loadLedger:where=>work.loadLedger({...where,validate:foreign})}});
    const log=events(store);
    assert.ok(log.some(event=>event.event==='validator-exhausted'&&event.op===nodeId),'the validator exhausted the op on the red tree');
    const readmitted=log.filter(event=>event.event==='op-readmitted'&&event.op===nodeId&&/outside this operation/.test(event.reason));
    assert.ok(readmitted.length>=1,'the op is judged again while the tree is still red, because its errors are foreign');
    assert.ok(log.some(event=>event.event==='ledger-invalid'),'the foreign error is still reported');
  }finally{harness.cleanup();}
});

test('a refuse verdict refuses the approval with its one question, and --accept-critique records the owner override once',()=>{
  const question='Which component owns the receipt write, the backend ledger or the frontend surface?';
  const harness=setupWork({critiqueGoal:critique({verdict:'refuse',objections:[objection()],question})});
  try{
    assert.equal(harness.state.critique.verdict,'refuse');
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(page,/Verdict: `refuse` \(critic `stub-critic`\) - this goal contradicts an accepted record or cannot be verified at all/);
    assert.match(page,new RegExp(`### Question\\n\\n${question.replace(/[?]/g,'\\?')}`));
    assert.match(page,/--accept-critique "<reason>"/);
    // The approval is refused, and the refusal is the question itself: there is nothing else to answer it with.
    assert.throws(()=>approve(harness.store,harness.state),new RegExp(question.replace(/[?]/g,'\\?')));
    assert.equal(harness.store.loadState().approved,false);
    assert.equal(events(harness.store).some(event=>event.event==='approved'),false);
    // The override is the owner's decision: it is recorded with its reason, rendered on the page, and never asked for again.
    const accepted=approve(harness.store,harness.state,{acceptCritique:'the receipt write is mine to move later; ship the slice'});
    assert.equal(accepted.approved,true);
    assert.equal(accepted.critique.overridden,'the receipt write is mine to move later; ship the slice');
    assert.deepEqual(events(harness.store).filter(event=>event.event==='critique-overridden')
      .map(event=>[event.reason,event.question,event.objections]),
      [['the receipt write is mine to move later; ship the slice',question,1]]);
    assert.match(fs.readFileSync(harness.store.paths.goal,'utf8'),
      /Override: the owner accepted this critique - "the receipt write is mine to move later; ship the slice"\./);
    assert.equal(approve(harness.store,harness.state).approved,true,'an override is taken once, never asked for again');
    assert.equal(events(harness.store).filter(event=>event.event==='critique-overridden').length,1);
  }finally{harness.cleanup();}
});

test('a critic no provider could answer is recorded as unavailable and the workflow carries on',()=>{
  const harness=setupWork({critiqueGoal:()=>({ok:false,verdict:'unavailable',
    reason:'no provider produced a valid critique',attempts:[{provider:'claude-fable-5.1',attempt:0,errors:['rate-limited']}],usage:null})});
  try{
    assert.equal(harness.goal.ok,true);
    assert.equal(harness.state.critique.verdict,'unavailable');
    assert.deepEqual(events(harness.store).filter(event=>event.event==='goal-critique-unavailable')
      .map(event=>[event.reason,event.attempts]),[['no provider produced a valid critique',1]]);
    assert.equal(events(harness.store).some(event=>event.event==='goal-critiqued'),false);
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(page,/Phản biện: chưa chạy được - no critic runtime answered \(no provider produced a valid critique\)/);
    assert.ok(page.indexOf('Phản biện: chưa chạy được')<page.indexOf('## Definition of done'));
    const contract=renderContract({template,op:harness.state.ops[0],state:harness.state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.doesNotMatch(contract,/## Goal critique/);
    assert.equal(approve(harness.store,harness.state).approved,true,'a dead provider is never a veto over the owner\'s job');
  }finally{harness.cleanup();}});

/* ------------------------------------------------------------------ hosts */

/**
 * The headless host with processes that never run a provider: `spawn` records each child, and the host's own
 * blocking wait is where a pending child "finishes" - it writes the next report scripted for its op through the
 * launcher's `report` on a host built from nothing but the environment the kernel gave it, then its pid is gone -
 * exactly the way the scripted Orca's check finishes a live operation.
 */
function headlessFake({store,scripts}){
  const root=path.join(store.dir,'headless');
  const children=[];const alive=new Set();let pid=7000;
  const opOf=text=>(String(text).match(/op `([^`]+)`/)??[null,'unknown'])[1];
  const spawn=(executable,args,options)=>{const child={pid:++pid,executable,args,options,input:'',stdin:{write(text){child.input+=text;},end(){}},on(){},unref(){}};alive.add(child.pid);children.push(child);return child;};
  const finish=()=>{
    for(const child of children.filter(item=>alive.has(item.pid))){
      const queue=scripts[opOf(child.input)];
      if(!queue?.length)continue;
      const {effect,...script}=queue.shift();
      if(typeof effect==='function')effect();
      const [,run]=/of run (\S+),/.exec(child.input),[,task]=/Task id: (\S+)\./.exec(child.input),[,dispatch]=/Dispatch id: (\S+)\./.exec(child.input),[,terminal]=/terminal handle: (\S+) /.exec(child.input);
      const reporter=createHeadlessHost({cwd,calls,env:child.options.env});
      const reported=reportOutcome(reporter,{cwd,run,from:terminal,task,dispatch,...script,reportsDir:store.paths.reports});
      if(!reported.ok)throw Error(`the fake child could not report: ${reported.reason}`);
      alive.delete(child.pid);
    }
  };
  const orca=createHeadlessHost({cwd,root,calls,spawn,alive:id=>alive.has(id),kill:id=>alive.delete(id),sleep:finish,env:{}});
  return {orca,children,root,dispatches:{get size(){return children.length;}}};
}

test('on the headless host a workflow runs end to end one operation at a time: each op is one headless process whose report arrives through the mailbox, and the next launches only after the previous is done',()=>{
  const file=name=>`apps/agentos-controlplane/src/${name}/index.ts`;
  const plan={definitionOfDone:['both slices work'],ledger:[{id:'goal-1',title:'Sales slice',inputRef:'sds:SDS-FR-SALES-03',status:'absent'}],
    ops:['intake','catalog'].map(name=>({id:`op-${name}`,kind:'backend.implement',goal:`Implement ${name}.`,ledgerIds:['goal-1'],
      allowlist:[file(name)],references:['sds.md'],checks:[{name:'unit',command:`npx vitest run ${name}`}],acceptance:[`${name} works`],dependsOn:[]}))};
  const done=name=>({outcome:'done',summary:`${name} implemented.`,files:[file(name)],checks:[passing('unit',`npx vitest run ${name}`)]});
  const harness=setup({plan,dirty:[file('intake'),file('catalog')],allocator:createAllocator({sequential:true}),
    scripts:{'op-intake':[done('intake')],'op-catalog':[done('catalog')],'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('review','npx vitest run intake')]}]},
    orca:headlessFake});
  try{
    approve(harness.store,harness.state);
    // The kernel binds its run on the host it runs on; here the test does what workflow-run does.
    const created=harness.fake.orca.invoke('run-create',{objective:`Workflow ${harness.state.id}`,from:'term_kernel'});
    harness.state.run=created.receipt.result.run.id;harness.state.from='term_kernel';
    const state=harness.run({maxIterations:30});
    assert.equal(state.finished?.outcome,'done',JSON.stringify(state.needUser));
    const log=events(harness.store);
    const host=log.find(event=>event.event==='host');
    assert.deepEqual([host.name,host.sequential,host.maxParallelOps,host.capabilities],['headless',true,1,[]]);
    const launches=log.filter(event=>event.event==='launched');
    assert.deepEqual(launches.map(event=>event.op).slice(0,2).sort(),['op-catalog','op-intake']);
    assert.equal(launches.length,3,'two implementations and the review');
    // Strictly one after the other: the second launch follows the first acceptance, and no tick ever saw two running.
    assert.ok(log.indexOf(launches[1])>log.findIndex(event=>event.event==='op-done'),'the second op launched only after the first was done');
    for(const tick of log.filter(event=>event.event==='tick'))assert.ok(tick.ops.filter(item=>item.endsWith('=running')).length<=1,`two operations ran at once: ${tick.ops}`);
    // Every op was one detached process in the worktree, told which host it is on, with its log beside the store.
    assert.equal(harness.fake.children.length,3);
    for(const child of harness.fake.children){
      assert.equal(child.options.cwd,cwd);
      assert.equal(child.options.detached,true);
      assert.equal(child.options.env.STARCI_HOST,'headless');
      assert.equal(child.options.env.STARCI_HEADLESS_ROOT,harness.fake.root);
      assert.match(child.input,/=== HEADLESS PREAMBLE ===[\s\S]*# Operation contract/);
    }
    assert.equal(fs.readdirSync(harness.fake.root).filter(name=>name.endsWith('.log')).length,3);
    assert.equal(fs.readFileSync(path.join(harness.fake.root,'mailbox.jsonl'),'utf8').trim().split('\n').length,3);
    assert.deepEqual(state.ops.map(op=>[op.id,op.status]),[['op-intake','done'],['op-catalog','done'],['verify-1','done']]);
    // Accepted ops released their processes: nothing is listed on the host any more.
    assert.deepEqual(harness.fake.orca.invoke('worker-list',{run:state.run}).receipt.result.workers,[]);
  }finally{harness.cleanup();}
});

test('an image-first interface.draw op on a host without the design tool is host-unsupported: one host item, the frontend lane behind it keeps waiting, the rest finishes, and an approval from a host that has the tool re-admits it',()=>{
  const intake='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED,WORK_NODES[0],WORK_NODES[1]],dirty:[file],ledgerApi:brandLedger,
    scripts:{[intake]:[{outcome:'done',summary:'Intake implemented.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      [`${intake}-verify`]:[{outcome:'done',summary:'The intake scenarios pass through the API.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    // The first ui step invokes built-in ImageGen, so the headless host must refuse it before dispatch.
    const state=harness.run({host:HEADLESS_HOST,maxIterations:30});
    const ui=state.ops.find(op=>op.id===UI);
    assert.equal(ui.status,'blocked');
    assert.equal(ui.refusal,'host-unsupported');
    assert.deepEqual(state.needUser.filter(item=>item.kind==='host').map(item=>[item.op,item.kind]),[[UI,'host']]);
    assert.match(state.needUser.find(item=>item.kind==='host').detail,/needs design-tool, which the headless host does not have/);
    const log=events(harness.store);
    assert.deepEqual(log.filter(event=>event.event==='op-host-unsupported').map(event=>[event.op,event.kind,event.host,event.missing]),[[UI,'interface.draw','headless',['design-tool']]]);
    // Nothing of the drawing ever reached the host; the build behind it is still held by the design gate - correctly, there is no drawing to build from.
    assert.equal([...harness.fake.dispatches.values()].some(item=>item.op===UI),false);
    assert.deepEqual(log.filter(event=>event.event==='lane-waits-design').map(event=>[event.node,event.design]),[[CART,UI]]);
    assert.equal(state.ops.some(op=>op.nodeId===CART),false);
    // The backend slice ran and finished on this same host; the workflow ends blocked on the one host item.
    assert.equal(state.ops.find(op=>op.id===intake).status,'done');
    assert.equal(harness.read(intake).state,'done');
    assert.equal(state.finished.outcome,'blocked');
    assert.ok(state.needUser.some(item=>item.kind==='host'),'the final report names the host item');
    // Approving again from a host without the tool changes nothing; from Orca the op is ready and its item is gone.
    approve(harness.store,harness.state,{host:HEADLESS_HOST});
    assert.equal(harness.state.ops.find(op=>op.id===UI).status,'blocked');
    assert.equal(harness.state.ops.find(op=>op.id===UI).refusal,'host-unsupported');
    assert.equal(harness.state.needUser.some(item=>item.kind==='host'),true);
    approve(harness.store,harness.state,{host:ORCA_HOST});
    const readmitted=harness.state.ops.find(op=>op.id===UI);
    assert.equal(readmitted.status,'ready');
    assert.equal(readmitted.refusal,null);
    assert.equal(harness.state.needUser.some(item=>item.kind==='host'),false);
    assert.deepEqual(events(harness.store).filter(event=>event.event==='op-readmitted'&&event.op===UI).map(event=>event.host),['orca']);
    assert.equal(harness.state.finished,null,'the blocked finish is cleared for the next kernel');
    // One rule decides both the refusal and the re-admission.
    assert.deepEqual(hostMissing(HEADLESS_HOST,'interface.asset'),['design-tool']);
    assert.deepEqual(hostMissing(ORCA_HOST,'interface.asset'),[]);
    assert.deepEqual(hostMissing(HEADLESS_HOST,'interface.draw'),['design-tool'],'an image-first direction needs built-in ImageGen');
    assert.deepEqual(hostMissing(ORCA_HOST,'interface.draw'),[]);
    assert.deepEqual(hostMissing(HEADLESS_HOST,'backend.implement'),[]);
    assert.deepEqual(hostDescriptorOf({}),{...ORCA_HOST,capabilities:[...ORCA_HOST.capabilities]});
    assert.deepEqual(hostDescriptorOf({host:HEADLESS_HOST}),{name:'headless',capabilities:[],sequential:true});
  }finally{harness.cleanup();}
});

test('the answer the kernel gave to an op\'s question travels in the contract of its next attempt',()=>{
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    const state=harness.store.loadState();
    const op=state.ops[0];
    const before=renderContract({template,op,state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.doesNotMatch(before,/## Answer to the question you asked earlier/);
    op.answer='Use the existing intake table; do not add a migration.';
    const after=renderContract({template,op,state,store:harness.store,launcher:'L.mjs',run:'run_wf'});
    assert.match(after,/## Answer to the question you asked earlier\nUse the existing intake table; do not add a migration\.\nAct on it; do not ask the same question again\.\n\n## Acceptance/);
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ heavy work is cut and fanned out */

/**
 * The owner's ruling, as one workflow: a big node is cut by a planning operation into many small nodes with
 * disjoint write scopes, the seam everyone shares is built first and alone, the rest fan out, and the proof runs
 * once for the whole group on another runtime - never once per piece.
 */
const CHECKOUT='demo.sales.implementation.backend.checkout';
const CHECKOUT_DIR='features/sales/implementation/backend/checkout';
const CHECKOUT_RECORD=`.starciwork/${CHECKOUT_DIR}/index.yaml`;
const CHECKOUT_CUT=`${CHECKOUT}-cut`;
const SEAM=`${CHECKOUT}.wiring`,PAY=`${CHECKOUT}.payment`,SHIP=`${CHECKOUT}.shipping`;
const childRecord=id=>`.starciwork/${CHECKOUT_DIR}/${id.split('.').at(-1)}/index.yaml`;
const codeOf=id=>`apps/agentos-controlplane/src/sales/checkout/${id.split('.').at(-1)}.ts`;
/** Thirteen files is one past CUT_FILES, which is the whole reason this node is not one operation. */
const BIG_FILES=Array.from({length:13},(_,index)=>`apps/agentos-controlplane/src/sales/checkout/part-${index+1}.ts`);
const BIG=`schema: work/node@2
id: ${CHECKOUT}
kind: implementation
required: true
state: todo
description: Check a cart out end to end.
assertions:
  - checkout-completes
implementation:
  status: mixed
  changes:
    - what: Build checkout.
      why: The flow does not exist.
      repository: demo-backend
      directory: .
      files:
${BIG_FILES.map(file=>`        - ${file}`).join('\n')}
extensions:
  work3:
    checks:
      - assertion: checkout-completes
        command: npx vitest run checkout
`;
/** What the cut leaves behind on the parent: a derived parent, its assertions kept as the group's acceptance. */
const DERIVED=`schema: work/node@2
id: ${CHECKOUT}
kind: implementation
required: true
description: Check a cart out end to end.
extensions:
  work3:
    groupAssertions:
      - checkout-completes
`;
/** One child the cut wrote: one observable behaviour, its own small write scope, one check per assertion. */
const childText=(id,dependsOn=[])=>{
  const part=id.split('.').at(-1);
  return `schema: work/node@2
id: ${id}
kind: implementation
required: true
state: todo
description: The ${part} part of checkout.
assertions:
  - ${part}-works
${dependsOn.length?`dependsOn:\n${dependsOn.map(entry=>`  - ${entry}`).join('\n')}\n`:''}implementation:
  status: mixed
  changes:
    - what: Build ${part}.
      why: It does not exist.
      repository: demo-backend
      directory: .
      files:
        - ${codeOf(id)}
extensions:
  work3:
    checks:
      - assertion: ${part}-works
        command: npx vitest run ${part}
`;
};
const BIG_NODE={id:CHECKOUT,path:`${CHECKOUT_DIR}/index.yaml`,kind:'implementation',state:'todo',eligible:true,
  inputDigest:DIGEST('k'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null,authored:BIG};
const childNode=(id,dependsOn=[])=>({id,path:`${CHECKOUT_DIR}/${id.split('.').at(-1)}/index.yaml`,kind:'implementation',
  state:'todo',eligible:dependsOn.length===0,inputDigest:DIGEST('k'),dependsOn:[...dependsOn],refs:[],blockedBy:[],
  children:[],completion:null,authored:childText(id,dependsOn)});
const CHILDREN=[SEAM,PAY,SHIP];
const cutReport=summary=>({outcome:'done',summary,files:[CHECKOUT_RECORD,...CHILDREN.map(childRecord)],
  checks:[passing('work-tree-validates','node starci.mjs validate .starciwork')]});
const buildReportOf=id=>({outcome:'done',summary:`${id} is built.`,files:[codeOf(id)],
  checks:[passing(`${id.split('.').at(-1)}-works`,`npx vitest run ${id.split('.').at(-1)}`)]});

/**
 * One workflow over the too-big node. The projection array is mutable on purpose: the injected validator is read
 * again on every tick, so the test makes the children appear exactly as the operation would - the parent derived
 * (no state, so it is no candidate at all), the seam schedulable, the rest waiting behind it.
 */
function runCut({scripts,cut=true,maxIterations=24,allocator=fakeAllocator({maxParallelOps:10}),exec}={}){
  const nodes=[{...BIG_NODE}];
  const harness=setupWork({nodes,scripts,allocator,exec,
    dirty:[CHECKOUT_RECORD,...CHILDREN.map(childRecord),...CHILDREN.map(codeOf)]});
  approve(harness.store,harness.state);
  harness.state.run='run_wf';harness.state.from='term_kernel';
  const write=(where,text)=>{const file=path.join(harness.repo,where);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  const tick=()=>{
    // While the cut runs: the children are written and the parent becomes derived.
    if(cut&&!fs.existsSync(path.join(harness.repo,childRecord(SEAM)))&&harness.state.ops.some(op=>op.id===CHECKOUT_CUT&&op.status==='running')){
      write(CHECKOUT_RECORD,DERIVED);
      for(const id of CHILDREN)write(childRecord(id),childText(id,id===SEAM?[]:[SEAM]));
      nodes[0]={...nodes[0],state:null,children:[...CHILDREN]};
      nodes.push(...CHILDREN.map(id=>childNode(id,id===SEAM?[]:[SEAM])));
    }
    // Once the seam's build is accepted its siblings become eligible, exactly as the validator would report.
    if(harness.state.ops.some(op=>op.id===SEAM&&op.status==='done'))
      for(const node of nodes)if(node.dependsOn?.includes(SEAM))node.eligible=true;
  };
  const orca={...harness.fake.orca,invoke:(name,params,options)=>{
    const result=harness.fake.orca.invoke(name,params,options);
    if(name==='check')tick();
    return result;
  }};
  const state=runLoop(orca,harness.store,harness.state,{cwd,allocator:harness.allocator,template,wait:harness.clock.wait,now:harness.clock.now,
    // The projection is answered from the array as it stands: every re-read of the tree sees what the operations
    // have written by then, which is what makes a child authored mid-run a schedulable node on the next tick.
    validateOp:acceptAll,validate:(...args)=>{tick();return harness.validate(...args);},
    exec:exec??(command=>({status:0,stdout:`${command} ok`,stderr:''})),
    git:harness.git.git,waitTimeoutMs:2000,tickMs:1000,maxIterations});
  return {harness,state,nodes,log:events(harness.store)};
}
const cutScripts=(extra={})=>({[CHECKOUT_CUT]:[cutReport('Cut into a seam and two parts.')],
  ...Object.fromEntries(CHILDREN.map(id=>[id,[buildReportOf(id)]])),...extra});

test('a node too big for one operation gets a cut op before its lane, and its children fan out behind the seam',()=>{
  const {harness,state,log}=runCut({scripts:cutScripts({
    'verify-1':[{outcome:'done',summary:'Every scenario of the group is green.',files:[],
      checks:[passing('payment-works','npx vitest run payment')]}],
    'verify-2':[{outcome:'done',summary:'The group holds together.',files:[],open:[],
      checks:[passing('payment-works','npx vitest run payment')]}]})});
  try{
    // The cut precedes the lane: no build op of the parent was ever created.
    const planned=log.find(event=>event.event==='cut-planned');
    assert.equal(planned.node,CHECKOUT);
    assert.equal(planned.files,13);
    assert.equal(planned.assertions,1);
    assert.equal(planned.reason,'its write scope names 13 files, past the 12 one operation may hold');
    const cut=state.ops.find(op=>op.id===CHECKOUT_CUT);
    assert.equal(cut.kind,'implementation.plan','the cut is a kind of its own, carried by the work.author contract');
    assert.equal(cut.nodeId,CHECKOUT);
    assert.deepEqual(cut.ledgerIds,[],'a cut closes no node: the children it writes are the nodes');
    assert.deepEqual(cut.allowlist,[`.starciwork/${CHECKOUT_DIR}/**`],'its write scope is the node\'s own folder');
    assert.deepEqual(cut.checks.map(check=>check.name),['work-tree-validates']);
    assert.deepEqual(cut.cut,{node:CHECKOUT,reason:planned.reason});
    assert.ok(cut.references.includes(`${CHECKOUT_DIR}/index.yaml`)&&cut.references.includes(BIG_FILES[0]),
      'the node, its design and the code its allowlist names are the references');
    assert.equal(state.ops.some(op=>op.nodeId===CHECKOUT&&op.kind==='backend.implement'),false,
      'the parent never walked a lane step of its own');
    // Its contract is the cut sequence, and it says the parent loses its state on purpose.
    const contract=fs.readFileSync(harness.store.contractPath(CHECKOUT_CUT),'utf8');
    assert.match(contract,/Sequence `work\.cut`/);
    assert.match(contract,/## Work node you cut/);
    assert.match(contract,/removing its `state` is the job \(a parent authors no state\)/);
    assert.match(contract,/Name the SEAM first/);
    // On acceptance the tree is re-read: the children are the nodes now, and the seam is named from the records.
    const authored=log.find(event=>event.event==='cut-authored');
    assert.equal(authored.node,CHECKOUT);
    assert.deepEqual([...authored.children].sort(),[...CHILDREN].sort());
    assert.equal(authored.seam,SEAM);
    assert.equal(authored.groupAssertions,1);
    assert.deepEqual([...state.cuts[CHECKOUT].children].sort(),[...CHILDREN].sort());
    assert.deepEqual(state.cuts[CHECKOUT].assertions,['checkout-completes'],'the parent\'s assertions are the group\'s acceptance');
    // Seam first: its build is accepted before either sibling is even launched.
    const launched=log.filter(event=>event.event==='launched').map(event=>event.op);
    assert.ok(launched.indexOf(SEAM)>=0&&launched.indexOf(SEAM)<launched.indexOf(PAY)&&launched.indexOf(SEAM)<launched.indexOf(SHIP),'the seam is built first');
    for(const id of CHILDREN){
      const build=state.ops.find(op=>op.id===id);
      assert.equal(build.kind,'backend.implement','a child is ordinary build work, never a new kind');
      assert.deepEqual(build.allowlist,[codeOf(id)]);
      assert.equal(build.status,'done');
    }
    // One proof per parent, in order, and neither is a step any child planned for itself.
    const proofs=state.ops.filter(op=>op.origin==='verify');
    assert.deepEqual(proofs.map(op=>op.kind),['e2e.verify','review.verify'],
      'one API proof and one review for the whole group, never one per piece');
    for(const proof of proofs){
      assert.deepEqual([...proof.ledgerIds].sort(),[...CHILDREN].sort(),'the group is the unit that is proven');
      assert.equal(proof.nodeId,null);
      assert.ok(proof.acceptance.includes('checkout-completes'),'the parent\'s group acceptance is the proof\'s acceptance');
      assert.deepEqual([...proof.allowlist].sort(),CHILDREN.map(codeOf).sort());
      assert.equal(CHILDREN.map(id=>state.ops.find(op=>op.id===id).runtime).includes(proof.runtime),false,
        'the proof runs on a runtime none of the children used');
    }
    assert.equal(state.ops.filter(op=>op.kind==='e2e.verify').length,1);
    assert.equal(state.ops.filter(op=>op.kind==='review.verify').length,1);
    // Each child's prove steps were recorded when the parent's proof was accepted.
    for(const id of CHILDREN){
      assert.deepEqual(state.lanes[id].lane,['backend.implement','e2e.verify','security.verify','perf.verify','review.verify']);
      assert.deepEqual(state.lanes[id].done,['backend.implement','e2e.verify','review.verify']);
      assert.equal(harness.read(id).state,'done');
      assert.equal(state.ledger.find(item=>item.id===id).status,'verified');
    }
    for(const kind of ['e2e.verify','review.verify'])
      assert.deepEqual(log.filter(event=>event.event==='lane-step'&&event.kind===kind).map(event=>event.node).sort(),
        [...CHILDREN].sort(),'one group proof is one lane step of every child');
    assert.equal(state.ledger.some(item=>item.id===CHECKOUT),false,'the derived parent is no goal item of its own');
  }finally{harness.cleanup();}
});

test('a group proof that found something repairs the child whose write scope holds the file, not the whole group',()=>{
  const {harness,state,log}=runCut({scripts:cutScripts({
    'verify-1':[{outcome:'done',summary:'green',files:[],checks:[passing('payment-works','npx vitest run payment')]}],
    'verify-2':[{outcome:'partial',summary:'One finding.',files:[],
      open:[`${codeOf(PAY)}:31 the refund path never rolls the authorisation back, which breaks payment-works`],
      checks:[passing('payment-works','npx vitest run payment')]}],
    'repair-1':[buildReportOf(PAY)],
    'verify-3':[{outcome:'done',summary:'The finding is fixed.',files:[],open:[],
      checks:[passing('payment-works','npx vitest run payment')]}]})});
  try{
    const findings=log.find(event=>event.event==='verify-findings');
    assert.equal(findings.child,PAY,'the finding named a file of exactly one child');
    const repair=state.ops.find(op=>op.origin==='repair');
    assert.equal(repair.kind,'backend.implement','the repair is the lane\'s build step');
    assert.equal(repair.nodeId,PAY);
    assert.deepEqual(repair.ledgerIds,[PAY],'the other children are not reopened by a finding that is not theirs');
    assert.deepEqual(repair.allowlist,[codeOf(PAY)]);
  }finally{harness.cleanup();}
});

test('a node the planning operation did not split reports cut: none and the kernel runs it as it is',()=>{
  const {harness,state,log}=runCut({cut:false,maxIterations:3,
    scripts:{[CHECKOUT_CUT]:[{outcome:'done',summary:'cut: none - checkout is one observable behaviour.',
      files:[],checks:[passing('work-tree-validates','node starci.mjs validate .starciwork')]}]}});
  try{
    const none=log.find(event=>event.event==='cut-none');
    assert.equal(none.node,CHECKOUT);
    assert.equal(none.op,CHECKOUT_CUT);
    assert.equal(log.some(event=>event.event==='cut-authored'),false);
    assert.equal(state.lanes[CHECKOUT].cutNone,true);
    // The node starts its own lane, with its own id, and no second cut is ever planned for it.
    assert.deepEqual(state.ops.filter(op=>op.kind==='implementation.plan').map(op=>op.id),[CHECKOUT_CUT]);
    const build=state.ops.find(op=>op.id===CHECKOUT);
    assert.equal(build.kind,'backend.implement');
    assert.deepEqual(build.allowlist,BIG_FILES);
    assert.deepEqual(state.lanes[CHECKOUT].lane,['backend.implement','e2e.verify','security.verify','perf.verify','review.verify']);
    assert.deepEqual(state.lanes[CHECKOUT].done,[],'the cut walked no step of the lane');
  }finally{harness.cleanup();}
});

test('the fan-out cap and the seam rule are read from the allocation profile, never guessed',()=>{
  const allocator={...fakeAllocator({maxParallelOps:10}),fanOut:{seamFirst:true,maxPerGroup:1}};
  const {harness,state,log}=runCut({allocator,scripts:cutScripts({
    'verify-1':[{outcome:'done',summary:'green',files:[],checks:[passing('payment-works','npx vitest run payment')]}],
    'verify-2':[{outcome:'done',summary:'green',files:[],open:[],checks:[passing('payment-works','npx vitest run payment')]}]})});
  try{
    const deferred=log.filter(event=>event.event==='schedule-deferred'&&event.parent===CHECKOUT);
    assert.ok(deferred.length,'a child past the cap waits instead of taking a free slot');
    assert.ok(deferred.every(event=>/already run \(allocation\.fanOut\.maxPerGroup\)|runs alone/.test(event.reason)));
    // Capped at one, the two siblings still finish - one after the other, never at the same time.
    for(const id of CHILDREN)assert.equal(state.ops.find(op=>op.id===id).status,'done',id);
    assert.deepEqual(state.ops.filter(op=>op.origin==='verify').map(op=>op.kind),['e2e.verify','review.verify']);
  }finally{harness.cleanup();}
});

test('public retry reconciles only the exact exited native attempt before releasing its candidate fence',()=>{
  const lease={workflowId:'wf',opId:'author',attempt:3,generation:7,jobId:'operation-job',leaseToken:'token'},identity={workflowId:'wf',opId:'author',attempt:3,generation:7,jobId:'operation-job'};
  const op={id:'author',attempt:3,status:'ready',lease:lease,candidate:{identity},launch:{task:'task-native',dispatch:'ctx-native'}};
  const state={id:'wf',run:'run-native',worktree:'C:/repo',engine:{generation:7},ops:[op]},events=[];
  const store={appendEvent:event=>events.push(event),saveState(){}},result={dispatch:{id:'ctx-native',task_id:'task-native',run_id:'run-native'},worker:{dispatch_id:'ctx-native',state:'failed',stage:'process_exited'},observation:{exactWorker:true,status:'exited'},terminal:{handle:'term-native',connected:false,writable:false,paneRuntimeId:-1}};
  let settled=0,closed=0;
  const orca={invoke:()=>({outcome:'ok',receipt:{result}})},createRuntime=()=>({settleStoppedOperation(candidate,{dispatch,settlement}){assert.equal(candidate,op);assert.equal(dispatch,'ctx-native');assert.equal(settlement.effectState,'none');settled++;delete candidate.lease;candidate.ownedBaselinePaths=['src/real.ts'];candidate.retryReconciled={schema:'starci/native-retry-reconciliation@1',jobId:'operation-job',attempt:3,generation:7,dispatch,observedFiles:['src/real.ts'],candidateDigest:'candidate'};return {ok:true,observedFiles:['src/real.ts'],candidateDigest:'candidate'};},close(){closed++;}});
  const recovered=reconcileStoppedNativeRetryLease(state,op,{orca,store,createRuntime,settleHost:(_host,dispatch)=>({schema:'starci/orca-supervised-settlement@1',dispatchId:dispatch,effectState:'none'})});
  assert.equal(recovered.ok,true);assert.equal(settled,1);assert.equal(closed,1);assert.deepEqual(op.ownedBaselinePaths,['src/real.ts']);assert.equal(events.at(-1).event,'retry-native-attempt-reconciled');
  const attemptLease={...lease},attemptIdentity={...identity},attemptOnly={id:'author',attempt:3,status:'ready',lease:attemptLease,candidate:{identity:attemptIdentity},
    launch:{task:'task-native',dispatch:null,attempts:[{target:'claude-opus',dispatchId:'ctx-native',stage:'dispatch_input',effectState:'unknown'}]}};
  let attemptSettled=0;
  const attemptRecovered=reconcileStoppedNativeRetryLease(state,attemptOnly,{orca,store,
    createRuntime:()=>({settleStoppedOperation(candidate,{dispatch,settlement}){assert.equal(candidate,attemptOnly);assert.equal(dispatch,'ctx-native');assert.equal(settlement.effectState,'none');attemptSettled++;delete candidate.lease;return {ok:true,observedFiles:[],candidateDigest:'attempt-candidate'};},close(){}}),
    settleHost:(_host,dispatch)=>({schema:'starci/orca-supervised-settlement@1',dispatchId:dispatch,effectState:'none'})});
  assert.equal(attemptRecovered.ok,true,attemptRecovered.reason);assert.equal(attemptSettled,1,'one exact persisted attempt supplies the missing top-level dispatch identity');
  const ambiguous={...attemptOnly,lease:{...lease},candidate:{identity:{...identity}},launch:{...attemptOnly.launch,attempts:[{dispatchId:'ctx-native'},{dispatchId:'ctx-other'}]}};
  const ambiguousResult=reconcileStoppedNativeRetryLease(state,ambiguous,{orca,store,createRuntime(){throw Error('must not create runtime');},settleHost(){throw Error('must not settle');}});
  assert.equal(ambiguousResult.ok,false);assert.match(ambiguousResult.reason,/identity is incomplete/,'multiple persisted attempts stay unknown instead of choosing one');
  const mismatched={...op,lease:lease,candidate:{identity},launch:{task:'task-native',dispatch:'ctx-other'}};
  const denied=reconcileStoppedNativeRetryLease(state,mismatched,{orca,store,createRuntime(){throw Error('must not create runtime');},settleHost(){throw Error('must not settle');}});
  assert.equal(denied.ok,false);assert.match(denied.reason,/exact current Run\/Task\/Dispatch/);
  // An operation whose counter already moved past the leased attempt (a partial report advanced it) still binds
  // through the candidate identity; one whose lease names a LATER attempt than the operation does not.
  const advanced={...op,attempt:4,lease:lease,candidate:{identity},launch:{task:'task-native',dispatch:'ctx-native'},ownedBaselinePaths:undefined};
  const createRuntimeAhead=()=>({settleStoppedOperation(candidate,{dispatch,settlement}){assert.equal(candidate,advanced);assert.equal(dispatch,'ctx-native');assert.equal(settlement.effectState,'none');delete candidate.lease;return {ok:true,observedFiles:['src/real.ts'],candidateDigest:'digest'};},close(){}});
  const ahead=reconcileStoppedNativeRetryLease(state,advanced,{orca,store,createRuntime:createRuntimeAhead,settleHost:(_host,dispatch)=>({schema:'starci/orca-supervised-settlement@1',dispatchId:dispatch,effectState:'none'})});
  assert.equal(ahead.ok,true,ahead.reason);
  // A process Orca records as exited inside a tab the kernel never closed is still an exited process: the tab is
  // closed by the settlement, and the reconciliation proceeds.
  const openTab={...result,observation:{exactWorker:true,status:'live',agentWait:null},worker:{dispatch_id:'ctx-native',state:'failed',stage:'process_exited'},terminal:{handle:'term-open',connected:true,writable:true,paneRuntimeId:-1}};
  const tabbed={...op,attempt:3,lease:lease,candidate:{identity},launch:{task:'task-native',dispatch:'ctx-native'}};
  const closes=[];
  const withTab=reconcileStoppedNativeRetryLease(state,tabbed,{orca:{invoke:()=>({outcome:'ok',receipt:{result:openTab}})},store,
    createRuntime:()=>({settleStoppedOperation(candidate){delete candidate.lease;return {ok:true,observedFiles:[],candidateDigest:'d'};},close(){}}),
    settleHost:(_host,dispatch,options)=>{closes.push([options.terminalHandle,options.closeTerminal]);return {schema:'starci/orca-supervised-settlement@1',dispatchId:dispatch,effectState:'none'};}});
  assert.equal(withTab.ok,true,withTab.reason);
  assert.deepEqual(closes,[['term-open',true]],'the open tab is closed as part of the settlement');
  const stillRunning={...openTab,worker:{dispatch_id:'ctx-native',state:'running',stage:'process_running'}};
  assert.match(reconcileStoppedNativeRetryLease(state,{...tabbed,lease:lease},{orca:{invoke:()=>({outcome:'ok',receipt:{result:stillRunning}})},store,createRuntime(){throw Error('must not');},settleHost(){throw Error('must not');}}).reason,/does not prove/);
  const behind={...op,attempt:2,lease:lease,candidate:{identity},launch:{task:'task-native',dispatch:'ctx-native'}};
  assert.match(reconcileStoppedNativeRetryLease(state,behind,{orca,store,createRuntime(){throw Error('must not');},settleHost(){throw Error('must not');}}).reason,/do not bind the current workflow operation attempt/);
});

test('public retry settles an answered decision rerun only from exact stopped custody and retains its user-owned tab',()=>{
  const receipt='owner-receipt',lease={workflowId:'wf',opId:'ask',attempt:3,generation:7,jobId:'operation-ask',leaseToken:'token'},identity={workflowId:'wf',opId:'ask',attempt:3,generation:7,jobId:'operation-ask'},
    op={id:'ask',kind:'decision.prepare',attempt:3,status:'done',lease,candidate:{identity},dispatch:'ctx-ask',terminal:'term-owner',
      launch:{task:'task-ask',dispatch:'ctx-ask'},question:{prepared:true},ownerAnswer:{receiptId:receipt},ownerRequestStatus:'answered',ownerContinuationReceipt:receipt},
    state={id:'wf',run:'run-native',worktree:'C:/repo',engine:{generation:7},ops:[op]},events=[],closes=[];
  const result={dispatch:{id:'ctx-ask',task_id:'task-ask',run_id:'run-native',status:'completed',completed_at:'2026-09-16T12:00:00Z',capability_revoked_at:'2026-09-16T12:00:00Z'},
    worker:{dispatch_id:'ctx-ask',state:'succeeded',stage:'settled'},observation:{exactWorker:true,status:'live'},terminal:{handle:'term-owner',connected:true,writable:true,paneRuntimeId:42},
    terminalResource:{originDispatchId:'ctx-ask',terminalHandle:'term-owner',ownershipState:'USER_OWNED'}};
  const recovered=reconcileStoppedNativeRetryLease(state,op,{acceptedPreparedDecision:true,store:{appendEvent:event=>events.push(event),saveState(){}},orca:{invoke:()=>({outcome:'ok',receipt:{result}})},
    settleHost:()=>{closes.push(true);throw Error('a user-owned terminal must not be stopped or released');},
    createRuntime:()=>({settleStoppedOperation(candidate,input){assert.equal(input.acceptedPreparedDecision,true);assert.equal(input.settlement.schema,'starci/orca-user-takeover-settlement@1');delete candidate.lease;return {ok:true,observedFiles:[],candidateDigest:'empty',acceptedPreparedDecision:true};},close(){}})});
  assert.equal(recovered.ok,true,recovered.reason);assert.deepEqual(closes,[]);assert.equal(op.terminal,'term-owner');assert.equal(op.dispatch,'ctx-ask');
  assert.equal(op.ownerAnswer.receiptId,receipt);assert.equal(events.at(-1).event,'prepared-decision-lease-reconciled');
  assert.equal(retryableOperation({...op,status:'answering',lease:{...lease}}),false,'an authenticated answered decision is never relaunched');
  assert.equal(retryableOperation({...op,status:'answering',lease:{...lease},ownerAnswer:undefined,ownerContinuationReceipt:undefined,ownerRequestStatus:'waiting-owner'}),false,
    'an accepted prepared question waits for its owner without relaunching or retaining a new writer');
  const missingReceipt={...op,lease:{...lease},ownerContinuationReceipt:'different'};
  assert.match(reconcileStoppedNativeRetryLease(state,missingReceipt,{acceptedPreparedDecision:true,store:{},orca:{},createRuntime(){throw Error('must not');}}).reason,/still active/);
});

test('late answered-decision recovery binds exact report, question, candidate digest and current bytes',()=>{
  const dir=tmp(),repo=path.join(dir,'repo'),reports=path.join(dir,'reports');fs.mkdirSync(repo,{recursive:true});fs.mkdirSync(reports);
  try{
    const relative='decision.yaml',current=path.join(repo,relative);fs.writeFileSync(current,'choice: open\n');
    const digest=sha256(fs.readFileSync(current)),dispatch='ctx-late',task='task-late',receipt='receipt-owner',reportFile=path.join(reports,`${dispatch}.json`);
    const report={schema:'starci/op-report@1',kind:'op',outcome:'done',run:'run-late',task,dispatch,from:'term-owner',summary:'decision: demo recommended: 2',files:[relative],checks:[],open:[],question:null,
      signal:{type:'worker_done',orcaOutcome:'succeeded'},sent:{messageId:'msg-late',sentAt:2,type:'worker_done'}};
    fs.writeFileSync(reportFile,`${JSON.stringify(report,null,2)}\n`);
    const identity={workflowId:'wf',opId:'ask',attempt:3,generation:7,jobId:'job-late'},packet={...identity,candidateDigest:'candidate-late',roots:[{id:'source',repoRoot:repo,
      observedFiles:[{rootId:'source',path:relative,displayPath:relative}],changes:[{path:relative,afterSha256:digest}]}]},
      base={id:'ask',kind:'decision.prepare',attempt:3,status:'done',terminal:'term-owner',candidateDigest:'candidate-late',candidate:{status:'sealed',candidateDigest:'candidate-late',identity},
        question:{kind:'decision',text:'Choose?',options:[{id:'1',label:'One'},{id:'2',label:'Two'}],prepared:true},ownerRequestStatus:'answered',ownerAnswer:{receiptId:receipt},ownerContinuationReceipt:receipt};
    const store={reportPath:id=>path.join(reports,`${id}.json`)},runtime={candidatePacket:()=>packet},state={id:'wf',run:'run-late'};
    const op=structuredClone(base),staged=stageAnsweredDecisionLateReport(state,op,{store,runtime,dispatchId:dispatch,taskId:task});
    op.dispatch=dispatch;op.launch={task};
    assert.equal(staged.ok,true);assert.equal(op.status,'running');assert.equal(op.lateReportRecovery.ownerReceipt,receipt);assert.equal(op.retainedOwnerTerminal.handle,'term-owner');
    assert.equal(lateReportReplayMatches(state,op,report,{store}),true);
    op.lease={jobId:'job-late',leaseToken:'held-writer'};const before=structuredClone(op),pending=Object.assign(Error('validator pending'),{code:'STARCI_JOB_PENDING',job:{identity:{jobId:'check-late'},status:'running'}});
    op.status='done';delete op.lease;delete op.lateReportRecovery;
    restoreDeferredReportOperation(op,before,pending);
    assert.equal(op.lease.leaseToken,'held-writer');assert.equal(op.lateReportRecovery.reportSha256,before.lateReportRecovery.reportSha256);
    assert.deepEqual(op.pending,{kind:'durable-job',jobId:'check-late',status:'running'});assert.equal(lateReportReplayMatches(state,op,report,{store}),true,'persisted completion can replay after the durable check settles');
    op.status='done';assert.equal(keepsAskTab(state,op),true,'the exact USER_OWNED retained terminal survives answered-decision sweeps');op.status='running';
    op.question.options[1].label='Changed';assert.equal(lateReportReplayMatches(state,op,report,{store}),false,'changed question refuses replay before acceptance effects');
    const badCandidate=structuredClone(base);
    assert.equal(stageAnsweredDecisionLateReport(state,badCandidate,{store,runtime:{candidatePacket:()=>({...packet,candidateDigest:'different'})},dispatchId:dispatch,taskId:task}).ok,false,'candidate digest mismatch refuses recovery');
    fs.writeFileSync(reportFile,`${JSON.stringify({...report,task:'other-task'},null,2)}\n`);
    assert.equal(stageAnsweredDecisionLateReport(state,structuredClone(base),{store,runtime,dispatchId:dispatch,taskId:task}).ok,false,'report identity mismatch refuses recovery');
    fs.writeFileSync(reportFile,`${JSON.stringify(report,null,2)}\n`);fs.writeFileSync(current,'choice: externally changed\n');
    assert.equal(stageAnsweredDecisionLateReport(state,structuredClone(base),{store,runtime,dispatchId:dispatch,taskId:task}).ok,false,'canonical digest mismatch refuses recovery');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a stray is quarantined when git names the file and the validator names the reserved directory above it',()=>{
  const harness=setupWork({dirty:['apps/agentos-controlplane/src/sales/intake.ts'],scripts:{}});
  try{
    const {store,state,repo}=harness;
    approve(store,state);
    state.run='run_wf';state.from='term_kernel';
    // Root `_resources` is valid typed custody; `_archive` is not canonical Work. The validator reports the
    // invalid parent while git reports the file three levels under it.
    const stray=path.join(repo,'.starciwork','_archive','identity','recovery','stale.yaml');
    fs.mkdirSync(path.dirname(stray),{recursive:true});
    fs.writeFileSync(stray,'sops: {}\n');
    const validate=()=>({ok:false,errors:[{code:'RESERVED_DIRECTORY',path:'_archive',message:'Canonical Work v2 permits only root _local and _resources.'}],warnings:[],nodes:[],resources:[]});
    const git=(executable,args,options)=>args[0]==='status'&&args.includes('.starciwork')
      ?{status:0,stdout:'?? .starciwork/_archive/identity/recovery/stale.yaml\n',stderr:''}
      :harness.git.git(executable,args,options);
    harness.run({maxIterations:2,git,validate:()=>fs.existsSync(stray)?validate():harness.validate()});
    const log=events(store);
    const quarantined=log.find(event=>event.event==='stray-quarantined');
    assert.ok(quarantined,'the stray was quarantined even though the error names its parent');
    assert.deepEqual(quarantined.strays.map(item=>item.from),['.starciwork/_archive/identity/recovery/stale.yaml']);
    assert.equal(fs.existsSync(stray),false,'the stray left the tree');
    assert.ok(log.some(event=>event.event==='ledger-valid-again'),'and the tree reads clean again');
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ goal revisions and done metrics
 * The goal freezes at rev 1 with a checkable `done` contract; the typed `goal.revise` is the only way it
 * moves, and a report that lands on an older rev counts only while every input it was derived from still
 * reads the same.
 */
const goalFixture=()=>{
  const repo=tmp();
  const store=createStore({repoRoot:repo,id:'20260912-120000-goal-spec'});
  const state=createWorkflowState({job:'Ship the goal',inputs:[],worktree:repo,branch:'main',store});
  const op=(id='op-a',extra={})=>toOp({id,kind:'backend.implement',goal:'build A',ledgerIds:['feature-a'],allowlist:['src/a.ts'],...extra});
  return {repo,store,state,op,cleanup:()=>fs.rmSync(repo,{recursive:true,force:true})};
};

test('goal metrics evaluate against the ledger, gates and kernel-derived ops; a fresh goal is rev 1',()=>{
  const {state,op,cleanup}=goalFixture();
  try{
    assert.equal(state.goalRev,1,'a fresh workflow goal is rev 1');
    assert.equal(goalRevOf({}),1,'a state written before versioning still reads as rev 1');
    assert.equal(normalizeDoneMetrics('verified'),null,'a done block is a list');
    assert.equal(normalizeDoneMetrics([]),null,'an empty block is not a block');
    state.ledger=[{id:'feature-a',title:'A',status:'implemented'},{id:'feature-b',title:'B',status:'verified'}];
    state.gates=[{name:'smoke',command:'npm test'}];
    const intake=op('op-intake',{ledgerIds:[],allowlist:['.starciwork/**']});intake.intake={scope:'feature-a'};
    state.ops=[intake];
    let evaluated=evaluateGoalMetrics(state);
    assert.deepEqual(evaluated.metrics.map(m=>m.id).sort(),['gate:smoke','ledger:feature-a','ledger:feature-b','operation:op-intake']);
    assert.equal(evaluated.ok,false);
    assert.deepEqual(evaluated.gaps.map(m=>m.id).sort(),['gate:smoke','ledger:feature-a','operation:op-intake']);
    // The supplied `done` block, not the derivation, is what a declared contract is checked against.
    evaluated=evaluateGoalMetrics(state,{done:[{kind:'ledger',ref:'feature-a',expect:['implemented']}]});
    assert.equal(evaluated.ok,true,'a metric that declares its own expect list is judged by it');
    assert.equal(evaluateGoalMetrics(state,{done:[{kind:'ledger',ref:'ghost'}]}).unevaluable.length,1,'a ref the goal does not hold is unevaluable, not merely unmet');
    state.gateResults=[{name:'smoke',status:'passed',exitCode:0}];state.ledger[0].status='verified';intake.status='done';
    assert.equal(evaluateGoalMetrics(state).ok,true,'every metric holding is what done means');
    assert.deepEqual(metricsBindingOp(state,op()).map(m=>m.id),['ledger:feature-a'],'an op answers for the ledger items it serves');
    assert.deepEqual(metricsBindingOp(state,intake).map(m=>m.id),['operation:op-intake']);
  }finally{cleanup();}
});

test('approval freezes the goal at rev 1, stamps every derivation and refuses a goal with no evaluable metric',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.definitionOfDone=['A exists'];
    state.ledger=[{id:'feature-a',title:'A',status:'planned'}];
    const build=op();build.question={kind:'decision',text:'Which?',record:'feature-a'};
    state.ops=[build];
    state.decisions=[{id:'dec-1',kind:'decision',title:'Pick'}];
    state.quota='qwen:1';
    approve(store,state);
    assert.equal(state.goalRev,1);
    assert.equal(build.goalRev,1,'the op binds the rev it was derived under');
    assert.equal(build.question.goalRev,1,'and its question');
    assert.equal(state.decisions[0].goalRev,1,'and each decision');
  }finally{cleanup();}
  // The enrolled goal.json names the frozen rev and materializes the `done` contract it was assessed under.
  const harness=setup({plan:salesPlan,scripts:{}});
  try{
    const written=JSON.parse(fs.readFileSync(harness.store.paths.goalJson,'utf8'));
    assert.equal(written.rev,1,'the machine contract on disk names the frozen rev');
    assert.deepEqual(written.done,[{id:'ledger:goal-1',kind:'ledger',ref:'goal-1',expect:['verified','preexisting','out-of-repository']}],
      'with no declared block, the materialized contract is the derivation: every ledger item verified');
  }finally{harness.cleanup();}
  // A goal nothing can evaluate is refused at enroll, not discovered at the finish line.
  const bare=goalFixture();
  try{
    bare.state.definitionOfDone=['something'];bare.state.ops=[bare.op('op-x',{ledgerIds:[]})];bare.state.quota='qwen:1';
    assert.throws(()=>approve(bare.store,bare.state),/no evaluable done metric/);
  }finally{bare.cleanup();}
});

test('goal.revise validates the contract, bumps the rev, persists goal.json and records the diff',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',inputRef:'sds:old',status:'planned'}];
    state.ops=[op()];
    // The contract: a `done` block of checkable metrics, stable ids, the same workflow identity.
    assert.throws(()=>reviseGoal(store,state,{}),/`done` block/);
    assert.throws(()=>reviseGoal(store,state,{done:[]}),/`done` block/);
    assert.throws(()=>reviseGoal(store,state,{done:[{kind:'ledger',ref:'ghost'}]}),/does not hold/);
    assert.throws(()=>reviseGoal(store,state,{done:[{kind:'ledger',ref:'feature-a'}],ledger:[]}),/cannot drop ledger ids/);
    assert.throws(()=>reviseGoal(store,state,{done:[{kind:'ledger',ref:'feature-a'}],ops:[]}),/cannot drop op ids/);
    assert.throws(()=>reviseGoal(store,state,{id:'other',done:[{kind:'ledger',ref:'feature-a'}]}),/identity/);
    assert.throws(()=>reviseGoal(store,{...state,approved:false},{done:[{kind:'ledger',ref:'feature-a'}]}),/no approved goal/);
    const revised=reviseGoal(store,state,{done:[{kind:'ledger',ref:'feature-a'},{kind:'ledger',ref:'feature-b'}],
      ledger:[{id:'feature-a',title:'A',inputRef:'sds:old'},{id:'feature-b',title:'B',inputRef:'sds:new'}]});
    assert.equal(revised.rev,2);assert.equal(state.goalRev,2);
    assert.equal(state.ledger.length,2,'a revision may add items; dropping them was refused above');
    assert.equal(state.ledger[1].goalRev,2,'the item this revision made belongs to the new rev');
    assert.equal(state.ops[0].goalRev,1,'the op still names the rev it was derived under');
    assert.ok(!state.ops[0].goalStale,'and nothing it read moved');
    const written=JSON.parse(fs.readFileSync(store.paths.goalJson,'utf8'));
    assert.equal(written.rev,2);assert.deepEqual(written.done.map(m=>m.id),['ledger:feature-a','ledger:feature-b']);
    assert.equal(state.goalRevisions.length,1);assert.equal(state.goalRevisions[0].schema,'starci/goal-revision@1');
    assert.deepEqual(state.goalRevisions[0].changed.records,['feature-b']);
    assert.ok(state.goalDigest,'the revision froze the goal identity before moving it, so the durable binding still attests it');
    const revisedEvent=store.readEvents().find(e=>e.event==='goal-revised');
    assert.equal(revisedEvent.rev,2);assert.equal(revisedEvent.fromRev,1);
  }finally{cleanup();}
});

test('a report dispatched under rev N is adopted while every input it was derived from still reads the same',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',inputRef:'sds:old',status:'planned'}];
    const build=op();state.ops=[build];
    build.goalRev=1;build.status='running';build.inputDigests=opInputDigests(state,build,null);
    // Rev 2 adds a sibling item; nothing op-a reads moved.
    reviseGoal(store,state,{done:[{kind:'ledger',ref:'feature-a'},{kind:'ledger',ref:'feature-b'}],
      ledger:[{id:'feature-a',title:'A',inputRef:'sds:old'},{id:'feature-b',title:'B'}]});
    assert.equal(build.inputsHeld,true,'the in-flight revalidation proved the digests still hold');
    build.reports.push({attempt:1,outcome:'done',summary:'built',goalRev:1});
    const adopted=adoptReportRev(store,state,build,null);
    assert.deepEqual([adopted.stale,adopted.adopted],[false,true]);
    assert.equal(build.goalRev,2,'adoption binds the op to the rev its report landed under');
    assert.equal(build.reports.at(-1).stale,undefined,'and the report keeps no stale mark');
    assert.equal(build.goalStale,undefined);
    assert.ok(store.readEvents().some(e=>e.event==='goal-rev-adopted'&&e.op==='op-a'&&e.toRev===2));
  }finally{cleanup();}
});

test('a report whose inputs moved under rev N+1 is stale, does not count, and reopens the owed work',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',inputRef:'sds:old',status:'planned'}];
    const build=op();state.ops=[build];
    build.goalRev=1;build.status='running';build.inputDigests=opInputDigests(state,build,null);
    // Rev 2 rewrites the item the op was derived from.
    reviseGoal(store,state,{done:[{kind:'ledger',ref:'feature-a'}],
      ledger:[{id:'feature-a',title:'A renamed',inputRef:'sds:new'}]});
    assert.equal(build.goalStale?.rev,2,'the propagation marked the derivation stale');
    assert.equal(state.ledger[0].goalStale?.rev,2,'and the record it serves');
    assert.equal(build.inputsHeld,false,'the in-flight revalidation saw the input move');
    build.reports.push({attempt:1,outcome:'done',summary:'built the old spec',goalRev:1});
    const adopted=adoptReportRev(store,state,build,null);
    assert.equal(adopted.stale,true);
    assert.equal(build.reports.at(-1).stale.fromRev,1,'the stale mark is on the record - visible, never dropped');
    assert.equal(build.goalRev,1,'a stale op is not adopted into the new rev');
    assert.equal(reopenStaleOp(store,state,build,null),'goal-rev-stale');
    assert.equal(build.status,'ready','the bound ledger metric is still unmet, so the op re-queues under the new rev');
    assert.equal(build.attempt,2);
    const log=store.readEvents();
    assert.ok(log.some(e=>e.event==='goal-rev-stale'&&e.op==='op-a'));
    assert.ok(log.some(e=>e.event==='goal-rev-reopened'&&e.op==='op-a'));
  }finally{cleanup();}
});

test('a stale report whose bound metrics already hold settles the op instead of reopening it',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',status:'verified'}];
    const build=op();state.ops=[build];
    build.goalRev=1;build.status='running';build.inputDigests=opInputDigests(state,build,null);
    // Rev 2 moves prose the op's input digests cover but leaves its verified item alone.
    reviseGoal(store,state,{done:[{kind:'ledger',ref:'feature-a'}],definitionOfDone:['a stricter definition']});
    build.reports.push({attempt:1,outcome:'done',summary:'done',goalRev:1});
    assert.equal(adoptReportRev(store,state,build,null).stale,true,'the definition of done is an input the op read');
    assert.equal(reopenStaleOp(store,state,build,null),'goal-rev-stale');
    assert.equal(build.status,'skipped','its metric already holds, so nothing is owed to reopen');
    assert.equal(build.verdict,'stale');
  }finally{cleanup();}
});

test(`${GOAL_SPIN_LIMIT} settled dispatches that move no metric surface a classified stall, then progress clears it`,()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',status:'planned'}];
    state.ops=[op()];
    noteGoalMetrics(store,state);
    assert.equal(state.goalStatus.ok,false);assert.deepEqual(state.goalStatus.gaps,['ledger:feature-a']);
    for(let attempt=1;attempt<=GOAL_SPIN_LIMIT;attempt+=1)state.ops[0].reports.push({attempt,outcome:'partial',goalRev:1});
    noteGoalMetrics(store,state);
    assert.equal(state.goalStatus.dispatchesWithoutProgress,GOAL_SPIN_LIMIT);
    assert.equal(state.metricSpin.stalled,true);
    const stall=state.needUser.find(item=>item.code==='goal-metric-spin');
    assert.equal(stall?.kind,'stall','the classification is a stall, not a silent end');
    assert.ok(stall.detail.includes('ledger:feature-a'));
    assert.ok(store.readEvents().some(e=>e.event==='goal-stall'&&e.kind==='stall'));
    // Once classified it is not re-classified every tick.
    state.ops[0].reports.push({attempt:GOAL_SPIN_LIMIT+1,outcome:'partial',goalRev:1});
    noteGoalMetrics(store,state);
    assert.equal(store.readEvents().filter(e=>e.event==='goal-stall').length,1);
    // The signature moving again - progress - clears the classification.
    state.ledger[0].status='verified';
    assert.equal(noteGoalMetrics(store,state).ok,true);
    assert.equal(state.metricSpin.stalled,false);
    assert.equal(state.metricSpin.reportsAtChange,GOAL_SPIN_LIMIT+1);
    assert.ok(!state.needUser.some(item=>item.code==='goal-metric-spin'));
  }finally{cleanup();}
});

test('a goal-revise command in the inbox applies the typed transition on the next tick and a bad body is recorded, not applied',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',status:'planned'}];
    state.ops=[op()];
    queueInbox(store,{kind:'goal-revise',goal:{done:[{kind:'ledger',ref:'feature-a'}],definitionOfDone:['A exists']},source:'owner'});
    applyInbox(store,state,{});
    assert.equal(state.goalRev,2,'the inbox command ran the typed revision');
    const log=store.readEvents();
    assert.ok(log.some(e=>e.event==='goal-revised'&&e.rev===2));
    assert.ok(log.some(e=>e.event==='inbox-applied'&&e.kind==='goal-revise'));
    queueInbox(store,{kind:'goal-revise',goal:{}});
    applyInbox(store,state,{});
    assert.equal(state.goalRev,2,'the invalid body did not move the rev');
    assert.ok(store.readEvents().some(e=>e.event==='inbox-rejected'&&e.kind==='goal-revise'));
  }finally{cleanup();}
});

test('workflow-revise applies a typed revision to a stopped kernel and queues it to a live one',()=>{
  const {store,state,op,cleanup}=goalFixture();
  try{
    state.approved=true;
    state.ledger=[{id:'feature-a',title:'A',status:'planned'}];
    state.ops=[op()];
    store.saveState(state);
    const file=path.join(store.dir,'rev2.json');
    fs.writeFileSync(file,JSON.stringify({done:[{kind:'ledger',ref:'feature-a'}],definitionOfDone:['A exists']}));
    // No kernel.lock: the stopped path applies the revision itself.
    const applied=kernelMain('workflow-revise',{id:state.id,revision:file},{cwd:store.repoRoot,orca:null,wait:()=>{}});
    assert.equal(applied.rev,2);assert.equal(applied.fromRev,1);
    const saved=createStore({repoRoot:store.repoRoot,id:state.id}).loadState();
    assert.equal(saved.goalRev,2);assert.equal(saved.doneMetrics.length,1);
    assert.equal(saved.ops[0].goalRev,1);
    // A live kernel.lock: the command queues the revision for the running kernel's next tick.
    fs.writeFileSync(path.join(store.dir,'kernel.lock'),JSON.stringify({pid:process.pid}));
    fs.writeFileSync(file,JSON.stringify({done:[{kind:'ledger',ref:'feature-a'}],scope:['src/']}));
    const queued=kernelMain('workflow-revise',{id:state.id,revision:file},{cwd:store.repoRoot,orca:null,wait:()=>{}});
    assert.equal(queued.queued,true);assert.ok(fs.existsSync(queued.inbox));
    // And the kernel itself applies the queued command: the durable inbox hands the state across.
    const durable=createStore({repoRoot:store.repoRoot,id:state.id}).loadState();
    applyInbox(store,durable,{});
    assert.equal(durable.goalRev,3);assert.deepEqual(durable.scope,['src/']);
  }finally{cleanup();}
});
