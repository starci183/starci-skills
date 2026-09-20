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
// branch and scripts/api/quota/index.mjs probeQuota. Until they land the
// lifecycle tests skip; the kernel-pin tests run today (plan never launches).
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
const skipOrch=ORCH_LANDED?false:'orchestration wrappers (runCreate/taskCreate/workerStart/orchDispatch/workerShow/…) have not landed in scripts/api/orca yet';
const skipDispatch=MANAGED_DISPATCH_LANDED?false:'managed dispatch lane has not landed yet (orchestration wrappers missing, or api.mjs still refuses kind managed-agent)';
const skipQuota=QUOTA_LANDED?false:'quota probe lane (scripts/api/quota/index.mjs) has not landed yet — probeQuota(provider) is required for the dead-pin fallthrough';

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
    const body=kernelLine?example.replace(/^kernel:.*$/m,kernelLine):example;
    assert.match(body,/^kernel:/m,'fixture config keeps the kernel: line');
    fs.writeFileSync(path.join(ownerRoot,'config.yaml'),body);
  };
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const calls=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l).argv.slice(0,2).join(' '))
    :[];
  return {root,repo,env,run,calls,writeConfig};
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

/* ------------------------------------------------ kernel pin precedence */

test('kernel pin precedence: config.yaml kernel.provider wins over route-model',t=>{
  // config.example.yaml ships kernel {provider: codex, model: gpt-5.6-sol,
  // effort: high} — a plan must resolve routedBy 'config' without ever asking
  // route-model, and the codex card makes the launch managed.
  const fx=fixture(t);fx.writeConfig();
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);assert.ok(plan?.plan,`expected a plan, got: ${r.stdout}${r.stderr}`);
  assert.equal(plan.provider,'codex','the shipped kernel pin must decide the seat');
  assert.equal(plan.routedBy,'config');
  assert.equal(plan.launch,'managed-orchestration','codex is a native-managed-agent card — no terminal spawn');
  assert.equal(plan.model,'gpt-5.6-sol');
  assert.equal(plan.effort,'high');
  assert.equal(plan.route,undefined,'route-model must not be consulted when the pin decides');
  assert.equal(plan.config?.provider,'codex');
});

test('kernel pin precedence: --provider flag beats the config pin',t=>{
  const fx=fixture(t);fx.writeConfig(); // example pins codex
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--provider','devin','--plan','--json');
  assert.equal(r.status,0,r.stderr);
  const plan=json(r.stdout);
  assert.equal(plan.provider,'devin','an explicit --provider is the operator override');
  assert.equal(plan.routedBy,'override');
  assert.equal(plan.launch,'command-terminal');
});

test('kernel pin precedence: an unauthenticated pin falls through with a warning',{skip:skipQuota},t=>{
  // The pin is codex; the fake host reports codex dead in `account list`. The
  // pin must be ignored — printed warning, route continues to the next
  // eligible pool — and the workflow must never fail on the pin itself.
  const fx=fixture(t,{dead:['codex']});fx.writeConfig();
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--plan','--json');
  assert.equal(r.status,0,`an unauthed pin must not fail the plan: ${r.stderr}`);
  const plan=json(r.stdout);assert.ok(plan?.plan,`expected a plan, got: ${r.stdout}${r.stderr}`);
  assert.notEqual(plan.routedBy,'config','a dead pin must not decide the seat');
  assert.notEqual(plan.provider,'codex','routing must land on a different, live provider');
  const warnings=[...(plan.warnings??[]),r.stderr].join('\n');
  assert.match(warnings,/codex/,`the printed warning must name the ignored pin's provider: ${warnings}`);
  assert.match(warnings,/dead|not authent/i,`the warning must say the probe was dead: ${warnings}`);
  assert.equal(plan.config?.pinIgnored?.provider,'codex');
});

/* ------------------------------------------- managed dispatch lifecycle */

test('managed dispatch: route persists the decision, spawn marks the job running, settle stops+releases the worker',{skip:skipDispatch},t=>{
  const fx=fixture(t);
  const jobId='job-managed-1';
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId,workflowId:'wf-managed',opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent'}});
  }finally{ledger.close();}

  const r=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
  assert.equal(r.status,0,`managed dispatch failed: ${r.stderr||r.stdout}`);
  const job=jobRow(fx.repo,jobId);
  assert.equal(job?.status,'running',`managed dispatch must mark the job running, got ${job?.status}`);
  assert.equal(job?.worker_id,'dispatch-fake-1','worker_id is the Dispatch id, not a terminal handle');
  // Route persisted the decision: the resolved target/provider lives on the
  // durable job, not in launcher memory.
  assert.match(job?.payload_json??'',/codex/,`the dispatch decision must be persisted on the job payload: ${job?.payload_json}`);
  const seen=fx.calls();
  for(const step of ['orchestration run-create','orchestration task-create','orchestration worker-start','orchestration dispatch-show','orchestration dispatch','orchestration worker-show'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);

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

/* ------------------------------------------- managed kernel launch ----- */

test('managed kernel launch: a native-managed pin runs the orchestration sequence and worker_id is the dispatch id',{skip:skipOrch},t=>{
  const fx=fixture(t);fx.writeConfig(); // shipped pin: codex / gpt-5.6-sol / high
  const workflowId=defineGoal(fx);
  const r=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(r.status,0,`managed kernel launch failed: ${r.stderr||r.stdout}`);
  const out=json(r.stdout);
  assert.equal(out?.provider,'codex');
  assert.equal(out?.routedBy,'config');
  assert.equal(out?.launch,'managed');
  assert.equal(out?.dispatch,'dispatch-fake-1');
  assert.equal(out?.run,'run-fake-1');
  const job=jobRow(fx.repo,`kernel-${workflowId}`);
  assert.equal(job?.status,'running');
  assert.equal(job?.worker_id,'dispatch-fake-1','the kernel job binds the Dispatch id as worker_id');
  assert.match(job?.payload_json??'',/"runId":\s*"run-fake-1"/,'the bound run id must persist in the kernel job payload (orca.runId — the same key api.mjs dispatch reads)');
  const seen=fx.calls();
  for(const step of ['orchestration run-create','orchestration task-create','orchestration worker-start','orchestration dispatch','orchestration worker-show'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);

  // A second start must not double the seat: the managed signal is proven
  // live through worker-show, not a terminal handle.
  const again=fx.run(START_WORKFLOW,'--repo',fx.repo,'--goal',workflowId,'--json');
  assert.equal(again.status,0,again.stderr);
  assert.equal(json(again.stdout)?.replaced,false);
  const starts=fx.calls().filter(c=>c==='orchestration worker-start').length;
  assert.equal(starts,1,'a live managed kernel must not spawn a second worker');
});
