import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// inc-bc0b90a7ec70 + inc-9ae771781252: a managed worker-start returns before Orca has injected the
// worker's Task, so status read a 20-40 s old managed worker turn-idle and listed it nudge-ready;
// the nudge landed in front of the arriving Task. For allocation.liveness.launchGraceMs after its
// latest op-dispatched event a managed worker whose screen still reads an idle prompt is `starting`:
// never nudge-ready, and `api nudge` skips it worker-starting typing nothing. A command-terminal
// dispatch has already proven its prompt's submission before op-dispatched was written, so it keeps
// no grace; a staged paste is nudge-ready at any age. And per the Supervisor ruling on
// inc-f1d014518dc3, a nudge never appends a wake to input text the runtime cannot prove is its own:
// cmdNudge refuses `foreign-input` and types nothing.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WF='wf-launch-grace',JOB='job-launch-grace',OP='decide',DISPATCH='dispatch-fake-1',HANDLE='term-launch-grace';
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const HOUR=3600*1000,MIN=60*1000,SEC=1000;
const IDLE=['Codex','model: gpt-6-sol','','› Ask Codex to do anything'].join('\n');
// The first sentence of the wake cmdNudge builds for this exact job and attempt.
const WAKE=`Operation liveness wake for durable job ${JOB} (${OP}) attempt 1.`;

