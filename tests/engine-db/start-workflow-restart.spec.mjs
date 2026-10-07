import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,openLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';
import { ensureWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { senderEnv } from '../helpers/sender-env.mjs';
// Attestation/settle waits are counted logically; scaled down they cost milliseconds, not load-dependent seconds.
process.env.STARCI_SLEEP_SCALE??='0.02';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-start-restart-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json');
  const log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  const trustHome=path.join(root,'trust-home');fs.mkdirSync(trustHome);
  // The same exact repo is the Git main root when prepareWorkflowTree creates a registered workflow tree.
  const ownerConfig=fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8')
    .replace(/^language:.*$/m,'language: vi').replace(/^effort:.*$/m,'effort: medium')
    .replace(/^kernel:.*$/m,'kernel: {agent: codex, model: gpt-6.1-sol, effort: high}')
    .replace(/^launchTrust:.*$/m,`launchTrust: ${JSON.stringify({profile:'automatic',approvedBy:'owner',approvalRef:'private restart fixture adoption',roots:[repo]})}`);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),ownerConfig);
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  // Real Orca mints a distinct Dispatch id per worker-start; the canned 'dispatch-fake-1' would collide on
  // op_attempts.UNIQUE(workflow_id,dispatch_id) when a workflow's second managed op dispatches.
  fs.writeFileSync(fake,FAKE_ORCA.replaceAll("'dispatch-fake-1'","(state.dispatchSeq=(state.dispatchSeq??0)+1,'dispatch-fake-'+state.dispatchSeq)"));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot,STARCI_AGENT_TRUST_HOME:trustHome,
    // The machine registry is worker-wide: fixture repos all basename to 'repo' and collide on ledgers.name.
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite')};
  const run=(script,...args)=>spawnSync(process.execPath,['--loader',new URL('../helpers/worker-close-loader.mjs',import.meta.url).href,'--loader',new URL('../helpers/workflow-startup-loader.mjs',import.meta.url).href,script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:senderEnv(script,{...env,...(f.closeFails?{STARCI_FAKE_ORCA_CLOSE_FAILS:f.closeFails}:{}),...(f.releaseFails?{STARCI_FAKE_ORCA_RELEASE_FAILS:'1'}:{}),...(f.unverifiedClosure?{STARCI_FAKE_CLOSURE_UNPROVEN:'1'}:{})})});
  const f={};
  const callArgv=()=>fs.existsSync(log)
    ?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const calls=()=>callArgv().map(argv=>argv.slice(0,2).join(' '));
  return Object.assign(f,{root,repo,state,run,calls,callArgv,env});
};

const prepareWorkflowTree=(f,workflowId)=>{
  for(const args of [['init','--initial-branch=main'],['config','user.name','Startup Fixture'],['config','user.email','startup-fixture@example.invalid'],
    ['commit','--allow-empty','-m','native startup fixture']]){
    const result=spawnSync('git',args,{cwd:f.repo,encoding:'utf8',windowsHide:true,timeout:60000});
    assert.equal(result.status,0,result.stderr||result.error?.message);
  }
  const orca=fakeOrcaWorktrees({root:path.join(f.root,'trees')});
  const result=ensureWorkflowWorktree({env:f.env,orca},{workflowId,appRepo:f.repo});
  assert.equal(result.ok,true,result.detail);
  return result.record;
};

const readState=f=>json(fs.readFileSync(f.state,'utf8'));
// The Kernel worker ended: Orca shows its Dispatch exited (worker-show) and its terminal disconnected.
const dispatchOf=(state,handle)=>'dispatch-fake-'+((state.workerStarts??[]).findIndex(w=>w.handle===handle)+1);
const killTerminal=(f,handle)=>{
  const state=readState(f);
  state.terminals[handle].connected=false;state.terminals[handle].writable=false;
  state.workerStates={...(state.workerStates??{}),[dispatchOf(state,handle)]:'exited'};
  fs.writeFileSync(f.state,JSON.stringify(state));
};
const enqueueOp=(f,workflowId,jobId,ownedPath)=>{
  fs.mkdirSync(path.join(f.repo,ownedPath),{recursive:true});
  const ledger=openLedger({file:ledgerFileFor(f.repo)});
  try{
    seedWorkflow(ledger,{id:workflowId,jobs:[{jobId,opId:'code.refactor',
      payload:{opId:'code.refactor',owned_paths:[ownedPath],difficulty:'hard',model:'claude-agent'}}]});
  }finally{ledger.close();}
};
const payloadOf=(repo,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return json(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json);}
  finally{ledger.close();}
};

