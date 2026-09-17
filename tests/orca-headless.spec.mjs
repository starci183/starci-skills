import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';
import {DEFAULT_MAX_WALL_MS,HEADLESS_DISPATCH_ENV,HEADLESS_HOST,HEADLESS_ROOT_ENV,HOST_ENV,UNSUPPORTED_CALLS,createHeadlessHost,headlessPreamble,headlessRoot,providerFor,selectorPath} from '../hosts/headless/host.mjs';
import {ORCA_HOST} from '../hosts/orca/calls.mjs';
import {reportOutcome,waitTick} from '../hosts/orca/protocol.mjs';
import {observe} from '../hosts/orca/observe.mjs';
import {HOST_ADAPTERS,createHostRunner,hostAdapterOf,main,startOperation} from '../hosts/orca/launch.mjs';
import {inspectWorkflow,startKernel} from '../kernel/supervisor.mjs';
import {resolveExecutionChain} from '../kernel/chains.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-headless-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const readLines=file=>{try{return fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}};

/**
 * Child processes as the host sees them: a `spawn` that records the command line, the options and what was
 * written to stdin, a pid the injected `alive` answers for until the test ends the process, and a `kill` that
 * ends it the way `taskkill` would. Nothing here runs a provider.
 */
function fakeProcesses(){
  const spawned=[];const alive=new Set();let pid=4000;
  const spawn=(executable,args,options)=>{
    const child={pid:++pid,executable,args,options,input:'',events:[],stdin:{write(text){child.input+=text;},end(){child.events.push('stdin-end');}},on(event){child.events.push(event);},unref(){child.events.push('unref');}};
    alive.add(child.pid);spawned.push(child);
    return child;
  };
  return {spawn,spawned,alive:id=>alive.has(id),exit:child=>{alive.delete(child.pid);},kill:id=>{const was=alive.delete(id);return was;}};
}
const ids=input=>({run:/of run (\S+),/.exec(input)?.[1],task:/Task id: (\S+)\./.exec(input)?.[1],dispatch:/Dispatch id: (\S+)\./.exec(input)?.[1],terminal:/terminal handle: (\S+) /.exec(input)?.[1]});
function hostIn({root,cwd,processes=fakeProcesses(),now,sleep=()=>{},...rest}){
  return {processes,host:createHeadlessHost({cwd,root,calls,spawn:processes.spawn,alive:processes.alive,kill:processes.kill,sleep,now,env:{PATH:'x'},...rest})};
}
/** The host the child's own `report` builds: no root argument, only the environment the kernel gave the process. */
const childHost=(child,cwd)=>createHeadlessHost({cwd,calls,env:child.options.env});

test('the host declares itself: no capability, sequential, the same shape as the Orca runner',()=>{
  assert.deepEqual({...HEADLESS_HOST,capabilities:[...HEADLESS_HOST.capabilities]},{name:'headless',capabilities:[],sequential:true});
  assert.deepEqual({...ORCA_HOST,capabilities:[...ORCA_HOST.capabilities]},{name:'orca',capabilities:['design-tool'],sequential:false});
  assert.deepEqual(Object.keys(HEADLESS_HOST).sort(),Object.keys(ORCA_HOST).sort());
});

