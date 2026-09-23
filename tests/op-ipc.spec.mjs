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

// The op-IPC layer lives in scripts/kernel/api.mjs.
//
// Contract under test:
//   api dispatch --spawn            writes a contracts row (markdown,
//                                   dispatch_id), one lease row per owned_path
//                                   (resource_key 'path:<normalized p>'), sets
//                                   workflows.phase='running' and emits
//                                   'phase-transition'
//   api report --job --outcome --report <file>
//                                   upserts reports UNIQUE(workflow_id,
//                                   dispatch_id); emits 'report-filed'
//   api op-contract --job           prints the contracts row markdown
//   api check --job --checks <json> upserts checks PK(workflow_id,op_id,
//                                   attempt); emits 'checks-recorded'
//   api consume-report --job        sets reports.consumed_at
//   api settle                      sets reports.consumed_at for the job's
//                                   dispatch and deletes its lease rows

const WORKFLOW='wf-op-ipc';
const OP='code.refactor';
const OWNED=['docs/','src/op-ipc.txt'];
const checkEnvelope=(...checks)=>({checks});
import {normalizeOwnedPath} from '../engine/admission.mjs';

const fixture=(t,{mode='healthy'}={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-op-ipc-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:mode,
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    // machine.sqlite (the settle path's best-effort paired release) stays inside
    // the temp world — never the real arbiter.
    LOCALAPPDATA:path.join(root,'localappdata'),
  };
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
  return {root,repo,env,run};
};

// Every handle is opened and closed inside the helper — a leaked sqlite handle
// EPERMs the t.after rm on Windows (same lesson as _ledger-fixture trackHandles).
const enqueue=(fx,jobId='job-op-ipc-1')=>{
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId,workflowId:WORKFLOW,opId:OP,kind:'op',
      payload:{opId:OP,owned_paths:OWNED,model:'qwen-agent'}});
    // start-workflow.mjs enrols a workflow at phase 'queued' and dispatch's
    // transitionQueuedToRunning is guarded on it — reproduce the precondition.
    ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(WORKFLOW);
  }finally{ledger.close();}
  return jobId;
};
const inspect=(fx,fn)=>{
  const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
  try{return fn(ledger.db);}finally{ledger.close();}
};
const jobRow=(fx,jobId)=>inspect(fx,db=>db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
const contractRows=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT * FROM contracts WHERE workflow_id=?').all(wf));
const reportRows=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT * FROM reports WHERE workflow_id=?').all(wf));
const checkRows=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT * FROM checks WHERE workflow_id=?').all(wf));
const leaseRows=(fx,jobId)=>inspect(fx,db=>db.prepare('SELECT * FROM leases WHERE job_id=?').all(jobId));
const eventKinds=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT kind FROM events WHERE workflow_id=? ORDER BY seq').all(wf).map(r=>r.kind));
const phaseOf=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf)?.phase??null);

const dispatch=(fx,jobId)=>fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','qwen-agent','--spawn','--json');
const dispatchRunning=(fx,jobId)=>{
  const r=dispatch(fx,jobId);
  assert.equal(r.status,0,`command-terminal dispatch against healthy fake-orca must succeed: ${r.stderr||r.stdout}`);
  const job=jobRow(fx,jobId);
  assert.equal(job?.status,'running',`dispatch must mark the job running, got ${job?.status}`);
  assert.ok(job?.worker_id,'a dispatched job binds its worker/terminal id');
  return {r,job};
};
// The report file is a starci/op-report@1 JSON envelope — api report validates
// it and stamps run/task/dispatch/from from the job row.
const writeEnvelope=(fx,{outcome='done',sentinel='SENTINEL-ALPHA',name='report-1.json',extra={},files=['src/op-ipc.txt']}={})=>{
  const file=path.join(fx.repo,name);
  fs.writeFileSync(file,JSON.stringify({
    schema:'starci/op-report@1',outcome,summary:`op ${outcome} — ${sentinel}`,
    files,checks:[{name:'self-check',command:'true',exitCode:0}],
    ...(outcome==='partial'?{open:['one unfinished item']}:{}),
    // OP commits (commitPolicy), so api report requires head on done|partial.
    ...(['done','partial'].includes(outcome)?{head:'abc1234def'}:{}),
    ...(outcome==='ask'?{question:{text:'which way?',options:['a','b']}}:{}),
    ...(outcome==='blocked'?{blocker:{kind:'environment',detail:'dep missing'}}:{}),
    ...extra,
  }));
  return file;
};
// `api report --json` prints its emit() object and then the human rendering of
// the filed row; the object is the leading JSON value.
const emitted=stdout=>{
  const open=stdout.indexOf('{');
  const close=stdout.indexOf('\n}');
  return open<0||close<0?null:JSON.parse(stdout.slice(open,close+2));
};
const fileReport=(fx,jobId,opts={})=>{
  const file=writeEnvelope(fx,opts);
  const r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',file,'--json');
  assert.equal(r.status,0,`api report (${opts.outcome??'done'}) failed: ${r.stderr||r.stdout}`);
  return r;
};

