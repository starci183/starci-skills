import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../engine/yaml.mjs';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {classifyAgentScreen,ghostSuggestionOf,cardLivenessPatterns} from '../scripts/kernel/terminal-liveness.mjs';

// "job qwen xong/treo cũng không ai nhắn" (owner, 2026-09-25). Five defects, one spec each:
//  A. busy frames read turn-idle: a wrapped Devin spinner block, Claude's effort row under its spinner
//     (mia inc-1b82f657a6a8, inc-fcd1c1c10d8a; nivo inc-266976b75b25) - the patterns live on the cards;
//  B. a finished Qwen frame read active-unclassified, and its ghost suggestion was foreign input;
//  C. one long bounded command read wedged (nivo inc-d8f08b77ca8b);
//  D. a DONE worker stayed leased with its terminal open through a whole typed peer-wait
//     (nivo op-integration.verify-25532858e7 under peer-wait inc-8cce1cf1b330);
//  E. /status never said a job was done and waiting on a peer.
// Frames are the rows captured from live terminals on 2026-09-25 (nivo term_a51fe9e2, term_ddd12bb0).

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const card=agent=>parseYaml(fs.readFileSync(path.join(ROOT,'modules','models','agents',`${agent}.yaml`),'utf8'));

const DEVIN_FOOT=['──────────────────────────────────────────── (bypass permissions on) ─','❭ Guide Devin while it works',
  '──────────────────────────────────────────────────────────────────────','SWE-2 Max                            Context: 159k / 262k tokens (60%)','4 shells · ↓ select'];
const DEVIN_WRAPPED=[' │ 4 +  import path from "node:path";',
  '⠀⠴ Writing .\\.starciwork\\features\\collab\\impl\\nivo-',
  '  fe\\evidence\\surface-r2\\tools\\emit-evidence.mjs · 113m 0s · (1291c ·',
  '  ctrl+o for details · alt+t to toggle)',...DEVIN_FOOT].join('\n');
const DEVIN_DONE=[' The dispatch is settled; returning to idle.','──────────────────────────────────────────── (bypass permissions on) ─',
  '❭ Ask Devin to build features, fix bugs, or work on your code','──────────────────────────────────────────────────────────────────────',
  'SWE-2 Max                             Context: 35k / 262k tokens (13%)','4 shells · ↓ select'].join('\n');
const CLAUDE_CHROME=['──────────────────────────────────────────────────────────────────────','❯ ',
  '──────────────────────────────────────────────────────────────────────','  ⏵⏵ bypass permissions on (shift+tab to cycle)'];
const QWEN_RULE='──────────────────────────────────────────────────────────────────────';
const QWEN_FOOT=['  ➜ nivo-backend · git:(main) · deepseek-v4.1-flash (Token Plan','  Singapore) · 1.0m Context 26.6% used',
  '  YOLO mode (tab to cycle) · 2 tasks done','  26.6% used'];
const QWEN_DONE=['    Nothing further to do — the dispatch is closed: report filed','    (done), node-local evidence committed at head 010a320d, and the',
  '     single worker_done already sent.',QWEN_RULE,'* settle op-integration.verify-25532858e7',QWEN_RULE,...QWEN_FOOT].join('\n');
const QWEN_IDLE=['  ◆︎ Report filed.',QWEN_RULE,'*   Type your message or @path/to/file',QWEN_RULE,...QWEN_FOOT].join('\n');
const SONAR=[' ● Read shell 65471a',' │ Timeout: 4m40s',' └ No output yet (still running)',
  '⠋ Running tools · 45m 3s (esc twice to interrupt)',...DEVIN_FOOT].join('\n');

/* ------------------------------------------------------------------ A */
test('A: the Devin and Claude cards declare the rows that prove a running turn', () => {
  const devin=card('devin').liveness, claude=card('claude').liveness;
  assert.ok(devin.busyPatterns.length>=3,'the braille spinner row, its elapsed timer and its hint');
  assert.ok(claude.busyPatterns.length>=1 && claude.chromePatterns.length>=1,'the timer-and-tokens tail and the effort row');
  const cards=cardLivenessPatterns({refresh:true});
  assert.ok(cards.get('devin').busy.length===devin.busyPatterns.length,'every declared pattern compiles');
  assert.ok(cards.get('claude').chrome.length===claude.chromePatterns.length);
});

