import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';
import {createOrcaCalls} from '../hosts/orca/calls.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {openLedger,inspectLedger,openMachine,ledgerFileFor,machineFileFor,ledgerIdOf,anchorFileFor,readAnchor,reserveTwoPhase} from '../kernel/ledger-db.mjs';
import {createStore} from '../kernel/store.mjs';
import {createWorkflowState,runLoop} from '../kernel/kernel.mjs';
import {goalPhase,approve} from '../kernel/goal.mjs';
import {enrollEngine,createEngineRuntime} from '../kernel/engine.mjs';
import {fakeAllocator} from './helpers/kernel-harness.mjs';
import {withLedger} from './_ledger-fixture.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const flag=(args,name)=>{const index=args.indexOf(`--${name}`);return index<0?null:args[index+1];};
const git=(cwd,...args)=>{const ran=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(ran.status,0,`git ${args.join(' ')}: ${ran.stderr}`);return ran.stdout.trim();};
const noWait=()=>{};

/**
 * The §11 host: Orca's typed surface scripted to drive ops through `worker-start` dispatches, with reports
 * delivered through the ledger `reports` table (`store.writeReport`, §8) instead of files under `_local`.
 * `kill()` makes the named dispatch answer as a dead worker: not listed, terminal gone, `worker-show` an
 * exited process - what the reconciler sees after the kernel that launched it died.
 */
