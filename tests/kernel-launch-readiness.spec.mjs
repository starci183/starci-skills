import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {DEFAULT_READY_PATTERN,awaitReadiness,lastOutputOf,loadAdapter} from '../scripts/agent/lib.mjs';
import {inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// wf-nivo-fe-debt-mug06w7h, 2026-09-24: three `start-workflow` runs each failed
// "terminal readiness timeout after 120000ms" and left an exited terminal with an
// empty screen. Reproduced against Orca: Claude Code sat ready from its 6th second,
// but its empty input box carried a placeholder hint (❯ Try "write a test for
// <filepath>") the bare-glyph readiness pattern never matched; the runtime's own
// timeout path then closed the terminal (exitCause operator_close), taking the
// only evidence with it. The launch now reads the hint as a prompt, waits for a
// loaded host, fails early only on a real exit, keeps the last output, retries a
// transient failure once, and never closes a terminal that is still starting.

// The frame read from term_e8c4efcf (nivo-backend, claude 2.1.280) at 6s.
const CLAUDE_HINT_FRAME=[
  ' ▐▛███▜▌   Claude Code v2.1.280',
  '▝▜█████▛▘  Opus 5.5 with high effort · Claude Max',
  '  ▘▘ ▝▝    D:\\Repositories\\nivo-backend',
  '',
  '────────────────────────────────────────',
  '❯\u00a0Try "write a test for <filepath>"', // Claude writes U+00A0 after the glyph, not a space
  '────────────────────────────────────────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents',
].join('\n');

test('a Claude input box showing its placeholder hint is a ready prompt; a menu cursor is still not',()=>{
  const re=new RegExp(DEFAULT_READY_PATTERN,'i');
  assert.equal(re.test(CLAUDE_HINT_FRAME),true);
  assert.equal(re.test('❯ Try "how does <filepath> work?"\n───'),true,'a plain space too');
  // The second nivo launch after the first fix still timed out: the byte after the glyph is U+00A0.
  assert.equal(re.test('───\n❯ Try "how does <filepath> work?"\n───'),true);
  assert.equal(re.test('───\n❯ \n───'),true,'a bare glyph followed by U+00A0');
  assert.equal(re.test('❯ 1. Dark mode'),false);
  assert.equal(re.test('❯ 1. Dark mode ✔\n  2. Light mode'),false,'a numbered menu option is not a prompt');
  assert.equal(re.test('❯ Yes, I trust this folder'),false,'a launch-gate option is not a prompt');
  assert.equal(re.test('Loading project…'),false);
});

// ---- fake Orca at the io seam: a clock, a frame script and a CPU meter ----------
const claude=loadAdapter('claude').card;
const fakeIo=({frame,busy=0,readMs=300,status=()=>null})=>{
  let clock=0;const cpu={idle:0,total:0};
  const io={
    now:()=>clock,
    sleep:ms=>{clock+=ms;cpu.total+=ms;cpu.idle+=ms*(1-busy);},
    read:()=>{clock+=readMs;const s=status(clock);return {ok:true,screen:frame(clock),terminal:{connected:s!=='exited',...(s?{status:s}:{})}};},
    cpu:()=>({...cpu}),
  };
  return io;
};

test('the hint frame is ready on the first read',()=>{
  const r=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame:()=>CLAUDE_HINT_FRAME})});
  assert.equal(r.ok,true,r.reason);
  assert.ok(r.waitedMs<1000);
});

test('a terminal still printing past the base window keeps its launch until it turns ready',()=>{
  // Ready at 200s; its frame changes every 5s until then (a loaded host drawing slowly).
  const frame=ms=>ms<200000?`Loading Claude Code… ${Math.floor(ms/5000)}`:CLAUDE_HINT_FRAME;
  const beats=[];
  const adaptive=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame}),onWait:b=>beats.push(b)});
  assert.equal(adaptive.ok,true,adaptive.reason);
  assert.ok(adaptive.waitedMs>=200000);
  assert.ok(beats.length>100&&beats.every(b=>b.step==='readiness'),'every poll is a heartbeat for the reservation');
  const fixed=awaitReadiness('t1',claude,{io:fakeIo({frame})});
  assert.equal(fixed.ok,false,'without adaptive the base window still bounds a non-kernel launch');
  assert.equal(fixed.failureKind,'readiness-stalled');
});

