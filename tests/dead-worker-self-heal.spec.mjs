import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// On 2026-09-23 twenty-nine op workers died or went quiet without a report (codex and claude
// exited to a bare PowerShell prompt, Mia Mia workers sat nudged and silent), and each became a
// hand-written incident while its Kernel stalled. These specs pin the self-heal:
//   - `reconcile --dead-worker --settle-failed` settles a dead worker's attempt failed-no-report
//     when its effect evidence is bounded by the owned paths: lease released, terminal closed,
//     ONE retry queued as attempt+1 through the retry lineage; a repeat writes nothing;
//   - evidence outside the owned paths (an op risk hint) stays fenced for the Kernel;
//   - a worker quiet past its provider's timeout after a nudge is dead to the frontier, nudge
//     refuses it, and the recovery quits its agent before closing its terminal;
//   - the third failed-no-report death of one op raises ONE pattern incident;
//   - a live worker's path leases are renewed by status (inc-2262f5eab354);
//   - the watchdog runs the recovery for every frontier deadWorkerJobs entry.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WF='wf-self-heal',JOB='job-self-heal',HANDLE='term-self-heal',OP='docs.author';
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const HOUR=3600*1000,MIN=60*1000;

const git=(cwd,args,env={})=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,
    GIT_AUTHOR_NAME:'spec',GIT_AUTHOR_EMAIL:'spec@example.invalid',GIT_COMMITTER_NAME:'spec',GIT_COMMITTER_EMAIL:'spec@example.invalid',...env}});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// One world: a git repo that owns the ledger, docs/ committed an hour before the dispatch, the
