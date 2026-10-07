import test,{describe} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';
import {fakeOrcaWorktrees} from '../helpers/fake-orca-worktrees.mjs';
import {placeOnRepo} from '../helpers/op-placement.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor,startAttempt,writeContract,setJobStatus,updateAttempt,recordJobResult,fileReport} from '../../engine/db/ledger.mjs';
import { admitPacket, captureDispatchInputs, selectDispatchContract } from '../../scripts/kernel/dispatch-admission.mjs';
import {openMachine,openMachineReader} from '../../engine/db/machine.mjs';
process.env.STARCI_SLEEP_SCALE??='0.02';
import {jobRowOf} from '../../scripts/kernel/verbs/shared/rows.mjs';
import {writeGreenProofs,proofRepo} from '../helpers/sonar-scan.mjs';
import {buildContext} from '../../scripts/context/pack.mjs';
import { senderEnv } from '../helpers/sender-env.mjs';

// Build the workflow and logical unit required by the current ledger before
// exercising dispatch. Each fixture op job represents a distinct unit.
const grantDirs=(fx,...dirs)=>{for(const dir of dirs)fs.mkdirSync(path.join(fx.repo,dir),{recursive:true});};
const enqueueFixtureJob=(ledger,args)=>{
  ledger.ensureWorkflow({workflowId:args.workflowId});
  if(args.kind==='op')ledger.write.createUnit({workflowId:args.workflowId,unitId:args.jobId,
    opId:args.opId,subjectKey:args.jobId,goalRevision:1});
  return ledger.write.enqueueJob({...args,unitId:args.kind==='op'?args.jobId:null,
    status:args.kind==='kernel'?'running':args.status??'queued'});
};

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// Managed dispatch rides the scripts/api/orca orchestration wrappers
// (runCreate/workerStart/workerShow/workerStop/
// workerRelease), cli.mjs's managed-agent branch and
// scripts/agent/quota/index.mjs probeQuota. Kernel boot deliberately does not
// use those orchestration wrappers: every Kernel is a dedicated Orca
// terminal, while operation agents retain their routed managed lifecycle.

const fixture=(t,{dead=[],stale=[],allocationPolicy=null}={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-managed-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const mainRepo=path.join(root,'main');fs.mkdirSync(mainRepo,{recursive:true});
  const mainGit=proofRepo(t,mainRepo);
  const made=fakeOrcaWorktrees({root:path.join(root,'worktrees')}).create({repo:`path:${mainRepo}`,name:'wf-managed-fixture',baseBranch:'main'});
  assert.equal(made.ok,true,JSON.stringify(made));
  const repo=path.resolve(made.worktree.path);fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const git=(...args)=>mainGit('-C',repo,...args);
  // These refused starts leave the exact residual terminal that closure must prove away.
  const startBranch="else if (verb === 'orchestration worker-start') {";
  const stalledDispatch="last_failure: 'agent_prompt_stalled' }";
  assert.ok(FAKE_ORCA.includes(startBranch)&&FAKE_ORCA.includes(stalledDispatch),'private worker fixture anchors must exist');
  const managedFake=FAKE_ORCA.replace(startBranch,`${startBranch}
  if (['auth-partial', 'prompt-stalled'].includes(mode)) {
    const handle = 'fake-terminal-1';
    state.terminals = { ...(state.terminals || {}), [handle]: { handle, connected: mode === 'auth-partial', writable: mode === 'auth-partial' } };
    state.assignees = { ...(state.assignees || {}), 'dispatch-fake-1': handle }; save();
  }`).replace(stalledDispatch,"last_failure: 'agent_prompt_stalled', assigneeHandle: state.assignees?.[arg('dispatch')] ?? null }");
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,managedFake);
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot,{recursive:true});
  const trustHome=path.join(root,'trust-home');fs.mkdirSync(trustHome);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_FAKE_ORCA_DEAD:dead.join(','),
    STARCI_FAKE_ORCA_STALE:stale.join(','),
    STARCI_OWNER_ROOT:ownerRoot,STARCI_AGENT_TRUST_HOME:trustHome,
    APPDATA:path.join(root,'appdata'),
    STARCI_LOCAL_ROOT:path.join(root,'localappdata'),
    STARCI_PROJECTS_ROOT:path.join(root,'projects'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
    STARCI_GUARDS_ROOT:path.join(root,'guards'),
    STARCI_TEMP_ROOT:root,TEMP:root,TMP:root,TMPDIR:root,
  };
  // ownerRoot holds a config.yaml seeded from the shipped example; `kernel`
  // callers may rewrite the pin line.
  const example=fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8');
  const writeConfig=(kernelLine)=>{
    const canonical=kernelLine??'kernel: {agent: codex, model: gpt-6.1-sol, effort: high}';
    let body=example.replace(/^kernel:.*$/m,canonical)
      .replace(/^launchTrust:.*$/m,`launchTrust: ${JSON.stringify({profile:'automatic',approvedBy:'owner',approvalRef:'private managed dispatch fixture adoption',roots:[mainRepo]})}`);
    if(allocationPolicy){
      // Provider circuit scenarios keep order while testing repeated launches; the common example stays balanced.
      assert.ok(body.includes('\n  policy: balanced\n'),'fixture allocation policy anchor must exist');
      body=body.replace('\n  policy: balanced\n',`\n  policy: ${allocationPolicy}\n`);
    }
    assert.match(body,/^kernel:/m,'fixture config keeps the kernel: line');
    fs.writeFileSync(path.join(ownerRoot,'config.yaml'),body);
  };
  writeConfig();
  const registered=new Set();
  const bindWorkflow=workflowId=>{
    if(registered.has(workflowId))return;
    const record=registerWorkflowWorktree({env},{workflowId,orcaWorktreeId:made.worktree.id,path:repo,branch:made.worktree.branch});
    assert.equal(path.resolve(record.path),repo);assert.equal(record.branch,git('branch','--show-current'));
    registered.add(workflowId);
  };
  const run=(script,...args)=>{
    if(script===API&&args[0]==='dispatch'&&args.includes('--spawn')){
      const ledger=inspectLedger({file:ledgerFileFor(repo,{env})});
      try{const job=jobRowOf(ledger.db,args[args.indexOf('--job')+1]);assert.ok(job,'fixture dispatch names a real job');bindWorkflow(job.workflow_id);}
      finally{ledger.close();}
    }else if(script===START_WORKFLOW&&!args.includes('--plan'))bindWorkflow(args[args.indexOf('--goal')+1]);
    return new Promise(resolve=>execFile(process.execPath,
      ['--import',`data:text/javascript,import{register}from'node:module';register(${JSON.stringify(new URL('../helpers/worker-close-loader.mjs',import.meta.url).href)});register(${JSON.stringify(new URL('../helpers/workflow-startup-loader.mjs',import.meta.url).href)});`,script,...placeOnRepo(args,repo)],
      {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:senderEnv(script,env)},
      (error,stdout,stderr)=>resolve({status:error?.code??0,signal:error?.signal??null,error,stdout,stderr})));
  };
  const callArgv=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const calls=()=>callArgv().map(argv=>argv.slice(0,2).join(' '));
  return {root,repo,git,env,ledgerFile:ledgerFileFor(repo,{env}),run,calls,callArgv,writeConfig};
};

const defineGoal=async(fx,text='managed dispatch smoke goal')=>{
  const r=await fx.run(DEFINE_GOAL,'--repo',fx.repo,'--text',text,'--json');
  assert.equal(r.status,0,r.stderr);
  const workflowId=json(r.stdout)?.workflowId;
  assert.ok(workflowId,`define-goal returned no workflowId: ${r.stdout}`);
  return workflowId;
};

