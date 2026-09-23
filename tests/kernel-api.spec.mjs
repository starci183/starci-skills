import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
// api.mjs surface under test:
//   survey|status|hierarchy|plan|enqueue|dispatch|settle|incident|finish
//   --repo <path> --workflow <id> [--job <id>] [--kind <k>] [--op <id>]
//   [--verdict pass|fail] [--report <file>] --json
// wrapping kernel/ledger-db.mjs tables (workflows, goals, inbox, jobs,
// signals, incidents, events).
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
/** The same call with an owner-config root: STARCI_OWNER_ROOT is the one seam engine/config.mjs reads config.yaml through. */
const runApiAsOwner=(ownerRoot,...args)=>spawnSync(process.execPath,[API,...args],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,STARCI_OWNER_ROOT:ownerRoot}});
/** A temp owner root holding a valid config.yaml — the shipped example with `patch` merged over it. */
const ownerConfig=(t,patch)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const example=path.join(ROOT,'config.example.yaml');
  fs.copyFileSync(example,path.join(dir,'config.example.yaml'));
  const config=parseYaml(fs.readFileSync(example,'utf8'));
  fs.writeFileSync(path.join(dir,'config.yaml'),stringifyYaml({...config,...patch}));
  return dir;
};
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

/** One temp Work root per test: a plain directory; openLedger creates .starciwork/runtime.sqlite on demand. */
const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-'));dirs.push(dir);return dir;}};
};
/** Seed rows through the ledger API, then close so the spawned CLI never shares the handle. */
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const json=v=>JSON.stringify(v??null);

/** A workflow with a goal revision and a pending inbox goal row — the shape define-goal.mjs writes. */
const seedGoal=(repo,workflowId)=>{
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId,title:'k7 api smoke'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId,0,'k7goal','# goal',json({derivedFrom:'k7-test'}),at);
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?)")
      .run(workflowId,'goal',workflowId,json({prompt:'k7'}),at);
  });
};

test('survey on an empty workflow exits 0 with a sane empty result',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-empty';
  seed(repo,ledger=>ledger.ensureWorkflow({workflowId:wf,title:'empty'}));
  const r=runApi('survey','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body&&typeof body==='object',`survey --json should print a JSON object, got: ${r.stdout}`);
  // Nothing exists yet — whatever summary shape the CLI chose, it must not invent rows.
  for(const key of ['jobs','events','inbox','incidents','signals'])
    if(Array.isArray(body[key]))assert.equal(body[key].length,0,`empty workflow but survey.${key} is non-empty`);
});

test('enqueue writes a queued job row the ledger can see',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-enqueue';
  seedGoal(repo,wf);
  const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/',
    '--records','scope.workspace-canonicalization,scope.workspace-canonicalization',
    '--cut-id','consumer-migration','--cut-ordinal','1','--cut-total','3','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const jobs=read(repo,l=>l.db.prepare('SELECT * FROM jobs WHERE workflow_id=?').all(wf));
  assert.ok(jobs.length>=1,'enqueue produced no jobs row');
  const job=jobs.find(j=>j.op_id==='docs.author')??jobs[0];
  assert.equal(job.status,'queued',`fresh job must be queued, got ${job.status}`);
  const payload=JSON.parse(job.payload_json);
  assert.deepEqual(payload.records,['scope.workspace-canonicalization'],
    'enqueue must persist the explicit closed Work-record read set');
  assert.deepEqual(payload.goal_binding,{revision:0,identity:'k7goal'},
    'enqueue must freeze the approved goal binding for this durable attempt');
  assert.deepEqual(payload.cut,{id:'consumer-migration',ordinal:1,total:3},
    'enqueue must durably bind one bounded slice to its stable cut set');
});

test('status marks a running workflow with no operation frontier as orphaned-frontier',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-orphaned';
  seedGoal(repo,wf);
  seed(repo,ledger=>ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf));
  const r=runApi('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.deepEqual(out(r)?.frontier,{
    state:'orphaned-frontier',actionable:true,openOperations:0,readyOperations:0,staleOperations:[],unconsumedReports:0,nudgeReadyJobs:[],wedgedJobs:[],settleReadyJobs:[],askReserveDispatches:[],
    queued:[],queuedCauses:{},
    reason:'workflow is running but has no open operation and no unconsumed report; Kernel must derive/repair the next approved transition or finish',
  });
});

// driver-loop.yaml wait: the Kernel yields only on frontier.actionable:false.
// The field has to tell an engaged-and-waiting workflow from an engaged one
// that is still holding work nobody has picked up.
test('status: frontier.actionable is false only when nothing is waiting on the Kernel',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-actionable';
  seedGoal(repo,wf);
  seed(repo,ledger=>ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf));
  const frontier=()=>{
    const r=runApi('status','--repo',repo,'--workflow',wf,'--json');
    assert.equal(r.status,0,r.stderr||r.error?.message);
    return out(r).frontier;
  };

  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=read(repo,l=>l.db.prepare("SELECT job_id FROM jobs WHERE workflow_id=? AND op_id='docs.author'").get(wf)).job_id;
  const queued=frontier();
  assert.equal(queued.state,'engaged','a queued job is an open operation');
  assert.equal(queued.readyOperations,1);
  assert.equal(queued.actionable,true,'an undispatched job is work, not a wait — the Kernel must not yield on it');
  assert.match(queued.reason??'',/route\/dispatch or reconcile them before yielding/);

  // The same job, running and owing a report: this is the wait the yield rule
  // exists for.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId));
  const running=frontier();
  assert.equal(running.state,'engaged');
  assert.equal(running.readyOperations,0);
  assert.equal(running.actionable,false,'an engaged frontier with nothing ready is the one state that may yield');
  assert.equal(running.reason,null);

  // A fenced launch needs reconcile before anything else can move.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='effect_unknown' WHERE job_id=?").run(jobId));
  const fenced=frontier();
  assert.equal(fenced.readyOperations,1,'an effect_unknown launch is the Kernel’s to reconcile');
  assert.equal(fenced.actionable,true);

  // A settled workflow with nothing open is idle, and idle is the Kernel's
  // cue to plan the next leg or finish — never to yield.
  seed(repo,ledger=>{
    ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=?").run(jobId);
    ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(wf);
  });
  const idle=frontier();
  assert.equal(idle.state,'idle');
  assert.equal(idle.actionable,true);

  seed(repo,ledger=>ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf));
  assert.deepEqual([frontier().state,frontier().actionable],['finished',false],
    'a finished workflow is the other state with nothing to act on');
});

