import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {resolveExecutionChain} from '../kernel/chains.mjs';
import {ORCA_HOST,createOrcaCalls} from '../hosts/orca/calls.mjs';
import {HEADLESS_HOST,createHeadlessHost} from '../hosts/headless/host.mjs';
import {reportOutcome} from '../hosts/orca/protocol.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {spawnSync} from 'node:child_process';
import {validateGoalPlan,validateOp} from '../models/functions.mjs';
import {createStore} from '../kernel/store.mjs';
import {createAllocator} from '../kernel/schedule.mjs';
import {loadsFileFor} from '../kernel/loads.mjs';
import {resolveLedgerRoot} from '../kernel/routing.mjs';
import * as work from '../kernel/ledger.mjs';
import {describeLane,laneFor,nextKind,roleOf as graphRoleOf,routeFor,validateGraph} from '../kernel/graph.mjs';
import {machineVerify} from '../kernel/kernel.mjs';
import {BRAND_DECIDE,BRAND_PAYLOAD,DESIGN_KINDS,DYNAMIC_OPS_BUDGET,RATE_LIMIT_COOLDOWN_MS,SPEC_LIMIT,critiqueRuntimes,operationSpec,queueInbox,credentialNeed,rebindRunIfNeeded,reportAllowlist,sharedCheckCommand,treeForVerdict,treeVerdictFor,TRIAGE_AFTER,TRIAGE_OPTIONS,VALIDATOR_REJECT_LIMIT,VALIDATOR_UNAVAILABLE_LIMIT,applyOpReport,approve,brandPayload,brandSummary,changedFiles,createWorkflowState,designRecord,detectLedgerMode,drainSharedQueue,goalPhase,hostDescriptorOf,hostMissing,kernelGuards,kernelMain,laneLine,lanePredicates,launchOperator,launchWithCandidate,noteAnomaly,readValidatorMemory,reconcileWithOrca,renderContract,resumePaused,runLoop,settleStalled,triageAnomaly,validatorRejectLimit,workModule,workOpId,proposeQuota} from '../kernel/kernel.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const runtimeProfile=parseYaml(fs.readFileSync(new URL('../model/runtimes.yaml',import.meta.url),'utf8'));
const worktree='fixtures/orca/agentos-r14-sales';
const cwd=path.resolve(worktree);
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const noWait=()=>{};
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-workflow-kernel-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const flag=(args,name)=>{const index=args.indexOf(`--${name}`);return index<0?null:args[index+1];};
const events=store=>store.readEvents();
const indexOfEvent=(list,predicate)=>list.findIndex(predicate);

/**
 * One scripted Orca for a whole 5.0 workflow: it launches command-terminal (qwen) and managed-agent
 * (claude, codex) operations through the real launcher, and the blocking wait "finishes" each live
 * operation by writing the next report scripted for its operation id.
 */