/* ------------------------------------------- dispatch writes the IPC half */

test('op-IPC dispatch: contracts row, one path: lease per owned_path, phase=running and a phase-transition event',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  const {job}=dispatchRunning(fx,jobId);

  // The contract is the dispatch authority — written durably at dispatch, never
  // reconstructed from the terminal prompt.
  const contract=contractRows(fx)[0];
  assert.ok(contract,'dispatch must write a contracts row');
  assert.equal(contract.op_id,OP);
  assert.equal(contract.attempt,job.attempt,'the contract keys to the job attempt');
  assert.ok(contract.markdown?.trim(),'contract markdown must be non-empty');
  assert.ok(contract.dispatch_id,'the contract row names the dispatch it was written for');
  const payload=JSON.parse(job.payload_json);
  assert.equal(payload?.orca?.runId,'run-fake-1');
  assert.equal(payload?.orca?.taskId,'task-fake-1');
  assert.equal(payload?.orca?.dispatchId,contract.dispatch_id,
    'command-terminal jobs keep the terminal handle for cleanup but key reports/contracts to the Orca Dispatch');
  assert.equal(payload?.orca?.agentTerminalHandle,job.worker_id);
  assert.equal(payload?.hierarchy?.parentNodeId,`agent:kernel:${WORKFLOW}`);
  assert.equal(payload?.hierarchy?.runtime?.dispatchId,contract.dispatch_id);
  const calls=fs.readFileSync(fx.env.STARCI_FAKE_ORCA_LOG,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line).argv.slice(0,2).join(' '));
  for(const step of ['orchestration run-create','orchestration task-create','terminal create','orchestration dispatch'])
    assert.ok(calls.includes(step),`command-terminal hierarchy never called '${step}' — log: ${calls.join(', ')}`);

  // Every owned_path is fenced in the ledger the worker runs against.
  const keys=leaseRows(fx,jobId).map(l=>l.resource_key).sort();
  assert.deepEqual(keys,OWNED.map(p=>`path:${normalizeOwnedPath(p)}`).sort(),'each owned_path gets a path: lease row');

  assert.equal(phaseOf(fx), 'running', 'dispatch claims phase=running on the workflow');
  const kinds=eventKinds(fx);
  assert.ok(kinds.includes('phase-transition'),`dispatch must emit a phase-transition event — saw: ${kinds.join(', ')}`);
  assert.ok(kinds.includes('op-dispatched'),`the dispatch receipt event is still required — saw: ${kinds.join(', ')}`);
});

/* ------------------------------------------------ worker → kernel: report */