test('a native owner-approved goal revision during installation refuses the old Kernel and clears only its unused reservation',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','refactor the enrolment module','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout).workflowId;
  const tree=prepareWorkflowTree(f,workflowId);
  const preview=f.run(DEFINE_GOAL,'--repo',f.repo,'--revise',workflowId,'--text',
    'refactor and canonicalize .starciwork and .starcistacks against the current contracts','--plan','--json');
  assert.equal(preview.status,0,preview.stderr);
  const approval=json(preview.stdout).revisionPreview.approval;
  assert.ok(approval.token);
  // The test is the owner of this fixture and approves the exact native preview command. The install seam executes it.
  f.env.STARCI_FAKE_INSTALL_OWNER_COMMAND=JSON.stringify(approval.command);
  const started=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(started.status,1,started.stderr);
  const failed=json(started.stderr.trim().split(/\r?\n/).at(-1));
  assert.equal(failed?.reason,'workflow-goal-unverified');
  assert.equal(failed?.install?.installed,true);
  assert.equal(failed?.install?.receipt?.revision?.goalRevision,1);
  assert.equal(failed?.workflowWorktree?.orcaWorktreeId,tree.orcaWorktreeId);
  assert.equal(readState(f).workerStarts?.length??0,0,'no worker-start uses the superseded goal');
  assert.equal(fs.existsSync(tree.path),true,'the installed workflow tree is retained');
  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const goal=ledger.db.prepare('SELECT revision,approved_by,approval_ref FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
    assert.equal(goal.revision,1);
    assert.equal(goal.approved_by,'owner');
    assert.equal(goal.approval_ref,approval.token,'the native goal API persisted the actual fixture preview approval');
    assert.equal(ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(workflowId),undefined);
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind='kernel-booted'").get(workflowId).n,0);
  }finally{ledger.close();}
});