test('a quiet, never-ready terminal fails at the base window on an idle host and at twice it under full load',()=>{
  const frame=()=>'Welcome\nsomething unexpected';
  const idle=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame,busy:0.2})});
  assert.equal(idle.ok,false);
  assert.equal(idle.failureKind,'readiness-stalled');
  assert.equal(idle.transient,true);
  assert.ok(idle.waitedMs>=120000&&idle.waitedMs<125000,String(idle.waitedMs));
  assert.match(idle.reason,/^terminal readiness timeout after \d+ms/);
  assert.match(idle.lastOutput,/something unexpected/,'the last output names the cause');
  const loaded=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame,busy:1})});
  assert.equal(loaded.failureKind,'readiness-stalled');
  assert.ok(loaded.waitedMs>=240000&&loaded.waitedMs<245000,String(loaded.waitedMs));
  assert.equal(loaded.loadFactor,2);
  const slowReads=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame,readMs:3000})});
  assert.ok(slowReads.loadFactor>1.9,'slow Orca reads stretch the window too');
});

test('still printing at the hard cap: not transient, and flagged stillStarting so it is not closed',()=>{
  const r=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame:ms=>`spinner ${Math.floor(ms/2000)}`})});
  assert.equal(r.ok,false);
  assert.equal(r.failureKind,'readiness-still-starting');
  assert.equal(r.stillStarting,true);
  assert.equal(r.transient,false);
  assert.ok(r.waitedMs>=360000&&r.waitedMs<366000,String(r.waitedMs));
});

test('a real exit fails at once: Orca says exited, or the frame falls back to a bare shell prompt',()=>{
  const gone=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame:()=>'',status:ms=>ms>3000?'exited':null})});
  assert.equal(gone.failureKind,'agent-exited');
  assert.equal(gone.transient,true);
  assert.ok(gone.waitedMs<6000);
  const crashed=[
    'PS D:\\Repositories\\nivo-backend> & claude --model \'claude-opus-5-5\' --dangerously-skip-permissions',
    'Error: settings.json: Unexpected token } in JSON at position 812',
    'PS D:\\Repositories\\nivo-backend> ',
  ].join('\n');
  const shell=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame:ms=>ms<4000?'':crashed})});
  assert.equal(shell.failureKind,'agent-exited');
  assert.match(shell.reason,/bare shell prompt/);
  assert.match(shell.lastOutput,/Unexpected token/);
  assert.ok(shell.waitedMs<10000);
  // A shell prompt before the launch line was typed is not an exit.
  const early=awaitReadiness('t1',claude,{adaptive:true,io:fakeIo({frame:ms=>ms<5000?'PS D:\\Repositories\\nivo-backend> ':CLAUDE_HINT_FRAME})});
  assert.equal(early.ok,true,early.reason);
});

test('spawnAgent never closes a kernel terminal readiness gave up on while it was still printing',t=>{
  // A child process so the fake Orca binary is the one scripts/api/orca/lib.mjs resolves at import.
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-still-starting-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json');
  fs.writeFileSync(fake,FAKE_ORCA);
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  const lib=JSON.stringify(new URL('../scripts/agent/lib.mjs',import.meta.url).href);
  const script=`
    const { spawnAgent } = await import(${lib});
    let clock = 0;
    const io = { now: () => clock, sleep: (ms) => { clock += ms; }, cpu: () => null,
      read: () => { clock += 300; return { ok: true, screen: 'Loading ' + Math.floor(clock / 2000), terminal: { connected: true } }; } };
    const run = (keep) => spawnAgent({ provider: 'claude', model: 'claude-opus-5-5', worktree: ${JSON.stringify(root)}, title: '[Kernel] wf-t',
      prompt: 'go', kernel: true, dispatchId: 'kernel-wf-t', readiness: { adaptive: true, io }, keepStartingTerminal: keep });
    const kept = run(true); clock = 0;
    const closed = run(false);
    console.log(JSON.stringify({ kept, closed }));`;
  const r=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',windowsHide:true,timeout:60000,
    env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),STARCI_FAKE_ORCA_STATE:state,
      STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_AGENT_TRUST_HOME:root}});
  assert.equal(r.status,0,r.stderr);
  const {kept,closed}=lastJsonLine(r.stdout);
  assert.equal(kept.ok,false);
  assert.equal(kept.failureKind,'readiness-still-starting');
  assert.equal(kept.terminalClosed,undefined,'the still-starting terminal is not closed');
  assert.deepEqual(kept.terminalLeftOpen?.handle,kept.terminal);
  assert.match(kept.lastOutput,/^Loading \d+$/);
  assert.equal(closed.terminalClosed?.ok,true,'without keepStartingTerminal the old close-on-failure holds');
  const s=json(fs.readFileSync(state,'utf8'));
  assert.deepEqual(s.closed??[],[closed.terminal]);
});