test('api report upserts the dispatch report; api op-contract prints the stored markdown',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  dispatchRunning(fx,jobId);
  const contract=contractRows(fx)[0];

  fileReport(fx,jobId,{outcome:'done',sentinel:'SENTINEL-ALPHA',name:'report-1.md'});
  let rows=reportRows(fx);
  assert.equal(rows.length,1,'the first report files exactly one row');
  assert.equal(rows[0].outcome,'done');
  assert.ok(rows[0].dispatch_id,'the report is keyed to a dispatch');
  assert.equal(rows[0].dispatch_id,contract.dispatch_id,'the report binds the same dispatch the contract was written for');
  assert.match(rows[0].report_json??'',/SENTINEL-ALPHA/,'report_json carries the filed report body');
  assert.equal(rows[0].consumed_at,null,'a fresh report is unconsumed');

  // UNIQUE(workflow_id,dispatch_id): a second report for the same dispatch is
  // an upsert — one row, new content.
  fileReport(fx,jobId,{outcome:'partial',sentinel:'SENTINEL-BETA',name:'report-2.md'});
  rows=reportRows(fx);
  assert.equal(rows.length,1,'a second report for the same dispatch must upsert, not append');
  assert.equal(rows[0].outcome,'partial');
  assert.match(rows[0].report_json,/SENTINEL-BETA/);
  assert.doesNotMatch(rows[0].report_json,/SENTINEL-ALPHA/,'the upserted row holds the new body, not the old');
  assert.ok(eventKinds(fx).includes('report-filed'),'api report must emit the report-filed event');

  // api op-contract is the worker's read of its own contract: the row markdown.
  const oc=fx.run(API,'op-contract','--repo',fx.repo,'--job',jobId);
  assert.equal(oc.status,0,`api op-contract failed: ${oc.stderr||oc.stdout}`);
  assert.equal(oc.stdout.trim(),contract.markdown.trim(),'op-contract must print the stored contract markdown verbatim');
});

test('api report immediately wakes an idle Kernel after committing the durable report',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-report-wake');
  dispatchRunning(fx,jobId);

  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    const now=Date.now();
    ledger.db.prepare("INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,?,?,?,NULL)")
      .run(WORKFLOW,null,'kernel-token',JSON.stringify({terminal:'kernel-terminal-1'}),now);
  }finally{ledger.close();}
  // Dispatch prompt delivery increments the fake transport's counter. Reset it
  // so terminal-read projects the provider input prompt (turn-idle), which is
  // the exact state report filing is allowed to wake.
  fs.writeFileSync(fx.env.STARCI_FAKE_ORCA_STATE,JSON.stringify({
    sends:0,terminalCommand:'codex --model gpt-6-sol',terminalModel:'gpt-6-sol',
  }));

  fileReport(fx,jobId,{outcome:'done',sentinel:'WAKE-KERNEL'});
  const state=JSON.parse(fs.readFileSync(fx.env.STARCI_FAKE_ORCA_STATE,'utf8'));
  assert.equal(state.sends,1,'report-filed must send one event wake to the idle Kernel terminal');
  assert.ok(eventKinds(fx).includes('kernel-transition-woken'),'the wake receipt must be durable for audit');
  assert.equal(reportRows(fx).length,1,'the report remains authoritative even though wake is transport-only');
});

/* ------------------------------------- consume-report + checks durability */

test('api consume-report marks the dispatch report consumed; api check upserts the checks row',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  const {job}=dispatchRunning(fx,jobId);
  fileReport(fx,jobId);

  const c=fx.run(API,'consume-report','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(c.status,0,`api consume-report failed: ${c.stderr||c.stdout}`);
  assert.ok(reportRows(fx)[0]?.consumed_at,'consume-report must set reports.consumed_at');

  const first=checkEnvelope(
    {name:'lint',command:'npm run lint',exitCode:0,evidence:'lint passed'},
    {name:'tests',command:'npm test',exitCode:0,evidence:'tests passed'},
  );
  const k1=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(first),'--json');
  assert.equal(k1.status,0,`api check failed: ${k1.stderr||k1.stdout}`);
  let rows=checkRows(fx);
  assert.equal(rows.length,1,'api check writes one checks row per attempt');
  assert.equal(rows[0].op_id,OP);
  assert.equal(rows[0].attempt,job.attempt,'checks key to the job attempt');
  assert.deepEqual(JSON.parse(rows[0].checks_json),first);

  // Same PK (workflow_id,op_id,attempt): a re-run check upserts.
  const rerun=checkEnvelope(
    {name:'lint',command:'npm run lint',exitCode:0,evidence:'lint passed'},
    {name:'tests',command:'npm test',exitCode:1,evidence:'tests failed'},
  );
  const k2=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(rerun),'--json');
  assert.equal(k2.status,0,`api check (re-run) failed: ${k2.stderr||k2.stdout}`);
  rows=checkRows(fx);
  assert.equal(rows.length,1,'a second check for the same attempt must upsert, not append');
  assert.equal(JSON.parse(rows[0].checks_json).checks[1].exitCode,1);
  assert.ok(eventKinds(fx).includes('checks-recorded'),'api check must emit the checks-recorded event');
});

