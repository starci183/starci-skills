import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {createOrcaCalls} from '../execution/orca-calls.mjs';
import {buildMonitorLaunch,buildOperationLaunch,defaultOrcaExecutable,main,promptDelivery,replaceMonitor,resolveSupervisorChain,settleDispatch,startMonitor,startOperation} from '../execution/orca-supervised-launch.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const worktree='fixtures/orca/agentos-r14-sales';
const worktreePath=path.resolve(worktree);
const opName='[Op] review.verify - Sales';
const input={run:'run_sales',workflowTask:'task_workflow_sales',from:'term_monitor_sales',worktree,
  operation:'review.verify',scope:'Sales',spec:'Review the bounded Sales implementation and report exactly once.'};
const monitorInput={run:'run_parent',parentTask:'task_parent',from:'term_parent',worktree,workflow:'Sales',spec:'Manage the Sales operation DAG without performing operation work.'};

const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const runShow={ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_monitor_sales'}}};
const taskCreated=(id,display_name)=>({ok:true,result:{task:{id,display_name}}});
const started=(id,task)=>({ok:true,result:{dispatch:{id,task_id:task},worker:{state:'ready',agent_terminal_handle:`term_${id}`}}});
const stalled={ok:false,error:{code:'agent_prompt_stalled',message:'prompt was not consumed'},result:{failedStage:'dispatch_input',effects:[],residualResources:[]}};
function shown({dispatch='ctx_qwen',task='task_operation_sales',agent='qwen-code',model='qwen3.8-flash',title=opName,state='ready',effects=[{kind:'dispatch_input',state:'accepted'}],dispatchStatus='ready'}={}){
  return {ok:true,result:{dispatch:{id:dispatch,task_id:task,status:dispatchStatus},
    worker:{state,agent_terminal_handle:`term_${dispatch}`,effects,startOptions:{launch:{effective:{agent,model}}}},
    observation:{exactWorker:true},terminal:{title,worktreePath}}};
}

/** Scripted Orca: handlers keyed by sub-command receive (args, nth call of that sub-command). */
function fakeOrca(handlers){
  const spawned=[];const counts={};
  const spawn=(executable,args)=>{
    spawned.push(args);
    const key=args[0]==='terminal'?'terminal-rename':args[0]==='agent-context'?'agent-context':args[1];
    counts[key]=(counts[key]??0)+1;
    const handler=handlers[key];
    if(!handler)throw Error(`Unexpected fake call: ${args.join(' ')}`);
    return handler(args,counts[key]);
  };
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),spawned,names:()=>spawned.map(args=>args.slice(0,2).join(' '))};
}
const has=(args,flag,value)=>{const index=args.indexOf(flag);return index>=0&&(value===undefined||args[index+1]===value);};

test('native Orca runner uses an executable instead of a Windows command shim',()=>{
  assert.equal(defaultOrcaExecutable,process.platform==='win32'?'orca.exe':'orca');
});

test('operation request carries the whole review chain and owns the canonical Task identity',()=>{
  const planned=buildOperationLaunch(input);
  assert.equal(planned.schema,'starci/orca-supervised-op-request@2');
  assert.equal(planned.displayName,opName);
  assert.deepEqual(planned.candidates.map(candidate=>candidate.selection.target),['qwen-qwen3.8-flash-reviewer','claude-fable-5.1','codex-gpt-5.6-sol-reviewer']);
  assert.equal(planned.selection.orcaLaunch.agent,'qwen-code');
  assert.equal(planned.candidates[0].workerParams.model,undefined);
  assert.equal(planned.candidates[1].workerParams.model,undefined);
  assert.equal(planned.candidates[2].workerParams.model,'gpt-5.6-sol');
  assert.equal(planned.candidates[0].workerParams.worktree,`path:${worktreePath}`);
  assert.equal(planned.candidates[0].workerParams['timeout-ms'],120000);
  assert.deepEqual(planned.runAttestationParams,{id:'run_sales'});
  assert.equal(planned.taskParams['display-name'],opName);
  assert.equal(planned.taskParams.parent,undefined);
  assert.throws(()=>buildOperationLaunch({...input,worktree:'current'}),/filesystem-relative path/);
  assert.throws(()=>buildOperationLaunch({...input,worktree:worktreePath}),/must be relative/);
});

test('Workflow Monitor launch resolves the supervisor chain instead of a hardcoded provider',()=>{
  assert.deepEqual(resolveSupervisorChain('workflowMonitor').map(candidate=>[candidate.target,candidate.model,candidate.effort]),[['claude-opus',null,null],['codex-gpt-5.6-sol','gpt-5.6-sol','high']]);
  const planned=buildMonitorLaunch(monitorInput);
  assert.equal(planned.displayName,'[Monitor] Sales');
  assert.deepEqual(planned.candidates.map(candidate=>candidate.workerParams.agent),['claude','codex']);
  assert.equal(planned.candidates[0].workerParams.model,undefined);
  assert.equal(planned.candidates[1].workerParams.model,'gpt-5.6-sol');
  assert.equal(planned.candidates[1].workerParams.effort,'high');
  assert.equal(planned.taskParams.parent,'task_parent');
  assert.throws(()=>resolveSupervisorChain('nobody'),/Supervisor chain is missing/);
});