test('a managed-agent launch is one detached headless process: worker-start spawns it, check reads its report from the mailbox, ack settles the delivery',()=>{
  const base=tmp();
  try{
    const cwd=path.join(base,'worktree'),store=path.join(base,'store'),root=path.join(store,'headless');
    fs.mkdirSync(cwd,{recursive:true});
    const {host,processes}=hostIn({root,cwd});
    const created=host.invoke('run-create',{objective:'Workflow w: implement',from:'term_kernel'});
    assert.equal(created.outcome,'ok');assert.equal(created.effectState,'committed');
    const run=created.receipt.result.run.id;
    assert.match(run,/^run_h\d+$/);
    assert.equal(host.invoke('run-show',{id:run}).receipt.result.run.coordinator_handle,'term_kernel');
    const task=host.invoke('task-create',{run,from:'term_kernel',spec:'# Operation contract - `backend.implement` - op `op-a` - attempt 1\nDo the work.','display-name':'[Op] backend.implement - op-a','task-title':'backend.implement - op-a'});
    assert.equal(task.outcome,'ok');
    const taskId=task.receipt.result.task.id;
    assert.equal(task.receipt.result.task.display_name,'[Op] backend.implement - op-a');
    const started=host.invoke('worker-start',{task:taskId,worktree:`path:${cwd}`,agent:'claude',run,from:'term_kernel','display-name':'[Op] backend.implement - op-a','timeout-ms':120000});
    assert.equal(started.outcome,'ok',started.reason);
    assert.equal(started.effectState,'committed');
    const dispatch=started.receipt.result.dispatchId;
    assert.match(dispatch,/^ctx_h\d+$/);
    const handle=started.receipt.result.effects.find(effect=>effect.kind==='terminal').id;
    assert.match(handle,/^term_h\d+$/);
    // The process: the runtime's own headless command line, in the worktree, the contract on stdin, the host in its environment.
    assert.equal(processes.spawned.length,1);
    const child=processes.spawned[0];
    assert.equal(child.executable,'claude');
    // No model was asked for, so none is passed: the agent's own default, exactly as Orca's worker-start without --model.
    assert.deepEqual(child.args,['-p','--output-format','json']);
    assert.equal(child.options.cwd,cwd);
    assert.equal(child.options.detached,true);
    assert.equal(child.options.env[HOST_ENV],'headless');
    assert.equal(child.options.env[HEADLESS_ROOT_ENV],root);
    assert.equal(child.options.env[HEADLESS_DISPATCH_ENV],dispatch);
    assert.deepEqual(ids(child.input),{run,task:taskId,dispatch,terminal:handle});
    assert.match(child.input,/There is no `orca` command on this host/);
    assert.match(child.input,/Do the work\.\n$/);
    assert.ok(child.events.includes('stdin-end')&&child.events.includes('unref'));
    assert.ok(fs.existsSync(path.join(root,`${dispatch}.log`)));
    assert.equal(fs.readFileSync(path.join(root,`${dispatch}.prompt.md`),'utf8'),child.input);
    // The worker the launcher attests: the exact task, the agent and model it asked for, a live process.
    const shown=host.invoke('worker-show',{dispatch}).receipt.result;
    assert.equal(shown.dispatch.task_id,taskId);
    assert.equal(shown.worker.state,'running');
    assert.deepEqual(shown.worker.startOptions.launch.effective,{agent:'claude',model:null});
    assert.equal(shown.worker.agent_terminal_handle,handle);
    assert.equal(shown.observation.exactWorker,true);
    assert.equal(shown.terminal.worktreePath,cwd);
    assert.equal(host.invoke('terminal-rename',{terminal:handle,title:'[Op] backend.implement - op-a'}).outcome,'ok');
    assert.equal(host.invoke('worker-show',{dispatch}).receipt.result.terminal.title,'[Op] backend.implement - op-a');
    // The screen is the fact of the process: a live one reads as working, and the peeked heartbeat is its liveness.
    const read=host.invoke('terminal-read',{terminal:handle,screen:true}).receipt.result.terminal;
    assert.equal(read.status,'running');
    assert.equal(observe({screen:read.tail,terminal:read,now:Date.now()}).liveness,'working');
    const pings=host.invoke('check',{run,terminal:'term_kernel',peek:true,types:'heartbeat'}).receipt.result.messages;
    assert.equal(pings.length,1);
    assert.equal(JSON.parse(pings[0].payload).dispatchId,dispatch);
    // Nothing reported yet: a check that must not wait answers an empty batch and no delivery.
    const empty=host.invoke('check',{run,terminal:'term_kernel',types:'worker_done,question,escalation'}).receipt.result;
    assert.deepEqual(empty,{deliveryId:null,messages:[]});
    // The child reports through the launcher's own `report`, on a host built from nothing but its environment.
    const reported=reportOutcome(childHost(child,cwd),{cwd,run,from:handle,task:taskId,dispatch,outcome:'done',summary:'Done.',files:[],checks:[{name:'unit',command:'npx vitest run a',exitCode:0,evidence:'ok'}],workflow:'w1'});
    assert.equal(reported.ok,true,reported.reason);
    assert.match(reported.messageId,/^msg_h/);
    const mailbox=readLines(path.join(root,'mailbox.jsonl'));
    assert.equal(mailbox.length,1);
    assert.equal(mailbox[0].type,'worker_done');
    assert.equal(mailbox[0].run,run);
    assert.equal(JSON.parse(mailbox[0].payload).dispatchId,dispatch);
    processes.exit(child);
    // The blocking check returns the report with a delivery; an unacknowledged delivery is delivered again; an acked one is gone.
    const first=host.invoke('check',{run,terminal:'term_kernel',wait:true,'timeout-ms':'5000',types:'worker_done,question,escalation'});
    assert.equal(first.outcome,'ok');
    assert.equal(first.receipt.result.messages.length,1);
    assert.equal(first.receipt.result.messages[0].type,'worker_done');
    assert.match(first.receipt.result.deliveryId,/^delivery_h\d+$/);
    const again=host.invoke('check',{run,terminal:'term_kernel',types:'worker_done,question,escalation'}).receipt.result;
    assert.equal(again.messages.length,1,'an unacknowledged delivery is delivered again');
    const acked=host.invoke('check',{run,terminal:'term_kernel',ack:again.deliveryId,types:'worker_done,question,escalation'}).receipt.result;
    assert.deepEqual(acked.messages,[]);
    // The protocol's own tick reads the same host: the report file is a report, and the exited process reads as dead.
    const tick=waitTick(host,{cwd,run,from:'term_kernel',timeoutMs:1000,tickMs:1000,workflow:'w1',wait:()=>{}});
    assert.equal(tick.event,'report');
    assert.equal(tick.reports.length,1);
    assert.equal(tick.reports[0].dispatch,dispatch);
    assert.deepEqual(tick.liveness.map(item=>[item.dispatch,item.liveness]),[[dispatch,'dead']]);
    // Settlement: stop is idempotent on a gone process, release drops the row from the worker list.
    const stopped=host.invoke('worker-stop',{dispatch});
    assert.equal(stopped.outcome,'ok');
    assert.equal(stopped.receipt.result.alreadySettled,true);
    assert.equal(host.invoke('worker-release',{dispatch}).receipt.result.state,'released');
    assert.equal(host.invoke('worker-release',{dispatch}).receipt.result.state,'already_released');
    assert.deepEqual(host.invoke('worker-list',{run}).receipt.result.workers,[]);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('a dead pid is a dead worker: exited state, an exited terminal the observer reads as dead, a check that ends with the process, and no input reaches it',()=>{
  const base=tmp();
  try{
    const cwd=path.join(base,'worktree'),root=path.join(base,'headless');
    fs.mkdirSync(cwd,{recursive:true});
    // A clock that starts now: the dispatch log carries a real mtime, and the observer compares it with this clock.
    let at=Date.now();
    const slept=[];
    const {host,processes}=hostIn({root,cwd,now:()=>at,sleep:ms=>{slept.push(ms);at+=ms;}});
    const run=host.invoke('run-create',{objective:'w',from:'term_kernel'}).receipt.result.run.id;
    const taskId=host.invoke('task-create',{run,from:'term_kernel',spec:'op `op-b`','display-name':'[Op] x - op-b'}).receipt.result.task.id;
    const started=host.invoke('worker-start',{task:taskId,worktree:`path:${cwd}`,agent:'codex',model:'gpt-5.6-sol',run,from:'term_kernel'});
    const dispatch=started.receipt.result.dispatchId,handle=started.receipt.result.effects[0].id;
    assert.deepEqual(processes.spawned[0].args,['exec','--json','--model','gpt-5.6-sol']);
    // A check that waits ends when the process it watched ends, long before its timeout.
    const child=processes.spawned[0];
    const ending=createHeadlessHost({cwd,root,calls,spawn:processes.spawn,alive:processes.alive,kill:processes.kill,now:()=>at,env:{},sleep:ms=>{slept.push(ms);at+=ms;processes.exit(child);}});
    const waited=ending.invoke('check',{run,terminal:'term_kernel',wait:true,'timeout-ms':'60000',types:'worker_done'});
    assert.deepEqual(waited.receipt.result,{deliveryId:null,messages:[]});
    assert.equal(slept.length,1,'the wait ended at the first poll that found the process gone');
    const shown=host.invoke('worker-show',{dispatch}).receipt.result;
    assert.equal(shown.worker.state,'exited');
    assert.equal(shown.observation.status,'exited');
    const read=host.invoke('terminal-read',{terminal:handle,screen:true}).receipt.result.terminal;
    assert.equal(read.status,'exited');
    assert.equal(observe({screen:read.tail,terminal:read,now:at}).liveness,'dead');
    // The row stays until the kernel releases it, because the kernel settles only what it is shown.
    assert.deepEqual(host.invoke('worker-list',{run}).receipt.result.workers.map(row=>[row.dispatchId,row.workerState,row.dispatchStatus,row.alive]),[[dispatch,'unsupervised','dispatched',false]]);
    const sent=host.invoke('terminal-send',{terminal:handle,text:'continue',enter:true});
    assert.equal(sent.outcome,'failed');
    assert.equal(sent.effectState,'none');
    assert.match(sent.reason,/has exited/);
    // No heartbeat for a process that is gone, and none for one past its wall-time bound either.
    assert.deepEqual(host.invoke('check',{run,terminal:'term_kernel',peek:true,types:'heartbeat'}).receipt.result.messages,[]);
    const second=host.invoke('worker-start',{task:taskId,worktree:`path:${cwd}`,agent:'codex',model:'gpt-5.6-sol',run,from:'term_kernel'}).receipt.result;
    at+=DEFAULT_MAX_WALL_MS+1;
    assert.deepEqual(host.invoke('check',{run,terminal:'term_kernel',peek:true,types:'heartbeat'}).receipt.result.messages,[]);
    const stale=host.invoke('terminal-read',{terminal:second.effects[0].id,screen:true}).receipt.result.terminal;
    assert.equal(stale.status,'running');
    assert.match(stale.tail.join('\n'),/past the wall-time bound/);
    assert.equal(observe({screen:stale.tail,terminal:stale,now:at}).liveness,'stalled-silent');
    // Closing the terminal of a live process ends the process: the terminal is the process here.
    const closed=host.invoke('terminal-close',{terminal:second.effects[0].id});
    assert.equal(closed.receipt.result.processAction,'killed');
    assert.equal(processes.alive(processes.spawned[1].pid),false);
    assert.equal(host.invoke('worker-show',{dispatch:second.dispatchId}).receipt.result.worker.state,'stopped');
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('a run binds to the kernel handle that created it and re-binds on run-use; an unknown run is a failed read',()=>{
  const base=tmp();
  try{
    const {host}=hostIn({root:path.join(base,'h'),cwd:base});
    const run=host.invoke('run-create',{objective:'Workflow w',from:'term_a'}).receipt.result.run.id;
    assert.equal(host.invoke('run-show',{id:run}).receipt.result.run.coordinator_handle,'term_a');
    const rebound=host.invoke('run-use',{id:run,from:'term_b'});
    assert.equal(rebound.outcome,'ok');
    assert.equal(host.invoke('run-show',{id:run}).receipt.result.run.coordinator_handle,'term_b');
    const missing=host.invoke('run-show',{id:'run_nope'});
    assert.equal(missing.outcome,'failed');
    assert.equal(missing.effectState,'none');
    assert.match(missing.reason,/unknown run/);
    // The table survives a new host instance on the same root, which is what a restarted kernel is.
    const later=createHeadlessHost({cwd:base,root:path.join(base,'h'),calls,env:{}});
    assert.equal(later.invoke('run-show',{id:run}).receipt.result.run.coordinator_handle,'term_b');
    // A kernel terminal is a handle in the table, found again by title on the next start.
    const kernel=host.invoke('terminal-create',{worktree:`path:${base}`,title:'[Kernel] w',command:'bash'}).receipt.result.terminal.handle;
    assert.deepEqual(later.invoke('terminal-list',{}).receipt.result.terminals.map(item=>[item.handle,item.title,item.status]),[[kernel,'[Kernel] w','running']]);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('account list is unsupported with a reason, the budget probe reports it, and an undeclared call is still a contract violation',()=>{
  const base=tmp();
  try{
    const {host}=hostIn({root:path.join(base,'h'),cwd:base});
    assert.deepEqual([...UNSUPPORTED_CALLS],['account-list']);
    const result=host.invoke('account-list',{});
    assert.equal(result.outcome,'unsupported');
    assert.equal(result.effectState,'none');
    assert.match(result.reason,/no account list/);
    assert.deepEqual(host.probeBudget(),{ok:false,reason:result.reason});
    assert.throws(()=>host.invoke('coordinator-start',{}),/Unknown Orca call/);
    assert.throws(()=>host.invoke('check',{bogus:true}),/does not declare --bogus/);
    // Nothing was written for a read that could not be answered.
    assert.equal(fs.existsSync(path.join(base,'h')),false);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('a command terminal is a handle whose dispatch spawns the qwen headless command; a command with no headless line is a failed launch',()=>{
  const base=tmp();
  try{
    const cwd=path.join(base,'wt');fs.mkdirSync(cwd);
    const {host,processes}=hostIn({root:path.join(base,'h'),cwd});
    const run=host.invoke('run-create',{objective:'w',from:'term_kernel'}).receipt.result.run.id;
    const taskId=host.invoke('task-create',{run,from:'term_kernel',spec:'op `op-q`: draw nothing','display-name':'[Op] backend.implement - op-q'}).receipt.result.task.id;
    const command='Remove-Item Env:BAILIAN_TOKEN_PLAN_API_KEY -ErrorAction SilentlyContinue; qwen --model qwen3.8-flash --approval-mode yolo --exclude-tools agent';
    const handle=host.invoke('terminal-create',{worktree:`path:${cwd}`,title:'[Op] backend.implement - op-q',command}).receipt.result.terminal.handle;
    const ready=host.invoke('terminal-read',{terminal:handle,screen:true}).receipt.result.terminal.tail;
    assert.match(ready.join('\n'),/Type your message/);
    assert.equal(processes.spawned.length,0,'creating the handle runs nothing');
    const dispatched=host.invoke('dispatch',{task:taskId,to:handle,from:'term_kernel',run,'return-preamble':true});
    assert.equal(dispatched.outcome,'ok');
    const dispatch=dispatched.receipt.result.dispatch.id;
    assert.equal(dispatched.receipt.result.dispatch.task_id,taskId);
    assert.match(dispatched.receipt.result.preamble,/=== HEADLESS PREAMBLE ===[\s\S]*=== TASK ===\nop `op-q`: draw nothing/);
    assert.equal(processes.spawned.length,1);
    assert.equal(processes.spawned[0].executable,'qwen');
    assert.deepEqual(processes.spawned[0].args,['--model','qwen3.8-flash','--approval-mode','yolo','--output-format','json','--exclude-tools','agent']);
    assert.equal(processes.spawned[0].input,dispatched.receipt.result.preamble);
    // What the launcher checks next: the preamble is accepted, the screen shows activity and the model marker, the assignee is this handle.
    assert.equal(host.invoke('terminal-send',{terminal:handle,text:'@file preamble',enter:true}).outcome,'ok');
    const busy=host.invoke('terminal-read',{terminal:handle,screen:true}).receipt.result.terminal.tail.join('\n');
    assert.match(busy,/esc to cancel/);assert.match(busy,/qwen3\.8-flash/);
    assert.deepEqual(host.invoke('dispatch-show',{task:taskId}).receipt.result.dispatch,{id:dispatch,task_id:taskId,assignee_handle:handle,status:'dispatched'});
    assert.equal(host.invoke('dispatch',{task:taskId,to:handle,from:'term_kernel',run,'return-preamble':true}).outcome,'failed','one terminal carries one dispatch');
    const foreign=host.invoke('terminal-create',{worktree:`path:${cwd}`,title:'t',command:'qwen --model qwen3.9-unknown --approval-mode yolo'}).receipt.result.terminal.handle;
    const refused=host.invoke('dispatch',{task:taskId,to:foreign,from:'term_kernel',run,'return-preamble':true});
    assert.equal(refused.outcome,'failed');
    assert.equal(refused.effectState,'none');
    assert.match(refused.reason,/no headless command/);
    assert.equal(processes.spawned.length,1);
    const noAgent=host.invoke('worker-start',{task:taskId,worktree:`path:${cwd}`,agent:'gemini',run,from:'term_kernel'});
    assert.equal(noAgent.outcome,'failed');
    assert.match(noAgent.reason,/no headless command for agent gemini/);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('providerFor maps the launcher\'s agent and model, or a terminal command line, onto exactly one headless command',()=>{
  assert.deepEqual(providerFor({agent:'claude'}),{id:'claude-agent',family:'claude',executable:'claude',model:null,command:['claude','-p','--output-format','json']});
  assert.equal(providerFor({agent:'claude',model:'claude-fable-5-1'}).id,'claude-fable');
  assert.equal(providerFor({agent:'claude',model:'claude-fable-5-1'}).model,'claude-fable-5-1');
  assert.equal(providerFor({agent:'codex',model:'gpt-6-astra'}).id,'codex-agent~gpt-6-astra');
  assert.equal(providerFor({agent:'codex'}).id,'codex-agent');
  assert.equal(providerFor({command:'unset X; qwen --model qwen3.8-flash --approval-mode yolo'}).id,'qwen-agent');
  assert.deepEqual(providerFor({agent:'codex',model:'gpt-5.6-sol'}).command,['codex','exec','--json','--model','gpt-5.6-sol']);
  assert.equal(providerFor({agent:'codex',model:'gpt-9'}),null);
  assert.equal(providerFor({agent:'orca'}),null);
  assert.equal(providerFor({command:'devin --permission-mode accept-edits'}),null);
  assert.equal(providerFor({command:'powershell -NoLogo'}),null);
  // Every target the registry admits on the headless host has exactly one headless line. Orca-only targets
  // remain absent instead of being mapped to an invented local provider command.
  for(const op of ['backend.implement','architecture.decide','review.verify']){
    for(const candidate of resolveExecutionChain({skill:'starci',op}).candidates.filter(item=>item.executionHosts.includes('headless'))){
      const request=candidate.orcaLaunch.kind==='managed-agent'?{agent:candidate.orcaLaunch.agent,model:candidate.model}:{command:candidate.orcaLaunch.command};
      assert.ok(providerFor(request),`${op}: ${candidate.target} has no headless command`);
    }
  }
});

test('the real launcher drives a managed launch through the host end to end and attests the process it started',()=>{
  const base=tmp();
  // The launcher requires a filesystem-relative worktree; a repo-relative fixture path would leak
  // `orca-dispatch-ctx_*.md` artifacts into the real `fixtures/` tree, so the fixture lives outside the
  // runtime tree and `worktree` is its path relative to cwd. A relative path only exists between two paths
  // on one drive and os.tmpdir() is on another drive here, so the fixture goes to this drive's root.
  const suiteTemp=path.join(path.parse(process.cwd()).root,'starci-tmp');
  fs.mkdirSync(suiteTemp,{recursive:true});
  const wtRoot=fs.mkdtempSync(path.join(suiteTemp,'orca-headless-wt-'));
  try{
    const worktree=path.join(path.relative(process.cwd(),wtRoot),'agentos-r14-sales'),cwd=path.resolve(worktree);
    const {host,processes}=hostIn({root:path.join(base,'h'),cwd});
    const run=host.invoke('run-create',{objective:'w',from:'term_kernel'}).receipt.result.run.id;
    const candidate=resolveExecutionChain({skill:'starci',op:'architecture.decide'}).candidates[0];
    const launched=startOperation({run,workflowTask:'task_wf',from:'term_kernel',worktree,operation:'architecture.decide',scope:'op-d',spec:'# Operation contract - `architecture.decide` - op `op-d`\nDecide.'},{orca:host,wait:()=>{},candidates:[candidate]});
    assert.equal(launched.ok,true,launched.stopReason);
    assert.equal(launched.attestation.agent,candidate.orcaLaunch.agent);
    // The model the host reports is the one it launched: the candidate's when it names one, else none (the agent default).
    assert.equal(launched.attestation.model,providerFor({agent:candidate.orcaLaunch.agent,model:candidate.model}).model);
    assert.equal(launched.attestation.terminalTitle.canonical,true);
    assert.equal(processes.spawned.length,1);
    assert.equal(processes.spawned[0].options.cwd,cwd);
    assert.equal(ids(processes.spawned[0].input).dispatch,launched.dispatchId);
    assert.equal(host.invoke('worker-show',{dispatch:launched.dispatchId}).receipt.result.terminal.title,'[Op] architecture.decide - op-d');
  }finally{fs.rmSync(base,{recursive:true,force:true});fs.rmSync(wtRoot,{recursive:true,force:true});}
});

test('lane worktrees are git worktrees: create, set, show and rm, with the branch preserved',()=>{
  const base=tmp();
  try{
    const repo=path.join(base,'repo');fs.mkdirSync(repo);
    const git=args=>{const result=spawnSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
    git(['init','-q','-b','main']);git(['config','user.email','t@t']);git(['config','user.name','t']);
    fs.writeFileSync(path.join(repo,'a.txt'),'a\n');git(['add','a.txt']);git(['commit','-q','-m','init']);
    const {host}=hostIn({root:path.join(base,'h'),cwd:repo});
    const created=host.invoke('worktree-create',{repo:`path:${repo}`,name:'lane-1','base-branch':'main',setup:'skip','no-parent':true});
    assert.equal(created.outcome,'ok',created.reason);
    const row=created.receipt.result.worktree;
    assert.equal(row.path,path.join(repo,'.worktrees','lanes','lane-1'));
    assert.equal(row.branch,'refs/heads/workflow/lane-1');
    assert.ok(fs.existsSync(path.join(row.path,'a.txt')));
    assert.equal(host.invoke('worktree-create',{repo:`path:${repo}`,name:'lane-1','base-branch':'main'}).outcome,'failed','a lane name is taken once');
    assert.equal(host.invoke('worktree-set',{worktree:`path:${row.path}`,'display-name':'[Workflow] w','workspace-status':'in-progress'}).outcome,'ok');
    const shown=host.invoke('worktree-show',{worktree:`id:${row.id}`}).receipt.result.worktree;
    assert.equal(shown.branch,'workflow/lane-1');
    assert.equal(shown.displayName,'[Workflow] w');
    assert.equal(shown.workspaceStatus,'in-progress');
    const removed=host.invoke('worktree-rm',{worktree:`path:${row.path}`,force:true});
    assert.equal(removed.outcome,'ok',removed.reason);
    assert.equal(removed.receipt.result.preservedBranch,'refs/heads/workflow/lane-1');
    assert.equal(fs.existsSync(row.path),false);
    assert.equal(git(['branch','--list','workflow/lane-1']).includes('workflow/lane-1'),true);
    assert.equal(selectorPath('id:headless::/x/y'),path.resolve('/x/y'));
    assert.equal(selectorPath('path:/x/y'),path.resolve('/x/y'));
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('agent-context is the contract itself, so verify passes on the headless host and the launcher selects it by flag or environment',()=>{
  const base=tmp();
  try{
    const {host}=hostIn({root:path.join(base,'h'),cwd:base});
    const verified=host.verify();
    assert.equal(verified.ok,true,verified.errors.join('; '));
    assert.equal(verified.commandCount,Object.keys(calls.calls).length);
    assert.equal(host.invoke('status',{}).receipt.result.runtime.state,'headless');
    assert.deepEqual([...HOST_ADAPTERS],['orca','headless']);
    assert.equal(hostAdapterOf({},{}),'orca');
    assert.equal(hostAdapterOf({},{[HOST_ENV]:'headless'}),'headless');
    assert.equal(hostAdapterOf({'host-adapter':'headless'},{}),'headless');
    assert.equal(hostAdapterOf({'host-adapter':'orca'},{[HOST_ENV]:'headless'}),'orca','the flag wins over the environment');
    assert.throws(()=>hostAdapterOf({'host-adapter':'cloud'},{}),/--host-adapter must be one of orca, headless/);
    assert.equal(createHostRunner({adapter:'headless',cwd:base,env:{}}).host.name,'headless');
    assert.equal(createHostRunner({adapter:'orca'}).host.name,'orca');
    const cli=main(['verify','--host-adapter','headless'],{env:{}});
    assert.equal(cli.ok,true,cli.errors?.join('; '));
    assert.equal(cli.commandCount,Object.keys(calls.calls).length);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('the root follows the store, then the environment the kernel gave the child, then the reports directory, then the repository',()=>{
  const cwd=path.resolve('fixtures/orca/agentos-r14-sales');
  assert.equal(headlessRoot({cwd,storeDir:'/s/w'}),path.join(path.resolve('/s/w'),'headless'));
  assert.equal(headlessRoot({cwd,env:{[HEADLESS_ROOT_ENV]:'/env/root'}}),path.resolve('/env/root'));
  assert.equal(headlessRoot({cwd,env:{},reportsDir:'/s/w/reports'}),path.join(path.resolve('/s/w'),'headless'));
  assert.equal(headlessRoot({cwd,root:'/explicit'}),path.resolve('/explicit'));
  // The lane-opened-at-goal-time fallback is a kernel-owned corner beside the ledger now, not `_local`,
  // which 1.0.4 retires (docs/ledger-db.md §13). It sits alongside `kernel-evidence/`, and `core/index.mjs`
  // excludes it from Work validation for the same reason.
  assert.ok(headlessRoot({cwd,env:{}}).endsWith(path.join('.starciwork','kernel-headless')));
  const base=tmp();
  try{
    const host=createHeadlessHost({cwd:base,calls,env:{}});
    assert.equal(host.bindStore(path.join(base,'store')),path.join(base,'store','headless'));
    assert.equal(host.root(),path.join(base,'store','headless'));
    assert.match(headlessPreamble({run:'run_h1',task:'task_h2',dispatch:'ctx_h3',terminal:'term_h4',displayName:'[Op] x - y',provider:'claude-opus'}),/Task id: task_h2\. Dispatch id: ctx_h3\. Your terminal handle: term_h4 /);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('the supervisor starts the next kernel of a headless workflow on the headless host',()=>{
  const base=tmp();
  try{
    // inspectWorkflow no longer reads a workflow directory off disk (there is none, under the ledger) - the
    // caller loads the state the way the real supervisor loop does, via listWorkflows(repoRoot) -> {id, dir:
    // null, state, updatedAt}, and hands it the loaded state directly instead of a dir to read state.json from.
    const state={schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id:'w1',approved:true,finished:null,worktree:base,host:'H',hostAdapter:'headless'};
    const info=inspectWorkflow({id:'w1',dir:null,state},{now:()=>2});
    assert.equal(info.hostAdapter,'headless');
    const spawned=[];
    startKernel(info,{launcher:'L.mjs',spawnFn:(exe,args)=>{spawned.push(args);return {pid:1,unref(){}};}});
    assert.deepEqual(spawned[0].slice(-2),['--host-adapter','headless']);
    // A workflow that never recorded a host is started as before: on Orca, with no flag.
    const {hostAdapter:_omit,...withoutHostAdapter}=state;
    const plain=inspectWorkflow({id:'w1',dir:null,state:withoutHostAdapter},{now:()=>2});
    assert.equal(plain.hostAdapter,null);
    startKernel(plain,{launcher:'L.mjs',spawnFn:(exe,args)=>{spawned.push(args);return {pid:1,unref(){}};}});
    assert.equal(spawned[1].includes('--host-adapter'),false);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
