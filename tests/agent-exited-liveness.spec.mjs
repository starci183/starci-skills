import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {classifyAgentScreen,exitedAgentPromptRow,shellPromptPrefix,shellReceivedText} from '../scripts/kernel/terminal-liveness.mjs';
import {sendWakeWithProof,sendEnterWithProof} from '../scripts/kernel/wake-delivery.mjs';

// 2026-09-24 02:23: a nudge was typed into a DEAD op terminal (term_8a556567, mm-work
// op-architecture.decide-9203b3dcd7). Its agent had exited and left a bare PowerShell prompt, and
// PowerShell ran the wake text as a command. A frame that ENDS in a bare shell prompt is agent-exited:
// every wake path refuses to type into it and api status reads the worker dead.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// Captured 2026-09-24 from term_0982b445 (mia-mia-backend): a Codex op whose agent exited mid-turn. The
// spinner residue ("Working", "Running hook") is still on screen; the last row is the shell prompt.
const DEAD_CODEX=['','• Ran node \'D:\\Repositories\\starci-academy-backend\\.claude\\bin\\starci.mjs\' validate \'.starciwork\' --json','  └ {',
  '      "schema": "starci/work-validate-report@1",','    … +29 lines (ctrl + t to view transcript)','      }',
  '    }•ng1 runing · /ps to view · /stop to close ng g •g g     W W · Running hook W W Wo Wo Wo','',
  '    }Wo Wo Wor6 Wor Wor or Work Work Work Worki WorkiWorkiWorki · Running hookWokiWorkinWorkin•Workinorkingorking',
  'PS D:\\Repositories\\mia-mia-backend>'].join('\n');
// Captured 2026-09-24 from a live Qwen op (nivo-backend) running a shell tool, with the PowerShell rows a
// shell tool prints in the transcript; the frame still ends in Qwen's own input box and footer.
const LIVE_QWEN=['  ✓ Shell cd /d D:\\Repositories\\nivo-backend && npm test -- --runInBand src/modules/integrations/mail/',
  '    PS D:\\Repositories\\nivo-backend> npm test','    PS D:\\Repositories\\nivo-backend>',
  '  ⠙ Following the white rabbit... (12m 48s · ↑ 78k tokens · esc to cancel)','─'.repeat(40),
  '*   Type your message or @path/to/file','─'.repeat(40),
  '  ➜ nivo-backend · git:(main) · deepseek-v4.1-flash (Token Plan Singapore) · 1.0m Context 18.6% used',
  '  Enter to steer · Ctrl+Q to queue · YOLO mode (tab to cycle) · 1 task done'].join('\n');
// Captured 2026-09-24 from a Claude Kernel (term_1a4f3026) at rest, plus a Bash tool row that printed a prompt.
const IDLE_CLAUDE=['● Bash(pwsh -c "Get-Location")','  ⎿  PS D:\\Repositories\\nivo-backend>',
  '✻ Sautéed for 19s · done 3:12 AM','─'.repeat(40),'❯','─'.repeat(40),'  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
const IDLE_CODEX=['• Ran git status','  └ PS D:\\x> git status','› Ask Codex to do anything','  gpt-6-sol high · 70% left · ~\\x'].join('\n');

/* ------------------------------------------------------------------ units */

test('only a frame that ends in a bare shell prompt is agent-exited',()=>{
  assert.equal(exitedAgentPromptRow(DEAD_CODEX),'PS D:\\Repositories\\mia-mia-backend>');
  // The classifier alone calls it unknown, which api liveness turned into live-idle - and nudge typed into it.
  assert.equal(classifyAgentScreen(DEAD_CODEX).state,'unknown');
  for(const frame of [LIVE_QWEN,IDLE_CLAUDE,IDLE_CODEX]) assert.equal(exitedAgentPromptRow(frame),null,frame.split('\n').at(-1));
  // A launch still starting shows the command after the prompt: not an exit.
  assert.equal(exitedAgentPromptRow('PS D:\\x> qwen --yolo --model deepseek-v4.1-flash'),null);
  for(const prompt of ['PS D:\\Repositories\\x>','PS C:\\>','D:\\Repositories\\x>','$','Hi@DESKTOP MINGW64 /d/x (main)\n$ ',
    'user@host:~/repo$','user@host ~ %','bash-5.2$','(venv) user@host:~/x$','root@box:/#'])
    assert.ok(exitedAgentPromptRow(`some output\n${prompt}\n\n`),prompt);
  for(const row of ['100%','> ','❯','*   Type your message or @path/to/file','# Heading','Total: 5$'])
    assert.equal(exitedAgentPromptRow(`x\n${row}`),null,row);
});

const stub=screens=>{
  const calls=[];let reads=0;
  return {calls,deps:{send:(input)=>{calls.push(input);return {ok:true};},
    read:()=>({ok:true,screen:screens[Math.min(reads++,screens.length-1)]}),sleep:()=>{}}};
};

test('no wake and no Enter is typed into an exited agent',()=>{
  let s=stub([DEAD_CODEX]);
  const woke=sendWakeWithProof({terminal:'t',text:'Operation liveness wake for durable job j1.',deps:s.deps});
  assert.deepEqual([woke.ok,woke.delivery,woke.evidence,woke.shellPrompt],[false,'agent-exited','shell-prompt','PS D:\\Repositories\\mia-mia-backend>']);
  assert.equal(s.calls.length,0,'nothing sent');
  s=stub([IDLE_CLAUDE]);
  assert.equal(sendWakeWithProof({terminal:'t',text:'Operation liveness wake for durable job j1.',before:DEAD_CODEX,deps:s.deps}).delivery,'agent-exited');
  assert.equal(s.calls.length,0,'a caller-read frame decides too');
  s=stub([DEAD_CODEX]);
  const entered=sendEnterWithProof({terminal:'t',deps:s.deps});
  assert.deepEqual([entered.ok,entered.delivery],[false,'agent-exited']);
  assert.equal(s.calls.length,0,'no Enter either');
  s=stub([IDLE_CLAUDE]);
  assert.equal(sendEnterWithProof({terminal:'t',deps:s.deps}).ok,true,'a live agent still gets its Enter');
  assert.equal(s.calls.length,1);
});

/* ------------------------------------------------------------ fake Orca */

const opFixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-agent-exited-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stubFile=path.join(root,'fake-orca.mjs');fs.writeFileSync(stubFile,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stubFile]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile};
  const run=args=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const sends=()=>fs.readFileSync(logFile,'utf8').trim().split('\n').map(json).filter(e=>e?.argv?.[0]==='terminal'&&e.argv[1]==='send');
  const workflowId='wf-agent-exited',jobId='job-agent-exited';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const events=kind=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  return {repo,workflowId,jobId,run,orcaState,writeState,sends,events};
};

