import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {startOpIpcCli} from '../helpers/kernel-verbs-shared-op-ipc-fixture.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {jobRowOf} from '../../scripts/kernel/verbs/shared/rows.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');

// The op-IPC layer lives in scripts/kernel/cli.mjs.
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
import {normalizeOwnedPath} from '../../engine/admission.mjs';
import {writeGreenProofs} from '../helpers/sonar-scan.mjs';
// The ask here exercises the owner-flow contract; autopilot (scripts/kernel/autopilot-run.mjs, owner ruling 2026-09-28) is on
// by default, so this spec runs with it off - tests/kernel/autopilot.spec.mjs covers the autopilot flow.
process.env.STARCI_AUTOPILOT ??= 'off';
const CLI=startOpIpcCli({fakeOrca:FAKE_ORCA});
test.after(()=>CLI.close());

const fixture=(t,{mode='healthy'}={})=>{
  const root=fs.mkdtempSync(path.join(CLI.workspaceRoot,'case-'));
  const savedProjects=process.env.STARCI_PROJECTS_ROOT;
  process.env.STARCI_PROJECTS_ROOT=CLI.projectsRoot;
  t.after(()=>{if(savedProjects===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=savedProjects;});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  // The resident entry keeps environment-derived roots. Reset their persisted
  // rows between cases, while each case gets independent fake-Orca log/state.
  for(const dir of [CLI.projectsRoot,CLI.localAppData,path.join(CLI.workspaceRoot,'repo')])
    fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});
  for(const file of [CLI.machineFile,`${CLI.machineFile}-shm`,`${CLI.machineFile}-wal`])fs.rmSync(file,{force:true});
  const repo=path.join(CLI.workspaceRoot,'repo');fs.mkdirSync(repo,{recursive:true});for(const d of ['docs','src'])fs.mkdirSync(path.join(repo,d),{recursive:true});
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:CLI.orcaArgs,
    STARCI_FAKE_ORCA_MODE:mode,
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    // machine.sqlite (the settle path's best-effort paired release) stays inside
    // the temp world — never the real arbiter.
    LOCALAPPDATA:CLI.localAppData,
    STARCI_PROJECTS_ROOT:CLI.projectsRoot,
    STARCI_TEST_MACHINE_FILE:CLI.machineFile,
  };
  const runFresh=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
  const cliEnv=()=>({
    STARCI_ORCA_COMMAND:env.STARCI_ORCA_COMMAND,
    STARCI_ORCA_ARGS:env.STARCI_ORCA_ARGS,
    STARCI_FAKE_ORCA_MODE:env.STARCI_FAKE_ORCA_MODE,
    STARCI_FAKE_ORCA_LOG:env.STARCI_FAKE_ORCA_LOG,
    STARCI_FAKE_ORCA_STATE:env.STARCI_FAKE_ORCA_STATE,
    LOCALAPPDATA:env.LOCALAPPDATA,
    STARCI_PROJECTS_ROOT:env.STARCI_PROJECTS_ROOT,
    STARCI_TEST_MACHINE_FILE:env.STARCI_TEST_MACHINE_FILE,
    STARCI_AUTOPILOT:env.STARCI_AUTOPILOT,
    STARCI_CALLER:env.STARCI_CALLER??null,
  });
  const run=(script,...args)=>CLI.run(args,cliEnv());
  return {root,repo,env,mode,run,runFresh};
};

// Every handle is opened and closed inside the helper — a leaked sqlite handle
// EPERMs the t.after rm on Windows (same lesson as _ledger-fixture trackHandles).
const enqueue=(fx,jobId='job-op-ipc-1')=>{
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.ensureWorkflow({workflowId:WORKFLOW,phase:'queued'});
    const goalIdentity=ledger.db.prepare('SELECT goal_identity FROM workflows WHERE workflow_id=?').get(WORKFLOW).goal_identity;
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(WORKFLOW,1,goalIdentity ?? WORKFLOW,'op IPC fixture goal','{}',Date.now());
    ledger.write.createUnit({workflowId:WORKFLOW,unitId:jobId,opId:OP,subjectKey:jobId,goalRevision:1});
    ledger.write.enqueueJob({jobId,workflowId:WORKFLOW,unitId:jobId,opId:OP,kind:'op',
      payload:{opId:OP,owned_paths:OWNED,model:'devin-agent'}});
    // start-workflow.mjs enrols a workflow at phase 'queued' and dispatch's
    // transitionQueuedToRunning is guarded on it — reproduce the precondition.
  }finally{ledger.close();}
  return jobId;
};
const inspect=(fx,fn)=>{
  const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
  try{return fn(ledger.db);}finally{ledger.close();}
};
const jobRow=(fx,jobId)=>inspect(fx,db=>jobRowOf(db,jobId));
const contractRows=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT c.*,a.op_id,a.try_no AS attempt,a.dispatch_id FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE c.workflow_id=?').all(wf));
const reportRows=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT * FROM reports WHERE workflow_id=?').all(wf));
const scratchPath=(fx,name)=>path.join(inspect(fx,db=>db.prepare('SELECT scratch_dir FROM op_attempts ORDER BY attempt_id DESC LIMIT 1').get().scratch_dir),name);
const checkRows=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare("SELECT * FROM check_runs WHERE workflow_id=? AND runner='kernel' ORDER BY check_id").all(wf));
const leaseRows=(fx,jobId)=>inspect(fx,db=>db.prepare('SELECT * FROM leases WHERE job_id=?').all(jobId));
const eventKinds=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT kind FROM events WHERE workflow_id=? ORDER BY seq').all(wf).map(r=>r.kind));
const phaseOf=(fx,wf=WORKFLOW)=>inspect(fx,db=>db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf)?.phase??null);

