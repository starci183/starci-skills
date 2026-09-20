import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const ORCA_DIR=path.join(ROOT,'scripts','api','orca');
const QUOTA_MODULE=path.join(ROOT,'scripts','api','quota','index.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// Managed dispatch rides pinned sibling lanes: the scripts/api/orca
// orchestration wrappers (runCreate/taskCreate/workerStart/orchDispatch/
// workerShow/workerStop/workerRelease exports), api.mjs's managed-agent
// branch and scripts/api/quota/index.mjs probeQuota. Kernel boot deliberately
// does not use those orchestration wrappers: every Kernel is a dedicated Orca
// terminal, while operation agents retain their routed managed lifecycle.
const ORCH=await (async()=>{
  const fns={};
  for(const f of fs.readdirSync(ORCA_DIR).filter(f=>f.endsWith('.mjs')).sort()){
    try{Object.assign(fns,await import(pathToFileURL(path.join(ORCA_DIR,f)).href));}catch{/* half-landed lane */}
  }
  return fns;
})();
const ORCH_LANDED=['runCreate','taskCreate','workerStart','orchDispatch','workerShow','workerStop','workerRelease']
  .every(n=>typeof ORCH[n]==='function');
const API_SRC=fs.readFileSync(API,'utf8');
const MANAGED_DISPATCH_LANDED=ORCH_LANDED&&/cmdDispatchManaged|MANAGED_KINDS/.test(API_SRC);
const QUOTA_LANDED=fs.existsSync(QUOTA_MODULE);
const skipDispatch=MANAGED_DISPATCH_LANDED?false:'managed dispatch lane has not landed yet (orchestration wrappers missing, or api.mjs still refuses kind managed-agent)';
const skipQuota=QUOTA_LANDED?false:'quota probe lane (scripts/api/quota/index.mjs) has not landed yet — probeQuota(agent) is required for explicit-pin fail-closed coverage';

const fixture=(t,{dead=[]}={})=>{
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
    STARCI_OWNER_ROOT:ownerRoot,
  };
  // ownerRoot holds a config.yaml seeded from the shipped example; `kernel`
  // callers may rewrite the pin line.
  const example=fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8');
  const writeConfig=(kernelLine)=>{
    const canonical=kernelLine??'kernel: {agent: codex, model: gpt-5.6-sol, effort: high}';
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

/* ------------------------------------------------ kernel pin precedence */

test('kernel pin precedence: config selects the agent/model for a dedicated Orca terminal',t=>{
  // The fixture pins kernel {agent: codex, model: gpt-5.6-sol, effort: high}.
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
  assert.equal(plan.model,'gpt-5.6-sol');
  assert.equal(plan.effort,'high');
  assert.equal(plan.route,undefined,'route-model must not be consulted when the pin decides');
  assert.equal(plan.config?.agent,'codex');
  assert.match(plan.command??'',/\bcodex\b/i);
  assert.match(plan.command??'',/(?:^|\s)--model\s+['"]?gpt-5\.6-sol['"]?(?:\s|$)/i);
  assert.match(plan.command??'',/--ask-for-approval\s+never/);
  assert.match(plan.command??'',/--sandbox\s+danger-full-access/);
  assert.match(plan.command??'',/model_reasoning_effort/);
});

test('kernel pin precedence: --provider flag beats the config pin',t=>{
  const fx=fixture(t);fx.writeConfig(); // example pins codex
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--provider','devin','--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);
  assert.equal(plan.agent,'devin','an explicit --provider compatibility flag is the operator override');
  assert.equal(plan.routedBy,'override');
  assert.equal(plan.launch,'terminal');
});

test('kernel pin precedence: an unavailable explicit pin fails closed instead of silently substituting Devin',{skip:skipQuota},t=>{
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

test('managed dispatch: route persists the decision, spawn marks the job running, settle stops+releases the worker',{skip:skipDispatch},t=>{
  const fx=fixture(t);
  const jobId='job-managed-1';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:'kernel-wf-managed',workflowId:'wf-managed',kind:'kernel',role:'kernel',
      payload:{route:{host:'orca',agent:'codex',model:'gpt-5.6-sol'},hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:'agent:kernel:wf-managed',parentNodeId:'workflow:wf-managed',role:'kernel'}}});
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
  for(const step of ['orchestration run-create','orchestration task-create','orchestration worker-start','orchestration dispatch-show','orchestration worker-show'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  assert.equal(seen.includes('orchestration dispatch'),false,
    'worker-start already owns Task injection; a second orchestration dispatch would double-dispatch the operation');
  const calls=fx.callArgv();
  const workerStartCall=calls.find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.equal(workerStartCall?.[workerStartCall.indexOf('--from')+1],'fake-kernel-terminal',
    'the dedicated Kernel terminal is the explicit Orca Run/worker coordinator');
  const payload=json(job?.payload_json);
  assert.equal(payload?.hierarchy?.parentNodeId,'agent:kernel:wf-managed');
  assert.equal(payload?.hierarchy?.runtime?.runId,'run-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.taskId,'task-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.dispatchId,'dispatch-fake-1');
  assert.equal(payload?.hierarchy?.runtime?.terminalHandle,'fake-terminal-1');

  // Settle closes the managed worker through the contract's two-step
  // settlement: worker-stop then worker-release on the same Dispatch.
  const report=path.join(fx.repo,'report.md');fs.writeFileSync(report,'# verdict\n');
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--report',report,'--json');
  assert.equal(s.status,0,`settle failed: ${s.stderr||s.stdout}`);
  const settled=jobRow(fx.repo,jobId);
  assert.equal(settled?.status,'succeeded');
  const after=fx.calls();
  assert.ok(after.includes('orchestration worker-stop'),`settle must worker-stop the dispatch — log: ${after.join(', ')}`);
  assert.ok(after.includes('orchestration worker-release'),`settle must worker-release the dispatch — log: ${after.join(', ')}`);
});

/* -------------------------------------------- dedicated Kernel terminal */

test('kernel launch: Codex boots in a dedicated Orca terminal and never creates an orchestration run',t=>{
  const fx=fixture(t);fx.writeConfig(); // shipped pin: codex / gpt-5.6-sol / high
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
  assert.equal(out?.model,'gpt-5.6-sol');
  assert.equal(out?.modelAttested,true);
  const job=jobRow(fx.repo,`kernel-${workflowId}`);
  assert.equal(job?.status,'running');
  assert.equal(job?.worker_id,'fake-terminal-1','the Kernel job persists its dedicated terminal handle');
  assert.match(job?.payload_json??'',/"model":\s*"gpt-5\.6-sol"/);
  assert.deepEqual(kernelSignal(fx.repo,workflowId),{
    terminal:'fake-terminal-1',host:'orca',agent:'codex',routedBy:'config',
    model:'gpt-5.6-sol',effort:'high',launch:'terminal',modelAttested:true,
  });
  const seen=fx.calls();
  for(const step of ['terminal create','terminal read','terminal send'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  assert.equal(seen.some(step=>step.startsWith('orchestration ')),false,
    `Kernel boot must not require run-create/task-create/worker-start — log: ${seen.join(', ')}`);
  const create=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='terminal create');
  const command=create?.[create.indexOf('--command')+1]??'';
  assert.match(command,/\bcodex\b/i);
  assert.match(command,/(?:^|\s)--model\s+['"]?gpt-5\.6-sol['"]?(?:\s|$)/i);
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
  fx.env.STARCI_FAKE_ORCA_EFFECTIVE_MODEL='gpt-5.6-terra';
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0,'a different rendered model must reject the Kernel boot');
  const failure=json(r.stderr)||json(r.stdout);
  assert.equal(failure?.step,'model-attestation');
  assert.equal(failure?.requestedModel,'gpt-5.6-sol');
  assert.match(failure?.error??'',/gpt-5\.6-sol|model/i);
  const job=jobRow(fx.repo,`kernel-${workflowId}`);
  assert.notEqual(job?.status,'running','an unattested Kernel must never be recorded running');
});
