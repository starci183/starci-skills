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
import {validateGoalPlan} from '../execution/llm-functions.mjs';
import {createStore} from '../execution/workflow-store.mjs';
import {approve,createWorkflowState,detectLedgerMode,goalPhase,kernelMain,renderContract,runLoop,workModule,workOpId} from '../execution/workflow-kernel.mjs';

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
function fakeAllocator({maxParallelOps=3,pools={implement:['qwen3.8-flash','claude-opus','gpt-5.6-sol'],verify:['qwen3.8-flash','claude-fable-5.1','gpt-5.6-sol'],decide:['claude-fable-5.1','gpt-6-astra']}}={}){
  const busy=new Set(),requests=[];
  const roleOf=kind=>kind==='review.verify'?'verify':['architecture.decide','business.decide'].includes(kind)?'decide':'implement';
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
/** A fake worktree git: porcelain lists the dirty files until a commit clears them. */
function fakeGit(dirty){
  const calls=[];let pending=[...dirty];
  return {calls,git:(executable,args)=>{
    calls.push(args[0]);
    if(args[0]==='status')return {status:0,stdout:pending.map(file=>` M ${file}`).join('\n'),stderr:''};
    if(args[0]==='commit'){pending=[];return {status:0,stdout:'',stderr:''};}
    if(args[0]==='rev-parse')return {status:0,stdout:'abc1234\n',stderr:''};
    return {status:0,stdout:'',stderr:''};
  },dirty:()=>pending,add:file=>pending.push(file)};
}

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
    assert.deepEqual(harness.git.calls.filter(name=>['add','commit','rev-parse'].includes(name)).slice(0,3),['add','commit','rev-parse']);
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
    const resumed=runLoop(harness.fake.orca,harness.store,saved,{cwd,allocator:fakeAllocator(),template,wait:noWait,
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
    assert.equal(state.ledger[0].status,'implemented');
    assert.equal(state.finished.outcome,'blocked');
    assert.match(state.needUser.find(item=>item.kind==='review').detail,/still fails review after 3 rounds/);
    const log=events(harness.store);
    assert.equal(log.filter(event=>event.event==='verify-limit').length,1);
    assert.equal(log.filter(event=>event.event==='op-created'&&event.kind==='review.verify').length,3);
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.outcome,'blocked');
    assert.deepEqual(final.ledger.map(item=>item.status),['implemented']);
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
/** A Work tree on disk plus the validator projection of it, injected instead of spawning the real one. */
function workRepo(){
  const repo=tmp();
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'@demo/backend'}));
  const authored={[WORK_NODES[0].path]:ARCHITECTURE,[WORK_NODES[1].path]:BACKEND,[WORK_NODES[2].path]:UNCHECKED,[WORK_NODES[3].path]:OVERVIEW};
  for(const [relative,content] of Object.entries(authored)){
    const file=path.join(repo,'.starciwork',relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  }
  // The injected projection answers a fresh digest, the way the real validator does after a kernel write.
  const validate=()=>({ok:true,errors:[],warnings:[],nodes:WORK_NODES.map(node=>({...node,inputDigest:DIGEST('f')})),resources:[]});
  const node=id=>path.join(repo,'.starciwork',WORK_NODES.find(item=>item.id===id).path);
  const read=id=>parseYaml(fs.readFileSync(node(id),'utf8'));
  return {repo,validate,node,read};
}

