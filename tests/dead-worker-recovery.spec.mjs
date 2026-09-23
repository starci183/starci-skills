import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// A host shutdown kills every Orca terminal while the ledger still says an op
// is running. These specs pin the saga recovery:
//   - a running job whose exact terminal is disconnected, or whose handle a
//     live Orca no longer knows (terminal_handle_stale), makes the frontier
//     'worker-dead' and actionable - it no longer reads a silent 'engaged';
//   - api reconcile --dead-worker returns a provably no-effect attempt to
//     queued at the SAME attempt (no business attempt spent), releasing leases;
//   - a filed report takes the ordinary consume/check/settle route, unwritten;
//   - an uncommitted change or a commit on the owned paths fences it
//     effect_unknown with that evidence, leases held;
//   - a live worker is never recovered.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WF='wf-dead-worker',JOB='job-dead-worker',HANDLE='term-dead-worker',OP='docs.author';
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const HOUR=3600*1000;

const git=(cwd,args,env={})=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,
    GIT_AUTHOR_NAME:'spec',GIT_AUTHOR_EMAIL:'spec@example.invalid',GIT_COMMITTER_NAME:'spec',GIT_COMMITTER_EMAIL:'spec@example.invalid',...env}});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// One world: a git repo that owns the ledger, docs/ committed an hour before
// the dispatch, the fake Orca with the op's terminal record in `terminal`
// ({connected:false} dead, {stale:true} unknown to Orca, null live).
const world=(t,fn,{terminal={connected:false,writable:false}}={})=>withLedger(t,({root,repoRoot,machineHome,ledger})=>{
  git(repoRoot,['init','-q']);
  fs.writeFileSync(path.join(repoRoot,'.gitignore'),'.starciwork/\n');
  fs.mkdirSync(path.join(repoRoot,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repoRoot,'docs','readme.md'),'# docs\n');
  const past=new Date(Date.now()-HOUR).toISOString();
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
  const dispatchedAt=Date.now()-60000;
  seedWorkflow(ledger,{id:WF,state:{phase:'running'},
    jobs:[{jobId:JOB,opId:OP,kind:'op',status:'running',attempt:1,workerId:HANDLE,leaseToken:'tok-dead-worker',createdAt:dispatchedAt,
      payload:{opId:OP,owned_paths:['docs/'],orca:{dispatchId:HANDLE,agentTerminalHandle:HANDLE},
        hierarchy:{runtime:{host:'orca',agent:'codex',dispatchId:HANDLE,terminalHandle:HANDLE}}}}],
    leases:[{resourceKey:'path:docs/',jobId:JOB,expiresAt:Date.now()+HOUR}]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,OP,1,HANDLE,'# dead worker contract','{}',dispatchedAt);
  const job=()=>ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB);
  const leases=()=>ledger.db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(JOB).n;
  const events=kind=>ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND entity_id=? AND kind=?').all(WF,JOB,kind);
  const orcaState=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
  return fn({repoRoot,ledger,run,job,leases,events,orcaState});
});

const status=run=>{const r=run('status','--workflow',WF);assert.equal(r.status,0,r.stderr||r.stdout);return out(r);};

test('a running job whose terminal disconnected makes the frontier worker-dead and actionable',t=>world(t,({run})=>{
  const body=status(run);
  assert.equal(body.frontier.state,'worker-dead');
  assert.equal(body.frontier.actionable,true);
  assert.deepEqual(body.frontier.deadWorkerJobs,[JOB]);
  assert.equal(body.workers.find(w=>w.jobId===JOB)?.liveness,'disconnected');
  assert.match(body.frontier.reason,/reconcile --job <id> --dead-worker/);
}));

test('a handle Orca answers terminal_handle_stale for (after a reboot) reads gone and is worker-dead',t=>world(t,({run})=>{
  const body=status(run);
  const worker=body.workers.find(w=>w.jobId===JOB);
  assert.equal(worker?.liveness,'gone');
  assert.equal(worker?.errorCode,'terminal_handle_stale');
  assert.equal(body.frontier.state,'worker-dead');
  assert.equal(body.frontier.actionable,true);
},{terminal:{stale:true}}));