function scriptedLedgerOrca({store,scripts,worktree,run='run_wf'}){
  const terminals=new Map(),dispatches=new Map(),tasks=new Map(),live=new Map(),dead=new Set();
  let counter=0;const launches=[];
  const opOf=spec=>(String(spec??'').match(/op `([^`]+)`/)??[null,'unknown'])[1];
  const handlers={
    'run-show':()=>json(0,{ok:true,result:{run:{id:run,coordinator_handle:'term_kernel'}}}),
    'run-create':()=>json(0,{ok:true,result:{run:{id:run}}}),
    'run-use':()=>json(0,{ok:true,result:{run:{id:run}}}),
    'task-create':args=>{const id=`task_${++counter}`;tasks.set(id,{id,display_name:flag(args,'display-name'),op:opOf(flag(args,'spec'))});return json(0,{ok:true,result:{task:{id,display_name:flag(args,'display-name'),task_id:id}}});},
    'task-update':()=>json(0,{ok:true,result:{task:{status:'ready'}}}),
    'task-list':()=>json(0,{ok:true,result:{tasks:[...tasks.values()].map(task=>({id:task.id,display_name:task.display_name}))}}),
    'terminal-create':args=>{const handle=`term_${++counter}`;terminals.set(handle,{handle,title:flag(args,'title'),status:'running',worktreePath:worktree,lastOutputAt:Date.now()});return json(0,{ok:true,result:{terminal:{handle}}});},
    'terminal-read':args=>{const handle=flag(args,'terminal');return json(0,{ok:true,result:{terminal:{handle,status:terminals.get(handle)?.status??'running',tail:['∵ Thinking…','⠼ working (12s · esc to cancel)']}}});},
    'terminal-send':()=>json(0,{ok:true,result:{}}),
    'terminal-list':()=>json(0,{ok:true,result:{terminals:[...terminals.values()]}}),
    'terminal-close':args=>{terminals.delete(flag(args,'terminal'));return json(0,{ok:true,result:{}});},
    'terminal-rename':args=>{const terminal=terminals.get(flag(args,'terminal'));if(terminal)terminal.title=flag(args,'title');return json(0,{ok:true,result:{}});},
    dispatch:args=>{
      const id=`ctx_${++counter}`,task=flag(args,'task'),handle=flag(args,'to');
      dispatches.set(id,{id,task,handle,op:tasks.get(task)?.op??'unknown'});live.set(id,dispatches.get(id));
      return json(0,{ok:true,result:{dispatch:{id,task_id:task},preamble:'=== PREAMBLE ===\nreport once\n=== TASK ===\nDo it'}});
    },
    'dispatch-show':args=>{const found=dispatches.get(flag(args,'dispatch'))??[...dispatches.values()].find(item=>item.task===flag(args,'task'));return json(0,{ok:true,result:{dispatch:{id:found?.id,task_id:found?.task,status:'dispatched'}}});},
    'worker-start':args=>{
      const id=`ctx_${++counter}`,handle=`term_${++counter}`,task=flag(args,'task');
      terminals.set(handle,{handle,title:`Terminal ${counter}`,status:'running',worktreePath:worktree,lastOutputAt:Date.now()});
      dispatches.set(id,{id,task,handle,agent:flag(args,'agent'),model:flag(args,'model'),op:tasks.get(task)?.op??'unknown'});
      live.set(id,dispatches.get(id));launches.push({dispatch:id,op:tasks.get(task)?.op??'unknown'});
      return json(0,{ok:true,result:{state:'ready',dispatchId:id,taskId:task,launch:{effective:{agent:flag(args,'agent'),model:flag(args,'model')??null}},
        effects:[{kind:'terminal',role:'agent',id:handle},{kind:'dispatch_input',state:'accepted'}]}});
    },
    'worker-show':args=>{
      const found=dispatches.get(flag(args,'dispatch'));
      if(!found)return json(1,{ok:false,error:{message:'unknown dispatch'}});
      if(dead.has(found.id))return json(0,{ok:true,result:{dispatch:{id:found.id,task_id:found.task,run_id:run,status:'failed'},
        worker:{state:'stopped',stage:'process_exited',dispatch_id:found.id,agent_terminal_handle:found.handle},
        observation:{exactWorker:true,status:'exited'},
        terminal:{handle:found.handle,connected:false,writable:false,paneRuntimeId:null}}});
      return json(0,{ok:true,result:{dispatch:{id:found.id,task_id:found.task,run_id:run,status:'dispatched'},
        worker:{state:'ready',dispatch_id:found.id,agent_terminal_handle:found.handle},
        observation:{exactWorker:true,status:'running'},
        terminal:{handle:found.handle,connected:true,writable:true}}});
    },
    'worker-list':()=>json(0,{ok:true,result:{workers:[...live.values()].map(item=>({dispatchId:item.id,taskId:item.task,
      workerState:'running',dispatchStatus:'dispatched',agentTerminalHandle:item.handle}))}}),
    'worker-release':args=>{live.delete(flag(args,'dispatch'));return json(0,{ok:true,result:{dispatchId:flag(args,'dispatch'),state:'released',processAction:'none'}});},
    'worker-stop':args=>json(0,{ok:true,result:{state:'stopped',dispatchId:flag(args,'dispatch')}}),
    check:args=>{
      if(args.includes('--peek'))return json(0,{ok:true,result:{messages:[]}});
      // The blocking wait: every live dispatch whose op still has a scripted report reports it now, through
      // the ledger reports row - the worker's `starci report` in §9, not a file under _local.
      for(const dispatch of live.values()){
        const queue=scripts[dispatch.op];
        if(!queue?.length)continue;
        const report=buildReport({...queue.shift(),run,task:dispatch.task,dispatch:dispatch.id,from:dispatch.handle});
        report.sent={messageId:`msg_${dispatch.id}`,sentAt:1,type:report.signal.type};
        store.writeReport({dispatchId:dispatch.id,...report});
      }
      return json(0,{ok:true,result:{deliveryId:`delivery_${++counter}`,messages:[]}});
    },
    send:()=>json(0,{ok:true,result:{message:{id:`msg_${++counter}`}}})
  };
  const spawn=(executable,args)=>{
    const key=['terminal','worktree','worker','task','run','dispatch'].includes(args[0])?`${args[0]}-${args[1]}`:args[1];
    const handler=handlers[key];
    if(!handler)throw Error(`Unexpected fake Orca call: ${args.join(' ')}`);
    return handler(args);
  };
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),dispatches,terminals,launches,
    kill:dispatchId=>{dead.add(dispatchId);live.delete(dispatchId);const found=dispatches.get(dispatchId);if(found)terminals.delete(found.handle);}};
}

const acceptAll=()=>({ok:true,verdict:'accept',summary:'stub validator: accepted',findings:[],dropped:[],provider:'stub',usage:null});

/**
 * The engine is the real `createEngineRuntime` - the lease/candidate/settle custody under test - wrapped so
 * strategic model calls and machine checks answer synchronously instead of going through a detached durable
 * worker. `manageWorkflow` dispatches every offered op in snapshot order.
 */
function engineFixture({store,state,now}){
  const runtime=createEngineRuntime({store,state,now,eligibility:()=>({eligible:true}),
    spawnChild:()=>({pid:1,once(){},unref(){}})});
  return {...runtime,journal:runtime.journal,close:()=>runtime.close(),
    model:(name)=>name==='validateOp'?acceptAll():{ok:true,value:{option:'1'}},
    check:()=>({status:0,stdout:'ok',stderr:''}),
    manageWorkflow:snapshot=>({value:{orderedActionIds:(snapshot.actions??[]).filter(action=>action.type==='dispatch').map(action=>action.id),rationale:'fixture dispatch order'}})};
}

test('§11 restart proof: kill mid-op, delete and recreate the worktree, resume from the ledger alone',async t=>{
  await withLedger(t,({repoRoot,machine,ledgerFile,machineFile})=>{
    git(repoRoot,'init','-b','main');
    fs.writeFileSync(path.join(repoRoot,'README.md'),'fixture\n');
    git(repoRoot,'add','README.md');git(repoRoot,'-c','user.email=t@t','-c','user.name=t','commit','-m','init');

    const id='20261001-000000-restart';
    const branch='restart/lane-1';
    const lane=path.join(repoRoot,'..','lane-1');
    git(repoRoot,'worktree','add','-b',branch,lane,'main');

    const store=createStore({repoRoot,id});
    const state=createWorkflowState({job:'Two operations, one killed kernel',worktree:lane,branch,store,host:repoRoot,launcher:'L.mjs'});
    const plan={definitionOfDone:['both operations done'],
      ledger:[{id:'scope-1',title:'Scope',inputRef:'goal:job',status:'absent'}],
      ops:[
        {id:'op-1',kind:'backend.implement',goal:'First.',ledgerIds:['scope-1'],allowlist:['src/one/**'],references:[],
          checks:[],acceptance:['first done'],dependsOn:[]},
        {id:'op-2',kind:'backend.implement',goal:'Second.',ledgerIds:['scope-1'],allowlist:['src/two/**'],references:[],
          checks:[],acceptance:['second done'],dependsOn:['op-1']}
      ]};
    goalPhase(store,state,{assessGoal:()=>({ok:true,provider:'fake',value:plan}),
      critiqueGoal:()=>({ok:true,schema:'starci/goal-critique@1',verdict:'sound',objections:[],dropped:[],required:[],alternatives:[],question:null,provider:'stub-critic',attempt:0,attempts:[],usage:null}),
      renderGoalMarkdown:(value,{job:title})=>`# ${title}\n`,extractMaterial:()=>[],cwd:lane});
    approve(store,state);
    assert.equal(state.approved,true);

    const enrolled=enrollEngine(store,state,{ledgerFile,runtimePin:null,candidateRoot:path.join(repoRoot,'.starciwork','candidates'),now:()=>1});
    assert.equal(enrolled.generation,1);assert.equal(enrolled.ledgerFile,path.resolve(ledgerFile));

    const goals=inspectLedger({file:ledgerFile}).db.prepare('SELECT revision,goal_identity FROM goals WHERE workflow_id=?').all(id);
    assert.equal(goals.length,1,'the goal row exists in the ledger, not in a file');

    // ---- phase 1: goal approved, ops run; the kernel is killed while op-2 is in flight
    const reportDone=(summary)=>({outcome:'done',summary,files:[],checks:[],open:[],question:null,blocker:null});
    const orca1=scriptedLedgerOrca({store,scripts:{'op-1':[reportDone('op-1 complete')],'op-2':[]},worktree:lane});
    state.run='run_wf';state.from='term_kernel';
    const engine1=engineFixture({store,state,now:()=>Date.now()});
    runLoop(orca1.orca,store,state,{cwd:lane,allocator:fakeAllocator({maxParallelOps:1}),template:'contract',
      wait:noWait,exec:()=>({status:0,stdout:'ok',stderr:''}),git:spawnSync,
      engineRuntime:engine1,validateOp:acceptAll,maxIterations:12,waitTimeoutMs:1,tickMs:1,pollMs:1});
    engine1.close();

    assert.equal(state.ops.find(op=>op.id==='op-1').status,'done','op-1 finished before the kill');
    const op2=state.ops.find(op=>op.id==='op-2');
    assert.equal(op2.status,'running','op-2 is in flight at the kill');
    assert.ok(op2.lease?.jobId,'op-2 holds a durable lease at the kill');
    const killedDispatch=op2.dispatch,killedJob=op2.lease.jobId;

    // ---- kill: nothing but the ledger survives
    orca1.kill(killedDispatch);
    fs.rmSync(lane,{recursive:true,force:true});
    git(repoRoot,'worktree','prune');
    git(repoRoot,'worktree','add',lane,branch);
    assert.equal(fs.existsSync(path.join(repoRoot,'.starciwork','_local','workflows',id)),false,
      'the ledger owns the record: no _local/workflows/<id> was ever created');
    assert.equal(fs.existsSync(path.join(repoRoot,'.starciwork','_local')),false,'nothing under _local at all');

    // §12: the anchor lives in repoRoot's .starciwork, never in the worktree lane, so deleting and
    // recreating the lane cannot touch it - it is the tracked proof a re-clone of repoRoot would carry.
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),true,'the anchor survives the worktree delete/recreate');
    const survivedAnchor=readAnchor(repoRoot).workflows[id];
    assert.ok(survivedAnchor,'the anchor holds an entry for this workflow after the kill');
    assert.equal(survivedAnchor.generation,1,'anchored at the checkpoint generation bound at enrollment');

    // ---- phase 2: a new process: fresh store, fresh engine, state re-read from the ledger
    const store2=createStore({repoRoot,id});
    const resumed=store2.loadState();
    assert.ok(resumed,'the workflow reloads from the ledger alone');
    assert.equal(resumed.ops.find(op=>op.id==='op-1').status,'done','op-1 stays done across the restart');
    assert.equal(resumed.ops.find(op=>op.id==='op-2').status,'running','op-2 is still in flight until reconciled');
    resumed.run='run_wf';resumed.from='term_kernel';resumed.iterations=resumed.iterations??0;

    const orca2=scriptedLedgerOrca({store:store2,scripts:{'op-2':[reportDone('op-2 complete on retry')]},worktree:lane});
    orca2.kill(killedDispatch);   // the killed attempt's dispatch answers dead to the new kernel too
    const engine2=engineFixture({store:store2,state:resumed,now:()=>Date.now()});
    const settleCalls=[];
    const realSettle=engine2.settleStoppedOperation.bind(engine2);
    engine2.settleStoppedOperation=(op,input)=>{settleCalls.push({op:op.id,dispatch:input?.dispatch});return realSettle(op,input);};
    runLoop(orca2.orca,store2,resumed,{cwd:lane,allocator:fakeAllocator({maxParallelOps:1}),template:'contract',
      wait:noWait,exec:()=>({status:0,stdout:'ok',stderr:''}),git:spawnSync,
      engineRuntime:engine2,validateOp:acceptAll,maxIterations:12,waitTimeoutMs:1,tickMs:1,pollMs:1});
    engine2.close();

    assert.equal(resumed.ops.find(op=>op.id==='op-1').status,'done','op-1 stays done after resume');
    assert.equal(resumed.ops.find(op=>op.id==='op-2').status,'done','op-2 is reconciled and completes');
    assert.ok(settleCalls.some(call=>call.op==='op-2'&&call.dispatch===killedDispatch),
      'op-2 reconciles through settleStoppedOperation, not a silent reset');
    assert.equal(orca2.launches.filter(launch=>launch.op==='op-1').length,0,'op-1 is never relaunched');

    const ledger=openLedger({file:ledgerFile});
    try{
      const jobs=ledger.db.prepare('SELECT job_id,op_id,status FROM jobs WHERE workflow_id=? ORDER BY created_at').all(id);
      assert.ok(jobs.some(job=>job.op_id==='op-1'&&job.status==='succeeded'),'op-1 job settled succeeded');
      assert.ok(jobs.some(job=>job.op_id==='op-2'&&job.status!=='queued'&&job.status!=='running'&&job.status!=='leased'),
        'the killed op-2 attempt is terminally settled in the ledger');
      assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM leases WHERE workflow_id=?').get(id).n,0,'no live leases remain');
      assert.equal(ledger.verifyChain({workflowId:id}).ok,true,'the event hash chain verifies');
    }finally{ledger.close();}
    assert.equal(machine.db.prepare('SELECT count(*) AS n FROM leases').get().n,0,'the machine arbiter holds zero leases');
    assert.equal(fs.existsSync(path.join(repoRoot,'.starciwork','_local')),false,'resume still wrote nothing under _local');
  });
});

