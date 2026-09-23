import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {buildSpawnCommand} from '../scripts/agent/lib.mjs';
import {stagedInputRow,gateRemedy} from '../scripts/kernel/terminal-liveness.mjs';

// Orca's CLI routes a `terminal create --command` whose first word is `codex` or `claude` down its
// renderer-backed tab path: it waits at most 10s for the UI to publish a handle, answers
// "Timed out waiting for terminal handle after creation", and the tab still spawns later, untracked
// (starci-next op-workspace.manage-55001e2623, 2026-09-23). The cards now keep those launches on the
// runtime-owned PTY path, and a create whose effect is unknown is reconciled — the terminal it made is
// adopted or closed and the receipt is written into the dispatch/kernel events. A dispatch paste stuck
// in the input row gets one Enter, then the dispatch is refused and its terminal closed.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

/* ------------------------------------------------------------------ units */

// The same first-word test Orca's CLI applies (shouldUseRendererBackedInteractiveTerminal): env
// assignments and `env …` are skipped, then the executable basename decides.
const orcaRendererBacked=command=>{
  const tokens=String(command).trim().split(/\s+/);
  while(tokens[0]&&/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]))tokens.shift();
  const exe=(tokens[0]??'').replace(/\\/g,'/').split('/').pop().toLowerCase();
  return /^(?:codex|claude)(?:\.exe|\.cmd)?$/.test(exe);
};

test('Codex and Claude launch commands stay off Orca\'s renderer-backed create path',()=>{
  for(const [provider,model,kernel] of [['codex','gpt-6-sol',false],['codex','gpt-6-sol',true],['claude','claude-opus-5-5',true]]){
    const built=buildSpawnCommand({provider,model,kernel});
    assert.ok(!built.error,built.error);
    assert.equal(orcaRendererBacked(built.command),false,`${provider}: '${built.command}' would take the 10s renderer handle wait`);
    assert.match(built.command,new RegExp(`(?:^|\\s)${provider}(?:\\s|$)`),'the same binary still runs');
  }
  const explicit=buildSpawnCommand({provider:'codex',command:'codex --model gpt-6-sol'});
  assert.equal(orcaRendererBacked(explicit.command),false,'an explicit profile command is prefixed too');
  assert.equal(orcaRendererBacked('codex --model gpt-6-sol'),true,'the probe does recognise the bare form');
});

test('a paste is stuck only while it sits in the last input row',()=>{
  assert.equal(stagedInputRow('Codex\n\n› [Pasted Content 5012 chars]\n  gpt-6-sol high · repo'),'› [Pasted Content 5012 chars]');
  assert.equal(stagedInputRow('› [Pasted Content 5012 chars]\n• Working (2s • esc to interrupt)\n›  Ask Codex to do anything'),null,
    'an earlier row quoting the paste is transcript, not the input box');
  assert.equal(stagedInputRow('│ > [Pasted text #1 +40 lines] │'),'> [Pasted text #1 +40 lines] │','a boxed input row counts');
  assert.equal(stagedInputRow('Codex\n› Ask Codex to do anything'),null);
});

test('every first-run gate names the exact action that clears it',()=>{
  assert.match(gateRemedy('claude-first-run-onboarding'),/run `claude`.*hasCompletedOnboarding/);
  assert.match(gateRemedy('codex-directory-trust',{cwd:'D:/Repositories/starci-next'}),/D:\/Repositories\/starci-next.*run `codex`.*Yes, continue/);
  assert.equal(gateRemedy('no-such-gate'),null);
});

/* ------------------------------------------------------------ op dispatch */

const opFixture=(t,extra={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-create-recovery-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),...extra};
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const orcaState=()=>json(fs.readFileSync(path.join(root,'state.json'),'utf8'))??{};
  const workflowId='wf-create-recovery',jobId='job-create-recovery';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const dispatch=()=>run('dispatch','--repo',repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
  const events=kind=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  const job=()=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT status,worker_id FROM jobs WHERE job_id=?').get(jobId);}finally{l.close();}
  };
  const live=()=>Object.values(orcaState().terminals??{}).filter(term=>!term.closed).map(term=>term.handle);
  return {repo,dispatch,events,job,live,orcaState};
};