// Successful dispatches reuse the file-level entry process and its stable Orca
// channel. The rejection contract keeps a fresh process so its exit is visible.
const dispatch=(fx,jobId)=>(fx.mode==='healthy'?fx.run:fx.runFresh)(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','devin-agent','--spawn','--json');
const independentCheck=(fx,jobId,checks)=>{
  fx.env.STARCI_CALLER='runtime-settler';
  try{return fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(checks),'--json');}
  finally{delete fx.env.STARCI_CALLER;}
};
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
  const scratch=inspect(fx,db=>db.prepare('SELECT scratch_dir FROM op_attempts ORDER BY attempt_id DESC LIMIT 1').get()?.scratch_dir);
  const file=path.join(scratch??fx.repo,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({
    schema:'starci/op-report@1',outcome,summary:`op ${outcome} — ${sentinel}`,
    files:[...files,...(outcome==='done'?(writeGreenProofs(path.join(fx.repo,'docs')),['docs/sonar.json','docs/gate.json','docs/read-digest.json']):[])],checks:[{name:'self-check',command:'true',exitCode:0}],
    ...(outcome==='partial'?{open:['one unfinished item']}:{}),
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
  assert.equal(payload?.managed?.runId,'run-fake-1');
  assert.equal(payload?.managed?.taskId,'task-fake-1');
  assert.equal(payload?.managed?.dispatchId,contract.dispatch_id,'the op is keyed to its worker-start Dispatch');
  assert.equal(job.worker_id,contract.dispatch_id,'worker_id is the Dispatch id');
  assert.ok(payload?.managed?.agentTerminalHandle,'the worker terminal is bound for the caller boundary and follow-up input');
  assert.equal(payload?.hierarchy?.parentNodeId,`agent:kernel:${WORKFLOW}`);
  assert.equal(payload?.hierarchy?.runtime?.dispatchId,contract.dispatch_id);
  const calls=fs.readFileSync(fx.env.STARCI_FAKE_ORCA_LOG,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line).argv.slice(0,2).join(' '));
  for(const step of ['orchestration run-create','orchestration worker-start'])
    assert.ok(calls.includes(step),`the op hierarchy never called '${step}' — log: ${calls.join(', ')}`);
  assert.equal(calls.includes('terminal create'),false,'no op terminal is created by the runtime');

  // Every owned_path is fenced in the ledger the worker runs against.
  const keys=leaseRows(fx,jobId).map(l=>l.resource_key).sort();
  assert.deepEqual(keys,OWNED.map(p=>`path:${normalizeOwnedPath(p)}`).sort(),'each owned_path gets a path: lease row');

  assert.equal(phaseOf(fx), 'running', 'dispatch claims phase=running on the workflow');
  const kinds=eventKinds(fx);
  assert.ok(inspect(fx,db=>db.prepare("SELECT 1 FROM lifecycle_changes WHERE workflow_id=? AND to_phase='running'").get(WORKFLOW)),
    `dispatch must record a running lifecycle transition — saw: ${kinds.join(', ')}`);
  assert.ok(kinds.includes('op-dispatched'),`the dispatch receipt event is still required — saw: ${kinds.join(', ')}`);
});

/* ------------------------------------------------ worker → kernel: report */

