import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {createKernelDeadWorkerSelfHealFixture} from '../helpers/kernel-dead-worker-self-heal-fixture.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';

// Twenty-nine op workers died or went quiet without a report (codex and claude
// exited to a bare PowerShell prompt, some workers sat nudged and silent), and each became a
// hand-written incident while its Kernel stalled. These specs pin the self-heal:
//   - `reconcile --dead-worker --settle-failed` settles a dead worker's attempt failed-no-report
//     when its effect evidence is bounded by the owned paths: lease released,
//     ONE retry queued as attempt+1 through the retry lineage; a repeat writes nothing;
//   - evidence outside the owned paths (an op risk hint) stays fenced for the Kernel;
//   - a worker quiet past its provider's timeout after a nudge is dead to the frontier, nudge
//     refuses it, and its recovery releases the Dispatch;
//   - the third failed-no-report death of one op raises ONE pattern incident;
//   - a live worker's path leases are renewed by status;
//   - the watchdog runs the recovery for every frontier deadWorkerJobs entry.

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const WF='wf-self-heal',JOB='job-self-heal',HANDLE='term-self-heal',OP='docs.author';
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const HOUR=3600*1000,MIN=60*1000;

let fixture;
test.before(()=>{fixture=createKernelDeadWorkerSelfHealFixture({api:API,fakeOrca:FAKE_ORCA,root:ROOT,wf:WF,jobId:JOB,handle:HANDLE,op:OP,hour:HOUR,minute:MIN});});
test.after(async()=>{await fixture?.close();});

// One reusable world: the migrated ledgers and committed Git baseline are copied back before every
// case, then only that case's worker state and timestamps are injected. No test sees prior state.
const world=async(t,fn,{op=OP,...options}={})=>fn(fixture.reset({...options,operation:op}));
const status=async run=>{const r=await run('status','--workflow',WF);assert.equal(r.status,0,r.stderr||r.stdout);return out(r);};

test('--settle-failed settles a dead worker with owned-path effects failed-no-report and queues one retry',t=>world(t,async({repoRoot,run,job,jobs,leases,events,orcaState})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  assert.deepEqual((await status(run)).frontier.deadWorkerJobs,[JOB]);
  const r=await run('reconcile','--job',JOB,'--dead-worker','--settle-failed');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.deepEqual([body.recovery,body.status,body.reason,body.reportFiled,body.effectState],['settled-failed','failed','failed-no-report',false,'partial']);
  assert.ok(body.evidence.includes('dirty:docs/half-written.md'),JSON.stringify(body.evidence));
  const row=job();
  assert.equal(row.status,'failed');
  const result=JSON.parse(row.result_json);
  assert.deepEqual([result.verdict,result.reason,result.reportFiled,result.attemptConsumed],['fail','failed-no-report',false,true]);
  assert.equal(leases().length,0,'the lease is released');
  // One retry: the same op, records, owned paths, as attempt 2 through the retry lineage.
  const retry=jobs().find(j=>j.job_id!==JOB);
  assert.equal(body.retry.jobId,retry.job_id);
  assert.deepEqual([retry.status,retry.attempt,retry.op_id],['queued',2,OP]);
  const payload=JSON.parse(retry.payload_json);
  assert.deepEqual(payload.owned_paths,['docs/']);
  assert.deepEqual(payload.records,['docs/readme.md']);
  assert.equal(retry.retry_of,JOB);
  assert.equal(retry.retry_class,'business','a no-report death spends a business attempt');
  assert.equal(payload.retryReason.reason,'failed-no-report');
  const settled=events('op-settled').map(e=>JSON.parse(e.payload_json));
  assert.deepEqual([settled.length,settled[0].reason,settled[0].auto,settled[0].reportFiled],[1,'failed-no-report',true,false]);
  assert.equal(events('worker-failed-no-report').length,1);
  const after=await status(run);
  assert.deepEqual(after.frontier.deadWorkerJobs,[]);
  assert.ok(after.frontier.queued.some(q=>q.jobId===retry.job_id),'the retry waits on the Kernel to route it');
  // A repeat writes nothing and names the retry.
  const again=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([again.alreadyRecovered,again.retry.jobId],[true,retry.job_id]);
  assert.equal(jobs().length,2);
  assert.equal(events('worker-failed-no-report').length,1);
}));

