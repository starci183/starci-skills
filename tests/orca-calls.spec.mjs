import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml} from '../core/yaml.mjs';
import {readPublicJson} from './helpers/read-public.mjs';
import {buildArgs,classifyReceipt,createOrcaCalls,retryRequestId,unwrap,verifyLiveSchema} from '../execution/orca-calls.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const fixture=name=>JSON.parse(fs.readFileSync(new URL(`./fixtures/orca/live-1.4.188/${name}`,import.meta.url),'utf8'));
const agentContext=fixture('agent-context.json');
const api=readPublicJson('providers/orca/api.json');

test('calls contract validates against its strict schema and the compiled copy is identical',()=>{
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/orca-call.schema.yaml',import.meta.url),'utf8'));
  const validate=new Ajv2020({strict:true}).compile(schema);
  assert.equal(validate(calls),true,JSON.stringify(validate.errors));
  assert.deepEqual(readPublicJson('providers/orca/calls.json'),calls);
});

test('every declared call exists in the public API inventory and no forbidden command is callable',()=>{
  const publicCommands=new Set(api.publicCommands);
  for(const [name,call] of Object.entries(calls.calls))assert.ok(publicCommands.has(call.command),`${name} -> ${call.command}`);
  for(const command of calls.forbiddenCalls)assert.ok(publicCommands.has(command),command);
  const declared=new Set(Object.values(calls.calls).map(call=>call.command));
  for(const command of [...calls.forbiddenCalls,...api.forbiddenForStarciOrchestration])assert.equal(declared.has(command),false,command);
});

test('live agent-context 1.4.188 accepts every declared command and flag, and a drift is reported before effects',()=>{
  const live=verifyLiveSchema(calls,agentContext);
  assert.deepEqual(live,{ok:true,errors:[],commandCount:232});
  const drifted=structuredClone(calls);
  drifted.calls['worker-start'].flags.push('imaginary');
  drifted.calls.phantom={command:'orchestration phantom',kind:'read',flags:[],receipt:['result']};
  const result=verifyLiveSchema(drifted,agentContext);
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/--imaginary/);
  assert.match(result.errors.join('\n'),/orchestration phantom/);
  assert.equal(verifyLiveSchema(calls,{schemaVersion:2,commands:agentContext.commands}).ok,false);
});

test('argv is built only from the contract: exact order, required flags, forbidden flags and literal environments rejected',()=>{
  const args=buildArgs(calls,'worker-start',{task:'task_1',worktree:'path:/tmp/child',agent:'qwen-code',run:'run_1',from:'term_monitor',
    'display-name':'[Op] review.verify - Sales','timeout-ms':120000});
  assert.deepEqual(args,['orchestration','worker-start','--task','task_1','--worktree','path:/tmp/child','--agent','qwen-code',
    '--display-name','[Op] review.verify - Sales','--timeout-ms','120000','--run','run_1','--from','term_monitor','--json']);
  assert.throws(()=>buildArgs(calls,'worker-start',{task:'task_1',worktree:'current',agent:'codex',run:'run_1',from:'term_1',terminal:'term_x'}),/forbids --terminal/);
  assert.throws(()=>buildArgs(calls,'worker-start',{task:'task_1',worktree:'current',agent:'codex',run:'run_1',from:'term_1',on:'windows'}),/forbids --on/);
  assert.throws(()=>buildArgs(calls,'worker-start',{worktree:'current',agent:'codex',run:'run_1',from:'term_1'}),/requires --task/);
  assert.throws(()=>buildArgs(calls,'worker-show',{dispatch:'ctx_1',bogus:'x'}),/does not declare --bogus/);
  assert.throws(()=>buildArgs(calls,'nope',{}),/Unknown Orca call/);
  assert.deepEqual(buildArgs(calls,'check',{wait:true,types:'worker_done,escalation',ack:'dlv_1','timeout-ms':900000}),
    ['orchestration','check','--ack','dlv_1','--types','worker_done,escalation','--wait','--timeout-ms','900000','--json']);
  assert.deepEqual(buildArgs(calls,'task-create',{spec:'s',run:'run_1',from:'term_1'},{retryRequest:'starci-abc'}).slice(-3),['--retry-request','starci-abc','--json']);
  assert.throws(()=>buildArgs(calls,'worker-show',{dispatch:'ctx_1'},{retryRequest:'starci-abc'}),/cannot carry --retry-request/);
  assert.equal(retryRequestId({a:1}),retryRequestId({a:1}));
  assert.notEqual(retryRequestId({a:1}),retryRequestId({a:2}));
});

test('worker-start receipts classify into ok, failed-none, failed-partial and unknown from Orca stage and residual resources',()=>{
  const ready={ok:true,result:{dispatch:{id:'ctx_1'},worker:{state:'ready',agent_terminal_handle:'term_1'}}};
  assert.deepEqual(pick(classifyReceipt(calls,'worker-start',{exitCode:0,receipt:ready})),{outcome:'ok',effectState:'committed'});
  const stalled={ok:false,error:{code:'agent_prompt_stalled',message:'prompt was not consumed'},result:{failedStage:'dispatch_input',effects:[],residualResources:[]}};
  const stalledResult=classifyReceipt(calls,'worker-start',{exitCode:1,receipt:stalled});
  assert.deepEqual(pick(stalledResult),{outcome:'failed',effectState:'none'});
  assert.equal(stalledResult.recovery,'worker-start-retry-of');
  const exited=fixture('worker-show-monitor-process-exited.json');
  const partial=classifyReceipt(calls,'worker-start',{exitCode:1,receipt:{ok:false,result:exited.result.worker}});
  assert.deepEqual(pick(partial),{outcome:'failed',effectState:'partial'});
  assert.equal(partial.residualResources.length,2);
  assert.equal(partial.recovery,'settle-dispatch');
  const unknown={ok:false,result:{worker:{state:'outcome_unknown'},residualResources:[{kind:'terminal',id:'term_9'}]}};
  assert.deepEqual(pick(classifyReceipt(calls,'worker-start',{exitCode:1,receipt:unknown})),{outcome:'unknown',effectState:'unknown'});
  assert.deepEqual(pick(classifyReceipt(calls,'worker-start',{exitCode:0,receipt:{ok:true,result:{dispatch:{id:'ctx_1'},worker:{state:'starting'}}}})),{outcome:'unknown',effectState:'unknown'});
  assert.deepEqual(pick(classifyReceipt(calls,'worker-start',{exitCode:null,receipt:null,parseError:'Unexpected token'})),{outcome:'unknown',effectState:'unknown'});
  assert.deepEqual(pick(classifyReceipt(calls,'worker-show',{exitCode:null,receipt:null,parseError:'Unexpected token'})),{outcome:'failed',effectState:'none'});
});

