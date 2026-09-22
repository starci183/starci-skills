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
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),'language: vi\neffort: medium\nkernel: {agent: codex, model: gpt-5.6-sol, effort: high}\n');
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
  return Object.assign(f,{repo,state,run,calls,callArgv});
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
      payload:{opId:'code.refactor',owned_paths:[ownedPath],model:'codex-agent'}});
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
  assert.match(state.commands[0],/(?:^|\s)--model\s+['"]?gpt-5\.6-sol['"]?(?:\s|$)/i);
  assert.match(state.commands[0],/--ask-for-approval\s+never/);
  assert.match(state.commands[0],/--sandbox\s+danger-full-access/);
  assert.match(state.terminals[firstOut.terminal].prompt,new RegExp(ROOT.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(state.terminals[firstOut.terminal].prompt,/Never look for or create a\s+target-local `\.claude`/);

  const duplicate=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(duplicate.status,0,duplicate.stderr);
  assert.equal(json(duplicate.stdout)?.terminal,firstOut.terminal);
  state=json(fs.readFileSync(f.state,'utf8'));assert.equal(state.counter,1,'a connected kernel must not duplicate');

  killTerminal(f,firstOut.terminal);
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const restartOut=json(restarted.stdout);assert.equal(restartOut?.replaced,true);assert.equal(restartOut?.attempt,2);
  assert.equal(restartOut?.generation,0,'agent churn must not invalidate the workflow generation');
  assert.notEqual(restartOut?.terminal,firstOut.terminal);

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

  enqueueOp(f,workflowId,'job-run-survives-1','docs/a/');
  const d1=f.run(API,'dispatch','--repo',f.repo,'--job','job-run-survives-1','--model','codex-agent','--spawn','--json');
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
  const d2=f.run(API,'dispatch','--repo',f.repo,'--job','job-run-survives-2','--model','codex-agent','--spawn','--json');
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