// A queued row is the dispatch candidate; frontier.queued says why each one has
// not moved, so the Kernel clears the named blocker instead of re-dispatching
// into the same refusal. Causes and their order: api.mjs QUEUED_BECAUSE.
test('status explains every queued job: ready, dependency, path-lease, pool-full, circuit-open, max-ops',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-queued-because';
  const owner=ownerConfig(t,{budgets:{maxOps:null,perOpMs:null,dailyTokens:null}});
  seedGoal(repo,wf);
  const statusOf=(root=owner)=>{
    const r=runApiAsOwner(root,'status','--repo',repo,'--workflow',wf,'--json');
    assert.equal(r.status,0,r.stderr||r.stdout);
    return out(r).frontier;
  };
  const because=(jobId,frontier)=>frontier.queued.find(item=>item.jobId===jobId);

  const enq=(op,paths)=>{
    const r=runApiAsOwner(owner,'enqueue','--repo',repo,'--workflow',wf,'--op',op,'--paths',paths,'--json');
    assert.equal(r.status,0,r.stderr);
    return out(r).job_id;
  };
  const first=enq('docs.author','docs/first');

  // Nothing blocks it: queued and dispatchable now.
  let frontier=statusOf();
  assert.deepEqual(because(first,frontier),{jobId:first,opId:'docs.author',attempt:1,queuedBecause:'ready',blockedBy:null,detail:null});
  assert.deepEqual(frontier.queuedCauses,{ready:1});
  assert.equal(frontier.readyOperations,1,'the existing frontier counters are untouched');

  // path-lease: a live capacity-1 path lease an overlapping sibling holds.
  const second=enq('docs.author','docs/first/nested');
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run('path:docs/first');
    ledger.db.prepare("UPDATE jobs SET status='leased', lease_token='tok-k7-first' WHERE job_id=?").run(first);
    const job=ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(first);
    ledger.db.prepare(`INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref)
      VALUES(?,?,?,?,?,?,?,1,?,?,NULL)`).run('path:docs/first',first,wf,job.op_id,job.attempt,job.generation,job.lease_token,at,at+600000);
  });
  frontier=statusOf();
  assert.equal(because(second,frontier).queuedBecause,'path-lease');
  assert.deepEqual(because(second,frontier).blockedBy,{path:'path:docs/first',job:first},'the blocking path AND the job that holds it');

  // max-ops outranks the path fence: the workflow ceiling refuses before leases
  // are ever consulted, so that is the cause the Kernel is told to clear.
  const capped=ownerConfig(t,{budgets:{maxOps:1,perOpMs:null,dailyTokens:null}});
  const atCeiling=because(second,statusOf(capped));
  assert.equal(atCeiling.queuedBecause,'max-ops');
  assert.deepEqual(atCeiling.blockedBy,{ceiling:1,ceilingSource:'budgets.maxOps',running:1});

  // Release the fence, then saturate the routed pool instead.
  seed(repo,ledger=>{
    ledger.db.prepare('DELETE FROM leases WHERE job_id=?').run(first);
    ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=?").run(first);
  });
  assert.equal(because(second,statusOf()).queuedBecause,'ready','a released fence and a settled sibling clear it');

  // pool-full: the persisted route decision names a pool whose declared
  // maxParallel is already committed fleet-wide, across every workflow.
  const pool='claude-agent',maxParallel=parseYaml(fs.readFileSync(path.join(ROOT,'modules','models','runtimes.yaml'),'utf8')).runtimes[pool].maxParallel;
  seed(repo,ledger=>{
    const payload=JSON.parse(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(second).payload_json);
    ledger.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(json({...payload,model:pool}),second);
    const at=Date.now();
    ledger.ensureWorkflow({workflowId:'wf-other',title:'another workflow on the same fleet'});
    for(let n=1;n<=maxParallel;n++) ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES(?,?,?,?,0,'op','op',?,'running',?,?)`).run(`occupant-${n}`,'wf-other','docs.author',n,json({opId:'docs.author',model:pool}),at,at);
  });
  const full=because(second,statusOf());
  assert.equal(full.queuedBecause,'pool-full');
  assert.deepEqual(full.blockedBy,{pool,running:maxParallel,maxParallel},'the blocking pool and its declared slot count, read from runtimes.yaml');

  // circuit-open outranks pool-full: a dead provider credential is not a wait.
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare(`INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('provider-health',?,NULL,NULL,?,?,?)`)
      .run('claude',json({schema:'starci/provider-health@1',provider:'claude',status:'unavailable',failureKind:'auth',failures:1,strikeLimit:1}),at,at+600000);
  });
  const open=because(second,statusOf());
  assert.equal(open.queuedBecause,'circuit-open');
  assert.deepEqual(open.blockedBy,{provider:'claude',pool},'the provider credential that is parked, and the pool that shares it');

  // An earlier approved leg that was never enqueued is not a wait: intake legs
  // often have no job, and a plan that moved past a leg does not re-block on it.
  seed(repo,ledger=>ledger.db.prepare('UPDATE goals SET json=? WHERE workflow_id=? AND revision=0')
    .run(json({opChain:{legs:[{op:'scope.define'},{op:'docs.author'}]}}),wf));
  assert.notEqual(because(second,statusOf()).queuedBecause,'dependency','a leg with no job holds nothing');

  // dependency outranks everything once the earlier leg has a job still queued
  // or in flight: no admission check can make this op dispatchable before it settles.
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES(?,?,?,?,0,'op','op',?,'queued',?,?)`).run('earlier-leg-job',wf,'scope.define',1,json({opId:'scope.define'}),at,at);
  });
  const dep=because(second,statusOf());
  assert.equal(dep.queuedBecause,'dependency');
  assert.deepEqual(dep.blockedBy,{op:'scope.define',job:'earlier-leg-job'},'the earlier leg and its pending job');
  assert.match(dep.detail,/precedes docs\.author in the approved order/);
});

