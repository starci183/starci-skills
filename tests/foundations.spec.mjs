import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {claimFoundation,declareDependent,landFoundation,normalizeFoundationName} from '../scripts/kernel/foundations.mjs';

// Owner, 2026-09-24: workflows sharing one repository planned independently and found their shared
// foundations mid-flight (nivo Collab held on Modules' layout tree rev behind an owner-gate that was
// really a peer dependency, inc-28187662c4fe; mia-mia brand.decide waited on base-repos' Grammar and
// FE app/ for a day). The ledger now keeps a registry of shared foundations - one OWNER workflow, a
// state, its dependents; a dependent waits with a typed peer-wait --until-foundation, and the owner's
// landing notifies every dependent and releases those waits. A workflow created after the change
// declares its foundations before its first leg once the ledger plans foundations at all.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));
const MOD='wf-nivo-modules',COLLAB='wf-nivo-collab',AUTH='wf-nivo-auth',OLD='wf-nivo-old';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-foundations-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  // The spec registry: foundation planning took effect on 2026-01-01, so the workflows created here
  // are "new" and OLD (created 2025) predates it.
  const registry=path.join(root,'contract-changes.yaml');
  fs.writeFileSync(registry,["schema: starci/contract-changes@1",'changes:','  - id: shared-foundation-planning',"    effectiveAt: '2026-01-01T00:00:00Z'",'    summary: spec','    reach: new-legs',''].join('\n'));
  const base={...process.env,STARCI_CONTRACT_CHANGES:registry};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete base[key];
  const api=(args,env={})=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...base,...env}});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    for(const workflowId of [MOD,COLLAB,AUTH,OLD]){
      ledger.ensureWorkflow({workflowId,title:workflowId,ledgerMode:'durable',sourceRoots:[repo]});
      ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({derivedFrom:'foundations-spec'}),at);
    }
    ledger.db.prepare('UPDATE workflows SET created_at=? WHERE workflow_id=?').run(Date.parse('2025-06-01T00:00:00Z'),OLD);
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const ok=(args,env)=>{const r=api(args,env);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const refused=(args,code,env)=>{const r=api(args,env);assert.equal(r.status,1,`${args.join(' ')} must be refused: ${r.stdout}`);const body=json(r.stdout)?.ok===false?json(r.stdout):lastLine(r.stderr);assert.equal(body?.code??body?.reason,code,r.stderr||r.stdout);return body;};
  const foundation=(wf,...rest)=>ok(['foundation','--workflow',wf,...rest]);
  return {repo,api,ok,refused,read,seed,foundation};
};

test('the registry records are pure: claim, dependent, land and their refusals',()=>{
  assert.equal(normalizeFoundationName(' Layout-Tree '),'layout-tree');
  assert.throws(()=>normalizeFoundationName('no spaces here'),{code:'foundation-name-invalid'});
  const dep=declareDependent(null,{name:'grammar',workflowId:'b',now:1});
  assert.deepEqual([dep.record.state,dep.record.owner,dep.record.dependents.map(d=>d.workflowId)],['unclaimed',null,['b']]);
  const claimed=claimFoundation(dep.record,{name:'grammar',workflowId:'a',ownerRunning:false,kind:'grammar',version:'0.5.0',now:2});
  assert.deepEqual([claimed.record.state,claimed.record.owner.workflowId,claimed.record.version],['claimed','a','0.5.0']);
  assert.throws(()=>claimFoundation(claimed.record,{name:'grammar',workflowId:'b',ownerRunning:true,now:3}),{code:'foundation-owned'});
  const taken=claimFoundation(claimed.record,{name:'grammar',workflowId:'b',ownerRunning:false,now:3});
  assert.equal(taken.transferredFrom,'a');
  assert.deepEqual(taken.record.dependents,[],'the new owner no longer depends on itself');
  assert.throws(()=>landFoundation(claimed.record,{name:'grammar',workflowId:'b',proof:'x',now:4}),{code:'foundation-not-owner'});
  assert.throws(()=>landFoundation(claimed.record,{name:'grammar',workflowId:'a',proof:' ',now:4}),{code:'foundation-proof-missing'});
  const landed=landFoundation(claimed.record,{name:'grammar',workflowId:'a',proof:'npm @starci/grammar@0.5.0 installed',now:5});
  assert.deepEqual([landed.record.state,landed.record.landed.version,landed.idempotent],['landed','0.5.0',false]);
  assert.equal(landFoundation(landed.record,{name:'grammar',workflowId:'a',proof:'again',now:6}).idempotent,true);
  const reopened=claimFoundation(landed.record,{name:'grammar',workflowId:'a',ownerRunning:true,version:'0.6.0',now:7});
  assert.deepEqual([reopened.reopened,reopened.record.state,reopened.record.landed],[true,'claimed',null]);
});