test('a refused native install retains the registered workflow tree and creates no Kernel worker',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','refactor the enrolment module','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout).workflowId;
  const tree=prepareWorkflowTree(f,workflowId);
  f.env.STARCI_FAKE_INSTALL_FAIL='1';
  const started=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(started.status,1,started.stderr);
  const failed=json(started.stderr.trim().split(/\r?\n/).at(-1));
  assert.equal(failed?.reason,'workflow-worktree-install-failed');
  assert.equal(failed?.install?.installed,false);
  assert.equal(failed?.workflowWorktree?.orcaWorktreeId,tree.orcaWorktreeId);
  assert.equal(readState(f).workerStarts?.length??0,0);
  assert.equal(fs.existsSync(tree.path),true);
  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{assert.equal(ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(workflowId),undefined);}
  finally{ledger.close();}
  assert.equal(readMachine(m=>m.worktreeRow(tree.path),null,{env:f.env})?.orca_id,tree.orcaWorktreeId);
});

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
  assert.deepEqual([state.workerStarts[0].agent,state.workerStarts[0].model,state.workerStarts[0].effort],['codex','gpt-6.1-sol','high'],
    'the Kernel starts through worker-start with the pinned agent, model and effort');
  assert.equal(firstOut?.launch,'worker');
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
  // reply yes (observed on two replacement attempt-2 launches). The prompt
  // states the rule first, the approval, the launcher and why, and the ledger read that proves them.
  const authority=authorityOf(readState(f).terminals[restartOut.terminal].prompt).split('\n');
  assert.equal(authority[0],`LAUNCH AUTHORITY: resume ${workflowId} now as its Kernel attempt 2; ask no one to confirm.`);
  assert.match(authority[1],new RegExp(`^  Approval: the owner approved ${workflowId} goal revision \\d+ \\([0-9a-f]+\\); its first Kernel booted on that approval at \\d{4}-`));
  assert.equal(authority[2],`  Launcher: the watchdog's kernel repair started this terminal because Kernel attempt 1 (terminal ${firstOut.terminal}) failed its liveness check (worker state exited).`);
  assert.match(authority.join(' '),new RegExp(`starci kernel status --workflow ${workflowId} shows kernel\\.attempt 2,\\s+kernel\\.launchedBy watchdog and kernel\\.you true`));
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
    const jobRow=ledger.db.prepare('SELECT payload_json,generation,status,worker_id FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
    const job={attempt:json(jobRow?.payload_json)?.hierarchy?.attempt,generation:jobRow?.generation,status:jobRow?.status,worker_id:jobRow?.worker_id};
    const inbox=ledger.db.prepare("SELECT status FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId);
    const kinds=ledger.db.prepare("SELECT kind FROM events WHERE workflow_id=? ORDER BY seq").all(workflowId).map(row=>row.kind);
    assert.deepEqual({...workflow},{generation:0,phase:'running'});
    assert.deepEqual({...job},{attempt:2,generation:0,status:'running',worker_id:restartOut.terminal});
    assert.equal(inbox.status,'claimed');
    assert.ok(kinds.includes('kernel-stale-cleared'));assert.ok(kinds.includes('kernel-restarted'));
    assert.ok(kinds.includes('phase-transition'),'the kernel claim must durably record queued->running');
  }finally{ledger.close();}
  // The seat the prompt names is what starci kernel status shows; kernel.you proves the caller's own terminal.
  const statusAs=handle=>{
    const r=spawnSync(process.execPath,[API,'status','--repo',f.repo,'--workflow',workflowId,'--json'],
      {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...f.env,ORCA_TERMINAL_HANDLE:handle}});
    return {status:r.status,error:r.error?.message??null,signal:r.signal,stdout:r.stdout,stderr:r.stderr,
      kernel:json(r.stdout)?.kernel,refusal:json(String(r.stderr??'').trim().split(/\r?\n/).at(-1))};
  };
  const current=statusAs(restartOut.terminal);
  assert.equal(current.status,0,JSON.stringify(current));assert.equal(current.error,null);assert.equal(current.signal,null);
  const seat=current.kernel;
  assert.equal(seat?.attempt,2);assert.equal(seat?.terminal,restartOut.terminal);
  assert.equal(seat?.launch,'kernel-restarted');assert.equal(seat?.launchedBy,'watchdog');assert.equal(seat?.you,true);
  // Launch history identifies the old Kernel; the current incarnation owner refuses that exact stale caller.
  const stale=statusAs(firstOut.terminal);
  assert.equal(stale.status,1,JSON.stringify(stale));assert.equal(stale.error,null);assert.equal(stale.signal,null);
  assert.equal(stale.stdout.trim(),'','a stale Kernel receives no current seat projection');
  assert.equal(stale.refusal?.ok,false,JSON.stringify(stale));
  assert.equal(stale.refusal?.code,'kernel-caller-stale',JSON.stringify(stale));
  assert.equal(stale.refusal?.error,`current Kernel incarnation unavailable for ${workflowId}`,JSON.stringify(stale));
});

test('a replacement launch proceeds on its recorded authority alone — no confirmation step anywhere',t=>{
  // Orca 1.4.209, observed on two replacement attempt-2 launches: a replacement Claude
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
    'starci kernel status is the proof the prompt names: same attempt, same launcher, your terminal');

  // The flag names only the two real launchers.
  const bogus=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--launched-by','owner','--json');
  assert.equal(bogus.status,2);
  assert.match(bogus.stderr,/--launched-by must be one of watchdog, supervisor/);
});

