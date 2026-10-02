import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {findHostBoundaryViolations} from '../../scripts/checks/check-host-boundary.mjs';
import {spawnAgent,startAgent} from '../../scripts/agent/lib.mjs';
import {pathToFileURL} from 'node:url';

// Every agent launch goes through orchestration worker-start (modules/kernel/contract-changes/
// launch-through-worker-start.yaml): the Kernel, the [Supervisor], every [Worker] and every [Op]. This spec fails when
// any launch bypasses it - statically (runtime code that creates a terminal, a contract call that could) and on the
// wire (a dispatch or a Kernel boot whose Orca call log holds a terminal create or an orchestration dispatch).

process.env.STARCI_SLEEP_SCALE??='0.02';
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const readYaml=rel=>parseYaml(fs.readFileSync(path.join(ROOT,rel),'utf8'));
const BYPASS=['terminal create','orchestration dispatch'];

/* ------------------------------------------------------------ static law */

test('no runtime code creates an agent terminal (check-host-boundary agent-launch)',()=>{
  const found=findHostBoundaryViolations({root:ROOT}).violations.filter(v=>v.rule==='agent-launch');
  assert.deepEqual(found,[],'every agent launch is scripts/api/orca/worker-start.mjs');
});

test('the agent-launch rule flags every terminal-creating form and nothing else',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-launch-rule-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),text);};
  write('scripts/bad.mjs',[
    "import { terminalCreate } from '../api/orca/terminal-create.mjs';",
    "const r = orcaCall('terminal-create', { title });",
    "orcaRun(['terminal', 'create', '--title', t]);",
    'const cmd = `orca terminal create --worktree ${w}`;',
  ].join('\n'));
  write('scripts/api/orca/wrapper.mjs',"export const make = () => orcaRun(['terminal','create']);\n");
  write('scripts/good.mjs',[
    '// a terminal create here would bypass worker-start',
    ' * orca terminal create is forbidden',
    "const why = 'a terminal created before the Orca update refuses writes';",
    "const idle = 'whatever created a bare shell terminal and never closed it';",
    "workerStart({ task, worktree, agent: 'claude' });",
  ].join('\n'));
  write('scripts/shell.mjs',"orcaRun(['terminal','create','--title','[Shell] probe']);\n");
  write('scripts/checks/host-boundary.allow','scripts/shell.mjs:1  # a plain non-agent shell (reviewed)\n');
  const found=findHostBoundaryViolations({root}).violations.filter(v=>v.rule==='agent-launch').map(v=>v.where).sort();
  assert.deepEqual(found,['scripts/api/orca/wrapper.mjs:1','scripts/bad.mjs:1','scripts/bad.mjs:2','scripts/bad.mjs:3','scripts/bad.mjs:4','scripts/shell.mjs:1']);
});

test('the Orca contract carries no terminal-creating call and forbids it for the runtime',()=>{
  const calls=readYaml('modules/host/orca/calls.yaml').calls;
  assert.equal(calls['terminal-create'],undefined,'no terminal-create call');
  assert.equal(calls.dispatch,undefined,'no orchestration dispatch into a pre-made terminal');
  assert.equal(calls['worker-start'].flags.includes('terminal'),false,'worker-start never adopts a terminal');
  assert.equal(calls['task-create'],undefined,'worker-start --spec files the Task: there is no task-create call');
  assert.equal(calls['dispatch-show'],undefined,'the agent terminal comes from the start receipt or worker-show: no dispatch-show');
  for(const gone of ['parent','task','retry-of'])assert.equal(calls['worker-start'].flags.includes(gone),false,`worker-start never passes --${gone}`);
  assert.ok(calls['worker-start'].required.includes('spec'),'every start files its Task from --spec');
  assert.ok(calls['worker-start'].required.includes('agent'),'worker-start always names the agent it launches');
  const api=readYaml('modules/host/orca/api.yaml');
  for(const command of BYPASS)assert.ok(api.forbiddenForStarciOrchestration.includes(command),`${command} is forbidden`);
  assert.equal(api.roleCommands?.workflowKernel?.includes('terminal create')??false,false);
  // The wrapper lib builds every argv from calls.yaml: neither a terminal-create call nor a --terminal adoption can be built.
  const refusals=spawnSync(process.execPath,['--input-type=module','-e',
    `import {orcaCall} from ${JSON.stringify(pathToFileURL(path.join(ROOT,'scripts','api','orca','lib.mjs')).href)};`+
    "const t=f=>{try{f();return null;}catch(e){return e.message;}};"+
    "console.log(JSON.stringify([t(()=>orcaCall('terminal-create',{title:'x',command:'claude'})),"+
    "t(()=>orcaCall('worker-start',{spec:'s',worktree:'w',agent:'claude',run:'r',terminal:'term-1'},{request:{job:'j'}}))]));"],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,env:{...process.env,STARCI_ORCA_COMMAND:'orca-must-not-run'}});
  const [createRefused,adoptRefused]=json(refusals.stdout.trim())??[];
  assert.match(createRefused??'',/terminal-create/,refusals.stderr);
  assert.match(adoptRefused??'',/--terminal is not a flag/,refusals.stderr);
});

