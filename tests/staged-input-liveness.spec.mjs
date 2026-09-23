import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {classifyAgentScreen,stagedInputRegion,stagedInputRow} from '../scripts/kernel/terminal-liveness.mjs';

// Incident inc-06aeecf432f1 (starci-next base-repos, backend.scaffold cut ordinal 5): a Devin
// command-terminal worker sat 13+ minutes with its pasted contract text still in the input row and no
// work. The contract says "Running", "Working" and "esc to interrupt", so the whole-screen activity test
// read the frame `active`: dispatch's awaitSubmission called the paste submitted, status said active, and
// `api nudge` skipped it as worker-active. A staged, unsubmitted paste is never `active`: the classifier
// finds the input region by the text the runtime sent and only the rows above it can prove a turn, and
// nudge submits a staged paste with one Enter-only send.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// Contract prose that trips every activity marker the classifier and awaitSubmission know.
const PREAMBLE=[
  '[Op] code.refactor - dispatched Task preamble and operation contract.',
  'Running the declared checks yourself is part of this contract.',
  '• Working rules: file exactly one api report and end your turn.',
  'Never press esc to interrupt a long check; report the tokens you spent.',
].join('\n');
const INLINE_PASTE=['Devin','',`> ${PREAMBLE.split('\n')[0]}`,...PREAMBLE.split('\n').slice(1).map(l=>`  ${l}`)].join('\n');

/* ------------------------------------------------------------------ units */

test('an inline paste of the sent text is staged-input, never active',()=>{
  assert.equal(classifyAgentScreen(INLINE_PASTE).state,'active','without the sent text the pasted words read as a spinner (the incident)');
  const staged=classifyAgentScreen(INLINE_PASTE,{sentText:PREAMBLE});
  assert.equal(staged.state,'staged-input');
  assert.match(staged.row,/^> \[Op\] code\.refactor/);
  assert.equal(stagedInputRow(INLINE_PASTE,undefined,{sentText:PREAMBLE}),staged.row);
  // A TUI whose input box shows only the tail of a long paste (no glyph row in view) is staged too.
  const tail=['Devin',...PREAMBLE.split('\n').slice(1).map(l=>`  ${l}`)].join('\n');
  assert.equal(classifyAgentScreen(tail,{sentText:PREAMBLE}).state,'staged-input');
  // The "[Pasted Content]" marker needs no sent text.
  assert.equal(classifyAgentScreen('Codex\nmodel: gpt-6-sol\n\n› [Pasted Content 5012 chars]\n  gpt-6-sol high · repo').state,'staged-input');
});

test('a submitted prompt, a live turn above a queued paste and an idle prompt keep their states',()=>{
  // Submitted: the transcript echoes the prompt, the turn runs, the input row is empty.
  const submitted=[`› ${PREAMBLE.split('\n')[0]}`,'• Working (12s • esc to interrupt)','› Ask Codex to do anything'].join('\n');
  assert.equal(classifyAgentScreen(submitted,{sentText:PREAMBLE}).state,'active');
  assert.equal(stagedInputRegion(submitted,{sentText:PREAMBLE}),null);
  // A live spinner directly above a staged follow-up is still a running turn.
  const queued=['• Working (3m 44s • esc to interrupt)','› [Pasted Content 900 chars]'].join('\n');
  assert.equal(classifyAgentScreen(queued).state,'active');
  // A finished answer after an old spinner, then a staged paste: the paste is what waits.
  const finished=['• Working (12m 03s • esc to interrupt)','• All checks passed; report filed.','  done 11:27 PM','› [Pasted Content 900 chars]'].join('\n');
  assert.equal(classifyAgentScreen(finished).state,'staged-input');
  assert.equal(classifyAgentScreen('Codex\nmodel: gpt-6-sol\n› Ask Codex to do anything',{sentText:PREAMBLE}).state,'turn-idle');
});

/* ------------------------------------------------------------ fake Orca */

const opFixture=(t,extra={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-staged-input-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_PREAMBLE:PREAMBLE,...extra};
  const run=(args,more={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const sends=()=>fs.readFileSync(logFile,'utf8').trim().split('\n').map(json).filter(e=>e?.argv?.[0]==='terminal'&&e.argv[1]==='send').map(e=>e.argv);
  const workflowId='wf-staged-input',jobId='job-staged-input';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const dispatch=()=>run(['dispatch','--repo',repo,'--job',jobId,'--model','codex-agent','--spawn','--json']);
  const events=kind=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  const job=()=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);}finally{l.close();}};
  return {repo,workflowId,jobId,run,dispatch,events,job,orcaState,writeState,sends};
};

test('dispatch: an inline paste that never left the input box gets one Enter, then is refused prompt-stuck',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_STUCK_PASTE:'inline-never'});
  const r=fx.dispatch();
  assert.notEqual(r.status,0,'the pasted "Running"/"Working" words are not a submitted turn');
  const [rejected]=fx.events('dispatch-rejected');
  assert.deepEqual([rejected?.step,rejected?.signal],['submission','prompt-stuck']);
  assert.equal(fx.orcaState().terminals['fake-terminal-1'].enters,1,'exactly one Enter-only send');
  assert.equal(fx.job()?.status,'queued');
});

test('dispatch: an inline paste one Enter submits is a running job',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_STUCK_PASTE:'inline-enter'});
  const r=fx.dispatch();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(fx.job()?.status,'running');
  assert.equal(fx.orcaState().terminals['fake-terminal-1'].enters,1);
});

test('status, observe and nudge: a running worker whose paste sits unsubmitted is staged-input and nudge sends Enter only',t=>{
  const fx=opFixture(t);
  const r=fx.dispatch();
  assert.equal(r.status,0,r.stderr||r.stdout);
  // The incident frame: the contract is back in (never left) the input row of the running worker.
  fx.writeState(s=>{s.terminals['fake-terminal-1'].staged=true;});
  const inline={STARCI_FAKE_ORCA_STUCK_PASTE:'inline-enter'};

  const status=json(fx.run(['status','--repo',fx.repo,'--workflow',fx.workflowId,'--json'],inline).stdout);
  const worker=status.workers.find(w=>w.jobId===fx.jobId);
  assert.deepEqual([worker.screenState,worker.liveness],['staged-input','staged-input'],'never active');
  assert.equal(status.frontier.state,'worker-nudge-ready');
  assert.deepEqual(status.frontier.nudgeReadyJobs,[fx.jobId]);

  const observed=json(fx.run(['observe','--repo',fx.repo,'--job',fx.jobId,'--json'],inline).stdout);
  assert.equal(observed.turnState,'staged-input');

  const before=fx.sends().length;
  const nudged=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json'],inline);
  assert.equal(nudged.status,0,nudged.stderr);
  assert.deepEqual([json(nudged.stdout).nudged,json(nudged.stdout).action],[true,'submit-staged-input']);
  const sent=fx.sends().slice(before);
  assert.equal(sent.length,1,'one send');
  assert.ok(sent[0].includes('--enter'),'it is an Enter');
  assert.equal(sent[0][sent[0].indexOf('--text')+1]??'','','with no text typed on top of the paste');
  assert.equal(fx.orcaState().terminals['fake-terminal-1'].staged,false,'the paste was submitted');
  const [event]=fx.events('op-worker-nudged');
  assert.deepEqual([event.priorLiveness,event.action],['staged-input','submit-staged-input']);
});
