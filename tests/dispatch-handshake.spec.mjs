import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
// Lane m13 — the dispatch handshake (defect: `api dispatch` marked a job
// running although the spawned terminal died at `401 Invalid API-key`).
// A fake `orca` binary — a node script spawned through the existing
// STARCI_ORCA_COMMAND/STARCI_ORCA_ARGS overrides — serves canned receipts:
// create → handle, read → a screen, send → ack, close → ack. Every call is
// appended to a JSONL call log so the spec can prove no terminal leaks.
//
// The ledger module is canonical at engine/ledger-db.mjs post-flip (kernel/ is
// doomed); use whichever actually imports — engine/ can exist-but-be-mid-flip.
const LEDGER_MODULE=await (async()=>{
  for(const p of ['../engine/ledger-db.mjs','../kernel/ledger-db.mjs']){
    if(!fs.existsSync(path.join(ROOT,p.slice(3))))continue;
    try{return await import(p);}catch{/* landed but not yet wired — fall back */}
  }
  throw new Error('no importable ledger module at engine/ or kernel/');
})();
const {openLedger,inspectLedger,ledgerFileFor}=LEDGER_MODULE;

// The canned `orca` binary lives in tests/helpers/fake-orca.mjs — the same
// stub serves this spec and managed-dispatch.spec.mjs (orchestration verbs,
// account-list rateLimits, STARCI_FAKE_ORCA_MODE / STARCI_FAKE_ORCA_DEAD).

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  const make=mode=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-handshake-'));dirs.push(root);
    const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
    const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
    const env={...process.env,
      STARCI_ORCA_COMMAND:process.execPath,          // the stub runs as `node fake-orca.mjs ...`
      STARCI_ORCA_ARGS:JSON.stringify([stub]),
      STARCI_FAKE_ORCA_MODE:mode,
      STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
      STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    };
    const jobId=`job-${mode}`;
    const ledger=openLedger({file:ledgerFileFor(repo)});
    try{
      ledger.enqueueJob({jobId,workflowId:'wf-dispatch',opId:'code.refactor',kind:'op',
        payload:{opId:'code.refactor',owned_paths:['docs/']}});
    }finally{ledger.close();}
    return {root,repo,env,jobId};
  };
  return {make};
};

const runDispatch=(fx)=>spawnSync(process.execPath,
  [API,'dispatch','--repo',fx.repo,'--job',fx.jobId,'--spawn','--json'],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:fx.env});

const callArgv=fx=>fs.existsSync(path.join(fx.root,'calls.jsonl'))
  ?fs.readFileSync(path.join(fx.root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
  :[];
const calls=fx=>callArgv(fx).map(argv=>argv.slice(0,2).join(' '));

const orcaState=fx=>JSON.parse(fs.readFileSync(path.join(fx.root,'state.json'),'utf8'));
const liveTerminals=fx=>Object.values(orcaState(fx).terminals??{}).filter(term=>!term.closed).map(term=>term.handle);

const jobRow=(fx,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
  try{return ledger.db.prepare('SELECT status,worker_id,result_json FROM jobs WHERE job_id=?').get(jobId);}
  finally{ledger.close();}
};

test('healthy stub: dispatch --spawn attests and marks the job running',t=>{
  const fx=fixture(t).make('healthy');
  const r=runDispatch(fx);
  assert.equal(r.status,0,`dispatch failed against a healthy terminal: ${r.stderr||r.stdout}`);
  const job=jobRow(fx,fx.jobId);
  assert.equal(job?.status,'running',`a successfully attested spawn must mark the job running, got ${job?.status}`);
  assert.equal(job?.worker_id,'fake-terminal-1');
  const seen=calls(fx);
  for(const step of ['terminal create','terminal read','terminal send'])
    assert.ok(seen.includes(step),`fake orca never saw '${step}' — log: ${seen.join(', ')}`);
  const create=callArgv(fx).find(argv=>argv.slice(0,2).join(' ')==='terminal create');
  assert.equal(create?.[create.indexOf('--title')+1],'[Op] code.refactor a1 · wf-dispatch',
    'a command terminal is a flat sidebar row: it carries the semantic name at creation, not the provider auto-summary');
  const command=create?.[create.indexOf('--command')+1]??'';
  assert.match(command,/--yolo\b/,'the real API dispatch path must inject Qwen yolo into the profile command');
  assert.match(command,/--exclude-tools agent\b/,'the real API dispatch path must preserve the nested-agent exclusion');
});

// The 401 screen still carries the readiness pattern (the TUI renders its
// prompt then dies on the first API call — the observed failure shape), so
// readiness passes and the death surfaces where the contract says it must:
// post-submission attestation.
test('auth-dead stub: dispatch never leaves the job running and leaks no terminal',t=>{
  const fx=fixture(t).make('auth');
  const r=runDispatch(fx);
  assert.notEqual(r.status,0,'a terminal whose screen shows 401 Invalid API-key must not dispatch clean');
  const job=jobRow(fx,fx.jobId);
  assert.notEqual(job?.status,'running','job must NOT be running after a rejected dispatch — this was the observed defect');
  assert.ok(calls(fx).includes('terminal close'),'the dead terminal must be closed — log shows no close call');
  // fable.md orca-hierarchy: a refused op left its [Op] terminal open and the
  // Orca sidebar kept showing it "Idle" under the kernel. A rejection leaves
  // no live terminal for that dispatch, and says so on the record.
  assert.deepEqual(liveTerminals(fx),[],'a rejected dispatch leaves no live terminal behind');
  assert.deepEqual(orcaState(fx).closed,['fake-terminal-1']);
  assert.equal(callArgv(fx).filter(argv=>argv.slice(0,2).join(' ')==='terminal close').length,1,
    'the terminal is closed once, in the step that records the refusal');
  const rejection=JSON.parse(r.stdout||'{}')?.rejection;
  assert.equal(rejection?.terminalClosed,true);
  assert.equal(rejection?.closed?.handle,'fake-terminal-1');
  const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
  try{
    const event=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id='wf-dispatch' AND kind='dispatch-rejected'").get();
    assert.equal(JSON.parse(event?.payload_json??'{}')?.terminalClosed,true,'dispatch-rejected carries the containment proof');
  }finally{ledger.close();}
});

// Contract for m4's attestation work: the rejection is typed, not just a crash.
// Marker accepted in any of the three places m4's contract names: a
// dispatch-rejected event, the job's result_json reason, or the CLI output.
// Skips until the marker exists; the invariant test above pins today.
test('auth-dead stub: the rejection is typed dispatch-rejected',t=>{
  const fx=fixture(t).make('auth');
  const r=runDispatch(fx);
  assert.notEqual(r.status,0);
  const job=jobRow(fx,fx.jobId);
  const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});
  let eventKinds=[];
  try{eventKinds=ledger.db.prepare('SELECT kind FROM events WHERE workflow_id=?').all('wf-dispatch').map(e=>e.kind);}
  finally{ledger.close();}
  const marked=eventKinds.includes('dispatch-rejected')
    ||/dispatch-rejected/.test(job?.result_json??'')
    ||/dispatch-rejected/.test(`${r.stdout}\n${r.stderr}`);
  assert.ok(marked,
    `dispatch rejection must be typed 'dispatch-rejected' (event kind / result_json / output). `+
    `got status=${job?.status}, events=[${eventKinds}], stdout=${r.stdout.slice(0,300)}`);
});