test('a live worker keeps the frontier engaged and --dead-worker refuses it without writing',t=>world(t,({run,job,leases})=>{
  const body=status(run);
  assert.notEqual(body.frontier.state,'worker-dead');
  assert.deepEqual(body.frontier.deadWorkerJobs,[]);
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,1);
  assert.equal(out(r)?.reason,'worker-alive');
  assert.equal(job().status,'running');
  assert.equal(leases(),1);
},{terminal:null}));

test('a dead worker with no effect returns to queued at the same attempt, leases released, no business attempt spent',t=>world(t,({run,job,leases,events})=>{
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body.recovery,'requeued');
  assert.equal(body.attemptConsumed,false);
  assert.equal(body.effectState,'none');
  const row=job();
  assert.equal(row.status,'queued');
  assert.equal(row.attempt,1,'same attempt');
  assert.equal(row.worker_id,null);
  assert.equal(leases(),0);
  const payload=JSON.parse(row.payload_json);
  assert.equal(payload.orca?.agentTerminalHandle,undefined,'the dead terminal binding is cleared');
  assert.equal(payload.hierarchy.runtime.terminalHandle,undefined);
  assert.equal(payload.deadWorkers.length,1);
  assert.equal(payload.deadWorkers[0].recovery,'requeued');
  const result=JSON.parse(row.result_json);
  assert.equal(result.reason,'dead-worker-requeued');
  assert.equal(result.proof.paths.provable,true);
  assert.equal(events('dead-worker-requeued').length,1);
  const after=status(run);
  assert.notEqual(after.frontier.state,'worker-dead');
  assert.equal(after.frontier.readyOperations>0||after.frontier.queued.some(q=>q.jobId===JOB),true);
  const again=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(again.status,0);
  assert.equal(out(again).alreadyRecovered,true);
  assert.equal(events('dead-worker-requeued').length,1,'idempotent');
}));

test('a dead worker that filed a report goes the consume/check/settle route and nothing is written',t=>world(t,({run,ledger,job,leases,events})=>{
  ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,HANDLE,OP,1,'done','{"outcome":"done"}',Date.now());
  const body=status(run);
  assert.equal(body.frontier.state,'transition-ready','the report outranks the dead worker');
  assert.deepEqual(body.frontier.deadWorkerJobs,[],'a job with a filed report is not dead-worker work');
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(out(r).route,'settle');
  assert.equal(out(r).report.outcome,'done');
  assert.equal(job().status,'running');
  assert.equal(leases(),1);
  assert.equal(events('dead-worker-requeued').length+events('dead-worker-fenced').length,0);
}));

test('an uncommitted change on the owned paths fences the job effect_unknown with the evidence, leases held',t=>world(t,({repoRoot,run,job,leases,events})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body.recovery,'fenced');
  assert.equal(body.effectState,'partial');
  assert.ok(body.evidence.includes('dirty:docs/half-written.md'),JSON.stringify(body.evidence));
  assert.equal(job().status,'effect_unknown');
  assert.equal(job().attempt,1);
  assert.equal(leases(),1,'the fence keeps the owned-path lease');
  assert.equal(events('dead-worker-fenced').length,1);
  const plain=run('reconcile','--job',JOB);
  assert.equal(plain.status,1);
  assert.match(plain.stderr,/dead-worker-fenced/);
  assert.equal(status(run).frontier.actionable,true,'a fenced job stays the Kernel\'s to settle');
  const settled=run('settle','--job',JOB,'--verdict','fail');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.equal(job().status,'failed','the Kernel settles the fenced attempt; a retry is a new attempt');
  assert.equal(leases(),0);
}));