const jobRow=(fx,jobId)=>{
  const ledger=inspectLedger({file:fx.ledgerFile});
  try{return jobRowOf(ledger.db,jobId);}
  finally{ledger.close();}
};
const kernelSignal=(fx,workflowId)=>{
  const ledger=inspectLedger({file:fx.ledgerFile});
  try{
    const row=ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
    return row?.value_json?json(row.value_json):null;
  }finally{ledger.close();}
};
const ledgerRead=(fx,fn)=>{
  const ledger=inspectLedger({file:fx.ledgerFile});
  try{return fn(ledger.db);}finally{ledger.close();}
};
const providerHealthRow=(fx,provider)=>{
  const machine=openMachineReader({file:fx.env.STARCI_TEST_MACHINE_FILE});
  try{
    const row=machine.db.prepare('SELECT status,failure_kind,strikes,circuit_open_until,detail_json FROM provider_health WHERE provider=?').get(provider);
    if(!row)return null;
    return {value_json:JSON.stringify({...json(row.detail_json),status:row.status,failureKind:row.failure_kind,strikes:row.strikes}),
      expires_at:row.circuit_open_until};
  }finally{machine.close();}
};
const reportFile=(fx,jobId)=>{
  const scratch=ledgerRead(fx,db=>db.prepare('SELECT scratch_dir FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId)?.scratch_dir);
  assert.ok(scratch,`dispatched job ${jobId} has no scratch directory`);
  fs.mkdirSync(scratch,{recursive:true});
  return path.join(scratch,'report.json');
};

const attachProofs=(fx,jobId,report)=>{
  const binding=ledgerRead(fx,db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE attempt_id=(SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1)').get(jobId).context_json).packet.context.gate_binding);
  const dir=path.join(path.dirname(report),'proofs');
  writeGreenProofs(dir,{root:fx.repo,binding});
  return dir;
};

/* ------------------------------------------------ kernel pin precedence */

describe('managed dispatch CLI scenarios',{concurrency:3},()=>{

test('kernel pin precedence: config selects the agent/model the Kernel worker starts with',async t=>{
  // The fixture pins kernel {agent: codex, model: gpt-6.1-sol, effort: high}.
  // A plan must resolve routedBy 'config' without ever asking
  // route-model. Ingress may be any human chat surface; Orca still owns a
  // dedicated Kernel terminal.
  const fx=fixture(t);fx.writeConfig();
  const workflowId=await defineGoal(fx);
  const r=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);assert.ok(plan?.plan,`expected a plan, got: ${r.stdout}${r.stderr}`);
  assert.equal(plan.agent,'codex','the shipped Kernel agent pin must decide the seat');
  assert.equal(plan.routedBy,'config');
  assert.equal(plan.executionHost,'orca');
  assert.equal(plan.launch,'worker','every Kernel starts through orchestration worker-start');
  assert.equal(plan.model,'gpt-6.1-sol');
  assert.equal(plan.effort,'high');
  assert.equal(plan.route,undefined,'route-model must not be consulted when the pin decides');
  assert.equal(plan.config?.agent,'codex');
  assert.equal(plan.command,undefined,'no command is composed: Orca launches the agent');
});

test('kernel pin precedence: --agent flag beats the config pin',async t=>{
  const fx=fixture(t);fx.writeConfig(); // example pins codex
  const workflowId=await defineGoal(fx);
  const r=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--agent','devin','--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);
  assert.equal(plan.agent,'devin','an explicit --agent flag is the operator override');
  assert.equal(plan.routedBy,'override');
  assert.equal(plan.launch,'worker');
});

test('kernel pin precedence: an unavailable explicit pin fails closed instead of silently substituting Devin',async t=>{
  // The pin is codex; the fake host reports codex dead in `account list`.
  // Kernel identity is an owner decision. Fallback remains legal for routed
  // operations, not for this explicit Kernel pin.
  const fx=fixture(t,{dead:['codex']});fx.writeConfig();
  const workflowId=await defineGoal(fx);
  const r=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.notEqual(r.status,0,'an unavailable explicit Kernel pin must fail closed');
  const failure=json(r.stderr)||json(r.stdout);
  assert.equal(failure?.agent,'codex');
  assert.match(failure?.routeError??failure?.error??'',/dead|not authent|unavailable/i);
  assert.doesNotMatch(`${r.stdout}\n${r.stderr}`,/"(?:agent|provider)"\s*:\s*"devin"/i);
});

/* ------------------------------------------- managed dispatch lifecycle */

test('managed dispatch: route persists the decision, spawn marks the job running, report sends worker_done, settle only releases the worker',async t=>{
  const fx=fixture(t);
  const jobId='job-managed-1';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:'kernel-wf-managed',workflowId:'wf-managed',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6.1-sol'},hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:'agent:kernel:wf-managed',parentNodeId:'workflow:wf-managed',role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-managed'").run();
    enqueueFixtureJob(ledger,{jobId,workflowId:'wf-managed',opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],model:'claude-agent'}});
  }finally{ledger.close();}

  const r=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','claude-agent','--spawn','--json');
  assert.equal(r.status,0,`managed dispatch failed: ${r.stderr||r.stdout}`);
  const job=jobRow(fx,jobId);
  assert.equal(job?.status,'running',`managed dispatch must mark the job running, got ${job?.status}`);
  assert.equal(job?.worker_id,'dispatch-fake-1','worker_id is the Dispatch id, not a terminal handle');
  // Route persisted the decision: the resolved profile/agent lives on the
  // durable job, not in launcher memory.
  assert.match(job?.payload_json??'',/claude/,`the dispatch decision must be persisted on the job payload: ${job?.payload_json}`);
  const seen=fx.calls();
  for(const step of ['orchestration run-create','orchestration worker-start','terminal rename','orchestration worker-show'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  for(const gone of ['orchestration task-create','orchestration dispatch-show'])
    assert.equal(seen.includes(gone),false,`worker-start --spec files the Task and names the terminal: no ${gone}`);
  assert.equal(seen.includes('orchestration dispatch'),false,
    'worker-start already owns Task injection; a second orchestration dispatch would double-dispatch the operation');
  const calls=fx.callArgv();
  const workerStartCall=calls.find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  // Claude is the managed exemplar: Codex operations launch as unattended
  // command terminals.
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--agent')+1],'claude',
    'managed profiles use Orca native managed-agent admission');
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--from')+1],'fake-kernel-terminal',
    'the dedicated Kernel terminal is the explicit Orca Run/worker coordinator');
  // worker-start --spec files the op Task in the workflow Run, from the Kernel terminal, with no --parent.
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--run')+1],'run-fake-1');
  assert.equal(workerStartCall?.includes('--parent'),false,
    'Orca --parent takes a task id; the kernel is a terminal, so the Task hangs under the Run and names the kernel with --from');
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--task-title')+1],'code.refactor #1');
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--display-name')+1],'[Op] Ch\u1ec9nh s\u1eeda m\u00e3 ngu\u1ed3n · docs · wf-managed');
  assert.ok(workerStartCall?.includes('--spec'),'the rendered packet rides on --spec');
  // Inspect the real launch transport, including a spilled packet; preview-only wiring cannot satisfy this regression.
  const taskSpec=workerStartCall[workerStartCall.indexOf('--spec')+1];
  const packetPath=taskSpec.match(/^ {2}(.+packet\.a\d+\.md)$/m)?.[1];
  if(packetPath){
    const rel=path.relative(fx.root,path.resolve(packetPath));
    assert.ok(rel!=='..'&&!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel),'packet spill remains in this private fixture');
  }
  const delivered=packetPath?fs.readFileSync(packetPath,'utf8'):taskSpec;
  const context=ledgerRead(fx,db=>json(db.prepare('SELECT context_json FROM contracts WHERE attempt_id=(SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1)').get(jobId)?.context_json));
  const canonical=buildContext({op:'code.refactor',skillRoot:ROOT,records:[],ownedPaths:[]});
  const expected=canonical.mandatory.map(entry=>entry.path);
  assert.deepEqual(context?.packet?.context?.mandatoryReads,expected,'the saved actual attempt carries the canonical resolved read list');
  for(const required of ['docs/architecture.md','docs/code-pattern-enforcement.md','scripts/gates/gate.mjs','modules/kernel/dispatch.yaml'])
    assert.ok(expected.includes(required),`the actual context must carry ${required}`);
  const block=delivered.split('MANDATORY READS — read in this order before any action:')[1]?.split('  shared evidence and path policy:')[0];
  assert.equal(typeof block,'string','worker-start receives the materialized context block');
  assert.deepEqual(context?.packet?.context?.readRefs?.map(({path:file,absolute,rootKind,root,sha256})=>({path:file,absolute,rootKind,root,sha256})),
    canonical.mandatory.map(({path:file,sha256})=>({path:file,absolute:path.resolve(ROOT,file),rootKind:'source',root:ROOT,sha256})),
    'the saved actual READ snapshot binds ordered canonical Source paths, roots and hashes');
  let cursor=-1;
  for(const [index,file]of expected.entries()){
    const at=block.indexOf(`${index+1}. ${path.resolve(ROOT,file)} —`);
    assert.ok(at>cursor,`actual worker prompt omits or reorders mandatory read ${file}`);cursor=at;
  }
  const renameCall=calls.find(argv=>argv.slice(0,2).join(' ')==='terminal rename');
  assert.equal(renameCall?.[renameCall.indexOf('--terminal')+1],'fake-terminal-1');
  assert.equal(renameCall?.[renameCall.indexOf('--title')+1],'[Op] Ch\u1ec9nh s\u1eeda m\u00e3 ngu\u1ed3n · docs · wf-managed',
    'managed worker terminals keep the semantic [Op] title instead of worker-task_<id>');
  const payload=json(job?.payload_json);
  assert.equal(payload?.hierarchy?.parentNodeId,'agent:kernel:wf-managed');
  assert.equal(payload?.hierarchy?.runtime?.runId,'run-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.taskId,'task-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.dispatchId,'dispatch-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.terminalHandle,'fake-terminal-1');
  // worker-start owns the agent's env, so the op's guard is bound to the Orca terminal the history hook reads
  // and command guard (ORCA_TERMINAL_HANDLE), and the guard receipt rides on op-dispatched.
  const dispatched=ledgerRead(fx,db=>db.prepare("SELECT payload_json FROM events WHERE kind='op-dispatched' AND entity_id=?").get(jobId));
  const guard=json(dispatched?.payload_json)?.guard;
  assert.equal(typeof guard?.jobFile,'string',JSON.stringify(guard));
  assert.equal(path.basename(guard?.terminal??''),'fake-terminal-1.json',JSON.stringify(guard));
  assert.equal(json(fs.readFileSync(guard.terminal,'utf8'))?.jobId,jobId);
  assert.equal('shims' in (guard??{}),false,'the guard reaches the agent through its terminal binding only');

  // A pass is earned from the worker's filed done claim plus an independent
  // green Kernel check. starci kernel report sends the op's one worker_done (orca-deep-map
  // REPLACE #9), so Orca settles the Task and Dispatch and settle only releases.
  const report=reportFile(fx,jobId);fs.writeFileSync(report,JSON.stringify({
    schema:'starci/op-report@1',outcome:'done',summary:'managed dispatch completed',head:fx.git('rev-parse','HEAD'),
    files:[],checks:[{name:'self-check',command:'true',exitCode:0}],
  }));
  const filed=await fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--attach',attachProofs(fx,jobId,report),'--dispatch-capability','dcap_fake','--json');
  assert.equal(filed.status,0,`report failed: ${filed.stderr||filed.stdout}`);
  assert.deepEqual(ledgerRead(fx,db=>db.prepare("SELECT name FROM job_artifacts WHERE job_id=? AND name IN ('attachments/proofs/gate.json','attachments/proofs/read-digest.json') ORDER BY name").all(jobId)).map(row=>row.name),
    ['attachments/proofs/gate.json','attachments/proofs/read-digest.json'],'the filed attempt carries the actual attached gate and READ blobs');
  const sends=fx.callArgv().filter(argv=>argv.slice(0,2).join(' ')==='orchestration send');
  assert.equal(sends.length,1,'exactly one worker_done');
  const flagOf=(argv,name)=>argv[argv.indexOf(`--${name}`)+1];
  assert.deepEqual(['type','task-id','dispatch-id','from','outcome'].map(n=>flagOf(sends[0],n)),['worker_done','task-fake-1','dispatch-fake-1','fake-terminal-1','succeeded']);
  assert.ok(sends[0].includes('--retry-request'),'a lost receipt replays, never a second worker_done');
  assert.equal(flagOf(sends[0],'dispatch-capability'),'dcap_fake','the op\'s own Dispatch capability authenticates the worker_done');
  assert.equal(JSON.stringify(jobRow(fx,jobId)).includes('dcap_fake'),false,'the capability is never stored on the job');
  assert.deepEqual([json(jobRow(fx,jobId)?.payload_json)?.workerDone?.outcome,json(jobRow(fx,jobId)?.payload_json)?.workerDone?.ok],['succeeded',true],'starci kernel report sent the worker_done and the job keeps its receipt');
  fx.env.STARCI_CALLER='runtime-settler';
  const checked=await fx.run(API,'record-checks','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({
    checks:[{name:'validator',command:'managed validation',exitCode:0,evidence:'green'}],
  }),'--json');
  delete fx.env.STARCI_CALLER;
  assert.equal(checked.status,0,`check failed: ${checked.stderr||checked.stdout}`);
  const s=await fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(s.status,0,`settle failed: ${s.stderr||s.stdout}`);
  const settled=jobRow(fx,jobId);
  assert.equal(settled?.status,'succeeded');
  const after=fx.calls();
  assert.equal(after.includes('orchestration worker-stop'),false,`a Dispatch settled by worker_done is never stopped — log: ${after.join(', ')}`);
  assert.ok(after.includes('orchestration worker-release'),`settle must worker-release the dispatch — log: ${after.join(', ')}`);
  assert.equal(after.includes('orchestration task-update'),false,`the Task settled with worker_done: settle never issues task-update — log: ${after.join(', ')}`);
  const worker=json(s.stdout)?.managedWorker;
  assert.deepEqual([worker?.dispatch?.state,worker?.dispatch?.workerDone,worker?.stop],['succeeded',true,null],'the receipt keeps the Dispatch state it released');
  assert.equal('taskClosed' in (json(s.stdout)??{}),false);
});

