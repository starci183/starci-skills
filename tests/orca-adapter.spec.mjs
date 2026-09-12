import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {createOrcaCalls} from '../execution/orca-calls.mjs';
import {boundaryMessages,createOrcaAdapter} from '../execution/orca-adapter.mjs';
import {planOrcaExecution,startOrcaExecution} from '../execution/orca.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const has=(args,flag,value)=>{const index=args.indexOf(flag);return index>=0&&(value===undefined||args[index+1]===value);};

function fakeOrca(handlers){
  const spawned=[];const counts={};
  const spawn=(executable,args)=>{
    spawned.push(args);
    const key=args[0]==='terminal'?'terminal-rename':args[0]==='worktree'?`worktree-${args[1]}`:args[1];
    counts[key]=(counts[key]??0)+1;
    const handler=handlers[key];
    if(!handler)throw Error(`Unexpected fake call: ${args.join(' ')}`);
    return handler(args,counts[key]);
  };
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),spawned};
}

const selection=()=>({provider:'openai',model:'gpt-5.6-sol',effort:'high',orcaLaunch:{kind:'managed-agent',agent:'codex'}});
const parentWorktree={selector:'path:/repo/main',id:'repo-1::/repo/main'};
const request=()=>({id:'release-widget',mode:'orchestrated',controlPlane:'orca',operations:[
  {id:'prepare',operation:'workspace.manage',spec:'Prepare inputs',dependsOn:[],allowedFiles:['work/prepare/**'],selection:selection()}
]});

test('the concrete adapter drives startOrcaExecution end to end through the typed runner',async()=>{
  const renamed=new Set();
  const fake=fakeOrca({
    'run-create':()=>json(0,{ok:true,result:{run:{id:'run_1'}}}),
    'task-create':(args,nth)=>json(0,{ok:true,result:{task:{id:`task_${nth}`,display_name:args[args.indexOf('--display-name')+1]}}}),
    'worker-start':(args,nth)=>json(0,{ok:true,result:{dispatch:{id:`ctx_${nth}`,task_id:args[args.indexOf('--task')+1]},worker:{state:'ready',worktree_id:nth===1?'repo-1::/repo/child':undefined,agent_terminal_handle:`term_${nth}`}}}),
    'worktree-set':()=>json(0,{ok:true,result:{}}),
    'worktree-show':()=>json(0,{ok:true,result:{worktree:{id:'repo-1::/repo/child',parentWorktreeId:parentWorktree.id}}}),
    'worker-show':(args)=>{const dispatch=args[args.indexOf('--dispatch')+1];return json(0,{ok:true,result:{dispatch:{id:dispatch,task_id:'task_2'},worker:{state:'ready',agent_terminal_handle:`term_${dispatch}`,startOptions:{launch:{effective:{agent:'codex',model:'gpt-5.6-sol'}}}},observation:{exactWorker:true},terminal:{title:renamed.has(dispatch)?'[Op] workspace.manage - release-widget':'Working'}}});},
    'terminal-rename':(args)=>{renamed.add(args[args.indexOf('--terminal')+1].replace('term_',''));return json(0,{ok:true,result:{}});}
  });
  const adapter=createOrcaAdapter({orca:fake.orca,cwd:'.',from:'term_coordinator',repo:'path:/repo'});
  const plan=await startOrcaExecution({request:request(),parentWorktree,adapter});
  assert.equal(plan.status,'running');
  assert.equal(plan.workflow.worktree.lineageAttested,true);
  assert.equal(plan.operations.prepare.status,'dispatched');
  assert.equal(plan.operations.prepare.attempts[0].providerAttestation.titleCanonicalized,true);
  const starts=fake.spawned.filter(args=>args[1]==='worker-start');
  assert.equal(starts.length,2);
  assert.ok(has(starts[0],'--worktree','new-child')&&has(starts[0],'--name')&&has(starts[0],'--repo','path:/repo')&&has(starts[0],'--setup','run'));
  assert.ok(has(starts[1],'--worktree','path:/repo/child')&&has(starts[1],'--model','gpt-5.6-sol')&&has(starts[1],'--effort','high'));
  assert.ok(starts.every(args=>has(args,'--from','term_coordinator')&&has(args,'--timeout-ms','120000')));
  const set=fake.spawned.find(args=>args[0]==='worktree'&&args[1]==='set');
  assert.ok(has(set,'--parent-worktree',parentWorktree.selector));
});