// An attempt (a8, order-input-contract) died, and its auto-retry chained to a7, a queued
// dead-code-proof job of the same op enqueued in between, so the lineage crossed units and read as
// a false retry-loop. The dead attempt itself is the retry's predecessor.
test('a no-report retry chains to the dead attempt, never to a later unrelated job of the same op',t=>world(t,async({ledger,repoRoot,run,jobs})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const other='job-self-heal-other',at=Date.now();
  seedWorkflow(ledger,{id:WF,jobs:[{jobId:other,opId:OP,status:'queued',createdAt:at,
    payload:{opId:OP,title:'another unit',records:['notes/other.md'],owned_paths:['notes/']}}]});
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'settled-failed');
  const retry=jobs().find(j=>j.job_id===body.retry.jobId);
  const payload=JSON.parse(retry.payload_json);
  assert.equal(retry.attempt,2,'the unrelated unit does not advance this unit\'s try number');
  assert.equal(retry.retry_of,JOB);
}));

test('without --settle-failed the recovery keeps its fence; --settle-failed later settles that fence',t=>world(t,async({repoRoot,run,job,jobs})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  assert.equal(out(await run('reconcile','--job',JOB,'--dead-worker')).recovery,'fenced');
  assert.equal(job().status,'effect_unknown');
  const r=await run('reconcile','--job',JOB,'--dead-worker','--settle-failed');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(out(r).recovery,'settled-failed');
  assert.equal(job().status,'failed');
  assert.equal(jobs().filter(j=>j.status==='queued').length,1);
}));

test('a provably no-effect death is still the same attempt requeued, not a spent attempt',t=>world(t,async({run,job,jobs})=>{
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'requeued');
  assert.deepEqual([job().status,job().attempt,jobs().length],['queued',1,1]);
}));

test('evidence the owned paths cannot bound stays fenced for the Kernel',t=>world(t,async({run,job,jobs})=>{
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'fenced');
  assert.ok(body.evidence.some(e=>e.startsWith('risk:')),JSON.stringify(body.evidence));
  assert.deepEqual([job().status,jobs().length],['effect_unknown',1]);
},{op:'release.deliver'}));

test('the third no-report death of one op raises one pattern incident, and only one',t=>world(t,async({ledger,repoRoot,run,incidents})=>{
  for(const id of ['job-earlier-1','job-earlier-2'])
    ledger.appendEvent({workflowId:WF,entityType:'job',entityId:id,kind:'worker-failed-no-report',payload:{opId:OP,attempt:1,liveness:'agent-exited'}});
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([body.pattern.raised,body.pattern.count],[true,3]);
  const open=incidents();
  assert.equal(open.length,1);
  assert.match(open[0].last_progress,/^\[worker-died-no-report-pattern\] docs\.author: 3 attempts ended with no report/);
  assert.equal(open[0].op_id,OP);
  // A fourth death while it is open adds no second incident.
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:'job-earlier-3',kind:'worker-failed-no-report',payload:{opId:OP,attempt:1}});
  const second=ledger.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=? AND status=?').get(WF,'queued').job_id;
  for(const to of ['ready','leased','running'])ledger.write.setJobStatus({jobId:second,to,reason:'test retry',...(to==='running'?{workerId:HANDLE}:{})});
  // The retry's own effect: a file the first attempt left, written before this job existed, is debris the
  // retry found (owned-path-effects.mjs ownedPathEffects preexisting), never this attempt's evidence.
  fs.writeFileSync(path.join(repoRoot,'docs','half-written-again.md'),'partial\n');
  const again=out(await run('reconcile','--job',second,'--dead-worker','--settle-failed'));
  assert.equal(again.recovery,'settled-failed',JSON.stringify(again));
  assert.deepEqual([again.pattern.raised,again.pattern.existing],[false,true]);
  assert.equal(incidents().length,1);
}));

