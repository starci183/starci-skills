import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,openLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-start-restart-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json');
  const log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),'language: vi\neffort: medium\nkernel: {agent: codex, model: gpt-6-sol, effort: high}\n');
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot};
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...(f.closeFails?{STARCI_FAKE_ORCA_CLOSE_FAILS:f.closeFails}:{})}});
  const f={};
  const callArgv=()=>fs.existsSync(log)
    ?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const calls=()=>callArgv().map(argv=>argv.slice(0,2).join(' '));
  return Object.assign(f,{repo,state,run,calls,callArgv,env});
};

const readState=f=>json(fs.readFileSync(f.state,'utf8'));
const killTerminal=(f,handle)=>{
  const state=readState(f);
  state.terminals[handle].connected=false;state.terminals[handle].writable=false;
  fs.writeFileSync(f.state,JSON.stringify(state));
};
const enqueueOp=(f,workflowId,jobId,ownedPath)=>{
  const ledger=openLedger({file:ledgerFileFor(f.repo)});
  try{
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',
      payload:{opId:'code.refactor',owned_paths:[ownedPath],model:'claude-agent'}});
  }finally{ledger.close();}
};
const payloadOf=(repo,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return json(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json);}
  finally{ledger.close();}
};

test('a disconnected kernel restarts from the durable ledger with absolute host context',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','refactor the stale architecture','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstOut=json(first.stdout);assert.equal(firstOut?.replaced,false);assert.equal(firstOut?.attempt,1);
  assert.equal(firstOut?.generation,0);assert.equal(firstOut?.promptSubmitted,true);
  let state=json(fs.readFileSync(f.state,'utf8'));
  assert.match(state.commands[0],/\bcodex\b/i);
  assert.match(state.commands[0],/(?:^|\s)--model\s+['"]?gpt-6-sol['"]?(?:\s|$)/i);
  assert.match(state.commands[0],/--ask-for-approval\s+never/);
  assert.match(state.commands[0],/--sandbox\s+danger-full-access/);
  assert.match(state.terminals[firstOut.terminal].prompt,new RegExp(ROOT.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(state.terminals[firstOut.terminal].prompt,/The routed target has no `\.claude`: never look for or create one there/);

  const duplicate=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(duplicate.status,0,duplicate.stderr);
  assert.equal(json(duplicate.stdout)?.terminal,firstOut.terminal);
  state=json(fs.readFileSync(f.state,'utf8'));assert.equal(state.counter,1,'a connected kernel must not duplicate');

  killTerminal(f,firstOut.terminal);
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--launched-by','watchdog','--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const restartOut=json(restarted.stdout);assert.equal(restartOut?.replaced,true);assert.equal(restartOut?.attempt,2);
  assert.equal(restartOut?.generation,0,'agent churn must not invalidate the workflow generation');
  assert.notEqual(restartOut?.terminal,firstOut.terminal);

  // The first boot says the plan gate was the go, unchanged.
  const authorityOf=prompt=>prompt.slice(prompt.indexOf('LAUNCH AUTHORITY'),prompt.indexOf('\n\nRESOLVED HOST CONTEXT'));
  const firstPrompt=state.terminals[firstOut.terminal].prompt;
  assert.equal(authorityOf(firstPrompt),[
    `LAUNCH AUTHORITY — the owner approved ${workflowId} (goal revision ${firstOut.launchAuthority.goalRevision} (${firstOut.launchAuthority.goalIdentity})) through the start-kernel plan gate`,
    '  before this terminal launched. This prompt is that go: begin the LOOP now and never ask for a',
    '  confirmation to start or to continue.',
    "  Watchdog wakes are the runtime's authorized cadence, not owner messages: act on each one; a",
    '  launch gate or a confirmation request is never yours to raise (owner rule: the owner never',
    '  approves launch gates). Owner decisions reach you only as asks you file through the api.'].join('\n'));
  assert.deepEqual(firstOut.launchAuthority?.kind,'first-boot');
  // Replacement Claude kernels read the pasted prompt as unverified text and asked a person to
  // reply yes (starci-next sn-foundation and sn-subscription attempt 2, 2026-09-25). The prompt
  // states the rule first, the approval, the launcher and why, and the ledger read that proves them.
  const authority=authorityOf(readState(f).terminals[restartOut.terminal].prompt).split('\n');
  assert.equal(authority[0],`LAUNCH AUTHORITY: resume ${workflowId} now as its Kernel attempt 2; ask no one to confirm.`);
  assert.match(authority[1],new RegExp(`^  Approval: the owner approved ${workflowId} goal revision \\d+ \\([0-9a-f]+\\); its first Kernel booted on that approval at \\d{4}-`));
  assert.equal(authority[2],`  Launcher: the watchdog's kernel repair started this terminal because Kernel attempt 1 (terminal ${firstOut.terminal}) failed its liveness check (terminal disconnected).`);
  assert.match(authority.join(' '),new RegExp(`api status --workflow ${workflowId} shows kernel\\.attempt 2,\\s+kernel\\.launchedBy watchdog and kernel\\.you true`));
  assert.match(authority.join(' '),/No person watches this terminal/);
  assert.ok(authority.length<=7,'a few short lines');
  // No line asks anyone for a go.
  for(const line of authority.filter(l=>/reply|confirm|Run it|read-only first|\byes\b/i.test(l)))
    assert.match(line,/ask no one to confirm/,`a confirmation request reached the prompt: ${line}`);
  assert.equal(restartOut.launchAuthority?.kind,'replacement');
  assert.equal(restartOut.launchAuthority?.launchedBy,'watchdog');
  assert.equal(restartOut.launchAuthority?.previousTerminal,firstOut.terminal);
  assert.equal(restartOut.launchAuthority?.previousAttempt,1);
  assert.equal(restartOut.launchAuthority?.confirmationRequested,false);
  assert.ok(restartOut.launchAuthority?.approvedAt,'the approval the replacement resumes under is cited');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const workflow=ledger.db.prepare('SELECT generation,phase FROM workflows WHERE workflow_id=?').get(workflowId);
    const job=ledger.db.prepare('SELECT attempt,generation,status,worker_id FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
    const inbox=ledger.db.prepare("SELECT status FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId);
    const kinds=ledger.db.prepare("SELECT kind FROM events WHERE workflow_id=? ORDER BY seq").all(workflowId).map(row=>row.kind);
    assert.deepEqual({...workflow},{generation:0,phase:'running'});
    assert.deepEqual({...job},{attempt:2,generation:0,status:'running',worker_id:restartOut.terminal});
    assert.equal(inbox.status,'claimed');
    assert.ok(kinds.includes('kernel-stale-cleared'));assert.ok(kinds.includes('kernel-restarted'));
    assert.ok(kinds.includes('phase-transition'),'the kernel claim must durably record queued->running');
  }finally{ledger.close();}
  // The seat the prompt names is what api status shows; kernel.you proves the caller's own terminal.
  const statusAs=handle=>json(spawnSync(process.execPath,[API,'status','--repo',f.repo,'--workflow',workflowId,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...f.env,ORCA_TERMINAL_HANDLE:handle}}).stdout)?.kernel;
  const seat=statusAs(restartOut.terminal);
  assert.equal(seat?.attempt,2);assert.equal(seat?.terminal,restartOut.terminal);
  assert.equal(seat?.launch,'kernel-restarted');assert.equal(seat?.launchedBy,'watchdog');assert.equal(seat?.you,true);
  assert.equal(statusAs(firstOut.terminal)?.you,false,'the replaced terminal is not the seat');
});

test('a replacement launch proceeds on its recorded authority alone — no confirmation step anywhere',t=>{
  // Orca 1.4.209 / starci-next sn-foundation and sn-subscription attempt 2: a replacement Claude
  // Kernel held for a human "yes" because its prompt gave too little authority and it read watchdog
  // wakes as possible injection. The launch itself is the proof it needs no person: it completes,
  // names its launcher, and files no ask, incident or owner wait (owner rule: the owner never
  // approves launch gates).
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','a replacement needs no confirmation','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);

  killTerminal(f,firstKernel);
  // No --launched-by: a direct run is the supervisor's.
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const out=json(restarted.stdout);
  assert.equal(out?.replaced,true);assert.equal(out?.attempt,2);
  assert.deepEqual({kind:out?.launchAuthority?.kind,launchedBy:out?.launchAuthority?.launchedBy,
    confirmationRequested:out?.launchAuthority?.confirmationRequested},
    {kind:'replacement',launchedBy:'supervisor',confirmationRequested:false},
    'the launch receipt declares the replacement resumed with no confirmation requested');
  const authority=readState(f).terminals[out.terminal].prompt
    .split('RESOLVED HOST CONTEXT')[0];
  assert.match(authority,/LAUNCH AUTHORITY: resume .*ask no one to confirm\./);
  assert.match(authority,/Launcher: the supervisor started this terminal/);
  assert.doesNotMatch(authority,/reply ['"]?(yes|run it|ok)\b|read-only first|waiting for (a |your )?(go|yes|ok)\b/i,
    'no line of the authority block asks a person for a go');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const ev=json(ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-restarted'").get(workflowId)?.payload_json);
    assert.equal(ev?.launchedBy,'supervisor','the ledger records who launched the replacement');
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM incidents WHERE workflow_id=?").get(workflowId).n,0,'no confirmation incident');
  }finally{ledger.close();}
  const status=json(spawnSync(process.execPath,[API,'status','--repo',f.repo,'--workflow',workflowId,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...f.env,ORCA_TERMINAL_HANDLE:out.terminal}}).stdout);
  assert.deepEqual(status?.awaitingOwner,[],'nothing waits on the owner');
  assert.deepEqual({attempt:status?.kernel?.attempt,launch:status?.kernel?.launch,launchedBy:status?.kernel?.launchedBy,you:status?.kernel?.you},
    {attempt:2,launch:'kernel-restarted',launchedBy:'supervisor',you:true},
    'api status is the proof the prompt names: same attempt, same launcher, your terminal');

  // The flag names only the two real launchers.
  const bogus=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--launched-by','owner','--json');
  assert.equal(bogus.status,2);
  assert.match(bogus.stderr,/--launched-by must be one of watchdog, supervisor/);
});

test('the workflow Orca Run survives a kernel restart — one run-create, one runId, the new kernel terminal',t=>{
  // fable.md orca-hierarchy root cause 1: the restart wrote a fresh
  // payload_json over the kernel job, so orca.runId was lost and the next
  // dispatch's ensureWorkflowRun created a SECOND Run. Two Runs is what the
  // owner saw as two trees in the Orca sidebar.
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','keep one run across kernel churn','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);

  // claude-agent is the managed exemplar; Codex ops are command terminals (tests/codex-unattended-ops.spec.mjs).
  enqueueOp(f,workflowId,'job-run-survives-1','docs/a/');
  const d1=f.run(API,'dispatch','--repo',f.repo,'--job','job-run-survives-1','--model','claude-agent','--spawn','--json');
  assert.equal(d1.status,0,d1.stderr||d1.stdout);
  assert.equal(json(d1.stdout)?.managed?.runId,'run-fake-1');
  assert.equal(payloadOf(f.repo,`kernel-${workflowId}`)?.orca?.runId,'run-fake-1',
    'the Run is recorded on the kernel job, which is what survives an op');

  killTerminal(f,firstKernel);
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const secondKernel=json(restarted.stdout)?.terminal;
  assert.notEqual(secondKernel,firstKernel,'precondition: the restart really did take a new seat');

  const afterRestart=payloadOf(f.repo,`kernel-${workflowId}`);
  assert.equal(afterRestart?.orca?.runId,'run-fake-1','the restart merges the new seat over the durable Orca identity');
  assert.equal(afterRestart?.hierarchy?.runtime?.runId,'run-fake-1');
  assert.equal(afterRestart?.hierarchy?.runtime?.terminalHandle,secondKernel,'the seat facts are still replaced');
  assert.equal(afterRestart?.hierarchy?.attempt,2);

  enqueueOp(f,workflowId,'job-run-survives-2','docs/b/');
  const d2=f.run(API,'dispatch','--repo',f.repo,'--job','job-run-survives-2','--model','claude-agent','--spawn','--json');
  assert.equal(d2.status,0,d2.stderr||d2.stdout);
  assert.equal(json(d2.stdout)?.managed?.runId,'run-fake-1','the op after the restart joins the SAME Run');

  const runCreates=f.calls().filter(c=>c==='orchestration run-create');
  assert.equal(runCreates.length,1,`the workflow Run is created once, not once per kernel: ${f.calls().join(', ')}`);
  const taskCreates=f.callArgv().filter(argv=>argv.slice(0,2).join(' ')==='orchestration task-create');
  assert.equal(taskCreates.length,2);
  assert.equal(taskCreates[0][taskCreates[0].indexOf('--from')+1],firstKernel);
  assert.equal(taskCreates[1][taskCreates[1].indexOf('--from')+1],secondKernel,
    'every Task is created with the CURRENT kernel terminal as --from');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const created=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='run-created'").all(workflowId);
    assert.equal(created.length,1,'run-created is emitted once for the workflow');
    assert.equal(json(created[0].payload_json)?.runId,'run-fake-1');
  }finally{ledger.close();}
});