test('api check rejects scalar and double-encoded payloads before recording evidence',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-check-shape');
  const valid=checkEnvelope({name:'validator',command:'starci validate',exitCode:0,evidence:'green'});

  for(const malformed of [JSON.stringify('pass'),JSON.stringify(JSON.stringify(valid))]){
    const refused=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',malformed,'--json');
    assert.notEqual(refused.status,0,'scalar and double-encoded JSON must be refused');
    assert.match(`${refused.stderr}${refused.stdout}`,/checks-invalid/);
    assert.equal(checkRows(fx).length,0,'a refused check payload must not mutate the checks row');
  }

  dispatchRunning(fx,jobId);
  fileReport(fx,jobId,{outcome:'done',name:'check-shape-report.json'});
  const accepted=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(valid),'--json');
  assert.equal(accepted.status,0,accepted.stderr||accepted.stdout);
  const body=JSON.parse(accepted.stdout);
  assert.equal(body.checks,1);
  assert.deepEqual(body.checkEvidence,{observed:1,passed:1,failed:0,green:true});
  assert.deepEqual(JSON.parse(checkRows(fx)[0].checks_json),valid);
});

test('queued jobs cannot self-file reports, record green checks, or settle pass without an operation dispatch',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-undispatched-claim');
  const report=writeEnvelope(fx,{outcome:'done',name:'undispatched-report.json'});
  const checks=JSON.stringify(checkEnvelope({name:'validator',command:'starci validate',exitCode:0,evidence:'green'}));

  const filed=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--json');
  assert.notEqual(filed.status,0,'a queued job must not impersonate its missing Op worker');
  assert.match(`${filed.stderr}${filed.stdout}`,/report-job-not-active/);
  assert.equal(reportRows(fx).length,0,'a refused queued report must not create a report row');

  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',checks,'--json');
  assert.notEqual(checked.status,0,'Kernel checks cannot manufacture a worker report boundary');
  assert.match(`${checked.stderr}${checked.stdout}`,/report-job-not-active/);
  assert.equal(checkRows(fx).length,0,'a refused queued check must not create check evidence');

  const settled=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.notEqual(settled.status,0,'an undispatched queued job cannot settle pass');
  assert.match(`${settled.stderr}${settled.stdout}`,/report-job-not-active/);
  assert.equal(jobRow(fx,jobId)?.status,'queued');
});

/* ------------------------------------------------------ settle integrates */

test('settle consumes the dispatch report and releases every owned-path lease',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  dispatchRunning(fx,jobId);
  fileReport(fx,jobId);
  assert.equal(reportRows(fx)[0].consumed_at,null,'precondition: the report is unconsumed before settle');

  const verdictReport=path.join(fx.repo,'verdict-report.md');
  fs.writeFileSync(verdictReport,'# verdict\npass\n');
  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(checkEnvelope({name:'validator',exitCode:0})),'--json');
  assert.equal(checked.status,0,`api check failed: ${checked.stderr||checked.stdout}`);
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--report',verdictReport,'--json');
  assert.equal(s.status,0,`settle failed: ${s.stderr||s.stdout}`);
  assert.equal(jobRow(fx,jobId)?.status,'succeeded');
  assert.ok(reportRows(fx)[0]?.consumed_at,'settle must set consumed_at on the job dispatch report');
  assert.equal(leaseRows(fx,jobId).length,0,'settle releases the owned-path leases');
});

/* ------------------------------------ regression: a rejection claims nothing */

