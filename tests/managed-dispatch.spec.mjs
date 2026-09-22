import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// Managed dispatch rides the scripts/api/orca orchestration wrappers
// (runCreate/taskCreate/workerStart/orchDispatch/workerShow/workerStop/
// workerRelease), api.mjs's managed-agent branch and
// scripts/api/quota/index.mjs probeQuota. Kernel boot deliberately does not
// use those orchestration wrappers: every Kernel is a dedicated Orca
// terminal, while operation agents retain their routed managed lifecycle.

const fixture=(t,{dead=[],stale=[]}={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-managed-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot,{recursive:true});
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_FAKE_ORCA_DEAD:dead.join(','),
    STARCI_FAKE_ORCA_STALE:stale.join(','),
    STARCI_OWNER_ROOT:ownerRoot,
  };
  // ownerRoot holds a config.yaml seeded from the shipped example; `kernel`
  // callers may rewrite the pin line.
  const example=fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8');
  const writeConfig=(kernelLine)=>{
    const canonical=kernelLine??'kernel: {agent: codex, model: gpt-6-sol, effort: high}';
    const body=example.replace(/^kernel:.*$/m,canonical);
    assert.match(body,/^kernel:/m,'fixture config keeps the kernel: line');
    fs.writeFileSync(path.join(ownerRoot,'config.yaml'),body);
  };
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const callArgv=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const calls=()=>callArgv().map(argv=>argv.slice(0,2).join(' '));
  return {root,repo,env,run,calls,callArgv,writeConfig};
};

const defineGoal=(fx,text='managed dispatch smoke goal')=>{
  const r=fx.run(DEFINE_GOAL,'--repo',fx.repo,'--text',text,'--json');
  assert.equal(r.status,0,r.stderr);
  const workflowId=json(r.stdout)?.workflowId;
  assert.ok(workflowId,`define-goal returned no workflowId: ${r.stdout}`);
  return workflowId;
};

const jobRow=(repo,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return ledger.db.prepare('SELECT status,worker_id,payload_json,result_json FROM jobs WHERE job_id=?').get(jobId);}
  finally{ledger.close();}
};
const kernelSignal=(repo,workflowId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{
    const row=ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
    return row?.value_json?json(row.value_json):null;
  }finally{ledger.close();}
};
const ledgerRead=(repo,fn)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return fn(ledger.db);}finally{ledger.close();}
};

/* ------------------------------------------------ kernel pin precedence */

test('kernel pin precedence: config selects the agent/model for a dedicated Orca terminal',t=>{
  // The fixture pins kernel {agent: codex, model: gpt-6-sol, effort: high}.
  // A plan must resolve routedBy 'config' without ever asking
  // route-model. Ingress may be any human chat surface; Orca still owns a
  // dedicated Kernel terminal.
  const fx=fixture(t);fx.writeConfig();
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);assert.ok(plan?.plan,`expected a plan, got: ${r.stdout}${r.stderr}`);
  assert.equal(plan.agent,'codex','the shipped Kernel agent pin must decide the seat');
  assert.equal(plan.routedBy,'config');
  assert.equal(plan.executionHost,'orca');
  assert.equal(plan.launch,'terminal');
  assert.equal(plan.model,'gpt-6-sol');
  assert.equal(plan.effort,'high');
  assert.equal(plan.route,undefined,'route-model must not be consulted when the pin decides');
  assert.equal(plan.config?.agent,'codex');
  assert.match(plan.command??'',/\bcodex\b/i);
  assert.match(plan.command??'',/(?:^|\s)--model\s+['"]?gpt-6-sol['"]?(?:\s|$)/i);
  assert.match(plan.command??'',/--ask-for-approval\s+never/);
  assert.match(plan.command??'',/--sandbox\s+danger-full-access/);
  assert.match(plan.command??'',/model_reasoning_effort/);
});

test('kernel pin precedence: --agent flag beats the config pin',t=>{
  const fx=fixture(t);fx.writeConfig(); // example pins codex
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--agent','devin','--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);
  assert.equal(plan.agent,'devin','an explicit --agent flag is the operator override');
  assert.equal(plan.routedBy,'override');
  assert.equal(plan.launch,'terminal');
});

test('kernel pin precedence: an unavailable explicit pin fails closed instead of silently substituting Devin',t=>{
  // The pin is codex; the fake host reports codex dead in `account list`.
  // Kernel identity is an owner decision. Fallback remains legal for routed
  // operations, not for this explicit Kernel pin.
  const fx=fixture(t,{dead:['codex']});fx.writeConfig();
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.notEqual(r.status,0,'an unavailable explicit Kernel pin must fail closed');
  const failure=json(r.stderr)||json(r.stdout);
  assert.equal(failure?.agent,'codex');
  assert.match(failure?.routeError??failure?.error??'',/dead|not authent|unavailable/i);
  assert.doesNotMatch(`${r.stdout}\n${r.stderr}`,/"(?:agent|provider)"\s*:\s*"devin"/i);
});