function scriptedOrca({reportsDir,scripts,run='run_wf'}){
  const terminals=new Map(),dispatches=new Map(),tasks=new Map(),live=new Map();
  const taken=new Map();let counter=0;const sends=[];
  const opOf=spec=>(String(spec??'').match(/op `([^`]+)`/)??[null,'unknown'])[1];
  const newHandle=()=>`term_${++counter}`;
  const screenOf=handle=>{
    const terminal=terminals.get(handle);
    if(!terminal)return [];
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
      const found=dispatches.get(flag(args,'dispatch'));
      if(!found)return json(1,{ok:false,error:{message:'unknown dispatch'}});
      const terminal=terminals.get(found.handle);
      return json(0,{ok:true,result:{dispatch:{id:found.id,task_id:found.task,status:'dispatched'},
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
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),terminals,dispatches,live,sends};
}

/** Pools instead of a chain: least-index-free runtime per role, honouring `avoid`. */
function fakeAllocator({maxParallelOps=3,pools={implement:['qwen3.8-flash','claude-opus','gpt-5.6-sol'],verify:['qwen3.8-flash','claude-fable-5.1','gpt-5.6-sol'],decide:['claude-fable-5.1','gpt-6-astra'],write:['gpt-5.6-sol','claude-opus','qwen3.8-flash'],plan:['claude-fable-5.1','gpt-6-astra']}}={}){
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
    release(runtime){busy.delete(runtime);},
    failed(runtime){busy.delete(runtime);},
    snapshot(){return {busy:[...busy]};},
    serialize(){return {busy:[...busy]};},
    candidateFor(kind,target){
      const found=resolveExecutionChain({skill:'starci',op:kind}).candidates.find(candidate=>candidate.target===target);
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
const running=(state,id,dispatch,runtime='qwen3.8-flash')=>{
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
  const run=(options={})=>runLoop(fake.orca,store,state,{cwd,allocator,template,wait:noWait,
    exec:exec??((command)=>{runs.push(command);return {status:0,stdout:`${command} ok`,stderr:''};}),
    git:git.git,planOp:()=>{throw Error('planOp must not be called on this path');},
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    validateOp:acceptAll,
    waitTimeoutMs:2000,tickMs:1000,maxIterations:12,...options});
  return {repo,store,state,goal,fake,git,run,runs,allocator,
    cleanup:()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true})};
}

const salesPlan={
  definitionOfDone:['order intake persists an order','the receipt is rendered'],
  ledger:[{id:'goal-1',title:'Order intake',inputRef:'sds:SDS-FR-SALES-03',status:'absent'}],
  ops:[{id:'op-intake',kind:'backend.implement',goal:'Implement order intake.',ledgerIds:['goal-1'],
    allowlist:['apps/agentos-controlplane/src/sales/intake.ts'],references:['.starciwork/features/sales/sds.md#3'],
    checks:[{name:'unit',command:'npx vitest run sales'}],acceptance:['intake persists an order'],dependsOn:[]}]
};

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
    assert.match(contract,/## Acceptance/);assert.match(contract,/## Never/);
    // A plan-mode backend.implement op without a Work node still gets the implement.ledger working order.
    assert.match(contract,/## Working order \(mandatory, in this order\)\nSequence `implement\.ledger`\./);
    assert.match(contract,/## Definition of done for this kind/);
    assert.match(contract,/node L\.mjs report --run run_wf/);
    assert.match(contract,/- `apps\/agentos-controlplane\/src\/sales\/intake\.ts`/);
    assert.doesNotMatch(contract,/<launcher>|<nested run>|<runtime dir>|<reports dir>/);
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
    assert.deepEqual(firstRound.map(event=>event.runtime).sort(),['claude-opus','gpt-5.6-sol','qwen3.8-flash']);
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
    const resumed=runLoop(harness.fake.orca,harness.store,saved,{cwd,allocator:fakeAllocator(),template,wait:noWait,validateOp:acceptAll,
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
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
});

test('the review loop is bounded: three rounds of findings end in needUser instead of a fourth review',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const done=summary=>({outcome:'done',summary,files:[file],checks:[passing('unit','npx vitest run sales')]});
  const finding=round=>({outcome:'partial',summary:`Review round ${round} rejected the work.`,files:[],
    checks:[passing('review','npx vitest run sales')],open:[`${file} still does not persist the receipt (round ${round})`]});
  const harness=setup({plan:salesPlan,dirty:[file],
    scripts:{'op-intake':[done('Intake implemented.')],'verify-1':[finding(1)],'repair-1':[done('Receipt added.')],
      'verify-2':[finding(2)],'repair-2':[done('Receipt fixed.')],'verify-3':[finding(3)]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    assert.deepEqual(state.ops.map(op=>op.id),['op-intake','verify-1','repair-1','verify-2','repair-2','verify-3']);
    assert.deepEqual(state.ops.filter(op=>op.kind==='review.verify').map(op=>op.verdict),['fail','fail','fail']);
    // Each repair is scoped to the file the finding named, inside the reviewed group's allowlist.
    assert.deepEqual(state.ops.find(op=>op.id==='repair-1').allowlist,[file]);
    assert.equal(state.verifyRounds['goal-1'],3);
    assert.equal(state.ledger[0].status,'review-exhausted','the group is parked, not re-planned every tick');
    assert.equal(state.finished.outcome,'blocked');
    assert.match(state.needUser.find(item=>item.kind==='review').detail,/still fails review after 3 rounds/);
    const log=events(harness.store);
    assert.equal(log.filter(event=>event.event==='verify-limit').length,1);
    assert.equal(log.filter(event=>event.event==='op-created'&&event.kind==='review.verify').length,3);
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.outcome,'blocked');
    assert.deepEqual(final.ledger.map(item=>item.status),['review-exhausted']);
  }finally{harness.cleanup();}
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
${rev===null?'':`extensions:
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
  checks:[passing('work-tree-validates','node starci.mjs validate .starciwork')]});
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