function setupWork({scope=[],scripts={},dirty=[],exec,allocator=fakeAllocator(),gates=[],assessGoal}={}){
  const tree=workRepo();
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
    assert.deepEqual(op.acceptance,['unit-tests-pass']);
    assert.deepEqual(op.references,['features/sales/implementation/backend/intake/index.yaml']);
    assert.equal(op.origin,'ledger');
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
    const markdown=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(markdown,/## Work nodes this workflow executes/);
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
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run();
    const node=harness.read('demo.sales.implementation.backend.intake');
    assert.equal(node.state,'done');
    assert.equal(node.completion.inputDigest,DIGEST('f'));
    assert.deepEqual(node.completion.evidence,['demo.sales.implementation.backend.intake']);
    assert.equal(node.extensions.work3.kernel.verifiedBy,'starci-kernel');
    assert.deepEqual(node.extensions.work3.kernel.checks.map(check=>[check.assertion,check.exitCode]),[['unit-tests-pass',0]]);
    // The authored checks survive the write; the kernel owns only state, completion and its own block.
    assert.deepEqual(node.extensions.work3.checks.map(check=>check.command),['npx vitest run intake']);
    assert.equal(node.description,'Implement order intake against the accepted SDS.');
    const manifest=parseYaml(fs.readFileSync(path.join(path.dirname(harness.node('demo.sales.implementation.backend.intake')),
      'evidence','demo.sales.implementation.backend.intake','manifest.yaml'),'utf8'));
    assert.equal(manifest.schema,'work/evidence@1');
    assert.equal(manifest.nodeId,'demo.sales.implementation.backend.intake');
    assert.equal(manifest.outcome,'pass');
    assert.equal(manifest.provenance.actor,'starci-kernel');
    // The commit names the node it closes.
    assert.match(harness.commits[0],/^feat\(demo\.sales\.implementation\.backend\.intake\): Implement order intake/);
    assert.match(harness.commits[0],/\nWork: demo\.sales\.implementation\.backend\.intake$/);
    const events=harness.store.readEvents();
    assert.deepEqual(events.filter(event=>event.event==='ledger-write').map(event=>event.step),['in-progress','done']);
    assert.equal(events.find(event=>event.event==='ledger-loaded').valid,true);
    // One review per module, on a runtime that did not implement it.
    const verify=state.ops.find(item=>item.kind==='review.verify');
    assert.equal(verify.id,'verify-1');
    assert.equal(verify.nodeId,null);
    assert.notEqual(verify.runtime,state.ops[0].runtime);
    assert.equal(state.verifyRounds['features/sales'],1);
    assert.deepEqual(state.ledger.map(item=>[item.module,item.status]),[['features/sales','verified']]);
    assert.equal(state.finished.outcome,'blocked','the frontend node is still ledger-incomplete');
    const final=JSON.parse(fs.readFileSync(harness.store.paths.final,'utf8'));
    assert.equal(final.ledgerMode,'work');
    assert.equal(final.ledgerSummary.total,4);
    assert.deepEqual(final.decisions.map(item=>item.id),['demo.payments.business.overview']);
    assert.deepEqual(final.ops.map(op=>[op.id,op.node]),[['demo.sales.implementation.backend.intake','demo.sales.implementation.backend.intake'],['verify-1',null]]);
  }finally{harness.cleanup();}
});

test('a reported SDS gap reopens the architecture node and schedules the decision that settles it',()=>{
  const file='apps/agentos-controlplane/src/sales/intake.ts';
  const design='.starciwork/features/sales/architecture/sds/intake/index.yaml';
  const harness=setupWork({dirty:[file,design],
    scripts:{'demo.sales.implementation.backend.intake':[
      {outcome:'blocked',summary:'The SDS does not say how a partial order is persisted.',files:[],checks:[],
        blocker:{kind:'sds-gap',detail:'features/sales/architecture/sds/intake/index.yaml does not map the partial-order case'}},
      {outcome:'done',summary:'Intake implemented against the settled design.',files:[file],checks:[passing('unit-tests-pass','npx vitest run intake')]}],
      'architecture-1':[{outcome:'done',summary:'The partial-order case is now mapped.',files:[design],
        checks:[passing('work-tree-validates','starci validate')]}],
      'verify-1':[{outcome:'done',summary:'Review passed.',files:[],checks:[passing('unit-tests-pass','npx vitest run intake')]}]}});
  try{
    approve(harness.store,harness.state);
    harness.state.run='run_wf';harness.state.from='term_kernel';
    const state=harness.run({maxIterations:20});
    const gap=harness.store.readEvents().find(event=>event.event==='sds-gap');
    assert.equal(gap.architecture,'demo.sales.architecture.sds.intake');
    assert.equal(gap.decide,'architecture-1');
    const decide=state.ops.find(item=>item.id==='architecture-1');
    assert.equal(decide.kind,'architecture.decide');
    assert.equal(decide.nodeId,'demo.sales.architecture.sds.intake');
    assert.deepEqual(decide.allowlist,[design]);
    assert.equal(decide.status,'done');
    // The implementation waited for the decision before it ran again.
    const implement=state.ops.find(item=>item.id==='demo.sales.implementation.backend.intake');
    assert.ok(implement.dependsOn.includes('architecture-1'));
    assert.equal(implement.status,'done');
    const architecture=harness.read('demo.sales.architecture.sds.intake');
    // Reopened, then decided again by a collocated review: the kernel never fakes an execution receipt here.
    assert.equal(architecture.state,'done');
    assert.equal(architecture.extensions.work3.kernel.reopened.length,1);
    assert.match(architecture.extensions.work3.kernel.reopened[0].reason,/reported an SDS gap/);
    assert.equal(architecture.completion.review.schema,'starci/design-review@1');
    assert.deepEqual(architecture.completion.review.observations.map(item=>item.id),['architecture-quality']);
    assert.equal(architecture.completion.inputDigest,DIGEST('f'));
    const steps=harness.store.readEvents().filter(event=>event.event==='ledger-write').map(event=>event.step);
    assert.deepEqual(steps,['in-progress','reopened','in-progress','decided','in-progress','done']);
  }finally{harness.cleanup();}
});