/* ------------------------------------------- managed dispatch lifecycle */

test('managed dispatch: route persists the decision, spawn marks the job running, settle stops+releases the worker',t=>{
  const fx=fixture(t);
  const jobId='job-managed-1';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:'kernel-wf-managed',workflowId:'wf-managed',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6-sol'},hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:'agent:kernel:wf-managed',parentNodeId:'workflow:wf-managed',role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-managed'").run();
    ledger.enqueueJob({jobId,workflowId:'wf-managed',opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent'}});
  }finally{ledger.close();}

  const r=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
  assert.equal(r.status,0,`managed dispatch failed: ${r.stderr||r.stdout}`);
  const job=jobRow(fx.repo,jobId);
  assert.equal(job?.status,'running',`managed dispatch must mark the job running, got ${job?.status}`);
  assert.equal(job?.worker_id,'dispatch-fake-1','worker_id is the Dispatch id, not a terminal handle');
  // Route persisted the decision: the resolved profile/agent lives on the
  // durable job, not in launcher memory.
  assert.match(job?.payload_json??'',/codex/,`the dispatch decision must be persisted on the job payload: ${job?.payload_json}`);
  const seen=fx.calls();
  for(const step of ['orchestration run-create','orchestration task-create','orchestration worker-start','orchestration dispatch-show','terminal rename','orchestration worker-show'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  assert.equal(seen.includes('orchestration dispatch'),false,
    'worker-start already owns Task injection; a second orchestration dispatch would double-dispatch the operation');
  const calls=fx.callArgv();
  const workerStartCall=calls.find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--agent')+1],'codex',
    'Codex operations use Orca native managed-agent admission, not an unguarded shell command');
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--from')+1],'fake-kernel-terminal',
    'the dedicated Kernel terminal is the explicit Orca Run/worker coordinator');
  const taskCreateCall=calls.find(argv=>argv.slice(0,2).join(' ')==='orchestration task-create');
  assert.equal(taskCreateCall?.[taskCreateCall.indexOf('--run')+1],'run-fake-1');
  assert.equal(taskCreateCall?.includes('--parent'),false,
    'Orca --parent takes a task id; the kernel is a terminal, so the Task hangs under the Run and names the kernel with --from');
  assert.equal(taskCreateCall?.[taskCreateCall.indexOf('--from')+1],'fake-kernel-terminal');
  assert.equal(taskCreateCall?.[taskCreateCall.indexOf('--task-title')+1],'code.refactor #1');
  assert.equal(taskCreateCall?.[taskCreateCall.indexOf('--display-name')+1],'[Op] code.refactor');
  const renameCall=calls.find(argv=>argv.slice(0,2).join(' ')==='terminal rename');
  assert.equal(renameCall?.[renameCall.indexOf('--terminal')+1],'fake-terminal-1');
  assert.equal(renameCall?.[renameCall.indexOf('--title')+1],'[Op] code.refactor',
    'managed worker terminals keep the semantic [Op] title instead of worker-task_<id>');
  const payload=json(job?.payload_json);
  assert.equal(payload?.hierarchy?.parentNodeId,'agent:kernel:wf-managed');
  assert.equal(payload?.hierarchy?.runtime?.runId,'run-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.taskId,'task-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.dispatchId,'dispatch-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.terminalHandle,'fake-terminal-1');

  // A pass is earned from the worker's filed done claim plus an independent
  // green Kernel check. Settle then closes the managed worker through the
  // contract's two-step worker-stop/worker-release lifecycle.
  const report=path.join(fx.repo,'report.json');fs.writeFileSync(report,JSON.stringify({
    schema:'starci/op-report@1',outcome:'done',summary:'managed dispatch completed',
    files:['docs/managed-result.md'],checks:[{name:'self-check',command:'true',exitCode:0}],
  }));
  const filed=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--json');
  assert.equal(filed.status,0,`report failed: ${filed.stderr||filed.stdout}`);
  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({
    checks:[{name:'validator',command:'managed validation',exitCode:0,evidence:'green'}],
  }),'--json');
  assert.equal(checked.status,0,`check failed: ${checked.stderr||checked.stdout}`);
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(s.status,0,`settle failed: ${s.stderr||s.stdout}`);
  const settled=jobRow(fx.repo,jobId);
  assert.equal(settled?.status,'succeeded');
  const after=fx.calls();
  assert.ok(after.includes('orchestration worker-stop'),`settle must worker-stop the dispatch — log: ${after.join(', ')}`);
  assert.ok(after.includes('orchestration worker-release'),`settle must worker-release the dispatch — log: ${after.join(', ')}`);
  // Stopping the worker is not closing the Task. A settled op that leaves its
  // Task open is exactly the ticked [Op] row the owner found at the Orca
  // sidebar root (fable.md orca-hierarchy, row 3).
  assert.ok(after.includes('orchestration task-update'),`settle must close the operation Task — log: ${after.join(', ')}`);
  const update=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='orchestration task-update');
  assert.equal(update?.[update.indexOf('--id')+1],'task-fake-1');
  assert.equal(update?.[update.indexOf('--status')+1],'done');
  assert.equal(update?.[update.indexOf('--run')+1],'run-fake-1');
  assert.equal(update?.[update.indexOf('--from')+1],'fake-kernel-terminal');
  assert.equal(json(s.stdout)?.taskClosed?.ok,true,'the settle receipt records the Task it closed');
  assert.equal(json(jobRow(fx.repo,jobId)?.payload_json)?.taskClosed?.ok,true,
    'and the job payload keeps the proof, so finish does not close it twice');
});

