import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {inspectLedger,ledgerFileFor,openLedger,releaseTwoPhase,reserveTwoPhase} from '../engine/ledger-db.mjs';
import {isLeaseOverlapRefusal,patternFindings} from '../scripts/supervisor/owed.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// nivo wf-nivo-modules-agentos-mudqjov6 (repeat-reject cae2e44b): the Kernel dispatched a qwen job
// twice and both were rejected at step `reserve` — "resource path:apps/app/src/messages/en.json
// overlaps durable lease …" — behind op-interface.implement-f291042a12, a running job of the SAME
// workflow holding en.json/vi.json for ~20 more minutes. A write set another job's live lease owns is
// a wait, not a launcher failure: route and dispatch leave the job queued (queuedBecause path-lease,
// naming the holder and its expiry), nothing is recorded as dispatch-rejected, repeat-reject never
// counts it, and once the holder releases the lease the job reads ready and dispatches.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WORKFLOW='wf-lease-wait';
const OP='code.refactor';
const EN='apps/app/src/messages/en.json',VI='apps/app/src/messages/vi.json';

const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write=(root,rel,body)=>{const abs=path.join(root,...rel.split('/'));fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);};
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-lease-wait-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');
  fs.mkdirSync(repo,{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  write(repo,'.gitignore','.starciwork/\n');
  for(const rel of [EN,VI,'apps/app/src/accounting/ledger.ts','apps/app/src/other/page.tsx'])write(repo,rel,'{}\n');
  git(repo,'add','-A');
  const past='2020-01-01T00:00:00Z';
  const c=spawnSync('git',['-C',repo,'commit','--quiet','-m','seed'],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past}});
  assert.equal(c.status,0,c.stderr);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    LOCALAPPDATA:path.join(root,'localappdata'),
  };
  const run=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
  const withWrite=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  withWrite(l=>{
    l.ensureWorkflow({workflowId:WORKFLOW,title:'lease wait'});
    l.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(WORKFLOW);
  });
  const inspect=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {root,repo,run,inspect,withWrite};
};
const leading=stdout=>{
  const open=stdout.indexOf('{'),close=stdout.indexOf('\n}');
  return JSON.parse(close<0?stdout.slice(open):stdout.slice(open,close+2));
};

test('reserveTwoPhase names the conflicting leases on its refusal so a caller can tell a wait from a failure',t=>withLedger(t,({ledger,machine})=>{
  for(const key of [`path:${EN}`,`path:${VI}`])ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  assert.equal(reserveTwoPhase(ledger,machine,{job:{jobId:'holder',workflowId:'wf',opId:'interface.implement',generation:1,kind:'op'},
    leases:[{resourceKey:`path:${EN}`,units:1},{resourceKey:`path:${VI}`,units:1}],ttlMs:20*60_000}).ok,true);
  const refused=reserveTwoPhase(ledger,machine,{job:{jobId:'waiter',workflowId:'wf',opId:'code.refactor',generation:1,kind:'op'},
    leases:[{resourceKey:`path:${EN}`,units:1}]});
  assert.equal(refused.ok,false);
  assert.equal(refused.pathConflicts.length,1);
  assert.deepEqual({...refused.pathConflicts[0],expiresAt:typeof refused.pathConflicts[0].expiresAt},
    {requested:`path:${EN}`,held:`path:${EN}`,jobId:'holder',workflowId:'wf',opId:'interface.implement',expiresAt:'number'});
}));