function setupWork({nodes=WORK_NODES,scope=[],reintake=[],scripts={},dirty=[],exec,allocator=fakeAllocator(),gates=[],assessGoal,
  critiqueGoal,ledgerApi,validateOp=acceptAll,binding=null}={}){
  const tree=workRepo(nodes);
  activeRepo=tree.repo;
  const store=createStore({repoRoot:tree.repo,id:'20260912-110000-work-ledger'});
  const state=createWorkflowState({job:'Finish the sales slice',worktree:cwd,branch:'starci183/sales',
    gates,store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'work',scope,reintake,repoRoot:tree.repo});
  const api=ledgerApi?ledgerApi(tree):undefined;
  const goal=goalPhase(store,state,{validate:tree.validate,cwd,...(api?{ledgerApi:api}:{}),
    critiqueGoal:critiqueGoal??soundCritique,
    assessGoal:assessGoal??(({ledger})=>({ok:true,provider:'fake',value:{definitionOfDone:[`the ${ledger.length} listed nodes are done`],risks:[],questions:[]}}))});
  const fake=scriptedOrca({reportsDir:store.paths.reports,scripts});
  const git=fakeGit(dirty);
  const commits=[];
  const run=(options={})=>runLoop(fake.orca,store,state,{cwd,allocator,template,wait:noWait,validate:tree.validate,
    ...(api?{ledgerApi:api}:{}),
    exec:exec??(command=>({status:0,stdout:`${command} ok`,stderr:''})),
    git:(executable,args)=>{if(args[0]==='commit')commits.push(args[args.indexOf('-m')+1]);return git.git(executable,args);},
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    validateOp,
    ...(binding?{resolveLedger:bindingRoles(binding)}:{}),
    waitTimeoutMs:2000,tickMs:1000,maxIterations:12,...options});
  return {...tree,api,store,state,goal,fake,git,run,commits,allocator,cleanup:()=>fs.rmSync(path.dirname(tree.repo),{recursive:true,force:true})};
}

/**
 * A scope the tree does not know yet is not an error and not a guess: the workflow begins with the one op that
 * authors it - a feature's records as drafts, or the brand record - and the tree says what follows.
 */