test('a commit on the owned paths since dispatch fences the job even with a clean tree',t=>world(t,({repoRoot,run,job})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','landed.md'),'landed\n');
  git(repoRoot,['add','-A']);
  git(repoRoot,['commit','-q','-m','worker commit']);
  const sha=git(repoRoot,['rev-parse','HEAD']);
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(out(r).recovery,'fenced');
  assert.ok(out(r).evidence.includes(`commit:${sha}`),JSON.stringify(out(r).evidence));
  assert.equal(job().status,'effect_unknown');
}));

// 2026-09-24: reconcile --dead-worker recovered agent-exited workers and left each one's shell open - a
// stray PowerShell tab per dead op (mia-mia term_0982b445). The recovery now closes that terminal with its
// tab, but only on fresh proof: disconnected, or a frame that ends in a bare shell prompt.
// Captured 2026-09-24 from term_0982b445 (mia-mia-backend): a Codex op whose agent exited mid-turn.
const DEAD_CODEX=['','• Ran node \'D:\\Repositories\\starci-academy-backend\\.claude\\bin\\starci.mjs\' validate \'.starciwork\' --json','  └ {',
  '      "schema": "starci/work-validate-report@1",','    … +29 lines (ctrl + t to view transcript)','      }',
  '    }•ng1 runing · /ps to view · /stop to close ng g •g g     W W · Running hook W W Wo Wo Wo','',
  '    }Wo Wo Wor6 Wor Wor or Work Work Work Worki WorkiWorkiWorki · Running hookWokiWorkinWorkin•Workinorkingorking',
  'PS D:\\Repositories\\mia-mia-backend>'].join('\n');
const EXITED={connected:true,writable:true,sent:true,command:'codex --model gpt-6-sol',screen:DEAD_CODEX};
const closeEvents=events=>events('dead-worker-terminal-closed').map(r=>JSON.parse(r.payload_json));

test('an exited worker is requeued and its bare-shell terminal is closed with its tab, after the recovery',t=>world(t,({run,job,events,orcaState})=>{
  assert.equal(status(run).workers.find(w=>w.jobId===JOB)?.liveness,'agent-exited');
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body.recovery,'requeued');
  assert.deepEqual([body.terminalClosed.handle,body.terminalClosed.closed,body.terminalClosed.proof,body.terminalClosed.shellPrompt],
    [HANDLE,true,'shell-prompt','PS D:\\Repositories\\mia-mia-backend>']);
  assert.deepEqual(orcaState().closedTabs,[HANDLE],'closed with its tab, so Orca never restores the shell');
  assert.equal(orcaState().terminals[HANDLE].closed,true);
  assert.equal(job().status,'queued','the close follows the requeue');
  const recorded=closeEvents(events);
  assert.equal(recorded.length,1);
  assert.deepEqual([recorded[0].handle,recorded[0].closed,recorded[0].proof,recorded[0].attempt],[HANDLE,true,'shell-prompt',1]);
  const again=out(run('reconcile','--job',JOB,'--dead-worker'));
  assert.equal(again.alreadyRecovered,true);
  assert.equal(again.terminalClosed.alreadyClosed,true);
  assert.equal(closeEvents(events).length,1,'a repeat closes nothing twice');
  assert.equal(orcaState().closed.length,1);
},{terminal:EXITED}));

test('a fenced exited worker has its shell closed too; the evidence is in git, not in the shell',t=>world(t,({repoRoot,run,job,orcaState})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const body=out(run('reconcile','--job',JOB,'--dead-worker'));
  assert.equal(body.recovery,'fenced');
  assert.equal(job().status,'effect_unknown');
  assert.deepEqual([body.terminalClosed.closed,body.terminalClosed.proof],[true,'shell-prompt']);
  assert.deepEqual(orcaState().closedTabs,[HANDLE]);
},{terminal:EXITED}));

test('a disconnected worker terminal is closed after the requeue',t=>world(t,({run,events,orcaState})=>{
  const body=out(run('reconcile','--job',JOB,'--dead-worker'));
  assert.deepEqual([body.recovery,body.terminalClosed.closed,body.terminalClosed.proof],['requeued',true,'disconnected']);
  assert.deepEqual(orcaState().closed,[HANDLE]);
  assert.equal(closeEvents(events).length,1);
}));

