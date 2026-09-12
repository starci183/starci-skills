import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {createOrcaCalls} from '../execution/orca-calls.mjs';
import {resolveExecutionChain} from '../profiles/select.mjs';
import {buildOperationLaunch,defaultOrcaExecutable,main,notifyTerminal,parseSkip,promptDelivery,qwenLaunchMode,resolveSupervisorChain,settleDispatch,startOperation,sweepWorktree} from '../execution/orca-supervised-launch.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const worktree='fixtures/orca/agentos-r14-sales';
const worktreePath=path.resolve(worktree);
const noWait=()=>{};
// Execution op: qwen command terminal first, then Claude Opus, then Codex Sol.
const opName='[Op] backend.implement - Sales';
const input={run:'run_sales',workflowTask:'task_workflow_sales',from:'term_monitor_sales',worktree,
  operation:'backend.implement',scope:'Sales',spec:'Implement the bounded Sales slice and report exactly once.'};
// Reasoning op: managed agents only (Fable, then Astra).
const reasonName='[Op] architecture.decide - Sales';
const reasonInput={...input,operation:'architecture.decide',spec:'Decide the bounded Sales SDS gap.'};

const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const runShow={ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_monitor_sales'}}};
const taskCreated=(id,display_name)=>({ok:true,result:{task:{id,display_name}}});
const started=(id,task)=>({ok:true,result:{dispatch:{id,task_id:task},worker:{state:'ready',agent_terminal_handle:`term_${id}`}}});
const stalled={ok:false,error:{code:'agent_prompt_stalled',message:'prompt was not consumed'},result:{failedStage:'dispatch_input',effects:[],residualResources:[]}};
const screen=lines=>({ok:true,result:{terminal:{handle:'term_qwen',status:'running',tail:lines,source:'screen'}}});
const qwenReady=['>_ Qwen Code (v0.23.3)','Token Plan | qwen3.8-flash (Token Plan Singapore)','>   Type your message or @path/to/file','qwen3.8-flash (Token Plan Singapore)'];
const qwenStaged=['>_ Qwen Code (v0.23.3)','A direct instruction from the user takes precedence [Pasted Content 715 chars]','qwen3.8-flash (Token Plan Singapore)'];
const qwenThinking=['[Pasted Content 6 200 chars]','∵ Thinking… 1s','⠼ polishing (5s · ↑ 25 tokens · esc to cancel)','qwen3.8-flash (Token Plan Singapore)'];
function shown({dispatch='ctx_claude',task='task_operation_sales',agent='claude',model=null,title=reasonName,state='ready',effects=[{kind:'dispatch_input',state:'accepted'}],dispatchStatus='ready'}={}){
  return {ok:true,result:{dispatch:{id:dispatch,task_id:task,status:dispatchStatus},
    worker:{state,agent_terminal_handle:`term_${dispatch}`,effects,startOptions:{launch:{effective:{agent,model}}}},
    observation:{exactWorker:true},terminal:{title,worktreePath}}};
}

/** Scripted Orca: handlers keyed by sub-command receive (args, nth call of that sub-command). */
function fakeOrca(handlers){
  const spawned=[];const counts={};
  const spawn=(executable,args)=>{
    spawned.push(args);
    const key=args[0]==='terminal'?`terminal-${args[1]}`:args[0]==='agent-context'?'agent-context':args[1];
    counts[key]=(counts[key]??0)+1;
    const handler=handlers[key];
    if(!handler)throw Error(`Unexpected fake call: ${args.join(' ')}`);
    return handler(args,counts[key]);
  };
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),spawned,names:()=>spawned.map(args=>args.slice(0,2).join(' '))};
}
const has=(args,flag,value)=>{const index=args.indexOf(flag);return index>=0&&(value===undefined||args[index+1]===value);};
const value=(args,flag)=>args[args.indexOf(flag)+1];