test('A: a wrapped Devin spinner block above "Guide Devin while it works" is active (inc-1b82f657a6a8, inc-266976b75b25)', () => {
  assert.equal(classifyAgentScreen(DEVIN_WRAPPED).state,'active','the braille row has no digit, the last row is the hint alone');
  assert.equal(classifyAgentScreen(DEVIN_WRAPPED,{provider:'devin'}).state,'active');
  assert.equal(classifyAgentScreen(['⠋ Thinking · 13m 17s (esc twice to interrupt)',...DEVIN_FOOT].join('\n')).state,'active');
  // The same wrap with the timer split onto its own row.
  assert.equal(classifyAgentScreen(['⠇⠀ Writing .\\a\\very\\long\\path\\that\\wraps\\at\\its\\separators\\component.tsx','  · 32m 36s · (412c ·',
    '  ctrl+o for details · alt+t to toggle)',...DEVIN_FOOT].join('\n')).state,'active');
  assert.equal(classifyAgentScreen(DEVIN_DONE).state,'turn-idle','a finished Devin turn still reads idle');
});

test('A: a Claude spinner above its effort row and an empty ❯ input is active (inc-fcd1c1c10d8a)', () => {
  const galloping=['● Reading the handover packet.','* Galloping… (8s · ↓ 288 tokens)','                                              ◐ medium · /effort',...CLAUDE_CHROME].join('\n');
  assert.equal(classifyAgentScreen(galloping).state,'active');
  assert.equal(classifyAgentScreen(galloping,{provider:'claude'}).state,'active');
  // The effort row is chrome, not an answer: a finished answer below the spinner still ends the turn.
  assert.equal(classifyAgentScreen(['* Galloping… (8s · ↓ 288 tokens)','● Report filed with outcome done.','◐ medium · /effort',...CLAUDE_CHROME].join('\n')).state,'turn-idle');
  assert.equal(classifyAgentScreen(['✻ Cogitated for 15s · done 12:15 AM',...CLAUDE_CHROME].join('\n')).state,'turn-idle');
});

/* ------------------------------------------------------------------ B */
test('B: a finished Qwen frame reads turn-idle, and its card-declared ghost suggestion is not typed input', () => {
  const qwen=card('qwen').liveness;
  assert.ok(qwen.inputRow?.pattern && qwen.ghostSuggestion,'the card declares its input row and its ghost suggestion');
  assert.equal(classifyAgentScreen(QWEN_DONE).state,'turn-idle','was unknown, so active-unclassified while the footer redrew');
  assert.equal(classifyAgentScreen(QWEN_IDLE).state,'turn-idle','the empty input box too');
  assert.equal(ghostSuggestionOf(QWEN_DONE,'qwen'),'settle op-integration.verify-25532858e7');
  assert.equal(ghostSuggestionOf(QWEN_IDLE,'qwen'),null,'the placeholder is no suggestion');
  assert.equal(ghostSuggestionOf(QWEN_DONE,'codex'),null,'only a card that declares it has a ghost');
  // A Qwen spinner above the box is a running turn.
  assert.equal(classifyAgentScreen(['⠏ Considering the options… (esc to cancel, 1m 3s)',QWEN_RULE,'*   Type your message or @path/to/file',QWEN_RULE,...QWEN_FOOT].join('\n')).state,'active');
  // A bullet in the transcript is not the input row: only a row framed by rules is.
  assert.equal(classifyAgentScreen(['* a markdown bullet','  more prose'].join('\n')).state,'unknown');
});

/* ------------------------------------------------------------------ C */
test('C: one long bounded command is a running tool, never wedged; an unbounded silent one still is (inc-d8f08b77ca8b)', () => {
  assert.equal(classifyAgentScreen(SONAR).state,'active','a shell read with a Timeout polls a --wait scan');
  assert.equal(classifyAgentScreen(SONAR.replace('● Read shell 65471a','○ Running command').replace('45m','95m')).state,'active','a command with its own Timeout returns by itself');
  const xargs=[' ○ Running command',' │ $ grep -rln "work/implementation@1" .starciwork/ | head -10 | xargs grep -l "state:"',
    ' │ No output yet (still running)','⠙⠀ Thinking · 60m 34s (esc twice to interrupt)','❭ Guide Devin while it works'].join('\n');
  assert.equal(classifyAgentScreen(xargs).state,'wedged','no bound anywhere in its tool block');
});