test('release and stop verdicts classify without ever throwing, and missing receipt paths are not accepted as ok',()=>{
  const release=state=>classifyReceipt(calls,'worker-release',{exitCode:state==='release_unknown'?1:0,receipt:{ok:state!=='release_unknown',result:{releaseState:state}}});
  assert.deepEqual(pick(release('released')),{outcome:'ok',effectState:'committed'});
  assert.deepEqual(pick(release('already_released')),{outcome:'ok',effectState:'committed'});
  assert.deepEqual(pick(release('retained')),{outcome:'failed',effectState:'partial'});
  assert.deepEqual(pick(release('release_pending')),{outcome:'failed',effectState:'partial'});
  assert.deepEqual(pick(release('release_unknown')),{outcome:'unknown',effectState:'unknown'});
  assert.deepEqual(pick(classifyReceipt(calls,'worker-stop',{exitCode:1,receipt:{ok:false,result:{verdict:'stop_unknown'}}})),{outcome:'unknown',effectState:'unknown'});
  assert.deepEqual(pick(classifyReceipt(calls,'task-create',{exitCode:0,receipt:{ok:true,result:{task:{id:'task_1'}}}})),{outcome:'unknown',effectState:'unknown'});
  assert.deepEqual(pick(classifyReceipt(calls,'task-create',{exitCode:1,receipt:{ok:false,error:{code:'invalid_argument',message:'bad spec'}}})),{outcome:'failed',effectState:'none'});
  assert.deepEqual(pick(classifyReceipt(calls,'run-show',{exitCode:0,receipt:{ok:true,result:{run:{id:'run_1',coordinator_handle:'term_1'}}}})),{outcome:'ok',effectState:'none'});
});

test('runner replays an unknown mutation once with --retry-request, never replays reads, and returns exit 1 as a typed result',()=>{
  const spawned=[];
  const spawn=(executable,args)=>{
    spawned.push(args);
    if(args[1]==='task-create'&&!args.includes('--retry-request'))return {status:null,stdout:'',stderr:'',error:Error('ETIMEDOUT')};
    if(args[1]==='task-create')return {status:0,stdout:JSON.stringify({ok:true,result:{task:{id:'task_1',display_name:'[Op] x - y'}}}),stderr:''};
    if(args[1]==='worker-show')return {status:null,stdout:'',stderr:'',error:Error('ETIMEDOUT')};
    if(args[1]==='worker-start')return {status:1,stdout:JSON.stringify({ok:false,error:{code:'agent_prompt_stalled',message:'stalled'},result:{failedStage:'dispatch_input',residualResources:[]}}),stderr:''};
    throw Error(`unexpected ${args.join(' ')}`);
  };
  const orca=createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0});
  const created=orca.invoke('task-create',{spec:'Review',run:'run_1',from:'term_1'},{cwd:'.'});
  assert.equal(created.schema,'starci/orca-call-result@1');
  assert.equal(created.outcome,'ok');
  assert.equal(created.attempts.length,2);
  assert.equal(created.attempts[0].outcome,'unknown');
  assert.match(created.attempts[1].retryRequest,/^starci-[0-9a-f]{24}$/);
  assert.ok(created.attempts[1].args.includes('--retry-request'));
  assert.equal(unwrap(created).result.task.id,'task_1');
  const shown=orca.invoke('worker-show',{dispatch:'ctx_1'},{cwd:'.'});
  assert.equal(shown.outcome,'failed');
  assert.equal(shown.effectState,'none');
  assert.equal(shown.attempts.length,1);
  const started=orca.invoke('worker-start',{task:'task_1',worktree:'current',agent:'qwen-code',run:'run_1',from:'term_1'},{cwd:'.'});
  assert.equal(started.outcome,'failed');
  assert.equal(started.effectState,'none');
  assert.equal(started.exitCode,1);
  assert.equal(started.recovery,'worker-start-retry-of');
  assert.equal(spawned.filter(args=>args[1]==='worker-start').length,1);
  assert.throws(()=>unwrap(started),/worker-start failed \(none\): stalled/);
});

test('verify fails closed when agent-context is unreachable or drifted',()=>{
  const offline=createOrcaCalls({executable:'orca-fake',calls,spawn:()=>({status:null,stdout:'',stderr:'',error:Error('ENOENT')})});
  const result=offline.verify({cwd:'.'});
  assert.equal(result.ok,false);
  assert.match(result.errors[0],/agent-context failed/);
  const live=createOrcaCalls({executable:'orca-fake',calls,spawn:()=>({status:0,stdout:JSON.stringify(agentContext),stderr:''})});
  assert.equal(live.verify({cwd:'.'}).ok,true);
});

function pick(value){return {outcome:value.outcome,effectState:value.effectState};}