test('§5/§6 identity: a relocated ledger keeps its machine leases; a path rebuilt fresh does not inherit them',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-identity-'));
  const machineHome=path.join(root,'machine');fs.mkdirSync(machineHome,{recursive:true});
  const machineFile=machineFileFor({LOCALAPPDATA:machineHome});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));

  const machine=openMachine({file:machineFile});
  machine.setCapacity('ai/test',10);
  const job=(jobId,workflowId)=>({jobId,workflowId,kind:'model',generation:1});

  // ---- a ledger moved to another path (close, rename the bytes, reopen+register at the new path) keeps
  // its machine leases: `meta.ledger_id` travels with the bytes, so the machine sweep still recognizes them.
  const pathA=path.join(root,'a','runtime.sqlite'),pathB=path.join(root,'b','runtime.sqlite');
  let ledgerA=openLedger({file:pathA,machine});
  const idA=ledgerIdOf(ledgerA);
  const reservedA=reserveTwoPhase(ledgerA,machine,{job:job('job-a','wf-a'),machineNeeds:[{resourceKey:'ai/test',units:1}]});
  assert.equal(reservedA.ok,true,reservedA.reason);
  assert.equal(machine.db.prepare('SELECT count(*) AS n FROM leases').get().n,1,'the machine lease is taken');
  ledgerA.close();
  fs.mkdirSync(path.dirname(pathB),{recursive:true});
  fs.renameSync(pathA,pathB);
  const movedLedger=openLedger({file:pathB,machine});   // re-registers idA with the refreshed file=pathB
  assert.equal(ledgerIdOf(movedLedger),idA,'the identity moved with the bytes, unchanged by the path');
  assert.equal(machine.db.prepare('SELECT file FROM ledgers WHERE ledger_id=?').get(idA).file,fs.realpathSync(pathB));
  let swept=machine.sweep({inspectLedger,at:reservedA.expiresAt-1});
  assert.equal(swept.orphaned,0,'the relocated ledger still backs its lease, so nothing is orphaned');
  assert.equal(machine.db.prepare('SELECT count(*) AS n FROM leases').get().n,1,'the lease is kept across the move');
  movedLedger.close();

  // ---- a path rebuilt with a fresh ledger does not inherit the OLD registration at that same path: ledger
  // D takes a lease and is registered at pathD; the file is then replaced (not moved) by a brand new ledger
  // (fresh meta.ledger_id) without ever re-registering D at a new location. Per §5/§6 a registered ledger is
  // only trusted to prove its own leases gone when `meta.ledger_id` still matches at its registered file - a
  // path that now holds a *different* ledger proves the old one moved, never that its leases are live, so
  // sweep leaves D's lease alone (same as a path it cannot inspect at all) rather than crediting it to the
  // newcomer or silently dropping it. The newcomer starts, and stays, at zero.
  const pathD=path.join(root,'d','runtime.sqlite');
  const ledgerD=openLedger({file:pathD,machine});
  const idD=ledgerIdOf(ledgerD);
  const reservedD=reserveTwoPhase(ledgerD,machine,{job:job('job-d','wf-d'),machineNeeds:[{resourceKey:'ai/test',units:1}]});
  assert.equal(reservedD.ok,true,reservedD.reason);
  ledgerD.close();
  fs.rmSync(pathD);
  const freshE=openLedger({file:pathD,machine});   // rebuilt at D's old path: a fresh identity, D's registration untouched
  const idE=ledgerIdOf(freshE);
  assert.notEqual(idE,idD,'a rebuilt file at the same path is a different ledger, never the old one');
  assert.equal(machine.db.prepare('SELECT count(*) AS n FROM leases WHERE ledger_id=?').get(idE).n,0,
    'the fresh ledger inherits none of the old leases - it has never taken any of its own');
  swept=machine.sweep({inspectLedger,at:reservedD.expiresAt-1});
  assert.equal(swept.orphaned,0,'D\'s stale registration cannot be proven dead through a file that now answers as E');
  assert.equal(machine.db.prepare('SELECT count(*) AS n FROM leases WHERE ledger_id=?').get(idD).n,1,
    'D\'s lease is left exactly where it was - not transferred to E, not silently cleared, until its TTL passes');
  assert.equal(machine.db.prepare('SELECT count(*) AS n FROM leases WHERE ledger_id=?').get(idE).n,0,'still nothing for E');
  freshE.close();machine.close();
});