// Orca restarts wiped every terminal on the host - every Kernel
// and every worker answered terminal_handle_stale in the same second. Each worker with partial effects
// settled failed-no-report as a spent business attempt, demoted its pool for the retry, and three of
// them raised [worker-died-no-report-pattern]. A worker gone together with its workflow's Kernel terminal died
// of the host: the retry continues the tree, spends no business attempt, blames no pool, counts in no
// pattern.
const KERNEL_HANDLE='term-kernel-self-heal';
const seatKernel=(ledger,handle=KERNEL_HANDLE)=>{
  ledger.write.bindKernelJob({workflowId:WF,workerId:handle,payload:{hierarchy:{role:'kernel'}}});
};
const WIPED={stale:true};
test('a worker gone with its Kernel terminal in a host terminal wipe settles as the environment: no business attempt, no pool demoted, no pattern',t=>world(t,async({ledger,repoRoot,run,job,jobs,events,incidents,writeOrca})=>{
  seatKernel(ledger);
  writeOrca(s=>{s.terminals[KERNEL_HANDLE]={handle:KERNEL_HANDLE,stale:true};});
  for(const id of ['job-earlier-1','job-earlier-2'])
    ledger.appendEvent({workflowId:WF,entityType:'job',entityId:id,kind:'worker-failed-no-report',payload:{opId:OP,attempt:1,liveness:'gone'}});
  ledger.db.prepare("UPDATE jobs SET payload_json=json_set(payload_json,'$.model','devin-agent') WHERE job_id=?").run(JOB);
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  assert.deepEqual((await status(run)).frontier.deadWorkerJobs,[JOB]);
  const r=await run('reconcile','--job',JOB,'--dead-worker','--settle-failed');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.deepEqual([body.recovery,body.liveness,body.effectState,body.attemptConsumed,body.environment],['settled-failed','gone','partial',false,'host-terminal-wipe'],JSON.stringify(body));
  assert.deepEqual([body.hostWipe.proof,body.hostWipe.kernelTerminal,body.hostWipe.errorCode],['kernel-terminal-gone',KERNEL_HANDLE,'terminal_handle_stale']);
  const result=JSON.parse(job().result_json);
  assert.deepEqual([result.reason,result.attemptConsumed,result.retryClass,result.environment],['failed-no-report',false,'environment','host-terminal-wipe']);
  const retry=jobs().find(j=>j.job_id!==JOB&&j.kind==='op');
  const died=events('worker-failed-no-report').map(e=>JSON.parse(e.payload_json)).find(p=>p.dispatchId);
  assert.deepEqual([died.environment,died.attemptConsumed],['host-terminal-wipe',false]);
  assert.equal(body.pattern.raised,false,'the host death is no pattern of the op');
  assert.equal(incidents().length,0);
  const {lineageRouteAdjust}=await import('../../scripts/kernel/lineage-route.mjs');
  const adjust=lineageRouteAdjust(ledger.db,retry);
  assert.deepEqual([adjust.attempts[0].cause,adjust.attempts[0].attributable,adjust.demote,adjust.exclude],['host-terminal-wipe',false,[],[]]);
},{terminal:WIPED}));

test('a Kernel seat already cleared for a gone terminal since the dispatch is the same host wipe',t=>world(t,async({ledger,repoRoot,run,job,writeOrca})=>{
  seatKernel(ledger,'term-kernel-replacement');
  writeOrca(s=>{s.terminals['term-kernel-replacement']={handle:'term-kernel-replacement',connected:true,writable:true};});
  ledger.appendEvent({workflowId:WF,entityType:'workflow',entityId:WF,kind:'kernel-stale-cleared',payload:{terminal:KERNEL_HANDLE,reason:'terminal_handle_stale'}});
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([body.environment,body.hostWipe?.proof,body.hostWipe?.kernelTerminal],['host-terminal-wipe','kernel-stale-cleared',KERNEL_HANDLE],JSON.stringify(body));
  assert.equal(JSON.parse(job().result_json).attemptConsumed,false);
},{terminal:WIPED}));

test('a worker gone while its Kernel terminal lives is its own death: a spent business attempt',t=>world(t,async({ledger,repoRoot,run,job,jobs,writeOrca})=>{
  seatKernel(ledger);
  writeOrca(s=>{s.terminals[KERNEL_HANDLE]={handle:KERNEL_HANDLE,connected:true,writable:true};});
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.deepEqual([body.recovery,body.liveness,body.attemptConsumed,body.environment],['settled-failed','gone',true,undefined],JSON.stringify(body));
  const result=JSON.parse(job().result_json);
  assert.deepEqual([result.attemptConsumed,result.retryClass],[true,undefined]);
  const lineage=JSON.parse(jobs().find(j=>j.job_id!==JOB&&j.kind==='op').payload_json).retry;
},{terminal:WIPED}));

