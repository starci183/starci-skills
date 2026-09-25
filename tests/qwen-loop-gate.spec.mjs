import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {classifyAgentScreen,gateRemedy} from '../scripts/kernel/terminal-liveness.mjs';
import {loadAdapter,gateAutoAnswerRule,gateMenuPosition} from '../scripts/agent/lib.mjs';
import {ensureLaunchTrust,ensureHostSettings,checkHostSettings,hostPrerequisitesOf} from '../scripts/agent/trust.mjs';

// starci-next wf-sn-foundation-mufrhftf inc-af01e1cedbf4: a qwen worker (op-backend.implement-df7282b6ef)
// stopped at Qwen Code's interactive "A potential loop was detected" menu (Keep / Disable loop detection)
// and no unattended worker could answer it. The qwen card now pins model.skipLoopDetection (with
// model.maxSessionTurns) before every launch, names the dialog as the gate qwen-loop-detection, and
// api nudge answers it with 'Disable loop detection for this session'; answered maxPerAttempt times on one
// attempt it reads gate-loop and recovers through reconcile --dead-worker --settle-failed.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// The dialog exactly as Qwen Code 0.24.5 draws it (%APPDATA%/npm/node_modules/@qwen-code/qwen-code,
// LoopDetectionConfirmation.tsx: a round warning box, marginLeft 1, paddingX 1; BaseSelectionList puts the
// `›` cursor before the numbered option), at a 110-column terminal, above Qwen's footer.
const box=rows=>{const w=104;return [' ╭'+'─'.repeat(w)+'╮',...rows.map(r=>' │ '+r.padEnd(w-1)+'│'),' ╰'+'─'.repeat(w)+'╯'];};
const DIALOG_ROWS=[
  '?  A potential loop was detected',
  '',
  'This can happen due to repetitive tool calls or other model behavior. Do you want to keep loop detection',
  'enabled or disable it for this session?',
  '',
  '› 1. Keep loop detection enabled (esc)',
  '  2. Disable loop detection for this session',
  '',
  'Note: Setting "model.skipLoopDetection" to true in your settings.json disables only the heuristic loop',
  'checks for future sessions; the always-on guards (consecutive identical tool calls, repeated shell',
  'inspection commands, and the per-turn tool-call cap) are not affected by it. The cap is tunable via',
  '"model.maxToolCallsPerTurn" (0 disables it). Disabling for this session above suppresses everything.',
];
const TRANSCRIPT=['✦ I will read the slice files again.','╭──────────────────────────╮','│ ✓  ReadFile src/app.ts   │','╰──────────────────────────╯'];
const FOOTER=['  YOLO mode (tab to cycle) · 1 task running'];
const LOOP_DIALOG=[...TRANSCRIPT,...box(DIALOG_ROWS),...FOOTER].join('\n');
const QWEN_IDLE=['✦ Slice done; filing the report next.','─'.repeat(60),'*   Type your message or @path/to/file','─'.repeat(60),'  YOLO mode (tab to cycle)'].join('\n');

/* ------------------------------------------------------------------ units */

test('the Qwen loop-detection menu is the interactive gate qwen-loop-detection, even behind its box rails',()=>{
  const read=classifyAgentScreen(LOOP_DIALOG);
  assert.deepEqual([read.state,read.gate],['interactive-gate','qwen-loop-detection']);
  // The title scrolled out of the window: the two option labels alone name it.
  const tail=[...TRANSCRIPT,...box(DIALOG_ROWS).slice(4),...FOOTER].join('\n');
  assert.equal(classifyAgentScreen(tail).gate,'qwen-loop-detection');
  // The cursor row lifted out of the frame and appended as a draft row (option order reversed).
  const lifted=[...TRANSCRIPT,...box(DIALOG_ROWS.filter(r=>!r.startsWith('›'))),...FOOTER].join('\n');
  assert.equal(classifyAgentScreen(lifted,{draft:'1. Keep loop detection enabled (esc)'}).gate,'qwen-loop-detection');
  // The halted-request notice Qwen leaves in the transcript afterwards is no gate: the prompt is back.
  const notice=['ℹ A potential loop was detected. This can happen due to repetitive tool calls or other model behavior. The request has been halted.',
    '─'.repeat(60),'*   Type your message or @path/to/file','─'.repeat(60),'  YOLO mode (tab to cycle)'].join('\n');
  assert.notEqual(classifyAgentScreen(notice,{provider:'qwen'}).state,'interactive-gate');
  assert.match(gateRemedy('qwen-loop-detection'),/Disable loop detection for this session/);
});