/** Happy-path Qwen command-terminal handlers; `reads` scripts the successive --screen frames. */
function qwenHandlers({reads=[qwenReady,qwenStaged,qwenThinking],dispatchOk=true,assignee='term_qwen'}={}){
  let readIndex=0;
  return {
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'terminal-create':()=>json(0,{ok:true,result:{terminal:{handle:'term_qwen'}}}),
    'terminal-read':()=>json(0,screen(reads[Math.min(readIndex++,reads.length-1)])),
    'dispatch':()=>dispatchOk?json(0,{ok:true,result:{dispatch:{id:'ctx_qwen',task_id:'task_operation_sales'},injected:false,preamble:'=== PREAMBLE ===\nreport worker_done once\n=== TASK ===\nImplement'}}):json(1,{ok:false,error:{code:'invalid_argument',message:'no such task'}}),
    'terminal-send':()=>json(0,{ok:true,result:{}}),
    'dispatch-show':()=>json(0,{ok:true,result:{dispatch:{id:'ctx_qwen',task_id:'task_operation_sales',assignee_handle:assignee,status:'dispatched'}}}),
    'terminal-close':()=>json(0,{ok:true,result:{}}),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_qwen',state:'fenced'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_qwen',state:'retained',reason:'no_owned_resource',processAction:'none'}}),
    'task-update':(args)=>{assert.ok(has(args,'--status','ready'));return json(0,{ok:true,result:{task:{id:'task_operation_sales',status:'ready'}}});}
  };
}
const reready={'task-update':(args)=>{assert.ok(has(args,'--status','ready'));return json(0,{ok:true,result:{task:{id:'task_operation_sales',status:'ready'}}});}};

test('native Orca runner uses an executable instead of a Windows command shim',()=>{
  assert.equal(defaultOrcaExecutable,process.platform==='win32'?'orca.exe':'orca');
  assert.equal(qwenLaunchMode,'command-terminal');
});

test('operation request carries the whole chain with its launch kinds and owns the canonical Task identity',()=>{
  const planned=buildOperationLaunch(input);
  assert.equal(planned.schema,'starci/orca-supervised-op-request@2');
  assert.equal(planned.displayName,opName);
  assert.deepEqual(planned.candidates.map(candidate=>[candidate.selection.target,candidate.launch]),[['qwen3.8-flash','command-terminal'],['claude-opus','managed-agent'],['gpt-5.6-sol','managed-agent']]);
  assert.match(planned.candidates[0].terminalParams.command,/^qwen --model qwen3.8-flash .*--exclude-tools agent/);
  assert.equal(planned.candidates[0].terminalParams.title,opName);
  assert.equal(planned.candidates[0].terminalParams.worktree,`path:${worktreePath}`);
  assert.deepEqual(planned.candidates[0].dispatchParams,{task:'$operationTaskId',to:'$terminalHandle',from:'term_monitor_sales',run:'run_sales','return-preamble':true});
  assert.equal(planned.candidates[1].workerParams.model,undefined);
  assert.equal(planned.candidates[2].workerParams.model,'gpt-5.6-sol');
  assert.equal(planned.candidates[1].workerParams['timeout-ms'],120000);
  assert.deepEqual(planned.runAttestationParams,{id:'run_sales'});
  assert.equal(planned.taskParams['display-name'],opName);
  assert.throws(()=>buildOperationLaunch({...input,worktree:'current'}),/filesystem-relative path/);
  assert.throws(()=>buildOperationLaunch({...input,worktree:worktreePath}),/must be relative/);
  assert.deepEqual(buildOperationLaunch(reasonInput).candidates.map(candidate=>[candidate.selection.target,candidate.launch]),[['claude-fable-5.1','managed-agent'],['gpt-6-astra','managed-agent'],['claude-opus','managed-agent']]);
});

test('a supervisor chain resolves from the registry with its model and effort, never from a hardcoded provider',()=>{
  assert.deepEqual(resolveSupervisorChain('workflowMonitor').map(candidate=>[candidate.target,candidate.model,candidate.effort]),[['claude-opus',null,null],['gpt-5.6-sol','gpt-5.6-sol','high']]);
  assert.throws(()=>resolveSupervisorChain('nobody'),/Supervisor chain is missing/);
});