// fake Orca with the op's terminal record in `terminal` ({connected:false} dead, null live).
const world=(t,fn,{terminal={connected:false,writable:false},dispatchedAgo=MIN,leaseExpiresIn=HOUR,op=OP,payloadExtra={}}={})=>withLedger(t,({root,repoRoot,machineHome,ledger})=>{
  git(repoRoot,['init','-q']);
  fs.writeFileSync(path.join(repoRoot,'.gitignore'),'.starciwork/\n');
  fs.mkdirSync(path.join(repoRoot,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repoRoot,'docs','readme.md'),'# docs\n');
  const past=new Date(Date.now()-2*HOUR).toISOString();
  git(repoRoot,['add','-A']);
  git(repoRoot,['commit','-q','-m','seed'],{GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'orca-state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:terminal?{[HANDLE]:{handle:HANDLE,...terminal}}:{}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    LOCALAPPDATA:machineHome};
  delete env.ORCA_TERMINAL_HANDLE;delete env.STARCI_ROLE;delete env.STARCI_OP_JOB;
  const run=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repoRoot,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const dispatchedAt=Date.now()-dispatchedAgo;
  seedWorkflow(ledger,{id:WF,state:{phase:'running'},
    jobs:[{jobId:JOB,opId:op,kind:'op',status:'running',attempt:1,workerId:HANDLE,leaseToken:'tok-self-heal',createdAt:dispatchedAt,
      payload:{opId:op,title:'author the docs',records:['docs/readme.md'],owned_paths:['docs/'],orca:{dispatchId:HANDLE,agentTerminalHandle:HANDLE},
        hierarchy:{runtime:{host:'orca',agent:'codex',dispatchId:HANDLE,terminalHandle:HANDLE}},...payloadExtra}}],
    leases:[{resourceKey:'path:docs/',jobId:JOB,expiresAt:Date.now()+leaseExpiresIn}]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,op,1,HANDLE,'# self-heal contract','{}',dispatchedAt);
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-dispatched',payload:{op,dispatch:HANDLE,terminal:HANDLE},createdAt:dispatchedAt});
  const job=(id=JOB)=>ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(id);
  const jobs=()=>ledger.db.prepare('SELECT * FROM jobs WHERE workflow_id=? ORDER BY attempt').all(WF);
  const leases=()=>ledger.db.prepare('SELECT * FROM leases WHERE job_id=?').all(JOB);
  const events=kind=>ledger.db.prepare('SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND kind=?').all(WF,kind);
  const incidents=()=>ledger.db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open'").all(WF);
  const orcaState=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
  const writeOrca=mutate=>{const s=orcaState();mutate(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  return fn({repoRoot,ledger,run,job,jobs,leases,events,incidents,orcaState,writeOrca,dispatchedAt});
});
const status=run=>{const r=run('status','--workflow',WF);assert.equal(r.status,0,r.stderr||r.stdout);return out(r);};

test('--settle-failed settles a dead worker with owned-path effects failed-no-report and queues one retry',t=>world(t,({repoRoot,run,job,jobs,leases,events,orcaState})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  assert.deepEqual(status(run).frontier.deadWorkerJobs,[JOB]);
  const r=run('reconcile','--job',JOB,'--dead-worker','--settle-failed');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.deepEqual([body.recovery,body.status,body.reason,body.reportFiled,body.effectState],['settled-failed','failed','failed-no-report',false,'partial']);
  assert.ok(body.evidence.includes('dirty:docs/half-written.md'),JSON.stringify(body.evidence));
  const row=job();
  assert.equal(row.status,'failed');
  const result=JSON.parse(row.result_json);
  assert.deepEqual([result.verdict,result.reason,result.reportFiled,result.attemptConsumed],['fail','failed-no-report',false,true]);
  assert.equal(leases().length,0,'the lease is released');
  assert.deepEqual([body.terminalClosed.closed,body.terminalClosed.proof],[true,'disconnected'],'the dead terminal is closed');
  assert.deepEqual(orcaState().closed,[HANDLE]);
  // One retry: the same op, records, owned paths, as attempt 2 through the retry lineage.
  const retry=jobs().find(j=>j.job_id!==JOB);
  assert.equal(body.retry.jobId,retry.job_id);
  assert.deepEqual([retry.status,retry.attempt,retry.op_id],['queued',2,OP]);
  const payload=JSON.parse(retry.payload_json);
  assert.deepEqual(payload.owned_paths,['docs/']);
  assert.deepEqual(payload.records,['docs/readme.md']);
  assert.equal(payload.retry.retryOf,JOB);
  assert.equal(payload.retry.retryClass,'business','a no-report death spends a business attempt');
  assert.equal(payload.retryReason.reason,'failed-no-report');
  const settled=events('op-settled').map(e=>JSON.parse(e.payload_json));
  assert.deepEqual([settled.length,settled[0].reason,settled[0].auto,settled[0].reportFiled],[1,'failed-no-report',true,false]);
  assert.equal(events('worker-failed-no-report').length,1);
  const after=status(run);
  assert.deepEqual(after.frontier.deadWorkerJobs,[]);
  assert.ok(after.frontier.queued.some(q=>q.jobId===retry.job_id),'the retry waits on the Kernel to route it');
  // A repeat writes nothing and names the retry.
  const again=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([again.alreadyRecovered,again.retry.jobId],[true,retry.job_id]);
  assert.equal(jobs().length,2);
  assert.equal(events('worker-failed-no-report').length,1);
}));

test('without --settle-failed the recovery keeps its fence; --settle-failed later settles that fence',t=>world(t,({repoRoot,run,job,jobs})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  assert.equal(out(run('reconcile','--job',JOB,'--dead-worker')).recovery,'fenced');
  assert.equal(job().status,'effect_unknown');
  const r=run('reconcile','--job',JOB,'--dead-worker','--settle-failed');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(out(r).recovery,'settled-failed');
  assert.equal(job().status,'failed');
  assert.equal(jobs().filter(j=>j.status==='queued').length,1);
}));

test('a provably no-effect death is still the same attempt requeued, not a spent attempt',t=>world(t,({run,job,jobs})=>{
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'requeued');
  assert.deepEqual([job().status,job().attempt,jobs().length],['queued',1,1]);
}));

test('evidence the owned paths cannot bound stays fenced for the Kernel',t=>world(t,({run,job,jobs})=>{
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'fenced');
  assert.ok(body.evidence.some(e=>e.startsWith('risk:')),JSON.stringify(body.evidence));
  assert.deepEqual([job().status,jobs().length],['effect_unknown',1]);
},{op:'release.deliver'}));

test('the third no-report death of one op raises one pattern incident, and only one',t=>world(t,({ledger,repoRoot,run,incidents})=>{
  for(const id of ['job-earlier-1','job-earlier-2'])
    ledger.appendEvent({workflowId:WF,entityType:'job',entityId:id,kind:'worker-failed-no-report',payload:{opId:OP,attempt:1,liveness:'agent-exited'}});
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([body.pattern.raised,body.pattern.count],[true,3]);
  const open=incidents();
  assert.equal(open.length,1);
  assert.match(open[0].last_progress,/^\[worker-died-no-report-pattern\] docs\.author: 3 attempts ended with no report/);
  assert.equal(open[0].op_id,OP);
  // A fourth death while it is open adds no second incident.
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:'job-earlier-3',kind:'worker-failed-no-report',payload:{opId:OP,attempt:1}});
  const second=ledger.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=? AND status=?').get(WF,'queued').job_id;
  ledger.db.prepare("UPDATE jobs SET status='running',worker_id=? WHERE job_id=?").run(HANDLE,second);
  const again=out(run('reconcile','--job',second,'--dead-worker','--settle-failed'));
  assert.equal(again.recovery,'settled-failed',JSON.stringify(again));
  assert.deepEqual([again.pattern.raised,again.pattern.existing],[false,true]);
  assert.equal(incidents().length,1);
}));