test('status reads an exited worker dead, observe names it, and nudge refuses without typing',t=>{
  const fx=opFixture(t);
  const d=fx.run(['dispatch','--repo',fx.repo,'--job',fx.jobId,'--model','codex-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  fx.writeState(s=>{s.terminals['fake-terminal-1'].screen=DEAD_CODEX;});

  const status=json(fx.run(['status','--repo',fx.repo,'--workflow',fx.workflowId,'--json']).stdout);
  const worker=status.workers.find(w=>w.jobId===fx.jobId);
  assert.deepEqual([worker.screenState,worker.liveness,worker.shellPrompt],['agent-exited','agent-exited','PS D:\\Repositories\\mia-mia-backend>']);
  assert.equal(status.frontier.state,'worker-dead');

  const observed=json(fx.run(['observe','--repo',fx.repo,'--job',fx.jobId,'--json']).stdout);
  assert.equal(observed.turnState,'agent-exited');

  const before=fx.sends().length;
  const nudged=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.notEqual(nudged.status,0);
  assert.deepEqual([json(nudged.stdout).reason,json(nudged.stdout).delivery],['agent-exited','agent-exited']);
  assert.equal(fx.sends().length,before,'nothing typed into the shell');
  assert.equal(fx.events('op-worker-nudged').length,0);
});

/* ---------------------------------------- nivo term_8f9e0611, 03:56 */

// 2026-09-24 03:56 (after the guard above landed): nivo op-architecture.decide-e64bfaaea3 (Codex, attempt
// 11, term_8f9e0611). observe read turn-idle (stale-active: the "Working (10m 46s ...)" row had frozen),
// nudge typed the wake and PowerShell ran it (ParserError MissingLoopStatement); the event said
// delivered/wake-text because the shell's echo of the text looked like the wake landing. Captured frame,
// 80 columns: the Codex frame ends at its input row, the footer row below it is gone - overwritten by
// PowerShell's prompt, which is followed by the echoed wake and the parser error.
const NIVO_TRANSCRIPT=['    … +18 lines (ctrl + t to view transcript)','      }','    }',
  '• Ran orca orchestration check --terminal term_8f9e0611-1faa-415b-a343-4a2c2e3e8','24f --json','  └ {',
  '      "id": "e1790393-c1bf-437a-b6a9-146c93d5b9be",','    … +19 lines (ctrl + t to view transcript)','      }','    }',
  '• Ran node D:\\Repositories\\starci-academy-backend\\.claude\\scripts\\kernel\\api.mjs',' op-contract --repo D:',
  '  │ \\Repositories\\nivo-backend --job op-architecture.decide-e64bfaaea3',
  '  └ # dispatch contract — [Op] architecture.decide (job op-architecture.decide-e','64bfaaea3)',
  '    … +107 lines (ctrl + t to view transcript)','    (node:39400) ExperimentalWarning: SQLite is an experimental feature and migh',
  't change at any time','    (Use `node --trace-warnings ...` to show where the warning was created)',
  '• Working (10m 46s • esc to interrupt) · 1 background terminal running · /ps to','view · /stop to close',
  '› Ask Codex to do anything'];
const NIVO_PS='PS D:\\Repositories\\nivo-backend>';
const NIVO_WAKE='Operation liveness wake for durable job op-architecture.decide-e64bfaaea3 (architecture.decide) attempt 11. Your accepted contract remains running but no durable report is filed. Re-read the exact contract with api op-contract, continue only inside its existing authority, and file exactly one api report. Report done, partial, failed, ask or blocked truthfully; do not wait for another chat prompt and do not widen scope.';
const wrap80=line=>{const rows=[];for(let i=0;i<line.length;i+=80)rows.push(line.slice(i,i+80));return rows;};
const NIVO_AFTER=[...NIVO_TRANSCRIPT,...wrap80(`${NIVO_PS} ${NIVO_WAKE}`),'At line:1 char:366',
  '+ ... . Report done, partial, failed, ask or blocked truthfully; do not wai ...',
  '+                                                                  ~','Missing statement body in do loop.',
  '    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordExce','ption',
  '    + FullyQualifiedErrorId : MissingLoopStatement','',NIVO_PS].join('\n');
// The frame before the wake, the two ways it could have looked: PowerShell's prompt over the footer row,
// bare or followed by what was left of the footer it did not clear.
const NIVO_EXITED_BARE=[...NIVO_TRANSCRIPT,NIVO_PS].join('\n');
const NIVO_EXITED_RESIDUE=[...NIVO_TRANSCRIPT,`${NIVO_PS} % left · ~\\nivo-backend`].join('\n');
// A frozen Codex still drawing its footer: nothing on screen says the process is gone.
const NIVO_FROZEN=[...NIVO_TRANSCRIPT,'  gpt-6-sol high · 58% left · ~\\nivo-backend'].join('\n');
// The shell mid-echo: the wake typed after the prompt, not yet run.
const NIVO_TYPING=[...NIVO_TRANSCRIPT,...wrap80(`${NIVO_PS} ${NIVO_WAKE}`)].join('\n');

test('nivo 03:56: a Codex frame frozen at Working with a shell prompt under its input row is agent-exited',()=>{
  assert.equal(exitedAgentPromptRow(NIVO_EXITED_BARE),NIVO_PS);
  assert.equal(exitedAgentPromptRow(NIVO_EXITED_RESIDUE),`${NIVO_PS} % left · ~\\nivo-backend`,'a prompt over an uncleared footer row');
  assert.equal(exitedAgentPromptRow(NIVO_AFTER),NIVO_PS);
  assert.equal(exitedAgentPromptRow(NIVO_TYPING),null,'mid-echo the last row is the wrapped wake, not a prompt');
  assert.equal(exitedAgentPromptRow(NIVO_FROZEN),null,'a frozen frame that still draws its footer proves nothing');
  // A launch typed under an old agent frame is not an exit, and a live agent never ends in a prompt row.
  assert.equal(exitedAgentPromptRow([...NIVO_TRANSCRIPT,`${NIVO_PS} codex --model gpt-6-sol -c model_reasoning_effort=high`].join('\n')),null);
  // So is one whose line sets the launch env first (agents/claude.yaml launchEnv).
  assert.equal(exitedAgentPromptRow([...NIVO_TRANSCRIPT,`${NIVO_PS} $env:DISABLE_AUTOUPDATER='1'; & claude --model 'claude-opus-5-5' --dangerously-skip-permissions`].join('\n')),null);
  assert.equal(exitedAgentPromptRow([...NIVO_TRANSCRIPT,`${NIVO_PS} $env:DISABLE_AUTOUPDATER='1'; Get-ChildItem`].join('\n')),`${NIVO_PS} $env:DISABLE_AUTOUPDATER='1'; Get-ChildItem`,'an env statement alone is no launch');
  for(const frame of [LIVE_QWEN,IDLE_CLAUDE,IDLE_CODEX,NIVO_FROZEN]) assert.equal(exitedAgentPromptRow(frame),null);
  assert.equal(shellPromptPrefix('PS D:\\Repositories\\nivo-backend> Operation liveness'),NIVO_PS);
  assert.equal(shellPromptPrefix('  └ PS D:\\x> git status'),null,'a transcript row is not the shell');
});

test('nivo 03:56: text a shell received is never a delivered wake',()=>{
  assert.deepEqual(shellReceivedText(NIVO_AFTER,NIVO_WAKE,NIVO_FROZEN)?.evidence,'shell-echo');
  assert.deepEqual(shellReceivedText(NIVO_TYPING,NIVO_WAKE,NIVO_FROZEN)?.evidence,'shell-echo','wrapped at 80 columns mid-word');
  assert.equal(shellReceivedText([NIVO_FROZEN,'Missing statement body in do loop.','    + FullyQualifiedErrorId : MissingLoopStatement'].join('\n'),'x',NIVO_FROZEN)?.evidence,'shell-error');
  // An agent that echoes the wake in its own input row or transcript is the delivery, not a shell.
  const landed=[...NIVO_TRANSCRIPT,`› ${NIVO_WAKE.slice(0,76)}`,'• Working (1s • esc to interrupt)','› Ask Codex to do anything'].join('\n');
  assert.equal(shellReceivedText(landed,NIVO_WAKE,NIVO_FROZEN),null);
  // Mid-turn exit: the frame before the send looked alive, the frames after show PowerShell echoing it.
  let s=stub([NIVO_FROZEN,NIVO_TYPING,NIVO_AFTER]);
  const woke=sendWakeWithProof({terminal:'t',text:NIVO_WAKE,deps:s.deps});
  assert.deepEqual([woke.ok,woke.delivery,woke.evidence,woke.splitRetried],[false,'agent-exited','shell-echo',false]);
  assert.equal(s.calls.length,1,'no retry, no Enter into the shell');
  // The frame read immediately before typing decides, not the caller's older observation.
  s=stub([NIVO_EXITED_RESIDUE]);
  const refused=sendWakeWithProof({terminal:'t',text:NIVO_WAKE,before:NIVO_FROZEN,deps:s.deps});
  assert.deepEqual([refused.ok,refused.delivery,refused.evidence],[false,'agent-exited','shell-prompt']);
  assert.equal(s.calls.length,0,'nothing typed');
  // No frame at all: nothing is typed blind.
  const blind={calls:[],deps:{send:(i)=>{blind.calls.push(i);return {ok:true};},read:()=>({ok:false,error:'terminal_gone'}),sleep:()=>{}}};
  assert.deepEqual([sendWakeWithProof({terminal:'t',text:NIVO_WAKE,deps:blind.deps}).delivery,blind.calls.length],['unreadable',0]);
});

test('nudge: an agent that dies under a stale-active frame gets no delivered claim and the shell is recorded',t=>{
  const fx=opFixture(t);
  const d=fx.run(['dispatch','--repo',fx.repo,'--job',fx.jobId,'--model','codex-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  // Frozen for 20 minutes (stale-active turn-idle), and the host shell reads whatever is typed next.
  fx.writeState(s=>{Object.assign(s.terminals['fake-terminal-1'],{screen:NIVO_FROZEN,lastOutputAt:Date.now()-20*60_000,shellAfterSend:NIVO_PS});});
  const before=fx.sends().length;
  const nudged=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.notEqual(nudged.status,0);
  const out=json(nudged.stdout);
  assert.deepEqual([out.reason,out.delivery,out.evidence,out.typed],['agent-exited','agent-exited','shell-echo',true],nudged.stdout);
  assert.equal(fx.sends().length,before+1,'one send, never retried into the shell');
  assert.equal(fx.events('op-worker-nudged').length,0,'no nudge is recorded as delivered');
  assert.equal(fx.events('op-worker-wake-to-shell').length,1);
  // The shell is left behind: status reads the worker dead, and a second nudge types nothing.
  const status=json(fx.run(['status','--repo',fx.repo,'--workflow',fx.workflowId,'--json']).stdout);
  assert.equal(status.workers.find(w=>w.jobId===fx.jobId).liveness,'agent-exited');
  const again=json(fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']).stdout);
  assert.equal(again.reason,'agent-exited');
  assert.equal(fx.sends().length,before+1);
});

test('nudge: the residue frame (prompt over the footer) is refused before anything is typed',t=>{
  const fx=opFixture(t);
  const d=fx.run(['dispatch','--repo',fx.repo,'--job',fx.jobId,'--model','codex-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  fx.writeState(s=>{Object.assign(s.terminals['fake-terminal-1'],{screen:NIVO_EXITED_RESIDUE,lastOutputAt:Date.now()-20*60_000});});
  const before=fx.sends().length;
  const nudged=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.notEqual(nudged.status,0);
  assert.deepEqual([json(nudged.stdout).reason,json(nudged.stdout).worker.liveness],['agent-exited','agent-exited']);
  assert.equal(fx.sends().length,before,'nothing typed');
});