// A live AUTH workflow parked its OAuth legs on a step only the owner can drive
// and wrote that in free prose; status still called the jobs ready, so the
// watchdog woke an idle Kernel that had nothing it could do.
test('an owner-gate incident holds the jobs it names until the Kernel resolves it',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-owner-gate';
  const owner=ownerConfig(t,{budgets:{maxOps:null,perOpMs:null,dailyTokens:null}});
  seedGoal(repo,wf);
  const api=(...args)=>runApiAsOwner(owner,...args,'--repo',repo,'--json');
  const enq=(op,paths)=>{const r=api('enqueue','--workflow',wf,'--op',op,'--paths',paths);assert.equal(r.status,0,r.stderr);return out(r).job_id;};
  const held=enq('integration.verify','docs/oauth-google');
  const free=enq('docs.author','docs/readme');
  const frontier=()=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr||r.stdout);return out(r).frontier;};
  const because=(jobId,fr)=>fr.queued.find(item=>item.jobId===jobId);

  const raised=api('incident','--workflow',wf,'--kind','owner-gate','--op','uat.assisted.verify',
    '--holds','uat.assisted.verify,integration.verify','--detail','the owner drives the assisted OAuth run');
  assert.equal(raised.status,0,raised.stderr||raised.stdout);
  const incidentId=out(raised).incidentId;
  assert.deepEqual(out(raised).holds,['uat.assisted.verify','integration.verify']);

  let fr=frontier();
  assert.equal(because(held,fr).queuedBecause,'owner-gate');
  assert.deepEqual(because(held,fr).blockedBy,{incident:incidentId});
  assert.equal(because(free,fr).queuedBecause,'ready','a job the gate does not name stays ready');
  assert.equal(fr.readyOperations,1);

  for(const verb of ['route','dispatch']){
    const refused=api(verb,'--job',held);
    assert.notEqual(refused.status,0,`${verb} refuses a held job before any pool or Orca call`);
    assert.equal(out(refused).reason,'owner-gate');
  }

  // with only held jobs queued, nothing is actionable and the watchdog stays quiet
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=?").run(free));
  fr=frontier();
  assert.equal(fr.actionable,false);
  assert.deepEqual(fr.queuedCauses,{'owner-gate':1});

  const resolved=api('incident','--workflow',wf,'--resolve',incidentId,'--detail','assisted run receipt landed');
  assert.equal(resolved.status,0,resolved.stderr||resolved.stdout);
  assert.equal(out(resolved).changed,true);
  fr=frontier();
  assert.equal(because(held,fr).queuedBecause,'ready');
  assert.equal(fr.actionable,true);
  assert.equal(out(api('incident','--workflow',wf,'--resolve',incidentId)).changed,false,'resolving twice is a no-op');
  const kinds=read(repo,ledger=>ledger.db.prepare("SELECT kind FROM events WHERE entity_type='incident' AND entity_id=? ORDER BY seq").all(incidentId).map(r=>r.kind));
  assert.deepEqual(kinds,['incident-raised','incident-resolved']);

  // without --holds the incident's own --op is held; any other kind holds nothing
  const plain=out(api('incident','--workflow',wf,'--kind','owner-gate','--op','integration.verify','--detail','consent'));
  assert.equal(because(held,frontier()).queuedBecause,'owner-gate');
  api('incident','--workflow',wf,'--resolve',plain.incidentId);
  api('incident','--workflow',wf,'--kind','infra-provider','--op','integration.verify','--detail','not a gate');
  assert.equal(because(held,frontier()).queuedBecause,'ready');
  assert.notEqual(api('incident','--workflow',wf,'--resolve','inc-nope').status,0,'an unknown incident is refused');
});