test('every profile and registry target launches through worker-start --agent <card>',()=>{
  const cards=fs.readdirSync(path.join(ROOT,'modules','models','agents')).map(f=>f.replace(/\.yaml$/,''));
  for(const name of cards){
    const card=readYaml(`modules/models/agents/${name}.yaml`);
    assert.equal(card.start?.api,'orchestration.worker-start',`${name}: start is worker-start`);
    for(const gone of ['terminalFallback','hostLaunchPrefix','commandPrefix','commandRequirements'])
      assert.equal(card[gone],undefined,`${name}: no hand-built launch command (${gone})`);
  }
  for(const f of fs.readdirSync(path.join(ROOT,'modules','models','profiles'))){
    const orca=readYaml(`modules/models/profiles/${f}`).launch?.orca;
    assert.deepEqual(Object.keys(orca??{}),['agent'],`${f}: launch.orca is {agent}`);
    assert.ok(cards.includes(orca.agent),`${f}: ${orca.agent} is an agent card`);
  }
  for(const [name,target] of Object.entries(readYaml('modules/models/registry.yaml').targets))
    assert.deepEqual(Object.keys(target.orcaLaunch??{}),['agent'],`registry ${name}: orcaLaunch is {agent}`);
});

/* ------------------------------------------------------------ spawnAgent / startAgent */

// Orca seams: every host call is recorded; nothing reaches a real host or the owner's trust files.
const seams=({start=null,show=null,handle='term_1'}={})=>{
  const calls=[];
  const rec=(name,fn)=>(args)=>{calls.push([name,args]);return fn(args);};
  const io={
    trust:rec('trust',()=>({status:'ok',paths:[]})),
    start:rec('start',start??(({agent,model,run})=>({ok:true,outcome:'ok',effectState:'committed',dispatchId:'ctx_1',taskId:`task_${run}`,agentTerminalHandle:handle,state:'ready',agent,model}))),
    rename:rec('rename',()=>({ok:true})),
    show:rec('show',show??(()=>({ok:true,state:'ready',dispatch:{id:'ctx_1',assigneeHandle:'term_shown'},
      effective:{agent:calls.find(c=>c[0]==='start')[1].agent,model:calls.find(c=>c[0]==='start')[1].model??null}}))),
    stop:rec('stop',()=>({ok:true})),
    release:rec('release',()=>({ok:true})),
  };
  return {io,calls,names:()=>calls.map(c=>c[0])};
};

test('spawnAgent starts the routed agent with its spec through worker-start, takes the terminal from the receipt, names it and attests it',()=>{
  const s=seams();
  const created=[];
  const r=spawnAgent({provider:'claude',model:'claude-opus-5-5',effort:'high',worktree:'w',title:'[Op] x',spec:'do x',taskTitle:'x.op #1',run:'run_1',from:'term_k',
    request:{job:'j1',lease:'l1'},onCreated:(h,d)=>created.push([h,d]),io:s.io});
  assert.equal(r.ok,true,JSON.stringify(r));
  assert.deepEqual(s.names(),['trust','start','show','rename'],'no task-create and no dispatch-show');
  const start=s.calls.find(c=>c[0]==='start')[1];
  assert.deepEqual({agent:start.agent,model:start.model,effort:start.effort,spec:start.spec,taskTitle:start.taskTitle,run:start.run,from:start.from,worktree:start.worktree},
    {agent:'claude',model:'claude-opus-5-5',effort:'high',spec:'do x',taskTitle:'x.op #1',run:'run_1',from:'term_k',worktree:'w'});
  assert.deepEqual(start.request,{job:'j1',lease:'l1',run:'run_1',agent:'claude',model:'claude-opus-5-5'},'the start identity is the ledger identity plus the Run, agent and model');
  assert.equal(start.task,undefined,'a start never names an existing Task');
  assert.equal(start.terminal,undefined,'no terminal is ever handed to worker-start');
  assert.deepEqual([r.terminal,r.dispatchId,r.taskId,r.titleApplied],['term_1','ctx_1','task_run_1',true]);
  assert.deepEqual(created,[['term_1','ctx_1']],'the handle is recorded the moment the receipt names it');
});