test('dispatch-rejected regression: a dead provider claims no contract, no leases, no running phase',t=>{
  const fx=fixture(t,{mode:'auth'}); // fake-orca serves the observed 401 death screen
  const jobId=enqueue(fx,'job-op-ipc-rejected');
  const r=dispatch(fx,jobId);
  assert.notEqual(r.status,0,'a dead provider screen must reject the dispatch');

  const job=jobRow(fx,jobId);
  assert.equal(job?.status,'queued','a proven no-effect rejection returns the same durable attempt to the queue');
  assert.equal(job?.attempt,1,'a no-effect infrastructure rejection reuses the logical operation attempt');
  assert.match(job?.result_json??'',/dispatch-rejected/);
  assert.equal(JSON.parse(job.result_json).attemptConsumed,false,'infrastructure rejection does not consume business retry budget');
  assert.equal(contractRows(fx).length,0,'a rejected dispatch must not claim a contract');
  assert.equal(leaseRows(fx,jobId).length,0,'a rejected dispatch holds no leases');
  assert.notEqual(phaseOf(fx),'running','a rejected dispatch must not claim phase=running');
  assert.ok(eventKinds(fx).includes('dispatch-rejected'),'the dispatch-rejected event is the audit record');
});

/* -------------------------------------- op-report@1 envelope enforcement */

test('api report enforces the starci/op-report@1 envelope',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  dispatchRunning(fx,jobId);

  // A bare markdown dump is not an answer — the envelope is the only shape.
  const bad=path.join(fx.repo,'bad.md');fs.writeFileSync(bad,'# op report\nlooks done\n');
  let r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',bad,'--json');
  assert.notEqual(r.status,0,'a non-envelope report must be refused');
  assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);

  // Conditional payloads: partial without open[], files outside owned_paths.
  const noOpen=path.join(fx.repo,'noopen.json');fs.writeFileSync(noOpen,JSON.stringify({outcome:'partial',summary:'x'}));
  r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',noOpen,'--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);assert.match(`${r.stderr}${r.stdout}`,/open\[\]/);

  const escaped=path.join(fx.repo,'escaped.json');fs.writeFileSync(escaped,JSON.stringify({outcome:'done',summary:'x',files:['../outside.txt']}));
  r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',escaped,'--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);assert.match(`${r.stderr}${r.stdout}`,/outside owned_paths/);

  // Identity is the job's, not the worker's claim.
  const forged=path.join(fx.repo,'forged.json');fs.writeFileSync(forged,JSON.stringify({outcome:'done',summary:'x',dispatch:'someone-else'}));
  r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',forged,'--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);assert.match(`${r.stderr}${r.stdout}`,/identity 'dispatch'/);

  // A --outcome flag contradicting the envelope is refused.
  const good=writeEnvelope(fx,{outcome:'done',name:'good.json'});
  r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',good,'--outcome','blocked','--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/outcome-mismatch/);

  // The row carries the stamped identity + the exact outcome the kernel reads.
  r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',good,'--json');
  assert.equal(r.status,0,`valid envelope refused: ${r.stderr||r.stdout}`);
  const row=reportRows(fx)[0];
  const stored=JSON.parse(row.report_json);
  assert.equal(stored.schema,'starci/op-report@1');
  assert.equal(stored.from,jobId,'from is stamped from the job row');
  assert.equal(stored.dispatch,row.dispatch_id,'dispatch is stamped to the worker handle');
  assert.equal(row.outcome,'done');
});

/* ------------------------------------------------ kernel reads the answer */

test('api status projects filed reports; settle works row-first without --report and enforces verdict↔outcome',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  dispatchRunning(fx,jobId);
  fileReport(fx,jobId,{outcome:'done'});

  // `api status` is how the kernel learns the op finished and with what result.
  const st=fx.run(API,'status','--repo',fx.repo,'--workflow',WORKFLOW,'--json');
  assert.equal(st.status,0,st.stderr);
  const reports=JSON.parse(st.stdout).reports??[];
  assert.ok(reports.some(r=>r.job_id===jobId&&r.outcome==='done'&&!r.consumed_at),`status must surface the filed unconsumed report — got ${JSON.stringify(reports)}`);

  // A verdict that contradicts the filed outcome is refused.
  const bad=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','blocked','--json');
  assert.notEqual(bad.status,0,'verdict blocked cannot settle a done report');
  assert.match(`${bad.stderr}${bad.stdout}`,/verdict-outcome-mismatch/);

  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(checkEnvelope({name:'validator',exitCode:0})),'--json');
  assert.equal(checked.status,0,checked.stderr||checked.stdout);

  // Settle consumes the row — no --report needed; the row is the verdict.
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(s.status,0,`row-first settle failed: ${s.stderr||s.stdout}`);
  const settled=JSON.parse(s.stdout);
  assert.equal(settled.reportFiled,true);
  assert.equal(settled.reportOutcome,'done');
  assert.equal(jobRow(fx,jobId)?.status,'succeeded');
  assert.ok(reportRows(fx)[0]?.consumed_at);
});