// Live Modules ran three provision.ask jobs at once (Chatbot, Shell, Accounting);
// status listed only the op's latest attempt, so the kernel never saw the
// answers to the other two and kept waiting on them.
test('status lists every concurrent owner wait of one op by subject, and a later same-subject job replaces one',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-owner-waits';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    const job=(id,attempt,subject,status='failed',verdict='awaiting-owner')=>ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,result_json,created_at,updated_at)
      VALUES(?,?,?,?,0,'op','op',?,?,?,?,?)`).run(id,wf,'provision.ask',attempt,json({opId:'provision.ask',params:{subject}}),status,json({verdict}),at+attempt,at+attempt);
    job('ask-chatbot',2,'Chatbot decisions');
    job('ask-shell-old',3,'Shell auth');
    job('ask-accounting',4,'Accounting decisions');
    job('ask-shell-new',5,'Shell auth','queued',null);
  });
  const r=runApi('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual(out(r).awaitingOwner.map(a=>a.jobId).sort(),['ask-accounting','ask-chatbot'],
    'every subject still waiting is listed; the re-enqueued Shell ask replaced its older attempt');
});

// A Collab kernel held seven record-level backend.implement jobs behind a
// composition job in its head; status called them ready and the watchdog woke
// the idle kernel every five minutes for nothing.
test('enqueue --after and a cut seam hold siblings as dependency until the prior job succeeds',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-after';
  const owner=ownerConfig(t,{budgets:{maxOps:null,perOpMs:null,dailyTokens:null}});
  seedGoal(repo,wf);
  const api=(...args)=>runApiAsOwner(owner,...args,'--repo',repo,'--json');
  const enq=(...extra)=>{const r=api('enqueue','--workflow',wf,...extra);assert.equal(r.status,0,r.stderr||r.stdout);return out(r).job_id;};
  const because=(jobId)=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr);return out(r).frontier.queued.find(q=>q.jobId===jobId);};
  const composition=enq('--op','docs.author','--paths','docs/composition');
  const member=enq('--op','docs.author','--paths','docs/membership','--after',composition);
  assert.equal(because(member).queuedBecause,'dependency');
  assert.deepEqual(because(member).blockedBy,{op:'docs.author',job:composition});
  assert.equal(because(composition).queuedBecause,'ready','the job it waits on is itself ready');
  assert.notEqual(api('enqueue','--workflow',wf,'--op','docs.author','--paths','docs/x','--after','op-nope').status,0,'an unknown --after job is refused');

  const seam=enq('--op','docs.author','--paths','docs/cut-1','--cut-id','c1','--cut-ordinal','1','--cut-total','2');
  const second=enq('--op','docs.author','--paths','docs/cut-2','--cut-id','c1','--cut-ordinal','2','--cut-total','2');
  assert.equal(because(second).queuedBecause,'dependency');
  assert.match(because(second).detail,/seam/);

  // A StarCi Next and a MiaMia workflow stalled behind a seam / --after job
  // that had settled failed: status read engaged and nothing woke the Kernel.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='failed',result_json=? WHERE job_id IN (?,?)").run(JSON.stringify({verdict:'blocked'}),composition,seam));
  const frontierNow=()=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr);return out(r).frontier;};
  let frontier=frontierNow();
  assert.equal(frontier.queued.find(q=>q.jobId===member).queuedBecause,'dependency-failed');
  assert.equal(frontier.queued.find(q=>q.jobId===second).queuedBecause,'dependency-failed');
  assert.match(frontier.queued.find(q=>q.jobId===second).detail,/seam .* is failed.*will not succeed on its own/);
  assert.equal(frontier.actionable,true,'a dead dependency is the Kernel\'s to move, so the watchdog wakes it');
  // A retried seam (a later ordinal-1 attempt) is a live wait again.
  enq('--op','docs.author','--paths','docs/cut-1b','--cut-id','c1','--cut-ordinal','1','--cut-total','2');
  assert.equal(frontierNow().queued.find(q=>q.jobId===second).queuedBecause,'dependency');

  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=? OR json_extract(payload_json,'$.cut.ordinal')=1").run(composition));
  assert.equal(because(member).queuedBecause,'ready');
  assert.equal(because(second).queuedBecause,'ready');
});

// A StarCi Next Kernel held two cut ordinals behind a failed seam whose grants
// broke the Work layout and had no verb to retire them, so it could not re-plan.
test('reconcile --drop retires a never-dispatched queued job and names what waits on it',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-drop';
  const owner=ownerConfig(t,{budgets:{maxOps:null,perOpMs:null,dailyTokens:null}});
  seedGoal(repo,wf);
  const api=(...args)=>runApiAsOwner(owner,...args,'--repo',repo,'--json');
  const enq=(...extra)=>{const r=api('enqueue','--workflow',wf,...extra);assert.equal(r.status,0,r.stderr||r.stdout);return out(r).job_id;};
  const seam=enq('--op','docs.author','--paths','docs/cut-1','--cut-id','c1','--cut-ordinal','1','--cut-total','2');
  const second=enq('--op','docs.author','--paths','docs/cut-2','--cut-id','c1','--cut-ordinal','2','--cut-total','2');
  const third=enq('--op','docs.author','--paths','docs/after','--after',second);
  assert.notEqual(api('reconcile','--job',second,'--drop').status,0,'a drop keeps its reason');
  const dropped=api('reconcile','--job',second,'--drop','--reason','cut grants break the Work layout');
  assert.equal(dropped.status,0,dropped.stderr);
  assert.deepEqual([out(dropped).status,out(dropped).waiting],['cancelled',[third]]);
  const s=api('status','--workflow',wf);
  const q=out(s).frontier.queued;
  assert.equal(q.find(x=>x.jobId===third).queuedBecause,'dependency-failed','its dependant is the Kernel\'s to move now');
  assert.equal(q.some(x=>x.jobId===second),false);
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='running',worker_id='w-1' WHERE job_id=?").run(seam));
  const refused=api('reconcile','--job',seam,'--drop','--reason','x');
  assert.notEqual(refused.status,0,'a dispatched job settles through settle');
  assert.match(refused.stderr,/drop-not-queued/);
});

// Live Modules had nothing open but one unanswered tax ask whose job lineage
// did not survive a later same-op job; status called it orphaned-frontier and
// the watchdog woke the waiting kernel every five minutes.
test('no open operation plus an unanswered ask is awaiting-owner, not actionable',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-awaiting-owner';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    const job=(id,attempt,status,result)=>ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,result_json,created_at,updated_at)
      VALUES(?,?,?,?,0,'op','op',?,?,?,?,?)`).run(id,wf,'business.decide',attempt,json({opId:'business.decide'}),status,json(result),at+attempt,at+attempt);
    job('bd-tax',12,'failed',{verdict:'awaiting-owner',askDispatchId:'ctx_tax'});
    job('bd-record',13,'succeeded',{verdict:'pass'});
    ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,0,'ask',?,?,?)`)
      .run(wf,'ctx_tax','business.decide',12,json({outcome:'ask',summary:'tax',question:{text:'tax?'}}),at,at);
    ledger.appendEvent({workflowId:wf,entityType:'report',entityId:'ctx_tax',kind:'ask-serving',payload:{dispatchId:'ctx_tax',url:'http://127.0.0.1:6971/a-x'}});
  });
  const status=()=>{const r=runApi('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return out(r);};
  let s=status();
  assert.equal(s.frontier.state,'awaiting-owner');
  assert.equal(s.frontier.actionable,false);
  assert.deepEqual(s.awaitingOwner.map(a=>[a.jobId,a.answer]),[['bd-tax','pending']],'the pending ask is listed although a later attempt of the op exists');
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:'ctx_tax',kind:'ask-answered',payload:{dispatchId:'ctx_tax'}}));
  s=status();
  assert.equal(s.frontier.state,'orphaned-frontier','once answered the Kernel owes the next transition');
  assert.equal(s.frontier.actionable,true);
});

// A WSPV kernel consumed a done report and yielded before settling it; the
// frontier read engaged (not actionable) so nothing ever woke it.
test('a consumed report whose job is still running makes the frontier settle-ready',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-settle-ready';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES('impl-a35',?,'interface.implement',35,0,'op','op',?,'running',?,?)`).run(wf,json({opId:'interface.implement'}),at,at);
    ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at)
      VALUES(?,'impl-a35','interface.implement',35,0,'done',?,?,?)`).run(wf,json({outcome:'done',summary:'done'}),at,at);
  });
  const r=runApi('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr);
  const f=out(r).frontier;
  assert.equal(f.state,'settle-ready');
  assert.equal(f.actionable,true);
  assert.deepEqual(f.settleReadyJobs,['impl-a35']);
});

// A Collab kernel ran seven implementation slices in their Work records'
// dependsOn order while status called every waiting slice ready.
test('a Work record dependsOn owned by another open job holds the job as dependency; a succeeded owner releases it',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-record-deps';
  const owner=ownerConfig(t,{budgets:{maxOps:null,perOpMs:null,dailyTokens:null}});
  seedGoal(repo,wf);
  const rec=(name,deps)=>{const dir=path.join(repo,'.starciwork','features','f','impl','r',name);fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'index.yaml'),stringifyYaml({schema:'work/implementation@1',id:`impl.f.r.${name}`,dependsOn:deps.map(d=>`impl.f.r.${d}`)}));
    return `.starciwork/features/f/impl/r/${name}`;};
  const api=(...args)=>runApiAsOwner(owner,...args,'--repo',repo,'--json');
  const enq=(p)=>{const r=api('enqueue','--workflow',wf,'--op','docs.author','--paths',p);assert.equal(r.status,0,r.stderr||r.stdout);return out(r).job_id;};
  const base=enq(rec('composition',[]));
  const tasks=enq(rec('tasks',['composition']));
  const approval=enq(rec('approval',['composition','tasks']));
  const because=(id)=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr);return out(r).frontier.queued.find(q=>q.jobId===id);};
  assert.equal(because(base).queuedBecause,'ready');
  assert.deepEqual(because(tasks).blockedBy,{op:'docs.author',job:base});
  assert.equal(because(approval).queuedBecause,'dependency');
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=?").run(base));
  assert.equal(because(tasks).queuedBecause,'ready','the succeeded owner releases its dependents');
  assert.deepEqual(because(approval).blockedBy,{op:'docs.author',job:tasks});
});

// The Modules tax ask's serve-ask form hit its ttl while the kernel waited on
// the owner; the owner's link was dead and nothing re-served it.
test('an unanswered ask whose form expired is ask-reserve (actionable); a live form is awaiting-owner',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-ask-reserve';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,result_json,created_at,updated_at)
      VALUES('bd-tax',?,'business.decide',1,0,'op','op',?,'failed',?,?,?)`).run(wf,json({opId:'business.decide'}),json({verdict:'awaiting-owner',askDispatchId:'ctx_tax'}),at,at);
    ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at) VALUES(?,'ctx_tax','business.decide',1,0,'ask',?,?,?)`)
      .run(wf,json({outcome:'ask',summary:'tax',question:{text:'tax?'}}),at,at);
    ledger.appendEvent({workflowId:wf,entityType:'report',entityId:'ctx_tax',kind:'ask-serving',payload:{dispatchId:'ctx_tax',url:'http://127.0.0.1:6971/a-x'}});
  });
  const frontier=()=>{const r=runApi('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return out(r).frontier;};
  assert.equal(frontier().state,'awaiting-owner','a live form waits on the owner');
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:'ctx_tax',kind:'ask-serving-expired',payload:{dispatchId:'ctx_tax'}}));
  let f=frontier();
  assert.equal(f.state,'ask-reserve');
  assert.equal(f.actionable,true);
  assert.deepEqual(f.askReserveDispatches,['ctx_tax']);
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:'ctx_tax',kind:'ask-serving',payload:{dispatchId:'ctx_tax',url:'http://127.0.0.1:6971/a-y'}}));
  assert.equal(frontier().state,'awaiting-owner','re-served, it waits on the owner again');
});

// StarCi Next base-repos recorded an owner-gate for a missing brand before any
// frontend job could be enqueued; the frontier stayed orphaned/actionable
// (inc-103f2028ba77) and the watchdog woke a kernel that could only wait.
test('no open operation plus an open owner-gate incident is awaiting-owner',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-gate-no-job';
  seedGoal(repo,wf);
  seed(repo,ledger=>ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf));
  const status=()=>{const r=runApi('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return out(r).frontier;};
  assert.equal(status().state,'orphaned-frontier');
  const raised=runApi('incident','--repo',repo,'--workflow',wf,'--kind','owner-gate','--op','interface.scaffold','--detail','brand missing','--json');
  assert.equal(raised.status,0,raised.stderr);
  let f=status();
  assert.equal(f.state,'awaiting-owner');
  assert.equal(f.actionable,false);
  assert.match(f.reason,/owner-gate incident/);
  runApi('incident','--repo',repo,'--workflow',wf,'--resolve',out(raised).incidentId,'--json');
  assert.equal(status().state,'orphaned-frontier','resolved, the Kernel owes the next transition again');
});

test('hierarchy projects workflow -> Kernel -> Op from durable job identity',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-hierarchy';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,NULL,1,0,'kernel','kernel',?,'running',?,?,?)")
      .run(`kernel-${wf}`,wf,json({
        route:{host:'orca',agent:'codex',model:'gpt-6-sol',runtimePool:'codex-agent'},
        hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${wf}`,parentNodeId:`workflow:${wf}`,role:'kernel',runtime:{host:'orca',agent:'codex',model:'gpt-6-sol',terminalHandle:'term-kernel'}},
      }),'term-kernel',at,at);
  });
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const h=runApi('hierarchy','--repo',repo,'--workflow',wf,'--json');
  assert.equal(h.status,0,h.stderr);
  const body=out(h);
  assert.equal(body?.schema,'starci/agent-hierarchy@1');
  assert.equal(body?.workflow?.nodeId,`workflow:${wf}`);
  const kernel=body?.nodes?.find(n=>n.role==='kernel');
  const op=body?.nodes?.find(n=>n.role==='operation');
  assert.equal(kernel?.nodeId,`agent:kernel:${wf}`);
  assert.equal(kernel?.parentNodeId,`workflow:${wf}`);
  assert.equal(kernel?.runtime?.agent,'codex');
  assert.equal(kernel?.runtime?.model,'gpt-6-sol');
  assert.equal(op?.parentNodeId,kernel?.nodeId);
  assert.equal(op?.opId,'docs.author');
  assert.ok(body?.edges?.some(e=>e.parentNodeId===kernel.nodeId&&e.childNodeId===op.nodeId));
});