test('finish closes the kernel terminal and every Task the Run still holds open',t=>{
  const fx=fixture(t);
  const workflowId='wf-finish-tree';
  const jobId='job-finish-tree';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    // An op whose Task was opened and whose attempt never reached settle.
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],managed:{runId:'run-fake-1',taskId:'task-orphan-1',dispatchId:'dispatch-fake-1'}}});
    ledger.db.prepare("UPDATE jobs SET status='cancelled' WHERE job_id=?").run(jobId);
  }finally{ledger.close();}

  const finished=fx.run(API,'finish','--repo',fx.repo,'--workflow',workflowId,'--json');
  assert.equal(finished.status,0,finished.stderr||finished.stdout);
  const out=json(finished.stdout);
  assert.equal(out?.phase,'finished');
  assert.deepEqual(out?.tasksClosed?.map(entry=>[entry.jobId,entry.taskId,entry.status,entry.ok]),
    [[jobId,'task-orphan-1','done',true]],'a finish leaves no open Task in the Run');
  assert.equal(out?.kernelTerminal,'fake-kernel-terminal');

  const argv=fx.callArgv();
  const update=argv.find(a=>a.slice(0,2).join(' ')==='orchestration task-update');
  assert.equal(update?.[update.indexOf('--id')+1],'task-orphan-1');
  assert.equal(update?.[update.indexOf('--from')+1],'fake-kernel-terminal','the Task is closed from the kernel that owned it');
  const close=argv.find(a=>a.slice(0,2).join(' ')==='terminal close');
  assert.equal(close?.[close.indexOf('--terminal')+1],'fake-kernel-terminal','the kernel terminal does not outlive the workflow');
  assert.equal(json(jobRow(fx.repo,jobId)?.payload_json)?.taskClosed?.ok,true);
});

