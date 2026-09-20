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

// The op-IPC layer rides the pinned sibling lane d1 in scripts/kernel/api.mjs.
// Until it lands every lifecycle test skips; the gates below read api.mjs's
// source for the verb/implementation markers (the same skip-if-absent pattern
// managed-dispatch.spec.mjs uses) so a half-landed lane skips precisely.
//
// Pinned contract under test:
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
const API_SRC=fs.readFileSync(API,'utf8');
const has=(...res)=>res.some(re=>re.test(API_SRC));
const LANDED={
  // dispatch's IPC half: a contracts row (raw SQL or a ledger helper), one
  // path: lease per owned_path, and the pinned phase-transition event. Every
  // marker is absent from api.mjs today — 'contract'/'lease_token' alone would
  // false-positive on the existing prompt-builder and rejectDispatch code.
  dispatchIpc:has(/\bINTO\s+contracts\b/i,/\b(writeContract|upsertContract|putContract|fileContract)\b/)
    &&has(/phase-transition/)
    &&has(/\bINTO\s+leases\b/i,/\breserveTwoPhase\b/,/\bacquireLease\b/),
  report:has(/\breport-filed\b/,/\bcmdReport\b/,/\bcase 'report'/,/\breport:\s*\[/),
  opContract:has(/\bop-contract\b/,/\bcmdOpContract\b/),
  check:has(/\bchecks-recorded\b/,/\bcmdCheck\b/,/\bcase 'check'/,/\bcheck:\s*\[/),
  consumeReport:has(/\bconsume-report\b/,/\bcmdConsumeReport\b/),
  // settle's half of consume: any consumed_at write in api.mjs (consume-report
  // or settle). A lane that lands consume-report but not the settle write runs
  // and fails the settle test — that is the contract gap being surfaced.
  consumeWrite:has(/\bconsumed_at\b/),
};
const skipFor=names=>{
  const missing=names.filter(n=>!LANDED[n]);
  return missing.length
    ?`op-IPC lane has not landed in scripts/kernel/api.mjs yet — missing marker(s): ${missing.join(', ')}`
    :false;
};

const WORKFLOW='wf-op-ipc';
const OP='code.refactor';
const OWNED=['docs/','src/op-ipc.txt'];
// api.mjs's normalizeOwnedPath, mirrored: lease resource_keys are
// 'path:' + the owned path with separators canonicalised and trailing
// slashes stripped ('docs/' fences 'path:docs').
const normalizeOwnedPath=p=>String(p).replace(/\\/g,'/').replace(/\/{2,}/g,'/').replace(/^\.\//,'').replace(/\/+$/,'');

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
    ...(outcome==='ask'?{question:{text:'which way?',options:['a','b']}}:{}),
    ...(outcome==='blocked'?{blocker:{kind:'environment',detail:'dep missing'}}:{}),
    ...extra,
  }));
  return file;
};
const fileReport=(fx,jobId,opts={})=>{
  const file=writeEnvelope(fx,opts);
  const r=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',file,'--json');
  assert.equal(r.status,0,`api report (${opts.outcome??'done'}) failed: ${r.stderr||r.stdout}`);
  return r;
};

/* ------------------------------------------- dispatch writes the IPC half */

test('op-IPC dispatch: contracts row, one path: lease per owned_path, phase=running and a phase-transition event',{skip:skipFor(['dispatchIpc'])},t=>{
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

test('api report upserts the dispatch report; api op-contract prints the stored markdown',{skip:skipFor(['dispatchIpc','report','opContract'])},t=>{
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

/* ------------------------------------- consume-report + checks durability */

test('api consume-report marks the dispatch report consumed; api check upserts the checks row',{skip:skipFor(['dispatchIpc','report','check','consumeReport'])},t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  const {job}=dispatchRunning(fx,jobId);
  fileReport(fx,jobId);

  const c=fx.run(API,'consume-report','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(c.status,0,`api consume-report failed: ${c.stderr||c.stdout}`);
  assert.ok(reportRows(fx)[0]?.consumed_at,'consume-report must set reports.consumed_at');

  const k1=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({lint:'pass',tests:'pass'}),'--json');
  assert.equal(k1.status,0,`api check failed: ${k1.stderr||k1.stdout}`);
  let rows=checkRows(fx);
  assert.equal(rows.length,1,'api check writes one checks row per attempt');
  assert.equal(rows[0].op_id,OP);
  assert.equal(rows[0].attempt,job.attempt,'checks key to the job attempt');
  assert.deepEqual(JSON.parse(rows[0].checks_json),{lint:'pass',tests:'pass'});

  // Same PK (workflow_id,op_id,attempt): a re-run check upserts.
  const k2=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({lint:'pass',tests:'fail'}),'--json');
  assert.equal(k2.status,0,`api check (re-run) failed: ${k2.stderr||k2.stdout}`);
  rows=checkRows(fx);
  assert.equal(rows.length,1,'a second check for the same attempt must upsert, not append');
  assert.equal(JSON.parse(rows[0].checks_json).tests,'fail');
  assert.ok(eventKinds(fx).includes('checks-recorded'),'api check must emit the checks-recorded event');
});

/* ------------------------------------------------------ settle integrates */

test('settle consumes the dispatch report and releases every owned-path lease',{skip:skipFor(['dispatchIpc','report','consumeWrite'])},t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx);
  dispatchRunning(fx,jobId);
  fileReport(fx,jobId);
  assert.equal(reportRows(fx)[0].consumed_at,null,'precondition: the report is unconsumed before settle');

  const verdictReport=path.join(fx.repo,'verdict-report.md');
  fs.writeFileSync(verdictReport,'# verdict\npass\n');
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--report',verdictReport,'--json');
  assert.equal(s.status,0,`settle failed: ${s.stderr||s.stdout}`);
  assert.equal(jobRow(fx,jobId)?.status,'succeeded');
  assert.ok(reportRows(fx)[0]?.consumed_at,'settle must set consumed_at on the job dispatch report');
  assert.equal(leaseRows(fx,jobId).length,0,'settle releases the owned-path leases');
});

/* ------------------------------------ regression: a rejection claims nothing */

test('dispatch-rejected regression: a dead provider claims no contract, no leases, no running phase',{skip:skipFor(['dispatchIpc'])},t=>{
  const fx=fixture(t,{mode:'auth'}); // fake-orca serves the observed 401 death screen
  const jobId=enqueue(fx,'job-op-ipc-rejected');
  const r=dispatch(fx,jobId);
  assert.notEqual(r.status,0,'a dead provider screen must reject the dispatch');

  const job=jobRow(fx,jobId);
  assert.equal(job?.status,'failed','a rejected dispatch never stands running');
  assert.match(job?.result_json??'',/dispatch-rejected/);
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

test('api status projects filed reports; settle works row-first without --report and enforces verdict↔outcome',{skip:skipFor(['dispatchIpc','report','consumeWrite'])},t=>{
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

  // Settle consumes the row — no --report needed; the row is the verdict.
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(s.status,0,`row-first settle failed: ${s.stderr||s.stdout}`);
  const settled=JSON.parse(s.stdout);
  assert.equal(settled.reportFiled,true);
  assert.equal(settled.reportOutcome,'done');
  assert.equal(jobRow(fx,jobId)?.status,'succeeded');
  assert.ok(reportRows(fx)[0]?.consumed_at);
});