test('status projects exact host liveness and live jobs cannot route or dispatch again',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-liveness',jobId='op-k7-live';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'running',?,?,?)")
      .run(jobId,wf,'docs.author',json({opId:'docs.author',owned_paths:['docs/'],orca:{dispatchId:'ctx-k7-live',agentTerminalHandle:'term-k7-op'},hierarchy:{runtime:{host:'orca',agent:'devin',dispatchId:'ctx-k7-live',terminalHandle:'term-k7-op'}}}),'term-k7-op',at,at);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'docs.author',1,'ctx-k7-live','# live contract',json({}),at);
  });
  const fakeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-live-'));
  t.after(()=>fs.rmSync(fakeRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(fakeRoot,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const callsFile=path.join(fakeRoot,'calls.jsonl');
  fs.writeFileSync(path.join(fakeRoot,'state.json'),JSON.stringify({sends:1}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:callsFile,STARCI_FAKE_ORCA_STATE:path.join(fakeRoot,'state.json'),LOCALAPPDATA:path.join(fakeRoot,'localappdata')};
  const runLive=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const status=spawnSync(process.execPath,[API,'status','--repo',repo,'--workflow',wf,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(status.status,0,status.stderr||status.error?.message);
  const worker=out(status)?.workers?.find(item=>item.jobId===jobId);
  assert.equal(worker?.terminalHandle,'term-k7-op');
  assert.equal(worker?.liveness,'active');
  assert.equal(worker?.connected,true);
  assert.equal(worker?.writable,true);
  const route=runApi('route','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(route.status,0,'a live job must never be rerouted');
  assert.match(`${route.stdout}${route.stderr}`,/job-not-queued/);
  const dispatch=runApi('dispatch','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(dispatch.status,0,'a live job must never be dispatched twice');
  assert.match(`${dispatch.stdout}${dispatch.stderr}`,/job-not-queued/);

  // Regression for an old reserve-rejection bug: the ledger was returned to
  // queued and its lease dropped although the original exact worker stayed
  // alive. Status must expose that mismatch, duplicate route/dispatch must
  // fail closed, and reconcile reattaches the worker + lease without spawn.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,lease_token=NULL,deadline=NULL WHERE job_id=?").run(jobId));
  const driftStatus=runLive('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(driftStatus.status,0,driftStatus.stderr);
  const driftWorker=out(driftStatus)?.workers?.find(item=>item.jobId===jobId);
  assert.equal(driftWorker?.ledgerStatus,'queued');
  assert.equal(driftWorker?.liveness,'active');
  const driftRoute=runLive('route','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(driftRoute.status,0);
  assert.match(`${driftRoute.stdout}${driftRoute.stderr}`,/job-live-worker/);
  const driftDispatch=runLive('dispatch','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(driftDispatch.status,0);
  assert.match(`${driftDispatch.stdout}${driftDispatch.stderr}`,/job-live-worker/);
  const reconciled=runLive('reconcile','--repo',repo,'--job',jobId,'--json');
  assert.equal(reconciled.status,0,reconciled.stderr||reconciled.stdout);
  assert.equal(out(reconciled)?.status,'running');
  const repaired=read(repo,ledger=>({
    job:ledger.db.prepare('SELECT status,worker_id FROM jobs WHERE job_id=?').get(jobId),
    leases:ledger.db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(jobId).n,
  }));
  assert.equal(repaired.job?.status,'running');
  assert.equal(repaired.job?.worker_id,'term-k7-op');
  assert.equal(repaired.leases,1);
});

test('status distinguishes a turn-idle Op and nudge wakes the exact worker without creating a job',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-nudge',jobId='op-k7-idle';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'running',?,?,?)")
      .run(jobId,wf,'docs.author',json({opId:'docs.author',owned_paths:['docs/'],orca:{dispatchId:'ctx-k7-idle',agentTerminalHandle:'term-k7-idle'},hierarchy:{runtime:{host:'orca',agent:'devin',dispatchId:'ctx-k7-idle',terminalHandle:'term-k7-idle'}}}),'term-k7-idle',at,at);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'docs.author',1,'ctx-k7-idle','# idle contract',json({}),at);
  });
  const fakeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-nudge-'));
  t.after(()=>fs.rmSync(fakeRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(fakeRoot,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(fakeRoot,'state.json');fs.writeFileSync(stateFile,JSON.stringify({sends:0}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(fakeRoot,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile,LOCALAPPDATA:path.join(fakeRoot,'localappdata')};
  const runLive=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});

  const before=runLive('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(before.status,0,before.stderr);
  assert.equal(out(before)?.workers?.find(item=>item.jobId===jobId)?.liveness,'turn-idle');
  assert.equal(out(before)?.frontier?.state,'worker-nudge-ready');
  assert.deepEqual(out(before)?.frontier?.nudgeReadyJobs,[jobId]);

  const nudged=runLive('nudge','--repo',repo,'--job',jobId,'--json');
  assert.equal(nudged.status,0,nudged.stderr||nudged.stdout);
  assert.equal(out(nudged)?.nudged,true);
  assert.equal(JSON.parse(fs.readFileSync(stateFile,'utf8')).sends,1,'nudge must send once to the exact terminal');
  const durable=read(repo,ledger=>({
    jobs:ledger.db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n,
    status:ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status,
    event:ledger.db.prepare("SELECT kind FROM events WHERE workflow_id=? AND entity_id=? ORDER BY seq DESC LIMIT 1").get(wf,jobId)?.kind,
  }));
  assert.deepEqual(durable,{jobs:1,status:'running',event:'op-worker-nudged'});
  const after=runLive('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(out(after)?.workers?.find(item=>item.jobId===jobId)?.liveness,'active');
});

test('dispatch --job without --spawn prints the packet and leaves the job unclaimed',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-dispatch';
  seedGoal(repo,wf);
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/',
    '--records','scope.workspace-canonicalization','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=out(enq)?.jobId??out(enq)?.job_id??read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=?').get(wf))?.job_id;
  assert.ok(jobId,'could not resolve the enqueued job id');
  seed(repo,ledger=>ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
    .run(wf,1,'k7goal','# later approved revision',json({derivedFrom:'later-test-revision'}),Date.now()));
  const r=runApi('dispatch','--repo',repo,'--workflow',wf,'--job',jobId,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.ok(r.stdout.trim().length>0,'dispatch without --spawn should print the packet');
  const preview=out(r);
  assert.deepEqual(preview?.packet?.context?.records,['scope.workspace-canonicalization']);
  assert.deepEqual(preview?.packet?.context?.workflow,{id:wf,goal_revision:0,goal_identity:'k7goal'},
    'dispatch must keep the enqueue-time approved revision rather than silently adopting a later one');
  assert.match(preview?.prompt??'',/records: scope\.workspace-canonicalization/);
  assert.match(preview?.prompt??'',new RegExp(`workflow: ${wf} goal_revision=0 goal_identity=k7goal`));
  assert.match(preview?.prompt??'',new RegExp(path.join(ROOT,'CONTEXT.md').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    'an Op launched in a routed repo must receive the absolute canonical Source skill path');
  assert.match(preview?.prompt??'',new RegExp(path.join(ROOT,'modules','ops','ops','docs.author.yaml').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    'an Op must receive the absolute operation-contract path, not a cwd-relative modules path');
  assert.doesNotMatch(preview?.prompt??'',/CONTEXT\.md \(repo root\)/);
  const job=read(repo,l=>l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId));
  assert.notEqual(job?.status,'running','a packet print must not mark the job running — nothing was spawned');
});

// budgets.maxOps is the owner's per-workflow concurrency ceiling and it is
// ENFORCED: min(budgets.maxOps, runtimes.yaml maxParallelOps) is the line, and a
// job that meets it stays queued instead of launching.
test('budgets.maxOps refuses the second concurrent operation with max-ops and leaves it queued',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-max-ops';
  const owner=ownerConfig(t,{budgets:{maxOps:1,perOpMs:null,dailyTokens:null}});
  seedGoal(repo,wf);
  const first=runApiAsOwner(owner,'enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/a','--json');
  assert.equal(first.status,0,first.stderr);
  const second=runApiAsOwner(owner,'enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/b','--json');
  assert.equal(second.status,0,second.stderr);
  const [jobA,jobB]=read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=? ORDER BY attempt').all(wf)).map(r=>r.job_id);

  // Nothing is dispatched yet: two queued jobs hold no slot, so the first one is admitted.
  const admitted=runApiAsOwner(owner,'dispatch','--repo',repo,'--job',jobA,'--json');
  assert.equal(admitted.status,0,admitted.stderr||admitted.stdout);

  // The first operation now holds the workflow's one slot.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobA));
  const refused=runApiAsOwner(owner,'dispatch','--repo',repo,'--job',jobB,'--json');
  assert.notEqual(refused.status,0,'a second dispatch at budgets.maxOps:1 must refuse');
  const body=out(refused);
  assert.equal(body?.ok,false);
  assert.equal(body?.reason,'max-ops');
  assert.equal(body?.slots?.ceiling,1);
  assert.equal(body?.slots?.ceilingSource,'budgets.maxOps','the owner budget is the lower of the two ceilings');
  assert.equal(body?.slots?.running,1);
  assert.equal(read(repo,l=>l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobB)).status,'queued',
    'a refused dispatch reserves nothing — the job stays queued for the next slot');
  // route spends a model decision on a slot that does not exist; it refuses first.
  const routed=runApiAsOwner(owner,'route','--repo',repo,'--job',jobB,'--json');
  assert.notEqual(routed.status,0);
  assert.equal(out(routed)?.reason,'max-ops');

  // Free the slot and the same job is admitted with nothing else changed.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=?").run(jobA));
  assert.equal(runApiAsOwner(owner,'dispatch','--repo',repo,'--job',jobB,'--json').status,0,
    'a settled sibling releases the slot');
  // With no owner budget the fleet ceiling (runtimes.yaml maxParallelOps) admits alone.
  const unbounded=ownerConfig(t,{budgets:{maxOps:null,perOpMs:null,dailyTokens:null}});
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobA));
  assert.equal(runApiAsOwner(unbounded,'dispatch','--repo',repo,'--job',jobB,'--json').status,0,
    'one running operation is nowhere near maxParallelOps');
});

test('settle --verdict fail --report marks the job settled and appends an event',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-settle';
  seedGoal(repo,wf);
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=out(enq)?.jobId??out(enq)?.job_id??read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=?').get(wf))?.job_id;
  assert.ok(jobId);
  const reportFile=path.join(repo,'k7-report.json');
  fs.writeFileSync(reportFile,json({outcome:'failed',summary:'k7 settle smoke',checks:[]}));
  const before=read(repo,l=>l.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n);
  const r=runApi('settle','--repo',repo,'--workflow',wf,'--job',jobId,'--verdict','fail','--report',reportFile,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const after=read(repo,l=>({
    job:l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId),
    events:l.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n,
  }));
  assert.ok(after.job,'settled job row vanished');
  assert.ok(!['queued','running'].includes(after.job.status),`settled job still live: ${after.job.status}`);
  assert.ok(after.events>before,'settle appended no event');
});

test('cut pass requires the cut-aware green check names before settlement',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-cut-settle',jobId='op-k7-cut';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.enqueueJob({jobId,workflowId:wf,opId:'docs.author',kind:'op',payload:{
      opId:'docs.author',owned_paths:['docs/'],cut:{id:'cut-a',ordinal:1,total:2},
      orca:{dispatchId:'ctx-k7-cut',agentTerminalHandle:'term-k7-cut'},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'docs.author',1,'ctx-k7-cut','# cut contract',json({}),at);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,'ctx-k7-cut','docs.author',1,0,'done',json({outcome:'done'}),null,at);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,'docs.author',1,json({checks:[{name:'generic-green',exitCode:0}]}),at);
  });
  const refused=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.notEqual(refused.status,0,'generic green evidence must not settle a cut pass');
  assert.match(`${refused.stdout}${refused.stderr}`,/cut-checks-missing/);
  seed(repo,ledger=>ledger.db.prepare('UPDATE checks SET checks_json=? WHERE workflow_id=? AND op_id=? AND attempt=1')
    .run(json({checks:[
      {name:'cut-slice-postcondition',exitCode:0},
      {name:'cut-regression-inventory',exitCode:0},
    ]}),wf,'docs.author'));
  const accepted=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(accepted.status,0,accepted.stderr||accepted.stdout);
  assert.equal(read(repo,ledger=>ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status),'succeeded');
});