test('the workflow Orca Run survives a kernel restart — one workflow Run, one runId, the new kernel terminal',t=>{
  // orca-hierarchy root cause 1: the restart wrote a fresh payload_json over the kernel job, so
  // orca.runId was lost and the next dispatch's ensureWorkflowRun created a SECOND Run - two trees in the sidebar.
  // Every Kernel is a worker of its own entry Run (run-fake-1, reused by the restart); the workflow Run its ops
  // join is created once, from the Kernel's own terminal, and re-bound to the new Kernel after a restart.
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','keep one run across kernel churn','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const tree=prepareWorkflowTree(f,workflowId);
  for(const ownedPath of ['be/a/','fe/b/'])fs.mkdirSync(path.join(tree.path,ownedPath),{recursive:true});

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);
  assert.equal(json(first.stdout)?.runId,'run-fake-1','the Kernel\'s entry Run');

  enqueueOp(f,workflowId,'job-run-survives-1','be/a/');
  const d1=f.run(API,'dispatch','--repo',f.repo,'--job','job-run-survives-1','--model','claude-agent','--spawn','--json');
  assert.equal(d1.status,0,`${d1.stderr}\n${d1.stdout}`);
  assert.equal(json(d1.stdout)?.managed?.runId,'run-fake-2');
  assert.equal(payloadOf(f.repo,`kernel-${workflowId}`)?.orca?.runId,'run-fake-2',
    'the workflow Run is recorded on the kernel job, which is what survives an op');

  killTerminal(f,firstKernel);
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const secondKernel=json(restarted.stdout)?.terminal;
  assert.notEqual(secondKernel,firstKernel,'precondition: the restart really did take a new seat');
  assert.equal(json(restarted.stdout)?.runId,'run-fake-1','the restart reuses the entry Run Orca still knows');

  const afterRestart=payloadOf(f.repo,`kernel-${workflowId}`);
  assert.equal(afterRestart?.orca?.runId,'run-fake-2','the restart merges the new seat over the durable Orca identity');
  assert.equal(afterRestart?.hierarchy?.runtime?.terminalHandle,secondKernel,'the seat facts are still replaced');
  assert.equal(afterRestart?.hierarchy?.attempt,2);

  enqueueOp(f,workflowId,'job-run-survives-2','fe/b/');
  const d2=f.run(API,'dispatch','--repo',f.repo,'--job','job-run-survives-2','--model','claude-agent','--spawn','--json');
  assert.equal(d2.status,0,`${d2.stderr}\n${d2.stdout}`);
  assert.equal(json(d2.stdout)?.managed?.runId,'run-fake-2','the op after the restart joins the SAME workflow Run');
  const finalState=readState(f);
  assert.equal(finalState.runs?.['run-fake-2']?.coordinator,secondKernel,'the workflow Run belongs to the current Kernel');
  assert.deepEqual((finalState.runUses??[]).filter(r=>r.id==='run-fake-2').map(r=>r.from),[secondKernel],
    'the workflow Run is rebound exactly once to the replacement Kernel');

  const runCreates=f.calls().filter(c=>c==='orchestration run-create');
  assert.equal(runCreates.length,2,`one entry Run and one workflow Run, never one per kernel: ${f.calls().join(', ')}`);
  // worker-start --spec files each op Task: the op starts are the op Tasks.
  const opTasks=f.callArgv().filter(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start'&&/^code\.refactor #/.test(argv[argv.indexOf('--task-title')+1]));
  assert.equal(opTasks.length,2);
  assert.equal(opTasks[0][opTasks[0].indexOf('--from')+1],firstKernel);
  assert.equal(opTasks[1][opTasks[1].indexOf('--from')+1],secondKernel,
    'every op Task is created with the CURRENT kernel terminal as --from');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const created=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='run-created'").all(workflowId);
    assert.equal(created.length,1,'run-created is emitted once for the workflow');
    assert.equal(json(created[0].payload_json)?.runId,'run-fake-2');
  }finally{ledger.close();}
});

test('a kernel restart fences and releases the previous kernel worker before the new one is recorded',t=>{
  // orca-hierarchy root cause 2: clearing the stale signal removed the ledger's handle on the old
  // Kernel, not the process. The old Dispatch is stopped, released and its terminal is affirmatively closed first.
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','one live kernel per workflow','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);
  const firstDispatch=json(first.stdout)?.dispatch;assert.ok(firstDispatch);

  killTerminal(f,firstKernel);
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const secondKernel=json(restarted.stdout)?.terminal;
  assert.notEqual(secondKernel,firstKernel);

  const state=readState(f);
  assert.equal(state.workerStates[firstDispatch],'released','the previous Kernel worker is released');
  const argvOf=verb=>f.callArgv().filter(argv=>argv.slice(0,2).join(' ')===verb);
  assert.deepEqual(argvOf('orchestration worker-stop').map(a=>a[a.indexOf('--dispatch')+1]),[firstDispatch]);
  assert.deepEqual(argvOf('orchestration worker-release').map(a=>a[a.indexOf('--dispatch')+1]),[firstDispatch]);
  assert.deepEqual(argvOf('terminal close').map(a=>a[a.indexOf('--terminal')+1]),[firstKernel],
    'the owning cleanup closes the exact previous terminal');
  const calls=f.callArgv();
  const closeIndex=calls.findIndex(a=>a.slice(0,2).join(' ')==='terminal close');
  const starts=calls.flatMap((a,i)=>a.slice(0,2).join(' ')==='orchestration worker-start'?[i]:[]);
  assert.ok(closeIndex<starts[1],'closure completes before the replacement worker starts');
  // The tab reads the workflow's display name (define-goal derived it: `<Product> · <goal clause>`).
  const named=json(defined.stdout)?.displayName;assert.ok(named&&named!==workflowId);
  const rename=argvOf('terminal rename').find(a=>a[a.indexOf('--terminal')+1]===secondKernel);
  assert.equal(rename?.[rename.indexOf('--title')+1],`[Kernel] ${named}`,'the kernel worker carries its semantic name');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const cleared=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-cleared'").get(workflowId);
    assert.deepEqual([json(cleared?.payload_json)?.terminalClosed?.ok,json(cleared?.payload_json)?.terminalClosed?.dispatch],[true,firstDispatch],
      'the release is recorded on kernel-stale-cleared');
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM incidents WHERE workflow_id=?").get(workflowId).n,0);
  }finally{ledger.close();}
});