// One world: the fake Orca holding the op's live terminal, a running op job (managed by default -
// worker_id is the Dispatch id, the terminal comes from payload.managed.agentTerminalHandle; a
// command-terminal job carries payload.orca and worker_id=handle), its contract row and the
// op-dispatched event the grace measures from.
const world=(t,fn,{screen=IDLE,dispatchedAgo=30*SEC,managed=true,nudgeAgo=null}={})=>withLedger(t,({root,repoRoot,machineHome,ledger})=>{
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'orca-state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:{[HANDLE]:{handle:HANDLE,connected:true,writable:true,command:'claude',screen,lastOutputAt:Date.now()}}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    LOCALAPPDATA:machineHome};
  delete env.ORCA_TERMINAL_HANDLE;delete env.STARCI_ROLE;delete env.STARCI_OP_JOB;
  const run=(args,more={})=>spawnSync(process.execPath,[API,...args,'--repo',repoRoot,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const dispatchedAt=Date.now()-dispatchedAgo;
  const payload=managed
    ?{opId:OP,owned_paths:['docs/'],model:'claude-agent',provider:'claude',
      managed:{runId:'run-1',taskId:'task-1',dispatchId:DISPATCH,agentTerminalHandle:HANDLE},
      hierarchy:{runtime:{host:'orca',agent:'claude',dispatchId:DISPATCH,terminalHandle:HANDLE}}}
    :{opId:OP,owned_paths:['docs/'],model:'codex-agent',provider:'codex',
      orca:{dispatchId:HANDLE,agentTerminalHandle:HANDLE},
      hierarchy:{runtime:{host:'orca',agent:'codex',dispatchId:HANDLE,terminalHandle:HANDLE}}};
  seedWorkflow(ledger,{id:WF,state:{phase:'running'},
    jobs:[{jobId:JOB,opId:OP,kind:'op',status:'running',attempt:1,workerId:managed?DISPATCH:HANDLE,leaseToken:'tok-launch-grace',createdAt:dispatchedAt,payload}]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,OP,1,managed?DISPATCH:HANDLE,'# launch-grace contract','{}',dispatchedAt);
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-dispatched',
    payload:{op:OP,dispatch:managed?DISPATCH:HANDLE,...(managed?{managed:true}:{terminal:HANDLE})},createdAt:dispatchedAt});
  if(nudgeAgo!=null)ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-worker-nudged',payload:{opId:OP,attempt:1},createdAt:Date.now()-nudgeAgo});
  const orcaState=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
  const events=kind=>ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=?').all(WF,kind).map(r=>JSON.parse(r.payload_json));
  return fn({repoRoot,ledger,run,orcaState,events});
});
const status=run=>{const r=run(['status','--workflow',WF]);assert.equal(r.status,0,r.stderr||r.stdout);return out(r);};
const worker=body=>body.workers.find(w=>w.jobId===JOB);

test('a managed worker inside its launch grace reads starting and is never nudge-ready',t=>world(t,({run,orcaState,events})=>{
  const body=status(run);
  const w=worker(body);
  assert.equal(w.liveness,'starting');
  assert.equal(w.livenessReason,'launch-grace');
  assert.ok(w.launchGrace.ageMs<w.launchGrace.graceMs);
  assert.deepEqual(body.frontier.nudgeReadyJobs,[],'a starting worker is never nudge-ready');
  const nudge=run(['nudge','--job',JOB]);
  assert.equal(nudge.status,0,nudge.stderr||nudge.stdout);
  assert.deepEqual([out(nudge).ok,out(nudge).nudged,out(nudge).reason],[true,false,'worker-starting']);
  assert.equal(orcaState().sends??0,0,'nothing was typed');
  assert.equal(events('op-worker-nudged').length,0,'no nudge event');
}));

test('past the grace the same idle screen is turn-idle and nudges',t=>world(t,({run,events})=>{
  assert.equal(worker(status(run)).liveness,'turn-idle');
  const nudge=run(['nudge','--job',JOB],{STARCI_FAKE_ORCA_SEND_STALLED:'landed'});
  assert.equal(nudge.status,0,nudge.stderr||nudge.stdout);
  assert.equal(out(nudge).nudged,true);
  assert.equal(events('op-worker-nudged').length,1);
},{dispatchedAgo:5*MIN}));

test('a nudge since the dispatch ends the launch grace',t=>world(t,({run})=>{
  assert.equal(worker(status(run)).liveness,'turn-idle','a delivered nudge ends the launch grace');
  assert.deepEqual(status(run).frontier.nudgeReadyJobs,[JOB]);
},{nudgeAgo:10*SEC}));

test('a staged paste is nudge-ready inside the grace and one Enter submits it',t=>world(t,({run,events,orcaState})=>{
  const body=status(run);
  assert.equal(worker(body).liveness,'staged-input');
  assert.deepEqual(body.frontier.nudgeReadyJobs,[JOB]);
  const nudge=run(['nudge','--job',JOB]);
  assert.equal(nudge.status,0,nudge.stderr||nudge.stdout);
  assert.equal(out(nudge).action,'submit-staged-input');
  assert.equal(orcaState().terminals[HANDLE].enters,1,'one Enter-only send');
  assert.equal(events('op-worker-nudged').length,1);
},{screen:['Claude','','❯ [Pasted Content 512 chars]'].join('\n')}));

test('a command-terminal worker has no launch grace: its prompt was already proven submitted',t=>world(t,({run})=>{
  const body=status(run);
  assert.equal(worker(body).liveness,'turn-idle');
  assert.deepEqual(body.frontier.nudgeReadyJobs,[JOB]);
},{managed:false}));

test('nudge refuses to append a wake to foreign input and types nothing',t=>world(t,({run,orcaState,events})=>{
  assert.equal(worker(status(run)).liveness,'turn-idle','foreign text in the input row still reads as a prompt');
  const nudge=run(['nudge','--job',JOB]);
  assert.equal(nudge.status,1,'refused');
  const res=out(nudge);
  assert.equal(res.reason,'foreign-input');
  assert.equal(res.nudged,false);
  assert.equal(orcaState().sends??0,0,'nothing was typed - no wake text, no Enter, no split retry');
  assert.equal(events('op-worker-nudged').length,0);
},{screen:['Claude','','❯ continue to cut 6','  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n'),managed:false,dispatchedAgo:HOUR}));

test('an input row holding this job\'s own wake text is not foreign',t=>world(t,({run,events})=>{
  const nudge=run(['nudge','--job',JOB],{STARCI_FAKE_ORCA_SEND_STALLED:'landed'});
  assert.equal(nudge.status,0,nudge.stderr||nudge.stdout);
  assert.equal(out(nudge).nudged,true,'the runtime\'s own staged wake is not foreign input');
  assert.equal(events('op-worker-nudged').length,1);
},{screen:`Claude\n\n❯ ${WAKE}`,managed:false,dispatchedAgo:HOUR}));