test('lastOutputOf keeps the tail rows of a frame, capped',()=>{
  const frame=Array.from({length:50},(_,i)=>`row ${i}`).join('\n');
  const tail=lastOutputOf(frame,{rows:5});
  assert.equal(tail,'row 45\nrow 46\nrow 47\nrow 48\nrow 49');
  assert.equal(lastOutputOf('x'.repeat(5000)).length,3000);
});

// ---- start-workflow end to end against the fake Orca binary ----------------------
const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastJsonLine=text=>String(text??'').trim().split(/\r?\n/).reverse().map(json).find(Boolean)??null;
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kernel-launch-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json'),log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  const trustHome=path.join(root,'trust');fs.mkdirSync(trustHome);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),'language: en\neffort: medium\nkernel: {agent: claude, model: claude-opus-5-5, effort: high}\n');
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot,
    STARCI_AGENT_TRUST_HOME:trustHome,STARCI_FAKE_ORCA_BOOT_SCREEN:'claude-hint'};
  const run=(script,args,extra={})=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:240000,env:{...env,...extra}});
  const defined=run(DEFINE_GOAL,['--repo',repo,'--text','boot the kernel through a loaded host','--json']);
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const boot=(extra={})=>{const r=run(START_WORKFLOW,['--repo',repo,'--goal',workflowId,'--json'],extra);return {r,body:json(r.stdout),err:lastJsonLine(r.stderr)};};
  const readState=()=>json(fs.readFileSync(state,'utf8'));
  const events=()=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind LIKE 'kernel-%' ORDER BY seq").all(workflowId).map(e=>({kind:e.kind,payload:json(e.payload_json)}));}finally{l.close();}};
  const signals=()=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare("SELECT token,value_json,expires_at FROM signals WHERE scope='kernel' AND key=?").all(workflowId);}finally{l.close();}};
  return {repo,workflowId,boot,readState,events,signals};
};

test('start-workflow boots a Claude kernel whose prompt shows the placeholder hint: attested, submitted, one terminal',t=>{
  const f=fixture(t);
  const {r,body}=f.boot();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.deepEqual([body.agent,body.model,body.modelAttested,body.promptSubmitted],['claude','claude-opus-5-5',true,true]);
  assert.equal(body.retriedAfter,undefined);
  assert.equal(typeof body.readiness?.waitedMs,'number');
  const state=f.readState();
  assert.equal(state.counter,1);
  assert.equal(state.terminals[body.terminal].sent,true,'the kernel prompt was sent');
  assert.deepEqual(f.events().map(e=>e.kind),['kernel-booted']);
});

test('a kernel that exits before its prompt is retried once with a fresh terminal; the first cause is kept',t=>{
  const f=fixture(t);
  const {r,body}=f.boot({STARCI_FAKE_ORCA_BOOT_EXIT:'1'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.terminal,'fake-terminal-2');
  assert.equal(body.retriedAfter.length,1);
  const [first]=body.retriedAfter;
  assert.deepEqual([first.terminal,first.step,first.failureKind,first.transient],['fake-terminal-1','readiness','agent-exited',true]);
  assert.match(first.lastOutput,/fake startup crash/);
  assert.equal(first.terminalClosed?.ok,true);
  const events=f.events();
  assert.deepEqual(events.map(e=>e.kind),['kernel-start-retry','kernel-booted']);
  assert.match(events[0].payload.lastOutput,/fake startup crash/);
  const state=f.readState();
  assert.deepEqual(state.closed,['fake-terminal-1']);
  assert.deepEqual(Object.values(state.terminals).filter(x=>!x.closed).map(x=>x.handle),['fake-terminal-2'],'exactly one live kernel terminal');
});

test('two transient failures end the boot with a typed error, both causes and no live terminal',t=>{
  const f=fixture(t);
  const {r,err}=f.boot({STARCI_FAKE_ORCA_BOOT_EXIT:'2'});
  assert.equal(r.status,1);
  assert.equal(err.ok,false);
  assert.equal(err.step,'readiness');
  assert.equal(err.errorCode,'kernel-launch-transient-retry-exhausted');
  assert.equal(err.failureKind,'agent-exited');
  assert.match(err.lastOutput,/fake startup crash/);
  assert.deepEqual(err.attempts.map(a=>a.terminal),['fake-terminal-1','fake-terminal-2']);
  assert.equal(f.readState().counter,2,'one retry, not a loop');
  const events=f.events();
  assert.deepEqual(events.map(e=>e.kind),['kernel-start-retry','kernel-start-failed']);
  assert.match(events[1].payload.lastOutput,/fake startup crash/);
  assert.equal(Object.values(f.readState().terminals).filter(x=>!x.closed).length,0);
  assert.equal(f.signals().length,0,'the startup reservation is released');
});
