import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {createOrcaCalls} from '../execution/orca-calls.mjs';
import {buildReport} from '../execution/reports.mjs';
import {applyReport,initialState,renderContract,superviseLoop} from '../execution/supervise.mjs';
import {OP_PLAN_FORM,callFunction,extractJson,validateForm} from '../execution/llm-functions.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const io=parseYaml(fs.readFileSync(new URL('../schemas/op-io.yaml',import.meta.url),'utf8'));
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const worktree='fixtures/orca/agentos-r14-sales';
const cwd=path.resolve(worktree);
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const noWait=()=>{};
const plan={goal:'Implement SDS-FR-SALES-03 order intake.',srsIds:['SRS-SALES-1'],sdsIds:['SDS-FR-SALES-03'],allowlist:['apps/agentos-controlplane/src/sales/intake.ts'],references:['.starciwork/features/sales/sds.md#3'],checks:[{name:'unit',command:'npx vitest run sales'}],acceptance:['intake persists an order'],inputs:['SDS 3.1'],outputs:['intake.ts']};
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-supervise-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};

/** Scripted Orca for a whole workflow: each launched op ends with the next scripted report. */
function scriptedOrca({reports,reportsDir}){
  const spawned=[];let terminals=0,dispatches=0;const sent=new Set();const live=new Map();const sends=[];
  const handlers={
    'run-show':()=>json(0,{ok:true,result:{run:{id:'run_sales',coordinator_handle:'term_monitor'}}}),
    'task-create':(args)=>json(0,{ok:true,result:{task:{id:`task_${dispatches+1}`,display_name:args[args.indexOf('--display-name')+1]}}}),
    'terminal-create':()=>{terminals+=1;return json(0,{ok:true,result:{terminal:{handle:`term_${terminals}`}}});},
    'terminal-read':(args)=>{const handle=args[3];return json(0,{ok:true,result:{terminal:{handle,status:'running',tail:sent.has(handle)?['∵ Thinking… 1s','⠼ working (5s · esc to cancel)','qwen3.8-flash (Token Plan Singapore)']:['>_ Qwen Code (v0.23.3)','>   Type your message or @path/to/file','qwen3.8-flash (Token Plan Singapore)']}}});},
    dispatch:()=>{dispatches+=1;const id=`ctx_${dispatches}`;live.set(id,`term_${terminals}`);return json(0,{ok:true,result:{dispatch:{id,task_id:`task_${dispatches}`},injected:false,preamble:'=== PREAMBLE ===\nreport once\n=== TASK ===\nDo it'}});},
    'terminal-send':(args)=>{sent.add(args[3]);return json(0,{ok:true,result:{}});},
    'dispatch-show':(args)=>json(0,{ok:true,result:{dispatch:{id:`ctx_${dispatches}`,task_id:args[args.indexOf('--task')+1],assignee_handle:`term_${terminals}`,status:'dispatched'}}}),
    check:(args)=>{
      if(args.includes('--peek'))return json(0,{ok:true,result:{messages:[]}});
      // The blocking wait: the running op "finishes" now by writing its scripted report.
      const id=`ctx_${dispatches}`;const script=reports[dispatches-1];
      if(script&&!fs.existsSync(path.join(reportsDir,`${id}.json`))){const report=buildReport({...script,run:'run_sales',task:`task_${dispatches}`,dispatch:id,from:live.get(id)});report.sent={messageId:`msg_${id}`,sentAt:1,type:report.signal.type};fs.writeFileSync(path.join(reportsDir,`${id}.json`),JSON.stringify(report));}
      return json(0,{ok:true,result:{deliveryId:`delivery_${dispatches}`,messages:[]}});
    },
    'worker-list':()=>json(0,{ok:true,result:{workers:[...live].map(([id,handle])=>({dispatchId:id,taskId:id.replace('ctx','task'),workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:handle}))}}),
    'terminal-list':()=>json(0,{ok:true,result:{terminals:[...live.values()].map(handle=>({handle,title:'Qwen - sales',worktreePath:cwd,status:'running',lastOutputAt:0}))}}),
    'task-list':()=>json(0,{ok:true,result:{tasks:[]}}),
    'terminal-rename':()=>json(0,{ok:true,result:{}}),
    'worker-release':(args)=>{live.delete(args[args.indexOf('--dispatch')+1]);return json(0,{ok:true,result:{dispatchId:'x',state:'released'}});},
    'terminal-close':()=>json(0,{ok:true,result:{}}),
    send:(args)=>{sends.push(args);return json(0,{ok:true,result:{message:{id:'msg_wf'}}});}
  };
  const spawn=(executable,args)=>{spawned.push(args);const key=args[0]==='terminal'?`terminal-${args[1]}`:args[0]==='agent-context'?'agent-context':args[1];const handler=handlers[key];if(!handler)throw Error(`Unexpected fake call: ${args.join(' ')}`);return handler(args);};
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),spawned,sends};
}

