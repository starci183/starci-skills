import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {classifyAgentScreen,exitedAgentPromptRow} from '../scripts/kernel/terminal-liveness.mjs';
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