test('a start receipt without the agent terminal takes it from worker-show; neither is a typed refusal that cleans the worker',()=>{
  const s=seams({handle:null});
  const r=spawnAgent({provider:'claude',model:'claude-opus-5-5',worktree:'w',title:'[Op] x',spec:'s',run:'run_1',request:{job:'j'},io:s.io});
  assert.equal(r.ok,true,JSON.stringify(r));
  assert.equal(r.terminal,'term_shown');
  const none=seams({handle:null,show:()=>({ok:true,state:'ready',dispatch:{id:'ctx_1'},effective:{agent:'claude',model:'claude-opus-5-5'}})});
  const n=spawnAgent({provider:'claude',model:'claude-opus-5-5',worktree:'w',title:'[Op] x',spec:'s',run:'run_1',request:{job:'j'},io:none.io});
  assert.deepEqual([n.ok,n.step,n.code,n.effectState],[false,'worker-show','worker-terminal-unknown','none']);
  assert.ok(none.names().includes('stop')&&none.names().includes('release'),'the nameless worker is stopped and released');
  const noTask=seams({start:({agent,model})=>({ok:true,outcome:'ok',effectState:'committed',dispatchId:'ctx_1',taskId:null,agentTerminalHandle:'term_1',agent,model})});
  const t=spawnAgent({provider:'claude',model:'claude-opus-5-5',worktree:'w',title:'[Op] x',spec:'s',run:'run_1',request:{job:'j'},io:noTask.io});
  assert.deepEqual([t.ok,t.step,t.code],[false,'worker-start','worker-start-no-task']);
});

test('a card that takes no model flag starts without --model/--effort and is attested on its agent alone',()=>{
  const s=seams({show:()=>({ok:true,state:'ready',effective:{agent:'devin',model:null}})});
  const r=spawnAgent({provider:'devin',model:'swe-2-max',effort:'high',worktree:'w',title:'[Op] x',spec:'s',run:'run_1',request:{job:'j'},io:s.io});
  assert.equal(r.ok,true,JSON.stringify(r));
  const start=s.calls.find(c=>c[0]==='start')[1];
  assert.equal(start.agent,'devin');
  assert.equal(start.model,undefined,'devin takes no --model on worker-start');
  assert.equal(start.effort,undefined,'--effort requires --model');
});

test('an attestation mismatch fences and releases the worker it started and never reports it live',()=>{
  const s=seams({show:()=>({ok:true,state:'ready',effective:{agent:'claude',model:'claude-sonnet-5'}})});
  const r=spawnAgent({provider:'claude',model:'claude-opus-5-5',worktree:'w',title:'t',spec:'s',run:'run_1',request:{job:'j'},io:s.io});
  assert.equal(r.ok,false);
  assert.equal(r.step,'attestation');
  assert.ok(s.names().includes('stop')&&s.names().includes('release'),'the mismatched worker is stopped and released');
  assert.equal(r.effectState,'none','a proven release leaves no effect');
});

test('a start refused before any effect is not cleaned; an unknown effect is left fenced while worker-show says live',()=>{
  const refused=seams({start:()=>({ok:false,outcome:'failed',effectState:'none',dispatchId:null,error:'worker_start_failed'})});
  const a=spawnAgent({provider:'claude',model:'m',worktree:'w',title:'t',spec:'s',run:'r',request:{job:'j'},io:refused.io});
  assert.deepEqual([a.ok,a.step,a.effectState],[false,'worker-start','none']);
  assert.equal(refused.names().some(n=>['stop','release','show'].includes(n)),false);
  const unknown=seams({start:()=>({ok:false,outcome:'unknown',effectState:'unknown',dispatchId:'ctx_9'}),show:()=>({ok:true,state:'ready'})});
  const b=spawnAgent({provider:'claude',model:'m',worktree:'w',title:'t',spec:'s',run:'r',request:{job:'j'},io:unknown.io});
  assert.deepEqual([b.ok,b.effectState],[false,'unknown']);
  assert.equal(unknown.names().includes('stop'),false,'absence of exit proof never authorizes a stop');
});