test('Claude auth rejection circuits the shared-auth provider for every job and reuses the logical operation attempt',t=>{
  const fx=fixture(t,{stale:['claude']});
  fx.env.STARCI_FAKE_ORCA_MODE='auth';
  const jobId='job-claude-auth-circuit';
  const siblingJobId='job-claude-prerouted-sibling';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:'kernel-wf-claude-auth',workflowId:'wf-claude-auth',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-6-sol'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id='kernel-wf-claude-auth'").run();
    ledger.enqueueJob({jobId,workflowId:'wf-claude-auth',opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
    ledger.enqueueJob({jobId:siblingJobId,workflowId:'wf-claude-auth',opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/sibling/'],difficulty:'hard'}});
  }finally{ledger.close();}

  const firstRoute=fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard',
    '--prefer','claude-agent','--json');
  assert.equal(firstRoute.status,0,firstRoute.stderr||firstRoute.stdout);
  assert.equal(json(firstRoute.stdout)?.decision?.model,'claude-agent',
    'a refreshable stale token is allowed one real launch attempt');
  const siblingRoute=fx.run(API,'route','--repo',fx.repo,'--job',siblingJobId,'--difficulty','hard',
    '--prefer','claude-agent','--json');
  assert.equal(siblingRoute.status,0,siblingRoute.stderr||siblingRoute.stdout);
  assert.equal(json(siblingRoute.stdout)?.decision?.model,'claude-agent','precondition: the sibling route predates the circuit');

  const rejected=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
  assert.notEqual(rejected.status,0,'the fake Claude OAuth rejection must reject the candidate');
  const afterReject=ledgerRead(fx.repo,db=>({
    job:db.prepare('SELECT status,attempt,result_json FROM jobs WHERE job_id=?').get(jobId),
    health:db.prepare("SELECT value_json,expires_at FROM signals WHERE scope='provider-health' AND key='claude'").get(),
    leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
  }));
  assert.equal(afterReject.job?.attempt,1,'provider rejection must not mint a second logical operation attempt');
  assert.equal(afterReject.job?.status,'queued','a proven no-effect auth rejection is safe to route again');
  assert.equal(afterReject.leases,0,'no-effect fallback releases the rejected candidate lease');
  assert.equal(json(afterReject.job?.result_json)?.attemptConsumed,false);
  assert.equal(json(afterReject.health?.value_json)?.status,'unavailable','the shared provider circuit is durable');
  assert.ok(afterReject.health?.expires_at>Date.now(),'the auth circuit carries its declared cooldown');
  const survey=fx.run(API,'survey','--repo',fx.repo,'--workflow','wf-claude-auth','--json');
  assert.equal(survey.status,0,survey.stderr||survey.stdout);
  assert.ok(json(survey.stdout)?.signals?.some(signal=>signal.scope==='provider-health'&&signal.key==='claude'),
    'kernel survey exposes the active provider circuit for durable reasoning');

  const siblingRejected=fx.run(API,'dispatch','--repo',fx.repo,'--job',siblingJobId,'--spawn','--json');
  assert.notEqual(siblingRejected.status,0,'a persisted sibling route must re-check provider health before launch');
  assert.equal(json(siblingRejected.stdout)?.rejection?.status,'queued');
  assert.equal(fx.calls().filter(call=>call==='orchestration worker-start').length,1,
    'the circuit rejects the already-routed sibling before a second Claude worker-start');

  // The circuit, not the chain, decides here: a route that still prefers
  // claude-agent crosses to the other provider while the Claude OAuth is out.
  const fallback=fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard',
    '--prefer','claude-agent','--json');
  assert.equal(fallback.status,0,fallback.stderr||fallback.stdout);
  const decision=json(fallback.stdout)?.decision;
  assert.equal(decision?.model,'codex-agent','fallback must cross the failed auth provider boundary');
  const rejectedTargets=new Set((decision?.routeRejected??[]).map(item=>item.target));
  assert.ok(rejectedTargets.has('claude-agent'),'the Claude pool is excluded by the provider circuit');
  assert.equal(ledgerRead(fx.repo,db=>db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(jobId)?.attempt),1);
});

test('historical workflow incident text cannot poison provider routing',t=>{
  const fx=fixture(t);
  const workflowId='wf-incident-routing';
  const jobId='job-incident-routing';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'scope.define',kind:'op',
      payload:{opId:'scope.define',owned_paths:['docs/'],difficulty:'medium'}});
    ledger.db.prepare(`INSERT INTO incidents(
      incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at
    ) VALUES(?,?,?,0,0,0,0,?,'open',?)`).run(
      'inc-historical-provider-names',workflowId,'scope.define',
      'Recovered dispatch attempts mentioned codex and claude; no provider outage remains.',Date.now(),
    );
  }finally{ledger.close();}

  const routed=fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','medium','--json');
  assert.equal(routed.status,0,routed.stderr||routed.stdout);
  assert.ok(json(routed.stdout)?.decision?.model,
    'routing must use typed provider-health signals, not arbitrary incident prose');
});