test('a dependent waits on the owner\'s foundation; the landing notifies it and releases the typed wait',t=>{
  const fx=fixture(t);
  const empty=fx.ok(['foundations']);
  assert.deepEqual(empty.foundations,[]);
  assert.deepEqual(empty.undeclared.sort(),[AUTH,COLLAB,MOD,OLD].sort());

  // Collab needs the layout tree before anyone owns it: the need is recorded, but no wait can name it.
  const need=fx.foundation(COLLAB,'--declare-dependent','layout-tree','--detail','the /chat composites sit in the Modules shell');
  assert.deepEqual([need.state,need.owner,need.dependents],['unclaimed',null,[COLLAB]]);
  assert.match(need.next,/nobody owns layout-tree yet/);
  fx.refused(['incident','--workflow',COLLAB,'--kind','peer-wait','--until-foundation','layout-tree','--detail','needs the shell'],'foundation-unowned');
  fx.refused(['incident','--workflow',COLLAB,'--kind','owner-gate','--until-foundation','layout-tree','--detail','x'],'peer-wait-kind-mismatch');

  const claim=fx.foundation(MOD,'--claim','layout-tree','--kind','layout-tree','--detail','App Router layout tree + ConsoleLayout captures');
  assert.deepEqual([claim.state,claim.owner,claim.dependents],['claimed',MOD,[COLLAB]]);
  fx.refused(['foundation','--workflow',COLLAB,'--claim','layout-tree'],'foundation-owned');
  fx.refused(['foundation','--workflow',COLLAB,'--land','layout-tree','--proof','x'],'foundation-not-owner');
  fx.refused(['foundation','--workflow',MOD,'--claim','layout-tree','--declare-none'],'foundation-action-invalid');
  fx.refused(['foundation','--workflow',COLLAB,'--declare-none'],'foundation-declared');
  fx.refused(['incident','--workflow',COLLAB,'--kind','peer-wait','--peer',AUTH,'--until-foundation','layout-tree','--detail','x'],'foundation-peer-mismatch');

  // The typed wait: its peer is the owner; the held op reads peer-wait and the frontier parks.
  const wait=fx.ok(['incident','--workflow',COLLAB,'--kind','peer-wait','--until-foundation','layout-tree','--op','docs.author','--detail','Collab redraw needs the new shell rev']);
  assert.deepEqual([wait.peer,wait.untilFoundation,wait.until],[MOD,'layout-tree',[{type:'foundation',name:'layout-tree'}]]);
  const job=fx.ok(['enqueue','--workflow',COLLAB,'--op','docs.author','--paths','docs/chat']).job_id;
  const front=fx.ok(['status','--workflow',COLLAB]);
  assert.deepEqual([front.frontier.state,front.frontier.actionable],['peer-wait',false]);
  assert.equal(front.frontier.queued.find(q=>q.jobId===job).queuedBecause,'peer-wait');
  assert.equal(front.frontier.peerWaits[0].untilFoundation,'layout-tree');
  assert.deepEqual(front.foundations.needs.map(f=>[f.name,f.state,f.owner]),[['layout-tree','claimed',MOD]]);
  const listed=fx.ok(['foundations']);
  assert.deepEqual(listed.foundations[0].waits,[{workflowId:COLLAB,incidentId:wait.incidentId,holds:['docs.author']}]);

  // The owner lands it: the wait is released, the dependent hears it, and a new wait is refused.
  const r=fx.api(['foundation','--workflow',MOD,'--land','layout-tree']);
  assert.equal(r.status,1,'a landing without its proof is refused');
  const land=fx.foundation(MOD,'--land','layout-tree','--version','rev-18','--proof','shell rev 18 commit abc123 captures /chat at desktop+mobile light','--refs','abc123');
  assert.deepEqual(land.released,[{workflowId:COLLAB,incidentId:wait.incidentId,holds:['docs.author']}]);
  assert.deepEqual(land.notified.map(m=>m.to),[COLLAB]);
  assert.deepEqual(land.wakes,[{workflowId:COLLAB,action:'kernel-signal-absent'}],'the wake is attempted (no Kernel terminal in a spec)');
  fx.read(db=>{
    assert.equal(db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(wait.incidentId).status,'resolved');
    const resolved=JSON.parse(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='incident-resolved'").get(wait.incidentId).payload_json);
    assert.deepEqual([resolved.foundation,resolved.by],['layout-tree','foundation-landed']);
  });
  const inbox=fx.ok(['inbox','--workflow',COLLAB]);
  assert.equal(inbox.pending.length,1);
  assert.match(inbox.pending[0].subject,/^foundation landed: layout-tree rev-18$/);
  assert.equal(fx.ok(['status','--workflow',COLLAB]).frontier.queued.find(q=>q.jobId===job).queuedBecause!=='peer-wait',true);
  fx.refused(['incident','--workflow',COLLAB,'--kind','peer-wait','--until-foundation','layout-tree','--detail','x'],'foundation-landed');
  assert.equal(fx.foundation(MOD,'--land','layout-tree','--version','rev-18','--proof','again').idempotent,true);
});

test('foundation writes are Kernel verbs; an op caller may read the registry only',t=>{
  const fx=fixture(t);
  fx.seed(l=>{
    l.enqueueJob({jobId:'job-op-f',workflowId:MOD,opId:'docs.author',kind:'op',payload:{opId:'docs.author',owned_paths:['docs/']}});
    l.db.prepare("UPDATE jobs SET status='running' WHERE job_id='job-op-f'").run();
  });
  const asOp={STARCI_ROLE:'op',STARCI_OP_JOB:'job-op-f'};
  const r=fx.api(['foundation','--workflow',MOD,'--claim','brand'],asOp);
  assert.equal(r.status,1);
  assert.equal(lastLine(r.stderr)?.code,'op-context-refused');
  assert.equal(fx.api(['foundations'],asOp).status,0);
});

test('a new workflow with running peers declares its foundations before its first leg once the ledger plans them; an old one is only advised',t=>{
  const fx=fixture(t);
  // Nothing registered in this ledger yet: every workflow is advised, none is held.
  const first=fx.ok(['enqueue','--workflow',MOD,'--op','docs.author','--paths','docs/a']);
  assert.match(first.foundationAdvisory,/declared no shared foundation/);

  // Once one workflow declares, the ledger plans foundations: a new undeclared workflow is refused.
  fx.foundation(AUTH,'--declare-none','--detail','auth builds on no shared foundation');
  const refusal=fx.refused(['enqueue','--workflow',MOD,'--op','docs.author','--paths','docs/b'],'foundations-undeclared');
  assert.match(refusal.detail,/api foundation --claim/);
  assert.equal(fx.ok(['status','--workflow',MOD]).foundations.required,true);
  // A workflow created before foundation planning is advised, never held (the versioned-contract rule).
  const old=fx.ok(['enqueue','--workflow',OLD,'--op','docs.author','--paths','docs/old']);
  assert.match(old.foundationAdvisory,/advised: it started before foundation planning/);
  // A declared workflow enqueues; --foundation marks its foundation legs, which lead the queue.
  assert.equal(fx.ok(['enqueue','--workflow',AUTH,'--op','docs.author','--paths','docs/auth']).foundationAdvisory,undefined);
  fx.refused(['enqueue','--workflow',MOD,'--op','docs.author','--paths','docs/c','--foundation','brand'],'foundation-not-owned');
  fx.foundation(MOD,'--claim','brand','--kind','brand');
  const feature=fx.ok(['enqueue','--workflow',MOD,'--op','docs.author','--paths','docs/feature']).job_id;
  const brandLeg=fx.ok(['enqueue','--workflow',MOD,'--op','docs.author','--paths','docs/brand','--foundation','brand']);
  assert.equal(brandLeg.foundation,'brand');
  const queued=fx.ok(['status','--workflow',MOD]).frontier.queued;
  assert.deepEqual(queued.slice(0,1).map(q=>[q.jobId,q.foundation]),[[brandLeg.job_id,'brand']]);
  assert.ok(queued.some(q=>q.jobId===feature&&!q.foundation));

  // An owner that stopped running hands its foundation to the next claimant.
  fx.seed(l=>l.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(MOD));
  const taken=fx.foundation(COLLAB,'--claim','brand');
  assert.equal(taken.transferredFrom,MOD);
  fx.refused(['foundation','--workflow',MOD,'--claim','grammar'],'workflow-not-running');
});

test('an open wait raised before the registry is typed onto a foundation with --attach and released by the landing',t=>{
  const fx=fixture(t);
  fx.foundation(MOD,'--claim','workspace-provision-module','--kind','module');
  // nivo AUTH inc-9f2e1e7ff1f6: a free-text peer-wait on the peer that owns the module; Collab inc-28187662c4fe:
  // an owner-gate that was really a peer dependency.
  const plain=fx.ok(['incident','--workflow',AUTH,'--kind','peer-wait','--peer',MOD,'--op','docs.author','--detail','app does not boot until WorkspaceProvisionModule exports its admission token']);
  const gate=fx.ok(['incident','--workflow',COLLAB,'--kind','owner-gate','--op','docs.author','--detail','Peer dependency: the provision module']);
  fx.refused(['incident','--workflow',AUTH,'--attach',plain.incidentId,'--until-foundation','nowhere'],'foundation-unknown');
  for(const [wf,inc] of [[AUTH,plain.incidentId],[COLLAB,gate.incidentId]]){
    const typed=fx.ok(['incident','--workflow',wf,'--attach',inc,'--until-foundation','workspace-provision-module']);
    assert.deepEqual([typed.status,typed.until],['open',[{type:'foundation',name:'workspace-provision-module'}]]);
  }
  assert.deepEqual(fx.ok(['foundations']).foundations[0].dependents.map(d=>d.workflowId).sort(),[AUTH,COLLAB].sort(),'typing a wait on it declares the dependency');
  const status=fx.ok(['status','--workflow',AUTH]).frontier;
  assert.equal(status.gateConditions?.[0]?.conditions?.[0]?.met,false);
  const land=fx.foundation(MOD,'--land','workspace-provision-module','--proof','commit 1a2b3c: WORKSPACE_PROVISIONING_ADMISSION exported; nivo lane boots');
  assert.deepEqual(land.released.map(r=>r.incidentId).sort(),[plain.incidentId,gate.incidentId].sort());
  assert.deepEqual(land.notified.map(m=>m.to).sort(),[AUTH,COLLAB].sort());
  fx.read(db=>{for(const inc of [plain.incidentId,gate.incidentId])assert.equal(db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(inc).status,'resolved');});
});