test('startAgent reuses the prior Run while Orca knows it and takes the start, else opens a fresh Run',()=>{
  const run=(priorKnown,priorAccepts)=>{
    const log=[];
    const spawn=seams({start:({run,agent,model})=>(log.push(`worker-start:${run}`),run==='run_old'&&!priorAccepts
      ?{ok:false,outcome:'failed',effectState:'none',dispatchId:null,errorCode:'not_run_coordinator',error:'not_run_coordinator'}
      :{ok:true,outcome:'ok',effectState:'committed',dispatchId:'ctx_1',taskId:`task_${run}`,agentTerminalHandle:'term_1',agent,model})});
    const io={
      runShow:()=>(log.push('run-show'),{ok:priorKnown}),
      runCreate:({from,request})=>(log.push(`run-create:${from??'-'}`),{ok:true,runId:'run_new',request}),
      spawn:spawn.io,
    };
    const r=startAgent({provider:'claude',model:'claude-opus-5-5',worktree:'w',title:'[Kernel] wf',prompt:'boot',objective:'o',entry:'term_owner',priorRunId:'run_old',
      request:{workflow:'wf',kernelAttempt:2,reservation:'tok'},io});
    return {r,log,spawn};
  };
  const reused=run(true,true);
  assert.deepEqual(reused.log,['run-show','worker-start:run_old']);
  assert.deepEqual([reused.r.ok,reused.r.runId,reused.r.taskId],[true,'run_old','task_run_old']);
  const fenced=run(true,false);
  assert.deepEqual(fenced.log,['run-show','worker-start:run_old','run-create:term_owner','worker-start:run_new']);
  assert.equal(fenced.r.runId,'run_new');
  const starts=fenced.spawn.calls.filter(c=>c[0]==='start').map(c=>c[1].request.run);
  assert.deepEqual(starts,['run_old','run_new'],'each Run gets its own start identity, so the refused start is never replayed');
  const lost=run(false,true);
  assert.deepEqual(lost.log,['run-show','run-create:term_owner','worker-start:run_new']);
  assert.throws(()=>startAgent({provider:'claude',worktree:'w',title:'t',prompt:'p',objective:'o',io:{}}),/needs request/);
});

/* ------------------------------------------------------------ on the wire */

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-launch-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const saved=process.env.STARCI_PROJECTS_ROOT;
  process.env.STARCI_PROJECTS_ROOT=path.join(root,'projects');
  t.after(()=>{if(saved===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=saved;});
  const repo=path.join(root,'repo');fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot,{recursive:true});
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8')
    .replace(/^kernel:.*$/m,'kernel: {agent: codex, model: gpt-6-sol, effort: high}'));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:ownerRoot,LOCALAPPDATA:path.join(root,'localappdata'),STARCI_PROJECTS_ROOT:path.join(root,'projects'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),USERPROFILE:path.join(root,'home'),HOME:path.join(root,'home'),
    CODEX_HOME:path.join(root,'home','.codex'),ORCA_TERMINAL_HANDLE:''};
  fs.mkdirSync(path.join(root,'home'),{recursive:true});
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const callArgv=()=>fs.existsSync(env.STARCI_FAKE_ORCA_LOG)
    ?fs.readFileSync(env.STARCI_FAKE_ORCA_LOG,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv):[];
  const calls=()=>callArgv().map(argv=>argv.slice(0,2).join(' '));
  return {repo,env,run,calls,callArgv};
};