test('supervised operation launcher starts native Qwen without a model override and verifies prompt delivery',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':()=>json(0,started('ctx_qwen','task_operation_sales')),
    'worker-show':(args,nth)=>json(0,shown({title:nth===1?'Working':opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca});
  assert.equal(result.ok,true);
  assert.equal(result.schema,'starci/orca-supervised-op-launch@2');
  assert.equal(result.dispatchId,'ctx_qwen');
  assert.equal(result.selection.target,'qwen-qwen3.8-flash-reviewer');
  assert.deepEqual(result.attempts,[]);
  const start=fake.spawned.find(args=>args[1]==='worker-start');
  assert.ok(has(start,'--agent','qwen-code'));
  assert.equal(start.includes('--model'),false);
  assert.ok(has(start,'--worktree',`path:${worktreePath}`));
  assert.ok(has(start,'--timeout-ms','120000'));
  assert.ok(has(start,'--from','term_monitor_sales'));
  assert.deepEqual(fake.names(),['orchestration run-show','orchestration task-create','orchestration worker-start','orchestration worker-show','terminal rename','orchestration worker-show']);
});

test('a Qwen prompt stall is classified as no-effect and the launcher falls through to Claude in the same invocation',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':(args)=>has(args,'--agent','qwen-code')?json(1,stalled):json(0,started('ctx_claude','task_operation_sales')),
    'worker-show':(args,nth)=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:nth===1?'Working':opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'claude-fable-5.1');
  assert.equal(result.attempts.length,1);
  assert.equal(result.attempts[0].target,'qwen-qwen3.8-flash-reviewer');
  assert.equal(result.attempts[0].effectState,'none');
  assert.match(result.attempts[0].reason,/prompt was not consumed/);
  assert.equal(result.attempts[0].settlement,null);
  assert.equal(fake.spawned.filter(args=>args[1]==='task-create').length,1);
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-stop').length,0);
  assert.deepEqual(fake.spawned.filter(args=>args[1]==='worker-start').map(args=>args[args.indexOf('--agent')+1]),['qwen-code','claude']);
});

test('provider mismatch fences and settles the exact dispatch, then the next candidate runs; a retained terminal stops the chain',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':(args,nth)=>json(0,started(nth===1?'ctx_wrong':'ctx_claude','task_operation_sales')),
    'worker-show':(args)=>has(args,'--dispatch','ctx_wrong')?json(0,shown({dispatch:'ctx_wrong',agent:'codex',model:'gpt-5.6-sol',title:'Working'})):json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:fake.spawned.some(a=>a[0]==='terminal')?opName:'Working'})),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'released'}}),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'claude-fable-5.1');
  assert.equal(result.attempts.length,1);
  assert.match(result.attempts[0].reason,/expected agent qwen-code/);
  assert.equal(result.attempts[0].effectState,'none');
  assert.equal(result.attempts[0].settlement.release.state,'released');
  assert.ok(fake.spawned.some(args=>args[1]==='worker-stop'&&has(args,'--dispatch','ctx_wrong')));
  assert.ok(fake.spawned.some(args=>args[1]==='worker-release'&&has(args,'--dispatch','ctx_wrong')));

  const retained=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':()=>json(0,started('ctx_wrong','task_operation_sales')),
    'worker-show':()=>json(0,shown({dispatch:'ctx_wrong',agent:'codex',model:'gpt-5.6-sol',title:'Working'})),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'release_pending',processAction:'closing'}})
  });
  const stopped=startOperation(input,{orca:retained.orca});
  assert.equal(stopped.ok,false);
  assert.equal(stopped.exhausted,false);
  assert.equal(stopped.stopReason,'partial-or-unknown-effects');
  assert.equal(stopped.attempts[0].effectState,'partial');
  assert.equal(stopped.recovery,'reconcile-residual-resources-before-retry');
  assert.equal(retained.spawned.filter(args=>args[1]==='worker-start').length,1);
});

test('an exhausted chain is a typed failure, never a thrown string',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':()=>json(1,stalled)
  });
  const result=startOperation(input,{orca:fake.orca});
  assert.equal(result.ok,false);
  assert.equal(result.exhausted,true);
  assert.equal(result.stopReason,'chain-exhausted');
  assert.deepEqual(result.attempts.map(attempt=>attempt.target),['qwen-qwen3.8-flash-reviewer','claude-fable-5.1','codex-gpt-5.6-sol-reviewer']);
  assert.ok(result.attempts.every(attempt=>attempt.effectState==='none'));
  assert.equal(result.recovery,'report-workflow-boundary-worker_failed');
});