// 2026-09-26 09:55, 11:30 and 17:04 +07: Orca restarts wiped every terminal on the host - every Kernel
// and every worker answered terminal_handle_stale in the same second. Each worker with partial effects
// settled failed-no-report as a spent business attempt, demoted its pool for the retry, and three of
// them raised [worker-died-no-report-pattern] (nivo inc-ceb153dfd2cf: 3x devin, starci-next
// inc-65666fb85763: 2x qwen + 1x devin). A worker gone together with its workflow's Kernel terminal died
// of the host: the retry continues the tree, spends no business attempt, blames no pool, counts in no
// pattern.
const KERNEL_HANDLE='term-kernel-self-heal';
const seatKernel=(ledger,handle=KERNEL_HANDLE)=>{
  ledger.enqueueJob({jobId:`kernel-${WF}`,workflowId:WF,kind:'kernel',role:'kernel',payload:{hierarchy:{role:'kernel'}}});
  ledger.db.prepare("UPDATE jobs SET status='running',worker_id=? WHERE job_id=?").run(handle,`kernel-${WF}`);
};
const WIPED={stale:true};
test('a worker gone with its Kernel terminal in a host terminal wipe settles as the environment: no business attempt, no pool demoted, no pattern',t=>world(t,async({ledger,repoRoot,run,job,jobs,events,incidents,writeOrca})=>{
  seatKernel(ledger);
  writeOrca(s=>{s.terminals[KERNEL_HANDLE]={handle:KERNEL_HANDLE,stale:true};});
  for(const id of ['job-earlier-1','job-earlier-2'])
    ledger.appendEvent({workflowId:WF,entityType:'job',entityId:id,kind:'worker-failed-no-report',payload:{opId:OP,attempt:1,liveness:'gone'}});
  ledger.db.prepare("UPDATE jobs SET payload_json=json_set(payload_json,'$.model','devin-agent') WHERE job_id=?").run(JOB);
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  assert.deepEqual(status(run).frontier.deadWorkerJobs,[JOB]);
  const r=run('reconcile','--job',JOB,'--dead-worker','--settle-failed');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.deepEqual([body.recovery,body.liveness,body.effectState,body.attemptConsumed,body.environment],['settled-failed','gone','partial',false,'host-terminal-wipe'],JSON.stringify(body));
  assert.deepEqual([body.hostWipe.proof,body.hostWipe.kernelTerminal,body.hostWipe.errorCode],['kernel-terminal-gone',KERNEL_HANDLE,'terminal_handle_stale']);
  const result=JSON.parse(job().result_json);
  assert.deepEqual([result.reason,result.attemptConsumed,result.retryClass,result.environment],['failed-no-report',false,'environment','host-terminal-wipe']);
  const retry=jobs().find(j=>j.job_id!==JOB&&j.kind==='op');
  const lineage=JSON.parse(retry.payload_json).retry;
  assert.deepEqual([retry.attempt,lineage.retryOf,lineage.retryClass,lineage.businessAttempt,lineage.consumesBusinessRetry],[2,JOB,'environment',1,false],'a new durable attempt that spends no business retry');
  const died=events('worker-failed-no-report').map(e=>JSON.parse(e.payload_json)).find(p=>p.dispatchId);
  assert.deepEqual([died.environment,died.attemptConsumed],['host-terminal-wipe',false]);
  assert.equal(body.pattern.raised,false,'the host death is no pattern of the op');
  assert.equal(incidents().length,0);
  const {lineageRouteAdjust}=await import('../scripts/kernel/lineage-route.mjs');
  const adjust=lineageRouteAdjust(ledger.db,retry);
  assert.deepEqual([adjust.attempts[0].cause,adjust.attempts[0].attributable,adjust.demote,adjust.exclude],['host-terminal-wipe',false,[],[]]);
},{terminal:WIPED}));