test('a scope entry that names nothing in the tree begins with an intake operation: a feature is authored as drafts, the brand is authored and decided',()=>{
  const collab=setupWork({scope:['collab']});
  try{
    assert.equal(collab.goal.ok,true);
    assert.deepEqual(collab.state.ops.map(op=>[op.id,op.kind,op.nodeId,op.origin,op.intake]),
      [['collab-intake','work.author',null,'ledger',{scope:'collab',example:'features/payments',mode:'author'}]]);
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
    assert.match(op.goal,/Reconcile and re-author the existing drafts of the feature payments/);
    assert.deepEqual(events(again.store).filter(event=>event.event==='intake-planned').map(event=>event.mode),['reconcile']);
  }finally{again.cleanup();}
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
    // The one op is a work.author (plan role); the strongest runtime has no plan role, so the proposal must not stop there.
    const proposal=harness.state.quotaProposal;
    const opus=proposal.rows.find(row=>row.runtime==='claude-opus');
    assert.ok(opus&&opus.slots>=1,`a runtime with the plan role has a slot: ${proposal.text}`);
    assert.match(opus.why,/plan role/);
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
    queueInbox(store,{kind:'approve',allocation:'claude-opus=2:hard+medium,gpt-5.6-sol=1:hard+medium'});
    const restarted=harness.run({maxIterations:3});
    assert.deepEqual(events(store).filter(event=>event.event==='stopped').map(event=>event.reason).slice(-1),['restart: allocation changed']);
    assert.equal(restarted.quota.slots['claude-opus'],2);
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

test('a question only the owner can answer pauses the op and opens an owner.ask op; the drafted decision is listed, the answer is delivered, and a mechanical question stays with the kernel',()=>{
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const question={outcome:'ask',summary:'Need a ruling.',files:[],checks:[],question:{text:'Which Telegram bot token does the chatbot use, and where does the owner provide it?',options:['a stack secret named TELEGRAM_BOT_TOKEN','an environment variable on the host'],kind:'credential'}};
  const askReport={outcome:'done',summary:'decision: demo.sales.business.srs.decision.d-telegram-token\n1. a stack secret named TELEGRAM_BOT_TOKEN\n2. an environment variable on the host',files:[],checks:[passing('work-tree-validates','node starci.mjs validate')]};
  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[question,{outcome:'done',summary:'Intake implemented with the ruling.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
    'ask-1':[askReport]}});
  try{
    const {store,state}=harness;
    approve(store,state);state.run='run_wf';state.from='term_kernel';
    // Tick 1: the op asks; the kernel never hands a credential question to the supervisor model (the harness decide throws).
    let after=harness.run({maxIterations:1});
    const requester=after.ops.find(op=>op.id===nodeId),ask=after.ops.find(op=>op.kind==='owner.ask');
    assert.ok(ask,'an owner.ask op was opened');
    assert.deepEqual([ask.id,ask.origin,ask.allowlist,ask.requesters,ask.question.kind,ask.question.from],['ask-1','ask',['.starciwork/features/sales/business/srs/decisions/**'],[nodeId],'credential',nodeId]);
    assert.deepEqual([requester.status,requester.waitingFor],['paused','ask-1']);
    assert.ok(events(store).some(event=>event.event==='owner-ask-opened'&&event.op===nodeId&&event.ask==='ask-1'));
    const contract=renderContract({template,op:ask,state:after,store,launcher:'L.mjs',run:'run_wf'});
    assert.match(contract,/## Question for the owner\nAsked by `demo\.sales\.implementation\.backend\.intake` \(credential\): Which Telegram bot token/);
    assert.match(contract,/## Credentials and configuration/);
    // The ask op runs and reports the drafted decision: the question is listed for the owner with its options.
    after=harness.run({maxIterations:4});
    const listed=after.needUser.find(item=>item.kind==='decision');
    assert.ok(listed,'the owner is asked');
    assert.deepEqual([listed.op,listed.record,listed.options.length,listed.requesters],['ask-1','demo.sales.business.srs.decision.d-telegram-token',2,[nodeId]]);
    assert.match(listed.detail,/workflow-answer --id .* --op ask-1 --choice <n>/);
    assert.equal(after.ops.find(op=>op.id===nodeId).status,'paused','the requester still waits');
    // The owner answers through the inbox: the requester resumes with the answer in its next contract.
    queueInbox(store,{kind:'answer',op:'ask-1',choice:'1',note:'the stack secret store, never a .env file'});
    after=harness.run({maxIterations:6});
    const resumed=after.ops.find(op=>op.id===nodeId);
    assert.equal(after.needUser.some(item=>item.kind==='decision'),false,'the question is gone');
    assert.match(String(resumed.answer),/The owner decided on "Which Telegram bot token.*option 1 - a stack secret named TELEGRAM_BOT_TOKEN; the stack secret store/);
    const log=events(store);
    assert.deepEqual(log.filter(event=>event.event==='owner-answered').map(event=>[event.ask,event.choice,event.requesters]),[['ask-1','1',[nodeId]]]);
    assert.ok(log.some(event=>event.event==='owner-answer-delivered'&&event.op===nodeId));
    assert.equal(resumed.status,'done','the requester finished on the ruling');
    assert.match(renderContract({template,op:{...resumed,answer:resumed.answer},state:after,store,launcher:'L.mjs',run:'run_wf'}),/## Answer to the question you asked earlier\nThe owner decided on/);
  }finally{harness.cleanup();}
  // A mechanical question is the kernel's: the supervisor model answers it and no owner.ask op exists.
  const mechanical=setupWork({dirty:[file],scripts:{[nodeId]:[{...question,question:{text:'Run the unit suite with vitest or jest?',options:['vitest','jest'],kind:'mechanical'}},{outcome:'done',summary:'Done.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(mechanical.store,mechanical.state);mechanical.state.run='run_wf';mechanical.state.from='term_kernel';
    const after=mechanical.run({maxIterations:6,decide:()=>({ok:true,value:{option:'answer',instructions:'vitest, as the repository already does',rationale:'tooling'}})});
    assert.equal(after.ops.some(op=>op.kind==='owner.ask'),false);
    assert.ok(events(mechanical.store).some(event=>event.event==='decide'&&event.option==='answer'));
  }finally{mechanical.cleanup();}
});

test('an environment blocker that names a credential is the question of the owner, prepared by an owner.ask op, and credentialNeed reads the detail',()=>{
  assert.equal(credentialNeed('TELEGRAM_BOT_TOKEN is not set; the delivery worker reads it in delivery.module.ts'),true);
  assert.equal(credentialNeed('the Zalo OA api key the owner has not provided'),true);
  assert.equal(credentialNeed('docker is not installed on this host'),false);
  const nodeId='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setupWork({dirty:[file],scripts:{[nodeId]:[{outcome:'blocked',summary:'Cannot deliver without the bot token.',files:[],checks:[],blocker:{kind:'environment',detail:'TELEGRAM_BOT_TOKEN is not provided; apps/agentos-controlplane/src/chatbot/delivery.module.ts reads it at boot'}}]}});
  try{
    approve(harness.store,harness.state);harness.state.run='run_wf';harness.state.from='term_kernel';
    const after=harness.run({maxIterations:1});
    const ask=after.ops.find(op=>op.kind==='owner.ask');
    assert.ok(ask,'the credential need became the question of the owner');
    assert.deepEqual([ask.question.kind,ask.question.from],['credential',nodeId]);
    assert.equal(after.ops.find(op=>op.id===nodeId).status,'paused');
    assert.equal(after.needUser.some(item=>item.kind==='environment'),false,'no bare environment line nobody answers');
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
      {lane:['backend.implement','e2e.verify','review.verify'],done:[],checks:[],head:null});
    const markdown=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(markdown,/## Work nodes this workflow executes/);
    assert.match(markdown,/backend\.implement.*e2e\.verify.*review\.verify \(this op: step 1 of 3\)/);
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
    assert.deepEqual(state.lanes['demo.sales.implementation.backend.intake'].lane,['backend.implement','e2e.verify','review.verify']);
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

/* ------------------------------------------------------------------ lanes and routes */

const CART='demo.sales.implementation.frontend.cart';
const cartFile='apps/web/src/cart/index.tsx';
const cartDone=summary=>({outcome:'done',summary,files:[cartFile],checks:[passing('cart-renders','npx vitest run cart')]});
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
}});
const uiDone=summary=>({outcome:'done',summary,files:[UI_FILE],checks:[passing('sales-surfaces-drawn','node starci.mjs validate .starciwork')]});

test('the kind graph is the lane and route authority: it validates, and the kernel reads the same answers from it',()=>{
  assert.deepEqual(validateGraph(),[]);
  // The ui node is the design record and walks its own lane; the implementation node builds against it.
  assert.deepEqual(laneFor({kind:'ui'}),['interface.draw','interface.asset']);
  assert.deepEqual(laneFor({kind:'implementation',layout:'frontend'}),['frontend.implement','uat.verify']);
  assert.deepEqual(laneFor({kind:'implementation',layout:null}),['backend.implement','e2e.verify','review.verify']);
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
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('The cart surface is drawn.'))],
      [CART]:[cartDone('The cart is built from the accepted design.')],
      [`${CART}-verify`]:[cartDone('The cart flow passes end to end.')]}});
  try{
    // The lane is in goal.md before anything launches: the user approves a template, not a pile of ops.
    const markdown=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(markdown,/interface\.draw.*interface\.asset \(this op: step 1 of 2\)/);
    assert.deepEqual(harness.state.lanes[UI].lane,['interface.draw','interface.asset']);
    assert.deepEqual(harness.state.lanes[CART].lane,['frontend.implement','uat.verify']);
    // The implementation waits for the drawing: its first op exists only once the ui node is done.
    assert.deepEqual(harness.state.ops.map(op=>[op.id,op.kind]),[[UI,'interface.draw']]);
    assert.deepEqual(events(harness.store).filter(event=>event.event==='lane-waits-design').map(event=>[event.node,event.design]),[[CART,UI]]);
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    // One step at a time, each one its own operation on the node's own allowlist.
    assert.deepEqual(state.ops.map(op=>[op.id,op.kind,op.status,op.nodeId]),
      [[UI,'interface.draw','done',UI],[CART,'frontend.implement','done',CART],[`${CART}-verify`,'uat.verify','done',CART]]);
    assert.deepEqual(state.lanes[UI].done,['interface.draw']);
    assert.deepEqual(state.lanes[CART].done,['frontend.implement','uat.verify']);
    // The build read the drawing: the ui record is a reference of every op built or walked against it.
    assert.ok(state.ops.find(op=>op.id===CART).references.includes('features/sales/ui/index.yaml'));
    const log=events(harness.store);
    // The drawing's record declares no artwork slot, so the asset step is retired and the ui lane is walked as one.
    assert.deepEqual(log.filter(event=>event.event==='lane-step').map(event=>[event.kind,event.step,event.skipped,event.next]),
      [['interface.draw','1/1',['interface.asset'],null],['frontend.implement','1/2',[],'uat.verify'],['uat.verify','2/2',[],null]]);
    // Each node hears `done` exactly once, from the step that closes its lane; the build step only reports progress.
    const writes=log.filter(event=>event.event==='ledger-write');
    assert.deepEqual(writes.filter(event=>event.step==='done').map(event=>[event.op,event.node]),[[UI,UI],[`${CART}-verify`,CART]]);
    assert.ok(writes.some(event=>event.step==='in-progress'&&event.op===CART));
    assert.equal(writes.at(-1).op,`${CART}-verify`);
    const node=harness.read(CART);
    assert.equal(node.state,'done');
    assert.deepEqual(node.completion.evidence,[`${CART}-verify-evidence`]);
    assert.deepEqual(node.extensions.work3.kernel.checks.map(check=>[check.assertion,check.exitCode]),[['cart-renders',0]]);
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
    assert.deepEqual(status.lanes[CART],{lane:'frontend.implement -> uat.verify',done:['frontend.implement','uat.verify'],skipped:[],progress:'2/2'});
    assert.deepEqual(status.workNodes.map(item=>[item.op,item.progress]),
      [[UI,'1/1'],[CART,'2/2'],[`${CART}-verify`,'2/2']]);
  }finally{harness.cleanup();}
});

test('a red UAT run routes to a repair of the lane build step and reopens the run behind it, bounded by the review rounds',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],[CART]:[cartDone('Built.')],
      [`${CART}-verify`]:[cartRed('The cart total stays empty.'),cartDone('The flow passes now.')],
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
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,
    validateOp:payload=>{judged.push(payload);return acceptAll();},
    scripts:{[UI]:[drawn(uiDone('The cart surface is drawn.'))],
      [CART]:[cartDone('The cart is built from the accepted design.')],
      [`${CART}-verify`]:[cartDone('The cart flow passes end to end.')]}});
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
    assert.deepEqual([...DESIGN_KINDS].sort(),['frontend.implement','grammar.update','interface.asset','interface.draw','uat.verify']);
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
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_TODO],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,allocator:brandAllocator(),
    scripts:{'brand-1':[brandDone('The brand is decided: tokens, mascot, forbidden list.')],
      [UI]:[drawn(uiDone('Drawn inside the decided brand.'))],
      [CART]:[cartDone('Built from the drawing and the brand assets.')],
      [`${CART}-verify`]:[cartDone('The flow passes end to end.')]}});
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
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],
      [CART]:[gap,cartDone('Built from the completed design.')],
      'draw-1':[uiDone('The empty state is drawn.')],
      [`${CART}-verify`]:[cartDone('The flow passes.')]}});
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
const grammarAllocator=()=>fakeAllocator({pools:{implement:['claude-opus','gpt-5.6-sol','qwen3.8-flash'],
  verify:['qwen3.8-flash','claude-fable-5.1','gpt-5.6-sol'],decide:['claude-fable-5.1','gpt-6-astra'],
  write:['gpt-5.6-sol','claude-opus','qwen3.8-flash'],plan:['claude-opus','claude-fable-5.1']}});