test('after a host reboot the kernel Dispatch Orca no longer knows is replaced with no incident',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','a reboot leaves no worker to keep','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);

  const state=readState(f);
  state.lostDispatches=[json(first.stdout).dispatch];
  fs.writeFileSync(f.state,JSON.stringify(state));
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  assert.notEqual(json(restarted.stdout)?.terminal,firstKernel);

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const cleared=json(ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-cleared'").get(workflowId)?.payload_json);
    assert.match(cleared?.reason??'',/not found/);
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM incidents WHERE workflow_id=?").get(workflowId).n,0);
  }finally{ledger.close();}
});

test('a stale Kernel with refused release or surviving process keeps its singleton and refuses replacement',t=>{
  for (const unverified of [false, true]) {
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','a refused release must not be swallowed','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstKernel=json(first.stdout)?.terminal;assert.ok(firstKernel);

  killTerminal(f,firstKernel);
  f.releaseFails=!unverified;
  f.unverifiedClosure=unverified;
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,1,`unproven closure refuses replacement: ${restarted.stderr}`);
  assert.equal(json(restarted.stdout)?.step,'kernel-stale-terminal-unclosed');
  assert.equal(readState(f).workerStarts.length,1,'no worker starts beside the unsettled prior one');

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const unclosed=ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-terminal-unclosed'").get(workflowId);
    assert.ok(unclosed,'a refused release is recorded, never silent');
    assert.equal(json(unclosed.payload_json)?.handle,firstKernel);
    const incident=ledger.db.prepare("SELECT last_progress,status FROM incidents WHERE workflow_id=?").get(workflowId);
    assert.equal(incident?.status,'open');
    assert.match(incident?.last_progress??'',/kernel-stale-terminal-unclosed/);
    assert.equal(json(ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId)?.value_json)?.terminal,firstKernel);
  }finally{ledger.close();}
  }
});

for (const startup of [false,true]) test(`a startup crash ${startup?'with an expired signal and unsettled receipt':'with a terminal missing its Dispatch'} keeps the original singleton`,t=>{
    const f=fixture(t);
    const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','a startup crash must preserve the execution fence','--json');
    assert.equal(defined.status,0,defined.stderr);
    const workflowId=json(defined.stdout).workflowId;
    const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
    assert.equal(first.status,0,first.stderr);
    const firstOut=json(first.stdout), ledger=openLedger({file:ledgerFileFor(f.repo)});
    let token;
    try {
      token=ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(workflowId).token;
      // Reconstruct the real crash window: worker-start has created a worker and bound the capacity receipt,
      // while the launcher has not yet persisted its final managed job/signal identity.
      const payload=json(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`).payload_json);
      payload.managed=null;
      if (startup) payload.hierarchy.attempt=0;
      ledger.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify(payload),`kernel-${workflowId}`);
      ledger.db.prepare("UPDATE signals SET value_json=?,expires_at=? WHERE scope='kernel' AND key=?")
        .run(JSON.stringify(startup?{state:'starting'}:{terminal:firstOut.terminal}),startup?Date.now()-1:null,workflowId);
    } finally { ledger.close(); }
    const before=readMachine(m=>m.providerReservations({activeOnly:true}),null,{env:f.env});
    assert.equal(before.length,1);assert.equal(before[0].state,'live');
    const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
    assert.equal(restarted.status,1,'no affirmative closure or no-effect proof exists');
    const after=inspectLedger({file:ledgerFileFor(f.repo)});
    try { assert.equal(after.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(workflowId).token,token,
      'expiry never replaces the unsettled singleton identity'); } finally { after.close(); }
    assert.equal(readState(f).workerStarts.length,1);
    const retained=readMachine(m=>m.providerReservations({activeOnly:true}),null,{env:f.env});
    assert.equal(retained.length,1);assert.equal(retained[0].id,before[0].id);
});