test('a Kernel seat already cleared for a gone terminal since the dispatch is the same host wipe',t=>world(t,({ledger,repoRoot,run,job,writeOrca})=>{
  seatKernel(ledger,'term-kernel-replacement');
  writeOrca(s=>{s.terminals['term-kernel-replacement']={handle:'term-kernel-replacement',connected:true,writable:true};});
  ledger.appendEvent({workflowId:WF,entityType:'workflow',entityId:WF,kind:'kernel-stale-cleared',payload:{terminal:KERNEL_HANDLE,reason:'terminal_handle_stale'}});
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([body.environment,body.hostWipe?.proof,body.hostWipe?.kernelTerminal],['host-terminal-wipe','kernel-stale-cleared',KERNEL_HANDLE],JSON.stringify(body));
  assert.equal(JSON.parse(job().result_json).attemptConsumed,false);
},{terminal:WIPED}));

test('a worker gone while its Kernel terminal lives is its own death: a spent business attempt',t=>world(t,({ledger,repoRoot,run,job,jobs,writeOrca})=>{
  seatKernel(ledger);
  writeOrca(s=>{s.terminals[KERNEL_HANDLE]={handle:KERNEL_HANDLE,connected:true,writable:true};});
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([body.recovery,body.liveness,body.attemptConsumed,body.environment],['settled-failed','gone',true,undefined],JSON.stringify(body));
  const result=JSON.parse(job().result_json);
  assert.deepEqual([result.attemptConsumed,result.retryClass],[true,undefined]);
  const lineage=JSON.parse(jobs().find(j=>j.job_id!==JOB&&j.kind==='op').payload_json).retry;
  assert.deepEqual([lineage.retryClass,lineage.businessAttempt],['business',2]);
},{terminal:WIPED}));

// Mia Mia inc-c6cf249ecd5a: a worker nudged once, then silent at its prompt with a lease and no report.
const IDLE={connected:true,writable:true,screen:['• Report pending.','› Ask Codex to do anything','  gpt-6-sol high · 62% left'].join('\n'),lastOutputAt:Date.now()-45*MIN};
test('a worker quiet past its provider timeout after a nudge is dead: nudge refuses, the recovery quits and closes it',t=>world(t,({ledger,repoRoot,run,job,orcaState})=>{
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-worker-nudged',payload:{opId:OP,attempt:1},createdAt:Date.now()-30*MIN});
  const worker=status(run).workers.find(w=>w.jobId===JOB);
  assert.equal(worker.liveness,'quiet');
  assert.ok(worker.quiet.quietMs>0);
  assert.deepEqual(status(run).frontier.deadWorkerJobs,[JOB]);
  const nudge=run('nudge','--job',JOB);
  assert.equal(nudge.status,1);
  assert.equal(out(nudge).reason,'worker-quiet');
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'settled-failed',JSON.stringify(body));
  assert.equal(body.liveness,'quiet');
  assert.deepEqual([body.terminalClosed.closed,body.terminalClosed.proof],[true,'quiet-quit']);
  assert.ok((orcaState().closed??[]).includes(HANDLE));
  assert.equal(job().status,'failed');
},{terminal:IDLE,dispatchedAgo:HOUR}));

test('a worker nudged a moment ago, or never nudged, is not quiet',t=>world(t,({ledger,run})=>{
  assert.equal(status(run).workers.find(w=>w.jobId===JOB).liveness,'turn-idle','never nudged: the Kernel nudges first');
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-worker-nudged',payload:{opId:OP,attempt:1},createdAt:Date.now()-2*MIN});
  assert.equal(status(run).workers.find(w=>w.jobId===JOB).liveness,'turn-idle','nudged 2 minutes ago');
},{terminal:IDLE,dispatchedAgo:HOUR}));