test('a kernel restart closes the previous kernel terminal before the new one is recorded',t=>{
  // fable.md orca-hierarchy root cause 2: clearing the stale signal removed
  // the ledger's handle on the old terminal, not the PTY. Only the managed
  // kernel was settled; the command-terminal kernel lived on as a second
  // [Kernel] row nobody owned.
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','one live kernel terminal per workflow','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);
  assert.deepEqual(readState(f).closed??[],[],'precondition: nothing closed yet');

  killTerminal(f,firstKernel);
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const secondKernel=json(restarted.stdout)?.terminal;
  assert.notEqual(secondKernel,firstKernel);

  const state=readState(f);
  assert.deepEqual(state.closed,[firstKernel],'the restart closes exactly the previous kernel terminal');
  const live=Object.values(state.terminals).filter(term=>!term.closed).map(term=>term.handle);
  assert.deepEqual(live,[secondKernel],'a workflow has exactly one live kernel terminal');
  assert.equal(state.terminals[secondKernel].title,`[Kernel] ${workflowId}`,
    'the kernel terminal carries its semantic name from creation');
  const closeCall=f.callArgv().find(argv=>argv.slice(0,2).join(' ')==='terminal close');
  assert.equal(closeCall?.[closeCall.indexOf('--terminal')+1],firstKernel);

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const cleared=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-cleared'").get(workflowId);
    assert.equal(json(cleared?.payload_json)?.terminalClosed?.ok,true,'the close is recorded on kernel-stale-cleared');
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind='kernel-stale-terminal-unclosed'").get(workflowId).n,0);
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM incidents WHERE workflow_id=?").get(workflowId).n,0);
  }finally{ledger.close();}
});