test('the supervisor drives implement -> repair -> review to a committed workflow report with the model only filling forms',()=>{
  const dir=tmp();const parentDir=path.join(dir,'parent');fs.mkdirSync(parentDir);
  const check={name:'unit',command:'npx vitest run sales',exitCode:0,evidence:'ok'};
  const fake=scriptedOrca({reportsDir:dir,reports:[
    {outcome:'partial',summary:'Intake done, receipt left open.',files:['apps/agentos-controlplane/src/sales/intake.ts'],checks:[check],open:['receipt not persisted']},
    {outcome:'done',summary:'Receipt persisted.',files:['apps/agentos-controlplane/src/sales/intake.ts'],checks:[check]},
    {outcome:'done',summary:'Review passed: acceptance 1 verified.',files:[],checks:[{...check,name:'review'}]}
  ]});
  const planCalls=[];const gits=[];
  const state=initialState({workflow:'Sales',run:'run_sales',from:'term_monitor',worktree:cwd,branch:'starci183/agentos-r14-sales',ownership:['apps/agentos-controlplane/src/sales/**'],sdsFiles:[],parentRun:'run_parent',workflowTask:'task_wf',monitorDispatch:'ctx_wf',runtimeDir:dir,launcher:'launcher.mjs',host:'.'});
  state.reportsDir=dir;state.parentReportsDir=parentDir;
  try{
    const result=superviseLoop(fake.orca,state,{cwd,io,template,wait:noWait,maxIterations:40,
      planOp:(input)=>{planCalls.push(input.node.id);return {ok:true,value:{...plan,goal:`${plan.goal} (${input.node.id})`}};},
      decide:()=>{throw Error('decide must not be called on a policy-covered path');},
      git:(cmd,args)=>{gits.push(args[0]);return {status:0,stdout:args[0]==='rev-parse'?'abc123\n':'',stderr:''};}});
    assert.equal(result.finished.outcome,'done');
    assert.deepEqual(result.nodes.map(n=>[n.id,n.operation,n.status]),[['implement-1','backend.implement','done'],['implement-repair-1','backend.implement','done'],['review-1','review.verify','done']]);
    assert.deepEqual(planCalls,['implement-1','implement-repair-1','review-1']);
    assert.deepEqual(result.nodes[1].priorOpen,['receipt not persisted']);
    assert.ok(fs.existsSync(result.nodes[0].contractFile));
    const contract=fs.readFileSync(result.nodes[0].contractFile,'utf8');
    assert.match(contract,/## Ping \(mandatory\)/);assert.match(contract,/## Acceptance/);assert.doesNotMatch(contract,/<launcher>|<nested run>|<runtime dir>/);
    assert.deepEqual(gits,['add','commit','rev-parse']);
    const workflowReport=JSON.parse(fs.readFileSync(path.join(parentDir,'ctx_wf.json'),'utf8'));
    assert.equal(workflowReport.outcome,'done');assert.equal(workflowReport.head,'abc123');
    assert.equal(fake.sends.length,1);
  }finally{fs.rmSync(path.dirname(dir),{recursive:true,force:true});}
});

test('the result policy is a table: repairs are bounded and an sds-gap inserts an architecture sidearm',()=>{
  const dir=tmp();
  try{
    const base=()=>{const s=initialState({workflow:'Sales',run:'run_sales',from:'term_monitor',worktree:cwd,branch:'b',ownership:['apps/sales/**'],sdsFiles:[],parentRun:'run_parent',workflowTask:'task_wf',monitorDispatch:'ctx_wf',runtimeDir:dir,launcher:'l',host:'.'});s.nodes[0].status='running';return s;};
    const check={name:'unit',command:'x',exitCode:1,evidence:'fail'};
    const failed=buildReport({outcome:'failed',run:'r',task:'t',dispatch:'d',from:'f',summary:'unit failed',checks:[check]});
    let state=base();let decided=0;
    for(let i=0;i<4;i+=1){const node=state.nodes.find(n=>n.status==='running')??state.nodes.find(n=>n.status==='pending'&&n.operation==='backend.implement');node.status='running';applyReport(state,node,failed,{io,decide:()=>{decided+=1;return {ok:true,value:{option:'escalate',rationale:'enough'}};},cwd});}
    assert.equal(state.repairs.implement,3);
    assert.equal(decided,1);
    assert.equal(state.nodes.filter(n=>n.status==='blocked').length,1);
    const gap=buildReport({outcome:'blocked',run:'r',task:'t',dispatch:'d',from:'f',summary:'ledger key missing',blocker:{kind:'sds-gap',detail:'ledger key'}});
    state=base();
    applyReport(state,state.nodes[0],gap,{io,decide:()=>{throw Error('no decide');},cwd});
    assert.deepEqual(state.nodes.map(n=>[n.id,n.status]),[['architecture-1','ready'],['implement-1','paused'],['review-1','pending']]);
    const sds=buildReport({outcome:'done',run:'r',task:'t',dispatch:'d2',from:'f',summary:'SDS updated with ledger key',checks:[{name:'sds',command:'review',exitCode:0}]});
    state.nodes[0].status='running';
    applyReport(state,state.nodes[0],sds,{io,decide:()=>{throw Error('no decide');},cwd});
    assert.equal(state.nodes[1].status,'ready');assert.equal(state.nodes[1].attempt,2);
    const shared=buildReport({outcome:'blocked',run:'r',task:'t',dispatch:'d3',from:'f',summary:'Core must register',blocker:{kind:'shared-change',detail:'Core registration'}});
    state=base();applyReport(state,state.nodes[0],shared,{io,decide:()=>{throw Error('no decide');},cwd});
    assert.equal(state.nodes[0].status,'done');assert.equal(state.nodes[0].escalation.kind,'shared-change');
  }finally{fs.rmSync(path.dirname(dir),{recursive:true,force:true});}
});

test('model functions are forms: JSON is extracted from prose, validated, and retried once per provider',()=>{
  assert.deepEqual(extractJson('Sure:\n```json\n{"a":1}\n```'),{a:1});
  assert.deepEqual(extractJson('{"a":{"b":[1,2]}} trailing'),{a:{b:[1,2]}});
  assert.equal(validateForm({...plan},OP_PLAN_FORM).ok,true);
  assert.match(validateForm({...plan,checks:[]},OP_PLAN_FORM).errors.join(';'),/checks needs at least 1/);
  const answers=['not json at all',JSON.stringify({...plan,sdsIds:[]}),JSON.stringify(plan)];
  const seen=[];
  const result=callFunction({kind:'planOp',payload:{},form:OP_PLAN_FORM,providers:['p1','p2'],runHeadless:(provider,prompt)=>{seen.push(provider);return answers.shift();}});
  assert.equal(result.ok,true);assert.equal(result.provider,'p2');assert.deepEqual(seen,['p1','p1','p2']);
  assert.equal(result.attempts.length,2);
  const rendered=renderContract({template,plan,node:{id:'implement-1',operation:'backend.implement',attempt:1,priorOpen:['x']},state:{workflow:'Sales',worktree:'C:/w',branch:'b',runtimeDir:'C:/r',run:'run_1',launcher:'L.mjs'}});
  assert.match(rendered,/## Open items you inherit\n- x/);assert.match(rendered,/checks-implement-1.json/);assert.match(rendered,/node L.mjs report --run run_1/);
});