test('api report keeps the first dispatch report immutable; api op-contract prints the stored markdown',t=>{
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

  // One dispatch may file only one immutable report. A different second body
  // is refused without replacing the worker's original claim.
  const second=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',writeEnvelope(fx,{outcome:'partial',sentinel:'SENTINEL-BETA',name:'report-2.md'}),'--json');
  assert.notEqual(second.status,0);
  assert.match(second.stdout+second.stderr,/report-already-filed/);
  rows=reportRows(fx);
  assert.equal(rows.length,1);
  assert.equal(rows[0].outcome,'done');
  assert.match(rows[0].report_json,/SENTINEL-ALPHA/);
  assert.doesNotMatch(rows[0].report_json,/SENTINEL-BETA/);
  assert.ok(eventKinds(fx).includes('report-filed'),'api report must emit the report-filed event');

  // api op-contract is the worker's read of its own contract: the row markdown.
  const oc=fx.runFresh(API,'op-contract','--repo',fx.repo,'--job',jobId);
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

test('api consume-report marks the dispatch report consumed; api check records each check run',t=>{
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
  assert.equal(rows.length,2,'api check records one row per check');
  assert.deepEqual(rows.map(r=>r.name).sort(),['lint','tests']);
  assert.ok(rows.every(r=>r.job_id===jobId && r.attempt_id===reportRows(fx)[0].attempt_id));
  assert.ok(rows.every(r=>r.authority==='declared'),'unrerunnable commands remain declared evidence');

  // A rerun appends new run rows so both observations remain auditable.
  const rerun=checkEnvelope(
    {name:'lint',command:'npm run lint',exitCode:0,evidence:'lint passed'},
    {name:'tests',command:'npm test',exitCode:1,evidence:'tests failed'},
  );
  const k2=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify(rerun),'--json');
  assert.equal(k2.status,0,`api check (re-run) failed: ${k2.stderr||k2.stdout}`);
  rows=checkRows(fx);
  assert.equal(rows.length,4,'a second check run appends without erasing the first');
  assert.equal(rows.filter(r=>r.name==='tests').at(-1).declared_exit_code,1);
  assert.ok(eventKinds(fx).includes('checks-recorded'),'api check must emit the checks-recorded event');
});

test('api check rejects scalar and double-encoded payloads before recording evidence',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-check-shape');
  const valid=checkEnvelope({name:'validator',command:'starci validate',exitCode:0,evidence:'green'});

  for(const malformed of [JSON.stringify('pass'),JSON.stringify(JSON.stringify(valid))]){
    const refused=fx.runFresh(API,'check','--repo',fx.repo,'--job',jobId,'--checks',malformed,'--json');
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
  assert.deepEqual(body.checkEvidence,{observed:1,passed:0,failed:0,green:false,declared:1});
  assert.equal(checkRows(fx)[0].declared_exit_code,0);
});

test('queued jobs cannot self-file reports, record green checks, or settle pass without an operation dispatch',t=>{
  const fx=fixture(t);
  const jobId=enqueue(fx,'job-op-ipc-undispatched-claim');
  const report=writeEnvelope(fx,{outcome:'done',name:'undispatched-report.json'});
  const checks=JSON.stringify(checkEnvelope({name:'validator',command:'starci validate',exitCode:0,evidence:'green'}));

  const filed=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--json');
  assert.notEqual(filed.status,0,'a queued job must not impersonate its missing Op worker');
  assert.match(`${filed.stderr}${filed.stdout}`,/report-job-not-active/);
  assert.equal(reportRows(fx).length,0,'a refused queued report must not create a report row');

  const checked=fx.runFresh(API,'check','--repo',fx.repo,'--job',jobId,'--checks',checks,'--json');
  assert.notEqual(checked.status,0,'Kernel checks cannot manufacture a worker report boundary');
  assert.match(`${checked.stderr}${checked.stdout}`,/checks-report-missing/);
  assert.equal(checkRows(fx).length,0,'a refused queued check must not create check evidence');

  const settled=fx.runFresh(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.notEqual(settled.status,0,'an undispatched queued job cannot settle pass');
  assert.match(`${settled.stderr}${settled.stdout}`,/job-not-dispatched/);
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
  const checked=independentCheck(fx,jobId,checkEnvelope({name:'validator',exitCode:0}));
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
  assert.equal(job?.status,'ready','a proven no-effect rejection leaves the same durable job ready');
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
  const bad=scratchPath(fx,'bad.md');fs.writeFileSync(bad,'# op report\nlooks done\n');
  let r=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',bad,'--json');
  assert.notEqual(r.status,0,'a non-envelope report must be refused');
  assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);

  // Conditional payloads: partial without open[], files outside owned_paths.
  const noOpen=scratchPath(fx,'noopen.json');fs.writeFileSync(noOpen,JSON.stringify({outcome:'partial',summary:'x'}));
  r=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',noOpen,'--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);assert.match(`${r.stderr}${r.stdout}`,/open\[\]/);

  const escaped=scratchPath(fx,'escaped.json');fs.writeFileSync(escaped,JSON.stringify({outcome:'done',summary:'x',files:['../outside.txt']}));
  r=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',escaped,'--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);assert.match(`${r.stderr}${r.stdout}`,/outside owned_paths/);

  // Identity is the job's, not the worker's claim.
  const forged=scratchPath(fx,'forged.json');fs.writeFileSync(forged,JSON.stringify({outcome:'done',summary:'x',dispatch:'someone-else'}));
  r=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',forged,'--json');
  assert.notEqual(r.status,0);assert.match(`${r.stderr}${r.stdout}`,/report-invalid/);assert.match(`${r.stderr}${r.stdout}`,/identity 'dispatch'/);

  // A --outcome flag contradicting the envelope is refused.
  const good=writeEnvelope(fx,{outcome:'done',name:'good.json'});
  r=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',good,'--outcome','blocked','--json');
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
  const bad=fx.runFresh(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','blocked','--json');
  assert.notEqual(bad.status,0,'verdict blocked cannot settle a done report');
  assert.match(`${bad.stderr}${bad.stdout}`,/verdict-outcome-mismatch/);

  const checked=independentCheck(fx,jobId,checkEnvelope({name:'validator',exitCode:0}));
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
  assert.equal(refused.status,0,'an already filed attempt replays its immutable report');
  assert.equal(emitted(refused.stdout)?.replayed,true);
  assert.equal(reportRows(fx).length,1,'the rejected claim never creates another row');
  assert.equal(reportRows(fx)[0].dispatch_id,live);

  // check and settle resolve the same binding, so the attempt can finish.
  const checked=independentCheck(fx,jobId,checkEnvelope({name:'validator',exitCode:0}));
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
    for(const to of ['ready','leased','running'])ledger.write.setJobStatus({jobId,to,reason:'rejected dispatch fixture'});
  }finally{ledger.close();}
  patchPayload(fx,jobId,{
    managed:{dispatchId:'ctx_rejected_only'},
    rejectedDispatches:[{dispatchId:'ctx_rejected_only',step:'worker-start',at:Date.now(),effectState:'none'}],
  });

  const report=writeEnvelope(fx,{outcome:'done',name:'a7-unbound.json'});
  const refused=fx.runFresh(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--json');
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
  assert.equal(JSON.parse(settled.stdout).status,'awaiting_owner');
  assert.equal(row.status,'awaiting_owner','an ask is a wait: jobs.status is never failed');
  assert.equal(inspect(fx,db=>db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(jobId).n),0,'the settled wait drops its leases');
  assert.equal(inspect(fx,db=>db.prepare('SELECT state FROM work_units WHERE unit_id=?').get(db.prepare('SELECT unit_id FROM jobs WHERE job_id=?').get(jobId).unit_id).state),'deciding','the unit parks deciding, not failed');
  const result=JSON.parse(row.result_json);
  assert.equal(result.verdict,'awaiting-owner');
  assert.equal(result.kernelVerdict,'blocked');
  assert.equal(result.askDispatchId,askDispatch);

  const status=()=>JSON.parse(fx.run(API,'status','--repo',fx.repo,'--workflow',WORKFLOW,'--json').stdout);
  let st=status();
  assert.deepEqual(st.failures,{failed:0,awaitingOwner:1},'an ask is never counted as a failure');
  assert.deepEqual(st.jobs.awaiting_owner,1,'api status groups the job under its own status');
  const leg=st.legs.find(l=>l.op===OP);
  assert.equal(leg.status,'awaiting_owner');
  assert.equal(leg.awaitingOwner,true);
  assert.notEqual(leg.color,'red','the leg of an ask is a wait, never red');
  assert.deepEqual(st.awaitingOwner,[{jobId,opId:OP,attempt:1,dispatchId:askDispatch,answer:'pending'}]);

  const hierarchy=JSON.parse(fx.run(API,'hierarchy','--repo',fx.repo,'--workflow',WORKFLOW,'--json').stdout);
  assert.equal(hierarchy.nodes.find(n=>n.jobId===jobId)?.verdict,'awaiting-owner');

  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{ledger.transaction(()=>ledger.appendEvent({workflowId:WORKFLOW,entityType:'job',entityId:jobId,kind:'ask-answered',payload:{dispatchId:askDispatch}}));}
  finally{ledger.close();}
  st=status();
  assert.equal(st.awaitingOwner[0].answer,'answered','the answered ask tells the Kernel to re-enqueue');
  assert.equal(inspect(fx,db=>db.prepare('SELECT MAX(revision) AS revision FROM goals WHERE workflow_id=?').get(WORKFLOW).revision),1);

  const again=fx.run(API,'enqueue','--repo',fx.repo,'--workflow',WORKFLOW,'--op',OP,'--paths','docs/','--retry-of',jobId,'--json');
  assert.equal(again.status,0,again.stderr||again.stdout);
  const next=jobRow(fx,JSON.parse(again.stdout).job_id);
  assert.equal(next.try_no,2,'the answered ask runs as a new durable try');
  assert.equal(next.retry_of,jobId);
  assert.equal(next.retry_class,'follow-up','owner answers use the durable follow-up try class');
  assert.deepEqual(status().awaitingOwner,[],'a re-enqueued op no longer waits');
});