/* ----------------------------------------------------- api world (B, C, D) */
const WF='wf-busy-cards',PEER='wf-busy-peer',JOB='job-busy-cards',HANDLE='term-busy-cards',OP='docs.author';
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const MIN=60*1000,HOUR=60*MIN;
const git=(cwd,args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,
    GIT_AUTHOR_NAME:'spec',GIT_AUTHOR_EMAIL:'spec@example.invalid',GIT_COMMITTER_NAME:'spec',GIT_COMMITTER_EMAIL:'spec@example.invalid'}});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
};
const world=(t,fn,{screen,provider,dispatchedAgo=HOUR}={})=>withLedger(t,({root,repoRoot,machineHome,ledger})=>{
  git(repoRoot,['init','-q']);
  fs.writeFileSync(path.join(repoRoot,'.gitignore'),'.starciwork/\n');
  fs.mkdirSync(path.join(repoRoot,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repoRoot,'docs','readme.md'),'# docs\n');
  git(repoRoot,['add','-A']);git(repoRoot,['commit','-q','-m','seed']);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'orca-state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:{[HANDLE]:{handle:HANDLE,connected:true,writable:true,command:provider,screen}}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),LOCALAPPDATA:machineHome};
  delete env.ORCA_TERMINAL_HANDLE;delete env.STARCI_ROLE;delete env.STARCI_OP_JOB;
  const run=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repoRoot,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const dispatchedAt=Date.now()-dispatchedAgo;
  seedWorkflow(ledger,{id:PEER,state:{phase:'running'},jobs:[{jobId:'job-of-the-peer',opId:'backend.implement',kind:'op',status:'queued',attempt:1,payload:{opId:'backend.implement'}}]});
  seedWorkflow(ledger,{id:WF,state:{phase:'running'},
    jobs:[{jobId:JOB,opId:OP,kind:'op',status:'running',attempt:1,workerId:HANDLE,leaseToken:'tok-busy',createdAt:dispatchedAt,
      payload:{opId:OP,title:'author the docs',records:['docs/readme.md'],owned_paths:['docs/'],provider,agent:provider,
        orca:{dispatchId:HANDLE,agentTerminalHandle:HANDLE},hierarchy:{runtime:{host:'orca',agent:provider,dispatchId:HANDLE,terminalHandle:HANDLE}}}}],
    leases:[{resourceKey:'path:docs/',jobId:JOB,expiresAt:Date.now()+HOUR}]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id IN (?,?)").run(WF,PEER);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,OP,1,HANDLE,'# busy-cards contract','{}',dispatchedAt);
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-dispatched',payload:{op:OP,dispatch:HANDLE,terminal:HANDLE},createdAt:dispatchedAt});
  const job=()=>ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB);
  const leases=()=>ledger.db.prepare('SELECT * FROM leases WHERE job_id=?').all(JOB);
  const events=kind=>ledger.db.prepare('SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND kind=?').all(WF,kind);
  const orcaState=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
  const consumeReport=(at=Date.now()-30*MIN)=>ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at)
    VALUES(?,?,?,1,0,'done',?,?,?)`).run(WF,HANDLE,OP,JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:'docs authored'}),at,at-MIN);
  return fn({repoRoot,ledger,run,job,leases,events,orcaState,consumeReport});
});
const status=run=>{const r=run('status','--workflow',WF);assert.equal(r.status,0,r.stderr||r.stdout);return out(r);};

test('B: a finished Qwen worker with a ghost suggestion is nudge-ready and the wake is typed over the suggestion',t=>world(t,({run,orcaState})=>{
  const s=status(run);
  assert.equal(s.workers[0].liveness,'turn-idle','not active-unclassified');
  assert.deepEqual(s.frontier.nudgeReadyJobs,[JOB]);
  const nudge=out(run('nudge','--job',JOB));
  assert.notEqual(nudge?.reason,'foreign-input',JSON.stringify(nudge));
  assert.ok(orcaState().sends>=1,'the wake was typed (the stub never repaints, so its delivery stays unproven here)');
},{screen:QWEN_DONE,provider:'qwen'}));

test('B: the same input row on a card with no ghost suggestion stays foreign input',t=>world(t,({run,orcaState})=>{
  const r=run('nudge','--job',JOB);
  assert.equal(out(r)?.reason,'foreign-input',r.stdout);
  assert.equal(orcaState().sends??0,0,'nothing typed');
},{screen:QWEN_DONE.replace('* settle','› settle'),provider:'codex'}));

test('C: a worker polling one long bounded scan reads active; the frontier is engaged, not actionable',t=>world(t,({run})=>{
  const s=status(run);
  assert.equal(s.workers[0].liveness,'active');
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.frontier.wedgedJobs,s.frontier.nudgeReadyJobs],['engaged',false,[],[]]);
},{screen:SONAR,provider:'devin'}));

test('D: a done worker held by a peer-wait is released - terminal closed, lease back, job unsettled - and settle needs no live worker',t=>world(t,({run,job,leases,events,orcaState,consumeReport})=>{
  consumeReport();
  const {incidentId}=out(run('incident','--workflow',WF,'--kind','peer-wait','--peer',PEER,'--holds',JOB,'--until-job','job-of-the-peer',
    '--detail','the closing pass waits for the peer seam to settle'));
  assert.ok(incidentId);
  const held=status(run);
  assert.deepEqual([held.frontier.state,held.frontier.actionable],['peer-wait',false]);
  assert.deepEqual(held.frontier.heldWorkerJobs,[JOB]);
  assert.deepEqual([held.frontier.heldSettleJobs[0].jobId,held.frontier.heldSettleJobs[0].worker],[JOB,'held']);

  const r=run('reconcile','--job',JOB,'--release-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.deepEqual([body.releasedWhileHeld,body.custody.state,body.heldBy.incident,body.heldBy.peer,body.status],[true,'released',incidentId,PEER,'running']);
  assert.ok(orcaState().quits.some(q=>q.handle===HANDLE && q.text==='/quit'),'the agent quit with its own CLI input');
  assert.ok(orcaState().closed.includes(HANDLE),'its terminal closed');
  assert.equal(leases().length,0,'its path lease is released');
  assert.equal(job().status,'running','the job stays unsettled');
  assert.equal(JSON.parse(job().payload_json).workerReleased.custody.state,'released');
  assert.equal(events('worker-released-while-held').length,1);

  const after=status(run);
  assert.equal(after.workers[0].liveness,'released','no host read, never dead or nudge-ready');
  assert.deepEqual([after.frontier.heldWorkerJobs,after.frontier.heldSettleJobs[0].worker,after.frontier.deadWorkerJobs,after.frontier.nudgeReadyJobs],[[],'released',[],[]]);
  assert.deepEqual([after.frontier.state,after.frontier.actionable],['peer-wait',false]);
  assert.equal(leases().length,0,'status renews no lease of a released worker');
  assert.equal(out(run('reconcile','--job',JOB,'--release-worker')).alreadyReleased,true);
  assert.equal(events('worker-released-while-held').length,1,'a repeat writes nothing');

  // The wait resolves; the settle runs against the already-released worker.
  assert.equal(run('incident','--workflow',WF,'--resolve',incidentId,'--detail','peer landed').status,0);
  assert.deepEqual(status(run).frontier.settleReadyJobs,[JOB]);
  assert.equal(out(run('reconcile','--job',JOB,'--release-worker')).alreadyReleased,true,'still released once the wait resolved');
  const quits=orcaState().quits.length,closed=orcaState().closed.length;
  assert.equal(run('check','--job',JOB,'--checks',JSON.stringify({checks:[{name:'regression',command:'npm test',exitCode:1,evidence:'red'}]})).status,0);
  const settled=run('settle','--job',JOB,'--verdict','fail');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  const receipt=out(settled);
  assert.deepEqual([receipt.status,receipt.terminalClosed.custody.state,receipt.terminalClosed.custody.proof],['failed','released','released-while-held']);
  assert.deepEqual([orcaState().quits.length,orcaState().closed.length],[quits,closed],'nothing is quit or closed again');
  const proof=out(run('reconcile','--job',JOB,'--release-worker'));
  assert.deepEqual([proof.ok,proof.alreadyReleased],[true,true],'the release proof accepts an already-released worker');
},{screen:QWEN_DONE,provider:'qwen'}));

test('D: --release-worker refuses a running job no wait holds, and a job whose report is not consumed',t=>world(t,({run,job,orcaState})=>{
  const r=run('reconcile','--job',JOB,'--release-worker');
  assert.equal(r.status,1);
  assert.match(r.stdout+r.stderr,/release-worker-not-settled/);
  assert.equal(job().status,'running');
  assert.equal((orcaState().quits??[]).length,0);
},{screen:QWEN_DONE,provider:'qwen'}));

test('D: the watchdog releases every frontier heldWorkerJobs entry through the api', async () => {
  const {releaseHeldWorkers}=await import('../scripts/kernel/watchdog.mjs');
  const calls=[];
  const run=(args)=>{calls.push(args);return args.includes('job-b')
    ?{ok:false,value:{ok:false,code:'release-worker-not-settled'},stderr:''}
    :{ok:true,value:{ok:true,releasedWhileHeld:true,custody:{state:'released'},leasesReleased:1}};};
  const released=releaseHeldWorkers({frontier:{heldWorkerJobs:['job-a','job-b']}},{run,repoPath:'D:/repo'});
  assert.deepEqual(calls.map(a=>a.slice(a.indexOf('--job'),a.indexOf('--job')+3)),[['--job','job-a','--release-worker'],['--job','job-b','--release-worker']]);
  assert.deepEqual(released[0],{jobId:'job-a',ok:true,custody:'released',leasesReleased:1});
  assert.deepEqual([released[1].ok,released[1].reason],[false,'release-worker-not-settled']);
  assert.deepEqual(releaseHeldWorkers({frontier:{}},{run}),[]);
  const src=fs.readFileSync(path.join(ROOT,'scripts','kernel','watchdog.mjs'),'utf8');
  assert.match(src,/repair && \(status\.value\?\.frontier\?\.heldWorkerJobs \?\? \[\]\)\.length \? releaseHeldWorkers/,'only a --repair watchdog releases');
});

/* ------------------------------------------------------------------ E */
test('E: /status lists each held settle per workflow: done, waiting on <peer workflow>/<job>, with its age', async (t) => {
  const {workflowProgress,progressMessages,settleHoldsOf}=await import('../scripts/supervisor/progress-report.mjs');
  await withLedger(t, async ({ledger}) => {
    const wf='wf-nivo-app-auth-mudqjob3', peer='wf-nivo-modules-agentos-mudqjov6', job='op-integration.verify-25532858e7';
    seedWorkflow(ledger,{id:wf,state:{phase:'running'}});
    seedWorkflow(ledger,{id:peer,state:{phase:'running'}});
    const now=Date.now(), start=now-5*HOUR;
    ledger.db.prepare("UPDATE workflows SET phase='running', created_at=? WHERE workflow_id=?").run(start,wf);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf,1,'g','hoàn thiện đăng nhập',JSON.stringify({derivedPlan:{legs:['integration.verify']}}),start);
    ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at)
      VALUES(?,?,'integration.verify',3,0,'op','op',?,'running','term_ddd12bb0',?,?)`).run(job,wf,JSON.stringify({orca:{dispatchId:'ctx_47c2cd765a50'}}),start,start);
    ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at)
      VALUES(?,?,'integration.verify',3,0,'done','{"outcome":"done","summary":"verified"}',?,?)`).run(wf,'ctx_47c2cd765a50',now-50*MIN,now-51*MIN);
    ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)")
      .run('inc-8cce1cf1b330',wf,'integration.verify','[peer-wait] Closing pass waits for the Modules seam',now-40*MIN);
    ledger.appendEvent({workflowId:wf,entityType:'incident',entityId:'inc-8cce1cf1b330',kind:'incident-raised',createdAt:now-40*MIN,
      payload:{kind:'peer-wait',peer,holds:[job],until:[{type:'job',jobId:'op-backend.implement-1747a01ad5',want:'settled'}]}});
    const holds=settleHoldsOf(ledger.db,wf,{now});
    assert.deepEqual(holds.map(h=>[h.jobId,h.outcome,h.heldBecause,h.incident,h.peer,h.peerJob]),[[job,'done','peer-wait','inc-8cce1cf1b330',peer,'op-backend.implement-1747a01ad5']]);
    assert.ok(Math.abs(holds[0].ageMs-40*MIN)<MIN,'the age runs from the later of the wait and the consumed report');
    const row=ledger.db.prepare('SELECT workflow_id, created_at FROM workflows WHERE workflow_id=?').get(wf);
    const text=progressMessages([{repo:'r',...workflowProgress(ledger.db,row,{now})}],{now}).join('\n');
    assert.match(text,/⏸ Kiểm tích hợp thật \(op-integration\.verify-25532858e7\): xong, đang chờ Modules \(AgentOS\)\/op-backend\.implement-1747a01ad5 \(inc-8cce1cf1b330\) — đã 40 phút/);
    assert.match(text,/⏸ 1 việc đã xong đang chờ/);
    // Resolved: no hold is listed.
    ledger.db.prepare("UPDATE incidents SET status='resolved' WHERE incident_id='inc-8cce1cf1b330'").run();
    assert.deepEqual(settleHoldsOf(ledger.db,wf,{now}),[]);
  });
});
