import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {resolveExecutionChain} from '../profiles/select.mjs';
import {createOrcaCalls} from '../execution/orca-calls.mjs';
import {buildReport} from '../execution/reports.mjs';
import {spawnSync} from 'node:child_process';
import {validateGoalPlan,validateOp} from '../execution/llm-functions.mjs';
import {createStore} from '../execution/workflow-store.mjs';
import {describeLane,laneFor,nextKind,roleOf as graphRoleOf,routeFor,validateGraph} from '../execution/kind-graph.mjs';
import {DYNAMIC_OPS_BUDGET,TRIAGE_AFTER,TRIAGE_OPTIONS,VALIDATOR_REJECT_LIMIT,VALIDATOR_UNAVAILABLE_LIMIT,applyOpReport,approve,changedFiles,createWorkflowState,detectLedgerMode,drainSharedQueue,goalPhase,kernelGuards,kernelMain,laneLine,launchOperator,noteAnomaly,readValidatorMemory,reconcileWithOrca,renderContract,resumePaused,runLoop,settleStalled,triageAnomaly,validatorRejectLimit,workModule,workOpId} from '../execution/workflow-kernel.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
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
  const handlers={
    'run-show':()=>json(0,{ok:true,result:{run:{id:run,coordinator_handle:'term_kernel'}}}),
    'run-create':()=>json(0,{ok:true,result:{run:{id:run}}}),
    'run-use':()=>json(0,{ok:true,result:{run:{id:run}}}),
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
        const script=queue.shift();
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
function fakeAllocator({maxParallelOps=3,pools={implement:['qwen3.8-flash','claude-opus','gpt-5.6-sol'],verify:['qwen3.8-flash','claude-fable-5.1','gpt-5.6-sol'],decide:['claude-fable-5.1','gpt-6-astra'],write:['gpt-5.6-sol','claude-opus','qwen3.8-flash']}}={}){
  const busy=new Set(),requests=[];
  // The kind graph is the role authority, exactly as the real allocator reads it; the rest is the 4.x guess.
  const roleOf=kind=>graphRoleOf(kind)??(kind==='review.verify'?'verify':['architecture.decide','business.decide'].includes(kind)?'decide':'implement');
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
 * The `execution/kernel-guards.mjs` surface, stubbed so each test owns exactly what the path protection, the
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

function setup({job='Implement the sales slice',plan,scripts,dirty=[],exec,allocator=fakeAllocator(),gates=[]}){
  const repo=tmp();
  const store=createStore({repoRoot:repo,id:'20260912-104251-kernel-spec'});
  const state=createWorkflowState({job,inputs:['sds:.starciwork/features/sales/sds.md'],worktree:cwd,
    branch:'starci183/agentos-r14-sales',gates,store,host:path.resolve('.'),launcher:'L.mjs'});
  const goal=goalPhase(store,state,{assessGoal:()=>({ok:true,provider:'fake',value:plan}),
    renderGoalMarkdown:(value,{job:title})=>`# ${title}\n\n${value.ledger.map(item=>`- ${item.title}`).join('\n')}\n`,
    extractMaterial:()=>[{file:'sds.md',text:'design'}],cwd});
  const fake=scriptedOrca({reportsDir:store.paths.reports,scripts});
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
    assert.deepEqual(events(harness.store).map(event=>event.event),['goal']);
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
  const functions={assessGoal:()=>({ok:true,provider:'fake',value:salesPlan}),extractMaterial:()=>[]};
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
    assert.deepEqual(after.events.map(event=>event.event),['created','goal','approved']);
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
const AUTHORED={'demo.sales.architecture.sds.intake':ARCHITECTURE,'demo.sales.implementation.backend.intake':BACKEND,
  'demo.sales.implementation.frontend.receipt':UNCHECKED,'demo.payments.business.overview':OVERVIEW,
  [FRONTEND_NODE.id]:FRONTEND};

/** A Work tree on disk plus the validator projection of it, injected instead of spawning the real one. */
function workRepo(nodes=WORK_NODES){
  const repo=tmp();
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'@demo/backend'}));
  for(const item of nodes){
    const file=path.join(repo,'.starciwork',item.path);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,AUTHORED[item.id]);
  }
  // The injected projection answers a fresh digest, the way the real validator does after a kernel write.
  const validate=()=>({ok:true,errors:[],warnings:[],nodes:nodes.map(node=>({...node,inputDigest:DIGEST('f')})),resources:[]});
  const node=id=>path.join(repo,'.starciwork',nodes.find(item=>item.id===id).path);
  const read=id=>parseYaml(fs.readFileSync(node(id),'utf8'));
  return {repo,validate,node,read};
}