test('a gone worker handle is requeued with nothing closed and no close event',t=>world(t,({run,events,orcaState})=>{
  const body=out(run('reconcile','--job',JOB,'--dead-worker'));
  assert.deepEqual([body.recovery,body.terminalClosed.closed,body.terminalClosed.proof],['requeued',false,'gone']);
  assert.equal((orcaState().closed??[]).length,0);
  assert.equal(closeEvents(events).length,0);
},{terminal:{stale:true}}));

test('a job requeued before the close existed has its recorded shell closed by the next --dead-worker',t=>world(t,({ledger,run,job,events,orcaState})=>{
  // The pre-fix outcome: requeued, bindings cleared, the dead terminal only in payload.deadWorkers, its shell still open.
  const payload=JSON.parse(job().payload_json);
  delete payload.orca;delete payload.hierarchy.runtime.terminalHandle;
  payload.deadWorkers=[{attempt:1,dispatchId:HANDLE,terminal:HANDLE,liveness:'agent-exited',recovery:'requeued',at:Date.now()}];
  ledger.db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,payload_json=?,result_json=? WHERE job_id=?")
    .run(JSON.stringify(payload),JSON.stringify({reason:'dead-worker-requeued'}),JOB);
  const body=out(run('reconcile','--job',JOB,'--dead-worker'));
  assert.equal(body.alreadyRecovered,true);
  assert.deepEqual([body.terminalClosed.handle,body.terminalClosed.closed,body.terminalClosed.proof],[HANDLE,true,'shell-prompt']);
  assert.deepEqual(orcaState().closedTabs,[HANDLE]);
  assert.equal(closeEvents(events).length,1);
},{terminal:EXITED}));

test('closeExitedTerminal closes only on proof: a bare shell or a disconnected terminal, never an agent screen or an outage',async()=>{
  const {closeExitedTerminal}=await import('../scripts/kernel/close-op-terminal.mjs');
  const closes=[];const close=h=>{closes.push(h);return {ok:true};};
  const up={ok:true,connected:true,writable:true};
  const probe=(shown,screen)=>closeExitedTerminal('t1',{show:()=>shown,read:()=>screen==null?{ok:false}:{ok:true,screen},close});
  let r=probe(up,DEAD_CODEX);
  assert.deepEqual([r.closed,r.proof,r.shellPrompt],[true,'shell-prompt','PS D:\\Repositories\\mia-mia-backend>']);
  r=probe({ok:true,connected:false,writable:false},null);
  assert.deepEqual([r.closed,r.proof],[true,'disconnected']);
  assert.equal(closes.length,2);
  closes.length=0;
  const live=['• Ran git status','  └ PS D:\\x> git status','› Ask Codex to do anything','  gpt-6-sol high · 70% left · ~\\x'].join('\n');
  r=probe(up,live);assert.deepEqual([r.closed,r.proof,r.reason],[false,null,'agent-screen']);
  r=probe(up,null);assert.deepEqual([r.closed,r.reason],[false,'unreadable']);
  r=probe({ok:false,hostUnavailable:true,errorCode:'runtime_unavailable',error:'Start the Orca app first.'});
  assert.deepEqual([r.closed,r.proof,r.reason],[false,null,'host-unavailable']);
  r=probe({ok:false,errorCode:'terminal_handle_stale'});assert.deepEqual([r.closed,r.proof],[false,'gone']);
  r=probe({ok:false,errorCode:'runtime_error',error:'odd'});assert.deepEqual([r.closed,r.reason],[false,'unverified']);
  assert.deepEqual(closes,[],'nothing closed without proof');
  r=closeExitedTerminal('t1',{show:()=>up,read:()=>({ok:true,screen:DEAD_CODEX}),close:()=>({ok:false,error:'terminal_close_refused'})});
  assert.deepEqual([r.closed,r.proof,r.error],[false,'shell-prompt','terminal_close_refused']);
});