test('incident writes an incidents row for the workflow',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-incident';
  seedGoal(repo,wf);
  const r=runApi('incident','--repo',repo,'--workflow',wf,'--op','docs.author','--kind','test','--detail','k7 incident smoke','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const n=read(repo,l=>l.db.prepare('SELECT count(*) n FROM incidents WHERE workflow_id=?').get(wf).n);
  assert.ok(n>=1,'incident produced no incidents row');
});

test('finish finishes the workflow, closes its inbox and keeps the goals rows',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-finish';
  seedGoal(repo,wf);
  const fakeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-finish-'));
  t.after(()=>fs.rmSync(fakeRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(fakeRoot,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const callsFile=path.join(fakeRoot,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:callsFile,STARCI_FAKE_ORCA_STATE:path.join(fakeRoot,'state.json'),LOCALAPPDATA:path.join(fakeRoot,'localappdata')};
  seed(repo,ledger=>{
    const at=Date.now(),jobId=`kernel-${wf}`;
    ledger.enqueueJob({jobId,workflowId:wf,kind:'kernel',role:'kernel',payload:{
      hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${wf}`,parentNodeId:`workflow:${wf}`,
        role:'kernel',runtime:{host:'orca',agent:'codex',model:'gpt-6-sol',terminalHandle:'term-k7-kernel'}},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='term-k7-kernel' WHERE job_id=?").run(jobId);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,?,?,?,NULL)")
      .run(wf,'token-k7',json({terminal:'term-k7-kernel',modelAttested:true}),at);
  });
  const goalsBefore=read(repo,l=>l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n);
  assert.ok(goalsBefore>=1);
  const r=spawnSync(process.execPath,[API,'finish','--repo',repo,'--workflow',wf,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const after=read(repo,l=>({
    phase:l.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf)?.phase,
    pending:l.db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(wf).n,
    goals:l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n,
    kernel:l.db.prepare("SELECT status,worker_id,payload_json FROM jobs WHERE workflow_id=? AND kind='kernel'").get(wf),
    kernelSignals:l.db.prepare("SELECT count(*) n FROM signals WHERE scope='kernel' AND key=?").get(wf).n,
  }));
  assert.equal(after.phase,'finished','finish must set workflows.phase=finished');
  assert.equal(after.pending,0,'finish must close the workflow inbox — no pending rows left');
  assert.equal(after.goals,goalsBefore,'finish finishes the goal, it never deletes the record');
  assert.equal(after.kernelSignals,0,'finish releases the live Kernel singleton signal');
  assert.equal(after.kernel?.status,'succeeded');
  assert.equal(after.kernel?.worker_id,null);
  assert.equal(JSON.parse(after.kernel?.payload_json)?.hierarchy?.runtime?.terminalHandle,null);
  const calls=fs.readFileSync(callsFile,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line).argv);
  assert.ok(calls.some(argv=>argv.slice(0,2).join(' ')==='terminal close'&&argv.includes('term-k7-kernel')),
    'finish must request close of the exact Kernel terminal');
});

test('estimate sizes same-op slices from measured counts, never a guess',t=>{
  const fx=fixture(t),repo=fx.repo();
  seed(repo,ledger=>ledger.ensureWorkflow({workflowId:'wf-k7-estimate',title:'estimate smoke'}));
  const big=runApi('estimate','--repo',repo,'--files','40','--assertions','20','--components','9','--json');
  assert.equal(big.status,0,big.stderr);
  const b=out(big);
  assert.equal(b.minutes,328,'40*4 + 20*3 + 9*12 = 328 agent-minutes');
  assert.equal(b.size,'xl','40 files reaches allocation.slicing.size.xl.from.files');
  assert.equal(b.slices,b.agentsAchievable,'slices is retained as the agent count, never a second number');
  assert.equal(b.slices,6,'xl at gear 1 asks for 6 agents (runtimes.yaml allocation.slicing.size.xl.agents)');
  assert.equal(b.overTarget,true,'328 agent-min over 6 agents still exceeds targetMinutes[1]');
  const small=runApi('estimate','--repo',repo,'--files','3','--json');
  assert.equal(small.status,0,small.stderr);
  assert.equal(out(small).slices,1,'a 12-minute measure never cuts');
  const empty=runApi('estimate','--repo',repo,'--json');
  assert.notEqual(empty.status,0,'estimate with no measured count must refuse');
  assert.match(`${empty.stdout}${empty.stderr}`,/estimate-no-measure/);
});

// The owner's one knob, end to end: the measured closure lands in a size class,
// the class plus the gear names agentsRequested, and the closure's own disjoint
// path partition is what it can actually achieve.
// runtimes.yaml allocation.slicing {size, gears}; config.yaml parallel.gear.
test('estimate classifies s/m/l/xl and scales only l/xl by gear',t=>{
  const fx=fixture(t),repo=fx.repo();
  seed(repo,ledger=>ledger.ensureWorkflow({workflowId:'wf-k7-size',title:'size classes'}));
  const estimate=(...args)=>{
    const r=runApi('estimate','--repo',repo,...args,'--json');
    assert.equal(r.status,0,r.stderr||r.stdout);
    return out(r);
  };
  // s: the whole closure fits inside targetMinutes[0] (3 files * 4 = 12 <= 15).
  // m: past that window but short of every l bound (8 files * 4 = 32).
  // l: 12 files reaches size.l.from.files. xl: 40 reaches size.xl.from.files.
  const fixtures={s:['--files','3'],m:['--files','8'],l:['--files','12'],xl:['--files','40']};
  const expected={
    1:{s:[1,1],m:[1,1],l:[3,3],xl:[6,6]},
    2:{s:[1,1],m:[1,1],l:[5,5],xl:[10,10]},
  };
  for(const gear of [1,2]) for(const [size,args] of Object.entries(fixtures)){
    const e=estimate(...args,'--gear',String(gear));
    const [requested,achievable]=expected[gear][size];
    assert.equal(e.size,size,`${args.join(' ')} must classify ${size}, got ${e.size}`);
    assert.equal(e.gear,gear);
    assert.equal(e.gearSource,'flag','--gear is the dry-run override; it never writes');
    assert.equal(e.agentsRequested,requested,`${size} at gear ${gear} asks for ${requested} agents`);
    assert.equal(e.agentsAchievable,achievable);
    assert.equal(e.slices,e.agentsAchievable,'slices must stay equal to agentsAchievable');
    assert.equal(e.reason,null,'nothing bounded the request below it');
  }
  // s/m never fan out, whatever the gear.
  assert.deepEqual([estimate('--files','3','--gear','2').agentsRequested,estimate('--files','8','--gear','2').agentsRequested],[1,1]);
  // Without --gear the standing answer is the owner config, not a literal.
  const standing=estimate('--files','12');
  assert.equal(standing.gearSource,'config');
  assert.ok(standing.gears.includes(standing.gear),'the gear must come from the declared gears list');
  // An undeclared gear fails closed exactly like an undeclared config key.
  const bad=runApi('estimate','--repo',repo,'--files','12','--gear','7','--json');
  assert.notEqual(bad.status,0);
  assert.match(`${bad.stdout}${bad.stderr}`,/gear-undeclared/);
});

test('estimate bounds agentsAchievable by the disjoint path partition the closure actually holds',t=>{
  const fx=fixture(t),repo=fx.repo();
  seed(repo,ledger=>ledger.ensureWorkflow({workflowId:'wf-k7-achievable',title:'achievable'}));
  // Two top-level groups, one of them spelled twice: an xl closure at gear 2
  // asks for ten agents and can be cut into exactly two disjoint slices.
  const r=runApi('estimate','--repo',repo,'--files','40','--gear','2',
    '--paths','src/feature-a,src/feature-a/nested,lib/shared','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const e=out(r);
  assert.equal(e.size,'xl');
  assert.equal(e.agentsRequested,10,'xl at gear 2 requests 10');
  assert.equal(e.agentsAchievable,2,'a two-group closure cuts into two disjoint slices, however high the gear');
  assert.deepEqual(e.pathGroups,['lib/shared','src/feature-a'],'a descendant collapses into its owned ancestor');
  assert.equal(e.achievableBasis,'disjoint-owned-path-prefixes');
  assert.match(e.reason??'',/partitions into 2 pairwise-disjoint path prefix/);
  assert.equal(e.slices,2,'the N the --cut-total flags carry is the achievable count, not the requested one');
  // No closure supplied: the request stands, and the field says on what basis.
  const unbounded=out(runApi('estimate','--repo',repo,'--files','40','--gear','2','--json'));
  assert.equal(unbounded.agentsAchievable,10);
  assert.equal(unbounded.achievableBasis,'unbounded-no-path-closure');
  assert.equal(unbounded.reason,null);
  // A glob is not a concrete ownership boundary and never becomes a slice.
  const glob=runApi('estimate','--repo',repo,'--files','40','--paths','src/**/*.ts','--json');
  assert.notEqual(glob.status,0);
  assert.match(`${glob.stdout}${glob.stderr}`,/estimate-paths-invalid/);
});

test('a re-enqueued op carries its retry lineage: a business failure spends a business attempt, a no-effect rejection does not',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-retry-lineage';
  seedGoal(repo,wf);
  const enqueue=()=>{
    const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/','--json');
    assert.equal(r.status,0,r.stderr||r.error?.message);
    return out(r).job_id;
  };
  const payloadOf=jobId=>JSON.parse(read(repo,l=>l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)).payload_json);
  const settle=(jobId,result)=>seed(repo,l=>l.db.prepare("UPDATE jobs SET status='failed',result_json=? WHERE job_id=?").run(JSON.stringify(result),jobId));

  const first=enqueue();
  assert.equal(payloadOf(first).retry,undefined,'a first attempt supersedes nothing');

  // An ordinary failed attempt: the new row is a business retry.
  settle(first,{verdict:'fail'});
  const second=enqueue();
  assert.deepEqual([payloadOf(second).retry.attempt,payloadOf(second).retry.businessAttempt,
    payloadOf(second).retry.retryClass,payloadOf(second).retry.retryOf],[2,2,'business',first]);

  // A launch rejected before any effect is infrastructure: it consumes no business retry.
  settle(second,{reason:'dispatch-rejected',effectState:'none',retryable:true,attemptConsumed:false});
  const third=enqueue();
  assert.deepEqual([payloadOf(third).retry.businessAttempt,payloadOf(third).retry.retryClass,
    payloadOf(third).retry.consumesBusinessRetry],[2,'infrastructure',false]);
});

test('enqueue refuses an unbounded grant, an op with no brief, and a finished workflow',t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-enqueue-refusals';
  seedGoal(repo,wf);
  const rows=()=>read(repo,l=>l.db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n);
  const refusal=r=>JSON.parse(r.stderr.trim().split('\n').at(-1));

  const noPaths=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths',' , ','--json');
  assert.equal(noPaths.status,1,'an op with no owned_paths must not enqueue');
  assert.deepEqual([refusal(noPaths).ok,refusal(noPaths).code],[false,'empty-paths']);
  assert.equal(rows(),0,'a refused enqueue writes no jobs row');

  const custody=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/,.starciwork/kernel-evidence/'+wf+'/round2','--json');
  assert.equal(custody.status,1,'an op never owns kernel custody');
  assert.deepEqual([refusal(custody).ok,refusal(custody).code],[false,'path-kernel-custody']);
  assert.equal(rows(),0);

  const unknown=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/','--json');
  assert.equal(unknown.status,1,'an op with no brief must not enqueue');
  assert.deepEqual([refusal(unknown).ok,refusal(unknown).code],[false,'unknown-op']);
  assert.equal(rows(),0);

  seed(repo,ledger=>ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf));
  const finished=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/','--json');
  assert.equal(finished.status,1,'a finished phase takes no new work');
  assert.deepEqual([refusal(finished).ok,refusal(finished).code],[false,'workflow-finished']);
  assert.equal(rows(),0);
});