test('a Qwen operation runs in one command terminal: create, wait for the prompt, return-preamble, send, submit-verify, attest assignee',()=>{
  const fake=fakeOrca(qwenHandlers());
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.launch,'command-terminal');
  assert.equal(result.dispatchId,'ctx_qwen');
  assert.equal(result.terminal,'term_qwen');
  assert.equal(result.selection.target,'qwen3.8-flash');
  assert.equal(result.attestation.supervision,'command-terminal');
  assert.equal(result.attestation.model,'qwen3.8-flash');
  assert.equal(result.attestation.submitEnters,2);
  assert.deepEqual(result.attempts,[]);
  const create=fake.spawned.find(args=>args[0]==='terminal'&&args[1]==='create');
  assert.ok(has(create,'--title',opName)&&has(create,'--worktree',`path:${worktreePath}`));
  assert.match(value(create,'--command'),/BAILIAN_TOKEN_PLAN_API_KEY.*qwen --model qwen3.8-flash/);
  assert.doesNotMatch(value(create,'--command'),/sk-/);
  const dispatch=fake.spawned.find(args=>args[1]==='dispatch');
  assert.ok(has(dispatch,'--task','task_operation_sales')&&has(dispatch,'--to','term_qwen')&&has(dispatch,'--from','term_monitor_sales')&&has(dispatch,'--run','run_sales')&&dispatch.includes('--return-preamble'));
  assert.equal(dispatch.includes('--inject'),false);
  const sends=fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='send');
  assert.equal(sends.length,2);
  assert.ok(has(sends[0],'--text')&&sends[0].includes('--enter')&&value(sends[0],'--text').startsWith('=== PREAMBLE ==='));
  assert.equal(result.attestation.delivery,'inline');
  assert.equal(has(sends[1],'--text'),false);
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-start').length,0);
});

test('a Qwen terminal that never renders its prompt is closed with no effects and the chain continues to Claude',()=>{
  const fake=fakeOrca({
    ...qwenHandlers({reads:[['Welcome','npm view @qwen-code/qwen-code dist-tags.latest']]}),
    'worker-start':(args)=>{assert.ok(has(args,'--agent','claude'));return json(0,started('ctx_claude','task_operation_sales'));},
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'claude-opus');
  assert.equal(result.launch,'managed-agent');
  assert.equal(result.attempts.length,1);
  assert.equal(result.attempts[0].effectState,'none');
  assert.match(result.attempts[0].reason,/readiness timeout/);
  assert.equal(fake.spawned.filter(args=>args[1]==='dispatch').length,0);
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='close').length,1);
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='read').length,24);
});

test('a Qwen prompt that is never consumed is fenced: stop the Dispatch, close exactly that terminal, release, then fall through',()=>{
  const fake=fakeOrca({
    ...qwenHandlers({reads:[qwenReady,qwenStaged,qwenStaged,qwenStaged]}),
    'worker-start':()=>json(0,started('ctx_claude','task_operation_sales')),
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'claude-opus');
  assert.equal(result.attempts[0].dispatchId,'ctx_qwen');
  assert.equal(result.attempts[0].effectState,'none');
  assert.match(result.attempts[0].reason,/not consumed/);
  assert.equal(result.attempts[0].settlement.closedTerminal.handle,'term_qwen');
  assert.ok(fake.spawned.some(args=>args[1]==='worker-stop'&&has(args,'--dispatch','ctx_qwen')));
  assert.ok(fake.spawned.some(args=>args[1]==='worker-release'&&has(args,'--dispatch','ctx_qwen')));
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='send'&&!has(args,'--text')).length,1);
});