test('a terminal that is not the nested Run Monitor cannot create an operation Task',()=>{
  const fake=fakeOrca({'run-show':()=>json(0,{ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_other_monitor'}}})});
  assert.throws(()=>startOperation(input,{orca:fake.orca}),/exact Workflow Monitor/);
  assert.deepEqual(fake.names(),['orchestration run-show']);
});

test('prompt delivery requires a ready worker with accepted task input',()=>{
  assert.equal(promptDelivery(shown()).ok,true);
  assert.match(promptDelivery(shown({state:'failed',effects:[{kind:'dispatch_input',state:'accepted'}]})).reason,/Worker is failed/);
  assert.match(promptDelivery(shown({dispatchStatus:'failed'})).reason,/Dispatch failed/);
  assert.match(promptDelivery(shown({effects:[{kind:'dispatch_input',state:'stalled'}]})).reason,/Task input was stalled/);
});

test('Workflow Monitor launch tries Claude Opus first and falls through to Codex Sol only after a no-effect failure',()=>{
  const fake=fakeOrca({
    'task-create':()=>json(0,taskCreated('task_monitor_sales','[Monitor] Sales')),
    'worker-start':(args)=>has(args,'--agent','claude')?json(1,{ok:false,error:{code:'startup_failure',message:'claude did not start'},result:{failedStage:'agent_start',residualResources:[]}}):json(0,started('ctx_codex','task_monitor_sales')),
    'worker-show':(args,nth)=>json(0,shown({dispatch:'ctx_codex',task:'task_monitor_sales',agent:'codex',model:'gpt-5.6-sol',title:nth===1?'Working':'[Monitor] Sales'})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startMonitor(monitorInput,{orca:fake.orca});
  assert.equal(result.ok,true);
  assert.equal(result.schema,'starci/orca-supervised-monitor-launch@2');
  assert.equal(result.selection.target,'codex-gpt-5.6-sol');
  assert.equal(result.attempts[0].target,'claude-opus');
  const codexStart=fake.spawned.filter(args=>args[1]==='worker-start').at(-1);
  assert.ok(has(codexStart,'--model','gpt-5.6-sol'));
  assert.ok(has(codexStart,'--effort','high'));
});

test('a dead Workflow Monitor is settled and replaced with --retry-of; a live one is never replaced',()=>{
  const fake=fakeOrca({
    'worker-show':(args,nth)=>has(args,'--dispatch','ctx_dead')?json(0,{ok:true,result:{dispatch:{id:'ctx_dead',task_id:'task_monitor_sales'},worker:{state:'failed',stage:'process_exited'}}}):json(0,shown({dispatch:'ctx_new',task:'task_monitor_sales_2',agent:'claude',model:null,title:nth>=3?'[Monitor] Sales':'Working'})),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'already_released'}}),
    'task-create':()=>json(0,taskCreated('task_monitor_sales_2','[Monitor] Sales')),
    'task-update':()=>json(0,{ok:true,result:{task:{id:'task_monitor_sales',status:'failed'}}}),
    'worker-start':()=>json(0,started('ctx_new','task_monitor_sales_2')),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=replaceMonitor({...monitorInput,task:'task_monitor_sales',dispatch:'ctx_dead'},{orca:fake.orca});
  assert.equal(result.ok,true);
  assert.equal(result.replaced,'ctx_dead');
  assert.equal(result.settlement.effectState,'none');
  assert.equal(result.dispatchId,'ctx_new');
  assert.equal(result.task.id,'task_monitor_sales_2');
  assert.deepEqual(result.previous,{task:'task_monitor_sales',closed:true,closeReason:null});
  const start=fake.spawned.find(args=>args[1]==='worker-start');
  assert.ok(has(start,'--retry-of','ctx_dead')&&has(start,'--task','task_monitor_sales_2'));
  const create=fake.spawned.find(args=>args[1]==='task-create');
  assert.ok(has(create,'--parent','task_parent')&&has(create,'--display-name','[Monitor] Sales')&&has(create,'--spec',monitorInput.spec));
  const close=fake.spawned.find(args=>args[1]==='task-update');
  assert.ok(has(close,'--id','task_monitor_sales')&&has(close,'--status','failed'));
  const live=fakeOrca({'worker-show':()=>json(0,shown({dispatch:'ctx_live',task:'task_monitor_sales',agent:'claude',model:null,title:'[Monitor] Sales'}))});
  assert.throws(()=>replaceMonitor({...monitorInput,task:'task_monitor_sales',dispatch:'ctx_live'},{orca:live.orca}),/a live Monitor is never replaced/);
});

test('a dead worker whose terminal Orca keeps as identity_unproven settles to none with the residual terminal recorded',()=>{
  const fake=fakeOrca({
    'worker-stop':()=>json(0,JSON.parse(fs.readFileSync(new URL('./fixtures/orca/live-1.4.188/worker-stop-already-settled.json',import.meta.url),'utf8'))),
    'worker-release':()=>json(0,JSON.parse(fs.readFileSync(new URL('./fixtures/orca/live-1.4.188/worker-release-retained-identity-unproven.json',import.meta.url),'utf8')))
  });
  const settlement=settleDispatch(fake.orca,'ctx_aabf230fb48b',{cwd:'.'});
  assert.equal(settlement.effectState,'none');
  assert.equal(settlement.stop.alreadySettled,true);
  assert.deepEqual(settlement.residualTerminal,{state:'retained',reason:'identity_unproven',processAction:'none'});
  assert.equal(settlement.release.outcome,'failed');
  const live=fakeOrca({
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_1',state:'ready'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_1',state:'retained',reason:'active_worker',processAction:'none'}})
  });
  assert.equal(settleDispatch(live.orca,'ctx_1',{cwd:'.'}).effectState,'partial');
});

test('settlement reports unknown when stop cannot be confirmed and never calls release afterwards',()=>{
  const fake=fakeOrca({'worker-stop':()=>json(1,{ok:false,result:{dispatchId:'ctx_x',state:'stop_unknown'}}),
    'worker-show':()=>json(0,{ok:true,result:{dispatch:{id:'ctx_1'},worker:{state:'ready'},observation:{status:'live'}}})});
  const settlement=settleDispatch(fake.orca,'ctx_1',{cwd:'.',wait:()=>{}});
  assert.equal(settlement.schema,'starci/orca-supervised-settlement@1');
  assert.equal(settlement.effectState,'unknown');
  assert.equal(settlement.release.outcome,'skipped');
  assert.equal(settlement.reconciliation.settled,false);
  assert.equal(settlement.reconciliation.observed.length,6);
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-release').length,0);
  const exits=fakeOrca({
    'worker-stop':(args,nth)=>nth<=2?json(1,{ok:false,result:{dispatchId:'ctx_2',state:'stop_unknown'}}):json(0,{ok:true,result:{dispatchId:'ctx_2',state:'failed',alreadySettled:true}}),
    'worker-show':(args,nth)=>json(0,{ok:true,result:{dispatch:{id:'ctx_2'},worker:{state:nth<2?'ready':'failed'},observation:{status:nth<2?'live':'exited'}}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_2',state:'retained',reason:'identity_unproven',processAction:'none'}})
  });
  const settled=settleDispatch(exits.orca,'ctx_2',{cwd:'.',wait:()=>{}});
  assert.equal(settled.effectState,'none');
  assert.equal(settled.reconciliation.settled,true);
  assert.equal(exits.spawned.filter(args=>args[1]==='worker-stop').length,3);
  const cli=main(['settle','--dispatch','ctx_2'],{orca:fakeOrca({'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'released'}})}).orca});
  assert.equal(cli.effectState,'none');
});

test('verify command reports live contract drift before any effect',()=>{
  const agentContext=JSON.parse(fs.readFileSync(new URL('./fixtures/orca/live-1.4.188/agent-context.json',import.meta.url),'utf8'));
  const fake=fakeOrca({'agent-context':()=>json(0,agentContext)});
  const result=main(['verify'],{orca:fake.orca});
  assert.equal(result.schema,'starci/orca-live-contract-verification@1');
  assert.equal(result.ok,true);
  assert.equal(result.commandCount,232);
});

test('native activity title drift after the canonical rename is recorded, never fenced',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':()=>json(0,started('ctx_qwen','task_operation_sales')),
    'worker-show':()=>json(0,shown({title:'◐ Reviewing the Sales module'})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca});
  assert.equal(result.ok,true);
  assert.equal(result.titleDrift,true);
  assert.deepEqual(result.attestation.terminalTitle,{observed:'◐ Reviewing the Sales module',canonical:false,mutableUiMetadata:true,action:'recanonicalize-without-fencing'});
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal').length,2);
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-stop').length,0);
  const monitor=fakeOrca({
    'task-create':()=>json(0,taskCreated('task_monitor_sales','[Monitor] Sales')),
    'worker-start':()=>json(0,started('ctx_claude','task_monitor_sales')),
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',task:'task_monitor_sales',agent:'claude',model:null,title:'◑ Orca Plan Coordinator'})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const started2=startMonitor(monitorInput,{orca:monitor.orca});
  assert.equal(started2.ok,true);
  assert.equal(started2.titleDrift,true);
  assert.equal(started2.selection.target,'claude-opus');
});