test('dispatch and route wait on a live path lease of the same workflow: queued path-lease, no reject, ready once released',t=>{
  const fx=fixture(t);
  const enqueue=paths=>{
    const r=fx.run('enqueue','--workflow',WORKFLOW,'--op',OP,'--paths',paths.join(','));
    assert.equal(r.status,0,r.stderr||r.stdout);
    return leading(r.stdout).job_id;
  };
  const holder=enqueue([EN,VI,'apps/app/src/accounting']);
  const first=fx.run('dispatch','--job',holder,'--model','qwen-agent','--spawn');
  assert.equal(first.status,0,`the holder dispatches: ${first.stderr||first.stdout}`);

  const waiter=enqueue([EN,'apps/app/src/other']);
  const events=()=>fx.inspect(db=>db.prepare("SELECT kind FROM events WHERE entity_id=? AND kind IN ('dispatch-rejected','route-decided','op-dispatched')").all(waiter).map(r=>r.kind));
  for(const attempt of [1,2]){
    const d=fx.run('dispatch','--job',waiter,'--model','qwen-agent','--spawn');
    assert.notEqual(d.status,0,`dispatch ${attempt} does not launch over a live lease`);
    const body=leading(d.stdout);
    assert.equal(body.reason,'path-lease');
    assert.equal(body.waiting,true);
    assert.equal(body.queuedBecause,'path-lease');
    assert.equal(body.rejected,undefined,'a lease wait is never a dispatch rejection');
    assert.equal(body.holders.length,1);
    assert.equal(body.holders[0].jobId,holder);
    assert.equal(body.holders[0].sameWorkflow,true);
    assert.ok(body.holders[0].expiresAt>Date.now(),'the holder expiry is named');
    assert.ok(body.detail.includes(`path:${EN} overlaps durable lease path:${EN} held by ${holder}`),body.detail);
    assert.match(body.detail,/do not re-dispatch it by hand/);
  }
  const routed=fx.run('route','--job',waiter);
  assert.notEqual(routed.status,0);
  assert.equal(leading(routed.stdout).reason,'path-lease','route spends no pool decision on a waiting job');
  assert.deepEqual(events(),[],'no dispatch-rejected, route-decided or op-dispatched event for the waiting job');
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(waiter).status),'queued');
  assert.deepEqual(fx.inspect(db=>db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(waiter)),[],'a waiting job holds nothing');

  const status=()=>leading(fx.run('status','--workflow',WORKFLOW).stdout).frontier;
  const waiting=status().queued.find(item=>item.jobId===waiter);
  assert.equal(waiting.queuedBecause,'path-lease');
  assert.equal(waiting.blockedBy.job,holder);
  assert.ok(Number(waiting.blockedBy.expiresAt)>Date.now());
  assert.match(waiting.detail,/becomes ready when .* settles and releases it/);

  // The holder settles: its lease rows go (settle's releaseTwoPhase), and the job reads ready.
  fx.withWrite(l=>releaseTwoPhase(l,null,{jobId:holder,status:'succeeded'}));
  assert.equal(status().queued.find(item=>item.jobId===waiter).queuedBecause,'ready');
  const now=fx.run('dispatch','--job',waiter,'--model','qwen-agent','--spawn');
  assert.equal(now.status,0,`released, the job dispatches: ${now.stderr||now.stdout}`);
  assert.deepEqual(events().filter(k=>k==='dispatch-rejected'),[]);
});

test('an expired lease row is no wait: reserve still refuses it as a recovery signal',t=>{
  const fx=fixture(t);
  const enqueue=paths=>leading(fx.run('enqueue','--workflow',WORKFLOW,'--op',OP,'--paths',paths.join(',')).stdout).job_id;
  const holder=enqueue([EN]);
  assert.equal(fx.run('dispatch','--job',holder,'--model','qwen-agent','--spawn').status,0);
  fx.withWrite(l=>l.db.prepare('UPDATE leases SET expires_at=1 WHERE job_id=?').run(holder));
  const waiter=enqueue([EN]);
  const d=fx.run('dispatch','--job',waiter,'--model','qwen-agent','--spawn');
  assert.notEqual(d.status,0);
  const body=leading(d.stdout);
  assert.equal(body.rejected,'dispatch-rejected');
  assert.equal(body.rejection.status,'queued','a no-effect reserve refusal keeps the job queued');
  assert.match(fx.inspect(db=>db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='dispatch-rejected'").get(waiter).payload_json),/overlaps durable lease/);
});

test('repeat-reject never counts a lease-overlap refusal; real launcher failures still count',t=>withLedger(t,({repoRoot,ledger})=>{
  const WF='wf-nivo-modules-agentos-mudqjov6',NOW=Date.now(),MIN=60_000;
  const overlap=`resource path:${EN} overlaps durable lease path:${EN} held by op-interface.implement-f291042a12; resource path:${EN} capacity 1 has 1 used and needs 1`;
  assert.equal(isLeaseOverlapRefusal({step:'reserve',error:overlap}),true);
  assert.equal(isLeaseOverlapRefusal({step:'reserve',error:`resource path:${EN} overlaps durable lease path:${EN} held by j1`}),true);
  assert.equal(isLeaseOverlapRefusal({step:'reserve',error:'machine arbiter unavailable: EBUSY'}),false);
  assert.equal(isLeaseOverlapRefusal({step:'reserve',error:`resource path:${EN} overlaps durable lease path:${EN} held by j1; resource path:x has no declared capacity`}),false,'a mixed refusal still counts');
  assert.equal(isLeaseOverlapRefusal({step:'task-create',error:overlap}),false);
  seedWorkflow(ledger,{id:WF,now:NOW-300*MIN,events:[
    ...[1,2].map(n=>({kind:'dispatch-rejected',entityType:'job',entityId:'op-code.refactor-qwen00000001',payload:{provider:'qwen',step:'reserve',error:overlap},created_at:NOW-n*10*MIN})),
    ...[1,2].map(n=>({kind:'dispatch-rejected',entityType:'job',entityId:`op-x-000000000${n}`,payload:{provider:'qwen',step:'reserve',error:'machine arbiter unavailable: EBUSY'},created_at:NOW-n*10*MIN})),
  ]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  const rejects=patternFindings(ledger.db,{repo:repoRoot,now:NOW,staleOf:()=>[]}).filter(f=>f.pattern==='repeat-reject');
  assert.equal(rejects.length,1,'only the launcher failure is a repeat-reject');
  assert.match(rejects[0].summary,/machine arbiter unavailable/);
  assert.doesNotMatch(rejects[0].summary,/overlaps durable lease/);
}));