function setupWork({nodes=WORK_NODES,scope=[],scripts={},dirty=[],exec,allocator=fakeAllocator(),gates=[],assessGoal}={}){
  const tree=workRepo(nodes);
  const store=createStore({repoRoot:tree.repo,id:'20260912-110000-work-ledger'});
  const state=createWorkflowState({job:'Finish the sales slice',worktree:cwd,branch:'starci183/sales',
    gates,store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'work',scope,repoRoot:tree.repo});
  const goal=goalPhase(store,state,{validate:tree.validate,cwd,
    assessGoal:assessGoal??(({ledger})=>({ok:true,provider:'fake',value:{definitionOfDone:[`the ${ledger.length} listed nodes are done`],risks:[],questions:[]}}))});
  const fake=scriptedOrca({reportsDir:store.paths.reports,scripts});
  const git=fakeGit(dirty);
  const commits=[];
  const run=(options={})=>runLoop(fake.orca,store,state,{cwd,allocator,template,wait:noWait,validate:tree.validate,
    exec:exec??(command=>({status:0,stdout:`${command} ok`,stderr:''})),
    git:(executable,args)=>{if(args[0]==='commit')commits.push(args[args.indexOf('-m')+1]);return git.git(executable,args);},
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    validateOp:acceptAll,
    waitTimeoutMs:2000,tickMs:1000,maxIterations:12,...options});
  return {...tree,store,state,goal,fake,git,run,commits,allocator,cleanup:()=>fs.rmSync(path.dirname(tree.repo),{recursive:true,force:true})};
}

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
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run();
    const node=harness.read('demo.sales.implementation.backend.intake');
    assert.equal(node.state,'done');
    assert.equal(node.completion.inputDigest,DIGEST('f'));
    // The last step of the lane writes the completion, so the evidence record is named after the review.
    assert.deepEqual(node.completion.evidence,['verify-1-evidence']);
    // The kernel-owned assertion is stripped from every op and proven by the kernel itself when it records the node.
    assert.deepEqual(node.extensions.work3.kernel.checks.filter(check=>check.assertion==='work-valid').map(check=>check.exitCode),[0],'the kernel proved work-valid by validating the tree');
    assert.ok(!state.ops.some(op=>(op.checks??[]).some(check=>/work-valid/.test(check.name??''))),'no op ever carried the kernel-owned check');
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
    assert.deepEqual(events.filter(event=>event.event==='ledger-write').map(event=>event.step),['in-progress','in-progress','in-progress','in-progress','done']);
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
    assert.equal(state.finished.outcome,'blocked','the frontend node is still ledger-incomplete');
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.ledgerMode,'work');
    assert.equal(final.ledgerSummary.total,4);
    assert.deepEqual(final.decisions.map(item=>item.id),['demo.payments.business.overview']);
    assert.deepEqual(final.ops.map(op=>[op.id,op.node]),[['demo.sales.implementation.backend.intake','demo.sales.implementation.backend.intake'],['demo.sales.implementation.backend.intake-verify','demo.sales.implementation.backend.intake'],['verify-1',null]]);
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
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
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
    assert.deepEqual(steps,['in-progress','reopened','in-progress','decided','in-progress','in-progress','in-progress','in-progress','done']);
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ lanes and routes */

const CART='demo.sales.implementation.frontend.cart';
const cartFile='apps/web/src/cart/index.tsx';
const cartDone=summary=>({outcome:'done',summary,files:[cartFile],checks:[passing('cart-renders','npx vitest run cart')]});
const cartRed=summary=>({outcome:'failed',summary,files:[],
  checks:[{name:'cart-renders',command:'npx vitest run cart',exitCode:1,evidence:'1 failed spec: the total is empty'}]});