// inc-2c1ac4ff3e48: a worker sat 34+ minutes on one shell command with no output - its moving
// spinner read as active and nothing flagged it, while status/driver-loop pointed the Kernel at a
// nudge cmdNudge has no branch for (it refused worker-state-unknown) and reconcile --dead-worker
// refused worker-alive. A wedged worker is dead to its contract - the turn can never file the
// report - but it is not a dead-liveness state: it recovers only through
// `reconcile --dead-worker --settle-failed`, which quits the agent first like the quiet path.
const WEDGED={connected:true,writable:true,command:'codex',screen:['• Working (45m 12s • esc to interrupt)',' │ No output yet (still running)','› Ask Codex to do anything'].join('\n')};
test('a wedged worker: nudge refuses worker-wedged, plain --dead-worker refuses, --settle-failed quits it and settles failed',t=>world(t,({repoRoot,run,job,jobs,events,orcaState})=>{
  assert.equal(status(run).workers.find(w=>w.jobId===JOB).liveness,'wedged');
  assert.deepEqual(status(run).frontier.wedgedJobs,[JOB]);
  assert.deepEqual(status(run).frontier.deadWorkerJobs,[],'wedged is not a dead-liveness state');
  const nudge=run('nudge','--job',JOB);
  assert.equal(nudge.status,1);
  assert.equal(out(nudge).reason,'worker-wedged');
  assert.equal(orcaState().sends??0,0,'nothing was typed');
  assert.equal(events('op-worker-nudged').length,0);
  const plain=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(plain.status,1);
  assert.equal(out(plain).reason,'worker-wedged','the refusal names the settle-failed route');
  assert.equal(job().status,'running','nothing written');
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'settled-failed',JSON.stringify(body));
  assert.equal(body.liveness,'wedged');
  assert.deepEqual([body.terminalClosed.closed,body.terminalClosed.proof],[true,'wedged-quit']);
  assert.ok((orcaState().quits??[]).some(q=>q.handle===HANDLE),'the agent was quit before its terminal closed');
  assert.ok((orcaState().closed??[]).includes(HANDLE));
  assert.equal(job().status,'failed');
  assert.equal(jobs().filter(j=>j.status==='queued').length,1,'one retry queued');
  const dead=events('worker-failed-no-report').map(e=>JSON.parse(e.payload_json));
  assert.equal(dead[0]?.liveness,'wedged');
},{terminal:WEDGED,dispatchedAgo:HOUR,payloadExtra:{provider:'codex'}}));

test('status renews the path lease of a live running worker and never the lease of a dead one (inc-2262f5eab354)',async t=>{
  await world(t,({run,leases})=>{
    const body=status(run);
    assert.equal(body.activeLeases.length,1,'the expiring lease is listed');
    assert.ok(leases()[0].expires_at>Date.now()+15*MIN,'renewed to a full dispatch TTL');
  },{terminal:{connected:true,writable:true,screen:'• Working (40m 3s • esc to interrupt)\n› Ask Codex to do anything'},leaseExpiresIn:2*MIN});
  await world(t,({run,leases})=>{
    status(run);
    assert.ok(leases()[0].expires_at<Date.now()+3*MIN,'a disconnected worker keeps its old expiry');
  },{leaseExpiresIn:2*MIN});
});

test('the watchdog recovers every dead worker the frontier lists, through the api',async()=>{
  const {recoverDeadWorkers}=await import('../scripts/kernel/watchdog.mjs');
  const calls=[];
  const run=(args)=>{calls.push(args);return args.includes('job-b')
    ?{ok:false,value:{ok:false,reason:'worker-alive'},stderr:''}
    :{ok:true,value:{ok:true,recovery:'settled-failed',status:'failed',retry:{jobId:'job-a-retry'},pattern:{raised:true,incidentId:'inc-x'}}};};
  const healed=recoverDeadWorkers({frontier:{deadWorkerJobs:['job-a','job-b']}},{run,repoPath:'D:/repo'});
  assert.deepEqual(calls.map(a=>a.slice(a.indexOf('--job'),a.indexOf('--job')+4)),[['--job','job-a','--dead-worker','--settle-failed'],['--job','job-b','--dead-worker','--settle-failed']]);
  assert.deepEqual(healed[0],{jobId:'job-a',ok:true,recovery:'settled-failed',status:'failed',retry:'job-a-retry',patternIncident:'inc-x'});
  assert.deepEqual([healed[1].ok,healed[1].reason],[false,'worker-alive'],'a live worker is refused by the api, never recovered');
  assert.deepEqual(recoverDeadWorkers({frontier:{deadWorkerJobs:[]}},{run}),[]);
  const src=fs.readFileSync(path.join(ROOT,'scripts','kernel','watchdog.mjs'),'utf8');
  assert.match(src,/if \(repair && \(status\.value\?\.frontier\?\.deadWorkerJobs \?\? \[\]\)\.length\)/,'only a --repair watchdog recovers');
});