test('starci kernel report without the op\'s Dispatch capability sends no worker_done, records dispatch_capability_missing, and settle fences the Dispatch with worker-stop then releases it',async t=>{
  const fx=fixture(t);
  const jobId='job-managed-no-capability';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:'kernel-wf-nocap',workflowId:'wf-nocap',kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-nocap'").run();
    enqueueFixtureJob(ledger,{jobId,workflowId:'wf-nocap',opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'claude-agent'}});
  }finally{ledger.close();}
  const d=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','claude-agent','--spawn','--json');
  assert.equal(d.status,0,d.stderr||d.stdout);
  const report=reportFile(fx,jobId);fs.writeFileSync(report,JSON.stringify({
    schema:'starci/op-report@1',outcome:'done',summary:'no capability',head:fx.git('rev-parse','HEAD'),
    files:[],checks:[{name:'self-check',command:'true',exitCode:0}],
  }));
  const filed=await fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--attach',attachProofs(fx,jobId,report),'--json');
  assert.equal(filed.status,0,filed.stderr||filed.stdout);
  assert.equal(fx.calls().includes('orchestration send'),false,'no capability, no worker_done attempt');
  const done=json(jobRow(fx,jobId)?.payload_json)?.workerDone;
  assert.deepEqual([done?.ok,done?.errorCode,done?.code],[false,'dispatch_capability_missing','worker-done-unsent']);
});

test('managed settle: a Dispatch with no worker_done (the op filed no report) is fenced with worker-stop, then released',async t=>{
  const fx=fixture(t);
  const jobId='job-managed-no-worker-done';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:'kernel-wf-nodone',workflowId:'wf-nodone',kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-nodone'").run();
    enqueueFixtureJob(ledger,{jobId,workflowId:'wf-nodone',opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'claude-agent'}});
  }finally{ledger.close();}
  const d=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','claude-agent','--spawn','--json');
  assert.equal(d.status,0,d.stderr||d.stdout);
  const r=await fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--dead-worker','--settle-failed','--json');
  const calls=fx.calls();
  assert.equal(calls.includes('orchestration send'),false,'no report, no worker_done');
  if(calls.includes('orchestration worker-release')){
    assert.ok(calls.indexOf('orchestration worker-stop')>=0&&calls.lastIndexOf('orchestration worker-stop')<calls.lastIndexOf('orchestration worker-release'),
      `a Dispatch that did not settle itself is stopped before the release — log: ${calls.join(', ')} (${r.stdout||r.stderr})`);
  }
  assert.equal(calls.includes('orchestration task-update'),false);
});