test('create-timeout-then-adopt: the op adopts the terminal the timed-out create made',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_CREATE_TIMEOUT:'live'});
  const r=fx.dispatch();
  assert.equal(r.status,0,`dispatch failed: ${r.stderr||r.stdout}`);
  assert.deepEqual([fx.job()?.status,fx.job()?.worker_id],['running','fake-terminal-1']);
  const [dispatched]=fx.events('op-dispatched');
  assert.equal(dispatched?.createRecovery?.action,'adopted');
  assert.equal(dispatched.createRecovery.adopted,'fake-terminal-1');
  assert.match(dispatched.createRecovery.cause,/Timed out waiting for terminal handle after creation/);
  assert.equal(dispatched.terminal,'fake-terminal-1');
  assert.deepEqual(fx.live(),['fake-terminal-1'],'exactly the adopted terminal is live and tracked');
  assert.equal(fx.orcaState().counter,1,'no second create');
});

test('create-timeout-then-close: a dead terminal the create made is closed and the refusal records it',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_CREATE_TIMEOUT:'dead'});
  const r=fx.dispatch();
  assert.notEqual(r.status,0);
  const [rejected]=fx.events('dispatch-rejected');
  assert.equal(rejected?.step,'create');
  assert.equal(rejected.createRecovery?.action,'closed');
  assert.deepEqual(rejected.createRecovery.closed,[{handle:'fake-terminal-1',ok:true}]);
  assert.equal(rejected.effectState,'none');
  assert.equal(fx.job()?.status,'queued','the attempt is not consumed');
  assert.deepEqual(fx.live(),[],'no untracked terminal is left behind');
});

test('an adopted terminal at an interactive gate is refused with the gate, its remedy, and closed',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_CREATE_TIMEOUT:'live',STARCI_FAKE_ORCA_GATE:'codex'});
  const r=fx.dispatch();
  assert.notEqual(r.status,0);
  const [rejected]=fx.events('dispatch-rejected');
  assert.equal(rejected?.step,'readiness');
  assert.match(rejected.error,/interactive gate 'codex-directory-trust'.*run `codex`.*Yes, continue/);
  assert.equal(rejected.createRecovery?.action,'adopted');
  assert.equal(rejected.terminalClosed,true);
  assert.equal(json(r.stdout)?.spawn?.gate,'codex-directory-trust');
  assert.deepEqual(fx.live(),[]);
});

test('stuck-paste-then-enter: one Enter submits a paste left in the input row',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_STUCK_PASTE:'enter'});
  const r=fx.dispatch();
  assert.equal(r.status,0,`dispatch failed: ${r.stderr||r.stdout}`);
  assert.equal(fx.job()?.status,'running');
  const term=fx.orcaState().terminals['fake-terminal-1'];
  assert.equal(term.enters,1,'exactly one extra Enter');
  assert.equal(term.prompt,'fake dispatch preamble','the preamble is what was pasted');
  assert.deepEqual(fx.live(),['fake-terminal-1']);
});

test('stuck-paste-then-reject: a paste that survives the Enter is refused and its terminal closed',t=>{
  const fx=opFixture(t,{STARCI_FAKE_ORCA_STUCK_PASTE:'never'});
  const r=fx.dispatch();
  assert.notEqual(r.status,0);
  const [rejected]=fx.events('dispatch-rejected');
  assert.equal(rejected?.step,'submission');
  assert.equal(rejected.signal,'prompt-stuck');
  assert.match(rejected.error,/Pasted Content/);
  assert.equal(rejected.terminalClosed,true);
  assert.equal(fx.orcaState().terminals['fake-terminal-1'].enters,1,'Enter is sent once, never hammered');
  assert.deepEqual(fx.live(),[]);
  assert.equal(fx.job()?.status,'queued');
});

/* ------------------------------------------------------------ kernel boot */

const kernelFixture=(t,kernelLine,extra={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kernel-recovery-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),`language: vi\neffort: medium\n${kernelLine}\n`);
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',
    STARCI_OWNER_ROOT:ownerRoot,...extra};
  const run=(script,args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const defined=run(DEFINE_GOAL,['--repo',repo,'--text','boot the kernel','--json']);
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;
  const boot=()=>{const r=run(START_WORKFLOW,['--repo',repo,'--goal',workflowId,'--json']);return {r,body:json(r.stdout)};};
  const events=()=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind LIKE 'kernel-%' ORDER BY seq").all(workflowId)
      .map(row=>({kind:row.kind,payload:json(row.payload_json)}));}finally{l.close();}
  };
  const orcaState=()=>json(fs.readFileSync(state,'utf8'));
  return {boot,events,orcaState};
};