test('after a host reboot the kernel handle Orca no longer knows is replaced with no close call and no incident',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','a reboot leaves no terminal to close','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);

  const state=readState(f);
  state.terminals[firstKernel].stale=true;
  fs.writeFileSync(f.state,JSON.stringify(state));
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  assert.notEqual(json(restarted.stdout)?.terminal,firstKernel);
  assert.equal(f.callArgv().some(argv=>argv.slice(0,2).join(' ')==='terminal close'),false,'nothing is left to close');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const cleared=json(ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-cleared'").get(workflowId)?.payload_json);
    assert.deepEqual(cleared?.terminalClosed,{handle:firstKernel,ok:true,gone:true});
    assert.equal(cleared?.reason,'terminal_handle_stale');
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM incidents WHERE workflow_id=?").get(workflowId).n,0);
  }finally{ledger.close();}
});

test('a stale kernel terminal the host refuses to close is an incident, not silence — the restart still proceeds',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','a refused close must not be swallowed','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);

  killTerminal(f,firstKernel);
  f.closeFails=firstKernel;
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,`a dead kernel must still be replaced: ${restarted.stderr}`);
  const secondKernel=json(restarted.stdout)?.terminal;
  assert.notEqual(secondKernel,firstKernel);
  assert.deepEqual(readState(f).closed??[],[],'the refused close left the terminal alive');
  assert.match(restarted.stderr,/kernel terminal .* could not be closed/i);

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const unclosed=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-terminal-unclosed'").get(workflowId);
    assert.ok(unclosed,'a failed close is recorded, never silent');
    assert.equal(json(unclosed.payload_json)?.handle,firstKernel);
    const incident=ledger.db.prepare("SELECT last_progress,status FROM incidents WHERE workflow_id=?").get(workflowId);
    assert.equal(incident?.status,'open');
    assert.match(incident?.last_progress??'',/kernel-stale-terminal-unclosed/);
  }finally{ledger.close();}
});