test('a Dispatch whose assignee is not the created terminal is fenced, never accepted',()=>{
  const fake=fakeOrca({
    ...qwenHandlers({assignee:'term_other'}),
    'worker-start':()=>json(0,started('ctx_claude','task_operation_sales')),
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.selection.target,'claude-opus');
  assert.match(result.attempts[0].reason,/assignee attestation failed/);
});

test('a managed candidate stall is classified as no-effect and the launcher falls through in the same invocation',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',reasonName)),
    'worker-start':(args)=>has(args,'--agent','claude')?json(1,stalled):json(0,started('ctx_codex','task_operation_sales')),
    'worker-show':(args,nth)=>json(0,shown({dispatch:'ctx_codex',agent:'codex',model:'gpt-6-astra',title:nth===1?'Working':reasonName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(reasonInput,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'gpt-6-astra');
  assert.equal(result.attempts.length,1);
  assert.equal(result.attempts[0].target,'claude-fable-5.1');
  assert.equal(result.attempts[0].effectState,'none');
  assert.equal(result.attempts[0].settlement,null);
  assert.equal(fake.spawned.filter(args=>args[1]==='task-update').length,0);
  assert.equal(fake.spawned.filter(args=>args[1]==='task-create').length,1);
  assert.deepEqual(fake.spawned.filter(args=>args[1]==='worker-start').map(args=>value(args,'--agent')),['claude','codex']);
  assert.ok(has(fake.spawned.filter(args=>args[1]==='worker-start')[1],'--model','gpt-6-astra'));
});

test('provider mismatch fences and settles the exact managed dispatch; a pending release stops the chain',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',reasonName)),
    'worker-start':(args,nth)=>json(0,started(nth===1?'ctx_wrong':'ctx_codex','task_operation_sales')),
    'worker-show':(args)=>has(args,'--dispatch','ctx_wrong')?json(0,shown({dispatch:'ctx_wrong',agent:'codex',model:'gpt-5.6-sol',title:'Working'})):json(0,shown({dispatch:'ctx_codex',agent:'codex',model:'gpt-6-astra',title:reasonName})),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'released'}}),
    'terminal-rename':()=>json(0,{ok:true,result:{}}),
    ...reready
  });
  const result=startOperation(reasonInput,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'gpt-6-astra');
  assert.match(result.attempts[0].reason,/expected agent claude/);
  assert.equal(result.attempts[0].settlement.release.state,'released');
  const reissue=fake.spawned.find(args=>args[1]==='task-update');
  assert.ok(has(reissue,'--id','task_operation_sales')&&has(reissue,'--status','ready')&&has(reissue,'--from','term_monitor_sales'));
  const pending=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',reasonName)),
    'worker-start':()=>json(0,started('ctx_wrong','task_operation_sales')),
    'worker-show':()=>json(0,shown({dispatch:'ctx_wrong',agent:'codex',model:'gpt-5.6-sol',title:'Working'})),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'release_pending',processAction:'closing'}})
  });
  const stopped=startOperation(reasonInput,{orca:pending.orca,wait:noWait});
  assert.equal(stopped.ok,false);
  assert.equal(stopped.stopReason,'partial-or-unknown-effects');
  assert.equal(stopped.attempts[0].effectState,'partial');
  assert.equal(pending.spawned.filter(args=>args[1]==='worker-start').length,1);
});

test('an exhausted chain is a typed failure, never a thrown string',()=>{
  const fake=fakeOrca({
    ...qwenHandlers({reads:[['Welcome']]}),
    'worker-start':()=>json(1,stalled)
  });
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,false);
  assert.equal(result.exhausted,true);
  assert.equal(result.stopReason,'chain-exhausted');
  assert.deepEqual(result.attempts.map(attempt=>attempt.target),['qwen3.8-flash','claude-opus','gpt-5.6-sol']);
  assert.ok(result.attempts.every(attempt=>attempt.effectState==='none'));
  assert.equal(result.recovery,'report-workflow-boundary-worker_failed');
});

