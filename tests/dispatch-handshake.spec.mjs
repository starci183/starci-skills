import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

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

const FAKE_ORCA=String.raw`// fake orca — canned terminal API for the dispatch-handshake spec.
import fs from 'node:fs';
const argv = process.argv.slice(2);
const log = process.env.STARCI_FAKE_ORCA_LOG;
const stateFile = process.env.STARCI_FAKE_ORCA_STATE;
const mode = process.env.STARCI_FAKE_ORCA_MODE || 'healthy';
if (log) fs.appendFileSync(log, JSON.stringify({ argv }) + '\n');
const state = stateFile && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { sends: 0 };
const save = () => { if (stateFile) fs.writeFileSync(stateFile, JSON.stringify(state)); };
const arg = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const out = o => console.log(JSON.stringify(o));
// qwen card: readiness.screenPattern 'Type your message', identity 'qwen3.8-flash',
// submission.activityPattern 'Thinking|esc to cancel|tokens'.
const PROMPT = 'qwen3.8-flash\nType your message\n> ';
const DEAD = 'qwen3.8-flash\nType your message\n\nERROR 401 Invalid API-key — key rejected upstream\n';
const LIVE = 'Thinking hard\nesc to cancel\ntokens 96\n';
if (argv[0] === 'terminal' && argv[1] === 'create')
  out({ ok: true, result: { terminal: { handle: 'fake-terminal-1', title: arg('title'), connected: true, writable: true } } });
else if (argv[0] === 'terminal' && argv[1] === 'read')
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true,
    screen: mode === 'auth' ? DEAD : (state.sends > 0 ? LIVE : PROMPT) } } });
else if (argv[0] === 'terminal' && argv[1] === 'send') { state.sends += 1; save(); out({ ok: true, result: { sent: true } }); }
else if (argv[0] === 'terminal' && argv[1] === 'close') out({ ok: true, result: { closed: arg('terminal') } });
else if (argv[0] === 'terminal' && argv[1] === 'show')
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true } } });
else { out({ ok: false, error: 'fake-orca: unhandled ' + argv.join(' ') }); process.exit(1); }
process.exit(0);
`;

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

const calls=fx=>fs.existsSync(path.join(fx.root,'calls.jsonl'))
  ?fs.readFileSync(path.join(fx.root,'calls.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l).argv.slice(0,2).join(' '))
  :[];

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