// Two settled nivo business.decide ops kept their Claude terminals live:
// worker-release answered release_unknown ("the agent terminal was closed but
// its process could not be confirmed stopped") and settle recorded nothing.
for(const unknown of [1,2]) test(`managed settle: release_unknown ${unknown}x repeats the release once and records its custody`,async t=>{
  const fx=fixture(t);fx.env.STARCI_FAKE_ORCA_RELEASE_UNKNOWN=String(unknown);
  const jobId='job-managed-release';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:'kernel-wf-release',workflowId:'wf-release',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6.1-sol'},hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:'agent:kernel:wf-release',parentNodeId:'workflow:wf-release',role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-release'").run();
    enqueueFixtureJob(ledger,{jobId,workflowId:'wf-release',opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'claude-agent'}});
  }finally{ledger.close();}
  const d=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','claude-agent','--spawn','--json');
  assert.equal(d.status,0,d.stderr||d.stdout);
  assert.equal(json(jobRow(fx,jobId)?.payload_json)?.managed?.agentTerminalHandle,'fake-terminal-1');
  const report=reportFile(fx,jobId);fs.writeFileSync(report,JSON.stringify({
    schema:'starci/op-report@1',outcome:'done',summary:'done',head:fx.git('rev-parse','HEAD'),files:[],checks:[{name:'self',command:'true',exitCode:0}]}));
  const releaseFiled=await fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--attach',attachProofs(fx,jobId,report),'--dispatch-capability','dcap_fake','--json');
  assert.equal(releaseFiled.status,0,`report failed: ${releaseFiled.stderr||releaseFiled.stdout}`);
  assert.deepEqual(ledgerRead(fx,db=>db.prepare("SELECT name FROM job_artifacts WHERE job_id=? AND name IN ('attachments/proofs/gate.json','attachments/proofs/read-digest.json') ORDER BY name").all(jobId)).map(row=>row.name),
    ['attachments/proofs/gate.json','attachments/proofs/read-digest.json'],'the filed attempt carries the actual attached gate and READ blobs');
  fx.env.STARCI_CALLER='runtime-settler';
  assert.equal((await fx.run(API,'record-checks','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({checks:[{name:'v',command:'v',exitCode:0,evidence:'green'}]}),'--json')).status,0);
  delete fx.env.STARCI_CALLER;
  const s=await fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(s.status,0,s.stderr||s.stdout);
  const releases=fx.calls().filter(c=>c==='orchestration worker-release').length;
  assert.equal(releases,2,'an unknown release is repeated once, as Orca\'s recovery says');
  const worker=json(s.stdout)?.managedWorker;
  assert.equal(worker?.retryRelease?.state!==undefined,true,'the repeat is on the receipt');
  // A release is not trusted to end the agent (a released cursor worker kept running): after the last worker-release the runtime closes that worker's
  // own terminal (scripts/machine/worker-close.mjs); nothing is typed into it.
  const heads=fx.callArgv().map(a=>a.slice(0,2).join(' '));
  const closeAt=heads.indexOf('terminal close');
  assert.ok(closeAt>heads.lastIndexOf('orchestration worker-release'),'the terminal is closed after the release');
  assert.ok(fx.callArgv().filter(a=>a.slice(0,2).join(' ')==='terminal close').every(a=>a.includes('fake-terminal-1')),'only the worker terminal is closed');
  assert.equal(heads.filter(h=>h==='terminal send').length,0,'no quit input');
  // Orca\'s own recovery repeats the release once: the first unknown is settled by it; two unknowns leave the worker retained,
  // which the receipt says (custody) and --release-worker retries later. The runtime then closes the worker's terminal itself, and that close read
  // back disconnected is the proof the worker is gone: custody is released either way, by its own proof.
  assert.equal(worker?.custody?.state,'released',JSON.stringify(worker?.custody));
  assert.equal(worker?.custody?.proof,unknown===1?'release-ok':'terminal-disconnected',JSON.stringify(worker?.custody));
  assert.equal(json(jobRow(fx,jobId)?.payload_json)?.managedWorker?.custody?.state,worker?.custody?.state,'the ledger keeps the worker receipt');
});

test('finish closes the kernel terminal and never issues task-update (the Task of an op belongs to Orca)',async t=>{
  const fx=fixture(t);
  const workflowId='wf-finish-tree';
  const jobId='job-finish-tree';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    // An op whose Task was opened and whose attempt never reached settle.
    enqueueFixtureJob(ledger,{jobId,workflowId,opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],managed:{runId:'run-fake-1',taskId:'task-orphan-1',dispatchId:'dispatch-fake-1'}}});
    ledger.db.prepare("UPDATE jobs SET status='cancelled' WHERE job_id=?").run(jobId);
    // Only a running workflow finishes (api-lib/lifecycle.mjs: running -> finished).
    ledger.write.changeWorkflowPhase({workflowId,to:'running',by:'test-fixture',reason:'finish precondition'});
    // The terminal-closure fixture includes the real admitted handover job that owns this approval.
    const handoverJob='job-finish-handover',opId='handover.review',at=Date.now();
    const payload={opId,owned_paths:['docs/']};
    enqueueFixtureJob(ledger,{jobId:handoverJob,workflowId,opId,kind:'op',payload});
    for(const to of ['ready','leased'])setJobStatus(ledger.db,{jobId:handoverJob,to,reason:'fixture handover',at});
    const attempt=startAttempt(ledger.db,{workflowId,jobId:handoverJob,dispatchId:'handover-finish-review',dispatchedAt:at,startedAt:at,at});
    const selection=selectDispatchContract(ROOT,opId,payload),packet={context:{records:[],owned_paths:[{root:fx.repo,path:'docs/'}],selected_op:selection.selected}};
    admitPacket(ROOT,{packet,op:opId,placements:[{base:fx.repo,path:'docs/'}],db:ledger.db,workflowId,now:at});
    const {inputs}=captureDispatchInputs({skillRoot:ROOT,op:opId,packet,briefDoc:selection.brief,params:selection.params,
      repo:fx.repo,stateDir:path.join(fx.repo,'.starciwork'),workerCwd:fx.repo});
    writeContract(ledger.db,{attemptId:attempt.attempt_id,markdown:fs.readFileSync(path.join(ROOT,'modules/ops/ops/handover.review.yaml'),'utf8'),
      context:{worktree:fx.repo,packet,contract:packet.context.contract,inputs},createdAt:at});
    setJobStatus(ledger.db,{jobId:handoverJob,to:'running',reason:'fixture handover',attemptId:attempt.attempt_id,at});
    fileReport(ledger.db,{attemptId:attempt.attempt_id,outcome:'done',report:{schema:'starci/op-report@1',outcome:'done',summary:'owner-handover precondition of terminal closure'},createdAt:at});
    for(const to of ['reported','succeeded'])setJobStatus(ledger.db,{jobId:handoverJob,to,reason:'fixture handover',attemptId:attempt.attempt_id,at});
    updateAttempt(ledger.db,{attemptId:attempt.attempt_id,settledAt:at,verdict:'pass',endState:'settled',at});
    recordJobResult(ledger.db,{jobId:handoverJob,result:{verdict:'pass'},at});
    ledger.appendEvent({workflowId,entityType:'job',entityId:handoverJob,kind:'handover-approved',payload:{jobId:handoverJob,dispatchId:'ask-finish',answeredBy:'owner'}});
  }finally{ledger.close();}

  const finished=await fx.run(API,'finish','--repo',fx.repo,'--workflow',workflowId,'--json');
  assert.equal(finished.status,0,finished.stderr||finished.stdout);
  const out=json(finished.stdout);
  assert.equal(out?.phase,'finished');
  assert.equal('tasksClosed' in (out??{}),false);
  assert.equal(out?.kernelTerminal,'fake-kernel-terminal');

  const argv=fx.callArgv();
  assert.equal(argv.some(a=>a.slice(0,2).join(' ')==='orchestration task-update'),false,'finish closes no Task');
  const close=argv.find(a=>a.slice(0,2).join(' ')==='terminal close');
  assert.equal(close?.[close.indexOf('--terminal')+1],'fake-kernel-terminal','the kernel terminal does not outlive the workflow');
  assert.equal('taskClosed' in (json(jobRow(fx,jobId)?.payload_json)??{}),false);
});