test('a terminal that is not the nested Run Monitor cannot create an operation Task',()=>{
  const fake=fakeOrca({'run-show':()=>json(0,{ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_other_monitor'}}})});
  assert.throws(()=>startOperation(input,{orca:fake.orca}),/exact Workflow Monitor/);
  assert.deepEqual(fake.names(),['orchestration run-show']);
});

test('managed prompt delivery requires a ready worker with accepted task input',()=>{
  assert.equal(promptDelivery(shown()).ok,true);
  assert.match(promptDelivery(shown({state:'failed'})).reason,/Worker is failed/);
  assert.match(promptDelivery(shown({dispatchStatus:'failed'})).reason,/Dispatch failed/);
  assert.match(promptDelivery(shown({effects:[{kind:'dispatch_input',state:'stalled'}]})).reason,/Task input was stalled/);
});

test('native activity title drift after the canonical rename is recorded, never fenced',()=>{
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',reasonName)),
    'worker-start':()=>json(0,started('ctx_claude','task_operation_sales')),
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:'◐ Deciding the Sales SDS'})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(reasonInput,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.titleDrift,true);
  assert.deepEqual(result.attestation.terminalTitle,{observed:'◐ Deciding the Sales SDS',canonical:false,mutableUiMetadata:true,action:'recanonicalize-without-fencing'});
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='rename').length,2);
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-stop').length,0);
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
  const live=fakeOrca({
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_1',state:'ready'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_1',state:'retained',reason:'active_worker',processAction:'none'}})
  });
  assert.equal(settleDispatch(live.orca,'ctx_1',{cwd:'.'}).effectState,'partial');
});

test('settlement reconciles an unknown stop, closes an unstoppable own terminal, and reports unknown when nothing settles',()=>{
  const fake=fakeOrca({'worker-stop':()=>json(1,{ok:false,result:{dispatchId:'ctx_x',state:'stop_unknown'}}),
    'worker-show':()=>json(0,{ok:true,result:{dispatch:{id:'ctx_1'},worker:{state:'ready',agent_terminal_handle:'term_1'},observation:{status:'live'}}}),
    'terminal-close':()=>json(1,{ok:false,error:{code:'terminal_busy',message:'cannot close'}})});
  const settlement=settleDispatch(fake.orca,'ctx_1',{cwd:'.',wait:noWait});
  assert.equal(settlement.schema,'starci/orca-supervised-settlement@1');
  assert.equal(settlement.effectState,'unknown');
  assert.equal(settlement.release.outcome,'skipped');
  assert.equal(settlement.reconciliation.settled,false);
  assert.equal(settlement.closedTerminal.outcome,'failed');
  let closed=false;
  const contained=fakeOrca({
    'worker-stop':()=>closed?json(0,{ok:true,result:{dispatchId:'ctx_2',state:'failed',alreadySettled:true}}):json(1,{ok:false,result:{dispatchId:'ctx_2',state:'stop_unknown'}}),
    'worker-show':()=>json(0,{ok:true,result:{dispatch:{id:'ctx_2'},worker:{state:closed?'failed':'ready',agent_terminal_handle:'term_ctx_2'},observation:{status:closed?'exited':'live'}}}),
    'terminal-close':(args)=>{assert.ok(has(args,'--terminal','term_ctx_2'));closed=true;return json(0,{ok:true,result:{}});},
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_2',state:'released'}})
  });
  const settled=settleDispatch(contained.orca,'ctx_2',{cwd:'.',wait:noWait,terminalHandle:'term_ctx_2'});
  assert.equal(settled.effectState,'none');
  assert.equal(settled.reconciliation.afterClose,true);
  const cli=main(['settle','--dispatch','ctx_3'],{orca:fakeOrca({'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_3',state:'failed'}}),'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_3',state:'released'}})}).orca});
  assert.equal(cli.effectState,'none');
});

test('--skip records a verified no-effect failure for a chain target and starts at the next candidate',()=>{
  const planned=buildOperationLaunch({...input,skip:'qwen3.8-flash:unavailable'});
  assert.deepEqual(planned.candidates.map(candidate=>candidate.selection.target),['claude-opus','gpt-5.6-sol']);
  assert.deepEqual(planned.skipped,[{target:'qwen3.8-flash',reason:'unavailable',effectState:'none',source:'monitor-verified-skip'}]);
  assert.throws(()=>buildOperationLaunch({...input,skip:'qwen3.8-flash:permission-denied'}),/reason must be one of/);
  assert.throws(()=>buildOperationLaunch({...input,skip:'gpt-6-astra:unavailable'}),/outside this operation chain/);
  assert.throws(()=>buildOperationLaunch({...input,skip:'qwen3.8-flash,claude-opus,gpt-5.6-sol'}),/Every candidate/);
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':(args)=>{assert.ok(has(args,'--agent','claude'));return json(0,started('ctx_claude','task_operation_sales'));},
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation({...input,skip:'qwen3.8-flash'},{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'claude-opus');
  assert.deepEqual(result.attempts.map(attempt=>[attempt.target,attempt.reason,attempt.effectState]),[['qwen3.8-flash','unavailable','none']]);
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='create').length,0);
  assert.deepEqual(parseSkip('',[]),[]);
});