test('a red Kernel check overrules an Op done claim, settles fail, and releases the worker',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-red-done');
  dispatchRunning(fx,jobId);
  fileReport(fx,jobId,{outcome:'done',name:'red-done.json'});
  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(checkEnvelope(
    {name:'required-validator',command:'starci validate',exitCode:1,evidence:'failed'},
    {name:'bounded-assertion',exitCode:0,evidence:'passed'},
  )),'--json');
  assert.equal(checked.status,0,checked.stderr||checked.stdout);

  const settled=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','fail','--json');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  const body=JSON.parse(settled.stdout);
  assert.equal(body.claimOverruled,true,'Kernel evidence must outrank the worker claim');
  assert.ok(body.checkEvidence.failed>0);
  assert.equal(jobRow(fx,jobId)?.status,'failed');
  assert.equal(leaseRows(fx,jobId).length,0,'failed settlement releases the operation lease');
});

/* ----------------------------- A7: a rejected dispatch never shadows a live one */

// Patch the job payload the way rejectDispatch leaves it: the launch that was
// refused goes on rejectedDispatches[], and whatever managed binding the row
// already had is NOT written over.
const patchPayload=(fx,jobId,patch)=>{
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    const row=ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId);
    ledger.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?')
      .run(JSON.stringify({...JSON.parse(row.payload_json),...patch}),jobId);
  }finally{ledger.close();}
};

test('A7: a report binds to the contracts row, never to a dispatch that was rejected',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-a7');
  dispatchRunning(fx,jobId);
  const live=contractRows(fx)[0].dispatch_id;

  // The incident: worker-start refused ctx_rejected_A before any contract, the
  // retry ran under the live dispatch, and the job payload still named A.
  patchPayload(fx,jobId,{
    managed:{dispatchId:'ctx_rejected_A'},
    rejectedDispatches:[{dispatchId:'ctx_rejected_A',step:'worker-start',at:Date.now(),effectState:'none'}],
  });

  const filed=fileReport(fx,jobId,{outcome:'done',sentinel:'A7-LIVE',name:'a7-live.json'});
  assert.equal(emitted(filed.stdout)?.dispatchId,live,
    'the contracts row for this attempt is the binding — a stale payload cannot strand a valid report');
  assert.equal(reportRows(fx)[0].dispatch_id,live);

  // A report that claims the rejected dispatch is refused under its own name.
  const forged=path.join(fx.repo,'a7-forged.json');
  fs.writeFileSync(forged,JSON.stringify({schema:'starci/op-report@1',outcome:'done',
    summary:'claiming the dead dispatch',files:['src/op-ipc.txt'],
    checks:[{name:'self-check',command:'true',exitCode:0}],dispatch:'ctx_rejected_A'}));
  const refused=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',forged,'--json');
  assert.notEqual(refused.status,0,'a rejected dispatch is evidence, never an identity to file under');
  assert.match(`${refused.stderr}${refused.stdout}`,/report-invalid/);
  assert.match(`${refused.stderr}${refused.stdout}`,/identity 'dispatch'/);
  assert.equal(reportRows(fx).length,1,'the refused claim never reaches the row');

  // check and settle resolve the same binding, so the attempt can finish.
  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,
    '--checks',JSON.stringify(checkEnvelope({name:'validator',exitCode:0})),'--json');
  assert.equal(checked.status,0,`api check must bind to the live dispatch: ${checked.stderr||checked.stdout}`);
  const settled=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(settled.status,0,`api settle must bind to the live dispatch: ${settled.stderr||settled.stdout}`);
  assert.equal(jobRow(fx,jobId)?.status,'succeeded');
  assert.ok(reportRows(fx)[0]?.consumed_at,'settle consumed the report filed under the live dispatch');
});