test('Claude auth rejection circuits the shared-auth provider for every job and reuses the logical operation attempt',async t=>{
  const fx=fixture(t,{allocationPolicy:'prefer-then-overflow'});
  fx.env.STARCI_FAKE_ORCA_MODE='auth';
  const jobId='job-claude-auth-circuit';
  const siblingJobId='job-claude-prerouted-sibling';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:'kernel-wf-claude-auth',workflowId:'wf-claude-auth',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6.1-sol'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-claude-auth'").run();
    enqueueFixtureJob(ledger,{jobId,workflowId:'wf-claude-auth',opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
    grantDirs(fx,'docs/sibling');
    enqueueFixtureJob(ledger,{jobId:siblingJobId,workflowId:'wf-claude-auth',opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/sibling/'],difficulty:'hard'}});
  }finally{ledger.close();}
  seedGoalBias(fx,'wf-claude-auth',{prefer:[{provider:'claude'}]});

  const firstRoute=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard',
    '--json');
  assert.equal(firstRoute.status,0,firstRoute.stderr||firstRoute.stdout);
  assert.equal(json(firstRoute.stdout)?.decision?.routePolicy,'prefer-then-overflow','private owner fixture declares ordered routing');
  assert.equal(json(firstRoute.stdout)?.decision?.model,'claude-agent',
    'fresh authenticated quota permits the owner-preferred provider to reach launch attestation');
  const siblingRoute=await fx.run(API,'route','--repo',fx.repo,'--job',siblingJobId,'--difficulty','hard',
    '--json');
  assert.equal(siblingRoute.status,0,siblingRoute.stderr||siblingRoute.stdout);
  assert.equal(json(siblingRoute.stdout)?.decision?.model,'claude-agent','precondition: the sibling route predates the circuit');

  const rejected=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
  assert.notEqual(rejected.status,0,'the fake Claude OAuth rejection must reject the candidate');
  const afterReject=ledgerRead(fx,db=>({
    job:jobRowOf(db,jobId),
    health:providerHealthRow(fx,'claude'),
    leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
  }));
  assert.equal(afterReject.job?.attempt,1,'provider rejection must not mint a second logical operation attempt');
  assert.equal(afterReject.job?.status,'ready','a proven no-effect auth rejection is safe to route again');
  assert.equal(afterReject.leases,0,'no-effect fallback releases the rejected candidate lease');
  assert.equal(json(afterReject.job?.result_json)?.attemptConsumed,false);
  assert.equal(json(afterReject.health?.value_json)?.status,'unavailable','the shared provider circuit is durable');
  assert.ok(afterReject.health?.expires_at>Date.now(),'the auth circuit carries its declared cooldown');
  const survey=await fx.run(API,'survey','--repo',fx.repo,'--workflow','wf-claude-auth','--json');
  assert.equal(survey.status,0,survey.stderr||survey.stdout);
  assert.ok(json(survey.stdout)?.signals?.some(signal=>signal.scope==='provider-health'&&signal.key==='claude'),
    'kernel survey exposes the active provider circuit for durable reasoning');

  const siblingRejected=await fx.run(API,'dispatch','--repo',fx.repo,'--job',siblingJobId,'--spawn','--json');
  assert.notEqual(siblingRejected.status,0,'a persisted sibling route must re-check provider health before launch');
  assert.equal(json(siblingRejected.stdout)?.rejection?.status,'ready');
  assert.equal(fx.calls().filter(call=>call==='orchestration worker-start').length,1,
    'the circuit rejects the already-routed sibling before a second Claude worker-start');

  // The circuit, not the chain, decides here: a route that still prefers
  // claude-agent crosses to the other provider while the Claude OAuth is out.
  const fallback=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard',
    '--json');
  assert.equal(fallback.status,0,fallback.stderr||fallback.stdout);
  const decision=json(fallback.stdout)?.decision;
  assert.equal(decision?.model,'codex-agent','fallback must cross the failed auth provider boundary');
  const rejectedTargets=new Set((decision?.routeRejected??[]).map(item=>item.target));
  assert.ok(rejectedTargets.has('claude-agent'),'the Claude pool is excluded by the provider circuit');
  assert.equal(ledgerRead(fx,db=>db.prepare('SELECT try_no AS attempt FROM jobs WHERE job_id=?').get(jobId)?.attempt),1);
});

test('historical workflow incident text cannot poison provider routing',async t=>{
  const fx=fixture(t);
  const workflowId='wf-incident-routing';
  const jobId='job-incident-routing';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    enqueueFixtureJob(ledger,{jobId,workflowId,opId:'scope.define',kind:'op',
      payload:{opId:'scope.define',owned_paths:['docs/'],difficulty:'medium'}});
    ledger.db.prepare(`INSERT INTO incidents(
      incident_id,workflow_id,op_id,kind,owner,last_progress,status,created_at,updated_at
    ) VALUES(?,?,?,'other','kernel',?,'open',?,?)`).run(
      'inc-historical-provider-names',workflowId,'scope.define',
      'Recovered dispatch attempts mentioned codex and claude; no provider outage remains.',Date.now(),Date.now(),
    );
  }finally{ledger.close();}

  const routed=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','medium','--json');
  assert.equal(routed.status,0,routed.stderr||routed.stdout);
  assert.ok(json(routed.stdout)?.decision?.model,
    'routing must use typed provider-health signals, not arbitrary incident prose');
});

test('Claude auth fallback advances only after partial effects reconcile and never on unknown effects',async t=>{
  const exercise=async(mode,suffix,unverifiedClosure=false)=>{
    const fx=fixture(t);
    fx.env.STARCI_FAKE_ORCA_MODE=mode;
    if(unverifiedClosure)fx.env.STARCI_FAKE_CLOSURE_UNPROVEN='1';
    const workflowId=`wf-claude-${suffix}`;
    const jobId=`job-claude-${suffix}`;
    const ledger=openLedger({file:fx.ledgerFile});
    try{
      enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
      ledger.db.prepare('UPDATE jobs SET status=\'running\',worker_id=\'fake-kernel-terminal\' WHERE job_id=?').run(`kernel-${workflowId}`);
      enqueueFixtureJob(ledger,{jobId,workflowId,opId:'architecture.decide',kind:'op',
        payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
    }finally{ledger.close();}
    seedGoalBias(fx,workflowId,{prefer:[{provider:'claude'}]});
    const routed=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json');
    assert.equal(routed.status,0,routed.stderr||routed.stdout);
    const rejected=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
    assert.notEqual(rejected.status,0);
    return {fx,jobId,rejected:json(rejected.stdout),result:ledgerRead(fx,db=>({
      job:jobRowOf(db,jobId),
      leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
    }))};
  };

  const partial=await exercise('auth-partial','partial');
  assert.equal(partial.result.job.status,'ready','settled residual resources reduce partial to proven no-effect');
  const partialClosure=partial.rejected?.managed?.cleanup?.release;
  assert.equal(partialClosure?.handle,'fake-terminal-1');
  assert.equal(partialClosure?.processes?.verdict,'none');
  assert.deepEqual(partialClosure?.processes?.census,[],'partial launch fallback requires the measured terminal census to be empty');
  assert.equal(json(partial.result.job.result_json)?.effectState,'none');
  assert.equal(partial.result.leases,0);
  assert.ok(partial.fx.calls().includes('orchestration worker-stop'));
  assert.ok(partial.fx.calls().includes('orchestration worker-release'));
  // A refusal leaves nothing running, and says so on the record.
  assert.equal(json(partial.result.job.result_json)?.terminalClosed,true);
  assert.equal(json(partial.result.job.result_json)?.closed?.dispatchId,'dispatch-fake-1');

  const unverified=await exercise('auth-partial','unverified-process',true);
  assert.equal(unverified.result.job.status,'effect_unknown','terminal closure alone cannot release an unproven process tree');
  assert.equal(unverified.rejected?.managed?.cleanup?.release?.processes?.verdict,'unverifiable');
  assert.equal(json(unverified.result.job.result_json)?.effectState,'unknown');
  assert.equal(unverified.result.leases,1,'unproven process exit retains the operation fence');

  const unknown=await exercise('auth-unknown','unknown');
  assert.equal(unknown.result.job.status,'effect_unknown','a ready worker observation blocks provider fallback');
  assert.equal(json(unknown.result.job.result_json)?.effectState,'unknown');
  assert.equal(unknown.result.leases,1,'unknown effects keep the operation fence in place');
  assert.equal(unknown.fx.calls().includes('orchestration worker-stop'),false,'unknown readiness is not killed from a guess');
  assert.equal(unknown.fx.calls().includes('orchestration worker-release'),false);
  assert.equal(json(unknown.result.job.result_json)?.terminalClosed,false,
    'an unreconciled worker is outstanding, not quietly assumed gone');
  assert.equal(json(unknown.result.job.result_json)?.closed?.deferred,'reconcile-then-stop');
});

test('a dispatch refused after the worker exists closes that worker in the same rejection',async t=>{
  // orca-hierarchy row 2: interface.audit a4 was rejected at
  // worker-start and its terminal stayed open, so the sidebar kept an "Idle"
  // [Op] row under the kernel for a job the ledger had already failed.
  const fx=fixture(t);
  fx.env.STARCI_FAKE_ORCA_MODE='auth-partial';
  const workflowId='wf-reject-closes';
  const jobId='job-reject-closes';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    enqueueFixtureJob(ledger,{jobId,workflowId,opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],model:'claude-agent'}});
  }finally{ledger.close();}

  const rejected=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','claude-agent','--spawn','--json');
  assert.notEqual(rejected.status,0,'a worker-start refusal is a rejected dispatch');
  const out=json(rejected.stdout);
  assert.equal(out?.rejected,'dispatch-rejected');
  assert.equal(out?.rejection?.terminalClosed,true,'the refusal reports what it closed');

  const argv=fx.callArgv();
  const stopped=argv.filter(a=>a.slice(0,2).join(' ')==='orchestration worker-stop');
  const released=argv.filter(a=>a.slice(0,2).join(' ')==='orchestration worker-release');
  assert.equal(stopped.length,1,'the residual worker is stopped exactly once');
  assert.equal(released.length,1,'and released exactly once — the rejection does not repeat the caller cleanup');
  assert.equal(stopped[0][stopped[0].indexOf('--dispatch')+1],'dispatch-fake-1');
  assert.equal(released[0][released[0].indexOf('--dispatch')+1],'dispatch-fake-1');

  const event=ledgerRead(fx,db=>db.prepare(
    "SELECT payload_json FROM events WHERE workflow_id=? AND kind='dispatch-rejected'").get(workflowId));
  const payload=json(event?.payload_json);
  assert.equal(payload?.terminalClosed,true,'dispatch-rejected carries the proof');
  assert.equal(payload?.closed?.kind,'managed');
  assert.equal(payload?.closed?.dispatchId,'dispatch-fake-1');
  // Lane G's evidence list is untouched by the containment.
  const job=jobRow(fx,jobId);
  const rejectedDispatches=json(job?.payload_json)?.rejectedDispatches??[];
  assert.equal(rejectedDispatches.length,1);
  assert.equal(rejectedDispatches[0].dispatchId,'dispatch-fake-1');
});

