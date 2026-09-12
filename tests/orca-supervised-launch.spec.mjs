import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {buildMonitorLaunch,buildOperationLaunch,startOperation} from '../execution/orca-supervised-launch.mjs';

const worktree='fixtures/orca/agentos-r14-sales';
const worktreePath=path.resolve(worktree);
const input={run:'run_sales',workflowTask:'task_workflow_sales',from:'term_monitor_sales',worktree,
  operation:'review.verify',scope:'Sales',spec:'Review the bounded Sales implementation and report exactly once.'};

function receipt({agent='qwen-code',model='qwen3.8-flash',title='[Op] review.verify - Sales'}={}){
  return {ok:true,result:{
    dispatch:{id:'ctx_operation_sales',task_id:'task_operation_sales'},
    worker:{state:'ready',agent_terminal_handle:'term_operation_sales',startOptions:{launch:{effective:{agent,model}}}},
    observation:{exactWorker:true},terminal:{title,worktreePath}
  }};
}

test('operation request resolves Qwen first and owns the canonical Task identity',()=>{
  const planned=buildOperationLaunch(input);
  assert.equal(planned.displayName,'[Op] review.verify - Sales');
  assert.equal(planned.selection.orcaLaunch.agent,'qwen-code');
  assert.equal(planned.selection.model,'qwen3.8-flash');
  assert.deepEqual(planned.taskArgs.slice(0,2),['orchestration','task-create']);
  assert.equal(planned.taskArgs.includes('--parent'),false);
  assert.deepEqual(planned.runAttestationArgs,['orchestration','run-show','--id','run_sales','--json']);
  assert.ok(planned.taskArgs.includes('[Op] review.verify - Sales'));
  assert.ok(planned.workerArgs.includes('qwen-code'));
  assert.equal(planned.workerArgs.includes('--model'),false);
  assert.ok(planned.workerArgs.includes(`path:${worktreePath}`));
});

test('Workflow Manager is named Monitor and cannot use an implicit worktree',()=>{
  const planned=buildMonitorLaunch({run:'run_parent',parentTask:'task_parent',from:'term_parent',worktree,
    workflow:'Sales',spec:'Manage the Sales operation DAG without performing operation work.'});
  assert.equal(planned.displayName,'[Monitor] Sales');
  assert.throws(()=>buildOperationLaunch({...input,worktree:'current'}),/filesystem-relative path/);
  assert.throws(()=>buildOperationLaunch({...input,worktree:worktreePath}),/must be relative/);
});

test('supervised operation launcher emits native Qwen worker-start without a model override',()=>{
  const calls=[];
  const runOrca=args=>{
    calls.push(args);
    if(args[0]==='orchestration'&&args[1]==='run-show')return {ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_monitor_sales'}}};
    if(args[0]==='orchestration'&&args[1]==='task-create')return {ok:true,result:{task:{id:'task_operation_sales',display_name:'[Op] review.verify - Sales'}}};
    if(args[0]==='orchestration'&&args[1]==='worker-start')return {ok:true,result:{dispatch:{id:'ctx_operation_sales',task_id:'task_operation_sales'}}};
    if(args[0]==='orchestration'&&args[1]==='worker-show')return receipt({title:calls.filter(call=>call[0]==='terminal').length?'[Op] review.verify - Sales':'Working'});
    if(args[0]==='terminal'&&args[1]==='rename')return {ok:true,result:{}};
    throw Error(`Unexpected fake call: ${args.join(' ')}`);
  };
  const result=startOperation(input,{runOrca});
  assert.equal(result.ok,true);
  const start=calls.find(args=>args[0]==='orchestration'&&args[1]==='worker-start');
  assert.ok(start.includes('qwen-code'));
  assert.equal(start.includes('--model'),false);
  assert.ok(start.includes(`path:${worktreePath}`));
  assert.deepEqual(calls.map(args=>args.slice(0,2).join(' ')),[
    'orchestration run-show','orchestration task-create','orchestration worker-start','orchestration worker-show','terminal rename','orchestration worker-show'
  ]);
});

test('provider mismatch fences the exact dispatch and never falls back to Codex',()=>{
  const calls=[];
  const runOrca=args=>{
    calls.push(args);
    if(args[1]==='run-show')return {ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_monitor_sales'}}};
    if(args[1]==='task-create')return {ok:true,result:{task:{id:'task_operation_sales',display_name:'[Op] review.verify - Sales'}}};
    if(args[1]==='worker-start')return {ok:true,result:{dispatch:{id:'ctx_operation_sales',task_id:'task_operation_sales'}}};
    if(args[1]==='worker-show')return receipt({agent:'codex',model:'gpt-5.6-sol',title:'Working'});
    if(args[1]==='worker-stop')return {ok:true,result:{}};
    throw Error(`Unexpected fake call: ${args.join(' ')}`);
  };
  assert.throws(()=>startOperation(input,{runOrca}),/expected agent qwen-code/);
  assert.equal(calls.some(args=>args[1]==='worker-stop'&&args.includes('ctx_operation_sales')),true);
  assert.equal(calls.filter(args=>args[1]==='worker-start').length,1);
});

test('a terminal that is not the nested Run Monitor cannot create an operation Task',()=>{
  const calls=[];
  const runOrca=args=>{calls.push(args);return {ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_other_monitor'}}};};
  assert.throws(()=>startOperation(input,{runOrca}),/exact Workflow Monitor/);
  assert.deepEqual(calls.map(args=>args[1]),['run-show']);
});