test('A7: a job whose only dispatch was rejected binds nothing at all',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-a7-unbound');
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
  }finally{ledger.close();}
  patchPayload(fx,jobId,{
    managed:{dispatchId:'ctx_rejected_only'},
    rejectedDispatches:[{dispatchId:'ctx_rejected_only',step:'worker-start',at:Date.now(),effectState:'none'}],
  });

  const report=writeEnvelope(fx,{outcome:'done',name:'a7-unbound.json'});
  const refused=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--json');
  assert.notEqual(refused.status,0,'a refused launch is not a binding to file against');
  assert.match(`${refused.stderr}${refused.stdout}`,/report-dispatch-unbound/);
  assert.equal(reportRows(fx).length,0);
});

/* ------------------------------------- an ask is a wait on the owner, not a failure */

test('an ask settles awaiting-owner: no business attempt spent, projected apart from failures',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-ask');
  dispatchRunning(fx,jobId);
  fileReport(fx,jobId,{outcome:'ask',name:'ask.json'});
  const askDispatch=reportRows(fx)[0].dispatch_id;

  const settled=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','blocked','--json');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.equal(JSON.parse(settled.stdout).awaitingOwner,true);
  const row=jobRow(fx,jobId);
  assert.equal(row.status,'failed','jobs.status keeps the vocabulary a running kernel reads');
  const result=JSON.parse(row.result_json);
  assert.equal(result.verdict,'awaiting-owner');
  assert.equal(result.kernelVerdict,'blocked');
  assert.equal(result.askDispatchId,askDispatch);

  const status=()=>JSON.parse(fx.run(API,'status','--repo',fx.repo,'--workflow',WORKFLOW,'--json').stdout);
  let st=status();
  assert.deepEqual(st.failures,{failed:0,awaitingOwner:1},'an ask is never counted as a failure');
  assert.deepEqual(st.awaitingOwner,[{jobId,opId:OP,attempt:1,dispatchId:askDispatch,answer:'pending'}]);

  const hierarchy=JSON.parse(fx.run(API,'hierarchy','--repo',fx.repo,'--workflow',WORKFLOW,'--json').stdout);
  assert.equal(hierarchy.nodes.find(n=>n.jobId===jobId)?.verdict,'awaiting-owner');

  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{ledger.transaction(()=>ledger.appendEvent({workflowId:WORKFLOW,entityType:'job',entityId:jobId,kind:'ask-answered',payload:{dispatchId:askDispatch}}));}
  finally{ledger.close();}
  st=status();
  assert.equal(st.awaitingOwner[0].answer,'answered','the answered ask tells the Kernel to re-enqueue');

  const again=fx.run(API,'enqueue','--repo',fx.repo,'--workflow',WORKFLOW,'--op',OP,'--paths','docs/','--json');
  assert.equal(again.status,0,again.stderr||again.stdout);
  const next=JSON.parse(jobRow(fx,JSON.parse(again.stdout).job_id).payload_json);
  assert.equal(next.retry.attempt,2,'the answered ask runs as a new durable attempt');
  assert.equal(next.retry.businessAttempt,1,'the ask spent no business attempt');
  assert.equal(next.retry.retryClass,'owner-answer');
  assert.deepEqual(status().awaitingOwner,[],'a re-enqueued op no longer waits');
});

test('a blocked verdict on an ask report settled before awaiting-owner existed reads as a wait',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-old-ask');
  dispatchRunning(fx,jobId);
  fileReport(fx,jobId,{outcome:'ask',name:'old-ask.json'});
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.db.prepare("UPDATE jobs SET status='failed',result_json=? WHERE job_id=?").run(JSON.stringify({verdict:'blocked'}),jobId);
  }finally{ledger.close();}
  const st=JSON.parse(fx.run(API,'status','--repo',fx.repo,'--workflow',WORKFLOW,'--json').stdout);
  assert.deepEqual(st.failures,{failed:0,awaitingOwner:1});
  const again=fx.run(API,'enqueue','--repo',fx.repo,'--workflow',WORKFLOW,'--op',OP,'--paths','docs/','--json');
  assert.equal(again.status,0,again.stderr||again.stdout);
  assert.equal(JSON.parse(jobRow(fx,JSON.parse(again.stdout).job_id).payload_json).retry.businessAttempt,1);
});