const seedOp=(fx,{jobId,model})=>{
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.ensureWorkflow({workflowId:'wf-launch'});
    ledger.write.enqueueJob({jobId:'kernel-wf-launch',workflowId:'wf-launch',kind:'kernel',role:'kernel',status:'running',unitId:null,
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6-sol'},hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:'agent:kernel:wf-launch',parentNodeId:'workflow:wf-launch',role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-launch'").run();
    ledger.write.createUnit({workflowId:'wf-launch',unitId:jobId,opId:'code.refactor',subjectKey:jobId,goalRevision:1});
    ledger.write.enqueueJob({jobId,workflowId:'wf-launch',opId:'code.refactor',kind:'op',status:'queued',unitId:jobId,
      payload:{opId:'code.refactor',owned_paths:['docs/'],model,difficulty:'hard'}});
  }finally{ledger.close();}
};

for(const [model,agent,takesModel] of [['claude-agent','claude',true],['codex-agent','codex',true],['devin-agent','devin',false]]){
  test(`api dispatch --spawn launches a ${model} op through worker-start --agent ${agent}, never a terminal create`,t=>{
    const fx=fixture(t);
    const jobId=`job-${agent}`;
    seedOp(fx,{jobId,model});
    const r=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model',model,'--spawn','--json');
    assert.equal(r.status,0,`dispatch failed: ${r.stderr||r.stdout}`);
    const seen=fx.calls();
    for(const bypass of BYPASS)assert.equal(seen.includes(bypass),false,`${model} launched with ${bypass}: ${seen.join(', ')}`);
    const starts=fx.callArgv().filter(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
    assert.equal(starts.length,1,'exactly one worker-start per launch');
    const start=starts[0];
    assert.equal(start[start.indexOf('--agent')+1],agent);
    assert.equal(start.includes('--terminal'),false);
    assert.equal(start.includes('--model'),takesModel,`${agent} ${takesModel?'pins':'takes no'} --model`);
    // The nested Run rule (Orca's sub-dispatch shape): the Kernel binds its OWN workflow Run, files the op Task there
    // with no --parent (Orca takes a parent only from the same Run) and starts the op from its terminal.
    const argvOf=(verb)=>fx.callArgv().filter(argv=>argv.slice(0,2).join(' ')===verb);
    const flag=(argv,name)=>argv.includes(name)?argv[argv.indexOf(name)+1]:null;
    const [runCreate]=argvOf('orchestration run-create');
    assert.equal(flag(runCreate,'--from'),'fake-kernel-terminal','the workflow Run is created from the Kernel terminal, its coordinator');
    assert.deepEqual(argvOf('orchestration task-create'),[],'worker-start --spec files the op Task: no task-create');
    assert.equal(start.includes('--parent'),false,'an op Task never names a --parent');
    assert.equal(start.includes('--task'),false,'a start never names an existing Task');
    assert.ok(flag(start,'--spec'),'the rendered packet rides on --spec');
    assert.equal(flag(start,'--task-title'),'code.refactor #1');
    assert.match(flag(start,'--retry-request')??'',/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,'the start carries its request id from the first issue');
    assert.equal(flag(start,'--from'),'fake-kernel-terminal','the op is started from the Kernel terminal');
    assert.equal(flag(start,'--run'),flag(runCreate,'--run')??'run-fake-1');
    const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
    try{
      const job=ledger.db.prepare('SELECT status,worker_id FROM jobs WHERE job_id=?').get(jobId);
      assert.deepEqual([job.status,job.worker_id],['running','dispatch-fake-1'],'the op runs as a worker, keyed by its Dispatch');
    }finally{ledger.close();}
  });
}

test('the Kernel boots as a worker of its own entry Run through worker-start, never a terminal create',t=>{
  const fx=fixture(t);
  const goal=fx.run(DEFINE_GOAL,'--repo',fx.repo,'--text','launch through worker-start','--json');
  assert.equal(goal.status,0,goal.stderr);
  const workflowId=json(goal.stdout).workflowId;
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(r.status,0,`kernel boot failed: ${r.stderr||r.stdout}`);
  const out=json(r.stdout);
  assert.equal(out.launch,'worker');
  assert.equal(out.dispatch,'dispatch-fake-1');
  const seen=fx.calls();
  for(const bypass of BYPASS)assert.equal(seen.includes(bypass),false,`the Kernel launched with ${bypass}: ${seen.join(', ')}`);
  const order=['orchestration run-create','orchestration worker-start','orchestration worker-show'];
  assert.deepEqual(seen.filter(c=>order.includes(c)),order,'entry Run -> worker-start --spec (the Kernel Task) -> attestation');
  assert.equal(seen.includes('orchestration task-create')||seen.includes('orchestration dispatch-show'),false);
  const start=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.deepEqual([start[start.indexOf('--agent')+1],start[start.indexOf('--model')+1],start[start.indexOf('--effort')+1]],['codex','gpt-6-sol','high']);
  const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
  try{
    const seat=json(ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId).value_json);
    assert.deepEqual([seat.launch,seat.dispatch,seat.terminal],['worker','dispatch-fake-1','fake-terminal-1']);
    const managed=json(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`).payload_json).managed;
    assert.deepEqual([managed.dispatchId,managed.agentTerminalHandle],['dispatch-fake-1','fake-terminal-1']);
  }finally{ledger.close();}
  // A second start while the worker is live never launches a second Kernel.
  const again=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(again.status,0,again.stderr);
  assert.equal(json(again.stdout).replaced,false);
  assert.equal(fx.calls().filter(c=>c==='orchestration worker-start').length,1);
});