test('the qwen card allowlists the continue option and the menu walk reaches it',()=>{
  const card=loadAdapter('qwen').card;
  const rule=gateAutoAnswerRule(card,'qwen-loop-detection');
  assert.equal(rule.select,'Disable loop detection for this session');
  assert.ok(card.gateAutoAnswer.gates['qwen-loop-detection'].maxPerAttempt>=1);
  // The cursor sits on Keep; Disable is one row down.
  assert.deepEqual(gateMenuPosition(LOOP_DIALOG,rule.select),{onTarget:false,direction:1});
  const moved=LOOP_DIALOG.replace('› 1. Keep','  1. Keep').replace('  2. Disable','› 2. Disable');
  assert.deepEqual(gateMenuPosition(moved,rule.select),{onTarget:true,direction:0});
});

test('the qwen card declares both host settings and the launch preflight pins them',t=>{
  const card=loadAdapter('qwen').card;
  const pre=hostPrerequisitesOf(card);
  assert.equal(pre.settingsFile,'<home>/.qwen/settings.json');
  assert.deepEqual(pre.settings,[{key:'model.maxSessionTurns',equals:-1},{key:'model.skipLoopDetection',equals:true}]);
  assert.match(card.why,/model\.skipLoopDetection must be true/);

  const home=fs.mkdtempSync(path.join(os.tmpdir(),'starci-qwen-host-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const file=path.join(home,'.qwen','settings.json');
  // No settings file: Qwen is not set up there, and the preflight never creates one.
  let receipt=ensureLaunchTrust({agent:'qwen',cwd:home,env:{STARCI_AGENT_TRUST_HOME:home}});
  assert.deepEqual([receipt.status,receipt.hostPrerequisites.state],['failed','missing-file']);
  assert.equal(fs.existsSync(file),false);

  fs.mkdirSync(path.dirname(file),{recursive:true});
  const original={modelProviders:{openai:[{id:'deepseek-v4.1-flash',baseUrl:'https://example.invalid/v1'}]},model:{name:'qwen3.8-flash',maxSessionTurns:240},ui:{theme:'x'}};
  fs.writeFileSync(file,JSON.stringify(original,null,2)+'\n');
  receipt=ensureLaunchTrust({agent:'qwen',cwd:home,env:{STARCI_AGENT_TRUST_HOME:home}});
  assert.deepEqual([receipt.status,receipt.hostPrerequisites.state],['written','written']);
  assert.deepEqual(receipt.hostPrerequisites.written,['model.maxSessionTurns','model.skipLoopDetection']);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.deepEqual(doc.model,{name:'qwen3.8-flash',maxSessionTurns:-1,skipLoopDetection:true});
  assert.deepEqual([doc.modelProviders,doc.ui],[original.modelProviders,original.ui],'every other key is kept');
  receipt=ensureLaunchTrust({agent:'qwen',cwd:home,env:{STARCI_AGENT_TRUST_HOME:home}});
  assert.deepEqual([receipt.status,receipt.hostPrerequisites.state],['already','already']);
  assert.equal(checkHostSettings({file,settings:pre.settings}).ok,true);

  // An unparsable settings file is reported, never rewritten.
  fs.writeFileSync(file,'{ "model": { // comment\n }');
  const bad=ensureHostSettings({file,settings:pre.settings});
  assert.deepEqual([bad.ok,bad.state],[false,'unreadable']);
  assert.equal(fs.readFileSync(file,'utf8'),'{ "model": { // comment\n }');
  // A test process without a trust home touches no real file.
  assert.equal(ensureLaunchTrust({agent:'qwen',cwd:home,env:{NODE_TEST_CONTEXT:'child'}}).hostPrerequisites.state,'skipped');
});

/* ------------------------------------------------------------ fake Orca */

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-qwen-loop-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stubFile=path.join(root,'fake-orca.mjs');fs.writeFileSync(stubFile,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stubFile]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile,LOCALAPPDATA:path.join(root,'localappdata')};
  const run=(args,more={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const workflowId='wf-qwen-loop',jobId='job-qwen-loop';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'qwen-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const events=kind=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  const d=run(['dispatch','--repo',repo,'--job',jobId,'--model','qwen-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const handle=Object.keys(orcaState().terminals)[0];
  // Mid-run the worker's turn halts at the loop menu, cursor on Keep; answered, Qwen returns to its prompt.
  const loop=()=>writeState(s=>{s.terminals[handle].screen=QWEN_IDLE;s.terminals[handle].gate={kind:'qwen-loop',cursor:0,cleared:false};s.terminals[handle].gateKeys=[];});
  const status=()=>json(run(['status','--repo',repo,'--workflow',workflowId,'--json']).stdout);
  return {repo,workflowId,jobId,handle,run,events,orcaState,loop,status};
};

test('api nudge answers the loop menu with the card option, records it, and a repeat past the limit is gate-loop',t=>{
  const fx=fixture(t);
  fx.loop();
  let status=fx.status();
  let worker=status.workers.find(w=>w.jobId===fx.jobId);
  assert.deepEqual([worker.liveness,worker.gate,worker.gateAutoAnswer.select,worker.gateAutoAnswer.answers],
    ['interactive-gate','qwen-loop-detection','Disable loop detection for this session',0]);
  assert.ok(status.frontier.nudgeReadyJobs.includes(fx.jobId),'an allowlisted host dialog is nudge-ready');

  const r=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.ok,out.nudged,out.action,out.gate,out.answered,out.cleared,out.answers],[true,true,'answer-gate','qwen-loop-detection',true,true,1]);
  const term=fx.orcaState().terminals[fx.handle];
  assert.deepEqual(term.gateKeys,['\x1b[B','\r'],'down to Disable, then Enter - no text typed into the menu');
  assert.equal(term.gate.cleared,true);
  assert.equal(term.connected,true,'Keep (which halts the request) was never picked');
  const [event]=fx.events('op-worker-gate-answered');
  assert.deepEqual([event.gate,event.select,event.answers,event.attempt],['qwen-loop-detection','Disable loop detection for this session',1,1]);
  assert.equal(fx.status().workers.find(w=>w.jobId===fx.jobId).liveness,'turn-idle','back at its prompt');

  // The same attempt loops again: answered up to maxPerAttempt, then it is a loop, not a prompt.
  const limit=loadAdapter('qwen').card.gateAutoAnswer.gates['qwen-loop-detection'].maxPerAttempt;
  for(let n=2;n<=limit;n+=1){
    fx.loop();
    const again=json(fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']).stdout);
    assert.deepEqual([again.action,again.answers],['answer-gate',n]);
  }
  fx.loop();
  status=fx.status();
  worker=status.workers.find(w=>w.jobId===fx.jobId);
  assert.deepEqual([worker.liveness,worker.gateAutoAnswer.loop,worker.gateAutoAnswer.answers],['gate-loop',true,limit]);
  assert.ok(!status.frontier.nudgeReadyJobs.includes(fx.jobId));
  assert.ok(status.frontier.wedgedJobs.includes(fx.jobId),'it recovers like a wedged worker');
  assert.match(status.frontier.reason??'',/gate-loop/);
  const refused=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.equal(refused.status,1);
  assert.equal(json(refused.stdout).reason,'worker-gate-loop');
  assert.deepEqual(fx.orcaState().terminals[fx.handle].gateKeys,[],'nothing typed into the looping menu');
  assert.equal(fx.events('op-worker-gate-loop').length,1);
  // The plain requeue refuses it; only the settle-failed route takes it.
  const plain=fx.run(['reconcile','--repo',fx.repo,'--job',fx.jobId,'--dead-worker','--json']);
  assert.equal(plain.status,1);
  assert.equal(json(plain.stdout).reason,'worker-gate-loop');
  const recovered=fx.run(['reconcile','--repo',fx.repo,'--job',fx.jobId,'--dead-worker','--settle-failed','--json']);
  assert.equal(recovered.status,0,recovered.stderr||recovered.stdout);
  const rec=json(recovered.stdout);
  assert.ok(['requeued','settled-failed','fenced'].includes(rec.recovery),recovered.stdout);
  assert.equal(rec.terminalClosed?.proof,'gate-loop-quit');
  assert.equal(fx.orcaState().terminals[fx.handle].gateKeys[0],'\x1b','Esc closes the menu before the quit command');
});