test('Claude auth fallback advances only after partial effects reconcile and never on unknown effects',t=>{
  const exercise=(mode,suffix)=>{
    const fx=fixture(t,{stale:['claude']});
    fx.env.STARCI_FAKE_ORCA_MODE=mode;
    const workflowId=`wf-claude-${suffix}`;
    const jobId=`job-claude-${suffix}`;
    const ledger=openLedger({file:ledgerFileFor(fx.repo)});
    try{
      ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
      ledger.db.prepare('UPDATE jobs SET status=\'running\',worker_id=\'fake-kernel-terminal\' WHERE job_id=?').run(`kernel-${workflowId}`);
      ledger.enqueueJob({jobId,workflowId,opId:'architecture.decide',kind:'op',
        payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
    }finally{ledger.close();}
    const routed=fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json');
    assert.equal(routed.status,0,routed.stderr||routed.stdout);
    const rejected=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
    assert.notEqual(rejected.status,0);
    return {fx,jobId,result:ledgerRead(fx.repo,db=>({
      job:db.prepare('SELECT status,attempt,result_json FROM jobs WHERE job_id=?').get(jobId),
      leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
    }))};
  };

  const partial=exercise('auth-partial','partial');
  assert.equal(partial.result.job.status,'queued','settled residual resources reduce partial to proven no-effect');
  assert.equal(json(partial.result.job.result_json)?.effectState,'none');
  assert.equal(partial.result.leases,0);
  assert.ok(partial.fx.calls().includes('orchestration worker-stop'));
  assert.ok(partial.fx.calls().includes('orchestration worker-release'));
  // A refusal leaves nothing running, and says so on the record.
  assert.equal(json(partial.result.job.result_json)?.terminalClosed,true);
  assert.equal(json(partial.result.job.result_json)?.closed?.dispatchId,'dispatch-fake-1');

  const unknown=exercise('auth-unknown','unknown');
  assert.equal(unknown.result.job.status,'effect_unknown','a ready worker observation blocks provider fallback');
  assert.equal(json(unknown.result.job.result_json)?.effectState,'unknown');
  assert.equal(unknown.result.leases,1,'unknown effects keep the operation fence in place');
  assert.equal(unknown.fx.calls().includes('orchestration worker-stop'),false,'unknown readiness is not killed from a guess');
  assert.equal(unknown.fx.calls().includes('orchestration worker-release'),false);
  assert.equal(json(unknown.result.job.result_json)?.terminalClosed,false,
    'an unreconciled worker is outstanding, not quietly assumed gone');
  assert.equal(json(unknown.result.job.result_json)?.closed?.deferred,'reconcile-then-stop');
});

test('a dispatch refused after the worker exists closes that worker in the same rejection',t=>{
  // fable.md orca-hierarchy row 2: interface.audit a4 was rejected at
  // worker-start and its terminal stayed open, so the sidebar kept an "Idle"
  // [Op] row under the kernel for a job the ledger had already failed.
  const fx=fixture(t);
  fx.env.STARCI_FAKE_ORCA_MODE='auth-partial';
  const workflowId='wf-reject-closes';
  const jobId='job-reject-closes';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent'}});
  }finally{ledger.close();}

  const rejected=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
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

  const event=ledgerRead(fx.repo,db=>db.prepare(
    "SELECT payload_json FROM events WHERE workflow_id=? AND kind='dispatch-rejected'").get(workflowId));
  const payload=json(event?.payload_json);
  assert.equal(payload?.terminalClosed,true,'dispatch-rejected carries the proof');
  assert.equal(payload?.closed?.kind,'managed');
  assert.equal(payload?.closed?.dispatchId,'dispatch-fake-1');
  // Lane G's evidence list is untouched by the containment.
  const job=jobRow(fx.repo,jobId);
  const rejectedDispatches=json(job?.payload_json)?.rejectedDispatches??[];
  assert.equal(rejectedDispatches.length,1);
  assert.equal(rejectedDispatches[0].dispatchId,'dispatch-fake-1');
});

test('managed prompt stall with exact exited worker is retried as the same logical attempt',t=>{
  const fx=fixture(t);
  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const workflowId='wf-prompt-stalled';
  const jobId='job-prompt-stalled';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
  }finally{ledger.close();}

  const routed=fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json');
  assert.equal(routed.status,0,routed.stderr||routed.stdout);
  const rejected=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json');
  assert.notEqual(rejected.status,0,'the launch still reports a rejected dispatch to the Kernel');
  const state=ledgerRead(fx.repo,db=>({
    job:db.prepare('SELECT status,attempt,worker_id,result_json FROM jobs WHERE job_id=?').get(jobId),
    leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
    contracts:db.prepare('SELECT COUNT(*) n FROM contracts WHERE workflow_id=?').get(workflowId).n,
  }));
  assert.equal(state.job.status,'queued','exact exited prompt-stall is a reusable infrastructure launch');
  assert.equal(state.job.attempt,1,'retry preserves the logical attempt');
  assert.equal(state.job.worker_id,null);
  assert.equal(json(state.job.result_json)?.effectState,'none');
  assert.equal(json(state.job.result_json)?.attemptConsumed,false);
  assert.equal(state.leases,0);
  assert.equal(state.contracts,0,'prompt stalled before an operation contract was accepted');
  assert.ok(fx.calls().includes('orchestration worker-release'));
  assert.ok(fx.calls().includes('orchestration worker-show'));
});