test('a failed worker-start is settled and surfaces the effect state instead of an opaque error',async()=>{
  const fake=fakeOrca({
    'worker-start':()=>json(1,{ok:false,error:{code:'agent_prompt_stalled',message:'stalled'},result:{dispatch:{id:'ctx_stalled'},worker:{state:'failed',stage:'dispatch_input'},residualResources:[{kind:'terminal',id:'term_x'}]}}),
    'worker-stop':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'failed'}}),
    'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'released'}})
  });
  const adapter=createOrcaAdapter({orca:fake.orca,cwd:'.'});
  await assert.rejects(()=>adapter.dispatchWorker({runId:'run_1',taskId:'task_1',worktree:{kind:'existing-child',id:'repo-1::/repo/child'},selection:selection(),displayName:'[Op] x - y',launchPlan:{steps:[{args:{agent:'codex',model:'gpt-5.6-sol'}}]}}),error=>{
    assert.equal(error.effectState,'none');
    assert.equal(error.settlement.release.state,'released');
    assert.equal(error.result.outcome,'failed');
    return true;
  });
  assert.ok(fake.spawned.some(args=>args[1]==='worker-stop'&&has(args,'--dispatch','ctx_stalled')));
});

test('boundary wait filters keepalive rows, reports a timeout as an empty ok batch and acknowledges by delivery id',async()=>{
  const fake=fakeOrca({
    'check':(args,nth)=>nth===1?json(0,{ok:true,result:{delivery:{id:'dlv_1'},messages:[{_keepalive:true},{type:'worker_done',taskId:'task_2',dispatchId:'ctx_2',outcome:'succeeded'}]}}):json(0,{ok:true,result:{messages:[]}})
  });
  const adapter=createOrcaAdapter({orca:fake.orca,cwd:'.'});
  const first=await adapter.waitBoundary({runId:'run_1'});
  assert.equal(first.ok,true);assert.equal(first.deliveryId,'dlv_1');assert.equal(first.timedOut,false);
  assert.deepEqual(first.messages.map(row=>row.type),['worker_done']);
  const second=await adapter.waitBoundary({runId:'run_1',ack:'dlv_1'});
  assert.equal(second.timedOut,true);assert.deepEqual(second.messages,[]);
  const ackCall=fake.spawned.at(-1);
  assert.ok(has(ackCall,'--ack','dlv_1')&&has(ackCall,'--wait')&&has(ackCall,'--types','worker_done,escalation,question'));
  assert.deepEqual(boundaryMessages({result:{messages:[{_heartbeat:true},{type:'question'}]}}).map(row=>row.type),['question']);
});

test('release reports retained terminals honestly and integration is never performed by the adapter',async()=>{
  const fake=fakeOrca({'worker-release':()=>json(0,{ok:true,result:{dispatchId:'ctx_x',state:'retained',reason:'identity_unproven',processAction:'none'}})});
  const adapter=createOrcaAdapter({orca:fake.orca,cwd:'.'});
  const release=await adapter.releaseWorker({dispatchId:'ctx_1'});
  assert.deepEqual({status:release.status,releaseState:release.releaseState,effectState:release.effectState},{status:'retained',releaseState:'retained',effectState:'partial'});
  await assert.rejects(()=>adapter.integrateChange({}),/coordinator-owned/);
  assert.equal(planOrcaExecution(request()).status,'planned');
});