test('an explicit candidate list replaces chain resolution, so the allocator launches exactly one runtime',()=>{
  const chain=resolveExecutionChain({skill:'starci',op:'backend.implement'}).candidates;
  const opus=chain.find(candidate=>candidate.target==='claude-opus');
  const planned=buildOperationLaunch({...input,candidates:[opus]});
  assert.deepEqual(planned.candidates.map(candidate=>candidate.selection.target),['claude-opus']);
  assert.deepEqual(planned.selection,opus);
  assert.deepEqual(planned.skipped,[]);
  assert.equal(planned.candidates[0].launch,'managed-agent');
  // The list is the decision: it cannot be combined with --skip and it cannot be empty or unresolved.
  assert.throws(()=>buildOperationLaunch({...input,candidates:[opus],skip:'qwen3.8-flash:unavailable'}),/cannot narrow it further/);
  assert.throws(()=>buildOperationLaunch({...input,candidates:[]}),/at least one resolved selection/);
  assert.throws(()=>buildOperationLaunch({...input,candidates:[{target:'claude-opus'}]}),/resolved selection with a target and an Orca launch shape/);
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',opName)),
    'worker-start':args=>{assert.ok(has(args,'--agent','claude'));return json(0,started('ctx_claude','task_operation_sales'));},
    'worker-show':()=>json(0,shown({dispatch:'ctx_claude',agent:'claude',model:null,title:opName})),
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(input,{orca:fake.orca,wait:noWait,candidates:[opus]});
  assert.equal(result.ok,true);
  assert.equal(result.selection.target,'claude-opus');
  // Qwen leads this chain, yet no terminal was created and no attempt was recorded against it.
  assert.deepEqual(result.attempts,[]);
  assert.equal(fake.spawned.filter(args=>args[0]==='terminal'&&args[1]==='create').length,0);
  assert.deepEqual(fake.spawned.filter(args=>args[1]==='worker-start').map(args=>value(args,'--agent')),['claude']);
});

test('verify command reports live contract drift before any effect',()=>{
  const agentContext=JSON.parse(fs.readFileSync(new URL('./fixtures/orca/live-1.4.188/agent-context.json',import.meta.url),'utf8'));
  const fake=fakeOrca({'agent-context':()=>json(0,agentContext)});
  const result=main(['verify'],{orca:fake.orca});
  assert.equal(result.schema,'starci/orca-live-contract-verification@1');
  assert.equal(result.ok,true);
  assert.equal(result.commandCount,232);
});