test('reconcile converts a fenced effect_unknown prompt stall into the same queued job',t=>{
  const fx=fixture(t,{stale:['claude']});
  const workflowId='wf-late-reconcile';
  const jobId='job-late-reconcile';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
  }finally{ledger.close();}

  fx.env.STARCI_FAKE_ORCA_MODE='auth-unknown';
  assert.equal(fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json').status,0);
  assert.notEqual(fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json').status,0);
  const fenced=ledgerRead(fx.repo,db=>db.prepare('SELECT status,attempt,worker_id FROM jobs WHERE job_id=?').get(jobId));
  assert.equal(fenced.status,'effect_unknown');
  assert.equal(fenced.attempt,1);

  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const reconciled=fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(reconciled.status,0,reconciled.stderr||reconciled.stdout);
  assert.equal(json(reconciled.stdout)?.reconciled,true);
  const state=ledgerRead(fx.repo,db=>({
    job:db.prepare('SELECT status,attempt,worker_id,result_json FROM jobs WHERE job_id=?').get(jobId),
    leases:db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(jobId).n,
  }));
  assert.equal(state.job.status,'queued');
  assert.equal(state.job.attempt,1);
  assert.equal(state.job.worker_id,null);
  assert.equal(json(state.job.result_json)?.reason,'dispatch-reconciled');
  assert.equal(json(state.job.result_json)?.attemptConsumed,false);
  assert.equal(state.leases,0);
});

/* -------------------------------------------- dedicated Kernel terminal */

test('kernel launch: Codex boots in a dedicated Orca terminal and never creates an orchestration run',t=>{
  const fx=fixture(t);fx.writeConfig(); // shipped pin: codex / gpt-6-sol / high
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(r.status,0,`Kernel terminal launch failed: ${r.stderr||r.stdout}`);
  const out=json(r.stdout);
  assert.equal(out?.agent,'codex');
  assert.equal(out?.routedBy,'config');
  assert.equal(out?.executionHost,'orca');
  assert.equal(out?.launch,'terminal');
  assert.equal(out?.terminal,'fake-terminal-1');
  assert.equal(out?.dispatch,undefined);
  assert.equal(out?.run,undefined);
  assert.equal(out?.model,'gpt-6-sol');
  assert.equal(out?.modelAttested,true);
  const job=jobRow(fx.repo,`kernel-${workflowId}`);
  assert.equal(job?.status,'running');
  assert.equal(job?.worker_id,'fake-terminal-1','the Kernel job persists its dedicated terminal handle');
  assert.match(job?.payload_json??'',/"model":\s*"gpt-6-sol"/);
  assert.deepEqual(kernelSignal(fx.repo,workflowId),{
    terminal:'fake-terminal-1',host:'orca',agent:'codex',routedBy:'config',
    model:'gpt-6-sol',effort:'high',launch:'terminal',modelAttested:true,
  });
  const seen=fx.calls();
  for(const step of ['terminal create','terminal read','terminal send'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  assert.equal(seen.some(step=>step.startsWith('orchestration ')),false,
    `Kernel boot must not require run-create/task-create/worker-start — log: ${seen.join(', ')}`);
  const create=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='terminal create');
  const command=create?.[create.indexOf('--command')+1]??'';
  assert.match(command,/\bcodex\b/i);
  assert.match(command,/(?:^|\s)--model\s+['"]?gpt-6-sol['"]?(?:\s|$)/i);
  assert.match(command,/--ask-for-approval\s+never/);
  assert.match(command,/--sandbox\s+danger-full-access/);
  assert.match(command,/model_reasoning_effort/);

  // A second start must not double the seat: the terminal handle is the
  // persisted, probed Kernel identity.
  const again=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(again.status,0,again.stderr);
  assert.equal(json(again.stdout)?.replaced,false);
  const starts=fx.calls().filter(c=>c==='terminal create').length;
  assert.equal(starts,1,'a live Kernel terminal must not be duplicated');
});

test('kernel launch is independent of orchestration run-create launcher context',t=>{
  const fx=fixture(t);fx.writeConfig();
  fx.env.STARCI_FAKE_ORCA_MODE='run-create-error';
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(r.status,0,`Kernel boot must not call run-create: ${r.stderr||r.stdout}`);
  assert.equal(fx.calls().includes('orchestration run-create'),false);
  assert.equal(json(r.stdout)?.terminal,'fake-terminal-1');
});

test('kernel launch fails closed when the terminal does not attest the requested model',t=>{
  const fx=fixture(t);fx.writeConfig();
  fx.env.STARCI_FAKE_ORCA_EFFECTIVE_MODEL='gpt-6-luna';
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0,'a different rendered model must reject the Kernel boot');
  const failure=json(r.stderr)||json(r.stdout);
  assert.equal(failure?.step,'model-attestation');
  assert.equal(failure?.requestedModel,'gpt-6-sol');
  assert.match(failure?.error??'',/gpt-6-sol|model/i);
  const job=jobRow(fx.repo,`kernel-${workflowId}`);
  assert.notEqual(job?.status,'running','an unattested Kernel must never be recorded running');
});

/* ------------------------------------------ worker-start feeds provider health */

test('an unclassified worker-start refusal is a strike; the second one opens the provider circuit',t=>{
  const fx=fixture(t);
  fx.env.STARCI_FAKE_ORCA_MODE='worker-start-refused';
  const workflowId='wf-worker-start-strikes';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    for(const n of [1,2,3])
      ledger.enqueueJob({jobId:`job-ws-${n}`,workflowId,opId:'architecture.decide',kind:'op',
        payload:{opId:'architecture.decide',owned_paths:[`docs/ws-${n}/`],difficulty:'hard'}});
  }finally{ledger.close();}

  const dispatchClaude=jobId=>{
    const routed=fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--prefer','claude-agent','--json');
    assert.equal(routed.status,0,routed.stderr||routed.stdout);
    return {routed:json(routed.stdout)?.decision?.model,
      dispatched:fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json')};
  };
  const health=()=>ledgerRead(fx.repo,db=>json(
    db.prepare("SELECT value_json FROM signals WHERE scope='provider-health' AND key='claude'").get()?.value_json??'null'));
  const unavailableEvents=()=>ledgerRead(fx.repo,db=>db.prepare(
    "SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind='provider-unavailable'").get(workflowId).n);

  const first=dispatchClaude('job-ws-1');
  assert.equal(first.routed,'claude-agent','precondition: the pool is healthy before the first refusal');
  assert.notEqual(first.dispatched.status,0,'a refused worker-start rejects the dispatch');
  const firstReject=json(first.dispatched.stdout);
  assert.equal(firstReject?.rejection?.status,'queued','effectState none keeps the candidate reusable');
  assert.equal(firstReject?.rejection?.providerHealth,null,'one refusal is a strike, not an outage');
  assert.equal(health()?.status,'striking','the strike is durable so the next refusal can count it');
  assert.equal(health()?.failureKind,'worker-start');
  assert.equal(health()?.failures,1);
  assert.equal(unavailableEvents(),0,'a strike does not announce a provider outage');

  const second=dispatchClaude('job-ws-2');
  assert.equal(second.routed,'claude-agent','a striking pool is still routable');
  assert.notEqual(second.dispatched.status,0);
  const secondReject=json(second.dispatched.stdout);
  assert.equal(secondReject?.rejection?.providerHealth?.failureKind,'worker-start',
    'the second refusal opens the typed circuit under its own failure kind');
  assert.equal(secondReject?.rejection?.status,'queued','opening a circuit never consumes the attempt');
  assert.equal(health()?.status,'unavailable');
  assert.equal(health()?.failures,2);
  assert.equal(unavailableEvents(),1,'the open circuit is announced exactly once');
  const cooldown=ledgerRead(fx.repo,db=>db.prepare(
    "SELECT expires_at FROM signals WHERE scope='provider-health' AND key='claude'").get()?.expires_at);
  assert.ok(cooldown>Date.now(),'the worker-start circuit carries its declared cooldown');
  assert.ok(cooldown<=Date.now()+120000,'runtimes.yaml allocation.cooldownMs.worker-start owns the number');

  // The point of the circuit: routing stops sending work at the broken pool.
  const third=fx.run(API,'route','--repo',fx.repo,'--job','job-ws-3','--difficulty','hard','--prefer','claude-agent','--json');
  assert.equal(third.status,0,third.stderr||third.stdout);
  const decision=json(third.stdout)?.decision;
  assert.notEqual(decision?.model,'claude-agent','route must skip the pool whose launch path is refusing');
  assert.ok(new Set((decision?.routeRejected??[]).map(item=>item.target)).has('claude-agent'),
    'the skipped pool is named with its reason, not silently dropped');
  assert.equal(fx.calls().filter(call=>call==='orchestration worker-start').length,2,
    'no third launch is burned on the circuited pool');
});

test('A7: a rejected managed launch is recorded as evidence, never as the job binding',t=>{
  const fx=fixture(t,{stale:['claude']});
  const workflowId='wf-a7-rejected-evidence';
  const jobId='job-a7-rejected-evidence';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',payload:{}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?")
      .run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'architecture.decide',kind:'op',
      payload:{opId:'architecture.decide',owned_paths:['docs/'],difficulty:'hard'}});
  }finally{ledger.close();}

  fx.env.STARCI_FAKE_ORCA_MODE='auth-unknown';
  assert.equal(fx.run(API,'route','--repo',fx.repo,'--job',jobId,'--difficulty','hard','--json').status,0);
  assert.notEqual(fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--spawn','--json').status,0,
    'an unproven launch rejects the dispatch');

  const payload=json(jobRow(fx.repo,jobId)?.payload_json);
  assert.equal(payload?.managed?.dispatchId,undefined,
    'a refused launch never becomes the job’s managed binding — that field means "live", nothing else');
  assert.deepEqual(payload?.rejectedDispatches?.map(entry=>[entry.dispatchId,entry.step,entry.effectState]),
    [['dispatch-fake-1','worker-start','unknown']],
    'the refused launch is kept as evidence with the step that refused it and the effect reconcile must prove away');
  assert.ok(Number.isFinite(payload.rejectedDispatches[0].at));

  // reconcile reads that array where it used to read the overwritten binding.
  fx.env.STARCI_FAKE_ORCA_MODE='prompt-stalled';
  const reconciled=fx.run(API,'reconcile','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(reconciled.status,0,`reconcile failed: ${reconciled.stderr||reconciled.stdout}`);
  assert.equal(json(reconciled.stdout)?.dispatchId,'dispatch-fake-1',
    'reconcile resolves the launch it must prove from rejectedDispatches[]');
  const after=jobRow(fx.repo,jobId);
  assert.equal(after?.status,'queued');
  const afterPayload=json(after.payload_json);
  assert.equal(afterPayload.rejectedDispatches[0].effectState,'none',
    'a reconciled rejection stays on the record, settled — evidence outlives the state it proved');
  assert.ok(Number.isFinite(afterPayload.rejectedDispatches[0].reconciledAt));
});

// Host tools: an op's route.riskHints host-tool-required:<tool> admits only the
// pools whose agent card lists the tool under capabilities.hostTools.
const seedOp=(fx,workflowId,jobId,opId,payload={})=>{
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{ledger.enqueueJob({jobId,workflowId,opId,kind:'op',payload:{opId,owned_paths:[`.starciwork/features/x/${jobId}`],...payload}});}
  finally{ledger.close();}
};

test('route admits only agents that carry the op host tool; none at the difficulty refuses tool-unavailable',t=>{
  const fx=fixture(t);
  fx.writeConfig();
  const wf='wf-host-tools';
  seedOp(fx,wf,'job-audit-medium','interface.audit');
  const audit=fx.run(API,'route','--repo',fx.repo,'--job','job-audit-medium','--difficulty','medium','--json');
  assert.equal(audit.status,0,audit.stderr||audit.stdout);
  const decided=json(audit.stdout);
  assert.equal(decided.decision.model,'devin-agent','browser-dom is on the devin card only');
  assert.ok(decided.rejected.some(r=>r.target==='codex-agent'&&/lacks host tool 'browser-dom'/.test(r.reason)),
    `codex must be rejected for the tool, got ${JSON.stringify(decided.rejected)}`);

  seedOp(fx,wf,'job-draw','interface.draw');
  const draw=fx.run(API,'route','--repo',fx.repo,'--job','job-draw','--difficulty','medium','--prefer','devin-agent','--json');
  assert.equal(draw.status,0,draw.stderr||draw.stdout);
  assert.equal(json(draw.stdout).decision.model,'codex-agent','a prefer bias never hoists an agent past a missing tool');

  seedOp(fx,wf,'job-audit-easy','interface.audit');
  const easy=fx.run(API,'route','--repo',fx.repo,'--job','job-audit-easy','--difficulty','easy','--json');
  assert.equal(easy.status,1);
  const refusal=json(easy.stdout);
  assert.equal(refusal.reason,'tool-unavailable');
  assert.deepEqual(refusal.tools,['browser-dom']);
  assert.match(refusal.detail,/devin-agent \(difficulty medium\|hard\)/);
  assert.match(refusal.detail,/Re-run api route --job job-audit-easy with --difficulty/);
  assert.equal(json(jobRow(fx.repo,'job-audit-easy').payload_json).model,undefined,'a refused route persists no decision');
});

test('dispatch --spawn refuses tool-unavailable before any Orca call when the routed agent lacks the tool',t=>{
  const fx=fixture(t);
  fx.writeConfig();
  seedOp(fx,'wf-host-tools-dispatch','job-audit-codex','interface.audit',{model:'codex-agent'});
  const r=fx.run(API,'dispatch','--repo',fx.repo,'--job','job-audit-codex','--spawn','--json');
  assert.equal(r.status,1);
  const out=json(r.stdout);
  assert.equal(out.reason,'tool-unavailable');
  assert.deepEqual(out.tools,['browser-dom']);
  assert.match(out.detail,/Re-run api route --job job-audit-codex/);
  assert.deepEqual(fx.calls(),[],'nothing reached the host');
  assert.equal(jobRow(fx.repo,'job-audit-codex').status,'queued');
  const dry=json(fx.run(API,'dispatch','--repo',fx.repo,'--job','job-audit-codex','--json').stdout);
  assert.match(dry.toolUnavailable,/spawn will refuse tool-unavailable/,'the dry run warns instead of refusing');
});
