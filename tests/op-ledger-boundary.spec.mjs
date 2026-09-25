import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {buildSpawnCommand,envPrefix} from '../scripts/agent/lib.mjs';

// Incident inc-360891316369 (starci-next base-repos, backend.scaffold seam attempt 11): an op worker ran
// node:sqlite against .starciwork/runtime.sqlite to inspect jobs. The contract forbade it; the owner wants
// it enforced. The op launch carries no ledger path and a role marker (STARCI_ROLE=op, STARCI_OP_JOB), Orca's
// ORCA_TERMINAL_HANDLE identifies a managed worker whose env StarCi cannot set, and api refuses every kernel
// verb from an op caller and files `report` only for the caller's own job. Raw file reads stay a documented
// residual (modules/kernel/api.yaml conventions.callerBoundary).
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-op-boundary-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  const base={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile};
  // The suite may itself run inside an Orca or op terminal: start from a caller with no identity.
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete base[key];
  const api=(args,env={})=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...base,...env}});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const wf='wf-op-boundary',jobId='job-op-boundary',otherJob='job-op-sibling',managedJob='job-op-managed';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${wf}`,workflowId:wf,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${wf}`,parentNodeId:`workflow:${wf}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${wf}`);
    ledger.enqueueJob({jobId,workflowId:wf,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
    ledger.enqueueJob({jobId:otherJob,workflowId:wf,opId:'docs.author',kind:'op',payload:{opId:'docs.author',owned_paths:['notes/']}});
    // A managed (worker-start) op: its agent terminal handle is on the payload, its env is Orca's.
    ledger.enqueueJob({jobId:managedJob,workflowId:wf,opId:'docs.author',kind:'op',attempt:2,payload:{opId:'docs.author',owned_paths:['guides/'],
      managed:{dispatchId:'ctx_managed_1',agentTerminalHandle:'term_managed_1',runId:'run-fake-1'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='ctx_managed_1' WHERE job_id=?").run(managedJob);
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {root,repo,wf,jobId,otherJob,managedJob,api,orcaState,read};
};

test('the op launch command carries the role marker and the op packet names no ledger file',t=>{
  // Unit: the marker is set in the terminal's own shell before the agent starts.
  assert.equal(envPrefix({STARCI_ROLE:'op',STARCI_OP_JOB:'op-x-1'},'win32'),"$env:STARCI_ROLE='op'; $env:STARCI_OP_JOB='op-x-1';");
  assert.equal(envPrefix({STARCI_ROLE:'op',STARCI_OP_JOB:'op-x-1'},'posix'),"export STARCI_ROLE='op'; export STARCI_OP_JOB='op-x-1';");
  assert.equal(envPrefix({bad:'x',STARCI_OP_JOB:"a'b"},'posix'),'','unsafe keys and values are dropped, never quoted around');
  const built=buildSpawnCommand({provider:'codex',model:'gpt-6-sol',env:{STARCI_ROLE:'op',STARCI_OP_JOB:'op-x-1'}});
  assert.match(built.command,/^(?:\$env:STARCI_ROLE='op'; \$env:STARCI_OP_JOB='op-x-1';|export STARCI_ROLE='op'; export STARCI_OP_JOB='op-x-1';) /);

  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const command=fx.orcaState().commands[0];
  assert.match(command,/STARCI_ROLE='op'/);
  assert.ok(command.includes(`STARCI_OP_JOB='${fx.jobId}'`),command);
  const contract=fx.read(db=>db.prepare('SELECT markdown,context_json FROM contracts WHERE workflow_id=? AND op_id=?').get(fx.wf,'code.refactor'));
  assert.doesNotMatch(contract.markdown,/runtime\.sqlite/,'the op prompt names no ledger file');
  assert.doesNotMatch(contract.context_json,/runtime\.sqlite/,'nor does the packet context');
  assert.match(contract.markdown,/never open, query or copy a ledger file/);
});

test('an op caller is refused every kernel verb; reads and its own report pass the gate',t=>{
  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const asOp={STARCI_ROLE:'op',STARCI_OP_JOB:fx.jobId};
  const kernelCalls=[
    ['settle','--job',fx.jobId,'--verdict','fail'],
    ['check','--job',fx.jobId,'--checks','{"checks":[{"name":"x","exitCode":0}]}'],
    ['enqueue','--workflow',fx.wf,'--op','docs.author','--paths','other/'],
    ['dispatch','--job',fx.otherJob],
    ['route','--job',fx.otherJob],
    ['reconcile','--job',fx.otherJob,'--drop','--reason','x'],
    ['consume-report','--job',fx.jobId],
    ['incident','--workflow',fx.wf,'--kind','x','--detail','y'],
    ['finish','--workflow',fx.wf],
    ['nudge','--job',fx.jobId],
    ['reply','--workflow',fx.wf,'--message','m','--body','b'],
  ];
  for(const args of kernelCalls){
    const r=fx.api(args,asOp);
    assert.equal(r.status,1,`${args[0]} must be refused from an op`);
    const refusal=lastLine(r.stderr);
    assert.equal(refusal?.code,'op-context-refused',`${args[0]}: ${r.stderr}`);
    assert.deepEqual([refusal.caller.jobId,refusal.caller.via],[fx.jobId,'env-role']);
  }
  const state=fx.read(db=>({
    job:db.prepare('SELECT status FROM jobs WHERE job_id=?').get(fx.jobId).status,
    jobs:db.prepare('SELECT count(*) n FROM jobs').get().n,
    phase:db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(fx.wf).phase,
    incidents:db.prepare('SELECT count(*) n FROM incidents').get().n,
    refused:db.prepare("SELECT count(*) n FROM events WHERE kind='op-caller-refused' AND entity_id=?").get(fx.jobId).n,
  }));
  assert.deepEqual([state.job,state.jobs,state.incidents],['running',4,0],'nothing the refused verbs would write was written');
  assert.notEqual(state.phase,'finished');
  assert.equal(state.refused,kernelCalls.length,'every refusal leaves a receipt on the op job');

  // Reads stay open to an op.
  assert.equal(fx.api(['status','--workflow',fx.wf],asOp).status,0);
  assert.equal(fx.api(['op-contract','--job',fx.jobId],asOp).status,0);

  // report: another job's is refused; its own passes the gate and files.
  const reportFile=path.join(fx.root,'report.json');
  fs.writeFileSync(reportFile,JSON.stringify({outcome:'failed',summary:'boundary spec',files:[],checks:[]}));
  const foreign=fx.api(['report','--job',fx.otherJob,'--report',reportFile],asOp);
  assert.equal(foreign.status,1);
  assert.equal(lastLine(foreign.stderr).code,'report-identity-mismatch');
  const own=fx.api(['report','--job',fx.jobId,'--report',reportFile],asOp);
  assert.equal(own.status,0,own.stderr);
  assert.equal(fx.read(db=>db.prepare('SELECT outcome FROM reports WHERE workflow_id=?').get(fx.wf).outcome),'failed');

  // The Kernel (no op identity) still settles.
  const settled=fx.api(['settle','--job',fx.jobId,'--verdict','fail']);
  assert.equal(settled.status,0,settled.stderr);
});

test('Orca\'s terminal handle identifies an op whose env StarCi could not set (managed worker-start)',t=>{
  const fx=fixture(t);
  const asManaged={ORCA_TERMINAL_HANDLE:'term_managed_1'};
  const refused=fx.api(['settle','--job',fx.managedJob,'--verdict','fail'],asManaged);
  assert.equal(refused.status,1);
  assert.deepEqual([lastLine(refused.stderr).code,lastLine(refused.stderr).caller.via,lastLine(refused.stderr).caller.jobId],
    ['op-context-refused','terminal-handle',fx.managedJob]);
  const foreign=fx.api(['report','--job',fx.jobId,'--report','x.json'],asManaged);
  assert.equal(lastLine(foreign.stderr).code,'report-identity-mismatch');
  // The bound terminal outranks the env marker: naming another job in STARCI_OP_JOB does not make the caller that job.
  const spoofed=fx.api(['report','--job',fx.jobId,'--report','x.json'],{...asManaged,STARCI_ROLE:'op',STARCI_OP_JOB:fx.jobId});
  assert.deepEqual([lastLine(spoofed.stderr).code,lastLine(spoofed.stderr).caller?.jobId],['report-identity-mismatch',fx.managedJob]);
  // A terminal that is no op's (the Kernel's own, or the owner's) is not an op caller.
  const kernel=fx.api(['incident','--workflow',fx.wf,'--kind','note','--detail','kernel may write'],{ORCA_TERMINAL_HANDLE:'fake-kernel-terminal'});
  assert.equal(kernel.status,0,kernel.stderr);
});