// A worker nudged once, then silent at its prompt with a lease and no report.
const IDLE={connected:true,writable:true,screen:['• Report pending.','› Ask Codex to do anything','  gpt-6.1-sol high · 62% left'].join('\n'),lastOutputAt:Date.now()-45*MIN};
test('a worker quiet past its provider timeout after a nudge is dead: nudge refuses, the recovery requeues it',t=>world(t,async({ledger,repoRoot,run,runFailure,job,orcaState})=>{
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-worker-nudged',payload:{opId:OP,attempt:1},createdAt:Date.now()-30*MIN});
  const worker=(await status(run)).workers.find(w=>w.jobId===JOB);
  assert.equal(worker.liveness,'quiet');
  assert.ok(worker.quiet.quietMs>0);
  assert.deepEqual((await status(run)).frontier.deadWorkerJobs,[JOB]);
  const nudge=runFailure('nudge','--job',JOB);
  assert.equal(nudge.status,1);
  assert.equal(out(nudge).reason,'worker-quiet');
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'settled-failed',JSON.stringify(body));
  assert.equal(body.liveness,'quiet');
  assert.equal(job().status,'failed');
},{terminal:IDLE,dispatchedAgo:HOUR}));

test('a worker nudged a moment ago, or never nudged, is not quiet',t=>world(t,async({ledger,run})=>{
  assert.equal((await status(run)).workers.find(w=>w.jobId===JOB).liveness,'turn-idle','never nudged: the Kernel nudges first');
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:JOB,kind:'op-worker-nudged',payload:{opId:OP,attempt:1},createdAt:Date.now()-2*MIN});
  assert.equal((await status(run)).workers.find(w=>w.jobId===JOB).liveness,'turn-idle','nudged 2 minutes ago');
},{terminal:IDLE,dispatchedAgo:HOUR}));

// A worker sat 34+ minutes on one shell command with no output - its moving
// spinner read as active and nothing flagged it, while status/driver-loop pointed the Kernel at a
// nudge cmdNudge has no branch for (it refused worker-state-unknown) and reconcile --dead-worker
// refused worker-alive. A wedged worker is dead to its contract - the turn can never file the
// report - but it is not a dead-liveness state: it recovers only through
// `reconcile --dead-worker --settle-failed`, which settles it like the quiet path.
const WEDGED={connected:true,writable:true,command:'codex',screen:['• Working (45m 12s • esc to interrupt)',' │ No output yet (still running)','› Ask Codex to do anything'].join('\n')};
test('a wedged worker: nudge refuses worker-wedged, plain --dead-worker refuses, --settle-failed settles failed',t=>world(t,async({repoRoot,run,runFailure,job,jobs,events,orcaState})=>{
  assert.equal((await status(run)).workers.find(w=>w.jobId===JOB).liveness,'wedged');
  assert.deepEqual((await status(run)).frontier.wedgedJobs,[JOB]);
  assert.deepEqual((await status(run)).frontier.deadWorkerJobs,[],'wedged is not a dead-liveness state');
  const nudge=runFailure('nudge','--job',JOB);
  assert.equal(nudge.status,1);
  assert.equal(out(nudge).reason,'worker-wedged');
  assert.equal(orcaState().sends??0,0,'nothing was typed');
  assert.equal(events('op-worker-nudged').length,0);
  const plain=runFailure('reconcile','--job',JOB,'--dead-worker');
  assert.equal(plain.status,1);
  assert.equal(out(plain).reason,'worker-wedged','the refusal names the settle-failed route');
  assert.equal(job().status,'running','nothing written');
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(await run('reconcile','--job',JOB,'--dead-worker','--settle-failed'));
  assert.equal(body.recovery,'settled-failed',JSON.stringify(body));
  assert.equal(body.liveness,'wedged');
  assert.equal(job().status,'failed');
  assert.equal(jobs().filter(j=>j.status==='queued').length,1,'one retry queued');
  const dead=events('worker-failed-no-report').map(e=>JSON.parse(e.payload_json));
  assert.equal(dead[0]?.liveness,'wedged');
},{terminal:WEDGED,dispatchedAgo:HOUR,payloadExtra:{provider:'codex'}}));

test('status renews the path lease of a live running worker and never the lease of a dead one',async t=>{
  await world(t,async({run,leases})=>{
    const body=await status(run);
    assert.equal(body.activeLeases.length,1,'the expiring lease is listed');
    assert.ok(leases()[0].expires_at>Date.now()+15*MIN,'renewed to a full dispatch TTL');
  },{terminal:{connected:true,writable:true,screen:'• Working (40m 3s • esc to interrupt)\n› Ask Codex to do anything'},leaseExpiresIn:2*MIN});
  await world(t,async({run,leases})=>{
    await status(run);
    assert.ok(leases()[0].expires_at<Date.now()+3*MIN,'a disconnected worker keeps its old expiry');
  },{leaseExpiresIn:2*MIN});
});