test('a Dispatch Orca cannot move out of stop_unknown is abandoned only after its own terminal is closed',()=>{
  let closed=false;
  const fake=fakeOrca({
    'worker-stop':()=>json(1,{ok:false,error:{code:'dispatch_inactive',message:'Dispatch ctx_9 cannot stop from stop_unknown.'}}),
    'worker-show':()=>json(0,{ok:true,result:{dispatch:{id:'ctx_9'},worker:{state:'stop_unknown',agent_terminal_handle:'term_9'},observation:{status:closed?'exited':'live'}}}),
    'terminal-close':(args)=>{assert.ok(has(args,'--terminal','term_9'));closed=true;return json(0,{ok:true,result:{}});},
    'worker-abandon':()=>json(0,{ok:true,result:{dispatchId:'ctx_9',state:'abandoned'}})
  });
  const settlement=settleDispatch(fake.orca,'ctx_9',{cwd:'.',wait:noWait});
  assert.equal(settlement.effectState,'none');
  assert.equal(settlement.abandoned,true);
  assert.equal(settlement.closedTerminal.handle,'term_9');
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-release').length,0);
  const cli=main(['settle','--dispatch','ctx_9','--terminal','term_9','--close','true'],{orca:fakeOrca({
    'worker-stop':()=>json(1,{ok:false,error:{code:'dispatch_inactive',message:'cannot stop from stop_unknown'}}),
    'terminal-close':()=>json(0,{ok:true,result:{}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_9',state:'retained',reason:'active_worker',processAction:'none'}})
  }).orca});
  assert.equal(cli.effectState,'none');
  assert.equal(cli.closedTerminal.handle,'term_9');
});

test('a Task that cannot be re-readied after a settled attempt stops the chain with a typed reason',()=>{
  const fake=fakeOrca({
    ...qwenHandlers({reads:[qwenReady,qwenStaged,qwenStaged,qwenStaged]}),
    'task-update':()=>json(1,{ok:false,error:{code:'invalid_transition',message:'blocked tasks stay blocked'}})
  });
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,false);
  assert.equal(result.stopReason,'task-not-reissuable');
  assert.equal(result.attempts[0].reissue.outcome,'failed');
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-start').length,0);
});

test('sweep closes settled-dispatch and residual agent terminals in the workflow worktree only, never live workers or supervisors',()=>{
  const here=path.resolve('.');
  const fake=fakeOrca({
    'terminal-list':()=>json(0,{ok:true,result:{terminals:[
      {handle:'term_monitor',title:'◐ Monitor Sales',worktreePath:here},
      {handle:'term_live',title:'◑ Sales backend implementation',worktreePath:here},
      {handle:'term_dead_op',title:'◑ Old op',worktreePath:here},
      {handle:'term_qwen_residual',title:'npm view @qwen-code/qwen-code dist-tags.latest',worktreePath:here},
      {handle:'term_report',title:'Report task outcome | sales',worktreePath:here},
      {handle:'term_user',title:'my shell',worktreePath:here},
      {handle:'term_qwen_live',title:'◐ Qwen - sales',worktreePath:here},
      {handle:'term_qwen_done',title:'◐ Qwen - sales',worktreePath:here},
      {handle:'term_other_wt',title:'[Op] backend.implement - Core',worktreePath:path.resolve('..')}
    ]}}),
    'worker-list':()=>json(0,{ok:true,result:{workers:[
      {dispatchId:'ctx_live',workerState:'ready',agentTerminalHandle:'term_live'},
      {dispatchId:'ctx_dead',workerState:'abandoned',dispatchStatus:'failed',agentTerminalHandle:'term_dead_op'},
      {dispatchId:'ctx_qwen_live',workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:'term_qwen_live'},
      {dispatchId:'ctx_qwen_done',workerState:'unsupervised',dispatchStatus:'completed',agentTerminalHandle:'term_qwen_done'}
    ]}}),
    'terminal-close':()=>json(0,{ok:true,result:{}})
  });
  const swept=sweepWorktree(fake.orca,{cwd:here,from:'term_monitor'});
  assert.equal(swept.schema,'starci/orca-supervised-sweep@1');
  assert.deepEqual(swept.closed.map(item=>item.handle).sort(),['term_dead_op','term_qwen_done','term_qwen_residual','term_report']);
  assert.deepEqual(swept.kept.map(item=>[item.handle,item.reason]),[['term_monitor','protected'],['term_live','live-worker'],['term_user','unknown-ownership'],['term_qwen_live','live-worker']]);
  const cli=main(['sweep','--worktree','.','--from','term_monitor'],{orca:fake.orca});
  assert.equal(cli.schema,'starci/orca-supervised-sweep@1');
});

test('a preamble above the inline limit is delivered as a short @file reference inside the worktree',()=>{
  const long='=== PREAMBLE ===\n'+'x'.repeat(5000);
  const fake=fakeOrca({...qwenHandlers(),'dispatch':()=>json(0,{ok:true,result:{dispatch:{id:'ctx_qwen',task_id:'task_operation_sales'},preamble:long}})});
  const result=startOperation(input,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.attestation.delivery,'file-reference');
  const send=fake.spawned.find(args=>args[0]==='terminal'&&args[1]==='send'&&has(args,'--text'));
  const text=value(send,'--text');
  assert.match(text,/^@\.starciwork\/_local\/runtime\/orca-dispatch-ctx_qwen\.md /);
  assert.ok(text.length<400);
  const file=path.join(worktreePath,'.starciwork','_local','runtime','orca-dispatch-ctx_qwen.md');
  assert.equal(fs.readFileSync(file,'utf8').startsWith('=== PREAMBLE ==='),true);
  fs.rmSync(path.join(worktreePath,'.starciwork'),{recursive:true,force:true});
});

test('notify proves Coordinator -> Monitor delivery from the screen, not from the send receipt',()=>{
  const file=path.join(worktreePath,'.starciwork','_local','runtime','r14-v4','coordinator-addendum.md');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'COORDINATOR ADDENDUM: the --skip qwen authorization is withdrawn.\n');
  try{
    const busy=fakeOrca({
      'terminal-send':()=>json(1,{ok:false,error:{code:'agent_prompt_stalled',message:'prompt was not consumed'}}),
      'terminal-read':()=>json(0,screen(['  ...withdrawn.','❯ Press up to edit queued messages','  ⏵⏵ bypass permissions on']))
    });
    const queued=notifyTerminal(busy.orca,{cwd:worktreePath,terminal:'term_monitor_sales',file:'.starciwork/_local/runtime/r14-v4/coordinator-addendum.md',wait:noWait});
    assert.equal(queued.ok,true);
    assert.equal(queued.delivered,'queued');
    assert.equal(queued.effectState,'committed');
    assert.equal(queued.send.outcome,'failed');
    const sendArgs=busy.spawned.find(args=>args[1]==='send');
    assert.ok(sendArgs.join(' ').includes('coordinator-addendum.md'));
    const lost=fakeOrca({
      'terminal-send':()=>json(1,{ok:false,error:{code:'agent_prompt_stalled',message:'prompt was not consumed'}}),
      'terminal-read':()=>json(0,screen(['❯','  ⏵⏵ bypass permissions on']))
    });
    const missing=main(['notify','--terminal','term_monitor_sales','--text','resend me','--worktree',worktree],{orca:lost.orca});
    assert.equal(missing.ok,false);
    assert.equal(missing.effectState,'none');
    assert.match(missing.reason,/not visible/);
  }finally{fs.rmSync(path.dirname(file),{recursive:true,force:true});}
});