test('kernel boot adopts the terminal a timed-out create made',t=>{
  const f=kernelFixture(t,'kernel: {agent: codex, model: gpt-6-sol, effort: high}',{STARCI_FAKE_ORCA_CREATE_TIMEOUT:'live'});
  const {r,body}=f.boot();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.terminal,'fake-terminal-1');
  const [booted]=f.events();
  assert.equal(booted.kind,'kernel-booted');
  assert.equal(booted.payload.createRecovery?.action,'adopted');
  assert.equal(booted.payload.terminal,'fake-terminal-1');
});

test('kernel boot at the Claude first-run onboarding is refused with the gate and what to run, and closed',t=>{
  const f=kernelFixture(t,'kernel: {agent: claude, model: claude-opus-5-5, effort: high}',
    {STARCI_FAKE_ORCA_CREATE_TIMEOUT:'live',STARCI_FAKE_ORCA_GATE:'claude'});
  const {r}=f.boot();
  assert.equal(r.status,1);
  const [failed]=f.events();
  assert.equal(failed.kind,'kernel-start-failed');
  assert.deepEqual([failed.payload.step,failed.payload.gate],['readiness','claude-first-run-onboarding']);
  assert.match(failed.payload.error,/run `claude`.*hasCompletedOnboarding/);
  assert.match(failed.payload.remedy,/run `claude`/);
  assert.equal(failed.payload.createRecovery?.action,'adopted');
  assert.equal(failed.payload.terminalClosed?.ok,true);
  const live=Object.values(f.orcaState().terminals).filter(term=>!term.closed);
  assert.deepEqual(live,[],'the adopted gated terminal is closed, nothing untracked remains');
});

/* ------------------------------------------------------------- close proof */

// Orca stops a runtime-owned background terminal but answers its close with
// `runtime_error: tab_not_found` (observed against Orca 2026-09-23). The close
// counts only when terminal show proves that exact terminal disconnected.
const CLOSE_STUB=String.raw`const argv=process.argv.slice(2);const verb=argv.slice(0,2).join(' ');
const out=o=>console.log(JSON.stringify(o));
if(verb==='terminal close'){out({ok:false,error:{code:'runtime_error',message:'tab_not_found'}});process.exit(1);}
if(verb==='terminal show'){out({ok:true,result:{terminal:{handle:argv[argv.indexOf('--terminal')+1],connected:process.env.STUB_CONNECTED==='1',writable:false}}});process.exit(0);}
out({ok:false,error:'unhandled'});process.exit(1);`;

test('a tab_not_found close counts only when terminal show proves the terminal disconnected',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-close-proof-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const stub=path.join(dir,'orca.mjs');fs.writeFileSync(stub,CLOSE_STUB);
  const close=connected=>{
    const r=spawnSync(process.execPath,[path.join(ROOT,'scripts','api','orca','terminal-close.mjs'),'--terminal','term-x'],{encoding:'utf8',windowsHide:true,timeout:30000,
      env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_ORCA_SKIP_LIVE_CHECK:'1',STUB_CONNECTED:connected}});
    return json(r.stdout);
  };
  assert.deepEqual([close('0')?.ok,close('0')?.verifiedBy],[true,'terminal-show']);
  assert.equal(close('1')?.ok,false,'a terminal still connected is not closed');
});

test('Claude workspace-trust and bypass-consent screens are named gates, not tool approvals',async()=>{
  const {classifyAgentScreen}=await import('../scripts/kernel/terminal-liveness.mjs');
  const trust="Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source\nproject, or work from your team).\nClaude Code'll be able to read, edit, and execute files here.\nSecurity guide\n❯ 1. Yes, I trust this folder\n  2. No, exit\nEnter to confirm · Esc to cancel";
  assert.equal(classifyAgentScreen(trust).gate,'claude-workspace-trust');
  assert.equal(classifyAgentScreen('WARNING: Claude Code running in Bypass Permissions mode\n❯ 1. No, exit\n  2. Yes, I accept').gate,'claude-bypass-permissions-consent');
  assert.notEqual(classifyAgentScreen('> \n  ⏵⏵ bypass permissions on (shift+tab to cycle)').state,'interactive-gate','the running-mode footer is not a gate');
});