const grammarGap={outcome:'blocked',summary:'The accepted design needs a stepped progress rail the grammar has no contract for.',
  files:[],checks:[],blocker:{kind:'grammar-gap',detail:'no contract renders a stepped progress rail for the cart checkout'}};

test('a frontend build that reports a grammar gap routes to grammar.update in the bound grammar repository and reopens the requester',()=>{
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED],dirty:[cartFile,UI_FILE],ledgerApi:brandLedger,
    allocator:grammarAllocator(),binding:grammarBinding,
    scripts:{[UI]:[drawn(uiDone('Drawn.'))],
      [CART]:[grammarGap,cartDone('Built with the grown grammar unit.')],
      'grammar-1':[{outcome:'done',summary:'ProgressRail published at 0.5.0; the canon names it.',files:[],
        checks:[passing('cart-renders','npx vitest run cart')]}],
      [`${CART}-verify`]:[cartDone('The flow passes.')]}});
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
    const state=runLoop(orca,harness.store,harness.state,{cwd,allocator:harness.allocator,template,wait:noWait,validateOp:acceptAll,
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
  const state=runLoop(orca,harness.store,harness.state,{cwd,allocator:harness.allocator,template,wait:noWait,
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
    assert.match(contract,/Lane: this op precedes backend\.implement -> e2e\.verify -> review\.verify, which the kernel launches itself once this record is complete/);
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
    assert.deepEqual(state.lanes[REFUND].lane,['backend.implement','e2e.verify','review.verify']);
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

test('changedFiles never carries a kernel-owned path, even when the allowlist is the whole feature folder',()=>{
  const ledger='.starciwork/features/sales/implementation/backend/intake';
  const git=fakeGit([`${ledger}/index.yaml`,`${ledger}/evidence/run-1/manifest.yaml`,'.starciwork/features/sales/notes.md']).git;
  const state={worktree:cwd},op={allowlist:['.starciwork/features/sales/**']};
  assert.equal(changedFiles(state,op,{git}).length,3);
  assert.deepEqual(changedFiles(state,op,{git},op.allowlist,{exclude:[`${ledger}/index.yaml`,`${ledger}/evidence/**`]}),
    ['.starciwork/features/sales/notes.md']);
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
    // The Work tree is never delegated: a shared change naming a ledger path is refused and reaches the user.
    harness.state.ops.push({...structuredClone(harness.state.ops[0]),id:'op-ledger',status:'pending',dispatch:null,terminal:null,runtime:null});
    assert.equal(block('op-ledger','.starciwork/features/sales/migration/index.yaml must drop its source identity'),'shared-change-refused');
    assert.equal(op('op-ledger').status,'blocked');
    assert.match(harness.state.needUser.find(item=>item.kind==='ledger-path').detail,/\.starciwork\/features\/sales\/migration\/index\.yaml/);
    assert.equal(events(harness.store).at(-1).event,'shared-change-refused');
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
    // A shared op that ends blocked blocks its requesters instead of leaving them paused forever.
    op('shared-2').status='blocked';
    resumePaused(harness.store,harness.state);
    assert.equal(op('op-c').status,'blocked');
    assert.match(harness.state.needUser.find(item=>item.op==='op-c').detail,/waits for the shared change shared-2, which is blocked/);
    const log=events(harness.store).map(event=>event.event);
    for(const name of ['shared-change-merged','shared-change-deferred','op-paused','shared-change-unnamed','shared-change-resumed','shared-change-blocked'])
      assert.ok(log.includes(name),`the log records ${name}`);
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
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
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
    assert.deepEqual(failed,[['qwen3.8-flash','rate-limited (inferred from repeated silence)']]);
    const inferred=events(harness.store).find(event=>event.event==='rate-limit-inferred');
    assert.equal(inferred.runtime,'qwen3.8-flash');
    assert.equal(inferred.windowMs,30*60*1000);
    assert.deepEqual(harness.state.silences['qwen3.8-flash'],[],'the window is cleared, so the inference needs two fresh silences');
    assert.ok(harness.state.ops[0].avoidRuntimes.includes('qwen3.8-flash'));
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
    assert.deepEqual(released,['qwen3.8-flash']);
    const ship=harness.state.ops.find(op=>op.id==='op-ship');
    assert.equal(ship.status,'ready');assert.equal(ship.dispatch,null);
    assert.equal(harness.state.ops.find(op=>op.id==='op-intake').status,'running','a dispatch Orca still lists is alive');
    assert.equal(events(harness.store).at(-1).event,'reconciled-dead');

    const asked=[];
    const decide=({situation,options})=>{asked.push({situation,options});return {ok:true,value:{option:'park-runtime',rationale:'the runtime keeps dying'}};};
    const parked=[];
    const ctx={cwd,allocator:{...harness.allocator,failed:(runtime,info)=>parked.push([runtime,info.reason])},guards:stubGuards(),git:harness.git.git,wait:noWait,now:()=>0,work:null,decide,orca:harness.fake.orca};
    for(let count=1;count<=TRIAGE_AFTER;count+=1){
      noteAnomaly(harness.store,harness.state,'settled:op-intake:dead',{op:'op-intake',runtime:'qwen3.8-flash',liveness:'dead'});
      assert.equal(triageAnomaly(harness.store,harness.state,'settled:op-intake:dead',ctx),count<TRIAGE_AFTER?null:'park-runtime');
    }
    assert.equal(asked.length,1,'the model is asked exactly once per signature');
    assert.deepEqual(asked[0].options,TRIAGE_OPTIONS);
    assert.deepEqual(parked,[['qwen3.8-flash','triage: settled:op-intake:dead']]);
    noteAnomaly(harness.store,harness.state,'settled:op-intake:dead',{});
    assert.equal(triageAnomaly(harness.store,harness.state,'settled:op-intake:dead',ctx),null,'a triaged signature is a rule now, not another call');
    const triaged=events(harness.store).find(event=>event.event==='triage');
    assert.equal(triaged.option,'park-runtime');
    assert.equal(triageAnomaly(harness.store,harness.state,'missing',{}),null,'no decider or no entry is a no-op');
  }finally{harness.cleanup();}
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
    assert.match(asked[0].detail,/the validator answered nothing usable for 3 op results in a row \(gpt-5.6-sol, claude-opus\)/);
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
    assert.equal(ledger().runtimes[launched.runtime].usedToday,1);
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
  // Alone in the repository the proposal names Fable, the first runtime of the decide chain, and nothing else.
  const alone=proposeQuota(state);
  assert.equal(alone.rows.some(row=>row.runtime==='gpt-6-astra'),false);
  assert.equal(alone.rows.find(row=>row.runtime==='claude-fable-5.1').slots,1);
  fs.writeFileSync(loadsFileFor(state.dir),JSON.stringify({schema:'starci/runtime-loads@1',
    runtimes:{'claude-fable-5.1':{live:[{workflow:other,op:'op-other',since:1}],cooling:null,usedToday:1,day:new Date().toISOString().slice(0,10)}}}));
  const shared=proposeQuota(state);
  const astra=shared.rows.find(row=>row.runtime==='gpt-6-astra');
  assert.equal(astra.slots,1);
  assert.match(astra.why,/claude-fable-5\.1 is busy with 20260912-100000-other/);
  assert.match(shared.text,/gpt-6-astra=1/);
  // A lane is added, never taken away: the busy runtime keeps the slot this workflow's own quota gives it.
  assert.equal(shared.rows.find(row=>row.runtime==='claude-fable-5.1').slots,1);
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
    assert.deepEqual(asked[0].providers,['gpt-6-astra','claude-fable-5.1'],'the critic runs on the host critics: astra first, then fable');
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

test('the critics are read from config.json `critique.runtimes`, astra then fable by default, and a bad file falls back',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-critics-'));
  try{
    assert.deepEqual(critiqueRuntimes(root),['gpt-6-astra','claude-fable-5.1']);
    fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({critique:{runtimes:['claude-opus']}}));
    assert.deepEqual(critiqueRuntimes(root),['claude-opus']);
    fs.writeFileSync(path.join(root,'config.json'),'{not json');
    assert.deepEqual(critiqueRuntimes(root),['gpt-6-astra','claude-fable-5.1']);
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

test('an interface.asset op on a host without the design tool is host-unsupported: one host item, the frontend lane behind it keeps waiting, the rest finishes, and an approval from a host that has the tool re-admits it',()=>{
  const intake='demo.sales.implementation.backend.intake',file='apps/agentos-controlplane/src/sales/intake.ts';
  const harness=setupWork({nodes:[UI_NODE,FRONTEND_NODE,BRAND_DECIDED,WORK_NODES[0],WORK_NODES[1]],dirty:[file],ledgerApi:brandLedger,
    scripts:{[intake]:[{outcome:'done',summary:'Intake implemented.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      [`${intake}-verify`]:[{outcome:'done',summary:'The intake scenarios pass through the API.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    // The drawing renders the grammar in a browser and runs anywhere; the artwork step is the one that needs the
    // image model. The ui node's first op is made that step here, so the capability rule is exercised on it.
    harness.state.ops.find(op=>op.id===UI).kind='interface.asset';
    const state=harness.run({host:HEADLESS_HOST,maxIterations:30});
    const ui=state.ops.find(op=>op.id===UI);
    assert.equal(ui.status,'blocked');
    assert.equal(ui.refusal,'host-unsupported');
    assert.deepEqual(state.needUser.filter(item=>item.kind==='host').map(item=>[item.op,item.kind]),[[UI,'host']]);
    assert.match(state.needUser.find(item=>item.kind==='host').detail,/needs design-tool, which the headless host does not have/);
    const log=events(harness.store);
    assert.deepEqual(log.filter(event=>event.event==='op-host-unsupported').map(event=>[event.op,event.kind,event.host,event.missing]),[[UI,'interface.asset','headless',['design-tool']]]);
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
    assert.deepEqual(hostMissing(HEADLESS_HOST,'interface.draw'),[],'a drawing is the grammar rendered in a browser: every host can');
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