test('the kind graph is the lane and route authority: it validates, and the kernel reads the same answers from it',()=>{
  assert.deepEqual(validateGraph(),[]);
  assert.deepEqual(laneFor({kind:'implementation',layout:'frontend'}),['interface.draw','frontend.implement','uat.verify']);
  assert.deepEqual(laneFor({kind:'implementation',layout:null}),['backend.implement','e2e.verify','review.verify']);
  assert.deepEqual(laneFor({kind:'operations'}),['runtime.operate','review.verify']);
  assert.equal(nextKind(laneFor({kind:'implementation',layout:'frontend'}),['interface.draw']),'frontend.implement');
  assert.equal(nextKind(laneFor({kind:'implementation',layout:'frontend'}),['interface.draw','frontend.implement','uat.verify']),null);
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
  const harness=setupWork({nodes:[FRONTEND_NODE],dirty:[cartFile],
    scripts:{[CART]:[cartDone('The cart surface is drawn.')],
      [`${CART}-implement`]:[cartDone('The cart is built from the accepted design.')],
      [`${CART}-verify`]:[cartDone('The cart flow passes end to end.')]}});
  try{
    // The lane is in goal.md before anything launches: the user approves a template, not a pile of ops.
    const markdown=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(markdown,/interface\.draw.*frontend\.implement.*uat\.verify \(this op: step 1 of 3\)/);
    assert.deepEqual(harness.state.lanes[CART].lane,['interface.draw','frontend.implement','uat.verify']);
    assert.deepEqual(harness.state.ops.map(op=>[op.id,op.kind]),[[CART,'interface.draw']]);
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    // One step at a time, each one its own operation on the node's own allowlist.
    assert.deepEqual(state.ops.map(op=>[op.id,op.kind,op.status]),
      [[CART,'interface.draw','done'],[`${CART}-implement`,'frontend.implement','done'],[`${CART}-verify`,'uat.verify','done']]);
    assert.equal(state.ops.every(op=>op.nodeId===CART),true);
    assert.deepEqual(state.lanes[CART].done,['interface.draw','frontend.implement','uat.verify']);
    const log=events(harness.store);
    assert.deepEqual(log.filter(event=>event.event==='lane-step').map(event=>[event.kind,event.step,event.next]),
      [['interface.draw','1/3','frontend.implement'],['frontend.implement','2/3','uat.verify'],['uat.verify','3/3',null]]);
    // The ledger hears `in-progress` for every step but the last, and `done` exactly once, from the UAT step.
    const writes=log.filter(event=>event.event==='ledger-write');
    assert.deepEqual(writes.map(event=>event.step),['in-progress','in-progress','in-progress','in-progress','in-progress','done']);
    assert.equal(writes.filter(event=>event.step==='done').length,1);
    assert.equal(writes.at(-1).op,`${CART}-verify`);
    const node=harness.read(CART);
    assert.equal(node.state,'done');
    assert.deepEqual(node.completion.evidence,[`${CART}-verify-evidence`]);
    assert.deepEqual(node.extensions.work3.kernel.checks.map(check=>[check.assertion,check.exitCode]),[['cart-renders',0]]);
    // A frontend lane proves itself with its own UAT step: no kernel review is planned for it.
    assert.equal(state.ops.some(op=>op.kind==='review.verify'),false);
    assert.deepEqual(state.ledger.map(item=>[item.id,item.status]),[[CART,'verified']]);
    assert.equal(state.finished.outcome,'done');
    // Every contract says which lane it belongs to and which step it is.
    assert.match(fs.readFileSync(harness.store.contractPath(`${CART}-implement`),'utf8'),
      /Lane: interface\.draw -> frontend\.implement -> uat\.verify \(this op: step 2 of 3\)/);
    assert.equal(laneLine(state,{nodeId:CART,kind:'uat.verify'}),'Lane: interface.draw -> frontend.implement -> uat.verify (this op: step 3 of 3)');
    // The status command prints the lane per node.
    const status=kernelMain('workflow-status',{id:harness.store.id},{orca:{invoke:()=>{throw Error('status makes no Orca call');}},cwd:harness.repo});
    assert.deepEqual(status.lanes[CART],{lane:'interface.draw -> frontend.implement -> uat.verify',
      done:['interface.draw','frontend.implement','uat.verify'],progress:'3/3'});
    assert.deepEqual(status.workNodes.map(item=>[item.op,item.progress]),
      [[CART,'3/3'],[`${CART}-implement`,'3/3'],[`${CART}-verify`,'3/3']]);
  }finally{harness.cleanup();}
});

test('a red UAT run routes to a repair of the lane build step and reopens the run behind it, bounded by the review rounds',()=>{
  const harness=setupWork({nodes:[FRONTEND_NODE],dirty:[cartFile],
    scripts:{[CART]:[cartDone('Drawn.')],[`${CART}-implement`]:[cartDone('Built.')],
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

test('a frontend implementation that reports an interface gap routes to interface.draw and reopens the requester',()=>{
  const gap={outcome:'blocked',summary:'The accepted design never drew the empty cart.',files:[],checks:[],
    blocker:{kind:'interface-gap',detail:'the accepted design has no empty state for apps/web/src/cart/index.tsx'}};
  const harness=setupWork({nodes:[FRONTEND_NODE],dirty:[cartFile],
    scripts:{[CART]:[cartDone('Drawn.')],
      [`${CART}-implement`]:[gap,cartDone('Built from the completed design.')],
      'draw-1':[cartDone('The empty state is drawn.')],
      [`${CART}-verify`]:[cartDone('The flow passes.')]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:24});
    const draw=state.ops.find(op=>op.id==='draw-1');
    assert.equal(draw.kind,'interface.draw');
    assert.equal(draw.nodeId,CART);
    assert.equal(draw.origin,'architecture');
    assert.equal(draw.status,'done');
    const route=events(harness.store).find(event=>event.event==='routed'&&event.on==='interface-gap');
    assert.deepEqual([route.op,route.to,route.origin,route.kind,route.then],
      [`${CART}-implement`,'draw-1','architecture','interface.draw','reopen']);
    const build=state.ops.find(op=>op.id===`${CART}-implement`);
    assert.ok(build.dependsOn.includes('draw-1'));
    assert.equal(build.attempt,2);
    assert.equal(build.status,'done');
    assert.match(build.priorOpen.at(-1),/the interface gap is drawn by draw-1/);
    assert.deepEqual(state.lanes[CART].done,['interface.draw','frontend.implement','uat.verify']);
    assert.equal(harness.read(CART).state,'done');
    assert.equal(state.finished.outcome,'done');
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
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
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
  const functions={assessGoal:()=>({ok:true,provider:'fake',value:salesPlan}),extractMaterial:()=>[]};
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