test('a managed agent whose prompt is staged in its input box is submitted once instead of fenced',()=>{
  let shows=0,model=null;const sends=[];
  const fake=fakeOrca({
    'run-show':()=>json(0,runShow),
    'task-create':()=>json(0,taskCreated('task_operation_sales',reasonName)),
    'worker-start':(args)=>{model=args.includes('--model')?value(args,'--model'):null;return json(1,{ok:false,error:{code:'agent_prompt_stalled',message:'prompt was not consumed'},result:{state:'failed',failedStage:'dispatch_input',dispatchId:'ctx_claude',residualResources:[{kind:'terminal',role:'agent',id:'term_ctx_claude'}]}});},
    'terminal-read':()=>json(0,screen(['You are working inside Orca, a multi-agent IDE.','❯ You are working inside Orca, a multi-agent IDE. You are a dispatched worker.','  ⏵⏵ bypass permissions on'])),
    'terminal-send':(args)=>{sends.push(args);return json(0,{ok:true,result:{}});},
    'worker-show':()=>{shows+=1;return json(0,shown({model,title:shows>1?reasonName:'worker-task_operation_sales'}));},
    'terminal-rename':()=>json(0,{ok:true,result:{}})
  });
  const result=startOperation(reasonInput,{orca:fake.orca,wait:noWait});
  assert.equal(result.ok,true);
  assert.equal(result.dispatchId,'ctx_claude');
  assert.equal(sends.length,1);assert.ok(has(sends[0],'--enter')&&has(sends[0],'--terminal','term_ctx_claude'));
  assert.equal(fake.spawned.filter(args=>args[1]==='worker-stop').length,0);
});