test('managed prompt stall with exact exited worker is retried as the same logical attempt',async t=>{
  const fx=fixture(t);
  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const workflowId='wf-prompt-stalled';
  const jobId='job-prompt-stalled';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    enqueueFixtureJob(ledger,{jobId,workflowId,opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
  }finally{ledger.close();}

  const routed=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json');
  assert.equal(routed.status,0,routed.stderr||routed.stdout);
  const rejected=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
  assert.notEqual(rejected.status,0,'the launch still reports a rejected dispatch to the Kernel');
  const stalledClosure=json(rejected.stdout)?.managed?.cleanup?.release;
  assert.equal(stalledClosure?.handle,'fake-terminal-1');
  assert.equal(stalledClosure?.processes?.verdict,'none');
  assert.deepEqual(stalledClosure?.processes?.census,[],'exact exited prompt-stall still requires measured process closure');
  const state=ledgerRead(fx,db=>({
    job:jobRowOf(db,jobId),
    leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
    contracts:db.prepare('SELECT COUNT(*) n FROM contracts WHERE workflow_id=?').get(workflowId).n,
  }));
  assert.equal(state.job.status,'ready','exact exited prompt-stall is a reusable infrastructure launch');
  assert.equal(state.job.attempt,1,'retry preserves the logical attempt');
  assert.equal(state.job.worker_id,null);
  assert.equal(json(state.job.result_json)?.effectState,'none');
  assert.equal(json(state.job.result_json)?.attemptConsumed,false);
  assert.equal(state.leases,0);
  assert.equal(state.contracts,0,'prompt stalled before an operation contract was accepted');
  assert.ok(fx.calls().includes('orchestration worker-release'));
  assert.ok(fx.calls().includes('orchestration worker-show'));
});

test('reconcile converts a fenced effect_unknown prompt stall into the same queued job',async t=>{
  const fx=fixture(t,{stale:['claude']});
  const workflowId='wf-late-reconcile';
  const jobId='job-late-reconcile';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    enqueueFixtureJob(ledger,{jobId,workflowId,opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
  }finally{ledger.close();}

  fx.env.STARCI_FAKE_ORCA_MODE='auth-unknown';
  assert.equal((await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json')).status,0);
  assert.notEqual((await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json')).status,0);
  const fenced=ledgerRead(fx,db=>db.prepare('SELECT status,try_no AS attempt,worker_id FROM jobs WHERE job_id=?').get(jobId));
  assert.equal(fenced.status,'effect_unknown');
  assert.equal(fenced.attempt,1);

  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const reconciled=await fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(reconciled.status,0,reconciled.stderr||reconciled.stdout);
  assert.equal(json(reconciled.stdout)?.reconciled,true);
  const state=ledgerRead(fx,db=>({
    job:jobRowOf(db,jobId),
    leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
  }));
  assert.equal(state.job.status,'ready');
  assert.equal(state.job.attempt,1);
  assert.equal(state.job.worker_id,null);
  assert.equal(json(state.job.result_json)?.reason,'dispatch-reconciled');
  assert.equal(json(state.job.result_json)?.attemptConsumed,false);
  assert.equal(state.leases,0);
});

/* -------------------------------------------- the Kernel is a worker-start worker */

test('kernel launch: Codex boots as a worker of its own entry Run through worker-start, never a terminal create',async t=>{
  const fx=fixture(t);fx.writeConfig(); // shipped pin: codex / gpt-6.1-sol / high
  const workflowId=await defineGoal(fx);
  const r=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(r.status,0,`Kernel launch failed: ${r.stderr||r.stdout}`);
  const out=json(r.stdout);
  assert.deepEqual([out?.agent,out?.routedBy,out?.executionHost,out?.launch],['codex','config','orca','worker']);
  assert.deepEqual([out?.terminal,out?.dispatch,out?.runId,out?.model,out?.modelAttested],['fake-terminal-1','dispatch-fake-1','run-fake-1','gpt-6.1-sol',true]);
  const job=jobRow(fx,`kernel-${workflowId}`);
  assert.equal(job?.status,'running');
  assert.equal(job?.worker_id,'fake-terminal-1','the Kernel job persists its worker terminal handle');
  assert.equal(json(job?.payload_json)?.managed?.dispatchId,'dispatch-fake-1');
  assert.deepEqual(kernelSignal(fx,workflowId),{
    terminal:'fake-terminal-1',dispatch:'dispatch-fake-1',runId:'run-fake-1',host:'orca',agent:'codex',routedBy:'config',
    model:'gpt-6.1-sol',effort:'high',launch:'worker',modelAuthority:'supported-model-argument',effectiveModel:'gpt-6.1-sol',modelAttested:true,
  });
  const seen=fx.calls();
  for(const step of ['orchestration run-create','orchestration worker-start','terminal rename','orchestration worker-show'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  for(const gone of ['orchestration task-create','orchestration dispatch-show'])
    assert.equal(seen.includes(gone),false,`worker-start --spec files the Task and names the terminal: no ${gone}`);
  assert.equal(seen.includes('terminal create'),false,'the Kernel is never launched with terminal create');
  const start=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.deepEqual([start[start.indexOf('--agent')+1],start[start.indexOf('--model')+1],start[start.indexOf('--effort')+1]],['codex','gpt-6.1-sol','high']);

  // A second start must not double the seat: the live Dispatch is the Kernel identity.
  const again=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(again.status,0,again.stderr);
  assert.equal(json(again.stdout)?.replaced,false);
  assert.equal(fx.calls().filter(c=>c==='orchestration worker-start').length,1,'a live Kernel worker must not be duplicated');
});

test('kernel launch fails closed when its entry Run cannot be created, and starts no worker',async t=>{
  const fx=fixture(t);fx.writeConfig();
  fx.env.STARCI_FAKE_ORCA_MODE='run-create-error';
  const workflowId=await defineGoal(fx);
  const r=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0);
  assert.equal((json(r.stderr)||json(r.stdout))?.step,'run-create');
  assert.equal(fx.calls().includes('orchestration worker-start'),false,'no Kernel without its Run');
  assert.notEqual(jobRow(fx,`kernel-${workflowId}`)?.status,'running');
});

test('a run-create Orca refuses before any effect is recorded as no effect: the singleton is released and the next start boots',async t=>{
  const fx=fixture(t);fx.writeConfig();
  fx.env.STARCI_FAKE_ORCA_MODE='run-create-no-sender';
  const workflowId=await defineGoal(fx);
  const refused=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.notEqual(refused.status,0);
  const failure=json(refused.stderr)||json(refused.stdout);
  assert.equal(failure?.step,'run-create');
  assert.equal(failure?.effectState,'none');
  assert.equal(kernelSignal(fx,workflowId),null,'a proven refusal leaves no launch-unknown signal');
  assert.equal(fx.calls().includes('orchestration worker-start'),false);
  delete fx.env.STARCI_FAKE_ORCA_MODE;
  const retried=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(retried.status,0,retried.stderr);
  assert.ok(json(retried.stdout)?.terminal,'the next start boots the Kernel');
});

test('a start without a sender terminal is refused before any host effect, and --plan reports it',async t=>{
  const fx=fixture(t);fx.writeConfig();
  fx.env.ORCA_TERMINAL_HANDLE='  ';
  const workflowId=await defineGoal(fx);
  const plan=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.equal(plan.status,0,plan.stderr);
  assert.equal(json(plan.stdout)?.sender?.ok,false);
  const before=fx.calls().length;
  const refused=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.notEqual(refused.status,0);
  const failure=json(refused.stdout)||json(refused.stderr);
  assert.equal(failure?.step,'workflow-sender-terminal-missing');
  assert.match(failure?.error??'',/Orca terminal/);
  assert.equal(fx.calls().length,before,'no Orca call, no signal and no worktree before the refusal');
  assert.equal(kernelSignal(fx,workflowId),null);
});

test('kernel launch fails closed when the worker does not attest the requested model, and releases it',async t=>{
  const fx=fixture(t);fx.writeConfig();
  fx.env.STARCI_FAKE_ORCA_EFFECTIVE_MODEL='gpt-6-luna';
  const workflowId=await defineGoal(fx);
  const r=await fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0,'a worker running another model must reject the Kernel boot');
  const failure=json(r.stderr)||json(r.stdout);
  assert.equal(failure?.step,'attestation');
  assert.equal(failure?.requestedModel,'gpt-6.1-sol');
  assert.match(failure?.error??'',/expected agent=codex model=gpt-6\.1-sol, got agent=codex model=gpt-6-luna/);
  assert.ok(fx.calls().includes('orchestration worker-release'),'the mis-attested worker is released');
  const job=jobRow(fx,`kernel-${workflowId}`);
  assert.notEqual(job?.status,'running','an unattested Kernel must never be recorded running');
});

/* ------------------------------------------ worker-start feeds provider health */

test('an unclassified worker-start refusal is a strike; the second one opens the provider circuit',async t=>{
  const fx=fixture(t,{allocationPolicy:'prefer-then-overflow'});
  fx.env.STARCI_FAKE_ORCA_MODE='worker-start-refused';
  const workflowId='wf-worker-start-strikes';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    grantDirs(fx,...[1,2,3].map(n=>`docs/ws-${n}`));
    for(const n of [1,2,3])
      enqueueFixtureJob(ledger,{jobId:`job-ws-${n}`,workflowId,opId:'architecture.decide',kind:'op',
        payload:{opId:'architecture.decide',owned_paths:[`docs/ws-${n}/`],difficulty:'hard'}});
  }finally{ledger.close();}
  seedGoalBias(fx,workflowId,{prefer:[{provider:'claude'}]});

  const dispatchClaude=async jobId=>{
    const routed=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json');
    assert.equal(routed.status,0,routed.stderr||routed.stdout);
    assert.equal(json(routed.stdout)?.decision?.routePolicy,'prefer-then-overflow','the private circuit fixture preserves route order');
    return {routed:json(routed.stdout)?.decision?.model,
      dispatched:await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json')};
  };
  const health=()=>json(providerHealthRow(fx,'claude')?.value_json??'null');
  const unavailableEvents=()=>ledgerRead(fx,db=>db.prepare(
    "SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind='provider-unavailable'").get(workflowId).n);

  const first=await dispatchClaude('job-ws-1');
  assert.equal(first.routed,'claude-agent','precondition: the pool is healthy before the first refusal');
  assert.notEqual(first.dispatched.status,0,'a refused worker-start rejects the dispatch');
  const firstReject=json(first.dispatched.stdout);
  assert.equal(firstReject?.rejection?.status,'ready','effectState none keeps the candidate reusable');
  assert.equal(firstReject?.rejection?.providerHealth,null,'one refusal is a strike, not an outage');
  assert.equal(health()?.status,'striking','the strike is durable so the next refusal can count it');
  assert.equal(health()?.failureKind,'worker-start');
  assert.equal(health()?.failures,1);
  assert.equal(unavailableEvents(),0,'a strike does not announce a provider outage');

  const second=await dispatchClaude('job-ws-2');
  assert.equal(second.routed,'claude-agent','a striking pool is still routable');
  assert.notEqual(second.dispatched.status,0);
  const secondReject=json(second.dispatched.stdout);
  assert.equal(secondReject?.rejection?.providerHealth?.failureKind,'worker-start',
    'the second refusal opens the typed circuit under its own failure kind');
  assert.equal(secondReject?.rejection?.status,'ready','opening a circuit never consumes the attempt');
  assert.equal(health()?.status,'unavailable');
  assert.equal(health()?.failures,2);
  assert.equal(unavailableEvents(),1,'the open circuit is announced exactly once');
  const cooldown=providerHealthRow(fx,'claude')?.expires_at;
  assert.ok(cooldown>Date.now(),'the worker-start circuit carries its declared cooldown');
  assert.ok(cooldown<=Date.now()+120000,'runtimes.yaml allocation.cooldownMs.worker-start owns the number');

  // The point of the circuit: routing stops sending work at the broken pool.
  const third=await fx.run(API,'route','--repo',fx.repo,'--job','job-ws-3','--difficulty','hard','--json');
  assert.equal(third.status,0,third.stderr||third.stdout);
  const decision=json(third.stdout)?.decision;
  assert.notEqual(decision?.model,'claude-agent','route must skip the pool whose launch path is refusing');
  assert.ok(new Set((decision?.routeRejected??[]).map(item=>item.target)).has('claude-agent'),
    'the skipped pool is named with its reason, not silently dropped');
  assert.equal(fx.calls().filter(call=>call==='orchestration worker-start').length,2,
    'no third launch is burned on the circuited pool');
});

test('a circuit that reopens for the same failure waits longer each time (circuitBackoff)',async t=>{
  const fx=fixture(t,{allocationPolicy:'prefer-then-overflow'});
  fx.env.STARCI_FAKE_ORCA_MODE='worker-start-refused';
  const workflowId='wf-worker-start-backoff';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    grantDirs(fx,...[1,2,3,4].map(n=>`docs/bo-${n}`));
    for(const n of [1,2,3,4])
      enqueueFixtureJob(ledger,{jobId:`job-bo-${n}`,workflowId,opId:'architecture.decide',kind:'op',
        payload:{opId:'architecture.decide',owned_paths:[`docs/bo-${n}/`],difficulty:'hard'}});
  }finally{ledger.close();}
  seedGoalBias(fx,workflowId,{prefer:[{provider:'claude'}]});
  const refuse=async jobId=>{
    const routed=await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json');
    assert.equal(routed.status,0,routed.stderr||routed.stdout);
    assert.equal(json(routed.stdout)?.decision?.routePolicy,'prefer-then-overflow','the owner-selected fixture policy is retained across cooldowns');
    assert.equal(json(routed.stdout)?.decision?.model,'claude-agent','each refused launch exercises the same provider before a circuit opens');
    const refused=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
    assert.notEqual(refused.status,0,'the fixture must reach the refused worker start');
  };
  const health=()=>{
    const row=providerHealthRow(fx,'claude');
    return row?{...json(row.value_json),expiresAt:row.expires_at}:null;
  };
  await refuse('job-bo-1');await refuse('job-bo-2');
  const first=health();
  assert.equal(first.status,'unavailable');
  assert.equal(first.trips,1);
  assert.ok(first.cooldownMs<=120000,'the first open circuit waits the base worker-start cooldown');
  // the cooldown passes and the same failure comes back
  const machine=openMachine({file:fx.env.STARCI_TEST_MACHINE_FILE,env:fx.env});
  try{machine.db.prepare('UPDATE provider_health SET circuit_open_until=? WHERE provider=?').run(Date.now()-1,'claude');}finally{machine.close();}
  await refuse('job-bo-3');await refuse('job-bo-4');
  const second=health();
  assert.equal(second.status,'unavailable');
  assert.equal(second.trips,2,'the trip count survives the expired row');
  assert.equal(second.cooldownMs,600000,'base 120000 x factor 5 from runtimes.yaml allocation.circuitBackoff');
  assert.ok(second.expiresAt>Date.now()+500000);
});

test('A7: a rejected managed launch is recorded as evidence, never as the job binding',async t=>{
  const fx=fixture(t,{stale:['claude']});
  const workflowId='wf-a7-rejected-evidence';
  const jobId='job-a7-rejected-evidence';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    enqueueFixtureJob(ledger,{jobId,workflowId,opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
  }finally{ledger.close();}

  fx.env.STARCI_FAKE_ORCA_MODE='auth-unknown';
  assert.equal((await fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json')).status,0);
  assert.notEqual((await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json')).status,0,
    'an unproven launch rejects the dispatch');

  const payload=json(jobRow(fx,jobId)?.payload_json);
  assert.equal(payload?.managed?.dispatchId,undefined,
    'a refused launch never becomes the job’s managed binding — that field means "live", nothing else');
  assert.deepEqual(payload?.rejectedDispatches?.map(entry=>[entry.dispatchId,entry.step,entry.effectState]),
    [['dispatch-fake-1','worker-start','unknown']],
    'the refused launch is kept as evidence with the step that refused it and the effect reconcile must prove away');
  assert.ok(Number.isFinite(payload.rejectedDispatches[0].at));

  // reconcile reads that array where it used to read the overwritten binding.
  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const reconciled=await fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(reconciled.status,0,`reconcile failed: ${reconciled.stderr||reconciled.stdout}`);
  assert.equal(json(reconciled.stdout)?.dispatchId,'dispatch-fake-1',
    'reconcile resolves the launch it must prove from rejectedDispatches[]');
  const after=jobRow(fx,jobId);
  assert.equal(after?.status,'ready');
  const afterPayload=json(after.payload_json);
  assert.equal(afterPayload.rejectedDispatches[0].effectState,'none',
    'a reconciled rejection stays on the record, settled — evidence outlives the state it proved');
  assert.ok(Number.isFinite(afterPayload.rejectedDispatches[0].reconciledAt));
});

// Host tools: an op's route.riskHints host-tool-required:<tool> admits only the
// pools whose agent card lists the tool under capabilities.hostTools.
const seedOp=(fx,workflowId,jobId,opId,payload={})=>{
  const ledger=openLedger({file:fx.ledgerFile});
  try{enqueueFixtureJob(ledger,{jobId,workflowId,opId,kind:'op',payload:{opId,owned_paths:[`.starciwork/features/x/${jobId}`],...payload}});}
  finally{ledger.close();}
};
// The owner's routing_bias on the workflow goal (define-goal): the only bias starci kernel route applies - a Kernel
// --prefer/--avoid is refused as an unknown option (owner decision 2026-09-25).
const seedGoalBias=(fx,workflowId,routingBias)=>{
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    ledger.ensureWorkflow({workflowId,title:'host tools'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({routing_bias:routingBias}),Date.now());
  }finally{ledger.close();}
};

test('route admits only agents that carry the op host tool; with every carrier excluded the route refuses and persists nothing',async t=>{
  const fx=fixture(t);
  fx.writeConfig();
  const wf='wf-host-tools';
  // interface.audit walks the ui order (codex, then devin; owner routing 2026-09-26); the devin and codex cards
  // list browser-dom, and claude-agent is not on the order at all: a prefer for it never puts it there.
  seedGoalBias(fx,wf,{prefer:['claude-agent'],avoid:['devin-agent']});
  seedOp(fx,wf,'job-audit-medium','interface.audit');
  const audit=await fx.run(API,'route','--repo',fx.repo,'--job','job-audit-medium','--difficulty','medium','--json');
  assert.equal(audit.status,0,audit.stderr||audit.stdout);
  const decided=json(audit.stdout);
  assert.equal(decided.decision.model,'codex-agent','the ui order leads with the pool that carries browser-dom');
  assert.ok(!decided.rejected.some(r=>r.target==='claude-agent'),'claude-agent is off the ui order entirely');

  seedOp(fx,wf,'job-draw','interface.draw');
  const draw=await fx.run(API,'route','--repo',fx.repo,'--job','job-draw','--difficulty','medium','--json');
  assert.equal(draw.status,0,draw.stderr||draw.stdout);
  assert.equal(json(draw.stdout).decision.model,'codex-agent','a prefer bias never hoists an agent past a missing tool');

  seedGoalBias(fx,'wf-host-tools-avoid',{prefer:[],avoid:['codex-agent','devin-agent']});
  seedOp(fx,'wf-host-tools-avoid','job-audit-avoid','interface.audit');
  const avoid=await fx.run(API,'route','--repo',fx.repo,'--job','job-audit-avoid','--json');
  assert.equal(avoid.status,1);
  const refusal=json(avoid.stdout);
  assert.equal(refusal.ok,false);
  assert.match(String(refusal.error),/./,'the ui order [codex-agent, devin-agent] is fully excluded by the goal bias: no pool is left');
  assert.equal(json(jobRow(fx,'job-audit-avoid').payload_json).model,undefined,'a refused route persists no decision');
});

test('dispatch --spawn refuses before any Orca call when the routed agent is outside the op order (claude-agent carries no browser-dom)',async t=>{
  const fx=fixture(t);
  fx.writeConfig();
  // Reach the route-order gate with the typed audit input this operation requires.
  seedOp(fx,'wf-host-tools-dispatch','job-audit-codex','interface.audit',{model:'claude-agent',params:{audit:{
    id:'operation.x.host-tools',feature:'x',selectedMatrix:{cells:[
      {id:'host-tools-ready',surface:'host-tools',route:'/',state:'ready',viewport:'desktop',theme:'light',assertionIds:['ui.x.host-tools']},
    ]},
  }}});
  const r=await fx.run(API,'dispatch','--repo',fx.repo,'--job','job-audit-codex','--spawn','--json');
  assert.equal(r.status,1,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.ok(out,r.stderr||r.stdout||'dispatch returned no JSON');
  assert.equal(out.reason,'model-outside-order');
  assert.deepEqual(fx.calls(),[],'nothing reached the host');
  assert.equal(jobRow(fx,'job-audit-codex').status,'queued');
  const dry=json((await fx.run(API,'dispatch','--repo',fx.repo,'--job','job-audit-codex','--json')).stdout);
  assert.match(dry.modelOutsideOrder,/outside/,'the dry run warns instead of refusing');
});

// Mia Mia inc-eb9a21769d69, inc-a253fdf2deda, inc-fbff1e65b60f, inc-d1c5a963c8bb: settle released the
// path lease and closed the Task, but its receipt said "release unknown/retained" for a worker whose
// agent terminal was already disconnected, and each such receipt became an incident. Custody is now
// read back from the exact agent terminal, and --release-worker proves it again idempotently.
test('a dead managed worker settles with custody released from its disconnected terminal; --release-worker is idempotent',async t=>{
  const fx=fixture(t);
  const jobId='job-managed-custody';
  const ledger=openLedger({file:fx.ledgerFile});
  try{
    enqueueFixtureJob(ledger,{jobId:'kernel-wf-custody',workflowId:'wf-custody',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6.1-sol'},hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:'agent:kernel:wf-custody',parentNodeId:'workflow:wf-custody',role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-custody'").run();
    enqueueFixtureJob(ledger,{jobId,workflowId:'wf-custody',opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'claude-agent'}});
  }finally{ledger.close();}
  const d=await fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','claude-agent','--spawn','--json');
  assert.equal(d.status,0,d.stderr||d.stdout);
  // The worker died: its agent terminal is disconnected, and Orca retains the Dispatch it cannot prove stopped.
  const stateFile=fx.env.STARCI_FAKE_ORCA_STATE;
  const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  state.terminals={...(state.terminals??{}),'fake-terminal-1':{handle:'fake-terminal-1',connected:false,writable:false}};
  fs.writeFileSync(stateFile,JSON.stringify(state));
  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const s=await fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','fail','--json');
  assert.equal(s.status,0,s.stderr||s.stdout);
  const worker=json(s.stdout)?.managedWorker;
  assert.equal(worker?.release?.ok,false,'Orca still answers retained');
  assert.deepEqual([worker?.custody?.state,worker?.custody?.proof],['released','terminal-disconnected'],'custody is proven from the exact agent terminal');
  assert.match(s.stdout,/custody/);
  assert.equal(json(jobRow(fx,jobId)?.payload_json)?.managedWorker?.custody?.state,'released','the ledger keeps the proof');
  const r=await fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--release-worker','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=json(r.stdout);
  assert.equal(body?.custody?.state,'released');
  const again=json((await fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--release-worker','--json')).stdout);
  assert.equal(again?.alreadyReleased,true,'a second proof writes nothing');
  const refused=await fx.run(API,'reconcile','--repo',fx.repo,'--job','kernel-wf-custody','--release-worker','--json');
  assert.notEqual(refused.status,0,'a job still running is settle\'s to release');
});

});
